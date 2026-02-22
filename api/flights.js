// Vercel Serverless Function — Cached Aviation Edge Flights
// All visitors share the same cached response for 90 seconds
// API key stays server-side (never exposed to browser)

export default async function handler(req, res) {
    const API_KEY = process.env.AVIATION_EDGE_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'Aviation Edge API key not configured' });
    }

    try {
        const response = await fetch(
            `https://aviation-edge.com/v2/public/flights?key=${API_KEY}&limit=30000`,
            { signal: AbortSignal.timeout(25000) }
        );

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Aviation Edge returned ${response.status}`
            });
        }

        const data = await response.json();

        // Cache on Vercel CDN for 90 seconds
        // s-maxage = CDN cache (shared across all visitors)
        // stale-while-revalidate = serve stale while fetching fresh (no downtime)
        res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=30');
        res.setHeader('Content-Type', 'application/json');

        return res.status(200).json(data);
    } catch (err) {
        console.error('[flights] Aviation Edge fetch error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch flights' });
    }
}
