import { createOmiseCharge } from '../utils/omise.js';
import { addCommand } from '../commands/queue.js';

function generateOrderId() {
    const date = new Date();
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SATU-${yyyymmdd}-${random}`;
}

export async function handleCreateOrder(request, env) {
    try {
        const { device_id, user_id, product_id } = await request.json();
        
        if (!device_id || !user_id || !product_id) {
            return Response.json({ error: 'device_id, user_id, product_id required' }, { status: 400 });
        }
        
        // Product prices (could be stored in DB)
        const products = { 1: 1000, 2: 2000, 3: 5000, 4: 10000, 5: 20000 };
        const amount = products[product_id];
        
        if (!amount) {
            return Response.json({ error: 'Invalid product_id' }, { status: 400 });
        }
        
        const order_id = generateOrderId();
        const now = Date.now();
        
        // Create order in database
        await env.DB.prepare(
            `INSERT INTO orders (order_id, device_id, user_id, product_id, amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        ).bind(order_id, device_id, user_id, product_id, amount, now).run();
        
        // Create Omise charge
        const charge = await createOmiseCharge(amount, `Donation for ${device_id}`, env);
        
        // Update order with Omise charge ID and QR code
        await env.DB.prepare(
            `UPDATE orders SET omise_charge_id = ?, qr_code_url = ? WHERE order_id = ?`
        ).bind(charge.id, charge.source.scannable_code.image.download_uri, order_id).run();
        
        return Response.json({
            order_id: order_id,
            qr_code_url: charge.source.scannable_code.image.download_uri,
            amount: amount
        });
        
    } catch (error) {
        console.error('Create order error:', error);
        return Response.json({ error: 'Payment creation failed' }, { status: 500 });
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
        console.error('Get order status error:', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
    }
}
