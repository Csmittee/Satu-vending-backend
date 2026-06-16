✅ COMPLETE — 2026-06-16 — webhook R-124 payload envelope fix

---

# CC_PROMPT_fix_webhook_payload.md
> Created by: Chat (Claude)
> Date: 2026-06-16
> Session goal: Fix webhook payload mismatch — simulator flow break after fake-omise scan
> Repo: Satu-vending-backend
> Mode: Fix Mode — 2 files only (src/handlers/webhook.js + PROJECT_STATE.md)
> Flash cycles: 0
> PR target: main
> Sequence: Prompt 1 of 1 (self-contained fix)

---

## CC INTRO

New session. Ignore all previous context from other projects.

You are working on SATU 1.0 BACKEND at:
https://github.com/Csmittee/Satu-vending-backend

CC_PROMPT files are always at the repository ROOT level.
docs/prompts/ is archive only — never execute from there.

Read IN FULL and state each filename aloud before writing anything:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. src/handlers/webhook.js        ← read the ENTIRE file
5. fake-omise-worker.js           ← read the ENTIRE file (repo root)
6. CC_PROMPT_fix_webhook_payload.md ← this file

State "All files read ✅" then execute this prompt.

---

## CONTEXT — WHY THIS EXISTS

The simulator (simulator.html) stopped advancing past the QR payment screen
after fake-omise sends a simulated webhook. Root cause: two mismatches between
fake-omise-worker.js and webhook.js that appeared together after R-107 rewrote
the fake worker.

**Mismatch 1 — Payload envelope:**
fake-omise wraps the charge object in `{ key: 'charge.complete', data: { ... } }`
webhook.js reads `payload.object` and `payload.status` — both undefined at top level.
The `if` condition never matches. Handler returns `{ status:'ok' }` immediately.
Nothing gets written to DB. No command queued. Machine polls forever.

**Mismatch 2 — charge_id not in DB:**
fake-omise generates a random `charge_id` (`fake_chg_xxxxxxxx`) that was never
stored when the order was created. The DB lookup `WHERE omise_charge_id = ?` finds
nothing even if Mismatch 1 were fixed. Need fallback lookup by `order_id` from
`metadata`.

**Real Omise is unaffected:**
Real Omise sends charge at top level (no `.data` wrapper) — `payload.data` is
undefined, so `charge = payload.data || payload` correctly falls back to `payload`.
Real Omise always sends a real charge_id that exists in DB — fallback lookup never fires.

**Rule to add:**
R-124: fake-omise-worker wraps charge in `{ key, data: {...} }`.
webhook.js MUST unwrap via `const charge = payload.data || payload` before
reading `.object`, `.status`, `.id`, `.metadata`. Never read these from `payload` directly.

---

## OUTCOME

- Fixed in PR on branch claude/funny-turing-b7d5ki
- Root cause verified from live files before fix was written
- webhook.js: added `const charge = payload.data || payload` + all charge.* reads
- Fallback lookup simplified from Object.assign pattern to direct assignment
- R-124 added to RULES.md
- PROJECT_STATE.md updated with session log
- 14-test suite: owner to verify 14/14 after deploy
