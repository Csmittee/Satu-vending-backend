# CC_SKILL.md — Satu 1.0
> Version 1.0 — 2026-06-18
> Changes: Initial creation — CC session protocol, 6 skills, role awareness,
>          CC_CHAT_LOG write protocol
> Location: Repo root (both repos) — CC reads every session

---

## CC SESSION OPENING — MANDATORY SEQUENCE

Read and state aloud before touching any file:
```
1. CLAUDE.md          ← project compass, stack, key files
2. RULES.md           ← universal rules + domain index
3. CC_SKILL.md        ← this file
4. PROJECT_STATE.md   ← current status (Build Mode only)
5. [task-specific files listed in the CC prompt]
```

State: "Files read: [list]. Proceeding with [prompt name]."
If any file is missing → stop → write in CC_CHAT_LOG what was missing → tell owner.

---

## THE THREE ROLES — CC PERSPECTIVE

**Owner** — describes goals, flashes hardware, reports serial output, approves PRs.
Never edits source manually. Reports QA results as screenshots or pass/fail.

**Chat** — reads repo via project knowledge, diagnoses, writes CC prompts as .md files.
Chat cannot talk to CC directly. Everything Chat needs from CC must be in the prompt.
Chat reads CC_CHAT_LOG to understand what CC did. CC writes CC_CHAT_LOG for Chat.

**CC (you)** — reads live repo, writes complete files, commits, updates docs, writes CC_CHAT_LOG.
CC is NOT bound by Chat's suggested implementation — always verify from live repo first.
CC never writes CHAT_HANDOFF — that is Chat's responsibility only.

---

## THE TWO LOOPS — CC PERSPECTIVE

**Loop A (Cloud/Backend/Frontend):**
Owner pushes CC prompt to repo root → CC reads → fixes → updates docs → 
writes CC_CHAT_LOG → merges to main → Chat reads log next session

**Loop B (Firmware):**
Owner pushes CC prompt to firmware repo root → CC writes complete .h files →
commits → writes CC_CHAT_LOG → PR ready → Owner compiles + flashes → 
reports serial to Chat → Chat sends fix prompt if needed

---

## SKILL 1 — CHAT OVERRIDE GUARD

**Trigger:** Chat's prompt contains hardcoded values (filenames, endpoints, variable names, 
line numbers) that conflict with what actually exists in the live repo.

**Rule:** CC verifies from live repo first. If conflict found:
1. Use the repo version — not Chat's version
2. Write in CC_CHAT_LOG exactly what was ignored and why:
   ```
   OVERRIDE: Chat said [X], repo has [Y]. Used repo version. 
   Chat should update CHAT_RULE if this is a pattern.
   ```
3. Never silently follow Chat's hardcode — always declare the conflict

**Why:** Chat's memory can lag the repo. Repo is always source of truth.

---

## SKILL 2 — STRUCTURAL CHANGE GUARD

**Trigger:** CC is about to change anything that affects:
- CORS headers or preflight handlers
- Route table order (public routes must be before auth middleware)
- Auth middleware (JWT, device-secret validation)
- Database schema (schema.sql)
- wrangler.toml (routes, bindings, cron)
- Payment flow (webhook, charge creation, PAYMENT_MODE)

**Rule:** Before making the change:
1. State in PR description: "STRUCTURAL CHANGE: [what] affects [which systems]"
2. List what was preserved (CORS, auth order, idempotency guards)
3. List what was changed and why
4. Never proceed silently — declaration is mandatory

**Why:** Silent structural changes have caused CORS failures, auth regressions, 
and payment bugs that took multiple sessions to diagnose (R-96, R-97, R-98).

---

## SKILL 3 — LIBRARY ONBOARDING

**Trigger:** Any new Arduino library or npm package is being added.

**Rule — mandatory before writing any code:**
1. Visit the library designer's GitHub — read README + releases + examples
2. Create `.claude/rules/LIBRARY_[name].md` with:
   - Correct API function signatures (exact — not approximated)
   - Callback return types (int vs void matters — see PNGdec R-89)
   - Memory requirements and known failure modes
   - Which example was verified to work
3. Write in CC_CHAT_LOG: library added, doc created, example verified
4. Never assume API from name alone — always read designer's docs first

**Why:** PNGdec `return 0` vs `return 1` cost 48 hours across 4 sessions (R-89).
One library doc read would have prevented this entirely.

See: `.claude/rules/SKILL_library_onboarding.md`

---

## SKILL 4 — TOKEN DISCIPLINE

**Rule:** Use the minimum context needed for the task.

