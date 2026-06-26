import { Fragment, h, render } from 'preact';

import L, { DivIcon, divIcon, icon, LatLngExpression, Map as LeafletMap, Marker, Polyline, popup } from 'leaflet';
import { Dispatch, StateUpdater, useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';

import 'leaflet-rotatedmarker';
import 'leaflet-doubletapdrag';
import 'leaflet-doubletapdragzoom';
import { encodeHTML, findRouteDetails, getAllStops, IGenericRoute, RemixIcon } from 'src/js/util';
import { IStopData } from 'src/js/app';
import { NysseStop, SingleNysseStop } from '../Monitor';
import { LinePicker } from './linepicker';
import { BusInstanceMonitor } from 'src/js/ui/newmap/businstance';

let __map: LeafletMap | null = null;
let __mapState: {
    filterLines: (gtfsIds: string[] | null) => any,
    jumpToGps: () => any
} | null = null;

const screenHeight = signal(window.innerHeight);
document.addEventListener('resize', () => {
    screenHeight.value = window.innerHeight;
    __map?.invalidateSize();
});

const ICON_GPS = divIcon({
    iconSize: [16, 16],
    className: 'x-gps-icon'
});

const TRAM_HEADSIGNS = ['1', '3'];
const ICON_CACHE = new Map<string, DivIcon>();

const ICON_STOP = icon({
    iconUrl: (new URL('../../../assets/pysakki.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_STOP_TRAM = icon({
    iconUrl: (new URL('../../../assets/ratikka.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_STOP_METRO = icon({
    iconUrl: (new URL('../../../assets/metropysakki.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_STOP_TRAIN = icon({
    iconUrl: (new URL('../../../assets/junapysakki.png', import.meta.url)).toString(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [8, -8]
})

const ICON_BUS = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner" data-tram="false">`
        + `<img src="${(new URL('../../../assets/bussi.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">X</span>`
    + `</div>`
});

const ICON_TRAM = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner" data-tram="true">`
        + `<img src="${(new URL('../../../assets/bussi.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const ICON_METRO = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner" data-metro="true">`
        + `<img src="${(new URL('../../../assets/metro.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const ICON_TRAIN = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner" data-metro="true">`
        + `<img src="${(new URL('../../../assets/juna.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const iconTypes: Record<string, any> = {
    RAIL: ICON_TRAIN,
    BUS: ICON_BUS,
    SUBWAY: ICON_METRO,
    TRAM: ICON_TRAM
};

const stopTypes: Record<string, any> = {
    RAIL: ICON_STOP_TRAIN,
    BUS: ICON_STOP,
    SUBWAY: ICON_STOP_METRO,
    TRAM: ICON_STOP_TRAM
};

const typeColors: Record<string, string> = {
    BUS: '#20264d',
    TRAM: '#4d2020',
    SUBWAY: '#a85c00',
    RAIL: '#00a80b',
    FERRY: '#4a008a'
};

export default function NysseMapNew(props: {
    feed: string,
    filteredLines: string[] | null,
    setFilteredLines: Dispatch<StateUpdater<string[] | null>>
}) {
    
    const refMapContainer = useRef<HTMLDivElement>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([61.496634, 23.756104]);
    const [isLoaded, setLoaded] = useState<boolean>(false);
    
    const {filteredLines, setFilteredLines} = props;
    const [isLinePickerOpen, setLinePickerOpen] = useState<boolean>(false);
    
    const [popupBusLine, setPopupBusLine] = useState<any | null>(null);
    const [allRoutes, setAllRoutes] = useState<Record<string, IGenericRoute>>({});
    
    const isActuallyLoaded = isLoaded && Object.keys(allRoutes).length > 0;
    
        
    useEffect(() => {
        fetch(`/api/getAllRoutes/${encodeURIComponent(props.feed)}`)
            .then(x => x.json())
            .then(rawRoutes => {
                if (!rawRoutes || !rawRoutes.data.routes) {
                    console.error(`Invalid data?`);
                    return;
                }
                setAllRoutes(Object.fromEntries(rawRoutes.data.routes.map((r: any) => [r.gtfsId, r])));
            })
    }, [props.feed]);
        
    useEffect(() => {
        
        if (!refMapContainer.current) {
            return;
        }
        
        if (Object.keys(allRoutes).length == 0) {
            console.log(`waiting for route data...`);
            return;
        }
        
        const map = L.map(refMapContainer.current, {
            preferCanvas: true,
            zoom: 13,
            scrollWheelZoom: true,
            markerZoomAnimation: false,
            // @ts-ignore
            doubleTapDragZoomOptions: { reverse: true },
            center: mapCenter
        });
        
        map.addLayer(L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://digitransit.fi/en/developers/">Digitransit</a>`
        }));
        
        let hadInitialGps = false;
        let userHasMoved = false;
        
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
            
            gpsLocation[0] = position.coords.latitude;
            gpsLocation[1] = position.coords.longitude;
            
            if (!hadInitialGps) {
                if (!userHasMoved) {
                    map.flyTo([position.coords.latitude, position.coords.longitude], 15, { animate: false });
                }
                hadInitialGps = true;
            }
            
        }, error => {
            console.error(error);
        }, {
            enableHighAccuracy: true,
            maximumAge: 3000
        });
        
        map.addEventListener('move', () => {
            userHasMoved = true;
        });
        
        
        // STOP MARKERS
        const stopMarkers = new Map<string, Marker>();
        getAllStops(props.feed)
            .then(stopsRaw => {
                const rawData: IStopData[] = [...stopsRaw.data.stops].filter(sd => !!sd.vehicleMode);
                
                const latC = rawData.reduce((p, c) => p+c.lat, 0)/rawData.length;
                const lonC = rawData.reduce((p, c) => p+c.lon, 0)/rawData.length;
                setMapCenter([latC, lonC]);
                __map?.panTo([latC, lonC]);
                setLoaded(true);
                
                for (const stop of rawData) {
                    
                    if (!stop.lat || !stop.lon) continue;
                    
                    const stopMarker = L.marker([stop.lat, stop.lon], {
                        icon: stopTypes[stop.vehicleMode] || ICON_STOP //stop.vehicleMode == 'TRAM' ? ICON_STOP_TRAM : ICON_STOP
                    });
                    
                    stopMarker.addEventListener('click', () => {
                        
                        const popupStop = L.popup({
                            autoPan: false,
                            keepInView: false,
                            className: 'x-map-stop-popup',
                            content: '<div class="inner" style="width: 250px;"></div>'
                        });
                        
                        stopMarker
                            .bindPopup(popupStop)
                            .openPopup();
                        
                        const popupElement = popupStop.getElement();
                        const popupInner = popupElement?.querySelector('.inner');
                        if (popupElement && popupInner) {
                            const content = popupElement.querySelector('.leaflet-popup-content');
                            if (content && content instanceof HTMLElement) {
                                content.style.width = '';
                            }
                            render(<Fragment>
                                <SingleNysseStop feed={props.feed} stopId={stop.gtfsId}/>
                            </Fragment>, popupInner);
                        }
                        
                        let isRemoved = false;
                        stopMarker.addEventListener('popupclose', () => {
                            
                            if (isRemoved) return;
                            isRemoved = true;
                            
                            const popupElement = popupStop.getElement();
                            const popupInner = popupElement?.querySelector('.inner');
                            popupInner && render(null, popupInner);
                            
                            stopMarker.unbindPopup();
                            popupStop.remove();
                            
                            console.log('remove stop popup');
                            
                        });
                        
                    });
                    
                    stopMarkers.set(stop.gtfsId, stopMarker);
                    stopMarker.addTo(map);
                    
                }
            })
            .catch(err => console.error(err));
        
        
        // VEHICLE MARKERS
        const vehicleMarkers = new Map<string, Marker>();
        let shownRoutes: string[] | null = null;
        async function updateVehicleMarkers() {
            
            const x = await fetch(`/api/realtime/${encodeURIComponent(props.feed)}?t=${Date.now()}`);
            const vehicles: IRealtimeVehicle[] = (await x.json())
                .filter((v: IRealtimeVehicle) => !shownRoutes || shownRoutes.includes(v.headsign));
            
            for (const veh of vehicles) {
                
                //console.log(veh.walttiRouteId, allRoutes);
                
                const vehRefInitial = veh.vehicleRef.split('_')[0];
                let routeId = veh.walttiRouteId || '';
                // stupid hack for Tampere's route ID weirdness.... reeEEEE
                if (routeId.endsWith(vehRefInitial)) {
                    routeId = routeId.slice(0, -vehRefInitial.length);
                }
                
                const vehRoute = allRoutes[props.feed + ':' + routeId];
                const fuzzyHeadsign = routeId;
                const headsign = veh.walttiRouteId
                    ? (vehRoute?.shortName ?? '???')
                    : veh.headsign;
                
                if (!vehicleMarkers.has(veh.vehicleRef)) {
                    
                    const m = L.marker(
                        veh.location,
                        {
                            rotationAngle: veh.bearing,
                            rotationOrigin: 'center',
                            zIndexOffset: 100,
                            icon: iconTypes[vehRoute.mode] || ICON_BUS //vehRoute.mode != 'BUS' ? ICON_TRAM : ICON_BUS
                        }
                    );
                    
                    m.addEventListener('click', e => {
                        
                        const popupBus = L.popup({
                            className: 'x-map-vehicle-bubble',
                            autoPan: false,
                            keepInView: false
                        })
                            .setLatLng(veh.location)
                            .setContent(`
                                <b><span class="headsign">${encodeHTML(headsign)}</span> ${encodeHTML(veh.destination)}</b> <br/>
                                <span class="${`time ${Math.abs(veh.delay) < 0.5 ? '' : (veh.delay < 0 ? 'early' : 'delayed')}`}">${(Math.abs(veh.delay)/1000/60).toFixed(1)} min ${veh.delay < 0 ? 'etuajassa' : 'myöhässä'}</span>
                            `);
                        
                        let shownPath: Polyline | null = null;
                        let tripUpdateTimeout: any = null;
                        
                        const updateRouteInfo = () => {
                            findRouteDetails(fuzzyHeadsign, parseInt(veh.direction), veh.tripDate, veh.tripTime, props.feed)
                                .then(trip => {
                                    
                                    setPopupBusLine(trip || null);
                                    
                                    if (!trip) {
                                        console.error(`fuzzy trip search failed for ${fuzzyHeadsign}`);
                                        return;
                                    }
                                    
                                    for (const stopTime of trip.stoptimesForDate) {
                                        
                                        const stopMarker = stopMarkers.get(stopTime.stop.gtfsId);
                                        if (!stopMarker) continue;
                                        
                                        if ((((stopTime.serviceDay*1000 + stopTime.realtimeDeparture*1000) - Date.now())/1000/60) > 0) {
                                            stopMarker.getTooltip()?.setContent(`<div class='x-map-stop-tooltip'>
                                                <b>${stopTime.stop.name}</b> <br/>
                                                ${(((stopTime.serviceDay*1000 + stopTime.realtimeDeparture*1000) - Date.now())/1000/60).toFixed(0)} min
                                            </div>`);
                                        } else {
                                            if (stopMarker.getTooltip()) {
                                                stopMarker.unbindTooltip();
                                                stopMarker.getTooltip()?.remove();
                                            }
                                        }
                                        
                                    }
                                    
                                })
                                .catch(err => {
                                    console.error(err);
                                })
                                .finally(() => {
                                    tripUpdateTimeout = setTimeout(() => updateRouteInfo(), 1000*10);
                                })
                        }
                        
                        findRouteDetails(fuzzyHeadsign, parseInt(veh.direction), veh.tripDate, veh.tripTime, props.feed)
                            .then(trip => {
                                    
                                setPopupBusLine(trip || null);
                                
                                if (shownPath) {
                                    shownPath?.remove();
                                    shownPath = null;
                                }
                                
                                if (!trip) {
                                    console.error(`fuzzy trip search failed for ${fuzzyHeadsign}`);
                                    return;
                                }
                                
                                shownPath = L.polyline(trip.geometry.map(([lo, la]: [number, number]) => [la, lo]), {
                                    color: typeColors[vehRoute.mode] || '#20264d', //TRAM_HEADSIGNS.includes(headsign) ? ,
                                    weight: 10
                                });
                                shownPath.addTo(map);
                                
                                for (const m of stopMarkers.values()) {
                                    m.setOpacity(0.2);
                                }
                                for (const stopTime of trip.stoptimesForDate) {
                                    
                                    const stopMarker = stopMarkers.get(stopTime.stop.gtfsId);
                                    if (!stopMarker) continue;
                                    
                                    stopMarker.setOpacity(1);
                                    
                                    if ((((stopTime.serviceDay*1000 + stopTime.realtimeDeparture*1000) - Date.now())/1000/60) > 0) {
                                        stopMarker.bindTooltip(L.tooltip({
                                            className: '',
                                            permanent: true,
                                            direction: 'center',
                                            content: `<div class='x-map-stop-tooltip'>
                                                <b>${stopTime.stop.name}</b> <br/>
                                                ${(((stopTime.serviceDay*1000 + stopTime.realtimeDeparture*1000) - Date.now())/1000/60).toFixed(0)} min
                                            </div>`
                                        }));
                                    }
                                    
                                    
                                }
                                
                            })
                            .catch(err => {
                                console.error(err);
                            })
                            .finally(() => {
                                tripUpdateTimeout = setTimeout(() => updateRouteInfo(), 1000*10);
                            })
                        
                        m.bindPopup(popupBus).openPopup();
                        
                        let isRemoved = false;
                        m.addEventListener('popupclose', () => {
                            
                            if (isRemoved) return;
                            isRemoved = true;
                                    
                            setPopupBusLine(null);
                            
                            m.unbindPopup();
                            popupBus.remove();
                            
                            shownPath?.remove();
                            shownPath = null;
                            for (const m of stopMarkers.values()) {
                                m.setOpacity(1);
                                m.unbindTooltip();
                                m.getTooltip()?.remove();
                            }
                            
                            if (tripUpdateTimeout !== null) {
                                clearTimeout(tripUpdateTimeout);
                            }
                            
                            console.log('remove popup');
                            
                        });
                        
                    });
                    
                    m.addTo(map);
                    vehicleMarkers.set(veh.vehicleRef, m);
                    
                }
                
                const m = vehicleMarkers.get(veh.vehicleRef);
                m?.setLatLng(veh.location);
                m?.setRotationAngle(veh.bearing);
                    
                const markerText = m?.getElement()?.querySelector('.inner span');
                if (markerText && markerText instanceof HTMLElement) {
                    markerText.style.transform = `rotate(-${veh.bearing}deg)`;
                    markerText.textContent = `${headsign}`;
                }
                
                const popupBus = m?.getPopup();
                if (popupBus) {
                    popupBus.setContent(`
                        <b><span class="headsign">${encodeHTML(headsign)}</span> ${encodeHTML(veh.destination)}</b> <br/>
                        <span class="${`time ${Math.abs(veh.delay) < 0.5 ? '' : (veh.delay < 0 ? 'early' : 'delayed')}`}">${(Math.abs(veh.delay)/1000/60).toFixed(1)} min ${veh.delay < 0 ? 'etuajassa' : 'myöhässä'}</span>
                    `);
                }
                
            }
            
            // remove markers of non-existing vehicles
            const currentVehicles = vehicles.map(veh => veh.vehicleRef);
            const currentMarkers = [...vehicleMarkers.keys()];
            for (const key of currentMarkers) {
                if (!currentVehicles.includes(key)) {
                    vehicleMarkers.get(key)?.remove();
                    vehicleMarkers.delete(key);
                }
            }
            
            toUpdate = setTimeout(() => updateVehicleMarkers(), 5000)
            
        }
        
        let toUpdate = setTimeout(() => updateVehicleMarkers(), 0);
        
        __map = map;
        __mapState = {
            filterLines: (ids: string[] | null) => {
                
                shownRoutes = ids
                    ? ids.map(i => i.split(':').slice(-1).join(''))
                    : null;
                
                clearTimeout(toUpdate);
                toUpdate = setTimeout(() => updateVehicleMarkers(), 0);
                
            },
            jumpToGps: () => {
                map.flyTo(gpsLocation, 15, { animate: false });
            }
        };
        
        return () => {
            
            clearTimeout(toUpdate);
            
            if (geolocationId != null) {
                navigator.geolocation.clearWatch(geolocationId);
            }
            
            map.remove();
            __map = null;
            __mapState = null;
            
        };
        
    }, [allRoutes]);
    
    useEffect(() => {
        __mapState?.filterLines(props.filteredLines);
    }, [props.filteredLines]);
    
    return <div className='x-floating-map'
        style={{
            opacity: isActuallyLoaded ? 1 : 0.5,
            filter: isActuallyLoaded ? '' : 'grayscale(80%) blur(5px)'
        }}
        >
        <div className='x-floating-map-container'>
            <div className='x-map' ref={refMapContainer} style={{
                height: `${screenHeight.value}px`
            }}>
            </div>
        </div>
        <div className='x-floating-map-toolbar'>
            <button
                onClick={e => {
                    e.preventDefault();
                    setLinePickerOpen(o => !o);
                }}
                >
                <RemixIcon icon='ri-filter-line'/>
                {filteredLines && <span className='active-number'>{filteredLines.length}</span>}
            </button>
            <button
                onClick={e => {
                    e.preventDefault();
                    __mapState?.jumpToGps();
                }}
                >
                <RemixIcon icon='ri-navigation-line'/>
            </button>
        </div>
        
        {popupBusLine && <BusInstanceMonitor trip={popupBusLine}/>}
        
        {(isLinePickerOpen) && <div className='x-map-dialog-dimmer'></div>}
        
        {isLinePickerOpen &&
            <LinePicker
                onSelectLines={lines => {
                    __mapState?.filterLines(lines);
                    setFilteredLines(lines);
                    setLinePickerOpen(false);
                }}
                initialSelection={filteredLines}
                feed={props.feed}
                />}
                
    </div>;
    
}

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
    tripTime: string,
    
    licensePlate?: string,
    walttiRouteId?: string
}
