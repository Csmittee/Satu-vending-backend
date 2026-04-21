import { generateSetupCode } from '../utils/setupCode.js';
import { addCommand } from '../commands/queue.js';
import { authenticateJWT } from '../middleware/auth.js';

// ════════════════════════════════════════════════════════════════════════════
//  DEVICE AUTHENTICATION
//
//  Each registered machine gets a unique device_secret stored in the DB at
//  registration time. The ESP32 must send it with every request as:
//    Header: X-Device-Secret: <secret>
//
//  This prevents anyone who knows a device_id from reading its command queue
//  or spoofing heartbeats.
//
//  NOTE: generateDeviceSecret() is a new utility — add to utils/setupCode.js:
//    export function generateDeviceSecret() {
//        const arr = new Uint8Array(32);
//        crypto.getRandomValues(arr);
//        return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
//    }
//
//  DB migration needed:
//    ALTER TABLE devices ADD COLUMN device_secret TEXT;
//    UPDATE devices SET device_secret = hex(randomblob(32)) WHERE device_secret IS NULL;
// ════════════════════════════════════════════════════════════════════════════

async function authenticateDevice(request, env) {
    const deviceSecret = request.headers.get('X-Device-Secret');
    if (!deviceSecret) return { valid: false, reason: 'Missing X-Device-Secret header' };

    const url      = new URL(request.url);
    const deviceId = url.searchParams.get('device_id')
        || (await request.clone().json().catch(() => ({}))).device_id;

    if (!deviceId) return { valid: false, reason: 'Missing device_id' };

    const device = await env.DB.prepare(
        `SELECT device_id, status FROM devices WHERE device_id = ? AND device_secret = ?`
    ).bind(deviceId, deviceSecret).first();

    if (!device) return { valid: false, reason: 'Invalid device credentials' };
    if (device.status === 'disabled') return { valid: false, reason: 'Device is disabled' };

    return { valid: true, deviceId: device.device_id };
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE MACHINE HELLO
//  Called by ESP32 on boot. Registers device or returns existing status.
//  Returns device_secret on first registration — ESP32 must store it in NVS.
// ════════════════════════════════════════════════════════════════════════════
export async function handleMachineHello(request, env) {
    try {
        const { mac, firmware } = await request.json();

        if (!mac || !firmware) {
            return Response.json({ error: 'mac and firmware required' }, { status: 400 });
        }

        // Validate MAC format (basic sanity check)
        if (!/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac)) {
            return Response.json({ error: 'Invalid MAC address format' }, { status: 400 });
        }

        const now = Date.now();

        const existing = await env.DB.prepare(
            'SELECT device_id, status, device_secret FROM devices WHERE mac = ?'
        ).bind(mac).first();

        if (existing) {
            // Update firmware version and last seen on every hello
            await env.DB.prepare(
                `UPDATE devices SET firmware_version = ?, last_heartbeat = ? WHERE mac = ?`
            ).bind(firmware, now, mac).run();

            return Response.json({
                status:    existing.status,
                device_id: existing.device_id,
                // Return secret again in case ESP32 lost NVS (rare but possible)
                device_secret: existing.device_secret,
                message: existing.status === 'active' ? 'Device active' : 'Device pending claim'
            });
        }

        // New device — generate setup code AND device secret
        const setupCode    = generateSetupCode();
        const secretBuffer = new Uint8Array(32);
        crypto.getRandomValues(secretBuffer);
        const deviceSecret = Array.from(secretBuffer).map(b => b.toString(16).padStart(2,'0')).join('');

        await env.DB.prepare(
            `INSERT INTO devices (mac, firmware_version, status, device_secret, first_seen, last_heartbeat)
             VALUES (?, ?, 'pending', ?, ?, ?)`
        ).bind(mac, firmware, deviceSecret, now, now).run();

        await env.DB.prepare(
            `INSERT INTO setup_codes (code, assigned_mac, generated_at) VALUES (?, ?, ?)`
        ).bind(setupCode, mac, now).run();

        return Response.json({
            status:        'pending',
            message:       'Device registered. Use setup code to claim.',
            setup_code:    setupCode,
            device_secret: deviceSecret   // ESP32 must store this in NVS immediately
        });

    } catch (error) {
        console.error('Machine hello error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE HEARTBEAT
//  FIX: Now authenticated. Heartbeat table insert moved to connection_logs
//  (not admin_log — admin_log is for human admin actions).
// ════════════════════════════════════════════════════════════════════════════
export async function handleHeartbeat(request, env) {
    try {
        const body = await request.json();
        const { device_id, free_heap, uptime, firmware } = body;

        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        // Authenticate device
        const auth = await authenticateDevice(request, env);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        const now = Date.now();

        await env.DB.prepare(
            `UPDATE devices SET last_heartbeat = ?, firmware_version = COALESCE(?, firmware_version) WHERE device_id = ?`
        ).bind(now, firmware || null, device_id).run();

        // Log to connection_logs (correct table), not admin_log
        await env.DB.prepare(
            `INSERT INTO connection_logs (device_id, free_heap, uptime, logged_at) VALUES (?, ?, ?, ?)`
        ).bind(device_id, free_heap || null, uptime || null, now).run();

        return Response.json({ status: 'ok', server_time: now });

    } catch (error) {
        console.error('Heartbeat error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE GET COMMANDS
//  FIX: Now authenticated — only the real device can dequeue its own commands.
//  Commands are marked executed on read (dequeue model).
// ════════════════════════════════════════════════════════════════════════════
export async function handleGetCommands(request, env) {
    try {
        const url      = new URL(request.url);
        const deviceId = url.searchParams.get('device_id');

        if (!deviceId) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        // FIX: Authenticate before returning any commands
        const auth = await authenticateDevice(request, env);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        const commands = await env.DB.prepare(
            `SELECT id, command, data FROM device_commands
             WHERE device_id = ? AND executed = 0
             ORDER BY created_at ASC`
        ).bind(deviceId).all();

        // Mark all returned commands as executed (dequeue)
        if (commands.results.length > 0) {
            const ids = commands.results.map(c => c.id).join(',');
            await env.DB.prepare(
                `UPDATE device_commands SET executed = 1, executed_at = ? WHERE id IN (${ids})`
            ).bind(Date.now()).run();
        }

        return Response.json({
            commands: commands.results.map(cmd => ({
                command: cmd.command,
                data:    cmd.data ? JSON.parse(cmd.data) : {}
            }))
        });

    } catch (error) {
        console.error('Get commands error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE CLAIM DEVICE
//  Temple owner claims a machine using the setup code displayed on screen.
//  Requires JWT (temple owner must be logged in).
// ════════════════════════════════════════════════════════════════════════════
export async function handleClaimDevice(request, env) {
    const auth = await authenticateJWT(request, env);
    if (!auth.valid) {
        return Response.json({ error: 'Unauthorized - Please login first' }, { status: 401 });
    }

    const owner_id = auth.userId;
    const { setup_code, temple_name, address, contact_phone } = await request.json();

    if (!setup_code || !temple_name) {
        return Response.json({ error: 'setup_code and temple_name required' }, { status: 400 });
    }

    // Find the device assigned to this setup code
    const existingDevice = await env.DB.prepare(
        `SELECT device_id, owner_id, mac FROM devices WHERE mac =
            (SELECT assigned_mac FROM setup_codes WHERE code = ? AND used = 0)`
    ).bind(setup_code).first();

    if (!existingDevice) {
        return Response.json({ error: 'Invalid or expired setup code' }, { status: 400 });
    }

    if (existingDevice.owner_id) {
        return Response.json({
            error: 'This machine already belongs to another temple. Contact support.'
        }, { status: 403 });
    }

    // Claim
    await env.DB.prepare(
        `UPDATE devices SET owner_id = ?, status = 'active', temple_name = ?, address = ?, contact_phone = ?
         WHERE device_id = ?`
    ).bind(owner_id, temple_name, address || null, contact_phone || null, existingDevice.device_id).run();

    // Mark code used
    await env.DB.prepare(
        `UPDATE setup_codes SET used = 1, used_at = ? WHERE code = ?`
    ).bind(Date.now(), setup_code).run();

    // Log ownership change
    await env.DB.prepare(
        `INSERT INTO ownership_log (device_id, new_owner_id, action, created_at) VALUES (?, ?, 'claimed', ?)`
    ).bind(existingDevice.device_id, owner_id, Date.now()).run();

    return Response.json({
        status:    'claimed',
        device_id: existingDevice.device_id,
        message:   'Device claimed successfully'
    });
}
