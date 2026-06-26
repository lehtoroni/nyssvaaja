import fs from 'fs';
import path from 'path';
import URL from 'url';

import argsParser from 'args-parser';
import fetch from 'node-fetch';

import express from 'express';
import asyncHandler from 'express-async-handler';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const __dirname = path.dirname(URL.fileURLToPath(import.meta.url));
const args = argsParser(process.argv);

const apiKeyFile = path.join(__dirname, '..', 'apikey.txt');
const walttiKeyFile = path.join(__dirname, '..', 'waltti.txt');

const port = args.port ?? 9999;
const apiKey = args.apiKey ?? (fs.existsSync(apiKeyFile) ? fs.readFileSync(apiKeyFile, 'utf8').trim() : null);
const walttiKeyRaw = args.walttiKey ?? (fs.existsSync(walttiKeyFile) ? fs.readFileSync(walttiKeyFile, 'utf8').trim() : null);
const walttiKey = Buffer.from(walttiKeyRaw, 'utf8').toString('base64');

const walttiCity = [
    'lahti',
    'joensuu',
    'jyvaskyla',
    'oulu'
];

//const baseUrl = `https://api.digitransit.fi/routing/v1/routers/waltti/index/graphql`;

const endpoints = new Map(Object.entries({
    'HSL': `https://api.digitransit.fi/routing/v2/hsl/gtfs/v1`,
    'waltti': `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`,
    'finland': `https://api.digitransit.fi/routing/v2/finland/gtfs/v1`,
    'varely': `https://api.digitransit.fi/routing/v2/varely/gtfs/v1`
}));

const baseUrl = `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`;

const realtimeDelay = (args.realtimeDelay ?? 3) * 2000;
const realtimeMulti = new Map();

let cachedRealtimeData = {};
updateRealtime();

let feedsAndAgencies = new Map();
updateDaily().catch(err => console.error(err));

const queryCache = new NodeCache({
    stdTTL: 60,
    useClones: false,
    maxKeys: 1000
});

function convertDurationToMilliseconds(durationString) {
    
    const match = durationString.match(/(-)?P(\d+Y)?(\d+M)?(\d+D)?T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?/);

    if (!match) {
        throw new Error("Invalid duration format");
    }

    const isNegative = !!match[1];

    const years = parseInt(match[2]) || 0;
    const months = parseInt(match[3]) || 0;
    const days = parseInt(match[4]) || 0;
    const hours = parseInt(match[5]) || 0;
    const minutes = parseInt(match[6]) || 0;
    const seconds = parseFloat(match[7]) || 0;

    const milliseconds = (
        (years * 365 * 24 * 60 * 60 * 1000) +
        (months * 30 * 24 * 60 * 60 * 1000) +
        (days * 24 * 60 * 60 * 1000) +
        (hours * 60 * 60 * 1000) +
        (minutes * 60 * 1000) +
        (seconds * 1000)
    );

    return isNegative ? -milliseconds : milliseconds;
    
}

async function updateDaily() {
    
    try {
        
        console.log(`Fetching endpoints and their feeds...`);
        const timeStart = Date.now();
        
        feedsAndAgencies.clear();
        
        for (const [key, endpointUrl] of Object.entries(Object.fromEntries(endpoints.entries()))) {
            
            console.log(`${key}: ${endpointUrl}`);
            const omap = new Map();
            
            const feedsData = await nysseQuery(`{
                feeds {
                    feedId,
                    agencies {
                        name,
                        gtfsId,
                        url
                    }
                }
            }`, endpointUrl);
            
            for (const fd of (feedsData?.data?.feeds ?? [])) {
                if (omap.has(fd.feedId)) {
                    omap.set(`${key}§${fd.feedId}`);
                    console.log(`Duplicate feed: ${fd.feedId}`);
                } else {
                    omap.set(fd.feedId, fd);
                }
            }
            
            feedsAndAgencies.set(key, omap);
            
        }
        console.log(`Loaded, took ${Date.now() - timeStart} ms`);
        
    } catch (err) {
        console.error(`Error while fetching hourly data: ${err}`);
        console.error(err);
    }
    
    setTimeout(() => {
        updateDaily().catch(err => console.error(err));
    }, 1000*60*60);
    
}

function isValidFeed(feedId) {
    const feedEndpoint = getFeeds(feedId)[feedId];
    return feedEndpoint && endpoints.get(feedEndpoint);
}

function getFeeds() {
    const feedsOut = {};
    feedsAndAgencies.forEach((feeds, key) => {
        feeds.forEach((feedData, feedId) => {
            feedsOut[feedId] = key;
        })
    })
    return Object.fromEntries(
        Object.entries(feedsOut).toSorted(([a], [b]) => a.localeCompare(b))
    );
}

