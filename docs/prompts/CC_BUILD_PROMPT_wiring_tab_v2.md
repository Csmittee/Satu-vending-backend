# CC_BUILD_PROMPT_wiring_tab_v2.md
> Created by: Chat (Claude) — 2026-06-17
> Replaces: CC_BUILD_PROMPT_wiring_tab.md (2026-06-16) — DO NOT USE OLD VERSION
> Session goal: Build Tab 4 "⚡ Wiring" in satu-machine-builder.html
> Repo: Satu-vending-backend
> Mode: Build Mode — frontend only (public/satu-machine-builder.html)
> Flash cycles: 0 — browser tool only
> PR target: main
> Sequence: Prompt 1 of 1 — self-contained frontend build

---

## CC INTRO — PASTE THIS TO CC

```
New session. Ignore all previous context from other projects.

You are working on SATU 1.0 at:
https://github.com/Csmittee/Satu-vending-backend

Before doing anything else, read IN FULL:
1. CLAUDE.md
2. RULES.md
3. PROJECT_STATE.md
4. public/satu-machine-builder.html  (existing file — read completely before touching)

State the name of every file you read before writing a single line.
Then execute: CC_BUILD_PROMPT_wiring_tab_v2.md
```

---

## CONTEXT

Tab 4 "⚡ Wiring" is a new tab added to `public/satu-machine-builder.html`.

This is a pin-level interactive wiring diagram, signal flow simulator, and
Bill of Materials generator for the Satu 1.0 physical machine.

This is a **browser-only tool** — no backend API calls, no firmware changes.
All hardware constants are hardcoded from firmware source of truth.
Owner is connecting physical hardware for the first time — wrong wiring
destroys components. Accuracy > aesthetics. Every pin label must be correct.

**Key architectural decisions confirmed 2026-06-17 (read carefully):**
- Motor stops on IR sensor trigger — NOT on a fixed timer
- VEND_MAX_SPIN_MS is the safety limit (motor forced off if sensor never fires)
- Relay 12 = spring flap (NOT door lock solenoid) — energize briefly to open,
  spring returns it closed — no REMOVAL_TIMEOUT, no waiting for item pickup
- Lane empty = motor ran VEND_MAX_SPIN_MS with no sensor trigger →
  disable lane immediately, POST error to backend, grey out on idle grid
- There is NO door lock in the dispensing path anymore

---

## HARDWARE REFERENCE — SOURCE OF TRUTH
> Embed these constants in JS. Never guess. Never change.

### ESP32-S3 (ESP32-8048S070C) GPIO
```
GPIO 19  = I2C SDA  → MCP1 + MCP2
GPIO 20  = I2C SCL  → MCP1 + MCP2
GPIO  5  = WS2812B LED data (40 LEDs total)
GPIO  2  = TFT backlight (PWM)
GPIO 44  = UART RX
GPIO 43  = UART TX
```

### MCP23017 addresses + pin mapping
```
MCP1 (0x20):
  GPA0–GPA7 = IR Sensors 1–8   (pins 0–7,  INPUT_PULLUP, TRIGGERED=LOW)
  GPB0–GPB5 = Relays 1–6       (pins 8–13, OUTPUT, RELAY_ON=HIGH)

MCP2 (0x21):
  GPA0–GPA1 = IR Sensors 9–10  (pins 0–1,  INPUT_PULLUP, TRIGGERED=LOW)
  GPB0–GPB5 = Relays 7–12      (pins 8–13, OUTPUT, RELAY_ON=HIGH)
    Relay 11 = Water Pump  (GPB3, pin 11)
    Relay 12 = Spring Flap (GPB5, pin 13) — pulse HIGH to open, spring closes

MCP3 (0x22): reserved / unpopulated — show greyed out in diagram
```

