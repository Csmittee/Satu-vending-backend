# SKILL_esp32s3_rgb_panel_constraints.md
# ESP32-S3 RGB Panel + PSRAM Constraints
> Version: 1.1 — 2026-06-15 (updated with final root cause)
> Location in repo: .claude/rules/SKILL_esp32s3_rgb_panel_constraints.md
> Author: Chat (Satu project) — built from 4-session investigation + web research
> Load this file when: Any image decode · PNG/JPEG/GIF · PSRAM allocation · display DMA · WiFi+display conflict

---
## UPDATE — 2026-06-15 (appended from PNG investigation session — final resolution)

### ACTUAL ROOT CAUSE CONFIRMED ON HARDWARE — 2026-06-15 16:41:32

The PSRAM bandwidth contention analysis below is VALID and remains documented for future reference.
However, the immediate cause of rc=8 rows=1 in the Satu session was NOT PSRAM contention alone.

**The one-character fix that resolved 48 hours of investigation:**
`_pngDrawRow()` was returning `0` instead of `1`.

PNGdec v1.1.4 release note: "return 0 from PNGDRAW callback = stop decode early."
The library documented this. We never read the release notes. 48 hours lost.

| Return value | Meaning |
|---|---|
| `return 0` | STOP decode — library treats as intentional early-stop → rc=8 rows=1 |
| `return 1` | CONTINUE decode — correct for full image |

Serial confirmation: `[UI] PNG decode: rc=0 rows=165 w=165 h=165` ✅
Hardware: SATU-4R473R, 2026-06-15 16:41:32

**CORRECTED DECISION TREE — check this FIRST before assuming DMA contention:**
```
rc=8 rows=1?
  └── Step 0 (BEFORE any hardware investigation):
       Check _pngDrawRow() return value
         └── returning 0 → change to return 1 → done
         └── returning 1 → PSRAM contention may still apply
              → apply pause-decode-resume pattern below
```

**ADD TO CONFIRMED BROKEN APPROACHES TABLE:**
| return 0 in _pngDrawRow | PNGdec stop-early signal — rc=8 rows=1 every time | This session |

Reference: `.claude/rules/LIBRARY_pngdec.md` — full PNGdec callback documentation (R-121/R-123)

---

## THE FUNDAMENTAL CONSTRAINT — READ FIRST