async function updateRealtime() {
    
    
    try {
        
        const cityOut = [];
        
        const x = await fetch(`https://realtime.hsl.fi/realtime/vehicle-positions/v2/hsl`, {
            headers: { 'User-Agent': `Nyssvaaja` }
        });
        const raw = await x.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(raw));
        
        feed.entity.forEach(entity => {
            cityOut.push({
                headsign: entity.vehicle.trip.routeId,
                direction: entity.vehicle.trip.directionId,
                origin: '',
                destination: entity.vehicle.vehicle.label,
                location: [
                    entity.vehicle.position.latitude,
                    entity.vehicle.position.longitude
                ],
                bearing: entity.vehicle.position.bearing,
                delay: 0,
                vehicleRef: entity.vehicle.vehicle.id,
                tripDate: `${entity.vehicle.trip.startDate}`.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
                tripTime: `${parseInt(`${entity.vehicle.trip.startTime}`.replace(/:/gmi, ''))}`,
                
                walttiRouteId: entity.vehicle.trip.routeId,
                licensePlate: entity.vehicle.vehicle.licensePlate,
                //raw: JSON.parse(JSON.stringify(entity))
            });
        });
        
        realtimeMulti.set('helsinki', cityOut);
        
    } catch (err) {
        console.error(err);
    }
    
    try {
        
        for (const city of walttiCity) {
            
            const cityOut = [];
            
            const raw = await walttiQuery(`https://data.waltti.fi/${encodeURIComponent(city)}/api/gtfsrealtime/v1.0/feed/vehicleposition`);
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(raw));
            
            feed.entity.forEach(entity => {
                cityOut.push({
                    headsign: entity.vehicle.trip.routeId,
                    direction: entity.vehicle.trip.directionId,
                    origin: '',
                    destination: entity.vehicle.vehicle.label,
                    location: [
                        entity.vehicle.position.latitude,
                        entity.vehicle.position.longitude
                    ],
                    bearing: entity.vehicle.position.bearing,
                    delay: 0,
                    vehicleRef: entity.vehicle.vehicle.id,
                    tripDate: `${entity.vehicle.trip.startDate}`.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
                    tripTime: `${parseInt(`${entity.vehicle.trip.startTime}`.replace(/:/gmi, ''))}`,
                    
                    walttiRouteId: entity.vehicle.trip.routeId,
                    licensePlate: entity.vehicle.vehicle.licensePlate,
                    //raw: JSON.parse(JSON.stringify(entity))
                });
            });
            
            realtimeMulti.set(city, cityOut);
            
        }
        
    } catch (err) {
        console.error(err);
    }
    
    try {
        
        const x = await fetch('http://data.itsfactory.fi/siriaccess/vm/json');
        const realtime = await x.json();
        
        if (!(realtime?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery ?? null)) {
            throw new Error('Data format changed, or error?');
        }
        
        const vehicles = realtime?.Siri?.ServiceDelivery?.VehicleMonitoringDelivery[0].VehicleActivity;
        cachedRealtimeData = vehicles.map(v => ({
            headsign: v.MonitoredVehicleJourney.LineRef.value,
            direction: v.MonitoredVehicleJourney.DirectionRef.value,
            origin: v.MonitoredVehicleJourney.OriginName.value,
            destination: v.MonitoredVehicleJourney.DestinationName.value,
            location: [
                v.MonitoredVehicleJourney.VehicleLocation.Latitude,
                v.MonitoredVehicleJourney.VehicleLocation.Longitude
            ],
            bearing: v.MonitoredVehicleJourney.Bearing,
            delay: convertDurationToMilliseconds(v.MonitoredVehicleJourney.Delay),
            vehicleRef: v.MonitoredVehicleJourney.VehicleRef.value,
            tripDate: v.MonitoredVehicleJourney.FramedVehicleJourneyRef.DataFrameRef.value,
            tripTime: v.MonitoredVehicleJourney.FramedVehicleJourneyRef.DatedVehicleJourneyRef
        }))
        
    } catch (err) {
        console.error(`Error while fetching realtime data:`);
        console.error(err);
    }
    
    setTimeout(updateRealtime, realtimeDelay);
    
}

if (!apiKey || apiKey == '') {
    throw new Error(`Please provide an API key using --apiKey=... or using apikey.txt in the root folder`);
}

if (!walttiKeyRaw || walttiKeyRaw == '') {
    throw new Error(`Please provide a Waltti id:secret pair using --walttiKey=clientid:secret or using waltti.txt in the root folder`);
}

console.log(`Nyssvääjä² (c) 2026`);

const app = express();

app.set('trust proxy', 1);

app.use(bodyParser.json({ type: 'application/json' }));
app.use(bodyParser.text({ type: '*/*' }));

