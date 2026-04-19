// src/handlers/order.js - COPY THIS ENTIRE FILE
function generateOrderId() {
    const date = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SATU-${yyyymmdd}-${random}`;
}

export async function handleCreateOrder(request, env) {
    try {
        const { device_id, product_id } = await request.json();
        
        if (!device_id || !product_id) {
            return Response.json({ error: 'device_id and product_id required' }, { status: 400 });
        }
        
        const products = { 1: 10, 2: 20, 3: 50, 4: 100, 5: 500 };
        const amount = products[product_id];
        
        if (!amount) {
            return Response.json({ error: 'Invalid product_id' }, { status: 400 });
        }
        
        const order_id = generateOrderId();
        const now = Date.now();
        
        await env.DB.prepare(
            `INSERT INTO orders (order_id, device_id, product_id, amount, status, created_at)
             VALUES (?, ?, ?, ?, 'pending', ?)`
        ).bind(order_id, device_id, product_id, amount, now).run();
        
        // TEMPORARY: Fake QR for testing without Omise
        const qrText = `TEST|${order_id}|${amount}|${now}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
        
        return Response.json({
            order_id: order_id,
            qr_code_url: qrCodeUrl,
            amount: amount,
            test_mode: true,
            message: "TEST MODE - Use this QR code to simulate payment"
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function handleGetOrderStatus(order_id, env) {
    try {
        const order = await env.DB.prepare(
            `SELECT status, paid_at FROM orders WHERE order_id = ?`
        ).bind(order_id).first();
        
        if (!order) {
            return Response.json({ error: 'Order not found' }, { status: 404 });
        }
        
        return Response.json({ status: order.status });
        
    } catch (error) {
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}

// Call this to simulate payment during testing
export async function simulatePayment(order_id, env) {
    await env.DB.prepare(
        `UPDATE orders SET status = 'paid', paid_at = ? WHERE order_id = ?`
    ).bind(Date.now(), order_id).run();
    
    return Response.json({ status: 'paid' });
}
