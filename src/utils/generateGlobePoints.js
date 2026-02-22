/**
 * Generate land points from an Earth alpha/topology map image.
 * Loads the image into a canvas, samples pixels, and creates
 * a point-cloud of {lat, lng, size} for land masses.
 */

const EARTH_TOPOLOGY = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

/**
 * Load an image and sample it to generate land coordinate points.
 * White/bright pixels = land → generate a dot
 * Dark pixels = water → skip
 *
 * @param {number} sampleStep - Pixel step size (lower = more points, better detail)
 * @param {number} threshold - Brightness threshold for land detection (0-255)
 * @returns {Promise<Array<{lat: number, lng: number, size: number}>>}
 */
export function generateLandPointsFromImage(sampleStep = 3, threshold = 30) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const points = [];

            for (let y = 0; y < canvas.height; y += sampleStep) {
                for (let x = 0; x < canvas.width; x += sampleStep) {
                    const i = (y * canvas.width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const brightness = (r + g + b) / 3;

                    if (brightness > threshold) {
                        // Convert pixel x,y → lat/lng
                        const lat = 90 - (y / canvas.height) * 180;
                        const lng = (x / canvas.width) * 360 - 180;

                        // Size varies with brightness for depth effect
                        const normBright = brightness / 255;
                        const size = 0.1 + normBright * 0.12;

                        points.push({ lat, lng, size });
                    }
                }
            }

            console.log(`[WORLDVIEW] Generated ${points.length} land points from topology map`);
            resolve(points);
        };

        img.onerror = () => {
            console.warn('[WORLDVIEW] Failed to load topology image, using fallback');
            resolve(generateFallbackLandPoints());
        };

        img.src = EARTH_TOPOLOGY;
    });
}

/**
 * Fallback land point generator using simplified continent boundaries.
 * Used when the canvas/image approach fails.
 */
function generateFallbackLandPoints() {
    const CONTINENTS = [
        { minLat: 15, maxLat: 72, minLng: -170, maxLng: -50 },
        { minLat: -56, maxLat: 15, minLng: -82, maxLng: -34 },
        { minLat: 35, maxLat: 72, minLng: -12, maxLng: 40 },
        { minLat: -35, maxLat: 37, minLng: -18, maxLng: 52 },
        { minLat: 1, maxLat: 75, minLng: 26, maxLng: 180 },
        { minLat: -45, maxLat: -10, minLng: 110, maxLng: 155 },
        { minLat: 30, maxLat: 46, minLng: 126, maxLng: 146 },
        { minLat: -11, maxLat: 6, minLng: 95, maxLng: 141 },
        { minLat: 6, maxLat: 36, minLng: 68, maxLng: 98 },
        { minLat: 12, maxLat: 42, minLng: 26, maxLng: 63 },
    ];

    const points = [];
    const density = 1.8;

    for (let lat = -85; lat <= 85; lat += density) {
        const lngStep = density / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
        for (let lng = -180; lng <= 180; lng += Math.max(lngStep, density * 0.5)) {
            for (const c of CONTINENTS) {
                if (lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng) {
                    points.push({
                        lat: lat + (Math.random() - 0.5) * 0.5,
                        lng: lng + (Math.random() - 0.5) * 0.5,
                        size: 0.12 + Math.random() * 0.06,
                    });
                    break;
                }
            }
        }
    }
    return points;
}

/**
 * Generate graticule (lat/long grid) lines as arc data.
 * These appear as thin glowing lines on the globe.
 */
export function generateGraticule() {
    const arcs = [];

    // Latitude lines every 30 degrees
    for (let lat = -60; lat <= 60; lat += 30) {
        const points = [];
        for (let lng = -180; lng <= 180; lng += 5) {
            points.push({ lat, lng });
        }
        for (let i = 0; i < points.length - 1; i++) {
            arcs.push({
                startLat: points[i].lat,
                startLng: points[i].lng,
                endLat: points[i + 1].lat,
                endLng: points[i + 1].lng,
                type: 'graticule',
            });
        }
    }

    // Longitude lines every 30 degrees
    for (let lng = -180; lng < 180; lng += 30) {
        const points = [];
        for (let lat = -90; lat <= 90; lat += 5) {
            points.push({ lat, lng });
        }
        for (let i = 0; i < points.length - 1; i++) {
            arcs.push({
                startLat: points[i].lat,
                startLng: points[i].lng,
                endLat: points[i + 1].lat,
                endLng: points[i + 1].lng,
                type: 'graticule',
            });
        }
    }

    return arcs;
}

/**
 * Generate connecting arcs between major cities for visual effect.
 */
export function generateFlightArcs() {
    const cities = [
        { lat: 40.71, lng: -74.01 },   // New York
        { lat: 51.51, lng: -0.13 },    // London
        { lat: 48.86, lng: 2.35 },     // Paris
        { lat: 35.68, lng: 139.69 },   // Tokyo
        { lat: 25.20, lng: 55.27 },    // Dubai
        { lat: 37.77, lng: -122.42 },  // San Francisco
        { lat: 1.35, lng: 103.82 },    // Singapore
        { lat: -33.87, lng: 151.21 },  // Sydney
        { lat: 55.75, lng: 37.62 },    // Moscow
        { lat: 19.43, lng: -99.13 },   // Mexico City
        { lat: -23.55, lng: -46.63 },  // Sao Paulo
        { lat: 28.61, lng: 77.21 },    // New Delhi
        { lat: 31.23, lng: 121.47 },   // Shanghai
        { lat: 38.91, lng: -77.04 },   // Washington DC
        { lat: 30.27, lng: -97.74 },   // Austin
    ];

    const arcs = [];
    const numArcs = 25;

    for (let i = 0; i < numArcs; i++) {
        const from = cities[Math.floor(Math.random() * cities.length)];
        let to = cities[Math.floor(Math.random() * cities.length)];
        while (to === from) {
            to = cities[Math.floor(Math.random() * cities.length)];
        }

        arcs.push({
            startLat: from.lat,
            startLng: from.lng,
            endLat: to.lat,
            endLng: to.lng,
            type: 'flight-route',
        });
    }

    return arcs;
}
