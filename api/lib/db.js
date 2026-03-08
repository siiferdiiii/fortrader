const { neon } = require('@neondatabase/serverless');

/**
 * Get a SQL query function connected to Neon.tech
 * Uses HTTP-based serverless driver (no persistent connections)
 */
function getDB() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    return neon(process.env.DATABASE_URL);
}

module.exports = { getDB };
