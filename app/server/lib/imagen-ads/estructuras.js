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

const BIBLIOTECA = path.join(RAIZ, 'mis_archivos');
const HOSTS = new Set(['medias.trendtrack.io']);

/** La ruta de la imagen de una estructura (dentro de mis_archivos/), o null. */
export function rutaReferencia(formatoId) {
  const f = leerSkill().formatos.get(formatoId);
  if (!f?.referencia) return null;
  const abs = path.resolve(RAIZ, f.referencia);
  const rel = path.relative(BIBLIOTECA, abs);
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : abs;
}

const fichaDe = (f) => (f?.estructura ? leerJSON(path.join(DIR_SKILL, f.estructura)) : null);

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
      };
    });
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
