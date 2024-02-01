import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { IMonitorSettings, IStopData } from '../app';
import { MapContainer, Marker as ReactMarker, MarkerProps, Popup, TileLayer, useMap, useMapEvent, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import { LatLngExpression, icon, Marker, divIcon, DivIcon, LatLngTuple } from 'leaflet';
import { IFuzzyTripDepartureStopTime, IFuzzyTripDetails, findRouteDetails, getAllStops, plusOrMinus } from '../util';
import { forwardRef } from 'preact/compat';
import 'leaflet-rotatedmarker';

export interface IRealtimeVehicle {
    headsign: string,
    direction: string,
    origin: string,
    destination: string,
    location: [number, number],
    bearing: number,
    delay: number,
    vehicleRef: string,
    tripDate: string,
    tripTime: string
}

const TRAM_HEADSIGNS = ['1', '3'];
const TAMPERE: LatLngExpression = [61.496634, 23.756104];

const ICON_STOP = icon({
    iconUrl: (new URL('../../assets/pysakki.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_STOP_TRAM = icon({
    iconUrl: (new URL('../../assets/ratikka.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_GPS = divIcon({
    iconSize: [16, 16],
    className: 'x-gps-icon'
});

const ICON_CACHE = new Map<string, DivIcon>();
let hasLocationPermission = false;
let hasAskedLocationPermission = false;

function getBusIcon(headsign: string, rotation: number, isTram: boolean) {
    
    const iconHash = `${headsign}_${Math.floor(rotation)}`;
    
    if (ICON_CACHE.has(iconHash)) {
        return ICON_CACHE.get(iconHash);
    }
    
    const icon = divIcon({
        className: 'x-bus-icon',
        html: `<div class="inner" data-tram="${isTram}">`
            + `<img src="${(new URL('../../assets/bussi.png', import.meta.url)).toString()}"/>`
            + `<span style="transform: rotate(${-rotation}deg);">${encodeHTML(headsign)}</span>`
        + `</div>`
    });
    ICON_CACHE.set(iconHash, icon);
    
    return icon;
    
}

interface RotatedMarkerProps extends MarkerProps {
    rotationAngle: number,
    rotationOrigin: string
};

const RotatedMarker = forwardRef(({ children, ...props }: RotatedMarkerProps, forwardRef: any) => {
    const markerRef = useRef<Marker>();

    const { rotationAngle, rotationOrigin } = props;
    useEffect(() => {
        const marker = markerRef.current;
        if (marker) {
            marker.setRotationAngle(rotationAngle);
            marker.setRotationOrigin(rotationOrigin);
        }
    }, [rotationAngle, rotationOrigin]);

    return (
        <ReactMarker
            ref={(ref: any) => {
                markerRef.current = ref;
                if (forwardRef) {
                    forwardRef.current = ref;
                }
            }}
            {...props}
        >
            {children}
        </ReactMarker>
    );
});

export default function NysseMap(props: { settings: IMonitorSettings }) {
    
    const [screenHeight, setScreenHeight] = useState<number>(window.innerHeight);
    const [stops, setStops] = useState<IStopData[]>([]);
    
    const [realtimeData, setRealtimeData] = useState<IRealtimeVehicle[]>([]);
    const [gpsLocation, setGpsLocation] = useState<[number, number]>([0, 0]);
    
    const [shownPath, setShownPath] = useState<LatLngExpression[] | null>(null);
    const [filteredStops, setFilteredStops] = useState<{ [key: string]: IFuzzyTripDepartureStopTime } | null>(null);
    
    useEffect(() => {
        getAllStops()
            .then(stopsRaw => {
                const rawData: IStopData[] = [...stopsRaw.data.stops].filter(sd => !!sd.vehicleMode);
                setStops(rawData);
            })
    }, []);
    
    useEffect(() => {
        
        let geolocationId: number | null = null;
        
        if (navigator.geolocation) {
            geolocationId = navigator.geolocation.watchPosition(position => {
                hasLocationPermission = true;
                setGpsLocation([position.coords.latitude, position.coords.longitude]);
            }, error => {
                console.error(error);
                hasLocationPermission = false;
            })
        }
        
        function updateRealtime() {
            
            fetch(`/api/realtime?${Date.now()}`)
                .then(x => x.json())
                .then((vehicles: IRealtimeVehicle[]) => {
                    setRealtimeData(vehicles);
                })
                .catch(err => console.error(err))
            
        }
        
        let iv = setInterval(updateRealtime, 3000);
        updateRealtime();
        
        return () => {
            clearInterval(iv);
            if (geolocationId != null) {
                navigator.geolocation.clearWatch(geolocationId);
            }
        }
        
    }, []);
    
    return <div className='x-floating-map'
        style={{  }}
        >
        <div className='x-floating-map-container'>
            <div className='x-map' style={{ }}>
                <MapContainer center={TAMPERE} zoom={13} scrollWheelZoom={true} markerZoomAnimation={false} style={{ height: `${screenHeight}px` }}>
                    
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    
                    <ReactMarker position={[gpsLocation[0], gpsLocation[1]]} icon={ICON_GPS}/>
                    
                    {shownPath
                        ? <Polyline pathOptions={{
                            color: '#20264d',
                            weight: 10
                        }} positions={shownPath}/>
                        : ''}
                    
                    {stops
                        .filter(st => st.lat && st.lon)
                        .map(st => <ReactMarker key={st.gtfsId} position={[st.lat, st.lon]} icon={st.vehicleMode == 'TRAM' ? ICON_STOP_TRAM : ICON_STOP}
                            opacity={(!filteredStops || filteredStops[st.gtfsId]) ? 1 : 0.2} >
                            <Popup>
                                <b>{st.name}</b><br/>
                                {st.code}<br/>
                                {st.vehicleMode}
                            </Popup>
                            {filteredStops && filteredStops[st.gtfsId] && (((filteredStops[st.gtfsId].serviceDay*1000 + filteredStops[st.gtfsId].realtimeDeparture*1000) - Date.now())/1000/60) > 0
                                ? <Tooltip direction='top' permanent={true}>
                                    <div className='x-map-stop-tooltip'>
                                        <b>{filteredStops[st.gtfsId].stop.name}</b> <br/>
                                        {(((filteredStops[st.gtfsId].serviceDay*1000 + filteredStops[st.gtfsId].realtimeDeparture*1000) - Date.now())/1000/60).toFixed(0)} min
                                    </div>
                                </Tooltip>
                                : ''}
                        </ReactMarker>)}
                    
                    {realtimeData.map(veh => <RotatedMarker
                        key={veh.vehicleRef}
                        position={veh.location}
                        icon={getBusIcon(veh.headsign, veh.bearing, TRAM_HEADSIGNS.includes(veh.headsign))}
                        rotationAngle={veh.bearing}
                        rotationOrigin='center'
                        zIndexOffset={100}
                        eventHandlers={{
                            click: e => {
                                setShownPath(null);
                                findRouteDetails(veh.headsign, parseInt(veh.direction), veh.tripDate, veh.tripTime)
                                    .then(trip => {
                                        if (!trip) {
                                            throw new Error(`Fuzzy trip search failed for ${veh.headsign}`);
                                        }
                                        setShownPath(trip.geometry.map(([lo, la]) => [la, lo]));
                                        setFilteredStops(Object.fromEntries(trip.stoptimesForDate.map(s => [s.stop.gtfsId, s])));
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        setShownPath(null);
                                    })
                            }
                        }}
                        >
                        <Popup eventHandlers={{
                            remove: e => {
                               setFilteredStops(null);
                               setShownPath(null);
                            },
                            popupclose: e => {
                                setFilteredStops(null);
                                setShownPath(null);
                            }
                        }}>
                            <b>{veh.headsign} {veh.destination}</b> <br/>
                            {(veh.delay/1000/60).toFixed(1)} min myöhässä <br/>
                        </Popup>
                    </RotatedMarker>)}
                    
                    <SizeBubbler onResize={s => setScreenHeight(s)}/>
                    
                </MapContainer>
            </div>
        </div>
    </div>;
    
}

function SizeBubbler(props: { onResize: (n: number) => any }) {
    
    const [screenHeight, setScreenHeight] = useState<number>(window.innerHeight);
    
    const map = useMap();
    
    useEffect(() => {
        
        function onResize(e: any) {
            props.onResize(window.innerHeight);
            setScreenHeight(window.innerHeight);
            if (map) setTimeout(() => map.invalidateSize(), 1);
        }
        
        onResize(null);
        
        window.addEventListener('resize', onResize);
        
        return () => {
            window.removeEventListener('resize', onResize);
        }
        
    }, []);
    
    return <div></div>;
    
}


function encodeHTML(s: string) {
    return s.replace(/</gmi, '&lt;')
        .replace(/>/gmi, '&gt;')
        .replace(/"/gmi, '&quot;')
        .replace(/&/gmi, '&amp;');
}