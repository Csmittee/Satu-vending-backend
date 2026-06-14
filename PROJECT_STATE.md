# PROJECT_STATE.md — Satu 1.0 Live Status
<!-- CC updates phase status after Build sessions · Chat updates after design decisions locked -->
<!-- Last updated: 2026-06-13 — machine farm: node8 fix + sidebar layout + network view tab -->

## Session Log (newest first)

### 2026-06-14 — QR HEAD method fix (R-108)
- **ROOT CAUSE:** satu-system-tester.html Test 4 calls `fetch(qr_url, {method:'HEAD'})` to check reachability.
  Backend route matched only `method === 'GET'` — HEAD fell through to JWT auth → HTTP 401.
- **FIX:** `src/index.js` line 133: added `|| method === 'HEAD'` to QR route condition.
  CF Workers strips body for HEAD automatically — no change to qr.js handler needed.
- **RULES.md:** R-108 prepended at TOP (public binary endpoints must accept GET + HEAD)
- **Test 4 status:** ✅ HEAD now matches public QR route — will return 200

### 2026-06-14 — QR auth + CORS fix (CC_PROMPT_fix_qr_auth_cors)
- **REGRESSION 1 (Test 4):** GET /v1/qr/:charge_id confirmed public in index.js (lines 132-136, before JWT auth). No code change needed — correctly placed in PR #12.
- **REGRESSION 2 (Tests 7, 9):** fake-omise-worker.js had CORS headers on OPTIONS preflight only. All actual responses (POST /charges, POST /webhooks/payment, etc.) lacked CORS headers → browser blocked responses. Fixed: `corsHeaders` const applied to every response.
- **MISSING ENDPOINTS:** /simulate-payment and /test/simulate-payment were missing — 14-test suite calls these. Added: both paths trigger backend /v1/webhook/omise with Omise-shaped charge.complete payload.
- **RULES.md:** R-107 prepended at TOP (rewrite PRESERVE checklist rule)
- **QR endpoint status:** ✅ public (no auth required)
- **Fake worker CORS:** ✅ restored on all responses
- **14-test suite target:** 14/14 after owner deploys corrected fake-omise-worker.js

### 2026-06-13 — QR PNG backend endpoint (CC_PROMPT_fix_qr_png_backend)
- **ROOT CAUSE:** fake omise worker qr_code_url pointed to api.qrserver.com — returned 510-byte HTML error, not PNG
- **FIX (Part 1):** `src/handlers/qr.js` NEW — GET /v1/qr/:charge_id → image/png
  Pure-JS QR matrix (qrcode.create) + CF Workers CompressionStream PNG encoder. No external services.
- **FIX (Part 2):** `src/index.js` — added GET /v1/qr/:charge_id route (public, no auth)
- **FIX (Part 3):** `fake-omise-worker.js` — corrected file written to repo root for owner to deploy
  qr_code_url now → https://api.janishammer.com/v1/qr/${chargeId}
- **RULES.md:** R-106 appended at TOP
- **QR PNG status:** ✅ fixed pending owner: (1) deploy corrected fake worker, (2) hardware verify

### 2026-06-13 — docs: R-50/R-99/R-104 CC prompt location fixed (root=active, docs/prompts/=archive)
- R-50/R-99/R-104 CC prompt location fixed

### 2026-06-13 — machine farm simulator: node8 fix + sidebar + network view
- **FIX (Node 8 idempotency):** Node 8 now creates its own fresh POST /v1/order before testing. Previously reused Node 3's order (already dispensed by Node 7). Fresh charge_id used for both webhook fires. Polls freshOrderId only. count===1 = pass.
- **FIX (Arrow connectors):** Replaced invisible 2px div with `.node-connector` (vertical line + CSS ▼ triangle). Dark-grey pending → dark-green pass → dark-red fail/skip.
- **FEATURE (Sidebar layout):** 200px sidebar with SATU gold branding + two nav items (gold left-border active state). No CSS colors/fonts changed — layout restructure only.
- **FEATURE (Network View tab):** Section B now has two tabs: Stress Test (unchanged) + Network View. Network View = SVG canvas: machine nodes → Backend API → D1 + Payment GW / Webhook / Cmd Queue. Lines animate during Fire All; settle green/red on completion. Heartbeat pulse every 3s.
- **File:** public/satu-machine-tester.html only.

