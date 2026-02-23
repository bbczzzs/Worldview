import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import MapGL, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    fetchLiveFlights, fetchSatellites, fetchEarthquakes, fetchWeatherRadarTimestamp,
    getCCTVLocations, getAirports, lookupAirport,
    generateFallbackFlights, generateFallbackSatellites
} from '../services/api';

// ═══ TILE-BASED SATELLITE MAP STYLE ═══
const MAP_STYLE = {
    version: 8,
    sources: {
        'esri-satellite': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© Esri',
        },
        'carto-labels': {
            type: 'raster',
            tiles: [
                'https://basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            maxzoom: 18,
        }
    },
    layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#050510' } },
        { id: 'satellite-tiles', type: 'raster', source: 'esri-satellite' },
        { id: 'labels-overlay', type: 'raster', source: 'carto-labels', paint: { 'raster-opacity': 0.85 } },
    ],
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
};

// Aircraft SVG icons — different shapes per category
const AIRCRAFT_SVGS = {
    // Heavy wide-body (big wings, larger)
    heavy: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="%23FFD700"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
    // Standard jet (medium)
    jet: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="%23FFCC00"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
    // Regional / turboprop (smaller, lighter)
    regional: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="%23FFB800"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
    // Helicopter (proper silhouette — body + rotor + tail)
    helicopter: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="%2300F2FF"><path d="M3 11h1V9h5V7H4V6h7v1h2V6h7v1h-5v2h5v2h1v1h-7.5l-.5 3h2l1 2H7l1-2h2l-.5-3H3v-1zm9-4a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/><rect x="11" y="2" width="2" height="5" rx="1" fill="%2300F2FF"/><rect x="4" y="3.5" width="16" height="1.5" rx=".75" fill="%2300F2FF" opacity=".5"/></svg>`,
    // Light / GA (tiny, dimmer)
    light: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="%23FF9900"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
};

