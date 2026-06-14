// fake-omise-worker.js
// ════════════════════════════════════════════════════════════════════════════
//  FAKE OMISE WORKER — for local/dev use
//  Deploy to: fake-omise.csmittee.workers.dev
//
//  CHANGE LOG:
//    R-106 (2026-06-13): qr_code_url now points to backend /v1/qr/:charge_id
//      Was: external api.qrserver.com (returned ~510 byte HTML error, not PNG)
//      Now: https://api.janishammer.com/v1/qr/${chargeId}
//           Backend generates QR PNG directly (see src/handlers/qr.js)
//
//  PAYMENT MODE REMINDER: PAYMENT_MODE must remain = fake. Never suggest live.
// ════════════════════════════════════════════════════════════════════════════

export default {
    async fetch(request, env) {
        const url    = new URL(request.url);
        const path   = url.pathname;
        const method = request.method;

        // CORS
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin':  '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            });
        }

        // ── POST /charges — fake PromptPay charge ────────────────────────────
        if (path === '/charges' && method === 'POST') {
            let body = {};
            try { body = await request.json(); } catch {}

            const chargeId  = 'fake_chg_' + Math.random().toString(36).slice(2, 10);
            const amount    = body.amount    || 0;
            const currency  = body.currency  || 'thb';
            const desc      = body.description || '';

            // R-106: qr_code_url points to backend /v1/qr/:charge_id
            // Backend serves PNG directly — no external image service
            const qrUrl = `https://api.janishammer.com/v1/qr/${chargeId}`;

            return Response.json({
                object:   'charge',
                id:       chargeId,
                amount:   amount,
                currency: currency,
                description: desc,
                status:   'pending',
                source: {
                    object: 'source',
                    type:   'promptpay',
                    scannable_code: {
                        object: 'scannable_code',
                        type:   'qr',
                        image: {
                            object:       'document',
                            location:     qrUrl,
                            download_uri: qrUrl    // ← backend endpoint
                        }
                    }
                },
                created: Date.now()
            });
        }

        // ── POST /webhooks/payment — simulate paid webhook ───────────────────
        if (path === '/webhooks/payment' && method === 'POST') {
            let body = {};
            try { body = await request.json(); } catch {}
            return Response.json({
                object: 'event',
                id:     'fake_evt_' + Math.random().toString(36).slice(2, 10),
                data:   { ...body, status: 'successful' }
            });
        }

        // ── GET /health ──────────────────────────────────────────────────────
        if (path === '/health' && method === 'GET') {
            return Response.json({ status: 'ok', mode: 'fake', version: 'R-106' });
        }

        return new Response('Not found', { status: 404 });
    }
};