### 2026-06-13 — esbuild template literal fix (wrangler 4.100 breaking change)
- **FIX:** src/index.js handleAdminDashboard() — 5 inner template literals inside HTML template literal converted to string concatenation. Wrangler 4.100+ esbuild strict mode fails on nested `${...}` inside outer backtick strings. R-98 added to RULES.md.
- **Files:** src/index.js only

### 2026-06-13 — tester consolidation: simulator upgrade + machine farm redesign (R-94)
- **DELETE:** public/simulator_r3.html — fully superseded, deleted.
- **UPGRADE:** simulator.html → "SATU VENDING MACHINE SIMULATOR"
  - Title updated. Styled device dropdown (3 approved devices, no free entry).
  - Connection Status toggle drawer: 6 live indicators (Backend, D1, Order, Payment Gateway, Machine Command, Idempotency).
  - [🔁 Run Idempotency Test] button: create order → POST webhook ×2 → poll commands → verify count===1.
- **REDESIGN:** satu-machine-tester.html → "Machine Farm Simulator"
  - Section A: 8-node vertical flow diagram (Health → Hello → Order → QR → Webhook → Commands → Completion → Idempotency). Run All / Step / Reset controls. Expandable node details.
  - Section B: Fleet stress test — 2-3 machines fired in parallel via Promise.all(). Results panel with auto-generated observations (D1 contention, rate limits, latency spikes).
  - Section C: Full-width activity log with source tagging ([Machine N] / [Flow]).
  - Gold/dark theme throughout.
- **RULES:** R-94 (three-tester architecture), R-99 (CC prompt convention), R-100 (machine farm) added to RULES.md.
- **WORKFLOW:** WORKFLOW_SKILL.md updated with CC Prompt File Naming section.
- public/ inventory: simulator.html (upgraded) · satu-machine-tester.html (redesigned) · satu-system-tester.html (untouched) · satu-admin.html · satu-preflight.html. simulator_r3.html DELETED.

### 2026-06-13 — wrangler.toml build fix + device dropdowns
- **FIX:** wrangler.toml `routes` was nested inside `[[d1_databases]]` — caused Cloudflare build error "Unexpected fields found in d1_databases[0] field: routes". Moved `routes` to top-level (before `[assets]`). R-97 added to RULES.md.
- **FIX:** simulator.html MAC input (readonly text) → dropdown of 3 approved devices. `genMac()` removed. No ghost devices possible.
- **FIX:** satu-machine-tester.html locked SATU-T001 (not in D1) → dropdown defaulting to SATU-TEST001. Lock overlay removed.
- Approved devices in D1: SATU-TEST001 (AA:BB:CC:DD:EE:00) · SATU-SIM01 (AA:BB:CC:DD:EE:01) · SATU-4R473R (3C:DC:75:5D:DD:2C)

## Current Goal
Flash firmware R5 to SATU-4R473R. Monitor CI compile check on PRs.

---

## Phase Status

| Phase | What | Status |
|-------|------|--------|
| P1 | Backend API | ✅ DONE — 14/14 tests pass |
| P2 | Payment Gateway | 🟡 TEST KEYS ACTIVE — KYC/bank pending |
| P3 | Firmware R3 | ✅ WRITTEN — ready to flash, not yet validated on board |
| P4 | Hardware Build | 🔵 DESIGN DONE — components arrived, build not started |
| P5 | Temple Owner Dashboard | 🟡 PARTIAL — HTML built, backend patches not applied |
| P6 | Omise Live Keys | 🔴 BLOCKED — KYC incomplete |
| P7 | First Machine Field Test | ⬜ NOT STARTED |

---

