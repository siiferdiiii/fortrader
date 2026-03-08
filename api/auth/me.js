const { getDB } = require('../lib/db');
const { getUserFromRequest, sendJSON, sendError } = require('../lib/auth-helpers');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return sendError(res, 405, 'Method not allowed');

    try {
        // Verify JWT from Authorization header
        const decoded = getUserFromRequest(req);
        if (!decoded) {
            return sendError(res, 401, 'Token tidak valid atau sudah expired.');
        }

        const sql = getDB();

        // Get fresh user data from database
        const result = await sql`
            SELECT id, email, full_name, plan, avatar_url, email_verified, created_at, last_login_at
            FROM users
            WHERE id = ${decoded.id}
        `;

        if (result.length === 0) {
            return sendError(res, 404, 'User tidak ditemukan.');
        }

        const user = result[0];

        // Get active subscription if any
        const subs = await sql`
            SELECT plan, status, current_period_end
            FROM subscriptions
            WHERE user_id = ${user.id} AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        `;

        sendJSON(res, 200, {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                plan: user.plan,
                avatarUrl: user.avatar_url,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            },
            subscription: subs.length > 0 ? subs[0] : null
        });

    } catch (err) {
        console.error('Me error:', err);
        sendError(res, 500, 'Terjadi kesalahan server.');
    }
};
