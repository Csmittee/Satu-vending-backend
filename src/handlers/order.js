// src/handlers/order.js
function generateOrderId() {
    const date = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SATU-${yyyymmdd}-${random}`;
}

async function createPayment(amount, orderId, env) {
    const paymentMode = env.PAYMENT_MODE || 'fake';
    
    if (paymentMode === 'live') {
        // Real Omise
        const response = await fetch('https://api.omise.co/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(env.OMISE_SECRET_KEY + ':')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                currency: 'thb',
                description: `Satu donation ${orderId}`,
                source: { type: 'promptpay' }
            })
        });
        return await response.json();
    } else {
        // Fake Omise
        const fakeUrl = env.FAKE_OMISE_URL || 'https://fake-omise.csmittee.workers.dev';
        const response = await fetch(`${fakeUrl}/charges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                currency: 'thb',
                description: `Satu donation ${orderId}`
            })
        });
        return await response.json();
    }
}

export async function handleCreateOrder(request, env) {
    try {
        const { device_id, donor_name, product_id } = await request.json();
        
        if (!device_id || !product_id) {
            return Response.json({ error: 'device_id and product_id required' }, { status: 400 });
        }
        
        const products = { 1: 10, 2: 20, 3: 50, 4: 100, 5: 500, 6: 1000, 7: 2000, 8: 5000, 9: 10000, 10: 20000 };
        const amount = products[product_id];
        
        if (!amount) {
            return Response.json({ error: 'Invalid product_id' }, { status: 400 });
        }
        
        const order_id = generateOrderId();
        const now = Date.now();
        const donorName = donor_name || null;
        
        await env.DB.prepare(
            `INSERT INTO orders (order_id, device_id, donor_name, product_id, amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        ).bind(order_id, device_id, donorName, product_id, amount, now).run();
        
        const payment = await createPayment(amount, order_id, env);
        const qr_code_url = payment.source?.scannable_code?.image?.download_uri || null;
        const omise_charge_id = payment.id || null;
        
        await env.DB.prepare(
            `UPDATE orders SET qr_code_url = ?, omise_charge_id = ? WHERE order_id = ?`
        ).bind(qr_code_url, omise_charge_id, order_id).run();
        
         return Response.json({
            order_id: order_id,
            qr_code_url: qr_code_url,
            amount: amount,
            payment_mode: env.PAYMENT_MODE || 'fake',
            omise_charge_id: omise_charge_id
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function handleGetOrderStatus(order_id, env) {
    try {
        const order = await env.DB.prepare(
            `SELECT status, paid_at, donor_name FROM orders WHERE order_id = ?`
        ).bind(order_id).first();
        
        if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 });
        }
        
        return Response.json({ 
            status: order.status,
            paid_at: order.paid_at,
            donor_name: order.donor_name
        });
        
    } catch (error) {
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
