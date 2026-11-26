// QUÉ TAN DISTINTAS (2026-11-26a). Pedido: «de un ganador salen 10 casi iguales y Meta (Andromeda) castiga lo
// parecido». En «Variantes» el usuario elige el nivel:
//   fieles     el camino de «Replicar validado» (mismo diseño; cambian modelo, escena, pose y titular)
//   vecinas    (por defecto) la mitad con el ángulo del ganador y el resto con ≥3 ángulos más; ≥2 variables de
//              Andromeda cambian en cada una
//   conceptos  cada una con un concepto de formato distinto (por `angulos_compatibles` y `tipos_producto`)
// Antes de todo, la IA analiza el ganador (`analisis.json`: lo que vende y lo que no se toca).
//
// Aquí viven las REGLAS DURAS que revisa la app en el plan de «Vecinas» y «Conceptos» (si fallan, la IA lo rehace en la
// misma sesión), la validación del análisis y el nombre de descarga de cada imagen. Todo puro: se prueba solo
// (app/herramientas/probar-variaciones-imagen.mjs).
//
//   NIVELES · nivelDe(brief) · esVariado(brief) · conAnalisis(brief)
//   errorDeAnalisis(analisis, skill)                     -> [errores]
//   cupos(n, nivel)                                      -> { maxFormato, maxGanador, angulos, nativas, protagonistas, … }
//   reglasDelPlan(plan, { nivel, analisis, skill, historial, venta }) -> { errores, avisos }
//   nombreDeDescarga({ producto, v, formatoId, anguloId, formato, skill })  'producto_V03-F17-ugc-selfie-transformacion.png'
//
// (2026-11-26b) ESTRUCTURAS GANADORAS (Mayaverra): en un lote cada imagen sale de una ESTRUCTURA distinta y se rotan el
// estilo (foto real, 3D, ilustración, bodegón, carta de texto), la zona del cuerpo y el segmento: nunca el mismo estilo,
// la misma zona ni el mismo segmento dos veces seguidas. Las fichas de cada estructura (.claude/skills/
// anuncios-imagen-ads/estructuras/mv-XX.json) se validan con errorDeFicha. Nada se rehace solo (decisión del usuario):
// la revisión marca y propone el prompt corregido; rehacer necesita su sí (npm run rehacer).
export const NIVELES = ['fieles', 'vecinas', 'conceptos'];
export const ESTILOS = ['foto-real', '3d-pixar', 'ilustracion-plana', 'bodegon-premium', 'carta-de-texto'];
export const GANCHOS = ['resultado', 'mecanismo', 'segmento', 'oferta', 'emocion', 'urgencia'];
export const DOLORES = ['cuerpo-real-antes-despues', '3d-cartoon-antes-despues', 'ilustracion-plana', 'invisible-visible', 'ninguno'];
export const BENEFICIOS = ['iconos', 'linea-de-tiempo', 'circulo-frasco', 'ninguno'];
export const PRUEBAS = ['clientes', 'garantia', 'terceros', 'hecho-a-mano', 'ninguna'];
export const OFERTAS = ['tachado-por-unidad', '3x2', '2+1', 'porcentaje-estrella', 'barra', 'ninguna'];
export const CTAS = ['boton', 'pildora', 'ninguno'];
/** Los 7 criterios de la comparación contra la referencia (0-10; pasa con 8 o más en todos). */
export const CRITERIOS = ['estructura', 'dolor_visual', 'titular', 'texto_limpio', 'frasco_fiel', 'oferta_confianza', 'diferencia_real'];
export const NOTA_MINIMA = 8;
export const NOMBRES_CRITERIOS = {
  estructura: 'Estructura',
  dolor_visual: 'Dolor visual',
  titular: 'Titular',
  texto_limpio: 'Texto limpio',
  frasco_fiel: 'Frasco fiel',
  oferta_confianza: 'Oferta y confianza',
  diferencia_real: 'Diferencia real',
};

export const nivelDe = (brief) => (brief?.modo === 'variantes' && NIVELES.includes(brief?.variacion) ? brief.variacion : null);
/** «Vecinas» o «Conceptos nuevos»: la estrategia de la IA con las reglas duras (el ganador solo como estilo). */
export const esVariado = (brief) => ['vecinas', 'conceptos'].includes(nivelDe(brief));
/** Todo lote de «Variantes» con el selector nuevo analiza primero su ganador. */
export const conAnalisis = (brief) => Boolean(nivelDe(brief)) && (brief?.referencias || []).length > 0;

