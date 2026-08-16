# Coastal Water Level Tracker — NOAA Tide Station Data

Get real-time readings from NOAA's coastal and Great Lakes tide
stations — water level, water temperature, air temperature, or air
pressure — by state or specific station ID.

Built for port operations, marine/boating use, and coastal engineering
teams who need current tidal conditions, not a forecast. This is the
coastal counterpart to [River Water Level
Tracker](https://github.com/timmKal01/river-water-level-tracker), which
covers inland streams and rivers via USGS instead — different agency,
different phenomenon (tidal vs. riverine), different audience.

## Input

```json
{
  "state": "NY",
  "stationId": "",
  "product": "waterLevel",
  "maxResults": 25
}
```

| Field | Type | Description |
|---|---|---|
| `state` | string | Two-letter US state code to survey all tide stations in. Ignored if `stationId` is set. |
| `stationId` | string (optional) | A specific NOAA CO-OPS station ID to check instead of a whole state, e.g. `"8518750"` (The Battery, NY). |
| `product` | string | `"waterLevel"`, `"waterTemperature"`, `"airTemperature"`, or `"airPressure"`. Default `"waterLevel"`. |
| `maxResults` | number | Max stations to return when surveying a state. Default `25`, max `100`. |

Either `state` or `stationId` is required.

## Output

One record per station:

```json
{
  "stationId": "8518750",
  "stationName": "The Battery",
  "latitude": 40.7006,
  "longitude": -74.0142,
  "product": "water_level",
  "value": 5.102,
  "time": "2026-08-15 21:48"
}
```

Water level is in feet relative to the station's Mean Lower Low Water
(MLLW) datum, the standard NOAA tidal reference. Stations with no
current reading for the selected type are silently skipped.

A search with no matching stations returns no items but is still billed
once for the search.

## How it works

Direct calls to the official [NOAA CO-OPS Tides & Currents
API](https://api.tidesandcurrents.noaa.gov/api/prod/) — no proxy, no
key, no scraping. Public U.S. government data, updated every 6 minutes
per station.

## Pricing note

Billed per **search**, not per station returned — one charge whether
the search returns 0 stations or 100.

## Related products

- [River Water Level Tracker](https://github.com/timmKal01/river-water-level-tracker) — the inland/USGS equivalent for streams and rivers
