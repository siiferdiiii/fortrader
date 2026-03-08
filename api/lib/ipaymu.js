const crypto = require('crypto');

const IPAYMU_SANDBOX_URL = 'https://sandbox.ipaymu.com/api/v2/payment';
const IPAYMU_PRODUCTION_URL = 'https://my.ipaymu.com/api/v2/payment';

/**
 * Plans and their prices in IDR
 * iPaymu works with IDR — prices converted from USD at ~16000 rate
 */
const PLAN_PRICES = {
    basic: {
        name: 'ForTrader Basic',
        price: 32000,   // ~$1.99 USD
        description: 'Langganan Basic — Unlimited Backtest & Jurnal (Bulanan)'
    },
    basic_3mo: {
        name: 'ForTrader Basic 3 Bulan',
        price: 48000,   // ~$2.99 USD ($0.99/bln × 3, hemat 50%)
        description: 'Langganan Basic — 3 Bulan (Hemat 50%)'
    },
    pro: {
        name: 'ForTrader Pro',
        price: 80000,   // ~$5 USD
        description: 'Langganan Pro — Full Features + AI Analisa (Bulanan)'
    },
    pro_3mo: {
        name: 'ForTrader Pro 3 Bulan',
        price: 120000,  // ~$7.50 USD ($2.50/bln × 3, hemat 50%)
        description: 'Langganan Pro — 3 Bulan (Hemat 50%)'
    }
};

/**
 * Generate iPaymu API signature
 * Format: HMAC-SHA256( "POST:VA:sha256(body):ApiKey", ApiKey )
 */
function generateSignature(body) {
    const va = process.env.IPAYMU_VA;
    const apiKey = process.env.IPAYMU_API_KEY;

    if (!va || !apiKey) throw new Error('iPaymu credentials not set');

    // SHA-256 hash of JSON body (lowercase hex)
    const bodyHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(body))
        .digest('hex')
        .toLowerCase();

    // StringToSign
    const stringToSign = `POST:${va}:${bodyHash}:${apiKey}`;

    // HMAC-SHA256 signature
    const signature = crypto
        .createHmac('sha256', apiKey)
        .update(stringToSign)
        .digest('hex');

    return signature;
}

/**
 * Create an iPaymu redirect payment transaction
 * @param {string} plan - 'basic' or 'pro'
 * @param {object} user - { id, email, fullName }
 * @param {string} appUrl - Base URL for callbacks
 * @returns {object} iPaymu API response with payment URL
 */
async function createTransaction(plan, user, appUrl) {
    const planInfo = PLAN_PRICES[plan];
    if (!planInfo) throw new Error('Invalid plan: ' + plan);

    const va = process.env.IPAYMU_VA;
    const apiKey = process.env.IPAYMU_API_KEY;
    const ipaymuUrl = process.env.IPAYMU_URL || IPAYMU_SANDBOX_URL;

    const body = {
        product: [planInfo.name],
        qty: [1],
        price: [planInfo.price],
        description: [planInfo.description],
        returnUrl: `${appUrl}/?page=account&payment=success`,
        notifyUrl: `${appUrl}/api/payment/callback`,
        cancelUrl: `${appUrl}/?page=account&payment=cancelled`,
        buyerName: user.full_name || user.fullName || 'Trader',
        buyerEmail: user.email,
        referenceId: `${user.id}_${plan}_${Date.now()}`
    };

    const bodyString = JSON.stringify(body);
    const signature = generateSignature(body);

    // Timestamp format: YYYYMMDDHHmmss
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

    console.log('iPaymu request:', { url: ipaymuUrl, va, timestamp, plan });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(ipaymuUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'va': va,
                'signature': signature,
                'timestamp': timestamp
            },
            body: bodyString,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();
        console.log('iPaymu response:', JSON.stringify(result));
        return result;
    } catch (err) {
        clearTimeout(timeoutId);
        console.error('iPaymu fetch error:', err.message);
        throw err;
    }
}

module.exports = {
    PLAN_PRICES,
    generateSignature,
    createTransaction
};
