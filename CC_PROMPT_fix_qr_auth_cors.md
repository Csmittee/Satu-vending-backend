# CC_PROMPT_fix_qr_auth_cors.md
> Created by: Chat (Claude)
> Date: 2026-06-14
> Session goal: Fix two regressions introduced in PR #12
> Mode: Fix Mode (2 files, no firmware, 0 flash cycles)
> Repos: Satu-vending-backend (primary) + fake omise worker (worker.js)
> PR target: main

---

## CC INTRO

New session. Ignore all previous context from other projects.

You are working on SATU 1.0 BACKEND at:
https://github.com/Csmittee/Satu-vending-backend

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ is archive only — never execute from there.

Read IN FULL and state each filename aloud before writing a single line:
1. CLAUDE.md
2. RULES.md
3. src/index.js          ← route ordering — public vs auth-gated
4. src/handlers/qr.js   ← the new handler from PR #12
5. fake-omise-worker.js  ← the rewritten worker from PR #12 (or worker.js — check root)
6. CC_PROMPT_fix_qr_auth_cors.md  ← this file

State "All files read ✅" before writing a single line.

---

## CONTEXT — TWO REGRESSIONS FROM PR #12

After PR #12 merged, the 14-test suite now fails on tests 4, 7, and 9.

### Regression 1 — Test 4: QR endpoint returns HTTP 401

```
Result: QR URL valid (HTTP 401)
URL: https://api.janishammer.com/v1/qr/fake_chg_au45v13z
```

Root cause: `GET /v1/qr/:charge_id` was placed AFTER the auth middleware
in `src/index.js`. It is a public endpoint — no auth should be required.
The charge_id is unguessable (random string) — that IS the access control.

### Regression 2 — Tests 7 & 9: "Failed to fetch" on fake omise worker

```
Error: Failed to fetch
```

Root cause: The rewritten `worker.js` dropped the CORS headers that the
previous version had. The 14-test suite runs in a browser and calls
`fake-omise.csmittee.workers.dev/simulate-payment` directly.
Without CORS headers, the browser blocks the request.

These tests were passing 14/14 before PR #12. Both regressions are PR #12 bugs.

---

## FIX 1 — src/index.js: Move QR route to public block

Read `src/index.js` carefully. Find the section that handles public routes
(no auth required) — these are routes processed BEFORE the JWT middleware runs.

Locate `GET /v1/qr/:charge_id` and confirm it is currently placed incorrectly
(behind auth). Move it to the PUBLIC routes block, alongside routes like:
- GET /health
- POST /v1/order
- POST /v1/webhook/omise
- GET /v1/order/:id/status

The route must be reachable with NO Authorization header and NO X-Device-Secret.

Do NOT move any other routes. Do NOT change any auth logic.

### Verification CC must perform before committing:
```
curl https://api.janishammer.com/v1/qr/fake_chg_test123
```
Expected: HTTP 200, Content-Type: image/png (not 401, not 403)

---

## FIX 2 — worker.js (fake omise worker): Restore CORS headers

The fake omise worker (separate Cloudflare deployment, not in the backend repo)
was rewritten in PR #12. The rewrite dropped CORS headers.

Rewrite `worker.js` as a complete file with CORS headers on ALL responses.

### PRESERVE — these must survive this rewrite:
- `Access-Control-Allow-Origin: *` on every response
- `Access-Control-Allow-Methods: GET, POST, OPTIONS` on every response
- `Access-Control-Allow-Headers: Content-Type` on every response
- OPTIONS preflight handler at the TOP of the fetch handler (returns 200 before any routing)
- `/charges` endpoint — creates fake charge, returns `qr_code_url` pointing to `https://api.janishammer.com/v1/qr/${chargeId}`
- `/simulate-payment` endpoint — triggers webhook callback to backend
- `/test/simulate-payment` endpoint alias (some callers use this path)

### The CORS pattern for every Response in this file:
```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Preflight — must be FIRST in fetch handler
if (request.method === 'OPTIONS') {
  return new Response(null, { status: 200, headers: corsHeaders });
}

// All other responses include corsHeaders:
return Response.json({ ... }, { headers: corsHeaders });
```

CC: write the complete corrected `worker.js` as a full file output.
Place it in the backend repo root as `fake-omise-worker.js` for owner reference.
Owner will copy this into the fake omise worker project and run `wrangler deploy`.

---

## DO NOT TOUCH
- hardware.h — R2 LOCKED — never open
- Any firmware files
- PAYMENT_MODE — stays fake
- src/handlers/qr.js — the QR generation logic is correct, do not change
- The 14-test suite (satu-system-tester.html) — never modify
- wrangler.toml — no changes needed
- Any other routes in index.js — only move the QR route position

---

## NEW RULE — append to RULES.md at TOP

```
R-107: Any CC prompt that rewrites an EXISTING file MUST include a PRESERVE section
listing behaviours that must survive the rewrite. CC must verify each item is present
in the output before committing.
Minimum mandatory PRESERVE items:
  - worker.js: CORS headers on ALL responses + OPTIONS preflight handler at top
  - index.js: all public routes placed BEFORE any auth middleware block
  - webhook.js: idempotency guard + HMAC skip for fake_omise mode
Failure to preserve = regression. Regressions require a new fix PR. (Added 2026-06-14)
```

---

## VERIFICATION STEPS — CC confirms ALL before opening PR

1. `curl https://api.janishammer.com/v1/qr/fake_chg_test123` → HTTP 200, image/png
2. `curl -X OPTIONS https://fake-omise.csmittee.workers.dev/simulate-payment` → HTTP 200 with CORS headers
3. `curl -X POST https://fake-omise.csmittee.workers.dev/simulate-payment -H "Content-Type: application/json" -d '{"order_id":"test"}'` → HTTP 200 JSON response
4. GitHub Actions compile: ✅ GREEN before opening PR

---

## MANDATORY — end of session

1. GitHub Actions ✅ GREEN before PR — state this in PR body
2. Append R-107 to RULES.md at TOP (see above)
3. Update PROJECT_STATE.md:
   - QR endpoint: ✅ public (no auth)
   - Fake worker CORS: ✅ restored
   - 14-test suite: target 14/14
4. Archive this file → docs/prompts/ stamped ✅ COMPLETE — 2026-06-14 — QR auth + CORS fix
5. Merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.

## OWNER ACTION AFTER PR MERGES
1. Copy `fake-omise-worker.js` from backend repo root into fake omise worker project
2. Run `wrangler deploy` in fake omise worker project
3. Run `satu-system-tester.html` → confirm 14/14 passing
4. Report result to Chat
