export const GTFS_ENDPOINTS = {
    'HSL': `https://api.digitransit.fi/routing/v2/hsl/gtfs/v1`,
    'waltti': `https://api.digitransit.fi/routing/v2/waltti/gtfs/v1`,
    'finland': `https://api.digitransit.fi/routing/v2/finland/gtfs/v1`,
    'varely': `https://api.digitransit.fi/routing/v2/varely/gtfs/v1`
};

export const REALTIME_FEEDS_WALTTI = `tampere 
LINKKI 
Lappeenranta 
Joensuu 
Kuopio 
FOLI 
OULU 
Hameenlinna 
Lahti 
Vaasa 
Mikkeli 
Pori 
Kouvola 
Kotka 
Rovaniemi 
Salo 
Kajaani 
VARELY 
Rauma 
digitraffic 
Harma 
Korsisaari 
IngvesSvanback`.split('\n').map(r => r.trim());

