// La VELOCIDAD de una landing (2026-11-20q): Lighthouse, lo mismo que mide PageSpeed Insights, en celular (con la
// conexión y el procesador lentos que simula). Corre con `npx lighthouse` (la primera vez lo baja, unos minutos; después
// queda guardado) y el navegador que ya trae la app (navegador.js). En modo prueba no corre: devuelve un puntaje simulado.
//
//   puntaje(url) -> { puntaje (0-100), fcp, lcp, tbt, cls, peso (KB) } | { error }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { rutaDelNavegador } from './navegador.js';
import { modoPrueba } from '../procesos.js';

const VERSION = '12.6.0';

function npx() {
  const dir = path.dirname(process.execPath);
  for (const n of process.platform === 'win32' ? ['npx.cmd'] : ['npx']) if (fs.existsSync(path.join(dir, n))) return path.join(dir, n);
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

export async function puntaje(url) {
  if (modoPrueba() && !process.env.LANDINGS_LIGHTHOUSE) return { puntaje: /127\.0\.0\.1|localhost/.test(url) ? 95 : 62, fcp: '0,9 s', lcp: '2,1 s', tbt: '40 ms', cls: '0', peso: 600, simulado: true };
  const chrome = rutaDelNavegador();
  if (!chrome) return { error: 'No encontré el navegador para medir.' };
  const salida = path.join(os.tmpdir(), `kads-lh-${crypto.randomBytes(4).toString('hex')}.json`);
  const args = ['-y', `lighthouse@${VERSION}`, url, '--only-categories=performance', '--output=json', `--output-path=${salida}`, '--chrome-flags=--headless --no-sandbox --disable-gpu', '--quiet', '--max-wait-for-load=60000'];
  const codigo = await new Promise((ok) => {
    const p = spawn(npx(), args, { env: { ...process.env, CHROME_PATH: chrome }, windowsHide: true, shell: process.platform === 'win32' });
    const t = setTimeout(() => p.kill('SIGKILL'), 8 * 60000);
    p.on('close', (c) => {
      clearTimeout(t);
      ok(c);
    });
    p.on('error', () => {
      clearTimeout(t);
      ok(-1);
    });
  });
  try {
    const r = JSON.parse(fs.readFileSync(salida, 'utf8'));
    const a = r.audits;
    const sc = r.categories?.performance?.score;
    if (sc === null || sc === undefined) return { error: r.runtimeError?.message || 'Lighthouse no pudo medirla.' };
    return { puntaje: Math.round(sc * 100), fcp: a['first-contentful-paint']?.displayValue, lcp: a['largest-contentful-paint']?.displayValue, tbt: a['total-blocking-time']?.displayValue, cls: a['cumulative-layout-shift']?.displayValue, peso: Math.round((a['total-byte-weight']?.numericValue || 0) / 1024) };
  } catch {
    return { error: codigo === -1 ? 'No pude correr Lighthouse (falta npm/npx).' : 'Lighthouse no pudo medirla (¿la página está en línea?).' };
  } finally {
    fs.rmSync(salida, { force: true });
  }
}