### Relay → Lane mapping (1-indexed)
```
Relay  1  = Lane 1  motor  (MCP1 GPB0 pin  8)
Relay  2  = Lane 2  motor  (MCP1 GPB1 pin  9)
Relay  3  = Lane 3  motor  (MCP1 GPB2 pin 10)
Relay  4  = Lane 4  motor  (MCP1 GPB3 pin 11)
Relay  5  = Lane 5  motor  (MCP1 GPB4 pin 12)
Relay  6  = Lane 6  motor  (MCP1 GPB5 pin 13)
Relay  7  = Lane 7  motor  (MCP2 GPB0 pin  8)
Relay  8  = Lane 8  motor  (MCP2 GPB1 pin  9)
Relay  9  = Lane 9  motor  (MCP2 GPB2 pin 10)
Relay 10  = Lane 10 motor  (MCP2 GPB3 pin 11)
Relay 11  = Water Pump     (MCP2 GPB4 pin 12)
Relay 12  = Spring Flap    (MCP2 GPB5 pin 13)
```

### Sensor → Lane mapping (1-indexed, 0-indexed in firmware)
```
Sensor  1  = Lane 1  drop detect  (MCP1 GPA0 pin 0)
Sensor  2  = Lane 2  drop detect  (MCP1 GPA1 pin 1)
Sensor  3  = Lane 3  drop detect  (MCP1 GPA2 pin 2)
Sensor  4  = Lane 4  drop detect  (MCP1 GPA3 pin 3)
Sensor  5  = Lane 5  drop detect  (MCP1 GPA4 pin 4)
Sensor  6  = Lane 6  drop detect  (MCP1 GPA5 pin 5)
Sensor  7  = Lane 7  drop detect  (MCP1 GPA6 pin 6)
Sensor  8  = Lane 8  drop detect  (MCP1 GPA7 pin 7)
Sensor  9  = Lane 9  drop detect  (MCP2 GPA0 pin 0)
Sensor 10  = Lane 10 drop detect  (MCP2 GPA1 pin 1)
```

### LED zones (WS2812B, GPIO5, 40 total)
```
Zone TOP    = LEDs  0–9   (top accent lighting)
Zone FLOOR1 = LEDs 10–19  (floor 1 — lanes 1–5)
Zone FLOOR2 = LEDs 20–29  (floor 2 — lanes 6–10)
Zone DOOR   = LEDs 30–39  (flap / dispense area)
```

### Timing constants — correct values as of 2026-06-17
```
VEND_MAX_SPIN_MS   = 30000  ms  motor safety cutoff — 10 turns at 90-180°/sec
                                motor STOPS when sensor triggers (primary)
                                motor STOPS at 30s even if sensor never fires (safety)
FLAP_PULSE_MS      =   300  ms  spring flap open duration (Relay 12 ON time)
SENSOR_POLL_MS     =    10  ms  how often firmware reads sensor during motor spin
PAYMENT_TIMEOUT    = 60000  ms  QR code window
HEARTBEAT_INTERVAL = 300000 ms  5 min

REMOVED: VEND_PULSE_MS — no longer exists (was timer-based motor stop — WRONG)
REMOVED: DROP_TIMEOUT  — no longer needed (sensor fires while motor still running)
REMOVED: REMOVAL_TIMEOUT — no longer needed (spring flap, no item removal wait)
```

---

## WIRE COLOR STANDARD — IEC 60757
```
RED     #FF2020  = 5V power
ORANGE  #FF8C00  = 3.3V power
BLACK   #111111  = GND / common ground
WHITE   #F0F0F0  = 12V power
YELLOW  #FFD700  = I2C SDA
GREEN   #00C040  = I2C SCL
BLUE    #2060FF  = GPIO signal (relay IN line, sensor OUT line)
PURPLE  #9B30FF  = WS2812B data
GREY    #888888  = NC / unused / reserved
BROWN   #8B4513  = 12V return / chassis ground
```

---