## ⚠️ CRITICAL: Cloudflare Variables — Action Required

### Must change from Secret → plain Variable (no damage if visible):
| Name | Change to | Value |
|------|-----------|-------|
| `FAKE_OMISE_URL` | Variable | `https://fake-omise.csmittee.workers.dev` |
| `PAYMENT_GATEWAY` | Variable | `fake_omise` |
| `SYSTEM_MODE` | Variable | `online` |

### Keep as Secret (real damage if leaked):
| Name | Why |
|------|-----|
| `ADMIN_SECRET` | Grants full DB access |
| `OMISE_SECRET_KEY` | Payment API — can charge cards |
| `OMISE_WEBHOOK_SECRET` | HMAC key — fake payments injectable if leaked |
| `ADMIN_PATH` | Fine either way, keep secret for obscurity |

### Old variable — delete if still present:
- `PAYMENT_MODE` — replaced by `PAYMENT_GATEWAY`. Delete from Cloudflare.

---

## ⚠️ CRITICAL: Omise Gateway Architecture — LOCKED DECISION

Three modes, controlled by `PAYMENT_GATEWAY` variable in Cloudflare:

| Value | Calls | QR Code | Webhook | Money | Use for |
|-------|-------|---------|---------|-------|---------|
| `fake_omise` | fake-omise.csmittee.workers.dev | Fake URL | Auto-called by fake worker (no HMAC) | ❌ None | All dev, all automated tests |
| `omise_test` | api.omise.co (test keys) | **Real scannable PromptPay QR** | Only fires when someone actually scans & pays | ❌ None | Demos, presentations, real QR testing |
| `omise_live` | api.omise.co (live keys) | Real QR | Fires on real payment | ✅ Real money | After KYC complete only |

### Why 14-test suite uses fake_omise:
Tests 8, 10, 11 test the webhook → payment_confirmed → door unlock chain.
In omise_test/live mode, Omise only calls our webhook when a real human scans and pays.
This cannot be automated. Those 3 tests are skipped/greyed in True Omise mode.
All other 11 tests pass in both modes.

### To get real scannable QR in simulator:
Change `PAYMENT_GATEWAY` → `omise_test` in Cloudflare. No code change needed.
Change back to `fake_omise` for automated testing.

### What was confirmed working via curl (historical):
- Real Omise account active with test keys
- PromptPay enabled (1.65% fee)
- Real QR URL returned and reachable — confirmed in system tester Tests 3 & 4
- 502 error previously was wrong API key in Cloudflare (now fixed)

---

## ⚠️ CRITICAL: Hardware Lane Count
Default: **10 slots (5×2 grid)** — this is what gets flashed now
Maximum: 21 slots (7×3 grid) — future expansion, scrollable UX needed if >10

config.h is set to NUM_SLOTS=10, NUM_COLS=5 — correct for first build.
21-slot design is validated in UI simulator only. Physical machine starts at 10.

---

## Firmware R3 — File Status (all files in one Arduino sketch folder)

| File | Version | Status | Action |
|------|---------|--------|--------|
| `satu_vending.ino` | R3 | ✅ Ready | Replace in repo |
| `ui.h` | R3 | ✅ Ready | Replace in repo |
| `state_machine.h` | R3 | ✅ Ready | Replace in repo |
| `config.h` | R3 | ✅ Ready | **Edit WiFi SSID/password first**, then replace |
| `network.h` | R3 | ✅ Ready | Replace in repo |
| `hardware.h` | R2 | ⚠️ Keep old | Do NOT replace — R2 still correct for 10-lane |

### Key R3 changes from R2:
- `ui.h`: TFT_eSPI → Arduino_GFX. getTouchedProduct() → getTouchedSlot(). 21-slot grid.
- `satu_vending.ino`: STATE_GIFT_OPTION added. wantSacredWater flag. loadSlotsFromJson() called after /hello.
- `state_machine.h`: STATE_GIFT_OPTION + STATE_SERVICE added. Arrays sized to NUM_SLOTS.
- `config.h`: NUM_SLOTS=10 default, max 21. 3×MCP stubs. Correct API URL.
- `network.h`: initWiFi() returns JsonDocument for slot loading. createOrder() accepts sacredWater + donorName.

