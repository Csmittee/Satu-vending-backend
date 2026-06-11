# CC_BUILD_PROMPT_foundation-docs.md
> Purpose: Fill workflow scaffolding gaps in Satu 1.0 — respect all existing docs
> Branch: chore/foundation-docs
> Rule: READ ALL 3 REPOS FIRST — never overwrite existing content

---

## CC INTRO

```
New session. Ignore all previous context from other projects.

You are working on SATU 1.0. There are THREE repos — read all three.

REPO 1 — Backend:
https://github.com/Csmittee/Satu-vending-backend

Read IN FULL — state each file name aloud as you read it:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md        ← read every line — you must not overwrite this
4. KNOWLEDGE_MAP.md        ← read every line
5. UI_SPEC.md              ← skim for structure
6. SECURITY.md             ← skim for structure
7. WORKFLOW_SKILL.md       ← if it exists
8. CHAT_HANDOFF.md         ← if it exists
9. src/index.js            ← route table only
10. wrangler.toml          ← bindings and cron only

REPO 2 — Firmware:
https://github.com/Csmittee/Satu-Vending-Firmware

11. CLAUDE.md              ← firmware copy, if exists
12. RULES.md               ← firmware copy, if exists
13. config.h               ← skim: NUM_SLOTS, NVS keys, pin constants
14. state_machine.h        ← skim: all MachineState values
15. network.h              ← skim: API endpoints called, NVS keys used
16. ui.h                   ← skim: screen functions, service mode tabs
17. satu_vending.ino       ← skim: setup(), loop(), state machine branches
18. hardware.h             ← NOTE: R2 LOCKED — read only, never modify

REPO 3 — Hardware:
https://github.com/Csmittee/Satu-vending-hardware

19. Any wiring diagram files (HTML, PDF, or MD)
20. Any BOM (bill of materials) files
21. Any README or notes

After reading all three repos, state this assessment aloud before writing anything:

ASSESSMENT:
- Backend docs found: [list]
- Backend docs missing: [list]
- Firmware docs found: [list]
- Firmware docs missing: [list]
- Hardware docs found: [list]
- Hardware repo notes: [any relevant wiring/BOM details to reference in docs]
- RULES.md rule count: [N rules]
- Will split RULES.md? [yes/no — yes if >50 rules]
- Action plan: CREATE [list] / APPEND [list] / SKIP [list]

Then proceed immediately with that plan.
```

---

## WHAT ALREADY EXISTS — DO NOT TOUCH OR REPLACE

These files are authoritative. Read them, reference them, never overwrite:

- `CLAUDE.md` — update Key Files section only if new docs are added
- `RULES.md` — append new rules only (newest at TOP), never reorganize existing
- `PROJECT_STATE.md` — append new sections only, never touch existing content
- `KNOWLEDGE_MAP.md` — append new rows to the table only
- `UI_SPEC.md` — do not touch
- `SECURITY.md` — do not touch
- `hardware.h` — R2 LOCKED — read only, never modify in any context
- All `src/` handler files — do not touch
- All `public/` HTML files — do not touch
- `wrangler.toml` — do not touch
- `schema.sql` — do not touch
- All `.h` firmware files — do not touch
- `satu_vending.ino` — do not touch

---

## WHAT IS MISSING — BUILD THESE

### GAP 1 — WORKFLOW_SKILL.md (CREATE in backend repo)

Satu has a unique constraint: firmware requires physical hardware to flash.
Document TWO loops:

**Loop A — Cloud (Backend + Frontend) — fully automatable**
```
Owner describes goal
→ Chat reads repo → diagnoses → writes CC_PROMPT → owner pushes to repo root
→ Owner runs CC: "Read CLAUDE.md, RULES.md, PROJECT_STATE.md.
  Then execute: [prompt filename]"
→ CC reads fresh → fixes → commits → archives prompt →
  appends RULES.md → updates PROJECT_STATE.md → overwrites CHAT_HANDOFF.md → merges to main
→ Owner runs 14-test suite (satu-system-tester.html) → reports pass/fail to Chat
→ Chat reviews → next prompt or done
```

**Loop B — Firmware (Arduino/ESP32) — requires physical owner**
```
Owner describes firmware behavior needed
→ Chat reads firmware files → writes CC_PROMPT_firmware → owner pushes to firmware repo
→ CC writes complete firmware files → commits to firmware repo
→ Owner: pulls new files → copies to local Arduino sketch folder
→ Owner: Arduino IDE → Verify only (compile) → reports result to Chat
  (if errors: paste exact error text)
→ Owner: flash to device → open serial monitor → report behavior to Chat
  (if wrong: describe what happened vs what was expected)
→ Chat diagnoses → writes targeted fix → CC updates file → repeat from compile step
→ Target: ≤3 flash cycles per feature
```

