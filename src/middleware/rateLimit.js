// ════════════════════════════════════════════════════════════════════════════
//  SATU — RATE LIMITER (D1-backed, production-safe)
//  File: src/middleware/rateLimit.js
//
//  WHY THIS EXISTS:
//    The previous version used an in-memory Map. Cloudflare Workers run as
//    thousands of isolated V8 isolates — each instance has its own empty Map.
//    An attacker could hit POST /v1/order at full speed and every isolate
//    would see only 1 request. The limiter was completely ineffective.
//
//  HOW THIS WORKS:
//    Uses D1 (SQLite) as the shared counter store — all Worker instances
//    share the same D1 database. Each IP gets one row per time window.
//    On every request:
//      1. Upsert a row for (ip, window_key) — window_key is minute-precision
//      2. If count > MAX_REQUESTS → return 429
//      3. Otherwise → pass through to handler
//
//  DESIGN DECISIONS:
//    - Window key = floor(unix_seconds / 60) — simple tumbling 1-minute window
//    - UPSERT with count increment is a single atomic D1 operation (safe)
//    - Old rows are pruned periodically by the Cron job (see index.js scheduled)
//    - Limits are intentionally generous — this is anti-abuse, not throttling
//      legitimate temple donors who may share a temple WiFi IP
//    - Machine endpoints (/v1/machine/*) are NOT rate limited here —
//      they use device-secret auth instead. Only order creation is limited
//      because that's the one endpoint that costs money (Omise API call).
//
//  LIMITS (adjust constants below if needed):
//    - POST /v1/order : 20 requests per IP per minute
//      Rationale: A legitimate donor selects one item, pays, done. 20/min
//      is generous even for a busy temple. Bots hammering order creation
//      would exhaust Omise API quota and cost real money.
//
//  SCHEMA REQUIRED (run once in D1 console — included in schema.sql):
//    CREATE TABLE IF NOT EXISTS rate_limit_counters (
//        ip TEXT NOT NULL,
//        window_key INTEGER NOT NULL,
//        count INTEGER DEFAULT 0,
//        PRIMARY KEY (ip, window_key)
//    );
//
//  FUTURE:
//    If Cloudflare adds free KV writes or you upgrade to paid plan,
//    KV is faster for this pattern. D1 is correct and free for current scale.
// ════════════════════════════════════════════════════════════════════════════

const MAX_REQUESTS = 20;   // per IP per minute for POST /v1/order
const WINDOW_SECONDS = 60; // tumbling window size

export async function rateLimit(request, env, handler) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Math.floor(Date.now() / 1000);
    const windowKey = Math.floor(now / WINDOW_SECONDS); // changes every 60 seconds

    try {
        // Atomic upsert: insert row or increment existing count
        // SQLite UPSERT guarantees this is safe under concurrent writes
        await env.DB.prepare(`
            INSERT INTO rate_limit_counters (ip, window_key, count)
            VALUES (?, ?, 1)
            ON CONFLICT(ip, window_key) DO UPDATE SET count = count + 1
        `).bind(ip, windowKey).run();

        // Read the current count for this IP + window
        const row = await env.DB.prepare(`
            SELECT count FROM rate_limit_counters
            WHERE ip = ? AND window_key = ?
        `).bind(ip, windowKey).first();

        const count = row?.count ?? 1;

        if (count > MAX_REQUESTS) {
            // Return 429 with Retry-After header so well-behaved clients back off
            const retryAfter = WINDOW_SECONDS - (now % WINDOW_SECONDS);
            return new Response(
                JSON.stringify({
                    error: 'Rate limit exceeded',
                    message: `Too many requests. Max ${MAX_REQUESTS} per minute per IP.`,
                    retry_after_seconds: retryAfter
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': String(retryAfter),
                        'X-RateLimit-Limit': String(MAX_REQUESTS),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String((windowKey + 1) * WINDOW_SECONDS)
                    }
                }
            );
        }

        // Add rate limit headers to successful response for transparency
        const response = await handler();

        // Clone and add headers (Response is immutable)
        const newHeaders = new Headers(response.headers);
        newHeaders.set('X-RateLimit-Limit', String(MAX_REQUESTS));
        newHeaders.set('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - count)));
        newHeaders.set('X-RateLimit-Reset', String((windowKey + 1) * WINDOW_SECONDS));

        return new Response(response.body, {
            status: response.status,
            headers: newHeaders
        });

    } catch (err) {
        // If D1 is down or table missing, FAIL OPEN (let the request through)
        // Rationale: A broken rate limiter should not block real donors from paying.
        // Log the error so we know about it. Monitor D1 health separately.
        console.error('[rateLimit] D1 error — failing open:', err.message);
        return handler();
    }
}