export const CONCIENCIA = ['inconsciente', 'consciente-del-problema', 'consciente-de-la-solucion', 'consciente-del-producto', 'muy-consciente'];
export const VARIABLES = ['faceta', 'problema', 'deseo', 'contexto', 'formato'];

const conTexto = (x) => typeof x === 'string' && x.trim().length > 0;
const listaConTexto = (x) => Array.isArray(x) && x.some(conTexto);
/** Para comparar: minúsculas, sin tildes ni signos, espacios simples. */
export const normal = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
// «sin modelo», «no hay», «ninguno»: un anuncio sin persona puede repetirlo
const VACIO_VALIDO = /^(sin |no hay|no aplica|ninguna?o?\b|n a$|solo (el )?producto)/;

// ---------------------------------------------------------------- el análisis del ganador

/** Los errores de `analisis.json` (vacío = está bien). `skill` = leerSkill() de verificar.js. */
export function errorDeAnalisis(a, skill) {
  if (!a || typeof a !== 'object') return ['falta analisis.json (o no es JSON válido)'];
  const e = [];
  for (const k of ['deseo_central', 'dolor_principal', 'promesa', 'emocion', 'mecanismo_persuasion', 'esencia']) if (!conTexto(a[k])) e.push(`falta "${k}" (una frase)`);
  if (!CONCIENCIA.includes(a.nivel_conciencia)) e.push(`"nivel_conciencia" tiene que ser uno de: ${CONCIENCIA.join(', ')} (Schwartz)`);
  if (!conTexto(a.hook_visual?.que) || !conTexto(a.hook_visual?.por_que)) e.push('falta "hook_visual" con "que" (lo que se ve primero) y "por_que" (por qué detiene el scroll)');
  for (const k of ['invariables', 'modificables', 'experimentales']) if (!listaConTexto(a[k])) e.push(`falta "${k}" (una lista de frases)`);
  if (conTexto(a.esencia) && a.esencia.split(/\s+/).length > 30) e.push('"esencia" es una sola frase corta (hasta 30 palabras)');
  if (skill && !skill.formatos.has(a.formato_ganador)) e.push(`"formato_ganador": "${a.formato_ganador ?? ''}" no está en formatos/indice.json (el más parecido al ganador)`);
  if (skill && !skill.angulos.has(a.angulo_ganador)) e.push(`"angulo_ganador": "${a.angulo_ganador ?? ''}" no está en angulos.json`);
  return e;
}

// ---------------------------------------------------------------- la ficha de una estructura ganadora

/** Los errores de una ficha de estructura (estructuras/mv-XX.json). Vacío = está bien. */
export function errorDeFicha(f) {
  if (!f || typeof f !== 'object') return ['no es JSON válido'];
  const e = [];
  if (!/^[a-z]{2,4}-\d{2}$/.test(String(f.id || ''))) e.push('"id" como mv-01');
  if (!conTexto(f.referencia)) e.push('falta "referencia" (la imagen)');
  if (!f.zonas || typeof f.zonas !== 'object' || Object.values(f.zonas).filter(conTexto).length < 2) e.push('"zonas": al menos 2 (arriba, centro, abajo) con su %');
  else for (const [k, v] of Object.entries(f.zonas)) if (conTexto(v) && !/\d+ ?%/.test(v)) e.push(`zonas.${k}: falta el % aproximado del lienzo`);
  const t = f.titular || {};
  if (!(Number.isInteger(t.lineas) && t.lineas >= 1 && t.lineas <= 6)) e.push('titular.lineas: un número');
  if (!(Number.isInteger(t.palabras) && t.palabras >= 0)) e.push('titular.palabras: un número (0 si no lleva titular)');
  if (!conTexto(t.resaltada)) e.push('titular.resaltada: qué palabra va resaltada (o «ninguna»)');
  if (!GANCHOS.includes(t.gancho)) e.push(`titular.gancho: uno de ${GANCHOS.join(', ')}`);
  if (!DOLORES.includes(f.dolor_visual?.tipo)) e.push(`dolor_visual.tipo: uno de ${DOLORES.join(', ')}`);
  if (!conTexto(f.zona_del_cuerpo)) e.push('falta "zona_del_cuerpo"');
  if (!conTexto(f.segmento)) e.push('falta "segmento"');
  if (!BENEFICIOS.includes(f.beneficios?.tipo)) e.push(`beneficios.tipo: uno de ${BENEFICIOS.join(', ')}`);
  if (!Array.isArray(f.prueba) || !f.prueba.length || f.prueba.some((x) => !PRUEBAS.includes(x))) e.push(`prueba: lista de ${PRUEBAS.join(', ')}`);
  if (!OFERTAS.includes(f.oferta?.tipo)) e.push(`oferta.tipo: uno de ${OFERTAS.join(', ')}`);
  if (!CTAS.includes(f.cta?.tipo)) e.push(`cta.tipo: uno de ${CTAS.join(', ')}`);
  if (typeof f.franja_confianza !== 'string') e.push('falta "franja_confianza" (o «ninguna»)');
  if (!ESTILOS.includes(f.estilo)) e.push(`estilo: uno de ${ESTILOS.join(', ')}`);
  return e;
}