Include these sections in WORKFLOW_SKILL.md:
- The Three Roles (Owner / Chat / CC) — Owner firmware note: physically compiles, flashes, reads serial
- Loop A and Loop B as above
- Session Modes:
  - Fix Mode: CLAUDE.md + RULES.md + 1-2 source files (low token)
  - Build Mode: all docs + all affected files (high token, CC creates PR)
  - Firmware Mode: all docs + all .h files + simulator.html as UI spec
- CC Prompt Template (standard opening block — include PAYMENT_GATEWAY=fake_omise as mandatory reminder)
- Handoff Doc Template (sections: What was done / Rules added / Current state confirmed / Pending broken / Next action / Owner action required / Risks)
- What CC cannot do for Satu — table with two columns: Task / Workaround
- Session opening message — quick copy-paste block for owner

Keep under 150 lines. Reference existing docs by name — never duplicate their content.

---

### GAP 2 — CHAT_HANDOFF.md (CREATE in backend repo)

This file is OVERWRITTEN at end of every session — never appended.
First version must accurately reflect current project state from PROJECT_STATE.md and CHAT_HANDOFF_2026-06-11.md (if present in repo).

Structure:
```markdown
# CHAT HANDOFF — [today's date]
> Overwrite this file at end of every session — never append

## ⚠️ DO FIRST
1. GitHub sync checkbox → CONFIRM CHECKED
2. Paste this handoff

## 🆕 NEW SYSTEM (added 2026-06-11)
[brief: WORKFLOW_SKILL.md now exists, two loops, session closing discipline]

## WHAT HAPPENED LAST SESSION
[extract from existing CHAT_HANDOFF.md if present, otherwise from PROJECT_STATE.md]

## CURRENT STATE — CONFIRMED WORKING
[from PROJECT_STATE.md Phase Status]

## CURRENT STATE — PENDING / BROKEN
[from PROJECT_STATE.md Known Risks + Pending CC jobs — include 14-test not run after R4]

## NEXT SESSION — EXACT ORDER
Step 0: Run CC foundation-docs prompt (this session — if not already done)
Step 1: Run 14-test suite — must pass before touching firmware
Step 2: Firmware compile check — Verify only, no flash
Step 3: Flash and smoke test
[include expected boot sequence from existing CHAT_HANDOFF.md]

## OWNER ACTION REQUIRED
[utility model, Omise KYC, Cloudflare variables, config.h delete]

## ARDUINO IDE SETTINGS
[exact settings — Board, Flash, Partition, PSRAM OPI CRITICAL, Upload Speed, Port]

## LIBRARIES INSTALLED
[from existing CHAT_HANDOFF.md]

## NVS KEYS
[from existing CHAT_HANDOFF.md — all approved keys, namespace satu, ≤15 chars]
```

---

### GAP 3 — .claude/rules/ domain split (backend repo)

Count all rules in RULES.md.

**If ≤ 50 rules:** Skip. Add to RULES.md header:
```
<!-- Split to .claude/rules/ when rule count exceeds 50 -->
```

**If > 50 rules:** Create `.claude/rules/` with:
```
.claude/rules/
├── RULES-backend.md     ← R-10 to R-19
├── RULES-firmware.md    ← R-20 to R-29 + R-60 to R-82
├── RULES-hardware.md    ← R-30 to R-39
├── RULES-security.md    ← R-40 to R-49
└── RULES-workflow.md    ← R-01 to R-09 + R-50 to R-59
```

Each domain file header:
```markdown
# RULES-[domain].md — Satu 1.0
> Domain: [what this covers]
> Load this file when: [exact condition]
> Last updated: [date]
---
[exact rule wording from RULES.md — no paraphrasing — newest first within domain]
```

If splitting: rewrite RULES.md to ~10 universal rules only.
Add header: `> For domain rules: load .claude/rules/RULES-[domain].md`

---

### GAP 4 — APPEND to existing files (never overwrite)

