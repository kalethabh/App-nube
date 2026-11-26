// El estado de un lote de ANUNCIOS DE IMAGEN: app/imagen-ads/estado.json (ESPECIFICACION-imagen-ads.md §4.3). Su UNICO
// escritor es el paso `anuncios` de la familia, que lo lee una vez al empezar y despues trabaja en memoria y lo guarda de
// una vez (temporal + renombre) cuando cambia. Las rutas solo lo leen.
//
//   cargarYNormalizar(carpeta, brief, { uuidEstrategia, motorEstrategia, simulada })   el estado al empezar el paso (o
//                                       al volver a abrir la app): retoma las tandas cortadas, aplica la revision que ya
//                                       estaba escrita y reconoce las ordenes al motor que quedaron sin anotar
//   guardar(carpeta, est)               solo si cambio
//   vistaDelLote({...})                 lo que ve la pantalla (GET /api/imagen-ads/:lote, §9.2)
//   resumenDelLote(carpeta, brief, conductor)  lo de "Tus lotes" (con `motor`: la IA del lote, o la del plan que espera;
//                                       `mosaico`: sus primeros cuadrados, hasta 4; `foto`: la del producto del lote)
//   motorDelLote(est, conductor)        la IA que hizo la estrategia: 'claude' | 'codex' | null
//
// La sesion de la estrategia (tandas.E001) guarda `motor`: la IA que la hizo ('claude' o 'codex'). La vista la manda
// como `motor` (el informe dice quien hizo el lote).
import fs from 'node:fs';
import path from 'node:path';
import { completarVariacionesFieles } from './variaciones-fieles.js';
import { leerJSON, existe, listar } from '../archivos.js';
import { nivelDe, nombreDeDescarga, CRITERIOS, NOMBRES_CRITERIOS, NOTA_MINIMA } from './variedad.js';
import { estructurasDelLote, evaluarPuntajes } from './comparacion.js';
import { nuevoEstado, asegurarPiezas, aplicarRevision, listaDePiezas, cuentas, PEDIDO_TERMINADO } from './planificador.js';
import { verificarRevision, leerSkill } from './verificar.js';
import { borrarRecortes, finalAlDia, sha1DelLogo } from './local.js';
import { R, firma, guardarJSON, siguienteEnDisco, idsDelLote, piezaId, vDe, formatoDe, nombreFormato, kebab, ordenDeV, fotoDelLote } from './disco.js';
import { plantillaDe, piezaLocal, estadoComposicion } from './plantillas.js';
import { POR_ID, CATALOGO } from './catalogo-plantillas.js';

const ultimoGuardado = new Map(); // carpeta -> el texto que se guardo la ultima vez
const MOTORES_VALIDOS = new Set(['claude', 'codex']);

/**
 * La IA que hizo la estrategia del lote: la de tandas.E001 o, si todavia no esta en el estado, la del paso. Un lote
 * con estado y sin ninguna de las dos es de antes de poder elegir la IA: lo hizo Claude. Sin estado ni paso, null.
 */
export function motorDelLote(est, conductor = null) {
  const deE = est?.tandas?.E001?.motor;
  if (MOTORES_VALIDOS.has(deE)) return deE;
  const delPaso = conductor?.pasos?.find((p) => p.id === 'estrategia')?.motor;
  if (MOTORES_VALIDOS.has(delPaso)) return delPaso;
  return est?.tandas?.E001 ? 'claude' : null;
}

/** Lo que hay en disco (o null): solo para leer. */
export const leerEstado = (carpeta) => {
  const e = leerJSON(R.estado(carpeta));
  return e && typeof e === 'object' && e.piezas ? e : null;
};

/** Guarda el estado si cambio desde la ultima vez (de una vez: nunca queda a medias). true si escribio. */
export function guardar(carpeta, est) {
  const texto = JSON.stringify(est);
  if (ultimoGuardado.get(carpeta) === texto && existe(R.estado(carpeta))) return false;
  guardarJSON(R.estado(carpeta), est);
  ultimoGuardado.set(carpeta, texto);
  return true;
}

/** Los numeros de las tandas y las ordenes: nunca uno que ya este en disco. */
function ponerAlDiaNumeros(carpeta, est) {
  const s = (est.siguiente ||= { E: 1, R: 1, A: 1, T: 1 });
  const deTandas = (letra) => Math.max(0, ...Object.keys(est.tandas || {}).filter((k) => k.startsWith(letra)).map((k) => Number(k.slice(1)) || 0)) + 1;
  s.E = Math.max(Number(s.E) || 1, deTandas('E'));
  s.R = Math.max(Number(s.R) || 1, deTandas('R'), siguienteEnDisco(R.dirRevision(carpeta), /^R(\d+)\.json$/));
  s.A = Math.max(Number(s.A) || 1, deTandas('A'), siguienteEnDisco(R.ajustes(carpeta), /^A(\d+)\.json$/));
  s.T = Math.max(Number(s.T) || 1, siguienteEnDisco(R.motor(carpeta), /^T(\d+)\.json$/));
}

