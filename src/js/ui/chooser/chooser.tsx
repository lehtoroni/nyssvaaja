import { Fragment, h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { IStopData } from 'src/js/app';
import { getAllStops, RemixIcon } from 'src/js/util';
import StopSelectorMap from './stopsmap';

export default function StopChooser(props: {
    onChoose: (stops: string[]) => any,
    chosen: string[]
}) {
    
    const [allStops, setAllStops] = useState<IStopData[]>([]);
    const allStopsById = useMemo<Record<string, IStopData>>(() => Object.fromEntries(
        allStops.map(st => [st.gtfsId, st])
    ), [allStops]);
    
    const [error, setError] = useState<string | null>(null);
    
    const [selectedStops, setSelectedStops] = useState<string[]>(props.chosen);
    const [isMapMode, setMapMode] = useState<boolean>(false);
    
    useEffect(() => {
        getAllStops()
            .then(stopData => {
                
                const rawData: IStopData[] = [...stopData.data.stops].filter(sd => !!sd.vehicleMode);
                rawData.sort((a, b) => (a.vehicleMode ?? '').toLowerCase().localeCompare((b.vehicleMode ?? '').toLowerCase()) || a.name.localeCompare(b.name));
                
                setAllStops(rawData);
                
            })
            .catch(err => {
                setError(`Pysäkkejä ei voida hakea: ${err}`);
            })
    }, []);
    
    if (allStops.length == 0) {
        <div
            className='nyssvaaja-floating-chooser'
            >
            
            <h2 className='text-center'>Valitse pysäkkejä</h2>
            
            <div className='text-center my-4'>
                <div className='nyssvaaja-spinner'>🚍️</div>
            </div>
            
        </div>
    }
    
    return <div
        className='nyssvaaja-floating-chooser'
        >
        
        <div className='d-flex justify-content-between mb-3'>
            <h3 className='text-center'>Valitse pysäkkejä</h3>
            <button className='btn btn-sm btn-success'
                onClick={e => {
                    e.preventDefault();
                    props.onChoose(selectedStops);
                }}
                >
                <RemixIcon icon='ri-save-line'/> {' '}
                Valmis
            </button>
        </div>
        
        <div className='nyssvaaja-button-pill'>
            <button
                className='x-btn'
                onClick={e => {
                    e.preventDefault();
                    setMapMode(m => !m);
                }}
                data-active={`${!isMapMode}`}
                >
                <RemixIcon icon='ri-list-view'/>  Lista
            </button>
            <button
                className='x-btn'
                data-active={`${isMapMode}`}
                onClick={e => {
                    e.preventDefault();
                    setMapMode(m => !m);
                }}
                >
                <RemixIcon icon='ri-map-pin-line'/> Kartta
            </button>
        </div>
        
        <div className='list-selected-stops my-2'>
            <div className='list'>
                {selectedStops.length == 0 &&
                    <p className='text-center my-4 fst-italic text-secondary'>Ei valittuja pysäkkejä</p>}
                {selectedStops
                    .map(stopId => allStopsById[stopId] || null)
                    .filter(st => !!st)
                    .map(st =>
                        <div
                            key={st.gtfsId}
                            className='list-stop'
                            onClick={e => {
                                e.preventDefault();
                            }}
                            >
                            <span>{st.code}</span>
                            {st.name}
                            <span className='trash d-inline-block ms-auto'
                                onClick={e => {
                                    e.preventDefault();
                                    setSelectedStops(old => old.filter(id => id != st.gtfsId));
                                }}
                                >❌</span>
                        </div>
                    )}
            </div>
        </div>
        
        {!isMapMode && <Fragment>
            <StopsListSelector
                all={allStops}
                selected={selectedStops}
                onPick={stopId => {
                    setSelectedStops(old => old.includes(stopId)
                        ? old.filter(id => id != stopId)
                        : [...old, stopId]);
                }}
                />
        </Fragment>}
        
        {isMapMode && <StopSelectorMap
            selected={selectedStops}
            onPick={stopId => {
                setSelectedStops(old => old.includes(stopId)
                    ? old.filter(id => id != stopId)
                    : [...old, stopId]);
            }}
            />}
        
    </div>;
    
}

function StopsListSelector(props: {
    all: IStopData[],
    onPick: (stopId: string) => any,
    selected: string[]
}) {
    
    const [searchText, setSearchText] = useState<string>('');
    const [delayedSearch, setDelayedSearch] = useState<string>('');
    
    useEffect(() => {
        
        const to = setTimeout(() => {
            setDelayedSearch(searchText);
        }, 600);
        
        return () => {
            clearTimeout(to);
        }
        
    }, [searchText]);
    
    return <div className='stop-list-selector'>
        
        <div className='search mb-2'>
            <input
                className='form-control'
                value={searchText}
                onInput={e => setSearchText(`${e.currentTarget.value}`.toLowerCase())}
                placeholder='Etsi pysäkkejä...'
                />
        </div>
        
        <div className='list'>
            {props.all
                .filter(st => delayedSearch == '' || `${st.gtfsId} ${st.name}`.toLowerCase().includes(delayedSearch))
                .map(st =>
                    <div
                        key={st.gtfsId}
                        className='list-stop'
                        data-selected={`${props.selected.includes(st.gtfsId)}`}
                        onClick={e => {
                            e.preventDefault();
                            props.onPick(st.gtfsId);
                        }}
                        >
                        <span>{st.code}</span>
                        {st.name}
                    </div>
                )}
        </div>
        
        <div></div>
        
    </div>;
    
}
