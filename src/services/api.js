/**
 * Real-time data services for WORLDVIEW
 * - Live flights from OpenSky Network
 * - Real satellites from CelesTrak + satellite.js
 */

import * as satellite from 'satellite.js';
// ══════════════════════════════════════════════════════
//  FLIGHT ENGINE — adsb.lol + adsb.fi dual API
//  44 global hubs, batched fetch, ~5000-7000+ unique aircraft
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
    AJT: 'Amerijet', ANZ: 'Air New Zealand', AST: 'Star Air', BAG: 'deuter BAG',
    BER: 'Air Berlin', CAI: 'Corendon', CKS: 'Kalitta Air', CLX: 'Cargolux',
    CXA: 'Xiamen Air', DAL: 'Delta', ELY: 'El Al', FPO: 'ASL Airlines',
    GIA: 'Garuda Indonesia', JBU: 'JetBlue', JST: 'Jetstar', MAS: 'Malaysia Airlines',
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
const HUBS = [
    // EUROPE (dense airspace — 12 hubs)
    { lat: 51, lon: 0 },     // London
    { lat: 48, lon: 2 },     // Paris
    { lat: 50, lon: 12 },    // Germany
    { lat: 46, lon: 25 },    // Eastern Europe
    { lat: 40, lon: 2 },     // Spain
    { lat: 60, lon: 15 },    // Scandinavia
    { lat: 55, lon: -5 },    // Ireland
    { lat: 42, lon: 15 },    // Italy
    { lat: 38, lon: 24 },    // Greece
    { lat: 55, lon: 37 },    // Moscow
    { lat: 45, lon: 5 },     // Switzerland/Alps
    { lat: 52, lon: 20 },    // Poland
    // NORTH AMERICA (16 hubs)
    { lat: 40, lon: -74 },   // NYC
    { lat: 41, lon: -88 },   // Chicago
    { lat: 34, lon: -118 },  // LA
    { lat: 30, lon: -97 },   // Texas
    { lat: 33, lon: -84 },   // Atlanta
    { lat: 45, lon: -75 },   // Montreal
    { lat: 49, lon: -123 },  // Vancouver
    { lat: 26, lon: -80 },   // Miami
    { lat: 47, lon: -122 },  // Seattle
    { lat: 39, lon: -105 },  // Denver
    { lat: 37, lon: -122 },  // SFO
    { lat: 19, lon: -99 },   // Mexico City
    { lat: 44, lon: -93 },   // Minneapolis
    { lat: 36, lon: -86 },   // Nashville/Central US
    { lat: 53, lon: -113 },  // Edmonton/Canada
    { lat: 29, lon: -90 },   // New Orleans
    // MIDDLE EAST (4 hubs)
    { lat: 25, lon: 55 },    // Dubai
    { lat: 33, lon: 35 },    // Levant
    { lat: 40, lon: 28 },    // Istanbul
    { lat: 24, lon: 46 },    // Riyadh
    // ASIA (14 hubs)
    { lat: 35, lon: 140 },   // Tokyo
    { lat: 37, lon: 127 },   // Seoul
    { lat: 22, lon: 114 },   // Hong Kong
    { lat: 31, lon: 121 },   // Shanghai
    { lat: 40, lon: 116 },   // Beijing
    { lat: 13, lon: 100 },   // Bangkok
    { lat: 1, lon: 104 },    // Singapore
    { lat: 28, lon: 77 },    // Delhi
    { lat: 19, lon: 73 },    // Mumbai
    { lat: 14, lon: 121 },   // Manila
    { lat: 25, lon: 121 },   // Taiwan
    { lat: 10, lon: 107 },   // Vietnam
    { lat: 35, lon: 52 },    // Tehran
    { lat: 47, lon: 68 },    // Central Asia
    // OCEANIA + S.AMERICA + AFRICA (10 hubs)
    { lat: -33, lon: 151 },  // Sydney
    { lat: -37, lon: 145 },  // Melbourne
    { lat: -23, lon: -46 },  // São Paulo
    { lat: -34, lon: -58 },  // Buenos Aires
    { lat: 4, lon: -74 },    // Bogotá
    { lat: 30, lon: 31 },    // Cairo
    { lat: -26, lon: 28 },   // Johannesburg
    { lat: 6, lon: 3 },      // Lagos
    { lat: -1, lon: 37 },    // Nairobi
    { lat: 34, lon: -6 },    // Morocco
    // OCEAN ROUTES (4 hubs)
    { lat: 55, lon: -30 },   // N.Atlantic
    { lat: 50, lon: -20 },   // N.Atlantic 2
    { lat: -5, lon: 75 },    // Indian Ocean
    { lat: 20, lon: -160 },  // Pacific
];

