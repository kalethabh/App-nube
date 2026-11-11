// Las sesiones de la IA (Claude o ChatGPT) de un lote de ANUNCIOS DE IMAGEN (ESPECIFICACION-imagen-ads.md §7): que lee,
// que escribe (una lista exacta: nunca un comodin, asi la IA no toca un V##.json que el motor esta usando), cuantos
// pasos y cuanto tiempo tiene, el texto de la tarea y lo que revisa la app al final.
//
//   sesionEstrategia({ carpeta, lote, brief })                 producto, estrategia, plan y los primeros 4 anuncios
//   sesionPrompts({ carpeta, lote, brief, ids })               los V##.json que faltan (de a 8; de a 4 con ChatGPT)
//   sesionRevision({ carpeta, lote, brief, tanda, t })         una tanda de revision (de un solo formato)
//   sesionAjuste({ carpeta, lote, brief, tanda, pedidos })     lo que pidio el usuario, con instruccion
//   permisos(lote, escribe, { conSkill, claude })
// Cada una devuelve { tipo, prompt, escribe, maxTurnos, timeoutMin, verificar, conSkill, material, esfuerzo? }.
//
// `material` es lo que la sesion lee, dicho entero (DISENO-motor-codex §2.6): ChatGPT trabaja sin herramientas y la
// app le pasa eso (textos pegados, imagenes adjuntas y, `aPedido`, una lista de lo que puede pedir). Claude lo ignora:
// lee lo mismo con Read. Solo entra lo que existe, con rutas desde la raiz (temp/<lote>/… y .claude/skills/…).
//
// Todas: sin terminal (Bash y PowerShell prohibidos), sin internet, sin Skill, sin leer produccion/ ni el .env
// (claude.prohibidasComunes), con la carpeta del lote y la skill de solo lectura.
import fs from 'node:fs';
import path from 'node:path';
import { textoClaude, prohibidasComunes as prohibidasDeClaude } from '../claude.js';
import { leerJSON, existe } from '../archivos.js';
import { leerSkill, verificarSesion, DIR_SKILL } from './verificar.js';
import { R, idsDelLote, piezaId, vDe, formatoDe, fotoDelLote, nombreFormato } from './disco.js';

export const HERRAMIENTAS = ['Read', 'Glob', 'Grep', 'Write', 'Edit'];
export const SKILL = 'anuncios-imagen-ads';

/** Las reglas de permisos de una sesion: lee el lote (y la skill), escribe SOLO `escribe` (relativos a la carpeta). */
export function permisos(lote, escribe, { conSkill = true, claude = null } = {}) {
  const c = `./temp/${lote}`;
  return {
    herramientas: HERRAMIENTAS,
    permitidas: [`Read(${c}/**)`, ...(conSkill ? [`Read(./.claude/skills/${SKILL}/**)`] : []), 'Glob', 'Grep', ...escribe.flatMap((f) => [`Write(${c}/${f})`, `Edit(${c}/${f})`])],
    prohibidas: typeof claude?.prohibidasComunes === 'function' ? claude.prohibidasComunes({ terminal: false }) : prohibidasDeClaude({ terminal: false }),
  };
}

/** "V01, V02, V03 y V04" */
export function listaDeIds(ids) {
  if (ids.length <= 1) return ids.join('');
  return `${ids.slice(0, -1).join(', ')} y ${ids[ids.length - 1]}`;
}

const DONDE = {
  'arriba-izquierda': 'arriba a la izquierda',
  'arriba-centro': 'arriba al centro',
  'arriba-derecha': 'arriba a la derecha',
  'abajo-izquierda': 'abajo a la izquierda',
  'abajo-centro': 'abajo al centro',
  'abajo-derecha': 'abajo a la derecha',
};

/** "arriba al centro" (1:1) · "arriba al centro, justo debajo del 15 % de arriba" (9:16). */
export function zonaTexto(posicion, formato) {
  const d = DONDE[posicion] || DONDE['arriba-centro'];
  if (formato !== '9:16') return d;
  return String(posicion).startsWith('abajo') ? `${d}, justo encima del 15 % de abajo` : `${d}, justo debajo del 15 % de arriba`;
}

