import { addCommand } from '../commands/queue.js';

// ════════════════════════════════════════════════════════════════════════════
//  OMISE WEBHOOK SIGNATURE VERIFICATION
//
//  Omise sends an HMAC-SHA256 signature in the "omise-signature" header.
//  We verify it before trusting the payload. This prevents anyone on the
//  internet from faking a "payment successful" event to unlock doors without
//  paying.
//
//  Setup:
//    npx wrangler secret put OMISE_WEBHOOK_SECRET
//    → paste the webhook secret from your Omise dashboard
//
//  In fake/test mode (PAYMENT_MODE=fake), signature verification is skipped
//  because the fake Omise worker doesn't sign requests.
// ════════════════════════════════════════════════════════════════════════════

async function verifyOmiseSignature(request, bodyText, env) {
    // Skip signature check when using fake_omise gateway — it doesn't sign requests
    const gateway = env.PAYMENT_GATEWAY || 'fake_omise';
    if (gateway === 'fake_omise') return true;

    const signature = request.headers.get('omise-signature');
    if (!signature) return false;

    // Omise signature format: "t=<timestamp>,v1=<hmac>"
    const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
    const hmacHex = parts['v1'];
    if (!hmacHex) return false;

    // Re-compute expected HMAC
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(env.OMISE_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    // Omise signs: timestamp + "." + body
    const signingPayload = `${parts['t']}.${bodyText}`;
    const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingPayload));

    // Convert to hex for comparison
    const computedHex = Array.from(new Uint8Array(sigBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return computedHex === hmacHex;
}

export async function handleOmiseWebhook(request, env) {
    try {
        // Read body as text first so we can verify signature AND parse JSON
        const bodyText = await request.text();

        // FIX: Verify Omise signature before processing anything
        const signatureValid = await verifyOmiseSignature(request, bodyText, env);
        if (!signatureValid) {
            console.warn('Webhook rejected: invalid Omise signature');
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const payload = JSON.parse(bodyText);

        if (payload.object === 'charge' && payload.status === 'successful') {
            const chargeId = payload.id;
            const orderId  = payload.metadata?.order_id;

            // Find order by charge ID
            const order = await env.DB.prepare(
                `SELECT order_id, device_id, product_id, status FROM orders WHERE omise_charge_id = ?`
            ).bind(chargeId).first();

            if (!order) {
                // Charge ID not found — could be from a different system, just ack
                console.warn(`Webhook: no order found for charge ${chargeId}`);
                return Response.json({ status: 'ok', note: 'charge not found' });
            }

            // ════════════════════════════════════════════════════════════════
            //  FIX: IDEMPOTENCY CHECK
            //  If order is already paid, silently ignore the duplicate webhook.
            //  Omise retries webhooks on network errors — without this check,
            //  each retry would add another payment_confirmed command to the
            //  queue, causing the door to unlock multiple times.
            // ════════════════════════════════════════════════════════════════
            if (order.status === 'paid') {
                console.log(`Webhook: duplicate ignored for already-paid order ${order.order_id}`);
                return Response.json({ status: 'ok', note: 'duplicate ignored' });
            }

            // Mark as paid FIRST (atomic guard), then push command
            // If the Worker crashes between these two steps, the next webhook
            // retry will hit the 'paid' guard above and skip safely.
            const updateResult = await env.DB.prepare(
                `UPDATE orders SET status = 'paid', paid_at = ? WHERE order_id = ? AND status = 'pending'`
            ).bind(Date.now(), order.order_id).run();

            // Double-check: if rowsAffected is 0, another request beat us to it
            if (updateResult.meta?.changes === 0) {
                console.log(`Webhook: race condition avoided for order ${order.order_id}`);
                return Response.json({ status: 'ok', note: 'race condition avoided' });
            }

            // Now safe to push the command — exactly once
            await addCommand(order.device_id, 'payment_confirmed', {
                order_id:   order.order_id,
                product_id: order.product_id
            }, env);

            console.log(`Webhook: order ${order.order_id} marked paid, command dispatched to ${order.device_id}`);
        }

        if (payload.object === 'charge' && payload.status === 'failed') {
            // Mark order as failed — no command sent, door stays locked
            const chargeId = payload.id;
            await env.DB.prepare(
                `UPDATE orders SET status = 'failed', failure_code = ?, failure_message = ? WHERE omise_charge_id = ? AND status = 'pending'`
            ).bind(
                payload.failure_code || 'unknown',
                payload.failure_message || 'Payment failed',
                chargeId
            ).run();

            console.log(`Webhook: payment failed for charge ${chargeId} — ${payload.failure_code}`);
        }

        return Response.json({ status: 'ok' });

    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
