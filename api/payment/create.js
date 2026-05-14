const { createClient } = require('@supabase/supabase-js');
const { createTransaction, PLAN_PRICES } = require('../lib/ipaymu');

// Server-side Supabase client dengan service_role (bypass RLS)
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// Helper responses
const sendJSON  = (res, code, data)    => res.status(code).json(data);
const sendError = (res, code, message) => res.status(code).json({ error: message });

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

    try {
        // Verify user via Supabase JWT (Authorization: Bearer <access_token>)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 401, 'Silakan login terlebih dahulu.');
        }

        const token    = authHeader.substring(7);
        const anonKey  = process.env.SUPABASE_ANON_KEY;
        const url      = process.env.SUPABASE_URL;
        if (!url || !anonKey) return sendError(res, 500, 'Server configuration error.');

        // Validate token via Supabase anon client
        const supabaseAnon = createClient(url, anonKey);
        const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
        if (authErr || !user) return sendError(res, 401, 'Token tidak valid. Silakan login ulang.');

        const { plan } = req.body;
        if (!plan || !PLAN_PRICES[plan]) {
            return sendError(res, 400, 'Plan tidak valid. Pilih basic atau pro.');
        }

        const supabase = getSupabaseAdmin();

        // Get user profile to check current plan
        const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('plan, full_name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileErr || !profile) return sendError(res, 404, 'User tidak ditemukan.');
        if (profile.plan === plan) return sendError(res, 400, `Kamu sudah berlangganan plan ${plan}.`);

        // Create iPaymu transaction
        const userData = {
            id:        user.id,
            email:     user.email,
            full_name: profile.full_name || user.user_metadata?.full_name || 'Trader',
        };
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
        const result = await createTransaction(plan, userData, appUrl);

        if (result.Status === 200 && result.Data && result.Data.Url) {
            // Record pending subscription
            await supabase.from('subscriptions').insert({
                user_id: user.id,
                plan,
                status:  'incomplete',
            });

            return sendJSON(res, 200, {
                message:    'Redirect ke halaman pembayaran...',
                paymentUrl: result.Data.Url,
                sessionId:  result.Data.SessionID || null,
            });
        } else {
            console.error('iPaymu error:', result);
            return sendError(res, 502, 'Gagal membuat transaksi pembayaran. Coba lagi nanti.');
        }

    } catch (err) {
        console.error('Payment create error:', err);
        return sendError(res, 500, 'Terjadi kesalahan server.');
    }
};
