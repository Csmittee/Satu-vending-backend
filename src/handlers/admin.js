import { addCommand } from '../commands/queue.js';

export async function handleDisableDevice(request, env, adminId) {
    try {
        const { device_id, reason } = await request.json();
        
        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }
        
        const now = Date.now();
        
        // Update device status
        await env.DB.prepare(
            `UPDATE devices SET status = 'disabled', disable_reason = ?, disabled_at = ? 
             WHERE device_id = ?`
        ).bind(reason || 'admin_action', now, device_id).run();
        
        // Add disable command
        await addCommand(device_id, 'disable', { reason: reason || 'admin_action' }, env);
        
        // Log admin action
        await env.DB.prepare(
            `INSERT INTO admin_log (admin_id, action, target, details, ip_address, created_at)
             VALUES (?, 'disable', ?, ?, ?, ?)`
        ).bind(adminId, device_id, JSON.stringify({ reason }), request.headers.get('CF-Connecting-IP'), now).run();
        
        return Response.json({ status: 'ok' });
        
    } catch (error) {
        console.error('Disable device error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function handleEnableDevice(request, env, adminId) {
    try {
        const { device_id } = await request.json();
        
        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }
        
        const now = Date.now();
        
        await env.DB.prepare(
            `UPDATE devices SET status = 'active', disable_reason = NULL, disabled_at = NULL 
             WHERE device_id = ?`
        ).bind(device_id).run();
        
        await addCommand(device_id, 'enable', {}, env);
        
        await env.DB.prepare(
            `INSERT INTO admin_log (admin_id, action, target, created_at)
             VALUES (?, 'enable', ?, ?)`
        ).bind(adminId, device_id, now).run();
        
        return Response.json({ status: 'ok' });
        
    } catch (error) {
        console.error('Enable device error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function handleReassignDevice(request, env, adminId) {
    try {
        const { device_id, new_owner_email, reason } = await request.json();
        
        if (!device_id || !new_owner_email) {
            return Response.json({ error: 'device_id and new_owner_email required' }, { status: 400 });
        }
        
        // Get new owner
        const newOwner = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
        ).bind(new_owner_email).first();
        
        if (!newOwner) {
            return Response.json({ error: 'New owner not found' }, { status: 404 });
        }
        
        // Get current device
        const device = await env.DB.prepare(
            `SELECT mac, owner_id FROM devices WHERE device_id = ?`
        ).bind(device_id).first();
        
        if (!device) {
            return Response.json({ error: 'Device not found' }, { status: 404 });
        }
        
        const now = Date.now();
        
        // Log ownership transfer
        await env.DB.prepare(
            `INSERT INTO ownership_log (device_mac, from_user_id, to_user_id, reason, changed_by, changed_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(device.mac, device.owner_id, newOwner.id, reason, adminId, now).run();
        
        // Update device owner
        await env.DB.prepare(
            `UPDATE devices SET owner_id = ? WHERE device_id = ?`
        ).bind(newOwner.id, device_id).run();
        
        // Log admin action
        await env.DB.prepare(
            `INSERT INTO admin_log (admin_id, action, target, details, created_at)
             VALUES (?, 'reassign', ?, ?, ?)`
        ).bind(adminId, device_id, JSON.stringify({ new_owner_email, reason }), now).run();
        
        return Response.json({ status: 'ok' });
        
    } catch (error) {
        console.error('Reassign device error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function handleGetAllDevices(request, env) {
    try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || 'all';
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT d.*, u.email as owner_email, u.name as owner_name
            FROM devices d
            LEFT JOIN users u ON d.owner_id = u.id
        `;
        
        if (status !== 'all') {
            query += ` WHERE d.status = '${status}'`;
        }
        
        query += ` ORDER BY d.first_seen DESC LIMIT ${limit} OFFSET ${offset}`;
        
        const devices = await env.DB.prepare(query).all();
        
        return Response.json({
            devices: devices.results,
            page,
            limit
        });
        
    } catch (error) {
        console.error('Get all devices error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE COMMAND INJECT  — POST /v1/machine/command-inject
//  R-142: Admin-auth test endpoint. Queues any command to any device.
//  Never expose publicly. Never add to 14-test suite.
//  Added to support HW Trigger IR sensor simulation (2026-06-17)
// ════════════════════════════════════════════════════════════════════════════
export async function handleCommandInject(request, env) {
    try {
        const adminToken = request.headers.get('X-Admin-Token');
        if (!adminToken || adminToken !== env.ADMIN_SECRET) {
            return Response.json(
                { error: 'Unauthorized' },
                { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const body = await request.json();
        const { device_id, command, data } = body;

        if (!device_id || !command) {
            return Response.json(
                { error: 'device_id and command required' },
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        console.log('[INJECT] command queued: ' + command + ' → ' + device_id);
        await addCommand(device_id, command, data || {}, env);

        return Response.json(
            { status: 'ok', command, device_id },
            { headers: { 'Access-Control-Allow-Origin': '*' } }
        );

    } catch (error) {
        console.error('Command inject error:', error);
        return Response.json(
            { error: 'Internal error' },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}
