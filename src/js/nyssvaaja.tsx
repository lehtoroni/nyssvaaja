import { h, render } from 'preact';
import App from './app';

const base = document.getElementById('nyssvaaja');
if (!base) throw new Error(`No base div found`);

render(<App/>, base);
