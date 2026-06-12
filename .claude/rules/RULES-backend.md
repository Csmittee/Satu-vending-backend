# RULES-backend.md — Satu 1.0
> Domain: Cloudflare Workers, D1 database, API endpoints, payment gateway
> Load this file when: Any backend source change · payment logic · rate limiting · endpoint work
> Last updated: 2026-06-11
---

- R-15: Run 14-test suite (satu-system-tester.html) after every backend change before closing
- R-14: Only 2 test devices allowed: `SATU-TEST001` (AA:BB:CC:DD:EE:00) + `SATU-SIM01` (AA:BB:CC:DD:EE:01)
- R-13: Ghost devices = never use random MACs in test tools — every random MAC creates a new DB row
- R-12: PAYMENT_MODE = `fake` for all dev/test · `live` only when real ESP32 is physically connected
- R-11: Rate limiting uses D1-backed counter — NOT in-memory Map (multi-instance bug was fixed Apr 2026)
- R-10: API base URL is always `https://api.janishammer.com` — never change without updating firmware
