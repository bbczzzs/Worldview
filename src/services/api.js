/**
 * Real-time data services for WORLDVIEW
 * - Live flights from Aviation Edge API
 * - Real satellites from CelesTrak + satellite.js
 */

import * as satellite from 'satellite.js';
// ══════════════════════════════════════════════════════
//  FLIGHT ENGINE — Aviation Edge API
//  Single API call → ALL global flights
// ══════════════════════════════════════════════════════

// Airline ICAO code → name decoder
const AIRLINES = {
    AAL: 'American Airlines', AAR: 'Asiana', ACA: 'Air Canada', AFR: 'Air France',
    AIC: 'Air India', AIJ: 'Interjet', ANA: 'All Nippon Airways', ASA: 'Alaska Airlines',
    AUA: 'Austrian', AVA: 'Avianca', AZA: 'Alitalia/ITA', BAW: 'British Airways',
    BEL: 'Brussels Airlines', CAL: 'China Airlines', CCA: 'Air China', CES: 'China Eastern',
    CLH: 'Lufthansa CityLine', CPA: 'Cathay Pacific', CSN: 'China Southern', DAL: 'Delta',
    DLH: 'Lufthansa', EIN: 'Aer Lingus', EJU: 'easyJet Europe', ETD: 'Etihad',
    ETH: 'Ethiopian', EVA: 'EVA Air', EWG: 'Eurowings', EZY: 'easyJet',
    FDX: 'FedEx Express', FIN: 'Finnair', GAI: 'GlobeAir', GTI: 'Atlas Air',
    GWI: 'Germanwings', HAL: 'Hawaiian Airlines', IBE: 'Iberia', ICE: 'Icelandair',
    INO: 'Flyone', JAL: 'Japan Airlines', JBU: 'JetBlue', KAL: 'Korean Air',
    KLM: 'KLM Royal Dutch', LAN: 'LATAM Chile', LOT: 'LOT Polish', MSR: 'EgyptAir',
    NAX: 'Norwegian', NKS: 'Spirit Airlines', PAL: 'Philippine Airlines', PIA: 'Pakistan Intl',
    QFA: 'Qantas', QTR: 'Qatar Airways', RAM: 'Royal Air Maroc', RYR: 'Ryanair',
    SAS: 'Scandinavian', SAA: 'South African', SIA: 'Singapore Airlines', SKW: 'SkyWest',
    SLK: 'Silk Air', SWA: 'Southwest', SWR: 'Swiss Intl', TAP: 'TAP Air Portugal',
    THA: 'Thai Airways', THY: 'Turkish Airlines', TOM: 'TUI Airways', UAE: 'Emirates',
    UAL: 'United Airlines', UPS: 'UPS Airlines', VIR: 'Virgin Atlantic', VOZ: 'Virgin Australia',
    VJT: 'VistaJet', WZZ: 'Wizz Air', AEE: 'Aegean Airlines', AMX: 'Aeromexico',
    AJT: 'Amerijet', ANZ: 'Air New Zealand', AST: 'Star Air',
    CKS: 'Kalitta Air', CLX: 'Cargolux',
    CXA: 'Xiamen Air', ELY: 'El Al', FPO: 'ASL Airlines',
    GIA: 'Garuda Indonesia', JST: 'Jetstar', MAS: 'Malaysia Airlines',
    NOZ: 'Nordic Aviation', OMA: 'Oman Air', PAC: 'Polar Air Cargo', PGT: 'Pegasus',
    RJA: 'Royal Jordanian', ROT: 'TAROM', SBI: 'S7 Airlines', SEH: 'SunExpress',
    SVA: 'Saudia', TCX: 'Thomas Cook', TGW: 'Tiger Air', TVF: 'Transavia France',
    VLG: 'Vueling', WJA: 'WestJet',
};

function decodeAirline(callsign) {
    if (!callsign || callsign.length < 3) return '';
    const prefix = callsign.substring(0, 3).toUpperCase();
    return AIRLINES[prefix] || '';
}

// Aircraft type → visual category for different map icons
const HEAVY_TYPES = new Set([
    'A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345', 'A346',
    'A359', 'A35K', 'A380', 'A388',
    'B744', 'B748', 'B74S', 'B752', 'B753', 'B762', 'B763', 'B764',
    'B772', 'B773', 'B77L', 'B77W', 'B788', 'B789', 'B78X',
    'C17', 'AN12', 'AN24', 'IL76', 'IL96', 'MD11',
]);
const REGIONAL_TYPES = new Set([
    'E170', 'E175', 'E190', 'E195', 'E75L', 'E75S',
    'CRJ2', 'CRJ7', 'CRJ9', 'CRJX',
    'AT43', 'AT45', 'AT72', 'AT76', 'ATR', 'DH8A', 'DH8B', 'DH8C', 'DH8D',
    'SF34', 'JS41', 'B190', 'BE1900', 'SW4', 'F50', 'F70',
]);
const HELI_TYPES = new Set([
    'EC35', 'EC45', 'EC55', 'EC75', 'H125', 'H130', 'H135', 'H145', 'H155', 'H160',
    'H175', 'H215', 'H225', 'AS32', 'AS50', 'AS55', 'AS65',
    'B06', 'B06T', 'B105', 'B212', 'B214', 'B407', 'B412', 'B429', 'B430',
    'S76', 'S92', 'R22', 'R44', 'R66', 'A109', 'A119', 'A139', 'A169', 'A189',
    'UH1', 'UH60', 'AH64', 'CH47', 'MI8', 'MI17', 'MI24', 'MI26',
]);
const LIGHT_TYPES = new Set([
    'C150', 'C152', 'C172', 'C182', 'C206', 'C208', 'C210', 'C310', 'C340', 'C402', 'C414', 'C421', 'C425',
    'BE33', 'BE35', 'BE36', 'BE55', 'BE58', 'BE9L', 'BE20', 'BE30', 'BE40',
    'P28A', 'P28B', 'P28R', 'P28T', 'P46T', 'PA24', 'PA30', 'PA31', 'PA32', 'PA34', 'PA44', 'PA46',
    'DA40', 'DA42', 'DA62', 'SR20', 'SR22', 'TBM7', 'TBM8', 'TBM9', 'PC12', 'PC24',
    'GLID', 'ULAC',
]);

function classifyAircraft(icaoType) {
    if (!icaoType) return 'jet';
    const t = icaoType.toUpperCase();
    if (HELI_TYPES.has(t)) return 'helicopter';
    if (HEAVY_TYPES.has(t)) return 'heavy';
    if (REGIONAL_TYPES.has(t)) return 'regional';
    if (LIGHT_TYPES.has(t)) return 'light';
    // Default: if starts with A3/A2/B7/B73 → jet, else jet
    return 'jet';
}

// ══════════════════════════════════════════════════════
//  DUAL-ENGINE FLIGHT SYSTEM
//  Primary: adsb.lol (FREE, real-time ADS-B, ~0.1s delay, no key)
//  Secondary: Aviation Edge (paid, ~60s delay, has airline/route enrichment)
//  Merger: ICAO24 hex dedup → adsb.lol position wins, AE enriches metadata
// ══════════════════════════════════════════════════════

// ── Aviation Edge enrichment cache (route/airline info — updated slowly) ──
let _aeEnrichment = new Map(); // icao24 → { airline, depAirport, arrAirport }
let _aeLastFetch = 0;
const AE_ENRICH_TTL = 120000; // Refresh enrichment data every 2 minutes

/**
 * Fetch from adsb.lol — PRIMARY source (real-time ADS-B)
 * Free, no API key, no rate limits, CORS-enabled
 * Returns global aircraft with sub-second freshness
 */
