// LAS ESTRUCTURAS GANADORAS EN TU COMPUTADOR (2026-11-26b). Las fichas viajan con la app (.claude/skills/
// anuncios-imagen-ads/estructuras/mv-XX.json); la IMAGEN de cada referencia vive en tu biblioteca privada
// (mis_archivos/biblioteca/referencias/mayaverra/), nunca en el instalador. Si falta, la app la baja sola de su
// `url_origen` (TrendTrack) la primera vez que se usa. Solo se usa como estructura: nunca se publica.
//
//   listaEstructuras()                 [{ id: 'F33', mv: 'mv-01', nombre, estilo, gancho, dolor, segmento, zona, oferta, hay }]
//   asegurarReferencia(formatoId)      la baja si falta -> true si está
//   asegurarReferencias(ids)           varias (de a una)
//   rutaReferencia(formatoId)          la ruta absoluta (o null si el formato no es una estructura)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RAIZ } from '../rutas.js';
import { leerJSON, existe } from '../archivos.js';
import { leerSkill, DIR_SKILL } from './verificar.js';
import { absDePropia, rutaPermitida } from './propias-disco.js';

const HOSTS = new Set(['medias.trendtrack.io']);

/** La ruta de la imagen de una estructura (dentro de mis_archivos/ o de tus estructuras), o null. */
export function rutaReferencia(formatoId) {
  const f = leerSkill().formatos.get(formatoId);
  if (!f?.referencia) return null;
  const abs = path.resolve(RAIZ, f.referencia);
  return rutaPermitida(abs) ? abs : null;
}

/** (2026-11-26d) La ruta absoluta de la ficha: las de Mayaverra en la skill; las tuyas (P##) en tu biblioteca. */
export function rutaFicha(f) {
  if (!f?.estructura) return null;
  if (f.marca === 'propia') return absDePropia(f.estructura);
  return path.join(DIR_SKILL, f.estructura);
}
export const fichaDe = (f) => {
  const r = rutaFicha(f);
  return r ? leerJSON(r) : null;
};

/** Las estructuras de la skill, para la pantalla. */
export function listaEstructuras() {
  return [...leerSkill().formatos.values()]
    .filter((f) => f.estructura)
    .map((f) => {
      const x = fichaDe(f) || {};
      return {
        id: f.id,
        mv: x.id || path.basename(f.estructura, '.json'),
        nombre: f.nombre,
        estilo: f.estilo,
        gancho: x.titular?.gancho || null,
        dolor: x.dolor_visual?.tipo || null,
        segmento: x.segmento || null,
        zona: x.zona_del_cuerpo || null,
        oferta: x.oferta?.tipo || null,
        hay: Boolean(rutaReferencia(f.id) && existe(rutaReferencia(f.id))),
        oculta: f.oculta === true,
        // (2026-11-26d) de quién es: 'mayaverra' o 'propia' (las tuyas)
        marca: f.marca || null,
        propia: f.marca === 'propia',
        creado: f.creado || null,
      };
    });
}

/** (2026-11-26d) La mezcla de Mayaverra (estructuras/mayaverra-mezcla.json): la proporción de cada gancho. */
export function mezclaMayaverra() {
  const m = leerJSON(path.join(DIR_SKILL, 'estructuras', 'mayaverra-mezcla.json'));
  return m?.ganchos && typeof m.ganchos === 'object' ? m : { ganchos: {} };
}

/** Cuántas de cada gancho en un lote de n, con la proporción de Mayaverra (restos mayores). */
export function cuposDeGanchos(n, ganchos = mezclaMayaverra().ganchos) {
  const l = Object.entries(ganchos).filter(([, p]) => Number(p) > 0);
  const total = l.reduce((t, [, p]) => t + Number(p), 0) || 1;
  const base = l.map(([g, p]) => ({ g, exacto: (n * Number(p)) / total }));
  const cupos = Object.fromEntries(base.map((x) => [x.g, Math.floor(x.exacto)]));
  let falta = n - Object.values(cupos).reduce((t, x) => t + x, 0);
  for (const x of [...base].sort((a, b) => b.exacto - Math.floor(b.exacto) - (a.exacto - Math.floor(a.exacto)))) {
    if (falta <= 0) break;
    cupos[x.g]++;
    falta--;
  }
  return cupos;
}

