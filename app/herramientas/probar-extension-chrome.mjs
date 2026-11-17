// Prueba de la extensión «Guardar en Kads» SIN abrir Facebook (y sin gastar nada):
//
//   node app/herramientas/probar-extension-chrome.mjs [puerto de una app en modo prueba] [carpeta de capturas]
//
// Necesita Playwright (con su Chromium) y una app ya abierta en modo prueba
// (ANUNCIOS_MODO_PRUEBA=1 PUERTO=4494 node app/server/index.js). Hace esto:
//   1. arma una copia de extension-chrome/ cuyo manifiesto también entra en http://127.0.0.1/ads/library/* (solo para
//      la prueba: la de verdad entra solo en facebook.com/ads/library);
//   2. sirve app/herramientas/datos-prueba/biblioteca-falsa.html (dos tarjetas que imitan la Biblioteca de anuncios) en
//      http://127.0.0.1:<otro puerto>/ads/library/ y responde las direcciones .fbcdn.net con archivos de la app;
//   3. abre Chromium con la extensión, pega el código de emparejamiento en sus Opciones y prueba la conexión;
//   4. comprueba que aparece «Guardar en Kads» en cada tarjeta, toca el de las dos, y que los anuncios llegan a
//      «Desde Chrome» con su video / su imagen; al final los borra.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const PUERTO_APP = Number(process.argv[2] || 4494);
const CAPTURAS = process.argv[3] || null;
const APP = `http://127.0.0.1:${PUERTO_APP}`;

async function cargarPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const global = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(global, 'playwright', 'index.mjs')).href);
  }
}

let pasan = 0;
let fallas = 0;
const check = (que, ok, detalle = '') => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'} ${que}${!ok && detalle ? ` -> ${detalle}` : ''}`);
};

// 1. la copia de la extensión para la prueba
const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-ext-'));
fs.cpSync(path.join(RAIZ, 'extension-chrome'), copia, { recursive: true });
const manifiesto = JSON.parse(fs.readFileSync(path.join(copia, 'manifest.json'), 'utf8'));
manifiesto.content_scripts[0].matches.push('http://127.0.0.1/ads/library/*');
fs.writeFileSync(path.join(copia, 'manifest.json'), JSON.stringify(manifiesto, null, 2));

// 2. la Biblioteca falsa
const PAGINA = fs.readFileSync(path.join(AQUI, 'datos-prueba', 'biblioteca-falsa.html'));
const falsa = http.createServer((req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGINA));
await new Promise((r) => falsa.listen(0, '127.0.0.1', r));
const BIBLIOTECA = `http://127.0.0.1:${falsa.address().port}/ads/library/?active_status=active&q=prueba`;

