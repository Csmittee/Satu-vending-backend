# CC_BUILD_PROMPT_tester_redesign.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Upgrade Vending Machine Simulator + redesign Machine Farm Simulator
>               with multi-machine fleet stress testing
> Sequence: Prompt 2 of 3 (backend fix ✅ → tester redesign → QR firmware fix)
> PR target: main (Satu-vending-backend repo)
> Mode: Build Mode
> Prerequisite: Cloudflare build GREEN ✅ (confirmed 2026-06-13 14:05 TH)

---

## CC INTRO
New session. Ignore all previous context from other projects.

You are working on SATU 1.0 at:
https://github.com/Csmittee/Satu-vending-backend

Before doing anything else, read IN FULL:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. public/simulator.html
5. public/satu-machine-tester.html
6. WORKFLOW_SKILL.md

State the name of every file you read before writing a single line.
Then execute this prompt.

---

## CONTEXT — THREE-TESTER ARCHITECTURE (R-94)

Exactly 3 testing tools going forward:

| # | File | Name | Purpose |
|---|------|------|---------|
| 1 | `satu-system-tester.html` | Backend System Tester | 14-test automated API suite — DO NOT MODIFY |
| 2 | `simulator.html` | Vending Machine Simulator | Full touch screen UI + connection status drawer |
| 3 | `satu-machine-tester.html` | Machine Farm Simulator | n8n node flow + multi-machine stress test |

`simulator_r3.html` — DELETE. Fully superseded.

---

## CONFIRMED DEVICES IN D1 (never create others)

| MAC | Device ID | Role |
|-----|-----------|------|
| `AA:BB:CC:DD:EE:01` | SATU-SIM01 | Simulator default |
| `3C:DC:75:5D:DD:2C` | SATU-4R473R | Physical ESP32 |
| `AA:BB:CC:DD:EE:00` | SATU-TEST001 | Backend test suite |

---

## TASK 1 — Delete simulator_r3.html

Delete `public/simulator_r3.html` entirely.

---

## TASK 2 — Upgrade public/simulator.html → "Vending Machine Simulator"

Keep ALL existing functionality. Additive changes only.

### 2A — Header title
Change displayed title to: `SATU VENDING MACHINE SIMULATOR`

### 2B — Replace MAC input with approved device dropdown
Replace MAC text input with:

```html
<label style="font-size:10px;color:#555;letter-spacing:1px;">
  DEVICE (approved only — no free entry)
</label>
<select id="sim-mac" style="background:#111;border:1px solid #333;
  color:#ccc;padding:4px 8px;font-family:monospace;font-size:11px;">
  <option value="AA:BB:CC:DD:EE:01">SATU-SIM01 — Simulator</option>
  <option value="3C:DC:75:5D:DD:2C">SATU-4R473R — Physical ESP32</option>
  <option value="AA:BB:CC:DD:EE:00">SATU-TEST001 — Backend tests</option>
</select>
```

Update sendHello() / bootSequence() to read dropdown value.
Remove genMac() function entirely — random MACs create ghost devices in D1.

### 2C — Connection Status toggle drawer
Add toggle button in sim-controls row: `[📊 Connection Status ▼]`
Toggles a panel showing 6 live status indicators:

```
🔌 Backend Connection   — green after /hello 200, red on error
💾 Database (D1)        — inferred from /health, yellow if unknown
📦 Order Creation       — green after /order 200, red on 4xx/5xx
💳 Payment Gateway      — shows payment_mode value from /health
🤖 Machine Command      — green when payment_confirmed received
🔁 Webhook Idempotency  — Not tested / ✅ Pass / ❌ Fail
```

Each indicator updates automatically as the relevant API call runs.
Panel hidden by default. Button toggles ▼/▲.

### 2D — Idempotency test button inside drawer
Add `[🔁 Run Idempotency Test]` button at bottom of drawer.

Sequence:
1. Create order with current device + product_id 2
2. Build webhook payload:
   `{ object:'charge', id: omise_charge_id, status:'successful',
     metadata:{ order_id } }`
