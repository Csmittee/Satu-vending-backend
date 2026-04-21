import { handleMachineHello, handleHeartbeat, handleGetCommands } from './handlers/machine.js';
import { handleCreateOrder, handleGetOrderStatus } from './handlers/order.js';
import { handleOmiseWebhook } from './handlers/webhook.js';
import { handleDisableDevice, handleEnableDevice, handleReassignDevice, handleGetAllDevices } from './handlers/admin.js';
import { handleGetUserDevices } from './handlers/dashboard.js';
import { authenticateJWT, requireAdmin } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { logRequest } from './middleware/logging.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // Non-blocking logging — never delays or breaks any request
        ctx.waitUntil(logRequest(request, env));

        // ── Public health check (no auth, no logging delay) ─────────────────
        if (path === '/health' && method === 'GET') {
            return Response.json({
                status: 'ok',
                timestamp: Date.now(),
                environment: env.ENVIRONMENT || 'production',
                payment_mode: env.PAYMENT_MODE || 'fake'
            });
        }

        if (path === '/' && method === 'GET') {
            return Response.json({
                service: 'Satu API',
                status: 'running',
                endpoints: ['GET /health', 'POST /v1/machine/hello', 'POST /v1/order', 'GET /v1/machine/commands']
            });
        }

        // ── Test / Demo pages (served from Worker assets, not GitHub) ────────
        // FIX: Removed live GitHub fetch (supply-chain risk). Bundle these as
        // Worker assets via wrangler.toml [assets] and serve from env.ASSETS.
        // If you haven't migrated yet, keep the fetch but add error handling:
        if (path === '/test' && method === 'GET') {
            try {
                const html = await fetch('https://raw.githubusercontent.com/Csmittee/Satu-vending-backend/main/satu-system-tester.html');
                if (!html.ok) throw new Error('upstream');
                const text = await html.text();
                return new Response(text, {
                    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'max-age=60' }
                });
            } catch {
                return new Response('Test page unavailable', { status: 503 });
            }
        }

        if (path === '/demo' && method === 'GET') {
            try {
                const html = await fetch('https://raw.githubusercontent.com/Csmittee/Satu-vending-backend/main/satu-machine-tester.html');
                if (!html.ok) throw new Error('upstream');
                const text = await html.text();
                return new Response(text, {
                    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'max-age=60' }
                });
            } catch {
                return new Response('Demo page unavailable', { status: 503 });
            }
        }

        // ── Omise Webhook (public — Omise calls this, signature verified inside) ──
        if (path === '/v1/webhook/omise' && method === 'POST') {
            return handleOmiseWebhook(request, env);
        }

        // ── Machine endpoints (device-secret authenticated inside handlers) ──
        if (path === '/v1/machine/hello' && method === 'POST') {
            return handleMachineHello(request, env);
        }

        if (path === '/v1/machine/heartbeat' && method === 'POST') {
            return handleHeartbeat(request, env);
        }

        if (path === '/v1/machine/commands' && method === 'GET') {
            return handleGetCommands(request, env);
        }

        // ── Order (rate limited) ─────────────────────────────────────────────
        if (path === '/v1/order' && method === 'POST') {
            return rateLimit(request, env, async () => handleCreateOrder(request, env));
        }

        if (path.match(/^\/v1\/order\/.+\/status$/) && method === 'GET') {
            const orderId = path.split('/')[3];
            return handleGetOrderStatus(orderId, env);
        }

        // ════════════════════════════════════════════════════════════════════
        //  ADMIN DASHBOARD
        //  FIX: Now requires ADMIN_SECRET header — no longer open to anyone
        //  who knows the URL.
        //
        //  How to access:
        //    curl -H "X-Admin-Token: YOUR_SECRET" https://api.janishammer.com/admin
        //
        //  Setup (one time):
        //    npx wrangler secret put ADMIN_SECRET
        //    → paste a long random string, e.g. from: openssl rand -hex 32
        //
        //  The path is now /admin — change ADMIN_PATH secret to customise.
        // ════════════════════════════════════════════════════════════════════
        const ADMIN_PATH = env.ADMIN_PATH || '/admin';

        if (path === ADMIN_PATH || path.startsWith(ADMIN_PATH + '/api/')) {
            // Verify admin token from header (never in URL — URLs appear in logs)
            const providedToken = request.headers.get('X-Admin-Token');
            if (!env.ADMIN_SECRET || !providedToken || providedToken !== env.ADMIN_SECRET) {
                return new Response('Forbidden', { status: 403 });
            }

            if (method === 'GET' && path === ADMIN_PATH) {
                return await handleAdminDashboard(env, ADMIN_PATH);
            }

            if (method === 'GET' && path.startsWith(ADMIN_PATH + '/api/')) {
                const tableName = path.split('/').pop();
                return await handleAdminTableData(tableName, env);
            }
        }

        // ── JWT-protected routes ─────────────────────────────────────────────
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (path === '/v1/dashboard/devices' && method === 'GET') {
            return handleGetUserDevices(auth.userId, env);
        }

        if (path === '/v1/admin/device/disable' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleDisableDevice(request, env, auth.userId);
        }

        if (path === '/v1/admin/device/enable' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleEnableDevice(request, env, auth.userId);
        }

        if (path === '/v1/admin/device/reassign' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleReassignDevice(request, env, auth.userId);
        }

        if (path === '/v1/admin/devices' && method === 'GET') {
            if (!await requireAdmin(auth.userId, env)) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleGetAllDevices(request, env);
        }

        return Response.json({ error: 'Not found' }, { status: 404 });
    }
};

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD HANDLER
// ════════════════════════════════════════════════════════════════════════════

