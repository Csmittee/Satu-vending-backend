# CC_BUILD_PROMPT_split_machine_builder_v1.md
> ✅ COMPLETE — 2026-06-19 — split satu-machine-builder.html into 3 files (satu-machine-builder ~530 lines, satu-hw-trigger ~280 lines, satu-wiring 1398 lines). RULES.md refactored 285→60 lines. R-147 added.
> Prompt 1 of 1 — Split satu-machine-builder.html into 3 self-contained files
> Repo: https://github.com/Csmittee/Satu-vending-backend
> Created: 2026-06-19
> Mode: Build — read PROJECT_STATE.md

---

## 1. CC INTRO

New session. Ignore all previous context from other projects.
Repo: https://github.com/Csmittee/Satu-vending-backend

Read IN FULL before touching anything — state each filename aloud after reading:
1. CLAUDE.md
2. RULES.md
3. CC_SKILL.md
4. PROJECT_STATE.md
5. KNOWLEDGE_MAP.md
6. public/satu-machine-builder.html  ← read the ENTIRE file, all ~1800 lines

State: "All 6 files read ✅" before writing a single line of code.

---

## 2. CONTEXT

`public/satu-machine-builder.html` is ~1800 lines (~127KB).
R-145 requires any HTML file over 1000 lines to be split before the next CC session.
Owner has confirmed the split. This prompt executes it.

**Why this split matters:**
A single 1800-line file requires 4 agents and massive tokens to edit safely.
After the split, each file is ~300–400 lines. CC can read and fix it in one
agent with one read. This is the architectural goal — not a cosmetic change.

**What exists in the live file right now (CC must verify by reading):**
- Section A: 🔬 Single Flow Test — 8-node end-to-end flow diagram
- Section B: 🖥️ Machine Fleet — stress test, Promise.all parallel firing
- Section C: ⚡ HW Trigger — payment sim + IR sensor + dispense cycle buttons
- Section D: 🔌 Wiring — draggable SVG diagram, BOM, signal flow sim, model tabs

All 4 sections share one left sidebar nav and one activity log (`farmLog()`).

**Confirmed by owner:** UI/UX is locked and tested. Zero visual or logic changes.

---

## 3. NEW FILES

Two new files. CC must add both to KNOWLEDGE_MAP.md and CLAUDE.md key files.

```
public/satu-hw-trigger.html   ← Section C content (HW Trigger) — new standalone file
public/satu-wiring.html       ← Section D content (Wiring) — new standalone file
```

`public/satu-machine-builder.html` keeps its filename — Section A + B only.

---

## 4. TASKS

### OVERVIEW — THE SPLIT RULE

Each of the 3 output files must be:
- 100% self-contained — all CSS, all JS, all HTML in one file
- No imports between files, no shared .js files
- Identical gold/dark theme: `#0a0b0e` bg · `#d4a843` gold · `#12131a` cards
- Same left sidebar nav in all 3 files with cross-file `<a href>` links (not JS routing)
- Active page highlighted in gold in that file's sidebar
- ZERO logic changes — copy JS/HTML exactly as-is from source
- If a function is used in a section being extracted but defined elsewhere in
  the file, copy that function into the new file — do not refactor or rename

---

### TASK 1 — READ AND MAP BEFORE WRITING (mandatory)

Read `public/satu-machine-builder.html` in full.
Before writing any output file, state in your response:
- Exact line ranges for section-a, section-b, section-c, section-d
- Exact line range for the shared CSS block
- Exact line range for the shared sidebar HTML
- Exact line range for `farmLog()` and the shared activity log panel
- Exact line range for `showSection()` function
- Exact line range for `wiringInit()` and all wiring-related functions
- Any functions used in section-c that are defined outside section-c
- Any functions used in section-d that are defined outside section-d
- Confirm localStorage keys used in section-d (wiring models)

Do NOT proceed to Task 2 until this mapping is stated.

---

### TASK 2 — FILE 1: public/satu-machine-builder.html (REPLACE IN PLACE)

Keep: Section A (Single Flow Test) + Section B (Machine Fleet)
Remove: Section C, Section D, and all wiring-only JS

**Sidebar nav in this file:**
```html
<div id="nav-a" class="nav-item active">🔬 Single Flow Test</div>
<div id="nav-b" class="nav-item" onclick="showSection('b')">🖥️ Machine Fleet</div>
<a href="/satu-hw-trigger" class="nav-item">⚡ HW Trigger</a>
<a href="/satu-wiring" class="nav-item">🔌 Wiring</a>
```
- nav-a and nav-b remain JS-driven (same as today — showSection() unchanged)
- nav-c and nav-d become `<a href>` links — no JS, no onclick
- Gold highlight: nav-a active by default (Section A shows on load)
- `showSection()` in this file only handles 'a' and 'b' — remove 'c' and 'd' cases
- Remove: all wiring JS (wiringInit, wiringRenderDiagram, wiringInspect, etc.)
- Remove: all section-c HTML and hwSensorTriggered, hwDispense, updateHwButtonStates
- Keep: farmLog(), the activity log panel, all Section A + B JS

