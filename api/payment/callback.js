const { createClient } = require('@supabase/supabase-js');

// Server-side Supabase client dengan service_role (bypass RLS)
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method === 'GET') return res.status(200).json({ status: 'OK', service: 'Lynk.id Webhook Receiver' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        console.log('Lynk.id webhook received:', JSON.stringify(req.body));

        const payload = req.body;

        const messageData = payload?.data?.message_data || {};
        const isSuccess   = payload?.data?.message_action === 'SUCCESS';

        // Extract email
        const email = messageData?.customer?.email
            || payload.email
            || payload.customer_email
            || payload.buyer_email
            || (payload.customer && payload.customer.email);

        if (!email) {
            console.log('Received payload without email. Treating as ping.');
            return res.status(200).json({ message: 'Ping acknowledged' });
        }

        if (!isSuccess) {
            console.log(`Payment not successful (${payload?.data?.message_action}) for ${email}`);
            return res.status(200).json({ message: 'Ignored, not a success status' });
        }

        const supabase = getSupabaseAdmin();

        // 1. Find user by email (via auth.users via admin API)
        const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
        if (userErr) throw userErr;

        const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!authUser) {
            console.log(`User with email ${email} not found.`);
            return res.status(200).json({ message: 'User not found' });
        }

        const userId = authUser.id;

        // 2. Determine plan & period from product name
        let plan       = 'basic';
        let periodDays = 30;

        const items       = messageData?.items || [];
        const productName = items.length > 0 ? (items[0].title || '').toLowerCase() : '';

        if (productName.includes('pro'))                                                       plan = 'pro';
        if (productName.includes('3 bulan') || productName.includes('3 month') || productName.includes('3mo')) periodDays = 90;

        // 3. Update user_profiles.plan
        const { error: profileErr } = await supabase
            .from('user_profiles')
            .update({ plan })
            .eq('id', userId);
        if (profileErr) throw profileErr;

        // 4. Record payment
        const totalAmount = messageData?.totalPrice || messageData?.customerPay || payload.amount || 0;
        const amountCents = parseInt(totalAmount) * 100;

        await supabase.from('payment_history').insert({
            user_id:       userId,
            amount_cents:  amountCents,
            currency:      'idr',
            status:        'succeeded',
            paid_at:       new Date().toISOString(),
        });

        // 5. Upsert subscription
        const now    = new Date();
        const endDt  = new Date(now.getTime() + periodDays * 86400000);

        const { data: existSub } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('plan', plan)
            .maybeSingle();

        if (existSub) {
            await supabase
                .from('subscriptions')
                .update({
                    status:                'active',
                    current_period_start:  now.toISOString(),
                    current_period_end:    endDt.toISOString(),
                })
                .eq('id', existSub.id);
        } else {
            await supabase.from('subscriptions').insert({
                user_id:               userId,
                plan,
                status:                'active',
                current_period_start:  now.toISOString(),
                current_period_end:    endDt.toISOString(),
            });
        }

        console.log(`User ${email} upgraded to ${plan} (${periodDays}d) via Lynk.id`);
        res.status(200).json({ message: 'Callback processed successfully' });

    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(200).json({ message: 'Internal error tracked' });
    }
};
