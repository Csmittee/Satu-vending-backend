# SATU_ROADMAP.md — Product Vision & Direction
> Version 2.0 — 2026-06-20
> Changes: Full rewrite from satu-roadmap.html. Removed all status tracking (tracker = PROJECT_STATE.md).
>          Added repo architecture, Foundation Warning, Phase 2/3/4, business context.
>          Roadmap is a direction guide — never a progress tracker.
> Previous: v1.0 — 2026-06-20 (initial extract — incomplete)

---

## HOW TO READ THIS FILE

**Chat:** Read section headers + bullet points at every session open.
Full section read only when the task touches that domain.
This file answers "where are we heading" — for "where are we now" read PROJECT_STATE.md.

**CC:** Read when owner or Chat flags an architecture decision, new screen design,
commercial direction, hardware model change, or SaaS question.

**Rule:** This file is a direction guide. Never add progress columns, status icons,
or completion tracking here. That belongs in PROJECT_STATE.md.

---

## WHAT SATU IS

**SATU — Sacred Automated Temple Unit**

A Thai temple donation vending machine built to modernise merit-making.
Donors select a sacred item (amulet, blessing card, sacred water), pay via
PromptPay QR, and the machine dispenses the item immediately.

Vision: From a single prototype machine → national digital donation infrastructure.

---

## REPO ARCHITECTURE

Satu is built across repos. Every Chat and CC session must know which repo
they are working in and what that repo owns.

| Repo | Owns | Notes |
|---|---|---|
| `Satu-vending-backend` | Cloudflare Workers API + D1 database | Serves ALL Satu generations |
| `Satu-Vending-Firmware` | ESP32 firmware for Satu 1.0 machine | Hardware + display + network |
| `Satu-2-Firmware` *(future)* | ESP32/device firmware for Satu 2.0 | Has its own sub-hardware |
| `Satu-3-Firmware` *(future)* | AI interface device firmware for Satu 3.0 | Has its own sub-hardware |

**Critical backend rule:** The backend repo is not coupled to any one generation.
It is the shared infrastructure layer — Satu 1, 2, and 3 all call the same backend,
extended over time. Never couple backend logic to physical machine assumptions.
Device type is an attribute, not a schema constraint.

---

## THREE GENERATIONS

### Satu 1.0 — Temple Donation Vending Machine
Physical machine placed inside a temple. Fully autonomous.

What it does:
- Donor selects product (amulet, blessing card, sacred water, etc.)
- Scans PromptPay QR code shown on touch display
- Machine dispenses item via spring coil motor
- Temple owner manages inventory and views revenue via web dashboard
- Remote machine management from backend (enable/disable, commands, OTA stub)

Hardware: ESP32-S3 (ESP32-8048S070C) · 7-inch touch display · 2× MCP23017
· Spring coil motors · IR sensors · WS2812B LEDs · PromptPay via Omise

Three physical models offered to temples:

| Model | Grid | Lanes | Approximate size |
|---|---|---|---|
| Small | 5×2 | 10 | Width <50cm · Height ~100cm |
| Medium | 5×3 | 15 | Width <50cm · Height ~130cm |
| Large | 7×3 | 21 | Width ~70cm · Height ~130cm |

Prototype is being built for the Small model (10 lanes, 2× MCP23017).
Firmware NUM_SLOTS in config.h controls lane count — one constant scales the whole system.
Architecture must preserve expansion path to 21 lanes without redesign.
MCP3 (address 0x22) defined in HARDWARE_SPEC.md but not populated in prototype.

### Satu 2.0 — National Digital Donation Platform
No physical machine required. QR-based giving at temple entrance, merit boards,
festival kiosks, and mobile. Every temple in Thailand accessible.

What it adds:
- 3D visual storytelling per temple ("This roof tile costs 200 THB")
- Tax-exempt donation certificates — blockchain-anchored, Revenue Department API
- Government MOU with Department of Religious Affairs, Fine Arts Dept, BOI approval
- Multi-temple reporting dashboard for temple chains
- Anti-fraud infrastructure — immutable audit trail, multi-sig approvals, public transparency
- National rollout infrastructure — same backend, extended not replaced
- BOI application (Category 4.1) — 6-12 month lead time, start before Satu 1.0 launch

Satu 2.0 has its own firmware repo when device hardware is defined.
Backend repo extends naturally — multi-tenancy already designed in.

### Satu 3.0 — AI Dharma
AI Buddhist guidance system rooted in 2,000 years of Dhamma wisdom.
Not a gimmick — deeply respectful, academically grounded.

What it adds:
- Natural conversation with Dhamma guidance (Pali Canon + Thai Buddhist commentaries)
- Merit tracking and spiritual journey record across temples
- Pilgrimage digital record and community of practice
- Multi-language: Thai · English · Chinese · Japanese · Korean
- Buddhist tourism integration — every temple becomes accessible to international visitors
- AI monk consultation interface integrated with Satu 2.0 network data

Satu 3.0 has its own firmware repo when device form factor is defined.

---

## FOUR PHASES — COMMERCIAL MAP

This is the direction map. Where we are in each phase lives in PROJECT_STATE.md.

### Phase 1 — Prototyping: Product & Software
Build the first working machine. Prove the concept. Get the first temple.

**Building right now (firmware + backend + hardware):**
- ESP32 firmware: state machine, touch display, WiFi, API integration, service mode
- Backend: Cloudflare Workers + D1, Omise PromptPay, temple owner dashboard
- Hardware: ESP32-S3, MCP23017, spring motors, IR sensors, wiring and enclosure
- Payment: Omise KYC completion needed before live mode