### Arduino IDE settings (DO NOT CHANGE):
- Board: ESP32S3 Dev Module
- Flash: 16MB (128Mb)
- Partition: 16M Flash (3MB APP/9.9MB FATFS)
- PSRAM: **OPI PSRAM** ← NEVER change this or display breaks
- Upload Speed: 460800
- Port: /dev/cu.usbserial-1420

### Display init (confirmed working):
```cpp
Arduino_ESP32RGBPanel *bus = new Arduino_ESP32RGBPanel(
  41, 40, 39, 42,
  14, 21, 47, 48, 45,
  9, 46, 3, 8, 16, 1,
  15, 7, 6, 5, 4,
  0, 8, 2, 43,
  0, 8, 2, 12,
  1, 16000000
);
Arduino_RGB_Display *gfx = new Arduino_RGB_Display(800, 480, bus, 0, true);
TAMC_GT911 touch(19, 20, -1, -1, 800, 480);
Wire.begin(19, 20);
touch.begin();
touch.setRotation(ROTATION_INVERTED);
```

---

## Donor Flow — LOCKED DECISION (2026-05-29)

```
IDLE (product grid, 10 slots default)
  ↓ single tap on slot → 300ms → auto-advance
DONOR (ID card screen)
  ↓ insert Thai ID card (auto-confirm after read)  OR  tap Skip (anonymous)
GIFT OPTION
  ↓ tap "Item Only"  OR  tap "+ Sacred Water (+20 THB)"
QR PAYMENT (real or fake QR depending on PAYMENT_GATEWAY)
  ↓ donor scans & pays  →  Omise calls webhook  →  backend sends payment_confirmed command
  [if Sacred Water selected]
SACRED WATER COUNTDOWN (3-2-1 spray animation)
  ↓ auto-advance after spray
VENDING (relay fires, progress bar, door opens, beep until pickup)
  ↓ IR sensor clears when item removed
LUCKY NUMBER + THANK YOU (8s, then auto-reset)
  ↓ auto
IDLE
```

Key rules:
- Donor name: ID card slot only, NO keyboard input ever
- Skip always allowed → anonymous donation
- Sacred water: +20 THB, fires separate relay (WATER_PUMP_RELAY)
- Lucky number: random 10-99, generated locally on ESP32

---

## Slot Config — Remote Config Architecture (LOCKED DECISION 2026-05-29)

Machine pulls slot names/prices from backend on boot via `/hello` response.
Owner configures slots via temple dashboard (web). No flashing needed.

Backend needs (CC job — not yet done):
- New D1 table: `machine_slots` (machine_id, slot, name_th, name_en, price, enabled)
- Add `slots[]` array to `/hello` response
- Dashboard: 7×3 slot editor grid for temple owners

Firmware side: `loadSlotsFromJson(doc["slots"])` already implemented in network.h R3.
Fallback if no slots from backend: show "Slot N" greyed out (disabled).
Price: owner-defined free input. Color auto-tiers by value (50/100/200/300/500).

---

## Three-Tester Architecture (R-94) — LOCKED 2026-06-13

| # | File | Name | Purpose |
|---|------|------|---------|
| 1 | `satu-system-tester.html` | Backend System Tester | 14-test automated API suite — DO NOT MODIFY |
| 2 | `simulator.html` | Vending Machine Simulator | Full touch screen UI + connection status drawer |
| 3 | `satu-machine-tester.html` | Machine Farm Simulator | 8-node flow diagram + multi-machine stress test |

`simulator_r3.html` — DELETED 2026-06-13. Fully superseded.

No new test files without owner + Chat approval (R-94).

---

