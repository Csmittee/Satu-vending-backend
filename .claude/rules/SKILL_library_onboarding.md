# SKILL_library_onboarding.md
# Library Onboarding — Read Before You Code
> Version: 1.0 — 2026-06-15
> Location: .claude/rules/SKILL_library_onboarding.md (both repos)
> Author: Chat — built from 48-hour PNGdec investigation (Satu project)
> Trigger: ANY time a new library is selected or added to firmware or backend

---

## WHY THIS EXISTS

Satu project spent 48 hours, 4 chat sessions, 20+ PRs, and millions of tokens
debugging PNGdec rc=8. The root cause was `return 0` in the draw callback —
documented clearly in the library's own release notes as "stop decode early."

We never read the release notes. We never checked the designer's examples.
We built 5 hypotheses (PSRAM, DMA, timing, format, allocation) on an
unverified assumption about how the library works.

This skill exists so this never happens again.

---

## THE RULE — MANDATORY FOR EVERY NEW LIBRARY

> When any library is selected for use in firmware or backend,
> Chat or CC MUST complete this onboarding checklist BEFORE writing
> any code that uses the library. The output is a LIBRARY_xxx.md file
> stored in .claude/rules/ and committed to the repo.

This applies to:
- Arduino libraries (firmware)
- npm packages (backend)
- ESP-IDF components
- Any external dependency added to either repo

---

## ONBOARDING CHECKLIST — 5 STEPS

### Step 1 — Visit the designer's GitHub
Go to the library's official repository. Read in this order:
1. `README.md` — usage pattern, known limitations, minimum RAM requirements
2. `CHANGELOG.md` or `releases` page — every version note, breaking changes
3. `/examples/` folder — at least 2 examples showing correct usage
4. Open `Issues` — filter by "bug" and "closed" — scan for known failure modes
5. Check `library.properties` — minimum architecture, dependencies

### Step 2 — Extract critical facts
Document these specifically:

```
LIBRARY NAME:
VERSION USED:
AUTHOR / REPO:

CALLBACK / RETURN VALUES:
  - What does returning 0 mean?
  - What does returning 1 mean?
  - What does returning -1 mean?

MEMORY REQUIREMENTS:
  - Minimum RAM needed?
  - Does it use stack, heap, or PSRAM?
  - Any internal buffers? How large?

KNOWN FAILURE MODES (from issues/releases):
  - [list any rc codes and their meaning]
  - [list any platform-specific bugs]
  - [list any version-specific breaking changes]

CORRECT USAGE PATTERN (from designer's own examples):
  - [copy the minimal working example structure]

WHAT NOT TO DO (from issues/release notes):
  - [list explicitly]

VERSION LOCK REASON:
  - Why this version specifically?
  - What breaks in newer/older versions?
```

### Step 3 — Test with designer's own example FIRST
Before writing any project-specific code:
- Run the designer's simplest example on the target hardware
- Confirm it works exactly as documented
- Only then adapt to project needs

This step eliminates 90% of "library broken" false hypotheses.

### Step 4 — Write the LIBRARY_xxx.md file
Save to `.claude/rules/LIBRARY_[name].md` in the relevant repo.
Commit immediately — before any code using the library is written.

### Step 5 — Add to CLAUDE.md library table
Add one row to the library reference table in CLAUDE.md:
```
| LibraryName | version | purpose | LIBRARY_libraryname.md |
```

---

## WHAT THIS WOULD HAVE FOUND IN 5 MINUTES

For PNGdec, Step 1 release notes would have shown:

> "This release adds the ability to end the decode of an image early
>  if necessary by returning 0 from the PNGDRAW callback function."

Correct callback:
```cpp
// Designer's own example — PNGdec benchmark:
void PNGDraw(PNGDRAW *pDraw) {
  // no return value in old signature (void)
  // modern signature: return 1 to continue, return 0 to stop early
}
```

`return 0` = stop. `return 1` = continue.
This was documented. We never looked. 48 hours lost.

---

## LIBRARY ONBOARDING FILES — ALREADY CREATED

| Library | File | Key facts captured |
|---|---|---|
| PNGdec 1.1.6 | LIBRARY_pngdec.md | return 1=continue, return 0=stop early, 48K RAM min |
| ESP32-S3 RGB Panel | SKILL_esp32s3_rgb_panel_constraints.md | PSRAM DMA bandwidth, bounce buffer, pixel clock |

---

## TEMPLATE — LIBRARY_xxx.md

```markdown
# LIBRARY_[name].md
> Library: [name] by [author]
> Version locked: [version]
> Repo: [github url]
> Added: [date]
> Onboarded by: [Chat/CC]

## WHAT IT DOES
[one paragraph, plain language]

## CORRECT USAGE PATTERN
[minimal working code from designer's own example]

## CRITICAL RETURN VALUES / SIGNALS
[what each return value means — THIS IS ALWAYS CHECKED FIRST]

## MEMORY FOOTPRINT
[stack / heap / PSRAM usage]

## KNOWN FAILURE MODES
[from GitHub issues and release notes]

## VERSION LOCK REASON
[why this version, what breaks in others]

## WHAT NOT TO DO
[explicit anti-patterns from designer's docs]

## RELEASE NOTES SUMMARY
[key changes per version — especially breaking changes]
```

---

## RULE NUMBERS — ADD TO RULES.MD

```
R-121: LIBRARY ONBOARDING — when any new library is added to firmware or backend:
       Chat or CC must visit designer's GitHub, read README + releases + examples,
       and create LIBRARY_[name].md in .claude/rules/ BEFORE writing any code.
       Commit the LIBRARY file first. Code second. No exceptions.

R-122: LIBRARY EXAMPLE FIRST — before project-specific library code is written,
       run the designer's own simplest example on target hardware and confirm it works.
       "Library broken" is never the first hypothesis — check correct usage first.

R-123: CALLBACK RETURN VALUES — for any library using callbacks, the first thing
       documented in LIBRARY_xxx.md must be what each return value means.
       Returning wrong value from callback = silent failure that mimics hardware bugs.
```

---

## PROCESS — WHERE THIS FITS IN NEW BOARD BRINGUP

When testing a new board from China (or any supplier):

```
NEW BOARD ARRIVES
      │
      ├── Step 1: Identify all required libraries from supplier docs
      │
      ├── Step 2: For EACH library → run SKILL_library_onboarding.md
      │           → create LIBRARY_xxx.md
      │           → commit to repo
      │
      ├── Step 3: Run designer's example for each library on hardware
      │           → confirm works → document in KNOWN_GOOD.md
      │
      ├── Step 4: ONLY NOW begin writing project firmware
      │
      └── Step 5: If anything fails → check LIBRARY_xxx.md first
                  before any hardware hypothesis
```

This converts the "5 hour mystery session" into a structured 2 hour process
with documented outputs that protect every future session.
