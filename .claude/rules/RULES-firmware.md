# RULES-firmware.md — Satu 1.0
> Domain: Arduino/ESP32 firmware, library versions, NVS, compile constraints
> Load this file when: Any firmware discussion · compile errors · flash issues · NVS/config work
> Last updated: 2026-06-11
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
