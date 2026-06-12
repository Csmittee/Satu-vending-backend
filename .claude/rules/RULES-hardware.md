# RULES-hardware.md — Satu 1.0
> Domain: Physical hardware, wiring, power supply, display, touch
> Load this file when: Any pin mapping · relay/sensor work · power decisions · hardware-layer code
> Last updated: 2026-06-11
---

- R-32: Display driver EK9716 — Arduino_GFX RGB panel only — TFT_eSPI is incompatible, remove if installed
- R-31: Touch controller GT911 — requires TAMC_GT911 library — NOT TFT_eSPI built-in
- R-30: Relay board needs separate 12V supply — NOT from ESP32-S3 5V (max 500mA)

## Key Hardware Reference (read Satu-vending-hardware repo before any hardware decision)
- Board: ESP32-8048S070C · ESP32-S3 · 16MB flash · 8MB OPI PSRAM
- Display: Arduino_GFX RGB panel 800×480 · backlight pin=2
- Touch: TAMC_GT911 · SDA=19 · SCL=20 · ROTATION_INVERTED
- MCP1 (0x20): sensors 1-8 · relays 1-6
- MCP2 (0x21): sensors 9-10 · relays 7-12 (R11=pump · R12=door lock)
- IR sensors: E18-D80NK · NPN normally-open · SENSOR_TRIGGERED=LOW · mount 5-8cm below shelf