3. POST to `/v1/webhook/omise` twice, 1200ms apart
4. Wait 1200ms, GET `/v1/machine/commands?device_id=...`
5. Count `payment_confirmed` for that order_id
6. count===1 → green ✅ PASS | count===0 → red ❌ No command |
   count>1 → red ❌ FAIL duplicate
7. Log full result to sim-log

---

## TASK 3 — Full redesign: public/satu-machine-tester.html
## → "Machine Farm Simulator"

Complete file replacement. Purpose: test the full backend integration flow
AND simulate a real-world fleet of multiple machines firing simultaneously
to discover performance limits and contention issues before real deployment.

---

### PAGE STRUCTURE

```
┌─────────────────────────────────────────────────────────────┐
│  SATU MACHINE FARM SIMULATOR                                │
│  End-to-end integration flow + multi-machine stress test    │
├──────────────────┬──────────────────────────────────────────┤
│  SECTION A       │  SECTION B                               │
│  Single Flow     │  Machine Fleet (stress test)             │
│  (node diagram)  │  (2-3 machines in parallel)              │
├──────────────────┴──────────────────────────────────────────┤
│  ACTIVITY LOG                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### SECTION A — Single Flow Test (left panel, 50%)

#### Controls
```
Device: [dropdown — 3 approved devices, default SATU-TEST001]
Product: [dropdown — products 1-10]
[▶ Run All]  [⏭ Step]  [🔄 Reset]
```

**Run All**: executes nodes 1→8 in sequence, 800ms between each.
Stops on first failure, marks remaining ⏸ Skipped.

**Step**: executes one pending node per click.

**Reset**: all nodes → ⏳ Pending, log cleared.

#### 8 Nodes (vertical, connected by arrows)

Each node card shows: icon, name, status badge, expandable detail.
Status: `⏳ Pending` / `🔄 Running` / `✅ Pass` / `❌ Fail` / `⏸ Skipped`

```
Node 1: 🔌 Backend Health
  GET /health
  Pass: HTTP 200, status:"ok"
  Shows: payment_mode, version

Node 2: 🖥️ Device Registration
  POST /v1/machine/hello {mac, firmware:"v1.0.0-farm"}
  Pass: HTTP 200, has device_id + device_secret
  Shows: device_id, status

Node 3: 🛒 Order Creation
  POST /v1/order {device_id, product_id}
  Pass: HTTP 200/201, has order_id + qr_code_url
  Shows: order_id, amount, qr_code_url

Node 4: 📱 QR Reachability
  HEAD request to qr_code_url (no-cors)
  Pass: HTTP 200 + image content-type
  Note: mark ⚠️ Unverifiable if CORS blocks — not a failure

Node 5: 💳 Payment Simulation
  POST /v1/webhook/omise
  {object:'charge', id:omise_charge_id,
   status:'successful', metadata:{order_id}}
  Pass: HTTP 200

Node 6: 📡 Command Delivery
  GET /v1/machine/commands?device_id=...
  Poll up to 5× with 800ms gap
  Pass: payment_confirmed found for this order_id
  Shows: attempts taken, command data

Node 7: ✅ Completion Report
  POST /v1/machine/completion
  {device_id, order_id, success:true, slot:1}
  Pass: HTTP 200

Node 8: 🔁 Idempotency Check
  Fire Node 5 webhook a 2nd time, wait 1200ms
  Poll commands, count payment_confirmed for this order
  Pass: count still === 1
  Shows: count, reason
