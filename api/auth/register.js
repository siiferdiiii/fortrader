const { getDB } = require('../lib/db');
const { hashPassword, createToken, sendJSON, sendError } = require('../lib/auth-helpers');

module.exports = async function handler(req, res) {
    // Only allow POST
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

    try {
        const { email, password, fullName } = req.body;

        // Validate input
        if (!email || !password || !fullName) {
            return sendError(res, 400, 'Email, password, dan nama lengkap wajib diisi.');
        }

        if (password.length < 6) {
            return sendError(res, 400, 'Password minimal 6 karakter.');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendError(res, 400, 'Format email tidak valid.');
        }

        const sql = getDB();

        // Check if email already exists
        const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
        if (existing.length > 0) {
            return sendError(res, 409, 'Email sudah terdaftar. Silakan login.');
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Insert user
        const result = await sql`
            INSERT INTO users (email, password_hash, full_name, plan)
            VALUES (${email.toLowerCase()}, ${passwordHash}, ${fullName}, 'free')
            RETURNING id, email, full_name, plan, created_at
        `;

        const user = result[0];

        // Create JWT token
        const token = createToken({
            id: user.id,
            email: user.email,
            plan: user.plan
        });

        sendJSON(res, 201, {
            message: 'Akun berhasil dibuat!',
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
        console.error('Register error:', err);
        sendError(res, 500, 'Terjadi kesalahan server. Coba lagi nanti.');
    }
};
