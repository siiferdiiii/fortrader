export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ message: 'Email diwajibkan' });
    }

    try {
        const { getDB } = await import('../lib/db.js');
        const sql = getDB();

        // 1. Check if user exists
        const users = await sql`SELECT id, full_name, plan FROM users WHERE email = ${email} LIMIT 1`;
        
        if (users.length === 0) {
            // Security Best Practice: Don't reveal if email exists or not to prevent enumeration attacks
            return res.status(200).json({ message: 'Jika email terdaftar, link reset telah dikirim.' });
        }

        const user = users[0];

        // 2. Generate a secure random token (UUID works well)
        // Note: For a real production app, you might want to crypto.randomBytes()
        const crypto = await import('crypto');
        const resetToken = crypto.randomUUID();
        
        // 3. Set expiration (1 hour from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        // 4. Save token to database
        await sql`
            UPDATE users 
            SET reset_token = ${resetToken}, 
                reset_token_expires = ${expiresAt}
            WHERE id = ${user.id}
        `;

        // 5. Send Email via Brevo REST API
        const BREVO_API_KEY = process.env.BREVO_API_KEY;
        
        if (!BREVO_API_KEY) {
            console.error('CRITICAL: BREVO_API_KEY environment variable is missing.');
            return res.status(500).json({ message: 'Server configuration error (Email service not configured)' });
        }

        const resetLink = `https://${req.headers.host || 'fortrader.com'}/?reset_token=${resetToken}`;

        const brevoPayload = {
            sender: {
                name: "ForTrader Support",
                email: "noreply@fortrader.com" // You can change this to your verified Brevo sender domain later
            },
            to: [
                {
                    email: email,
                    name: user.full_name
                }
            ],
            subject: "Reset Password Akun ForTrader Anda",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; color: #333;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #6366f1; margin: 0;">ForTrader</h2>
                    </div>
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h3 style="margin-top: 0; color: #1f2937;">Halo ${user.full_name},</h3>
                        <p style="line-height: 1.6;">Kami menerima permintaan untuk mereset password akun ForTrader Anda. Jika Anda merasa tidak melakukan permintaan ini, silakan abaikan email ini.</p>
                        <p style="line-height: 1.6;">Untuk membuat password baru, silakan klik tombol di bawah ini (Link kedaluwarsa dalam 1 jam):</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetLink}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password Sekarang</a>
                        </div>
                        <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 30px; margin-bottom: 5px;">
                            Atau salin link berikut secara manual:
                        </p>
                        <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all; font-family: monospace; font-size: 12px; color: #4b5563;">
                            ${resetLink}
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
                        &copy; ${new Date().getFullYear()} ForTrader. All rights reserved.
                    </div>
                </div>
            `
        };

        const brevoReq = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(brevoPayload)
        });

        if (!brevoReq.ok) {
            const errorData = await brevoReq.text();
            console.error('Brevo API Error:', errorData);
            return res.status(500).json({ message: 'Gagal mengirim email reset password. Silakan coba lagi.' });
        }

        // 6. Return Success
        return res.status(200).json({ 
            message: 'Jika email terdaftar, link reset telah dikirim.'
        });

    } catch (error) {
        console.error('Forgot Password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
