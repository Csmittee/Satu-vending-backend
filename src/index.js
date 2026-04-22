import { handleMachineHello, handleHeartbeat, handleGetCommands } from './handlers/machine.js';
import { handleCreateOrder, handleGetOrderStatus } from './handlers/order.js';
import { handleOmiseWebhook } from './handlers/webhook.js';
import { handleDisableDevice, handleEnableDevice, handleReassignDevice, handleGetAllDevices } from './handlers/admin.js';
import { handleGetUserDevices } from './handlers/dashboard.js';
import { handleLogin, handleRegister, handleAdminResetPassword } from './handlers/authHandler.js';
import { authenticateJWT, requireAdmin } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { logRequest } from './middleware/logging.js';

// ════════════════════════════════════════════════════════════════════════════
//  CORS
//  All HTML pages are served from api.janishammer.com (same origin as the API)
//  via Cloudflare Static Assets (wrangler.toml [assets]).
//  CORS headers are kept for:
//    - The ESP32 firmware (it uses HTTPClient, not a browser, so no CORS — but
//      adding headers does no harm)
//    - Any future external integrations (Satu 2.0 portal on a different domain)
//    - The Omise webhook (comes from Omise servers)
//
//  ALLOWED_ORIGINS: lock this down to your actual domains in production.
// ════════════════════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = [
    'https://api.janishammer.com',
    'https://janishammer.com',
    'http://localhost:8787',   // wrangler dev
    'http://127.0.0.1:8787',
];

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin':      allowed,
        'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Device-Secret, X-Admin-Token',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age':           '86400',
    };
}

