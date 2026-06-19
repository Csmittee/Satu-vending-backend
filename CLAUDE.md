# CLAUDE.md — Satu Project Compass
> Version 1.3 — 2026-06-19
> Changes: Added src/index.js + src/handlers/ to Key Files
> Previous: v1.2 — 2026-06-19
<!-- max 35 lines · never grows · CC reads this on every session start -->

## Stack
- **Backend**: Cloudflare Workers + D1 (SQLite) · `api.janishammer.com`
- **Payment**: Omise PromptPay · PAYMENT_MODE secret = `fake` (dev) / `live` (real machine only)
- **Hardware**: ESP32-S3 (ESP32-8048S070C) · MCP23017 ×2 · relays · IR sensors (E18-D80NK)
- **Firmware**: Arduino/C++ · satu_vending.ino + .h headers
- **Frontend**: Vanilla HTML/JS · Cloudflare Pages
- **Firmware IDE**: Arduino 1.8.19 · ESP32 core 2.0.17 · GFX lib 1.4.9

## 5 Rules (non-negotiable)
1. **Never hardcode secrets** — always Cloudflare secrets manager
2. **Security = non-negotiable** — real money at religious institutions · flag issues immediately
3. **Full files only** — never partial snippets for critical files
4. **Run the 14-test suite** (satu-system-tester.html) after any backend change
5. **Document every decision** — this must be handoff-ready at all times

## Key Files (read before touching anything)
- `RULES.md` — 10 universal rules · read every session · domain rules in `.claude/rules/`
- `CC_SKILL.md` — CC session protocol + 6 skills · read every CC session
- `CC_CHAT_LOG.md` — CC→Chat log · Chat reads last 3 entries each session open
- `PROJECT_STATE.md` — phase status · endpoint table · CC updates after every fix/PR
- `KNOWN_GOOD.md` — last confirmed test snapshot · updated by Chat/owner after each test session
- `KNOWLEDGE_MAP.md` — navigation guide · what to read for each task
- `public/satu-hw-trigger.html` — HW Trigger standalone tool · Section C extracted from machine builder
- `public/satu-wiring.html`     — Wiring + BOM standalone reference · Section D extracted from machine builder
- `src/index.js`                — route table + middleware · read before any endpoint change
- `src/handlers/`               — all handler files live here (order.js, webhook.js, admin.js, auth.js, machine.js, dashboard.js)

## Repos
- Backend: `Csmittee/Satu-vending-backend`
- Firmware: `Csmittee/Satu-Vending-Firmware`