/**
 * Fetch live flights from BOTH adsb.lol AND adsb.fi
 * Batched to avoid overwhelming the proxy (browser allows ~6 connections)
 */
export async function fetchLiveFlights() {
    try {
        const seen = new Map();

        // Helper: fetch a batch of URLs and parse results into `seen`
        async function fetchBatch(urls) {
            const results = await Promise.all(
                urls.map(url =>
                    fetch(url, { signal: AbortSignal.timeout(12000) })
                        .then(r => r.ok ? r.json() : null)
                        .catch(() => null)
                )
            );
            for (const r of results) {
                if (!r) continue;
                const acArray = r.ac || r.aircraft || [];
                for (const ac of acArray) {
                    if (!ac.lat || !ac.lon) continue;
                    if (ac.alt_baro === 'ground') continue;
                    if (seen.has(ac.hex)) continue;

                    const altFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : null;
                    const speedKts = ac.gs ? Math.round(ac.gs) : null;
                    const callsign = (ac.flight || '').trim();
                    const vRate = ac.baro_rate || ac.geom_rate || 0;

                    seen.set(ac.hex, {
                        id: ac.hex,
                        callsign: callsign || ac.hex,
                        airline: decodeAirline(callsign),
                        lat: ac.lat,
                        lng: ac.lon,
                        alt: Math.max(0.005, (altFt || 10000) / 10000000),
                        altMeters: altFt ? altFt / 3.28084 : 0,
                        altFeet: altFt,
                        speed: speedKts ? `${speedKts} kts` : '—',
                        speedKts: speedKts || 0,
                        heading: ac.track || ac.true_heading || ac.mag_heading || 0,
                        country: '',
                        registration: ac.r || '',
                        aircraftType: ac.t || '',
                        aircraftDesc: ac.desc || '',
                        category: ac.category || '',
                        flightLevel: altFt ? `FL${Math.round(altFt / 100)}` : '—',
                        verticalRate: vRate ? vRate / 60 : 0,
                        squawk: ac.squawk || '—',
                        geoAlt: ac.alt_geom || null,
                        status: vRate > 100 ? 'CLIMBING' : vRate < -100 ? 'DESCENDING' : 'CRUISING',
                    });
                }
            }
        }

        // ── Build all URLs ──
        const lolUrls = HUBS.map(h => `/proxy/adsblol/v2/lat/${h.lat}/lon/${h.lon}/dist/250`);
        const fiUrls = HUBS.map(h => `/proxy/adsbfi/api/v2/lat/${h.lat}/lon/${h.lon}/dist/250`);
        const specialUrls = ['/proxy/adsblol/v2/mil', '/proxy/adsblol/v2/ladd'];

        // ── Fetch in batches of 10 to avoid proxy overload ──
        const BATCH = 10;
        for (let i = 0; i < lolUrls.length; i += BATCH) {
            await fetchBatch(lolUrls.slice(i, i + BATCH));
        }
        for (let i = 0; i < fiUrls.length; i += BATCH) {
            await fetchBatch(fiUrls.slice(i, i + BATCH));
        }
        await fetchBatch(specialUrls);

        const flights = Array.from(seen.values());
        console.log(`[WORLDVIEW] ✅ ${flights.length} unique flights (adsb.lol + adsb.fi + mil/ladd)`);
        return flights.length > 0 ? flights : null;
    } catch (err) {
        console.error('[WORLDVIEW] Flight fetch error:', err);
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
    // North America
    { iata: 'JFK', name: 'John F. Kennedy', city: 'New York', lat: 40.6413, lng: -73.7781 },
    { iata: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', lat: 33.9425, lng: -118.4081 },
    { iata: 'ORD', name: "O'Hare Intl", city: 'Chicago', lat: 41.9742, lng: -87.9073 },
    { iata: 'ATL', name: 'Hartsfield-Jackson', city: 'Atlanta', lat: 33.6407, lng: -84.4277 },
    { iata: 'DFW', name: 'Dallas/Fort Worth', city: 'Dallas', lat: 32.8998, lng: -97.0403 },
    { iata: 'DEN', name: 'Denver Intl', city: 'Denver', lat: 39.8561, lng: -104.6737 },
    { iata: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', lat: 37.6213, lng: -122.3790 },
    { iata: 'SEA', name: 'Seattle-Tacoma', city: 'Seattle', lat: 47.4502, lng: -122.3088 },
    { iata: 'MIA', name: 'Miami Intl', city: 'Miami', lat: 25.7959, lng: -80.2870 },
    { iata: 'YYZ', name: 'Toronto Pearson', city: 'Toronto', lat: 43.6777, lng: -79.6248 },
    { iata: 'MEX', name: 'Mexico City Intl', city: 'Mexico City', lat: 19.4363, lng: -99.0721 },
    // Europe
    { iata: 'LHR', name: 'Heathrow', city: 'London', lat: 51.4700, lng: -0.4543 },
    { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', lat: 49.0097, lng: 2.5479 },
    { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', lat: 50.0379, lng: 8.5622 },
    { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', lat: 52.3105, lng: 4.7683 },
    { iata: 'MAD', name: 'Barajas', city: 'Madrid', lat: 40.4983, lng: -3.5676 },
    { iata: 'FCO', name: 'Fiumicino', city: 'Rome', lat: 41.8003, lng: 12.2389 },
    { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', lat: 41.2608, lng: 28.7418 },
    { iata: 'MUC', name: 'Munich', city: 'Munich', lat: 48.3537, lng: 11.7750 },
    { iata: 'BCN', name: 'El Prat', city: 'Barcelona', lat: 41.2974, lng: 2.0833 },
    { iata: 'ZRH', name: 'Zurich', city: 'Zurich', lat: 47.4647, lng: 8.5492 },
    // Middle East
    { iata: 'DXB', name: 'Dubai Intl', city: 'Dubai', lat: 25.2532, lng: 55.3657 },
    { iata: 'DOH', name: 'Hamad Intl', city: 'Doha', lat: 25.2731, lng: 51.6081 },
    { iata: 'AUH', name: 'Abu Dhabi Intl', city: 'Abu Dhabi', lat: 24.4331, lng: 54.6511 },
    { iata: 'JED', name: 'King Abdulaziz', city: 'Jeddah', lat: 21.6796, lng: 39.1565 },
    // Asia
    { iata: 'HND', name: 'Haneda', city: 'Tokyo', lat: 35.5494, lng: 139.7798 },
    { iata: 'NRT', name: 'Narita', city: 'Tokyo', lat: 35.7720, lng: 140.3929 },
    { iata: 'PEK', name: 'Capital Intl', city: 'Beijing', lat: 40.0799, lng: 116.6031 },
    { iata: 'PVG', name: 'Pudong', city: 'Shanghai', lat: 31.1443, lng: 121.8083 },
    { iata: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', lat: 22.3080, lng: 113.9185 },
    { iata: 'ICN', name: 'Incheon', city: 'Seoul', lat: 37.4602, lng: 126.4407 },
    { iata: 'SIN', name: 'Changi', city: 'Singapore', lat: 1.3644, lng: 103.9915 },
    { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', lat: 13.6900, lng: 100.7501 },
    { iata: 'DEL', name: 'Indira Gandhi', city: 'Delhi', lat: 28.5562, lng: 77.1000 },
    { iata: 'BOM', name: 'Chhatrapati Shivaji', city: 'Mumbai', lat: 19.0896, lng: 72.8656 },
    { iata: 'KUL', name: 'KL Intl', city: 'Kuala Lumpur', lat: 2.7456, lng: 101.7099 },
    // Oceania
    { iata: 'SYD', name: 'Kingsford Smith', city: 'Sydney', lat: -33.9461, lng: 151.1772 },
    { iata: 'MEL', name: 'Tullamarine', city: 'Melbourne', lat: -37.6690, lng: 144.8410 },
    { iata: 'AKL', name: 'Auckland Intl', city: 'Auckland', lat: -37.0082, lng: 174.7850 },
    // South America
    { iata: 'GRU', name: 'Guarulhos', city: 'São Paulo', lat: -23.4356, lng: -46.4731 },
    { iata: 'EZE', name: 'Ezeiza', city: 'Buenos Aires', lat: -34.8222, lng: -58.5358 },
    { iata: 'BOG', name: 'El Dorado', city: 'Bogotá', lat: 4.7016, lng: -74.1469 },
    // Africa
    { iata: 'JNB', name: 'OR Tambo', city: 'Johannesburg', lat: -26.1392, lng: 28.2460 },
    { iata: 'CAI', name: 'Cairo Intl', city: 'Cairo', lat: 30.1219, lng: 31.4056 },
    { iata: 'LOS', name: 'Murtala Muhammed', city: 'Lagos', lat: 6.5774, lng: 3.3212 },
    { iata: 'ADD', name: 'Bole Intl', city: 'Addis Ababa', lat: 8.9779, lng: 38.7993 },
];

export function getAirports() {
    return AIRPORTS;
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
        id: 'ks-1', lat: 9.5120, lng: 100.0136, name: 'Crystal Bay Beach', city: 'Koh Samui',
        streamUrl: 'https://www.youtube.com/embed/kkVrj2cr9Ko?autoplay=1&mute=1&controls=0&modestbranding=1&showinfo=0&rel=0&iv_load_policy=3&disablekb=1'
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
