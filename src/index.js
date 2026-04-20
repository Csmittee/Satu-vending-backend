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
        
        await logRequest(request, env);
        
        if (path === '/health' && method === 'GET') {
            return Response.json({ 
                status: 'ok', 
                timestamp: Date.now(),
                environment: env.ENVIRONMENT || 'production'
            });
        }
        
        if (path === '/' && method === 'GET') {
            return Response.json({
                service: 'Satu API',
                status: 'running',
                endpoints: ['GET /health', 'POST /v1/machine/hello', 'POST /v1/order', 'GET /v1/machine/commands']
            });
        }
        
        // ADMIN DASHBOARD
        if (path === '/xK9mP2nQ5rT8wY1z' && method === 'GET') {
            return await handleAdminDashboard(env);
        }
        
        // ADMIN API
        if (path.startsWith('/xK9mP2nQ5rT8wY1z/api/') && method === 'GET') {
            const tableName = path.split('/').pop();
            return await handleAdminTableData(tableName, env);
        }
        
        if (path === '/v1/machine/hello' && method === 'POST') {
            return handleMachineHello(request, env);
        }
        
        if (path === '/v1/webhook/omise' && method === 'POST') {
            return handleOmiseWebhook(request, env);
        }
        
        if (path === '/v1/machine/heartbeat' && method === 'POST') {
            return handleHeartbeat(request, env);
        }
        
        if (path === '/v1/machine/commands' && method === 'GET') {
            return handleGetCommands(request, env);
        }
        
        if (path === '/v1/order' && method === 'POST') {
            return rateLimit(request, env, async () => handleCreateOrder(request, env));
        }
        
        if (path.match(/^\/v1\/order\/.+\/status$/) && method === 'GET') {
            const orderId = path.split('/')[3];
            return handleGetOrderStatus(orderId, env);
        }
        
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (path === '/v1/dashboard/devices' && method === 'GET') {
            return handleGetUserDevices(auth.userId, env);
        }
        
        if (path === '/v1/admin/device/disable' && method === 'POST') {
            const adminCheck = await requireAdmin(auth.userId, env);
            if (!adminCheck) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleDisableDevice(request, env, auth.userId);
        }
        
        if (path === '/v1/admin/device/enable' && method === 'POST') {
            const adminCheck = await requireAdmin(auth.userId, env);
            if (!adminCheck) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleEnableDevice(request, env, auth.userId);
        }
        
        if (path === '/v1/admin/device/reassign' && method === 'POST') {
            const adminCheck = await requireAdmin(auth.userId, env);
            if (!adminCheck) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleReassignDevice(request, env, auth.userId);
        }
        
        if (path === '/v1/admin/devices' && method === 'GET') {
            const adminCheck = await requireAdmin(auth.userId, env);
            if (!adminCheck) return Response.json({ error: 'Admin required' }, { status: 403 });
            return handleGetAllDevices(request, env);
        }
        // Serve machine tester
        if (path === '/demo' && method === 'GET') {
            const html = await fetch('https://raw.githubusercontent.com/Csmittee/Satu-vending-backend/main/satu-machine-tester.html');
            const text = await html.text();
            return new Response(text, { headers: { 'Content-Type': 'text/html' } });
        }
        
        // Serve system tester
        if (path === '/test' && method === 'GET') {
            const html = await fetch('https://raw.githubusercontent.com/Csmittee/Satu-vending-backend/main/satu-system-tester.html');
            const text = await html.text();
            return new Response(text, { headers: { 'Content-Type': 'text/html' } });
        }

        
        return Response.json({ error: 'Not found' }, { status: 404 });
    }
};