## JST CONNECTOR SPECIFICATION
```
I2C bus (ESP32 → MCP):
  JST-PH 2.0mm 4-pin  [3.3V | GND | SDA | SCL]
  Colors: ORANGE | BLACK | YELLOW | GREEN

IR Sensor (MCP GPA → sensor module):
  JST-PH 2.0mm 3-pin  [VCC | GND | OUT]
  Colors: RED(5V) | BLACK | BLUE
  Note: sensor VCC can be 3.3V or 5V — verify module spec

Relay signal (MCP GPB → relay module IN):
  JST-XH 2.54mm 2-pin  [IN | GND]
  Colors: BLUE | BLACK

Motor load (relay NO → spring motor):
  JST-VH 3.96mm 2-pin  [MOTOR+ | MOTOR-]
  Colors: RED | BLACK  (voltage = verify with supplier, typically 12V DC)

WS2812B LED strip:
  JST-SM 2.54mm 3-pin  [5V | GND | DATA]
  Colors: RED | BLACK | PURPLE

Spring flap solenoid (Relay 12):
  JST-VH 3.96mm 2-pin  [VCC+ | GND]
  Colors: WHITE | BROWN
  Note: normally-closed spring flap — energize briefly to open, spring closes

Water pump (Relay 11):
  JST-VH 3.96mm 2-pin  [12V+ | GND]
  Colors: WHITE | BROWN

Power 5V rail:  Terminal block or XT60  [5V+ | GND]
Power 12V rail: Terminal block          [12V+ | GND]
```

---

## ELECTRONICS WARNINGS — PERSISTENT PANEL
> Each warning has a confirm checkbox. State saved in localStorage key `satu_wiring_warnings`.
> Unchecked = ⚠ yellow border. Checked = ✅ green. Never auto-check.

```
W-01: I2C pull-up resistors required
      4.7kΩ on SDA (GPIO19) and SCL (GPIO20) to 3.3V.
      Without these the I2C bus floats → MCP not found → no relays or sensors.
      Add BEFORE first power-on.

W-02: Relay module driver — verify optocoupler included
      MCP23017 max output = 25mA per pin. Relay coil needs ~80mA → MCP burns.
      Most 5V relay modules from China include driver. Check datasheet.

W-03: WS2812B data line resistor
      300–500Ω between GPIO5 and LED data IN.
      Prevents voltage spikes destroying the first LED permanently.

W-04: WS2812B dedicated power supply
      40 LEDs = up to 2.4A at full white. Do NOT power from USB or ESP32 3V3.
      Add 100µF capacitor across 5V/GND at strip power input.

W-05: Motor voltage — verify with supplier
      Relay switches whatever load voltage you connect.
      Wrong voltage = motor too slow, too fast, or burnt.

W-06: Flyback diode on relay load
      Relay coil generates spike on switch-off. Relay modules include protection.
      Verify before connecting motors or solenoid. Bare relay = add 1N4007 across coil.

W-07: Spring flap polarity — Relay 12
      Flap solenoid: energize = open, spring = closed (normally locked).
      VEND_MAX_SPIN_MS fires before flap opens. Flap only opens after sensor confirms drop.
      Do not reverse polarity — solenoid will lock open permanently.
```

---

## TASK — BUILD TAB 4

### Tab placement
Add Tab 4 labelled `⚡ Wiring` to the existing tab bar.
Read existing tab IDs from satu-machine-builder.html before writing — do not guess.
Zero changes to Tabs 1–3.

---

## FEATURE 1 — MULTI-MODEL DIAGRAM TABS

The wiring tool supports multiple machine model variants.
Each model has its own complete diagram saved independently.

### Model tab bar (inside Tab 4, above the diagram)
```
[ Satu 1.0 — 10 Spring ] [ Satu 1.0 — 21 Spring ] [ + New Model ]
```

- Default models pre-populated: "Satu 1.0 — 10 Spring" (10 lanes) and
  "Satu 1.0 — 21 Spring" (21 lanes, uses 3× MCP23017 + extended relay/sensor map)
- [+ New Model] opens a prompt: enter model name → creates blank tab with same
  component tree, user fills in active lane count
- Each model tab is independently renameable (double-click tab label to rename)
- Each model tab deletable (× button) — minimum 1 tab must remain
- Active model tab highlighted in gold

