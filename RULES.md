# RULES.md — Satu 1.0 Universal Rules
> For domain rules: load `.claude/rules/RULES-[domain].md`
> Domain files: workflow · backend · firmware · hardware · security
> Last updated: 2026-06-16

---

- **R-124: fake-omise-worker wraps charge in { key:'charge.complete', data:{ object:'charge', ... } }.
  webhook.js MUST use: const charge = payload.data || payload;
  Then read charge.object, charge.status, charge.id, charge.metadata — never payload.* directly.
  Real Omise sends charge at top level — payload.data is undefined — falls back to payload correctly.
  This dual-envelope pattern must be preserved in any future webhook rewrites.
  (Added 2026-06-16)**

- **R-123: CALLBACK RETURN VALUES — for any library using callbacks, document what each return value means in LIBRARY_xxx.md BEFORE writing project code (2026-06-15).**
  Wrong return value = silent failure that mimics hardware bugs.
  Example: PNGdec return 0 = stop decode. return 1 = continue. (48hr lesson — R-121 prevents recurrence)
  See: `.claude/rules/SKILL_library_onboarding.md`

- **R-122: LIBRARY EXAMPLE FIRST — before writing project-specific library code, run the designer's own simplest example on target hardware (2026-06-15).**
  Confirm it works. "Library broken" is never the first hypothesis.
  See: `.claude/rules/SKILL_library_onboarding.md`

- **R-121: LIBRARY ONBOARDING — when any new library is added to firmware or backend (2026-06-15):**
  Chat or CC visits designer's GitHub, reads README + releases + /examples/,
  creates `.claude/rules/LIBRARY_[name].md` BEFORE writing any code.
  Commit the LIBRARY file first. Code second. No exceptions.
  See: `.claude/rules/SKILL_library_onboarding.md` for full process.

- **R-120: NVS writes must not occur during image decode or QR display — schedule at idle state only (2026-06-15)**
- **R-119: lineBuf in _pngDrawRow must be static (not stack-allocated) — stable layout during decode (2026-06-15)**
- **R-118: Product images = JPEG ≤320×320px served from backend. Only Omise QR = PNG (EMVCo requirement) (2026-06-15)**
- **R-117: PNG decode CONFIRMED WORKING — root cause was return 0 in callback (2026-06-15 CORRECTED):**
  Root cause confirmed on hardware 2026-06-15 16:41:32: `_pngDrawRow()` returned `0` = PNGdec stop-early (v1.1.4 feature).
  Fix: `return 1` in callback. One character. rc=0 rows=165 w=165 h=165 confirmed.
  pause-decode-resume pattern (TFT_BL gate) was tested alongside but was NOT the root cause.
  PSRAM bus contention is a real constraint on this board class and remains documented for future reference.
  Reference: `.claude/rules/LIBRARY_pngdec.md` · `.claude/rules/SKILL_esp32s3_rgb_panel_constraints.md`
- **R-116 PNGDEC ROOT CAUSE CONFIRMED — PSRAM BANDWIDTH CONTENTION (2026-06-15 update):**
  Root cause = RGB DMA engine reads 800×480 frame buffer from PSRAM continuously at ~16MHz,
  consuming ~50% of OPI PSRAM bus bandwidth at all times. zlib inflate needs 32KB sliding
  window with random PSRAM reads — DMA wins every bus arbitration. Fix = pause-decode-resume (R-117).
  CLOSED: do not run further format/allocation diagnostics on this issue.
- **R-116 PNGDEC INVESTIGATION STATUS — (2026-06-14) [SUPERSEDED by above 2026-06-15]:**
  PNGdec 1.1.6 openRAM() returns rc=8 rows=1 for all PNG variants tested.
  The library is NOT confirmed broken — it works for thousands of ESP32
  projects. Root cause NOT yet identified.
  Next diagnostic: esp_ptr_in_psram(g_pngBuf) immediately after ps_malloc
  in initUI(). If PSRAM=NO, zlib inflate fails due to insufficient 
  sliding window in internal RAM. This is the most likely root cause.
  Do not change PNG format or architecture again until this is measured.
  Bitmap branch preserved as fallback only.

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
- **R-115 CRITICAL FIX ESCALATION PROTOCOL — PERMANENT (2026-06-14):**
  When any fix attempt exceeds 2 loops without solving the root cause,
  STOP ALL CODE CHANGES immediately. Do not create a workaround that
  only works in one mode. Do not change architecture to avoid a library
  bug without first confirming the library is actually broken.

  Instead follow these steps in order:

  Step 1 — BIG PICTURE REVIEW
    List every file touched in this fix sequence.
    List all assumptions that have never been verified on hardware.
    State the original problem in one sentence.
    Ask: are we still solving the original problem or a new one?

  Step 2 — DEEP DIAGNOSTIC SPY
    Add serial output at the exact failure point before changing code.
    Never guess what data looks like — measure it.
    Report raw values (rc=, bytes=, addr=, PSRAM=YES/NO).
    Do not remove diagnostic output until root cause is confirmed.

  Step 3 — RESEARCH GLOBAL KNOWLEDGE
    Search Arduino forums, GitHub issues, and library release notes
    for the exact error code and library version.
    If the community has already solved it — use their fix.
    Do not invent a new architecture to avoid a known solvable bug.

  Step 4 — FIX MUST WORK IN ALL MODES
    Any fix must work for both fake mode AND live Omise PNG mode.
    A fix that only works in fake mode is not a fix — it is a 
    workaround that creates future problems.
    Image rendering (PNG/JPEG) is core to this product — QR codes,
    amulet photos, Buddha images, temple owner uploads all depend on it.

  Applied lesson: QR PNG bitmap experiment — PRs #16-#20, 5 flash 
  cycles, 125K firmware tokens, problem confirmed but not root-caused.
  Bitmap workaround works in fake mode only. PNGdec investigation 
  continues next session with esp_ptr_in_psram() diagnostic.
