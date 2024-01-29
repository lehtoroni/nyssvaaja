import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { IMonitorSettings, IStopData } from '../app';
import { MapContainer, Marker as ReactMarker, MarkerProps, Popup, TileLayer, useMap, useMapEvent, useMapEvents } from 'react-leaflet';
import { LatLngExpression, icon, Marker, divIcon, DivIcon } from 'leaflet';
import { getAllStops } from '../util';
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
    vehicleRef: string
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

const ICON_BUS = icon({
    iconUrl: (new URL('../../assets/bussi.png', import.meta.url)).toString(),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [16, -8]
})

const ICON_TRAM = icon({
    iconUrl: (new URL('../../assets/ratikkablob.png', import.meta.url)).toString(),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [16, -8]
})

const ICON_CACHE = new Map<string, DivIcon>();

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
    
    useEffect(() => {
        getAllStops()
            .then(stopsRaw => {
                const rawData: IStopData[] = [...stopsRaw.data.stops].filter(sd => !!sd.vehicleMode);
                setStops(rawData);
            })
    }, []);
    
    useEffect(() => {
        
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
        }
        
    }, []);
    
    return <div className='x-floating-map'
        style={{  }}
        >
        <div className='x-floating-map-container'>
            <div className='x-map' style={{ }}>
                <MapContainer center={TAMPERE} zoom={13} scrollWheelZoom={true} style={{ height: `${screenHeight}px` }}>
                    
                    <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {stops.filter(st => st.lat && st.lon).map(st => <ReactMarker position={[st.lat, st.lon]} icon={st.vehicleMode == 'TRAM' ? ICON_STOP_TRAM : ICON_STOP}>
                        <Popup>
                            <b>{st.name}</b><br/>
                            {st.code}<br/>
                            {st.vehicleMode}
                        </Popup>
                    </ReactMarker>)}
                    
                    {realtimeData.map(veh => <RotatedMarker position={veh.location} icon={getBusIcon(veh.headsign, veh.bearing, TRAM_HEADSIGNS.includes(veh.headsign))} rotationAngle={veh.bearing} rotationOrigin='center' zIndexOffset={100}>
                        <Popup>
                            {veh.headsign}
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