/**
 * El estado con el que empieza (o sigue) el paso `anuncios`:
 *   - la primera vez: todas las piezas esperando su anuncio, y los de la estrategia (E001) ya escritos;
 *   - una revision cortada: si su R###.json ya esta completo y es de esas mismas imagenes, se aplica; si no, la tanda
 *     se vuelve a correr con el mismo uuid (y la pieza cuya imagen cambio vuelve a esperar revision);
 *   - las tandas de anuncios y de ajustes cortadas se vuelven a correr con su uuid (las elige el planificador);
 *   - una orden al motor que quedo escrita sin anotarse en el estado se reconoce (asi nunca va dos veces).
 */
export function cargarYNormalizar(carpeta, brief, { uuidEstrategia = null, motorEstrategia = null, simulada = false } = {}) {
  const cantidad = Number(brief?.cantidad) || 0;
  const formatos = Array.isArray(brief?.formatos) && brief.formatos.length ? brief.formatos : ['1:1'];
  const motor = MOTORES_VALIDOS.has(motorEstrategia) ? motorEstrategia : null;
  let est = leerEstado(carpeta);
  if (!est) {
    est = nuevoEstado({ cantidad, formatos });
    // (el modo rápido escribe todos los anuncios de una vez: ninguno espera a la IA)
    // (y «Desde 0»: la app ya escribió todos los anuncios con sus 6 zonas)
    const ids = idsDelLote(brief?.rapido || brief?.desde0 ? cantidad : Math.min(cantidad, 4));
    est.tandas.E001 = { tipo: 'estrategia', ids, uuid: uuidEstrategia, motor: brief?.rapido ? null : motor, estado: 'hecha', ...(brief?.rapido ? { rapido: true } : {}) };
    for (const v of ids) est.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
    est.siguiente.E = 2;
  } else {
    asegurarPiezas(est, { cantidad, formatos });
    // (un estado de antes, sin la IA de la estrategia: se completa con la del paso, si se sabe)
    if (est.tandas?.E001 && !est.tandas.E001.motor && motor) est.tandas.E001.motor = motor;
  }
  // (2026-11-26b) nada se rehace solo (decisión del usuario): la revisión marca y propone; rehacer necesita su sí
  delete est.autoRehacer;
  // PLANTILLAS: lo que dibuja solo la app (las plantillas sin escena y los verticales, que reutilizan la escena del
  // cuadrado) nunca va al motor: queda «final» de entrada y la pantalla lo muestra cuando está dibujado.
  if (brief?.plantillas) {
    for (const [pieza, p] of Object.entries(est.piezas)) {
      if (p.local || !piezaLocal(plantillaDe(carpeta, vDe(pieza)), pieza)) continue;
      Object.assign(p, { fase: 'final', resultado: 'listo', version: Math.max(1, p.version || 0), orden: null, local: true });
    }
  }
  // Solo antes de arrancar piezas: los títulos comparten una plantilla validada por referencia.
  if (!leerEstado(carpeta)) {
    for (const v of completarVariacionesFieles(carpeta, brief, { normalizarIniciales: true })) est.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
  }
  ponerAlDiaNumeros(carpeta, est);

  for (const [id, t] of Object.entries(est.tandas)) {
    if (t.estado !== 'en-curso' || t.tipo !== 'revision') continue;
    const firmas = {};
    for (const x of t.piezas || []) {
      const p = est.piezas[x.pieza];
      const f = firma(R.img(carpeta, x.pieza));
      firmas[x.pieza] = f;
      if (p?.fase === 'revisando' && (simulada || f !== x.firma)) {
        p.fase = 'por-revisar';
        p.firma = f;
        delete p.tandaRevision;
      }
    }
    t.piezas = (t.piezas || []).filter((x) => est.piezas[x.pieza]?.fase === 'revisando' && est.piezas[x.pieza].tandaRevision === id);
    if (!t.piezas.length) {
      t.estado = 'anulada';
      continue;
    }
    const v = verificarRevision(carpeta, id, t.piezas.map((x) => x.pieza));
    if (!v.errores.length) {
      for (const p of aplicarRevision(est, id, v.datos, firmas)) borrarRecortes(carpeta, p);
    }
  }

  // ordenes que quedaron en disco sin anotarse (la app se cerro entre escribir T### y guardar el estado)
  for (const n of listar(R.motor(carpeta)).filter((x) => /^T\d+\.json$/.test(x))) {
    const o = leerJSON(R.orden(carpeta, n.replace(/\.json$/, '')));
    for (const x of o?.piezas || []) {
      const p = est.piezas[x.pieza];
      if (p && ['por-pedir', 'reintento'].includes(p.fase) && p.orden?.id === x.orden && !p.orden.trabajo) {
        p.fase = 'pedida';
        p.orden.trabajo = o.id;
      }
    }
  }
  // y al reves: una pieza anotada en una orden que no llego a escribirse vuelve a estar por pedir
  for (const p of Object.values(est.piezas)) {
    if (p.fase === 'pedida' && (!p.orden?.trabajo || !existe(R.orden(carpeta, p.orden.trabajo)))) {
      if (p.orden) delete p.orden.trabajo;
      p.fase = p.orden?.id === 'rev' ? 'reintento' : 'por-pedir';
    }
  }
  // Desde 2026-11-09 no hay reintento automatico (todo al primer intento: la revision solo deja su nota). Una pieza de
  // un lote de antes que quedo esperando el suyo y todavia no salio al motor queda «con detalles», con lo que vio la
  // revision (p.revision.problemas). La que ya esta en el motor ('pedida') se deja terminar: kie puede haberla cobrado.
  for (const p of Object.values(est.piezas)) {
    if (p.fase === 'reintento' && p.orden?.id === 'rev' && !p.orden.trabajo) {
      p.fase = 'final';
      p.resultado = 'con-detalles';
      p.ronda = p.revision?.ronda ?? 1;
      p.reintentoAuto = 'hecho';
      p.orden = null;
    }
  }
  return est;
}

