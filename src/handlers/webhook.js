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
        
