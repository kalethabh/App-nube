// Lo que revisa la app en lo que escribe Claude para un lote de ANUNCIOS DE IMAGEN (ESPECIFICACION-imagen-ads.md §7.6).
// Frena SOLO lo seguro (esquema, ids, cantidades, largo del prompt): junta todos los errores y claude.js le manda a
// Claude los 12 primeros para que los corrija en la misma sesion. Lo demas (bloques del formato, precio donde el formato
// no tiene lugar, un par angulo + formato repetido) es solo un aviso: queda en el registro y nunca frena.
//
//   verificarSesion({ carpeta, brief, tipo, ids, tanda, piezas, pedidos })  -> { ok, errores, avisos, final?, bloqueado?, error? }
//   verificarProducto · verificarEstrategia · verificarPlan · verificarV · verificarRevision · verificarAjuste
//   leerBloqueo(carpeta) · leerSkill()
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS } from '../rutas.js';
import { leerJSON, existe } from '../archivos.js';
import { validarEsquema, cargarEsquema } from '../claude.js';
import { construirPrompt, construirPromptVertical } from '../../../../produccion/imagen-ads.js';
import { R, RE_V, idsDelLote, piezaId } from './disco.js';

export const DIR_SKILL = path.join(SKILLS, 'anuncios-imagen-ads');
export const TOPE_PROMPT_VERIFICADO = 19000;

// ---------------------------------------------------------------- la skill (angulos y formatos)

let cacheSkill = null;
/** { angulos: Map(id -> angulo), formatos: Map(id -> entrada del indice) } de la skill (se lee una vez). */
export function leerSkill() {
  if (cacheSkill) return cacheSkill;
  const a = leerJSON(path.join(DIR_SKILL, 'angulos.json'));
  const i = leerJSON(path.join(DIR_SKILL, 'formatos', 'indice.json'));
  cacheSkill = {
    angulos: new Map((a?.angulos || []).map((x) => [x.id, x])),
    formatos: new Map((i?.formatos || []).map((x) => [x.id, x])),
  };
  return cacheSkill;
}

const cacheFormato = new Map();
function archivoDeFormato(id) {
  if (cacheFormato.has(id)) return cacheFormato.get(id);
  const e = leerSkill().formatos.get(id);
  const f = e?.archivo ? leerJSON(path.join(DIR_SKILL, e.archivo)) : null;
  cacheFormato.set(id, f);
  return f;
}

// ---------------------------------------------------------------- utilidades

const nombre = (ruta) => path.basename(ruta);
const conTexto = (x) => typeof x === 'string' && x.trim().length > 0;

/** Lee y valida un JSON contra su esquema: { datos, errores }. */
function leerConEsquema(ruta, esquema) {
  let texto;
  try {
    texto = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  } catch {
    return { datos: null, errores: [`Falta ${nombre(ruta)}: tienes que escribirlo.`] };
  }
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch (e) {
    return { datos: null, errores: [`${nombre(ruta)} no es JSON válido (${e.message}). Revisa comillas dobles y comas.`] };
  }
  const errores = validarEsquema(datos, cargarEsquema(esquema)).map((e) => `${nombre(ruta)} → ${e}`);
  return { datos, errores };
}

/** El logo del lote como lo entiende el motor (la posicion), o null. */
export const logoDelBrief = (brief) => (brief?.logo?.posicion ? brief.logo.posicion : null);

/** Lo que dice el bloqueo que escribio Claude (o null). */
export function leerBloqueo(carpeta) {
  const b = leerJSON(R.bloqueo(carpeta));
  if (!b) return null;
  const faltan = Array.isArray(b.faltan) ? b.faltan.filter(conTexto) : [];
  const motivo = conTexto(b.motivo) ? b.motivo.trim() : 'A la IA le falta un dato de tu producto para armar los anuncios.';
  return faltan.length ? `${motivo} Falta: ${faltan.join(', ')}.` : motivo;
}

// ---------------------------------------------------------------- cada archivo

export function verificarProducto(carpeta) {
  const { datos, errores } = leerConEsquema(R.productoJson(carpeta), 'imagen-ads-producto');
  return { datos, errores };
}

