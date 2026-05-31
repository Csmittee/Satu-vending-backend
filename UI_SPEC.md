# SATU — UI Specification R4
<!-- Read this before touching ui.h or any drawXxx() function -->
<!-- Last updated: 2026-05-31 -->
<!-- Screen: 800×480 px, RGB565, Arduino_GFX, EK9716 driver -->

## Screen Coordinates

```
(0,0)────────────────────────────(800,0)
│  STATUS BAR  44px tall                │
│  SATU | state label | [EN|TH] WiFi   │
(0,44)───────────────────────────(800,44)
│                                       │
│   MAIN CONTENT AREA  436px tall       │
│                                       │
(0,480)──────────────────────────(800,480)
```

Status bar colour: C_DARKGOLD background, 3px C_GOLD strip at bottom
Font is ASCII only — no Thai until bitmap font loaded

---

## Language System

- NVS key: `lang` (2 chars, default `EN`)
- Global: `static bool g_lang_th = false;`
- All label strings use: `g_lang_th ? "ข้อความไทย" : "English text"`
- Thai font: NOT in R4 scope — TH label falls back to EN if font not loaded
- Selector: small [EN|TH] toggle in status bar, top-right area
- R4 delivers: language toggle in Settings + EN labels only. TH activates in R5 when font added.

---

## Grid System — R rows × Out outputs per row

Config sent by backend in /hello: `grid_rows` (1-3), `grid_cols` (1-7)
Stored in NVS: `nvs_grow` / `nvs_gcol` as cache

### Layout rules

| Rows | Cols | Tab behaviour | Total slots |
|------|------|--------------|-------------|
| 1 | 1-7 | No tabs, single row fills height | 1-7 |
| 2 | 1-7 | No tabs, two rows fill height | 2-14 |
| 3 | 1-7 | Side tabs A/B/C appear, one row shown at a time | 3-21 |

### Side tab design (rows=3 only)

```
┌──┬─────────────────────────────────────┐
│A │  [1]  [2]  [3]  [4]  [5]           │
│──│                                     │
│B │  ← selected row buttons fill here  │
│──│     full height of content area    │
│C │                                     │
└──┴─────────────────────────────────────┘
```

Side tab strip: 60px wide, full content height
Active tab: C_GOLD border, slightly brighter background
Button labels: A1-A7, B1-B7, C1-C7 (row letter + column number)
Physical mapping: A = top shelf, B = middle shelf, C = bottom shelf

### Cell size calculation (runtime, not hardcoded)

```cpp
int sidew    = (g_grid_rows >= 3) ? 66 : 0;
int avail_w  = SCR_W - sidew - GRID_PAD*2;
int avail_h  = SCR_H - STATUS_H - GRID_PAD*2;
int CELL_W   = (avail_w - GRID_PAD*(g_grid_cols-1)) / g_grid_cols;
int CELL_H   = (g_grid_rows >= 3)
               ? (avail_h - GRID_PAD*2)                    // one row, full height
               : (avail_h - GRID_PAD*(g_grid_rows-1)) / g_grid_rows;
```

### Cell content layout (all configs)

```
┌──────────────────┐
│     [A2]         │  ← slot label badge (top centre), 11px circle
│                  │
│       100        │  ← price HERO (size 3-4, price-tier colour)
│       THB        │  ← size 1
│                  │
│   Small Amulet   │  ← name_en (size 2, grey, bottom area)
└──────────────────┘
```

Price colour tiers:
- ≤50 THB → C_PRICE_TEAL
- ≤100 THB → C_PRICE_GOLD
- ≤200 THB → C_PRICE_AMBER
- ≤300 THB → C_PRICE_ORANGE
- >300 THB → C_PRICE_DEEPORANGE

Disabled slot: dim grey background, slot number only, no tap response

---

## Idle Screen Additions (R4)

Below the grid, in the remaining space (varies by config):
- "Tap any item to begin" — size 1, C_GOLD, centred, gentle pulse animation
- Pulse: draw text at alpha 100% → delay 1s → 60% → delay 1s → repeat
- After 30s no touch: call idleAnimationUI() (gold border flash, 2 cycles)
- LED breathing (hardware.h idleAnimation) runs asynchronously

---

## Screen Inventory

