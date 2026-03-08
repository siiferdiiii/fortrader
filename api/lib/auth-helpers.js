const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password
 */
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain-text password against hash
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Create a JWT token for a user
 */
function createToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            plan: user.plan
        },
        secret,
        { expiresIn: '7d' }
    );
}

/**
 * Verify and decode a JWT token
 */
function verifyToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');

    return jwt.verify(token, secret);
}

/**
 * Extract user from Authorization header
 * Returns decoded user payload or null
 */
function getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.substring(7);
    try {
        return verifyToken(token);
    } catch (err) {
        return null;
    }
}

/**
 * Send JSON response helper
 */
function sendJSON(res, statusCode, data) {
    res.status(statusCode).json(data);
}

/**
 * Send error response helper
 */
function sendError(res, statusCode, message) {
    res.status(statusCode).json({ error: message });
}

module.exports = {
    hashPassword,
    verifyPassword,
    createToken,
    verifyToken,
    getUserFromRequest,
    sendJSON,
    sendError
};
