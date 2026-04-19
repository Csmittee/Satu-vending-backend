import { generateSetupCode } from '../utils/setupCode.js';
import { addCommand } from '../commands/queue.js';
import { authenticateJWT } from '../middleware/auth.js';
export async function handleClaimDevice(request, env) {
    // STEP 1: Get logged-in user from JWT token
    const auth = await authenticateJWT(request, env);
    if (!auth.valid) {
        return Response.json({ error: 'Unauthorized - Please login first' }, { status: 401 });
    }
    
    const owner_id = auth.userId;  // This is where owner_id comes from
    
    // STEP 2: Get request data
    const { setup_code, temple_name, address, contact_phone } = await request.json();
    
    // STEP 3: Find device by setup code
    const existingDevice = await env.DB.prepare(
        `SELECT device_id, owner_id, mac FROM devices WHERE mac = 
            (SELECT assigned_mac FROM setup_codes WHERE code = ? AND used = 0)`
    ).bind(setup_code).first();
    
    // STEP 4: Validate setup code
    if (!existingDevice) {
        return Response.json({ error: 'Invalid or expired setup code' }, { status: 400 });
    }
    
    // STEP 5: Check if already owned
    if (existingDevice.owner_id) {
        return Response.json({ 
            error: 'This machine already belongs to another temple. Contact support.' 
        }, { status: 403 });
    }
    
    // STEP 6: Claim the device
    await env.DB.prepare(
        `UPDATE devices SET owner_id = ?, status = 'active', temple_name = ?, address = ?, contact_phone = ? 
         WHERE device_id = ?`
    ).bind(owner_id, temple_name, address, contact_phone, existingDevice.device_id).run();
    
    // STEP 7: Mark setup code as used
    await env.DB.prepare(
        `UPDATE setup_codes SET used = 1, used_at = ? WHERE code = ?`
    ).bind(Date.now(), setup_code).run();
    
    // STEP 8: Return success
    return Response.json({ 
        status: 'claimed', 
        device_id: existingDevice.device_id,
        message: 'Device claimed successfully' 
    });
}

export async function handleMachineHello(request, env) {
    try {
        const { mac, firmware } = await request.json();
        
        if (!mac || !firmware) {
            return Response.json({ error: 'mac and firmware required' }, { status: 400 });
        }
        
        const now = Date.now();
        const setupCode = generateSetupCode();
        
        const existing = await env.DB.prepare(
            'SELECT * FROM devices WHERE mac = ?'
        ).bind(mac).first();
        
        if (existing) {
            return Response.json({ 
                status: existing.status, 
                device_id: existing.device_id,
                message: existing.status === 'active' ? 'Device active' : 'Device pending claim'
            });
        }
        
        await env.DB.prepare(
            `INSERT INTO devices (mac, firmware_version, status, first_seen, last_heartbeat) 
             VALUES (?, ?, 'pending', ?, ?)`
        ).bind(mac, firmware, now, now).run();
        
        await env.DB.prepare(
            `INSERT INTO setup_codes (code, assigned_mac, generated_at) 
             VALUES (?, ?, ?)`
        ).bind(setupCode, mac, now).run();
        
        return Response.json({
            status: 'pending',
            message: 'Device registered. Use setup code to claim.',
            setup_code: setupCode
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
        
        const commands = await env.DB.prepare(
            `SELECT id, command, data FROM device_commands 
             WHERE device_id = ? AND executed = 0 
             ORDER BY created_at ASC`
        ).bind(device_id).all();
        
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
