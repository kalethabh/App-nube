// El SEMÁFORO de las imágenes del chat de la coordinadora (2026-11-21d, pedido del usuario): cada imagen que ella genera
// se ve en el chat con 🟢 (está bien: la estructura, el titular enganchador, la modelo, los detalles) o 🔴 (no la
// quiero otra vez, con su motivo si lo dice). Lo votado queda guardado y ella lo tiene en cuenta en las próximas
// variaciones: NO para hacerlas iguales, sino para seguir lo que funcionó (cómo pone el titular, cómo se ve el antes y
// después…) y no repetir lo que no.
//
// temp/_oficina/votos-imagenes.json: { votos: [{ id, lote, pieza, voto: 'bien'|'mal', motivo, titular, productoId,
//   archivo (copia en temp/_oficina/votos/<id>.<ext>), fecha }] }
//
//   votar({ lote, pieza, voto, motivo }) -> el voto      votosDelLote(lote) -> { <pieza>: { voto, motivo } }
//   leccionesParaLaCoordinadora(productoId) -> texto con las buenas y las malas (rutas para que las mire con Read)
//   leccionesParaElModelo(productoId) -> texto corto en inglés para el prompt de la imagen
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, RAIZ } from './rutas.js';
import { leerJSON } from './archivos.js';
import { escribirJSON, ErrorApp } from './productos.js';

const DIR = () => path.join(TEMP, '_oficina');
const ARCHIVO = () => path.join(DIR(), 'votos-imagenes.json');
const COPIAS = () => path.join(DIR(), 'votos');
const MAX = 300;

const leer = () => {
  const d = leerJSON(ARCHIVO());
  return Array.isArray(d?.votos) ? d : { votos: [] };
};

export function votosDelLote(lote) {
  const out = {};
  for (const v of leer().votos) if (v.lote === lote) out[v.pieza] = { voto: v.voto, motivo: v.motivo || '' };
  return out;
}

export async function votar({ lote, pieza, voto, motivo = '' } = {}) {
  if (!/^_?[a-z0-9-]{3,120}$/.test(String(lote || '')) || !/^V\d{2,3}_(1x1|9x16)$/.test(String(pieza || ''))) throw new ErrorApp(400, 'No encuentro esa imagen.');
  if (!['bien', 'mal', 'nada'].includes(voto)) throw new ErrorApp(400, 'El voto es «bien» o «mal».');
  const { carpetaDe, R } = await import('./imagen-ads/disco.js');
  const carpeta = carpetaDe(lote);
  const v = leerJSON(path.join(carpeta, `${pieza.split('_')[0]}.json`)) || {};
  const brief = leerJSON(R.brief(carpeta)) || {};
  // la imagen de la pieza (con el logo si lo lleva, si no la de img/)
  const img = [R.final(carpeta, pieza), R.img(carpeta, pieza)].find((f) => fs.existsSync(f)) || null;
  const d = leer();
  const antes = d.votos.find((x) => x.lote === lote && x.pieza === pieza);
  if (voto === 'nada') {
    d.votos = d.votos.filter((x) => x !== antes);
    if (antes?.archivo) fs.rmSync(path.join(RAIZ, antes.archivo), { force: true });
    escribirJSON(ARCHIVO(), d);
    return { voto: null };
  }
  const id = antes?.id || crypto.randomBytes(6).toString('hex');
  let archivo = antes?.archivo || null;
  if (img && !archivo) {
    fs.mkdirSync(COPIAS(), { recursive: true });
    const destino = path.join(COPIAS(), `${id}.png`);
    fs.copyFileSync(img, destino);
    archivo = path.relative(RAIZ, destino).replace(/\\/g, '/');
  }
  const titular = String((v.text_layers || [])[0]?.text || '').slice(0, 200);
  const nuevo = { id, lote, pieza, voto, motivo: String(motivo || '').replace(/\s+/g, ' ').trim().slice(0, 300), titular, cambio: String(v.app_chat?.cambio || '').slice(0, 300), productoId: brief.productoId || null, archivo, fecha: new Date().toISOString() };
  d.votos = [...d.votos.filter((x) => x !== antes), nuevo].slice(-MAX);
  escribirJSON(ARCHIVO(), d);
  return nuevo;
}

const deEste = (productoId) => {
  const vs = leer().votos;
  // (las de este producto primero; después las demás: lo que funciona en la estructura vale entre productos)
  return [...vs.filter((x) => x.productoId === productoId), ...vs.filter((x) => x.productoId !== productoId)].reverse();
};

export function leccionesParaLaCoordinadora(productoId = null) {
  const vs = deEste(productoId);
  const bien = vs.filter((x) => x.voto === 'bien').slice(0, 8);
  const mal = vs.filter((x) => x.voto === 'mal').slice(0, 8);
  if (!bien.length && !mal.length) return '';
  const linea = (x) => `- «${x.titular || 'sin titular'}»${x.cambio ? ` (${x.cambio})` : ''}${x.motivo ? ` — dijo: ${x.motivo}` : ''}${x.archivo ? ` · imagen: ${x.archivo}` : ''}`;
  return `Lo que el usuario votó en las imágenes que hiciste (míralas con Read antes de proponer variaciones nuevas; NO para copiarlas, sino para seguir lo que funcionó: cómo va el titular y qué tan enganchador es, la modelo, el antes y después, los detalles):
🟢 LE GUSTARON:
${bien.map(linea).join('\n') || '- (ninguna todavía)'}
🔴 NO QUIERE OTRA VEZ:
${mal.map(linea).join('\n') || '- (ninguna todavía)'}`;
}

export function leccionesParaElModelo(productoId = null) {
  const vs = deEste(productoId);
  const bien = vs.filter((x) => x.voto === 'bien' && x.titular).slice(0, 5);
  const mal = vs.filter((x) => x.voto === 'mal').slice(0, 5);
  if (!bien.length && !mal.length) return '';
  return [
    bien.length ? `What the client APPROVED before (follow how they work, do not copy them): headlines like ${bien.map((x) => `"${x.titular}"`).join(', ')}.` : '',
    mal.length ? `What the client REJECTED before (avoid it): ${mal.map((x) => [x.titular && `"${x.titular}"`, x.motivo].filter(Boolean).join(' — ')).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
