# SATU — Knowledge Architecture Guide
<!-- How to find anything in this project quickly -->
<!-- Read this first in any new chat session -->
<!-- Last updated: 2026-06-11 -->

## Document Map — What to Read for What Task

| Task | Read first | Then read |
|------|-----------|-----------|
| Starting new chat session | CHAT_HANDOFF.md | PROJECT_STATE.md |
| Any firmware change | UI_SPEC.md | CHAT_HANDOFF.md file touch rules |
| Any backend change | PROJECT_STATE.md endpoint table | SECURITY.md auth layers |
| Any auth / ownership code | SECURITY.md | schema.sql |
| Service mode UI | UI_SPEC.md (tabs 1-5 section) | simulator.html |
| Grid / slot layout | UI_SPEC.md (grid system section) | machine.js _loadSlots() |
| Payment integration | PROJECT_STATE.md Omise section | SECURITY.md payment modes |
| CC build session | CC_BUILD_PROMPT_*.md | Upload local .h files first |
| Security review | SECURITY.md | PROJECT_STATE.md known risks |
| Hardware wiring / BOM | Satu-vending-hardware repo | config.h pin constants |
| Workflow / session modes | WORKFLOW_SKILL.md | CLAUDE.md |
| Business / legal | satu-business-model.html | work_instruction.txt |
| Starting new chat | CHAT_HANDOFF.md | WORKFLOW_SKILL.md |
| Domain rules (if split) | .claude/rules/RULES-[domain].md | RULES.md universal |

---

## File Locations

### Firmware (local Arduino folder — always pull fresh from repo before compiling)
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
public/                 — static HTML files (simulator, testers, admin)
```

### Project knowledge docs (this folder)
```
SECURITY.md          — auth layers, ownership model, gaps  ← not yet in this repo
UI_SPEC.md           — screen inventory, grid system, service tabs, NVS keys
KNOWLEDGE_MAP.md     — this file
PROJECT_STATE.md     — endpoint status, known bugs, next actions
CHAT_HANDOFF.md      — session summary — overwrite each session
WORKFLOW_SKILL.md    — how Chat + CC + Owner work together · session modes · two loops
CC_BUILD_PROMPT_*.md — CC session opening prompts (archived to docs/prompts/ after use)
```

### Other repos
```
Csmittee/Satu-Vending-Firmware  — firmware source, KNOWLEDGE_MAP.md, UI_SPEC.md, SECURITY.md
Csmittee/Satu-vending-hardware  — wiring diagrams, BOM, hardware specs  ← read before hardware decisions
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
8. **Three-repo system** — read all three repos before any decision (R-83)

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
| POST /v1/machine/completion | ❌ Missing | Returns 404 — pending CC job |
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