// ---------------------------------------------------------------- los cupos (con 10, tal cual el pedido; escalados)

/**
 * Con 10: máx. 2 por formato (y 2 con el del ganador), ≥4 ángulos, ≥3 nativas y ≥3 con el producto protagonista.
 * Con menos se escala hacia abajo; con más, hacia arriba (sin pedir más ángulos de los que hay).
 */
export function cupos(n, nivel = 'vecinas') {
  const k = Math.max(1, Number(n) || 1);
  const r = (x) => Math.round(x * k / 10);
  const c = {
    // (2026-11-26b) cada imagen con una estructura distinta (con lotes muy grandes, lo mínimo que alcanza)
    maxFormato: Math.max(1, Math.ceil(k / 40)),
    maxGanador: 1,
    estilos: Math.min(k, 3),
    angulos: Math.min(12, k <= 2 ? 1 : Math.max(2, r(4))),
    nativas: k < 3 ? 0 : Math.max(1, r(3)),
    protagonistas: k < 3 ? 0 : Math.max(1, r(3)),
    nuevasCombinaciones: Math.min(k, 3),
  };
  // «Vecinas»: la mitad con el ángulo del ganador (±1)
  if (nivel === 'vecinas') c.mitad = { min: Math.max(1, Math.floor(k / 2) - 1), max: Math.max(1, Math.ceil(k / 2) + 1) };
  return c;
}

// ---------------------------------------------------------------- las reglas duras del plan

/** Cuántas estructuras distintas (familias de formato) sirven para un ángulo. */
export function estructurasPara(skill, anguloId) {
  return new Set([...skill.formatos.values()].filter((f) => !f.angulos_compatibles?.length || f.angulos_compatibles.includes(anguloId)).map((f) => f.familia || f.id)).size;
}

const CAMPOS = ['escena', 'modelo', 'vestuario', 'camara', 'paleta_secundaria'];
// (2026-11-26b) lo que rota: nunca igual dos veces seguidas
const ROTAN = [
  ['estilo', 'el estilo'],
  ['zona_del_cuerpo', 'la zona del cuerpo'],
  ['segmento', 'el segmento'],
];

/**
 * Las reglas de «Vecinas» y «Conceptos» sobre plan.json (los errores, en frases que la IA entiende y corrige).
 * `historial`: [{ formato_id, angulo_id, compras, cpa }] de ventas reales de este producto (ventas.js), o [].
 */
