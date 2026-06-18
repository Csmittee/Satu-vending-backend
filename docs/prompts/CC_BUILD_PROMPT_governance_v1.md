# CC_BUILD_PROMPT_governance_v1.md
✅ COMPLETE — 2026-06-18 — Governance wiring: CC_SKILL/CC_CHAT_LOG registered, R-143 to R-146 added, CLAUDE.md + KNOWLEDGE_MAP.md corrected in both repos

---

> Prompt 1 of 1 — Governance wiring: register new files, add rules, sync docs
> Repo: Satu-vending-backend (then repeat for Satu-Vending-Firmware)
> Created: 2026-06-18

---

## 1. CC INTRO

New session. Ignore all previous context from other projects.

Repos:
- https://github.com/Csmittee/Satu-vending-backend
- https://github.com/Csmittee/Satu-Vending-Firmware

Read IN FULL before touching anything:
1. CLAUDE.md
2. RULES.md
3. CC_SKILL.md  ← NEW FILE — read this for session protocol
4. CC_CHAT_LOG.md ← NEW FILE — read to understand context
5. .claude/claude_project/WORKFLOW_SKILL.md ← read to understand governance intent

State every file read before writing a single line.

---

## 2. CONTEXT

New governance files have been added to both repos by the owner:
- `CC_SKILL.md` — CC session protocol + 6 skills (repo root)
- `CC_CHAT_LOG.md` — CC→Chat communication log (repo root)
- `.claude/claude_project/WORKFLOW_SKILL.md` — v2.0 (reference copy)
- `.claude/claude_project/CHAT_RULE.md` — Chat non-negotiables (reference copy)

These files are already in the repo. This prompt only wires them into the
existing documents (CLAUDE.md, RULES.md, KNOWLEDGE_MAP.md).

Zero code changes. Zero src/ changes. Docs only.

---

## 3. NEW FILES

NONE — files already exist. This prompt registers them in existing docs only.

---

## 4. TASKS

### TASK 1 — CLAUDE.md (both repos)

In the "Key Files" section, add these entries:
```
- `CC_SKILL.md` — CC session protocol + 6 skills · read every CC session
- `CC_CHAT_LOG.md` — CC→Chat log · Chat reads last 3 entries each session open
```

Remove or correct any reference to:
- `Satu-vending-hardware` repo — this repo was DELETED. Remove from Repos section.
- `CHAT_HANDOFF.md` — this file is NOT in the repo. Remove any mention that implies it is.
- `satu-preflight.html` — this file is obsolete. Remove from any key files list.

After edits: CLAUDE.md must still be under 35 lines. Trim if needed.
Bump version header.

---

### TASK 2 — RULES.md (both repos)

Append these 4 rules at the TOP (newest first). Use next available R-numbers
after the current highest R-number in RULES.md — read the file to find it.

[rules text as executed — R-143 to R-146 backend / R-138 to R-141 firmware]

Bump version header on RULES.md.
Also verify the Domain Rules Index table still points to correct .claude/rules/ files.

---

### TASK 3 — KNOWLEDGE_MAP.md (backend repo)

See execution notes in CC_CHAT_LOG.md 2026-06-18 entry.

---

### TASK 4 — Repeat for Satu-Vending-Firmware repo

Apply Tasks 1 and 2 to the firmware repo copies of CLAUDE.md and RULES.md.
Apply same corrections (remove hardware repo, remove preflight references).
KNOWLEDGE_MAP.md exists in firmware repo — same additions applied.

---

## 5. DO NOT TOUCH

- hardware.h — R2 LOCKED
- Any file in src/
- Any file in public/ (HTML files)
- schema.sql
- wrangler.toml
- satu-system-tester.html
- config.h / config.h.example
- Any .ino or .h firmware files
- PAYMENT_MODE — stays fake

---

## 6. VERIFICATION

1. CLAUDE.md — CC_SKILL.md and CC_CHAT_LOG.md listed, no dead repo references ✅
2. RULES.md — 4 new rules at top with correct R-numbers, version bumped ✅
3. KNOWLEDGE_MAP.md — new files listed, public/ inventory accurate ✅
4. CC_CHAT_LOG.md — exists with seed entry ✅
5. All changed files have version headers bumped ✅
6. Zero src/ files touched ✅
7. 14-test suite: no backend changes — status unchanged ✅

---

## 7. MANDATORY CLOSING

✅ COMPLETE — all steps executed 2026-06-18

---

## 8. PAYMENT MODE REMINDER

PAYMENT_MODE remained = fake. No payment code touched.
