export async function logRequest(request, env) {
    const url = new URL(request.url);
    const log = {
        timestamp: Date.now(),
        method: request.method,
        path: url.pathname,
        ip: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent')
    };
    
    // Optional: Store in D1 for analytics
    // await env.DB.prepare(`INSERT INTO request_logs ...`).bind(...).run();
    
    console.log(JSON.stringify(log));
}
