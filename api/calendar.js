export default async function handler(req, res) {
    // Basic CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // Some APIs block default fetch user-agents
            }
        });
        
        if (!response.ok) {
            throw new Error(`Upstream error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Cache this response on Vercel Edge network for 1 hour to prevent rate limiting from faireconomy
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json(data);
    } catch (error) {
        console.error("Calendar fetch error:", error);
        res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
}