### Per-model data stored in localStorage key `satu_model_{name}`:
```javascript
{
  name: "Satu 1.0 — 10 Spring",
  laneCount: 10,             // active lanes (1-21)
  mcpCount: 2,               // 2 for 10-lane, 3 for 21-lane
  nodePositions: {           // drag positions saved here
    "esp32": {x: 120, y: 200},
    "mcp1":  {x: 340, y: 150},
    // ...one key per draggable node
  },
  warnings: { W01: false, W02: false, ... },
  harnessLengths: { "esp32_mcp1": 30, ... }
}
```

### 21-Spring model — extended mapping
For the 21-lane model, MCP3 (0x22) becomes active:
```
MCP3 (0x22):
  GPA0–GPA7 = IR Sensors 11–18  (pins 0–7)
  GPB0–GPB4 = Relays 13–17      (pins 8–12) — Lanes 11–15
  (second MCP3 at 0x23 for lanes 16-21 if needed — show as "MCP4 reserved")
```
Lane count determines which sensors and relays render as active vs greyed-out.

---

## FEATURE 2 — DRAGGABLE NODES WITH PERSISTENCE

Every component node (ESP32, MCP1, MCP2, relay bank, sensor group, LED strip,
power rails) is draggable on the SVG canvas.

### Drag behaviour
- Mouse down on node header → drag mode
- Node moves with cursor, wires re-route in real time (recalculate elbow paths)
- Mouse up → position saved immediately to localStorage for active model
- On page load → positions restored from localStorage for active model
- If no saved positions → use default layout (left-to-right flow as specified below)

### Default layout (used when no saved positions exist)
```
x=80   y=180  esp32        (left anchor)
x=300  y=100  mcp1
x=300  y=340  mcp2
x=520  y=60   relay_bank1  (relays 1-6)
x=520  y=300  relay_bank2  (relays 7-12)
x=720  y=60   motors_1_6
x=720  y=300  motors_7_10
x=720  y=420  special      (pump + flap)
x=520  y=500  sensors_1_8
x=520  y=620  sensors_9_10
x=100  y=500  led_strip
x=80   y=600  power_5v
x=80   y=660  power_12v
x=80   y=720  power_33v
```

### [Reset Layout] button
Clears node positions from localStorage for active model → reloads default layout.

---

## FEATURE 3 — LAYER TOGGLE SYSTEM

Left panel checkboxes — each hides/shows a named SVG `<g>` group:

```
☑ 3.3V power      (ORANGE wires)
☑ 5V power        (RED wires)
☑ 12V power       (WHITE wires)
☑ GND             (BLACK wires)
☑ I2C bus         (YELLOW + GREEN wires)
☑ Relay signals   (BLUE wires solid — MCP GPB → relay IN)
☑ Sensor signals  (BLUE wires dashed — MCP GPA ← sensor OUT)
☑ Motor load      (RED+BLACK heavy — relay NO → motor)
☑ Flap/Solenoid   (WHITE+BROWN — relay 12 → spring flap)
☑ LED data        (PURPLE wire)
☑ JST labels      (show/hide connector type labels on all endpoints)
☑ Warning flags   (show/hide W-01–W-07 markers on diagram)
☑ Pin numbers     (show/hide raw MCP pin numbers on nodes)
```

Layer toggle state saved per-model in localStorage.

---

## FEATURE 4 — SVG DIAGRAM REQUIREMENTS

### Node rendering
Each component drawn as draggable SVG `<g>` with:
- Rounded rect background (dark bg, gold border to match app theme)
- Header bar with component name + address
- Pin rows inside: `PIN_ID | SIGNAL_NAME | LANE/FUNCTION`
- JST connector tab at each wire endpoint (small colored pill label)
- Wire color segment leaving each pin

### Wire routing
- SVG `<path>` with cubic bezier elbows (not straight diagonals)
- Wires re-route dynamically when nodes are dragged
- Power/load wires: stroke-width 3px
- Signal wires: stroke-width 2px
- Sensor wires: stroke-width 2px, stroke-dasharray "6 3"
- Wire crossings: draw bridge arc (small semicircle bump) on crossing wire
- Hover wire → tooltip: FROM pin, TO pin, JST type, color, gauge suggestion
- Click wire → highlight full path, dim all others, update Inspector

