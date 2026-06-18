# 🎯 WORKFLOW SKILL — Satu 1.0
> Version 2.0 — 2026-06-18
> Changes: Added governance table, trigger→action→validator contract, 
>          CC_CHAT_LOG protocol, revised session opening (Chat reads repo),
>          document versioning rule, symmetric 3-doc system, CC_SKILL reference,
>          removed GitHub sync checklist (owner responsibility), 
>          removed CHAT_HANDOFF from repo (project folder only)
> Previous: v1.1 — 2026-06-15

---

## DOCUMENT VERSIONING RULE (applies to ALL .md files in this project)

Every document must carry a version header. Format:
```
> Version X.Y — YYYY-MM-DD
> Changes: [one line summary of what changed]
> Previous: vX.Y — YYYY-MM-DD
```

Version increment rules:
- **X.Y → X.Y+1** (e.g. 1.1 → 1.2): same sections, detail change only
- **X.0 → X+1.0** (e.g. 1.0 → 2.0): new section added or structure changed

Who applies this: whoever last edited the file — Chat, CC, or Owner.
No document is committed without a version bump if content changed.

---

## THE THREE ROLES

### 👤 OWNER
- Describes goals, reports QA results (screenshots or pass/fail)
- Physically flashes the ESP32 and reads serial monitor output
- Reports compile errors or serial output back to Chat exactly
- Never edits source files manually
- Never acts as messenger between Chat and CC
- Observes workflow health — if something feels wrong, checks this document first

### 🧠 CHAT (this session)
- Reads repo via project knowledge sync — never asks owner to upload source
- Reads CC_CHAT_LOG (last 3 entries) at every session open
- Diagnoses before acting — never guesses
- Writes CC prompts as complete .md files (8 sections — see template)
- Flags decision impact to owner before writing any prompt that touches security, payment, CORS, or main structure
- Does NOT write to the repo directly
- Generates CHAT_HANDOFF at session end — project folder only, never repo

### 🤖 CC (Claude Code)
- Reads CLAUDE.md + RULES.md + CC_SKILL.md before every session
- Reads PROJECT_STATE.md in Build Mode
- Writes complete replacement files — never patches or diffs
- Is NOT bound by Chat's suggested solution — verifies from live repo files
- Writes to CC_CHAT_LOG at end of every session
- Commits + merges to main before session closes
- Never writes CHAT_HANDOFF — that is Chat's responsibility only

---

## SYMMETRIC 3-DOCUMENT SYSTEM

Every party has: HANDOFF + SKILL + RULE

| Doc type | Chat | CC |
|---|---|---|
| **HANDOFF** | `CHAT_HANDOFF.md` — project folder only, single use, never in repo | `CC_CHAT_LOG.md` — repo root, CC writes, Chat reads last 3 |
| **SKILL** | `WORKFLOW_SKILL.md` — this file, project folder master | `CC_SKILL.md` — repo root, CC reads every session |
| **RULE** | `CHAT_RULE.md` — project folder + `/.claude/claude_project/` copy | `RULES.md` + `.claude/rules/` — repo |

**File location discipline:**
- Project folder = Chat's world (CHAT_HANDOFF, WORKFLOW_SKILL, CHAT_RULE)
- Repo = CC's world (CC_CHAT_LOG, CC_SKILL, RULES.md, CLAUDE.md, all source)
- `/.claude/claude_project/` = reference copies of Chat docs (owner downloads from project folder — rarely needed by CC)
- CC never forced to read `/.claude/claude_project/` — for investigation only

---

## THE TWO DEVELOPMENT LOOPS

### Loop A — Cloud (Backend + Frontend)
```
Owner describes goal
        ↓
Chat reads repo (project knowledge) → reads CC_CHAT_LOG last 3 → diagnoses
        ↓
Chat writes CC_BUILD_PROMPT or CC_PROMPT_fix → owner pushes to repo root
        ↓
Owner runs CC: "Read CLAUDE.md, RULES.md, CC_SKILL.md. Then execute: [filename]"
        ↓
CC reads fresh → verifies → fixes → updates docs → writes CC_CHAT_LOG → merges
        ↓
Chat reads CC_CHAT_LOG → verifies delivery against prompt → closes or flags
        ↓
Chat writes CHAT_HANDOFF → saves to project folder
```

### Loop B — Firmware (Arduino/ESP32)
```
Owner describes firmware behavior needed
        ↓
Chat reads firmware repo → diagnoses → writes CC_PROMPT_firmware_xxx
        ↓
Owner pushes prompt to firmware repo root → runs CC
        ↓
CC writes complete firmware files → commits → writes CC_CHAT_LOG → PR ready
        ↓
Owner pulls fresh files → Arduino IDE → compile → report errors to Chat
        ↓
Chat diagnoses → fix prompt → CC updates → owner re-compiles → flashes
        ↓
Owner reads serial monitor → reports behavior to Chat
        ↓
Iterate until behavior matches spec. Chat writes CHAT_HANDOFF.
```