```

Arrow connectors: grey=pending, green=both passed, red=upstream failed.

---

### SECTION B — Machine Fleet Stress Test (right panel, 50%)

**Purpose**: fire 2-3 machines simultaneously to discover:
- D1 write contention under parallel orders
- Command queue isolation per device
- Cloudflare Worker concurrency behavior
- Rate limiter response to burst traffic
- Whether heartbeats from N devices conflict
- Maximum safe concurrent machine count

#### Fleet Configuration
```
[+ Add Machine]  (up to 3 total)
[▶ Fire All Simultaneously]
[📊 View Results]
[🔄 Reset Fleet]
```

Each machine slot shows:
```
Machine N  [Device dropdown]  [Product dropdown]  [✕ Remove]
Status: ⏳ Ready / 🔄 Firing / ✅ Done / ❌ Failed
Last result: [summary line]
```

Default on load: 2 machine slots pre-populated:
- Machine 1: SATU-SIM01, product 2 (Small Amulet, 20 THB)
- Machine 2: SATU-TEST001, product 3 (Medium Amulet, 50 THB)

[+ Add Machine] adds a 3rd slot. Maximum 3 (hard limit — D1 safe).

#### Fire All Simultaneously
When clicked, ALL machine slots fire their full flow IN PARALLEL:
- Each machine runs: /hello → /order → webhook → poll commands
- All fired at exactly the same moment using Promise.all()
- Each machine tracks its own state independently
- Timer starts when Fire is clicked, stops when last machine completes

#### Results Panel (appears after Fire All completes)
```
┌─────────────────────────────────────────┐
│  STRESS TEST RESULTS                    │
├─────────────────────────────────────────┤
│  Machines fired:     2 (or 3)           │
│  All succeeded:      ✅ Yes / ❌ No     │
│  Total time:         Xms                │
│  Avg per machine:    Xms                │
│                                         │
│  Machine 1 (SATU-SIM01):    ✅ 842ms   │
│  Machine 2 (SATU-TEST001):  ✅ 956ms   │
│  Machine 3 (SATU-4R473R):   ❌ timeout │
│                                         │
│  ⚠️ OBSERVATIONS:                      │
│  [auto-generated based on results]      │
└─────────────────────────────────────────┘
```

Auto-generated observations logic:
- If any machine timed out → "Command delivery timeout detected —
  possible D1 write contention or rate limiting under load"
- If all succeeded under 1000ms → "Backend handles N concurrent
  machines cleanly at current load"
- If total > 3000ms → "Latency spike detected — monitor under higher load"
- If rate limit hit (429) → "Rate limiter triggered —
  consider raising limit for multi-machine deployments"

#### Important: device isolation rule
The 3 machines MUST use different device IDs from the approved list.
If owner tries to add a 4th machine or duplicate device → show error:
"Maximum 3 machines. All must use different approved device IDs."

---

### SECTION C — Activity Log (full width, bottom)

Scrollable log showing ALL activity from both sections.
Format: `[HH:MM:SS] [Machine N / Flow] message`
Color: grey=info, green=pass, red=fail, yellow=warning, blue=network

---

### Styling
Gold/dark Satu theme throughout:
- Background: #0a0b0e
- Gold: #d4a843
- Surface: #12131a
- Cards: #1a1b26
- Mono font for IDs/URLs/results
- System font for labels
- Subtle gold border on node card hover

---

## TASK 4 — Update wrangler.toml comments

Update comment block at top of wrangler.toml:
```toml
#  HTML pages served at their filename path:
#    public/simulator.html              → /simulator
#    public/satu-system-tester.html     → /satu-system-tester
#    public/satu-machine-tester.html    → /satu-machine-tester
#    public/satu-preflight.html         → /satu-preflight
#    public/satu-admin.html             → /satu-admin
#    (simulator_r3.html DELETED 2026-06-13)
```

---

## TASK 5 — Update WORKFLOW_SKILL.md

Add this section at end of file under new heading
"## CC PROMPT FILE NAMING — PERMANENT CONVENTION (2026-06-13)":

```markdown
## CC PROMPT FILE NAMING — PERMANENT CONVENTION (2026-06-13)

All CC prompts written by Chat as downloadable .md files.
Owner pushes to docs/prompts/ in relevant repo before running CC.
CC executes then archives stamped ✅ COMPLETE — [date] — [summary].

| Prompt type | Filename pattern |
|-------------|-----------------|
| Quick fix (1-2 files) | CC_PROMPT_fix_[topic].md |
| Build/feature (multi-file) | CC_BUILD_PROMPT_[topic].md |
| Firmware change | CC_PROMPT_firmware_[topic].md |

