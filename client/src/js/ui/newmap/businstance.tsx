import { h } from 'preact';
import { Fragment, useState } from 'react';
import { calculateTripLengthKm, getDueMinutes, RemixIcon } from '../../util';


export function BusInstanceMonitor(props: {
    trip?: any | null,
    stop?: any | null
}) {
    
    if (!props.trip && !props.stop) {
        return '';
    }
    
    const isMobile = window.innerWidth < 600;
    const [isOpen, setOpen] = useState<boolean>(false);
    
    console.log(props.trip);
    
    const getStopTime = (st: any) => new Date(st.serviceDay*1000 + st.realtimeDeparture*1000).getTime();
    const lastStops = props.trip.stoptimesForDate
        .filter((st: any) => getStopTime(st) <= Date.now())
        .toSorted((stA: any, stB: any) => {
            return getStopTime(stB) - getStopTime(stA);
        });
    const lastStop = lastStops[0];
    let vehDelay: number = 0;
    let vehDeparted = false;
    if (lastStop) {
        vehDelay = lastStop.realtimeDeparture*1000 - lastStop.scheduledDeparture*1000;
        vehDeparted = true;
    } else {
        vehDelay = 0;
        vehDeparted = false;
    }
    
    const vehDelaySeconds = Math.round(Math.abs(vehDelay)/1000);
    
    return <aside className='x-floating-details' data-open={`${isOpen}`}>
        <div className='p-3 py-2'>
            
            <div className='row align-items-center'
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                    e.preventDefault();
                    setOpen(o => !o);
                }}
                >
                <div className='col-10'>
                    <h3><span class="headsign">{props.trip.routeShortName}</span> {props.trip.tripHeadsign}</h3>
                </div>
                <div className='col-2'>
                    {isMobile && <div className='x-mobile-handle'
                        >
                        <div className='handle'>
                            <RemixIcon icon={isOpen ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'}/>
                        </div>
                    </div>}
                </div>
            </div>
            
            
            <p className='mb-1'>
                <RemixIcon icon='ri-calendar-schedule-line'/> {' '}
                Lähtö {' '}
                {new Date(props.trip.stoptimesForDate[0].serviceDay*1000 + props.trip.stoptimesForDate[0].scheduledDeparture*1000).toLocaleString('fi')}.
            </p>
            
            <p className='mb-1'>
                <RemixIcon icon='ri-map-pin-time-line'/> {' '}
                {vehDeparted && <Fragment>
                    <b className={vehDelay > 0 ? 'text-danger' : 'text-success'}>{Math.floor(vehDelaySeconds/60)} min {vehDelaySeconds % 60} s {vehDelay < 0 ? 'edellä' : 'myöhässä'}</b>
                </Fragment>} 
            </p>
            
            <p className='mb-2'>
                <RemixIcon icon='ri-route-line'/> {' '}
                {calculateTripLengthKm(props.trip.geometry).toFixed(1)} km 
            </p>
            
            <div className='x-trip-stops'>
                {props.trip.stoptimesForDate.map((st: any, i: number) => {
                        
                        const isPast = new Date(st.serviceDay*1000 + (st.realtimeDeparture || st.scheduledDeparture)*1000).getTime() < Date.now()
                        
                        const isRealtime = st.realtime; //|| !(!st.realtimeDeparture || st.realtimeDeparture == st.scheduledDeparture);
                        
                        const stopTimeFi = new Date(st.serviceDay*1000 + (st.realtimeDeparture || st.scheduledDeparture)*1000).toLocaleTimeString('fi').replace(/\./gmi, ':').split(':').slice(0, 2).join(':');
                        
                        return <div className='trip-row' data-past={`${isPast}`} key={`${i}_${st.stop.gtfsId}`}>
                            <div className='stop'>
                                <div className='road' style={{
                                    opacity: i > 0 ? 1 : 0
                                }}></div>
                                <div className='icon'>{st.stop.zoneId}</div>
                                <div className='road' style={{
                                    opacity: i < props.trip.stoptimesForDate.length-1 ? 1 : 0
                                }}></div>
                            </div>
                            <div className='content'>
                                <p className='mb-0'>
                                    <b>{st.stop.name}</b> {' '}
                                    {st.timepoint && <span title='Aikataulun tasaus'>⌚️</span>}
                                    {st.pickupType == 'NONE' && <span title='Ei nousua'>⛔️</span>}
                                </p>
                                <p className='mb-0 smaller'>
                                    <span className='id'>{st.stop.gtfsId}</span>
                                </p>
                            </div>
                            <div className='time' data-realtime={`${isRealtime}`}>
                                <p className='mb-0'>
                                    {isPast && <Fragment>{stopTimeFi}</Fragment>}
                                    {!isPast && <Fragment>
                                        <span className='mins'>{getDueMinutes(st)} min</span><br/>
                                        <span className='rawtime'>~{stopTimeFi}</span>
                                    </Fragment>}
                                </p>
                            </div>
                        </div>
                    }
                )}
            </div>
            
            <hr/>
            <p><b>Merkkien selitykset</b></p>
            <p>
                ⌚️ = Aikataulun tasaus, ei lähde ennen aikataulun mukaista aikaa
            </p>
            <p>
                ⛔️ = Ei nousua, bussi ei ota matkustajia kyytiin (esim. linjan tai suunnan vaihtuessa)
            </p>
            
        </div>
    </aside>;
    
}