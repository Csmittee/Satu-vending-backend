// ════════════════════════════════════════════════════════════════════════════
//  SATU — AUTH HANDLER
//  File: src/handlers/authHandler.js
//
//  ENDPOINTS:
//    POST /v1/auth/login     — email + password → JWT token
//    POST /v1/auth/register  — create new temple owner account
//
//  WHY THIS FILE EXISTS:
//    jwt.js has generateJWT/verifyJWT but no HTTP handler.
//    index.js had JWT-protected routes but no way to GET a JWT.
//    login.html was pointing at the wrong domain (api.satu-th.com).
//    Temple owners had no way to log in. This fixes all three.
//
//  PASSWORD HASHING:
//    Cloudflare Workers does not have Node.js 'bcrypt' (native C binding).
//    We use the Web Crypto API (SubtleCrypto) with PBKDF2 — available in
//    all Workers runtimes, no npm dependency needed.
//
//    PBKDF2 parameters chosen:
//      - iterations: 100,000  (OWASP minimum recommendation 2024)
//      - hash: SHA-256
//      - salt: 16 random bytes per password (stored with hash)
//      - output: 32 bytes
//
//    Format stored in password_hash column:
//      pbkdf2:100000:<base64_salt>:<base64_hash>
//
//    MIGRATION NOTE:
//      The seed admin row in schema.sql has '$2a$10$YourHashHere' (bcrypt
//      placeholder). Before first real login you must update it:
//        1. Call POST /v1/auth/register with admin@satu.com to set real hash
//           (will fail — email exists)
//        OR
//        2. Run this in D1 console to reset the password directly:
//           See admin password reset query in schema.sql reference card.
//        OR (simplest):
//        3. DELETE the seed admin row, then POST /v1/auth/register to
//           create a fresh admin account, then UPDATE role='admin'.
//
//  SECURITY DECISIONS:
//    - Constant-time comparison for password check (avoids timing attacks)
//    - Generic error message on failure ("invalid credentials") — never
//      reveal whether email exists or password is wrong
//    - Rate limiting on login is handled upstream in index.js (same D1
//      rate limiter used for /v1/order)
//    - JWT expires in 7 days (set in jwt.js) — acceptable for temple owners
//      who check dashboards weekly
//    - No refresh tokens yet — add when session management becomes complex
// ════════════════════════════════════════════════════════════════════════════

import { generateJWT } from '../auth/jwt.js';

// ─────────────────────────────────────────────────────────────────────────────
//  PASSWORD UTILITIES (PBKDF2 via Web Crypto — no npm needed)
// ─────────────────────────────────────────────────────────────────────────────

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = btoa(String.fromCharCode(...saltBytes));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const hashBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256 // 32 bytes
    );

    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBits)));
    return `pbkdf2:100000:${salt}:${hashBase64}`;
}

async function verifyPassword(password, storedHash) {
    // Handle legacy bcrypt placeholder from seed data
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        // bcrypt hash in DB but we can't verify it in Workers runtime
        // Force password reset — return false so login fails cleanly
        console.warn('[auth] bcrypt hash detected — password reset required');
        return false;
    }

    // Expect format: pbkdf2:100000:<salt>:<hash>
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
        console.error('[auth] Unknown password hash format');
        return false;
    }

    const [, iterStr, salt, storedHashBase64] = parts;
    const iterations = parseInt(iterStr, 10);

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const hashBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    const computedHash = btoa(String.fromCharCode(...new Uint8Array(hashBits)));

    // Constant-time comparison — prevents timing attacks
    const a = new TextEncoder().encode(computedHash);
    const b = new TextEncoder().encode(storedHashBase64);
    if (a.length !== b.length) return false;

    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /v1/auth/login