**Expected output: ~400–500 lines**

---

### TASK 3 — FILE 2: public/satu-hw-trigger.html (NEW FILE)

Contains: Section C (HW Trigger) only — complete and standalone

**Sidebar nav in this file:**
```html
<a href="/satu-machine-builder" class="nav-item">🔬 Single Flow Test</a>
<a href="/satu-machine-builder" class="nav-item">🖥️ Machine Fleet</a>
<div class="nav-item active" style="color:#d4a843;">⚡ HW Trigger</div>
<a href="/satu-wiring" class="nav-item">🔌 Wiring</a>
```
- All links are `<a href>` — no showSection() in this file
- Section C content loads immediately on page load — no tab switching needed
- Keep: farmLog(), the activity log panel (Section C uses it)
- Keep: updateHwButtonStates(), hwSensorTriggered(), hwDispense() — all Section C JS
- Keep: all Section C CSS (.hw-hint, .hw-status, .hw-warn-box, .btn-success, etc.)
- Keep: sidebar brand "SATU" + "Machine Farm" — identical to original
- Remove: all wiring JS, all Section A + B JS

**Confirmed endpoints used in Section C (copy exactly, do not modify):**
- GET `https://api.janishammer.com/v1/order/{orderId}/status` — Lookup
- POST `https://fake-omise.csmittee.workers.dev/simulate-payment` — Pay Pass
- POST `https://api.janishammer.com/v1/webhook/omise` — Pay Fail
- POST `https://api.janishammer.com/v1/machine/command-inject` — IR sensor (R-142)
- POST `https://api.janishammer.com/v1/machine/completion` — Dispense cycle buttons

**Expected output: ~300–350 lines**

---

### TASK 4 — FILE 3: public/satu-wiring.html (NEW FILE)

Contains: Section D (Wiring) only — complete and standalone

**Sidebar nav in this file:**
```html
<a href="/satu-machine-builder" class="nav-item">🔬 Single Flow Test</a>
<a href="/satu-machine-builder" class="nav-item">🖥️ Machine Fleet</a>
<a href="/satu-hw-trigger" class="nav-item">⚡ HW Trigger</a>
<div class="nav-item active" style="color:#d4a843;">🔌 Wiring</div>
```
- All links are `<a href>` — no showSection() in this file
- Section D content loads immediately on page load — no tab switching needed
- Keep: ALL wiring JS verbatim — wiringInit(), wiringRenderDiagram(), wiringInspect(),
  wiringShowSubTab(), wiringResetLayout(), simLog(), simRun(), simStop(),
  animateDotAlongWire(), model management, drag logic, BOM generation — everything
- Keep: all wiring CSS — W_NODE_DEFS, W_HARNESS_DEFS, H, HW constants
- Keep: localStorage keys `satu_wiring_models` + `satu_wiring_active_model` — unchanged
- Keep: `window.addEventListener('load', wiringInit)` — wiring initialises on load
- Keep: `window.addEventListener('resize', wiringSetViewBox)` — responsive SVG
- Keep: `document.addEventListener('mouseup', wiringCanvasUp)` — drag release
- Keep: farmLog() + activity log panel — wiring signal sim uses it
- Keep: `@media print` block — unchanged
- Remove: all Section A + B + C JS and HTML

**Expected output: ~900–1000 lines**
Note: satu-wiring.html will be the largest of the 3 files due to wiring constants.
This is expected and acceptable — it is already self-contained (sub-tabs, SVG canvas,
BOM, model management). No further split needed unless owner requests.

---

### TASK 5 — wrangler.toml: register new routes

Add to the comment block at top of wrangler.toml (the HTML page route table):
```
#    public/satu-hw-trigger.html   → /satu-hw-trigger
#    public/satu-wiring.html       → /satu-wiring
```
Cloudflare static assets auto-serve from public/ by filename — no route config needed.
The comment update is documentation only. Do NOT add routes[] entries for HTML files.

---

## 5. DO NOT TOUCH

- `public/satu-system-tester.html` — R-94 LOCKED, never modify
- `public/simulator.html` — never modify
- `public/satu-admin.html` — never modify
- `hardware.h` — R2 LOCKED
- `config.h` / `config.h.example`
- Any file in `src/` — zero backend changes
- `schema.sql`
- PAYMENT_MODE — stays `fake`
- Any `.ino` or `.h` firmware files
- The 14-test suite — no changes, must still pass 14/14