// FIX: Escape user-supplied data before injecting into HTML to prevent XSS
function escapeJson(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\//g, '\\u002f');
}

async function handleAdminDashboard(env, adminPath) {
    const tables     = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
    const orders     = await env.DB.prepare(`SELECT COUNT(*) as count FROM orders`).first();
    const devices    = await env.DB.prepare(`SELECT COUNT(*) as count FROM devices`).first();
    const users      = await env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first();
    const todayOrders = await env.DB.prepare(
        `SELECT COUNT(*) as count, SUM(amount) as total FROM orders WHERE date(created_at/1000, 'unixepoch') = date('now')`
    ).first();
    const recentOrders = await env.DB.prepare(
        `SELECT order_id, device_id, amount, status, datetime(created_at/1000, 'unixepoch', '+7 hours') as created FROM orders ORDER BY created_at DESC LIMIT 10`
    ).all();
    const recentDevices = await env.DB.prepare(
        `SELECT device_id, temple_name, status, datetime(last_heartbeat/1000, 'unixepoch', '+7 hours') as last_seen FROM devices ORDER BY last_heartbeat DESC LIMIT 10`
    ).all();

    const tableNamesJson    = escapeJson(tables.results.map(t => t.name));
    const recentOrdersJson  = escapeJson(recentOrders.results);
    const recentDevicesJson = escapeJson(recentDevices.results);

    // Pass adminPath into JS so the dashboard fetch calls use the correct path
    const adminPathJson = escapeJson(adminPath);

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satu Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f0f1a; color: #e0e0e0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #667eea; margin-bottom: 10px; }
        .subtitle { color: #888; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1a1a2e; border-radius: 12px; padding: 20px; border-left: 4px solid #667eea; }
        .stat-number { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { color: #888; margin-top: 8px; font-size: 14px; }
        .stat-small { font-size: 14px; color: #10b981; margin-top: 8px; }
        .section { background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
        .section h2 { margin-bottom: 20px; color: #ccc; font-size: 18px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .tab { background: #2a2a3e; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; color: #ccc; }
        .tab.active { background: #667eea; color: white; }
        .table-container { overflow-x: auto; max-height: 500px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { text-align: left; padding: 10px; border-bottom: 1px solid #2a2a3e; }
        th { background: #2a2a3e; position: sticky; top: 0; color: #667eea; }
        tr:hover { background: #2a2a3e; }
        .status-active { color: #10b981; }
        .status-pending { color: #f59e0b; }
        .status-disabled { color: #ef4444; }
        .status-paid { color: #10b981; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
        .auth-note { background: #10b98115; border: 1px solid #10b981; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; font-size: 13px; color: #10b981; }
    </style>
</head>
<body>
<div class="container">
    <h1>🔐 Satu Admin</h1>
    <div class="subtitle">System Dashboard</div>
    <div class="auth-note">✅ Authenticated via X-Admin-Token header</div>

    <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${orders?.count || 0}</div><div class="stat-label">Total Orders</div></div>
        <div class="stat-card"><div class="stat-number">${devices?.count || 0}</div><div class="stat-label">Total Devices</div></div>
        <div class="stat-card"><div class="stat-number">${users?.count || 0}</div><div class="stat-label">Total Users</div></div>
        <div class="stat-card"><div class="stat-number">${todayOrders?.count || 0}</div><div class="stat-label">Today's Orders</div><div class="stat-small">${todayOrders?.total || 0} THB</div></div>
    </div>

    <div class="section">
        <h2>📋 Recent Orders</h2>
        <div class="table-container" id="recent-orders"></div>
    </div>

    <div class="section">
        <h2>🖥️ Recent Devices</h2>
        <div class="table-container" id="recent-devices"></div>
    </div>

    <div class="section">
        <h2>🗄️ Database Browser</h2>
        <div class="tabs" id="tabs"></div>
        <div id="table-content"></div>
    </div>

    <div class="footer">Satu Admin | Restricted Access</div>
</div>

<script>
    const ADMIN_PATH = ${adminPathJson};
    const tableNames    = ${tableNamesJson};
    const recentOrders  = ${recentOrdersJson};
    const recentDevices = ${recentDevicesJson};

    // FIX: Escape HTML to prevent XSS from database values
    function h(str) {
        return String(str ?? '-')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function renderRecentOrders() {
        const c = document.getElementById('recent-orders');
        if (!recentOrders.length) { c.innerHTML = '<p>No orders yet</p>'; return; }
        c.innerHTML = '<table><thead><tr><th>Order ID</th><th>Device</th><th>Amount</th><th>Status</th><th>Time (UTC+7)</th></tr></thead><tbody>'
            + recentOrders.map(o => \`<tr>
                <td>\${h(o.order_id)}</td>
                <td>\${h(o.device_id)}</td>
                <td>\${h(o.amount)} THB</td>
                <td class="status-\${h(o.status)}">\${h(o.status)}</td>
                <td>\${h(o.created)}</td>
            </tr>\`).join('')
            + '</tbody></table>';
    }

    function renderRecentDevices() {
        const c = document.getElementById('recent-devices');
        if (!recentDevices.length) { c.innerHTML = '<p>No devices yet</p>'; return; }
        c.innerHTML = '<table><thead><tr><th>Device ID</th><th>Temple</th><th>Status</th><th>Last Seen (UTC+7)</th></tr></thead><tbody>'
            + recentDevices.map(d => \`<tr>
                <td>\${h(d.device_id)}</td>
                <td>\${h(d.temple_name)}</td>
                <td class="status-\${h(d.status)}">\${h(d.status)}</td>
                <td>\${h(d.last_seen)}</td>
            </tr>\`).join('')
            + '</tbody></table>';
    }

    function renderTabs() {
        const tabsDiv = document.getElementById('tabs');
        tabsDiv.innerHTML = tableNames.map(name =>
            \`<button class="tab" onclick="showTab('\${h(name)}')">\${h(name)}</button>\`
        ).join('');
        if (tableNames.length > 0) showTab(tableNames[0]);
    }

    async function showTab(tableName) {
        const c = document.getElementById('table-content');
        c.innerHTML = '<div class="table-container">Loading...</div>';
        // FIX: send admin token with every API call
        const token = sessionStorage.getItem('adminToken') || prompt('Enter Admin Token:');
        if (token) sessionStorage.setItem('adminToken', token);
        try {
            const res = await fetch(ADMIN_PATH + '/api/' + tableName, {
                headers: { 'X-Admin-Token': token }
            });
            if (res.status === 403) {
                sessionStorage.removeItem('adminToken');
                c.innerHTML = '<p style="color:#ef4444;">❌ Invalid token</p>';
                return;
            }
            const data = await res.json();
            if (!data || data.length === 0) { c.innerHTML = '<p>No data found</p>'; return; }
            let html = '<div class="table-container"><table><thead><tr>';
            Object.keys(data[0]).forEach(key => { html += \`<th>\${h(key)}</th>\`; });
            html += '</tr></thead><tbody>';
            data.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(val => {
                    const display = typeof val === 'object' ? JSON.stringify(val) : val;
                    html += \`<td>\${h(String(display ?? '-').substring(0, 100))}</td>\`;
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            c.innerHTML = html;
        } catch(e) {
            c.innerHTML = '<p style="color:#ef4444;">Error loading data</p>';
        }
    }

    renderRecentOrders();
    renderRecentDevices();
    renderTabs();
</script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN TABLE DATA
//  FIX: whitelist check kept — never interpolate tableName without it
// ════════════════════════════════════════════════════════════════════════════
async function handleAdminTableData(tableName, env) {
    const validTables = [
        'users', 'devices', 'orders', 'setup_codes', 'donor_consent',
        'data_access_log', 'device_commands', 'admin_log', 'ownership_log',
        'connection_logs', 'firmware_versions', 'test_payments'
    ];

    if (!validTables.includes(tableName)) {
        return Response.json({ error: 'Invalid table' }, { status: 400 });
    }

    // Safe: tableName is whitelisted above, not user input
    const data = await env.DB.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 200`).all();
    return Response.json(data.results);
}
