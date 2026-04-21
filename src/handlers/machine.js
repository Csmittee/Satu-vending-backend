import { generateSetupCode } from '../utils/setupCode.js';
import { addCommand } from '../commands/queue.js';
import { authenticateJWT } from '../middleware/auth.js';

// ════════════════════════════════════════════════════════════════════════════
//  DEVICE AUTHENTICATION
//
//  FAKE mode  (PAYMENT_MODE=fake):  no X-Device-Secret required.
//             System tester + machine tester work without ESP32 firmware.
//             The Cloudflare env var is the gate — nothing in client files.
//
//  LIVE mode  (PAYMENT_MODE=live):  X-Device-Secret header required on every
//             /heartbeat and /commands call. ESP32 stores secret in NVS.
// ════════════════════════════════════════════════════════════════════════════
async function authenticateDevice(request, env, deviceId) {
    if ((env.PAYMENT_MODE || 'fake') === 'fake') {
        // In fake mode: just confirm device exists in DB
        const device = await env.DB.prepare(
            `SELECT device_id, status FROM devices WHERE device_id = ?`
        ).bind(deviceId).first();
        if (!device)                        return { valid: false, reason: 'Device not found' };
        if (device.status === 'disabled')   return { valid: false, reason: 'Device is disabled' };
        return { valid: true, deviceId: device.device_id };
    }

    // Live mode: require secret header
    const deviceSecret = request.headers.get('X-Device-Secret');
    if (!deviceSecret) return { valid: false, reason: 'Missing X-Device-Secret header' };

    const device = await env.DB.prepare(
        `SELECT device_id, status FROM devices WHERE device_id = ? AND device_secret = ?`
    ).bind(deviceId, deviceSecret).first();

    if (!device)                        return { valid: false, reason: 'Invalid device credentials' };
    if (device.status === 'disabled')   return { valid: false, reason: 'Device is disabled' };
    return { valid: true, deviceId: device.device_id };
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE MACHINE HELLO
//  Called by ESP32 on boot. Registers device or returns existing status.
//
//  MAC VALIDATION:
//   - Fake mode: accept any non-empty string  (tester sends TEST:MAC:xxx)
//   - Live mode: enforce real format          AA:BB:CC:DD:EE:FF
// ════════════════════════════════════════════════════════════════════════════
export async function handleMachineHello(request, env) {
    try {
        const { mac, firmware } = await request.json();

        if (!mac || !firmware) {
            return Response.json({ error: 'mac and firmware required' }, { status: 400 });
        }

        const isFakeMode = (env.PAYMENT_MODE || 'fake') === 'fake';
        const isValidMac = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/.test(mac);
        if (!isFakeMode && !isValidMac) {
            return Response.json({ error: 'Invalid MAC address format' }, { status: 400 });
        }

        const now = Date.now();

        const existing = await env.DB.prepare(
            'SELECT device_id, status, device_secret FROM devices WHERE mac = ?'
        ).bind(mac).first();

        if (existing) {
            await env.DB.prepare(
                `UPDATE devices SET firmware_version = ?, last_heartbeat = ? WHERE mac = ?`
            ).bind(firmware, now, mac).run();

            return Response.json({
                status:        existing.status,
                device_id:     existing.device_id,
                device_secret: existing.device_secret,
                message:       existing.status === 'active' ? 'Device active' : 'Device pending claim'
            });
        }

        // New device: generate device_id, setup code, and device secret
        // device_id format: SATU-XXXXXX (6 random uppercase alphanumeric chars)
        const deviceIdSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => b.toString(36).toUpperCase().padStart(2, '0'))
            .join('').substring(0, 6);
        const deviceId = `SATU-${deviceIdSuffix}`;

        const setupCode    = generateSetupCode();
        const secretBuffer = new Uint8Array(32);
        crypto.getRandomValues(secretBuffer);
        const deviceSecret = Array.from(secretBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

        await env.DB.prepare(
            `INSERT INTO devices (mac, device_id, firmware_version, status, device_secret, first_seen, last_heartbeat)
             VALUES (?, ?, ?, 'pending', ?, ?, ?)`
        ).bind(mac, deviceId, firmware, deviceSecret, now, now).run();

        await env.DB.prepare(
            `INSERT INTO setup_codes (code, assigned_mac, generated_at) VALUES (?, ?, ?)`
        ).bind(setupCode, mac, now).run();

        return Response.json({
            status:        'pending',
            device_id:     deviceId,
            message:       'Device registered. Use setup code to claim.',
            setup_code:    setupCode,
            device_secret: deviceSecret
        });

    } catch (error) {
        console.error('Machine hello error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE HEARTBEAT
// ════════════════════════════════════════════════════════════════════════════
export async function handleHeartbeat(request, env) {
    try {
        const body = await request.json();
        const { device_id, free_heap, uptime, firmware } = body;

        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        const auth = await authenticateDevice(request, env, device_id);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        const now = Date.now();

        await env.DB.prepare(
            `UPDATE devices SET last_heartbeat = ?, firmware_version = COALESCE(?, firmware_version) WHERE device_id = ?`
        ).bind(now, firmware || null, device_id).run();

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
// ════════════════════════════════════════════════════════════════════════════
export async function handleGetCommands(request, env) {
    try {
        const url      = new URL(request.url);
        const deviceId = url.searchParams.get('device_id');

        if (!deviceId) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        const auth = await authenticateDevice(request, env, deviceId);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        const commands = await env.DB.prepare(
            `SELECT id, command, data FROM device_commands
             WHERE device_id = ? AND executed = 0
             ORDER BY created_at ASC`
        ).bind(deviceId).all();

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

    await env.DB.prepare(
        `UPDATE devices SET owner_id = ?, status = 'active', temple_name = ?, address = ?, contact_phone = ?
         WHERE device_id = ?`
    ).bind(owner_id, temple_name, address || null, contact_phone || null, existingDevice.device_id).run();

    await env.DB.prepare(
        `UPDATE setup_codes SET used = 1, used_at = ? WHERE code = ?`
    ).bind(Date.now(), setup_code).run();

    await env.DB.prepare(
        `INSERT INTO ownership_log (device_id, new_owner_id, action, created_at) VALUES (?, ?, 'claimed', ?)`
    ).bind(existingDevice.device_id, owner_id, Date.now()).run();

    return Response.json({
        status:    'claimed',
        device_id: existingDevice.device_id,
        message:   'Device claimed successfully'
    });
}
