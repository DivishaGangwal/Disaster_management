import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/atkinson-hyperlegible-next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './command-atlas.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
