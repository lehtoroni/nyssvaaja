import { Fragment, h, render } from 'preact';

import L, { DivIcon, divIcon, icon, LatLngExpression, Map as LeafletMap, maplibreGL, Marker, Polyline, popup } from 'leaflet';
import { Dispatch, StateUpdater, useEffect, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';

import 'leaflet-rotatedmarker';
import 'leaflet-doubletapdrag';
import 'leaflet-doubletapdragzoom';
import '@maplibre/maplibre-gl-leaflet';

import { encodeHTML, findRouteDetails, getAllStops, getGhostTripLastStop, IGenericRoute, lazyFindRouteDetails, RemixIcon } from '../../util';
import { IStopData } from '../../app';
import { NysseStop, SingleNysseStop } from '../Monitor';
import { LinePicker } from './linepicker';
import { BusInstanceMonitor } from './businstance';
import { IGhostTrip, IRealtimeVehicle, IRunningTrip } from '../../../common/types';

let __map: LeafletMap | null = null;
let __mapState: {
    filterLines: (gtfsIds: string[] | null, callUpdate?: boolean) => any,
    jumpToGps: () => any
} | null = null;

const FEED_CENTERS: Record<string, [number, number]> = {
    "FOLI": [60.4518, 22.2666],
    "FUNI": [62.2426, 25.7473],
    "HSL": [60.1699, 24.9384],
    "HSLlautta": [60.1699, 24.9384],
    "Hameenlinna": [60.9963, 24.4643],
    "Harma": [63.0333, 22.8500],
    "IngvesSvanback": [60.1167, 19.9000],
    "Joensuu": [62.6010, 29.7636],
    "Kajaani": [64.2273, 27.7285],
    "Korsisaari": [60.2055, 24.6559],
    "Kotka": [60.4664, 26.9458],
    "KotkaLautat": [60.4664, 26.9458],
    "Kouvola": [60.8681, 26.7042],
    "Kuopio": [62.8924, 27.6770],
    "Lahti": [60.9827, 25.6615],
    "Lappeenranta": [61.0583, 28.1887],
    "LINKKI": [62.2426, 25.7473],
    "MATKA": [63.0951, 21.6165],
    "Mikkeli": [61.6886, 27.2723],
    "OULU": [65.0121, 25.4651],
    "PahkakankaanLiikenne": [64.2273, 27.7285],
    "Pori": [61.4851, 21.7974],
    "Raasepori": [59.9731, 23.4339],
    "Rauma": [61.1290, 21.5113],
    "Rovaniemi": [66.5039, 25.7294],
    "Salo": [60.3833, 23.1333],
    "Vaasa": [63.0951, 21.6165],
    "VARELY": [60.4518, 22.2666],
    "Viro": [59.4370, 24.7536],
    "tampere": [61.4978, 23.7610]
};

const mapContainerHeight = signal(window.innerHeight-50);
function recalcMapHeight() {
    const c = document.querySelector('.x-floating-map-container');
    if (c) {
        mapContainerHeight.value = c.getBoundingClientRect().height;
    } else {
        mapContainerHeight.value = window.innerHeight-50;
    }
    __map?.invalidateSize();
}
window.addEventListener('resize', () => {
    recalcMapHeight();
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

const ICON_STOP_FERRY = icon({
    iconUrl: (new URL('../../../assets/lauttapysakki.png', import.meta.url)).toString(),
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
    html: `<div class="inner">`
        + `<img src="${(new URL('../../../assets/metro.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const ICON_TRAIN = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner">`
        + `<img src="${(new URL('../../../assets/juna.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const ICON_GHOST = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner">`
        + `<img src="${(new URL('../../../assets/haamu.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const ICON_FERRY = divIcon({
    className: 'x-bus-icon', 
    html: `<div class="inner">`
        + `<img src="${(new URL('../../../assets/lautta.png', import.meta.url)).toString()}"/>`
        + `<span class="vehicle-number" style="transform: rotate(0deg);">R</span>`
    + `</div>`
});

const iconTypes: Record<string, any> = {
    RAIL: ICON_TRAIN,
    BUS: ICON_BUS,
    SUBWAY: ICON_METRO,
    TRAM: ICON_TRAM,
    FERRY: ICON_FERRY
};

const stopTypes: Record<string, any> = {
    RAIL: ICON_STOP_TRAIN,
    BUS: ICON_STOP,
    SUBWAY: ICON_STOP_METRO,
    TRAM: ICON_STOP_TRAM,
    FERRY: ICON_STOP_FERRY
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
    const [mapCenter, setMapCenter] = useState<[number, number]>(FEED_CENTERS[props.feed] || [61.496634, 23.756104]);
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
        
        let vehFetchCount = 0;
        
        const map = L.map(refMapContainer.current, {
            preferCanvas: true,
            zoom: 13,
            scrollWheelZoom: true,
            markerZoomAnimation: false,
            // @ts-ignore
            doubleTapDragZoomOptions: { reverse: true },
            center: mapCenter
        });
        
        /*
        map.addLayer(L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Data: <a href="https://digitransit.fi/en/developers/">Digitransit</a>`
        }));
        */
        
        const glLayer = maplibreGL({
            style: 'https://tiles.openfreemap.org/styles/bright'
        });
        glLayer.addTo(map);
        
        let hadInitialGps = false;
        let userHasMoved = false;
        let hasJumpedGps = false;
        
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
                    hasJumpedGps = true;
                }
                hadInitialGps = true;
            }
            
        }, error => {
            console.error(error);
            hasJumpedGps = true;
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
                
                if (FEED_CENTERS[props.feed]) {
                    setMapCenter(FEED_CENTERS[props.feed]);
                } else {
                    setMapCenter([latC, lonC]);
                }
                
                if (!hasJumpedGps && !userHasMoved && hadInitialGps) {
                    //__map?.panTo([latC, lonC]);
                }
                
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
                                <SingleNysseStop
                                    feed={props.feed}
                                    stopId={stop.gtfsId}
                                    onShowTrip={(routeId, dir, dateRef, timeref, feed) => {
                                        
                                        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                                        const vehD = new Date(parseInt(dateRef as any)*1000 + parseInt(timeref as any)*1000 - tzOffset);
                                        const vehInternalRef = JSON.stringify([
                                            routeId.split(':').at(-1),
                                            parseInt(dir as any),
                                            vehD.toISOString().split('T')[0],
                                            vehD.toISOString().split('T')[1].slice(0, -5),
                                            feed
                                        ]);
                                        
                                        const m = vehicleMarkers.get(vehInternalRef);
                                        if (m) {
                                            console.log(m);
                                            setTimeout(() => {
                                                m.fire('click');
                                                map.flyTo(m.getLatLng());
                                            }, 1);
                                        }
                                        
                                    }}
                                    />
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
        const ghostMarkers = new Map<string, Marker>();
        const ghostTrips = new Map<string, IGhostTrip>();
        
        let shownRoutes: string[] | null = null;
        
        async function updateVehicleMarkers(callUpdate: boolean = true) {
            
            if (vehFetchCount == 0) {
                console.log('doing initial filtering...');
                __mapState?.filterLines(props.filteredLines, false);
            }
            
            const x = await fetch(`/api/realtime/${encodeURIComponent(props.feed)}?t=${Date.now()}`);
            const vehicles: IRealtimeVehicle[] = (await x.json());
            
            let supposedTrips: IRunningTrip[] = [];
            if (vehFetchCount > 1) {
                const z = await fetch(`/api/getCurrentTrips/${encodeURIComponent(props.feed)}?t=${Date.now()}`);
                supposedTrips = (await z.json());
            }
            
            for (const veh of vehicles) {
                
                // stupid hack for Tampere's route ID weirdness.... reeEEEE
                const vehRefInitial = veh.vehicleRef.split('_')[0];
                let routeId = veh.walttiRouteId || '';
                if (routeId.endsWith(vehRefInitial)) {
                    routeId = routeId.slice(0, -vehRefInitial.length);
                }
                
                const vehRoute = allRoutes[props.feed + ':' + routeId];
                const fuzzyHeadsign = routeId;
                const headsign = veh.walttiRouteId
                    ? (vehRoute?.shortName ?? '???')
                    : (veh.headsign || '');
                
                if (shownRoutes && !(shownRoutes.includes(headsign) || shownRoutes.includes(vehRoute?.gtfsId?.split(':')?.at(-1) ?? ''))) {
                    continue; // hidden route!
                }
                
                if (!vehRoute) {
                    console.warn(`unknown route? ${props.feed}:${routeId}`);
                }
                
                const vehInternalRef = JSON.stringify([fuzzyHeadsign, parseInt(veh.direction as any), veh.tripDate, veh.tripTime, props.feed]);
                //console.log(vehInternalRef);
                
                // @ts-ignore
                veh.__id = vehInternalRef;
                
                if (!vehicleMarkers.has(vehInternalRef)) {
                    
                    const m = L.marker(
                        veh.location,
                        {
                            rotationAngle: veh.bearing,
                            rotationOrigin: 'center',
                            zIndexOffset: 100,
                            icon: iconTypes[vehRoute?.mode ?? ''] || ICON_BUS //vehRoute.mode != 'BUS' ? ICON_TRAM : ICON_BUS
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
                                <b><span class="headsign">${encodeHTML(headsign)}</span> ${encodeHTML(veh.destination || vehRoute.longName)}</b> <br/>
                                <span class="${`time ${Math.abs(veh.delay) < 0.5 ? '' : (veh.delay < 0 ? 'early' : 'delayed')}`}"><i>Hakee...</i></span>
                            `);
                        
                        let shownPath: Polyline | null = null;
                        let tripUpdateTimeout: any = null;
                        
                        const updateRouteInfo = (isInitial: boolean) => {
                            findRouteDetails(fuzzyHeadsign, parseInt(veh.direction as any), veh.tripDate, veh.tripTime, props.feed)
                                .then(trip => {
                                    
                                    // stupid hack for delay calculation
                                    // (Tampere had delay precalculated but Digitransit MQTT doesn't :c )
                                    if (vehRoute) {
                                        const getStopTime = (st: any) => new Date(st.serviceDay*1000 + st.realtimeDeparture*1000).getTime();
                                        const lastStops = trip.stoptimesForDate
                                            .filter((st: any) => getStopTime(st) <= Date.now())
                                            .toSorted((stA: any, stB: any) => {
                                                return getStopTime(stB) - getStopTime(stA);
                                            });
                                        const lastStop = lastStops[0];
                                        if (lastStop) {
                                            veh.delay = lastStop.realtimeDeparture*1000 - lastStop.scheduledDeparture*1000;
                                            popupBus.setContent(`
                                                <b><span class="headsign">${encodeHTML(headsign)}</span> ${encodeHTML(veh.destination || trip.tripHeadsign || vehRoute.longName)}</b> <br/>
                                                <span class="${`time ${Math.abs(veh.delay) < 0.5 ? '' : (veh.delay < 0 ? 'early' : 'delayed')}`}">${(Math.abs(veh.delay)/1000/60).toFixed(1)} min ${veh.delay < 0 ? 'etuajassa' : 'myöhässä'}</span>
                                            `);
                                        } else {
                                            veh.delay = 0;
                                            popupBus.setContent(`
                                                <b><span class="headsign">${encodeHTML(headsign)}</span> ${encodeHTML(veh.destination || trip.tripHeadsign || vehRoute.longName)}</b> <br/>
                                                <span class="time early"><i>Aikataulussa</i></span>
                                            `);
                                        }
                                    }
                                    
                                    setPopupBusLine(trip || null);
                                    
                                    // when first update:
                                    // - add path polyline
                                    // - dim other markers
                                    if (isInitial) {
                                        
                                        if (shownPath) {
                                            shownPath?.remove();
                                            shownPath = null;
                                        }
                                    
                                        if (!trip) {
                                            console.error(`fuzzy trip search failed for ${fuzzyHeadsign}`);
                                            return;
                                        }
                                        
                                        shownPath = L.polyline(trip.geometry.map(([lo, la]: [number, number]) => [la, lo]), {
                                            color: typeColors[vehRoute?.mode ?? ''] || '#20264d', //TRAM_HEADSIGNS.includes(headsign) ? ,
                                            weight: 10
                                        });
                                        shownPath.addTo(map);
                                        
                                        for (const m of stopMarkers.values()) {
                                            m.setOpacity(0.2);
                                        }
                                        
                                    }
                                    
                                    for (const stopTime of trip.stoptimesForDate) {
                                        
                                        const stopMarker = stopMarkers.get(stopTime.stop.gtfsId);
                                        if (!stopMarker) {
                                            continue;
                                        }
                                        
                                        const timeStopDeparture = (stopTime.serviceDay*1000 + stopTime.realtimeDeparture*1000);
                                        const isPassed = ((timeStopDeparture - Date.now())/1000/60) > 0;
                                        
                                        const tooltipContent = `<div class='x-map-stop-tooltip'>
                                            <b>${stopTime.stop.name}</b> <br/>
                                            ${((timeStopDeparture - Date.now())/1000/60).toFixed(0)} min
                                        </div>`;
                                        
                                        if (isInitial) {
                                            // initial update: create and bind tooltip
                                            stopMarker.setOpacity(1);
                                            if (isPassed) {
                                                stopMarker.bindTooltip(L.tooltip({
                                                    className: '',
                                                    permanent: true,
                                                    direction: 'center',
                                                    content: tooltipContent
                                                }));
                                            }
                                        } else {
                                            // non-initial update: update tooltip content
                                            if (isPassed) {
                                                stopMarker.getTooltip()?.setContent(tooltipContent);
                                            } else {
                                                if (stopMarker.getTooltip()) {
                                                    stopMarker.unbindTooltip();
                                                    stopMarker.getTooltip()?.remove();
                                                }
                                            }
                                        }
                                        
                                    }
                                    
                                })
                                .catch(err => {
                                    console.error(err);
                                })
                                .finally(() => {
                                    tripUpdateTimeout = setTimeout(() => updateRouteInfo(false), 1000*8);
                                })
                        }
                        
                        // initial route info fetch
                        updateRouteInfo(true);
                        
                        m.bindPopup(popupBus).openPopup();
                        
                        let isRemoved = false;
                        m.addEventListener('popupclose', () => {
                            
                            if (isRemoved) {
                                return;
                            }
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
                                tripUpdateTimeout = null;
                            }
                            
                            console.log('remove popup');
                            
                        });
                        
                    });
                    
                    if (ghostMarkers.get(vehInternalRef)) {
                        console.log(`vehicle ${vehInternalRef} is no longer a ghost!`);
                        ghostMarkers.get(vehInternalRef)?.remove();
                        ghostMarkers.delete(vehInternalRef);
                        ghostTrips.delete(vehInternalRef);
                    }
                    
                    m.addTo(map);
                    vehicleMarkers.set(vehInternalRef, m);
                    
                }
                
                const m = vehicleMarkers.get(vehInternalRef);
                m?.setLatLng(veh.location);
                m?.setRotationAngle(veh.bearing);
                    
                const markerText = m?.getElement()?.querySelector('.inner span');
                if (markerText && markerText instanceof HTMLElement) {
                    markerText.style.transform = `rotate(-${veh.bearing}deg)`;
                    markerText.textContent = `${headsign}`;
                }
                
            }
            
            for (const trip of supposedTrips) {
                
                const tzOffset = (new Date()).getTimezoneOffset() * 60000;
                const vehD = new Date(parseInt(trip.departureStoptime.serviceDay as any)*1000 + parseInt(trip.departureStoptime.scheduledDeparture as any)*1000 - tzOffset);
                const vehInternalRef = JSON.stringify([
                    trip.route.gtfsId.split(':').at(-1),
                    parseInt(trip.directionId as any),
                    vehD.toISOString().split('T')[0],
                    vehD.toISOString().split('T')[1].slice(0, -5),
                    props.feed
                ]);
                
                if (!vehicleMarkers.get(vehInternalRef)) {
                    
                    const vehRoute = allRoutes[trip.route.gtfsId];
                    const headsign = vehRoute?.shortName ?? '';
                    
                    if (shownRoutes && !(shownRoutes.includes(headsign) || shownRoutes.includes(trip.route.gtfsId.split(':')?.at(-1) ?? ''))) {
                        continue; // hidden route!
                    }
                    
                    if (trip.departureStoptime.realtime
                        && trip.departureStoptime.realtimeDeparture > trip.departureStoptime.scheduledDeparture) {
                        console.log(`"ghost" ${vehInternalRef} is just late, probably`);
                        continue;
                    }
                    
                    console.log(`ghost bus: ${vehInternalRef}`);
                    
                    if (!ghostMarkers.get(vehInternalRef)) {
                        
                        const m = L.marker(
                            [0, 0],
                            {
                                rotationAngle: 0,
                                rotationOrigin: 'center',
                                zIndexOffset: 100,
                                icon: ICON_GHOST,
                                //opacity: 0.5
                            }
                        );
                        m.addTo(map);
                        ghostMarkers.set(vehInternalRef, m);
                        
                        const markerText = m?.getElement()?.querySelector('.inner span');
                        const el = m?.getElement();
                        if (el) {
                            el.style.filter = 'grayscale(0.8)';
                        }
                        if (markerText && markerText instanceof HTMLElement) {
                            markerText.style.transform = `rotate(-${0}deg)`;
                            markerText.textContent = `${headsign}`;
                        }
                        
                        if (vehFetchCount > 1) {
                            lazyFindRouteDetails(
                                trip.route.gtfsId.split(':').at(-1) || '',
                                parseInt(trip.directionId as any),
                                vehD.toISOString().split('T')[0],
                                vehD.toISOString().split('T')[1].slice(0, -5),
                                props.feed
                            )
                                .then((trip: IGhostTrip) => {
                                    
                                    if (!ghostMarkers.has(vehInternalRef)) {
                                        console.log(`trip ${vehInternalRef} no longer a ghost? requested data will not be stored`);
                                        return;
                                    }
                                    
                                    console.log(`ghost trip for ${vehInternalRef}:`, trip);
                                    ghostTrips.set(vehInternalRef, trip);
                                    
                                    const lastStop = getGhostTripLastStop(trip);
                                    m.setLatLng(lastStop ? [lastStop.stop.lat, lastStop.stop.lon] : [0, 0]);
                                    
                                })
                                .catch(err => {})
                        }
                        
                    } else {
                        
                        const m = ghostMarkers.get(vehInternalRef);
                        
                        const markerText = m?.getElement()?.querySelector('.inner span');
                        const el = m?.getElement();
                        if (markerText && markerText instanceof HTMLElement) {
                            markerText.style.transform = `rotate(-${0}deg)`;
                            markerText.textContent = `${headsign}`;
                        }
                        
                        const trip = ghostTrips.get(vehInternalRef);
                        if (trip) {
                            const lastStop = getGhostTripLastStop(trip);
                            m?.setLatLng(lastStop ? [lastStop.stop.lat, lastStop.stop.lon] : [0, 0]);
                        }
                        
                    }
                    
                }
                
            }
            
            // remove markers of non-existing vehicles
            const currentVehicles = vehicles.map(veh => (veh as any).__id as string);
            const currentMarkers = [...vehicleMarkers.keys()];
            for (const key of currentMarkers) {
                if (!currentVehicles.includes(key)) {
                    vehicleMarkers.get(key)?.remove();
                    vehicleMarkers.delete(key);
                }
            }
            
            vehFetchCount++;
            if (callUpdate) {
                toUpdate = setTimeout(() => updateVehicleMarkers(), vehFetchCount == 1 ? 2000 : 4000)
            }
            
        }
        
        let toUpdate = setTimeout(() => updateVehicleMarkers(), 0);
        
        __map = map;
        __mapState = {
            filterLines: (ids: string[] | null, callUpdate: boolean = true) => {
                
                shownRoutes = ids
                    ? ids.map(i => i.split(':').slice(-1).join(''))
                    : null;
                
                if (callUpdate) {
                    clearTimeout(toUpdate);
                    toUpdate = setTimeout(() => updateVehicleMarkers(false), 0);
                }
                
            },
            jumpToGps: () => {
                map.flyTo(gpsLocation, 15, { animate: false });
            }
        };
        
        recalcMapHeight();
        
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
                height: `${mapContainerHeight.value}px`
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


