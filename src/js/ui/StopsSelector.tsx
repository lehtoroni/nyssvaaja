import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';

import { IStopData, Spinner } from '../app';
import { getAllStops } from '../util';

export const VEHICLE_ICON = {
    'BUS': `🚌`,
    'TRAM': `🚃`,
    '': ''
} as { [key: string]: string };

export default function StopsSelector(props: { onSelect: (stops: IStopData[]) => any, initialSelection: string[] }) {
    
    const [stops, setStops] = useState<IStopData[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    const [searchText, setSearchText] = useState<string>('');
    const [stopsSearch, setStopsSearch] = useState<IStopData[]>([]);
    
    const [selectedStops, setSelectedStops] = useState<IStopData[]>([]);
    
    const refInput = useRef<HTMLInputElement>(null);
    const [isFocusedSearch, setFocusedSearch] = useState<boolean>(false);
    
    useEffect(() => {
        getAllStops()
            .then(stopData => {
                
                const rawData: IStopData[] = [...stopData.data.stops].filter(sd => !!sd.vehicleMode);
                rawData.sort((a, b) => (a.vehicleMode ?? '').toLowerCase().localeCompare((b.vehicleMode ?? '').toLowerCase()) || a.name.localeCompare(b.name));
                
                setStops(rawData);
                setStopsSearch([...rawData]);
                
                if (props.initialSelection) {
                    setSelectedStops([...rawData.filter(st => props.initialSelection.includes(st.gtfsId))]);
                }
                
            })
            .catch(err => {
                setError(`Pysäkkejä ei voida hakea: ${err}`);
            })
    }, []);
    
    useEffect(() => {
        
        if (stops.length == 0) {
            return;
        }
        
        const iv = setTimeout(() => {
            
            const searchTerms = searchText.toLowerCase();
            
            setStopsSearch([...stops
                .filter(st => st.name.toLowerCase().indexOf(searchTerms) > -1
                    || st.code.indexOf(searchTerms) > -1)]);
            
        }, 200);
        
        return () => {
            clearTimeout(iv);
        }
        
    }, [searchText, stops]);
    
    useEffect(() => {
        props.onSelect(selectedStops);
    }, [selectedStops]);
    
    if ((!stops || stops.length == 0) && !error) {
        return <div className='text-center p-4 mb-3'>
            <Spinner/>
            <p className='mb-0'>Haetaan...</p>
        </div>;
    }
    
    return <div className='mb-3'>
        
        <div className='mb-2'>
            {selectedStops.length == 0
                ? <p className='mb-2'><i>Ei valittuja pysäkkejä</i></p>
                : selectedStops.map((st, i) => 
                    <div key={`${st.code}_${i}`}
                        className='x-selected-stop'
                        onClick={e => {
                            e.preventDefault();
                            setSelectedStops(selectedStops.filter(stop => stop != st));
                        }}
                        >
                        <div>{st.name}</div>
                        <div>{st.code}</div>
                        <div className='cross'></div>
                    </div>
                )}
        </div>
        
        <input
            type='text'
            className='form-control form-control-sm'
            value={searchText}
            onInput={e => setSearchText(e.currentTarget.value)}
            spellCheck={false}
            autoComplete='off'
            ref={refInput}
            placeholder='Hae pysäkkejä...'
            style={{
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0'
            }}
            />
        
        <div className='x-floating-select'>
            {stopsSearch.map((st, i) =>
                <div key={`${st.gtfsId}_${i}`}
                    className='x-search-item d-flex justify-content-between'
                    data-vehicle-type={st.vehicleMode}
                    data-selected={`${selectedStops.indexOf(st) != -1}`}
                    onClick={e => {
                        e.preventDefault();
                        refInput.current?.focus();
                        if (selectedStops.indexOf(st) == -1) {
                            setSelectedStops([...selectedStops, st]);
                        }
                    }}
                    >
                    <div><span style={{ marginRight: '8px' }}>{VEHICLE_ICON[st.vehicleMode ?? '?']}</span>{st.name}</div>
                    <div>
                        <code>{st.code}</code>
                    </div>
                </div>
            )}
        </div>
        
    </div>;
    
};