app.use(rateLimit({
    windowMs: 1000*60,
    max: 20*5,
    standardHeaders: true,
    legacyHeaders: false
}));

async function walttiQuery(url) {
    const x = await fetch(url, {
        headers: {
            'Authorization': `Basic ${walttiKey}`,
            'User-Agent': `Nyssvaaja`
        }
    });
    const raw = await x.arrayBuffer();
    return raw;
}

async function nysseQuery(query, endpointUrl) {
    
    if (!endpointUrl) {
        endpointUrl = baseUrl;
    }
    
    const x = await fetch(endpointUrl, {
        headers: {
            'Content-Type': 'application/graphql',
            'Digitransit-Subscription-Key': `${apiKey}`
        },
        method: 'POST',
        body: query
    });
    
    if (!x.ok) {
        throw new Error(`${x.status} ${x.statusText} ${await x.text()}`);
    }
    
    const respRaw = await x.json();
    return respRaw;
    
}

app.get('/api/getFeeds', asyncHandler(async (req, res) => {
    res.json({
        feeds: getFeeds(),
        realtime: [...realtimeMulti.keys(), 'tampere', 'hsl', 'linkki']
    });
}));

app.get('/api/getCanceledTrips/:feed', asyncHandler(async (req, res) => {
    
    if (queryCache.has(req.path)) {
        return res.json(queryCache.get(req.path));
    }
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const data = await nysseQuery(`{
  canceledTrips(first: 100) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        serviceDate
        trip {
          gtfsId
          routeShortName
          tripHeadsign
        }
        start {
          stopLocation {
            ... on Stop {
              name
            }
          }
          schedule {
            time {
              ... on ArrivalDepartureTime {
                departure
              }
            }
          }
        }
      }
    }
  }
}`, feedEndpoint);
    
    queryCache.set(req.path, data, 15);
    
    return res.json(data);
    
}));

app.get('/api/getAllRoutes/:feed', asyncHandler(async (req, res) => {
    
    if (queryCache.has(req.path)) {
        return res.json(queryCache.get(req.path));
    }
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const data = await nysseQuery(`{
        routes(feeds: [${JSON.stringify(feed)}]) {
            gtfsId,
            shortName,
            mode,
            longName
        }
    }`, feedEndpoint);
    
    queryCache.set(req.path, data, 60*60);
    
    return res.json(data);
    
}));

app.post('/api/getStopsData/:feed', (req, res) => {
    
    if (!req.body
        || !(typeof req.body == 'object')
        || !req.body.stopIds
        || !Array.isArray(req.body.stopIds)) {
        res.json({
            error: `invalid body`
        }).status(400);
        return;
    }
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const stopIds = [...req.body.stopIds].map(en => `${en}`.replace(/[^A-Za-z0-9:_\-\., ]/, ''));
    
    let maxRows = req.query.maxRows
        ? Number(`${req.query.maxRows}`)
        : 15;
    
    if (isNaN(maxRows)) {
        maxRows = 15;
    }
    maxRows = Math.floor(Math.max(1, Math.min(15, maxRows)));
    
    if (stopIds.length == 0) {
        res.json([]);
        return;
    }
    
    nysseQuery(`{
        ${stopIds.map((id, i) => `${id.replace(':', '_')}: stop(id: "${id}") {
            ...stopFields
        }`).join('\n')}
    }

    fragment stopFields on Stop {
        gtfsId,
        name,
        vehicleMode,
        alerts {
            ...alertFields
        }
        routes {
            gtfsId,
            shortName,
            alerts {
                ...alertFields
            }
        }
        stoptimesWithoutPatterns(numberOfDepartures: ${maxRows}) {
            serviceDay
            scheduledArrival
            scheduledDeparture
            realtimeArrival
            realtimeDeparture
            trip {
                alerts {
                    ...alertFields
                }
                route {
                    gtfsId,
                    shortName
                }
            }
            headsign
        }
    }

    fragment alertFields on Alert {
        id,
        effectiveStartDate,
        effectiveEndDate,
        alertDescriptionText,
        alertHeaderText,
        alertSeverityLevel
    }`, feedEndpoint)
        .then(stopsData => {
            res.json(stopsData);
        })
        .catch(err => {
            console.error(err);
            res.json({ error: `${err}` });
        })
})

