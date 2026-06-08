import { generateSetupCode } from '../utils/setupCode.js';
import { addCommand } from '../commands/queue.js';
import { authenticateJWT } from '../middleware/auth.js';

// ════════════════════════════════════════════════════════════════════════════
//  CHANGE LOG
//   R3.1 — Added slots[] to /hello response (reads machine_slots table)
//          Added handleGetSlots()  — GET  /v1/dashboard/slots
//          Added handleSaveSlots() — PUT  /v1/dashboard/slots
//          Heartbeat fix: connection_logs columns corrected
//   R4   — handleMachineHello: added config{} block to active response
//          Added handleMachineCompletion — POST /v1/machine/completion
//          Added handleFactoryReset     — POST /v1/machine/factory-reset
//
//  SLOT ARCHITECTURE:
//   Temple owner logs into dashboard → edits slots → PUT /v1/dashboard/slots
//   Backend writes to machine_slots table → queues reload_slots command
//   Machine receives reload_slots → calls reloadHello() → grid updates
//   No reflashing ever needed for slot changes.
//
//  machine_slots table (create in D1 if not exists):
//   CREATE TABLE IF NOT EXISTS machine_slots (
//     id         INTEGER PRIMARY KEY AUTOINCREMENT,
//     device_id  TEXT NOT NULL,
//     slot       INTEGER NOT NULL,
//     name_th    TEXT DEFAULT '',
//     name_en    TEXT DEFAULT '',
//     price      INTEGER DEFAULT 0,
//     enabled    INTEGER DEFAULT 1,
//     updated_at INTEGER DEFAULT 0,
//     UNIQUE(device_id, slot)
//   );
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
//  DEVICE AUTHENTICATION
//
//  FAKE mode  (PAYMENT_MODE=fake):  no X-Device-Secret required.
//  LIVE mode  (PAYMENT_MODE=live):  X-Device-Secret header required.
// ════════════════════════════════════════════════════════════════════════════
async function authenticateDevice(request, env, deviceId) {
    if ((env.PAYMENT_MODE || 'fake') === 'fake') {
        const device = await env.DB.prepare(
            `SELECT device_id, status FROM devices WHERE device_id = ?`
        ).bind(deviceId).first();
        if (!device)                      return { valid: false, reason: 'Device not found' };
        if (device.status === 'disabled') return { valid: false, reason: 'Device is disabled' };
        return { valid: true, deviceId: device.device_id };
    }

    const deviceSecret = request.headers.get('X-Device-Secret');
    if (!deviceSecret) return { valid: false, reason: 'Missing X-Device-Secret header' };

    const device = await env.DB.prepare(
        `SELECT device_id, status FROM devices WHERE device_id = ? AND device_secret = ?`
    ).bind(deviceId, deviceSecret).first();

    if (!device)                      return { valid: false, reason: 'Invalid device credentials' };
    if (device.status === 'disabled') return { valid: false, reason: 'Device is disabled' };
    return { valid: true, deviceId: device.device_id };
}

