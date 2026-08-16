const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json';

const PRODUCT_CODES = {
    waterLevel: 'water_level',
    waterTemperature: 'water_temperature',
    airTemperature: 'air_temperature',
    airPressure: 'air_pressure',
};

async function fetchStationsForState(state) {
    const res = await fetch(`${STATIONS_URL}?type=waterlevels`, { headers: { Connection: 'close' } });
    if (!res.ok) throw new Error(`NOAA station list request failed: ${res.status} ${res.statusText}`);
    const body = await res.json();
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

    const res = await fetch(url, { headers: { Connection: 'close' } });
    if (!res.ok) return null;
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
