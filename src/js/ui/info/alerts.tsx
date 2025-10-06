import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export type IGenericAlertEntity = 
    { __typename: 'Stop', gtfsId: string, name: string, code: string }
    | { __typename: 'Route', gtfsId: string, shortName: string, longName: string }
    | { __typename: 'StopOnRoute', route: { gtfsId: string }, stop: { gtfsId: string } }
    | { __typename: 'StopOnTrip', trip: { gtfsId: string }, stop: { gtfsId: string } }
    | { __typename: 'Agency', gtfsId: string }
    | { __typename: 'Pattern', headsign: string }
    | { __typename: 'RouteType', routeType: string }
    | { __typename: 'Trip', gtfsId: string, tripShortName: string, routeShortName: string }
    | { __typename: 'Unknown' | string };

export type IGenericAlert = {
    id: string,
    effectiveStartDate: number,
    effectiveEndDate: number,
    alertDescriptionText: string,
    alertHeaderText: string,
    alertSeverityLevel: string,
    entities: IGenericAlertEntity[]
};

export default function NysseAlerts(props: { feed: string }) {
    
    const [alerts, setAlerts] = useState<IGenericAlert[]>([]);
    
    useEffect(() => {
        
        function upd() {
            fetch(`/api/getAlerts`)
                .then(x => x.json())
                .then(raw => {
                    
                    const alertsRaw: IGenericAlert[] = raw?.data?.alerts ?? [];
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
            Huom! Tämä toiminto on vasta <u>kokeiluvaiheessa</u>.
            Varmista oikeat tiedot aina Nyssen virallisesta reittioppaasta.
        </p>
        
        <hr/>
        
        {alerts.map((al, i) =>
            <div className='alert alert-danger'
                key={al.id}
                >
                <h4>{al.alertHeaderText}</h4>
                <p>{al.alertDescriptionText}</p>
                <p><b>{new Date(al.effectiveStartDate*1000).toLocaleString('fi')}</b> – <b>{new Date(al.effectiveEndDate*1000).toLocaleString('fi')}</b></p>
                <details>
                    <summary>Lisätietoja (nörteille)</summary>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(al.entities, null, 2)}</div>
                </details>
            </div>
        )}
        
    </div>;
    
}
