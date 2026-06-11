# CHAT HANDOFF — 2026-06-11
> Overwrite this file at end of every session — never append

## ⚠️ DO FIRST
1. Project → Files → GitHub sync checkbox → **CONFIRM CHECKED** (resets every new chat)
2. Paste this handoff into Chat

---

## 🆕 NEW SYSTEM (added 2026-06-11)
`WORKFLOW_SKILL.md` now exists in both backend and firmware repos.
Two loops documented: Loop A (cloud — automatable) and Loop B (firmware — requires owner flash).
Session closing discipline is now mandatory — see WORKFLOW_SKILL.md.

---

## WHAT HAPPENED LAST SESSION
Foundation docs session (CC_BUILD_PROMPT_foundation-docs.md):
- WORKFLOW_SKILL.md created (backend + firmware repos) — dual-loop, session modes, CC template
- CHAT_HANDOFF.md created (backend + firmware repos)
- KNOWLEDGE_MAP.md created (backend repo)
- RULES.md appended with R-83 (three-repo system) and R-84 (session closing discipline)
- PROJECT_STATE.md appended with workflow system section
- CLAUDE.md updated with new key files and hardware repo reference
- Hardware README.md expanded with key hardware facts

---

## CURRENT STATE — CONFIRMED WORKING

| Phase | What | Status |
|-------|------|--------|
| P1 | Backend API | ✅ DONE — 14/14 tests pass |
| P2 | Payment Gateway | 🟡 TEST KEYS ACTIVE — KYC/bank pending |
| P3 | Firmware R4 | ✅ WRITTEN — committed to firmware repo, NOT yet compiled or flashed |
| P4 | Hardware Build | 🔵 DESIGN DONE — components arriving |
| P5 | Temple Owner Dashboard | 🟡 PARTIAL — HTML built, backend patches not applied |
| P6 | Omise Live Keys | 🔴 BLOCKED — KYC incomplete |
| P7 | First Machine Field Test | ⬜ NOT STARTED |

---

## CURRENT STATE — PENDING / BROKEN

**Backend:**
- POST /v1/machine/heartbeat → HTTP 500 (connection_logs column mismatch)
- POST /v1/machine/completion → ❌ Missing (404) — firmware calls it
- machine_slots table not yet created → /hello does not return slots[]
- /v1/dashboard/orders → ❌ Missing
- Order expiry / QR timeout → pending orders never expire

**Firmware:**
- R4 written and merged — **NOT YET COMPILED OR FLASHED ON BOARD**
- ui.h service mode 5 tabs — status unclear from last CC build
- 14-test suite not run after R4 merge

**Legal / Business:**
- Omise KYC not complete — cannot go live
- PDPA consent flow incomplete — legal review required before any live install
- Utility model (IP) not filed — file before any public demo

---

## NEXT SESSION — EXACT ORDER

**Step 0:** Confirm this handoff was done (foundation-docs prompt) — ✅ if reading this file it was done

**Step 1:** Run 14-test suite (satu-system-tester.html) — must pass 14/14 before touching firmware
- Expected: all 14 pass (backend confirmed working)
- If any fail: fix backend first, do not proceed to firmware

**Step 2:** Firmware compile check — Verify only, no flash
- Pull new R4 files from firmware repo to local Arduino sketch folder
- Open Arduino IDE → Sketch → Verify
- Report exact error text to Chat if compile fails

**Step 3:** Flash and smoke test
- Flash to ESP32-S3 board
- Open serial monitor at 115200 baud
- Expected boot sequence:
  ```
  [BOOT] Satu starting...
  [NVS] Loading config...
  [WiFi] Connecting to [SSID]...
  [WiFi] Connected — IP: [xxx.xxx.xxx.xxx]
  [HELLO] Sending /hello to backend...
  [HELLO] device_id: SATU-XXXXXX
  [HELLO] Slots loaded: 10
  [STATE] → IDLE
  ```
- Report any deviation from expected to Chat

---

## OWNER ACTION REQUIRED

| Item | Priority | Notes |
|------|----------|-------|
| Omise KYC meeting | 🔴 BLOCKS LAUNCH | Sales meeting not yet held |
| Cloudflare variables | 🟡 REQUIRED | Convert FAKE_OMISE_URL, PAYMENT_GATEWAY, SYSTEM_MODE from Secret → Variable. Delete PAYMENT_MODE if present |
| config.h in repo | 🔴 SECURITY | config.h still exposed (WiFi credentials) — delete from repo + rotate WiFi password |
| Utility model (IP) | 🔴 TIME-SENSITIVE | File before any public demo at ipthailand.go.th |
| PDPA legal review | 🔴 LEGAL RISK | Before any live donor data collected |

---

## ARDUINO IDE SETTINGS

```
Board:       ESP32S3 Dev Module
Flash:       16MB (128Mb)
Partition:   16M Flash (3MB APP/9.9MB FATFS)
PSRAM:       OPI PSRAM  ← NEVER CHANGE — display breaks without this
Upload Speed: 460800
Port:        /dev/cu.usbserial-1420
```

---

## LIBRARIES INSTALLED

```
Arduino_GFX (moononournation) — v1.4.9 ONLY (1.6.5 requires core 3.x — DO NOT UPGRADE)
TAMC_GT911 — touch controller
PNGdec (bitbank2/Larry Bank) — v1.1.6 ONLY — pin this version
ArduinoJson — current stable
TFT_eSPI — REMOVE if installed (incompatible with RGB panel)
ESP32 core — 2.0.17 ONLY (3.x breaks WiFi completely)
```

---

## NVS KEYS (namespace: satu, all ≤15 chars)

```
device_id    dev_secret   wifi_ssid    wifi_pass
svc_pin      svc_pin_en   boot_pin     cfg_idle
cfg_sel      cfg_water    cfg_lucky    scr_theme
lang         vol          nvs_idc      nvs_grow
nvs_gcol
```