export function reglasDelPlan(plan, { nivel = 'vecinas', analisis = null, skill, historial = [], tipoProducto = null, rotarZona = true } = {}) {
  const errores = [];
  const avisos = [];
  const vs = Array.isArray(plan?.variaciones) ? plan.variaciones : [];
  const n = vs.length;
  if (!n || !skill) return { errores, avisos };
  const c = cupos(n, nivel);
  const fmt = (id) => skill.formatos.get(id);
  const familia = (id) => fmt(id)?.familia || id;
  const ganadorF = analisis?.formato_ganador;
  const ganadorA = analisis?.angulo_ganador;
  const famGanador = ganadorF ? familia(ganadorF) : null;

  vs.forEach((x, i) => {
    const d = `plan.json → variaciones[${i}] (${x?.id || '?'})`;
    if (x?.fuente !== 'biblioteca') errores.push(`${d}.fuente: en este nivel todas salen de un formato de la biblioteca ("biblioteca"); el ganador va solo como referencia de estilo`);
    const f = fmt(x?.formato_id);
    if (!f) errores.push(`${d}.formato_id: "${x?.formato_id ?? ''}" no está en formatos/indice.json`);
    if (!skill.angulos.has(x?.angulo_id)) errores.push(`${d}.angulo_id: "${x?.angulo_id ?? ''}" no está en angulos.json`);
    for (const k of CAMPOS) if (!conTexto(x?.[k])) errores.push(`${d}.${k}: falta (una frase concreta)`);
    if (!conTexto(x?.por_que_vende)) errores.push(`${d}.por_que_vende: falta (una frase: por qué debería vender)`);
    const cambiadas = Array.isArray(x?.variables_cambiadas) ? [...new Set(x.variables_cambiadas.filter((v) => VARIABLES.includes(v)))] : [];
    if (cambiadas.length < 2) errores.push(`${d}.variables_cambiadas: cambia al menos 2 variables de Andromeda (${VARIABLES.join(', ')}) respecto del ganador`);
    if (typeof x?.mismo_formato_que_ganador !== 'boolean') errores.push(`${d}.mismo_formato_que_ganador: true o false`);
    else if (f && famGanador && x.mismo_formato_que_ganador !== (familia(x.formato_id) === famGanador)) {
      errores.push(`${d}.mismo_formato_que_ganador: tiene que ser ${familia(x.formato_id) === famGanador} (el ganador es ${ganadorF}, de la familia «${famGanador}»)`);
    }
    if (f && skill.angulos.has(x?.angulo_id) && Array.isArray(f.angulos_compatibles) && f.angulos_compatibles.length && !f.angulos_compatibles.includes(x.angulo_id)) {
      errores.push(`${d}: el formato ${x.formato_id} no sirve para el ángulo ${x.angulo_id} (sus ángulos compatibles: ${f.angulos_compatibles.join(', ')})`);
    }
    if (!ESTILOS.includes(x?.estilo)) errores.push(`${d}.estilo: uno de ${ESTILOS.join(', ')}`);
    else if (f?.estilo && x.estilo !== f.estilo) errores.push(`${d}.estilo: el formato ${x.formato_id} es «${f.estilo}»`);
    for (const k of ['zona_del_cuerpo', 'segmento']) if (!conTexto(x?.[k])) errores.push(`${d}.${k}: falta (por ejemplo ${k === 'segmento' ? '«mujeres 40+»' : '«glúteos»'}, o «ninguna»)`);
    if (f && tipoProducto && Array.isArray(f.tipos_producto) && !f.tipos_producto.includes('todos') && !f.tipos_producto.includes(tipoProducto)) {
      avisos.push(`${x.id}: el formato ${x.formato_id} no es de los pensados para un producto «${tipoProducto}»`);
    }
  });

  // formatos: ninguno más de lo permitido (por familia: un antes/después es uno aunque tenga tres archivos)
  const porFamilia = new Map();
  for (const x of vs) if (fmt(x?.formato_id)) porFamilia.set(familia(x.formato_id), [...(porFamilia.get(familia(x.formato_id)) || []), x.id]);
  for (const [fam, ids] of porFamilia) {
    const tope = fam === famGanador ? c.maxGanador : c.maxFormato;
    if (ids.length > tope) {
      errores.push(
        nivel === 'conceptos'
          ? `plan.json: «Conceptos nuevos» lleva un concepto de formato distinto en cada una, y ${ids.join(', ')} repiten el formato «${fam}»`
          : tope === 1
            ? `plan.json: cada imagen sale de una estructura distinta, y ${ids.join(', ')} repiten el formato «${fam}»${fam === famGanador ? ' (el del ganador: cambia de estructura)' : ''}`
            : `plan.json: el formato «${fam}»${fam === famGanador ? ' (el del ganador)' : ''} sale ${ids.length} veces (${ids.join(', ')}); máximo ${tope}`,
      );
    }
  }

  // ángulos
  const angulos = vs.map((x) => x?.angulo_id).filter((a) => skill.angulos.has(a));
  const distintos = new Set(angulos).size;
  if (distintos < c.angulos) errores.push(`plan.json: hay ${distintos} ángulos distintos; tienen que ser al menos ${c.angulos}`);
  if (ganadorA && vs[0]?.angulo_id !== ganadorA) errores.push(`plan.json → V01: va primero el ángulo del ganador (${ganadorA})`);
  if (nivel === 'vecinas' && ganadorA && c.mitad) {
    const conGanador = angulos.filter((a) => a === ganadorA).length;
    // (cada imagen con una estructura distinta: no se pueden pedir más que las estructuras que sirven para ese ángulo)
    c.mitad.min = Math.min(c.mitad.min, estructurasPara(skill, ganadorA));
    if (conGanador < c.mitad.min || conGanador > c.mitad.max) errores.push(`plan.json: en «Vecinas» la mitad usa el ángulo del ganador (${ganadorA}): entre ${c.mitad.min} y ${c.mitad.max} (hay ${conGanador})`);
  }

  // nada repetido entre variaciones: escena, modelo, vestuario, cámara y paleta secundaria
  for (const k of CAMPOS) {
    const vistos = new Map();
    for (const x of vs) {
      const t = normal(x?.[k]);
      if (!t || VACIO_VALIDO.test(t)) continue;
      if (vistos.has(t)) errores.push(`plan.json: ${x.id} repite ${k === 'camara' ? 'la cámara' : k === 'paleta_secundaria' ? 'la paleta secundaria' : `${k === 'escena' ? 'la escena' : k === 'modelo' ? 'la modelo' : 'el vestuario'}`} de ${vistos.get(t)} («${String(x[k]).slice(0, 60)}»): cada una distinta`);
      else vistos.set(t, x.id);
    }
  }

  // estilo, zona y segmento rotan: nunca iguales dos seguidas; y al menos 3 estilos (con 3 o más imágenes)
  // (2026-11-26e) con una sola zona del producto (p. ej. solo abdomen), la zona no puede rotar
  for (const [k, nombre] of ROTAN.filter(([k]) => rotarZona || k !== 'zona_del_cuerpo')) {
    for (let i = 1; i < n; i++) {
      const a = normal(vs[i - 1]?.[k]);
      const b = normal(vs[i]?.[k]);
      if (a && b && a === b && !VACIO_VALIDO.test(b)) errores.push(`plan.json: ${vs[i - 1].id} y ${vs[i].id} van seguidas con ${nombre} «${vs[i][k]}»: rótalo`);
    }
  }
  const estilos = new Set(vs.map((x) => x?.estilo).filter((x) => ESTILOS.includes(x))).size;
  if (estilos < c.estilos) errores.push(`plan.json: hay ${estilos} estilos; usa al menos ${c.estilos} (${ESTILOS.join(', ')})`);

  // nativas y con el producto protagonista (las marcas las pone la app en indice.json, no la IA)
  const nativas = vs.filter((x) => fmt(x?.formato_id)?.nativo === true).length;
  const protas = vs.filter((x) => fmt(x?.formato_id)?.protagonista === true).length;
  if (nativas < c.nativas) errores.push(`plan.json: hay ${nativas} con formato nativo (parece contenido orgánico: ${[...skill.formatos.values()].filter((f) => f.nativo).map((f) => f.id).join(', ')}); tienen que ser al menos ${c.nativas}`);
  if (protas < c.protagonistas) errores.push(`plan.json: hay ${protas} con el producto protagonista (${[...skill.formatos.values()].filter((f) => f.protagonista).map((f) => f.id).join(', ')}); tienen que ser al menos ${c.protagonistas}`);

  // lo que ya vendió (ventas reales): se prioriza y se prueban siempre combinaciones nuevas
  const hist = (Array.isArray(historial) ? historial : []).filter((h) => h?.formato_id && h?.angulo_id);
  if (hist.length) {
    const conocidas = new Set(hist.map((h) => `${h.formato_id}+${h.angulo_id}`));
    const nuevas = vs.filter((x) => !conocidas.has(`${x?.formato_id}+${x?.angulo_id}`)).length;
    if (nuevas < c.nuevasCombinaciones) errores.push(`plan.json: prueba al menos ${c.nuevasCombinaciones} combinaciones de formato + ángulo NUEVAS (que no estén en las ventas de este producto); hay ${nuevas}`);
    const ganadoras = hist.filter((h) => Number(h.compras) > 0);
    if (ganadoras.length && !vs.some((x) => ganadoras.some((h) => h.formato_id === x?.formato_id || h.angulo_id === x?.angulo_id))) {
      errores.push(`plan.json: usa en al menos una variación el formato o el ángulo que más vendió (${ganadoras.slice(0, 3).map((h) => `${h.formato_id} + ${h.angulo_id}`).join(', ')})`);
    }
  }
  return { errores, avisos };
}

