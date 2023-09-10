import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IMonitorSettings, IStopData } from '../app';
import StopsSelector from './StopsSelector';

export default function AppSettings(props: { settings: IMonitorSettings | null }) {
    
    const [selectedStops, setSelectedStops] = useState<IStopData[]>([]);
    const [inputRefreshInterval, setInputRefreshInterval] = useState<number>(10);
    
    useEffect(() => {
        
        if (props.settings) {
            setInputRefreshInterval(props.settings.interval);
        }
        
    }, []);
    
    return <div className='container mt-4'>
        <div className='row justify-content-center'>
            <div className='col-12 col-md-10 col-lg-6 col-xl-4'>
                
                <h3>🚍️ Nyssvääjä²</h3>
                <p className='mb-1'>
                    Tämä on helppo ja nopea työkalu minimalististen Nysse-aikataulu&shy;näyttöjen luomiseksi.
                    Emme vastaa tietojen oikeelli&shy;suudesta tai palvelun jatkuvasta saatavuudesta.
                </p>
                <p className='mb-0'>
                    Datan lähde: <a href='https://digitransit.fi/en/developers/' target='_blank'>Digitransit</a>.
                </p>
                
                <hr/>
                
                <h4>Pysäkit</h4>
                <StopsSelector onSelect={stops => {
                    setSelectedStops([...stops]);
                }} initialSelection={props.settings?.stops ?? []}/>
                
                <div className='mb-4'>
                    <label>Päivitystiheys (sekunteina)</label>
                    <input
                        type='number'
                        min='1'
                        max='1000'
                        step='1'
                        className='form-control form-control-sm'
                        value={inputRefreshInterval}
                        onInput={e => setInputRefreshInterval(parseInt(e.currentTarget.value))}
                        autoComplete='off'
                        />
                </div>
                
                <div className='text-center'>
                    <button className='btn btn-outline-warning'
                        onClick={e => {
                            e.preventDefault();
                            window.location.href = `/#${encodeURIComponent(JSON.stringify({
                                stops: selectedStops.map(st => st.gtfsId),
                                interval: inputRefreshInterval
                            }))}`;
                            window.location.reload();
                        }}
                        >
                        &raquo; {props.settings ? 'Päivitä' : 'Luo'} monitori
                    </button>
                </div>
                
                <hr/>
                
                <div className='text-center' style={{ fontSize: '80%' }}>
                    Forkkaa halutessasi <a href='https://github.com/lehtoroni/nyssvaaja'>Githubissa</a> &lt;3
                </div>
                
            </div>
        </div>
    </div>;
    
}
