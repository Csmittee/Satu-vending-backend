# CC_PROMPT_revert_qr_bitmap_experiment.md
✅ REVERTED — 2026-06-15 — bitmap experiment preserved not deleted

## What was reverted

- Backend PR #19 (real deflate R-113) and PR #20 (bitmap endpoint R-114) reverted from main
- Backend qr.js restored to PR #17 state (_zlibStore RFC 1950 manual blocks)
- Bitmap import/route removed from src/index.js
- version string back to R4 (was R4.1)
- Satu-Vending-Firmware PR #17 (bitmap, branch claude/cool-hopper-6owumd) closed without merging

## Why reverted

Bitmap approach confirmed working on hardware (serial: `[UI] drawQrFromBitmap: done`).
But it is fake-mode-only scaffolding:
- In live mode, Omise serves official PromptPay PNG with Thai branding + EMVCo payload embedded
- We cannot regenerate this PNG — we must decode it on the ESP32
- PNGdec must be fixed properly for all modes: QR codes, amulet photos, Buddha images, temple owner uploads
- Image rendering is CORE to this product, not optional

## What is preserved (do NOT delete)

- Backend branch `claude/vibrant-cray-cqp2em` — PRs #16–#19 (PNG variants)
- Backend branch `claude/cool-hopper-6owumd` — PR #20 (bitmap endpoint)
- Firmware branch `claude/cool-hopper-6owumd` — PR #17 (drawQrFromBitmap in ui.h)
- All PRs #16–#20 closed but visible in git history
- docs/prompts/ archive entries for all CC_PROMPTs executed

## Rules added this session

- **R-115** Critical Fix Escalation Protocol (PERMANENT) — stop at 2 loops, diagnose before coding
- **R-116** PNGdec Investigation Status — PSRAM allocation is prime suspect, measure before changing

## Next diagnostic step

Add immediately after `g_pngBuf = (uint8_t*)ps_malloc(200*1024);` in initUI():
```cpp
Serial.printf("[PSRAM] g_pngBuf in PSRAM: %s\n", esp_ptr_in_psram(g_pngBuf)?"YES":"NO");
```
Flash to SATU-4R473R. Report PSRAM=YES or PSRAM=NO.
- If **PSRAM=NO**: OPI PSRAM board setting likely wrong in Arduino IDE → zlib needs 32KB sliding window, internal RAM insufficient → PNGdec rc=8
- If **PSRAM=YES**: PSRAM correctly allocated → different root cause, continue investigation

## Payment mode reminder

PAYMENT_GATEWAY=fake_omise always. Never change.
