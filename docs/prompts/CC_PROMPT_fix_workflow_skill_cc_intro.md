# CC_PROMPT_fix_workflow_skill_cc_intro.md
> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix R-50 and R-99 — both say CC_PROMPT files live in docs/prompts/ — wrong
> Repo: https://github.com/Csmittee/Satu-vending-backend
> PR target: main
> Mode: Docs only — no source code touched
> Flash cycles: 0

## ✅ COMPLETE — 2026-06-13 — Fix R-50/R-99 CC prompt location root vs archive

### What was done
- `RULES.md`: R-50 updated (CC_PROMPT files live at repo ROOT while active), R-99 updated (same), R-104 appended at TOP
- `.claude/rules/RULES-workflow.md`: R-50 updated — same corrected text, R-104 appended under Workflow Rules
- `WORKFLOW_SKILL.md`: CC Prompt File Naming section updated — "Owner pushes to repo ROOT before running CC"
- `PROJECT_STATE.md`: one-line session entry appended
- No source files touched
- Branch: claude/vibrant-cray-cqp2em

### Root cause fixed
R-50 and R-99 in both RULES.md and RULES-workflow.md said "stored in docs/prompts/" with no
distinction between active (root) vs archived (docs/prompts/). CC inferred all CC_PROMPT files
were in docs/prompts/ and failed to find active prompts at root. Owner had to manually attach
the file every session — one wasted turn per session.

### New permanent rule — R-104
CC_PROMPT files are always at repo ROOT while active.
Owner pushes to root → CC reads from root → after merge CC archives to docs/prompts/ stamped ✅ COMPLETE.
CC must NEVER search docs/prompts/ for a file to execute.

---

## ORIGINAL PROMPT (archived below)

> Created by: Chat (Claude)
> Date: 2026-06-13
> Session goal: Fix R-50 and R-99 — both say CC_PROMPT files live in docs/prompts/ — wrong
> Repo: https://github.com/Csmittee/Satu-vending-backend
> PR target: main
> Mode: Docs only — no source code touched
> Flash cycles: 0

### PAYMENT MODE REMINDER
PAYMENT_MODE must remain = fake.
Never suggest changing to live.
