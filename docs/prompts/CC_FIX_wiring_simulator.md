# CC_FIX_wiring_simulator.md
✅ COMPLETE — 2026-06-17 — wiring tab simulator fix — animateDotAlongWire + simStop cleanup + simS2 skip indicator

## What was fixed
- Check 8 (animation): `animateDotAlongWire()` implemented. `wBezier()` updated with optional `wid` param. Four wire IDs assigned: `wire-mcp1-rb1`, `wire-rb1-motor`, `wire-mcp2-rb2`, `wire-rb2-flap`.
- Check 2 (stop cleanup): `simStop()` now removes `.sim-dot` SVG elements.
- Scenario 2 skip indicator: `'... [27 seconds later] ...'` line added between polling and VEND_MAX_SPIN_MS cutoff.

## All 8 verification checks — status after fix
1. ▶ Run button visible — ✅ (was already passing)
2. ■ Stop clears animation + log — ✅ (dot cleanup added)
3. S1 sensor TRIGGERED before motor OFF — ✅ (was already passing)
4. S1 Flap OPENS/CLOSED, no Door LOCK — ✅ (was already passing)
5. S2 VEND_MAX_SPIN_MS=30000ms shown — ✅ (was already passing)
6. S6 FLAP_PULSE_MS=300ms shown — ✅ (was already passing)
7. No VEND_PULSE_MS anywhere — ✅ (was already passing)
8. Animated dots move along wire paths — ✅ FIXED this session

## Commit
`fix: wiring tab simulator scenarios — correct motor logic + wire animations`
