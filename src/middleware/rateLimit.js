// Simple in-memory rate limiter (per Worker instance)
const ipRequests = new Map();

export async function rateLimit(request, env, handler) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100;
    
    if (!ipRequests.has(ip)) {
        ipRequests.set(ip, []);
    }
    
    const requests = ipRequests.get(ip).filter(timestamp => now - timestamp < windowMs);
    
    if (requests.length >= maxRequests) {
        return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    
    requests.push(now);
    ipRequests.set(ip, requests);
    
    return handler();
}
