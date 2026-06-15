# SKILL_problem_solving_kt.md
# Structured Problem Solving — Kepner-Tregoe Adapted for Software & Firmware
> Version: 1.1 — 2026-06-15 (updated with final resolution of PNGdec case study)
> Location in repo: .claude/rules/SKILL_problem_solving_kt.md (both repos)
> Author: Chat — built from owner QA expertise (automotive/aerospace KT practitioner)
>         + Kepner-Tregoe IS/IS-NOT framework + 8D methodology
> Load this file when: Any bug that fails to resolve after 2 fix attempts (R-111)

---
## UPDATE — 2026-06-15 (appended from PNG investigation session — final chapter)

### CONFIRMED OUTCOME — PNGdec case study final resolution

Actual root cause: `_pngDrawRow()` returned `0`. PNGdec v1.1.4: "return 0 = stop decode early."
This was documented in the library's own release notes. Never read. 48 hours lost.
Fix: change `return 0` → `return 1`. One character. rc=0 rows=165 confirmed on hardware.

**KT Post-Mortem:**
The IS/IS-NOT table correctly identified shared resource conflict as the pattern.
But the Phase 3a hypothesis table was missing one hypothesis:

| # | Hypothesis | Explains IS? | Explains IS-NOT? | Verdict |
|---|---|---|---|---|
| 6 | Wrong callback return value | Yes (PNGdec stops at row 0) | Yes (no display needed to trigger) | ✅ CONFIRMED ROOT CAUSE |

Hypothesis #6 would have been caught by SKILL_library_onboarding.md Step 1 in 5 minutes.
It was missing because we skipped library onboarding and went straight to hardware hypotheses.

**Mandatory addition to Phase 3a — BEFORE generating hypotheses:**
> Step 0: Read the library designer's documentation for all APIs in use.
> LIBRARY_xxx.md must exist before any hypothesis is formed (R-121).
> This eliminates the entire class of "wrong API usage" hypotheses before any code is changed.

**KT Rule 2 restatement (seek global knowledge before third attempt):**
"Global knowledge" explicitly includes: library release notes, designer examples, API docs.
Not just forums and Espressif docs — the library itself is the primary source.

---

## WHY THIS EXISTS

Standard debugging instinct in software is:
1. See symptom → form hypothesis → try fix → repeat

This is fast for simple bugs. It is catastrophic for complex ones.
After 2 failed fixes, the team is no longer solving the original problem —
they are solving the last fix's side effects. Evidence accumulates noise.
Confidence in assumptions grows while accuracy falls.

Kepner-Tregoe (KT) Problem Analysis, created in the 1960s and adopted by
automotive (VDA/8D), aerospace (Apollo 13), and manufacturing industries,
exists precisely to break this loop. It forces fact-based IS/IS-NOT separation
before any solution is attempted.

This skill formalizes KT for software and firmware debugging.

**The Satu project trigger that created this skill:**
PNGdec rc=8 was "fixed" across 5 PRs by changing PNG format, color type, zlib
compression — all wrong. Root cause (PSRAM DMA bandwidth contention) was found
only when the owner forced a wider search in session 4. KT IS/IS-NOT applied
at session 1 would have found it in 1 flash cycle.

---

## THE RULE — WHEN TO INVOKE THIS SKILL

> **R-111 upgraded:** After ANY 2 failed fix attempts on the same symptom:
> STOP all code changes. Invoke this skill. Complete all phases before writing
> a single line of fix code.

Do not skip phases. Do not compress. Do not assume.

---

## THE FOUR KT PHASES — ADAPTED FOR SOFTWARE/FIRMWARE

### PHASE 1 — SITUATION APPRAISAL
*What kind of problem is this? Do we actually understand what we're looking at?*

Questions to answer before anything else:

```
1. What is the EXACT symptom? (not interpretation — raw output, error code, serial log)
2. What was WORKING before this symptom appeared?
3. What CHANGED between working and broken? (code, library, hardware, environment)
4. Is this one problem or multiple problems mixed together?
5. What is the IMPACT if not solved? (blocker / workaround available / cosmetic)
6. Who or what else is affected by this problem?
```

**Firmware example applied:**
```
Symptom:    [UI] PNG decode: rc=8 rows=1 w=165 h=165
Was working: Bitmap QR rendered correctly (drawQrFromBitmap)
Changed:     Reverted from bitmap back to PNGdec approach
Impact:      Blocks live Omise QR — cannot launch product
Mixed?:      No — single clean symptom, reproducible every time
```

