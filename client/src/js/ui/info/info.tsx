import { Fragment, h } from 'preact';
import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { capitalizeFirst, RemixIcon } from 'src/js/util';
import { useMemo } from 'react';
import { useEffect } from 'react';
import { Spinner } from 'src/js/app';

const LegalInfo = lazy(() => import('./legal'));
const NysseAlerts = lazy(() => import('./alerts'));
const NysseOverallSituation = lazy(() => import('./overall'));

export default function AppInfo(props: { feed: string, setFeed: (toFeed: string) => any }) {
    
    const [openView, setOpenView] = useState<string | null>(null);
    
    const [feedsMap, setFeedsMap] = useState<{
        feeds: Record<string, string>,
        realtime: string[]
    } | null>(null);
    
    useEffect(() => {
        fetch(`/api/getFeeds`)
            .then(x => x.json())
            .then(feedsData => {
                setFeedsMap(feedsData);
            })
            .catch(err => {
                console.error(err);
            })
    }, []);
    
    const VIEWS = useMemo<Record<string, [string, any]>>(() => ({
        'alerts': ['⚠️ Häiriötiedotteet ja perutut', <Fragment>
            <Suspense fallback={<p>Ladataan...</p>}>
                <NysseAlerts feed={props.feed}/>
            </Suspense>
        </Fragment>],
        'overall': ['🕰️ Yleistilanne', <Fragment>
            <Suspense fallback={<p>Ladataan...</p>}>
                <NysseOverallSituation feed={props.feed}/>
            </Suspense>
        </Fragment>],
        'guide': ['❓️ Käyttöohje', <Fragment>
            <div className='p-3'>
                
                <h1>❓️ Nyssvääjä</h1>
                
                <hr/>
                
                <h2>1. Valitse pysäkit ja kartan linjat</h2>
                <p>
                    Valitse Nyssvääjän monitorinäkymästä pysäkki tai useampi, jotka haluat näkyviin. Voit valita pysäkit listalta tai kartalta. Valitse halutessasi karttanäkymään linjasuodattimia.
                </p>
                <p>
                    <img src='https://lehtodigital.fi/f/jj0Xb' className='nyssvaaja-info-img'/>
                </p>
                
                <hr/>
                
                <h2>2. Talleta osoite</h2>
                <p>
                    <b>Nyssvääjä tallentaa tekemäsi valinnat sivun URL-osoitteeseen.</b>
                </p>
                <p>
                    Saat luomasi Nyssvääjä-näkymän auki aina samalla osoitteella, jonka Nyssvääjä päivittää osoitepalkkiin tehdessäsi muutoksia.
                </p>
                <p>
                    Voit lisätä Nyssvääjä-kuvakkeen kotinäyttöösi tai suosikkeihisi, jolloin pääset nopeasti monitoriisi.
                </p>
                <p>
                    <img src='https://lehtodigital.fi/f/O7mll' className='nyssvaaja-info-img'/>
                </p>
                
                <hr/>
                <h3>3. Muutoksia? Talleta osoite!</h3>
                <p>
                    <b>Nyssvääjä tallettaa tekemäsi valinnat osoitteessa olevaan #-alkuiseen osaan.</b> Jos teet muutoksia, ne eivät tallennu kirjanmerkkiin tai kotinäytölle automaattisesti – sinun pitää lisätä kuvake tai kirjanmerkki uudelleen.
                </p>
                
            </div>
        </Fragment>],
        'copyrights': ['©️ Tekijänoikeudet', <Fragment>
            <div className='p-3'>
                
                <div className='text-center'>
                    <h1>©️ Tekijänoikeudet</h1>
                    
                    <p className='mb-1'>Nyssvääjä &copy; Roni Lehto {new Date().getFullYear()}</p>
                    <p className='mb-1'><a href='https://lehtodigital.fi/'>www.lehtodigital.fi</a></p>
                    <p>Forkkaa <a href='https://github.com/lehtoroni/nyssvaaja'>GitHubissa</a>!</p>
                </div>
                
                <hr/>
                
                <p>Nyssvääjä ei toimisi ilman seuraavia:</p>
                
                <hr/>
                
                <h2>Karttatasot</h2>
                <p>
                    Karttatyökalu &copy; <a href='https://leafletjs.com'>Leaflet</a> ja tekijät<br/>
                    Karttakuvat &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> ja tekijät
                </p>
                
                <hr/>
                <h2>Bussidata</h2>
                <p>
                    Joukkoliikennedata &copy; <a href='https://digitransit.fi/'>Digitransit</a> ja kumppanit. Avoin data on lisensoitu CC BY 4.0 Attribution International -lisenssillä.
                </p>
                
                <hr/>
                <h2>Avoimen lähdekoodin kirjastot</h2>
                <Suspense fallback={<p>Ladataan...</p>}>
                    <LegalInfo/>
                </Suspense>
                
            </div>
        </Fragment>]
    }), [props.feed]);
    
    return <div style={{ 
        position: 'relative',
        width: '100%',
        height: '100%'
     }} className='p-3'>
        <div className='row justify-content-center'>
            <div className='col-12 col-lg-6 col-xl-5'>
                
                <div className='nyssvaaja-info-header'>
                    <h1 className='text-center'>🚍️</h1>
                    <h3 className='text-center'>Nyssvääjä</h3>
                    <p className='text-center'>
                        Nyssvääjä on bussi&shy;pysäkki&shy;monitori Tamperelaisille (...ja nyt myös muille). Valitse pysäkit ja lisää kotinäytölle!
                    </p>
                </div>
                
                <hr/>
                
                <label>Palvelualue (feed)</label>
                {feedsMap && <Fragment>
                    <select className='form-select'
                        value={props.feed}
                        onInput={e => {
                            props.setFeed(e.currentTarget.value);
                        }}
                        >
                        {Object.entries(feedsMap.feeds).map((en, i) =>
                            <option value={en[0]}>{feedsMap.realtime.includes(en[0].toLowerCase()) ? '📍' : ''} {capitalizeFirst(en[0])} ({en[1]})</option>
                        )}
                    </select>
                </Fragment>}
                {!feedsMap && <Fragment>
                    <Spinner/>
                </Fragment>}
                
                <hr/>
                
                {Object.entries(VIEWS).map(([viewId, [viewName, viewContent]]) =>
                    <div className='mb-2'
                        key={`btn${viewId}`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gridTemplateRows: '1fr',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        >
                        <button className='btn btn-outline-info'
                            onClick={e => {
                                e.preventDefault();
                                setOpenView(viewId);
                            }}
                            >
                            {viewName}
                        </button>
                    </div>
                )}
                
                {Object.entries(VIEWS).map(([viewId, [viewName, viewContent]]) =>
                    <div className='view-sub'
                        key={viewId}
                        style={{
                            right: openView == viewId ? '0' : ''
                        }}
                        >
                        <div className='view-sub-top p-2' style={{
                        }}>
                            <button className='btn btn-sm text-light'
                                onClick={e => {
                                    e.preventDefault();
                                    setOpenView(null);
                                }}
                                ><RemixIcon icon='ri-arrow-go-back-line'/> Takaisin</button>
                        </div>
                        <div className='view-sub-content'>
                            {openView == viewId && viewContent}
                        </div>
                    </div>
                )}
                
            </div>
        </div>
    </div>;
    
}