| Screen | Function | State |
|--------|----------|-------|
| Boot | drawBootScreen(status) | STATE_STARTUP |
| Setup code | drawSetupCodeScreen(code) | STATE_STARTUP (pending) |
| Boot PIN | drawBootPinScreen() | STATE_STARTUP (boot_pin=true) |
| Idle grid | drawIdleScreen() | STATE_IDLE |
| Product selected | drawProductSelection(slot) | STATE_PRODUCT_SELECTION |
| Gift option | drawGiftOptionScreen(slot) | STATE_GIFT_OPTION |
| QR payment | drawQrScreen(url, amount, slot) | STATE_AWAITING_PAYMENT |
| Vending | drawVendingScreen(slot) | STATE_VENDING |
| Completion | drawCompletionScreen(slot, lucky, water) | STATE_COMPLETING |
| Error | drawErrorScreen(msg) | STATE_ERROR |
| Offline | drawErrorScreen("No WiFi") | STATE_OFFLINE |
| Service PIN overlay | drawPinOverlay() | any → STATE_SERVICE |
| Service mode | drawServiceScreen(tab) | STATE_SERVICE |
| Debug info | drawDebugScreen() | any (5s hold gesture) |

---

## Service Mode — Complete Tab Specification

### Entry
Gesture: 3× tap top-right corner (x>700, y<80) within 2 seconds
If SVC_PIN_EN=true: show PIN numpad overlay (4 digits, shake on wrong)
3 wrong attempts → 30s lockout with countdown display
Correct PIN → drawServiceScreen(TAB_SELFTEST)

Exit: ✕ button top-right of service header → back to STATE_IDLE

### Header bar (always visible in service mode)
```
[🔧 SERVICE MODE]  [SATU-4R473R]  [v1.0.0-r4]              [✕ EXIT]
```
Height: 36px, dark background, orange accent text for device_id

### Tab bar (below header)
5 tabs: SELF TEST | FREE PLAY | DEVICES | SETTINGS | FIRMWARE
Width: 160px each (800/5), active tab: gold underline + slightly brighter

---

### TAB 1: SELF TEST

**System Info section** (read-only rows):
```
Device ID     │ SATU-4R473R
API URL       │ https://api.janishammer.com
WiFi SSID     │ Jaydahome2.4G
IP Address    │ 192.168.1.45
Free Heap     │ 328,441 bytes
Uptime        │ 142s
Last Heartbeat│ 38s ago
Temperature   │ 40°C (simulated)
Firmware      │ v1.0.0-r4
```

**Automated Self Test** (runs on tab entry):
Button [▶ RUN ALL] | [✕ Clear]

14 test items displayed as PASS/FAIL lines:
```
[PASS] MCP23017 #1 (0x20)  — I2C OK
[PASS] MCP23017 #2 (0x21)  — I2C OK
[PASS] IR Sensors 1-8      — All CLEAR
[PASS] IR Sensors 9-10     — All CLEAR
[PASS] Relay bank 1-10     — Continuity OK (50ms pulse)
[PASS] Door lock R12       — Solenoid OK
[PASS] Water pump R11      — Flow OK
[PASS] WS2812B LEDs        — 40px respond
[PASS] Display 800×480     — Running OK
[PASS] GT911 Touch         — Last touch: 2s ago
[PASS] NVS Flash           — device_id present
[PASS] WiFi link           — Connected
[PASS] Backend /health     — fake_omise mode
[PASS] Temperature         — 40°C < 70°C limit
```

**Backend PING** button → GET /health → shows payment_mode in result area

**Log area**: monospace 8pt, dark bg, max 8 lines, scrollable, auto-scroll on new entry

---

### TAB 2: FREE PLAY

**Lane motor grid**: matches idle grid layout (same R/Out config + A/B/C tabs if needed)
Button labels: name_en from g_slots[], or "Lane N" if unconfigured
Tap button → fires selected motor mode

**Motor mode row**:
```
[● PULSE]  [HOLD]  [SLOW]
```
- PULSE: relay ON for VEND_PULSE_MS (800ms), auto-off — good for one item drop
- HOLD: relay ON while finger on button, OFF on release — good for jam clearing
- SLOW: 3× pulse with 500ms gap — good for stuck spring diagnosis

**Special devices row**:
```
[💧 Water Pump (hold)]  [🚪 Door Lock Toggle]  [▶ Run All Lanes]
```
- Water pump: hold = ON, release = OFF
- Door lock: toggle state, shows LOCKED / UNLOCKED
- Run all lanes: sequential PULSE on all active lanes, 1s gap, skips disabled

**IR sensor live display** (updates every 500ms):
```
IR1[CLEAR] IR2[CLEAR] IR3[BLOCK] IR4[CLEAR] IR5[CLEAR]
IR6[CLEAR] IR7[CLEAR] IR8[CLEAR] IR9[CLEAR] IR10[CLR]
```
Green = CLEAR, Red = BLOCK