const { chromium } = await cargarPlaywright();
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-perfil-'));
const contexto = await chromium.launchPersistentContext(perfil, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${copia}`, `--load-extension=${copia}`],
});
const MUESTRA = (n) => fs.readFileSync(path.join(RAIZ, 'app', 'muestras', n.includes('video') ? 'claymation' : 'skeleton', n.includes('video') ? 'video.mp4' : 'imagen.jpg'));
await contexto.route(/https:\/\/[a-z0-9.-]+\.fbcdn\.net\//, (ruta) => {
  const u = ruta.request().url();
  const video = /\.mp4/.test(u);
  ruta.fulfill({ status: 200, contentType: video ? 'video/mp4' : 'image/jpeg', body: MUESTRA(video ? 'video' : 'imagen') });
});

const guardados = [];
try {
  let [sw] = contexto.serviceWorkers();
  if (!sw) sw = await contexto.waitForEvent('serviceworker', { timeout: 15000 });
  const idExt = new URL(sw.url()).host;
  check('Chromium cargó la extensión', /^[a-p]{32}$/.test(idExt), sw.url());

  // 3. las Opciones
  const { codigo } = await fetch(`${APP}/api/inspiracion/chrome/codigo`, { headers: { Origin: APP } }).then((r) => r.json());
  check('la app dio el código', Boolean(codigo));
  const op = await contexto.newPage();
  await op.goto(`chrome-extension://${idExt}/opciones.html`);
  await op.fill('#codigo', 'MAL-CODIGO-QUE-NO-SIRVE-XXXX');
  await op.fill('#direccion', APP);
  await op.click('button[type=submit]');
  await op.click('#probar');
  await op.waitForFunction(() => /no coincide|No encontré|error/i.test(document.getElementById('estado').textContent), null, { timeout: 15000 });
  check('con un código equivocado, «Probar conexión» lo dice', /no coincide/i.test(await op.textContent('#estado')), await op.textContent('#estado'));
  await op.fill('#codigo', codigo);
  await op.click('button[type=submit]');
  await op.click('#probar');
  await op.waitForFunction(() => /Conectado/.test(document.getElementById('estado').textContent), null, { timeout: 15000 });
  check('con el código bueno: «Conectado con Kads Studio»', true);
  if (CAPTURAS) await op.screenshot({ path: path.join(CAPTURAS, 'extension-opciones.png') });
  await op.close();

  // 4. la Biblioteca (falsa)
  const p = await contexto.newPage();
  await p.goto(BIBLIOTECA);
  await p.waitForSelector('.kads-boton', { timeout: 15000 });
  check('aparece «Guardar en Kads» en cada tarjeta (2)', (await p.locator('.kads-boton').count()) === 2);
  const antes = (await fetch(`${APP}/api/inspiracion/chrome`).then((r) => r.json())).anuncios.length;
  await p.locator('.kads-boton').nth(0).click();
  await p.waitForSelector('.kads-aviso', { timeout: 20000 });
  const aviso1 = await p.textContent('.kads-aviso');
  check('el aviso dice que se guardó', /Guardado en Kads/.test(aviso1), aviso1);
  if (CAPTURAS) await p.screenshot({ path: path.join(CAPTURAS, 'extension-biblioteca.png') });
  await p.locator('.kads-boton').nth(1).click();
  await p.waitForFunction(() => document.querySelectorAll('.kads-boton--hecho').length === 2, null, { timeout: 20000 });
  const lista = (await fetch(`${APP}/api/inspiracion/chrome`).then((r) => r.json())).anuncios;
  const v = lista.find((a) => a.id === 'chrome_987650000000001');
  const i = lista.find((a) => a.id === 'chrome_987650000000002');
  if (v) guardados.push(v.id);
  if (i) guardados.push(i.id);
  check('los dos llegaron a «Desde Chrome»', lista.length === antes + 2 && v && i, JSON.stringify(lista.map((a) => a.id)));
  check('video: página, id de página, copy, fecha y creativos', v?.anunciante.nombre === 'Natura Clay Prueba' && v?.anunciante.pagina === '100064000000001' && /hinchazón/.test(v?.copy || '') && v?.desde?.startsWith('2026-09-02') && v?.creativos === 3, JSON.stringify(v));
  check('video: dominio, título y botón', v?.dominio === 'naturaclay.co' && v?.titulo === 'Desinflama en 7 días' && v?.cta === 'Comprar', JSON.stringify({ d: v?.dominio, t: v?.titulo, c: v?.cta }));
  check('video: bajado a la app (con miniatura)', v?.tipo === 'video' && v?.media?.startsWith('/api/inspiracion/chrome/media/') && Boolean(v?.miniatura));
  check('imagen (en inglés): página, fecha, imagen y botón', i?.anunciante.nombre === 'Huesos Fuertes Prueba' && i?.desde?.startsWith('2026-10-30') && i?.tipo === 'imagen' && i?.cta === 'Shop now', JSON.stringify(i));
  check('validado como insignia (no se esconde lo que guardaste)', v?.validado === true && i?.validado === false);
  await p.close();
} catch (e) {
  check('la prueba terminó sin errores', false, e?.stack || String(e));
} finally {
  if (!process.env.DEJAR) for (const id of guardados) await fetch(`${APP}/api/inspiracion/chrome/${id}`, { method: 'DELETE', headers: { Origin: APP } }).catch(() => {});
  await contexto.close();
  falsa.close();
  fs.rmSync(copia, { recursive: true, force: true });
  fs.rmSync(perfil, { recursive: true, force: true });
}

console.log(`\n${pasan} bien, ${fallas} mal`);
process.exit(fallas ? 1 : 0);