// ---------------------------------------------------------------- lo que ve la pantalla

const ESTADO_FINAL = { listo: 'listo', arreglado: 'arreglado', 'con-detalles': 'te-necesita', 'sin-revisar': 'sin-revisar', 'sin-imagen': 'sin-imagen' };

/** El estado de una pieza como lo muestra la pantalla (§9.2). */
export function estadoEnPantalla(p, { pedido = null, sinPrompt = false } = {}) {
  if (sinPrompt) return 'sin-imagen';
  if (!p) return 'en-cola';
  if (p.fase === 'final' && pedido && !PEDIDO_TERMINADO.has(pedido.estado)) {
    return pedido.instruccion && ['pendiente', 'en-espera', 'ajustando'].includes(pedido.estado) ? 'ajustando' : 'regenerando';
  }
  switch (p.fase) {
    case 'espera-prompt':
    case 'espera-cuadrado':
      return 'en-cola';
    case 'por-pedir':
      return p.version >= 1 ? 'regenerando' : 'en-cola';
    case 'pedida':
      return (p.orden?.version || 1) > 1 || p.version >= 1 ? 'regenerando' : 'generando';
    case 'reintento':
      return 'regenerando';
    case 'por-revisar':
    case 'revisando':
      return 'revisando';
    case 'ajustando':
    // (2026-11-21h) kie la rechazó por contenido y la IA la está reescribiendo: en pantalla, «la IA prepara el cambio»
    case 'reescribiendo':
      return 'ajustando';
    case 'final':
      return ESTADO_FINAL[p.resultado] || 'listo';
    default:
      return 'en-cola';
  }
}

const enc = encodeURIComponent;

