import { Fragment, h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { IMonitorSettings, IStopRealtimeData } from '../app';
import { getStopData, getTimeString, getDueMinutes, getStopsData, RemixIcon } from '../util';

export const VEHICLE_ICON: Record<string, string> = {
    'BUS': '🚌',
    'TRAM': '🚋'
};

export default function Monitor(props: {
    stops: string[],
    interval: number,
    isEditing: boolean,
    onEdit: (n: number, command: 'delete' | 'up' | 'down') => any
}) {
    
    const { isEditing } = props;
    const [stopData, setStopData] = useState<Record<string, IStopRealtimeData>>({});
    
    function refresh() {
        (async () => {
            
            const stopsDataRaw = await getStopsData(props.stops);
            const stopsData = props.stops.map(stopId => [stopId, stopsDataRaw.data[stopId.replace(':', '_')]]);
            
            setStopData(Object.fromEntries(stopsData));
            
        })()
            .catch(err => {
                console.error(err);
            })
    }
    
    useEffect(() => {
        
        const iv = setInterval(refresh, props.interval*1000);
        const t = setTimeout(refresh, 1);
        
        return () => {
            clearInterval(iv);
            clearTimeout(t);
        };
        
    }, [props.stops]);
    
    return <div className='container pl-3 my-3' style={{ maxWidth: '1000px' }}>
        <div className='row'>
            {props.stops.map((stopId, i) => <div
                className={`col-12 col-md-6 col-lg-5 col-xl-4` + (isEditing ? ' nyssvaaja-editing-stop-group' : '')}
                key={`${stopId}`}
                >
                {isEditing && <div className='tools'>
                    <button className='x-btn'
                        onClick={e => {
                            e.preventDefault();
                            props.onEdit(i, 'down');
                        }}
                        >
                        <RemixIcon icon='ri-arrow-down-line'/>
                    </button>
                    <button className='x-btn'
                        onClick={e => {
                            e.preventDefault();
                            props.onEdit(i, 'up');
                        }}
                        >
                        <RemixIcon icon='ri-arrow-up-line'/>
                    </button>
                    <button className='x-btn'
                        onClick={e => {
                            e.preventDefault();
                            if (confirm(`Poista "${stopId}" ?`)) {
                                props.onEdit(i, 'delete');
                            }
                        }}
                        >
                        <RemixIcon icon='ri-delete-bin-6-line'/>
                    </button>
                </div>}
                {stopData[stopId]
                    ? <NysseStop data={stopData[stopId]} isEditing={isEditing}/>
                    : <div className='text-center my-4'>
                        <div className='nyssvaaja-spinner'>🚍️</div>
                    </div>}
            </div>)}
        </div>
    </div>;
}

export function SingleNysseStop(props: { stopId: string }) {
    
    const [stopData, setStopData] = useState<IStopRealtimeData[]>();
    
    function refresh() {
        (async () => {
            
            const stopsDataRaw = await getStopsData([props.stopId]);
            const stopsData = [props.stopId].map(stopId => stopsDataRaw.data[stopId.replace(':', '_')])
            
            setStopData(stopsData);
            
        })()
            .catch(err => {
                console.error(err);
            })
    }
    
    useEffect(() => {
        
        const iv = setInterval(refresh, 5*1000);
        const t = setTimeout(refresh, 1);
        
        return () => {
            clearInterval(iv);
            clearTimeout(t);
        };
        
    }, []);
    
    return <Fragment>
        {stopData?.map((st, i) =>
            <NysseStop key={`${st.gtfsId}_${i}`} data={st} isEditing={false}/>
        )}
    </Fragment>;
    
}

export function NysseStop(props: { data: IStopRealtimeData, showInitial?: number, isEditing: boolean }) {
    
    const showInitial = props.showInitial ?? 5;
    const canBeExpanded = props.data.stoptimesWithoutPatterns.length > showInitial;
    const [isExpanded, setExpanded] = useState<boolean>(false);
    
    return <div className='nyssvaaja-stop-monitor-wrapper'>
        <div className='x-stop-monitor' data-vehicle-mode={(props.data.vehicleMode ?? '').toUpperCase()}>
            <h3>
                <span className='d-inline-block align-middle'>{props.data.name}</span>
                <span className='x-stop-id'>{props.data.gtfsId.split(':')[1]}</span>
            </h3>
            {!props.isEditing && <Fragment>
                {(props.data.alerts ?? [])
                    .filter((al, i) => al.effectiveEndDate*1000 >= Date.now() )
                    .map((al, i) =>
                        <div className='alert alert-danger p-2'>
                            <p className='mb-1'>🚨 <b>{al.alertHeaderText}</b></p>
                            <span style={{ fontSize: '90%', lineHeight: '110%', display: 'inline-block' }}>{al.alertDescriptionText}</span>
                        </div>
                    )}
                <table className='x-table'>
                    <thead>
                        <tr>
                            <td>{VEHICLE_ICON[props.data.vehicleMode ?? '']}</td>
                            <td>📍</td>
                            <td className='text-end'>⌚️</td>
                            <td className='text-end'>⏳️</td>
                        </tr>
                        <tr className='x-divider'><td colSpan={4}><hr/></td></tr>
                    </thead>
                    <tbody>
                        {props.data.stoptimesWithoutPatterns
                            .filter((t, n) => isExpanded || (n < showInitial))
                            .map(stopTime => 
                                <Fragment>
                                    <tr>
                                        <td style={{ width: '3em;' }}><span className='x-headsign'>{stopTime.trip?.route?.shortName ?? '?'}</span></td>
                                        <td>
                                            {stopTime.headsign ?? '?'}
                                            {(stopTime.trip?.alerts ?? []).length > 0
                                                && <span className='ms-2' onClick={e => {
                                                    e.preventDefault();
                                                    alert(`${(stopTime.trip?.alerts ?? []).map(al => `${al.alertHeaderText}\n\n${al.alertDescriptionText}\n\n---`).join('\n\n')}`);
                                                }}>⚠️</span>}
                                        </td>
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
                    </tbody>
                </table>
                {canBeExpanded && <div className='text-center'
                    onClick={e => {
                        e.preventDefault();
                        setExpanded(ex => !ex);
                    }}
                    >
                    <button className='x-show-more-button'>
                        <RemixIcon icon={isExpanded ? 'ri-eye-off-line' : 'ri-add-circle-line'}/>
                        <span>{isExpanded ? ' Piilota' : ' Enemmän'}</span>
                    </button>
                </div>}
            </Fragment>}
        </div>
    </div>
}
