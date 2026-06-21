# RULES.md — Satu 1.0 Universal Rules
> Version 1.6 — 2026-06-21
> Changes: Added R-157 (corrected flash command — esptool, baud 460800, write-flash, confirmed port + paths)
> Previous: v1.5 — 2026-06-20
> For domain rules: load `.claude/rules/RULES-[domain].md`
> Domain files: workflow · backend · firmware · hardware · security

---

- **R-162: SATU_ROADMAP.md IS THE PRODUCT DIRECTION SOURCE OF TRUTH (2026-06-20):**
  This file answers "where are we heading" — PROJECT_STATE.md answers "where are we now".
  Chat reads SATU_ROADMAP.md bullet summaries at every session open (mandatory).
  Full read required when: new firmware architecture, new screen design, commercial
  decision, SaaS direction, hardware model choice, or new repo created.
  CC updates SATU_ROADMAP.md when owner confirms a strategic decision.
  Never add status columns, progress tracking, or completion icons to SATU_ROADMAP.md.

- **R-161: UI_SPEC.md IS THE UI SOURCE OF TRUTH (2026-06-20):**
  All font decisions, layout rules, screen inventory, service tab specs, and NVS keys live here.
  Any UI decision made in a Chat session must trigger a UI_SPEC.md update in the same CC PR.
  CC reads UI_SPEC.md before any ui.h or ui_service.h change.

- **R-160: HARDWARE_SPEC.md IS THE HARDWARE SOURCE OF TRUTH (2026-06-20):**
  Renamed from HARDWARE_TRUTH.md. Lives at hardware/HARDWARE_SPEC.md in firmware repo.
  All pin assignments, relay logic, sensor logic, BOM, and wiring decisions live here.
  Any hardware change must update this file in the same PR.
  CC reads hardware/HARDWARE_SPEC.md before any hardware.h or config.h read.

- **R-157: CI ARTIFACT — 3 files required for full flash from scratch (updated 2026-06-21).**
  compile-check.yml: `--output-dir ./build` routes all build outputs to known path.
  `ls -la ./build/` step in CI confirms exact filenames in the run log.
  Artifact `satu-firmware-N` contains: `satu_vending.ino.bootloader.bin` + `satu_vending.ino.partitions.bin` + `satu_vending.ino.bin`.
  All 3 must be flashed — missing any = black screen. Port confirmed: /dev/cu.usbserial-1420. Baud: 460800.
  `esptool --chip esp32s3 --port /dev/cu.usbserial-1420 --baud 460800 write-flash 0x0 ~/satu-firmware/satu_vending.ino.bootloader.bin 0x8000 ~/satu-firmware/satu_vending.ino.partitions.bin 0x10000 ~/satu-firmware/satu_vending.ino.bin`
  Never change FQBN, board config, or locked library versions in compile-check.yml.

- **R-147: THREE-FILE MACHINE BUILDER ARCHITECTURE — PERMANENT (2026-06-19):**
  satu-machine-builder.html = Section A (Single Flow) + Section B (Fleet)
  satu-hw-trigger.html      = Section C (HW Trigger) — standalone test tool
  satu-wiring.html          = Section D (Wiring + BOM) — standalone reference
  All 3 files: self-contained CSS+JS, gold/dark theme, sidebar nav with `<a href>` cross-links.
  Never merge these files back into one.
  satu-hw-trigger.html → /satu-hw-trigger · satu-wiring.html → /satu-wiring

- **R-146: DOCUMENT VERSIONING — PERMANENT (2026-06-18):**
  Every .md file must carry: `> Version X.Y — YYYY-MM-DD / Changes: [summary] / Previous: vX.Y`
  X.Y+1 = detail change · X+1.0 = new section or structure.
  Whoever last edited applies the bump. No file committed without a version bump if changed.

- **R-145: HTML FILE SIZE LIMIT — PERMANENT (2026-06-18):**
  Any HTML file in public/ exceeding 1000 lines: flag immediately, Chat proposes split plan,
  CC executes only after owner confirms. Each section → independent self-contained file.

- **R-144: CC_SKILL.md MANDATORY READ — PERMANENT (2026-06-18):**
  CC reads CC_SKILL.md every session alongside CLAUDE.md and RULES.md.
  CC_SKILL.md = session protocol + 6 skills + CC_CHAT_LOG write format + closing checklist.

- **R-143: CC_CHAT_LOG PROTOCOL — PERMANENT (2026-06-18):**
  CC appends one entry to CC_CHAT_LOG.md at TOP after every session. Max 10 lines per entry.
  Chat reads last 3 entries each session open. CC never deletes old entries.

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

---

## Domain Rules Index

| Task | Load |
|------|------|
| Session structure · CC prompt · handoff | `.claude/rules/RULES-workflow.md` |
| Backend API · payment · D1 · rate limit | `.claude/rules/RULES-backend.md` |
| Firmware · Arduino · NVS · compile | `.claude/rules/RULES-firmware.md` |
| Hardware · wiring · relays · power | `.claude/rules/RULES-hardware.md` |
| Auth · secrets · ownership · legal | `.claude/rules/RULES-security.md` |
