// El navegador sin ventana para las landings (2026-11-20q): carga una página con su JavaScript y devuelve el HTML ya
// armado (--dump-dom). Usa el mismo Chrome que la app ya trae para el editor de video (el de Remotion:
// remotion/node_modules/.remotion/chrome-headless-shell), o CHROME_PATH, o el Chrome instalado en el computador.
//
//   rutaDelNavegador()                      -> ruta | null
//   htmlArmado(url, { espera, ancho, alto }) -> el HTML después de correr su JavaScript (o null si no hay navegador)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ } from '../rutas.js';

const AGENTE = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

function buscarEn(dir, nombres, prof = 0) {
  if (prof > 4 || !fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && nombres.includes(e.name)) return p;
    if (e.isDirectory()) {
      const r = buscarEn(p, nombres, prof + 1);
      if (r) return r;
    }
  }
  return null;
}

let cache;
export function rutaDelNavegador() {
  if (cache !== undefined) return cache;
  const candidatos = [
    process.env.CHROME_PATH,
    buscarEn(path.join(RAIZ, 'remotion', 'node_modules', '.remotion', 'chrome-headless-shell'), ['chrome-headless-shell', 'chrome-headless-shell.exe', 'headless_shell'] /* (headless_shell: el de Linux ARM, p. ej. Oracle gratis) */),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  cache = candidatos.find((c) => {
    try {
      return fs.statSync(c).isFile();
    } catch {
      return false;
    }
  }) || null;
  return cache;
}

/** El HTML de la página después de correr su JavaScript (carruseles armados, imágenes perezosas con su src). */
export function htmlArmado(url, { espera = 15000, ancho = 412, alto = 915, plazoMs = 90000, extra = [] } = {}) {
  const bin = rutaDelNavegador();
  if (!bin) return Promise.resolve(null);
  const args = ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--mute-audio', `--user-agent=${AGENTE}`, `--window-size=${ancho},${alto}`, `--virtual-time-budget=${espera}`, ...extra, ...String(process.env.LANDINGS_CHROME_ARGS || '').split(' ').filter(Boolean), '--dump-dom', url]; // (LANDINGS_CHROME_ARGS: p. ej. un proxy, para pruebas)
  return new Promise((ok) => {
    const p = spawn(bin, args, { windowsHide: true });
    const partes = [];
    const t = setTimeout(() => p.kill('SIGKILL'), plazoMs);
    p.stdout.on('data', (d) => partes.push(d));
    p.stderr.on('data', () => {});
    p.on('error', () => {
      clearTimeout(t);
      ok(null);
    });
    p.on('close', () => {
      clearTimeout(t);
      const html = Buffer.concat(partes).toString('utf8');
      ok(html.length > 500 ? html : null);
    });
  });
}

export { AGENTE };
