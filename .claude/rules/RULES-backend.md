# RULES-backend.md — Satu 1.0
> Version 1.1 — 2026-06-19
> Changes: Added R-85 to R-142 moved from RULES.md
> Previous: v1.0 — 2026-06-11
> Domain: Cloudflare Workers, D1 database, API endpoints, payment gateway, frontend tools
> Load this file when: Any backend source change · payment logic · rate limiting · endpoint work · machine-builder HTML

---

## Core Backend Rules
- R-15: Run 14-test suite (satu-system-tester.html) after every backend change before closing
- R-14: Only 2 test devices allowed: `SATU-TEST001` (AA:BB:CC:DD:EE:00) + `SATU-SIM01` (AA:BB:CC:DD:EE:01)
- R-13: Ghost devices = never use random MACs in test tools — every random MAC creates a new DB row
- R-12: PAYMENT_MODE = `fake` for all dev/test · `live` only when real ESP32 is physically connected
- R-11: Rate limiting uses D1-backed counter — NOT in-memory Map (multi-instance bug was fixed Apr 2026)
- R-10: API base URL is always `https://api.janishammer.com` — never change without updating firmware

## Machine Builder Architecture (moved from RULES.md 2026-06-19)
- R-147: THREE-FILE MACHINE BUILDER — satu-machine-builder.html (A+B) · satu-hw-trigger.html (C) · satu-wiring.html (D).
         All self-contained. Serve at /satu-machine-builder, /satu-hw-trigger, /satu-wiring. Never merge.
- R-145: HTML >1000 lines → flag → split plan → CC executes with owner confirm. Each section = independent file.
- R-142: POST /v1/machine/command-inject = admin-auth test endpoint. X-Admin-Token required. Never in 14-test suite.
- R-127: Wiring tab = pin-level browser tool. HW constants from hardware.h + config.h — never from backend API.
         Motor stop = sensor-triggered (primary). VEND_MAX_SPIN_MS=30000ms = safety cutoff only.
- R-126: GET /v1/order/:id/status MUST return omise_charge_id. HW Trigger Lookup depends on it. Never remove.
         webhook.js UPDATE WHERE status IN ('pending','vend_failed') — allows re-test of timed-out orders.
- R-125: HW Trigger (satu-hw-trigger.html) = test-only hardware bypass. Payment buttons call fake-omise or
         webhook with status:'failed'. Dispensing buttons call /v1/machine/completion (LIVE 2026-06-16).
- R-124: fake-omise wraps charge in `{ key:'charge.complete', data:{...} }`. webhook.js uses: `const charge = payload.data || payload`.
         Real Omise sends charge at top level (payload.data=undefined) — falls back correctly. Preserve this pattern.
- R-100: Machine Farm stress test — max 3 concurrent machines. Promise.all() tests D1 contention + rate limits.
- R-98: Template literals in Workers HTML: JS inside `<script>` blocks inside template literals MUST use string
        concatenation — NOT backtick template literals. Write `</script>` as `<\/script>` in outer literal.
- R-97: wrangler.toml — `routes = [...]` must be top-level, never inside `[[d1_databases]]` or any `[section]`.
- R-94: THREE-TESTER ARCHITECTURE — satu-system-tester.html (14 tests, LOCKED) · simulator.html (touch UI) ·
        satu-machine-builder.html (node flow + fleet). No new test files without owner+Chat approval.

## Payment + QR (moved from RULES.md 2026-06-19)
- R-113: CompressionStream('deflate') + manual RFC 1950 wrap for PNG IDAT. See qr.js _zlibDeflate(). Never revert to stored blocks.
- R-112: PNG color type = GRAYSCALE (type 0) for PNGdec 1.1.6. RGB (type 2) breaks row stride → rc=8.
- R-110: CompressionStream('deflate') in CF Workers = raw RFC 1951 (no zlib header, no Adler-32). Must wrap manually.
- R-108: Public binary endpoints (image/png etc.) MUST accept both GET and HEAD. HEAD must not hit auth middleware.
- R-107: Any CC prompt rewriting an existing file MUST list PRESERVE items. Mandatory: CORS headers, public routes
         before auth middleware, idempotency guard + HMAC skip for fake_omise mode.
- R-106: GET /v1/qr/:charge_id returns image/png from backend. Never use external image services.
- R-109: ~~PNG color type RGB (type 2)~~ — SUPERSEDED BY R-112. Grayscale failure was bad zlib, not color type.
- R-114: ~~QR served as raw bitmap~~ — REVERTED (bitmap branch only, not on main). PNGdec now working. See R-117.

## Workflow (CC prompt rules moved from RULES.md)
- R-104: CC_PROMPT files at repo ROOT while active → move to docs/prompts/ stamped ✅ COMPLETE after merge.
         CC must NEVER execute from docs/prompts/.
- R-99: CC prompt naming: CC_PROMPT_fix / CC_BUILD_PROMPT / CC_PROMPT_firmware. Active at ROOT. Archive to docs/prompts/.
