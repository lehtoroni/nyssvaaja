import { useSignal } from '@preact/signals'
import { h } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { getAllRoutes, IGenericRoute, RemixIcon } from 'src/js/util';

export function LinePicker(props: {
    initialSelection?: string[] | null,
    onSelectLines: (lines: string[] | null) => any,
    shownLines?: string[],
    feed: string
}) {
    
    const [selectedRoutes, setSelectedRoutes] = useState<string[]>([...(props.initialSelection ?? [])]);
    const [routes, setRoutes] = useState<Record<string, IGenericRoute[]>>({});
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        getAllRoutes(props.feed)
            .then(routes => {
                
                if (props.shownLines) {
                    routes = routes.filter(r => (props.shownLines ?? []).includes(r.gtfsId))
                }
                
                const routesByTen: Record<string, IGenericRoute[]> = {};
                
                for (const r of routes) {
                    
                    const routeTen = `${Math.floor(Number(`${r.shortName}`.replace(/[^0-9]/gmi, '')) / 10)*10}`;
                    
                    if (!routesByTen[routeTen]) {
                        routesByTen[routeTen] = [];
                    }
                    
                    routesByTen[routeTen].push(r);
                    
                }
                
                if (props.initialSelection == null) {
                    setSelectedRoutes(routes.map(r => r.gtfsId));
                }
                
                setRoutes(routesByTen);
                
            })
            .catch(err => {
                setError(err);
                console.error(err);
            })
    }, []);
    
    return <div className='x-map-line-picker'>
        
        <div className='d-block d-md-flex justify-content-between align-items-center'>
            <h3 className='mb-2 mb-2-md'>Näytettävät linjat</h3>
            <div className=''>
                <button className='btn btn-sm btn-outline-secondary'
                    onClick={e => {
                        e.preventDefault();
                        setSelectedRoutes([]);
                    }}
                    >
                    <RemixIcon icon='ri-close-line'/> Tyhjennä ({selectedRoutes.length})
                </button>
                <button className='btn btn-sm btn-outline-secondary ms-1'
                    onClick={e => {
                        e.preventDefault();
                        setSelectedRoutes(Object.values(routes).flat().map(r => r.gtfsId));
                    }}
                    >
                    <RemixIcon icon='ri-checkbox-multiple-line'/> Kaikki
                </button>
                <button className='btn btn-sm btn-success ms-1'
                    onClick={e => {
                        e.preventDefault();
                        props.onSelectLines(selectedRoutes.length == Object.values(routes).flat().length
                            ? null
                            : [...selectedRoutes]);
                    }}
                    >
                    <RemixIcon icon='ri-check-line'/> Vahvista
                </button>
            </div>
        </div>
        
        {error && <div className='alert alert-danger'>{error}</div>}
        
        <hr/>
        
        <div className='inner'>
            {Object.entries(routes).map(([routeCat, routes]) =>
                <div className='route-class mb-3' key={routeCat}>
                    {routes.map(route =>
                        <div key={route.gtfsId}
                            className='route'
                            title={`${route.shortName} ${route.longName}`}
                            data-mode={route.mode}
                            data-active={selectedRoutes.includes(route.gtfsId)}
                            onClick={e => {
                                e.preventDefault();
                                setSelectedRoutes(rs => rs.includes(route.gtfsId)
                                    ? rs.filter(r => r != route.gtfsId)
                                    : [...rs, route.gtfsId]);
                            }}
                            >{route.shortName}</div>
                    )}
                </div>
            )}
        </div>
        
    </div>;
    
}