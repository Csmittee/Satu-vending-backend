// src/handlers/qr.js — R-106: GET /v1/qr/:charge_id → image/png
//
// Serves QR PNG directly from backend. No external image services.
// qr_code_url in fake mode must point here (see fake-omise-worker.js).
// Live Omise returns its own PromptPay QR URL — no change needed for live.

import QRCode from 'qrcode';

// ── PNG encoder (pure CF Workers — uses CompressionStream, not Node zlib) ───

const _CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    return t;
})();

function _crc32(data) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) c = _CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function _u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, false);
    return b;
}

function _pngChunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const dataBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const body = new Uint8Array(typeBytes.length + dataBytes.length);
    body.set(typeBytes, 0);
    body.set(dataBytes, typeBytes.length);
    const crc = _u32(_crc32(body));  // CRC covers type + data (PNG spec)
    const out = new Uint8Array(4 + body.length + 4);
    out.set(_u32(dataBytes.length), 0);
    out.set(body, 4);
    out.set(crc, 4 + body.length);
    return out;
}

async function _zlibDeflate(data) {
    // CompressionStream('deflate') = zlib-wrapped deflate (RFC 1950) — what PNG IDAT needs
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function _buildPng(pixels, width, height) {
    const sig  = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR: width(4) height(4) bitDepth(1) colorType(1=grayscale) compression(1) filter(1) interlace(1)
    const ihdrData = new Uint8Array(13);
    const dv = new DataView(ihdrData.buffer);
    dv.setUint32(0, width,  false);
    dv.setUint32(4, height, false);
    ihdrData[8] = 8;  // 8-bit depth
    ihdrData[9] = 0;  // grayscale
    const ihdr = _pngChunk('IHDR', ihdrData);

    // Raw scanline data: filter byte 0 (None) + pixels per row
    const raw = new Uint8Array(height * (1 + width));
    for (let y = 0; y < height; y++) {
        raw[y * (1 + width)] = 0;
        raw.set(pixels.subarray(y * width, y * width + width), y * (1 + width) + 1);
    }

    const idat = _pngChunk('IDAT', await _zlibDeflate(raw));
    const iend = _pngChunk('IEND', new Uint8Array(0));

    const out = new Uint8Array(sig.length + ihdr.length + idat.length + iend.length);
    let pos = 0;
    for (const part of [sig, ihdr, idat, iend]) { out.set(part, pos); pos += part.length; }
    return out;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handleGetQrPng(charge_id, env) {
    try {
        if (!charge_id || charge_id.length > 200) {
            return new Response('Invalid charge ID', { status: 400 });
        }

        // Verify charge_id exists in DB — prevents open QR generation for arbitrary strings
        const order = await env.DB.prepare(
            'SELECT order_id FROM orders WHERE omise_charge_id = ?'
        ).bind(charge_id).first();

        if (!order) {
            return new Response('Not found', { status: 404 });
        }

        // Generate QR module matrix (pure computation — no canvas, no Node.js)
        const qr      = QRCode.create(charge_id, { errorCorrectionLevel: 'M' });
        const { size, data } = qr.modules;
        const quiet   = 4;   // 4-module quiet zone
        const scale   = 5;   // 5px per module — gives ~145-185px for typical QR sizes
        const dim     = (size + quiet * 2) * scale;

        // Render grayscale pixel buffer (0=black, 255=white)
        const pixels = new Uint8Array(dim * dim).fill(255);
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (data[r * size + c]) {
                    const px = (quiet + c) * scale;
                    const py = (quiet + r) * scale;
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dx = 0; dx < scale; dx++) {
                            pixels[(py + dy) * dim + (px + dx)] = 0;
                        }
                    }
                }
            }
        }

        const png = await _buildPng(pixels, dim, dim);

        return new Response(png, {
            headers: {
                'Content-Type':   'image/png',
                'Content-Length': String(png.length),
                'Cache-Control':  'public, max-age=3600'
            }
        });

    } catch (err) {
        console.error('[QR] handleGetQrPng error:', err);
        return new Response('QR generation failed', { status: 500 });
    }
}
