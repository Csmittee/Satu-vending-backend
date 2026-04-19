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
    
    const html = '<!DOCTYPE html>\n' +
'<html>\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>Satu Admin</title>\n' +
'    <style>\n' +
'        * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
'        body {\n' +
'            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
'            background: #0f0f1a;\n' +
'            color: #e0e0e0;\n' +
'            padding: 20px;\n' +
'        }\n' +
'        .container { max-width: 1400px; margin: 0 auto; }\n' +
'        h1 { color: #667eea; margin-bottom: 10px; }\n' +
'        .subtitle { color: #888; margin-bottom: 30px; }\n' +
'        .stats-grid {\n' +
'            display: grid;\n' +
'            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n' +
'            gap: 20px;\n' +
'            margin-bottom: 30px;\n' +
'        }\n' +
'        .stat-card {\n' +
'            background: #1a1a2e;\n' +
'            border-radius: 12px;\n' +
'            padding: 20px;\n' +
'            border-left: 4px solid #667eea;\n' +
'        }\n' +
'        .stat-number {\n' +
'            font-size: 32px;\n' +
'            font-weight: bold;\n' +
'            color: #667eea;\n' +
'        }\n' +
'        .stat-label { color: #888; margin-top: 8px; font-size: 14px; }\n' +
'        .stat-small { font-size: 14px; color: #10b981; margin-top: 8px; }\n' +
'        .section {\n' +
'            background: #1a1a2e;\n' +
'            border-radius: 12px;\n' +
'            padding: 20px;\n' +
'            margin-bottom: 30px;\n' +
'        }\n' +
'        .section h2 { margin-bottom: 20px; color: #ccc; font-size: 18px; }\n' +
'        .tabs {\n' +
'            display: flex;\n' +
'            gap: 8px;\n' +
'            margin-bottom: 20px;\n' +
'            flex-wrap: wrap;\n' +
'        }\n' +
'        .tab {\n' +
'            background: #2a2a3e;\n' +
'            border: none;\n' +
'            padding: 8px 16px;\n' +
'            border-radius: 8px;\n' +
'            cursor: pointer;\n' +
'            color: #ccc;\n' +
'        }\n' +
'        .tab.active { background: #667eea; color: white; }\n' +
'        .tab-content { display: none; }\n' +
'        .tab-content.active { display: block; }\n' +
'        .table-container {\n' +
'            overflow-x: auto;\n' +
'            max-height: 500px;\n' +
'            overflow-y: auto;\n' +
'        }\n' +
'        table {\n' +
'            width: 100%;\n' +
'            border-collapse: collapse;\n' +
'            font-size: 13px;\n' +
'        }\n' +
'        th, td {\n' +
'            text-align: left;\n' +
'            padding: 10px;\n' +
'            border-bottom: 1px solid #2a2a3e;\n' +
'        }\n' +
'        th {\n' +
'            background: #2a2a3e;\n' +
'            position: sticky;\n' +
'            top: 0;\n' +
'            color: #667eea;\n' +
'        }\n' +
'        tr:hover { background: #2a2a3e; }\n' +
'        .status-active { color: #10b981; }\n' +
'        .status-pending { color: #f59e0b; }\n' +
'        .status-disabled { color: #ef4444; }\n' +
'        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }\n' +
'    </style>\n' +
'</head>\n' +
'<body>\n' +
'    <div class="container">\n' +
'        <h1>🔐 Satu Admin</h1>\n' +
'        <div class="subtitle">System Dashboard - Your Eyes Only</div>\n' +
'        <div class="stats-grid">\n' +
'            <div class="stat-card"><div class="stat-number">' + (orders?.count || 0) + '</div><div class="stat-label">Total Orders</div></div>\n' +
'            <div class="stat-card"><div class="stat-number">' + (devices?.count || 0) + '</div><div class="stat-label">Total Devices</div></div>\n' +
'            <div class="stat-card"><div class="stat-number">' + (users?.count || 0) + '</div><div class="stat-label">Total Users</div></div>\n' +
'            <div class="stat-card"><div class="stat-number">' + (todayOrders?.count || 0) + '</div><div class="stat-label">Today\'s Orders</div><div class="stat-small">' + (todayOrders?.total || 0) + ' THB</div></div>\n' +
'        </div>\n' +
'        <div class="section">\n' +
'            <h2>📋 Recent Orders</h2>\n' +
'            <div class="table-container" id="recent-orders"></div>\n' +
'        </div>\n' +
'        <div class="section">\n' +
'            <h2>🖥️ Recent Devices</h2>\n' +
'            <div class="table-container" id="recent-devices"></div>\n' +
'        </div>\n' +
'        <div class="section">\n' +
'            <h2>🗄️ Database Browser</h2>\n' +
'            <div class="tabs" id="tabs"></div>\n' +
'            <div id="table-content"></div>\n' +
'        </div>\n' +
'        <div class="footer">Satu Admin | Only accessible to system administrator</div>\n' +
'    </div>\n' +
'    <script>\n' +
'        const tableNames = ' + tableNamesJson + ';\n' +
'        const recentOrders = ' + recentOrdersJson + ';\n' +
'        const recentDevices = ' + recentDevicesJson + ';\n' +
'        function renderRecentOrders() {\n' +
'            const container = document.getElementById("recent-orders");\n' +
'            if (!recentOrders.length) {\n' +
'                container.innerHTML = "<p>No orders yet</p>";\n' +
'                return;\n' +
'            }\n' +
'            let html = "<table><thead><tr><th>Order ID</th><th>Device</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead><tbody>";\n' +
'            for (let i = 0; i < recentOrders.length; i++) {\n' +
'                const o = recentOrders[i];\n' +
'                html += "<tr>";\n' +
'                html += "<td>" + (o.order_id || "-") + "</td>";\n' +
'                html += "<td>" + (o.device_id || "-") + "</td>";\n' +
'                html += "<td>" + (o.amount || 0) + " THB</td>";\n' +
'                html += "<td class=\"status-" + (o.status || "") + "\">" + (o.status || "-") + "</td>";\n' +
'                html += "<td>" + (o.created || "-") + "</td>";\n' +
'                html += "</tr>";\n' +
'            }\n' +
'            html += "</tbody></table>";\n' +
'            container.innerHTML = html;\n' +
'        }\n' +
'        function renderRecentDevices() {\n' +
'            const container = document.getElementById("recent-devices");\n' +
'            if (!recentDevices.length) {\n' +
'                container.innerHTML = "<p>No devices yet</p>";\n' +
'                return;\n' +
'            }\n' +
'            let html = "<table><thead><tr><th>Device ID</th><th>Temple</th><th>Status</th><th>Last Seen</th></tr></thead><tbody>";\n' +
'            for (let i = 0; i < recentDevices.length; i++) {\n' +
'                const d = recentDevices[i];\n' +
'                html += "<tr>";\n' +
'                html += "<td>" + (d.device_id || "-") + "</td>";\n' +
'                html += "<td>" + (d.temple_name || "-") + "</td>";\n' +
'                html += "<td class=\"status-" + (d.status || "") + "\">" + (d.status || "-") + "</td>";\n' +
'                html += "<td>" + (d.last_seen || "-") + "</td>";\n' +
'                html += "</tr>";\n' +
'            }\n' +
'            html += "</tbody></table>";\n' +
'            container.innerHTML = html;\n' +
'        }\n' +
'        function renderTabs() {\n' +
'            const tabsDiv = document.getElementById("tabs");\n' +
'            let html = "";\n' +
'            for (let i = 0; i < tableNames.length; i++) {\n' +
'                html += "<button class=\"tab\" onclick=\"showTab(\'" + tableNames[i] + "\')\">" + tableNames[i] + "</button>";\n' +
'            }\n' +
'            tabsDiv.innerHTML = html;\n' +
'            if (tableNames.length > 0) showTab(tableNames[0]);\n' +
'        }\n' +
'        async function showTab(tableName) {\n' +
'            const contentDiv = document.getElementById("table-content");\n' +
'            contentDiv.innerHTML = "<div class=\"table-container\">Loading...</div>";\n' +
'            try {\n' +
'                const res = await fetch("/xK9mP2nQ5rT8wY1z/api/" + tableName);\n' +
'                const data = await res.json();\n' +
'                if (!data || data.length === 0) {\n' +
'                    contentDiv.innerHTML = "<p>No data found</p>";\n' +
'                    return;\n' +
'                }\n' +
'                let html = "<div class=\"table-container\"><table><thead><tr>";\n' +
'                const keys = Object.keys(data[0]);\n' +
'                for (let i = 0; i < keys.length; i++) {\n' +
'                    html += "<th>" + keys[i] + "</th>";\n' +
'                }\n' +
'                html += "</tr></thead><tbody>";\n' +
'                for (let i = 0; i < data.length; i++) {\n' +
'                    const row = data[i];\n' +
'                    html += "<tr>";\n' +
'                    const values = Object.values(row);\n' +
'                    for (let j = 0; j < values.length; j++) {\n' +
'                        let val = values[j];\n' +
'                        if (val === null || val === undefined) val = "-";\n' +
'                        if (typeof val === "object") val = JSON.stringify(val);\n' +
'                        html += "<td>" + String(val).substring(0, 100) + "</td>";\n' +
'                    }\n' +
'                    html += "</tr>";\n' +
'                }\n' +
'                html += "</tbody></table></div>";\n' +
'                contentDiv.innerHTML = html;\n' +
'            } catch(e) {\n' +
'                contentDiv.innerHTML = "<p style=\"color:#ef4444;\">Error loading data</p>";\n' +
'            }\n' +
'        }\n' +
'        renderRecentOrders();\n' +
'        renderRecentDevices();\n' +
'        renderTabs();\n' +
'    </script>\n' +
'</body>\n' +
'</html>';
    
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
