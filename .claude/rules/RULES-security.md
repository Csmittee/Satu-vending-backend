# RULES-security.md — Satu 1.0
> Domain: Auth, secrets, payment security, legal compliance, ownership model
> Load this file when: Any auth/JWT code · device-secret · admin routes · payment gateway · factory reset
> Last updated: 2026-06-11
---

- R-42: PDPA consent flow is incomplete — legal review required before any live donor data collected
- R-41: All device auth uses device_id + device_secret pair — validate both on every call
- R-40: ADMIN_SECRET + ADMIN_PATH are secrets — never in source code or logs