function withCors(response, request) {
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
    // ════════════════════════════════════════════════════════════════════════
    //  HTTP HANDLER
    // ════════════════════════════════════════════════════════════════════════
    async fetch(request, env, ctx) {
        const url    = new URL(request.url);
        const path   = url.pathname;
        const method = request.method;

        // ── CORS preflight (OPTIONS) — must return 200 before any auth ───────
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(request) });
        }

        // Non-blocking logging
        ctx.waitUntil(logRequest(request, env));

        // ── Public health check ──────────────────────────────────────────────
        if (path === '/health' && method === 'GET') {
            return withCors(Response.json({
                status: 'ok',
                timestamp: Date.now(),
                environment: env.ENVIRONMENT || 'production',
                payment_mode: env.PAYMENT_MODE || 'fake'
            }), request);
        }

        if (path === '/' && method === 'GET') {
            return withCors(Response.json({
                service: 'Satu API',
                status: 'running',
                endpoints: ['GET /health', 'POST /v1/machine/hello', 'POST /v1/order', 'GET /v1/machine/commands'],
                pages: ['GET /simulator.html', 'GET /satu-system-tester.html', 'GET /satu-machine-tester.html']
            }), request);
        }

        // ── Static HTML pages ────────────────────────────────────────────────
        // Served from public/ via Cloudflare Assets (wrangler.toml [assets]).
        // These routes below are LEGACY FALLBACKS only — they redirect to the
        // asset URL so existing bookmarks still work.
        // Primary access: api.janishammer.com/simulator.html (served by Assets directly)
        //
        // If you haven't migrated to [assets] yet, these fetch from the local
        // ASSETS binding instead of GitHub (supply-chain safe).
        if ((path === '/test' || path === '/simulator' || path === '/sim') && method === 'GET') {
            return Response.redirect(url.origin + '/satu-system-tester.html', 302);
        }
        if (path === '/demo' && method === 'GET') {
            return Response.redirect(url.origin + '/satu-machine-tester.html', 302);
        }
        if (path === '/machine' && method === 'GET') {
            return Response.redirect(url.origin + '/simulator.html', 302);
        }

        // ── Omise Webhook (public — signature verified inside) ───────────────
        if (path === '/v1/webhook/omise' && method === 'POST') {
            return withCors(await handleOmiseWebhook(request, env), request);
        }

        // ── Machine endpoints (device-secret authenticated inside handlers) ──
        if (path === '/v1/machine/hello' && method === 'POST') {
            return withCors(await handleMachineHello(request, env), request);
        }

        if (path === '/v1/machine/heartbeat' && method === 'POST') {
            return withCors(await handleHeartbeat(request, env), request);
        }

        if (path === '/v1/machine/commands' && method === 'GET') {
            return withCors(await handleGetCommands(request, env), request);
        }

        // ── Auth (rate limited — prevents brute force login) ─────────────────
        if (path === '/v1/auth/login' && method === 'POST') {
            return withCors(await rateLimit(request, env, async () => handleLogin(request, env)), request);
        }

        if (path === '/v1/auth/register' && method === 'POST') {
            return withCors(await rateLimit(request, env, async () => handleRegister(request, env)), request);
        }

        if (path === '/v1/auth/reset-password' && method === 'POST') {
            return withCors(await handleAdminResetPassword(request, env), request);
        }

        // ── Order (rate limited) ─────────────────────────────────────────────
        if (path === '/v1/order' && method === 'POST') {
            return withCors(await rateLimit(request, env, async () => handleCreateOrder(request, env)), request);
        }

        if (path.match(/^\/v1\/order\/.+\/status$/) && method === 'GET') {
            const orderId = path.split('/')[3];
            return withCors(await handleGetOrderStatus(orderId, env), request);
        }

        // ════════════════════════════════════════════════════════════════════
        //  ADMIN DASHBOARD
        //  Requires X-Admin-Token header matching ADMIN_SECRET env secret.
        //  Access: curl -H "X-Admin-Token: YOUR_SECRET" https://api.janishammer.com/admin
        // ════════════════════════════════════════════════════════════════════
        const ADMIN_PATH = env.ADMIN_PATH || '/admin';

        if (path === ADMIN_PATH || path.startsWith(ADMIN_PATH + '/api/')) {
            const providedToken = request.headers.get('X-Admin-Token');
            if (!env.ADMIN_SECRET || !providedToken || providedToken !== env.ADMIN_SECRET) {
                return new Response('Forbidden', { status: 403 });
            }

            if (method === 'GET' && path === ADMIN_PATH) {
                return withCors(await handleAdminDashboard(env, ADMIN_PATH), request);
            }

            if (method === 'GET' && path.startsWith(ADMIN_PATH + '/api/')) {
                const tableName = path.split('/').pop();
                return withCors(await handleAdminTableData(tableName, env), request);
            }
        }

        // ── JWT-protected routes ─────────────────────────────────────────────
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }), request);
        }

        if (path === '/v1/dashboard/devices' && method === 'GET') {
            return withCors(await handleGetUserDevices(auth.userId, env), request);
        }

        if (path === '/v1/admin/device/disable' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return withCors(Response.json({ error: 'Admin required' }, { status: 403 }), request);
            return withCors(await handleDisableDevice(request, env, auth.userId), request);
        }

        if (path === '/v1/admin/device/enable' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return withCors(Response.json({ error: 'Admin required' }, { status: 403 }), request);
            return withCors(await handleEnableDevice(request, env, auth.userId), request);
        }

        if (path === '/v1/admin/device/reassign' && method === 'POST') {
            if (!await requireAdmin(auth.userId, env)) return withCors(Response.json({ error: 'Admin required' }, { status: 403 }), request);
            return withCors(await handleReassignDevice(request, env, auth.userId), request);
        }

        if (path === '/v1/admin/devices' && method === 'GET') {
            if (!await requireAdmin(auth.userId, env)) return withCors(Response.json({ error: 'Admin required' }, { status: 403 }), request);
            return withCors(await handleGetAllDevices(request, env), request);
        }

        return withCors(Response.json({ error: 'Not found' }, { status: 404 }), request);
    },

    // ════════════════════════════════════════════════════════════════════════
    //  CRON HANDLER
    // ════════════════════════════════════════════════════════════════════════
    async scheduled(event, env, ctx) {
        ctx.waitUntil(runScheduledJobs(event, env));
    }
};

// ════════════════════════════════════════════════════════════════════════════
//  SCHEDULED JOBS
// ════════════════════════════════════════════════════════════════════════════
async function runScheduledJobs(event, env) {
    const now = Math.floor(Date.now() / 1000);
    console.log(`[cron] Scheduled trigger fired at ${now} (cron: ${event.cron})`);
    await Promise.allSettled([
        expireStaleOrders(env, now),
        cleanupRateLimitCounters(env, now)
    ]);
}

