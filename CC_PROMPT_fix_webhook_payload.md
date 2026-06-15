# CC_PROMPT_fix_webhook_payload.md
> Created by: Chat (Claude)
> Date: 2026-06-16
> Session goal: Fix webhook payload mismatch — simulator flow break after fake-omise scan
> Repo: Satu-vending-backend
> Mode: Fix Mode — 2 files only (src/handlers/webhook.js + PROJECT_STATE.md)
> Flash cycles: 0
> PR target: main
> Sequence: Prompt 1 of 1 (self-contained fix)

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
4. src/handlers/webhook.js        ← read the ENTIRE file
5. fake-omise-worker.js           ← read the ENTIRE file (repo root)
6. CC_PROMPT_fix_webhook_payload.md ← this file

State "All files read ✅" then execute this prompt.

---

## CONTEXT — WHY THIS EXISTS

The simulator (simulator.html) stopped advancing past the QR payment screen
after fake-omise sends a simulated webhook. Root cause: two mismatches between
fake-omise-worker.js and webhook.js that appeared together after R-107 rewrote
the fake worker.

**Mismatch 1 — Payload envelope:**
fake-omise wraps the charge object in `{ key: 'charge.complete', data: { ... } }`
webhook.js reads `payload.object` and `payload.status` — both undefined at top level.
The `if` condition never matches. Handler returns `{ status:'ok' }` immediately.
Nothing gets written to DB. No command queued. Machine polls forever.

**Mismatch 2 — charge_id not in DB:**
fake-omise generates a random `charge_id` (`fake_chg_xxxxxxxx`) that was never
stored when the order was created. The DB lookup `WHERE omise_charge_id = ?` finds
nothing even if Mismatch 1 were fixed. Need fallback lookup by `order_id` from
`metadata`.

**Real Omise is unaffected:**
Real Omise sends charge at top level (no `.data` wrapper) — `payload.data` is
undefined, so `charge = payload.data || payload` correctly falls back to `payload`.
Real Omise always sends a real charge_id that exists in DB — fallback lookup never fires.

**Rule to add:**
R-124: fake-omise-worker wraps charge in `{ key, data: {...} }`.
webhook.js MUST unwrap via `const charge = payload.data || payload` before
reading `.object`, `.status`, `.id`, `.metadata`. Never read these from `payload` directly.

---

## FIX 1 — src/handlers/webhook.js

### File to edit: `src/handlers/webhook.js`

Inside `handleOmiseWebhook()`, find the block that begins after `JSON.parse(bodyText)`.

**FIND this exact block:**
```javascript
        const payload = JSON.parse(bodyText);

        if (payload.object === 'charge' && payload.status === 'successful') {
            const chargeId = payload.id;
            const orderId  = payload.metadata?.order_id;

            // Find order by charge ID
            let order = await env.DB.prepare(
                `SELECT order_id, device_id, product_id, status FROM orders WHERE omise_charge_id = ?`
            ).bind(chargeId).first();

            if (!order) {
```

**REPLACE WITH:**
```javascript
        const payload = JSON.parse(bodyText);

        // R-124: fake-omise wraps charge in { key, data:{...} }
        // Real Omise sends charge at top level — handle both
        const charge = payload.data || payload;

        if (charge.object === 'charge' && charge.status === 'successful') {
            const chargeId = charge.id;
            const orderId  = charge.metadata?.order_id;

            // Primary lookup: by charge_id (real Omise path — always hits)
            // Fallback lookup: by order_id from metadata (fake-omise path —
            //   charge_id is random and not in DB, but order_id is real)
            let order = await env.DB.prepare(
                `SELECT order_id, device_id, product_id, status FROM orders WHERE omise_charge_id = ?`
            ).bind(chargeId).first();

            if (!order && orderId) {
                order = await env.DB.prepare(
                    `SELECT order_id, device_id, product_id, status FROM orders WHERE order_id = ?`
                ).bind(orderId).first();
            }

            if (!order) {
```

Also find the existing `if (!order)` early-return block and **DELETE IT** — it is now superseded by the fallback above. The old block looks like:
```javascript
            if (!order) {
                // Charge ID not found — could be from a different system, just ack
                console.warn(`Webhook: no order found for charge ${chargeId}`);
                return Response.json({ status: 'ok', note: 'charge not found' });
            }
```