/** El parrafo del logo para las tareas que escriben anuncios (vacio si el lote no lleva logo). */
function textoLogo(brief) {
  const pos = brief?.logo?.posicion;
  if (!pos) return '';
  const vertical = (brief.formatos || []).includes('9:16');
  const posicionTexto = `${DONDE[pos] || DONDE['arriba-centro']}${vertical ? ' (en el cuadrado, a un 4-5 % del borde; en el vertical, un poco más adentro, dentro de la zona segura)' : ', a un 4-5 % del borde'}`;
  return `## Logo\nEste lote lleva el logo real de la marca: la app lo pega después, ya generada la imagen, ${posicionTexto}. En el \`visual_prompt\` de cada variación deja esa zona como fondo limpio, sin texto, bloque, persona ni producto, con un poco de aire alrededor (ningún botón, sello ni texto pegado a ella); si el formato tenía algo ahí, córrelo un poco hacia adentro. Lo mismo en el \`reference_position\` de cada capa de \`text_layers\`: ningún texto va en esa zona (por ejemplo, con el logo arriba al centro el titular no va «Top center» pegado al borde, sino «Top center, just below the empty logo band»). El modelo de imagen pone cada texto donde dice su \`reference_position\`. No dibujes ni describas ningún logo (como dice la skill).`;
}

