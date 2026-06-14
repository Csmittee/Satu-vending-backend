// src/handlers/qr.js — R-106: GET /v1/qr/:charge_id → image/png
//                    — R-114: GET /v1/qr/:charge_id/bitmap → raw pixel bitmap
//
// PNG endpoint: Serves QR PNG directly from backend. No external image services.
// qr_code_url in fake mode must point here (see fake-omise-worker.js).
// Live Omise returns its own PromptPay QR URL — no change needed for live.
// R-112 (supersedes R-109): PNG color type = 0 (grayscale, 1 byte/pixel).
// PNGdec 1.1.6 uses bitDepth (8) as bytes-per-pixel — correct for grayscale only.
// RGB (type 2) gives wrong stride → "row 1 filter" byte = pixel data = invalid → rc=8.
// R-113 (supersedes R-110 stored-block fix): PNGdec 1.1.6 inflate fails on large
// BTYPE=00 stored blocks — decodes row 0, then rc=8 rows=1. Use real compressed
// deflate: CF Workers CompressionStream('deflate') emits raw RFC 1951; wrap manually
// with 0x78 0x01 header + Adler-32 → valid RFC 1950 zlib with compressed blocks.
//
// Bitmap endpoint (R-114): PNGdec 1.1.6 fails for ALL PNG variants on this hardware.
// Raw bitmap bypasses PNGdec entirely — firmware draws with gfx->fillRect() directly.

import QRCode from 'qrcode';

// ── PNG encoder ──────────────────────────────────────────────────────────────

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

function _adler32(data) {
    let s1 = 1, s2 = 0;
    for (let i = 0; i < data.length; i++) {
        s1 = (s1 + data[i]) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    return ((s2 << 16) | s1) >>> 0;
}

async function _zlibDeflate(data) {
    // CF Workers CompressionStream('deflate') emits raw RFC 1951 (no zlib header/trailer).
    // Wrap with 2-byte zlib header (0x78 0x01) + Adler-32 of original data → RFC 1950.
    // Replaces _zlibStore() stored blocks: PNGdec 1.1.6 inflate fails on large BTYPE=00
    // stored blocks (decodes row 0, then rc=8 rows=1). Real compressed blocks work. (R-113)
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    await writer.write(data);
    await writer.close();

    const reader = cs.readable.getReader();
    const chunks = [];
    let totalLen = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLen += value.length;
    }

    // 2-byte zlib header + raw deflate output + 4-byte Adler-32 = RFC 1950
    const out = new Uint8Array(2 + totalLen + 4);
    out[0] = 0x78; out[1] = 0x01;  // CMF=0x78 FCHECK=0x01 → sum % 31 = 0 ✓
    let pos = 2;
    for (const chunk of chunks) { out.set(chunk, pos); pos += chunk.length; }
    const a = _adler32(data);
    out[pos++] = (a >>> 24) & 0xFF; out[pos++] = (a >>> 16) & 0xFF;
    out[pos++] = (a >>>  8) & 0xFF; out[pos++] =  a         & 0xFF;
    return out;
}

async function _buildPng(pixels, width, height) {
    const sig  = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR: width(4) height(4) bitDepth(1) colorType(0=grayscale) compression(1) filter(1) interlace(1)
    // Color type 0 (grayscale, 1 byte/pixel). PNGdec 1.1.6 uses bitDepth (8) as bytes-per-pixel
    // for all color types — correct only for grayscale. RGB (type 2) breaks stride. (R-112)
    const ihdrData = new Uint8Array(13);
    const dv = new DataView(ihdrData.buffer);
    dv.setUint32(0, width,  false);
    dv.setUint32(4, height, false);
    ihdrData[8] = 8;  // 8-bit per channel
    ihdrData[9] = 0;  // grayscale (R-112 supersedes R-109)
    const ihdr = _pngChunk('IHDR', ihdrData);

    // Raw scanline data: filter byte 0 (None) + 1 byte (gray) per pixel
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

// ── PNG Handler ───────────────────────────────────────────────────────────────

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

        // Render grayscale pixel buffer — 1 byte per pixel, white background (R-112)
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

// ── Bitmap Handler (R-114) ────────────────────────────────────────────────────
// PNGdec 1.1.6 fails for all PNG variants tested (PRs #16-#19).
// Returns raw pixels — firmware draws with gfx->fillRect(), no decoder needed.
// Response format: 4-byte header (width uint16 BE, height uint16 BE) + 1 byte/pixel.
// 0x00 = black module, 0xFF = white background.

export async function handleGetQrBitmap(charge_id, env) {
    try {
        if (!charge_id || charge_id.length > 200) {
            return new Response('Invalid charge ID', { status: 400 });
        }

        const order = await env.DB.prepare(
            'SELECT order_id FROM orders WHERE omise_charge_id = ?'
        ).bind(charge_id).first();

        if (!order) {
            return new Response('Not found', { status: 404 });
        }

        const qr = QRCode.create(charge_id, { errorCorrectionLevel: 'M' });
        const { size, data } = qr.modules;
        const quiet = 4;
        const scale = 5;
        const dim   = (size + quiet * 2) * scale;

        // 4-byte header + 1 byte per pixel
        const buf = new Uint8Array(4 + dim * dim);
        // Header: width and height as uint16 big-endian
        buf[0] = (dim >> 8) & 0xFF;
        buf[1] =  dim       & 0xFF;
        buf[2] = (dim >> 8) & 0xFF;
        buf[3] =  dim       & 0xFF;

        // Pixels: white background
        buf.fill(0xFF, 4);

        // Draw black modules
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (data[r * size + c]) {
                    const px = (quiet + c) * scale;
                    const py = (quiet + r) * scale;
                    for (let dy = 0; dy < scale; dy++) {
                        for (let dx = 0; dx < scale; dx++) {
                            buf[4 + (py + dy) * dim + (px + dx)] = 0x00;
                        }
                    }
                }
            }
        }

        return new Response(buf, {
            headers: {
                'Content-Type':   'application/octet-stream',
                'Content-Length': String(buf.length),
                'Cache-Control':  'public, max-age=3600',
            }
        });

    } catch (err) {
        console.error('[QR] handleGetQrBitmap error:', err);
        return new Response('Bitmap generation failed', { status: 500 });
    }
}
