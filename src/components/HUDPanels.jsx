import { useState, useRef, useEffect, useCallback } from 'react';

/* ── SVG Icons ── */
const ChevronDown = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const FlightIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
);

const EarthquakeIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="2 12 6 8 10 16 14 4 18 14 22 12" />
    </svg>
);

const SatelliteIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="2" />
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
);

const TrafficIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="3" width="22" height="18" rx="3" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="1" y1="9" x2="23" y2="9" />
        <line x1="1" y1="15" x2="23" y2="15" />
    </svg>
);

const WeatherIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
);

const CCTVIcon = () => (
    <svg className="data-layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

/* ── Toggle Switch Component ── */
function Toggle({ checked, onChange }) {
    return (
        <label className="toggle-switch">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <span className="toggle-track" />
            <span className="toggle-knob" />
        </label>
    );
}

/* ── Collapsible Panel ── */
function CollapsiblePanel({ title, defaultOpen = true, children }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="panel">
            <div className="panel-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="panel-header-title">{title}</span>
                <ChevronDown className={`panel-toggle ${isOpen ? 'open' : ''}`} />
            </div>
            <div className={`panel-body ${isOpen ? '' : 'collapsed'}`} style={{ maxHeight: isOpen ? '500px' : '0' }}>
                {children}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   DATA LAYERS PANEL
   ══════════════════════════════════════════════════════ */
export function DataLayersPanel({ layers, onToggle, stats }) {
    const [toast, setToast] = useState(null);

    const COMING_SOON = new Set(['earthquakes', 'traffic', 'weather']);

    const handleToggle = (key) => {
        if (COMING_SOON.has(key)) {
            setToast(key);
            setTimeout(() => setToast(null), 2500);
            return;
        }
        onToggle(key);
    };

    const layerConfig = [
        {
            key: 'flights',
            name: 'Live Flights',
            icon: <FlightIcon />,
            source: 'adsb.lol + adsb.fi • live',
            count: stats.flights || '...',
        },
        {
            key: 'earthquakes',
            name: 'Earthquakes (24h)',
            icon: <EarthquakeIcon />,
            source: 'USGS',
            count: '—',
        },
        {
            key: 'satellites',
            name: 'Satellites',
            icon: <SatelliteIcon />,
            source: 'CelesTrak • live',
            count: stats.satellites || '...',
        },
        {
            key: 'traffic',
            name: 'Street Traffic',
            icon: <TrafficIcon />,
            source: 'OpenStreetMap',
            count: '—',
        },
        {
            key: 'weather',
            name: 'Weather Radar',
            icon: <WeatherIcon />,
            source: 'NOAA NEXRAD',
            count: '—',
        },
        {
            key: 'cctv',
            name: 'CCTV Mesh',
            icon: <CCTVIcon />,
            source: 'CCTV Network • 26 cams',
            count: '36',
        },
    ];

    return (
        <CollapsiblePanel title="Data Layers" defaultOpen={true}>
            {layerConfig.map((layer) => {
                const isComingSoon = COMING_SOON.has(layer.key);
                return (
                    <div key={layer.key} className={`data-layer-item ${isComingSoon ? 'coming-soon' : ''}`}>
                        <div className="data-layer-left">
                            {layer.icon}
                            <div className="data-layer-info">
                                <span className="data-layer-name">
                                    {layer.name}
                                    {isComingSoon && <span className="coming-soon-badge">SOON</span>}
                                </span>
                                <span className="data-layer-source">{layer.source}</span>
                            </div>
                        </div>
                        <div className="data-layer-right">
                            <span className="data-layer-count">{layer.count}</span>
                            {layers[layer.key] !== undefined && (
                                <>
                                    <span className={layers[layer.key] && !isComingSoon ? 'tag-on' : 'tag-off'}>
                                        {layers[layer.key] && !isComingSoon ? 'ON' : 'OFF'}
                                    </span>
                                    <Toggle
                                        checked={layers[layer.key] && !isComingSoon}
                                        onChange={() => handleToggle(layer.key)}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Coming Soon Toast */}
            {toast && (
                <div className="coming-soon-toast">
                    <span className="toast-icon">🚀</span>
                    <div className="toast-text">
                        <span className="toast-title">COMING SOON</span>
                        <span className="toast-desc">
                            {toast === 'earthquakes' && 'USGS earthquake data integration in progress'}
                            {toast === 'traffic' && 'Real-time street traffic feed coming soon'}
                            {toast === 'weather' && 'NOAA weather radar overlay in development'}
                        </span>
                    </div>
                </div>
            )}
        </CollapsiblePanel>
    );
}

/* ══════════════════════════════════════════════════════
   EFFECTS PANEL (Right Sidebar)
   ══════════════════════════════════════════════════════ */
export function EffectsPanel({ effects, onEffectChange }) {
    return (
        <CollapsiblePanel title="Post FX" defaultOpen={true}>
            <div className="slider-control">
                <div className="slider-label">
                    <span className="slider-name" style={{ color: '#00f2ff' }}>✦ Bloom</span>
                    <span className="slider-value">{effects.bloom}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={effects.bloom}
                    onChange={(e) => onEffectChange('bloom', parseInt(e.target.value))}
                />
            </div>
            <div className="slider-control">
                <div className="slider-label">
                    <span className="slider-name" style={{ color: '#ffb800' }}>● Sharpen</span>
                    <span className="slider-value">{effects.sharpen}%</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={effects.sharpen}
                    onChange={(e) => onEffectChange('sharpen', parseInt(e.target.value))}
                />
            </div>
        </CollapsiblePanel>
    );
}

/* ══════════════════════════════════════════════════════
   HUD PANEL
   ══════════════════════════════════════════════════════ */
export function HUDPanel({ layout, onLayoutChange }) {
    return (
        <CollapsiblePanel title="HUD" defaultOpen={true}>
            <div style={{ marginBottom: '10px' }}>
                <div className="slider-label" style={{ marginBottom: '6px' }}>
                    <span className="slider-name">Layout</span>
                </div>
                <select
                    className="tactical-select"
                    value={layout}
                    onChange={(e) => onLayoutChange(e.target.value)}
                >
                    <option value="tactical">Tactical</option>
                    <option value="minimal">Minimal</option>
                    <option value="full">Full</option>
                </select>
            </div>
            <button className="btn-tactical" style={{ marginBottom: '8px' }}>
                DETECT
            </button>
            <button className="btn-tactical">
                CLEAN UI
            </button>
        </CollapsiblePanel>
    );
}

/* ══════════════════════════════════════════════════════
   PANOPTIC PANEL
   ══════════════════════════════════════════════════════ */
export function PanopticPanel({ panoptic, onPanopticChange }) {
    return (
        <div className="panel" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
            <div className="panel-header" style={{ borderColor: 'rgba(0,255,136,0.15)' }}>
                <span className="panel-header-title" style={{ color: '#00ff88' }}>▦ Panoptic</span>
                <Toggle
                    checked={panoptic.enabled}
                    onChange={() => onPanopticChange('enabled', !panoptic.enabled)}
                />
            </div>
            {panoptic.enabled && (
                <div className="panel-body">
                    <div className="slider-control">
                        <div className="slider-label">
                            <span className="slider-name">Density</span>
                            <span className="slider-value">{panoptic.density}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={panoptic.density}
                            onChange={(e) => onPanopticChange('density', parseInt(e.target.value))}
                        />
                    </div>
                    <div style={{ marginTop: '10px', borderTop: '1px solid rgba(0,255,136,0.1)', paddingTop: '10px' }}>
                        <span className="slider-name" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-dim)' }}>
                            PARAMETERS
                        </span>
                        {['Pixelation', 'Distortion', 'Instability'].map((param) => (
                            <div className="slider-control" key={param}>
                                <div className="slider-label">
                                    <span className="slider-name" style={{ color: 'var(--text-secondary)' }}>{param}</span>
                                    <span className="slider-value">{panoptic[param.toLowerCase()] || 50}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={panoptic[param.toLowerCase()] || 50}
                                    onChange={(e) => onPanopticChange(param.toLowerCase(), parseInt(e.target.value))}
                                    style={{
                                        background: 'linear-gradient(to right, rgba(0,242,255,0.6), rgba(0,242,255,0.2))'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════
   SEARCH BAR — Geocoding with Nominatim (OpenStreetMap)
   ══════════════════════════════════════════════════════ */
export function SearchBar({ onFlyTo }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced geocoding search
    const handleSearch = useCallback((value) => {
        setQuery(value);
        setActiveIndex(-1);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (value.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `q=${encodeURIComponent(value)}&format=json&limit=8&addressdetails=1`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                if (!res.ok) throw new Error('Geocoding failed');
                const data = await res.json();

                const mapped = data.map((item) => {
                    const addr = item.address || {};
                    const city = addr.city || addr.town || addr.village || addr.hamlet || '';
                    const state = addr.state || '';
                    const country = addr.country || '';
                    const subtitle = [city, state, country].filter(Boolean).join(', ');

                    return {
                        id: item.place_id,
                        name: item.display_name.split(',')[0],
                        subtitle: subtitle || item.display_name,
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon),
                        type: item.type,
                        importance: item.importance,
                    };
                });

                setResults(mapped);
                setIsOpen(mapped.length > 0);
            } catch (err) {
                console.warn('[WORLDVIEW] Geocoding error:', err);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);
    }, []);

    // Select a result
    const handleSelect = useCallback((result) => {
        setQuery(result.name);
        setIsOpen(false);
        setResults([]);

        // Determine zoom level based on result type
        let zoom = 10;
        if (['country', 'state', 'region'].includes(result.type)) zoom = 5;
        else if (['city', 'town'].includes(result.type)) zoom = 11;
        else if (['village', 'hamlet', 'suburb'].includes(result.type)) zoom = 13;
        else if (['building', 'house', 'address'].includes(result.type)) zoom = 16;

        if (onFlyTo) {
            onFlyTo({ lat: result.lat, lng: result.lng, zoom, name: result.name });
        }
    }, [onFlyTo]);

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen || results.length === 0) {
            if (e.key === 'Enter' && query.trim().length >= 2) {
                handleSearch(query);
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < results.length) {
                handleSelect(results[activeIndex]);
            } else if (results.length > 0) {
                handleSelect(results[0]);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    // Get icon for result type
    const getTypeIcon = (type) => {
        switch (type) {
            case 'country': return '🌍';
            case 'state': case 'region': return '🗺️';
            case 'city': case 'town': return '🏙️';
            case 'village': case 'hamlet': return '🏘️';
            case 'island': return '🏝️';
            case 'peak': case 'mountain': return '⛰️';
            case 'river': case 'lake': case 'ocean': return '🌊';
            case 'airport': case 'aerodrome': return '✈️';
            default: return '📍';
        }
    };

    return (
        <div className="search-bar-wrapper" ref={wrapperRef}>
            <div className="search-bar-container">
                <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    className="search-bar-input"
                    placeholder="SEARCH LOCATION..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                />
                {isLoading && (
                    <div className="search-bar-spinner" />
                )}
                {query && !isLoading && (
                    <button
                        className="search-bar-clear"
                        onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && results.length > 0 && (
                <div className="search-results-dropdown">
                    {results.map((r, i) => (
                        <div
                            key={r.id}
                            className={`search-result-item ${i === activeIndex ? 'active' : ''}`}
                            onClick={() => handleSelect(r)}
                            onMouseEnter={() => setActiveIndex(i)}
                        >
                            <span className="search-result-icon">{getTypeIcon(r.type)}</span>
                            <div className="search-result-info">
                                <span className="search-result-name">{r.name}</span>
                                <span className="search-result-subtitle">{r.subtitle}</span>
                            </div>
                            <span className="search-result-coords">
                                {r.lat.toFixed(2)}, {r.lng.toFixed(2)}
                            </span>
                        </div>
                    ))}
                    <div className="search-result-footer">
                        NOMINATIM • OPENSTREETMAP
                    </div>
                </div>
            )}
        </div>
    );
};