### Zoom + pan
- Mouse wheel = zoom in/out (manipulate SVG viewBox)
- Click + drag on empty canvas = pan
- [Fit to screen] button resets viewBox to show all nodes
- No external library — implement with viewBox math

---

## FEATURE 5 — RIGHT PANEL: INSPECTOR

Click any node or wire → Inspector updates:

```
┌─────────────────────────────────┐
│  INSPECTOR                      │
├─────────────────────────────────┤
│  Component:   MCP23017          │
│  Address:     0x20              │
│  I2C bus:     GPIO19/20         │
│  Pin:         GPB2 (pin 10)     │
│  Direction:   OUTPUT            │
│  Function:    Relay 3 drive     │
│  Maps to:     Lane 3 motor      │
│  Connector:   JST-XH 2.54mm 2p  │
│  Wire:        BLUE (signal)     │
│               BLACK (GND)       │
│  Logic:       HIGH = relay ON   │
│  Firmware:    mcp1.digitalWrite(10, HIGH) │
└─────────────────────────────────┘
```

Click sensor pin → shows:
```
│  Direction:   INPUT_PULLUP      │
│  Logic:       LOW = triggered   │
│  Firmware:    mcp1.digitalRead(pin) == LOW │
```

Click Relay 12 (spring flap):
```
│  Function:    Spring Flap       │
│  Logic:       Pulse HIGH 300ms → spring closes │
│  Note:        Opens AFTER sensor confirms drop  │
│  Firmware:    openFlap() — FLAP_PULSE_MS=300ms  │
```

---

## FEATURE 6 — SIGNAL FLOW SIMULATOR

### Scenario dropdown
```
1. Normal vend — Lane 3 (sensor triggers, flap opens)
2. Lane empty — max spin reached (sensor never fires)
3. Relay stuck ON — watchdog fires
4. Missing I2C pull-up — bus fault at boot
5. Water pump cycle
6. Spring flap test (Relay 12 pulse only)
7. All lanes sequential test
```

### Correct simulation sequences (must match R-128 motor logic exactly)

**Scenario 1 — Normal vend Lane 3:**
```
[0ms]      Order received — Lane 3
[2ms]      I2C write → MCP1 addr:0x20
[5ms]      GPB2 (pin 10) → HIGH — Relay 3 ON ✅ motor SPINNING
[5ms]      Sensor 3 polling begins (every 10ms)
[Xms]      GPA2 (pin 2) read → LOW — Sensor 3 TRIGGERED ✅ item detected
           (X is random 500–3000ms in simulation — item fell through beam)
[X+2ms]    GPB2 (pin 10) → LOW — Relay 3 OFF ✅ motor STOPS (sensor-triggered)
[X+5ms]    MCP2 GPB5 (pin 13) → HIGH — Relay 12 ON — Flap OPENS
[X+305ms]  MCP2 GPB5 (pin 13) → LOW — Relay 12 OFF — Flap CLOSED (spring)
[X+310ms]  LED DOOR zone → GOLD
[X+315ms]  State → COMPLETING — lucky number drawn
[X+320ms]  POST /v1/machine/completion — success
```

**Scenario 2 — Lane empty (sensor never fires):**
```
[0ms]      Order received — Lane 3
[5ms]      GPB2 → HIGH — Relay 3 ON — motor SPINNING
[5ms]      Sensor 3 polling begins (every 10ms)
[500ms]    GPA2 read → HIGH — CLEAR (no item)
[1000ms]   GPA2 read → HIGH — CLEAR (no item)
           ... polling continues every 10ms ...
[30000ms]  VEND_MAX_SPIN_MS exceeded ❌ safety cutoff
[30002ms]  GPB2 → LOW — Relay 12 OFF — motor FORCED OFF
[30005ms]  Lane 3 → DISABLED (g_slots[2].enabled = false)
[30010ms]  POST /v1/machine/error {lane:3, event:'lane_empty'}
[30015ms]  Screen: "Lane 3 empty — please contact staff"
[30020ms]  Idle grid: Lane 3 greyed out — no further purchases possible
[30025ms]  State → IDLE
```

