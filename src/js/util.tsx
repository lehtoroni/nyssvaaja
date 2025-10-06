import { LatLngTuple } from 'leaflet';
import { h } from 'preact';

const STORAGE_VERSION = `3`;
export const FEED_ID = `tampere`;
export const KEY_ALL_STOPS = `__nysse_all_stops_${STORAGE_VERSION}`;

export interface IRoutePattern {
    directionId: number,
    id: string,
    name: string,
    geometry: { lat: number, lon: number }[]
}

export interface IFuzzyTripDepartureStopTime {
    stop: {
        gtfsId: string,
        name: string,
        zoneId: string
    },
    serviceDay: number,
    realtimeDeparture: number,
    scheduledDeparture: number,
}

export interface IFuzzyTripDetails {
    tripShortName: string,
    routeShortName: string,
    gtfsId: string,
    tripHeadsign: string,
    geometry: LatLngTuple[],
    stops: {
        gtfsId: string,
        name: string
    }[],
    stoptimesForDate: IFuzzyTripDepartureStopTime[]
}

/**
 * Adds a + to positive integers, with .toFixed() support
 * @param n - the number
 * @param precision - the amount of decimals, 0 to ...
 * @returns the string representation
 */
export function plusOrMinus(n: number, precision: number = 1) {
    return n <= 0
        ? `${n.toFixed(precision)}`
        : `+${n.toFixed(precision)}`;
}


/**
 * Execute a fuzzy search on a trip, useful when trying to find detials
 * for piece of realtime info
 * @param routeHeadsign - the headsign/gtfsId of the route (e.g. "tampere:70")
 * @param direction - the direction of the trip, either 0 or 1 
 * @param dateRef - the service date, as YYYY-MM-DDDD
 * @param timeRef - the service time, as "HHMM" (the weird format from SIRI)
 * @returns the fetched trip data
 */
export async function findRouteDetails(routeHeadsign: string, direction: number, dateRef: string, timeRef: string) {
    
    if (!routeHeadsign.startsWith(`${FEED_ID}:`)) {
        routeHeadsign = `${FEED_ID}:${routeHeadsign}`;
    }
    
    const x = await fetch(`/api/getRouteDetails`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            routeHeadsign,
            direction,
            dateRef,
            timeRef
        })
    });
    
    if (!x.ok || x.status != 200) {
        throw new Error(`Fetch error: ${x.status} ${x.statusText}`);
    }
    
    let res = await x.json();
    console.log(res);
    return res;
    
}

/**
 * Fetch a list of all Nysse stops from the API
 * @returns a list of all stops
 */
export async function getAllStops() {
    
    if (window.localStorage) {
        const cached = window.localStorage.getItem(KEY_ALL_STOPS);
        if (cached) {
            const cachedData = JSON.parse(cached);
            if (Date.now() - cachedData.timestamp <= 1000*60*60*24) {
                return cachedData.data;
            }
        };
    }
    
    const x = await fetch(`/api/getAllStops`, {
        method: 'GET',
    });
    const data = await x.json();
    
    if (data.error) {
        console.error(data.error);
        throw new Error(`error: ${data.error}`);
    }
    
    if (window.localStorage) {
        window.localStorage.setItem(KEY_ALL_STOPS, JSON.stringify({
            timestamp: Date.now(),
            data
        }))
    }
    
    return data;
    
}

/**
 * Fetch data for multiple stops
 * @param stopIds the stop ids
 * @returns the data
 */
export async function getStopsData(stopIds: string[]) {
    
    const x = await fetch(`/api/getStopsData`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopIds })
    });
    
    return await x.json();
    
}


export type IGenericRoute = {
    gtfsId: string,
    shortName: string,
    mode: string,
    longName: string
};

export async function getAllRoutes(feed: string = 'tampere') {
    
    const x = await fetch('/api/getAllRoutes');
    const routes: IGenericRoute[] = (await x.json())?.data.routes ?? [];
    
    return routes.toSorted((a, b) => 
        (parseInt(`${a.shortName}`.replace(/[^0-9]/gmi, '')) - parseInt(`${b.shortName}`.replace(/[^0-9]/gmi, '')))
        || a.shortName.localeCompare(b.shortName)
    );
    
}

/**
 * Fetch data for a stop
 * @param stopId the stop id
 * @returns the data
 */
export async function getStopData(stopId: string){
    return Object.values((await getStopsData([ stopId ])).data)[0];
}

/**
 * Zero pad a time number
 * @param n the number
 * @returns the padded string
 */
export function zeroPad(n: number) {
    return `${n < 10 ? '0'+n : n}`;
} 

/**
 * Format a time, taking scheduled and realtime data into account
 * @param stopTime the stopTime data
 * @returns the formatted string
 */
export function getTimeString(stopTime: {
    realtimeDeparture: number,
    scheduledDeparture: number,
    serviceDay: number
}) {
    const isOffSchedule = stopTime.realtimeDeparture != stopTime.scheduledDeparture;
    const d = new Date((stopTime.serviceDay + stopTime.realtimeDeparture)*1000);
    return <span>
        {isOffSchedule ? '* ' : ''}{' '}
        {[...`${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}`]
            .map(c => <span className='x-time-char'>{c}</span>)}
    </span>
}

/**
 * Format a time into "minutes left"
 * @param stopTime the stopTime data
 * @returns the string
 */
export function getDueMinutes(stopTime: {
    realtimeDeparture: number,
    scheduledDeparture: number,
    serviceDay: number
}) {
    const d = new Date((stopTime.serviceDay + stopTime.realtimeDeparture)*1000);
    const mins = Math.floor((d.getTime() - Date.now())/1000/60);
    return mins <= 60 ? mins : '';
}

/**
 * Encode HTML special chars
 */
export function encodeHTML(s: string) {
    return s.replace(/</gmi, '&lt;')
        .replace(/>/gmi, '&gt;')
        .replace(/"/gmi, '&quot;')
        .replace(/&/gmi, '&amp;');
}

export function RemixIcon(props: { icon: string }) {
    return <i class={`ri ${props.icon}`}></i>;
}