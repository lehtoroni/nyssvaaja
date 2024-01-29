import { Fragment, h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import AppSettings from './ui/AppSettings';
import Monitor from './ui/Monitor';

window.addEventListener('hashchange', e => setTimeout(() => window.location.reload(), 10));

export interface IStopData {
    code: string;
    gtfsId: string;
    name: string;
    zoneId: string;
    vehicleMode: string;
    lat: number;
    lon: number;
}

export interface IStopRealtimeData {
    gtfsId: string;
    name: string;
    vehicleMode: string | null;
    stoptimesWithoutPatterns: {
        serviceDay: number;
        scheduledArrival: number;
        scheduledDeparture: number;
        realtimeArrival: number;
        realtimeDeparture: number;
        trip?: {
            route?: {
                shortName?: string;
            };
        };
        headsign?: string;
    }[];
}

export interface IMonitorSettings {
    edit: boolean;
    stops: string[];
    interval: number;
}

export function Spinner(props: {}) {
    return <div className='spinner-border text-light' role='status'>
        <span className='visually-hidden'>Ladataan...</span>
    </div>;
}

function getInitialSettings() {
    
    if (window.location.hash) {
        const rawHash = window.location.hash.substring(1);
        try {
            const metaRaw = JSON.parse(decodeURIComponent(rawHash));
            if (metaRaw.stops && metaRaw.interval) {
                return metaRaw;
            }
        } catch (err) {}
    }
    
    return null;
    
}

export default function App(props: {}) {
    
    const [monitorSettings, setMonitorSettings] = useState<IMonitorSettings | null>(getInitialSettings());
    
    return <div>
        {monitorSettings && !monitorSettings.edit
            ? <Monitor settings={monitorSettings}/>
            : <AppSettings key='settings' settings={monitorSettings}/>}
    </div>;
    
}
