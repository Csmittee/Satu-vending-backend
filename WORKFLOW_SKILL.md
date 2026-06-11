# 🎯 WORKFLOW SKILL — Satu 1.0
> Version 1.0 — 2026-06-11
> Adapted from Chaijohn OS WORKFLOW_SKILL v3.0
> Key difference: Firmware layer requires physical hardware — see constraints below.

---

## ⚠️ BEFORE EVERY NEW CHAT — OWNER CHECKLIST

Do these TWO things before typing anything else:

```
1. Project → Files → GitHub sync checkbox → CONFIRM IT IS CHECKED
   (resets to OFF every new chat — always re-check)

2. Paste CHAT_HANDOFF.md from last session
```

If Chat says it cannot find files — STOP. Re-check the sync box.

---

## THE THREE ROLES

### 👤 OWNER
- Describes goals, reports QA results (screenshots or pass/fail)
- **Firmware only:** physically flashes the device and reads serial monitor output
- **Firmware only:** reports compile errors or serial output back to Chat
- Never edits source files manually
- Never acts as messenger between Chat and CC

### 🧠 CHAT (this session)
- Reads repo files directly via project knowledge — never asks owner to upload source
- Diagnoses before acting — never guesses
- Writes CC prompts, updates handoff docs
- Does NOT write to the repo
- For firmware: writes complete .h / .ino files — owner flashes, reports result

### 🤖 CC (Claude Code)
- Reads all files fresh from repo before writing anything
- Writes complete replacement files — never patches or diffs
- Commits with descriptive messages, merges to main before ending session
- Archives prompt + updates RULES.md + PROJECT_STATE.md after every fix
- Is NOT bound by Chat's suggested solution — CC verifies from live files

---

## THE TWO DEVELOPMENT LOOPS

### Loop A — Cloud (Backend + Frontend)
> Fully automatable. Same as Chaijohn OS pattern.

```
Owner describes goal
        ↓
Chat reads repo → diagnoses → writes CC_PROMPT → owner pushes to repo root
        ↓
Owner runs CC: "Read CLAUDE.md, RULES.md, PROJECT_STATE.md. Then execute: [prompt filename]"
        ↓
CC reads fresh → verifies cause → fixes → commits → archives → updates docs → merges to main
        ↓
Owner runs 14-test suite → reports pass/fail to Chat
        ↓
Chat reviews → next prompt or done
```

**After every backend change:** Run satu-system-tester.html (14-test suite). All 14 must pass before session closes.

### Loop B — Firmware (Arduino/ESP32)
> Requires physical hardware for flash + verify step. Owner cannot be removed from this loop.

```
Owner describes firmware behavior needed
        ↓
Chat reads firmware files → writes CC_PROMPT_firmware_xxx → owner pushes to repo
        ↓
CC writes complete firmware files → commits to firmware repo
        ↓
Owner uploads local .h files (fresh from repo) → opens Arduino IDE
        ↓
Owner compiles → reports errors to Chat (copy serial output exactly)
        ↓
Chat diagnoses → writes fix → CC updates file
        ↓
Owner re-compiles → flashes → reads serial monitor → reports behavior to Chat
        ↓
Iterate until behavior matches spec
```

**Firmware flash constraint:** Chat and CC cannot compile, flash, or read serial output.
The physical flash step always requires the owner. Design firmware prompts to minimize
the number of flash cycles needed (write complete, correct files the first time).

---

## THE LOOP — combined view

```
Cloud fix:   Owner → Chat → CC → Owner (QA via browser) → done in 1-2 cycles
Firmware fix: Owner → Chat → CC → Owner (compile+flash+serial) → 2-4 cycles typical
```

---

## CHAT RULES — NON-NEGOTIABLE

1. **Never guess** — if a file is needed to diagnose, search project knowledge first
2. **Never ask owner to upload source code** — read from project knowledge directly
3. **Read before diagnosing** — check CLAUDE.md + RULES.md + affected source file before forming opinion
4. **One CC prompt per session goal** — batch all related fixes into one prompt
5. **Never re-explain project history in CC prompts** — CC reads CLAUDE.md + RULES.md
6. **Firmware: state the flash constraint** — always tell owner how many flash cycles to expect
7. **Payment mode warning** — any CC prompt touching payment must explicitly state PAYMENT_MODE=fake

---

## CC RULES — NON-NEGOTIABLE

1. **Read before writing** — state aloud which files were read before touching anything (R-01)
2. **hardware.h is R2 LOCKED** — never open, modify, or redeclare anything it owns (R-70)
3. **NUM_SLOTS in config.h only** — never redefine in ui.h (R-72)
4. **Full files only** — never patches or diffs — complete replacement always
5. **Test suite must pass** — remind owner to run satu-system-tester.html after any backend change
6. **PAYMENT_MODE=fake** — never suggest changing to live in any dev/test context (R-12)
7. **No ghost devices** — never use random MACs — only SATU-TEST001 and SATU-SIM01 (R-14)
8. **Archive + update docs** — every session ends: archive prompt → update RULES.md → update PROJECT_STATE.md → commit

