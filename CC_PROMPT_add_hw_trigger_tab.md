# CC_PROMPT_add_hw_trigger_tab.md
> Created by: Chat (Claude)
> Date: 2026-06-14
> Session goal: Add Section C "HW Trigger" to satu-machine-tester.html
> Repo: Satu-vending-backend
> File: public/satu-machine-tester.html ONLY
> Mode: Frontend only — no src/ changes, no firmware, no wrangler.toml
> Flash cycles: 0
> PR target: main

---

## CC INTRO

New session. Ignore all previous context from other projects.

You are working on SATU 1.0 BACKEND at:
https://github.com/Csmittee/Satu-vending-backend

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ is archive only — never execute from there.

Read IN FULL and state each filename aloud before writing anything:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. public/satu-machine-tester.html   ← read the ENTIRE file
5. CC_PROMPT_add_hw_trigger_tab.md   ← this file

State "All files read ✅" then execute this prompt.

---

## CRITICAL FILE RULES

FILE NAME:     public/satu-machine-tester.html  ← NEVER rename
TITLE TAG:     <title>SATU Machine Farm Simulator</title>  ← keep exactly
SIDEBAR BRAND: "SATU" + "Machine Farm"  ← keep exactly
THEME:         #0a0b0e bg · #d4a843 gold · #12131a cards  ← never change
SECTIONS A+B:  DO NOT TOUCH — add Section C only

---

## CONTEXT

Owner tests physical ESP32 (SATU-4R473R) without all sensors wired yet.
When machine shows QR screen, there is no way to simulate a donor scan
from the browser without this tool. Machine polls backend command queue
waiting for payment_confirmed — HW Trigger sends that signal on demand.
Testing tool only — never used in production.

---

## TASK — Add Section C to sidebar

### Current nav (DO NOT CHANGE):
```
🔬 Single Flow Test   → showSection('a')
🖥️ Machine Fleet      → showSection('b')
```

### Add after existing two:
```
⚡ HW Trigger         → showSection('c')
```

Update showSection() to handle 'a', 'b', 'c' — same toggle pattern.

---

## SECTION C CONTENT

### Section header
Title: HW TRIGGER
Subtitle: Physical hardware bypass · test without wired sensors

---

### CARD 1 — SESSION SETUP

**Order ID input**
- id="hw-order-id", placeholder="SATU-20260614-XXXXXX"
- Hint: "Paste from ESP32 serial when QR screen appears"

**Charge ID input**
- id="hw-charge-id", readonly
- Placeholder: "auto-filled after lookup"
- Hint: "Filled automatically by Lookup"

**Lookup button**
- id="hw-btn-lookup", label "🔍 Lookup Charge ID"
- Disabled when hw-order-id empty
- Action: GET https://api.janishammer.com/v1/order/{orderId}/status
  → fill hw-charge-id with response.omise_charge_id
  → call updateHwButtonStates()
  → on fail: farmLog('[HW] Order not found', 'err', 'HW')

**Device selector**
- id="hw-device-select"
- Options — hardcoded only, no free entry:
  3C:DC:75:5D:DD:2C — SATU-4R473R (Physical)  ← default
  AA:BB:CC:DD:EE:00 — SATU-TEST001
  AA:BB:CC:DD:EE:01 — SATU-SIM01

---

### CARD 2 — PAYMENT SIMULATION

Subtitle: "Simulates Omise webhook after donor scans QR. Machine receives payment_confirmed and dispenses."

**Status display** id="hw-pay-status", default "— waiting —"
Colors: #555 idle · #4caf50 success · #ff4444 fail

**Button: ✅ Simulate Scan PASS**
- id="hw-btn-pay-pass", class="btn-success"
- Disabled when hw-charge-id empty
- Action:
  POST https://fake-omise.csmittee.workers.dev/simulate-payment
  Body: { order_id: hwOrderId, charge_id: hwChargeId }
  → ok:true  → status "✅ Webhook sent — machine polling for command..."
  → ok:false → status "❌ Webhook failed"
  → farmLog('Payment PASS triggered — ' + orderId, 'ok', 'HW')

**Button: ❌ Simulate Scan FAIL**
- id="hw-btn-pay-fail", class="btn btn-danger" (use existing .btn.danger CSS)
- Disabled when hw-charge-id empty
- Action:
  POST https://api.janishammer.com/v1/webhook/omise
  Body: { key:'charge.complete', data:{ object:'charge', id:hwChargeId, status:'failed', metadata:{ order_id:hwOrderId } } }
  → status "❌ Payment FAILED — machine shows error screen"
  → farmLog('Payment FAIL triggered', 'warn', 'HW')

---

### CARD 3 — DISPENSING CYCLE

Warning box (amber):
"⚠ /v1/machine/completion not yet live. Buttons wired and ready — activate when backend endpoint is added."

