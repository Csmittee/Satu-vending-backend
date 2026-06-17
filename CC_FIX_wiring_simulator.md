# CC_FIX_wiring_simulator.md
> Created by: Chat (Claude) — 2026-06-17
> Scope: MICRO FIX — simulator scenarios only in Tab 4 wiring tool
> Repo: Satu-vending-backend
> File: public/satu-machine-builder.html
> Flash cycles: 0
> PR target: main
> Run AFTER: CC_BUILD_PROMPT_wiring_tab_v2.md is merged

---

## CC INTRO — PASTE THIS TO CC

```
New session. Ignore all previous context from other projects.

You are working on SATU 1.0 at:
https://github.com/Csmittee/Satu-vending-backend

Before doing anything else, read IN FULL:
1. CLAUDE.md
2. RULES.md
3. public/satu-machine-builder.html  ← read completely, focus on Tab 4 wiring section

State every file you read before writing anything.
Then execute: CC_FIX_wiring_simulator.md
```

---

## CONTEXT

Tab 4 wiring tool was built successfully. The diagram, layers, drag nodes,
inspector, and BOM all work. Three simulator scenarios were NOT verified
in the test plan and need QA + fix:

1. Scenario 1 — Normal Dispense
2. Scenario 2 — Safety Cutoff (lane empty)
3. Scenario 6 — Spring Flap Test

---

## PROBLEM — WHAT TO LOOK FOR

Read the simulator section of satu-machine-builder.html (Tab 4) carefully.

**Check 1 — Does [▶ Run Simulation] button exist?**
- If missing from the right panel → add it (see spec below)
- If present → proceed to Check 2

**Check 2 — Do scenario log outputs match R-128 motor logic?**

The simulation log must show sensor fires BEFORE motor stops.
Look for any of these WRONG patterns in the scenario JS code:

```javascript
// WRONG — timer stop
delay(VEND_PULSE_MS)  or  800ms  → motor OFF  → sensor check

// WRONG — old constants
VEND_PULSE_MS, DROP_TIMEOUT, REMOVAL_TIMEOUT, "Door LOCK", "Door UNLOCK"
```

**Check 3 — Scenario 2 must be "Lane empty / safety cutoff"**
NOT "Item not removed (REMOVAL_TIMEOUT)" — that scenario was removed.
If it still says REMOVAL_TIMEOUT → replace entirely.

---

## CORRECT SCENARIO SPECIFICATIONS

Replace any incorrect scenario JS with these exact sequences:

### Scenario 1 — Normal Dispense Lane 3
```
[0ms]      Order received — Lane 3
[2ms]      I2C write → MCP1 addr:0x20
[5ms]      GPB2 (pin 10) → HIGH — Relay 3 ON ✅ motor SPINNING
[5ms]      Sensor 3 polling begins (every 10ms)
[1247ms]   GPA2 (pin 2) read → LOW — Sensor 3 TRIGGERED ✅ item detected
[1249ms]   GPB2 (pin 10) → LOW — Relay 3 OFF ✅ motor stops (sensor-triggered)
[1252ms]   MCP2 GPB5 (pin 13) → HIGH — Relay 12 ON — Flap OPENS
[1552ms]   MCP2 GPB5 (pin 13) → LOW — Relay 12 OFF — Flap CLOSED (spring)
[1555ms]   LED DOOR zone → GOLD
[1558ms]   State → COMPLETING — lucky number generated
[1560ms]   POST /v1/machine/completion — success ✅
```
Note: 1247ms is example — sensor trigger time should be randomized 500–3000ms
in the animation to feel realistic. Use a random value each run.

### Scenario 2 — Lane Empty (safety cutoff)
```
[0ms]      Order received — Lane 3
[5ms]      GPB2 (pin 10) → HIGH — Relay 3 ON — motor SPINNING
[5ms]      Sensor 3 polling begins (every 10ms)
[500ms]    GPA2 (pin 2) read → HIGH — CLEAR (no item)
[1000ms]   GPA2 (pin 2) read → HIGH — CLEAR
[2000ms]   GPA2 (pin 2) read → HIGH — CLEAR
           ... polling continues every 10ms ...
[30000ms]  VEND_MAX_SPIN_MS=30000ms exceeded ❌ safety cutoff
[30002ms]  GPB2 (pin 10) → LOW — Relay 3 OFF — motor FORCED OFF
[30005ms]  Lane 3 → DISABLED ❌
[30008ms]  POST /v1/machine/error {lane:3, event:'lane_empty'}
[30010ms]  Idle grid: Lane 3 greyed out — no further purchases
[30015ms]  State → IDLE
```
Note: 30000ms is very long for an animation. Compress to show:
- First 3 poll attempts (at 500ms, 1000ms, 2000ms) with CLEAR result
- Skip indicator "... [27 seconds later] ..."
- Then safety cutoff fires
This keeps animation watchable while showing the correct logic.