**Free play log**: last 5 actions, monospace
```
[12:34:05] Lane A3 PULSE fired
[12:34:06] IR3: BLOCK → CLEAR  (drop OK)
[12:34:10] Door lock → UNLOCKED
```

---

### TAB 3: DEVICES

**Relay control grid** (12 buttons):
```
[R1 ON ] [R2 OFF] [R3 OFF] [R4 OFF] [R5 OFF] [R6 OFF]
[R7 OFF] [R8 OFF] [R9 OFF] [R10 OFF] [PUMP OFF] [DOOR LOCK]
```
Green=ON, Red=OFF. Tap to toggle. No auto-off — WARNING banner shown.

**IR sensor matrix** (live, 500ms update):
10 indicators. Same layout as FREE PLAY IR section.

**LED zone control**:
```
Zone:    [TOP]  [FLOOR1]  [FLOOR2]  [DOOR]  [ALL]
Colour:  [GOLD] [GREEN] [BLUE] [RED] [WHITE] [OFF]
Brightness: ──────●──── 128
Patterns: [Idle Gold] [Celebrate] [Error Flash]
```

**I2C bus scanner**:
```
[SCAN BUS] → Found: 0x20 (MCP1), 0x21 (MCP2), 0x5D (GT911)
```

---

### TAB 4: SETTINGS

**Network** (reboot required to apply):
```
WiFi SSID     [Jaydahome2.4G          ]
WiFi Password [••••••••               ]
              [Save WiFi + Reboot]
```

**Security**:
```
Service PIN      [1234]  [Save PIN]
PIN on svc entry [ON ●──]
PIN on startup   [OFF ──●]
```

**Display**:
```
Screen theme  [Dark Gold ▾]    [Apply on reboot]
Language      [EN | TH]        (TH = placeholder in R4)
```

**Donation features**:
```
Sacred water    [ON ●──]
Lucky number    [ON ●──]
Idle timeout    [60s ▾]   options: 30 / 60 / 120 / 300
Select timeout  [15s ▾]   options: 5 / 10 / 15 / 30
```

**Actions**:
```
[💾 Save All to NVS]          ← green, prominent

[⚠ Factory Reset]             ← red, requires PIN confirmation
  "Type your service PIN to confirm factory reset"
  Calls /v1/machine/factory-reset (requires network)
  Only wipes NVS on HTTP 200 response
```

---

### TAB 5: FIRMWARE

**Device info**:
```
Firmware version  v1.0.0-r4
Build date        2026-06-01
Board             ESP32-8048S070C
Flash             16MB
PSRAM             8MB OPI
MAC address       3C:DC:75:5D:DD:2C
```

**Security status**:
```
Flash Encryption  DISABLED (dev mode)
Secure Boot V2    DISABLED (dev mode)
JTAG              ENABLED  ← burn eFuse before production
```

**OTA** (stub):
```
[🔄 Check Update]   → logs "OTA not yet implemented"
[⚡ Force OTA]      → logs "OTA not yet implemented"
```

**Debug / Recovery**:
```
[Show Debug Info]   → shows MAC + device_id + setup_code (same as gesture)
[Print to Serial]   → Serial.println(device_id + MAC + FW)
```

---

## NVS Key Reference (complete — do not add keys not in this list)

| Key | Type | Max len | Default | Description |
|-----|------|---------|---------|-------------|
| `device_id` | String | 15 | — | Assigned by backend |
| `dev_secret` | String | 64 | — | Device secret, never shown |
| `svc_pin` | String | 4 | 1234 | Service mode PIN |
| `svc_pin_en` | Bool | — | true | Require PIN to enter service |
| `boot_pin` | Bool | — | false | Require PIN on daily startup |
| `cfg_idle` | Int | — | 60 | Idle timeout seconds |
| `cfg_sel` | Int | — | 15 | Selection timeout seconds |
| `cfg_water` | Bool | — | true | Sacred water feature enabled |
| `cfg_lucky` | Bool | — | true | Lucky number feature enabled |
| `nvs_ssid` | String | 32 | — | WiFi SSID (NVS override) |
| `nvs_pass` | String | 64 | — | WiFi password (NVS override) |
| `nvs_grow` | Int | — | 2 | Grid rows (cached from /hello) |
| `nvs_gcol` | Int | — | 5 | Grid cols (cached from /hello) |
| `scr_theme` | String | 10 | dark_gold | Screen theme |
| `lang` | String | 2 | EN | Language selector |

ESP32 NVS rule: namespace `satu` + key must each be ≤15 chars independently. All keys above are safe.