//
//  Request:  { "email": "...", "password": "..." }
//  Response: { "token": "...", "user": { id, email, name, role } }
//  Errors:   401 — invalid credentials (never reveals which field is wrong)
//            400 — missing fields
//            500 — internal error
// ─────────────────────────────────────────────────────────────────────────────
export async function handleLogin(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
        return Response.json(
            { error: 'Email and password are required' },
            { status: 400 }
        );
    }

    // Basic email format check
    if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (typeof password !== 'string' || password.length < 1 || password.length > 128) {
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    try {
        // Look up user — normalize email to lowercase
        const user = await env.DB.prepare(
            `SELECT id, email, name, role, password_hash FROM users WHERE email = ?`
        ).bind(email.toLowerCase().trim()).first();

        // Always run password verification even if user not found
        // This prevents timing-based user enumeration attacks
        const dummyHash = 'pbkdf2:100000:dummysalt:dummyhash00000000000000000000000000000000000=';
        const hashToCheck = user ? user.password_hash : dummyHash;
        const passwordValid = await verifyPassword(password, hashToCheck);

        if (!user || !passwordValid) {
            // Generic message — never reveal whether email exists
            return Response.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Generate JWT
        const token = await generateJWT(user.id, user.email, user.role, env);

        return Response.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        console.error('[auth] Login error:', err.message);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /v1/auth/register
//
//  Creates a new temple owner account.
//  New accounts always get role='user'. Promote to admin via D1 console.
//
//  Request:  { "email": "...", "password": "...", "name": "..." }
//  Response: { "token": "...", "user": { id, email, name, role } }
//  Errors:   409 — email already registered
//            400 — missing/invalid fields
//            500 — internal error
//
//  PASSWORD RULES:
//    - Minimum 8 characters
//    - Maximum 128 characters
//    No complexity rules enforced server-side — keep it simple for temple
//    owners who are not tech-savvy. Educate via UI instead.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleRegister(request, env) {
    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
        return Response.json(
            { error: 'Email, password, and name are required' },
            { status: 400 }
        );
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return Response.json(
            { error: 'Password must be at least 8 characters' },
            { status: 400 }
        );
    }

    if (password.length > 128) {
        return Response.json(
            { error: 'Password must be 128 characters or less' },
            { status: 400 }
        );
    }

    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
        return Response.json(
            { error: 'Name must be between 2 and 100 characters' },
            { status: 400 }
        );
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
        // Check if email already registered
        const existing = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
        ).bind(normalizedEmail).first();

        if (existing) {
            return Response.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await hashPassword(password);
        const now = Math.floor(Date.now() / 1000);

        // Insert new user
        const result = await env.DB.prepare(
            `INSERT INTO users (email, name, password_hash, role, created_at)
             VALUES (?, ?, ?, 'user', ?)`
        ).bind(normalizedEmail, name.trim(), passwordHash, now).run();

        const userId = result.meta?.last_row_id;
        if (!userId) throw new Error('Insert returned no row ID');

        // Generate JWT so user is immediately logged in after registration
        const token = await generateJWT(userId, normalizedEmail, 'user', env);

        return Response.json({
            token,
            user: {
                id: userId,
                email: normalizedEmail,
                name: name.trim(),
                role: 'user'
            }
        }, { status: 201 });

    } catch (err) {
        // Catch unique constraint violation as fallback (race condition safety)
        if (err.message?.includes('UNIQUE constraint failed')) {
            return Response.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }
        console.error('[auth] Register error:', err.message);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /v1/auth/reset-password  (Admin tool — not for public UI)
//
//  Allows an admin to set a new password for any user.
//  Requires X-Admin-Token header (same as admin dashboard).
//  Use this to fix the bcrypt placeholder on the seed admin account.
//
//  Request:  { "email": "...", "new_password": "..." }
//  Response: { "ok": true }
// ─────────────────────────────────────────────────────────────────────────────
export async function handleAdminResetPassword(request, env) {
    // Verify admin token
    const providedToken = request.headers.get('X-Admin-Token');
    if (!env.ADMIN_SECRET || !providedToken || providedToken !== env.ADMIN_SECRET) {
        return new Response('Forbidden', { status: 403 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, new_password } = body;

    if (!email || !new_password) {
        return Response.json(
            { error: 'Email and new_password are required' },
            { status: 400 }
        );
    }

    if (new_password.length < 8 || new_password.length > 128) {
        return Response.json(
            { error: 'Password must be 8–128 characters' },
            { status: 400 }
        );
    }

    try {
        const user = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
        ).bind(email.toLowerCase().trim()).first();

        if (!user) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const newHash = await hashPassword(new_password);
        await env.DB.prepare(
            `UPDATE users SET password_hash = ? WHERE email = ?`
        ).bind(newHash, email.toLowerCase().trim()).run();

        console.log(`[auth] Admin reset password for ${email}`);
        return Response.json({ ok: true });

    } catch (err) {
        console.error('[auth] Reset password error:', err.message);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