async function expireStaleOrders(env, now) {
    const logId = await startCronLog(env, 'expire_orders', now);
    try {
        const cutoff = now - (30 * 60);
        const result = await env.DB.prepare(`
            UPDATE orders SET status = 'expired'
            WHERE status = 'pending' AND created_at < ?
        `).bind(cutoff).run();
        const rowsAffected = result.meta?.changes ?? 0;
        console.log(`[cron] expire_orders: ${rowsAffected} orders expired`);
        await finishCronLog(env, logId, 'ok', rowsAffected);
    } catch (err) {
        console.error('[cron] expire_orders failed:', err.message);
        await finishCronLog(env, logId, 'error', 0, err.message);
    }
}

async function cleanupRateLimitCounters(env, now) {
    const logId = await startCronLog(env, 'cleanup_rate_limits', now);
    try {
        const cutoffWindowKey = Math.floor(now / 60) - 5;
        const result = await env.DB.prepare(`
            DELETE FROM rate_limit_counters WHERE window_key < ?
        `).bind(cutoffWindowKey).run();
        const rowsAffected = result.meta?.changes ?? 0;
        console.log(`[cron] cleanup_rate_limits: ${rowsAffected} rows deleted`);
        await finishCronLog(env, logId, 'ok', rowsAffected);
    } catch (err) {
        console.error('[cron] cleanup_rate_limits failed:', err.message);
        await finishCronLog(env, logId, 'error', 0, err.message);
    }
}

async function startCronLog(env, jobName, now) {
    try {
        const result = await env.DB.prepare(`
            INSERT INTO cron_log (job_name, started_at, status) VALUES (?, ?, 'running')
        `).bind(jobName, now).run();
        return result.meta?.last_row_id ?? null;
    } catch { return null; }
}

async function finishCronLog(env, logId, status, rowsAffected, errorMsg = null) {
    if (!logId) return;
    try {
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`
            UPDATE cron_log SET finished_at = ?, status = ?, rows_affected = ?, error_msg = ? WHERE id = ?
        `).bind(now, status, rowsAffected, errorMsg, logId).run();
    } catch {}
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function escapeJson(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\//g, '\\u002f');
}

