# CC_PROMPT_fix_qr_auth_cors.md
> Created by: Chat (Claude)
> Date: 2026-06-14
> Session goal: Fix two regressions introduced in PR #12
> Mode: Fix Mode (2 files, no firmware, 0 flash cycles)
> Repos: Satu-vending-backend (primary) + fake omise worker (worker.js)
> PR target: main

## ✅ COMPLETE — 2026-06-14 — QR auth + CORS fix (R-107)

### What was done
- **Regression 1 (Test 4 — HTTP 401):** GET /v1/qr/:charge_id confirmed correctly placed in
  public block of src/index.js (lines 132-136, before authenticateJWT call). No code change
  required — the route was already public from PR #12. 401 was from a stale deployment.
- **Regression 2 (Tests 7, 9 — "Failed to fetch"):** fake-omise-worker.js had two bugs:
  (a) CORS headers only on OPTIONS preflight — actual POST/GET responses had no CORS headers
      → browser blocks response body even after preflight succeeds
  (b) /simulate-payment and /test/simulate-payment endpoints missing entirely —
      14-test suite calls these paths, but worker only had /webhooks/payment
- **fake-omise-worker.js** (complete rewrite, PRESERVE checklist passed):
  - Added `corsHeaders` const, applied to ALL responses including 404
  - Added /simulate-payment + /test/simulate-payment → calls backend /v1/webhook/omise
  - Kept /charges (R-106 qr_code_url preserved), /webhooks/payment (legacy compat), /health
  - Version bumped to R-107
- **RULES.md:** R-107 prepended at TOP (rewrite PRESERVE checklist)
- **PROJECT_STATE.md:** session entry added

### Owner action required BEFORE testing
1. Copy `fake-omise-worker.js` (backend repo root) into fake omise worker project
2. Deploy: `wrangler deploy` in fake omise worker project
3. Run satu-system-tester.html → confirm 14/14

### Expected after deploy
- Test 4: QR URL → HTTP 200, Content-Type: image/png
- Tests 7, 9: simulate-payment → HTTP 200 JSON, no CORS error
- All 14 tests green

### PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake. Never suggest changing to live.
