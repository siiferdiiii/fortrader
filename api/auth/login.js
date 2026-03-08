const { getDB } = require('../lib/db');
const { verifyPassword, createToken, sendJSON, sendError } = require('../lib/auth-helpers');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return sendError(res, 400, 'Email dan password wajib diisi.');
        }

        const sql = getDB();

        // Find user by email
        const result = await sql`
            SELECT id, email, password_hash, full_name, plan, created_at
            FROM users
            WHERE email = ${email.toLowerCase()}
        `;

        if (result.length === 0) {
            return sendError(res, 401, 'Email atau password salah.');
        }

        const user = result[0];

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);
        if (!isValid) {
            return sendError(res, 401, 'Email atau password salah.');
        }

        // Update last login
        await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

        // Create JWT token
        const token = createToken({
            id: user.id,
            email: user.email,
            plan: user.plan
        });

        sendJSON(res, 200, {
            message: 'Login berhasil!',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                plan: user.plan,
                createdAt: user.created_at
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        sendError(res, 500, 'Terjadi kesalahan server. Coba lagi nanti.');
    }
};
