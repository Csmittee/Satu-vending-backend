export async function handleGetUserDevices(userId, env) {
    try {
        const devices = await env.DB.prepare(
            `SELECT device_id, status, temple_name, last_heartbeat, firmware_version 
             FROM devices WHERE owner_id = ?`
        ).bind(userId).all();
        
        return Response.json({ devices: devices.results });
        
    } catch (error) {
        console.error('Get user devices error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
