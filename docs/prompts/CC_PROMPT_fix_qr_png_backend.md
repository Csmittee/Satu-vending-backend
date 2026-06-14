# CC_PROMPT_fix_qr_png_backend.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix QR PNG — backend serves PNG directly, fake worker points to backend
> Repos: Satu-vending-backend + fake omise worker
> PR target: main (both repos)
> Mode: Backend fix — no firmware change needed
> Flash cycles: 0

## ✅ COMPLETE — 2026-06-13 — QR PNG backend endpoint (R-106)

### What was done
- `src/handlers/qr.js` (NEW): GET /v1/qr/:charge_id → image/png
  Pure-JS QR matrix via qrcode.create() + CF Workers CompressionStream PNG encoder
  DB lookup verifies charge_id exists — 404 if not found
  5px/module scale + 4-module quiet zone — ~145–185px output for typical QR sizes
- `src/index.js`: added import + GET /v1/qr/:charge_id route (public, no auth, near order routes)
- `package.json`: added "qrcode": "^1.5.3"
- `fake-omise-worker.js` (NEW at repo root): corrected fake worker — owner must deploy
  qr_code_url was: https://api.qrserver.com/v1/create-qr-code/?...  (HTML error, not PNG)
  qr_code_url now: https://api.janishammer.com/v1/qr/${chargeId}
- `RULES.md`: R-106 prepended at TOP
- `PROJECT_STATE.md`: session entry added

### Root cause
api.qrserver.com returned ~510 bytes (HTML error page) instead of a PNG.
Firmware's blocking readBytes() fix (R-105) now correctly reads all bytes — but 510 bytes
of HTML is still rejected by PNGdec. Fix: backend generates PNG natively, no external service.

### Owner action required — BEFORE testing
1. Copy `fake-omise-worker.js` (at repo root) to your fake omise worker project
2. Deploy: `wrangler deploy` in the fake worker project
3. Trigger QR screen on SATU-4R473R (no firmware flash needed)

### Expected serial after fake worker redeployed
```
[NET] fetchImageBytes: url=https://api.janishammer.com/v1/qr/fake_chg_xxx
[NET] fetchImageBytes: HTTP 200
[NET] fetchImageBytes: Content-Length=XXXX
[NET] fetchImageBytes: stream closed — transfer complete
[NET] fetchImageBytes: XXXX bytes read   ← expect 2000–8000
[UI] QR PNG loaded: XXXX bytes — rendering
```
Expected display: black/white QR pattern on screen.

### Verify endpoint directly
```
curl -o test_qr.png https://api.janishammer.com/v1/qr/fake_chg_test123
```
Note: this will 404 until a real order with that charge_id exists. Use a real charge_id from an active order in D1.

### PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake.
Never suggest changing to live.