export function verificarEstrategia(carpeta) {
  return leerConEsquema(R.estrategia(carpeta), 'imagen-ads-estrategia');
}

/** plan.json: cantidad, ids en orden, las primeras K de referencia y las demas de la biblioteca. */
export function verificarPlan(carpeta, brief) {
  const { datos, errores } = leerConEsquema(R.plan(carpeta), 'imagen-ads-plan');
  if (!datos) return { datos, errores };
  const n = Number(brief?.cantidad) || 0;
  const subidas = (brief?.referencias || []).length;
  // «más de lo mismo» (brief.fiel): TODAS salen de las referencias, repartidas en orden (V01 = R01, V02 = R02, … y vuelve a R01)
  const todas = Boolean(brief?.fiel && subidas);
  const k = todas ? n : Math.min(n, subidas);
  const ids = idsDelLote(n);
  if (datos.cantidad !== n) errores.push(`plan.json → cantidad: tiene que ser ${n}`);
  const vs = Array.isArray(datos.variaciones) ? datos.variaciones : [];
  if (vs.length !== n) errores.push(`plan.json → variaciones: tienen que ser ${n} (hay ${vs.length})`);
  const { angulos, formatos } = leerSkill();
  vs.forEach((x, i) => {
    const donde = `plan.json → variaciones[${i}]`;
    if (x?.id !== ids[i]) errores.push(`${donde}.id: tiene que ser "${ids[i] || '?'}" (van de ${ids[0]} a ${ids[ids.length - 1]}, en orden)`);
    if (!RE_V.test(String(x?.id || ''))) return;
    if (i < k) {
      if (x.fuente !== 'referencia') errores.push(`${donde}.fuente: ${todas ? 'en este lote todas' : `las primeras ${k}`} salen de las referencias ("referencia")`);
      const ref = String(x.referencia || '').replace(/\\/g, '/');
      const esperada = (brief.referencias || [])[todas ? i % subidas : i];
      const enRefs = /(^|\/)entrada\/referencias\/R\d{2}\.[a-z]+$/i.test(ref) && (!todas || path.basename(ref) === path.basename(esperada));
      if (!enRefs || !existe(path.join(carpeta, ref.replace(/^.*?(entrada\/referencias\/)/i, '$1')))) {
        errores.push(`${donde}.referencia: tiene que ser la ruta de su imagen de entrada/referencias/ (${esperada || 'R01…'})`);
      }
    } else {
      if (x.fuente !== 'biblioteca') errores.push(`${donde}.fuente: tiene que ser "biblioteca"`);
      if (!formatos.has(x.formato_id)) errores.push(`${donde}.formato_id: "${x.formato_id ?? ''}" no está en formatos/indice.json`);
      if (!angulos.has(x.angulo_id)) errores.push(`${donde}.angulo_id: "${x.angulo_id ?? ''}" no está en angulos.json`);
    }
  });
  return { datos, errores };
}

/** El largo de los prompts que va a armar el motor con este anuncio (el cuadrado y el vertical, con el logo del lote). */
export function largosDePrompt(ad, brief) {
  const logo = logoDelBrief(brief);
  let cuadrado = 0;
  let vertical = 0;
  try {
    cuadrado = construirPrompt(ad, { logo }).length;
  } catch {
    cuadrado = Infinity;
  }
  if ((brief?.formatos || []).includes('9:16')) {
    try {
      vertical = construirPromptVertical(ad, { conProducto: true, logo }).length;
    } catch {
      vertical = Infinity;
    }
  }
  return { cuadrado, vertical };
}

