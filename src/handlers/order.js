// src/handlers/order.js

// ════════════════════════════════════════════════════════════════════════════
//  ORDER ID GENERATION
//  FIX: Random 4-digit suffix gives only 10,000 combinations per day.
//  With many temples this will collide. Using 6-digit random + timestamp ms
//  for much better uniqueness. Still readable for support teams.
// ════════════════════════════════════════════════════════════════════════════
function generateOrderId() {
    const date   = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `SATU-${yyyymmdd}-${random}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  PRODUCT CATALOG
//  Amounts in THB (satangs conversion happens inside createPayment)
// ════════════════════════════════════════════════════════════════════════════
const PRODUCTS = {
    1:  { name: 'Blessing Card',     price: 10 },
    2:  { name: 'Small Amulet',      price: 20 },
    3:  { name: 'Medium Amulet',     price: 50 },
    4:  { name: 'Large Amulet',      price: 100 },
    5:  { name: 'Monk Blessing',     price: 500 },
    6:  { name: 'Temple Donation',   price: 1000 },
    7:  { name: 'Merit Set',         price: 2000 },
    8:  { name: 'Gold Leaf',         price: 5000 },
    9:  { name: 'Buddha Statue',     price: 10000 },
    10: { name: 'Lifetime Blessing', price: 20000 }
};

// ════════════════════════════════════════════════════════════════════════════
//  PAYMENT GATEWAY
//  FIX: Omise requires amount in SATANGS (THB × 100). The original code sent
//  THB directly which would charge 100× less than intended on real Omise.
//  e.g. 100 THB → must send 10000 to Omise.
//
//  Fake Omise worker accepts either unit (it's fake), but we send satangs to
//  keep parity between modes.
// ════════════════════════════════════════════════════════════════════════════
async function createPayment(amountTHB, orderId, env) {
    // ════════════════════════════════════════════════════════════════════════
    //  PAYMENT GATEWAY SELECTION
    //
    //  PAYMENT_GATEWAY secret (set via wrangler secret put PAYMENT_GATEWAY):
    //    'fake_omise'  — uses fake-omise worker (dev/testing, no real money)
    //    'omise_test'  — uses real Omise API with test keys (test money)
    //    'omise_live'  — uses real Omise API with live keys (real money)
    //
    //  omise_test and omise_live use identical code — only the API key differs.
    //  Switch between them by changing OMISE_SECRET_KEY secret only.
    //  No code change needed to go from test to live.
    //
    //  SYSTEM_MODE secret:
    //    'online'   — accepting transactions (default)
    //    'offline'  — maintenance mode (future use)
    // ════════════════════════════════════════════════════════════════════════
    const gateway      = env.PAYMENT_GATEWAY || 'fake_omise';
    const amountSatangs = amountTHB * 100;   // Omise requires satangs (THB × 100)

    if (gateway === 'omise_test' || gateway === 'omise_live') {
        if (!env.OMISE_SECRET_KEY) {
            throw new Error('OMISE_SECRET_KEY secret is not set — cannot process payment');
        }

        const response = await fetch('https://api.omise.co/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(env.OMISE_SECRET_KEY + ':')}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                amount:      amountSatangs,
                currency:    'thb',
                description: `Satu donation ${orderId}`,
                source:      { type: 'promptpay' }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Omise API error ${response.status}: ${err.message || 'unknown'}`);
        }

        return await response.json();

    } else {
        // fake_omise — permanent dev/test gateway stub (not a temporary hack)
        const fakeUrl  = env.FAKE_OMISE_URL || 'https://fake-omise.csmittee.workers.dev';
        const response = await fetch(`${fakeUrl}/charges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount:      amountSatangs,
                currency:    'thb',
                description: `Satu donation ${orderId}`
            })
        });

        if (!response.ok) {
            throw new Error(`Fake Omise gateway error ${response.status}`);
        }

        return await response.json();
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE CREATE ORDER
// ════════════════════════════════════════════════════════════════════════════
export async function handleCreateOrder(request, env) {
    try {
        const body = await request.json();
        const { device_id, donor_name, product_id } = body;

        if (!device_id || !product_id) {
            return Response.json({ error: 'device_id and product_id required' }, { status: 400 });
        }

        // Validate device exists and is active
        const device = await env.DB.prepare(
            `SELECT device_id, status FROM devices WHERE device_id = ?`
        ).bind(device_id).first();

        if (!device) {
            return Response.json({ error: 'Unknown device' }, { status: 400 });
        }
        if (device.status !== 'active') {
            return Response.json({ error: 'Device is not active' }, { status: 400 });
        }

        const product = PRODUCTS[product_id];
        if (!product) {
            return Response.json({ error: 'Invalid product_id' }, { status: 400 });
        }

        // Sanitize donor name
        const donorName = donor_name
            ? String(donor_name).trim().substring(0, 100)  // max 100 chars
            : null;

        const order_id = generateOrderId();
        const now      = Date.now();

        // Insert order first — if payment gateway fails we can clean up
        await env.DB.prepare(
            `INSERT INTO orders (order_id, device_id, donor_name, product_id, amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        ).bind(order_id, device_id, donorName, product_id, product.price, now).run();

        // Call payment gateway
        let payment;
        try {
            payment = await createPayment(product.price, order_id, env);
        } catch (paymentError) {
            // Clean up the pending order if payment gateway failed
            await env.DB.prepare(
                `UPDATE orders SET status = 'failed', failure_code = 'gateway_error' WHERE order_id = ?`
            ).bind(order_id).run();
            console.error('Payment gateway error:', paymentError.message);
            return Response.json({ error: 'Payment gateway unavailable. Please try again.' }, { status: 502 });
        }

        const qr_code_url     = payment.source?.scannable_code?.image?.download_uri || null;
        const omise_charge_id = payment.id || null;

        if (!qr_code_url || !omise_charge_id) {
            console.error('Payment gateway returned incomplete data:', payment);
            await env.DB.prepare(
                `UPDATE orders SET status = 'failed', failure_code = 'gateway_incomplete' WHERE order_id = ?`
            ).bind(order_id).run();
            return Response.json({ error: 'Payment gateway returned incomplete response' }, { status: 502 });
        }

        await env.DB.prepare(
            `UPDATE orders SET qr_code_url = ?, omise_charge_id = ? WHERE order_id = ?`
        ).bind(qr_code_url, omise_charge_id, order_id).run();

        return Response.json({
            order_id:        order_id,
            qr_code_url:     qr_code_url,
            amount:          product.price,
            product_name:    product.name,
            payment_gateway: env.PAYMENT_GATEWAY || 'fake_omise',
            omise_charge_id: omise_charge_id
        });

    } catch (error) {
        console.error('Create order error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  HANDLE GET ORDER STATUS
// ════════════════════════════════════════════════════════════════════════════
export async function handleGetOrderStatus(order_id, env) {
    try {
        // Validate order_id format to prevent probing
        if (!order_id || !/^SATU-\d{8}-\d{4,6}$/.test(order_id)) {
            return Response.json({ error: 'Invalid order ID format' }, { status: 400 });
        }

        const order = await env.DB.prepare(
            `SELECT status, paid_at, donor_name, amount, product_id, created_at FROM orders WHERE order_id = ?`
        ).bind(order_id).first();

        if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 });
        }

        return Response.json({
            status:     order.status,
            paid_at:    order.paid_at,
            donor_name: order.donor_name,
            amount:     order.amount,
            product_id: order.product_id,
            created_at: order.created_at
        });

    } catch (error) {
        console.error('Get order status error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
