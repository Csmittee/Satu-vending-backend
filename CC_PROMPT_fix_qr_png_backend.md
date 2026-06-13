# CC_PROMPT_fix_qr_png_backend.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix QR PNG — backend serves PNG directly, fake worker points to backend
> Repos: Satu-vending-backend + fake omise worker
> PR target: main (both repos)
> Mode: Backend fix — no firmware change needed
> Flash cycles: 0

---

## CC INTRO

New session. Ignore all previous context from other projects.

You are working on SATU 1.0 BACKEND at:
https://github.com/Csmittee/Satu-vending-backend

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ is archive only — never execute from there.

Read IN FULL and state each filename aloud:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. src/handlers/order.js      ← how qr_code_url is built in fake mode
5. src/index.js               ← route table, add new route here
6. CC_PROMPT_fix_qr_png_backend.md  ← this file, at repo root

State "All files read ✅" before writing a single line.
Then execute this prompt.

---

## CONTEXT — ROOT CAUSE CONFIRMED

Physical ESP32 (SATU-4R473R) calls `fetchImageBytes(qr_code_url)`.
The URL comes from the backend `qr_code_url` field in the order response.

In fake mode, `order.js` calls the fake omise worker at:
`https://fake-omise.csmittee.workers.dev/charges`

The fake worker builds:
```javascript
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
```

ESP32 fetches this external URL → `api.qrserver.com` returns ~500 bytes
(likely an HTML error response, not a PNG) → PNGdec rejects it.

Confirmed serial evidence:
```
fetchImageBytes: HTTP 200
fetchImageBytes: stream closed — transfer complete
fetchImageBytes: 510 bytes read
PNG open failed
```

A valid QR PNG at 200×200 is 2KB–5KB minimum.
510 bytes = HTML error page from api.qrserver.com, not a PNG.

The firmware fetch code is now correct (R-103, R-105).
The fix is entirely in the backend and fake worker — no firmware change.

---

## FIX — 3 parts

### Part 1 — src/handlers/qr.js (NEW FILE)

Create a new handler that generates a QR PNG and returns it.

Use the `qrcode` npm package — it works in Cloudflare Workers.
Add to package.json dependencies: `"qrcode": "^1.5.3"`

The endpoint receives a charge_id, looks up the order to get the
qr data string, generates a PNG buffer, returns it.

```
GET /v1/qr/:charge_id
- No auth required (QR URL is public, charge_id is unguessable)
- Look up order by omise_charge_id = charge_id
- If not found: 404
- Generate QR PNG from the charge_id string (or order_id — CC decides)
- Return: Content-Type: image/png, binary PNG body
- Size: 200×200 pixels minimum
```

If `qrcode` npm package is not available in Cloudflare Workers environment,
use an alternative pure-JS approach CC finds appropriate.
CC reads package.json and wrangler.toml to understand current dependencies
before choosing the QR generation method.

### Part 2 — src/index.js

Add route for the new endpoint:
```
GET /v1/qr/:charge_id → handleGetQrPng(charge_id, env)
```

Place it near the other order routes.

### Part 3 — fake omise worker (worker.js — separate deployment)

CC: note this file is NOT in the backend repo.
Owner will apply this change manually or via a separate worker deployment.

The one-line fix in worker.js `/charges` handler:

Change:
```javascript
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
```

To:
```javascript
const qrUrl = `https://api.janishammer.com/v1/qr/${chargeId}`;
```

CC: write the corrected worker.js as a complete file output so owner
can deploy it. Place in repo root or docs/ for owner reference.

---

## VERIFICATION

After backend deploys:
Test the new endpoint directly:
```
curl -o test_qr.png https://api.janishammer.com/v1/qr/fake_chg_test123
```
Expected: binary PNG file, 2KB+ size, opens as QR image.

Owner then triggers QR screen on SATU-4R473R (no flash needed — firmware is correct).
Expected serial:
```
[NET] fetchImageBytes: url=https://api.janishammer.com/v1/qr/fake_chg_xxx
[NET] fetchImageBytes: HTTP 200
[NET] fetchImageBytes: stream closed — transfer complete
[NET] fetchImageBytes: XXXX bytes read   ← expect 2000–5000
[UI] QR PNG loaded: XXXX bytes — rendering
```

Expected display: real QR PNG on screen (black/white pattern).

After QR confirmed: run 14-test suite → all 14 must still pass.

---

## DO NOT TOUCH
- hardware.h — R2 LOCKED
- firmware files — no firmware change needed
- PAYMENT_MODE — stays fake
- Existing order.js logic — only the qr_code_url construction in fake worker changes
- wrangler.toml — unless adding qrcode package requires it

---

## MANDATORY — end of session

1. Wait for GitHub Actions ✅ GREEN before PR
2. State "GitHub Actions compile: ✅ GREEN" in PR body
3. Run 14-test suite after backend change — all 14 must pass
4. Append to RULES.md at TOP:
```
R-106: QR PNG served by own backend — never external services.
GET /v1/qr/:charge_id returns image/png directly.
Fake worker qr_code_url points to api.janishammer.com/v1/qr/:charge_id.
Live Omise returns its own QR URL (real PromptPay PNG) — no change needed for live mode.
Confirmed fix: 2026-06-13. External api.qrserver.com returned HTML not PNG.
```
5. Update PROJECT_STATE.md — QR PNG: ✅ fixed (pending owner hardware verify)
6. Archive to docs/prompts/ stamped ✅ COMPLETE — 2026-06-13 — QR PNG backend endpoint
7. Merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.