#### Append to PROJECT_STATE.md (bottom only):
```markdown
---
## Workflow System — Added [today]

### New Documents Added This Session
- `WORKFLOW_SKILL.md` — dual-loop (Cloud Loop A + Firmware Loop B), session modes, CC template
- `CHAT_HANDOFF.md` — session handoff, overwrite each session

### Hardware Repo Reference
- `Csmittee/Satu-vending-hardware` — wiring diagrams, BOM
- Key hardware facts extracted: [summarise any relevant wiring/BOM details found in hardware repo]
- Read before any pin mapping or hardware-layer decision

### Session Closing Discipline (from this point forward)
Every CC session ends with:
1. Archive CC_PROMPT → docs/prompts/ stamped ✅ COMPLETE — [date] — [summary]
2. Append new rules → RULES.md (newest at TOP)
3. Update PROJECT_STATE.md phase status
4. Overwrite CHAT_HANDOFF.md with current state
5. Commit all docs → merge to main
```

#### Append to KNOWLEDGE_MAP.md (new rows to document map table only):
```
| Starting new chat        | CHAT_HANDOFF.md              | WORKFLOW_SKILL.md        |
| Workflow / session modes | WORKFLOW_SKILL.md            | CLAUDE.md                |
| Hardware wiring / BOM    | Satu-vending-hardware repo   | config.h pin constants   |
| Domain rules (if split)  | .claude/rules/RULES-[domain] | RULES.md universal       |
```

#### Update CLAUDE.md Key Files section (add only, keep under 35 lines total):
```markdown
- `WORKFLOW_SKILL.md` — how Chat + CC + Owner work together · session modes · two loops
- `CHAT_HANDOFF.md` — last session summary · read at session start · overwrite each session
```
If .claude/rules/ was created, also add:
```markdown
- `.claude/rules/RULES-[domain].md` — load relevant domain file for the task
```

Also add to CLAUDE.md Repos section if not already present:
```markdown
- Hardware: `Csmittee/Satu-vending-hardware` — wiring diagrams, BOM — read before any hardware decision
```

---

### GAP 5 — Firmware repo (Satu-Vending-Firmware)

Create in firmware repo:

**WORKFLOW_SKILL.md** — firmware-focused:
- Loop B full detail (same as backend WORKFLOW_SKILL.md Loop B section)
- Loop A: "For backend/cloud changes, see backend repo WORKFLOW_SKILL.md"
- Firmware Mode session guide
- What CC cannot do — compile / flash / read serial / see display
- Important: config.h is in .gitignore — CC cannot read WiFi credentials from repo
  Owner must paste config.h relevant sections when needed

**CHAT_HANDOFF.md** — firmware current state:
- Last state: R4 written and merged, not yet compiled or flashed on board
- hardware.h R2 LOCKED
- Next: compile verify → flash → smoke test → report serial output to Chat
- Owner must: pull new files from repo to local Arduino folder before compiling
- Owner must: delete config.h from repo + rotate WiFi password (🔴 still exposed)

**CLAUDE.md** — if missing or incomplete, ensure it contains:
- Stack section with exact Arduino IDE settings (from RULES.md R-60 to R-68):
  Board, Flash, Partition, PSRAM OPI (CRITICAL — never change), Upload Speed,
  Core 2.0.17 ONLY, GFX 1.4.9 ONLY, PNGdec 1.1.6, TFT_eSPI REMOVE if installed
- hardware.h R2 LOCKED note
- Key files: UI_SPEC.md, SECURITY.md, KNOWLEDGE_MAP.md (in backend repo)
- Repos: all three (backend, firmware, hardware)

---

### GAP 6 — Hardware repo (Satu-vending-hardware)

After reading the hardware repo, assess what documentation exists.

**If README.md is missing or thin:** Create a brief README.md:
```markdown
# Satu Hardware — Reference Documents

## Contents
- Wiring diagram: [filename] — pin mapping for ESP32-S3, MCP23017 ×2, relays, IR sensors
- BOM: [filename] — bill of materials with component sources

## Key Hardware Facts
- Board: ESP32-8048S070C (ESP32-S3, 16MB flash, 8MB OPI PSRAM)
- Display: Arduino_GFX RGB panel 800×480, backlight pin=2
- Touch: TAMC_GT911, SDA=19, SCL=20, INT=-1, RST=-1, ROTATION_INVERTED
- MCP1 (0x20): sensors 1-8, relays 1-6
- MCP2 (0x21): sensors 9-10, relays 7-12 (R11=pump, R12=door lock)
- IR sensors: E18-D80NK, NPN normally-open, SENSOR_TRIGGERED=LOW, mount 5-8cm below shelf
- Relay board: requires separate 12V supply — NOT from ESP32-S3 5V (max 500mA)

## Rule
hardware.h is R2 LOCKED — never modify without explicit owner approval.
All pin constants live in config.h. hardware.h is the physical abstraction layer.
```