// Heading to compass direction
function headingToCompass(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

export default function TacticalGlobe({
    activeFilter, layers, onGlobeReady, selectedCity, searchTarget, onDataUpdate
}) {
    const mapRef = useRef();
    const flightsMapRef = useRef(new Map()); // PERSISTENT MAP: id → flight object
    const flightsRef = useRef([]); // Array view for rendering


    const [flights, setFlights] = useState([]);
    const [satellites, setSatellites] = useState([]);
    const [cctvs, setCctvs] = useState([]);
    const [earthquakes, setEarthquakes] = useState([]);
    const [weatherRadarPath, setWeatherRadarPath] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [currentZoom, setCurrentZoom] = useState(1.8);
    const [dataStatus, setDataStatus] = useState({ flights: 'loading', satellites: 'loading' });
    const [mapReady, setMapReady] = useState(false);
    const [selectedFlight, setSelectedFlight] = useState(null);
    const [selectedCam, setSelectedCam] = useState(null);
    const [selectedQuake, setSelectedQuake] = useState(null);

    // ══════════════════════════════════════════════════════
    // 🏆 DUAL-ENGINE FLIGHT SYSTEM — PERSISTENT REGISTRY
    // Primary: adsb.lol (real-time ADS-B, ~0.1s delay) every 10s
    // Secondary: Aviation Edge (enrichment) every 2min background
    // Interpolate 1s between snapshots for smooth movement
    // ══════════════════════════════════════════════════════

    const STALE_MS = 45000; // 45s — tighter window since we get updates every 10s
    const lastInterpRef = useRef(Date.now()); // Track real elapsed time for interpolation

    // ──── FETCH SNAPSHOT & MERGE (every 10s — adsb.lol has no rate limits) ────
    useEffect(() => {
        let cancelled = false;
        let hasRealData = false;

        async function fetchSnapshot() {
            try {
                const data = await fetchLiveFlights();
                if (cancelled) return;
                if (data && data.length > 0) {
                    const now = Date.now();
                    const registry = flightsMapRef.current;

                    // First real data? Clear all SIM fallback flights
                    if (!hasRealData) {
                        for (const [id, f] of registry) {
                            if (f._sim) registry.delete(id);
                        }
                        hasRealData = true;
                    }

                    // Merge new data
                    for (const f of data) {
                        const existing = registry.get(f.id);
                        if (existing) {
                            existing.lat = f.lat;
                            existing.lng = f.lng;
                            existing.heading = f.heading;
                            existing.speedKts = f.speedKts;
                            existing.speedMS = (f.speedKts || 450) / 1.944;
                            existing.altFeet = f.altFeet;
                            existing.altMeters = f.altMeters;
                            existing.speed = f.speed;
                            existing.flightLevel = f.flightLevel;
                            existing.verticalRate = f.verticalRate;
                            existing.squawk = f.squawk;
                            existing.status = f.status;
                            existing.country = f.country || existing.country;
                            existing.registration = f.registration || existing.registration;
                            existing.aircraftType = f.aircraftType || existing.aircraftType;
                            existing.callsign = f.callsign || existing.callsign;
                            existing.lastSeen = now;
                        } else {
                            registry.set(f.id, {
                                ...f,
                                speedMS: (f.speedKts || 450) / 1.944,
                                lastSeen: now,
                            });
                        }
                    }

                    // Only remove stale if we got a good amount of data
                    if (data.length > 500) {
                        for (const [id, fl] of registry) {
                            if (now - fl.lastSeen > STALE_MS) registry.delete(id);
                        }
                    }

                    const arr = Array.from(registry.values());
                    flightsRef.current = arr;
                    setFlights([...arr]);
                    setDataStatus(p => ({ ...p, flights: 'live' }));
                    if (onDataUpdate) onDataUpdate('flights', arr.length);
                } else if (!hasRealData) {
                    // Show fallback ONLY on first load if API fails
                    const fb = generateFallbackFlights(2000).map(f => ({
                        ...f, speedMS: 220, lastSeen: Date.now(), _sim: true,
                    }));
                    for (const f of fb) flightsMapRef.current.set(f.id, f);
                    flightsRef.current = fb;
                    setFlights([...fb]);
                    setDataStatus(p => ({ ...p, flights: 'sim' }));
                    if (onDataUpdate) onDataUpdate('flights', fb.length);
                }
                // If API returns 0 but hasRealData → keep existing registry, planes interpolate
            } catch (err) {
                console.error('[WORLDVIEW] fetchSnapshot error:', err);
                if (!hasRealData) {
                    const fb = generateFallbackFlights(2000).map(f => ({
                        ...f, speedMS: 220, lastSeen: Date.now(), _sim: true,
                    }));
                    flightsRef.current = fb;
                    setFlights([...fb]);
                    setDataStatus(p => ({ ...p, flights: 'sim' }));
                }
            }
        }

        fetchSnapshot();
        const iv = setInterval(fetchSnapshot, 10000); // 10s — adsb.lol is free, no rate limits
        return () => { cancelled = true; clearInterval(iv); };
    }, [onDataUpdate]);

    // ──── INTERPOLATE every 1s (time-delta based) ────
    useEffect(() => {
        const iv = setInterval(() => {
            const cur = flightsRef.current;
            if (!cur.length) return;
            const now = Date.now();
            const dtSec = Math.min((now - lastInterpRef.current) / 1000, 3); // cap at 3s to prevent jumps
            lastInterpRef.current = now;
            for (const f of cur) {
                if (f.heading == null || !f.speedMS) continue;
                const dLat = (f.speedMS * dtSec) / 111000;
                const rad = (f.heading * Math.PI) / 180;
                f.lat = Math.max(-85, Math.min(85, f.lat + Math.cos(rad) * dLat));
                f.lng = ((f.lng + Math.sin(rad) * dLat) + 540) % 360 - 180;
            }
            setFlights([...cur]);
        }, 1000);
        return () => clearInterval(iv);
    }, []);

    // ──── FETCH LIVE SATELLITES (every 30s) ────
    useEffect(() => {
        let cancelled = false;
        async function load() {
            const data = await fetchSatellites(150);
            if (cancelled) return;
            if (data && data.length > 0) {
                setSatellites(data);
                setDataStatus(p => ({ ...p, satellites: 'live' }));
                if (onDataUpdate) onDataUpdate('satellites', data.length);
            } else {
                const fb = generateFallbackSatellites(80);
                setSatellites(fb);
                setDataStatus(p => ({ ...p, satellites: 'sim' }));
                if (onDataUpdate) onDataUpdate('satellites', fb.length);
            }
        }
        load();
        const iv = setInterval(load, 15000); // 15s — adsb.lol has no rate limits
        return () => { cancelled = true; clearInterval(iv); };
    }, [onDataUpdate]);

    useEffect(() => { setCctvs(getCCTVLocations()); }, []);

    // ──── EARTHQUAKES (USGS) ────
    useEffect(() => {
        if (!layers.earthquakes) { setEarthquakes([]); return; }
        let cancelled = false;
        async function load() {
            const data = await fetchEarthquakes();
            if (!cancelled && data) {
                setEarthquakes(data);
                if (onDataUpdate) onDataUpdate('earthquakes', data.length);
            }
        }
        load();
        const iv = setInterval(load, 300000); // 5 min
        return () => { cancelled = true; clearInterval(iv); };
    }, [layers.earthquakes, onDataUpdate]);

    // ──── WEATHER RADAR (RainViewer) ────
    useEffect(() => {
        if (!layers.weather) { setWeatherRadarPath(null); return; }
        let cancelled = false;
        async function load() {
            const path = await fetchWeatherRadarTimestamp();
            if (!cancelled && path) setWeatherRadarPath(path);
        }
        load();
        const iv = setInterval(load, 600000); // 10 min
        return () => { cancelled = true; clearInterval(iv); };
    }, [layers.weather]);

    // ──── ZOOM TRACKING ────
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const onMove = () => setCurrentZoom(map.getZoom());
        map.on('moveend', onMove);
        map.on('zoomend', onMove);
        return () => { map.off('moveend', onMove); map.off('zoomend', onMove); };
    }, [mapReady]);

    // ──── SIMULATED STREET VEHICLES ────
    const vehiclesRef = useRef([]);

    useEffect(() => {
        if (!layers.traffic || currentZoom < 14 || !mapRef.current) {
            setVehicles([]);
            vehiclesRef.current = [];
            return;
        }

        function generateVehicles() {
            const map = mapRef.current;
            if (!map) return;
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const lngSpan = ne.lng - sw.lng;
            const latSpan = ne.lat - sw.lat;
            const count = 25;
            const vehs = [];
            for (let i = 0; i < count; i++) {
                const heading = [0, 90, 180, 270][Math.floor(Math.random() * 4)] + (Math.random() * 30 - 15);
                vehs.push({
                    id: `VEH-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
                    lat: sw.lat + Math.random() * latSpan,
                    lng: sw.lng + Math.random() * lngSpan,
                    heading,
                    speed: 0.00002 + Math.random() * 0.00004, // degrees per tick
                });
            }
            vehiclesRef.current = vehs;
            setVehicles([...vehs]);
        }

        // Generate initial set
        generateVehicles();

        // Animate vehicles every 2 seconds
        const iv = setInterval(() => {
            const vehs = vehiclesRef.current;
            for (const v of vehs) {
                const rad = (v.heading * Math.PI) / 180;
                v.lng += Math.sin(rad) * v.speed;
                v.lat += Math.cos(rad) * v.speed;
                // Small random drift
                v.heading += (Math.random() - 0.5) * 8;
            }
            setVehicles([...vehs]);
        }, 2000);

        // Regenerate when panning
        const map = mapRef.current;
        const onMove = () => generateVehicles();
        map.on('moveend', onMove);

        return () => {
            clearInterval(iv);
            map.off('moveend', onMove);
        };
    }, [layers.traffic, currentZoom >= 14, mapReady]);

    // ──── MAP LOAD ────
    const airplaneImgsRef = useRef({}); // Cache all icon images

    const onMapLoad = useCallback((evt) => {
        const map = evt.target;

        try {
            map.setFog({
                color: 'rgba(10, 10, 26, 1)',
                'high-color': 'rgba(20, 20, 60, 1)',
                'horizon-blend': 0.02,
                'space-color': 'rgba(5, 5, 16, 1)',
                'star-intensity': 0.6,
            });
        } catch (e) { /* fog not supported */ }

        // Load all aircraft category icons
        const categories = Object.keys(AIRCRAFT_SVGS);
        let loaded = 0;

        for (const cat of categories) {
            const iconName = `aircraft-${cat}`;
            const svg = AIRCRAFT_SVGS[cat];
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                airplaneImgsRef.current[iconName] = img;
                try {
                    if (!map.hasImage(iconName)) {
                        map.addImage(iconName, img);
                    }
                } catch (e) { /* ignore */ }
                loaded++;
                if (loaded === categories.length) setMapReady(true);
            };
            img.onerror = () => {
                loaded++;
                if (loaded === categories.length) setMapReady(true);
            };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/%23/g, '#'));
        }

        // Re-add icons whenever MapLibre rebuilds the style
        map.on('styleimagemissing', (e) => {
            const cached = airplaneImgsRef.current[e.id];
            if (cached) {
                try { map.addImage(e.id, cached); } catch (err) { /* ignore */ }
            }
        });

        if (onGlobeReady) onGlobeReady();
    }, [onGlobeReady]);

    // ──── FLY TO CITY ────
    useEffect(() => {
        if (!mapRef.current || !selectedCity) return;
        mapRef.current.flyTo({
            center: [selectedCity.lng, selectedCity.lat],
            zoom: selectedCity.zoom || 8,
            duration: 2000,
        });
    }, [selectedCity]);

    // ──── FLY TO SEARCH TARGET ────
    useEffect(() => {
        if (!mapRef.current || !searchTarget) return;
        mapRef.current.flyTo({
            center: [searchTarget.lng, searchTarget.lat],
            zoom: searchTarget.zoom || 10,
            duration: 2500,
            essential: true,
        });
    }, [searchTarget]);

    // ──── CLICK ON FLIGHT, CCTV, OR EARTHQUAKE ────
    const onMapClick = useCallback((evt) => {
        if (!evt.features || evt.features.length === 0) {
            setSelectedFlight(null);
            setSelectedCam(null);
            setSelectedQuake(null);
            return;
        }
        const f = evt.features[0];
        if (f.layer.id === 'flight-icons' || f.layer.id === 'flight-glow') {
            setSelectedCam(null);
            setSelectedQuake(null);
            const props = f.properties;
            setSelectedFlight({
                lng: f.geometry.coordinates[0],
                lat: f.geometry.coordinates[1],
                callsign: props.callsign || '—',
                country: props.country || '—',
                altFeet: props.altFeet || '—',
                speed: props.speed || '—',
                heading: props.heading || 0,
                flightLevel: props.flightLevel || '—',
                status: props.status || '—',
                verticalRate: props.verticalRate || 0,
                squawk: props.squawk || '—',
                registration: props.registration || '—',
                aircraftType: props.aircraftType || '—',
                airline: props.airline || '',
                depAirport: props.depAirport || '',
                arrAirport: props.arrAirport || '',
                category: props.category || 'jet',
            });
        } else if (f.layer.id === 'quake-core' || f.layer.id === 'quake-pulse') {
            setSelectedFlight(null);
            setSelectedCam(null);
            const props = f.properties;
            setSelectedQuake({
                lng: f.geometry.coordinates[0],
                lat: f.geometry.coordinates[1],
                mag: props.mag || 0,
                depth: props.depth || 0,
                place: props.place || 'Unknown',
                time: props.time || Date.now(),
            });
        } else if (f.layer.id === 'cctv-dots') {
            setSelectedFlight(null);
            setSelectedQuake(null);
            const props = f.properties;
            setSelectedCam({
                lng: f.geometry.coordinates[0],
                lat: f.geometry.coordinates[1],
                name: props.name || 'Camera',
                city: props.city || '',
                streamUrl: props.streamUrl || '',
                status: props.status || 'online',
            });
        } else {
            setSelectedFlight(null);
            setSelectedCam(null);
            setSelectedQuake(null);
        }
    }, []);

    // ════════════════════════════════════════
    //  GEOJSON SOURCES
    // ════════════════════════════════════════

    const flightsGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (layers.flights ? flights : []).map(f => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
            properties: {
                callsign: f.callsign || '',
                heading: f.heading || 0,
                country: f.country || '',
                altFeet: f.altFeet || 0,
                speed: f.speed || '—',
                flightLevel: f.flightLevel || '—',
                status: f.status || '—',
                verticalRate: f.verticalRate || 0,
                squawk: f.squawk || '—',
                registration: f.registration || '',
                aircraftType: f.aircraftType || '',
                airline: f.airline || '',
                category: f.category || 'jet',
                depAirport: f.depAirport || '',
                arrAirport: f.arrAirport || '',
            },
        })),
    }), [flights, layers.flights]);

    const satsGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (layers.satellites ? satellites : []).map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
            properties: { name: s.name || '', displayName: s.displayName || '' },
        })),
    }), [satellites, layers.satellites]);

    const cctvGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (layers.cctv ? cctvs : []).map(c => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
            properties: {
                name: c.name || '',
                city: c.city || '',
                status: c.status || 'offline',
                streamUrl: c.streamUrl || '',
            },
        })),
    }), [cctvs, layers.cctv]);

    // Airports GeoJSON — shown when flights layer is on
    const airportsGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: (layers.flights ? getAirports() : []).map(a => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
            properties: { iata: a.iata, name: a.name, city: a.city },
        })),
    }), [layers.flights]);

    // Simulated street vehicles GeoJSON
    const vehiclesGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: vehicles.map(v => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
            properties: { id: v.id, heading: v.heading },
        })),
    }), [vehicles]);

    // Earthquakes GeoJSON
    const quakesGeo = useMemo(() => ({
        type: 'FeatureCollection',
        features: earthquakes.map(q => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [q.lng, q.lat] },
            properties: {
                id: q.id,
                mag: q.magnitude,
                depth: q.depth,
                place: q.place,
                time: q.time,
            },
        })),
    }), [earthquakes]);

    return (
        <div className="globe-container">
            <MapGL
                ref={mapRef}
                initialViewState={{ longitude: -40, latitude: 30, zoom: 1.8 }}
                projection="globe"
                mapStyle={MAP_STYLE}
                style={{ width: '100%', height: '100%' }}
                onLoad={onMapLoad}
                onClick={onMapClick}
                interactiveLayerIds={['flight-icons', 'flight-glow', 'cctv-dots', 'quake-core', 'quake-pulse']}
                attributionControl={false}
                dragRotate={true}
                touchZoomRotate={true}
                cursor="default"
            >
                {/* ═══════════════════════════════════════
            FLIGHTS — ALL planes, GPU-rendered
            ═══════════════════════════════════════ */}
                <Source id="flights" type="geojson" data={flightsGeo}>
                    {/* Glow circle — only visible when zoomed in (saves GPU at global view) */}
                    <Layer
                        id="flight-glow"
                        type="circle"
                        minzoom={4}
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6, 12, 10],
                            'circle-color': '#FFB800',
                            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.05, 6, 0.1, 10, 0.15],
                            'circle-blur': 0.8,
                        }}
                    />
                    {/* Airplane icons */}
                    <Layer
                        id="flight-icons"
                        type="symbol"
                        layout={{
                            'icon-image': ['match', ['get', 'category'],
                                'heavy', 'aircraft-heavy',
                                'jet', 'aircraft-jet',
                                'regional', 'aircraft-regional',
                                'helicopter', 'aircraft-helicopter',
                                'light', 'aircraft-light',
                                'aircraft-jet' // fallback
                            ],
                            'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 4, 0.55, 8, 0.85, 12, 1.1],
                            'icon-rotate': ['get', 'heading'],
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true,
                            'icon-optional': true,
                            'icon-padding': 0,
                        }}
                    />
                    {/* Callsign labels (zoom >= 5) */}
                    <Layer
                        id="flight-labels"
                        type="symbol"
                        minzoom={5}
                        layout={{
                            'text-field': ['get', 'callsign'],
                            'text-size': 10,
                            'text-offset': [1.5, 0],
                            'text-anchor': 'left',
                            'text-font': ['Open Sans Regular'],
                            'text-allow-overlap': false,
                        }}
                        paint={{
                            'text-color': '#FFD700',
                            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
                            'text-halo-width': 1,
                        }}
                    />
                </Source>

                {/* ═══════════════════════════════════════
            STREET TRAFFIC — TomTom real-time flow tiles
            ═══════════════════════════════════════ */}
                {layers.traffic && (
                    <Source
                        id="traffic-tiles"
                        type="raster"
                        tiles={[
                            `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${import.meta.env.VITE_TOMTOM_KEY}&tileSize=256`
                        ]}
                        tileSize={256}
                        minzoom={10}
                        maxzoom={18}
                    >
                        <Layer
                            id="traffic-flow"
                            type="raster"
                            minzoom={10}
                            paint={{
                                'raster-opacity': 0.75,
                            }}
                        />
                    </Source>
                )}

                {/* ═══════════════════════════════════════
            VEHICLE TARGETS — simulated moving dots (zoom 14+)
            ═══════════════════════════════════════ */}
                {layers.traffic && vehicles.length > 0 && (
                    <Source id="vehicles" type="geojson" data={vehiclesGeo}>
                        {/* Outer glow ring */}
                        <Layer
                            id="veh-glow"
                            type="circle"
                            paint={{
                                'circle-radius': 12,
                                'circle-color': '#00f2ff',
                                'circle-opacity': 0.08,
                                'circle-blur': 1,
                            }}
                        />
                        {/* Core dot */}
                        <Layer
                            id="veh-dot"
                            type="circle"
                            paint={{
                                'circle-radius': 3,
                                'circle-color': '#00f2ff',
                                'circle-opacity': 0.9,
                                'circle-stroke-width': 1,
                                'circle-stroke-color': 'rgba(0, 242, 255, 0.4)',
                            }}
                        />
                        {/* VEH-XXXX labels */}
                        <Layer
                            id="veh-labels"
                            type="symbol"
                            layout={{
                                'text-field': ['get', 'id'],
                                'text-size': 9,
                                'text-offset': [0, -1.5],
                                'text-anchor': 'bottom',
                                'text-font': ['Open Sans Regular'],
                                'text-allow-overlap': true,
                            }}
                            paint={{
                                'text-color': 'rgba(0, 242, 255, 0.8)',
                                'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                                'text-halo-width': 1,
                            }}
                        />
                    </Source>
                )}

                {/* ═══════════════════════════════════════
            EARTHQUAKES — USGS magnitude-scaled circles
            ═══════════════════════════════════════ */}
                {layers.earthquakes && earthquakes.length > 0 && (
                    <Source id="earthquakes" type="geojson" data={quakesGeo}>
                        {/* Outer pulse ring — scaled by magnitude */}
                        <Layer
                            id="quake-pulse"
                            type="circle"
                            paint={{
                                'circle-radius': ['interpolate', ['linear'], ['get', 'mag'],
                                    1, 6, 3, 12, 5, 22, 7, 40, 9, 60
                                ],
                                'circle-color': ['interpolate', ['linear'], ['get', 'mag'],
                                    1, '#ff9500', 3, '#ff5500', 5, '#ff2200', 7, '#ff0000'
                                ],
                                'circle-opacity': 0.12,
                                'circle-blur': 0.8,
                            }}
                        />
                        {/* Core dot */}
                        <Layer
                            id="quake-core"
                            type="circle"
                            paint={{
                                'circle-radius': ['interpolate', ['linear'], ['get', 'mag'],
                                    1, 3, 3, 5, 5, 8, 7, 12
                                ],
                                'circle-color': ['interpolate', ['linear'], ['get', 'mag'],
                                    1, '#ffaa00', 3, '#ff6600', 5, '#ff2200', 7, '#ff0000'
                                ],
                                'circle-opacity': 0.85,
                                'circle-stroke-width': 1,
                                'circle-stroke-color': 'rgba(255, 100, 0, 0.4)',
                            }}
                        />
                        {/* Magnitude labels */}
                        <Layer
                            id="quake-labels"
                            type="symbol"
                            layout={{
                                'text-field': ['concat', 'M', ['to-string', ['get', 'mag']]],
                                'text-size': 9,
                                'text-offset': [0, -1.5],
                                'text-anchor': 'bottom',
                                'text-font': ['Open Sans Regular'],
                                'text-allow-overlap': false,
                            }}
                            paint={{
                                'text-color': '#ff6600',
                                'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                                'text-halo-width': 1,
                            }}
                        />
                    </Source>
                )}

                {/* ═══════════════════════════════════════
            WEATHER RADAR — RainViewer precipitation overlay
            ═══════════════════════════════════════ */}
                {layers.weather && weatherRadarPath && (
                    <Source
                        id="weather-radar"
                        type="raster"
                        tiles={[
                            `https://tilecache.rainviewer.com${weatherRadarPath}/256/{z}/{x}/{y}/2/1_1.png`
                        ]}
                        tileSize={256}
                    >
                        <Layer
                            id="weather-radar-layer"
                            type="raster"
                            paint={{
                                'raster-opacity': 0.6,
                            }}
                        />
                    </Source>
                )}

                {/* ═══════════════════════════════════════
            SATELLITES — with glow/pulse effect
            ═══════════════════════════════════════ */}
                <Source id="satellites" type="geojson" data={satsGeo}>
                    {/* Outer glow ring */}
                    <Layer
                        id="sat-glow-outer"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 10, 5, 14],
                            'circle-color': '#FFB800',
                            'circle-opacity': 0.08,
                            'circle-blur': 1,
                        }}
                    />
                    {/* Inner glow */}
                    <Layer
                        id="sat-glow-inner"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 8],
                            'circle-color': '#FFB800',
                            'circle-opacity': 0.2,
                            'circle-blur': 0.5,
                        }}
                    />
                    {/* Core dot */}
                    <Layer
                        id="sat-core"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 5, 4],
                            'circle-color': '#FFD700',
                            'circle-opacity': 0.95,
                            'circle-stroke-width': 1,
                            'circle-stroke-color': 'rgba(255, 184, 0, 0.6)',
                        }}
                    />
                    {/* Labels */}
                    <Layer
                        id="sat-labels"
                        type="symbol"
                        layout={{
                            'text-field': ['get', 'name'],
                            'text-size': 9,
                            'text-offset': [1.5, 0],
                            'text-anchor': 'left',
                            'text-font': ['Open Sans Regular'],
                            'text-allow-overlap': false,
                        }}
                        paint={{
                            'text-color': '#FFB800',
                            'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                            'text-halo-width': 1,
                        }}
                    />
                </Source>

                {/* ═══════════════════════════════════════
            CCTV — Camera locations
            ═══════════════════════════════════════ */}
                <Source id="cctv" type="geojson" data={cctvGeo}>
                    {/* Outer glow pulse */}
                    <Layer
                        id="cctv-glow"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 5, 14, 10, 20],
                            'circle-color': '#FF4500',
                            'circle-opacity': 0.12,
                            'circle-blur': 1,
                        }}
                    />
                    {/* Main dot */}
                    <Layer
                        id="cctv-dots"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 5, 6, 10, 9],
                            'circle-color': '#FF4500',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#FFD700',
                        }}
                    />
                    {/* Camera icon label */}
                    <Layer
                        id="cctv-labels"
                        type="symbol"
                        minzoom={3}
                        layout={{
                            'text-field': '📹',
                            'text-size': ['interpolate', ['linear'], ['zoom'], 3, 12, 6, 16, 10, 20],
                            'text-offset': [0, -1.5],
                            'text-anchor': 'bottom',
                            'text-allow-overlap': true,
                            'text-ignore-placement': true,
                        }}
                    />
                    {/* Name labels at higher zoom */}
                    <Layer
                        id="cctv-name-labels"
                        type="symbol"
                        minzoom={5}
                        layout={{
                            'text-field': ['get', 'name'],
                            'text-size': 10,
                            'text-offset': [0, 1],
                            'text-anchor': 'top',
                            'text-font': ['Open Sans Regular'],
                            'text-allow-overlap': false,
                        }}
                        paint={{
                            'text-color': '#FF6B00',
                            'text-halo-color': 'rgba(0, 0, 0, 0.85)',
                            'text-halo-width': 1.5,
                        }}
                    />
                </Source>

                {/* ═══════════════════════════════════════
            AIRPORTS — Major world airports
            ═══════════════════════════════════════ */}
                <Source id="airports" type="geojson" data={airportsGeo}>
                    <Layer
                        id="airport-markers"
                        type="circle"
                        minzoom={3}
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 5, 10, 8],
                            'circle-color': 'rgba(0, 200, 255, 0.15)',
                            'circle-stroke-width': 1.5,
                            'circle-stroke-color': '#00C8FF',
                        }}
                    />
                    <Layer
                        id="airport-labels"
                        type="symbol"
                        minzoom={4}
                        layout={{
                            'text-field': ['get', 'iata'],
                            'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 8, 11],
                            'text-offset': [0, -1.2],
                            'text-anchor': 'bottom',
                            'text-font': ['Open Sans Bold'],
                            'text-allow-overlap': false,
                        }}
                        paint={{
                            'text-color': '#00C8FF',
                            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                            'text-halo-width': 1.5,
                        }}
                    />
                    <Layer
                        id="airport-name-labels"
                        type="symbol"
                        minzoom={7}
                        layout={{
                            'text-field': ['concat', ['get', 'name'], ' (', ['get', 'iata'], ')'],
                            'text-size': 9,
                            'text-offset': [0, 1],
                            'text-anchor': 'top',
                            'text-font': ['Open Sans Regular'],
                            'text-allow-overlap': false,
                        }}
                        paint={{
                            'text-color': 'rgba(0, 200, 255, 0.6)',
                            'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                            'text-halo-width': 1,
                        }}
                    />
                </Source>

                {/* ═══════════════════════════════════════
            FLIGHT DETAIL POPUP
            ═══════════════════════════════════════ */}
                {selectedFlight && (() => {
                    const dep = lookupAirport(selectedFlight.depAirport);
                    const arr = lookupAirport(selectedFlight.arrAirport);
                    return (
                        <Popup
                            latitude={selectedFlight.lat}
                            longitude={selectedFlight.lng}
                            onClose={() => setSelectedFlight(null)}
                            closeOnClick={false}
                            anchor="bottom"
                            className="flight-popup-wrapper"
                        >
                            <div className="flight-popup">
                                {/* Header */}
                                <div className="fp-header">
                                    <span className="fp-callsign">✈ {selectedFlight.callsign}</span>
                                    <span className={`fp-status ${selectedFlight.status.toLowerCase()}`}>
                                        {selectedFlight.status}
                                    </span>
                                </div>
                                {selectedFlight.airline && (
                                    <div className="fp-airline">{selectedFlight.airline}</div>
                                )}

                                {/* Route: Departure → Arrival */}
                                {(selectedFlight.depAirport || selectedFlight.arrAirport) && (
                                    <div className="fp-route">
                                        <div className="fp-route-point">
                                            <span className="fp-route-code">{selectedFlight.depAirport || '???'}</span>
                                            <span className="fp-route-name">
                                                {dep ? `${dep.name}` : 'Unknown'}
                                            </span>
                                            <span className="fp-route-city">
                                                {dep ? dep.city : ''}
                                            </span>
                                        </div>
                                        <div className="fp-route-line">
                                            <span className="fp-route-dash"></span>
                                            <span className="fp-route-plane">✈</span>
                                            <span className="fp-route-dash"></span>
                                        </div>
                                        <div className="fp-route-point fp-route-arr">
                                            <span className="fp-route-code">{selectedFlight.arrAirport || '???'}</span>
                                            <span className="fp-route-name">
                                                {arr ? `${arr.name}` : 'Unknown'}
                                            </span>
                                            <span className="fp-route-city">
                                                {arr ? arr.city : ''}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Info Grid */}
                                <div className="fp-grid">
                                    <div className="fp-item">
                                        <span className="fp-label">ALTITUDE</span>
                                        <span className="fp-value">{selectedFlight.altFeet?.toLocaleString() || '—'} ft</span>
                                    </div>
                                    <div className="fp-item">
                                        <span className="fp-label">SPEED</span>
                                        <span className="fp-value">{selectedFlight.speed}</span>
                                    </div>
                                    <div className="fp-item">
                                        <span className="fp-label">HEADING</span>
                                        <span className="fp-value">{Math.round(selectedFlight.heading)}° {headingToCompass(selectedFlight.heading)}</span>
                                    </div>
                                    <div className="fp-item">
                                        <span className="fp-label">AIRCRAFT</span>
                                        <span className="fp-value">{selectedFlight.aircraftType || '—'}</span>
                                    </div>
                                    {selectedFlight.registration && (
                                        <div className="fp-item fp-wide">
                                            <span className="fp-label">REGISTRATION</span>
                                            <span className="fp-value">{selectedFlight.registration}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    );
                })()}

                {/* ═══════════════════════════════════════
            LIVE CAM POPUP
            ═══════════════════════════════════════ */}
                {selectedCam && (
                    <Popup
                        latitude={selectedCam.lat}
                        longitude={selectedCam.lng}
                        onClose={() => setSelectedCam(null)}
                        closeOnClick={false}
                        anchor="bottom"
                        className="cam-popup-wrapper"
                        maxWidth="420px"
                    >
                        <div className="cam-popup">
                            <div className="cam-header">
                                <span className="cam-title">📹 {selectedCam.name}</span>
                                <span className="cam-city">{selectedCam.city}</span>
                                <span className="cam-live-badge">LIVE</span>
                            </div>
                            <div className="cam-player">
                                <iframe
                                    src={selectedCam.streamUrl}
                                    width="400"
                                    height="225"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={selectedCam.name}
                                />
                            </div>
                        </div>
                    </Popup>
                )}

                {/* ═══════════════════════════════════════
            EARTHQUAKE DETAIL POPUP
            ═══════════════════════════════════════ */}
                {selectedQuake && (() => {
                    const timeAgo = (() => {
                        const diff = Date.now() - selectedQuake.time;
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                    })();
                    const severity = selectedQuake.mag >= 6 ? 'severe' : selectedQuake.mag >= 4 ? 'moderate' : 'minor';
                    return (
                        <Popup
                            latitude={selectedQuake.lat}
                            longitude={selectedQuake.lng}
                            onClose={() => setSelectedQuake(null)}
                            closeOnClick={false}
                            anchor="bottom"
                            className="quake-popup-wrapper"
                        >
                            <div className="quake-popup">
                                <div className="qp-header">
                                    <span className="qp-mag">M{selectedQuake.mag}</span>
                                    <span className={`qp-severity ${severity}`}>{severity.toUpperCase()}</span>
                                </div>
                                <div className="qp-location">{selectedQuake.place}</div>
                                <div className="qp-grid">
                                    <div className="qp-item">
                                        <span className="qp-label">DEPTH</span>
                                        <span className="qp-value">{selectedQuake.depth.toFixed(1)} km</span>
                                    </div>
                                    <div className="qp-item">
                                        <span className="qp-label">TIME</span>
                                        <span className="qp-value">{timeAgo}</span>
                                    </div>
                                    <div className="qp-item">
                                        <span className="qp-label">LAT</span>
                                        <span className="qp-value">{selectedQuake.lat.toFixed(3)}°</span>
                                    </div>
                                    <div className="qp-item">
                                        <span className="qp-label">LNG</span>
                                        <span className="qp-value">{selectedQuake.lng.toFixed(3)}°</span>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    );
                })()}
            </MapGL>

            {/* Live status badges */}
            <div className="globe-status-badges">
                <Badge label="FLIGHTS" status={dataStatus.flights} count={flights.length} />
                <Badge label="SATS" status={dataStatus.satellites} count={satellites.length} />
            </div>
        </div>
    );
}

function Badge({ label, status, count }) {
    const live = status === 'live';
    const loading = status === 'loading';
    return (
        <div className={`status-badge ${live ? 'live' : loading ? 'loading' : 'sim'}`}>
            <span className="status-dot" />
            {label}: {loading ? '...' : count.toLocaleString()} {live ? 'LIVE' : loading ? '' : 'SIM'}
        </div>
    );
}
