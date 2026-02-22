import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import MapGL, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    fetchLiveFlights, fetchSatellites, getCCTVLocations, getAirports,
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

// Airplane SVG
const AIRPLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="%23FFCC00"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;

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
    const [dataStatus, setDataStatus] = useState({ flights: 'loading', satellites: 'loading' });
    const [mapReady, setMapReady] = useState(false);
    const [selectedFlight, setSelectedFlight] = useState(null);
    const [selectedCam, setSelectedCam] = useState(null);

    // ══════════════════════════════════════════════════════
    // 🏆 SMART HYBRID ENGINE — PERSISTENT REGISTRY
    // Snapshot every 60s → MERGE into registry → interpolate 1s
    // Aircraft persist across snapshots. Only removed if stale 3min+
    // ══════════════════════════════════════════════════════

    const STALE_MS = 300000; // 5 minutes — survive failed snapshots

    // ──── FETCH SNAPSHOT & MERGE (every 60s) ────
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
        const iv = setInterval(fetchSnapshot, 90000); // 90s — Aviation Edge
        return () => { cancelled = true; clearInterval(iv); };
    }, [onDataUpdate]);

    // ──── INTERPOLATE every 1s ────
    useEffect(() => {
        const iv = setInterval(() => {
            const cur = flightsRef.current;
            if (!cur.length) return;
            for (const f of cur) {
                if (f.heading == null || !f.speedMS) continue;
                const dLat = f.speedMS / 111000;
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

    // ──── MAP LOAD ────
    const airplaneImgRef = useRef(null); // Cache the icon image data

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

        // Helper to add the airplane icon to the map
        function addAirplaneIcon(mapInstance, imgData) {
            try {
                if (!mapInstance.hasImage('airplane-icon')) {
                    mapInstance.addImage('airplane-icon', imgData);
                }
            } catch (e) { /* ignore if map is being destroyed */ }
        }

        // Load airplane icon
        const img = new Image(24, 24);
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            airplaneImgRef.current = img;
            addAirplaneIcon(map, img);
            setMapReady(true);
        };
        img.onerror = () => setMapReady(true);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(AIRPLANE_SVG.replace(/%23/g, '#'));

        // Re-add icon whenever MapLibre rebuilds the style (wipes custom images)
        map.on('styleimagemissing', (e) => {
            if (e.id === 'airplane-icon' && airplaneImgRef.current) {
                addAirplaneIcon(map, airplaneImgRef.current);
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

    // ──── CLICK ON FLIGHT OR CCTV ────
    const onMapClick = useCallback((evt) => {
        if (!evt.features || evt.features.length === 0) {
            setSelectedFlight(null);
            setSelectedCam(null);
            return;
        }
        const f = evt.features[0];
        if (f.layer.id === 'flight-icons' || f.layer.id === 'flight-glow') {
            setSelectedCam(null);
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
            });
        } else if (f.layer.id === 'cctv-dots') {
            setSelectedFlight(null);
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
                interactiveLayerIds={['flight-icons', 'flight-glow', 'cctv-dots']}
                attributionControl={false}
                dragRotate={true}
                touchZoomRotate={true}
                cursor="default"
            >
                {/* ═══════════════════════════════════════
            FLIGHTS — ALL planes, GPU-rendered
            ═══════════════════════════════════════ */}
                <Source id="flights" type="geojson" data={flightsGeo}>
                    {/* Glow circle behind each plane */}
                    <Layer
                        id="flight-glow"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 8, 10, 12],
                            'circle-color': '#FFB800',
                            'circle-opacity': 0.15,
                            'circle-blur': 1,
                        }}
                    />
                    {/* Airplane icons */}
                    <Layer
                        id="flight-icons"
                        type="symbol"
                        layout={{
                            'icon-image': 'airplane-icon',
                            'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.35, 4, 0.5, 8, 0.8, 12, 1],
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
                {selectedFlight && (
                    <Popup
                        latitude={selectedFlight.lat}
                        longitude={selectedFlight.lng}
                        onClose={() => setSelectedFlight(null)}
                        closeOnClick={false}
                        anchor="bottom"
                        className="flight-popup-wrapper"
                    >
                        <div className="flight-popup">
                            <div className="fp-header">
                                <span className="fp-callsign">✈ {selectedFlight.callsign}</span>
                                <span className={`fp-status ${selectedFlight.status.toLowerCase()}`}>
                                    {selectedFlight.status}
                                </span>
                            </div>
                            {selectedFlight.airline && (
                                <div className="fp-airline">{selectedFlight.airline}</div>
                            )}
                            <div className="fp-grid">
                                <div className="fp-item fp-wide">
                                    <span className="fp-label">AIRCRAFT</span>
                                    <span className="fp-value">{selectedFlight.aircraftType !== '—' ? selectedFlight.aircraftType : 'Unknown'}</span>
                                </div>
                                <div className="fp-item fp-wide">
                                    <span className="fp-label">REGISTRATION</span>
                                    <span className="fp-value">{selectedFlight.registration}</span>
                                </div>
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
                                    <span className="fp-label">FL</span>
                                    <span className="fp-value">{selectedFlight.flightLevel}</span>
                                </div>
                                <div className="fp-item">
                                    <span className="fp-label">V/S</span>
                                    <span className="fp-value">{selectedFlight.verticalRate > 0 ? '+' : ''}{Math.round(selectedFlight.verticalRate * 196.85)} ft/min</span>
                                </div>
                                <div className="fp-item">
                                    <span className="fp-label">SQUAWK</span>
                                    <span className="fp-value">{selectedFlight.squawk}</span>
                                </div>
                                <div className="fp-item fp-wide">
                                    <span className="fp-label">COORDS</span>
                                    <span className="fp-value">{selectedFlight.lat.toFixed(4)}, {selectedFlight.lng.toFixed(4)}</span>
                                </div>
                            </div>
                        </div>
                    </Popup>
                )}

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
                                <span className="cam-live-badge">● LIVE</span>
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
