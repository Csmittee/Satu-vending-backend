# CHAT_RULE.md — Satu 1.0
> Version 1.1 — 2026-06-21
> Changes: Added Session Flow section — rules 20-24 (prompt discipline, scope lock, context decay, complaint detection, component detail suppression)
> Previous: v1.0 — 2026-06-18
> Location: Project folder (master) + /.claude/claude_project/ (reference copy)
> CC never reads this unless investigating a process failure

---

## NON-NEGOTIABLE RULES FOR CHAT

### Reading & Diagnosis
1. **Never guess file contents** — search project knowledge first, always
2. **Never ask owner to upload source code** — read from project knowledge directly
3. **Read before diagnosing** — CLAUDE.md + RULES.md + CC_CHAT_LOG (last 3) + affected file before forming any opinion
4. **Read CC_CHAT_LOG at every session open** — if unreadable, tell owner sync is missing before proceeding

### Prompt Writing
5. **One CC prompt per session goal** — batch all related fixes into one prompt
6. **Never re-explain project history in CC prompts** — CC reads CLAUDE.md + RULES.md
7. **8 sections required** — every CC prompt must follow the template in WORKFLOW_SKILL exactly
8. **Never hardcode values into CC prompts** — CC reads from live repo, not from Chat's memory
9. **Firmware: state flash cycle count** — always tell owner how many flash cycles to expect

### Safety
10. **Payment mode warning** — any CC prompt touching payment must explicitly state PAYMENT_MODE=fake
11. **Decision impact statement required** — before writing any prompt touching security, payment, CORS, or main structure, state the impact clearly and wait for owner confirmation
12. **Never reopen locked decisions** — R-128 (sensor motor), R-129 (pin-lock flap), R-141 (3-area rule) and any decision marked LOCKED or CONFIRMED are permanent

### File Discipline
13. **Flag HTML files over 1000 lines** — propose split to owner before next CC session
14. **Flag RULES.md over 200 lines** — tell owner, include split task in next CC prompt
15. **Every document needs a version bump** — if Chat writes or updates any .md, bump the version header
16. **New file = KNOWLEDGE_MAP update** — any CC prompt creating new files must include KNOWLEDGE_MAP update in Section 3 and Section 7

### Session Discipline
17. **Verify CC delivery before closing handoff** — read CC_CHAT_LOG after CC merges, flag any gap to owner in same session
18. **CHAT_HANDOFF goes to project folder only** — never mention repo, never ask CC to write it
19. **WORKFLOW_SKILL change requires Chat verification** — if CC writes a new version, Chat reads and confirms before owner accepts merge

### Session Flow
20. **Prompt discipline** — Do not ask owner clarifying questions beyond what is needed to write the CC prompt. If information is missing, state the assumption and proceed. Owner confirms or corrects in one reply. Never chain questions across multiple turns.
21. **Scope lock** — Once owner confirms today's goal, proceed to prompt delivery. No re-scoping, no expanding scope mid-session without owner explicitly changing the goal. If Chat detects scope creep in itself — stop and restate the original goal.
22. **Context decay** — When a session has exceeded ~15 exchanges or Chat notices its own outputs drifting from template standards — stop, restate what was originally agreed, write the prompt, close. Do not continue clarifying.
23. **Complaint detection** — If owner expresses frustration, repetition, or signals the system is not working — stop all task work immediately. Re-read WORKFLOW_SKILL.md and CHAT_RULE.md from project knowledge. State what rule was violated. Propose the fix to the rule before resuming work.
24. **Component detail suppression** — Do not list hardware components, pin assignments, wire specs, or BOM details in chat responses unless owner explicitly asks. These belong in CC prompts and spec files only.

### Decay Symptoms — Act Immediately When Detected
If any of these appear, stop current work and diagnose governance first:
- File version conflict between repo and project folder
- CC asks a question that suggests it forgot the project context
- CC prompt format looks wrong or incomplete
- Same issue repeats more than 2 loops → KT framework, not another fix
- Strange vocabulary or naming that doesn't match KNOWLEDGE_MAP
- CC_CHAT_LOG has gap (missing sessions)

---

## WHAT CHAT DOES NOT DO
- Write directly to repo
- Run code or tests
- Compile or flash firmware
- Check Omise dashboard
- Verify physical hardware wiring
- Update RULES.md, PROJECT_STATE.md, KNOWN_GOOD.md — CC owns these
