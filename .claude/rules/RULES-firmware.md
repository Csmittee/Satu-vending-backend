# RULES-firmware.md — Satu 1.0
> Version 1.1 — 2026-06-19
> Changes: Added R-85 to R-123 moved from RULES.md
> Previous: v1.0 — 2026-06-11
> Domain: Arduino/ESP32 firmware, library versions, NVS, compile constraints
> Load this file when: Any firmware discussion · compile errors · flash issues · NVS/config work

---

## Library + IDE Rules (added 2026-05-29)
- R-67: Slot grid default = 10 (5×2) · max 21 (7×3) · scrollable if >10 · never tiny cells
- R-66: PAYMENT_GATEWAY + SYSTEM_MODE + FAKE_OMISE_URL = plain Variables not Secrets
- R-65: Omise gateway = 3 modes: fake_omise (dev) / omise_test (real QR) / omise_live (KYC done)
- R-64: /hello body field = "firmware" NOT "firmware_version" — backend expects exact name
- R-63: Arduino sketch folder = let IDE create it via File→New, NEVER create manually in Finder
- R-62: TFT_eSPI = REMOVE if installed — incompatible with RGB panel, causes compile errors
- R-61: GFX Library for Arduino (moononournation) = 1.4.9 ONLY — 1.6.5 requires core 3.x
- R-60: ESP32 Arduino core = 2.0.17 ONLY — 3.x breaks WiFi library completely

## Firmware Rules
- R-24: hardware.h abstraction supports both single and dual ESP32 — don't hardwire single-only logic
- R-23: Heartbeat every 5min · command poll every 30s · these are NOT negotiable timing values
- R-22: IR sensor E18-D80NK = NPN normally-open · SENSOR_TRIGGERED = LOW · mount 5-8cm below shelf
- R-21: device_id + device_secret must be persisted in NVS after /hello — never lost on reboot
- R-20: Variable declarations inside switch/case blocks MUST have braces `{}` — compile error otherwise

## WiFi / Credentials (moved from RULES.md 2026-06-19)
- R-86: config.h = gitignored local file for pin constants and build config only.
        config.h.example = tracked template — WIFI_SSID="" WIFI_PASSWORD="" intentional.
        On new machine: copy config.h.example → config.h, leave WiFi empty, flash, enter on screen.
- R-85: WiFi credentials NEVER in source files or git — NVS only (nvs_ssid / nvs_pass).
        config.h WIFI_SSID and WIFI_PASSWORD MUST remain empty strings ("") permanently.
        Credentials entered via drawWifiSetupScreen() → saveWifiAndReboot() → NVS. Never fill config.h WiFi fields.

## PNG / Image Decode (moved from RULES.md 2026-06-19)
- R-123: CALLBACK RETURN VALUES — for any library using callbacks, document return values in LIBRARY_xxx.md FIRST.
         PNGdec: return 0 = stop decode, return 1 = continue. See LIBRARY_pngdec.md.
- R-122: LIBRARY EXAMPLE FIRST — run designer's own simplest example on hardware before writing project code.
- R-121: LIBRARY ONBOARDING — visit designer's GitHub, read README+releases+examples, create LIBRARY_[name].md BEFORE writing code.
- R-120: NVS writes must not occur during image decode or QR display — schedule at idle only.
- R-119: lineBuf in _pngDrawRow must be static — never stack-allocated.
- R-118: Product images = JPEG ≤320×320px from backend. Only Omise QR = PNG (EMVCo requirement).
- R-117: PNG decode root cause CONFIRMED 2026-06-15: _pngDrawRow() returned 0 = PNGdec stop-early (v1.1.4 feature).
         Fix: return 1 in callback. rc=0 rows=165 confirmed on hardware. See LIBRARY_pngdec.md.
- R-116: PSRAM bandwidth contention with RGB DMA on ESP32-8048S070C — real constraint, documented for reference.
         If decode fails after return 1 fix: apply pause-decode-resume (TFT_BL off → delay(20) → decode → on).
         See SKILL_esp32s3_rgb_panel_constraints.md for full analysis.
