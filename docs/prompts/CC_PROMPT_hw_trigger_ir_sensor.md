# CC_PROMPT_hw_trigger_ir_sensor.md
✅ COMPLETE — 2026-06-17 — HW Trigger IR sensor button + /v1/machine/command-inject endpoint

## What was done

### TASK 1 — src/commands/queue.js (addCommand whitelist check)
**Result: NO WHITELIST EXISTS.** addCommand() in src/commands/queue.js is a single INSERT
statement with no command string validation. Any command string is accepted directly.
No change needed. Confirmed in PR notes.

### TASK 2 — POST /v1/machine/command-inject endpoint (NEW)
- Added `handleCommandInject` to `src/handlers/admin.js`
- Auth: X-Admin-Token header required (same pattern as all admin endpoints)
- Validation: device_id and command required — 400 if missing
- No command whitelist — any string allowed (test tool only)
- Logs: `[INJECT] command queued: <command> → <device_id>`
- Returns: `{ status:'ok', command, device_id }`
- Wired in `src/index.js` as POST /v1/machine/command-inject
- Added import to index.js admin.js destructure line
- Version bumped to R4.1 in changelog comment and / endpoint list

### TASK 3 — public/satu-machine-builder.html Section C
- Added `🔦 IR Sensor Triggered` button (id=hw-btn-sensor) as first button in Dispensing Cycle card
- Button disabled when hw-order-id empty (consistent with existing dispensing buttons)
- Added `hw-btn-sensor` to `updateHwButtonStates()` disable logic
- Added `hwSensorTriggered()` async function:
  - Reads deviceId from hw-device-select
  - Reads hwOrderId from hw-order-id input
  - Reads adminToken from hw-admin-token input
  - POSTs to /v1/machine/command-inject with { device_id, command:'sensor_triggered', data:{ order_id } }
  - farmLog '[HW] sensor_triggered queued → motor will stop' on success
  - farmLog '[HW] sensor_triggered FAILED: <status>' on error

### RULES + DOCS
- R-142 prepended to RULES.md
- PROJECT_STATE.md session log updated
- This prompt archived to docs/prompts/

### 14-test suite
NOT MODIFIED. The command-inject endpoint is intentionally excluded from the test suite (R-142).
satu-system-tester.html unchanged — 14/14 still passing.
