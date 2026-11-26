// REHACER UNA IMAGEN DE UN LOTE (2026-11-26b): `npm run rehacer` para las piezas de un lote de anuncios de imagen
// (temp/_img-…). Misma regla que con las tomas de video: nunca se inventa un prompt nuevo por cuenta propia; se muestra,
// el usuario dice sí y recién entonces se pide la imagen (que cobra). La pide la app que está abierta (la que produce el
// lote), con su costo confirmado: así el estado del lote, la revisión y la comparación siguen igual que con «Regenerar».
//
//   npm run rehacer temp/_img-x --pieza V02_1x1 --contexto          lo que salió mal, los puntajes, el prompt y el costo
//   npm run rehacer temp/_img-x --pieza V02_1x1 --aplicar nuevo.json --solo-plan   qué cambia y cuánto cuesta (no cobra)
//   npm run rehacer temp/_img-x --pieza V02_1x1 --aplicar nuevo.json --si          aplica el prompt aprobado y la pide
//   npm run rehacer temp/_img-x --pieza V02_1x1 --si                               otra vez con el prompt de ahora
//
// nuevo.json trae solo lo que cambia del anuncio (V##.json): { "visual_prompt": "…", "text_layers": [ … ] }. El V##.json
// anterior queda como V##.antes-<fecha>.json.
import fs from 'node:fs';
import path from 'node:path';

const CAMBIABLES = ['visual_prompt', 'text_layers', 'mandatory_visual_elements', 'final_generation_exclusions', 'global_identity', 'art_direction'];
const leer = (r) => {
  try {
    return JSON.parse(fs.readFileSync(r, 'utf8'));
  } catch {
    return null;
  }
};

export function esLoteDeImagenes(carpeta) {
  return /^_img-/.test(path.basename(path.resolve(carpeta))) && fs.existsSync(path.join(carpeta, 'app', 'brief.json'));
}

/** Lo que hay que saber antes de rehacer una pieza (sin cobrar nada). */
export function contexto(carpeta, pieza) {
  const v = pieza.split('_')[0];
  const ad = leer(path.join(carpeta, `${v}.json`));
  const est = leer(path.join(carpeta, 'app', 'imagen-ads', 'estado.json'));
  const p = est?.piezas?.[pieza] || null;
  const prompt = fs.existsSync(path.join(carpeta, 'prompts', `${pieza}.txt`)) ? fs.readFileSync(path.join(carpeta, 'prompts', `${pieza}.txt`), 'utf8') : null;
  return { v, ad, revision: p?.revision || null, version: p?.version || 0, prompt };
}