**Scenario 3 — Relay stuck ON:**
```
[0ms]      GPB2 → HIGH — Relay 3 ON command sent
[5ms]      GPB2 readback → HIGH ✅ confirmed
[800ms]    GPB2 → LOW — Relay 3 OFF command sent
[802ms]    GPB2 readback → HIGH ⚠ STILL HIGH — relay stuck
[805ms]    RELAY_STUCK error logged
[810ms]    POST /v1/machine/error {relay:3, event:'relay_stuck'}
[815ms]    Lane 3 DISABLED — safety lockout
```

**Scenario 4 — Missing I2C pull-up:**
```
[0ms]      Wire.begin(GPIO19, GPIO20)
[5ms]      mcp1.begin_I2C(0x20) → TIMEOUT
[5ms]      [HW] ERROR: MCP1 (0x20) not found!
[10ms]     mcp2.begin_I2C(0x21) → TIMEOUT
[10ms]     [HW] ERROR: MCP2 (0x21) not found!
[15ms]     All relays INOPERABLE — no I2C bus
[20ms]     Screen: "Hardware error — contact staff"
           ROOT CAUSE: Missing 4.7kΩ pull-up resistors (W-01)
```

**Scenario 5 — Water pump:**
```
[0ms]      Sacred water option selected
[5ms]      MCP2 GPB3 (pin 11) → HIGH — Relay 11 ON — pump RUNNING
[3000ms]   MCP2 GPB3 → LOW — Relay 11 OFF — pump OFF
[3005ms]   Proceed to product dispense (normal vend flow)
```

**Scenario 6 — Spring flap test:**
```
[0ms]      Flap test triggered (service mode)
[5ms]      MCP2 GPB5 (pin 13) → HIGH — Relay 12 ON — Flap OPENS
[305ms]    MCP2 GPB5 → LOW — Relay 12 OFF — Flap CLOSED (spring return)
[310ms]    Test complete ✅
```

### Animation
- Colored dots travel along wire SVG paths in direction of signal flow
- Dot color matches wire color (BLUE for signal, RED for power, etc.)
- Speed: 1 real second = 150ms animation (compressed)
- Fault events: wire flashes RED, log line shows ❌
- [▶ Run] button starts scenario, [■ Stop] resets

### Simulation log
Scrollable monospace log below simulator — mirrors real serial monitor format.
Each line: `[Xms] message`
Fault lines shown in red. Success lines in green. Info in grey.

---

## FEATURE 7 — BOM TAB (sub-tab inside Tab 4)

Two sub-tabs within Tab 4: `📐 Diagram` and `📋 BOM`

### BOM — Harness length input table
Editable — owner fills in measured cable runs.
State saved per-model in localStorage key `satu_model_{name}.harnessLengths`.

```
┌──────────────────────────────────────────────────────┐
│  HARNESS LENGTH REFERENCE (edit to update wire totals)│
├─────────────────────┬──────────┬─────────────────────┤
│  Run                │ Length   │  Connector           │
├─────────────────────┼──────────┼─────────────────────┤
│  ESP32 → MCP1       │ [___] cm │  JST-PH 4-pin        │
│  ESP32 → MCP2       │ [___] cm │  JST-PH 4-pin        │
│  MCP1 → Relay bank1 │ [___] cm │  JST-XH 2-pin × 6   │
│  MCP2 → Relay bank2 │ [___] cm │  JST-XH 2-pin × 6   │
│  MCP1 → Sensors 1-8 │ [___] cm │  JST-PH 3-pin × 8   │
│  MCP2 → Sensors 9-10│ [___] cm │  JST-PH 3-pin × 2   │
│  Relay → Motor each │ [___] cm │  JST-VH 2-pin × 10  │
│  GPIO5 → LED strip  │ [___] cm │  JST-SM 3-pin +300Ω │
│  Relay 12 → Flap    │ [___] cm │  JST-VH 2-pin        │
│  Relay 11 → Pump    │ [___] cm │  JST-VH 2-pin        │
│  5V rail trunk      │ [___] cm │  terminal block       │
│  12V rail trunk     │ [___] cm │  terminal block       │
└─────────────────────┴──────────┴─────────────────────┘
```