/** V##.json: lo que el motor necesita para armar el prompt. Devuelve { datos, errores, avisos }. */
export function verificarV(carpeta, v, { brief, plan = null, usados = [] } = {}) {
  const ruta = R.v(carpeta, v);
  const { datos, errores } = leerConEsquema(ruta, 'imagen-ads-variacion');
  const avisos = [];
  if (!datos) return { datos, errores, avisos };
  if (datos.ad_info?.variation_id !== v) errores.push(`${v}.json → ad_info.variation_id: tiene que ser "${v}"`);
  (Array.isArray(datos.text_layers) ? datos.text_layers : []).forEach((t, i) => {
    if (!conTexto(t?.text)) errores.push(`${v}.json → text_layers[${i}].text: está vacío (si no va, saca esa capa)`);
  });
  if (!errores.length) {
    const { cuadrado, vertical } = largosDePrompt(datos, brief);
    if (cuadrado > TOPE_PROMPT_VERIFICADO || vertical > TOPE_PROMPT_VERIFICADO) {
      errores.push(`${v}.json → el prompt que se arma con este anuncio es demasiado largo: acorta el visual_prompt de ${v}`);
    }
  }
  // ---- solo avisos (nunca frenan), y solo en las variaciones de la biblioteca
  const enPlan = (plan?.variaciones || []).find((x) => x?.id === v);
  if (enPlan?.fuente === 'biblioteca' && enPlan.formato_id) {
    const f = archivoDeFormato(enPlan.formato_id);
    if (f) {
      const bloques = new Set((f.detected_visual_blocks || []).map((b) => b.block_id));
      const textos = new Set((f.text_layers || []).map((b) => b.block_id));
      for (const b of datos.reference_structure_analysis?.detected_visual_blocks || []) {
        if (b?.block_id && !bloques.has(b.block_id)) avisos.push(`${v}: el bloque ${b.block_id} no está en el formato ${enPlan.formato_id}`);
      }
      for (const t of datos.text_layers || []) {
        if (t?.block_id && !textos.has(t.block_id)) avisos.push(`${v}: el texto ${t.block_id} no está en el formato ${enPlan.formato_id}`);
      }
      const usadosAhora = new Set([...(datos.reference_structure_analysis?.detected_visual_blocks || []).map((b) => b?.block_id), ...(datos.text_layers || []).map((t) => t?.block_id)]);
      for (const b of [...(f.detected_visual_blocks || []), ...(f.text_layers || [])]) {
        if (b?.block_id && !JSON.stringify(b).includes('(OPTIONAL)') && !usadosAhora.has(b.block_id)) avisos.push(`${v}: falta el bloque ${b.block_id} del formato ${enPlan.formato_id}`);
      }
      const dePrecio = [...(f.detected_visual_blocks || []).map((b) => b.block_type), ...(f.text_layers || []).map((t) => t.reference_function)].some((s) => /price|precio|offer|oferta|discount|descuento/i.test(String(s || '')));
      const digitos = String(brief?.datos?.precio || '').replace(/[^\d]/g, '');
      if (!dePrecio && digitos.length >= 2 && (datos.text_layers || []).some((t) => String(t?.text || '').replace(/[^\d]/g, '').includes(digitos))) {
        avisos.push(`${v}: lleva el precio y el formato ${enPlan.formato_id} no tiene lugar para el precio`);
      }
    }
    if (usados.some((x) => x?.angulo_id === enPlan.angulo_id && x?.formato_id === enPlan.formato_id)) {
      avisos.push(`${v}: el par ${enPlan.angulo_id} + ${enPlan.formato_id} ya se usó en un lote anterior de este producto`);
    }
  }
  return { datos, errores, avisos };
}

/** revision/R###.json: estan todas las piezas de la tanda (y ninguna mas), con ok y sus problemas. */
export function verificarRevision(carpeta, tanda, piezas) {
  const { datos, errores } = leerConEsquema(R.revision(carpeta, tanda), 'imagen-ads-revision');
  if (!datos) return { datos, errores };
  const esperadas = new Set(piezas);
  const vistas = new Set();
  for (const [i, x] of (datos.revisadas || []).entries()) {
    if (!esperadas.has(x?.pieza)) errores.push(`${tanda}.json → revisadas[${i}].pieza: "${x?.pieza ?? ''}" no está en la lista de esta revisión`);
    else if (vistas.has(x.pieza)) errores.push(`${tanda}.json → ${x.pieza} está dos veces`);
    vistas.add(x?.pieza);
    if (x?.ok === false && !(Array.isArray(x.problemas) && x.problemas.some(conTexto))) errores.push(`${tanda}.json → ${x?.pieza}: con "ok": false, escribe en "problemas" qué está mal`);
  }
  for (const p of esperadas) if (!vistas.has(p)) errores.push(`${tanda}.json → falta ${p} (una entrada por imagen de la lista)`);
  return { datos, errores };
}