// ════════════════════════════════════════════════════════════════════════════
//  INTERNAL: load slots for a device from machine_slots table
//  Returns [] if table doesn't exist yet or no slots configured
// ════════════════════════════════════════════════════════════════════════════
async function _loadSlots(env, deviceId) {
    try {
        const rows = await env.DB.prepare(
            `SELECT slot, name_th, name_en, price, enabled
             FROM machine_slots
             WHERE device_id = ?
             ORDER BY slot ASC`
        ).bind(deviceId).all();
        return rows.results || [];
    } catch (e) {
        console.error('machine_slots query failed (table may not exist):', e.message);
        return [];
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE MACHINE HELLO
//  R3.1: includes slots[] for active devices
//  R4:   includes config{} block for active devices
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

            const slots = existing.status === 'active'
                ? await _loadSlots(env, existing.device_id)
                : [];

            return Response.json({
                status:        existing.status,
                device_id:     existing.device_id,
                device_secret: existing.device_secret,
                setup_code:    existing.status === 'pending'
                    ? (await env.DB.prepare(
                        `SELECT code FROM setup_codes WHERE assigned_mac = ? AND used = 0 ORDER BY generated_at DESC LIMIT 1`
                      ).bind(mac).first())?.code || null
                    : null,
                message:       existing.status === 'active'
                    ? 'Device active'
                    : 'Device pending claim — enter setup code in dashboard',
                config: existing.status === 'active' ? {
                    idle_timeout:      60,
                    selection_timeout: 15,
                    sacred_water:      true,
                    lucky_number:      true,
                    grid_rows:         2,
                    grid_cols:         5
                } : null,
                slots: slots.map(s => ({
                    slot:    s.slot,
                    name_th: s.name_th  || '',
                    name_en: s.name_en  || '',
                    price:   s.price    || 0,
                    enabled: s.enabled  === 1
                }))
            });
        }

        // New device — register it
        const deviceIdSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => b.toString(36).toUpperCase().padStart(2, '0'))
            .join('').substring(0, 6);
        const deviceId = `SATU-${deviceIdSuffix}`;

        const setupCode    = generateSetupCode();
        const secretBuffer = new Uint8Array(32);
        crypto.getRandomValues(secretBuffer);
        const deviceSecret = Array.from(secretBuffer)
            .map(b => b.toString(16).padStart(2, '0')).join('');

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
            setup_code:    setupCode,
            device_secret: deviceSecret,
            message:       'Device registered. Enter setup code in dashboard to activate.',
            config:        null,
            slots:         []
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
            `UPDATE devices SET last_heartbeat = ?, firmware_version = COALESCE(?, firmware_version)
             WHERE device_id = ?`
        ).bind(now, firmware || null, device_id).run();

        await env.DB.prepare(
            `INSERT INTO connection_logs (device_id, event_type, details, created_at)
             VALUES (?, ?, ?, ?)`
        ).bind(
            device_id,
            'heartbeat',
            JSON.stringify({ free_heap: free_heap || null, uptime: uptime || null }),
            now
        ).run();

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

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE GET SLOTS  — GET /v1/dashboard/slots?device_id=SATU-XXXXXX
// ════════════════════════════════════════════════════════════════════════════
export async function handleGetSlots(request, env) {
    try {
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url      = new URL(request.url);
        const deviceId = url.searchParams.get('device_id');
        if (!deviceId) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        const device = await env.DB.prepare(
            `SELECT device_id, temple_name FROM devices
             WHERE device_id = ? AND owner_id = ?`
        ).bind(deviceId, auth.userId).first();

        if (!device) {
            return Response.json({ error: 'Device not found or not yours' }, { status: 403 });
        }

        const slots = await _loadSlots(env, deviceId);

        return Response.json({
            device_id:   deviceId,
            temple_name: device.temple_name,
            slots:       slots.map(s => ({
                slot:    s.slot,
                name_th: s.name_th || '',
                name_en: s.name_en || '',
                price:   s.price   || 0,
                enabled: s.enabled === 1
            }))
        });

    } catch (error) {
        console.error('Get slots error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE SAVE SLOTS  — PUT /v1/dashboard/slots
// ════════════════════════════════════════════════════════════════════════════
export async function handleSaveSlots(request, env) {
    try {
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { device_id, slots } = body;

        if (!device_id || !Array.isArray(slots)) {
            return Response.json({ error: 'device_id and slots[] required' }, { status: 400 });
        }

        const device = await env.DB.prepare(
            `SELECT device_id FROM devices WHERE device_id = ? AND owner_id = ?`
        ).bind(device_id, auth.userId).first();

        if (!device) {
            return Response.json({ error: 'Device not found or not yours' }, { status: 403 });
        }

        for (const s of slots) {
            if (!s.slot || s.slot < 1 || s.slot > 21) {
                return Response.json({ error: `Invalid slot number: ${s.slot}` }, { status: 400 });
            }
            if (typeof s.price !== 'number' || s.price < 0) {
                return Response.json({ error: `Invalid price for slot ${s.slot}` }, { status: 400 });
            }
            if (s.price > 0 && s.price < 20) {
                return Response.json({
                    error: `Slot ${s.slot}: minimum price is 20 THB (Omise minimum charge)`
                }, { status: 400 });
            }
        }

        const now = Date.now();

        for (const s of slots) {
            await env.DB.prepare(
                `INSERT INTO machine_slots (device_id, slot, name_th, name_en, price, enabled, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(device_id, slot) DO UPDATE SET
                   name_th    = excluded.name_th,
                   name_en    = excluded.name_en,
                   price      = excluded.price,
                   enabled    = excluded.enabled,
                   updated_at = excluded.updated_at`
            ).bind(
                device_id,
                s.slot,
                s.name_th  || '',
                s.name_en  || '',
                s.price    || 0,
                s.enabled  ? 1 : 0,
                now
            ).run();
        }

        await env.DB.prepare(
            `INSERT INTO device_commands (device_id, command, data, created_at, executed)
             VALUES (?, 'reload_slots', '{}', ?, 0)`
        ).bind(device_id, now).run();

        return Response.json({
            status:      'ok',
            message:     `${slots.length} slot(s) saved. Machine will update within 30 seconds.`,
            slots_saved: slots.length
        });

    } catch (error) {
        console.error('Save slots error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE MACHINE COMPLETION  — POST /v1/machine/completion
//  R4: records vend outcome (success/failed) and slot number
// ════════════════════════════════════════════════════════════════════════════
export async function handleMachineCompletion(request, env) {
    try {
        const body = await request.json();
        const { device_id, order_id, success, slot } = body;

        if (!device_id || !order_id) {
            return Response.json({ error: 'device_id and order_id required' }, { status: 400 });
        }

        const auth = await authenticateDevice(request, env, device_id);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        await env.DB.prepare(
            `UPDATE orders SET status = ? WHERE order_id = ? AND device_id = ?`
        ).bind(success ? 'dispensed' : 'vend_failed', order_id, device_id).run();

        await env.DB.prepare(
            `INSERT INTO connection_logs (device_id, event_type, details, created_at) VALUES (?, ?, ?, ?)`
        ).bind(
            device_id,
            'completion',
            JSON.stringify({ success: success || false, slot: slot || null, order_id }),
            Date.now()
        ).run();

        return Response.json({ status: 'ok', message: 'Completion recorded' });

    } catch (error) {
        console.error('Completion error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE FACTORY RESET  — POST /v1/machine/factory-reset
//  R4: resets device to pending, generates new setup code
//  Machine MUST call this first — only wipes NVS on HTTP 200
// ════════════════════════════════════════════════════════════════════════════
export async function handleFactoryReset(request, env) {
    try {
        const body = await request.json();
        const { device_id } = body;

        if (!device_id) {
            return Response.json({ error: 'device_id required' }, { status: 400 });
        }

        const auth = await authenticateDevice(request, env, device_id);
        if (!auth.valid) {
            return Response.json({ error: auth.reason }, { status: 401 });
        }

        const device = await env.DB.prepare(
            'SELECT mac FROM devices WHERE device_id = ?'
        ).bind(device_id).first();

        if (!device) {
            return Response.json({ error: 'Device not found' }, { status: 404 });
        }

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const now     = Date.now();

        await env.DB.prepare(
            `UPDATE devices SET owner_id = NULL, status = 'pending' WHERE device_id = ?`
        ).bind(device_id).run();

        await env.DB.prepare(
            `DELETE FROM setup_codes WHERE device_id = ?`
        ).bind(device_id).run();

        await env.DB.prepare(
            `INSERT INTO setup_codes (code, assigned_mac, device_id, used, generated_at) VALUES (?, ?, ?, 0, ?)`
        ).bind(newCode, device.mac, device_id, now).run();

        await env.DB.prepare(
            `INSERT INTO connection_logs (device_id, event_type, details, created_at) VALUES (?, ?, ?, ?)`
        ).bind(
            device_id,
            'factory_reset',
            JSON.stringify({ initiated_by: 'machine' }),
            now
        ).run();

        return Response.json({ status: 'ok', message: 'Device reset. New setup code generated.' });

    } catch (error) {
        console.error('Factory reset error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