### BOM output — computed, updates live
Wire lengths: sum per color with 20% margin added automatically.
Component quantities driven by laneCount of active model.

```
SATU 1.0 — [MODEL NAME]  BOM  (generated [date])
════════════════════════════════════════════════
ACTIVE COMPONENTS
────────────────────────────────────────────────
ESP32-S3 (ESP32-8048S070C)        qty: 1
MCP23017 I2C GPIO expander        qty: [2 or 3 per model]
Relay module 8ch 5V optocoupler   qty: [ceil(relayCount/8)]
IR sensor module E18-D80NK        qty: [laneCount]
Spring coil motor (vending)       qty: [laneCount]
Spring flap solenoid (Relay 12)   qty: 1    normally-closed
Water pump (Relay 11)             qty: 1
WS2812B LED strip (60LED/m)       qty: 1    40 LEDs — cut to length

PASSIVE COMPONENTS
────────────────────────────────────────────────
4.7kΩ resistor 1/4W               qty: 2    I2C pull-up SDA+SCL → 3.3V
300–500Ω resistor 1/4W            qty: 1    WS2812B data protection
100µF electrolytic cap 10V+       qty: 1    LED strip power filter

CONNECTORS  (active model — [laneCount] lanes)
────────────────────────────────────────────────
JST-PH 2.0mm 4-pin pair (M+F)     qty: 4    I2C (2 used + 2 spare)
JST-PH 2.0mm 3-pin pair (M+F)     qty: [laneCount + 2 spare]  IR sensors
JST-XH 2.54mm 2-pin pair (M+F)    qty: [relayCount + 4 spare] relay signal
JST-VH 3.96mm 2-pin pair (M+F)    qty: [laneCount + 4 spare]  motor load
JST-SM 2.54mm 3-pin pair (M+F)    qty: 4    LED strip

WIRE (with 20% margin)
────────────────────────────────────────────────
RED    22AWG  (5V power)           [auto]m
ORANGE 22AWG  (3.3V power)         [auto]m
BLACK  22AWG  (GND)                [auto]m
WHITE  22AWG  (12V power)          [auto]m
YELLOW 26AWG  (I2C SDA)            [auto]m
GREEN  26AWG  (I2C SCL)            [auto]m
BLUE   26AWG  (signal lines)       [auto]m
PURPLE 26AWG  (LED data)           [auto]m
════════════════════════════════════════════════
```

[📋 Copy BOM] — copies plain text to clipboard
[🖨 Print / PDF] — opens browser print dialog (print CSS: BOM only, black on white)

---

## IMPLEMENTATION NOTES FOR CC

1. **Single file** — all HTML, CSS, JS in `satu-machine-builder.html`. No external files.

2. **SVG diagram** — vanilla SVG only. Use `<g id="layer-i2c">` groups for layers.
   No external diagramming library.

3. **Wire re-routing on drag** — recalculate bezier control points from node
   center positions on every drag move. Use requestAnimationFrame for smooth update.

4. **localStorage keys** (complete list — use exactly these):
   ```
   satu_wiring_active_model     string — name of currently active model tab
   satu_model_{name}            JSON   — full model data (positions, lengths, warnings)
   satu_wiring_layer_state      JSON   — layer toggle checkboxes state
   ```
   Note: the old prompt used `satu_harness_lengths` and `satu_wiring_warnings` —
   do NOT use those keys. Use the new keys above.

5. **Drag implementation** — use SVG `transform="translate(x,y)"` on node `<g>`.
   Listen to `mousedown` on node header, `mousemove` on SVG, `mouseup` on document.
   Save to localStorage on `mouseup` only (not on every move).