async function fetchAdsbLol() {
    try {
        // Use proxy to bypass CORS (Vite proxy in dev, Vercel rewrite in prod)
        const url = '/proxy/adsblol/v2/lat/0/lon/0/dist/18000';
        const res = await fetch(
            url,
            { signal: AbortSignal.timeout(20000) }
        );
        if (!res.ok) {
            console.warn(`[WORLDVIEW] adsb.lol HTTP ${res.status}`);
            return null;
        }
        const data = await res.json();
        const ac = data.ac || data.aircraft || [];
        if (!Array.isArray(ac)) return null;

        const flights = [];
        for (const f of ac) {
            const lat = parseFloat(f.lat);
            const lng = parseFloat(f.lon);
            if (isNaN(lat) || isNaN(lng)) continue;
            if (lat === 0 && lng === 0) continue;

            const hex = (f.hex || '').toLowerCase().trim();
            if (!hex) continue;

            // Handle altitude — alt_baro can be "ground" string
            const rawAlt = f.alt_baro;
            if (rawAlt === 'ground' || rawAlt === 'Ground') continue; // Skip ground aircraft
            const altFt = parseFloat(rawAlt) || parseFloat(f.alt_geom) || 0;
            if (altFt <= 0) continue; // Skip aircraft with no altitude

            const heading = parseFloat(f.track) || parseFloat(f.true_heading) || parseFloat(f.mag_heading) || 0;
            const gs = parseFloat(f.gs) || 0; // ground speed in knots
            const vRate = parseFloat(f.baro_rate) || parseFloat(f.geom_rate) || 0;
            const callsign = (f.flight || '').trim();
            const reg = (f.r || '').trim();
            const acType = (f.t || '').trim();
            const squawk = f.squawk || '—';
            const category = f.category || '';

            // Determine flight status
            const flightStatus = vRate > 300 ? 'CLIMBING' : vRate < -300 ? 'DESCENDING' : 'CRUISING';

            // Determine aircraft visual category
            let visCategory = classifyAircraft(acType);
            // Also check ADS-B category field (A1=light, A3=large, A5=heavy)
            if (category === 'A5' || category === 'A4') visCategory = 'heavy';
            else if (category === 'A1') visCategory = 'light';
            else if (category === 'A7' || category === 'B2') visCategory = 'helicopter';

            // Lookup enrichment from Aviation Edge (airline name, route)
            const enrichment = _aeEnrichment.get(hex) || {};

            flights.push({
                id: hex,
                callsign: callsign || '—',
                airline: enrichment.airline || decodeAirline(callsign) || '',
                lat,
                lng,
                alt: Math.max(0.005, altFt / 10000000),
                altMeters: altFt * 0.3048,
                altFeet: altFt,
                speed: gs ? `${Math.round(gs)} kts` : '—',
                speedKts: gs || 0,
                heading,
                country: f.origin_country || '',
                registration: reg,
                aircraftType: acType,
                aircraftDesc: '',
                category: visCategory,
                flightLevel: altFt ? `FL${Math.round(altFt / 100)}` : '—',
                verticalRate: vRate ? vRate / 60 : 0,
                squawk,
                geoAlt: altFt,
                status: flightStatus,
                depAirport: enrichment.depAirport || '',
                arrAirport: enrichment.arrAirport || '',
                _source: 'adsb.lol',
            });
        }

        console.log(`[WORLDVIEW] ✅ ${flights.length} flights from adsb.lol (real-time ADS-B)`);
        return flights.length > 0 ? flights : null;
    } catch (err) {
        console.warn('[WORLDVIEW] adsb.lol error:', err.message);
        return null;
    }
}

/**
 * Fetch from Aviation Edge — SECONDARY source (enrichment + fallback)
 * Paid API, ~60s delay, but has airline names and route info
 */
