// src/handlers/qr.js — R-106: GET /v1/qr/:charge_id → image/png
//
// Serves QR PNG directly from backend. No external image services.
// qr_code_url in fake mode must point here (see fake-omise-worker.js).
// Live Omise returns its own PromptPay QR URL — no change needed for live.
// R-112 (supersedes R-109): PNG color type = 0 (grayscale). PNGdec 1.1.6 uses
// bitDepth (8 = bits-per-channel) as bytes-per-pixel for ALL color types. For
// grayscale (type 0): BPP=1 = correct. For RGB (type 2): PNGdec uses BPP=1
// instead of 3, giving wrong row stride → "row 1 filter" byte = pixel data =
// invalid filter type → rc=8 rows=1. Grayscale is the only correct format.
// R-110: IDAT uses manual zlib store (RFC 1950). CompressionStream('deflate') in
// CF Workers emits raw RFC 1951 (no 2-byte header, no Adler-32 checksum) which
// causes PNG_INVALID_DATA (rc=8) in PNGdec after the first row. Fixed by building
// valid zlib with 0x78 0x01 header + stored deflate blocks + Adler-32 trailer.

import QRCode from 'qrcode';

// ── PNG encoder (pure synchronous — manual zlib store, no CompressionStream) ─

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

function _zlibStore(data) {
    // RFC 1950 zlib using stored (uncompressed) deflate blocks (BTYPE=00).
    // Replaces CompressionStream('deflate') which emits raw RFC 1951 in CF Workers,
    // missing the 2-byte header and Adler-32 — causes PNGdec rc=8. (R-110)
    const MAX_BLOCK = 65535;
    const numBlocks = Math.ceil(data.length / MAX_BLOCK) || 1;
    const out = new Uint8Array(2 + numBlocks * 5 + data.length + 4);
    let pos = 0;
    // Zlib header: CMF=0x78 FCHECK=0x01 → (0x78*256+0x01) mod 31 = 0 ✓
    out[pos++] = 0x78; out[pos++] = 0x01;
    // Stored deflate blocks
    let offset = 0;
    for (let i = 0; i < numBlocks; i++) {
        const bLen  = Math.min(MAX_BLOCK, data.length - offset);
        const nLen  = (~bLen) & 0xFFFF;
        out[pos++] = (i === numBlocks - 1) ? 0x01 : 0x00; // BFINAL | BTYPE=00
        out[pos++] = bLen & 0xFF; out[pos++] = (bLen >> 8) & 0xFF;
        out[pos++] = nLen & 0xFF; out[pos++] = (nLen >> 8) & 0xFF;
        out.set(data.subarray(offset, offset + bLen), pos);
        pos += bLen; offset += bLen;
    }
    // Adler-32 checksum, big-endian
    const a = _adler32(data);
    out[pos++] = (a >>> 24) & 0xFF; out[pos++] = (a >>> 16) & 0xFF;
    out[pos++] = (a >>>  8) & 0xFF; out[pos++] =  a         & 0xFF;
    return out;
}

function _buildPng(pixels, width, height) {
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

    const idat = _pngChunk('IDAT', _zlibStore(raw));
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

        const png = _buildPng(pixels, dim, dim);

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