**Logic preservation rules (verify these survive the split):**
- `farmLog()` function signature and behaviour — identical in all 3 files
- `showSection()` in satu-machine-builder.html — handles only 'a' and 'b' after split
- `wiringInit()` called on `window load` in satu-wiring.html — must not be removed
- `updateHwButtonStates()` called on `window load` in satu-hw-trigger.html
- All 3 approved device IDs preserved in HW Trigger device selector:
  - `3C:DC:75:5D:DD:2C — SATU-4R473R` (default)
  - `AA:BB:CC:DD:EE:00 — SATU-TEST001`
  - `AA:BB:CC:DD:EE:01 — SATU-SIM01`
- Sidebar brand "SATU" + subtitle "Machine Farm" — identical in all 3 files
- Gold/dark theme CSS — identical in all 3 files

---

## 6. VERIFICATION

CC must confirm each item before closing the PR:

**Per-file checks:**
1. `satu-machine-builder.html` — open in browser (file://): Section A loads, Run All works, Section B accessible, no console errors, no blank screen
2. `satu-hw-trigger.html` — open in browser: Section C loads immediately, all 6 buttons present, Lookup button disabled until order ID entered, IR Sensor button present
3. `satu-wiring.html` — open in browser: Section D loads, SVG canvas renders, model tabs render, BOM tab accessible, no console errors

**Cross-file checks:**
4. Each file's sidebar nav links to the other two using correct `/satu-*` paths
5. Active page is visually highlighted in gold in each file
6. No JS errors on load in any file (no undefined function references)
7. `farmLog()` works independently in each file — no cross-file dependency

**Line count check:**
8. State approximate line count for each output file
9. Confirm satu-machine-builder.html is under 600 lines after split
10. Confirm no wiring JS leaked into satu-machine-builder.html
11. Confirm no Section A/B JS leaked into satu-hw-trigger.html or satu-wiring.html

**14-test suite:**
12. No src/ files changed — 14-test suite status unchanged ✅

---

## 7. MANDATORY CLOSING

1. **CC_CHAT_LOG.md** — append entry at TOP, format per CC_SKILL.md:
   - List all 3 output files with approximate line counts
   - State any functions copied across files
   - Flag if satu-wiring.html exceeds 1000 lines (acceptable — document it)
   - State 14-test suite: unchanged ✅

2. **Archive this prompt** → `docs/prompts/CC_BUILD_PROMPT_split_machine_builder_v1.md`
   stamped: `✅ COMPLETE — [date] — split satu-machine-builder.html into 3 files`

3. **RULES.md** — append at TOP (next R-number after R-146):
   ```
   - **R-147: THREE-FILE MACHINE BUILDER ARCHITECTURE — PERMANENT (2026-06-19):**
     satu-machine-builder.html = Section A (Single Flow) + Section B (Fleet)
     satu-hw-trigger.html      = Section C (HW Trigger) — standalone test tool
     satu-wiring.html          = Section D (Wiring + BOM) — standalone reference
     All 3 files: self-contained CSS+JS, gold/dark theme, sidebar nav with <a href> cross-links.
     Never merge these files back into one.
     satu-hw-trigger.html and satu-wiring.html serve at /satu-hw-trigger and /satu-wiring.
   ```
   Bump RULES.md version header.

4. **PROJECT_STATE.md** — update public/ inventory section:
   ```
   public/ inventory (5 files):
   - satu-system-tester.html  — 14-test backend API suite — DO NOT MODIFY (R-94)
   - simulator.html           — Vending machine touch UI simulator
   - satu-machine-builder.html — Section A (Single Flow) + Section B (Fleet)
   - satu-hw-trigger.html     — Section C (HW Trigger) — NEW 2026-06-19
   - satu-wiring.html         — Section D (Wiring + BOM) — NEW 2026-06-19
   - satu-admin.html          — Admin tool
   ```
   Add session log entry. Bump PROJECT_STATE.md version header.

5. **KNOWLEDGE_MAP.md** — update public/ inventory to match above 5-file list.
   Add row to Document Map table:
   ```
   | Hardware wiring / BOM | satu-wiring.html | hardware.h pin arrays |
   | HW Trigger testing    | satu-hw-trigger.html | R-142 command-inject endpoint |
   ```
   Bump KNOWLEDGE_MAP.md version header.

6. **CLAUDE.md** — add to Key Files section:
   ```
   - `public/satu-hw-trigger.html` — HW Trigger standalone tool · Section C extracted
   - `public/satu-wiring.html`     — Wiring + BOM standalone reference · Section D extracted
   ```
   Bump CLAUDE.md version header.

7. Bump version header on every file changed this session.

8. Commit all docs + source in order → merge to main.

---

## 8. PAYMENT MODE REMINDER

PAYMENT_MODE must remain = `fake` for this entire session.
Never suggest changing to live.
No payment code is being modified in this session — this is a structural split only.
