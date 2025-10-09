import { Fragment, h } from 'preact';
import 'preact/debug';
import { useEffect, useRef, useState } from 'preact/hooks';
import Monitor from './ui/Monitor';
import NysseMapNew from './ui/newmap/map';
import StopChooser from './ui/chooser/chooser';
import AppInfo from './ui/info/info';
import { RemixIcon } from './util';

export interface IStopData {
    code: string;
    gtfsId: string;
    name: string;
    zoneId: string;
    vehicleMode: string;
    lat: number;
    lon: number;
}

export type IGenericAlertEntity = 
    { __typename: 'Stop', gtfsId: string, name: string, code: string }
    | { __typename: 'Route', gtfsId: string, shortName: string, longName: string }
    | { __typename: 'StopOnRoute', route: { gtfsId: string }, stop: { gtfsId: string } }
    | { __typename: 'StopOnTrip', trip: { gtfsId: string }, stop: { gtfsId: string } }
    | { __typename: 'Agency', gtfsId: string }
    | { __typename: 'Pattern', headsign: string }
    | { __typename: 'RouteType', routeType: string }
    | { __typename: 'Trip', gtfsId: string, tripShortName: string, routeShortName: string }
    | { __typename: 'Unknown' };

export interface IAlert {
    id: string,
    effectiveStartDate: number,
    effectiveEndDate: number,
    alertDescriptionText: string,
    alertHeaderText: string,
    alertSeverityLevel: string,
    entities?: IGenericAlertEntity[]
}

export interface IStopRealtimeData {
    gtfsId: string;
    name: string;
    vehicleMode: string | null;
    alerts: IAlert[];
    routes: {
        gtfsId: string,
        shortName: string,
        alerts: IAlert[]
    }[];
    stoptimesWithoutPatterns: {
        serviceDay: number;
        scheduledArrival: number;
        scheduledDeparture: number;
        realtimeArrival: number;
        realtimeDeparture: number;
        trip?: {
            route?: {
                gtfsId?: string;
                shortName?: string;
            };
            alerts: IAlert[]
        };
        headsign?: string;
    }[];
}

export interface IMonitorSettings {
    isMapOnly?: boolean;
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
            if (metaRaw.stops) {
                return metaRaw;
            }
        } catch (err) {}
    }
    
    return null;
    
}

const initialSettings = getInitialSettings() || {};

export enum AppView {
    MONITORS = 'monitors',
    MAP = 'map',
    INFO = 'info'
};

export default function App(props: {}) {
    
    const [appView, setAppView] = useState<AppView>(AppView.MONITORS);
    
    const [isChoosing, setChoosing] = useState<boolean>(false);
    const [isEditing, setEditing] = useState<boolean>(false);
    
    const [filteredLines, setFilteredLines] = useState<string[] | null>(initialSettings.mapLines || null);
    const [monitorStops, setMonitorStops] = useState<string[]>(initialSettings.stops || []);
    
    useEffect(() => {
        
        /*
        if (monitorStops.length == 0 && filteredLines == null) {
            return;
        }
        */
        
        window.location.hash = `#${encodeURIComponent(JSON.stringify({
            stops: monitorStops,
            mapLines: filteredLines
        }))}`;
        
    }, [monitorStops, filteredLines]);
    
    return <Fragment>
        
        <div className='nyssvaaja-app'>
            <div className='nyssvaaja-view'>
                {appView == AppView.MONITORS && <Fragment>
                    <Monitor
                        stops={monitorStops}
                        interval={10}
                        isEditing={isEditing}
                        onEdit={(n, command) => {
                            switch (command) {
                                case 'delete': {
                                    setMonitorStops(old => old.filter((st, i) => i != n));
                                    break;
                                }
                                case 'up':
                                case 'down': {
                                    
                                    const mut = [...monitorStops];
                                    if (command == 'up' && n > 0) {
                                        const oldPrev = mut[n-1];
                                        mut[n-1] = mut[n];
                                        mut[n] = oldPrev;
                                    } else if (command == 'down' && n < mut.length-1) {
                                        const oldNext = mut[n+1];
                                        mut[n+1] = mut[n];
                                        mut[n] = oldNext;
                                    }
                                    
                                    setMonitorStops(mut);
                                    
                                    break;
                                }
                            }
                        }}
                        />
                    {monitorStops.length == 0 &&
                        <div className='nyssvaaja-get-started'>
                            <h1>👻</h1>
                            <h2>Oho, tyhjää!</h2>
                            <p>Aloita valitsemalla pysäkkejä &darr;</p>
                        </div>}
                    <div className='nyssvaaja-edit-monitor mb-3'>
                        <button
                            className='x-btn'
                            onClick={e => {
                                e.preventDefault();
                                setChoosing(true);
                            }}
                            >
                            <RemixIcon icon='ri-map-pin-add-line'/>
                        </button>
                        {monitorStops.length > 0 && 
                            <button
                                className='x-btn'
                                onClick={e => {
                                    e.preventDefault();
                                    setEditing(ed => !ed);
                                }}
                                >
                                {isEditing ? <RemixIcon icon='ri-check-line'/> : <RemixIcon icon='ri-pencil-line'/>}
                            </button>}
                    </div>
                </Fragment>}
                {appView == AppView.MAP &&
                    <NysseMapNew
                        filteredLines={filteredLines}
                        setFilteredLines={setFilteredLines}
                        />}
                {appView == AppView.INFO &&
                    <AppInfo/>}
            </div>
            <div className='nyssvaaja-menu'>
                <div className='menu-item'
                    data-active={`${appView == AppView.MONITORS}`}
                    onClick={e => {
                        e.preventDefault();
                        setAppView(AppView.MONITORS);
                    }}
                    ><RemixIcon icon='ri-bus-fill'/></div>
                <div className='menu-item'
                    data-active={`${appView == AppView.MAP}`}
                    onClick={e => {
                        e.preventDefault();
                        setAppView(AppView.MAP);
                    }}
                    ><RemixIcon icon='ri-road-map-line'/></div>
                <div className='menu-item'
                    data-active={`${appView == AppView.INFO}`}
                    onClick={e => {
                        e.preventDefault();
                        setAppView(AppView.INFO);
                    }}
                    ><RemixIcon icon='ri-information-2-line'/></div>
            </div>
        </div>
        
        {isChoosing &&
            <StopChooser
                onChoose={stops => {
                    setMonitorStops(stops);
                    setChoosing(false);
                }}
                chosen={monitorStops}
                />}
        
    </Fragment>;
    
}
