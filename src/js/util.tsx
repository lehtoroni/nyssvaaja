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
    
    const timeHours = parseInt(timeRef.substring(0, 2));
    const timeMinutes = parseInt(timeRef.substring(2, 4));
    const timeRefSeconds = timeHours*60*60 + timeMinutes*60;
    
    const rawData = await nysseQuery(`{
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
            }
        }
    }`);
    
    const tripData: IFuzzyTripDetails | null = rawData.data?.fuzzyTrip ?? null;
      
    return tripData;
    
}

/**
 * Send a query to the Digitransit API. Uses the backend to provide the API key.
 * @param query - the graphql query
 * @param vars - variables, optional
 * @returns - the raw JSON response
 */
export async function nysseQuery(query: string, vars?: any) {
    
    const x = await fetch(`/api/digitransit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query,
            variables: vars ?? {}
        })
    });
    
    return await x.json();
    
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
    
    const data = await nysseQuery(`{
        stops(feeds: "${FEED_ID}") {
            gtfsId,
            name,
            code,
            zoneId,
            vehicleMode,
            lat,
            lon
        }
    }`);
    
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
    return await nysseQuery(`{
        ${stopIds.map((id, i) => `${id.replace(':', '_')}: stop(id: "${id}") {
            gtfsId,
            name,
            vehicleMode,
            stoptimesWithoutPatterns(numberOfDepartures: 5) {
                serviceDay
                scheduledArrival
                scheduledDeparture
                realtimeArrival
                realtimeDeparture
                trip {
                    route {
                        shortName
                    }
                }
                headsign
            }
        }`).join('\n')}
    }`);
}

/**
 * Fetch data for a stop
 * @param stopId the stop id
 * @returns the data
 */
export async function getStopData(stopId: string){
    return await nysseQuery(`{
        stop(id: "${stopId}") {
            gtfsId,
            name,
            stoptimesWithoutPatterns(numberOfDepartures: 5) {
                stop {
                    platformCode
                }
                serviceDay
                scheduledArrival
                scheduledDeparture
                realtimeArrival
                realtimeDeparture
                trip {
                    route {
                        shortName
                    }
                }
                headsign
            }
        }
    }`);
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