### Scenario 6 — Spring Flap Test (Relay 12 only)
```
[0ms]      Flap test triggered (service mode)
[5ms]      MCP2 GPB5 (pin 13) → HIGH — Relay 12 ON — Flap OPENS ✅
[305ms]    MCP2 GPB5 (pin 13) → LOW — Relay 12 OFF — Flap CLOSED (spring return) ✅
[308ms]    FLAP_PULSE_MS = 300ms confirmed
[310ms]    Test complete ✅
```

---

## IMPLEMENTATION — IF [▶ Run Simulation] BUTTON IS MISSING

Add to right panel, below the scenario dropdown:

```html
<div style="margin-top:12px; display:flex; gap:8px;">
  <button id="btn-sim-run"
    style="background:#c8a84b;color:#000;border:none;padding:8px 18px;
           border-radius:4px;cursor:pointer;font-weight:bold;">
    ▶ Run
  </button>
  <button id="btn-sim-stop"
    style="background:#333;color:#aaa;border:1px solid #555;
           padding:8px 18px;border-radius:4px;cursor:pointer;">
    ■ Stop
  </button>
</div>
<div id="sim-log"
  style="margin-top:10px;height:220px;overflow-y:auto;
         background:#0a0a0a;border:1px solid #333;padding:8px;
         font-family:monospace;font-size:11px;color:#888;">
</div>
```

Wire the Run button to the scenario array runner:
```javascript
document.getElementById('btn-sim-run').addEventListener('click', () => {
  const scenario = parseInt(document.getElementById('sim-scenario').value);
  runSimScenario(scenario);
});
document.getElementById('btn-sim-stop').addEventListener('click', stopSimulation);
```

---

## ANIMATED DOTS — IF MISSING FROM SCENARIOS 1/2/6

Each scenario should also animate colored dots along SVG wire paths.
If dots are not moving during simulation, add this to runSimScenario():

```javascript
function animateDotAlongWire(wireId, color, durationMs) {
  const wire = document.getElementById(wireId);
  if (!wire) return;
  const len = wire.getTotalLength();
  const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
  dot.setAttribute('r', 5);
  dot.setAttribute('fill', color);
  dot.setAttribute('opacity', 0.9);
  document.getElementById('wiring-svg').appendChild(dot);

  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / durationMs, 1);
    const pt = wire.getPointAtLength(t * len);
    dot.setAttribute('cx', pt.x);
    dot.setAttribute('cy', pt.y);
    if (t < 1) requestAnimationFrame(step);
    else dot.remove();
  }
  requestAnimationFrame(step);
}
```

Call for Scenario 1:
```javascript
// When relay fires:
animateDotAlongWire('wire-mcp1-relay3', '#2060FF', 200);  // signal: blue
// When motor runs:
animateDotAlongWire('wire-relay3-motor3', '#FF2020', 1200); // power: red
// When flap opens:
animateDotAlongWire('wire-mcp2-relay12', '#2060FF', 200);
```

Wire IDs must match whatever IDs were assigned in the SVG build.
Check actual wire element IDs from the SVG before calling.

---

## LOG OUTPUT FORMAT

All simulation log lines must follow serial monitor format:
```javascript
function simLog(ms, msg, type='info') {
  const colors = { info:'#888', ok:'#00C040', err:'#FF4040', warn:'#FFD700' };
  const line = `<div style="color:${colors[type]}">[${ms}ms] ${msg}</div>`;
  document.getElementById('sim-log').innerHTML += line;
  document.getElementById('sim-log').scrollTop = 999999;
}
```

---

## DO NOT TOUCH

- Any existing working feature in Tab 4 (diagram, drag, layers, inspector, BOM)
- Tabs 1, 2, 3 — zero changes
- Backend API files
- PAYMENT_MODE stays fake

---

## VERIFICATION (CC self-checks before PR)

1. [▶ Run] button visible in right panel
2. [■ Stop] button clears animation and log
3. Scenario 1 log: sensor TRIGGERED appears BEFORE motor OFF line
4. Scenario 1 log: "Flap OPENS" and "Flap CLOSED" appear — NO "Door LOCK/UNLOCK"
5. Scenario 2 log: VEND_MAX_SPIN_MS=30000ms shown — NO REMOVAL_TIMEOUT
6. Scenario 6 log: FLAP_PULSE_MS=300ms shown
7. No reference to VEND_PULSE_MS anywhere in simulator code
8. Animated dots move along wire paths during scenario 1

---

## MANDATORY END OF SESSION (R-84)

1. Archive this prompt → `docs/prompts/` stamped:
   `✅ COMPLETE — 2026-06-17 — wiring tab simulator fix R-128 scenarios`

2. No new RULES.md entry needed — R-127 already covers this tool.

3. Update PROJECT_STATE.md — note simulator scenarios verified

4. Commit: `fix: wiring tab simulator scenarios — R-128 correct motor logic`

5. Merge to main

**CHAT_HANDOFF.md is Chat's responsibility — CC must never write it.**
