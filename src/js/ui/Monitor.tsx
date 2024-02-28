import { Fragment, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { IMonitorSettings, IStopRealtimeData } from '../app';
import { getStopData, getTimeString, getDueMinutes, getStopsData } from '../util';
import { VEHICLE_ICON } from './StopsSelector';
import NysseMap from './NysseMap';

export default function Monitor(props: { settings: IMonitorSettings }) {
    
    const [stopData, setStopData] = useState<IStopRealtimeData[]>();
    const [isMapVisible, setMapVisible] = useState<boolean>(false);
    
    function refresh() {
        (async () => {
            
            const stopsDataRaw = await getStopsData(props.settings.stops);
            const stopsData = props.settings.stops.map(stopId => stopsDataRaw.data[stopId.replace(':', '_')])
            
            setStopData(stopsData);
            
        })()
            .catch(err => {
                console.error(err);
            })
    }
    
    useEffect(() => {
        
        const iv = setInterval(refresh, props.settings.interval*1000);
        const t = setTimeout(refresh, 1);
        
        return () => {
            clearInterval(iv);
            clearTimeout(t);
        };
        
    }, []);
    
    return <div className='container pl-3 my-3' style={{ maxWidth: '1000px' }}>
        <div className='row'>
            {stopData?.map((st, i) =>
                <NysseStop key={`${st.gtfsId}_${i}`} data={st}/>
            )}
        </div>
        {isMapVisible
            ? <NysseMap settings={props.settings}/>
            : ''}
        <div className='x-floating-edit-button'>
            <div 
                onClick={e => {
                    e.preventDefault();
                    setMapVisible(v => !v);
                }}>
                🗺️
            </div>
            <div 
                onClick={e => {
                    e.preventDefault();
                    window.location.href = `/#${encodeURIComponent(JSON.stringify({
                        ...props.settings,
                        edit: true
                    }))}`;
                }}>
                ⚙️
            </div>
        </div>
    </div>;
}

export function NysseStop(props: { data: IStopRealtimeData }) {
    return <div className='col-12 col-md-6 col-lg-5 col-xl-4 mb-3'>
        <div className='x-stop-monitor' data-vehicle-mode={(props.data.vehicleMode ?? '').toUpperCase()}>
            <h3>
                <span className='d-inline-block align-middle'>{props.data.name}</span>
                <span className='x-stop-id'>{props.data.gtfsId.split(':')[1]}</span>
            </h3>
            <table className='x-table'>
                <tr>
                    <td>{VEHICLE_ICON[props.data.vehicleMode ?? '']}</td>
                    <td>📍</td>
                    <td className='text-end'>⌚️</td>
                    <td className='text-end'>⏳️</td>
                </tr>
                <tr className='x-divider'><td colSpan={4}><hr/></td></tr>
                {props.data.stoptimesWithoutPatterns.map(stopTime => 
                    <Fragment>
                        <tr>
                            <td style={{ width: '3em;' }}>{stopTime.trip?.route?.shortName ?? '?'}</td>
                            <td>{stopTime.headsign ?? '?'}</td>
                            <td className='text-end' style={{ width: '4em' }}>
                                <b>{getTimeString(stopTime)}</b>
                            </td>
                            <td className='text-end' style={{ width: '2em' }}>
                                <b>{getDueMinutes(stopTime)}</b>
                            </td>
                        </tr>
                        <tr className='x-divider'><td colSpan={4}><hr/></td></tr>
                    </Fragment>
                )}
            </table>
        </div>
    </div>
}