---

### PHASE 2 — PROBLEM DEFINITION (IS / IS-NOT)
*The heart of KT. Facts only. No hypotheses yet.*

Build a 4-dimension IS/IS-NOT table:

| Dimension | IS (where/when problem exists) | IS NOT (where/when problem does NOT exist) | What is DISTINCTIVE about IS vs IS-NOT? |
|---|---|---|---|
| **WHAT** | What object has the defect? | What similar object does NOT have the defect? | |
| **WHERE** | Where does the defect appear? | Where does it NOT appear? | |
| **WHEN** | When did it first occur? When does it recur? | When does it NOT occur? | |
| **EXTENT** | How many affected? How severe? | How many NOT affected? | |

**Firmware example applied — PNGdec rc=8:**

| Dimension | IS | IS NOT | Distinctive |
|---|---|---|---|
| WHAT | PNGdec decode() after openRAM | openRAM() itself (succeeds, returns w=165 h=165) | Inflate stage only — not parse stage |
| WHAT | Any PNG variant (grayscale, RGB, stored, deflate) | Bitmap draw (no decode library) |  All compressed formats fail |
| WHERE | ESP32-8048S070C with 800×480 RGB panel | Browser (same PNG renders fine) | Panel-specific hardware environment |
| WHEN | During decode() call while display is active | At boot before display init | Display must be running |
| EXTENT | rc=8 rows=1 every single time | Never rc=0 on any PNG variant | 100% failure rate — not intermittent |

**What the IS/IS-NOT reveals:**
- Fails only when display is active → display is doing something during decode
- Fails on ALL compressed formats → not a format problem
- Browser renders fine → PNG is valid
- openRAM succeeds → library initializes correctly
- Distinctive: display running + decode failing = shared resource conflict

→ **Hypothesis from IS/IS-NOT: the display hardware consumes a shared resource that decode needs**
→ That resource = PSRAM bus bandwidth

This analysis alone — done in session 1 — would have eliminated all format-change attempts.

---

### PHASE 3 — ROOT CAUSE HYPOTHESIS & TESTING
*Generate possible causes. Test each against IS/IS-NOT. Eliminate by logic before touching code.*

#### Step 3a — Generate ALL possible causes (no filtering yet)

For each hypothesis, ask: **"Could this cause explain BOTH the IS and the IS-NOT?"**

| # | Hypothesis | Explains IS? | Explains IS-NOT? | Verdict |
|---|---|---|---|---|
| 1 | Wrong PNG color type | Yes (decode fails) | No (browser renders same file fine) | ❌ ELIMINATED |
| 2 | zlib wrapper wrong (RFC1950 vs RFC1951) | Yes | No (browser fine) | ❌ ELIMINATED |
| 3 | PSRAM allocation failed (g_pngBuf in internal RAM) | Yes (no 32KB window) | No (would fail at boot too) | ⚠️ PARTIAL |
| 4 | PSRAM bus contention with RGB DMA | Yes (DMA owns bus during decode) | Yes (browser has no DMA) | ✅ CONSISTENT |
| 5 | PNGdec library version incompatibility | Yes | No (works on 1000s of ESP32 projects) | ❌ ELIMINATED |

