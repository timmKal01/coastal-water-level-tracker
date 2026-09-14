const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json';

const PRODUCT_CODES = {
    waterLevel: 'water_level',
    waterTemperature: 'water_temperature',
    airTemperature: 'air_temperature',
    airPressure: 'air_pressure',
};

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 4;
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Neither NOAA call had a timeout or retry, so a hang or a transient NOAA
 * hiccup (the CO-OPS API has no uptime SLA) crashed the whole run instantly
 * with no way to recover. Same defensive pattern already used for crt.sh
 * (certificate-transparency-monitor) and CPSC (consumer-product-recall-tracker)
 * elsewhere in this portfolio: an AbortController-based per-attempt timeout so
 * a hung connection can't block forever, plus retry-with-backoff on both
 * thrown network errors and transient status codes.
 */
async function fetchWithRetry(url) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(url, { headers: { Connection: 'close' }, signal: controller.signal });
            if (res.ok) return res;
            if (!TRANSIENT_STATUSES.has(res.status)) {
                throw new Error(`NOAA request failed: ${res.status} ${res.statusText}`);
            }
            lastError = new Error(`NOAA request failed: ${res.status} ${res.statusText}`);
        } catch (err) {
            lastError = err.name === 'AbortError'
                ? new Error(`NOAA request timed out after ${REQUEST_TIMEOUT_MS}ms`)
                : err;
        } finally {
            clearTimeout(timeoutId);
        }
        if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
    }
    throw lastError;
}

async function fetchStationsForState(state) {
    const res = await fetchWithRetry(`${STATIONS_URL}?type=waterlevels`);
    const body = await res.json();
    if (!Array.isArray(body.stations)) {
        throw new Error('NOAA station list response missing "stations" array');
    }
    return body.stations.filter((s) => s.state === state.toUpperCase());
}

async function fetchReading(stationId, productCode) {
    const url = new URL(DATA_URL);
    url.searchParams.set('product', productCode);
    url.searchParams.set('application', 'coastal-water-level-tracker');
    url.searchParams.set('station', stationId);
    url.searchParams.set('date', 'latest');
    url.searchParams.set('units', 'english');
    url.searchParams.set('time_zone', 'lst_ldt');
    url.searchParams.set('format', 'json');
    if (productCode === 'water_level') url.searchParams.set('datum', 'MLLW');

    let res;
    try {
        res = await fetchWithRetry(url);
    } catch {
        // Preserve the original "no reading available for this station" behavior:
        // skip it and keep going rather than failing the whole run over one station.
        return null;
    }
    const body = await res.json();
    const point = body.data?.[0];
    if (!point) return null;

    return {
        stationId: body.metadata.id,
        stationName: body.metadata.name,
        latitude: Number(body.metadata.lat),
        longitude: Number(body.metadata.lon),
        product: productCode,
        value: Number(point.v),
        time: point.t,
    };
}

export async function fetchReadings({ state, stationId, product, maxResults }) {
    const productCode = PRODUCT_CODES[product] ?? PRODUCT_CODES.waterLevel;

    if (stationId) {
        const reading = await fetchReading(stationId, productCode);
        return reading ? [reading] : [];
    }

    const stations = await fetchStationsForState(state);
    const readings = [];
    for (const station of stations) {
        if (readings.length >= maxResults) break;
        const reading = await fetchReading(station.id, productCode);
        if (reading) readings.push(reading);
    }
    return readings;
}
