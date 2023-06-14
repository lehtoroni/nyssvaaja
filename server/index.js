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

if (!apiKey || apiKey == '') {
    throw new Error(`Please provide an API key using --apiKey=... or using apikey.txt in the root folder`);
}

console.log(`Nyssvääjä² (c) 2023`);

const app = express();

app.use(bodyParser.text({ type: '*/*' }));
app.use(rateLimit({
    windowMs: 1000*60*5,
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

// serve built frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

app.listen(port, () => {
    console.log(`Listening on :${port}`);
});
