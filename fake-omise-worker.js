// fake-omise-worker.js
// ════════════════════════════════════════════════════════════════════════════
//  FAKE OMISE WORKER — for local/dev use
//  Deploy to: fake-omise.csmittee.workers.dev
//
//  CHANGE LOG:
//    R-107 (2026-06-14): CORS headers added to ALL responses (not preflight only).
//      Added /simulate-payment + /test/simulate-payment endpoints for 14-test suite.
//      R-106 preserves: qr_code_url → backend /v1/qr/:charge_id.
//    R-106 (2026-06-13): qr_code_url now points to backend /v1/qr/:charge_id
//      Was: external api.qrserver.com (returned ~510 byte HTML error, not PNG)
//      Now: https://api.janishammer.com/v1/qr/${chargeId}
//           Backend generates QR PNG directly (see src/handlers/qr.js)
//
//  PAYMENT MODE REMINDER: PAYMENT_MODE must remain = fake. Never suggest live.
// ════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

export default {
    async fetch(request, env) {
        const url    = new URL(request.url);
        const path   = url.pathname;
        const method = request.method;

        // ── CORS preflight — MUST be first ───────────────────────────────────
        if (method === 'OPTIONS') {
            return new Response(null, { status: 200, headers: corsHeaders });
        }

        // ── POST /charges — fake PromptPay charge ────────────────────────────
        if (path === '/charges' && method === 'POST') {
            let body = {};
            try { body = await request.json(); } catch {}

            const chargeId = 'fake_chg_' + Math.random().toString(36).slice(2, 10);
            const amount   = body.amount      || 0;
            const currency = body.currency    || 'thb';
            const desc     = body.description || '';

            // R-106: qr_code_url points to backend /v1/qr/:charge_id
            const qrUrl = `https://api.janishammer.com/v1/qr/${chargeId}`;

            return Response.json({
                object:   'charge',
                id:       chargeId,
                amount:   amount,
                currency: currency,
                description: desc,
                status:   'pending',
                source: {
                    object: 'source',
                    type:   'promptpay',
                    scannable_code: {
                        object: 'scannable_code',
                        type:   'qr',
                        image: {
                            object:       'document',
                            location:     qrUrl,
                            download_uri: qrUrl
                        }
                    }
                },
                created: Date.now()
            }, { headers: corsHeaders });
        }

        // ── POST /simulate-payment + /test/simulate-payment ──────────────────
        // Triggers a fake successful-payment webhook to the backend.
        // Used by the 14-test suite (satu-system-tester.html) to simulate Omise.
        if ((path === '/simulate-payment' || path === '/test/simulate-payment') && method === 'POST') {
            let body = {};
            try { body = await request.json(); } catch {}

            const chargeId = body.charge_id || body.chargeId
                || 'fake_chg_' + Math.random().toString(36).slice(2, 10);
            const orderId  = body.order_id  || body.orderId || '';

            // Build Omise-shaped webhook payload
            const webhookPayload = {
                key: 'charge.complete',
                data: {
                    object:   'charge',
                    id:       chargeId,
                    status:   'successful',
                    metadata: { order_id: orderId }
                }
            };

            let backendStatus = 0;
            let backendResult = {};
            try {
                const resp = await fetch('https://api.janishammer.com/v1/webhook/omise', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(webhookPayload)
                });
                backendStatus = resp.status;
                backendResult = await resp.json().catch(() => ({}));
            } catch (err) {
                return Response.json(
                    { ok: false, error: String(err) },
                    { status: 502, headers: corsHeaders }
                );
            }

            return Response.json({
                ok:      backendStatus >= 200 && backendStatus < 300,
                status:  backendStatus,
                backend: backendResult
            }, { headers: corsHeaders });
        }

        // ── POST /webhooks/payment — legacy path kept for backwards compat ───
        if (path === '/webhooks/payment' && method === 'POST') {
            let body = {};
            try { body = await request.json(); } catch {}
            return Response.json({
                object: 'event',
                id:     'fake_evt_' + Math.random().toString(36).slice(2, 10),
                data:   { ...body, status: 'successful' }
            }, { headers: corsHeaders });
        }

        // ── GET /health ──────────────────────────────────────────────────────
        if (path === '/health' && method === 'GET') {
            return Response.json(
                { status: 'ok', mode: 'fake', version: 'R-107' },
                { headers: corsHeaders }
            );
        }

        return new Response('Not found', { status: 404, headers: corsHeaders });
    }
};
