import { Fragment, h, render } from 'preact';

import L, { DivIcon, divIcon, icon, LatLngExpression, Map as LeafletMap, Marker, Polyline, popup } from 'leaflet';
import { useEffect, useRef, useState } from 'preact/hooks';

import 'leaflet-rotatedmarker';
import 'leaflet-doubletapdrag';
import 'leaflet-doubletapdragzoom';
import { encodeHTML, findRouteDetails, getAllStops, RemixIcon } from 'src/js/util';
import { IStopData } from 'src/js/app';

let __map: LeafletMap | null = null;
let __mapState: {
    updateMarkers: (picked: string[]) => any,
    jumpToGps: () => any
} | null = null;

const ICON_GPS = divIcon({
    iconSize: [16, 16],
    className: 'x-gps-icon'
});

const ICON_STOP = icon({
    iconUrl: (new URL('../../../assets/pysakki.png', import.meta.url)).toString(),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [12, -12]
})

const ICON_STOP_TRAM = icon({
    iconUrl: (new URL('../../../assets/ratikka.png', import.meta.url)).toString(),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [12, -12]
})

const ICON_STOP_SELECTED = icon({
    iconUrl: (new URL('../../../assets/pysakki_valittu.png', import.meta.url)).toString(),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [12, -12]
})

export default function StopSelectorMap(props: {
    selected: string[],
    onPick: (id: string) => any
}) {
    
    const refMapContainer = useRef<HTMLDivElement>(null);
    
    const [filteredLines, setFilteredLines] = useState<string[] | null>();
    const [isLinePickerOpen, setLinePickerOpen] = useState<boolean>(false);
    
    useEffect(() => {
        
        if (!refMapContainer.current) {
            return;
        }
        
        const map = L.map(refMapContainer.current, {
            preferCanvas: true,
            zoom: 13,
            scrollWheelZoom: true,
            markerZoomAnimation: false,
            // @ts-ignore
            doubleTapDragZoomOptions: { reverse: true },
            center: [61.496634, 23.756104]
        });
        
        map.addLayer(L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://digitransit.fi/en/developers/">Digitransit</a>`
        }));
        
        let hadInitialGps = false;
        const gpsLocation: LatLngExpression = [0, 0];
        const markerGps = L.marker(gpsLocation, {
            icon: ICON_GPS
        });
        markerGps.addTo(map);
        // @todo add gps location
        
        const geolocationId = navigator.geolocation.watchPosition(position => {
            
            markerGps.setLatLng([
                position.coords.latitude,
                position.coords.longitude
            ]);
            
            if (!hadInitialGps) {
                map.flyTo([position.coords.latitude, position.coords.longitude], 15);
                hadInitialGps = true;
            }
            
        }, error => {
            console.error(error);
        }, {
            enableHighAccuracy: true,
            maximumAge: 3000
        });
        
        
        // STOP MARKERS
        const stopMarkers = new Map<string, Marker>();
        const tramStops: string[] = [];
        getAllStops()
            .then(stopsRaw => {
                const rawData: IStopData[] = [...stopsRaw.data.stops].filter(sd => !!sd.vehicleMode);
                for (const stop of rawData) {
                    
                    if (!stop.lat || !stop.lon) continue;
                    
                    const stopMarker = L.marker([stop.lat, stop.lon], {
                        icon: props.selected.includes(stop.gtfsId)
                            ? ICON_STOP_SELECTED
                            : (stop.vehicleMode == 'TRAM' ? ICON_STOP_TRAM : ICON_STOP)
                    });
                    
                    if (stop.vehicleMode == 'TRAM') {
                        tramStops.push(stop.gtfsId);
                    }
                    
                    stopMarker.addEventListener('click', () => {
                        props.onPick(stop.gtfsId);
                    });
                    
                    stopMarkers.set(stop.gtfsId, stopMarker);
                    stopMarker.addTo(map);
                    
                }
            })
            .catch(err => console.error(err));
        
        
        __map = map;
        __mapState = {
            updateMarkers: picked => {
                for (const [stopId, stopMarker] of stopMarkers.entries()) {
                    if (picked.includes(stopId)) {
                        stopMarker.setIcon(ICON_STOP_SELECTED);
                    } else {
                        stopMarker.setIcon(tramStops.includes(stopId)
                            ? ICON_STOP_TRAM
                            : ICON_STOP);
                    }
                }
            },
            jumpToGps: () => {
                map.flyTo(gpsLocation);
            }
        };
        
        return () => {
            
            if (geolocationId != null) {
                navigator.geolocation.clearWatch(geolocationId);
            }
            
            map.remove();
            __map = null;
            __mapState = null;
            
        };
        
    }, []);
    
    useEffect(() => {
        __mapState?.updateMarkers(props.selected);
    }, [props.selected]);
    
    return <div>
        
        <div className='x-floating-map'
            style={{ height: '100%', borderRadius: '4px', overflow: 'hidden' }}
            >
            <div className='x-floating-map-container' style={{ height: '100%' }}>
                <div className='x-map' ref={refMapContainer} style={{
                    height: '100%'
                }}>
                </div>
            </div>
            <div className='x-floating-map-toolbar'>
                <button
                    onClick={e => {
                        e.preventDefault();
                        __mapState?.jumpToGps();
                    }}
                    >
                    <RemixIcon icon='ri-navigation-line'/>
                </button>
            </div>
                    
        </div>
        
    </div>;
    
}