**Firmware constraint:** Chat and CC cannot compile, flash, or read serial.
Always tell owner how many flash cycles to expect at start of firmware session.

---

## TRIGGER → ACTION → VALIDATOR CONTRACT

| Trigger | Detected by | Action | Validator |
|---|---|---|---|
| New file created in repo | CC | Add to KNOWLEDGE_MAP.md + CLAUDE.md key files | Chat reads CC_CHAT_LOG next session |
| RULES.md exceeds 200 lines | CC or Chat | CC splits to `.claude/rules/` per SKILL_rules_maintenance | Chat confirms in CC_CHAT_LOG |
| Any HTML file exceeds 1000 lines | CC or Chat | Flag to owner, propose split before next CC session | Owner decides, Chat writes prompt |
| Fix fails twice on same symptom | Chat or CC | KT framework mandatory — no new code until IS/IS-NOT done | Chat reviews before next prompt |
| WORKFLOW_SKILL.md changed | Owner or Chat decides, CC writes | Chat verifies content before merge approval | Chat confirms to owner explicitly |
| CC ignores Chat hardcode, uses repo version | CC | Flag in CC_CHAT_LOG with what was ignored and why | Chat reads log, updates CHAT_RULE if pattern repeats |
| CORS / main structure change detected | CC | Declare intent in PR before doing — do not proceed silently | Chat reads PR, confirms to owner |
| New library added | CC | SKILL_library_onboarding mandatory before any code | Chat reads CC_CHAT_LOG for library notes |
| CC_CHAT_LOG unreadable (sync missing) | Chat | Tell owner immediately — do not proceed without it | Owner syncs, Chat re-reads |
| Decision impacts security/payment/scalability | Chat | State impact clearly to owner before writing any prompt | Owner confirms before Chat proceeds |
| Any document changed without version bump | CC or Chat | Reject — add version header before committing | Whoever reviews next flags it |
| Repo sync missing at Chat session start | Chat | Cannot read CC_CHAT_LOG → tell owner immediately | Owner syncs before continuing |

---

## INTERVENTION LEVELS — USE THE LIGHTEST ONE

| Level | Who | When | Example |
|---|---|---|---|
| Full CC prompt (Build) | CC reads all context | Multi-file, new feature | New screen, API endpoint |
| Fix prompt | CC reads 1-2 files | Single bug, clear symptom | Fix one function |
| Rapid fire phrase | Chat tells owner what to type to CC | One-line change confirmed | Change one constant |
| Owner direct edit | Owner edits GitHub UI | One character | `return 0` → `return 1` |

**Never use a heavier intervention than needed. Saves tokens and time.**

---

## CHAT SESSION OPENING — MANDATORY SEQUENCE

Every new Chat session opens in this order:

```
1. Owner pastes CHAT_HANDOFF from project folder
2. Chat reads CC_CHAT_LOG from repo (last 3 entries via project knowledge)
   → If unreadable: tell owner "sync missing — please sync before we continue"
   → If readable: state what CC did last, what is pending verification
3. Chat reads PROJECT_STATE.md for current status
4. Chat states: "Memory installed. Last CC session: [summary]. Pending: [items]."
5. Owner describes today's goal
6. Chat proceeds
```

**Owner session start message template:**
```
Here is my handoff: [paste CHAT_HANDOFF.md content]
Today's goal: [describe what you want to do]
```
No GitHub sync checkbox mention needed — that is owner's own discipline.

---

## CC PROMPT TEMPLATE (8 sections — all required)

```markdown
## 1. CC INTRO
New session. Ignore all previous context from other projects.
Repo: https://github.com/Csmittee/[repo-name]
Read IN FULL before touching anything:
  1. CLAUDE.md
  2. RULES.md  
  3. CC_SKILL.md
  4. [additional files for this task]
State every file read before writing a single line.

## 2. CONTEXT
[Why this prompt exists. What problem it solves. Sequence position: Prompt N of N.]

## 3. NEW FILES (if any)
[List every new filename being created]
[CC must add each to KNOWLEDGE_MAP.md and CLAUDE.md key files]
[Write NONE if no new files]

## 4. TASKS
[Numbered. Root cause stated. Exact file named. Exact fix described.]
[CC verifies from live repo — not bound by Chat's suggested implementation]

## 5. DO NOT TOUCH
[Explicit exclusion list]
[Always include: hardware.h — R2 LOCKED]
[Always include: config.h NUM_SLOTS definition]
[Always include: satu-system-tester.html — never modify]

## 6. VERIFICATION
[What CC confirms before closing PR]
[For backend: run 14-test suite, confirm 14/14]
[For firmware: state compile check must go green before PR]

## 7. MANDATORY CLOSING (every session)
1. Append CC_CHAT_LOG.md at TOP — format per CC_SKILL.md protocol
2. Archive this prompt → docs/prompts/ stamped ✅ COMPLETE — [date] — [summary]
3. Append new rules to RULES.md (newest at TOP) with next R-number + version bump
4. Update PROJECT_STATE.md — newest session at top, version bump
5. Update KNOWLEDGE_MAP.md if any new files created
6. Bump version header on every file changed
7. Commit all in correct order → merge to main

## 8. PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this entire session.
Never suggest changing to live.
```

