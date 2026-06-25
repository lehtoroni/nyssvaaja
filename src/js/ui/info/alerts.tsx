import { Fragment, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IAlert, IGenericAlertEntity } from 'src/js/app';

type ICanceledTrip = {
    serviceDate: string,
    trip: {
        gtfsId: string,
        routeShortName: string,
        tripHeadsign: string
    },
    start: {
        stopLocation: { name: string },
        schedule: { time: { departure: string } }
    }
};

const ALERT_SEVERITY: Record<string, string> = {
    INFO: 'info',
    SEVERE: 'danger',
    UNKNOWN_SEVERITY: 'secondary',
    WARNING: 'warning'
};

export default function NysseAlerts(props: { feed: string }) {
    
    const [alerts, setAlerts] = useState<IAlert[]>([]);
    const [canceled, setCanceled] = useState<ICanceledTrip[]>([]);
    
    useEffect(() => {
        
        function upd() {
            
            fetch(`/api/getCanceledTrips?t=${Date.now()}`)
                .then(y => y.json())
                .then(canceledRaw => {
                    setCanceled((canceledRaw?.data?.canceledTrips?.edges ?? []).map((n: any) => n.node as ICanceledTrip).filter((can: ICanceledTrip) => can.trip.gtfsId.startsWith('tampere:')));
                });
            
            fetch(`/api/getAlerts`)
                .then(x => x.json())
                .then(raw => {
                    
                    const alertsRaw: IAlert[] = raw?.data?.alerts ?? [];
                    setAlerts(alertsRaw);
                    
                })
                .catch(err => {
                    console.error(err);
                })
                
            to = setTimeout(() => upd(), 1000*10);
            
        }
        
        let to = setTimeout(() => upd(), 1);
        
        return () => {
            clearTimeout(to);
        }
        
    }, []);
    
    return <div className='p-3'>
        
        <h1 className='text-center'>⚠️ Häiriötiedotteet ja perutut</h1>
        
        <p className='text-center'>
            Huom! Tämä on kokeellinen ominaisuus. Tarkista oikeat tiedot aina Nyssen virallisesta reittioppaasta.
        </p>
                
        <hr/>
    
        <h2>Perutut vuorot</h2>
        {canceled.length == 0 && <Fragment>
            <p><i>Ei tiedossa olevia peruttuja vuoroja.</i></p>
        </Fragment>}
        {canceled.length > 0 && <Fragment>
            <p>Huom! Tarkista tietojen oikeellisuus virallisista lähteistä.</p>
        </Fragment>}
        {canceled
            .map((can, i) =>
                <div className='alert alert-danger mb-2'>
                    🚫 <b>Peruttu:</b> Linja {can.trip.routeShortName} {can.trip.tripHeadsign}, lähtöaika {new Date(can.start.schedule.time.departure).toLocaleString('fi')}, lähtöpysäkki {can.start.stopLocation.name}.
                </div>
            )}
        
        <hr/>
        
        
        
        <h2>Häiriötiedotteet</h2>
        {alerts.map((al, i) =>
            <div className={`alert alert-${ALERT_SEVERITY[al.alertSeverityLevel] || 'warning'}`}
                key={al.id}
                >
                <h4>{al.alertHeaderText}</h4>
                <p>{al.alertDescriptionText}</p>
                <p><b>{new Date(al.effectiveStartDate*1000).toLocaleString('fi')}</b> – <b>{new Date(al.effectiveEndDate*1000).toLocaleString('fi')}</b></p>
                <p className='mb-0'>{(al.entities ?? []).map((en, i) =>
                    <AlertEntityDisplay entity={en} color={ALERT_SEVERITY[al.alertSeverityLevel] || 'warning'} key={en.__typename + '' + i}/>
                )}</p>
            </div>
        )}
        
    </div>;
    
}

export function AlertEntityDisplay(props: {
    entity: IGenericAlertEntity,
    color: string
}) {
    const {entity} = props;
    return <span className={`badge text-bg-${props.color} me-1`}>
        {entity.__typename == 'Route' && <Fragment>
            🚍️ {entity.shortName} {entity.longName}
        </Fragment>}
        {entity.__typename == 'Stop' && <Fragment>
            🚏 {entity.code} {entity.name}
        </Fragment>}
        {entity.__typename == 'Trip' && <Fragment>
            🚌 {entity.routeShortName} {entity.gtfsId}
        </Fragment>}
        {entity.__typename == 'StopOnRoute' && <Fragment>
            Pysäkki {entity.stop.gtfsId} reitillä {entity.route.gtfsId} 
        </Fragment>}
        {entity.__typename == 'StopOnTrip' && <Fragment>
            Pysäkki {entity.stop.gtfsId} matkalla {entity.trip.gtfsId} 
        </Fragment>}
        {entity.__typename == 'Agency' && <Fragment>
            Matkanjärjestäjä {entity.gtfsId}
        </Fragment>}
        {entity.__typename == 'Pattern' && <Fragment>
            Linja {entity.headsign}
        </Fragment>}
        {entity.__typename == 'RouteType' && <Fragment>
            Kulkuväline {entity.routeType}
        </Fragment>}
        {entity.__typename == 'Unknown' && <Fragment>
            ?
        </Fragment>}
    </span>;
}
