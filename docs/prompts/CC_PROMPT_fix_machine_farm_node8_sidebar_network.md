# CC_PROMPT_fix_machine_farm_node8_sidebar_network.md
> ✅ COMPLETE — 2026-06-13
> Branch: claude/vibrant-cray-cqp2em
> Commit: fix: node8 fresh order + sidebar layout + network view tab
> File changed: public/satu-machine-tester.html ONLY

## What was done

### Fix 1 — Node 8 Idempotency (DONE)
Node 8 now creates its own fresh POST /v1/order before testing.
Fresh order_id and charge_id are used for both webhook fires.
Polls for freshOrderId only — not reusing Node 3's already-dispensed order.
pass = count===1 | fail = count===0 or count>1.
Fresh order_id shown in expandable node detail.

### Fix 2 — Arrow Connectors (DONE)
Replaced invisible 2px `.node-arrow` div with `.node-connector` containing:
- `.connector-line` — 2px × 16px vertical bar
- `.connector-head` — CSS border-trick ▼ triangle (12px wide)
Colors: #2e2e3a pending → #2d6a31 green pass → #7a1a1a red fail/skip.

### Fix 3 — Sidebar + Tabs (DONE)
- 200px sidebar: "SATU" gold title, "Machine Farm" grey subtitle, two nav items.
- Active nav item: gold left border + #12131a background.
- Section A (Single Flow Test) = default on page load.
- Section B (Machine Fleet) has two tabs:
  - Stress Test — unchanged content
  - Network View — SVG canvas, machine nodes (left) → Backend API (center-left)
    → D1 (center-below) + Payment GW / Webhook / Cmd Queue (right).
    Lines animate (stroke-dashoffset CSS) during Fire All; settle green/red.
    Heartbeat opacity pulse every 3s on all nodes.
- Activity Log stays full-width at viewport bottom.

## Verification checklist
- [x] Node 8 creates fresh order — independent of Node 3
- [x] Arrow connectors visible between all 8 nodes
- [x] Sidebar with 2 nav items + gold active state
- [x] Section A default on load
- [x] Section B → 2 tabs: Stress Test + Network View
- [x] Network View: machine + backend + D1 + services connected by lines
- [x] Lines animate when Fire All runs
- [x] PAYMENT_MODE = fake throughout
- [x] No src/ files touched
- [x] No CSS colors/fonts/theme changed — layout only
