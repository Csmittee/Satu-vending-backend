# RULES.md — Satu 1.0 Universal Rules
> For domain rules: load `.claude/rules/RULES-[domain].md`
> Domain files: workflow · backend · firmware · hardware · security
> Last updated: 2026-06-12

---

## Universal — Apply to Every Session

1. **Never hardcode secrets** — always Cloudflare secrets manager
2. **Security = non-negotiable** — real money at religious institutions · flag immediately
3. **Full files only** — never partial snippets for critical files · complete replacement always
4. **Run 14-test suite** (satu-system-tester.html) after any backend change · all 14 must pass
5. **Document every decision** — handoff-ready at all times
6. **hardware.h R2 LOCKED** — never open, modify, or redeclare anything it owns
7. **PAYMENT_GATEWAY=fake_omise** for all dev/test — never suggest live without physical hardware
8. **Three-repo system** — read all three repos before any decision (detail → RULES-workflow R-83)
9. **Session closing** — archive → RULES.md → PROJECT_STATE.md → commit (detail → RULES-workflow R-84)
10. **No ghost devices** — only SATU-TEST001 (AA:BB:CC:DD:EE:00) + SATU-SIM01 (AA:BB:CC:DD:EE:01)
- **R-100 MACHINE FARM STRESS TEST — PERMANENT (2026-06-13):**
  Machine Farm Simulator supports max 3 concurrent machines.
  All must use approved device IDs from D1 — no random MACs.
  Promise.all() parallel firing tests D1 contention + rate limits.
  Results panel auto-generates observations for capacity planning.

- **R-99 CC PROMPT FILE CONVENTION — PERMANENT (2026-06-13):**
  All CC prompts = downloadable .md files written by Chat.
  Naming: CC_PROMPT_fix / CC_BUILD_PROMPT / CC_PROMPT_firmware
  Stored in docs/prompts/. Archived ✅ COMPLETE after merge.
  Follow 8-section template defined in WORKFLOW_SKILL.md.

- **R-94 THREE-TESTER ARCHITECTURE — PERMANENT (2026-06-13):**
  satu-system-tester.html = Backend API suite (14 tests, never modify)
  simulator.html          = Vending Machine Simulator (touch UI + drawer)
  satu-machine-tester.html = Machine Farm Simulator (node flow + stress)
  simulator_r3.html DELETED 2026-06-13.
  No new test files without owner + Chat approval.

- **R-98 TEMPLATE LITERALS IN WORKERS HTML — PERMANENT RULE (2026-06-13):**
  In Cloudflare Workers, when returning HTML as a template literal that contains
  inline `<script>` blocks, any JS inside those script blocks MUST use string
  concatenation — NOT backtick template literals. Wrangler 4.100+ esbuild strict
  mode mis-parses nested `${...}` expressions inside outer template literal strings.
  Use: `'<td>'+h(val)+'</td>'` — NOT: `\`<td>${h(val)}</td>\``
  Also: `</script>` inside outer template literal must be written as `<\/script>`.
- **R-97 wrangler.toml ROUTES MUST BE TOP-LEVEL — PERMANENT RULE (2026-06-13):**
  `routes = [...]` must be a top-level key in wrangler.toml — never inside `[[d1_databases]]`
  or any other `[section]`. In TOML, all keys after a section header belong to that section.
  Correct placement: before `[assets]` block, in the top-level preamble.
  Symptom when wrong: Cloudflare build fails with "Unexpected fields found in d1_databases[0]: routes".
- **R-85 NO HARDCODED CREDENTIALS — PERMANENT RULE (2026-06-12):**
  WiFi credentials NEVER in source files or git — NVS only (nvs_ssid / nvs_pass).
  config.h WIFI_SSID and WIFI_PASSWORD MUST remain empty strings ("") permanently.
  Credentials entered via drawWifiSetupScreen() touchscreen → saveWifiAndReboot() → NVS.
  Do NOT suggest filling in config.h WiFi fields in any session, ever.
- **R-86 config.h WORKFLOW — PERMANENT RULE (2026-06-12):**
  config.h = gitignored local file for pin constants and build config only.
  config.h.example = tracked template in git — WIFI_SSID="" WIFI_PASSWORD="" intentional.
  On new machine: copy config.h.example → config.h, leave WiFi empty, flash, enter on screen.

---

## Domain Rules Index

| Task | Load |
|------|------|
| Session structure · CC prompt · handoff | `.claude/rules/RULES-workflow.md` |
| Backend API · payment · D1 · rate limit | `.claude/rules/RULES-backend.md` |
| Firmware · Arduino · NVS · compile | `.claude/rules/RULES-firmware.md` |
| Hardware · wiring · relays · power | `.claude/rules/RULES-hardware.md` |
| Auth · secrets · ownership · legal | `.claude/rules/RULES-security.md` |