async function fetchAviationEdge() {
    try {
        const isDev = import.meta.env.DEV;
        let url;

        if (isDev) {
            const key = import.meta.env.VITE_AVIATION_EDGE_KEY;
            if (!key) return null;
            url = `/proxy/aviationedge/v2/public/flights?key=${key}&limit=30000`;
        } else {
            url = '/api/flights';
        }

        const res = await fetch(url, {
            signal: AbortSignal.timeout(20000),
            cache: 'no-store',
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (!Array.isArray(data)) return null;

        const flights = [];
        for (const f of data) {
            const geo = f.geography || {};
            const lat = parseFloat(geo.latitude);
            const lng = parseFloat(geo.longitude);
            if (isNaN(lat) || isNaN(lng)) continue;
            if (lat === 0 && lng === 0) continue;

            const altFt = parseFloat(geo.altitude) || 0;
            const heading = parseFloat(geo.direction) || 0;
            const hSpeed = parseFloat((f.speed || {}).horizontal) || 0;
            const vSpeed = parseFloat((f.speed || {}).vspeed) || 0;

            const flightIcao = (f.flight || {}).icaoNumber || '';
            const flightIata = (f.flight || {}).iataNumber || '';
            const callsign = flightIcao || flightIata || '';
            const airlineIcao = (f.airline || {}).icaoCode || '';
            const airlineIata = (f.airline || {}).iataCode || '';
            const airline = decodeAirline(airlineIcao) || airlineIcao || airlineIata;

            const depIata = (f.departure || {}).iataCode || '';
            const arrIata = (f.arrival || {}).iataCode || '';
            const acIcao24 = ((f.aircraft || {}).icao24 || '').toLowerCase().trim();
            const acReg = (f.aircraft || {}).regNumber || '';
            const acIcaoCode = (f.aircraft || {}).icaoCode || '';
            const squawk = (f.system || {}).squawk || '—';

            const flightStatus = vSpeed > 100 ? 'CLIMBING' : vSpeed < -100 ? 'DESCENDING' : 'CRUISING';

            // Store enrichment data for adsb.lol merger
            if (acIcao24 && (airline || depIata || arrIata)) {
                _aeEnrichment.set(acIcao24, { airline, depAirport: depIata, arrAirport: arrIata });
            }

            flights.push({
                id: acIcao24 || `ae-${callsign}-${lat.toFixed(2)}`,
                callsign: callsign || '—',
                airline,
                lat,
                lng,
                alt: Math.max(0.005, altFt / 10000000),
                altMeters: altFt * 0.3048,
                altFeet: altFt,
                speed: hSpeed ? `${Math.round(hSpeed)} kts` : '—',
                speedKts: hSpeed || 0,
                heading,
                country: '',
                registration: acReg,
                aircraftType: acIcaoCode,
                aircraftDesc: '',
                category: classifyAircraft(acIcaoCode),
                flightLevel: altFt ? `FL${Math.round(altFt / 100)}` : '—',
                verticalRate: vSpeed ? vSpeed / 60 : 0,
                squawk,
                geoAlt: altFt,
                status: flightStatus,
                depAirport: depIata,
                arrAirport: arrIata,
                _source: 'aviation-edge',
            });
        }

        console.log(`[WORLDVIEW] ✅ ${flights.length} flights from Aviation Edge (enrichment)`);
        return flights.length > 0 ? flights : null;
    } catch (err) {
        console.warn('[WORLDVIEW] Aviation Edge error:', err.message);
        return null;
    }
}

/**
 * MAIN ENTRY — Dual-engine merger
 * 1. adsb.lol = PRIMARY (real-time positions, refreshed every 10s)
 * 2. Aviation Edge = ENRICHMENT (airline/route data, refreshed every 2min)
 * 3. Merge: adsb.lol position wins, AE fills in airline names + routes
 */
export async function fetchLiveFlights() {
    // Always try adsb.lol first (primary, real-time)
    const adsbData = await fetchAdsbLol();

    // Refresh Aviation Edge enrichment data in background (every 2 min)
    const now = Date.now();
    if (now - _aeLastFetch > AE_ENRICH_TTL) {
        _aeLastFetch = now;
        // Fire and forget — don't block the real-time data
        fetchAviationEdge().then(aeData => {
            if (aeData) {
                console.log(`[WORLDVIEW] 🔗 Aviation Edge enrichment updated (${_aeEnrichment.size} aircraft enriched)`);
            }
        }).catch(() => { });
    }

    // If adsb.lol succeeded, return it (with any available enrichment already applied)
    if (adsbData) return adsbData;

    // Fallback: If adsb.lol is down, use Aviation Edge directly
    console.warn('[WORLDVIEW] adsb.lol unavailable, falling back to Aviation Edge...');
    const aeData = await fetchAviationEdge();
    if (aeData) return aeData;

    return null;
}

// ══════════════════════════════════════════════════════
//  EARTHQUAKES — USGS GeoJSON Feed (free, no key)
// ══════════════════════════════════════════════════════

export async function fetchEarthquakes() {
    try {
        const res = await fetch(
            'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
            { signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.features) return null;

        const quakes = data.features.map(f => {
            const [lng, lat, depthKm] = f.geometry.coordinates;
            const p = f.properties;
            return {
                id: f.id,
                lat,
                lng,
                magnitude: p.mag || 0,
                depth: depthKm || 0,
                place: p.place || 'Unknown',
                time: p.time,
                type: p.type || 'earthquake',
                tsunami: p.tsunami || 0,
            };
        }).filter(q => q.magnitude >= 1); // Only show mag 1+

        console.log(`[WORLDVIEW] ✅ ${quakes.length} earthquakes from USGS`);
        return quakes;
    } catch (err) {
        console.error('[WORLDVIEW] USGS fetch error:', err);
        return null;
    }
}

// ══════════════════════════════════════════════════════
//  WEATHER RADAR — RainViewer (free, no key)
// ══════════════════════════════════════════════════════

export async function fetchWeatherRadarTimestamp() {
    try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json',
            { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        // Get the latest radar frame
        const frames = data.radar?.past || [];
        if (frames.length === 0) return null;
        const latest = frames[frames.length - 1];
        console.log(`[WORLDVIEW] ✅ Weather radar timestamp: ${latest.time}`);
        return latest.path; // e.g., "/v2/radar/1708600800"
    } catch (err) {
        console.error('[WORLDVIEW] RainViewer fetch error:', err);
        return null;
    }
}


// ══════════════════════════════════════════════════════
//  SATELLITES — CelesTrak TLE Data + satellite.js
// ══════════════════════════════════════════════════════

const CELESTRAK_ACTIVE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
// Fallback: smaller dataset
const CELESTRAK_STATIONS_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';

/**
 * Parse TLE text into array of {name, tle1, tle2}
 */
function parseTLE(tleText) {
    const lines = tleText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const tles = [];

    for (let i = 0; i < lines.length - 2; i += 3) {
        const name = lines[i];
        const tle1 = lines[i + 1];
        const tle2 = lines[i + 2];

        if (tle1.startsWith('1 ') && tle2.startsWith('2 ')) {
            tles.push({ name, tle1, tle2 });
        }
    }

    return tles;
}

/**
 * Compute the current lat/lng/alt of a satellite from its TLE.
 */
function getSatellitePosition(tle1, tle2) {
    try {
        const satrec = satellite.twoline2satrec(tle1, tle2);
        const now = new Date();
        const positionAndVelocity = satellite.propagate(satrec, now);

        if (!positionAndVelocity.position) return null;

        const gmst = satellite.gstime(now);
        const geo = satellite.eciToGeodetic(positionAndVelocity.position, gmst);

        return {
            lat: satellite.degreesLat(geo.latitude),
            lng: satellite.degreesLong(geo.longitude),
            altKm: geo.height, // altitude in km
        };
    } catch {
        return null;
    }
}

/**
 * Fetch real satellite positions from CelesTrak.
 * @param {number} maxCount - Maximum number of satellites to track
 */
export async function fetchSatellites(maxCount = 100) {
    try {
        // Try space stations first (smaller, faster dataset)
        let res = await fetch(CELESTRAK_STATIONS_URL);

        if (!res.ok) {
            // Fallback to active sats but will take longer
            res = await fetch(CELESTRAK_ACTIVE_URL);
        }

        if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);

        const tleText = await res.text();
        const tles = parseTLE(tleText);

        const sats = [];
        const subset = tles.slice(0, maxCount);

        for (const tle of subset) {
            const pos = getSatellitePosition(tle.tle1, tle.tle2);
            if (!pos) continue;

            // Extract NORAD ID from TLE line 1
            const noradId = tle.tle1.substring(2, 7).trim();

            sats.push({
                id: noradId,
                name: `SAT-${noradId}`,
                displayName: tle.name,
                lat: pos.lat,
                lng: pos.lng,
                alt: Math.max(0.02, Math.min(0.3, pos.altKm / 40000)), // Scale for globe
                altKm: pos.altKm,
            });
        }

        return sats;
    } catch (err) {
        console.warn('[WORLDVIEW] CelesTrak fetch failed:', err.message);
        return null;
    }
}


// ══════════════════════════════════════════════════════
//  AIRPORTS — Major world airports
// ══════════════════════════════════════════════════════

const AIRPORTS = [
    // ═══════════════════════════════════════
    // NORTH AMERICA — USA
    // ═══════════════════════════════════════
    { iata: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', lat: 33.6407, lng: -84.4277 },
    { iata: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', lat: 33.9425, lng: -118.4081 },
    { iata: 'ORD', name: "O'Hare Intl", city: 'Chicago', lat: 41.9742, lng: -87.9073 },
    { iata: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', lat: 32.8998, lng: -97.0403 },
    { iata: 'DEN', name: 'Denver Intl', city: 'Denver', lat: 39.8561, lng: -104.6737 },
    { iata: 'JFK', name: 'John F. Kennedy', city: 'New York', lat: 40.6413, lng: -73.7781 },
    { iata: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', lat: 37.6213, lng: -122.3790 },
    { iata: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', lat: 47.4502, lng: -122.3088 },
    { iata: 'MIA', name: 'Miami Intl', city: 'Miami', lat: 25.7959, lng: -80.2870 },
    { iata: 'EWR', name: 'Newark Liberty', city: 'Newark', lat: 40.6895, lng: -74.1745 },
    { iata: 'MCO', name: 'Orlando Intl', city: 'Orlando', lat: 28.4312, lng: -81.3081 },
    { iata: 'CLT', name: 'Charlotte Douglas', city: 'Charlotte', lat: 35.2140, lng: -80.9431 },
    { iata: 'PHX', name: 'Sky Harbor', city: 'Phoenix', lat: 33.4373, lng: -112.0078 },
    { iata: 'IAH', name: 'George Bush', city: 'Houston', lat: 29.9902, lng: -95.3368 },
    { iata: 'LAS', name: 'Harry Reid', city: 'Las Vegas', lat: 36.0840, lng: -115.1537 },
    { iata: 'MSP', name: 'Minneapolis-St Paul', city: 'Minneapolis', lat: 44.8848, lng: -93.2223 },
    { iata: 'DTW', name: 'Detroit Metro', city: 'Detroit', lat: 42.2124, lng: -83.3534 },
    { iata: 'BOS', name: 'Logan Intl', city: 'Boston', lat: 42.3656, lng: -71.0096 },
    { iata: 'PHL', name: 'Philadelphia Intl', city: 'Philadelphia', lat: 39.8744, lng: -75.2424 },
    { iata: 'LGA', name: 'LaGuardia', city: 'New York', lat: 40.7769, lng: -73.8740 },
    { iata: 'FLL', name: 'Fort Lauderdale', city: 'Fort Lauderdale', lat: 26.0726, lng: -80.1527 },
    { iata: 'BWI', name: 'Baltimore/Washington', city: 'Baltimore', lat: 39.1754, lng: -76.6683 },
    { iata: 'IAD', name: 'Dulles Intl', city: 'Washington DC', lat: 38.9531, lng: -77.4565 },
    { iata: 'DCA', name: 'Reagan National', city: 'Washington DC', lat: 38.8521, lng: -77.0377 },
    { iata: 'SLC', name: 'Salt Lake City', city: 'Salt Lake City', lat: 40.7899, lng: -111.9791 },
    { iata: 'SAN', name: 'San Diego Intl', city: 'San Diego', lat: 32.7336, lng: -117.1897 },
    { iata: 'TPA', name: 'Tampa Intl', city: 'Tampa', lat: 27.9755, lng: -82.5332 },
    { iata: 'PDX', name: 'Portland Intl', city: 'Portland', lat: 45.5898, lng: -122.5951 },
    { iata: 'HNL', name: 'Daniel K. Inouye', city: 'Honolulu', lat: 21.3245, lng: -157.9251 },
    { iata: 'ANC', name: 'Ted Stevens', city: 'Anchorage', lat: 61.1743, lng: -149.9982 },
    { iata: 'STL', name: 'St. Louis Lambert', city: 'St. Louis', lat: 38.7487, lng: -90.3700 },
    { iata: 'MCI', name: 'Kansas City Intl', city: 'Kansas City', lat: 39.2976, lng: -94.7139 },
    { iata: 'RDU', name: 'Raleigh-Durham', city: 'Raleigh', lat: 35.8776, lng: -78.7875 },
    { iata: 'BNA', name: 'Nashville Intl', city: 'Nashville', lat: 36.1263, lng: -86.6774 },
    { iata: 'AUS', name: 'Austin-Bergstrom', city: 'Austin', lat: 30.1975, lng: -97.6664 },
    { iata: 'MSY', name: 'Louis Armstrong', city: 'New Orleans', lat: 29.9934, lng: -90.2580 },
    { iata: 'IND', name: 'Indianapolis Intl', city: 'Indianapolis', lat: 39.7173, lng: -86.2944 },
    { iata: 'PIT', name: 'Pittsburgh Intl', city: 'Pittsburgh', lat: 40.4915, lng: -80.2329 },
    { iata: 'CLE', name: 'Cleveland Hopkins', city: 'Cleveland', lat: 41.4058, lng: -81.8540 },
    { iata: 'CMH', name: 'John Glenn Columbus', city: 'Columbus', lat: 39.9980, lng: -82.8919 },
    // CANADA
    { iata: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', lat: 43.6777, lng: -79.6248 },
    { iata: 'YVR', name: 'Vancouver Intl', city: 'Vancouver', lat: 49.1967, lng: -123.1815 },
    { iata: 'YUL', name: 'Montréal-Trudeau', city: 'Montréal', lat: 45.4706, lng: -73.7408 },
    { iata: 'YYC', name: 'Calgary Intl', city: 'Calgary', lat: 51.1215, lng: -114.0076 },
    { iata: 'YEG', name: 'Edmonton Intl', city: 'Edmonton', lat: 53.3097, lng: -113.5800 },
    { iata: 'YOW', name: 'Ottawa Macdonald', city: 'Ottawa', lat: 45.3225, lng: -75.6692 },
    { iata: 'YWG', name: 'Winnipeg Richardson', city: 'Winnipeg', lat: 49.9100, lng: -97.2399 },
    { iata: 'YHZ', name: 'Halifax Stanfield', city: 'Halifax', lat: 44.8808, lng: -63.5085 },
    // MEXICO & CENTRAL AMERICA
    { iata: 'MEX', name: 'Mexico City Intl', city: 'Mexico City', lat: 19.4363, lng: -99.0721 },
    { iata: 'CUN', name: 'Cancún Intl', city: 'Cancún', lat: 21.0365, lng: -86.8771 },
    { iata: 'GDL', name: 'Guadalajara Intl', city: 'Guadalajara', lat: 20.5218, lng: -103.3111 },
    { iata: 'MTY', name: 'Monterrey Intl', city: 'Monterrey', lat: 25.7785, lng: -100.1069 },
    { iata: 'SJO', name: 'Juan Santamaría', city: 'San José', lat: 9.9939, lng: -84.2088 },
    { iata: 'PTY', name: 'Tocumen Intl', city: 'Panama City', lat: 9.0714, lng: -79.3835 },
    { iata: 'SAL', name: 'El Salvador Intl', city: 'San Salvador', lat: 13.4409, lng: -89.0557 },
    { iata: 'GUA', name: 'La Aurora', city: 'Guatemala City', lat: 14.5833, lng: -90.5275 },
    // CARIBBEAN
    { iata: 'SJU', name: 'Luis Muñoz Marín', city: 'San Juan', lat: 18.4394, lng: -66.0018 },
    { iata: 'NAS', name: 'Lynden Pindling', city: 'Nassau', lat: 25.0390, lng: -77.4662 },
    { iata: 'KIN', name: 'Norman Manley', city: 'Kingston', lat: 17.9357, lng: -76.7875 },
    { iata: 'POS', name: 'Piarco Intl', city: 'Port of Spain', lat: 10.5954, lng: -61.3372 },
    { iata: 'HAV', name: 'José Martí', city: 'Havana', lat: 22.9892, lng: -82.4091 },
    { iata: 'SDQ', name: 'Las Américas', city: 'Santo Domingo', lat: 18.4297, lng: -69.6689 },
    // ═══════════════════════════════════════
    // SOUTH AMERICA
    // ═══════════════════════════════════════
    { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', lat: -23.4356, lng: -46.4731 },
    { iata: 'GIG', name: 'Galeão', city: 'Rio de Janeiro', lat: -22.8100, lng: -43.2506 },
    { iata: 'BSB', name: 'Brasília Intl', city: 'Brasília', lat: -15.8711, lng: -47.9186 },
    { iata: 'CNF', name: 'Confins', city: 'Belo Horizonte', lat: -19.6244, lng: -43.9719 },
    { iata: 'EZE', name: 'Ezeiza', city: 'Buenos Aires', lat: -34.8222, lng: -58.5358 },
    { iata: 'AEP', name: 'Aeroparque', city: 'Buenos Aires', lat: -34.5592, lng: -58.4156 },
    { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', lat: 4.7016, lng: -74.1469 },
    { iata: 'SCL', name: 'Arturo Merino', city: 'Santiago', lat: -33.3930, lng: -70.7858 },
    { iata: 'LIM', name: 'Jorge Chávez', city: 'Lima', lat: -12.0219, lng: -77.1143 },
    { iata: 'UIO', name: 'Mariscal Sucre', city: 'Quito', lat: -0.1292, lng: -78.3575 },
    { iata: 'CCS', name: 'Simón Bolívar', city: 'Caracas', lat: 10.6012, lng: -66.9913 },
    { iata: 'MVD', name: 'Carrasco Intl', city: 'Montevideo', lat: -34.8384, lng: -56.0308 },
    { iata: 'ASU', name: 'Silvio Pettirossi', city: 'Asunción', lat: -25.2400, lng: -57.5200 },
    { iata: 'VVI', name: 'Viru Viru', city: 'Santa Cruz', lat: -17.6448, lng: -63.1354 },
    { iata: 'MDE', name: 'José María Córdova', city: 'Medellín', lat: 6.1645, lng: -75.4231 },
    // ═══════════════════════════════════════
    // EUROPE — WESTERN
    // ═══════════════════════════════════════
    { iata: 'LHR', name: 'Heathrow', city: 'London', lat: 51.4700, lng: -0.4543 },
    { iata: 'LGW', name: 'Gatwick', city: 'London', lat: 51.1537, lng: -0.1821 },
    { iata: 'STN', name: 'Stansted', city: 'London', lat: 51.8860, lng: 0.2389 },
    { iata: 'LTN', name: 'Luton', city: 'London', lat: 51.8747, lng: -0.3683 },
    { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', lat: 49.0097, lng: 2.5479 },
    { iata: 'ORY', name: 'Orly', city: 'Paris', lat: 48.7262, lng: 2.3652 },
    { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', lat: 50.0379, lng: 8.5622 },
    { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', lat: 52.3105, lng: 4.7683 },
    { iata: 'MAD', name: 'Barajas', city: 'Madrid', lat: 40.4983, lng: -3.5676 },
    { iata: 'BCN', name: 'El Prat', city: 'Barcelona', lat: 41.2974, lng: 2.0833 },
    { iata: 'FCO', name: 'Fiumicino', city: 'Rome', lat: 41.8003, lng: 12.2389 },
    { iata: 'MXP', name: 'Malpensa', city: 'Milan', lat: 45.6306, lng: 8.7281 },
    { iata: 'MUC', name: 'Munich', city: 'Munich', lat: 48.3537, lng: 11.7750 },
    { iata: 'ZRH', name: 'Zurich', city: 'Zurich', lat: 47.4647, lng: 8.5492 },
    { iata: 'VIE', name: 'Vienna Intl', city: 'Vienna', lat: 48.1103, lng: 16.5697 },
    { iata: 'BRU', name: 'Brussels', city: 'Brussels', lat: 50.9014, lng: 4.4844 },
    { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', lat: 38.7742, lng: -9.1342 },
    { iata: 'DUB', name: 'Dublin', city: 'Dublin', lat: 53.4213, lng: -6.2701 },
    { iata: 'MAN', name: 'Manchester', city: 'Manchester', lat: 53.3537, lng: -2.2750 },
    { iata: 'EDI', name: 'Edinburgh', city: 'Edinburgh', lat: 55.9508, lng: -3.3615 },
    { iata: 'GVA', name: 'Geneva', city: 'Geneva', lat: 46.2381, lng: 6.1089 },
    { iata: 'CPH', name: 'Kastrup', city: 'Copenhagen', lat: 55.6180, lng: 12.6508 },
    { iata: 'ARN', name: 'Arlanda', city: 'Stockholm', lat: 59.6519, lng: 17.9186 },
    { iata: 'OSL', name: 'Gardermoen', city: 'Oslo', lat: 60.1939, lng: 11.1004 },
    { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', lat: 60.3172, lng: 24.9633 },
    { iata: 'AGP', name: 'Málaga-Costa del Sol', city: 'Málaga', lat: 36.6749, lng: -4.4991 },
    { iata: 'PMI', name: 'Palma de Mallorca', city: 'Palma', lat: 39.5517, lng: 2.7388 },
    { iata: 'NCE', name: 'Nice Côte d Azur', city: 'Nice', lat: 43.6584, lng: 7.2159 },
    { iata: 'HAM', name: 'Hamburg', city: 'Hamburg', lat: 53.6304, lng: 9.9882 },
    { iata: 'DUS', name: 'Düsseldorf', city: 'Düsseldorf', lat: 51.2895, lng: 6.7668 },
    { iata: 'TXL', name: 'Berlin Brandenburg', city: 'Berlin', lat: 52.3667, lng: 13.5033 },
    { iata: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', lat: 37.9364, lng: 23.9445 },
    { iata: 'NAP', name: 'Naples Intl', city: 'Naples', lat: 40.8860, lng: 14.2908 },
    { iata: 'VCE', name: 'Marco Polo', city: 'Venice', lat: 45.5053, lng: 12.3519 },
    // EASTERN EUROPE
    { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', lat: 41.2608, lng: 28.7418 },
    { iata: 'SAW', name: 'Sabiha Gökçen', city: 'Istanbul', lat: 40.8986, lng: 29.3092 },
    { iata: 'AYT', name: 'Antalya', city: 'Antalya', lat: 36.8987, lng: 30.8005 },
    { iata: 'WAW', name: 'Chopin', city: 'Warsaw', lat: 52.1657, lng: 20.9671 },
    { iata: 'PRG', name: 'Václav Havel', city: 'Prague', lat: 50.1008, lng: 14.2600 },
    { iata: 'BUD', name: 'Ferenc Liszt', city: 'Budapest', lat: 47.4369, lng: 19.2556 },
    { iata: 'OTP', name: 'Henri Coandă', city: 'Bucharest', lat: 44.5711, lng: 26.0850 },
    { iata: 'SOF', name: 'Sofia', city: 'Sofia', lat: 42.6967, lng: 23.4114 },
    { iata: 'SVO', name: 'Sheremetyevo', city: 'Moscow', lat: 55.9726, lng: 37.4146 },
    { iata: 'DME', name: 'Domodedovo', city: 'Moscow', lat: 55.4088, lng: 37.9063 },
    { iata: 'LED', name: 'Pulkovo', city: 'St Petersburg', lat: 59.8003, lng: 30.2625 },
    { iata: 'KBP', name: 'Boryspil', city: 'Kyiv', lat: 50.3450, lng: 30.8947 },
    { iata: 'TLL', name: 'Tallinn', city: 'Tallinn', lat: 59.4133, lng: 24.8328 },
    { iata: 'RIX', name: 'Riga Intl', city: 'Riga', lat: 56.9236, lng: 23.9711 },
    { iata: 'VNO', name: 'Vilnius', city: 'Vilnius', lat: 54.6341, lng: 25.2858 },
    { iata: 'BEG', name: 'Nikola Tesla', city: 'Belgrade', lat: 44.8184, lng: 20.3091 },
    { iata: 'ZAG', name: 'Franjo Tuđman', city: 'Zagreb', lat: 45.7430, lng: 16.0688 },
    // ═══════════════════════════════════════
    // MIDDLE EAST
    // ═══════════════════════════════════════
    { iata: 'DXB', name: 'Dubai Intl', city: 'Dubai', lat: 25.2532, lng: 55.3657 },
    { iata: 'DWC', name: 'Al Maktoum', city: 'Dubai', lat: 24.8960, lng: 55.1614 },
    { iata: 'AUH', name: 'Abu Dhabi Intl', city: 'Abu Dhabi', lat: 24.4331, lng: 54.6511 },
    { iata: 'DOH', name: 'Hamad Intl', city: 'Doha', lat: 25.2731, lng: 51.6081 },
    { iata: 'JED', name: 'King Abdulaziz', city: 'Jeddah', lat: 21.6796, lng: 39.1565 },
    { iata: 'RUH', name: 'King Khalid', city: 'Riyadh', lat: 24.9578, lng: 46.6989 },
    { iata: 'KWI', name: 'Kuwait Intl', city: 'Kuwait City', lat: 29.2266, lng: 47.9689 },
    { iata: 'BAH', name: 'Bahrain Intl', city: 'Manama', lat: 26.2708, lng: 50.6336 },
    { iata: 'MCT', name: 'Muscat Intl', city: 'Muscat', lat: 23.5933, lng: 58.2844 },
    { iata: 'AMM', name: 'Queen Alia', city: 'Amman', lat: 31.7226, lng: 35.9932 },
    { iata: 'BEY', name: 'Rafic Hariri', city: 'Beirut', lat: 33.8209, lng: 35.4884 },
    { iata: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', lat: 32.0055, lng: 34.8854 },
    { iata: 'IKA', name: 'Imam Khomeini', city: 'Tehran', lat: 35.4161, lng: 51.1522 },
    { iata: 'BGW', name: 'Baghdad Intl', city: 'Baghdad', lat: 33.2625, lng: 44.2346 },
    // ═══════════════════════════════════════
    // ASIA — EAST
    // ═══════════════════════════════════════
    { iata: 'HND', name: 'Haneda', city: 'Tokyo', lat: 35.5494, lng: 139.7798 },
    { iata: 'NRT', name: 'Narita', city: 'Tokyo', lat: 35.7720, lng: 140.3929 },
    { iata: 'KIX', name: 'Kansai', city: 'Osaka', lat: 34.4347, lng: 135.2440 },
    { iata: 'CTS', name: 'New Chitose', city: 'Sapporo', lat: 42.7752, lng: 141.6925 },
    { iata: 'FUK', name: 'Fukuoka', city: 'Fukuoka', lat: 33.5902, lng: 130.4517 },
    { iata: 'NGO', name: 'Chubu Centrair', city: 'Nagoya', lat: 34.8584, lng: 136.8125 },
    { iata: 'PEK', name: 'Capital Intl', city: 'Beijing', lat: 40.0799, lng: 116.6031 },
    { iata: 'PKX', name: 'Daxing', city: 'Beijing', lat: 39.5098, lng: 116.4105 },
    { iata: 'PVG', name: 'Pudong', city: 'Shanghai', lat: 31.1443, lng: 121.8083 },
    { iata: 'SHA', name: 'Hongqiao', city: 'Shanghai', lat: 31.1979, lng: 121.3363 },
    { iata: 'CAN', name: 'Baiyun', city: 'Guangzhou', lat: 23.3924, lng: 113.2988 },
    { iata: 'SZX', name: 'Bao an', city: 'Shenzhen', lat: 22.6393, lng: 113.8107 },
    { iata: 'CTU', name: 'Shuangliu', city: 'Chengdu', lat: 30.5785, lng: 103.9471 },
    { iata: 'CKG', name: 'Jiangbei', city: 'Chongqing', lat: 29.7192, lng: 106.6417 },
    { iata: 'WUH', name: 'Tianhe', city: 'Wuhan', lat: 30.7838, lng: 114.2081 },
    { iata: 'XIY', name: 'Xianyang', city: "Xi'an", lat: 34.4471, lng: 108.7516 },
    { iata: 'HGH', name: 'Xiaoshan', city: 'Hangzhou', lat: 30.2295, lng: 120.4344 },
    { iata: 'KMG', name: 'Changshui', city: 'Kunming', lat: 25.1019, lng: 102.9292 },
    { iata: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', lat: 22.3080, lng: 113.9185 },
    { iata: 'ICN', name: 'Incheon', city: 'Seoul', lat: 37.4602, lng: 126.4407 },
    { iata: 'GMP', name: 'Gimpo', city: 'Seoul', lat: 37.5583, lng: 126.7906 },
    { iata: 'TPE', name: 'Taoyuan', city: 'Taipei', lat: 25.0797, lng: 121.2342 },
    { iata: 'ULN', name: 'Chinggis Khaan', city: 'Ulaanbaatar', lat: 47.8431, lng: 106.7672 },
    // SOUTHEAST ASIA
    { iata: 'SIN', name: 'Changi', city: 'Singapore', lat: 1.3644, lng: 103.9915 },
    { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', lat: 13.6900, lng: 100.7501 },
    { iata: 'DMK', name: 'Don Mueang', city: 'Bangkok', lat: 13.9126, lng: 100.6068 },
    { iata: 'KUL', name: 'KL Intl', city: 'Kuala Lumpur', lat: 2.7456, lng: 101.7099 },
    { iata: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta', lat: -6.1256, lng: 106.6558 },
    { iata: 'DPS', name: 'Ngurah Rai', city: 'Bali', lat: -8.7482, lng: 115.1672 },
    { iata: 'MNL', name: 'Ninoy Aquino', city: 'Manila', lat: 14.5086, lng: 121.0198 },
    { iata: 'CEB', name: 'Mactan-Cebu', city: 'Cebu', lat: 10.3070, lng: 123.9794 },
    { iata: 'SGN', name: 'Tan Son Nhat', city: 'Ho Chi Minh City', lat: 10.8188, lng: 106.6520 },
    { iata: 'HAN', name: 'Noi Bai', city: 'Hanoi', lat: 21.2212, lng: 105.8070 },
    { iata: 'DAD', name: 'Da Nang', city: 'Da Nang', lat: 16.0439, lng: 108.1992 },
    { iata: 'PNH', name: 'Phnom Penh', city: 'Phnom Penh', lat: 11.5466, lng: 104.8441 },
    { iata: 'REP', name: 'Siem Reap', city: 'Siem Reap', lat: 13.4107, lng: 103.8128 },
    { iata: 'RGN', name: 'Yangon Intl', city: 'Yangon', lat: 16.9073, lng: 96.1332 },
    { iata: 'VTE', name: 'Wattay', city: 'Vientiane', lat: 17.9883, lng: 102.5633 },
    // SOUTH ASIA
    { iata: 'DEL', name: 'Indira Gandhi', city: 'Delhi', lat: 28.5562, lng: 77.1000 },
    { iata: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
    { iata: 'BLR', name: 'Kempegowda', city: 'Bangalore', lat: 13.1979, lng: 77.7063 },
    { iata: 'MAA', name: 'Chennai Intl', city: 'Chennai', lat: 12.9941, lng: 80.1709 },
    { iata: 'HYD', name: 'Rajiv Gandhi', city: 'Hyderabad', lat: 17.2403, lng: 78.4294 },
    { iata: 'CCU', name: 'Netaji Subhas Chandra', city: 'Kolkata', lat: 22.6547, lng: 88.4467 },
    { iata: 'COK', name: 'Cochin Intl', city: 'Kochi', lat: 10.1520, lng: 76.4019 },
    { iata: 'GOI', name: 'Dabolim', city: 'Goa', lat: 15.3808, lng: 73.8314 },
    { iata: 'AMD', name: 'Sardar Vallabhbhai Patel', city: 'Ahmedabad', lat: 23.0772, lng: 72.6347 },
    { iata: 'ISB', name: 'Islamabad Intl', city: 'Islamabad', lat: 33.5605, lng: 72.8526 },
    { iata: 'KHI', name: 'Jinnah Intl', city: 'Karachi', lat: 24.9065, lng: 67.1610 },
    { iata: 'LHE', name: 'Allama Iqbal', city: 'Lahore', lat: 31.5216, lng: 74.4036 },
    { iata: 'DAC', name: 'Hazrat Shahjalal', city: 'Dhaka', lat: 23.8432, lng: 90.3978 },
    { iata: 'CMB', name: 'Bandaranaike', city: 'Colombo', lat: 7.1808, lng: 79.8841 },
    { iata: 'KTM', name: 'Tribhuvan', city: 'Kathmandu', lat: 27.6966, lng: 85.3591 },
    { iata: 'MLE', name: 'Velana', city: 'Malé', lat: 4.1918, lng: 73.5292 },
    // CENTRAL ASIA
    { iata: 'TAS', name: 'Tashkent', city: 'Tashkent', lat: 41.2579, lng: 69.2812 },
    { iata: 'ALA', name: 'Almaty', city: 'Almaty', lat: 43.3521, lng: 77.0405 },
    { iata: 'NQZ', name: 'Nursultan Nazarbayev', city: 'Astana', lat: 51.0222, lng: 71.4669 },
    { iata: 'GYD', name: 'Heydar Aliyev', city: 'Baku', lat: 40.4675, lng: 50.0467 },
    { iata: 'TBS', name: 'Tbilisi Intl', city: 'Tbilisi', lat: 41.6692, lng: 44.9547 },
    { iata: 'EVN', name: 'Zvartnots', city: 'Yerevan', lat: 40.1473, lng: 44.3959 },
    // ═══════════════════════════════════════
    // OCEANIA
    // ═══════════════════════════════════════
    { iata: 'SYD', name: 'Kingsford Smith', city: 'Sydney', lat: -33.9461, lng: 151.1772 },
    { iata: 'MEL', name: 'Tullamarine', city: 'Melbourne', lat: -37.6690, lng: 144.8410 },
    { iata: 'BNE', name: 'Brisbane', city: 'Brisbane', lat: -27.3842, lng: 153.1175 },
    { iata: 'PER', name: 'Perth', city: 'Perth', lat: -31.9403, lng: 115.9672 },
    { iata: 'ADL', name: 'Adelaide', city: 'Adelaide', lat: -34.9461, lng: 138.5311 },
    { iata: 'CBR', name: 'Canberra', city: 'Canberra', lat: -35.3069, lng: 149.1951 },
    { iata: 'AKL', name: 'Auckland Intl', city: 'Auckland', lat: -37.0082, lng: 174.7850 },
    { iata: 'WLG', name: 'Wellington', city: 'Wellington', lat: -41.3272, lng: 174.8053 },
    { iata: 'CHC', name: 'Christchurch', city: 'Christchurch', lat: -43.4894, lng: 172.5322 },
    { iata: 'NAN', name: 'Nadi Intl', city: 'Fiji', lat: -17.7554, lng: 177.4431 },
    { iata: 'PPT', name: 'Faa a', city: 'Tahiti', lat: -17.5537, lng: -149.6115 },
    { iata: 'APW', name: 'Faleolo', city: 'Apia', lat: -13.8299, lng: -172.0083 },
    // ═══════════════════════════════════════
    // AFRICA
    // ═══════════════════════════════════════
    { iata: 'JNB', name: 'OR Tambo', city: 'Johannesburg', lat: -26.1392, lng: 28.2460 },
    { iata: 'CPT', name: 'Cape Town Intl', city: 'Cape Town', lat: -33.9715, lng: 18.6021 },
    { iata: 'DUR', name: 'King Shaka', city: 'Durban', lat: -29.6144, lng: 31.1197 },
    { iata: 'CAI', name: 'Cairo Intl', city: 'Cairo', lat: 30.1219, lng: 31.4056 },
    { iata: 'HRG', name: 'Hurghada', city: 'Hurghada', lat: 27.1784, lng: 33.7994 },
    { iata: 'SSH', name: 'Sharm El Sheikh', city: 'Sharm El Sheikh', lat: 27.9773, lng: 34.3947 },
    { iata: 'CMN', name: 'Mohammed V', city: 'Casablanca', lat: 33.3675, lng: -7.5900 },
    { iata: 'RAK', name: 'Marrakech Menara', city: 'Marrakech', lat: 31.6069, lng: -8.0363 },
    { iata: 'ALG', name: 'Houari Boumediene', city: 'Algiers', lat: 36.6910, lng: 3.2154 },
    { iata: 'TUN', name: 'Tunis-Carthage', city: 'Tunis', lat: 36.8510, lng: 10.2272 },
    { iata: 'LOS', name: 'Murtala Muhammed', city: 'Lagos', lat: 6.5774, lng: 3.3212 },
    { iata: 'ABV', name: 'Nnamdi Azikiwe', city: 'Abuja', lat: 9.0068, lng: 7.2632 },
    { iata: 'ACC', name: 'Kotoka', city: 'Accra', lat: 5.6052, lng: -0.1668 },
    { iata: 'NBO', name: 'Jomo Kenyatta', city: 'Nairobi', lat: -1.3192, lng: 36.9278 },
    { iata: 'MBA', name: 'Moi Intl', city: 'Mombasa', lat: -4.0348, lng: 39.5942 },
    { iata: 'ADD', name: 'Bole Intl', city: 'Addis Ababa', lat: 8.9779, lng: 38.7993 },
    { iata: 'DAR', name: 'Julius Nyerere', city: 'Dar es Salaam', lat: -6.8781, lng: 39.2026 },
    { iata: 'EBB', name: 'Entebbe', city: 'Entebbe', lat: 0.0424, lng: 32.4435 },
    { iata: 'KGL', name: 'Kigali Intl', city: 'Kigali', lat: -1.9686, lng: 30.1395 },
    { iata: 'DSS', name: 'Blaise Diagne', city: 'Dakar', lat: 14.6700, lng: -17.0733 },
    { iata: 'TNR', name: 'Ivato', city: 'Antananarivo', lat: -18.7969, lng: 47.4789 },
    { iata: 'MRU', name: 'SSR Intl', city: 'Mauritius', lat: -20.4302, lng: 57.6836 },
    { iata: 'SEZ', name: 'Seychelles Intl', city: 'Mahé', lat: -4.6743, lng: 55.5218 },
    { iata: 'WDH', name: 'Hosea Kutako', city: 'Windhoek', lat: -22.4799, lng: 17.4709 },
    { iata: 'MPM', name: 'Maputo Intl', city: 'Maputo', lat: -25.9208, lng: 32.5726 },
    { iata: 'LUN', name: 'Kenneth Kaunda', city: 'Lusaka', lat: -15.3308, lng: 28.4526 },
    { iata: 'HRE', name: 'Robert Mugabe', city: 'Harare', lat: -17.9318, lng: 31.0928 },
];

export function getAirports() {
    return AIRPORTS;
}

/** Look up airport info by IATA code */
export function lookupAirport(iata) {
    if (!iata) return null;
    return AIRPORTS.find(a => a.iata === iata.toUpperCase()) || null;
}

// ══════════════════════════════════════════════════════
//  CCTV — Known public traffic camera locations
// ══════════════════════════════════════════════════════

// Real public traffic camera locations around the world
// ALL verified LIVE YouTube streams — tested and confirmed active
const CCTV_LOCATIONS = [
    // ── Cities & Landmarks ──
    {
        id: 'vn-1', lat: 45.4342, lng: 12.3388, name: 'Grand Canal Live', city: 'Venice',
        streamUrl: 'https://www.youtube.com/embed/ph1vpnYIxJk?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'lv-1', lat: 36.1699, lng: -115.1398, name: 'Fremont Street', city: 'Las Vegas',
        streamUrl: 'https://www.youtube.com/embed/KCcNxl2ZppI?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'tk-1', lat: 35.6762, lng: 139.6503, name: 'Tokyo Live', city: 'Tokyo',
        streamUrl: 'https://www.youtube.com/embed/_k-5U7IeK8g?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'hs-1', lat: 29.7604, lng: -95.3698, name: 'Downtown Skyline', city: 'Houston',
        streamUrl: 'https://www.youtube.com/embed/wUQc3RoLAPs?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── Beaches & Coastal ──
    {
        id: 'ib-1', lat: 38.9806, lng: 1.3015, name: 'Café del Mar Sunset', city: 'Ibiza',
        streamUrl: 'https://www.youtube.com/embed/DuBAVRZVn2A?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'mi-1', lat: 25.7617, lng: -80.1918, name: 'Biscayne Bay', city: 'Miami',
        streamUrl: 'https://www.youtube.com/embed/5YCajRjvWCg?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'ml-1', lat: 39.5141, lng: 2.4844, name: 'Camp de Mar', city: 'Mallorca',
        streamUrl: 'https://www.youtube.com/embed/EgUqWpO7kVo?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'cw-1', lat: 50.0828, lng: -5.3174, name: 'Porthleven Harbour', city: 'Cornwall',
        streamUrl: 'https://www.youtube.com/embed/gEVKkMI-9F8?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'gv-1', lat: 29.3013, lng: -94.7977, name: 'Beach Front', city: 'Galveston',
        streamUrl: 'https://www.youtube.com/embed/HkHhXsWci7Q?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'jm-1', lat: 18.4079, lng: -77.1025, name: 'Ocho Rios Coast', city: 'Jamaica',
        streamUrl: 'https://www.youtube.com/embed/4X9dtsZmSw8?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'hr-1', lat: 43.1729, lng: 16.4411, name: 'Hvar Island', city: 'Croatia',
        streamUrl: 'https://www.youtube.com/embed/0wHWHAFnNh0?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── Airports & Aviation ──
    {
        id: 'sx-1', lat: 18.0425, lng: -63.1089, name: 'Maho Beach Planes', city: 'Sint Maarten',
        streamUrl: 'https://www.youtube.com/embed/2IQmpCXbOmM?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'lx-1', lat: 33.9425, lng: -118.4081, name: 'LAX Runways', city: 'Los Angeles',
        streamUrl: 'https://www.youtube.com/embed/UQaSS4_VAV4?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'va-1', lat: 36.08, lng: -115.15, name: 'Harry Reid Airport', city: 'Las Vegas',
        streamUrl: 'https://www.youtube.com/embed/cn8_34TuMaM?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'pg-1', lat: 50.1008, lng: 14.2632, name: 'Airport Live', city: 'Prague',
        streamUrl: 'https://www.youtube.com/embed/0jUGiYZKAMg?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── Nature & Wildlife ──
    {
        id: 'nm-1', lat: -24.7, lng: 15.8, name: 'Desert Wildlife Cam', city: 'Namibia',
        streamUrl: 'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'bb-1', lat: 34.2439, lng: -116.9114, name: 'Big Bear Lake', city: 'California',
        streamUrl: 'https://www.youtube.com/embed/c6pYq6ff388?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'hw-1', lat: 20.7984, lng: -156.3319, name: 'Whale Sanctuary', city: 'Maui, Hawaii',
        streamUrl: 'https://www.youtube.com/embed/iWCeBAxRCBo?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── Space ──
    {
        id: 'iss-1', lat: 0, lng: -30, name: 'Earth from ISS', city: 'NASA',
        streamUrl: 'https://www.youtube.com/embed/vytmBNhc9ig?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── MORE Cities ──
    {
        id: 'ny-ts', lat: 40.758, lng: -73.985, name: 'Times Square', city: 'New York',
        streamUrl: 'https://www.youtube.com/embed/rnXIjl_Rzy4?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'ny-sk', lat: 40.748, lng: -73.975, name: 'NYC Skyline', city: 'New York',
        streamUrl: 'https://www.youtube.com/embed/VGnFLdQW39A?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'akl-1', lat: -36.848, lng: 174.763, name: 'Sky Tower', city: 'Auckland',
        streamUrl: 'https://www.youtube.com/embed/BQR800Gu28g?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'sd-1', lat: 32.715, lng: -117.161, name: 'Bay View', city: 'San Diego',
        streamUrl: 'https://www.youtube.com/embed/edz0ux7JClE?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'dv-1', lat: 7.076, lng: 125.613, name: 'City Skyline', city: 'Davao, Philippines',
        streamUrl: 'https://www.youtube.com/embed/ShyEWcl4Kz4?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── MORE Beaches ──
    {
        id: 'vb-1', lat: 33.985, lng: -118.473, name: 'Venice Beach', city: 'Los Angeles',
        streamUrl: 'https://www.youtube.com/embed/EO_1LWqsCNE?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'md-1', lat: 4.175, lng: 73.509, name: 'Kuredu Island', city: 'Maldives',
        streamUrl: 'https://www.youtube.com/embed/_BMi3usEwi8?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'pp-1', lat: 21.665, lng: -158.053, name: 'Banzai Pipeline', city: 'Oahu, Hawaii',
        streamUrl: 'https://www.youtube.com/embed/VI8Wj5EwoRM?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'or-1', lat: 45.214, lng: -123.97, name: 'Cape Kiwanda', city: 'Oregon',
        streamUrl: 'https://www.youtube.com/embed/S5FRz8m4xWI?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'sb-1', lat: 28.177, lng: -80.592, name: 'Satellite Beach', city: 'Florida',
        streamUrl: 'https://www.youtube.com/embed/0bv7YxPWRdw?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'si-1', lat: 39.153, lng: -74.693, name: 'Boardwalk', city: 'Sea Isle City, NJ',
        streamUrl: 'https://www.youtube.com/embed/FYOGiFH60uM?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    // ── MORE Airports ──
    {
        id: 'lhr-1', lat: 51.47, lng: -0.454, name: 'Heathrow Runways', city: 'London',
        streamUrl: 'https://www.youtube.com/embed/YMxabMky18E?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'mia-ap', lat: 25.796, lng: -80.276, name: 'MIA Runway', city: 'Miami',
        streamUrl: 'https://www.youtube.com/embed/OXeFcz3lEz4?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'mdw-1', lat: 41.786, lng: -87.752, name: 'Midway Airport', city: 'Chicago',
        streamUrl: 'https://www.youtube.com/embed/67BCsiW-1Io?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'inn-1', lat: 47.26, lng: 11.344, name: 'Alpine Airport', city: 'Innsbruck',
        streamUrl: 'https://www.youtube.com/embed/bgwIoqEVduM?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'bne-1', lat: -27.384, lng: 153.117, name: 'Brisbane Airport', city: 'Brisbane',
        streamUrl: 'https://www.youtube.com/embed/tvQHkMGEyEo?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
    {
        id: 'tll-1', lat: 59.414, lng: 24.833, name: 'Tallinn Airport', city: 'Estonia',
        streamUrl: 'https://www.youtube.com/embed/jEhw23X8e8A?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
    },
];

export function getCCTVLocations() {
    return CCTV_LOCATIONS.map(cam => ({
        ...cam,
        alt: 0.001,
        status: 'online',
    }));
}


// ══════════════════════════════════════════════════════
//  FALLBACK DATA (when APIs are unavailable)
// ══════════════════════════════════════════════════════

export function generateFallbackFlights(count = 40) {
    const airlines = ['DAL', 'UAL', 'AAL', 'SWA', 'BAW', 'DLH', 'AFR', 'EK', 'SIA', 'QFA', 'ANA', 'JAL'];
    const flights = [];

    for (let i = 0; i < count; i++) {
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const flightNum = 100 + Math.floor(Math.random() * 9000);
        const fl = 250 + Math.floor(Math.random() * 200);
        const speed = 400 + Math.floor(Math.random() * 200);

        flights.push({
            lat: Math.random() * 140 - 70,
            lng: Math.random() * 360 - 180,
            alt: 0.005 + Math.random() * 0.015,
            callsign: `${airline}${flightNum}`,
            flightLevel: `FL${fl}`,
            speed: `${speed} kts`,
            heading: Math.floor(Math.random() * 360),
            id: `fallback-${i}`,
        });
    }

    return flights;
}

export function generateFallbackSatellites(count = 60) {
    const sats = [];
    for (let i = 0; i < count; i++) {
        const satId = 10000 + Math.floor(Math.random() * 50000);
        sats.push({
            lat: Math.random() * 140 - 70,
            lng: Math.random() * 360 - 180,
            alt: 0.05 + Math.random() * 0.2,
            name: `SAT-${satId}`,
            displayName: `SATELLITE ${satId}`,
            id: `fallback-${i}`,
        });
    }
    return sats;
}
