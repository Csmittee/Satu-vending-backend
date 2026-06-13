# CC_PROMPT_fix_workflow_skill_cc_intro.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Update WORKFLOW_SKILL.md — standardise CC intro block that works reliably
> Repo: https://github.com/Csmittee/Satu-vending-backend
> PR target: main
> Mode: Docs only — no source code touched
> Flash cycles: 0

---

## CC INTRO

New session. Ignore all previous context from other projects.

You are working on SATU 1.0 BACKEND at:
https://github.com/Csmittee/Satu-vending-backend

CC_PROMPT files are always at the repository ROOT level.
When given "Execute: CC_PROMPT_xxx.md" — read it from root immediately.
docs/prompts/ is archive only (✅ COMPLETE stamped files — do not execute these).

Before doing anything else, read IN FULL and state each filename aloud:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. WORKFLOW_SKILL.md         ← the file being updated
5. CC_PROMPT_fix_workflow_skill_cc_intro.md   ← this file, at repo root

State "All files read ✅" before writing a single line.
Then execute this prompt.

---

## CONTEXT

Owner discovered that the CC INTRO block in WORKFLOW_SKILL.md did NOT include
the CC_PROMPT file itself in the explicit read list. This caused CC to not find
the prompt file at root level, forcing the owner to manually attach the file to
the CC chat every session — wasting one turn and error-prone.

The confirmed working pattern (tested 2026-06-13, PR #13 session) is:

```
Read IN FULL and state each filename aloud:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. [any task-specific files]
5. [CC_PROMPT_filename.md]   ← list the prompt file explicitly by name

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ is archive only — never execute files from there.
```

When CC_PROMPT is listed explicitly in the read list with its full filename,
CC fetches it in the same pass as the other docs — no extra turn needed.

This also needs to be added to CLAUDE.md in BOTH repos so CC cannot claim
ignorance of where prompt files live.

---

## FIX — 3 files: WORKFLOW_SKILL.md, CLAUDE.md (backend), CLAUDE.md (firmware)

### Fix 1 — WORKFLOW_SKILL.md

Find the section:
```
## QUICK REFERENCE — SESSION OPENING
```

Replace the CC prompt template block inside it. The current template reads:
```
Owner runs CC: "Read CLAUDE.md, RULES.md, PROJECT_STATE.md. Then execute: [prompt filename]"
```

Replace with:
```
Owner runs CC:
"New session. Ignore all previous context.

Read IN FULL from https://github.com/Csmittee/[repo-name] — state each filename aloud:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. [task-specific files listed here]
5. [CC_PROMPT_filename.md]

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ = archive only (✅ COMPLETE stamped — never execute from there).

State 'All files read ✅' before writing a single line.
Then execute: [CC_PROMPT_filename.md]"
```

Also find the section:
```
## CC PROMPT FILE NAMING — PERMANENT CONVENTION
```

Under "Every prompt file MUST contain:" — find item 1:
```
1. CC INTRO block (repo URL, files to read, role reminder)
```

Replace with:
```
1. CC INTRO block — REQUIRED PATTERN:
   - "New session. Ignore all previous context."
   - Repo URL
   - "CC_PROMPT files are always at repo ROOT. docs/prompts/ = archive only."
   - Numbered read list: CLAUDE.md → RULES.md → PROJECT_STATE.md → task files → THIS PROMPT FILE
   - "State 'All files read ✅' before writing a single line."
   - The CC_PROMPT file itself MUST be the last item in the read list
     so CC fetches it in the same pass — no manual attachment ever needed.
```

### Fix 2 — CLAUDE.md (backend repo: Satu-vending-backend)

Find the section about CC sessions or prompt files. Append this block
(before the final line, or at end of file if no clear section):

```
## CC Prompt File Location — PERMANENT RULE (R-104)
CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ = archive only — ✅ COMPLETE stamped files, never execute from there.
When a CC_PROMPT file is listed in the CC intro read list, CC fetches it from
root in the same pass — owner never needs to manually attach the file.
```

### Fix 3 — CLAUDE.md (firmware repo: Satu-Vending-Firmware)

Same as Fix 2 — append the identical block to the firmware repo CLAUDE.md.

This ensures both repos have the rule in the first file CC reads every session.

---

## DO NOT TOUCH
- Any source files (src/, public/, firmware/)
- hardware.h — R2 LOCKED
- RULES.md — CC appends new rule, never replaces existing rules
- PROJECT_STATE.md — CC appends session note only
- KNOWN_GOOD.md — no firmware change this session

---

## APPEND TO RULES.md (newest at TOP)

```
- **R-104 CC PROMPT FILE LOCATION — PERMANENT (2026-06-13):**
  CC_PROMPT files always live at the repository ROOT level.
  docs/prompts/ = archive only (✅ COMPLETE stamped — never execute from there).
  Every CC_PROMPT file MUST list itself as the last item in the CC intro read list.
  This allows CC to fetch the prompt file in the same pass as CLAUDE.md/RULES.md —
  owner never manually attaches a file to CC chat. Confirmed working: PR #13 session.
  Apply this pattern to ALL future CC prompts in all repos.
```

---

## VERIFY before closing

- [ ] WORKFLOW_SKILL.md QUICK REFERENCE section updated — new CC intro pattern present
- [ ] WORKFLOW_SKILL.md CC PROMPT template item 1 updated — self-listing rule added
- [ ] CLAUDE.md (backend) — R-104 block appended
- [ ] CLAUDE.md (firmware) — R-104 block appended
- [ ] RULES.md — R-104 appended at TOP
- [ ] No source files touched
- [ ] 14-test suite NOT needed (no backend code changed)

---

## MANDATORY — end of session

1. Wait for GitHub Actions ✅ GREEN (docs-only PR — compile check still runs)
2. Archive this prompt to docs/prompts/:
   `✅ COMPLETE — 2026-06-13 — WORKFLOW_SKILL CC intro pattern standardised R-104`
3. Append R-104 to RULES.md (newest at TOP)
4. Update PROJECT_STATE.md — note CC intro pattern standardised
5. Commit all docs, merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake for this session.
Never suggest changing to live.
