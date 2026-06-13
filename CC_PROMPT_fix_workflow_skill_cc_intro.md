# CC_PROMPT_fix_workflow_skill_cc_intro.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix R-50 and R-99 — both say CC_PROMPT files live in docs/prompts/ — wrong
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
docs/prompts/ is archive only (✅ COMPLETE stamped files — never execute from there).

Before doing anything else, read IN FULL and state each filename aloud:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. .claude/rules/RULES-workflow.md
5. CC_PROMPT_fix_workflow_skill_cc_intro.md   ← this file, at repo root

State "All files read ✅" before writing a single line.
Then execute this prompt.

---

## CONTEXT — ROOT CAUSE OF THE BUG

When owner runs CC with "Execute: CC_PROMPT_xxx.md", CC looks in docs/prompts/ 
first and fails to find the file. Owner must manually attach it every time — 
wastes one turn, error-prone.

CC reads RULES.md and .claude/rules/RULES-workflow.md at every session start.
Both contain rules that tell CC CC_PROMPT files live in docs/prompts/. 
This is the direct cause. CC never reads WORKFLOW_SKILL.md so that file 
is NOT the problem.

Confirmed culprits — files CC actually reads:

CULPRIT 1 — RULES.md, R-50:
  CURRENT:  "CC instructions use CC_PROMPT_xxx naming — archived in docs/prompts/ after execution"
  PROBLEM:  No mention of root. CC infers all CC_PROMPT files are in docs/prompts/.

CULPRIT 2 — .claude/rules/RULES-workflow.md, R-50 (same text):
  CURRENT:  "CC instructions use CC_PROMPT_xxx naming — archived in docs/prompts/ after execution"
  PROBLEM:  Same — CC reads this file and gets the same wrong instruction.

CULPRIT 3 — RULES.md, R-99:
  CURRENT:  "Stored in docs/prompts/. Archived ✅ COMPLETE after merge."
  PROBLEM:  "Stored in" implies this is the primary location — wrong.

---

## FIXES — 2 files only

### Fix 1 — RULES.md: update R-50 and R-99

Find R-50 (exact text):
  "R-50: CC instructions use `CC_PROMPT_xxx` naming — archived in `docs/prompts/` after execution"

Replace with:
  "R-50: CC_PROMPT files live at repo ROOT while active — owner pushes to root, CC reads from root.
         After CC executes and merges: CC moves file to docs/prompts/ stamped ✅ COMPLETE.
         docs/prompts/ = archive only. CC never looks there for a file to execute."

Find R-99 (exact text):
  "Stored in docs/prompts/. Archived ✅ COMPLETE after merge."

Replace with:
  "Active CC_PROMPT files pushed to repo ROOT by owner. CC reads from root.
         After merge: CC archives to docs/prompts/ stamped ✅ COMPLETE — never execute from there."

### Fix 2 — .claude/rules/RULES-workflow.md: update R-50

Find R-50 (exact text):
  "R-50: CC instructions use `CC_PROMPT_xxx` naming — archived in `docs/prompts/` after execution"

Replace with identical corrected text from Fix 1:
  "R-50: CC_PROMPT files live at repo ROOT while active — owner pushes to root, CC reads from root.
         After CC executes and merges: CC moves file to docs/prompts/ stamped ✅ COMPLETE.
         docs/prompts/ = archive only. CC never looks there for a file to execute."

---

## ALSO UPDATE — WORKFLOW_SKILL.md (for Chat memory — not read by CC but keep consistent)

Find in CC PROMPT FILE NAMING section:
  "Owner pushes to docs/prompts/ in relevant repo before running CC."

Replace with:
  "Owner pushes to repo ROOT before running CC. CC reads from root.
   After execution: CC archives to docs/prompts/ stamped ✅ COMPLETE."

---

## APPEND TO RULES.md — R-104 (newest at TOP)

```
- **R-104 CC PROMPT FILE LOCATION — PERMANENT (2026-06-13):**
  CC_PROMPT files are always at repo ROOT while active.
  Owner pushes to root → tells CC to execute by filename → CC reads from root.
  After merge: CC moves to docs/prompts/ stamped ✅ COMPLETE — archive only.
  CC must NEVER search docs/prompts/ for a file to execute.
  Root cause of bug: R-50 and R-99 said "stored in docs/prompts/" without
  clarifying root=active vs docs/prompts/=archive. Fixed this session.
```

Also append R-104 to .claude/rules/RULES-workflow.md under ## Workflow Rules.

---

## DO NOT TOUCH
- Any source files (src/, public/, firmware/)
- hardware.h — R2 LOCKED
- PROJECT_STATE.md — append one line only: "R-50/R-99/R-104 CC prompt location fixed"
- KNOWN_GOOD.md — no firmware change

---

## VERIFY before closing

- [ ] RULES.md R-50 updated — says ROOT not docs/prompts/
- [ ] RULES.md R-99 updated — says ROOT not docs/prompts/
- [ ] RULES.md R-104 appended at TOP
- [ ] .claude/rules/RULES-workflow.md R-50 updated — same text
- [ ] .claude/rules/RULES-workflow.md R-104 appended
- [ ] WORKFLOW_SKILL.md naming convention section updated
- [ ] No source files touched
- [ ] 14-test suite NOT needed (no backend code changed)

---

## MANDATORY — end of session

1. GitHub Actions ✅ GREEN (docs-only — compile still runs, must pass)
2. Archive this prompt to docs/prompts/:
   "✅ COMPLETE — 2026-06-13 — Fix R-50/R-99 CC prompt location root vs archive"
3. Commit all, merge to main

## PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake.
Never suggest changing to live.
