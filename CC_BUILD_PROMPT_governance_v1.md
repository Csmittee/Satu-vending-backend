# CC_BUILD_PROMPT_governance_v1.md
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

```
R-[N+3]: DOCUMENT VERSIONING — PERMANENT (2026-06-18):
  Every .md file must carry a version header:
    > Version X.Y — YYYY-MM-DD
    > Changes: [one line summary]
    > Previous: vX.Y — YYYY-MM-DD
  Increment rule: X.Y→X.Y+1 = detail change only. X.0→X+1.0 = new section or structure.
  Whoever last edited the file applies the bump — Chat, CC, or Owner.
  No file is committed without a version bump if content changed.

R-[N+2]: HTML FILE SIZE LIMIT — PERMANENT (2026-06-18):
  Any HTML file in public/ that exceeds 1000 lines must be flagged immediately
  by Chat or CC. Chat proposes a split plan to owner before next CC session.
  CC executes the split only after owner confirms.
  Independent sections must become independent files — each self-contained,
  no shared JS between files.

R-[N+1]: CC_SKILL.md MANDATORY READ — PERMANENT (2026-06-18):
  CC reads CC_SKILL.md at the start of every session alongside CLAUDE.md and RULES.md.
  CC_SKILL.md lives at repo root in both repos.
  It contains: session protocol, 6 skills, CC_CHAT_LOG write format, closing checklist.
  Never remove CC_SKILL.md from the mandatory read list.

R-[N]: CC_CHAT_LOG PROTOCOL — PERMANENT (2026-06-18):
  CC appends one entry to CC_CHAT_LOG.md at the TOP after every session.
  Format defined in CC_SKILL.md. Max 10 lines per entry. Newest at top always.
  Chat reads last 3 entries at every session open.
  If CC_CHAT_LOG is missing or unreadable — Chat tells owner before proceeding.
  CC never deletes old entries.
```

Bump version header on RULES.md.
Also verify the Domain Rules Index table still points to correct .claude/rules/ files.

---

### TASK 3 — KNOWLEDGE_MAP.md (backend repo)

In the "File Locations" section under "Backend", add:
```
CC_SKILL.md         — CC session protocol, 6 skills, CC_CHAT_LOG format · repo root
CC_CHAT_LOG.md      — CC→Chat session log · CC writes · Chat reads last 3 · repo root
```

In the "Document Map" table, add rows:
```
| CC session start         | CC_SKILL.md       | CLAUDE.md + RULES.md     |
| Chat session start       | CC_CHAT_LOG.md    | CHAT_HANDOFF (proj folder) |
```

In the "File Locations" section, correct:
- Remove `satu-preflight.html` from public/ inventory (obsolete)
- Remove hardware repo references (repo deleted)
- Verify public/ inventory matches current reality — read actual public/ folder

Add the `.claude/claude_project/` section if not present:
```
.claude/claude_project/     — reference copies of Chat docs (Chat reads, CC rarely needs)
  WORKFLOW_SKILL.md         — v2.0 governance master reference
  CHAT_RULE.md              — Chat non-negotiables reference
```

Bump version header on KNOWLEDGE_MAP.md.

---

### TASK 4 — Repeat for Satu-Vending-Firmware repo

Apply Tasks 1 and 2 to the firmware repo copies of CLAUDE.md and RULES.md.
Apply same corrections (remove hardware repo, remove preflight references).
KNOWLEDGE_MAP.md may not exist in firmware repo — if missing, skip Task 3 for firmware.
If it exists, apply same additions.

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

Before closing:
1. Read CLAUDE.md — confirm CC_SKILL.md and CC_CHAT_LOG.md are listed, no dead repo references
2. Read RULES.md — confirm 4 new rules at top with correct R-numbers, version bumped
3. Read KNOWLEDGE_MAP.md — confirm new files listed, public/ inventory accurate
4. Read CC_CHAT_LOG.md — confirm it exists and has the seed entry from 2026-06-18
5. Confirm all changed files have version headers bumped
6. Confirm zero src/ files were touched
7. satu-system-tester.html: no backend changes were made so 14-test suite status unchanged — note this in CC_CHAT_LOG

---

## 7. MANDATORY CLOSING

1. Append CC_CHAT_LOG.md at TOP — use format from CC_SKILL.md exactly
2. Archive this prompt → docs/prompts/ stamped ✅ COMPLETE — 2026-06-18 — governance wiring
3. Append 4 new rules to RULES.md (done in Task 2 above) — confirm version bumped
4. Update PROJECT_STATE.md — add session entry: "2026-06-18 — governance docs wired: CC_SKILL, CC_CHAT_LOG, R-[N] to R-[N+3], CLAUDE.md + KNOWLEDGE_MAP.md corrected"
5. Bump version header on every file changed
6. Commit all in this order:
   - RULES.md
   - CLAUDE.md
   - KNOWLEDGE_MAP.md
   - PROJECT_STATE.md
   - CC_CHAT_LOG.md
   - docs/prompts/ archive
7. Merge to main — backend repo first, then firmware repo

---

## 8. PAYMENT MODE REMINDER

PAYMENT_MODE must remain = fake for this entire session.
This prompt touches zero payment code — flag immediately if anything touches payment.
