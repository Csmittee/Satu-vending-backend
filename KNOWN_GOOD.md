# KNOWN_GOOD.md — Satu Test Result Snapshots
<!-- Updated by human after every test/flash session — never by CC alone -->
<!-- Format: newest snapshot at TOP -->
<!-- Serial output = paste verbatim, never paraphrase — saves one full flash cycle -->

---

## Snapshot: 2026-06-11

### Backend
```
Commit:      PENDING — run satu-system-tester.html after R4 merge and paste hash here
Test suite:  NOT YET RUN after R4 backend merge (machine.js + index.js changed)
Result:      ⬜ Unknown — must verify before flash
Last known:  14/14 passing (pre-R4, exact commit unknown)
```

### Firmware
```
Build:       R4 — written by CC, merged to main via PR #1
Flash:       NOT YET — first flash pending
Board:       SATU-4R473R (MAC: 3C:DC:75:5D:DD:2C)
Compile:     NOT YET VERIFIED — run Arduino Verify before flash
Last flash:  R3 (pre-R4 build, date unknown)
```

### Action required before next snapshot is valid
- [ ] Run satu-system-tester.html → paste result + commit hash below
- [ ] Arduino IDE Verify → paste any errors verbatim below
- [ ] Flash R4 → paste Serial Monitor output (first 50 lines) below
- [ ] Run smoke test → update firmware status below

### Serial output (paste verbatim when available)
```
(paste here — do not paraphrase errors)
```

---

## Snapshot: PRE-R4 (last known good — date unknown)

### Backend
```
Commit:      unknown — not recorded at time
Test suite:  14/14 PASS
Result:      ✅ All passing
Endpoints verified:
  ✅ POST /v1/machine/hello
  ✅ POST /v1/machine/heartbeat
  ✅ GET  /v1/machine/commands
  ✅ POST /v1/order
  ✅ GET  /v1/order/:id/status
  ✅ POST /v1/webhook/omise
  ✅ POST /v1/auth/login
  ✅ POST /v1/auth/register
  ✅ GET  /v1/dashboard/slots
  ✅ PUT  /v1/dashboard/slots
  ✅ POST /v1/machine/claim
  ✅ GET  /health
  ✅ Rate limiting
  ✅ JWT auth
```

### Firmware
```
Build:       R3
Board:       SATU-4R473R (MAC: 3C:DC:75:5D:DD:2C)
WiFi:        ✅ connects (Jaydahome2.4G)
/hello:      ✅ HTTP 200, status=active, 3 slots returned
Heartbeat:   ✅ HTTP 200
Grid:        ✅ 3 coloured slots showing (Small Amulet 100, Blessing Card 50, Large Amulet 200)
Gift screen: ✅ Item Only / +Sacred Water works
QR screen:   ✅ placeholder + 120s countdown (PNG not loaded — white box)
Service mode:❌ gesture detected, nothing draws
/completion: ❌ 404 (not built until R4)
```

---

## How to Update This File

### After backend test run — paste this block:
```
## Snapshot: YYYY-MM-DD

### Backend
Commit:      [git short hash from GitHub — top of commits page]
Test suite:  14/14 PASS  ← or X/14 with failures listed
Result:      ✅ / ❌
Failed:      [list any failed test names]
```

### After firmware flash — paste this block:
```
### Firmware
Build:       R4 (or whatever version)
Board:       SATU-4R473R
Compile:     ✅ zero errors / ❌ [paste exact error line]
Flash:       ✅ success / ❌ [paste exact error]
Boot:        ✅ SATU screen shows / ❌ black screen
WiFi:        ✅ connects / ❌ timeout
/hello:      ✅ HTTP 200 / ❌ [paste response]
Grid:        ✅ slots showing / ❌ [describe]
Service mode:✅ PIN overlay + 5 tabs / ❌ [describe]
QR PNG:      ✅ real QR image shows / ❌ white box

Serial output (first boot, verbatim):
[PASTE HERE]
```

---

## Serial Output Rules
<!-- Reinforced every session — this saves flash cycles -->

1. **Paste verbatim — never paraphrase errors**
   - Wrong: "it said something about JSON"
   - Right: `[NET] /hello JSON error: InvalidInput`

2. **Paste the first 50 lines of Serial Monitor on first boot**
   - Set baud rate 115200 before flashing
   - Copy from Arduino IDE Serial Monitor → paste into this file

3. **If compile error: paste the entire red block**
   - Include file name + line number
   - One paraphrased error = one wasted flash cycle

4. **Target: ≤3 flash cycles per feature**
   - Cycle 1: first flash, observe serial output
   - Cycle 2: fix identified issue, reflash
   - Cycle 3: confirm fix — if still broken, stop and bring full serial log to chat

---

## Endpoint Status (updated each session)

| Endpoint | Pre-R4 | R4 built | R4 tested |
|----------|--------|----------|-----------|
| POST /v1/machine/hello | ✅ | ✅ +config{} | ⬜ |
| POST /v1/machine/heartbeat | ✅ | ✅ | ⬜ |
| GET /v1/machine/commands | ✅ | ✅ | ⬜ |
| POST /v1/machine/completion | ❌ 404 | ✅ built | ⬜ |
| POST /v1/machine/factory-reset | ❌ missing | ✅ built | ⬜ |
| POST /v1/order | ✅ | ✅ | ⬜ |
| GET /v1/order/:id/status | ✅ | ✅ | ⬜ |
| POST /v1/webhook/omise | ✅ | ✅ | ⬜ |
| POST /v1/auth/login | ✅ | ✅ | ⬜ |
| GET /v1/dashboard/slots | ✅ | ✅ | ⬜ |
| PUT /v1/dashboard/slots | ✅ | ✅ | ⬜ |
| GET /v1/admin-data/:table | ❌ missing | ✅ built | ⬜ |
| GET /health | ✅ | ✅ | ⬜ |

Legend: ✅ confirmed working | ❌ broken/missing | ⬜ not yet tested
