import { addCommand } from '../commands/queue.js';

export async function handleOmiseWebhook(request, env) {
    try {
        const payload = await request.json();
        
        // Verify webhook signature (implement with Omise library)
        // const isValid = verifyOmiseSignature(request, env);
        // if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 });
        
        if (payload.object === 'charge' && payload.status === 'successful') {
            // Find order by charge ID
            const order = await env.DB.prepare(
                `SELECT order_id, device_id, product_id FROM orders WHERE omise_charge_id = ?`
            ).bind(payload.id).first();
            
            if (order) {
                // Update order status
                await env.DB.prepare(
                    `UPDATE orders SET status = 'paid', paid_at = ? WHERE order_id = ?`
                ).bind(Date.now(), order.order_id).run();
                
                // Send command to machine to dispense
                await addCommand(order.device_id, 'payment_confirmed', {
                    order_id: order.order_id,
                    product_id: order.product_id
                }, env);
            }
        }
        
        return Response.json({ status: 'ok' });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
        }
        // When payment is successful
        async function handleSuccessfulPayment(order_id, env) {
            // 1. Update order status
            await env.DB.prepare(
                `UPDATE orders SET status = 'paid', paid_at = ? WHERE order_id = ?`
            ).bind(Date.now(), order_id).run();
            
            // 2. Get order details
            const order = await env.DB.prepare(
                `SELECT device_id, product_id FROM orders WHERE order_id = ?`
            ).bind(order_id).first();
            
            // 3. ADD DOOR OPEN COMMAND TO QUEUE
            await env.DB.prepare(
                `INSERT INTO device_commands (device_id, command, data, created_at)
                 VALUES (?, 'payment_confirmed', ?, ?)`
            ).bind(order.device_id, JSON.stringify({ 
                order_id: order_id, 
                product_id: order.product_id 
            }), Date.now()).run();
        }