app.post('/api/getRouteDetails/:feed', (req, res) => {
    
    if (!req.body
        || !(typeof req.body == 'object')) {
        res.json({
            error: `invalid body`
        }).status(400);
        return;
    }
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const routeHeadsign = `${req.body.routeHeadsign || ''}`;
    const direction = req.body.direction ?? 0;
    const dateRef = `${req.body.dateRef || ''}`;
    const timeRef = `${req.body.timeRef || ''}`;
    
    if (!routeHeadsign || direction === null || direction === undefined || !dateRef || !timeRef) {
        res.json({
            error: `invalid body`
        }).status(400);
        return;
    }
    
    const timeHours = parseInt(timeRef.substring(0, 2));
    const timeMinutes = parseInt(timeRef.substring(2, 4));
    const timeRefSeconds = timeHours*60*60 + timeMinutes*60;
    
    nysseQuery(`{
        fuzzyTrip(route: "${routeHeadsign}", direction: ${direction}, date: ${JSON.stringify(dateRef)}, time: ${timeRefSeconds}) {
            tripShortName,
            routeShortName,
            gtfsId,
            tripHeadsign,
            geometry,
            stops {
                gtfsId,
                name
            },
            stoptimesForDate(serviceDate: ${JSON.stringify(dateRef.replace(/\-/gmi, ''))}) {
              stop {
                  gtfsId,
                  name,
                  zoneId
              },
              serviceDay,
              realtimeDeparture,
              scheduledDeparture,
              realtime,
              timepoint,
              pickupType
            }
        }
    }`, feedEndpoint)
        .then(rawData => {
            const tripData = rawData.data?.fuzzyTrip ?? null;
            res.json(tripData);
        })
        .catch(err => {
            console.error(err);
            res.json({ error: `${err}` });
        })
})


let cachedAllStops = null;
let timeCachedAllStops = 0;

app.get('/api/getAllStops/:feed', asyncHandler(async (req, res) => {
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const rawData = queryCache.has(req.path)
        ? queryCache.get(req.path)
        : await (async () => {
            const x = await nysseQuery(`{
                stops {
                    gtfsId,
                    name,
                    code,
                    zoneId,
                    vehicleMode,
                    lat,
                    lon
                }
            }`, feedEndpoint);
            queryCache.set(req.path, x, 60*15);
            return x;
        })();
    
    if (rawData && rawData.data && rawData.data.stops) {
        rawData.data.stops = rawData.data.stops.filter(stop => (stop.gtfsId ?? '').startsWith(feed + ':'))
    }
    
    return res.json(rawData);
    
}));

app.get('/api/getAlerts/:feed', asyncHandler(async (req, res) => {
    
    const feed = req.params.feed || 'tampere';
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if (!isValidFeed(feed) || !feedEndpoint) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    const rawData = queryCache.has(req.path)
        ? queryCache.get(req.path)
        : await (async () => {
            const x = await nysseQuery(`{
                alerts(feeds: [${JSON.stringify(feed)}]) {
                    id,
                    effectiveStartDate,
                    effectiveEndDate,
                    alertDescriptionText,
                    alertHeaderText,
                    alertSeverityLevel,
                    entities {
                        __typename,
                        ... on Stop {
                        gtfsId,
                        name,
                        code
                        },
                        ... on Route {
                        gtfsId,
                        shortName,
                        longName
                        },
                        ... on StopOnRoute {
                        route { gtfsId },
                        stop { gtfsId }
                        },
                        ... on StopOnTrip {
                        trip { gtfsId },
                        stop { gtfsId }
                        },
                        ... on Agency {
                        gtfsId
                        },
                        ... on Pattern {
                        headsign
                        },
                        ... on RouteType {
                        routeType
                        },
                        ... on Trip {
                        gtfsId,
                        tripShortName,
                        routeShortName
                        }
                    }
                }
            }`, feedEndpoint);
            queryCache.set(req.path, x, 60);
            return x;
        })();
    
    if (rawData && rawData.data && rawData.data.stops) {
        rawData.data.stops = rawData.data.stops.filter(stop => (stop.gtfsId ?? '').startsWith(feed))
    }
    
    return res.json(rawData);
    
}));

app.get('/api/realtime/:feed', asyncHandler(async (req, res) => {
    
    let feed = req.params.feed || 'tampere';
    if (feed == 'FOLI') feed = 'turku';
    if (feed == 'LINKKI') feed = 'jyvaskyla';
    if (feed == 'HSL') feed = 'helsinki';
    
    const feedEndpoint = endpoints.get(getFeeds()[feed]);
    if ((!isValidFeed(feed) || !feedEndpoint) && !(walttiCity.includes(feed.toLowerCase())) && !(realtimeMulti.has(feed.toLowerCase()))) {
        res.status(400).json({ error: `Illegal feed '${feed}'` });
        return;
    }
    
    if (feed == 'tampere') {
        res.json(cachedRealtimeData);
    } else if (realtimeMulti.has(feed.toLowerCase())) {
        res.json(realtimeMulti.get(feed.toLowerCase()));
    } else {
        res.json([]);
    }
    
    
}));

// serve built frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.listen(port, () => {
    console.log(`Listening on :${port}`);
});
