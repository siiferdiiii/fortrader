export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ message: 'Token reset dan password baru diwajibkan' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password minimal 6 karakter' });
    }

    try {
        const bcrypt = await import('bcryptjs');
        const { getDB } = await import('../lib/db.js');
        const sql = getDB();

        // 1. Verify token exists and has not expired
        const usersInfo = await sql`
            SELECT id, email 
            FROM users 
            WHERE reset_token = ${token} 
              AND reset_token_expires > NOW()
            LIMIT 1
        `;
        
        if (usersInfo.length === 0) {
            return res.status(400).json({ 
                message: 'Link reset password tidak valid atau sudah kedaluwarsa. Silakan ajukan Lupa Password kembali.' 
            });
        }

        const user = usersInfo[0];

        // 2. Hash the new password using explicit salting
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Update password and invalidate the token
        await sql`
            UPDATE users 
            SET password_hash = ${hashedPassword},
                reset_token = NULL,
                reset_token_expires = NULL,
                updated_at = NOW()
            WHERE id = ${user.id}
        `;

        // 4. Return success
        return res.status(200).json({ 
            message: 'Password berhasil diperbarui. Silakan login kembali dengan password baru Anda.' 
        });

    } catch (error) {
        console.error('Reset Password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