async function handleAdminDashboard(env, adminPath) {
    const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
    const tableNames = tables.results.map(t => t.name);

    const [orders, devices, users, todayOrders] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as count FROM orders`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM devices`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first(),
        env.DB.prepare(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount)/100, 0) as total
            FROM orders
            WHERE status='paid' AND created_at > strftime('%s','now','-1 day')
        `).first()
    ]);

    const recentOrders = await env.DB.prepare(`
        SELECT order_id, device_id, amount/100 as amount, status,
               datetime(created_at, 'unixepoch', '+7 hours') as created
        FROM orders ORDER BY created_at DESC LIMIT 20
    `).all();

    const recentDevices = await env.DB.prepare(`
        SELECT device_id, temple_name, status,
               datetime(last_heartbeat, 'unixepoch', '+7 hours') as last_seen
        FROM devices ORDER BY last_heartbeat DESC LIMIT 20
    `).all();

    const adminPathJson     = escapeJson(adminPath);
    const tableNamesJson    = escapeJson(tableNames);
    const recentOrdersJson  = escapeJson(recentOrders.results  || []);
    const recentDevicesJson = escapeJson(recentDevices.results || []);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satu Admin</title>
    <style>
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
        .status-active { color: #10b981; } .status-pending { color: #f59e0b; }
        .status-disabled { color: #ef4444; } .status-paid { color: #10b981; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
        .auth-note { background: #10b98115; border: 1px solid #10b981; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; font-size: 13px; color: #10b981; }
        .pages-note { background: #667eea15; border: 1px solid #667eea; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; font-size: 13px; color: #667eea; }
        .pages-note a { color: #667eea; }
    </style>
</head>
<body>
<div class="container">
    <h1>🔐 Satu Admin</h1>
    <div class="subtitle">System Dashboard</div>
    <div class="auth-note">✅ Authenticated via X-Admin-Token header</div>
    <div class="pages-note">
      📺 <a href="/simulator.html" target="_blank">Machine Simulator</a> &nbsp;|&nbsp;
      🧪 <a href="/satu-system-tester.html" target="_blank">System Tester</a> &nbsp;|&nbsp;
      🎮 <a href="/satu-machine-tester.html" target="_blank">Machine Tester</a>
    </div>

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
    function h(str) { return String(str ?? '-').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function renderRecentOrders() {
        const c = document.getElementById('recent-orders');
        if (!recentOrders.length) { c.innerHTML = '<p>No orders yet</p>'; return; }
        c.innerHTML = '<table><thead><tr><th>Order ID</th><th>Device</th><th>Amount</th><th>Status</th><th>Time (UTC+7)</th></tr></thead><tbody>'
            + recentOrders.map(o => \`<tr><td>\${h(o.order_id)}</td><td>\${h(o.device_id)}</td><td>\${h(o.amount)} THB</td><td class="status-\${h(o.status)}">\${h(o.status)}</td><td>\${h(o.created)}</td></tr>\`).join('')
            + '</tbody></table>';
    }
    function renderRecentDevices() {
        const c = document.getElementById('recent-devices');
        if (!recentDevices.length) { c.innerHTML = '<p>No devices yet</p>'; return; }
        c.innerHTML = '<table><thead><tr><th>Device ID</th><th>Temple</th><th>Status</th><th>Last Seen (UTC+7)</th></tr></thead><tbody>'
            + recentDevices.map(d => \`<tr><td>\${h(d.device_id)}</td><td>\${h(d.temple_name)}</td><td class="status-\${h(d.status)}">\${h(d.status)}</td><td>\${h(d.last_seen)}</td></tr>\`).join('')
            + '</tbody></table>';
    }
    function renderTabs() {
        const tabsDiv = document.getElementById('tabs');
        tabsDiv.innerHTML = tableNames.map(name => \`<button class="tab" onclick="showTab('\${h(name)}')">\${h(name)}</button>\`).join('');
        if (tableNames.length > 0) showTab(tableNames[0]);
    }
    async function showTab(tableName) {
        const c = document.getElementById('table-content');
        c.innerHTML = '<div class="table-container">Loading...</div>';
        const token = sessionStorage.getItem('adminToken') || prompt('Enter Admin Token:');
        if (token) sessionStorage.setItem('adminToken', token);
        try {
            const res = await fetch(ADMIN_PATH + '/api/' + tableName, { headers: { 'X-Admin-Token': token } });
            if (res.status === 403) { sessionStorage.removeItem('adminToken'); c.innerHTML = '<p style="color:#ef4444;">❌ Invalid token</p>'; return; }
            const data = await res.json();
            if (!data || data.length === 0) { c.innerHTML = '<p>No data found</p>'; return; }
            let html = '<div class="table-container"><table><thead><tr>';
            Object.keys(data[0]).forEach(key => { html += \`<th>\${h(key)}</th>\`; });
            html += '</tr></thead><tbody>';
            data.forEach(row => { html += '<tr>'; Object.values(row).forEach(val => { const display = typeof val === 'object' ? JSON.stringify(val) : val; html += \`<td>\${h(String(display ?? '-').substring(0, 100))}</td>\`; }); html += '</tr>'; });
            html += '</tbody></table></div>';
            c.innerHTML = html;
        } catch(e) { c.innerHTML = '<p style="color:#ef4444;">Error loading data</p>'; }
    }
    renderRecentOrders(); renderRecentDevices(); renderTabs();
</script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN TABLE DATA
// ════════════════════════════════════════════════════════════════════════════
async function handleAdminTableData(tableName, env) {
    const validTables = [
        'users', 'devices', 'orders', 'setup_codes', 'donor_consent',
        'data_access_log', 'device_commands', 'admin_log', 'ownership_log',
        'connection_logs', 'firmware_versions', 'test_payments',
        'rate_limit_counters', 'cron_log'
    ];
    if (!validTables.includes(tableName)) {
        return Response.json({ error: 'Invalid table' }, { status: 400 });
    }
    const data = await env.DB.prepare(`SELECT * FROM ${tableName} ORDER BY rowid DESC LIMIT 200`).all();
    return Response.json(data.results);
}
