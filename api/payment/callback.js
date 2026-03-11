const { getDB } = require('../lib/db');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).json({ status: 'OK', service: 'Lynk.id Webhook Receiver' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Log the full payload so we can debug the exact Lynk.id format in Vercel Logs
        console.log('Lynk.id webhook received:', JSON.stringify(req.body));

        const payload = req.body;
        
        // Lynk.id payload structure check based on logs
        // e.g: { event: "payment.received", data: { message_action: "SUCCESS", message_data: { customer: { email: "...", ... }, items: [{ title: "Basic 1 Bulan", price: ... }] } } }
        
        const messageData = payload?.data?.message_data || {};
        const isSuccess = payload?.data?.message_action === 'SUCCESS';
        
        // Extract email
        const email = messageData?.customer?.email || 
                      payload.email || 
                      payload.customer_email || 
                      payload.buyer_email || 
                      (payload.customer && payload.customer.email);

        if (!email) {
            console.log('Received payload without email. Treating as generic ping or invalid payload.');
            return res.status(200).json({ message: 'Ping acknowledged' });
        }

        if (!isSuccess) {
             console.log(`Payment not successful (Status: ${payload?.data?.message_action}) for email: ${email}`);
             return res.status(200).json({ message: 'Ignored, not a success status' });
        }

        const sql = getDB();

        // 1. Find user by email
        const users = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
        if (users.length === 0) {
            console.log(`User with email ${email} not found in database.`);
             return res.status(200).json({ message: 'User not found' });
        }

        const userId = users[0].id;
        
        // Extract item title to determine plan
        let plan = 'basic'; 
        let periodDays = 30;
        
        const items = messageData?.items || [];
        const productName = items.length > 0 ? (items[0].title || '').toLowerCase() : '';

        if (productName.includes('pro')) {
            plan = 'pro';
        }
        if (productName.includes('3 bulan') || productName.includes('3 month') || productName.includes('3mo')) {
            periodDays = 90;
        }

        // Upgrade user plan
        await sql`UPDATE users SET plan = ${plan} WHERE id = ${userId}::uuid`;

        // Record payment
        const totalAmount = messageData?.totalPrice || messageData?.customerPay || payload.amount || payload.total_amount || 0;
        const amount = parseInt(totalAmount) * 100;
        
        await sql`
            INSERT INTO payment_history (user_id, amount_cents, currency, status, paid_at)
            VALUES (${userId}::uuid, ${amount}, 'idr', 'succeeded', NOW())
        `;

        // Check if subscription exists
        const existingSub = await sql`SELECT id FROM subscriptions WHERE user_id = ${userId}::uuid AND plan = ${plan} LIMIT 1`;
        
        if (existingSub.length > 0) {
            // Update existing subscription
            await sql`
                UPDATE subscriptions
                SET status = 'active',
                    current_period_start = NOW(),
                    current_period_end = NOW() + INTERVAL '${periodDays} days',
                    updated_at = NOW()
                WHERE id = ${existingSub[0].id}
            `;
        } else {
            // Insert new subscription
            await sql`
                INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
                VALUES (${userId}::uuid, ${plan}, 'active', NOW(), NOW() + INTERVAL '${periodDays} days')
            `;
        }

        console.log(`User ${email} upgraded to ${plan} successfully via Lynk.id`);
        res.status(200).json({ message: 'Callback processed successfully' });

    } catch (err) {
        console.error('Webhook processing error:', err);
        // Return 200 so Lynk.id doesn't retry infinitely on our crash
        res.status(200).json({ message: 'Internal error tracked' });
    }
};
