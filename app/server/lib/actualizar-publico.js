// Actualizar desde la VERSIÓN PUBLICADA (2026-11-15): para quien instaló la app con el comando (sin repositorio de
// GitHub). El botón «Actualizar» de la barra pregunta cuál es la última versión publicada en el repositorio público
// (kalethabh/kads-studio, donde «npm run publicar» sube cada versión) y, si es más nueva que la instalada, baja su
// paquete y lo aplica con lo mismo que Ajustes › Acerca de › «Actualizar la app» (lib/actualizar.js: nunca toca lo
// del usuario y deja respaldo).
//
//   ultimaPublicada()                 -> { version, url, notas } | { error }      (se recuerda 10 minutos)
//   bajarPaquete(url, destino, { esperados })   baja el zip a `destino` (lanza si no llega entero)
//   avance()                          -> { bytes, total } | null   (mientras baja)
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

export const REPO_PUBLICO = process.env.KADS_REPO_PUBLICO || 'kalethabh/kads-studio';
const ZIP = 'anuncios-con-ia-app.zip';
const RE_ETIQUETA = /^v(\d{4}-\d{2}-\d{2}[a-z]?)$/;
const CADA_MS = 10 * 60000;

let recordada = null; // { cuando, valor }
let bajando = null; // { bytes, total }

/** ¿`a` es una versión más nueva que `b`? (2026-11-15 > 2026-11-11b > 2026-11-11) */
export const esMasNueva = (a, b) => Boolean(a) && (!b || String(a) > String(b));

export async function ultimaPublicada({ fresca = false } = {}) {
  if (!fresca && recordada && Date.now() - recordada.cuando < CADA_MS) return recordada.valor;
  let valor;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO_PUBLICO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kads-studio' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const version = (RE_ETIQUETA.exec(String(d.tag_name || '')) || [])[1];
    const zip = (d.assets || []).find((a) => a?.name === ZIP);
    if (!version || !zip?.browser_download_url) throw new Error('sin-paquete');
    valor = { version, url: zip.browser_download_url, bytes: Number(zip.size) || null, notas: String(d.body || '').slice(0, 4000) };
  } catch {
    valor = { error: 'No pude revisar si hay una versión nueva. Revisa tu internet y vuelve a probar.' };
  }
  // (un fallo se recuerda solo un minuto)
  recordada = { cuando: valor.error ? Date.now() - CADA_MS + 60000 : Date.now(), valor };
  return valor;
}

export const avance = () => (bajando ? { ...bajando } : null);

export async function bajarPaquete(url, destino, { esperados = null } = {}) {
  if (bajando) throw new Error('Ya se está bajando la versión nueva. Espera a que termine.');
  bajando = { bytes: 0, total: esperados || null };
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'kads-studio' }, redirect: 'follow' });
    if (!r.ok || !r.body) throw new Error(`No pude bajar la versión nueva (${r.status}). Revisa tu internet y vuelve a probar.`);
    // (el peso es el que dice la versión publicada; el del servidor solo vale si no viene comprimido)
    if (!bajando.total && !r.headers.get('content-encoding')) bajando.total = Number(r.headers.get('content-length')) || null;
    const contar = new Transform({
      transform(trozo, _c, listo) {
        bajando.bytes += trozo.length;
        listo(null, trozo);
      },
    });
    await pipeline(Readable.fromWeb(r.body), contar, fs.createWriteStream(destino));
    if (esperados && bajando.bytes !== esperados) throw new Error('La descarga se cortó. Vuelve a intentarlo.');
    return { bytes: bajando.bytes };
  } catch (e) {
    fs.rmSync(destino, { force: true });
    throw e;
  } finally {
    bajando = null;
  }
}
