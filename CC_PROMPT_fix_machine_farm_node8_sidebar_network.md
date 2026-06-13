# CC_PROMPT_fix_machine_farm_node8_sidebar_network.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix Node 8 + restructure UI to sidebar + add Network View tab
> Repo: Satu-vending-backend
> File: public/satu-machine-tester.html ONLY
> Mode: Fix Mode
> CSS: DO NOT CHANGE existing colors, fonts, or theme — layout restructure only

---

## CC INTRO
New session. Ignore all previous context from other projects.

You are working on SATU 1.0 at:
https://github.com/Csmittee/Satu-vending-backend

Before doing anything else, read IN FULL:
1. CLAUDE.md
2. RULES.md
3. public/satu-machine-tester.html (full file)

State every file read before writing a single line.

---

## CONTEXT

Machine Farm Simulator was built in previous session. Two bugs found
in QA + owner requested UI restructure. All fixes in one session.

---

## FIX 1 — Node 8 Idempotency: must create its own fresh order

**Bug:** Node 8 reuses the order from Node 3. By the time Node 8
runs, Node 7 (Completion) has already marked that order dispensed
and commands are cleared from queue. count=0 always. Wrong.

**Fix:** Node 8 creates its own fresh order before testing:
1. POST /v1/order with same device + product → new order_id + omise_charge_id
2. Fire webhook once with new charge_id
3. Wait 1200ms
4. Fire same webhook again (exact duplicate)
5. Wait 1200ms
6. Poll /v1/machine/commands, count payment_confirmed for NEW order_id only
7. Pass if count === 1 | Fail if count === 0 or count > 1

Show the fresh order_id in Node 8 expandable detail.

---

## FIX 2 — Arrow connectors: make them visible

Current connectors between node cards are not visible enough.
Fix the connector elements between nodes so they show clearly:
- A vertical line
- A ▼ arrow at the bottom
- Color: dark grey when pending, dark green when upstream passed,
  dark red when upstream failed
- Improve space usage,so it can be seen in one screen height, can go horizonal way if need because fix 3 will give more space to desplay area.
- Do NOT change any other CSS

---

## FIX 3 — UI restructure: sidebar + tabs

**Keep all existing CSS colors, fonts, theme — layout only.**

### New page structure:

```
┌──────────────┬────────────────────────────────────────┐
│   SIDEBAR    │   MAIN CONTENT AREA                    │
│              │                                        │
│ > Single     │   [content for selected section]       │
│   Flow       │                                        │
│              │                                        │
│ > Machine    │                                        │
│   Fleet      │                                        │
│              │                                        │
└──────────────┴────────────────────────────────────────┘
```

### Sidebar (left, fixed, ~200px wide)
Dark background matching current theme.
Two nav items:
```
🔬 Single Flow Test     ← Section A (default selected)
🖥️ Machine Fleet        ← Section B
```
Active item: gold left border + slightly lighter background.
Title at top of sidebar: "SATU" in gold, "Machine Farm" below in grey.

### Section A — Single Flow Test (unchanged content)
Exactly the same 8-node flow, Run All / Step / Reset controls,
device + product dropdowns. No content changes — layout only.

### Section B — Machine Fleet
Two tabs inside the main content area:
```
[ 🔥 Stress Test ]  [ 🌐 Network View ]
```

**Tab 1 — Stress Test (existing Section B content)**
Exactly the same: machine slots, Fire All Simultaneously,
Reset Fleet, stress test results panel. No content changes.

**Tab 2 — Network View**
A live visual network diagram showing all configured machines
and their connection to the backend.

#### Network View layout:
Canvas-style area (full width of content, ~500px tall).
Shows nodes as circles/boxes connected by animated lines.

```
[SATU-SIM01] ──────────────┐
                            ├──► [BACKEND API] ──► [D1 DATABASE]
[SATU-TEST001] ─────────────┘
```
Nodes to show (left to right flow):

[Machine 1] ──►  [Backend API]  ──►  [Omise/Fake Gateway]
[Machine 2] ──►       │         ──►  [Webhook Handler]
[Machine N] ──►       ▼              [Command Queue]
                  [D1 Database]  ──►  [Device Commands]
Each node is expandable — click to see last request/response.
Backend API node shows sub-nodes when expanded:

/hello handler
/order handler
/webhook handler
/commands handler

Payment Gateway node shows:

Current mode (fake/live) from /health
Last charge_id processed

Command Queue node shows:

Pending command count
Last command type + timestamp

Lines animate when active, grey when idle.
All node data updates after each Fire All run.
Each machine node shows:
- Device ID (short form)
- Status badge: ⏳ Ready / 🔄 Active / ✅ Done / ❌ Failed
- Last response time (ms) if fired

Backend node shows:
- "api.janishammer.com"
- Request count during this session
- Last response time

D1 node shows:
- "D1 Database"
- Inferred status from /health

#### Animated connection lines:
When Fire All is clicked and machines are running:
- Lines pulse/animate from machine → backend → D1
- Green pulse = success signal travelling
- Red pulse = failure
- Grey = idle

Use CSS animation for the pulse — a moving dot along the SVG line
or a CSS keyframe on border/opacity. Keep it subtle not distracting.

#### Network View updates automatically:
- When machines are added/removed in Stress Test tab →
  network diagram adds/removes machine nodes
- When Fire All runs → lines animate for duration of the run
- When complete → lines settle to green (pass) or red (fail)
- Heartbeat indicator: a slow pulse on each node every 3s
  (simulated — shows the machine is "alive")

#### Implementation note:
Use inline SVG for the connection lines between nodes.
Machine nodes and backend node are absolutely positioned divs
overlaid on the SVG canvas. Lines drawn as SVG <line> or <path>
elements connecting node center points.
No external libraries — vanilla JS + SVG + CSS animation only.

---

## Activity Log
Keep full-width at bottom, unchanged.

---

## DO NOT TOUCH
- Any CSS colors, fonts, spacing, theme variables
- simulator.html
- satu-system-tester.html
- satu-admin.html
- satu-preflight.html
- src/ files
- PAYMENT_MODE (must stay fake)
- hardware.h

---

## VERIFICATION (CC confirms before closing)

1. Node 8 creates fresh order — passes with count===1
2. Arrow connectors visible between all 8 nodes in Section A
3. Sidebar renders with 2 nav items, gold active state
4. Section A loads by default on page open
5. Section B shows 2 tabs: Stress Test + Network View
6. Network View shows machine nodes + backend + D1 connected by lines
7. Lines animate when Fire All runs
8. Cloudflare build GREEN after merge
9. All 14 system tests still pass

---

## MANDATORY (end of session)

1. Commit: `fix: node8 fresh order + sidebar layout + network view tab`
2. Update PROJECT_STATE.md — machine farm simulator: node 8 fixed,
   sidebar layout added, network view tab added
3. Archive prompt → docs/prompts/ stamped ✅ COMPLETE — 2026-06-13
4. Merge to main

---

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.

---
> This is the final backend prompt for this session sequence.
> After merge: owner starts new chat with CHAT_HANDOFF.md
> Next task for new chat: CC_PROMPT_firmware_qr_png_fetch.md
> (already in Satu-Vending-Firmware/docs/prompts/)
