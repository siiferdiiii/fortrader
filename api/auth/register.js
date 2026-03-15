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

        // Generate verification token
        const crypto = require('crypto');
        const verifyToken = crypto.randomUUID();
        const tokenExpires = new Date();
        tokenExpires.setHours(tokenExpires.getHours() + 24); // 24 hour expiry

        // Insert user with verification token
        const result = await sql`
            INSERT INTO users (email, password_hash, full_name, plan, verify_token, verify_token_expires)
            VALUES (${email.toLowerCase()}, ${passwordHash}, ${fullName}, 'free', ${verifyToken}, ${tokenExpires})
            RETURNING id, email, full_name, plan, created_at
        `;

        const user = result[0];

        // Send verification email via Brevo
        const BREVO_API_KEY = process.env.BREVO_API_KEY;

        if (BREVO_API_KEY) {
            const appUrl = `https://${req.headers.host || 'fortrader.com'}`;
            const verifyLink = `${appUrl}/api/auth/verify-email?token=${verifyToken}`;

            const brevoPayload = {
                sender: {
                    name: "ForTrader",
                    email: "noreply@fortrader.com"
                },
                to: [
                    {
                        email: email.toLowerCase(),
                        name: fullName
                    }
                ],
                subject: "Verifikasi Email Akun ForTrader Anda",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; color: #333;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #6366f1; margin: 0;">ForTrader</h2>
                        </div>
                        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                            <h3 style="margin-top: 0; color: #1f2937;">Halo ${fullName},</h3>
                            <p style="line-height: 1.6;">Terima kasih telah mendaftar di ForTrader! Untuk mengaktifkan akun Anda, silakan verifikasi email dengan klik tombol di bawah ini:</p>
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

            try {
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
                    console.error('Brevo verification email error:', errorData);
                    // Don't block registration if email fails — user can request resend later
                }
            } catch (emailErr) {
                console.error('Failed to send verification email:', emailErr);
                // Don't block registration
            }
        } else {
            console.warn('BREVO_API_KEY not set — verification email not sent.');
        }

        // Create JWT token (user can login immediately, Option A)
        const token = createToken({
            id: user.id,
            email: user.email,
            plan: user.plan
        });

        sendJSON(res, 201, {
            message: 'Akun berhasil dibuat! Silakan cek email untuk verifikasi.',
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                plan: user.plan,
                createdAt: user.created_at,
                emailVerified: false
            }
        });

    } catch (err) {
        console.error('Register error:', err);
        sendError(res, 500, 'Terjadi kesalahan server. Coba lagi nanti.');
    }
};