- **R-114 QR IS SERVED AS RAW BITMAP — NOT PNG — (2026-06-14) [REVERTED from backend main 2026-06-15 — bitmap on claude/cool-hopper-6owumd branch only — see R-116]:**
  PNGdec 1.1.6 on ESP32 fails for ALL PNG variants tested (PRs #16–#19): grayscale+bad-zlib,
  RGB+stored-zlib, grayscale+stored-zlib, grayscale+real-deflate — every variant rc=2/rc=8.
  GET /v1/qr/:charge_id/bitmap returns: 4-byte header (width uint16 BE + height uint16 BE)
  then 1 byte per pixel: 0x00=black module · 0xFF=white background, row by row.
  Firmware reads with fetchImageBytes(), draws with gfx->fillRect(). No decode library needed.
  PNG endpoint GET /v1/qr/:charge_id remains for browser/simulator use (test suite HEAD route).
  Root cause of PNGdec failure NOT confirmed — investigation continues per R-116.
- **R-113 USE CompressionStream('deflate') + RFC 1950 WRAP FOR PNG IDAT — SUPERSEDES R-110 stored-block fix — PERMANENT (2026-06-14):**
  PNGdec 1.1.6 inflate fails on large BTYPE=00 stored deflate blocks: decodes exactly row 0
  (callback rows=1), then rc=8. The _zlibStore() stored-block approach from R-110 is broken.
  Fix: use CF Workers CompressionStream('deflate') (raw RFC 1951) + manual RFC 1950 wrap:
    out = [0x78, 0x01] + <raw deflate output> + <Adler-32 of uncompressed data, 4 bytes BE>
  This produces real compressed blocks (BTYPE=01/10) that PNGdec's inflate handles correctly.
  PNG size drops from ~27KB (stored) to ~3-8KB (compressed) for a typical QR code.
  See qr.js _zlibDeflate(). Never revert to stored blocks for any PNG served to PNGdec.

- **R-112 PNG COLOR TYPE MUST BE GRAYSCALE (TYPE 0) FOR PNGdec 1.1.6 — SUPERSEDES R-109 — PERMANENT (2026-06-14):**
  PNGdec 1.1.6 uses bitDepth (8 = bits-per-channel from IHDR) as bytes-per-pixel for ALL color types.
  For grayscale (type 0, 1 channel): BPP=1 = correct. Row stride = 1+width*1 ✓
  For RGB (type 2, 3 channels): PNGdec uses BPP=1 instead of 3. Row stride = 1+width*1 (should be
  1+width*3). After row 0, "row 1 filter" byte lands at offset 1+width*1 = pixel data = 0xFF =
  invalid filter type → rc=8 rows=1. R-109 (use RGB) was wrong — the original grayscale failure was
  caused by bad zlib (R-110), not the color type.
  Fix: ihdrData[9]=0 (grayscale), 1 byte/pixel, keep _zlibStore(). PNG ~27KB.
  Never switch QR PNG to RGB (type 2) or RGBA (type 6) — same BPP bug applies.

- **R-110 CF WORKERS CompressionStream('deflate') = RAW RFC 1951, NOT ZLIB — PERMANENT (2026-06-14):**
  CompressionStream('deflate') in CF Workers emits raw deflate (RFC 1951) with NO 2-byte zlib
  header and NO Adler-32 checksum. PNG IDAT requires RFC 1950 (zlib-wrapped deflate).
  PNGdec rc=8 (PNG_INVALID_DATA) after row 1 is the symptom.
  ~~Fix: stored BTYPE=00 blocks~~ — SUPERSEDED BY R-113. Stored blocks also cause rc=8 rows=1.
  Correct fix: use CompressionStream('deflate') + manual RFC 1950 wrap. See qr.js _zlibDeflate().

- **R-109 ~~PNG COLOR TYPE MUST BE RGB (TYPE 2) FOR ESP32/PNGdec~~ — SUPERSEDED BY R-112 (2026-06-14):**
  R-109 was wrong. Grayscale failure was caused by bad zlib (R-110), not the color type.
  PNGdec 1.1.6 BPP bug means RGB (type 2) breaks row stride → rc=8 rows=1 (same symptom).
  See R-112 for correct fix: use grayscale (type 0), 1 byte/pixel.

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