---

## SESSION MODES

### Fix Mode (low token — R-02)
Read: CLAUDE.md + RULES.md + 1-2 source files
Use for: single bug, clear symptom, known file
CC prompt names: `CC_PROMPT_fix_[topic].md`

### Build Mode (high token — R-03)
Read: CLAUDE.md + RULES.md + PROJECT_STATE.md + all affected files
Use for: new feature, multiple files, cross-layer change
CC prompt names: `CC_BUILD_PROMPT_[topic].md`

### Firmware Mode (special)
Read: CLAUDE.md + RULES.md + UI_SPEC.md + all .h files + satu_vending.ino
Use for: any ui.h, network.h, or satu_vending.ino change
Always include: simulator.html as UI spec reference
Always warn: owner must upload local .h files before CC session (repo may lag local)

---

## CC PROMPT TEMPLATE

```markdown
## CC INTRO
New session. Ignore all previous context from other projects.

You are working on SATU 1.0 at:
https://github.com/Csmittee/Satu-vending-backend   ← (or Firmware repo)

Before doing anything else, read IN FULL:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. [additional files specific to this task]

State the name of every file you read before writing a single line.
Then execute this prompt.

## READ FIRST (before touching any file)
[exact file list with reason]

## FIXES
[numbered, root cause stated, exact files, exact fix]

## DO NOT TOUCH
[explicit exclusion list]
[always include: hardware.h — R2 LOCKED]
[always include: config.h NUM_SLOTS definition]

## MANDATORY (end of every session)
1. Run 14-test suite reminder to owner (backend changes only)
2. Archive this prompt → docs/prompts/ stamped ✅ COMPLETE — [date] — [summary]
3. Append new rules to RULES.md (newest at TOP) with next R-number
4. Update PROJECT_STATE.md — mark completed items, add new known issues
5. Commit in correct order, merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.
```

---

## HANDOFF DOC TEMPLATE

> Chat generates this at end of every session. Owner pastes at start of next.

```markdown
# CHAT HANDOFF — [date]

## WHAT WAS DONE
[what was fixed or built — specific files changed]

## RULES ADDED
[new R-numbers and text]

## CURRENT STATE
[what is confirmed working]
[what is broken or pending]

## NEXT SESSION — RECOMMENDED FIRST ACTION
[one specific task with file names]

## OWNER ACTION REQUIRED
[anything only owner can do: flash hardware, check Airtable, approve PR, legal task]

## RISKS / BLOCKERS
[anything that could block progress]
```

---

## WHAT CC CANNOT DO FOR SATU (firmware constraint)

| Task | Workaround |
|---|---|
| Compile Arduino code | Owner compiles — reports errors to Chat |
| Flash ESP32 | Owner flashes — reports serial output to Chat |
| Read serial monitor | Owner copies serial output → pastes to Chat |
| Verify display renders correctly | Owner takes photo/video → describes to Chat |
| Check Omise webhook in real mode | Owner uses Omise dashboard + satu-system-tester |
| Verify hardware wiring | Owner checks against satu_wiring_diagram.html |

---

## FILE STRUCTURE — BOTH REPOS

```
Satu-vending-backend/
├── CLAUDE.md                    ← CC reads every session
├── RULES.md                     ← CC reads every session
├── PROJECT_STATE.md             ← CC reads in Build Mode
├── WORKFLOW_SKILL.md            ← this file
├── KNOWLEDGE_MAP.md             ← navigation guide
├── UI_SPEC.md                   ← read before any ui.h change
├── SECURITY.md                  ← read before any auth change
├── CHAT_HANDOFF.md              ← paste at session start (overwrite each time)
├── docs/prompts/                ← archived CC prompts (✅ COMPLETE stamped)
├── src/                         ← backend source
└── public/                      ← static HTML tools

Satu-Vending-Firmware/
├── CLAUDE.md                    ← same content, firmware repo copy
├── RULES.md                     ← same content, firmware repo copy
├── satu_vending.ino             ← main
├── config.h                     ← IN .gitignore (WiFi credentials)
├── config.h.example             ← template
├── hardware.h                   ← R2 LOCKED
├── network.h                    ← WiFi, NVS, API calls
├── ui.h                         ← screens, service mode
└── state_machine.h              ← enum + extern declarations
```

---

## QUICK REFERENCE — SESSION OPENING

```
Owner message to start any session:

"Read CLAUDE.md, RULES.md, PROJECT_STATE.md from:
https://github.com/Csmittee/Satu-vending-backend

Follow WORKFLOW_SKILL.md — you are the Chat role.
GitHub sync is confirmed checked.

Here is my handoff: [paste CHAT_HANDOFF.md]"
```