/** ajustes/A###.json: estan todos los pedidos; lo aplicado trae su instruccion y deja el V##.json valido. */
export function verificarAjuste(carpeta, tanda, pedidos, brief) {
  const { datos, errores } = leerConEsquema(R.ajuste(carpeta, tanda), 'imagen-ads-ajuste');
  if (!datos) return { datos, errores };
  const esperados = new Map(pedidos.map((p) => [p.id, p]));
  const vistos = new Set();
  for (const [i, x] of (datos.pedidos || []).entries()) {
    const ped = esperados.get(x?.id);
    if (!ped) {
      errores.push(`${tanda}.json → pedidos[${i}].id: "${x?.id ?? ''}" no es uno de los pedidos`);
      continue;
    }
    vistos.add(x.id);
    if (x.aplicado === true) {
      if (!conTexto(x.instruccion_en)) errores.push(`${tanda}.json → ${x.id}: falta "instruccion_en" (la instrucción para el modelo, en inglés)`);
      const v = ped.pieza.split('_')[0];
      const r = verificarV(carpeta, v, { brief });
      errores.push(...r.errores);
    } else if (!conTexto(x.motivo)) errores.push(`${tanda}.json → ${x.id}: con "aplicado": false, explica en "motivo" por qué no se puede`);
  }
  for (const id of esperados.keys()) if (!vistos.has(id)) errores.push(`${tanda}.json → falta el pedido ${id}`);
  return { datos, errores };
}

// ---------------------------------------------------------------- lo que revisa cada sesion

/**
 * El `verificar` de cada sesion de Claude. Con bloqueo.json: { ok: false, final: true, bloqueado: true, error } (no se
 * le pide corregir: falta un dato). Los avisos quedan en `avisos` (el que llama los anota en el registro).
 *   tipo 'estrategia': producto.json, estrategia.json, plan.json y los V de `ids`
 *   tipo 'prompts':    los V de `ids`
 *   tipo 'revision':   revision/<tanda>.json con `piezas`
 *   tipo 'ajuste':     ajustes/<tanda>.json con `pedidos` ([{ id, pieza }])
 */
export function verificarSesion({ carpeta, brief, tipo, ids = [], tanda = null, piezas = [], pedidos = [] }) {
  if (['estrategia', 'prompts'].includes(tipo) && existe(R.bloqueo(carpeta))) {
    return { ok: false, final: true, bloqueado: true, error: leerBloqueo(carpeta), errores: [] };
  }
  const errores = [];
  const avisos = [];
  if (tipo === 'estrategia') {
    errores.push(...verificarProducto(carpeta).errores, ...verificarEstrategia(carpeta).errores, ...verificarPlan(carpeta, brief).errores);
  }
  if (tipo === 'estrategia' || tipo === 'prompts') {
    const plan = leerJSON(R.plan(carpeta));
    const usados = leerJSON(R.usados(carpeta)) || [];
    for (const v of ids) {
      const r = verificarV(carpeta, v, { brief, plan, usados: Array.isArray(usados) ? usados : [] });
      errores.push(...r.errores);
      avisos.push(...r.avisos);
    }
  }
  if (tipo === 'revision') errores.push(...verificarRevision(carpeta, tanda, piezas).errores);
  if (tipo === 'ajuste') errores.push(...verificarAjuste(carpeta, tanda, pedidos, brief).errores);
  return { ok: errores.length === 0, errores, avisos };
}

/** Las piezas que tiene un lote segun su brief (para validar una pieza que llega de afuera). */
export function piezasDelBrief(brief) {
  return idsDelLote(brief?.cantidad).flatMap((v) => (brief?.formatos || ['1:1']).map((f) => piezaId(v, f)));
}