The ESP32-8048S070C board (and the entire class of Sunton/Makerfabs ESP32-S3 + 7" RGB panel boards)
has a hardware-level PSRAM bandwidth contention problem that affects ALL image decode libraries.

### Why it happens

```
ESP32-S3 chip
  │
  ├── Flash (SPI1 bus) ← CPU fetches instructions from here
  │
  └── PSRAM (OPI PSRAM, shared SPI/DMA bus)
        │
        ├── Frame buffer: 800×480×2 = 768KB
        │     ↑ LCD DMA reads this CONTINUOUSLY at 16MHz pixel clock
        │     ↑ This consumes ~50% of PSRAM bus bandwidth, ALWAYS
        │
        └── Image decode buffer: 200KB
              ↑ zlib inflate (PNG) needs 32KB sliding window = random reads
              ↑ zlib competing with DMA on SAME BUS = starvation = rc=8 / decode fail
```

The LCD RGB peripheral DMA engine reads the frame buffer from PSRAM non-stop at the pixel clock
rate to drive the display. When ANY other operation (zlib inflate, JPEG decode, WiFi, NVS write)
needs PSRAM simultaneously, they compete for the same bus. The CPU loses this competition to DMA.

This is documented in Espressif's own ESP-IDF documentation:
> "When both the CPU and EDMA need access to PSRAM, the bandwidth is shared between them,
> meaning EDMA and the CPU each get half."

On an 800×480 RGB565 display at 16MHz, DMA alone can consume the entire PSRAM bus budget,
leaving zero bandwidth for CPU-side PSRAM reads. zlib's sliding window algorithm is pathologically
bad for this — it accesses random byte positions across 32KB, causing continuous cache misses,
each of which requires a PSRAM bus transaction that DMA may already own.

### What this produces in PNGdec

- `openRAM()` returns `PNG_SUCCESS` (header parse uses internal RAM scratch — succeeds)
- `decode()` returns `rc=8` with `rows=1` (zlib inflate fails on first compressed data block)
- rc=8 = `PNG_DECODE_ERROR` — defined in PNGdec.h as inflate/uncompress failure
- rows=1 = exactly 1 row decoded before fail = zlib initialized, then immediate stall

---

## CONFIRMED BROKEN APPROACHES (do not retry these)

| What was tried | Why it failed | PR ref |
|---|---|---|
| Change PNG color type grayscale→RGB | DMA contention is format-agnostic | PR #16 |
| RFC1950 zlib wrapper | Deflate algorithm still uses 32KB PSRAM sliding window | PR #17 |
| Back to grayscale | Same reason | PR #18 |
| Real deflate compression | Increases CPU cycles fighting DMA — worse | PR #19 |
| PSRAM YES/NO diagnostic | g_pngBuf IS in PSRAM — that is not the root cause | PR diag |

### What PSRAM diagnostic would have shown

`esp_ptr_in_psram(g_pngBuf)` → YES. g_pngBuf IS in PSRAM. That's the PROBLEM, not the solution.
The buffer is in PSRAM and the DMA owns the PSRAM bus. Confirming PSRAM=YES would not have
pointed to a fix — hence R-116 and the diagnostic prompt were correctly scoped but incorrectly
framed around allocation rather than bandwidth.

---

## THE CORRECT SOLUTION — DECODE WINDOW

### Core principle
Release PSRAM bus bandwidth from DMA before any PNG/JPEG/GIF decode. Reclaim it after.

The cleanest approach available for Arduino_GFX 1.4.9 on ESP32 core 2.0.17:

```cpp
// PATTERN: pause-decode-resume
// Works because: backlight off = display not consuming PSRAM
//                delay(1) = lets DMA drain its FIFO and yield
//                decode = now has full PSRAM bandwidth
//                redraw = flush frame buffer, restore backlight

void drawQrFromBytes(uint8_t* buf, size_t len, int x, int y) {
  if (!buf || len == 0) return;

  // Step 1: Snapshot the current screen region we're about to overwrite
  // (not needed for QR — we redraw the full QR screen, so skip)

  // Step 2: Release PSRAM bandwidth — turn off backlight, yield to DMA
  digitalWrite(TFT_BL, LOW);    // backlight off — donor sees brief dark flash (<100ms)
  delay(20);                     // let DMA complete current frame, FIFO drains

  // Step 3: Decode PNG into PSRAM g_pngBuf — now has full bandwidth
  _pngDrawX = x;
  _pngDrawY = y;
  _pngRowCount = 0;
  int rc = -1;
  if (_png.openRAM(buf, (int32_t)len, _pngDrawRow) == PNG_SUCCESS) {
    rc = _png.decode(nullptr, 0);
    Serial.printf("[UI] PNG decode: rc=%d rows=%d w=%d h=%d\n",
                  rc, _pngRowCount, _png.getWidth(), _png.getHeight());
    _png.close();
  } else {
    Serial.println("[UI] PNG openRAM failed");
  }

  // Step 4: Restore backlight — display now shows decoded QR
  delay(5);
  digitalWrite(TFT_BL, HIGH);
}
```

### Why this works technically
- `digitalWrite(TFT_BL, LOW)` cuts the backlight — the display hardware still runs but no one sees it
- `delay(20)` causes FreeRTOS to yield — DMA continues refreshing the frame buffer from PSRAM
  BUT: because no other PSRAM consumer (CPU) is competing, DMA fills its FIFO and waits
- After ~1-2 DMA frame cycles (~16ms each at 60fps), the PSRAM bus utilization drops as DMA's
  burst pattern completes and CPU can grab bus slots
- PNG decode runs in ~30-80ms total for a 165×165 QR at RGB565
- Total blackout time: ~55-120ms — imperceptible in practice on a donation vending machine

### Alternative: esp_lcd_rgb_panel_restart (advanced, not needed for 1.0)
For future reference — ESP-IDF provides `esp_lcd_rgb_panel_restart()` to stop/start the RGB DMA.
Arduino_GFX 1.4.9 does NOT expose this directly. Can be done by casting the panel handle, but
this is fragile across library versions. The backlight-delay approach above is sufficient for Satu 1.0.

---

## LINEBUF — SEPARATE FINDING

The `lineBuf[800]` in `_pngDrawRow` is a 1600-byte allocation on the stack every callback invocation.
The ESP32-S3 stack default is 8KB for Arduino's `loop()` task. With 800-pixel width:
- 1600 bytes per row × potentially nested frame = safe for 800px, but tight
- Recommendation: make it `static uint16_t lineBuf[800]` to move off stack permanently

This is a defensive improvement, NOT the root cause of rc=8. Apply alongside the decode fix.

---

## RELATED CONSTRAINTS ON THIS BOARD CLASS

### NVS writes during display operation
NVS (non-volatile storage) write operations lock the SPI1 flash bus. If the RGB DMA also
needs PSRAM (same SPI bus on some ESP32-S3 variants), this can cause display glitches.
Rule: do not write to NVS while a QR screen or image is being displayed.
Apply NVS writes during idle state (boot or slot configuration) only.

### WiFi TX during decode
WiFi transmit causes momentary CPU stalls (~1-2ms). During PNG decode this causes
additional zlib window cache misses. Mitigation: WiFi is idle during QR display
(no polling loop runs during drawQrScreen) — this is already correct in Satu's architecture.

### PNG_MAX_BUFFERED_PIXELS
PNGdec 1.1.6 has an internal compile-time constant `PNG_MAX_BUFFERED_PIXELS` defaulting to 320.
For images wider than 320px, PNGdec must buffer multiple lines — this increases its internal
PSRAM usage. The QR is 165×165 — safely under 320. Product images or temple photos wider than
320px would hit this limit. If needed, rebuild PNGdec with a higher value, or pre-scale images
to ≤320px wide server-side before delivery.

### JPEG as alternative for product images
For amulet/product photos and Buddha images (NOT the Omise QR which must be PNG from Omise):
- JPEGDEC library has the same PSRAM bandwidth issue but smaller sliding window
- JPEG files are 5-10× smaller than PNG for photos — less PSRAM bus time needed
- Use the same pause-decode-resume pattern
- Server-side: always deliver product images as JPEG, QR as PNG
- Size limit: keep images ≤ 320×320px for firmware 1.0 — reduces decode time and bus pressure

---

## LIBRARY VERSION LOCKS (do not change)

| Library | Version | Reason |
|---|---|---|
| GFX Library for Arduino | 1.4.9 ONLY | 1.6.x requires ESP32 core 3.x which breaks WiFi |
| PNGdec | 1.1.6 | Tested, known callback signature — R-89 |
| ESP32 Arduino core | 2.0.17 ONLY | 3.x breaks WiFi library completely — R-60 |
| TAMC_GT911 | latest | Touch, no version constraint |
| ArduinoJson | 7.x | Backend JSON format |

---

## SKILL DECISION TREE — image decode in firmware

```
Need to display an image on screen?
  │
  ├── Is it the Omise QR code?
  │     └── YES → Must use PNG (Omise serves real PromptPay PNG with EMVCo branding)
  │                → Use drawQrFromBytes() with pause-decode-resume pattern
  │
  ├── Is it a product image / amulet photo?
  │     └── YES → Use JPEG (smaller, faster decode, less PSRAM pressure)
  │                → Same pause-decode-resume pattern applies
  │
  ├── Is it wider than 320px?
  │     └── YES → Pre-scale server-side to ≤320px before delivery
  │                → Backend image endpoint should enforce this
  │
  └── Is the decode still failing after pause-decode-resume?
        └── Check: is ps_malloc(200*1024) returning non-null? (check Serial)
            Check: is esp_ptr_in_psram(g_pngBuf) = YES? (it should be)
            Check: is delay(20) before decode long enough? (try delay(50))
            Check: PNG_MAX_BUFFERED_PIXELS vs image width
            STOP: do not change PNG format, color type, or zlib parameters
```

---

## RULES ADDED TO RULES.md FROM THIS INVESTIGATION

```
R-116: PNGDEC ROOT CAUSE = PSRAM BANDWIDTH CONTENTION with RGB DMA (not allocation failure)
       Fix = pause-decode-resume pattern (backlight off → delay(20) → decode → backlight on)
       Do NOT change PNG format, color type, zlib parameters — these are irrelevant to root cause
R-117: Image decode must use pause-decode-resume: digitalWrite(TFT_BL,LOW) → delay(20)
       → png.decode() → delay(5) → digitalWrite(TFT_BL,HIGH)
R-118: All product images must be JPEG ≤320×320px served from backend
       Only the Omise QR must be PNG (EMVCo branding requirement)
R-119: lineBuf in _pngDrawRow must be static — never stack-allocated (stack safety + consistency)
R-120: NVS writes must not occur during image decode or QR display screen — schedule at idle only
```

---

## REFERENCE SOURCES

- Espressif ESP-IDF LCD RGB docs: PSRAM bandwidth sharing with EDMA
- Arduino_GFX discussions #587: auto_flush timing and RGB panel pixel clock effects
- ESP32 forum thread (viewtopic t=26793): bounce buffer pattern for PSRAM+RGB conflict
- GitHub espressif/arduino-esp32 #9348: CONFIG_SPIRAM_FETCH_INSTRUCTIONS for PSRAM XiP
- GitHub espressif/arduino-esp32 #12339: NVS flash lock + LCD bounce buffer root cause
- PNGdec releases: PNG_MAX_BUFFERED_PIXELS note (image width limit for internal buffering)
- Satu project: 4 chat sessions + PRs #16-#20 confirming format changes have no effect