## Backend — Endpoint Inventory (api.janishammer.com)

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /v1/machine/hello | ✅ | Device registration + credential return |
| POST /v1/machine/heartbeat | ⚠️ | HTTP 500 — connection_logs column mismatch |
| GET /v1/machine/commands | ✅ | 30-sec poll |
| POST /v1/machine/command-ack | ✅ | Queue acknowledgment |
| POST /v1/machine/completion | ❌ | Missing — firmware calls it, 404 |
| POST /v1/order | ✅ | Creates order + QR |
| GET /v1/order/:id/status | ✅ | Payment poll fallback |
| POST /v1/webhook/omise | ✅ | HMAC skipped on fake_omise |
| POST /v1/auth/login | ✅ | PBKDF2 |
| POST /v1/auth/register | ✅ | ALLOW_REGISTRATION gated |
| GET /v1/dashboard/* | 🟡 | /dashboard/orders endpoint missing |
| POST /v1/machine/claim | ✅ | Route wired |

**Pending CC jobs (backend):**
1. Add `machine_slots` table + slots[] in /hello response
2. Add `/v1/machine/completion` endpoint
3. Fix heartbeat HTTP 500 (connection_logs column)
4. Add `/v1/dashboard/orders` route

---

## Known Risks (priority order)

| Item | Severity | Owner |
|------|----------|-------|
| Omise KYC incomplete | 🔴 BLOCKS LAUNCH | You |
| Heartbeat HTTP 500 | 🟡 | CC |
| /v1/machine/completion missing | 🟡 | CC |
| machine_slots table not yet created | 🟡 | CC |
| PDPA consent incomplete | 🔴 Legal risk | Before any live install |
| Dashboard backend patches not applied | 🟡 | CC |
| IP (utility model) not filed | 🔴 File before public demo | You |
| hardware.h still R2 (10-lane) | ✅ Correct for now | Update when scaling to 21 |

---

## Next 3 Actions (in order)

1. **Cloudflare** — convert FAKE_OMISE_URL, PAYMENT_GATEWAY, SYSTEM_MODE from Secret → Variable. Delete PAYMENT_MODE if still present.
2. **Flash firmware R3** — edit config.h WiFi credentials → replace 5 files → compile → flash
3. **Validate board** — confirm display shows boot screen, touch responds on product grid

---

## Business Context
- P&L: ฿10,470 COGS per machine, break-even at 150 tx/mo = 6 months
- Revenue model: 15% revenue share (beats outright sale 5.4× over 3 years)
- Company registration: Thai Ltd. target May 2026 (may be delayed)
- BOI application: Category 4.1, target June 2026
- Omise: Test keys active, real QR confirmed via curl, KYC meeting not yet held
- Single vs dual ESP32: still undecided — does not block current work
- PDPA legal review: not started
- Utility model (IP): not filed — file before any public demo

---
## Workflow System — Added 2026-06-11

### New Documents Added This Session
- `WORKFLOW_SKILL.md` — dual-loop (Cloud Loop A + Firmware Loop B), session modes, CC template
- `CHAT_HANDOFF.md` — session handoff, overwrite each session
- `KNOWLEDGE_MAP.md` — navigation guide (backend repo copy)

### Hardware Repo Reference
- `Csmittee/Satu-vending-hardware` — wiring diagrams, BOM
- Key hardware facts extracted: ESP32-8048S070C board (1600 THB), MCP23017×2 I/O expanders (0x20 sensors 1-8 relays 1-6 / 0x21 sensors 9-10 relays 7-12), 10× IR sensors E18-D80NK, 8+2 channel relays (requires separate 12V supply), RDM6300 ID card reader, WS2812B LEDs, metal frame 1.5mm steel. Total BOM ~8070 THB.
- Read before any pin mapping or hardware-layer decision

### Session Closing Discipline (from this point forward)
Every CC session ends with:
1. Archive CC_PROMPT → docs/prompts/ stamped ✅ COMPLETE — [date] — [summary]
2. Append new rules → RULES.md (newest at TOP)
3. Update PROJECT_STATE.md phase status
4. Overwrite CHAT_HANDOFF.md with current state
5. Commit all docs → merge to main
