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
- **R-109 PNG COLOR TYPE MUST BE RGB (TYPE 2) FOR ESP32/PNGdec — PERMANENT (2026-06-14):**
  Backend QR PNG must use color type 2 (RGB truecolor, 3 bytes/pixel), NOT type 0 (grayscale).
  PNGdec 1.1.6 getLineAsRGB565() silently fails on grayscale input — decode() returns error but
  firmware does not check the return value, so screen draws nothing with no serial error logged.
  Fix in qr.js: ihdrData[9]=2, pixels array = dim*dim*3, 3 bytes per module pixel.
  Confirmed root cause 2026-06-14. Applies to any future PNG generation for ESP32 display.

- **R-108 PUBLIC BINARY ENDPOINTS MUST ACCEPT HEAD — PERMANENT (2026-06-14):**
  Any public endpoint returning binary content (image/png, etc.) MUST accept both GET and HEAD.
  HEAD requests must not reach auth middleware — match HEAD in the same public route block as GET.
  Root cause: satu-system-tester.html Test 4 uses fetch(url, {method:'HEAD'}) to verify reachability.
  HEAD-only hitting auth = 401 = test fails even when the endpoint is correctly public.
  Pattern: `if (path.startsWith('/v1/qr/') && (method === 'GET' || method === 'HEAD'))`
  CF Workers strips response body for HEAD automatically — no change to handler needed.

- **R-107 REWRITE PRESERVE CHECKLIST — PERMANENT (2026-06-14):**
  Any CC prompt that rewrites an EXISTING file MUST include a PRESERVE section
  listing behaviours that must survive the rewrite. CC must verify each item is present
  in the output before committing.
  Minimum mandatory PRESERVE items:
    - worker.js: CORS headers on ALL responses + OPTIONS preflight handler at top
    - index.js: all public routes placed BEFORE any auth middleware block
    - webhook.js: idempotency guard + HMAC skip for fake_omise mode
  Failure to preserve = regression. Regressions require a new fix PR. (Added 2026-06-14)

- **R-106 QR PNG SERVED BY BACKEND — PERMANENT (2026-06-13):**
  GET /v1/qr/:charge_id returns image/png directly from backend.
  Fake worker qr_code_url MUST point to api.janishammer.com/v1/qr/:charge_id.
  Live Omise returns its own QR URL (real PromptPay PNG) — no change needed for live mode.
  NEVER use external image services (api.qrserver.com returns HTML not PNG on many requests).
  Confirmed fix: 2026-06-13. 510 bytes = HTML error page, not a valid PNG.

- **R-104 CC PROMPT FILE LOCATION — PERMANENT (2026-06-13):**
  CC_PROMPT files are always at repo ROOT while active.
  Owner pushes to root → tells CC to execute by filename → CC reads from root.
  After merge: CC moves to docs/prompts/ stamped ✅ COMPLETE — archive only.
  CC must NEVER search docs/prompts/ for a file to execute.
  Root cause of bug: R-50 and R-99 said "stored in docs/prompts/" without
  clarifying root=active vs docs/prompts/=archive. Fixed this session.

- **R-100 MACHINE FARM STRESS TEST — PERMANENT (2026-06-13):**
  Machine Farm Simulator supports max 3 concurrent machines.
  All must use approved device IDs from D1 — no random MACs.
  Promise.all() parallel firing tests D1 contention + rate limits.
  Results panel auto-generates observations for capacity planning.

- **R-99 CC PROMPT FILE CONVENTION — PERMANENT (2026-06-13):**
  All CC prompts = downloadable .md files written by Chat.
  Naming: CC_PROMPT_fix / CC_BUILD_PROMPT / CC_PROMPT_firmware
  Active CC_PROMPT files pushed to repo ROOT by owner. CC reads from root.
         After merge: CC archives to docs/prompts/ stamped ✅ COMPLETE — never execute from there.
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