**Rule: never fix a hypothesis that cannot explain the IS-NOT.**
Format changes (#1, #2) were tried for 5 PRs without ever passing this test.

#### Step 3b — For surviving hypotheses, design the minimum spy test

Do not fix yet. Prove the hypothesis with the least invasive measurement possible.

```
Hypothesis #4 test: does decode succeed when DMA is not competing?
Spy: digitalWrite(TFT_BL, LOW) + delay(20) before decode
If rc=0 → confirmed. If still rc=8 → eliminate #4, investigate #3.
```

This is the "send a spy" principle — one targeted observation that confirms or kills the hypothesis.

#### Step 3c — Verify fix solves IS without creating new IS-NOT

Before deploying: what new problems could this fix cause?
```
Fix: backlight off during decode (~100ms)
New IS-NOT risk: donor sees screen flash
Assessment: acceptable — QR screen is static, 100ms imperceptible
No functional regression — display returns to full operation
```

---

### PHASE 4 — SOLUTION & PREVENTION
*Fix the confirmed root cause. Then prevent recurrence.*

#### Fix
Only now write code. Fix must:
- Address the confirmed root cause (not the symptom)
- Not introduce new defects (verified in 3c)
- Be documented with the IS/IS-NOT reasoning

#### Prevention — the two questions after every fix:
```
1. COULD THIS SAME ROOT CAUSE AFFECT ANYTHING ELSE IN THE SYSTEM?
   (PSRAM contention affects JPEG decode, GIF decode, NVS writes during display — document all)

2. HOW DO WE DETECT THIS EARLIER NEXT TIME?
   (Add to SKILL file: board-class constraint documented permanently)
```

This is what converts a single fix into institutional knowledge.

---

## THE ESCALATION LADDER — WHEN TO USE WHAT

```
Symptom appears
      │
      ├── Fix attempt 1 → resolved? → done
      │
      ├── Fix attempt 1 fails → Fix attempt 2 (same hypothesis refined)
      │
      ├── Fix attempt 2 fails → STOP ← R-111 TRIGGERS HERE
      │         │
      │         └── INVOKE THIS SKILL
      │               │
      │               ├── Phase 1: Situation appraisal (10 min)
      │               ├── Phase 2: IS/IS-NOT table (20 min)
      │               │     └── Eliminate at least half the hypotheses by logic
      │               ├── Phase 3a: All hypotheses generated (no code yet)
      │               ├── Phase 3b: Minimum spy test designed
      │               │     └── ONE flash / ONE test / ONE data point
      │               ├── Phase 3b result confirms hypothesis
      │               └── Phase 3c: Fix designed, consequence checked
      │                     └── NOW write fix code
      │
      └── Spy test fails to confirm → back to Phase 3a with remaining hypotheses
            └── DO NOT CHANGE FORMAT / PARAMETERS / UNRELATED CODE
```

---

## THE FIVE RULES FOR CHAT AND CC

These apply to any bug that has survived 2 fix attempts:

**Rule 1 — Never fix a symptom you cannot explain with IS/IS-NOT.**
If your fix cannot explain why the problem does NOT appear somewhere, it is not the root cause.

**Rule 2 — Seek global knowledge before the third attempt.**
Search Arduino forums, ESP-IDF docs, board-specific issues, manufacturer errata.
The root cause may be a known hardware constraint unknown to local context.

**Rule 3 — Send a spy before sending a fix.**
The minimum invasive test that confirms or kills a hypothesis is always cheaper than a fix attempt.
One Serial.printf or one delay() to observe behavior costs zero risk.

**Rule 4 — Never change two things at once.**
Each fix attempt must change exactly one variable. Otherwise the result is uninterpretable.

**Rule 5 — Document what you eliminate, not just what you find.**
Eliminated hypotheses are as valuable as the confirmed one — they prevent future sessions from
re-investigating the same dead ends. Write them into the SKILL file.

---

## APPLICATION CHECKLIST — paste into CC PROMPT when invoking this skill

```
Before writing any fix code, complete and state the following:

IS/IS-NOT TABLE:
- WHAT IS:     [exact symptom object]
- WHAT IS NOT: [similar object where problem does NOT appear]
- WHERE IS:    [environment where it fails]
- WHERE IS NOT:[environment where same thing works]
- WHEN IS:     [exact conditions when it fails]
- WHEN IS NOT: [conditions when it does NOT fail]
- EXTENT:      [frequency, severity, reproducibility]

ELIMINATED HYPOTHESES (with reason):
- [hypothesis] → eliminated because: cannot explain IS-NOT [specific]

CONFIRMED HYPOTHESIS:
- [hypothesis] → explains both IS and IS-NOT because: [specific]

SPY TEST RESULT:
- Test: [what was measured]
- Result: [exact output]
- Conclusion: [confirmed / eliminated]

FIX CONSEQUENCE CHECK:
- Fix: [what changes]
- New risk: [what could break]
- Assessment: [acceptable / not acceptable]
```

---

## REFERENCE

- Kepner-Tregoe Problem Analysis: IS/IS-NOT comparative analysis, developed 1960s
- 8D Methodology: D2 (problem definition) + D4 (root cause) — automotive standard IATF 16949
- VDA Red Book: explicitly recommends KT IS/IS-NOT as best practice for D4 root cause
- Apollo 13: KT methodology used by NASA mission control for life-critical problem solving
- Satu project: PNGdec rc=8 investigation 2026-06 — 4 sessions without KT, solved in 1 with it
