import { h } from 'preact';

import licensesFront from '../../../assets/licenses_frontend.json';
import licensesServer from '../../../assets/licenses_server.json';

export default function LegalInfo(props: {}) {
    
    return <div>
        
        <h4>Frontend</h4>
        {licensesFront.map(dep =>
            <div key={dep.name}>
                <p className='mb-1'><b>{dep.name}</b> {dep.installedVersion}</p>
                <p className='mb-1'><a href={dep.link} target='_blank' rel='nofollow'>{dep.link}</a></p>
                <p className='mb-1'>Tekijä: {dep.author}</p>
                <p>Lisenssi: {dep.licenseType}</p>
            </div>
        )}
        
        <h4>Backend</h4>
        {licensesServer.map(dep =>
            <div key={dep.name}>
                <p className='mb-1'><b>{dep.name}</b> {dep.installedVersion}</p>
                <p className='mb-1'><a href={dep.link} target='_blank' rel='nofollow'>{dep.link}</a></p>
                <p className='mb-1'>Tekijä: {dep.author}</p>
                <p>Lisenssi: {dep.licenseType}</p>
            </div>
        )}
        
    </div>;
    
}