import './datos/tema.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Fuentes incluidas en la app (sin internet): títulos, interfaz y números del editor.
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/geist-mono';

import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/tema-juego.css';

import { ProveedorAvisos } from './componentes/Avisos.jsx';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProveedorAvisos>
      <App />
    </ProveedorAvisos>
  </StrictMode>
);
