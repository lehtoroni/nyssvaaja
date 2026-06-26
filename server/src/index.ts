import fs from 'fs';
import path from 'path';

// @ts-ignore
import argsParser from 'args-parser';

import express from 'express';
import asyncHandler from 'express-async-handler';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';

import { IFeedInfo, IRealtimeVehicle } from './common/types';
import { initRealtime } from './module/realtime';
import { GTFS_ENDPOINTS, REALTIME_FEEDS_WALTTI } from './module/magic';

const args = argsParser(process.argv);

const apiKeyFile = path.join(process.cwd(), 'apikey.txt');
const walttiKeyFile = path.join(process.cwd(), 'waltti.txt');

const isBundled = !!((process as any).pkg);
const VERSION = isBundled
    ? (JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version || 'unknown')
    : 'dev';

const port = args.port ?? 9999;
const apiKey = args.apiKey ?? (fs.existsSync(apiKeyFile) ? fs.readFileSync(apiKeyFile, 'utf8').trim() : null);
const walttiKeyRaw = args.walttiKey ?? (fs.existsSync(walttiKeyFile) ? fs.readFileSync(walttiKeyFile, 'utf8').trim() : null);
const walttiKey = Buffer.from(walttiKeyRaw, 'utf8').toString('base64');

const endpoints = new Map<string, string>(Object.entries(GTFS_ENDPOINTS));

let feedsAndAgencies = new Map<string, Map<string, IFeedInfo>>();
updateDaily().catch(err => console.error(err));

const queryCache = new NodeCache({
    stdTTL: 60,
    useClones: false,
    maxKeys: 1000
});

const realtime = initRealtime({ VERSION, apiKey, walttiKey });

async function updateDaily() {
    
    try {
        
        console.log(`Fetching endpoints and their feeds...`);
        const timeStart = Date.now();
        
        feedsAndAgencies.clear();
        
        for (const [key, endpointUrl] of Object.entries(Object.fromEntries(endpoints.entries()))) {
            
            console.log(`${key}: ${endpointUrl}`);
            const omap = new Map<string, IFeedInfo>();
            
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
                    omap.set(`${key}§${fd.feedId}`, fd);
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

function isValidFeed(feedId: string) {
    const feedEndpoint = getFeeds()[feedId];
    return feedEndpoint && endpoints.get(feedEndpoint);
}

function getFeeds() {
    const feedsOut: Record<string, string> = {};
    feedsAndAgencies.forEach((feeds, key) => {
        feeds.forEach((feedData, feedId) => {
            feedsOut[feedId] = key;
        })
    })
    return Object.fromEntries(
        Object.entries(feedsOut).toSorted(([a], [b]) => a.localeCompare(b))
    );
}

if (!apiKey || apiKey == '') {
    throw new Error(`Please provide an API key using --apiKey=... or using apikey.txt in the root folder`);
}

if (!walttiKeyRaw || walttiKeyRaw == '') {
    throw new Error(`Please provide a Waltti id:secret pair using --walttiKey=clientid:secret or using waltti.txt in the root folder`);
}

console.log(`Nyssvääjä² v${VERSION} (c) Roni Lehto 2026`);

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

async function nysseQuery(query: string, endpointUrl?: string) {
    
    if (!endpointUrl) {
        endpointUrl = endpoints.get('waltti') || '';
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
        realtime: [...REALTIME_FEEDS_WALTTI, 'hsl']
    });
}));

app.get('/api/getCanceledTrips/:feed', asyncHandler(async (req, res) => {
    
    if (queryCache.has(req.path)) {
        res.json(queryCache.get(req.path));
        return;
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
    
    res.json(data);
    return;
    
}));

app.get('/api/getAllRoutes/:feed', asyncHandler(async (req, res) => {
    
    if (queryCache.has(req.path)) {
        res.json(queryCache.get(req.path));
        return;
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
    
    res.json(data);
    return;
    
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
    
    //console.log(`fuzzyTrip(route: "${routeHeadsign}", direction: ${direction}, date: ${JSON.stringify(dateRef)}, time: ${timeRefSeconds})`);
    
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
        rawData.data.stops = rawData.data.stops.filter((stop: any) => (stop.gtfsId ?? '').startsWith(feed + ':'))
    }
    
    res.json(rawData);
    return;
    
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
        rawData.data.stops = rawData.data.stops.filter((stop: any) => (stop.gtfsId ?? '').startsWith(feed))
    }
    
    res.json(rawData);
    return;
    
}));

app.get('/api/realtime/:feed', asyncHandler(async (req, res) => {
    
    let feed = req.params.feed || 'tampere';
    if (feed.toLowerCase() == 'turku') feed = 'FOLI';
    if (feed.toLowerCase() == 'jyvaskyla') feed = 'LINKKI';
    if (feed.toLowerCase() == 'helsinki') feed = 'HSL';
    
    const data = await realtime.getRealtimeData(feed);
    res.json(data);
    
}));

// serve built frontend
app.use(express.static(
    isBundled
        ? path.join(__dirname, '../front-dist')
        : path.join(__dirname, '..', '..', 'client', 'dist')
));

app.listen(port, () => {
    console.log(`Listening on :${port}`);
});
