# LIBRARY_pngdec.md
> Library: PNGdec by Larry Bank (bitbank2)
> Version locked: 1.1.6
> Repo: https://github.com/bitbank2/PNGdec
> Added: 2026-06-15
> Onboarded by: Chat — after 48hr investigation (Satu project)

## WHAT IT DOES
Line-by-line PNG decoder for microcontrollers. Uses minimal RAM by decoding
one row at a time via callback. Does NOT require the full image in RAM.
Minimum 48KB RAM required for internal zlib state.

## CRITICAL — CALLBACK RETURN VALUES
**This is the #1 thing to check. Wrong return value = silent abort.**

```cpp
static int _pngDrawRow(PNGDRAW* pDraw) {
  // do your drawing here
  return 1;  // ← MUST BE 1 to continue decoding next row
             // ← return 0 = STOP DECODE EARLY (documented feature)
             // ← return 0 caused 48 hours of debugging in Satu project
}
```

From release notes (v1.1.4):
> "This release adds the ability to end the decode of an image early
>  if necessary by returning 0 from the PNGDRAW callback function."

**return 1 = continue. return 0 = abort. Never return 0 unless intentional.**

## CORRECT USAGE PATTERN
```cpp
PNG _png;
static int _drawRow(PNGDRAW* pDraw) {
  uint16_t lineBuf[320];  // or static for large widths
  _png.getLineAsRGB565(pDraw, lineBuf, PNG_RGB565_LITTLE_ENDIAN, 0xFFFFFFFF);
  // draw lineBuf to display here
  return 1;  // ← ALWAYS 1
}

// In your render function:
if (_png.openRAM(buf, len, _drawRow) == PNG_SUCCESS) {
  int rc = _png.decode(nullptr, 0);
  // rc=0 = success, rc=8 = decode error, rc=5 = unsupported feature
  _png.close();
}
```

## RC ERROR CODES
| Code | Meaning |
|---|---|
| 0 | PNG_SUCCESS |
| 5 | PNG_UNSUPPORTED_FEATURE (e.g. interlaced — not supported) |
| 8 | PNG_DECODE_ERROR — zlib inflate failed OR callback returned 0 |

**rc=8 with rows=1 = callback returned 0 on first row. Check return value first.**

## MEMORY FOOTPRINT
- Internal PNG struct: ~50KB — declare as static, not on stack
- zlib state: ~32KB sliding window — lives inside PNG struct
- lineBuf: `pDraw->iWidth * 2` bytes per row — use static for widths >320
- Input buffer: size of the PNG file — can be PSRAM or DRAM

## IMAGE WIDTH LIMIT
Default max width: 320px (PNG_MAX_BUFFERED_PIXELS compile-time constant).
For wider images, define before include:
```cpp
#define PNG_MAX_BUFFERED_PIXELS 800  // for 800px wide display
#include <PNGdec.h>
```

## KNOWN FAILURE MODES
| Symptom | Cause | Fix |
|---|---|---|
| rc=8 rows=1 | callback returns 0 | change return 0 → return 1 |
| rc=5 | interlaced PNG | re-encode PNG without interlacing |
| rc=8 rows=N (partial) | memory corruption in callback | check lineBuf size vs iWidth |
| openRAM fails | buffer pointer null or len=0 | check allocation before calling |
| Infinite loop (RP2040) | zlib inflate stall | known issue #25 — ESP32 not affected |

## WHAT NOT TO DO
- Never `return 0` from callback unless you intentionally want to stop early
- Never declare `PNG _png` on the stack — it is ~50KB, will overflow
- Never use `uint16_t lineBuf[800]` on stack inside callback — use `static`
- Never skip `_png.close()` after decode — leaks internal state
- Never ignore openRAM return value — always check == PNG_SUCCESS before decode

## VERSION LOCK REASON — 1.1.6
- 1.1.6: header changes for PNGenc coexistence — no functional change to decoder
- 1.1.5: added PNG_MAX_BUFFERED_PIXELS compile option
- 1.1.4: added return 0 = early stop feature (the one that bit us)
- Locked at 1.1.6 because callback signature and behavior are verified
- Do not upgrade without re-verifying callback return behavior

## RELEASE NOTES SUMMARY
| Version | Key change |
|---|---|
| 1.1.6 | Header coexistence with PNGenc — no decoder change |
| 1.1.5 | PNG_MAX_BUFFERED_PIXELS compile option for wide images |
| 1.1.4 | return 0 from callback = early stop (BREAKING for anyone using return 0) |
| 1.1.3 | IDAT size fix when smaller than 2K read buffer |
| earlier | LittleFS support, benchmark examples |
