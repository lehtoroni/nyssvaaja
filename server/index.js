import fs from 'fs';
import path from 'path';
import URL from 'url';

import argsParser from 'args-parser';
import fetch from 'node-fetch';

import express from 'express';
import asyncHandler from 'express-async-handler';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(URL.fileURLToPath(import.meta.url));
const args = argsParser(process.argv);

const apiKeyFile = path.join(__dirname, '..', 'apikey.txt');

const port = args.port ?? 9999;
const apiKey = args.apiKey ?? (fs.existsSync(apiKeyFile) ? fs.readFileSync(apiKeyFile, 'utf8').trim() : null);
const baseUrl = `https://api.digitransit.fi/routing/v1/routers/waltti/index/graphql`;

const realtimeDelay = (args.realtimeDelay ?? 3) * 1000;
let cachedRealtimeData = {};
updateRealtime();

function convertDurationToMilliseconds(durationString) {
    const match = durationString.match(/P(\d+Y)?(\d+M)?(\d+D)?T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?/);

    if (!match) {
        throw new Error("Invalid duration format");
    }

    const years = parseInt(match[1]) || 0;
    const months = parseInt(match[2]) || 0;
    const days = parseInt(match[3]) || 0;
    const hours = parseInt(match[4]) || 0;
    const minutes = parseInt(match[5]) || 0;
    const seconds = parseFloat(match[6]) || 0;

    const milliseconds = (
        (years * 365 * 24 * 60 * 60 * 1000) +
        (months * 30 * 24 * 60 * 60 * 1000) +
        (days * 24 * 60 * 60 * 1000) +
        (hours * 60 * 60 * 1000) +
        (minutes * 60 * 1000) +
        (seconds * 1000)
    );

    return milliseconds;
}

async function updateRealtime() {
    
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

console.log(`Nyssvääjä² (c) 2023`);

const app = express();

app.set('trust proxy', 1);

app.use(bodyParser.text({ type: '*/*' }));
app.use(rateLimit({
    windowMs: 1000*60,
    max: 20*5,
    standardHeaders: true,
    legacyHeaders: false
}));

app.post('/api/digitransit', asyncHandler(async (req, res) => {
    
    const x = await fetch(baseUrl, {
        headers: {
            'Content-Type': 'application/json',
            'Digitransit-Subscription-Key': `${apiKey}`
        },
        method: 'POST',
        body: req.body
    });
    
    if (!x.ok) {
        res.json({
            error: `${x.status} ${x.statusText} ${await x.text()}`
        });
        return;
    }
    
    const respRaw = await x.json();
    res.json(respRaw);
    
}));

app.get('/api/realtime', asyncHandler(async (req, res) => {
    res.json(cachedRealtimeData);
}));

// serve built frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.listen(port, () => {
    console.log(`Listening on :${port}`);
});