/**
 * AL AZAR (2026-11-26c; 2026-11-26d «mejor que sean del Mayaverra y yo también pueda agregar»): n estructuras
 * distintas, SOLO de Mayaverra y las tuyas (también las ocultas), con la mezcla de ganchos de Mayaverra
 * (mayaverra-mezcla.json) y sin el mismo estilo dos veces seguidas. Si tienes alguna tuya, un lote de 3 o más lleva al
 * menos una. `semilla` (el nombre del lote) hace el sorteo repetible.
 */
export function estructurasAlAzar(n, { semilla = '', excluir = [] } = {}) {
  let x = [...String(semilla || Date.now())].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 2166136261) || 1;
  const azar = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const barajar = (l) => {
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    return l;
  };
  const todas = barajar(
    [...leerSkill().formatos.values()]
      .filter((f) => f.estructura && f.referencia && ['mayaverra', 'propia'].includes(f.marca))
      .map((f) => ({ id: f.id, estilo: f.estilo, propia: f.marca === 'propia', gancho: fichaDe(f)?.titular?.gancho || null }))
  );
  // (2026-11-26i) «Más imágenes»: sin las que el lote ya usó (si alcanzan)
  const fuera = new Set(excluir || []);
  if (fuera.size && todas.filter((f) => !fuera.has(f.id)).length >= n) for (const f of todas.filter((y) => fuera.has(y.id))) todas.splice(todas.indexOf(f), 1);
  const k = Math.min(n, todas.length);
  const elegidas = [];
  // ningún estilo en más de la mitad del lote (si no, no hay orden sin dos seguidas)
  const tope = Math.ceil(k / 2);
  const cabe = (f) => elegidas.filter((y) => y.estilo === f.estilo).length < tope;
  const tomar = (f) => {
    elegidas.push(f);
    todas.splice(todas.indexOf(f), 1);
  };
  // al menos una tuya
  const tuya = todas.find((f) => f.propia);
  if (tuya && k >= 3) tomar(tuya);
  // la mezcla de ganchos de Mayaverra
  const cupos = cuposDeGanchos(k);
  for (const f of elegidas) if (cupos[f.gancho] > 0) cupos[f.gancho]--;
  for (const [g, c] of Object.entries(cupos)) for (let i = 0; i < c && elegidas.length < k; i++) {
    const f = todas.find((y) => y.gancho === g && cabe(y)) || todas.find((y) => y.gancho === g);
    if (f) tomar(f);
  }
  while (elegidas.length < k && todas.length) tomar(todas.find(cabe) || todas[0]);
  // el orden: nunca el mismo estilo seguido (primero el estilo que más queda, para no trabarse al final)
  const orden = [];
  const quedan = [...elegidas];
  while (quedan.length) {
    const antes = orden[orden.length - 1]?.estilo;
    const cuenta = (e) => quedan.filter((y) => y.estilo === e).length;
    const opciones = quedan.filter((y) => y.estilo !== antes);
    const f = (opciones.length ? opciones : quedan).sort((a, b) => cuenta(b.estilo) - cuenta(a.estilo))[0];
    orden.push(f);
    quedan.splice(quedan.indexOf(f), 1);
  }
  return orden.map((f) => f.id);
}

/** Baja la imagen de una estructura si falta (de su url_origen, solo de TrendTrack). -> true si quedó. */
export async function asegurarReferencia(formatoId) {
  const destino = rutaReferencia(formatoId);
  if (!destino) return false;
  if (existe(destino)) return true;
  const url = fichaDe(leerSkill().formatos.get(formatoId))?.url_origen;
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname)) return false;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return false;
    const datos = Buffer.from(await r.arrayBuffer());
    if (datos.length < 1000 || datos.length > 20 * 1024 * 1024) return false;
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const crudo = `${destino}.${process.pid}.bajada`;
    const tmp = `${destino}.${process.pid}.tmp.jpg`;
    fs.writeFileSync(crudo, datos);
    try {
      // (png y webp a jpg, con el nombre de la ficha)
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', crudo, '-q:v', '2', tmp]);
      fs.renameSync(tmp, destino);
    } finally {
      fs.rmSync(crudo, { force: true });
      fs.rmSync(tmp, { force: true });
    }
    return existe(destino);
  } catch (e) {
    console.error(`[imagen-ads] no pude bajar la estructura ${formatoId}: ${e?.message || e}`);
    return false;
  }
}

export async function asegurarReferencias(ids = []) {
  const out = {};
  for (const id of ids) out[id] = await asegurarReferencia(id);
  return out;
}
