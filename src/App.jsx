import { useState, useCallback, useRef } from 'react';
import { useEffect } from 'react';
import TacticalGlobe from './components/TacticalGlobe';
import { DataLayersPanel, EffectsPanel, HUDPanel, PanopticPanel, SearchBar } from './components/HUDPanels';
import BottomBar from './components/BottomBar';
import LoadingScreen from './components/LoadingScreen';

/* ── Isolated clock so it doesn't re-render the whole tree ── */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="rec-text">REC {time.toISOString().replace('T', ' ').substring(0, 19)}Z</span>;
}

function EdgeClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  const f = time.toISOString().replace('T', ' ').substring(0, 19) + 'Z';
  return (
    <>
      <span className="edge-text-left">COLL: {f.substring(11, 19)}</span>
      <span className="edge-text-right">DNA: {f.substring(0, 10)}</span>
    </>
  );
}

/* ── Static telemetry ── */
function Telemetry() {
  const [v] = useState({
    gsd: (5953 + Math.random() * 100).toFixed(2),
    niirs: (Math.random() * 8).toFixed(1),
    alt: (15877285 + Math.random() * 1000).toFixed(0),
    sun: (-35 + Math.random() * 10).toFixed(1),
  });
  return (
    <div className="telemetry">
      <span className="telemetry-line">GSD: {v.gsd}M NIIRS: {v.niirs}</span>
      <span className="telemetry-line">ALT: {v.alt}M SUN: {v.sun}° EL</span>
    </div>
  );
}

/* ── Golden Matrix Background for CRT mode ── */
function MatrixBackground({ active }) {
  if (!active) return null;
  return (
    <div className="matrix-bg">
      {Array.from({ length: 15 }, (_, i) => (
        <div
          key={i}
          className="matrix-column"
          style={{
            left: `${(i / 15) * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 12}s`,
          }}
        >
          {Array.from({ length: 40 }, (_, j) => (
            <span key={j} style={{ opacity: 0.15 + Math.random() * 0.35 }}>
              {String.fromCharCode(0x30A0 + Math.random() * 96)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}



function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Normal');
  const [selectedCity, setSelectedCity] = useState(null);

  const [layers, setLayers] = useState({
    flights: true,
    earthquakes: false,
    satellites: false,
    traffic: false,
    weather: false,
    cctv: true,
  });

  const [effects, setEffects] = useState({ bloom: 100, sharpen: 56 });
  const [hudLayout, setHudLayout] = useState('tactical');
  const [panoptic, setPanoptic] = useState({
    enabled: false, density: 6,
    pixelation: 50, distortion: 50, instability: 50,
  });

  // Dynamic stats from real API data
  const [stats, setStats] = useState({
    flights: '...',
    earthquakes: '—',
    satellites: '...',
  });

  const handleDataUpdate = useCallback((type, count) => {
    setStats(prev => ({
      ...prev,
      [type]: count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count),
    }));
  }, []);

  const handleLayerToggle = useCallback((key) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleEffectChange = useCallback((key, value) => {
    setEffects(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePanopticChange = useCallback((key, value) => {
    setPanoptic(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGlobeReady = useCallback(() => { }, []);

  const getSummaryText = () => {
    const f = activeFilter.toUpperCase();
    const c = selectedCity ? selectedCity.name.toUpperCase() : 'GLOBAL';
    return `${f} ${c === 'GLOBAL' ? 'GLOBAL' : `NEAR ${c}`}`;
  };

  const getFilterClass = () => {
    return (activeFilter === 'CRT' || activeFilter === 'NVG') ? 'active' : '';
  };

  const globeStyle = (() => {
    switch (activeFilter) {
      case 'CRT': return { filter: 'contrast(1.1) brightness(0.9)' };
      case 'NVG': return { filter: 'hue-rotate(60deg) saturate(1.5) brightness(0.8)' };
      case 'FLIR': return { filter: 'grayscale(0.8) contrast(1.8) brightness(0.6) invert(1)' };
      case 'Noir': return { filter: 'grayscale(1) contrast(1.3) brightness(0.7)' };
      case 'Anime': return { filter: 'saturate(2) contrast(1.2) brightness(1.1)' };
      case 'Snow': return { filter: 'brightness(1.3) contrast(0.8) saturate(0.3)' };
      default: return {};
    }
  })();

  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  const showMatrix = activeFilter === 'CRT';

  return (
    <div className="app-container">
      {/* ── Golden Matrix Background (CRT mode) ── */}
      <MatrixBackground active={showMatrix} />

      {/* ── Globe / Map ── */}
      <div style={{ ...globeStyle, position: 'absolute', inset: 0, zIndex: 1 }}>
        <TacticalGlobe
          activeFilter={activeFilter}
          layers={layers}
          onGlobeReady={handleGlobeReady}
          selectedCity={selectedCity}
          onDataUpdate={handleDataUpdate}
        />
      </div>

      <div className="vignette" />

      <div className={`crt-overlay ${getFilterClass()}`}>
        <div className="crt-scanlines" />
        <div className="crt-flicker" />
      </div>

      <div className="edge-markers">
        <EdgeClock />
      </div>

      <div className="hud-overlay">
        {/* TOP BAR */}
        <div className="top-bar">
          <div className="top-left">
            <div className="brand">
              <div className="brand-icon" />
              <div>
                <div className="brand-title">WORLDVIEW</div>
                <div className="brand-subtitle">NO PLACE LEFT BEHIND</div>
              </div>
            </div>
            <div className="classification">TOP SECRET // SI-TK // NOFORN</div>
            <div className="classification-sub">KH11-4166 OPS-4117</div>
            <div className="mode-label">{activeFilter.toUpperCase()}</div>
            <div className="summary-text">
              SUMMARY<br />{getSummaryText()}
            </div>
          </div>
          <div className="top-right">
            <div className="active-style-label">ACTIVE STYLE</div>
            <div className="active-style-value">{activeFilter.toUpperCase()}</div>
            <div className="rec-indicator">
              <div className="rec-dot" />
              <LiveClock />
            </div>
            <div className="orbital-info">ORB: 47439 PASS: DESC-179</div>
          </div>
        </div>

        {/* LEFT SIDEBAR */}
        <div className="left-sidebar">
          <SearchBar />
          <DataLayersPanel layers={layers} onToggle={handleLayerToggle} stats={stats} />
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="right-sidebar">
          <EffectsPanel effects={effects} onEffectChange={handleEffectChange} />
          <HUDPanel layout={hudLayout} onLayoutChange={setHudLayout} />
          <PanopticPanel panoptic={panoptic} onPanopticChange={handlePanopticChange} />
        </div>

        <Telemetry />

        <BottomBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          selectedCity={selectedCity}
          onCityChange={setSelectedCity}
        />
      </div>
    </div>
  );
}

export default App;
