// Vercel Serverless Function — Double-Cached Aviation Edge Flights
// Layer 1: In-memory cache (survives across warm invocations, 60s TTL)
// Layer 2: Vercel CDN edge cache (s-maxage=60, stale-while-revalidate=120)
// Result: ONE API call per ~60s regardless of traffic volume
// API key stays server-side (never exposed to browser)

// ── In-memory cache (persists across warm Vercel invocations) ──
let cachedData = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60000; // 60 seconds — one API call per minute max

export default async function handler(req, res) {
    const API_KEY = process.env.AVIATION_EDGE_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'Aviation Edge API key not configured' });
    }

    const now = Date.now();
    const cacheAge = now - cachedAt;

    // ── Serve from in-memory cache if fresh ──
    if (cachedData && cacheAge < CACHE_TTL_MS) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Data-Age', String(Math.round(cacheAge / 1000)));
        res.setHeader('X-Data-Timestamp', String(cachedAt));
        return res.status(200).json(cachedData);
    }

    // ── Fetch fresh from Aviation Edge ──
    try {
        const response = await fetch(
            `https://aviation-edge.com/v2/public/flights?key=${API_KEY}&limit=30000`,
            { signal: AbortSignal.timeout(25000) }
        );

        if (!response.ok) {
            // If API fails but we have stale cache, serve stale
            if (cachedData) {
                res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('X-Cache-Status', 'STALE');
                res.setHeader('X-Data-Age', String(Math.round(cacheAge / 1000)));
                return res.status(200).json(cachedData);
            }
            return res.status(response.status).json({
                error: `Aviation Edge returned ${response.status}`
            });
        }

        const data = await response.json();

        // Update in-memory cache
        cachedData = data;
        cachedAt = Date.now();

        // CDN cache: 60s fresh, serve stale for up to 120s while revalidating
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache-Status', 'MISS');
        res.setHeader('X-Data-Age', '0');
        res.setHeader('X-Data-Timestamp', String(cachedAt));

        return res.status(200).json(data);
    } catch (err) {
        console.error('[flights] Aviation Edge fetch error:', err.message);
        // Serve stale cache if available
        if (cachedData) {
            res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Cache-Status', 'STALE-ERROR');
            res.setHeader('X-Data-Age', String(Math.round(cacheAge / 1000)));
            return res.status(200).json(cachedData);
        }
        return res.status(502).json({ error: 'Failed to fetch flights' });
    }
}