/** Aplica lo aprobado al V##.json (deja una copia de antes). -> los campos cambiados */
export function aplicar(carpeta, pieza, nuevo) {
  const v = pieza.split('_')[0];
  const ruta = path.join(carpeta, `${v}.json`);
  const ad = leer(ruta);
  if (!ad) throw new Error(`No encuentro ${v}.json en el lote.`);
  const cambios = Object.keys(nuevo || {}).filter((k) => CAMBIABLES.includes(k));
  const otros = Object.keys(nuevo || {}).filter((k) => !CAMBIABLES.includes(k));
  if (otros.length) throw new Error(`nuevo.json solo puede cambiar ${CAMBIABLES.join(', ')} (trae ${otros.join(', ')}).`);
  if (!cambios.length) throw new Error('nuevo.json no cambia nada.');
  fs.copyFileSync(ruta, path.join(carpeta, `${v}.antes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
  fs.writeFileSync(ruta, JSON.stringify({ ...ad, ...Object.fromEntries(cambios.map((k) => [k, nuevo[k]])) }, null, 2) + '\n');
  return cambios;
}

async function api(base, ruta, cuerpo) {
  const r = await fetch(base + ruta, { method: cuerpo ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || `La app respondió ${r.status}.`);
  return d;
}

export async function main(args) {
  const carpetaArg = args.find((a, i) => !a.startsWith('--') && !['--pieza', '--aplicar'].includes(args[i - 1]));
  const carpeta = path.resolve(carpetaArg || '.');
  const pieza = args[args.indexOf('--pieza') + 1];
  if (!args.includes('--pieza') || !/^V\d{2,3}_(1x1|9x16)$/.test(String(pieza))) {
    console.error('\n  Uso: npm run rehacer temp/_img-<lote> --pieza V02_1x1 [--contexto | --aplicar nuevo.json] [--solo-plan | --si]\n');
    return 1;
  }
  const base = `http://127.0.0.1:${process.env.PUERTO || 4455}`;
  const lote = path.basename(carpeta);
  const c = contexto(carpeta, pieza);
  const op = await api(base, '/api/imagen-ads/opciones').catch(() => null);
  const formatos = (leer(path.join(carpeta, 'app', 'brief.json'))?.formatos || ['1:1']).length;
  const imagenes = pieza.endsWith('_1x1') ? formatos : 1;
  const porImagen = Number(op?.costo?.dolaresPorImagen) || 0;
  const costo = op?.costo?.conChatGPT ? 0 : Math.round(porImagen * imagenes * 100) / 100;
  const textoCosto = op ? (op.costo?.conChatGPT ? 'sin costo por imagen (tu ChatGPT)' : `US$${costo.toFixed(2)} (${imagenes} imagen${imagenes === 1 ? '' : 'es'}${imagenes > 1 ? ': el cuadrado y su vertical' : ''})`) : '(abre la app para saber el costo)';

  if (args.includes('--contexto')) {
    console.log(`\n  ${pieza} de ${lote} (versión ${c.version})`);
    if (c.revision?.puntajes) console.log(`  Puntajes: ${Object.entries(c.revision.puntajes).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    for (const t of c.revision?.problemas || []) console.log(`  - ${t}`);
    if (c.revision?.correccion_en) console.log(`\n  Corrección propuesta por la revisión:\n  ${c.revision.correccion_en}`);
    console.log(`\n  visual_prompt de ahora:\n  ${c.ad?.visual_prompt || '(sin anuncio)'}`);
    console.log(`\n  Textos: ${(c.ad?.text_layers || []).map((t) => JSON.stringify(t.text)).join(' · ')}`);
    console.log(`\n  Rehacerla cuesta ${textoCosto}. Escribe lo que cambia en un nuevo.json y córrelo con --aplicar nuevo.json --solo-plan.\n`);
    return 0;
  }
  const iA = args.indexOf('--aplicar');
  const nuevo = iA !== -1 ? leer(path.resolve(args[iA + 1] || '')) : null;
  if (iA !== -1 && !nuevo) {
    console.error(`\n  No pude leer ${args[iA + 1]} (tiene que ser JSON).\n`);
    return 1;
  }
  if (args.includes('--solo-plan') || !args.includes('--si')) {
    console.log(`\n  ${pieza} de ${lote}: ${nuevo ? `cambiaría ${Object.keys(nuevo).join(', ')} de ${c.v}.json` : 'se pediría otra vez con el mismo anuncio'}.`);
    if (nuevo?.visual_prompt) console.log(`\n  visual_prompt nuevo:\n  ${nuevo.visual_prompt}`);
    console.log(`\n  Costo: ${textoCosto}. No se pidió nada. Para hacerlo, el usuario dice sí y se corre lo mismo con --si.\n`);
    return 0;
  }
  if (!op) {
    console.error(`\n  La app no está abierta en ${base}: ábrela (es la que pide la imagen) y vuelve a correr esto.\n`);
    return 1;
  }
  if (nuevo) console.log(`  Aplicado en ${c.v}.json: ${aplicar(carpeta, pieza, nuevo).join(', ')}`);
  const r = await api(base, `/api/imagen-ads/${encodeURIComponent(lote)}/regenerar`, { pieza, costoMaximoConfirmado: costo });
  console.log(`\n  Pedida (${r?.pedido?.id || 'sin número'}, ${r?.pedido?.estado || ''}). Costo máximo confirmado: ${textoCosto}. La ves en la pantalla del lote.\n`);
  return 0;
}