**Still to build in Phase 1:**
- Physical prototype machine (components arriving)
- Full end-to-end test: real scan → webhook → relay → item dispensed
- Temple owner claim flow (setup code → dashboard)
- Rate limiting fix (in-memory Map broken across Workers instances)
- Order expiry / QR timeout (Cron Trigger)
- PDPA consent flow (legal review required before launch)
- Auth login endpoint wired to JWT system

### Phase 2 — Operations, Legal & Business
Build the operational backbone before scale becomes impossible.

**Production & Operations:**
- Production process flow: cycle time, assembly steps, quality checkpoints
- Firmware mass production flashing: batch script, eFuse burn, unit test per device
- Supply chain: component suppliers, lead times, safety stock, MOQ negotiation

**Legal & Government:**
- Company registration: Thai Ltd. (not sole proprietor) before government contracts
- BOI application Category 4.1 — start immediately, 6-12 month lead time
- PDPA full compliance audit: consent management, right to erasure, DPO appointment
- Religious institution agreements: MOU template, revenue sharing model
- IP protection: utility model filing before any public demo with partners

**Financial & Sales:**
- P&L model per machine: hardware cost (฿10,470 COGS), Cloudflare (~$5/mo),
  Omise (1.65% PromptPay), installation, maintenance. Break-even analysis.
- Pricing model: machine sale vs revenue share vs SaaS subscription, temple size tiers
- Order and invoice system: quote → PO → invoice → delivery tracking
- Marketing and sales: temple association outreach, Buddhist holiday timing,
  influencer monks, press, forecast model

### Phase 3 — Launch & Production: First Temples, Real Revenue
Controlled launch. Collect real data. Build support infrastructure.

**Launch milestones:**
- Pilot: 3 temples, 3 machines — collect real data on donation amounts,
  popular items, failure modes, support load
- Backend monitoring and alerting: device heartbeat monitor, payment failure alerts,
  on-call procedure
- Field support process: remote disable/enable in backend, physical support SLA,
  spare parts inventory
- Scale to 50 machines: multi-temple reporting, batch firmware OTA,
  revenue dashboard per temple, central accounting

### Phase 4 — Growth: Satu 2.0 National Platform + Satu 3.0 AI Dharma
National infrastructure. Government partnership. AI wisdom layer.

See Satu 2.0 and Satu 3.0 sections above for full detail.

---

## FOUNDATION — BUILD BEFORE SCALE

These items must be in place before Phase 3. Missing any one blocks national scale.
They are not Phase 2 optional tasks — they are prerequisites.

**Company structure**
Register proper Thai Ltd. (not sole proprietor) before government contracts.
BOI application takes 6-12 months — start during Phase 1, not Phase 2.

**PDPA compliance**
Donor consent flow is partially coded but incomplete.
At national scale, PDPA violations carry criminal liability.
Legal review required before any live installation.

**Security hardening**
rateLimit.js is broken in production (in-memory Map, multi-instance).
At national scale Satu becomes a target.
Needs: Cloudflare WAF rules, D1 backup strategy, incident response plan.

**IP protection**
File utility model for the machine concept before any public demo with partners.
Trade secret for firmware: flash encryption designed in Security_Protocol.txt.
Once demoed publicly without filing, protection window closes.

**Financial audit trail**
Temple donations require transparent accounting for trust.
Admin dashboard needs: export, reconciliation reports, Revenue Department integration.
This is a trust requirement, not just a legal one.

**Team and resource plan**
Currently solo. Before Satu 2.0 needs:
1 backend developer · 1 hardware technician · 1 business developer · legal counsel · accounting.
AI agents can extend the solo runway significantly in early stage.

---

## REVENUE MODEL

- Temple pays for the machine (one-time hardware cost)
- Satu takes a percentage of each transaction (revenue share — % TBD post-KYC)
- Alternative: SaaS subscription per machine per month
- Backend is designed for multi-tenancy — one backend serves all temples
- Long-term: backend can be licensed as SaaS to other religious or charity organisations

Omise fee: 1.65% per PromptPay transaction (deducted before Satu's share).
Cloudflare cost: approximately $5/month regardless of machine count (Workers + D1).

---

## DECISIONS THAT ARE LOCKED

These are architectural choices that must not be reopened without owner decision.
Challenging these requires bringing new information, not re-litigating old discussions.

| Decision | Rule | Detail |
|---|---|---|
| Motor stop = sensor-triggered | R-128 LOCKED | NOT timer-based — IR sensor stops motor |
| Relay 12 = spring flap | R-129 LOCKED | NOT door lock solenoid — spring closes automatically |
| 3-area layout | R-141 LOCKED | Product grid · Payment area · Status bar |
| hardware.h | R2 LOCKED | Never modify without explicit owner approval |
| PAYMENT_MODE | Always fake in dev | Live only with physical hardware + Omise KYC complete |

---

## OPEN STRATEGIC QUESTIONS

These are not locked. Owner decides when ready. Chat may challenge with new data.

| Question | Context |
|---|---|
| Transaction fee % | Post-KYC discussion with Omise sales |
| Machine pricing to temples | Pending first customer meeting |
| Machine sale vs revenue share vs SaaS | P&L model needed per Phase 2 |
| MCP3 / 21-lane expansion | Deferred — post-prototype hardware confirmed |
| Thai language in UI | Deferred — bitmap font required, ASCII only now |
| OTA firmware update | Stub exists — full implementation Phase 2+ |
| Single vs dual ESP32 | Does not block current work |
| Login screen for service mode | Deferred — post hardware QA |