**If README.md already exists and is good:** Append the Key Hardware Facts block only if missing.

Do NOT touch wiring diagram files or BOM files — reference only.

---

## DO NOT TOUCH — ABSOLUTE LIST

```
src/handlers/          — all backend handler files
src/middleware/        — all middleware
src/auth/              — JWT files
src/db/schema.sql      — database schema
src/commands/          — queue files
src/utils/             — utility files
wrangler.toml          — Cloudflare config
public/                — all HTML files (testers, simulator, admin)
firmware/hardware.h    — R2 LOCKED — never touch
firmware/config.h      — WiFi credentials (delete from repo, do not edit)
firmware/network.h     — do not touch
firmware/ui.h          — do not touch
firmware/satu_vending.ino — do not touch
firmware/state_machine.h  — do not touch
PROJECT_STATE.md       — append only
RULES.md               — append only (or domain split — never delete rules)
KNOWLEDGE_MAP.md       — append only
UI_SPEC.md             — do not touch
SECURITY.md            — do not touch
hardware repo wiring/BOM files — read only
```

---

## MANDATORY — end of this session

1. **Archive this prompt:**
   Move to `docs/prompts/CC_BUILD_PROMPT_foundation-docs.md`
   Stamp at top: `✅ COMPLETE — [date] — foundation docs: WORKFLOW_SKILL + CHAT_HANDOFF + rules split + hardware repo README`

2. **Append to RULES.md** (newest at TOP, next available R-number):
   ```
   R-[N]: Three-repo system — Chat and CC must read all three repos before any decision:
          backend (Satu-vending-backend), firmware (Satu-Vending-Firmware),
          hardware (Satu-vending-hardware). Hardware repo = wiring + BOM reference only.
          Never modify hardware repo wiring/BOM files. hardware.h R2 LOCKED in all contexts.

   R-[N+1]: Session closing discipline — every CC session ends:
             archive prompt → append RULES.md → update PROJECT_STATE.md →
             overwrite CHAT_HANDOFF.md → commit all docs → merge to main.
             No session closes without this sequence complete.
   ```

3. **Overwrite CHAT_HANDOFF.md** with end-of-session state

4. **Commit order:**
   ```
   docs(backend): WORKFLOW_SKILL.md — dual-loop Cloud+Firmware, session modes, CC template
   docs(backend): CHAT_HANDOFF.md — session handoff current state
   docs(backend): .claude/rules/ — domain split (if triggered)
   docs(backend): PROJECT_STATE.md — append workflow system + hardware repo section
   docs(backend): KNOWLEDGE_MAP.md — append new doc rows
   docs(backend): CLAUDE.md — add new key files + hardware repo reference
   docs(backend): RULES.md — append R-[N] and R-[N+1], archive this prompt
   docs(firmware): WORKFLOW_SKILL.md — Loop B focused
   docs(firmware): CHAT_HANDOFF.md — R4 flash state
   docs(firmware): CLAUDE.md — ensure Arduino IDE settings complete
   docs(hardware): README.md — create or update with key hardware facts
   ```

5. **Branch:** `chore/foundation-docs`
   **Merge to main** after all files confirmed visible in GitHub across all three repos.

---

## QA CHECKLIST (CC self-verify before merge)

### Backend repo
- [ ] WORKFLOW_SKILL.md created — Loop A, Loop B, session modes, CC template, handoff template
- [ ] CHAT_HANDOFF.md created — current state accurately from PROJECT_STATE.md
- [ ] PROJECT_STATE.md — existing content 100% intact, new section appended at bottom only
- [ ] KNOWLEDGE_MAP.md — existing content intact, new rows appended only
- [ ] CLAUDE.md — existing content intact, new key files added, hardware repo added, under 35 lines
- [ ] RULES.md — existing rules intact, R-[N] and R-[N+1] appended at top (or domain split done)
- [ ] If split: .claude/rules/ has 5 domain files, correct rules in each
- [ ] If split: RULES.md universal-only, header points to domain files
- [ ] This prompt archived to docs/prompts/ stamped ✅ COMPLETE

### Firmware repo
- [ ] WORKFLOW_SKILL.md created — Loop B focused, config.h gitignore note
- [ ] CHAT_HANDOFF.md created — R4 state, compile/flash steps, config.h 🔴 warning
- [ ] CLAUDE.md has complete Arduino IDE settings
- [ ] hardware.h NOT modified

### Hardware repo
- [ ] README.md exists with key hardware facts
- [ ] Wiring/BOM files NOT modified — read only
