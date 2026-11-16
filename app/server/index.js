// Servidor local de "Anuncios con IA": http://127.0.0.1:4455
//
//   npm run dev    -> API + interfaz con recarga al guardar (Vite en modo middleware, mismo puerto)
//   npm run build  -> arma la interfaz en dist/
//   npm start      -> API + la interfaz ya armada (dist/)
//
// Para las pruebas: PUERTO=4471 levanta otra app en ese puerto (cada probador la suya, en modo prueba).
//
// Cada archivo de server/rutas/*.js se carga solo al arrancar, en orden alfabetico.
// Para agregar rutas no hace falta tocar este archivo: se crea server/rutas/<algo>.js con
//
//   export default function (app) { app.get('/api/algo', (req, res) => res.json({...})); }
//
// (o con `export default router` si es un express.Router). Usa Express 5: los comodines se
// escriben con nombre ('/archivos/:slug/*ruta') y un error en una ruta async llega solo al
// manejador de errores de abajo.
//
// Al arrancar, antes de las rutas: la IA elegida (migrarMotor, lib/motor-ia.js). Ya escuchando, en segundo plano:
// lo de Codex (su config.toml, la carpeta de trabajo vacia y las conversaciones viejas), si se usa o esta instalado.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { APP, DIST, RUTAS_API, HOST, PUERTO } from './lib/rutas.js';
import { hostsPermitidos } from './lib/servidor.js';
import { migrarMotor, motorElegido } from './lib/motor-ia.js';
import { vigilarInterfaz } from './lib/interfaz.js';

const DEV = process.argv.includes('--dev');

// ---------------------------------------------------------------- la IA elegida
// Antes solo existia Claude: quien ya paso la bienvenida queda con Claude, una sola vez (lo mismo hace
// app/inicio/preparar-motor.mjs, que corre antes). Con AIA_MOTOR (solo pruebas) la IA ya esta fijada y no se toca
// config.json.
if (!process.env.AIA_MOTOR) {
  const m = migrarMotor();
  if (m.error) console.error(`  [motor-ia] no pude guardar la IA: ${m.error}`);
}

/**
 * Codex (ChatGPT), solo si es la IA elegida o esta instalado: su config.toml propio, la carpeta de trabajo vacia y las
 * conversaciones de mas de 30 dias. Cada paso por su lado: si uno falla se avisa en la consola y la app sigue. Si el
 * CODEX_HOME de la app fuera la sesion del propio usuario (~/.codex, solo en pruebas), ahi no se escribe ni se borra.
 */
async function prepararCodex() {
  const rutas = await import('./lib/codex-rutas.js');
  if (motorElegido() !== 'codex' && !rutas.resolverCodex()) return;
  const { home } = rutas.carpetasCodex();
  const delUsuario = rutas.esHomeDelUsuario(home);
  const paso = async (nombre, fn) => {
    try {
      await fn();
    } catch (e) {
      console.error(`  [codex] ${nombre}: ${e?.message || e}`);
    }
  };
  if (!delUsuario) await paso('config.toml', () => rutas.asegurarConfigCodex(home));
  await paso('carpeta de trabajo', () => rutas.vaciarTrabajo());
  if (!delUsuario && fs.existsSync(path.join(APP, 'server', 'lib', 'codex.js'))) {
    await paso('conversaciones viejas', async () => (await import('./lib/codex.js')).limpiarHilosViejos?.());
  }
}

const app = express();
app.disable('x-powered-by');

// Solo se atiende a este equipo: nada de otros nombres de host (evita que una pagina web
// cualquiera le hable a la app haciendose pasar por localhost).
const HOSTS = hostsPermitidos(PUERTO); // + el dominio del servidor, si la app corre en uno (lib/servidor.js)
app.use((req, res, next) => {
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return res.status(403).send('Solo desde este equipo.');
  next();
});

app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------- rutas (server/rutas/*.js)
const cargadas = [];
for (const archivo of fs.readdirSync(RUTAS_API).filter((f) => f.endsWith('.js')).sort()) {
  const modulo = await import(pathToFileURL(path.join(RUTAS_API, archivo)).href);
  const r = modulo.default;
  if (typeof r === 'function' && Array.isArray(r.stack)) app.use(r); // un express.Router
  else if (typeof r === 'function') await r(app);
  else continue;
  cargadas.push(archivo.replace(/\.js$/, ''));
}

// Lo que no existe en la API o en los archivos responde 404 en JSON (nunca la interfaz).
app.use(['/api', '/archivos'], (req, res) => res.status(404).json({ error: 'No existe esa ruta.' }));

// ---------------------------------------------------------------- interfaz
const servidor = http.createServer(app);

if (DEV) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(APP, 'vite.config.js'),
    root: APP,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server: servidor } },
  });
  app.use(vite.middlewares);
} else {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('\n  Falta armar la interfaz. Corre primero:  npm run build\n');
    process.exit(1);
  }
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // index.html sin cache: despues de actualizar la app, el navegador pide la interfaz nueva (los assets llevan su huella)
  app.get('/{*todo}', (req, res) => res.sendFile(path.join(DIST, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } }));
}

// ---------------------------------------------------------------- errores
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.url, err?.stack || err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: 'Algo salió mal en la app. Vuelve a intentarlo.' });
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  El puerto ${PUERTO} ya está ocupado: la app ya está abierta en otra ventana.\n  Ábrela en http://${HOST}:${PUERTO}\n`);
    process.exit(1);
  }
  throw err;
});

servidor.listen(PUERTO, HOST, () => {
  console.log(`\n  Kads Studio by Kalethabh ${DEV ? '(desarrollo)' : ''}`);
  console.log(`  Abre http://${HOST}:${PUERTO}`);
  console.log(`  Rutas cargadas: ${cargadas.join(', ')}\n`);
  prepararCodex().catch((e) => console.error(`  [codex] ${e?.message || e}`));
  if (!DEV) vigilarInterfaz(); // pantallas nuevas sin armar (p. ej. traídas por el guardado automático)
});
