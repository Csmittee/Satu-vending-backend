# CC_PROMPT_fix_hw_trigger_autofill.md
> Created by: Chat (Claude)
> Date: 2026-06-16
> Session goal: Fix HW Trigger Lookup + add auto-fill from latest pending order
> Repo: Satu-vending-backend
> Mode: Fix Mode — 3 files (order.js, webhook.js, satu-machine-builder.html)
> Flash cycles: 0
> PR target: main
> Sequence: Prompt 2 of 2 — previous: CC_PROMPT_fix_webhook_payload.md ✅ COMPLETE

---

## OWNER ACTION BEFORE RUNNING CC

1. Save this file as `CC_PROMPT_fix_hw_trigger_autofill.md` in repo ROOT
2. Confirm GitHub sync checked
3. Paste CC INTRO below into new CC session

---

## CC INTRO — PASTE THIS TO CC

```
Read CLAUDE.md, RULES.md, PROJECT_STATE.md from:
https://github.com/Csmittee/Satu-vending-backend

Then execute: CC_PROMPT_fix_hw_trigger_autofill.md

You are NOT bound by any solution in this prompt.
Verify root cause from live files, then fix correctly.
```

---

## CONTEXT — WHY THIS EXISTS

HW Trigger tab in satu-machine-builder.html is used to simulate a donor scan
on the physical ESP32 (SATU-4R473R) without a real phone. The owner must paste
the order ID from Arduino serial monitor within 30 seconds before the machine
times out — nearly impossible in practice.

Two bugs block HW Trigger from working:

**Bug 1 — Status endpoint missing omise_charge_id:**
GET /v1/order/:id/status SELECT does not include omise_charge_id.
HW Trigger Lookup gets a valid response but finds no charge ID field.
Logs "Order not found" even though order exists. Buttons never activate.

**Bug 2 — Idempotency blocks re-test on timed-out orders:**
webhook.js UPDATE WHERE clause: `status = 'pending'` only.
Timed-out orders have status `vend_failed`. UPDATE affects 0 rows.
changes === 0 guard fires → returns "race condition avoided" → no command queued.
Owner cannot re-test an order that timed out — must create a fresh one every time.

**Feature — Auto-fill from latest pending order:**
Owner currently must watch Arduino serial monitor, copy order ID by hand,
switch to browser, paste — all within 30 seconds. Fails every time.
Instead: HW Trigger polls /v1/admin-data/orders every 3 seconds,
finds latest pending order for SATU-4R473R, auto-fills both fields.
Owner just clicks Simulate Scan PASS. No copy-paste needed.
This uses the existing admin endpoint — zero new backend code needed.

---

## FIX 1 — src/handlers/order.js

### File: `src/handlers/order.js`
### Function: `handleGetOrderStatus`

Find the SELECT query:
```javascript
const order = await env.DB.prepare(
    `SELECT status, paid_at, donor_name, amount, product_id, created_at FROM orders WHERE order_id = ?`
).bind(order_id).first();
```

Add `omise_charge_id` to the SELECT — one field added.

Find the return statement and add `omise_charge_id` to the response object.

Nothing else in order.js changes.

---

## FIX 2 — src/handlers/webhook.js

### File: `src/handlers/webhook.js`
### Function: `handleOmiseWebhook`

Find the UPDATE statement:
```javascript
`UPDATE orders SET status = 'paid', paid_at = ? WHERE order_id = ? AND status = 'pending'`
```

Change `status = 'pending'` to `status IN ('pending', 'vend_failed')`.

**Why safe for production:**
Real Omise never fires a webhook on a `vend_failed` order —
that status is only set by the machine's own timeout completion report.
This change only affects the re-test path in fake mode.
Idempotency for `paid` and `dispensed` orders is unchanged.

Nothing else in webhook.js changes.

---

## FIX 3 — public/satu-machine-builder.html (HW Trigger Section C)

### Auto-fill from latest pending order

In Section C (HW Trigger), add an auto-poll that runs every 3 seconds
when the page is on the HW Trigger view.

Logic:
```
Every 3 seconds:
  GET /v1/admin-data/orders  with header X-Admin-Token: [ADMIN_SECRET]
  → filter rows where device_id matches hw-device-select value
    AND status = 'pending'
    AND omise_charge_id is not null
  → sort by created_at DESC, take first row
  → if found AND different from current hw-order-id value:
      fill hw-order-id with row.order_id
      fill hw-charge-id with row.omise_charge_id
      call updateHwButtonStates()
      farmLog('[HW] Auto-filled: ' + row.order_id, 'ok', 'HW')
  → if not found: show subtle "— watching for new order —" status text
```

**ADMIN_TOKEN handling:**
The existing satu-machine-builder.html already has an API base URL field.
Add a small input field for Admin Token in Session Setup card (password type,
placeholder "Admin token for auto-fill"). Store in a JS variable.
If empty, auto-fill polling is skipped silently — manual lookup still works.

**Stop polling when:**
- User navigates away from HW Trigger section
- An order is found and filled (pause for 10 seconds, then resume watching
  for a NEW order in case owner wants to test again)
