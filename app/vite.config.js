// Vite para la interfaz. La usa el servidor (server/index.js) en modo middleware en desarrollo,
// y `npm run build` para armar dist/.
//
// UNA SOLA COPIA de react, react-dom y remotion: la de remotion/node_modules (remotion 4.0.519,
// react 19.2.8, @remotion/player). El editor usa la composicion real de remotion/src/Anuncio.jsx
// con @remotion/player, y esos archivos importan "remotion": si hubiera dos copias de react o de
// remotion, el Player se rompe (dos contextos distintos). Por eso en app/ NO se instalan
// (ver .npmrc) y todo apunta aca.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const APP = path.dirname(fileURLToPath(import.meta.url));
const REMOTION = path.resolve(APP, '..', 'remotion');
const REMOTION_SRC = path.join(REMOTION, 'src');
const NM = path.join(REMOTION, 'node_modules');
const nm = (rel) => path.join(NM, rel);

export default defineConfig({
  root: APP,
  plugins: [react()],
  resolve: {
    alias: [
      // Paquetes completos: la carpeta (Vite lee su package.json y sus "exports").
      { find: /^react$/, replacement: nm('react') },
      { find: /^react-dom$/, replacement: nm('react-dom') },
      { find: /^remotion$/, replacement: nm('remotion') },
      { find: /^@remotion\/([\w-]+)$/, replacement: nm('@remotion/$1') },
      // Subrutas: el archivo exacto que dicen sus "exports".
      { find: /^react\/jsx-runtime$/, replacement: nm('react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: nm('react/jsx-dev-runtime.js') },
      { find: /^react-dom\/client$/, replacement: nm('react-dom/client.js') },
      { find: /^remotion\/no-react$/, replacement: nm('remotion/dist/esm/no-react.mjs') },
      { find: /^remotion\/version$/, replacement: nm('remotion/dist/esm/version.mjs') },
      // La composicion real del render: import { Anuncio } from '@composicion/Anuncio.jsx'
      { find: /^@composicion\/(.*)$/, replacement: path.join(REMOTION_SRC, '$1') },
    ],
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/player'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'remotion', '@remotion/player'],
  },
  server: {
    fs: {
      strict: true,
      // Fuera de app/ solo se puede leer la composicion y sus paquetes.
      allow: [APP, REMOTION_SRC, NM],
    },
    watch: { ignored: ['**/server/**', '**/dist/**', '**/config.json'] },
  },
  build: {
    outDir: path.join(APP, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
  },
});