Every prompt file MUST contain:
1. CC INTRO block (repo URL, files to read, role reminder)
2. CONTEXT — why this prompt exists + sequence position
3. TASK list — numbered, explicit, file-scoped
4. DO NOT TOUCH list
5. VERIFICATION STEPS — what CC confirms before closing
6. MANDATORY closing actions (RULES.md, PROJECT_STATE.md, archive, merge)
7. PAYMENT MODE REMINDER
8. Sequence note (Prompt N of N, next prompt name)

Benefits: full audit trail in docs/prompts/ matching GitHub PR history.
Owner can hand any prompt to a new CC session independently.
```

---

## DO NOT TOUCH
- `src/` — any backend source files
- `satu-system-tester.html` — never modify the 14-test suite
- `satu-admin.html`
- `satu-preflight.html`
- `schema.sql`
- `hardware.h`
- PAYMENT_MODE (must stay fake)

---

## VERIFICATION STEPS (CC must complete before closing)

1. `simulator_r3.html` deleted — `api.janishammer.com/simulator_r3` → 404
2. `api.janishammer.com/simulator` — device dropdown shows 3 options
3. Connection Status drawer opens/closes on toggle button
4. `api.janishammer.com/satu-machine-tester` — 8 nodes render, arrows visible
5. Machine Fleet section shows 2 default machine slots
6. [▶ Run All] in Single Flow executes all 8 nodes in sequence
7. [▶ Fire All Simultaneously] fires 2 machines in parallel, results panel appears
8. Run `satu-system-tester.html` — all 14 tests must still pass — report result
9. Cloudflare build GREEN after merge

---

## MANDATORY (end of session)

1. Commit message:
   `feat: tester consolidation — simulator upgrade + machine farm with stress test`

2. Append to RULES.md (newest at TOP):
```
- **R-99 CC PROMPT FILE CONVENTION — PERMANENT (2026-06-13):**
  All CC prompts = downloadable .md files written by Chat.
  Naming: CC_PROMPT_fix / CC_BUILD_PROMPT / CC_PROMPT_firmware
  Stored in docs/prompts/. Archived ✅ COMPLETE after merge.
  Follow 8-section template defined in WORKFLOW_SKILL.md.

- **R-94 THREE-TESTER ARCHITECTURE — PERMANENT (2026-06-13):**
  satu-system-tester.html = Backend API suite (14 tests, never modify)
  simulator.html          = Vending Machine Simulator (touch UI + drawer)
  satu-machine-tester.html = Machine Farm Simulator (node flow + stress)
  simulator_r3.html DELETED 2026-06-13.
  No new test files without owner + Chat approval.

- **R-100 MACHINE FARM STRESS TEST — PERMANENT (2026-06-13):**
  Machine Farm Simulator supports max 3 concurrent machines.
  All must use approved device IDs from D1 — no random MACs.
  Promise.all() parallel firing tests D1 contention + rate limits.
  Results panel auto-generates observations for capacity planning.
```

3. Update PROJECT_STATE.md:
   - public/ inventory: update to 3-tester architecture
   - simulator_r3.html: marked deleted
   - simulator.html: upgraded — device dropdown, connection drawer, idempotency button
   - satu-machine-tester.html: redesigned as Machine Farm Simulator with
     8-node flow diagram + multi-machine stress test (max 3 concurrent)
   - Note: stress test designed to discover D1 contention, rate limits,
     Cloudflare concurrency thresholds before real multi-temple deployment

4. Archive prompt → `docs/prompts/` stamped:
   `✅ COMPLETE — 2026-06-13 — tester redesign: simulator upgrade + machine farm simulator`

5. Merge to main

---

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.

---
> Previous: CC_PROMPT_fix_index_js_template_literal_build_error.md ✅
> Next: CC_PROMPT_firmware_qr_png_fetch.md (push to Satu-Vending-Firmware repo)
> Do not start Prompt 3 until this build is GREEN and 14 tests pass.