- Payment buttons are clicked (order is being processed)

**Status indicator:**
Add a small text line below the order ID field:
- Grey: "— watching —" (polling, no order found yet)
- Green: "✅ Auto-filled from SATU-4R473R" (order found)
- Off: (when not on HW Trigger section)

---

## PRESERVE CHECKLIST

CC must verify before committing:
- Section A (Single Flow Test) — all 8 nodes unchanged
- Section B (Machine Fleet) — Stress Test + Network View unchanged
- farmLog() function unchanged
- showSection() unchanged
- Sidebar brand, theme colors unchanged
- File name: public/satu-machine-builder.html (already renamed — do not revert)
- 14-test suite: run and confirm 14/14 pass

---

## PROJECT_STATE.md UPDATES

Add to SESSION LOG (newest at TOP):
```
### 2026-06-16 — HW Trigger auto-fill + lookup fix (R-125)
- Bug 1: GET /v1/order/:id/status missing omise_charge_id in SELECT/response — fixed
- Bug 2: webhook.js WHERE status='pending' blocked vend_failed re-test — widened to IN('pending','vend_failed')
- Feature: HW Trigger auto-polls /v1/admin-data/orders every 3s → auto-fills order+charge fields
  No new backend endpoint needed — uses existing admin-data route
  Owner just clicks Simulate Scan PASS — no copy-paste from serial monitor
- Files: src/handlers/order.js, src/handlers/webhook.js, public/satu-machine-builder.html
- 14-test suite: must confirm 14/14 after merge
```

Add to OPEN ITEMS / ROADMAP FLAGS:
```
ROADMAP FLAGS added 2026-06-16:
- [ ] Order expiry cron — Cloudflare Cron Trigger, hourly, marks pending orders
      older than 10 min as 'expired'. MANDATORY before live Omise mode.
- [ ] Admin dashboard activate — satu-admin.html orders/devices/analytics tabs
      Backend endpoints exist. Frontend not yet tested. Phase 1 late item.
- [ ] Order analytics — orders by status per day, conversion rate (pending→dispensed)
      Merge into satu-admin.html Orders section. No new backend needed.
- [ ] Omise reconciliation — cross-check DB dispensed vs Omise successful charges
      Add as tab in satu-admin.html. Phase 1 pre-live item.
- [ ] Service mode firmware — ui.h 5 tabs full build (stubs only currently)
      Full spec: live IR readings, relay toggles, NVS settings save, I2C scanner
      Separate firmware CC session. Needed before Phase B hardware build.
- [ ] satu_observer.ino — flash to second ESP32 for independent relay/IR confirm
      File complete in firmware repo. Owner action only — no coding needed.
- [ ] Circuit helper tab — Tab 3 in satu-machine-builder.html
      Pin-level wiring diagram UI. Phase B item.
- [ ] Payment timeout in config.h — extend from 30s to 120s for HW testing
      Owner direct edit. One line. Change back before temple deployment.
```

---

## RULE TO ADD — R-125

Append to RULES.md at TOP:
```
R-125: GET /v1/order/:id/status MUST return omise_charge_id in response.
HW Trigger Lookup depends on this field to activate payment buttons.
Never remove omise_charge_id from the status endpoint SELECT or response.
webhook.js UPDATE WHERE clause allows 'vend_failed' for re-test in fake mode.
Real Omise never fires on vend_failed — safe in production.
(Added 2026-06-16)
```

---

## DO NOT TOUCH

- satu-system-tester.html — 14 tests must stay green
- simulator.html
- fake-omise-worker.js
- hardware.h — R2 LOCKED
- config.h — do not change PAYMENT_TIMEOUT_MS (owner does this separately)
- wrangler.toml
- PAYMENT_MODE stays fake — never suggest live

---

## VERIFICATION BEFORE PR

1. Run satu-system-tester.html → confirm 14/14 pass — paste in PR body
2. Manually test Lookup:
   - Create order via Single Flow Test (Node 3) — get order_id
   - Paste into HW Trigger order field → click Lookup
   - Expected: charge_id auto-fills, payment buttons activate
3. Manually test auto-fill:
   - Enter admin token in Session Setup
   - Create order via Single Flow Test
   - Within 3 seconds: order_id + charge_id should auto-fill in HW Trigger
   - Expected: "[HW] Auto-filled: SATU-20260616-XXXXXX" in activity log

---

## MANDATORY END OF SESSION (R-84)

1. Archive → docs/prompts/ stamped:
   `✅ COMPLETE — 2026-06-16 — HW Trigger auto-fill R-125`
2. Append R-125 to RULES.md at TOP
3. Update PROJECT_STATE.md — session log + roadmap flags (above)
4. Overwrite CHAT_HANDOFF.md with current state
5. Update KNOWN_GOOD.md — add at TOP:
   `2026-06-16 — HW Trigger auto-fill R-125 — 14/14 passing`
6. Commit: `feat: HW Trigger auto-fill + lookup fix R-125`
7. Merge to main

---

## PAYMENT MODE REMINDER
PAYMENT_MODE stays fake. Never suggest changing to live.
