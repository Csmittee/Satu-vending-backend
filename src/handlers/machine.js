import { generateSetupCode } from '../utils/setupCode.js';
import { addCommand } from '../commands/queue.js';

export async function handleMachineHello(request, env) {
    try {
        const { mac, firmware } = await request.json();
        
        if (!mac || !firmware) {
            return Response.json({ error: 'mac and firmware required' }, { status: 400 });
        }
        
        const now = Date.now();
        const setupCode = generateSetupCode();
        
        // Check if device already exists
        const existing = await env.DB.prepare(
            'SELECT * FROM devices WHERE mac = ?'
        ).bind(mac).first();
        
        if (existing) {
            // Device already registered
            return Response.json({ 
                status: existing.status, 
                device_id: existing.device_id,
                message: existing.status === 'active' ? 'Device active' : 'Device pending claim'
            });
        }
        
        // Insert new device
        await env.DB.prepare(
            `INSERT INTO devices (mac, firmware_version, status, first_seen, last_heartbeat) 
             VALUES (?, ?, 'pending', ?, ?)`
        ).bind(mac, firmware, now, now).run();
        
        // Generate and store setup code
        await env.DB.prepare(
            `INSERT INTO setup_codes (code, assigned_mac, generated_at) 
             VALUES (?, ?, ?)`
        ).bind(setupCode, mac, now).run();
        
        return Response.json({
            status: 'pending',
            message: 'Device registered. Use setup code to claim.',
            setup_code: setupCode  // In production, send via email/SMS
        });
        
    } catch (error) {
        console.error('Machine hello error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function handleHeartbeat(request, env) {
    try {
        const { device_id, free_heap, uptime } = await request.json();
        
        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }
        
        const now = Date.now();
        
        await env.DB.prepare(
            `UPDATE devices SET last_heartbeat = ? WHERE device_id = ?`
        ).bind(now, device_id).run();
        
        // Log heartbeat (optional)
        await env.DB.prepare(
            `INSERT INTO admin_log (admin_id, action, target, details, created_at) 
             VALUES (0, 'heartbeat', ?, ?, ?)`
        ).bind(device_id, JSON.stringify({ free_heap, uptime }), now).run();
        
        return Response.json({ status: 'ok' });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function handleGetCommands(request, env) {
    try {
        const url = new URL(request.url);
        const device_id = url.searchParams.get('device_id');
        
        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }
        
        // Get unexecuted commands
        const commands = await env.DB.prepare(
            `SELECT id, command, data FROM device_commands 
             WHERE device_id = ? AND executed = 0 
             ORDER BY created_at ASC`
        ).bind(device_id).all();
        
        // Mark commands as executed
        for (const cmd of commands.results) {
            await env.DB.prepare(
                `UPDATE device_commands SET executed = 1, executed_at = ? WHERE id = ?`
            ).bind(Date.now(), cmd.id).run();
        }
        
        return Response.json({ 
            commands: commands.results.map(cmd => ({
                command: cmd.command,
                data: cmd.data ? JSON.parse(cmd.data) : {}
            }))
        });
        
    } catch (error) {
        console.error('Get commands error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
