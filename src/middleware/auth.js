import { verifyJWT } from '../auth/jwt.js';

export async function authenticateJWT(request, env) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false };
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, env);
    
    if (!payload) {
        return { valid: false };
    }
    
    return { valid: true, userId: payload.user_id, email: payload.email, role: payload.role };
}

export async function requireAdmin(userId, env) {
    const user = await env.DB.prepare(
        `SELECT role FROM users WHERE id = ?`
    ).bind(userId).first();
    
    return user && user.role === 'admin';
}
