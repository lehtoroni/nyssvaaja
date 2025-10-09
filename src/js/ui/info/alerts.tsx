import { Fragment, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IAlert, IGenericAlertEntity } from 'src/js/app';

export default function NysseAlerts(props: { feed: string }) {
    
    const [alerts, setAlerts] = useState<IAlert[]>([]);
    
    useEffect(() => {
        
        function upd() {
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
        
        <h1 className='text-center'>⚠️ Häiriötiedotteet</h1>
        
        <p className='text-center'>
            Huom! Tämä on kokeellinen ominaisuus. Tarkista oikeat tiedot aina Nyssen virallisesta reittioppaasta.
        </p>
        
        <hr/>
        
        {alerts.map((al, i) =>
            <div className='alert alert-danger'
                key={al.id}
                >
                <h4>{al.alertHeaderText}</h4>
                <p>{al.alertDescriptionText}</p>
                <p><b>{new Date(al.effectiveStartDate*1000).toLocaleString('fi')}</b> – <b>{new Date(al.effectiveEndDate*1000).toLocaleString('fi')}</b></p>
                <p>{(al.entities ?? []).map((en, i) =>
                    <AlertEntityDisplay entity={en} key={en.__typename + '' + i}/>
                )}</p>
            </div>
        )}
        
    </div>;
    
}

export function AlertEntityDisplay(props: {
    entity: IGenericAlertEntity
}) {
    const {entity} = props;
    return <span className='badge text-bg-danger me-1'>
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