6. **Wire bridge arcs** — when two paths cross, detect intersection geometrically
   and render a small semicircle bump (r=6px) on the upper wire.

7. **Animation** — CSS `@keyframes` + JS `setTimeout` chain per scenario.
   Each scenario defined as array of `{delayMs, action, log}` events.
   Simulation time is randomized for sensor trigger (500–3000ms range) to feel realistic.

8. **Model tab UI** — render as styled `<button>` row above diagram panel.
   Active tab: gold background. Double-click to rename (inline `<input>`).
   × delete button appears on hover (not on active tab if it's the last one).

9. **21-spring model** — when laneCount > 10, MCP3 (0x22) node becomes active
   in diagram (remove greyed-out state). Extend relay/sensor maps accordingly.

10. **Print CSS** — `@media print`: hide all tabs and panels except BOM section.
    BOM renders as black text on white, no border, standard font.

---

## DO NOT TOUCH

- Tabs 1, 2, 3 in satu-machine-builder.html — zero changes
- Any backend API handler files
- Firmware files (wrong repo)
- hardware.h — R2 LOCKED
- config.h NUM_SLOTS definition
- PAYMENT_MODE — stays fake

---

## VERIFICATION STEPS (CC self-checks before closing PR)

1. Tab 4 appears without breaking Tabs 1–3
2. Two default model tabs exist: "Satu 1.0 — 10 Spring" and "Satu 1.0 — 21 Spring"
3. [+ New Model] creates a new tab with correct empty state
4. Drag ESP32 node → position updates → reload page → node in same position
5. All 12 relays in diagram with correct MCP + pin label
6. All 10 sensors with correct MCP + pin label
7. Relay 12 inspector shows "Spring Flap" NOT "Door Lock"
8. Layer toggle I2C → hides I2C wires only, all others remain
9. Scenario 1 (Normal vend Lane 3) — log shows sensor fires BEFORE motor stops
10. Scenario 2 (Lane empty) — log shows VEND_MAX_SPIN_MS=30000ms, no flap opens
11. Scenario 1 and 2 have NO reference to VEND_PULSE_MS or REMOVAL_TIMEOUT
12. BOM lane count updates when switching between 10-spring and 21-spring models
13. Harness length input → wire totals update with 20% margin
14. All 7 warnings visible, checkboxes persist after page reload
15. [Reset Layout] returns nodes to default positions

---

## MANDATORY END OF SESSION (R-84)

1. Archive this prompt → `docs/prompts/` stamped:
   `✅ COMPLETE — 2026-06-17 — wiring tab v2 Tab 4 multi-model + drag + R-128 logic`

2. Append to RULES.md at TOP (use next available R-number):
   ```
   R-127: Wiring tab (Tab 4) is a pin-level browser tool.
          All hardware constants hardcoded from hardware.h + config.h.
          Never fetch hardware data from backend API in this tool.
          Motor stop logic = sensor-triggered (R-128) — never timer-based.
          Relay 12 = spring flap, not door lock. No REMOVAL_TIMEOUT in dispense path.
          Multi-model tabs: each model stored independently in localStorage.
          Node positions are draggable and persisted per model.
          (Added 2026-06-17)
   ```

3. Update PROJECT_STATE.md — session log entry + mark wiring tab COMPLETE in open items

4. Update KNOWN_GOOD.md — add snapshot at TOP:
   `2026-06-17 — Wiring tab v2 built — Tab 4 multi-model drag diagram + R-128 correct`

5. Commit: `feat: wiring tab v2 — multi-model drag diagram + correct motor logic R-127`

6. Merge to main

**CHAT_HANDOFF.md is Chat's responsibility — CC must never write it.**

---

## PAYMENT MODE REMINDER
PAYMENT_MODE stays fake. This prompt makes zero backend changes.
Never suggest changing to live.

---
✅ COMPLETE — 2026-06-17 — wiring tab v2 Tab 4 multi-model + drag + R-127/R-128 logic