Subtitle: "Simulates physical sensor events after payment confirmed."

**Button: 📦 Item Dispensed OK**
- id="hw-btn-dispensed", disabled when hw-order-id empty
- POST /v1/machine/completion body: { order_id, result:'success', slot_idx:0 }
- Log result regardless of HTTP status

**Button: 🚪 Door Blocked**
- id="hw-btn-door-blocked", disabled when hw-order-id empty
- Same POST, result:'door_blocked'

**Button: ⏱ Dispense Timeout**
- id="hw-btn-timeout", disabled when hw-order-id empty
- Same POST, result:'timeout'

---

## BUTTON STATE LOGIC

```javascript
function updateHwButtonStates() {
  const hasOrder  = document.getElementById('hw-order-id').value.trim().length > 0;
  const hasCharge = document.getElementById('hw-charge-id').value.trim().length > 0;
  document.getElementById('hw-btn-lookup').disabled       = !hasOrder;
  document.getElementById('hw-btn-pay-pass').disabled     = !hasCharge;
  document.getElementById('hw-btn-pay-fail').disabled     = !hasCharge;
  document.getElementById('hw-btn-dispensed').disabled    = !hasOrder;
  document.getElementById('hw-btn-door-blocked').disabled = !hasOrder;
  document.getElementById('hw-btn-timeout').disabled      = !hasOrder;
}
// Attach to hw-order-id input event
// Call after lookup fills hw-charge-id
// All 6 buttons start disabled on page load
```

---

## CSS TO ADD (inside existing style block)

```css
/* ══ HW TRIGGER ══ */
.hw-hint    { font-size: 10px; color: #555; margin-top: 3px; }
.hw-status  { font-size: 11px; font-family: monospace; padding: 8px 0; color: #555; min-height: 20px; }
.hw-warn-box {
  background: #1a1200; border: 1px solid #d4a843; border-radius: 6px;
  padding: 10px 12px; font-size: 11px; color: #d4a843; margin-bottom: 12px;
}
.btn-success {
  background: none; border: 1px solid #2d6a31; color: #4caf50;
  padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px;
  font-family: inherit; transition: all 0.15s;
}
.btn-success:hover:not(:disabled) { background: #0d1f0d; }
.btn-success:disabled,
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
```

---

## PRESERVE CHECKLIST (R-107)

CC must verify each item survives this edit:
- Section A (Single Flow Test) — all 8 nodes, Run All, Step, Reset unchanged
- Section B (Machine Fleet) — Stress Test tab + Network View tab unchanged
- Activity log farmLog() function unchanged
- showSection() extended to handle 'c' without breaking 'a' or 'b'
- Sidebar brand title "SATU" + subtitle "Machine Farm" unchanged
- File name public/satu-machine-tester.html unchanged
- Title tag "SATU Machine Farm Simulator" unchanged

---

## DO NOT TOUCH

- satu-system-tester.html
- simulator.html
- Any src/ files
- wrangler.toml
- hardware.h — R2 LOCKED
- PAYMENT_MODE stays fake

---

## VERIFICATION BEFORE PR

1. Open file:// in browser — no server needed
2. Three sidebar items render correctly
3. Click ⚡ HW Trigger → Section C appears, A+B hidden
4. Click back to Single Flow Test → Section A reappears, C hidden
5. All 6 hw-* buttons disabled on load
6. Type order ID → Lookup + Dispensing buttons enable
7. Payment buttons still disabled (need charge ID)
8. Click Lookup with real order ID → charge ID fills, payment buttons enable
9. Section A Run All executes correctly (not broken)
10. Section B Fire All executes correctly (not broken)
11. GitHub Actions ✅ GREEN — state in PR body

---

## MANDATORY END OF SESSION

1. GitHub Actions ✅ GREEN before PR
2. Append to RULES.md at TOP:
```
R-110: HW Trigger is Section C of satu-machine-tester.html.
Filename and title tag never change. Section C is a test-only hardware bypass.
Payment buttons call fake-omise /simulate-payment.
Dispensing buttons call /v1/machine/completion — 404 expected until endpoint exists.
(Added 2026-06-14)
```
3. Update PROJECT_STATE.md — note Section C added, /v1/machine/completion still pending
4. Archive → docs/prompts/ stamped ✅ COMPLETE — 2026-06-14 — HW Trigger Section C
5. Merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE stays fake. Never suggest live.

## OWNER WORKFLOW AFTER MERGE
1. Open https://api.janishammer.com/satu-machine-tester
2. Click ⚡ HW Trigger
3. Paste order ID from ESP32 serial → click Lookup
4. Click ✅ Simulate Scan PASS
5. Watch serial for: [CMD] payment_confirmed received → relay fires
