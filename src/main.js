import { Actor, log } from 'apify';
import { fetchReadings } from './coops.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { state, stationId, product = 'waterLevel', maxResults = 25 } = input;

if (!state && !stationId) {
    throw new Error('Either "state" or "stationId" is required.');
}

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const STATION_SEARCH_EVENT = 'station-search';

const readings = await fetchReadings({
    state,
    stationId,
    product,
    maxResults: Math.min(maxResults, 100),
});

for (const reading of readings) {
    await Actor.pushData(reading);
}

await Actor.charge({ eventName: STATION_SEARCH_EVENT });

log.info(`Pushed ${readings.length} reading(s)`);

await Actor.exit();
