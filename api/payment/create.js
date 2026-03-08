const { getDB } = require('../lib/db');
const { getUserFromRequest, sendJSON, sendError } = require('../lib/auth-helpers');
const { createTransaction, PLAN_PRICES } = require('../lib/ipaymu');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

    try {
        // Verify user is logged in
        const decoded = getUserFromRequest(req);
        if (!decoded) {
            return sendError(res, 401, 'Silakan login terlebih dahulu.');
        }

        const { plan } = req.body;

        // Validate plan
        if (!plan || !PLAN_PRICES[plan]) {
            return sendError(res, 400, 'Plan tidak valid. Pilih basic atau pro.');
        }

        const sql = getDB();

        // Get user data
        const users = await sql`SELECT id, email, full_name, plan FROM users WHERE id = ${decoded.id}`;
        if (users.length === 0) {
            return sendError(res, 404, 'User tidak ditemukan.');
        }

        const user = users[0];

        // Don't allow downgrade or same plan purchase
        if (user.plan === plan) {
            return sendError(res, 400, `Kamu sudah berlangganan plan ${plan}.`);
        }

        // Create iPaymu transaction
        const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
        const result = await createTransaction(plan, user, appUrl);

        if (result.Status === 200 && result.Data && result.Data.Url) {
            // Save pending subscription
            await sql`
                INSERT INTO subscriptions (user_id, plan, status)
                VALUES (${user.id}, ${plan}, 'incomplete')
            `;

            sendJSON(res, 200, {
                message: 'Redirect ke halaman pembayaran...',
                paymentUrl: result.Data.Url,
                sessionId: result.Data.SessionID || null
            });
        } else {
            console.error('iPaymu error:', result);
            sendError(res, 502, 'Gagal membuat transaksi pembayaran. Coba lagi nanti.');
        }

    } catch (err) {
        console.error('Payment create error:', err);
        sendError(res, 500, 'Terjadi kesalahan server.');
    }
};