Replace that old block with:
```javascript
            if (!order) {
                console.warn(`Webhook: no order found for charge ${chargeId} or order ${orderId}`);
                return Response.json({ status: 'ok', note: 'charge not found' });
            }
```

Also update the `failed` block — find:
```javascript
        if (payload.object === 'charge' && payload.status === 'failed') {
            const chargeId = payload.id;
```

Replace with:
```javascript
        if (charge.object === 'charge' && charge.status === 'failed') {
            const chargeId = charge.id;
```

### Nothing else in webhook.js changes.
All idempotency logic, race condition guard, addCommand call — untouched.

---

## FIX 2 — PROJECT_STATE.md UPDATES

Update PROJECT_STATE.md to reflect the following (add at TOP of SESSION LOG):

```
### 2026-06-16 — webhook payload mismatch fix (R-124)
- **ROOT CAUSE:** fake-omise-worker.js (R-107) wraps charge in { key, data:{...} }
  but webhook.js read payload.object directly — never matched. Handler returned ok
  immediately with no DB write and no command queued. Machine polled forever.
- **FIX:** src/handlers/webhook.js — const charge = payload.data || payload
  All charge reads changed from payload.* to charge.*
  Fallback DB lookup by order_id added for fake-omise random charge_id case.
- **RULE ADDED:** R-124 — see RULES.md
- **Real Omise:** unaffected — payload.data is undefined for real Omise,
  charge falls back to payload. Real charge_id always in DB.
- **File changed:** src/handlers/webhook.js only
```

Also update the endpoint table — find `/v1/webhook/omise` row and update Notes:
```
✅ HMAC skipped on fake_omise · R-124: unwraps { key, data } envelope from fake-omise
```

Also update these items in the Pending section:
- Mark `Heartbeat HTTP 500` as still open (connection_logs column mismatch — separate fix)
- Add note: `simulator.html gestScan() flow — FIXED 2026-06-16 via R-124`

---

## VERIFY BEFORE PR

1. Run `curl` to confirm webhook now processes correctly:
```bash
# Create a test order first, get order_id, then:
curl -X POST https://api.janishammer.com/v1/webhook/omise \
  -H "Content-Type: application/json" \
  -d '{"key":"charge.complete","data":{"object":"charge","id":"fake_chg_test","status":"successful","metadata":{"order_id":"REPLACE_WITH_REAL_ORDER_ID"}}}'
# Expected: {"status":"ok"} AND order status changes to 'paid' in DB
```

2. Run satu-system-tester.html → confirm 14/14 still passing

3. Open simulator.html → select any machine → tap product → click Simulate Scan gesture
   Expected: log shows `[SIM] Fake payment triggered` then state advances to vending screen

---

## DO NOT TOUCH

- satu-system-tester.html
- satu-machine-tester.html
- simulator.html
- fake-omise-worker.js  ← the worker is correct, webhook.js is the problem
- Any firmware files
- wrangler.toml
- hardware.h — R2 LOCKED
- PAYMENT_MODE stays fake — never change to live

---

## MANDATORY END OF SESSION

1. Append to RULES.md at TOP:
```
R-124: fake-omise-worker wraps charge in { key:'charge.complete', data:{ object:'charge', ... } }.
webhook.js MUST use: const charge = payload.data || payload;
Then read charge.object, charge.status, charge.id, charge.metadata — never payload.* directly.
Real Omise sends charge at top level — payload.data is undefined — falls back to payload correctly.
This dual-envelope pattern must be preserved in any future webhook rewrites.
(Added 2026-06-16)
```

2. Update PROJECT_STATE.md — session log entry (see FIX 2 above)

3. Run 14-test suite — confirm 14/14 pass — paste result in PR body

4. Archive this prompt → docs/prompts/ stamped:
   `✅ COMPLETE — 2026-06-16 — webhook R-124 payload envelope fix`

5. Merge to main

---

## PAYMENT MODE REMINDER
PAYMENT_MODE stays fake. Never suggest live.
