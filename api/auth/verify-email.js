const { getDB } = require('../lib/db');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Token verifikasi tidak ditemukan.' });
        }

        const sql = getDB();

        // Find user with this verification token that hasn't expired
        const users = await sql`
            SELECT id, email, full_name 
            FROM users 
            WHERE verify_token = ${token} 
              AND verify_token_expires > NOW()
            LIMIT 1
        `;

        if (users.length === 0) {
            // Redirect to app with error
            const appUrl = `https://${req.headers.host || 'fortrader.com'}`;
            return res.writeHead(302, { Location: `${appUrl}/?verified=expired` }).end();
        }

        const user = users[0];

        // Mark email as verified and clear token
        await sql`
            UPDATE users 
            SET email_verified = TRUE, 
                verify_token = NULL, 
                verify_token_expires = NULL 
            WHERE id = ${user.id}
        `;

        console.log(`Email verified for user: ${user.email}`);

        // Redirect to app with success
        const appUrl = `https://${req.headers.host || 'fortrader.com'}`;
        return res.writeHead(302, { Location: `${appUrl}/?verified=true` }).end();

    } catch (err) {
        console.error('Email verification error:', err);
        const appUrl = `https://${req.headers.host || 'fortrader.com'}`;
        return res.writeHead(302, { Location: `${appUrl}/?verified=error` }).end();
    }
};
