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
        
        // Log all requests
        await logRequest(request, env);
        
        // Health check (no auth)
        if (path === '/health' && method === 'GET') {
            return Response.json({ 
                status: 'ok', 
                timestamp: Date.now(),
                environment: env.ENVIRONMENT || 'production'
            });
        }
        // Root path - show API info
        if (path === '/' && method === 'GET') {
            return Response.json({
                service: 'Satu API',
                status: 'running',
                endpoints: ['GET /health', 'POST /v1/machine/hello', 'POST /v1/order', 'GET /v1/machine/commands']
            });
        }
        
        // Public endpoints (no auth required)
        if (path === '/v1/machine/hello' && method === 'POST') {
            return handleMachineHello(request, env);
        }
        
        if (path === '/v1/webhook/omise' && method === 'POST') {
            return handleOmiseWebhook(request, env);
        }
        
        // Machine endpoints (no JWT, uses device_id)
        if (path === '/v1/machine/heartbeat' && method === 'POST') {
            return handleHeartbeat(request, env);
        }
        
        if (path === '/v1/machine/commands' && method === 'GET') {
            return handleGetCommands(request, env);
        }
        
        // Order endpoints
        if (path === '/v1/order' && method === 'POST') {
            return rateLimit(request, env, async () => handleCreateOrder(request, env));
        }
        
        if (path.match(/^\/v1\/order\/.+\/status$/) && method === 'GET') {
            const orderId = path.split('/')[3];
            return handleGetOrderStatus(orderId, env);
        }
        
        // Protected endpoints (require JWT)
        const auth = await authenticateJWT(request, env);
        if (!auth.valid) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // User dashboard endpoints
        if (path === '/v1/dashboard/devices' && method === 'GET') {
            return handleGetUserDevices(auth.userId, env);
        }
        
        // Admin endpoints
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
