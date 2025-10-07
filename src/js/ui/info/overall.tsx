import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IRealtimeVehicle } from '../newmap/map';
import { RemixIcon } from '../../util';

export default function NysseOverallSituation(props: { feed: string }) {
    
    const [vehicles, setVehicles] = useState<IRealtimeVehicle[]>([]);
    const [mode, setMode] = useState<'time' | 'number'>('time');
    
    useEffect(() => {
        
        async function upd() {
            
            const x = await fetch(`/api/realtime?t=${Date.now()}`);
            const vehiclesRaw: IRealtimeVehicle[] = (await x.json());
            
            setVehicles(mode == 'time'
                ? vehiclesRaw.toSorted((a, b) => b.delay - a.delay)
                : vehiclesRaw.toSorted((a, b) => 
                    (Number(`${a.headsign}`.replace(/[^0-9]/gmi, '')) - Number(`${b.headsign}`.replace(/[^0-9]/gmi, '')))
                    || (a.origin.localeCompare(b.origin))
                    || (a.tripTime.localeCompare(b.tripTime))
                )
            );
            to = setTimeout(() => upd(), 1000*10);
            
        }
        
        let to = setTimeout(() => upd(), 1);
        
        return () => {
            clearTimeout(to);
        }
        
    }, [mode]);
    
    return <div className='p-3'>
        
        <h1 className='text-center'>🕰️ Yleistilanne</h1>
        
        <p className='text-center'>
            Tässä näet kaikki reaaliaikaisen seurannan tuntemat kulkuvälineet ja niiden aikataulutilanteen.
            Huomaathan, että tämä toiminto on kokeellinen. Varmista oikeat tiedot aina Nyssen reittioppaasta.
        </p>
        
        <hr/>
    
        <div className='nyssvaaja-button-pill mb-4'>
            <button
                className='x-btn'
                onClick={e => {
                    e.preventDefault();
                    setMode('time');
                }}
                data-active={`${mode == 'time'}`}
                >
                <RemixIcon icon='ri-sort-asc'/>  Aikataulujärjestys
            </button>
            <button
                className='x-btn'
                data-active={`${mode == 'number'}`}
                onClick={e => {
                    e.preventDefault();
                    setMode('number');
                }}
                >
                <RemixIcon icon='ri-sort-number-asc'/> Kilpijärjestys
            </button>
        </div>
        
        <table className='table table-sm table-dark'>
            <thead>
                <tr>
                    <th colspan={2}>Linja</th>
                    <th>Tilanne</th>
                </tr>
            </thead>
            <tbody>
                {vehicles.map((veh, i) =>
                    <tr key={veh.vehicleRef}>
                        <td className='align-top' style={{ marginBottom: '16px' }}>
                            <span className='x-display-headsign'>
                                {veh.headsign}
                            </span>
                        </td>
                        <td className='align-top'>
                            {veh.destination} <br/>
                            <small>{veh.origin} &rarr; {veh.tripTime}</small>
                        </td>
                        <td className='align-top'>
                            <span className={(() => {
                                if (veh.delay > 1000*60*5) {
                                    return 'badge text-bg-danger';
                                } else if (veh.delay > 1000*60*3) {
                                    return 'badge text-bg-warning';
                                } else if (veh.delay < -1000*60*5) {
                                    return 'badge text-bg-light';
                                } else if (veh.delay < -1000*60*3) {
                                    return 'badge text-bg-info';
                                } else if (Math.abs(veh.delay) < 1000*30) {
                                    return 'badge text-bg-success';
                                }
                                return 'badge text-bg-secondary';
                            })()}>
                                {(veh.delay / 1000 / 60).toFixed(1)} min {veh.delay > 0 ? ' myöhässä' : ' etuajassa'}
                            </span>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
        
    </div>;
    
}