---

## CHAT HANDOFF TEMPLATE

> Chat generates at end of every session. Save to project folder only. Never paste to repo.

```markdown
# CHAT HANDOFF — [date] END OF SESSION
> Overwrite at end of every session — never append
> New chat: paste this first, then state today's goal

## SYSTEM STATUS
[Backend: pass/fail + test count]
[Firmware: PR status + last known good]
[Hardware: what is wired, what is pending]
[Payment: PAYMENT_MODE + Omise status]

## WHAT WAS DONE TODAY
[Specific files changed, prompts sent, QA results]

## OPEN ITEMS — PRIORITY ORDER
[Table: Item | Repo | Status | Notes]

## NEXT SESSION — START HERE
[Exact first action with file names]

## OWNER ACTION REQUIRED
[Only things owner must do physically or legally]

## RULES ADDED THIS SESSION
[New R-numbers with text]

## ARDUINO IDE SETTINGS (firmware sessions)
[Board, Flash, Partition, PSRAM, Upload, Core version]
```

---

## SESSION CLOSING CHECKLIST

**CC closes every session with:**
1. Write CC_CHAT_LOG entry (newest at top)
2. Archive prompt → `docs/prompts/` stamped ✅ COMPLETE
3. Append RULES.md (newest rule at top) + version bump
4. Update PROJECT_STATE.md (newest session at top) + version bump
5. Update KNOWN_GOOD.md if hardware QA passed
6. Update KNOWLEDGE_MAP.md if new files created
7. Bump version on every file changed
8. Commit all docs → merge to main

**Chat closes every session with:**
1. Read CC_CHAT_LOG — verify delivery matches what was asked
2. Flag any gap to owner before session ends
3. Write CHAT_HANDOFF → save to project folder

---

## PROBLEM SOLVING — KT FRAMEWORK

Trigger: same symptom fails twice → STOP → invoke before any new code.
See: `.claude/rules/SKILL_problem_solving_kt.md`

- IS: where/when/what the problem EXISTS
- IS NOT: where/when/what it does NOT exist  
- Hypothesis must explain BOTH or it is eliminated
- Send a spy (Serial.printf) before sending a fix
- Read library designer's docs before any hardware hypothesis

---

## WHAT CC CANNOT DO (firmware constraint)

| Task | Workaround |
|---|---|
| Compile Arduino code | Owner compiles — reports errors to Chat |
| Flash ESP32 | Owner flashes — reports serial output to Chat |
| Read serial monitor | Owner copies output → pastes to Chat exactly |
| Verify display renders | Owner takes photo → describes to Chat |
| Check Omise webhook live | Owner uses Omise dashboard + satu-system-tester |
| Verify hardware wiring | Owner checks against satu-wiring.html |

---

## FILE STRUCTURE — BOTH REPOS

```
Satu-vending-backend/
├── CLAUDE.md              ← CC reads every session (30 lines max)
├── RULES.md               ← CC reads every session (200 lines max → split trigger)
├── CC_SKILL.md            ← CC reads every session
├── CC_CHAT_LOG.md         ← CC writes, Chat reads last 3 entries
├── PROJECT_STATE.md       ← CC reads in Build Mode, updates every session
├── KNOWN_GOOD.md          ← firmware test snapshots
├── KNOWLEDGE_MAP.md       ← navigation guide
├── UI_SPEC.md             ← read before any ui.h change
├── SECURITY.md            ← read before any auth change
├── docs/prompts/          ← archived CC prompts (✅ COMPLETE stamped)
├── src/                   ← backend source
├── public/                ← static HTML tools (each file max 1000 lines)
└── .claude/
    ├── rules/             ← domain rules + skills (CC reads by domain)
    └── claude_project/    ← reference copy of WORKFLOW_SKILL + CHAT_RULE (rarely needed)

Satu-Vending-Firmware/
├── CLAUDE.md              ← firmware-specific compass
├── RULES.md               ← firmware rules
├── CC_SKILL.md            ← same CC_SKILL (copy or symlink)
├── CC_CHAT_LOG.md         ← CC writes, Chat reads
├── PROJECT_STATE.md       ← firmware status
├── KNOWN_GOOD.md          ← flash + compile snapshots
├── satu_vending.ino       ← main state machine
├── config.h               ← IN .gitignore (WiFi credentials)
├── config.h.example       ← template (empty creds)
├── hardware.h             ← R2 LOCKED — never modify
├── network.h              ← WiFi, NVS, API calls
├── ui.h                   ← screens, service mode, fonts
└── state_machine.h        ← enum + extern declarations
```

**Project folder (Chat only — never in repo):**
```
CHAT_HANDOFF.md      ← single use, overwrite each session
WORKFLOW_SKILL.md    ← this file (master)
CHAT_RULE.md         ← Chat non-negotiables
```