// ---------------------------------------------------------------- reglas de conversión de cada anuncio (V##.json)

/** El titular de un V##.json: la capa que dice headline/titular (o la primera). */
export function titularDe(ad) {
  const capas = Array.isArray(ad?.text_layers) ? ad.text_layers : [];
  const t = capas.find((x) => /headline|titular|title|hook/i.test(`${x?.block_id || ''} ${x?.reference_function || ''} ${x?.role || ''}`)) || capas[0];
  return String(t?.text || '');
}

/**
 * Lo que revisa la app en el texto de cada anuncio de «Vecinas»/«Conceptos» (y en la oferta y los sellos del formulario
 * en todos los lotes que los traen): la oferta y los sellos letra por letra, el titular afirmativo y corto, nada de
 * «Prohibido decir».
 */
export function reglasDelAnuncio(ad, { venta = null, estricto = false } = {}) {
  const errores = [];
  const capas = (Array.isArray(ad?.text_layers) ? ad.text_layers : []).map((x) => String(x?.text || ''));
  const todo = capas.join(' \n ');
  const junta = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  if (venta?.oferta && !capas.some((t) => junta(t).includes(junta(venta.oferta)))) errores.push(`text_layers: falta la oferta del formulario letra por letra: «${venta.oferta}» (en su propia capa)`);
  for (const s of venta?.sellos || []) if (!capas.some((t) => junta(t).includes(junta(s)))) errores.push(`text_layers: falta el sello de confianza del formulario letra por letra: «${s}»`);
  const bajo = normal(todo);
  for (const p of venta?.prohibido || []) {
    const q = normal(p);
    if (q && new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(bajo)) errores.push(`text_layers: dice «${p}», que está en «Prohibido decir»`);
  }
  if (estricto) {
    const t = titularDe(ad);
    if (/[¿?]/.test(t)) errores.push(`el titular «${t}» es una pregunta: tiene que ser afirmativo`);
    const palabras = t.split(/\s+/).filter(Boolean).length;
    if (palabras > 9) errores.push(`el titular «${t}» tiene ${palabras} palabras: máximo 8 (un solo mensaje)`);
    const beneficios = (Array.isArray(ad?.text_layers) ? ad.text_layers : []).filter((x) => /benefit|beneficio|bullet|check/i.test(`${x?.block_id || ''} ${x?.reference_function || ''}`)).length;
    if (beneficios > 4) errores.push(`lleva ${beneficios} beneficios: máximo 4`);
  }
  return errores;
}

// ---------------------------------------------------------------- el nombre de descarga

const kebab = (t, max = 40) => normal(t).replace(/ñ/g, 'n').replace(/\s+/g, '-').slice(0, max).replace(/-+$/, '');

/** 'producto_V03-F17-ugc-selfie-transformacion.png' (sin formato: 'producto_V03.png'). `formato` '9:16' agrega '-9x16'. */
export function nombreDeDescarga({ producto, v, formatoId = null, anguloId = null, formato = '1:1', skill = null }) {
  const p = kebab(producto, 30) || 'anuncio';
  const entrada = formatoId && skill?.formatos?.get(formatoId);
  const archivo = entrada?.archivo;
  const slugFormato = entrada?.slug || (archivo ? String(archivo).split('/').pop().replace(/\.json$/i, '') : formatoId || '');
  const partes = [v, slugFormato, anguloId ? kebab(anguloId, 30) : ''].filter(Boolean).join('-');
  return `${p}_${partes}${formato === '9:16' ? '-9x16' : ''}.png`;
}