const sinSaltos = (t, max = 600) => String(t || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------------------------------------------------------------- el material (lo que lee cada sesion)

const DE_LA_SKILL = `.claude/skills/${SKILL}`;

/** Una ruta de la skill ('SKILL.md', 'formatos/F01-….json') desde la raiz, o null si no esta. */
const deLaSkill = (rel) => (rel && existe(path.join(DIR_SKILL, ...String(rel).split('/'))) ? `${DE_LA_SKILL}/${rel}` : null);

/** Una ruta del lote ('entrada/producto.png') desde la raiz (temp/<lote>/…), o null si no esta en su carpeta. */
const delLote = (carpeta, lote, rel) => (rel && existe(path.join(carpeta, ...String(rel).split('/'))) ? `temp/${lote}/${rel}` : null);

/** Sin vacios ni repetidos, en el orden en que vienen. */
const unicas = (lista) => [...new Set(lista.filter(Boolean))];

/** Los formatos/*.json de la skill (los 56 formatos y su indice), por nombre. */
function formatosDeLaSkill() {
  try {
    return fs
      .readdirSync(path.join(DIR_SKILL, 'formatos'))
      .filter((n) => n.toLowerCase().endsWith('.json'))
      .sort()
      .map((n) => `${DE_LA_SKILL}/formatos/${n}`);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- la estrategia (todo el lote y los primeros anuncios)

export function sesionEstrategia({ carpeta, lote, brief }) {
  const n = Number(brief.cantidad) || 1;
  const refs = (brief.referencias || []).slice(0, n);
  const k = refs.length;
  const ids = idsDelLote(Math.min(n, 4));
  const { angulos } = leerSkill();
  const angulo = brief.datos?.angulo ? angulos.get(brief.datos.angulo) : null;
  const datos = {
    nombre: brief.datos?.nombre || '',
    publico: brief.datos?.publico || '',
    precio: brief.datos?.precio || '',
    moneda: brief.datos?.moneda || '',
    cta: brief.datos?.cta || '',
    pais: brief.datos?.pais || '',
    idioma: brief.datos?.idioma || 'es',
    adicional: brief.datos?.adicional || '',
    angulo_preferido: angulo ? angulo.id : '',
  };
  const foto = `temp/${lote}/${fotoDelLote(carpeta) || 'entrada/producto.png'}`;
  const usados = leerJSON(R.usados(carpeta));
  const valores = {
    lote,
    datos: JSON.stringify(datos, null, 2),
    cantidad: String(n),
    proporciones: (brief.formatos || ['1:1']).join(' y '),
    angulo: angulo ? `${angulo.nombre} (${angulo.id})` : 'que lo elija la IA',
    foto,
    ficha: existe(R.ficha(carpeta)) ? `- Lo que la app ya sabe del producto: \`temp/${lote}/entrada/ficha-producto.json\`. Es contexto; manda lo que dice el formulario.` : '',
    referencias: k
      ? `- Imágenes de referencia, en este orden: ${refs.map((r, i) => `${idsDelLote(k)[i]} = \`temp/${lote}/${r}\``).join(', ')}. Mira cada una con Read (PASO 4, punto 1, y Protocolo de Traducción Estructural).${(brief.referencias || []).length > n ? ` (El usuario subió ${brief.referencias.length}: se usan las primeras ${n}.)` : ''}`
      : '- No hay referencias: todas las variaciones salen de la biblioteca.',
    anterior: existe(R.anterior(carpeta))
      ? `- Este producto ya tuvo un lote: \`temp/${lote}/entrada/lote-anterior.json\` trae su identidad visual y la descripción del producto. Mantenlas (es la misma marca). Los beneficios, las características, los titulares y todos los textos los escribes nuevos.`
      : '',
    usados: Array.isArray(usados) && usados.length
      ? `- Combinaciones de ángulo y formato ya usadas en lotes anteriores de este producto: \`temp/${lote}/entrada/usados.json\` (evítalas, PASO 4). No abras otras carpetas de \`temp/\`.`
      : '',
    ids: listaDeIds(ids),
    ultimo: idsDelLote(n)[n - 1],
    partes: n > 40 ? 'Son muchas: escribe primero el archivo con las 40 primeras y agrega las demás con Edit, en tramos de 30, antes de seguir.' : '',
    logo: textoLogo(brief),
  };
  // la skill fija (106 KB) pegada; la foto y las referencias adjuntas; la ficha, el lote anterior y lo ya usado, si
  // existen; los 57 formatos a pedido (elige los de V01-V04 despues de armar el plan) y, con 9:16, proporciones.md
  const material = {
    textos: unicas([
      deLaSkill('SKILL.md'),
      deLaSkill('angulos.json'),
      deLaSkill('formatos/indice.json'),
      delLote(carpeta, lote, 'entrada/ficha-producto.json'),
      delLote(carpeta, lote, 'entrada/lote-anterior.json'),
      delLote(carpeta, lote, 'entrada/usados.json'),
    ]),
    imagenes: unicas([delLote(carpeta, lote, fotoDelLote(carpeta)), ...refs.map((r) => delLote(carpeta, lote, r))]),
    aPedido: unicas([...formatosDeLaSkill(), (brief.formatos || []).includes('9:16') && deLaSkill('proporciones.md')]),
  };
  return {
    tipo: 'estrategia',
    ids,
    prompt: textoClaude('tarea-imagen-ads-estrategia', valores),
    escribe: ['producto.json', 'estrategia.json', 'plan.json', ...ids.map((v) => `${v}.json`), 'app/imagen-ads/bloqueo.json'],
    maxTurnos: 80 + 2 * k,
    timeoutMin: Math.min(120, 25 + 0.4 * n),
    conSkill: true,
    material,
    esfuerzo: 'alto',
    verificar: async () => verificarSesion({ carpeta, brief, tipo: 'estrategia', ids }),
  };
}

// ---------------------------------------------------------------- los anuncios que faltan (de a 8; de a 4 con ChatGPT)

export function sesionPrompts({ carpeta, lote, brief, ids }) {
  const plan = leerJSON(R.plan(carpeta));
  const variaciones = ids
    .map((v) => (plan?.variaciones || []).find((x) => x?.id === v))
    .filter(Boolean)
    .map((x) => (x.fuente === 'referencia' && x.referencia && !String(x.referencia).startsWith('temp/') ? { ...x, referencia: `temp/${lote}/${String(x.referencia).replace(/^.*?(entrada\/referencias\/)/i, '$1')}` } : x));
  // la skill, producto.json y plan.json pegados; el formato de cada variacion de la biblioteca (formato_id -> el
  // archivo del indice) y, adjunta, la referencia de cada una que sale de una (solo las de la carpeta del lote)
  const { formatos } = leerSkill();
  const deEsteLote = `temp/${lote}/`;
  const material = {
    textos: unicas([
      deLaSkill('SKILL.md'),
      delLote(carpeta, lote, 'producto.json'),
      delLote(carpeta, lote, 'plan.json'),
      ...variaciones.filter((x) => x.fuente !== 'referencia' && x.formato_id).map((x) => deLaSkill(formatos.get(x.formato_id)?.archivo)),
    ]),
    imagenes: unicas(
      variaciones
        .filter((x) => x.fuente === 'referencia' && x.referencia && String(x.referencia).startsWith(deEsteLote))
        .map((x) => delLote(carpeta, lote, String(x.referencia).slice(deEsteLote.length)))
    ),
  };
  return {
    tipo: 'prompts',
    ids,
    prompt: textoClaude('tarea-imagen-ads-prompts', { lote, ids: listaDeIds(ids), variaciones: JSON.stringify(variaciones, null, 2), logo: textoLogo(brief) }),
    escribe: [...ids.map((v) => `${v}.json`), 'app/imagen-ads/bloqueo.json'],
    maxTurnos: 60,
    timeoutMin: 35,
    conSkill: true,
    material,
    esfuerzo: 'alto',
    verificar: async () => verificarSesion({ carpeta, brief, tipo: 'prompts', ids }),
  };
}

// ---------------------------------------------------------------- la revision

export function sesionRevision({ carpeta, lote, brief, tanda, t }) {
  const vertical = t.formato === '9:16';
  const conLogo = Boolean(brief?.logo?.posicion);
  const c = `temp/${lote}`;
  const foto = (fotoDelLote(carpeta) || 'entrada/producto.png').replace(/^entrada\//, '');
  const lista = t.piezas
    .map(({ pieza }) => {
      const v = vDe(pieza);
      const recortes = [1, 2, 3, 4].map((i) => `${c}/revision/${pieza}_r${i}.png`).join(', ');
      const cuadrado = vertical ? ` · su cuadrado ${c}/revision/${piezaId(v, '1:1')}_vista.jpg` : '';
      return `- ${pieza} (${nombreFormato(formatoDe(pieza))}): vista ${c}/revision/${pieza}_vista.jpg · recortes ${recortes} · anuncio ${c}/${v}.json${cuadrado}`;
    })
    .join('\n');
  const valores = {
    lote,
    fotoProducto: foto,
    yCuadrado: vertical ? ' (y, en las verticales, la vista de su cuadrado)' : '',
    criterioVertical: vertical ? 'Además, en las verticales: es el mismo anuncio que su cuadrado (mismos textos, colores, persona y producto).' : '',
    criterioLogo: conLogo
      ? `Además: la zona ${zonaTexto(brief.logo.posicion, t.formato)} está reservada para el logo real, que la app pega después. Si ahí hay texto, el producto o una persona, es un fallo. Que esté vacía no es un fallo.`
      : '',
    lista,
    tanda,
  };
  const piezas = t.piezas.map((x) => x.pieza);
  // lo mismo que nombra la lista: la foto y, por pieza, su vista, sus 4 recortes (nunca se achican: ahi se leen las
  // letras) y, en las verticales, la vista de su cuadrado; los V##.json pegados. 8 cuadrados = 41 imagenes.
  const material = {
    textos: unicas(piezas.map((p) => delLote(carpeta, lote, `${vDe(p)}.json`))),
    imagenes: unicas([
      delLote(carpeta, lote, `entrada/${foto}`),
      ...piezas.flatMap((p) => [
        delLote(carpeta, lote, `revision/${p}_vista.jpg`),
        ...[1, 2, 3, 4].map((i) => delLote(carpeta, lote, `revision/${p}_r${i}.png`)),
        vertical ? delLote(carpeta, lote, `revision/${piezaId(vDe(p), '1:1')}_vista.jpg`) : null,
      ]),
    ]),
  };
  return {
    tipo: 'revision',
    prompt: textoClaude('tarea-imagen-ads-revision', valores),
    escribe: [`revision/${tanda}.json`],
    maxTurnos: 120,
    timeoutMin: 30,
    conSkill: false,
    material,
    verificar: async () => verificarSesion({ carpeta, brief, tipo: 'revision', tanda, piezas }),
  };
}

// ---------------------------------------------------------------- los ajustes que pidio el usuario

export function sesionAjuste({ carpeta, lote, brief, tanda, pedidos }) {
  const c = `temp/${lote}`;
  const lineas = pedidos
    .map((p) => {
      const v = vDe(p.pieza);
      const vista = existe(R.vista(carpeta, p.pieza)) ? ` · vista ${c}/revision/${p.pieza}_vista.jpg` : ' · (esta imagen todavía no existe)';
      return `- ${p.id} · ${p.pieza} (${nombreFormato(formatoDe(p.pieza))}): «${sinSaltos(p.instruccion)}»${vista} · anuncio ${c}/${v}.json`;
    })
    .join('\n');
  const vs = [...new Set(pedidos.map((p) => `${vDe(p.pieza)}.json`))];
  // la skill y cada V##.json pedido, pegados; la vista de cada imagen y la foto del producto (la tarea no la nombra,
  // pero Claude la puede abrir), adjuntas
  const material = {
    textos: unicas([deLaSkill('SKILL.md'), ...vs.map((v) => delLote(carpeta, lote, v))]),
    imagenes: unicas([...pedidos.map((p) => delLote(carpeta, lote, `revision/${p.pieza}_vista.jpg`)), delLote(carpeta, lote, fotoDelLote(carpeta))]),
  };
  return {
    tipo: 'ajuste',
    prompt: textoClaude('tarea-imagen-ads-ajuste', { lote, pedidos: lineas, tanda }),
    escribe: [...vs, `ajustes/${tanda}.json`],
    maxTurnos: 40,
    timeoutMin: 20,
    conSkill: true,
    material,
    verificar: async () => verificarSesion({ carpeta, brief, tipo: 'ajuste', tanda, pedidos: pedidos.map((p) => ({ id: p.id, pieza: p.pieza })) }),
  };
}