/** Los pedidos del usuario: los del estado y los que todavia no entraron (pedidos.json). */
function todosLosPedidos(carpeta, est) {
  const delEstado = est?.pedidos || {};
  const lista = Object.values(delEstado).map((x) => ({ ...x }));
  for (const x of leerJSON(R.pedidos(carpeta))?.pedidos || []) {
    if (x?.id && !delEstado[x.id]) lista.push({ id: x.id, ...(x.tipo === 'prompt' ? { tipo: 'prompt', v: x.v } : { pieza: x.pieza }), instruccion: x.instruccion || '', fecha: x.fecha, estado: 'pendiente' });
  }
  return lista.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** El pedido sin terminar que toca a esta pieza (el de su variacion: un cuadrado rehace tambien su vertical). */
function pedidoDe(pedidos, pieza) {
  const v = vDe(pieza);
  return pedidos.find((x) => !PEDIDO_TERMINADO.has(x.estado) && ((x.pieza && (x.pieza === pieza || (vDe(x.pieza) === v && formatoDe(x.pieza) === '1:1'))) || x.v === v || x.pasos?.some((s) => s.pieza === pieza))) || null;
}

/**
 * La vista de un lote para la pantalla (§9.2). Sin precios (el costo va solo en `informe`, y solo con el lote terminado)
 * y sin prompts. Las miniaturas las arma el servidor (la URL ya lleva su ?ancho=).
 */
/** Lo que se muestra del análisis del ganador (analisis-ganador.json del agente de variaciones). */
function resumenAnalisis(a) {
  if (!a || (!Array.isArray(a.referencias) && !a.angulo_central)) return null;
  const t = (x, n = 300) => (typeof x === 'string' ? x.slice(0, n) : '');
  const l = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string').slice(0, 8).map((y) => y.slice(0, 160)) : []);
  return {
    resumen: t(a.resumen),
    facetas: l(a.facetas),
    // sin referencia: el ángulo central que sacó de la investigación, como una «referencia» más
    referencias: [...(a.angulo_central ? [{ ref: 'Investigación', angulo: a.angulo_central, invariables: a.invariables, modificables: a.modificables, experimentales: a.experimentales }] : []), ...(Array.isArray(a.referencias) ? a.referencias : [])].slice(0, 10).map((r) => ({ ref: t(r?.ref, 20), deseo: t(r?.angulo?.deseo), problema: t(r?.angulo?.problema), promesa: t(r?.angulo?.promesa), mecanismo: t(r?.angulo?.mecanismo), invariables: l(r?.invariables), modificables: l(r?.modificables), experimentales: l(r?.experimentales) })),
  };
}

export function vistaDelLote({ lote, carpeta, brief, conductor = null, fila = null, modoPrueba = false }) {
  const est = leerEstado(carpeta);
  const plan = leerJSON(R.plan(carpeta));
  const estrategia = leerJSON(R.estrategia(carpeta));
  const indice = leerJSON(R.indiceVersiones(carpeta))?.piezas || {};
  const logoInfo = leerJSON(R.logoJson(carpeta));
  const conLogo = Boolean(brief?.logo?.posicion && existe(R.logo(carpeta)));
  const shaLogo = conLogo ? sha1DelLogo(carpeta) : null;
  const base = `/archivos/imagen-ads/${enc(lote)}`;
  const mini = `/archivos/miniatura/imagen-ads/${enc(lote)}`;
  const { angulos, formatos: catalogo } = leerSkill();
  const formatos = brief?.formatos || ['1:1'];
  const ids = idsDelLote(brief?.cantidad);
  const pedidos = todosLosPedidos(carpeta, est);
  const nombre = kebab(brief?.titulo || brief?.datos?.nombre || 'anuncio', 30);
  const delPlan = new Map((plan?.variaciones || []).map((x) => [x.id, x]));
  // (2026-11-26a) el nombre de descarga con el formato y el ángulo ('aguaje_V03-F17-ugc-selfie-transformacion.png'):
  // así «Aprender de mis ventas» reconoce cada anuncio en Meta. Sin formato de la biblioteca, el nombre de antes.
  const descargaDe = (v, f) => {
    const x = delPlan.get(v);
    return x?.formato_id && x?.angulo_id && x.fuente !== 'referencia'
      ? nombreDeDescarga({ producto: brief?.datos?.nombre || brief?.titulo, v, formatoId: x.formato_id, anguloId: x.angulo_id, formato: f, skill: leerSkill() })
      : `${nombre}-${v}-${nombreFormato(f)}.png`;
  };

  const vistaDePieza = (v, f) => (brief?.plantillas ? vistaDePiezaPlantilla(v, f) : vistaDePiezaComun(v, f));

  // PLANTILLAS: la imagen que se ve es la dibujada (final/), con la vista previa apenas existe; el estado es el de su
  // escena (si la usa) y, si no, «listo» cuando está dibujada al día.
  const vistaDePiezaPlantilla = (v, f) => {
    const id = piezaId(v, f);
    const ap = plantillaDe(carpeta, v);
    const cuadrado = piezaId(v, '1:1');
    const pc = est?.piezas?.[cuadrado] || null;
    const p = est?.piezas?.[id] || null;
    const pedido = pedidoDe(pedidos, id);
    const comp = estadoComposicion(carpeta, id);
    const fFinal = comp.existe ? firma(R.final(carpeta, id)) : null;
    let estado;
    if (!ap) estado = 'en-cola';
    else if (ap.escena) {
      estado = estadoEnPantalla(pc, { pedido: pedidoDe(pedidos, cuadrado) });
      if (estado === 'listo' && !comp.completa) estado = 'generando';
    } else estado = pedido && !PEDIDO_TERMINADO.has(pedido.estado) ? 'regenerando' : comp.existe ? 'listo' : 'generando';
    const local = Boolean(ap && piezaLocal(ap, id));
    const versiones = (indice[cuadrado] || []).filter(() => f === '1:1' && ap?.escena).filter((x) => x && existe(R.versionPng(carpeta, cuadrado, x.n))).map((x) => {
      const f2 = firma(R.versionPng(carpeta, cuadrado, x.n));
      return { n: Number(x.n), url: `${base}/versiones/${cuadrado}.v${x.n}.png?v=${f2}`, miniatura: `${mini}/versiones/${cuadrado}.v${x.n}.png?ancho=480&v=${f2}`, fecha: x.fecha || null, motivo: x.motivo || null, escena: true };
    });
    const libre = !pedido && (ap?.escena ? pc?.fase === 'final' : true);
    return {
      pieza: id,
      estado,
      url: fFinal ? `${base}/final/${id}.png?v=${fFinal}` : null,
      urlSinLogo: fFinal ? `${base}/final/${id}.png?v=${fFinal}` : null,
      miniatura: fFinal ? `${mini}/final/${id}.png?ancho=480&v=${fFinal}` : null,
      descarga: descargaDe(v, f),
      version: p?.version || 0,
      versiones,
      problemas: [],
      motivo: estado === 'sin-imagen' ? pc?.mensaje || 'No se pudo hacer la escena de esta imagen' : null,
      hayPrompt: Boolean(ap?.escena) && existe(R.prompt(carpeta, cuadrado)),
      puedeRegenerar: Boolean(ap) && libre && (ap.escena || comp.existe),
      // regenerar: las que dibuja la app salen gratis (otros textos); las de escena piden otra escena (1 imagen)
      imagenesRegenerar: ap?.escena ? 1 : 0,
      vistaPrevia: Boolean(ap?.escena && comp.existe && !comp.completa),
      // un cuadro del video: se puede «Pulir con IA» (cuesta 1 imagen); solo desde el cuadrado (el vertical lo sigue)
      pulible: Boolean(ap?.escenaFija && !ap?.escena && f === '1:1' && comp.existe),
      local,
      pedido: pedido ? { id: pedido.id, estado: pedido.estado } : null,
    };
  };

  const vistaDePiezaComun = (v, f) => {
    const id = piezaId(v, f);
    const p = est?.piezas?.[id] || null;
    const sinPrompt = est?.variaciones?.[v]?.prompt === 'sin-prompt';
    const pedido = pedidoDe(pedidos, id);
    const fImg = firma(R.img(carpeta, id));
    const final = Boolean(fImg && conLogo && finalAlDia(carpeta, id, { posicion: brief.logo.posicion, shaLogo }));
    const fFinal = final ? firma(R.final(carpeta, id)) : null;
    const rel = final ? `final/${id}.png` : `img/${id}.png`;
    const marca = final ? fFinal : fImg;
    const estado = estadoEnPantalla(p, { pedido, sinPrompt });
    const versiones = (indice[id] || [])
      .filter((x) => x && Number.isInteger(Number(x.n)) && existe(R.versionPng(carpeta, id, x.n)))
      .map((x) => {
        const f2 = firma(R.versionPng(carpeta, id, x.n));
        // (un pedido del usuario llega sin motivo: se reconoce por la orden que la reemplazo, U####)
        const motivo = x.motivo || (/^U\d+$/.test(String(x.reemplazadaPor || '')) ? 'usuario' : null);
        return { n: Number(x.n), url: `${base}/versiones/${id}.v${x.n}.png?v=${f2}`, miniatura: `${mini}/versiones/${id}.v${x.n}.png?ancho=480&v=${f2}`, fecha: x.fecha || null, motivo };
      });
    const cuadrado = est?.piezas?.[piezaId(v, '1:1')];
    const puedeRegenerar = Boolean(
      p && !sinPrompt && p.fase === 'final' && !pedido && (f === '1:1' || (cuadrado?.fase === 'final' && firma(R.img(carpeta, piezaId(v, '1:1')))))
    );
    const problemas = p?.fase === 'final' && p.resultado === 'con-detalles' ? p.revision?.problemas || [] : [];
    return {
      pieza: id,
      estado,
      url: fImg ? `${base}/${rel}?v=${marca}` : null,
      urlSinLogo: fImg ? `${base}/img/${id}.png?v=${fImg}` : null,
      miniatura: fImg ? `${mini}/${rel}?ancho=480&v=${marca}` : null,
      descarga: descargaDe(v, f),
      version: p?.version || 0,
      versiones,
      problemas,
      // (sin revisar: por que, si se sabe; p. ej. se acabo el plan de la IA)
      motivo: sinPrompt ? 'La IA no pudo escribir este anuncio.' : p?.resultado === 'sin-imagen' ? p.mensaje || 'kie no pudo hacer esta imagen' : p?.resultado === 'sin-revisar' ? p.mensaje || null : null,
      hayPrompt: existe(R.prompt(carpeta, id)),
      puedeRegenerar,
      pedido: pedido ? { id: pedido.id, estado: pedido.estado } : null,
    };
  };

  const variaciones0 = ids.map((v) => {
    const x = delPlan.get(v);
    const sinPrompt = est?.variaciones?.[v]?.prompt === 'sin-prompt';
    const ap = brief?.plantillas ? plantillaDe(carpeta, v) : null;
    return {
      v,
      ...(ap ? { plantilla: { id: ap.id, nombre: POR_ID.get(ap.id)?.nombre || ap.id, escena: Boolean(ap.escena), textos: ap.textos || {}, campos: POR_ID.get(ap.id)?.campos || [] } } : {}),
      angulo: x ? angulos.get(x.angulo_id)?.nombre || x.angulo || '' : '',
      formato: x ? (x.fuente === 'referencia' ? 'Tu referencia' : x.fuente === 'plantilla' ? POR_ID.get(x.plantilla)?.nombre || x.formato || '' : catalogo.get(x.formato_id)?.nombre || x.formato || '') : '',
      titular: x?.titular || '',
      // (agente de variaciones) qué nivel es, qué cambió respecto del ganador y qué se quiere probar
      ...(x?.nivel ? { nivel: String(x.nivel).slice(0, 1), cambio: String(x.cambio || '').slice(0, 300), hipotesis: String(x.hipotesis || '').slice(0, 300), faceta: String(x.faceta || '').slice(0, 120) } : {}),
      // (2026-11-26a) «Qué tan distintas»: el id del formato, por qué debería vender y la nota de la revisión (1-10)
      ...(nivelDe(brief) && x
        ? {
            formatoId: x.formato_id || null,
            porQueVende: String(x.por_que_vende || '').slice(0, 300),
            nota: Number.isInteger(est?.piezas?.[piezaId(v, '1:1')]?.revision?.nota) ? est.piezas[piezaId(v, '1:1')].revision.nota : null,
          }
        : {}),
      estado: sinPrompt ? 'sin-prompt' : 'ok',
      piezas: Object.fromEntries(formatos.map((f) => [f, vistaDePieza(v, f)])),
    };
  });

  // (2026-11-26a) «Qué tan distintas»: las de mejor nota primero (las que no tienen nota todavía, en su orden, al final)
  const variaciones = nivelDe(brief) ? [...variaciones0].sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1)) : variaciones0;

  // el avance
  const c = est ? cuentas(est) : { total: ids.length * formatos.length, listas: 0, escritas: 0 };
  const todas = variaciones.flatMap((x) => Object.values(x.piezas).map((p) => ({ ...p, sinPrompt: x.estado === 'sin-prompt' })));
  const vivas = todas.filter((p) => !p.sinPrompt);
  const listaFinal = (p) => ['listo', 'arreglado', 'te-necesita', 'sin-revisar', 'sin-imagen'].includes(p.estado);
  const pasoEstrategia = conductor?.pasos?.find((p) => p.id === 'estrategia');
  const etapas = [
    { id: 'estrategia', estado: pasoEstrategia?.estado || (est ? 'hecho' : 'pendiente') },
    { id: 'prompts', hechas: c.escritas || 0, total: ids.length },
    { id: 'cuadrados', hechas: vivas.filter((p) => p.pieza.endsWith('_1x1') && (p.version >= 1 || p.estado === 'sin-imagen')).length, total: vivas.filter((p) => p.pieza.endsWith('_1x1')).length },
    { id: 'revision', hechas: vivas.filter(listaFinal).length, total: vivas.length },
    ...(formatos.includes('9:16') ? [{ id: 'verticales', hechas: vivas.filter((p) => p.pieza.endsWith('_9x16') && (p.version >= 1 || p.estado === 'sin-imagen')).length, total: vivas.filter((p) => p.pieza.endsWith('_9x16')).length }] : []),
    ...(conLogo ? [{ id: 'logo', hechas: vivas.filter((p) => p.url && p.url.includes('/final/')).length, total: vivas.filter((p) => p.version >= 1).length }] : []),
  ];
  const pasoAnuncios = conductor?.pasos?.find((p) => p.id === conductor?.paso);
  const sinTerminar = pedidos.filter((x) => !PEDIDO_TERMINADO.has(x.estado));
  const informe = conductor?.estado === 'listo' && !sinTerminar.length ? leerJSON(R.informe(carpeta)) : null;
  return {
    lote,
    titulo: brief?.titulo || brief?.datos?.nombre || 'Anuncios de imagen',
    modoPrueba: Boolean(modoPrueba),
    // (2026-11-20) hecho por el agente de variaciones: su análisis del anuncio ganador
    ...(brief?.agente === 'variaciones' ? { agente: 'variaciones', analisis: resumenAnalisis(leerJSON(path.join(carpeta, 'analisis-ganador.json'))) } : {}),
    // (2026-11-26a) «Qué tan distintas»: el nivel y el análisis del ganador (analisis.json), arriba de las imágenes
    ...(nivelDe(brief) ? { variacion: nivelDe(brief), ganador: analisisParaLaPantalla(leerJSON(path.join(carpeta, 'analisis.json'))) } : {}),
    // (2026-11-26b) la comparación contra cada estructura ganadora: el montaje, los 7 puntajes y si pasa o va a rehacer
    ...comparacionParaLaPantalla(carpeta, est, base),
    // la IA que hizo la estrategia del lote, 'claude' | 'codex' (null si todavia no la hizo ninguna): «… los hizo
    // {Claude|ChatGPT} con tu plan» (la pantalla la lee con motorDelLote de datos/imagenes.js)
    motor: motorDelLote(est, conductor),
    brief: {
      cantidad: Number(brief?.cantidad) || 0,
      formatos,
      idioma: brief?.datos?.idioma || 'es',
      logo: brief?.logo?.posicion ? { posicion: brief.logo.posicion, url: conLogo ? `${base}/entrada/logo.png?v=${firma(R.logo(carpeta))}` : null, transparente: logoInfo ? Boolean(logoInfo.transparente) : null } : null,
    },
    producto: { id: brief?.productoId || null, nombre: brief?.datos?.nombre || brief?.titulo || '', foto: fotoDelLote(carpeta) ? `${base}/${fotoDelLote(carpeta)}` : null },
    conductor: conductor
      ? { estado: conductor.estado, paso: conductor.paso, motivo: conductor.motivo || null, pasos: conductor.pasos || [], error: conductor.error || pasoAnuncios?.error || null }
      : { estado: 'borrador', paso: null, motivo: null, pasos: [], error: null },
    fila: fila || null,
    avance: { listas: c.listas || 0, total: c.total || vivas.length, escritas: c.escritas || 0, frase: pasoAnuncios?.detalle || null, etapas },
    estrategia: estrategia
      ? {
          resumen: estrategia.resumen || '',
          paleta: Array.isArray(estrategia.paleta) ? estrategia.paleta.filter((x) => /^#[0-9a-f]{6}$/i.test(String(x?.hex || ''))) : [],
          tipografia: estrategia.tipografia || '',
          estilo: estrategia.estilo || '',
          beneficios: Array.isArray(estrategia.beneficios) ? estrategia.beneficios : [],
          caracteristicas: Array.isArray(estrategia.caracteristicas) ? estrategia.caracteristicas : [],
          deseoCentral: typeof estrategia.deseo_central === 'string' ? estrategia.deseo_central : '',
          beneficioPrincipal: typeof estrategia.beneficio_principal === 'string' ? estrategia.beneficio_principal : '',
          puntosDolor: Array.isArray(estrategia.puntos_dolor) ? estrategia.puntos_dolor.filter((x) => typeof x === 'string') : [],
          conInvestigacion: Boolean(brief?.investigacion),
          plan: variaciones.map((x) => ({ v: x.v, angulo: x.angulo, formato: x.formato, titular: x.titular })).filter((x) => x.titular || x.angulo),
        }
      : null,
    variaciones,
    // corrige: el pedido salió de «Corregir esto» (la caja empieza con lo que notó la revisión): el aviso de listo lo dice así
    pedidos: pedidos.map((x) => ({ id: x.id, pieza: x.pieza || null, v: x.v || vDe(x.pieza || ''), estado: x.estado, resumen: x.resumen || null, motivo: x.motivo || null, corrige: /^Corrige (esto|lo que notó la revisión):/i.test(String(x.instruccion || '')) })),
    informe,
  };
}

