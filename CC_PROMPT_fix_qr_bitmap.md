# CC_PROMPT_fix_qr_bitmap.md
> Created by: Chat (Claude) — 2026-06-14
> Session goal: Replace PNG QR delivery with raw bitmap — bypass PNGdec entirely
> Repo: Satu-vending-backend
> PR target: main
> Loop: A (backend only) — no firmware flash needed until backend PR merges
> Prompt: 1 of 2 (this = backend · next = CC_PROMPT_firmware_qr_bitmap.md)

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
3. PROJECT_STATE.md
4. src/handlers/qr.js        ← existing PNG handler — we are ADDING to this file
5. src/index.js              ← route table — we add one new route here
6. CC_PROMPT_fix_qr_bitmap.md ← this file

State "All files read ✅" then execute this prompt.

---

## CONTEXT — WHY PNG IS ABANDONED

PNGdec 1.1.6 on ESP32 has been tested with 4 PNG variants over PRs #16–#19:
- Grayscale + bad zlib → rc=8 rows=1
- RGB + stored zlib → rc=8 rows=1
- Grayscale + stored zlib → rc=8 rows=1
- Grayscale + real deflate → rc=2 rows=0

Every variant fails. The library is broken for our use case.
The PNG itself is valid (renders correctly in browser and simulator).
The fix is to stop using PNGdec entirely.

The QR image is binary — every pixel is either black (0x00) or white (0xFF).
We can serve raw pixel bytes. The firmware reads them with fetchImageBytes()
(already working — confirmed HTTP 200, correct byte count) and draws
with gfx->fillRect() directly. No decode library needed.

---

## TASK — Add one new endpoint to src/handlers/qr.js

### New endpoint: GET /v1/qr/:charge_id/bitmap

Add a new exported async function `handleGetQrBitmap(charge_id, env)`.

**Response format — binary, 1 byte per pixel:**
```
Byte 0–1:  width  as uint16 big-endian
Byte 2–3:  height as uint16 big-endian
Byte 4+:   pixels row by row, 1 byte each
            0x00 = black module
            0xFF = white (background)
```

**Implementation:**
```javascript
export async function handleGetQrBitmap(charge_id, env) {
    try {
        if (!charge_id || charge_id.length > 200) {
            return new Response('Invalid charge ID', { status: 400 });
        }

        const order = await env.DB.prepare(
            'SELECT order_id FROM orders WHERE omise_charge_id = ?'
        ).bind(charge_id).first();

        if (!order) {
            return new Response('Not found', { status: 404 });
        }

        const qr = QRCode.create(charge_id, { errorCorrectionLevel: 'M' });
        const { size, data } = qr.modules;
        const quiet = 4;
        const scale = 5;
        const dim   = (size + quiet * 2) * scale;

        // 4-byte header + 1 byte per pixel
        const buf = new Uint8Array(4 + dim * dim);
        // Header: width and height as uint16 big-endian
        buf[0] = (dim >> 8) & 0xFF;
        buf[1] =  dim       & 0xFF;
        buf[2] = (dim >> 8) & 0xFF;
        buf[3] =  dim       & 0xFF;

        // Pixels: white background
        buf.fill(0xFF, 4);

        // Draw black modules
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (data[r * size + c]) {
                    const px = (quiet + c) * scale;
                    const py = (quiet + r) * scale;
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dx = 0; dx < scale; dx++) {
                            buf[4 + (py + dy) * dim + (px + dx)] = 0x00;
                        }
                    }
                }
            }
        }

        return new Response(buf, {
            headers: {
                'Content-Type':   'application/octet-stream',
                'Content-Length': String(buf.length),
                'Cache-Control':  'public, max-age=3600',
            }
        });

    } catch (err) {
        console.error('[QR] handleGetQrBitmap error:', err);
        return new Response('Bitmap generation failed', { status: 500 });
    }
}
```

**Size check:** For a typical QR at size=33 modules: dim = (33+8)*5 = 205px.
Total bytes = 4 + 205*205 = 42,029 bytes (~41KB). Well within fetchImageBytes buffer.

---

## TASK — Wire route in src/index.js

Add to the PUBLIC routes block (same block as the existing `/v1/qr/` GET route,
BEFORE any auth middleware):

```javascript
// Bitmap endpoint — same public access rules as PNG endpoint (R-106, R-108)
if (path.match(/^\/v1\/qr\/[^/]+\/bitmap$/) && (method === 'GET' || method === 'HEAD')) {
    const charge_id = path.split('/')[3];
    return handleGetQrBitmap(charge_id, env);
}
```

Import `handleGetQrBitmap` at the top of index.js alongside the existing qr import.

---

## VERIFICATION — CC confirms before opening PR

```
curl -I https://api.janishammer.com/v1/qr/fake_chg_test123/bitmap
```
Expected: HTTP 200, Content-Type: application/octet-stream

```
curl -s https://api.janishammer.com/v1/qr/fake_chg_test123/bitmap | wc -c
```
Expected: 42029 or similar (4 + dim*dim bytes)

```
curl -s https://api.janishammer.com/v1/qr/nonexistent_id/bitmap -o /dev/null -w "%{http_code}"
```
Expected: 404

---

## DO NOT TOUCH
- hardware.h — R2 LOCKED — never open
- config.h
- state_machine.h
- Any firmware files
- PAYMENT_MODE — stays fake
- The existing handleGetQrPng function — leave it in place (HEAD route still needed for test suite)
- satu-system-tester.html — never modify
- The 14 existing test routes — do not move or reorder

---

## NEW RULE — append to RULES.md at TOP

```
R-113: QR IS SERVED AS RAW BITMAP — NOT PNG — PERMANENT (2026-06-14)
PNGdec 1.1.6 on ESP32 fails for all PNG variants tested (PRs #16–#19).
The QR bitmap endpoint GET /v1/qr/:charge_id/bitmap returns:
  4-byte header: width (uint16 BE) + height (uint16 BE)
  Then 1 byte per pixel: 0x00=black 0xFF=white, row by row
Firmware reads with fetchImageBytes(), draws with gfx->fillRect(). No decoder.
The PNG endpoint (GET /v1/qr/:charge_id) remains for browser/simulator use.
Never reintroduce PNGdec for QR rendering on this hardware.
```

---

## MANDATORY (end of session)

1. Run 14-test suite (satu-system-tester.html) — all 14 must still pass
2. Archive this prompt → docs/prompts/ stamped:
   `✅ COMPLETE — 2026-06-14 — Raw bitmap QR endpoint (R-113)`
3. Append R-113 to RULES.md (newest at TOP)
4. Update PROJECT_STATE.md:
   - Mark: QR bitmap endpoint ✅ deployed
   - Mark: PNG endpoint kept for browser/simulator
   - Add: firmware needs CC_PROMPT_firmware_qr_bitmap.md to use new endpoint
5. Commit and merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this entire session.
Never suggest changing to live.
