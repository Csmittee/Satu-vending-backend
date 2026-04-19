export async function generateJWT(userId, email, role, env) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { 
        user_id: userId, 
        email, 
        role,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = await crypto.subtle.sign(
        'HMAC',
        await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyJWT(token, env) {
    try {
        const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
        
        const signature = Uint8Array.from(atob(encodedSignature), c => c.charCodeAt(0));
        const expectedSignature = await crypto.subtle.sign(
            'HMAC',
            await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
        
        const expectedSignatureArray = new Uint8Array(expectedSignature);
        if (signature.length !== expectedSignatureArray.length) return null;
        
        for (let i = 0; i < signature.length; i++) {
            if (signature[i] !== expectedSignatureArray[i]) return null;
        }
        
        const payload = JSON.parse(atob(encodedPayload));
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        
        return payload;
        
    } catch (error) {
        return null;
    }
}
