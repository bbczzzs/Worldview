import { useState, useEffect } from 'react';

export default function LoadingScreen({ onComplete }) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('INITIALIZING SYSTEMS...');
    const [fadeOut, setFadeOut] = useState(false);

    const statusMessages = [
        'INITIALIZING SYSTEMS...',
        'LOADING GEOSPATIAL DATA...',
        'CONNECTING SATELLITE NETWORK...',
        'RENDERING DOT MATRIX...',
        'CALIBRATING SENSORS...',
        'ESTABLISHING SECURE LINK...',
        'SYNCHRONIZING ORBITAL DATA...',
        'LOADING FLIGHT VECTORS...',
        'ACTIVATING HUD SYSTEMS...',
        'SYSTEMS ONLINE',
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                const next = prev + Math.random() * 12 + 3;
                if (next >= 100) {
                    clearInterval(interval);
                    setStatus('SYSTEMS ONLINE');
                    setTimeout(() => {
                        setFadeOut(true);
                        setTimeout(() => onComplete(), 800);
                    }, 400);
                    return 100;
                }
                // Update status message based on progress
                const idx = Math.min(Math.floor((next / 100) * statusMessages.length), statusMessages.length - 1);
                setStatus(statusMessages[idx]);
                return next;
            });
        }, 200);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
            {/* Scanline background effect */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, rgba(0,242,255,0.02) 0px, rgba(0,242,255,0.02) 1px, transparent 1px, transparent 4px)',
                pointerEvents: 'none',
            }} />

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '2px solid #00f2ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 20px rgba(0,242,255,0.3)',
                    animation: 'pulse-glow 2s ease-in-out infinite',
                }}>
                    <div style={{
                        width: '12px',
                        height: '12px',
                        background: '#00f2ff',
                        borderRadius: '50%',
                        boxShadow: '0 0 12px rgba(0,242,255,0.6)',
                    }} />
                </div>
                <span className="loading-title">WORLDVIEW</span>
            </div>

            <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-dim)',
                letterSpacing: '3px',
                marginBottom: '40px',
            }}>
                NO PLACE LEFT BEHIND
            </p>

            {/* Classification banner */}
            <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: '#ffb800',
                letterSpacing: '2px',
                marginBottom: '30px',
                textShadow: '0 0 8px rgba(255,184,0,0.3)',
            }}>
                TOP SECRET // SI-TK // NOFORN
            </div>

            {/* Progress bar */}
            <div className="loading-bar-container">
                <div className="loading-bar" style={{ width: `${progress}%` }} />
            </div>

            {/* Status text */}
            <p className="loading-text" style={{ marginTop: '16px' }}>
                {status}
            </p>

            {/* Progress percentage */}
            <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '20px',
                color: '#00f2ff',
                marginTop: '12px',
                textShadow: '0 0 12px rgba(0,242,255,0.4)',
            }}>
                {Math.round(progress)}%
            </p>

            {/* Fake system lines */}
            <div style={{
                position: 'absolute',
                bottom: '30px',
                left: '30px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-dim)',
                lineHeight: '1.8',
                opacity: progress > 20 ? 1 : 0,
                transition: 'opacity 0.5s ease',
            }}>
                <div>KH11-4166 OPS-4117</div>
                <div>ORB: 47439 PASS: DESC-179</div>
                <div>SYS_INTEGRITY: OK</div>
                <div>CRYPTO_LINK: ESTABLISHED</div>
            </div>

            <div style={{
                position: 'absolute',
                bottom: '30px',
                right: '30px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-dim)',
                lineHeight: '1.8',
                textAlign: 'right',
                opacity: progress > 40 ? 1 : 0,
                transition: 'opacity 0.5s ease',
            }}>
                <div>NET: 256-BIT AES</div>
                <div>FEED: NOMINAL</div>
                <div>LATENCY: 12ms</div>
                <div>NODES: 4,891 ACTIVE</div>
            </div>
        </div>
    );
}
