# CHAT_HANDOFF.md — Session: 2026-05-31
<!-- Paste this at the start of every new chat session -->

## MANDATORY PRE-FLIGHT — DO THIS BEFORE WRITING ANY CODE

1. Read KNOWLEDGE_MAP.md — it tells you which doc to read for which task
2. Read SECURITY.md — before touching any auth, ownership, or factory reset code
3. Read UI_SPEC.md — before touching ui.h or any drawXxx() function
4. Ask user to upload current LOCAL Arduino files — do NOT use repo versions
5. Do NOT touch hardware.h under any circumstances

## File Touch Rules

| File | Rule |
|------|------|
| `hardware.h` | LOCKED R2 — never open, never modify, never copy its declarations |
| `ui.h` | Full rewrite in R4 — see UI_SPEC.md for complete spec |
| `network.h` | Add fetchImageBytes() for PNG, add config parsing |
| `config.h` | NUM_SLOTS=10 must stay — add NVS key comment block only |
| `satu_vending.ino` | Add new states: setup code, boot PIN, nuke, debug gesture |
| `state_machine.h` | Stable — only add states if absolutely needed |

## What Happened This Session (2026-05-31)

1. Read all local firmware files directly (not from repo)
2. Found and documented critical bugs in current local files (see bugs section below)
3. Designed complete grid system: R×Out with A/B/C side tabs when R≥3
4. Designed full ownership/security model: 6-digit setup code, claim flow, factory reset, nuke, debug mode
5. Decided QR format: PNG via PNGdec library (shows exactly what Omise sends)
6. Decided numpad: overlay on current screen (not full screen replacement)
7. Designed complete service mode 5-tab spec (all in UI_SPEC.md)
8. Added language selector (EN/TH toggle, TH is placeholder in R4)
9. Added idle screen instruction text + pulse animation
10. Added boot PIN feature (BOOT_PIN)
11. Added WiFi via NVS (Settings tab, no reflash needed)
12. Added factory reset → calls backend first requirement
13. Added nuke command handler
14. Added debug mode (5s hold bottom-left)
15. Produced: CC_BUILD_PROMPT_R4.md, UI_SPEC.md, SECURITY.md, KNOWLEDGE_MAP.md

## Bugs Found in Current Local Files

| Severity | File | Bug |
|----------|------|-----|
| COMPILE ERROR | satu_vending.ino | Calls idleAnimation() for screen flash, but ui.h function is idleAnimationUI() — these are different. hardware.h has idleAnimation() (LEDs). Need explicit calls to both. |
| RUNTIME | satu_vending.ino | STATE_SERVICE case missing from runStateMachine() switch — gesture detected, setState() called, but nothing draws |
| LOGIC | satu_vending.ino | laneErrorCount array uses NUM_SLOTS (=10) but comment says MAX_SLOTS_HW — consistent but comment is wrong |
| LOGIC | network.h | _sendHello sends "firmware_version" field? Verify it sends "firmware" — check preflight tool |
| SECURITY | config.h | WiFi SSID and password in plaintext — add to .gitignore before any public sharing |

## Current Board Status (SATU-4R473R)

- ✅ WiFi connects (Jaydahome2.4G)
- ✅ /hello OK — returns active, 3 slots
- ✅ Heartbeat HTTP 200
- ✅ 3 coloured slots showing (Small Amulet 100, Blessing Card 50, Large Amulet 200)
- ✅ Gift option screen works
- ✅ QR placeholder + countdown
- ❌ Setup code screen — not built
- ❌ Service mode — gesture fires but nothing draws
- ❌ QR image from URL — white placeholder box
- ❌ /v1/machine/completion — 404
- ❌ satu-admin.html — 401 + wrong URL path in apiGet()
- ❌ Boot PIN — not built
- ❌ Factory reset — doesn't call backend first (dangerous)

## Immediate Next Actions (in order)

1. **NOW**: Install PNGdec library in Arduino IDE (Tools → Manage Libraries → PNGdec by bitbank2)
2. **NOW**: Add config.h to .gitignore — WiFi creds in plaintext
3. **CC SESSION**: Open new CC chat, paste CC_BUILD_PROMPT_R4.md, upload local Arduino files
4. **AFTER CC**: Flash firmware, test service mode tabs, verify PNG QR renders
5. **AFTER FLASH**: Run 14-test suite (satu-system-tester.html) — all must pass
6. **DOMAIN**: Acquire satu-th.com (confirmed available)

## Architecture Decisions (locked this session)

| Decision | Choice |
|----------|--------|
| Grid system | R rows × Out cols; side tabs A/B/C when R≥3; sent by backend in /hello |
| QR image | PNG via PNGdec + HTTP fetch from Omise URL; 200KB PSRAM buffer |
| Service entry | Numpad overlay (not full screen), over current screen |
| Ownership model | AirTag-style; 6-digit random code; backend generates; MAC not used for identity |
| WiFi config | NVS primary, config.h fallback; Settings tab can change without reflash |
| Factory reset | Must call /v1/machine/factory-reset backend FIRST; offline reset blocked |
| Language | Toggle in Settings + status bar; TH placeholder in R4, font in R5 |
| Boot PIN | Optional daily startup PIN, same as SVC_PIN |

## Backend Pending Jobs (R4)

1. /v1/machine/completion — add to machine.js + index.js
2. /v1/machine/factory-reset — new endpoint, clears ownership, generates new setup code
3. /hello config{} block — add grid_rows, grid_cols, idle_timeout, sacred_water, lucky_number, selection_timeout
4. /v1/admin-data/:table — JWT or token auth, fixes admin UI
5. Fix satu-admin.html apiGet() token mode URL routing
6. Add device_events table to D1 for ownership audit log

## NVS Key Reference (complete — no other keys allowed)

device_id, dev_secret, svc_pin, svc_pin_en, boot_pin, cfg_idle, cfg_sel, cfg_water, cfg_lucky, nvs_ssid, nvs_pass, nvs_grow, nvs_gcol, scr_theme, lang

All ≤15 chars. Namespace "satu". See UI_SPEC.md for full table.

## Payment / Omise Status

- PAYMENT_MODE: fake (stay here until hardware physically present)
- Omise KYC: sales meeting scheduled — BLOCKS live payment
- PDPA consent: not built — blocks any real install

## Known Risks (updated)

| Item | Severity | Status |
|------|----------|--------|
| Omise KYC incomplete | 🔴 BLOCKS live payment | In progress |
| config.h WiFi in git | 🔴 Security gap | Fix NOW |
| /v1/machine/completion missing | 🟡 Firmware calls, gets 404 | R4 build |
| Factory reset orphans D1 | 🟡 Data integrity | R4 build |
| Admin UI 401 bug | 🟡 Cannot use admin UI | R4 build |
| PDPA consent incomplete | 🔴 Legal risk | Before any real install |
| IP utility model not filed | 🔴 File before public demo | You action |
| satu-th.com not acquired | 🟡 Available now | Buy now |
| device_events table missing | 🟡 No audit trail | R4 build |