/** Lo de "Tus lotes" de un lote (sin precios). */
export function resumenDelLote({ lote, carpeta, brief, conductor }) {
  const est = leerEstado(carpeta);
  const c = est ? cuentas(est) : { total: (Number(brief?.cantidad) || 0) * (brief?.formatos?.length || 1), listas: 0 };
  const conLogo = Boolean(brief?.logo?.posicion) && existe(R.logo(carpeta));
  // el cuadrado de una variación como se ve (con el logo si lo lleva), o null si todavía no existe
  const cuadrado = (v) =>
    brief?.plantillas
      ? existe(`${carpeta}/final/${v}_1x1.png`)
        ? `final/${v}_1x1.png`
        : null
      : [`final/${v}_1x1.png`, `img/${v}_1x1.png`].find((rel) => existe(`${carpeta}/${rel}`) && (rel.startsWith('img/') || conLogo)) || null;
  const miniaturaDe = (rel, ancho) => `/archivos/miniatura/imagen-ads/${enc(lote)}/${rel}?ancho=${ancho}&v=${firma(`${carpeta}/${rel}`)}`;
  const portada = cuadrado('V01');
  const marca = portada ? firma(`${carpeta}/${portada}`) : null;
  // el mosaico de "Tus lotes": los primeros cuadrados que ya existen, hasta 4 (en orden de variación)
  const mosaico = [];
  for (const v of idsDelLote(Number(brief?.cantidad) || 0)) {
    const rel = cuadrado(v);
    if (rel) mosaico.push(miniaturaDe(rel, 320));
    if (mosaico.length >= 4) break;
  }
  const foto = fotoDelLote(carpeta);
  // la IA del lote; si espera que se renueve un plan, la de ese plan (la anota el conductor en el error del paso)
  const paso = conductor?.pasos?.find((p) => p.id === conductor?.paso);
  const esperaLimite = conductor?.motivo === 'limite-claude' || paso?.error?.motivo === 'limite-claude';
  const motor = esperaLimite ? (MOTORES_VALIDOS.has(paso?.error?.motor) ? paso.error.motor : null) : motorDelLote(est, conductor);
  return {
    lote,
    titulo: brief?.titulo || brief?.datos?.nombre || 'Anuncios de imagen',
    productoId: brief?.productoId || null,
    cantidad: Number(brief?.cantidad) || 0,
    formatos: brief?.formatos || ['1:1'],
    estado: conductor ? conductor.estado : 'borrador',
    motivo: conductor?.motivo || null,
    motor,
    listas: c.listas || 0,
    total: c.total || 0,
    portada: portada ? `/archivos/miniatura/imagen-ads/${enc(lote)}/${portada}?ancho=480&v=${marca}` : null,
    mosaico,
    // la foto del producto con la que se hizo el lote (la portada de la sección la usa si el producto ya no está)
    foto: foto ? miniaturaDe(foto, 240) : null,
    creado: brief?.creado || null,
    terminado: conductor?.terminado || null,
    // lo último que le pasó (creado, armándose, una imagen nueva, una corrección): «Tus lotes» va del más reciente
    actualizado: ultimaModificacion(carpeta, [brief?.creado, conductor?.terminado]),
  };
}