async function handleAdminDashboard(env) {
    const tables = await env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).all();
    
    const orders = await env.DB.prepare(`SELECT COUNT(*) as count FROM orders`).first();
    const devices = await env.DB.prepare(`SELECT COUNT(*) as count FROM devices`).first();
    const users = await env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first();
    const todayOrders = await env.DB.prepare(
        `SELECT COUNT(*) as count, SUM(amount) as total FROM orders WHERE date(created_at/1000, 'unixepoch') = date('now')`
    ).first();
    
    const recentOrders = await env.DB.prepare(
        `SELECT order_id, device_id, amount, status, datetime(created_at/1000, 'unixepoch', '+7 hours') as created FROM orders ORDER BY created_at DESC LIMIT 10`
    ).all();
    
    const recentDevices = await env.DB.prepare(
        `SELECT device_id, temple_name, status, datetime(last_heartbeat/1000, 'unixepoch', '+7 hours') as last_seen FROM devices ORDER BY last_heartbeat DESC LIMIT 10`
    ).all();
    
    const tableNames = tables.results.map(t => t.name);
    const tableNamesJson = JSON.stringify(tableNames);
    const recentOrdersJson = JSON.stringify(recentOrders.results);
    const recentDevicesJson = JSON.stringify(recentDevices.results);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satu Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f0f1a;
            color: #e0e0e0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #667eea; margin-bottom: 10px; }
        .subtitle { color: #888; margin-bottom: 30px; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .stat-number { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { color: #888; margin-top: 8px; font-size: 14px; }
        .stat-small { font-size: 14px; color: #10b981; margin-top: 8px; }
        .section {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .section h2 { margin-bottom: 20px; color: #ccc; font-size: 18px; }
        .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        .tab {
            background: #2a2a3e;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            color: #ccc;
        }
        .tab.active { background: #667eea; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .table-container {
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        th, td {
            text-align: left;
            padding: 10px;
            border-bottom: 1px solid #2a2a3e;
        }
        th {
            background: #2a2a3e;
            position: sticky;
            top: 0;
            color: #667eea;
        }
        tr:hover { background: #2a2a3e; }
        .status-active { color: #10b981; }
        .status-pending { color: #f59e0b; }
        .status-disabled { color: #ef4444; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Satu Admin</h1>
        <div class="subtitle">System Dashboard - Your Eyes Only</div>
        
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
        
        <div class="footer">Satu Admin | Only accessible to system administrator</div>
    </div>
    
    <script>
        const tableNames = ${tableNamesJson};
        const recentOrders = ${recentOrdersJson};
        const recentDevices = ${recentDevicesJson};
        
        function renderRecentOrders() {
            const container = document.getElementById('recent-orders');
            if (!recentOrders.length) {
                container.innerHTML = '<p>No orders yet</p>';
                return;
            }
            let html = \`<table><thead><tr><th>Order ID</th><th>Device</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead><tbody>\`;
            recentOrders.forEach(o => {
                html += \`<tr>
                    <td>\${o.order_id || '-'}</td>
                    <td>\${o.device_id || '-'}</td>
                    <td>\${o.amount || 0} THB</td>
                    <td class="status-\${o.status}">\${o.status || '-'}</td>
                    <td>\${o.created || '-'}</td>
                </tr>\`;
            });
            html += \`</tbody></table>\`;
            container.innerHTML = html;
        }
        
        function renderRecentDevices() {
            const container = document.getElementById('recent-devices');
            if (!recentDevices.length) {
                container.innerHTML = '<p>No devices yet</p>';
                return;
            }
            let html = \`<table><thead><tr><th>Device ID</th><th>Temple</th><th>Status</th><th>Last Seen</th></tr></thead><tbody>\`;
            recentDevices.forEach(d => {
                html += \`<tr>
                    <td>\${d.device_id || '-'}</td>
                    <td>\${d.temple_name || '-'}</td>
                    <td class="status-\${d.status}">\${d.status || '-'}</td>
                    <td>\${d.last_seen || '-'}</td>
                </tr>\`;
            });
            html += \`</tbody></table>\`;
            container.innerHTML = html;
        }
        
        function renderTabs() {
            const tabsDiv = document.getElementById('tabs');
            let html = '';
            tableNames.forEach((name, i) => {
                html += \`<button class="tab" onclick="showTab('\${name}')">\${name}</button>\`;
            });
            tabsDiv.innerHTML = html;
            if (tableNames.length > 0) showTab(tableNames[0]);
        }
        
        async function showTab(tableName) {
            const contentDiv = document.getElementById('table-content');
            contentDiv.innerHTML = '<div class="table-container">Loading...</div>';
            try {
                const res = await fetch('/xK9mP2nQ5rT8wY1z/api/' + tableName);
                const data = await res.json();
                if (!data || data.length === 0) {
                    contentDiv.innerHTML = '<p>No data found</p>';
                    return;
                }
                let html = '<div class="table-container"><table><thead><tr>';
                Object.keys(data[0]).forEach(key => {
                    html += \`<th>\${key}</th>\`;
                });
                html += '</tr></thead><tbody>';
                data.forEach(row => {
                    html += '<tr>';
                    Object.values(row).forEach(val => {
                        let display = val;
                        if (val === null || val === undefined) display = '-';
                        if (typeof val === 'object') display = JSON.stringify(val);
                        html += \`<td>\${String(display).substring(0, 100)}</td>\`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
                contentDiv.innerHTML = html;
            } catch(e) {
                contentDiv.innerHTML = '<p style="color:#ef4444;">Error loading data</p>';
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

async function handleAdminTableData(tableName, env) {
    const validTables = ['users', 'devices', 'orders', 'setup_codes', 'donor_consent', 
                         'data_access_log', 'device_commands', 'admin_log', 'ownership_log', 
                         'connection_logs', 'firmware_versions', 'test_payments'];
    
    if (!validTables.includes(tableName)) {
        return Response.json({ error: 'Invalid table' }, { status: 400 });
    }
    
    const data = await env.DB.prepare(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 200`).all();
    return Response.json(data.results);
}
