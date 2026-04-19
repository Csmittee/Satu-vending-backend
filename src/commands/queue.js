export async function addCommand(deviceId, command, data, env) {
    await env.DB.prepare(
        `INSERT INTO device_commands (device_id, command, data, created_at, executed)
         VALUES (?, ?, ?, ?, 0)`
    ).bind(deviceId, command, JSON.stringify(data), Date.now()).run();
}
