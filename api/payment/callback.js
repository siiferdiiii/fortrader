const { getDB } = require('../lib/db');

/**
 * iPaymu Callback/Webhook Handler
 * iPaymu sends POST to this URL when payment status changes
 *
 * Expected body from iPaymu:
 * - trx_id: transaction ID
 * - status: payment status (berhasil/pending/expired/gagal)
 * - status_code: 1 = success, others = fail
 * - reference_id: our reference (format: userId_plan_timestamp)
 * - via: payment method used
 */
module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            trx_id,
            status,
            status_code,
            reference_id,
            via,
            amount
        } = req.body;

        console.log('iPaymu callback received:', { trx_id, status, status_code, reference_id, via, amount });

        // Parse reference_id: userId_plan_timestamp
        if (!reference_id) {
            return res.status(400).json({ error: 'Missing reference_id' });
        }

        const parts = reference_id.split('_');
        if (parts.length < 3) {
            return res.status(400).json({ error: 'Invalid reference_id format' });
        }

        const userId = parts[0];
        const plan = parts[1];

        const sql = getDB();

        if (String(status_code) === '1' || status === 'berhasil') {
            // Payment successful — upgrade user plan
            // Map plan key to base plan (basic_3mo → basic, pro_3mo → pro)
            const basePlan = plan.replace('_3mo', '');
            const periodDays = plan.includes('_3mo') ? 90 : 30;

            await sql`UPDATE users SET plan = ${basePlan} WHERE id = ${userId}::uuid`;

            // Update subscription status
            await sql`
                UPDATE subscriptions
                SET status = 'active',
                    current_period_start = NOW(),
                    current_period_end = NOW() + INTERVAL '${periodDays} days'
                WHERE user_id = ${userId}::uuid
                  AND plan = ${plan}
                  AND status = 'incomplete'
            `;

            // Record payment
            await sql`
                INSERT INTO payment_history (user_id, amount_cents, currency, status, paid_at)
                VALUES (${userId}::uuid, ${parseInt(amount) * 100 || 0}, 'idr', 'succeeded', NOW())
            `;

            console.log(`User ${userId} upgraded to ${plan} successfully`);

        } else {
            // Payment failed or expired
            await sql`
                UPDATE subscriptions
                SET status = 'canceled'
                WHERE user_id = ${userId}::uuid
                  AND plan = ${plan}
                  AND status = 'incomplete'
            `;

            // Record failed payment
            await sql`
                INSERT INTO payment_history (user_id, amount_cents, currency, status)
                VALUES (${userId}::uuid, ${parseInt(amount) * 100 || 0}, 'idr', 'failed')
            `;

            console.log(`Payment failed for user ${userId}, plan ${plan}`);
        }

        // Always respond 200 to acknowledge receipt
        res.status(200).json({ message: 'Callback processed' });

    } catch (err) {
        console.error('Payment callback error:', err);
        // Still return 200 to prevent iPaymu from retrying endlessly
        res.status(200).json({ message: 'Callback processed with errors' });
    }
};
