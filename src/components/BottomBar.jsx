import { useState, useEffect } from 'react';

const CITIES = [
    { name: 'Austin', lat: 30.27, lng: -97.74, altitude: 1.5 },
    { name: 'San Francisco', lat: 37.77, lng: -122.42, altitude: 1.5 },
    { name: 'New York', lat: 40.71, lng: -74.01, altitude: 1.2 },
    { name: 'Tokyo', lat: 35.68, lng: 139.69, altitude: 1.5 },
    { name: 'London', lat: 51.51, lng: -0.13, altitude: 1.2 },
    { name: 'Paris', lat: 48.86, lng: 2.35, altitude: 1.3 },
    { name: 'Dubai', lat: 25.20, lng: 55.27, altitude: 1.5 },
    { name: 'Washington DC', lat: 38.91, lng: -77.04, altitude: 1.0 },
];

const POIS = {
    'Washington DC': [
        { name: 'US Capitol', lat: 38.8899, lng: -77.0091 },
        { name: 'Washington Monument', lat: 38.8895, lng: -77.0353 },
        { name: 'Lincoln Memorial', lat: 38.8893, lng: -77.0502 },
        { name: 'Pentagon', lat: 38.8710, lng: -77.0559 },
        { name: 'Jefferson Memorial', lat: 38.8814, lng: -77.0365 },
    ],
    'London': [
        { name: 'Tower Bridge', lat: 51.5055, lng: -0.0754 },
        { name: 'The Shard', lat: 51.5045, lng: -0.0865 },
        { name: 'Big Ben / Parliament', lat: 51.5007, lng: -0.1246 },
        { name: "St. Paul's Cathedral", lat: 51.5138, lng: -0.0984 },
        { name: 'The Gherkin', lat: 51.5145, lng: -0.0803 },
    ],
    'New York': [
        { name: 'Times Square', lat: 40.7580, lng: -73.9855 },
        { name: 'Statue of Liberty', lat: 40.6892, lng: -74.0445 },
        { name: 'Central Park', lat: 40.7829, lng: -73.9654 },
        { name: 'Empire State', lat: 40.7484, lng: -73.9857 },
        { name: 'Brooklyn Bridge', lat: 40.7061, lng: -73.9969 },
    ],
    'Tokyo': [
        { name: 'Shibuya Crossing', lat: 35.6595, lng: 139.7004 },
        { name: 'Tokyo Tower', lat: 35.6586, lng: 139.7454 },
        { name: 'Meiji Shrine', lat: 35.6764, lng: 139.6993 },
        { name: 'Akihabara', lat: 35.7023, lng: 139.7745 },
        { name: 'Imperial Palace', lat: 35.6852, lng: 139.7528 },
    ],
    'Paris': [
        { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 },
        { name: 'Louvre', lat: 48.8606, lng: 2.3376 },
        { name: 'Notre-Dame', lat: 48.8530, lng: 2.3499 },
        { name: 'Arc de Triomphe', lat: 48.8738, lng: 2.2950 },
        { name: 'Sacré-Cœur', lat: 48.8867, lng: 2.3431 },
    ],
};

const FILTER_MODES = [
    { id: 'Normal', icon: '◯', label: 'Normal' },
    { id: 'CRT', icon: '▦', label: 'CRT' },
    { id: 'NVG', icon: '☽', label: 'NVG' },
    { id: 'FLIR', icon: '🌡', label: 'FLIR' },
    { id: 'Anime', icon: '✦', label: 'Anime' },
    { id: 'Noir', icon: '◐', label: 'Noir' },
    { id: 'Snow', icon: '❄', label: 'Snow' },
    { id: 'AI', icon: '⟐', label: 'AI' },
];

export default function BottomBar({ activeFilter, onFilterChange, selectedCity, onCityChange }) {
    const [activeCity, setActiveCity] = useState(selectedCity?.name || '');
    const activePOIs = POIS[activeCity] || [];

    const handleCityClick = (city) => {
        setActiveCity(city.name);
        onCityChange(city);
    };

    // Keep in sync with parent
    useEffect(() => {
        if (selectedCity) {
            setActiveCity(selectedCity.name);
        }
    }, [selectedCity]);

    return (
        <div className="bottom-bar">
            {/* POI Chips */}
            {activePOIs.length > 0 && (
                <div className="poi-chips">
                    {activePOIs.map((poi) => (
                        <span key={poi.name} className="poi-chip">
                            ◉ {poi.name}
                        </span>
                    ))}
                </div>
            )}

            {/* Location/City Chips */}
            <div className="location-chips">
                {CITIES.map((city) => (
                    <button
                        key={city.name}
                        className={`location-chip ${activeCity === city.name ? 'active' : ''}`}
                        onClick={() => handleCityClick(city)}
                    >
                        {city.name}
                    </button>
                ))}
            </div>

            {/* Filter Mode Bar */}
            <div className="filter-bar">
                {FILTER_MODES.map((mode) => (
                    <button
                        key={mode.id}
                        className={`filter-btn ${activeFilter === mode.id ? 'active' : ''}`}
                        onClick={() => onFilterChange(mode.id)}
                    >
                        <span className="filter-btn-icon">{mode.icon}</span>
                        <span className="filter-btn-label">{mode.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