| Session mode | What to read | What to skip |
|---|---|---|
| Fix (1-2 files) | CLAUDE.md + RULES.md + CC_SKILL.md + target file | PROJECT_STATE.md, other source files |
| Build (multi-file) | CLAUDE.md + RULES.md + CC_SKILL.md + PROJECT_STATE.md + affected files | Unrelated handlers |
| Firmware | CLAUDE.md + RULES.md + CC_SKILL.md + UI_SPEC.md + all .h files | Backend src/ |

**Additional token rules:**
- Never read a file you will not modify or reference
- Never re-read a file already in context
- Summarize what you read — do not quote files back in full
- If a task is clearly outside scope of the prompt — stop, write in CC_CHAT_LOG, do not expand scope
- If reading would take more than 5 files not listed in the prompt — ask owner before proceeding

---

## SKILL 5 — RULES MAINTENANCE

**Trigger:** RULES.md reaches or exceeds 200 lines.

**Rule:**
1. Count lines. If ≥ 200: split is mandatory before adding new rules.
2. Check if `.claude/rules/` domain files already exist:
   - If yes: move new rules to correct domain file, not RULES.md
   - If no: create domain files per the Domain Rules Index table in RULES.md
3. After split, RULES.md must contain only:
   - Universal rules (max 10)
   - Domain Rules Index table pointing to `.claude/rules/`
   - Version header
4. Write in CC_CHAT_LOG: "RULES.md split triggered — [N] rules moved to [files]"

**Domain mapping:**
```
Session · CC prompt · handoff → RULES-workflow.md
Backend API · payment · D1    → RULES-backend.md
Firmware · Arduino · NVS      → RULES-firmware.md
Hardware · wiring · relays    → RULES-hardware.md
Auth · secrets · legal        → RULES-security.md
```

**Version bump:** RULES.md and every domain file touched must get a version bump.

---

## SKILL 6 — PROBLEM SOLVING (KT FRAMEWORK)

**Trigger:** Same symptom fails twice on any fix attempt.

**Rule:** STOP. No new code until IS/IS-NOT is complete.

```
IS (problem EXISTS):     which device / which file / which condition / when
IS NOT (does NOT exist): what works fine / what is different about it

Every hypothesis must explain BOTH IS and IS NOT — or it is eliminated.
```

**Step 0 — always before hardware hypothesis:** Read library designer's docs.
Most hardware failures are API misuse, not hardware failure.

**Step 1 — send a spy:** Serial.printf or console.log to confirm assumption before fixing.

**Step 2 — write in CC_CHAT_LOG:** "KT invoked — IS: [X] IS NOT: [Y] — hypothesis: [Z]"

See: `.claude/rules/SKILL_problem_solving_kt.md`

---

## CC_CHAT_LOG WRITE PROTOCOL

CC appends one entry at the TOP of `CC_CHAT_LOG.md` at end of every session.
Format — keep it short, Chat reads last 3 only:

```markdown
---
## [YYYY-MM-DD] — [PROMPT NAME]
**Did:** [what was built or fixed — specific files]
**Updated:** [which docs were updated: RULES.md R-N, KNOWLEDGE_MAP, PROJECT_STATE]
**New files:** [any new files created — or NONE]
**Pending Chat verify:** [what Chat should check or ask owner about]
**Flags:** [anything unusual: override used, structural change made, KT invoked, library added]
---
```

**Rules:**
- Newest entry always at TOP
- Maximum 10 lines per entry
- Write even if session was minor — Chat needs the log to be complete
- If something was NOT done that the prompt asked for — say so explicitly in Flags

---

## CC SESSION CLOSING — MANDATORY SEQUENCE

No session closes without completing all of these:

```
1. Write CC_CHAT_LOG entry (newest at top)
2. Archive prompt → docs/prompts/ stamped ✅ COMPLETE — [date] — [summary]
3. Append new rules to RULES.md (newest at TOP) + version bump RULES.md
4. Update PROJECT_STATE.md (newest session at top) + version bump
5. Update KNOWLEDGE_MAP.md if new files created + version bump
6. Update KNOWN_GOOD.md if hardware QA passed
7. Bump version header on EVERY file changed this session
8. Commit all docs in order → merge to main
```

**Version bump reminder:** Every file changed = version header updated.
X.Y → X.Y+1 for detail changes. X.0 → X+1.0 for structure changes.

---

## WHAT CC DOES NOT DO
- Write CHAT_HANDOFF.md — Chat's responsibility only
- Read `.claude/claude_project/` — unless investigating a process failure
- Follow Chat's hardcode blindly — verify from repo first
- Expand scope beyond the prompt — flag and stop if needed
- Commit without updating CC_CHAT_LOG
- Merge without version bumping changed files