/** La fecha más reciente entre las dadas y las de los archivos que cambian cuando el lote avanza (ISO o null). */
function ultimaModificacion(carpeta, fechas) {
  const ms = fechas.map((x) => Date.parse(x) || 0);
  for (const rel of ['', 'img', 'final', 'app', 'brief.json', 'estado.json']) {
    try {
      ms.push(fs.statSync(rel ? `${carpeta}/${rel}` : carpeta).mtimeMs);
    } catch {
      // ese no está
    }
  }
  const max = Math.max(0, ...ms);
  return max ? new Date(max).toISOString() : null;
}

export { listaDePiezas, ordenDeV };

/** (2026-11-26a) El análisis del ganador como lo muestra la pantalla (solo los campos conocidos, cortos). */
function analisisParaLaPantalla(a) {
  if (!a || typeof a !== 'object') return null;
  const t = (x, max = 300) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const l = (x) => (Array.isArray(x) ? x.map((y) => t(y, 200)).filter(Boolean).slice(0, 8) : []);
  const { angulos, formatos } = leerSkill();
  return {
    esencia: t(a.esencia),
    deseo: t(a.deseo_central),
    dolor: t(a.dolor_principal),
    promesa: t(a.promesa),
    emocion: t(a.emocion, 120),
    conciencia: t(a.nivel_conciencia, 60),
    mecanismo: t(a.mecanismo_persuasion),
    hook: { que: t(a.hook_visual?.que), porQue: t(a.hook_visual?.por_que) },
    invariables: l(a.invariables),
    modificables: l(a.modificables),
    experimentales: l(a.experimentales),
    formato: formatos.get(a.formato_ganador)?.nombre || t(a.formato_ganador, 40),
    angulo: angulos.get(a.angulo_ganador)?.nombre || t(a.angulo_ganador, 40),
  };
}

