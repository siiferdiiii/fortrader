const { getDB } = require('../lib/db');
const { getUserFromRequest, sendJSON, sendError } = require('../lib/auth-helpers');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

    try {
        const decoded = getUserFromRequest(req);
        if (!decoded) {
            return sendError(res, 401, 'Silakan login terlebih dahulu.');
        }

        const sql = getDB();

        // Get user data
        const users = await sql`
            SELECT id, email, full_name, email_verified 
            FROM users WHERE id = ${decoded.id}
        `;

        if (users.length === 0) {
            return sendError(res, 404, 'User tidak ditemukan.');
        }

        const user = users[0];

        if (user.email_verified) {
            return sendJSON(res, 200, { message: 'Email sudah diverifikasi.' });
        }

        // Generate new verification token
        const crypto = require('crypto');
        const verifyToken = crypto.randomUUID();
        const tokenExpires = new Date();
        tokenExpires.setHours(tokenExpires.getHours() + 24);

        // Save token
        await sql`
            UPDATE users 
            SET verify_token = ${verifyToken}, verify_token_expires = ${tokenExpires} 
            WHERE id = ${user.id}
        `;

        // Send email via Brevo
        const BREVO_API_KEY = process.env.BREVO_API_KEY;

        if (!BREVO_API_KEY) {
            console.error('BREVO_API_KEY not set');
            return sendError(res, 500, 'Layanan email belum dikonfigurasi.');
        }

        const appUrl = `https://${req.headers.host || 'fortrader.com'}`;
        const verifyLink = `${appUrl}/api/auth/verify-email?token=${verifyToken}`;

        const brevoPayload = {
            sender: {
                name: "ForTrader",
                email: "noreply@fortrader.com"
            },
            to: [{ email: user.email, name: user.full_name }],
            subject: "Verifikasi Email Akun ForTrader Anda",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; color: #333;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #6366f1; margin: 0;">ForTrader</h2>
                    </div>
                    <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                        <h3 style="margin-top: 0; color: #1f2937;">Halo ${user.full_name},</h3>
                        <p style="line-height: 1.6;">Silakan klik tombol di bawah untuk memverifikasi email Anda:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verifyLink}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verifikasi Email Sekarang</a>
                        </div>
                        <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 30px; margin-bottom: 5px;">
                            Atau salin link berikut secara manual:
                        </p>
                        <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all; font-family: monospace; font-size: 12px; color: #4b5563;">
                            ${verifyLink}
                        </div>
                        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">Link ini akan kedaluwarsa dalam 24 jam.</p>
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
            console.error('Brevo resend verification error:', errorData);
            return sendError(res, 502, 'Gagal mengirim email. Coba lagi nanti.');
        }

        sendJSON(res, 200, { message: 'Email verifikasi berhasil dikirim ulang.' });

    } catch (err) {
        console.error('Resend verification error:', err);
        sendError(res, 500, 'Terjadi kesalahan server.');
    }
};
