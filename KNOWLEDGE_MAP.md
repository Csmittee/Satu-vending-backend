# SATU — Knowledge Architecture Guide
> Version 1.1 — 2026-06-18
> Changes: Added CC_SKILL.md + CC_CHAT_LOG.md entries; removed deleted hardware repo; added .claude/claude_project/ section; corrected project knowledge docs section
> Previous: v1.0 — 2026-06-11

## Document Map — What to Read for What Task

| Task | Read first | Then read |
|------|-----------|----------|
| Starting new chat session | CHAT_HANDOFF.md (proj folder) | CC_CHAT_LOG.md (last 3 entries) |
| CC session start | CC_SKILL.md | CLAUDE.md + RULES.md |
| Any firmware change | UI_SPEC.md | PROJECT_STATE.md firmware section |
| Any backend change | PROJECT_STATE.md endpoint table | SECURITY.md auth layers |
| Any auth / ownership code | SECURITY.md | schema.sql |
| Service mode UI | UI_SPEC.md (tabs 1-5 section) | simulator.html |
| Grid / slot layout | UI_SPEC.md (grid system section) | machine.js _loadSlots() |
| Payment integration | PROJECT_STATE.md Omise section | SECURITY.md payment modes |
| CC build session | CC_BUILD_PROMPT_*.md (repo root) | CC_CHAT_LOG.md last 3 entries |
| Security review | SECURITY.md | PROJECT_STATE.md known risks |
| Hardware wiring / BOM | satu-machine-builder.html (Wiring tab) | hardware.h pin arrays |
| Workflow / session modes | .claude/claude_project/WORKFLOW_SKILL.md | CLAUDE.md |
| Business / legal | satu-business-model.html | work_instruction.txt |
| Domain rules (if split) | .claude/rules/RULES-[domain].md | RULES.md universal |

---

## File Locations

### Firmware (Arduino sketch folder — pull fresh from repo before compiling)
```
firmware/satu_vending.ino   — main state machine, setup(), loop()
firmware/config.h           — pin constants, timeouts, NUM_SLOTS  ← IN .gitignore
firmware/hardware.h         — MCP23017, relays, IR, LEDs, idleAnimation()   ← R2 LOCKED — NEVER REPLACE
firmware/network.h          — WiFi, NVS, /hello, /order, /completion
firmware/ui.h               — all screen drawing, touch detection, service mode
firmware/state_machine.h    — enum MachineState, extern declarations
```

### Backend (GitHub repo → Cloudflare auto-deploy)
```
src/index.js            — route table, CORS, auth middleware
src/handlers/machine.js — /hello, /heartbeat, /commands, /slots, /completion
src/handlers/order.js   — /order, /order/:id/status
src/handlers/webhook.js — Omise webhook handler
src/handlers/admin.js   — admin device management
src/handlers/dashboard.js — temple owner dashboard routes
src/middleware/auth.js  — JWT + device secret auth
src/middleware/rateLimit.js — D1-backed rate limiting
src/db/schema.sql       — authoritative D1 schema
wrangler.toml           — Cloudflare config, routes, cron
public/                 — static HTML files (4 files: satu-system-tester, simulator, satu-machine-builder, satu-admin)
```

### Repo root docs
```
CLAUDE.md           — project compass · CC reads every session
RULES.md            — universal rules + domain index · CC reads every session
CC_SKILL.md         — CC session protocol, 6 skills, CC_CHAT_LOG format · CC reads every session
CC_CHAT_LOG.md      — CC→Chat session log · CC writes · Chat reads last 3
PROJECT_STATE.md    — endpoint status, known bugs, next actions
KNOWN_GOOD.md       — firmware test snapshots, last confirmed working state
UI_SPEC.md          — screen inventory, grid system, service tabs, NVS keys
SECURITY.md         — auth layers, ownership model, gaps
CC_BUILD_PROMPT_*.md — CC session prompts (active at root; archived to docs/prompts/ after use)
docs/prompts/        — archived CC prompts (✅ COMPLETE stamped)
```

### .claude/claude_project/ (reference copies — Chat reads, CC rarely needs)
```
WORKFLOW_SKILL.md   — v2.0 governance master reference
CHAT_RULE.md        — Chat non-negotiables reference
```

### .claude/rules/ (domain rules — CC loads by task)
```
RULES-workflow.md   — session structure, CC prompts, handoff
RULES-backend.md    — API, payment, D1, rate limiting
RULES-firmware.md   — Arduino, NVS, compile, UI
RULES-hardware.md   — wiring, relays, power
RULES-security.md   — auth, secrets, ownership, legal
SKILL_*.md          — KT problem solving, library onboarding, ESP32 constraints
LIBRARY_*.md        — library onboarding docs (PNGdec, etc.)
```

---

## Critical Rules (memorise these)

1. **hardware.h is R2 — NEVER replace or modify it**
2. **NUM_SLOTS defined in config.h only** — ui.h reads it, never redefines
3. **idleAnimation() lives in hardware.h** (LED) — ui.h has idleAnimationUI() (screen flash) — different functions
4. **config.h is .gitignored** — WiFi creds never in git — use config.h.example
5. **Factory reset requires backend call first** — see SECURITY.md
6. **NVS keys ≤15 chars each** — see UI_SPEC.md NVS table for approved keys only
7. **PAYMENT_GATEWAY=fake_omise for all dev/testing** — never switch to live without physical hardware
8. **Two-repo system** — read both repos (backend + firmware) before any decision — hardware repo was deleted

---

## Architecture Decisions (locked — do not revisit without good reason)

| Decision | Choice | Reason |
|----------|--------|--------|
| Backend hosting | Cloudflare Workers + D1 | Edge latency, free tier sufficient |
| Payment | Omise PromptPay | Thai market standard, good API |
| Display lib | Arduino_GFX (moononournation v1.4.9) | Only lib supporting EK9716 RGB panel |
| Identity model | MAC → backend assigns device_id | MAC spoofable, backend ID is canonical |
| Ownership model | AirTag-style binding | Single owner, admin override via nuke |
| Grid system | R×Out with side tabs when R≥3 | Works on 800×480, maps to physical shelves |
| QR display | PNGdec + HTTP fetch from Omise URL | Show exactly what Omise sends, no rebuild |
| WiFi config | NVS primary, config.h fallback | Owner changes WiFi without reflash |

---

## Endpoint Status Quick Reference

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /v1/machine/hello | ✅ Working | Returns slots[], status, setup_code |
| POST /v1/machine/heartbeat | ⚠️ HTTP 500 | connection_logs column mismatch |
| GET /v1/machine/commands | ✅ Working | 30s poll |
| POST /v1/machine/completion | ✅ Live | Confirmed 2026-06-16 |
| POST /v1/machine/command-inject | ✅ Live | Admin-token only — R-142 |
| POST /v1/machine/factory-reset | ✅ Working | |
| POST /v1/machine/claim | ✅ Working | |
| POST /v1/order | ✅ Working | |
| GET /v1/order/:id/status | ✅ Working | |
| POST /v1/webhook/omise | ✅ Working | |
| POST /v1/auth/login | ✅ Working | |
| POST /v1/auth/register | ✅ Working | ALLOW_REGISTRATION gated |
| GET /v1/dashboard/slots | ✅ Working | |
| PUT /v1/dashboard/slots | ✅ Working | |
| GET /v1/dashboard/orders | ❌ Missing | Pending CC job |
| GET /health | ✅ Working | Returns payment_mode |