/** (2026-11-26b) La comparación de cada imagen con su estructura ganadora, para la pantalla (vacío si el lote no usa). */
function comparacionParaLaPantalla(carpeta, est, base) {
  const e = estructurasDelLote(carpeta);
  const ids = Object.keys(e);
  if (!ids.length) return {};
  return {
    comparacion: {
      criterios: CRITERIOS.map((k) => ({ id: k, nombre: NOMBRES_CRITERIOS[k] })),
      minima: NOTA_MINIMA,
      informe: existe(path.join(carpeta, 'comparacion', 'informe.md')),
      piezas: ids.map((v) => {
        const pieza = piezaId(v, '1:1');
        const p = est?.piezas?.[pieza];
        const puntajes = p?.revision?.puntajes || null;
        const { pasa, fallan } = evaluarPuntajes(puntajes);
        const montaje = path.join(carpeta, 'comparacion', `${v}.jpg`);
        const f = existe(montaje) ? firma(montaje) : null;
        return {
          v,
          pieza,
          formato: e[v].formato_id,
          nombre: e[v].nombre,
          referencia: `/api/imagen-ads/estructuras/${e[v].formato_id}/imagen`,
          montaje: f ? `${base}/comparacion/${v}.jpg?v=${f}` : null,
          puntajes,
          pasa,
          fallan: fallan.map((k) => NOMBRES_CRITERIOS[k]),
          correccion: pasa === false ? p?.revision?.correccion_en || '' : '',
          problemas: pasa === false ? p?.revision?.problemas || [] : [],
          puedeRehacer: Boolean(p && p.fase === 'final' && pasa === false),
        };
      }),
    },
  };
}
