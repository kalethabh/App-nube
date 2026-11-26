// El planificador de un lote de ANUNCIOS DE IMAGEN (ESPECIFICACION-imagen-ads.md §6.2 y §6.4). No toca el disco ni la
// red: mira el estado en memoria y lo que se vio en disco (`hechos`) y decide que sigue. Lo usa el paso `anuncios`
// (familias/imagen-ads.js) en cada vuelta de su bucle y se prueba solo (app/herramientas/probar-imagen-ads.mjs).
//
//   nuevoEstado({ cantidad, formatos })      el estado de un lote que empieza
//   asegurarPiezas(est, { cantidad, formatos })
//   progresar(est, hechos)                   lo que pasa solo: una pieza con su anuncio listo queda por pedir, un vertical
//                                            espera a su cuadrado, un pedido del usuario avanza…
//   decidir(est, hechos, opciones)           { orden, claude, simulada, local, terminado } (llama a progresar)
//   y lo que aplica cada cosa que volvio: marcarOrden · aplicarResultado · iniciarTanda · aplicarPrompts ·
//   aplicarRevision · aplicarAjuste · marcarFallida · dejarSinRevisar (sin plan para revisar) · absorberPedidos
//
// Una pieza (V03_1x1) pasa por estas fases:
//   espera-prompt -> (espera-cuadrado, solo el 9:16) -> por-pedir -> pedida -> por-revisar -> revisando -> final
//   Todo al primer intento (decision de Diego, 2026-11-09): si la revision ve algo, la pieza queda «con detalles» con
//   su nota (p.revision.problemas) y el vertical se hace igual desde el cuadrado; no hay reintento automatico. Un pedido
//   del usuario la reabre (ronda 'u'). Con instruccion pasa antes por ajustando (la IA prepara el cambio). La fase
//   'reintento' y la orden 'rev' quedan solo para los lotes de antes (estado.js las pasa a «con detalles» al cargar si
//   todavia no salieron al motor).
// resultado (en final): listo · con-detalles · sin-imagen · sin-revisar (y arreglado, de los lotes de antes)
//
// El tamaño de las tandas de anuncios depende de la IA elegida (promptsPorTanda; las revisiones son de 8 cuadrados con
// las dos, revisionCuadrados): se mira en cada decidir, y
// solo para las tandas NUEVAS. Una tanda ya repartida (en curso) se vuelve a correr con sus mismas variaciones o piezas
// aunque la IA haya cambiado entre una vuelta y otra: nunca se parte distinto.
import { piezaId, vDe, formatoDe, numeroDeV, idsDelLote, ordenDePiezas, ordenDeV } from './disco.js';
import { motorActual } from '../motor-ia.js';
import { CRITERIOS, NOTA_MINIMA, NOMBRES_CRITERIOS } from './variedad.js';

/** (2026-11-26h) Una imagen adjunta a un pedido, dentro del lote. */
export const RE_ADJUNTO = /^entrada\/adjuntos\/A\d{4}\.(png|jpg)$/;
export const TOPES = {
  porOrden: 24, // piezas por orden al motor
  pedidasALaVez: 60, // piezas en el motor a la vez
  revisionVerticales: 6, // 6 x 6 + la foto = 37 imagenes (con las dos IA)
  ajustesPorTanda: 4,
  motorBajo: 12, // con menos que esto por hacer en el motor, se escriben mas anuncios antes de revisar
  esperaRevisionMs: 3 * 60000,
  localALaVez: 2,
};

// Con ChatGPT (DISENO-motor-codex §3.3): 4 anuncios por tanda (escribe mas despacio; asi las primeras imagenes empiezan
// antes y el total no cambia) y 8 cuadrados por revision, como Claude (8 x 5 + la foto = 41 imagenes: entran en un
// mensaje, el tope es 48 desde la prueba P0). Con Claude (o sin IA elegida), lo de siempre: 8 y 8.
const conChatGPT = (motor) => motor === 'codex';
/** Cuantos anuncios escribe una tanda: 8 con Claude, 4 con ChatGPT. */
export const promptsPorTanda = (motor = motorActual()) => (conChatGPT(motor) ? 4 : 8);
/** Cuantos cuadrados revisa una tanda: 8 con las dos IA (recibe la IA como promptsPorTanda; las verticales, 6: TOPES). */
export const revisionCuadrados = () => 8;

const PRIORIDAD = { ajuste: 3, 'revision-u': 3, revision: 2, prompts: 1 };
const FASES_DEL_MOTOR = new Set(['por-pedir', 'reintento', 'pedida']);
const FASES_OCUPADA = new Set(['por-pedir', 'reintento', 'pedida', 'por-revisar', 'revisando', 'ajustando', 'reescribiendo']);
export const PEDIDO_TERMINADO = new Set(['listo', 'no-aplicado']);

const nuevaPieza = (v, formato) => ({
  v,
  formato,
  fase: 'espera-prompt',
  resultado: null,
  version: 0,
  firma: null,
  orden: null,
  intentosApi: 0,
  ronda: 1,
  reintentoAuto: 'no',
  revision: null,
  motivo: null,
  mensaje: null,
  desde: null,
  pedido: null,
});

/** El estado de un lote que empieza: todas sus variaciones por escribir y todas sus piezas esperando su anuncio. */
export function nuevoEstado({ cantidad, formatos }) {
  const est = { version: 1, siguiente: { E: 1, R: 1, A: 1, T: 1 }, tandas: {}, variaciones: {}, piezas: {}, pedidos: {} };
  asegurarPiezas(est, { cantidad, formatos });
  return est;
}

/** Que esten todas las variaciones y las piezas del lote (por si el estado viene de una version anterior). */
export function asegurarPiezas(est, { cantidad, formatos, extras = null }) {
  est.siguiente ||= { E: 1, R: 1, A: 1, T: 1 };
  est.tandas ||= {};
  est.variaciones ||= {};
  est.piezas ||= {};
  est.pedidos ||= {};
  for (const v of idsDelLote(cantidad)) {
    est.variaciones[v] ||= { prompt: 'falta', tanda: null };
    // (2026-11-26i) más los tamaños pedidos solo para esta variación («Crear otro tamaño»)
    for (const f of [...new Set([...formatos, ...((extras && extras[v]) || [])])]) {
      const p = piezaId(v, f);
      est.piezas[p] ||= nuevaPieza(v, f);
    }
  }
  return est;
}

// ---------------------------------------------------------------- consultas

export const piezasDeV = (est, v) => Object.keys(est.piezas).filter((p) => vDe(p) === v).sort(ordenDePiezas);
export const listaDePiezas = (est) => Object.keys(est.piezas).sort(ordenDePiezas);
const conImagen = (est, hechos, p) => Boolean(hechos?.imagenes?.[p]) && (est.piezas[p]?.version || 0) >= 1;
const pedidosActivos = (est) => Object.values(est.pedidos || {}).filter((x) => !PEDIDO_TERMINADO.has(x.estado));

/** ¿La variacion esta haciendo algo (una pieza en el motor o en revision, su anuncio sin escribir…)? */
export function vOcupada(est, v) {
  const va = est.variaciones[v];
  if (!va || va.prompt !== 'listo') return true;
  return piezasDeV(est, v).some((p) => FASES_OCUPADA.has(est.piezas[p].fase) || est.piezas[p].fase === 'espera-prompt' || est.piezas[p].fase === 'espera-cuadrado');
}

const vPedido = (ped) => ped.v || vDe(ped.pieza);

// ---------------------------------------------------------------- lo que pasa solo

/** Empieza el paso `i` de un pedido: su pieza queda por pedir con la orden del pedido (ronda 'u'). */
function iniciarPaso(est, ped, i) {
  const paso = ped.pasos[i];
  const p = est.piezas[paso.pieza];
  ped.paso = i;
  p.fase = 'por-pedir';
  p.ronda = 'u';
  p.pedido = ped.id;
  p.fallo = null;
  const editar = paso.modo === 'editar' && p.version >= 1;
  // «otra version» (sin instruccion) de una imagen que la revision marco: tambien lleva lo que salio mal, para que la
  // IA no repita el mismo error a ciegas
  const correccion = !editar && p.revision?.ok === false && typeof p.revision.correccion_en === 'string' ? p.revision.correccion_en : '';
  p.orden = {
    id: paso.orden,
    modo: editar ? 'editar' : 'generar',
    version: (p.version || 0) + 1,
    ...(paso.motivo ? { motivo: paso.motivo } : {}),
    ...(editar ? { instruccion_en: paso.instruccion_en, textos: Boolean(paso.textos) } : {}),
    ...(editar && Array.isArray(paso.adjuntos) && paso.adjuntos.length ? { adjuntos: paso.adjuntos } : {}),
    ...(correccion ? { correccion_en: correccion } : {}),
  };
  ped.estado = 'generando';
}

/**
 * Los pasos de un pedido sobre una pieza. En un cuadrado con vertical, despues del cuadrado se rehace su vertical (que
 * sigan siendo el mismo anuncio). En un vertical con un texto cambiado, se cambia primero el cuadrado y despues el
 * vertical sale de el; si no cambia texto, solo el vertical.
 */
export function pasosDelPedido(est, ped, { instruccionEn = null, cambiaTextos = false } = {}) {
  const v = vDe(ped.pieza);
  const cuadrado = piezaId(v, '1:1');
  const vertical = piezaId(v, '9:16');
  // (plantillas: el vertical lo dibuja la app con la misma escena: no se pide otro)
  const hayVertical = Boolean(est.piezas[vertical]) && !est.piezas[vertical].local;
  const modo = instruccionEn ? 'editar' : 'generar';
  const adjuntos = instruccionEn && Array.isArray(ped.adjuntos) && ped.adjuntos.length ? { adjuntos: ped.adjuntos } : {};
  const extra = instruccionEn ? { instruccion_en: instruccionEn, textos: Boolean(cambiaTextos), ...adjuntos } : {};
  const delVertical = { pieza: vertical, orden: `${ped.id}-v`, modo: 'generar', motivo: 'cuadrado-nuevo' };
  // (2026-11-26i) y el retrato 4:5, si esta variación lo tiene: también sale del cuadrado nuevo
  const retrato = piezaId(v, '4:5');
  const delRetrato = est.piezas[retrato] && !est.piezas[retrato].local ? [{ pieza: retrato, orden: `${ped.id}-r`, modo: 'generar', motivo: 'cuadrado-nuevo' }] : [];
  if (formatoDe(ped.pieza) === '1:1') return [{ pieza: cuadrado, orden: ped.id, modo, ...extra }, ...(hayVertical ? [delVertical] : []), ...delRetrato];
  if (instruccionEn && cambiaTextos) return [{ pieza: cuadrado, orden: ped.id, modo: 'editar', instruccion_en: instruccionEn, textos: true, ...adjuntos }, ...(hayVertical ? [delVertical] : []), ...delRetrato];
  return [{ pieza: vertical, orden: ped.id, modo, ...extra }];
}

function reiniciarVariacion(est, v) {
  est.variaciones[v] = { prompt: 'falta', tanda: null };
  for (const p of piezasDeV(est, v)) {
    const x = est.piezas[p];
    Object.assign(x, { fase: 'espera-prompt', resultado: null, orden: null, ronda: 1, reintentoAuto: 'no', revision: null, motivo: null, mensaje: null, desde: null, fallo: null });
  }
}

function avanzarPedidos(est, hechos) {
  const activos = pedidosActivos(est).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const empezados = new Set(); // variaciones que ya tienen un pedido en marcha (uno por variacion)
  for (const ped of activos) if (!['pendiente', 'en-espera'].includes(ped.estado)) empezados.add(vPedido(ped));
  for (const ped of activos) {
    const v = vPedido(ped);
    if (!est.variaciones[v]) {
      ped.estado = 'no-aplicado';
      ped.motivo = 'Esa imagen no es de este lote.';
      continue;
    }
    // "Escribir de nuevo" una variacion que quedo sin escribir
    if (ped.tipo === 'prompt') {
      const va = est.variaciones[v];
      if (ped.estado === 'pendiente' || ped.estado === 'en-espera') {
        if (va.prompt !== 'sin-prompt') {
          ped.estado = va.prompt === 'listo' ? 'listo' : 'en-espera';
          if (ped.estado === 'listo') ped.resumen = 'Este anuncio ya estaba escrito.';
          continue;
        }
        reiniciarVariacion(est, v);
        ped.estado = 'generando';
        empezados.add(v);
        continue;
      }
      if (va.prompt === 'sin-prompt') {
        ped.estado = 'no-aplicado';
        ped.motivo = 'La IA no pudo escribir este anuncio otra vez.';
      } else if (va.prompt === 'listo' && piezasDeV(est, v).every((p) => est.piezas[p].fase === 'final')) ped.estado = 'listo';
      continue;
    }
    if (ped.estado === 'pendiente' || ped.estado === 'en-espera') {
      const libre = !vOcupada(est, v) && !empezados.has(v);
      if (!libre) {
        ped.estado = 'en-espera';
        continue;
      }
      ped.estado = 'pendiente';
      if (ped.instruccion) continue; // la toma una tanda de ajuste (decidir)
      ped.pasos = pasosDelPedido(est, ped);
      iniciarPaso(est, ped, 0);
      empezados.add(v);
      continue;
    }
    if (ped.estado === 'ajustando') continue;
    // generando / revisando: mirar el paso en curso
    const paso = ped.pasos?.[ped.paso || 0];
    const p = paso ? est.piezas[paso.pieza] : null;
    if (!p) {
      ped.estado = 'no-aplicado';
      ped.motivo = 'No encuentro esa imagen.';
      continue;
    }
    if (p.fase !== 'final') {
      ped.estado = ['por-revisar', 'revisando'].includes(p.fase) ? 'revisando' : 'generando';
      continue;
    }
    p.pedido = null;
    if (p.fallo?.orden === paso.orden) {
      ped.estado = 'no-aplicado';
      // ("quedó la de antes" solo si habia una: una pieza sin imagen que no se pudo rehacer sigue sin imagen)
      ped.motivo = `No se pudo rehacer: ${p.fallo.mensaje || 'kie no pudo hacer esta imagen'}.${p.version >= 1 ? ' Quedó la imagen de antes.' : ''}`;
      continue;
    }
    const sig = (ped.paso || 0) + 1;
    if (sig >= ped.pasos.length) {
      ped.estado = 'listo';
      continue;
    }
    iniciarPaso(est, ped, sig);
  }
}

/** Lo que pasa solo, sin pedir nada a nadie. Pone al dia `est` (no toca el disco). */
export function progresar(est, hechos = {}) {
  for (const p of listaDePiezas(est)) {
    const x = est.piezas[p];
    const va = est.variaciones[x.v];
    if (x.fase === 'espera-prompt' && va?.prompt === 'listo') {
      if (x.formato === '1:1') {
        x.fase = 'por-pedir';
        x.orden ||= { id: 'g', modo: 'generar', version: 1 };
      } else x.fase = 'espera-cuadrado';
    }
    if (x.fase === 'espera-cuadrado') {
      const c = est.piezas[piezaId(x.v, '1:1')];
      if (!c) {
        // un lote sin cuadrado no deberia existir: el vertical sale de su cuadrado
        x.fase = 'final';
        x.resultado = 'sin-imagen';
        x.motivo = 'falta-cuadrado';
        x.mensaje = 'No se pudo hacer porque su cuadrado no salió.';
      } else if (c.fase === 'final') {
        if (conImagen(est, hechos, piezaId(x.v, '1:1')) || (c.version >= 1 && c.resultado !== 'sin-imagen' && !hechos?.imagenes)) {
          x.fase = 'por-pedir';
          x.orden ||= { id: 'g', modo: 'generar', version: 1 };
        } else {
          x.fase = 'final';
          x.resultado = 'sin-imagen';
          x.motivo = 'falta-cuadrado';
          x.mensaje = 'No se pudo hacer porque su cuadrado no salió.';
        }
      }
    }
  }
  avanzarPedidos(est, hechos);
  return est;
}

// ---------------------------------------------------------------- decidir

const recortesListos = (est, hechos, p) => {
  const x = est.piezas[p];
  if (x.fase !== 'por-revisar' || !x.firma || hechos?.recortes?.[p] !== x.firma) return false;
  // el vertical se revisa al lado de su cuadrado: hace falta la vista del cuadrado
  if (x.formato !== '1:1' && est.piezas[piezaId(x.v, '1:1')] && !hechos?.vistas?.[piezaId(x.v, '1:1')]) return false;
  return true;
};

/** La propuesta de una tanda de revision con estas piezas (todas del mismo formato). */
const revision = (est, piezas, prioridad) => ({
  tipo: 'revision',
  formato: est.piezas[piezas[0]].formato,
  piezas: piezas.map((p) => ({ pieza: p, firma: est.piezas[p].firma, ronda: est.piezas[p].ronda })),
  prioridad,
});

/**
 * Lo que sigue. `hechos` (lo que vio en disco): { ahora, imagenes: {pieza: firma}, recortes: {pieza: firma},
 * vistas: {pieza: true}, finales: {pieza: true}, ordenesVivas: ['T003'], conLogo }.
 * `opciones`: { claudeLibre, motorLibre, localLibre, simulada, motor? } (motor: 'claude' | 'codex'; sin el, la IA
 * elegida ahora, motorActual()). La IA solo cambia el tamaño de las tandas nuevas.
 * Devuelve { orden, claude, simulada, local, terminado }:
 *   orden     { piezas: [{ pieza, orden, modo, version, ... }] } para el motor (o null)
 *   claude    la tanda que toca ({ tanda?, tipo, ids | piezas | pedidos, formato?, prioridad }) o null
 *   simulada  las piezas que revisa la revision simulada del modo prueba (sin Claude)
 *   local     lo que hace ffmpeg: [{ tipo: 'recortes'|'vista'|'logo', pieza }] (como mucho 2)
 */
export function decidir(est, hechos = {}, opciones = {}) {
  progresar(est, hechos);
  const ahora = Number(hechos.ahora) || Date.now();
  const piezas = listaDePiezas(est);
  const d = { orden: null, claude: null, simulada: [], local: [], terminado: false };

  // ---- el motor
  const enMotor = piezas.filter((p) => est.piezas[p].fase === 'pedida');
  if (opciones.motorLibre !== false) {
    const vivas = new Set(enMotor.map(vDe));
    const candidatas = piezas.filter((p) => ['por-pedir', 'reintento'].includes(est.piezas[p].fase) && est.piezas[p].orden && !est.piezas[p].orden.trabajo);
    const rango = (p) => {
      const x = est.piezas[p];
      if (String(x.orden.id).startsWith('U')) return 0;
      if (x.orden.id === 'rev' || /^rev\d$/.test(x.orden.id)) return 1;
      return x.formato === '1:1' ? 2 : 3;
    };
    candidatas.sort((a, b) => rango(a) - rango(b) || ordenDePiezas(a, b));
    const cupo = Math.min(TOPES.porOrden, TOPES.pedidasALaVez - enMotor.length);
    const elegidas = [];
    for (const p of candidatas) {
      if (elegidas.length >= cupo) break;
      if (vivas.has(vDe(p))) continue; // nunca dos ordenes vivas para la misma variacion
      vivas.add(vDe(p));
      elegidas.push(p);
    }
    if (elegidas.length) {
      d.orden = {
        piezas: elegidas.map((p) => {
          const o = est.piezas[p].orden;
          return {
            pieza: p,
            orden: o.id,
            modo: o.modo || 'generar',
            version: o.version || 1,
            ...(o.motivo ? { motivo: o.motivo } : {}),
            ...(o.instruccion_en ? { instruccion_en: o.instruccion_en, textos: Boolean(o.textos) } : {}),
            ...(Array.isArray(o.adjuntos) && o.adjuntos.length ? { adjuntos: o.adjuntos } : {}),
            ...(o.correccion_en ? { correccion_en: o.correccion_en } : {}),
          };
        }),
      };
    }
  }

  // ---- lo que revisa la revision simulada (modo prueba): no necesita a Claude
  if (opciones.simulada) d.simulada = piezas.filter((p) => recortesListos(est, hechos, p));

  // ---- Claude: una tanda a la vez
  const tandaViva = Object.entries(est.tandas || {}).find(([, t]) => t.estado === 'en-curso');
  if (opciones.claudeLibre !== false) {
    if (tandaViva) {
      // una tanda que quedo a medias (se cerro la app, o no le toco su turno): se vuelve a correr con su uuid
      const [id, t] = tandaViva;
      d.claude = { tanda: id, tipo: t.tipo, ...(t.ids ? { ids: t.ids } : {}), ...(t.piezas ? { piezas: t.piezas, formato: t.formato } : {}), ...(t.pedidos ? { pedidos: t.pedidos } : {}), prioridad: PRIORIDAD[t.tipo] || 1 };
      if (t.tipo === 'revision' && opciones.simulada) d.claude = null; // la simulada no la abre Claude
    } else {
      const motor = Object.hasOwn(opciones, 'motor') ? opciones.motor : motorActual();
      d.claude = elegirTanda(est, hechos, opciones, { piezas, ahora, prompts: promptsPorTanda(motor), cuadrados: revisionCuadrados(motor) });
    }
  }

  // ---- el carril local (ffmpeg)
  if (opciones.localLibre !== false) d.local = elegirLocal(est, hechos, piezas);

  d.terminado = estaTerminado(est, hechos, piezas) && !d.orden && !d.claude && !d.simulada.length && !d.local.length;
  return d;
}

function elegirTanda(est, hechos, opciones, { piezas, ahora, prompts: porTanda = promptsPorTanda('claude'), cuadrados = revisionCuadrados('claude') }) {
  // 1. ajustes que pidio el usuario (con instruccion): la IA prepara el cambio antes de rehacer
  const ajustes = Object.values(est.pedidos || {})
    // (la IA mira la vista de la imagen actual: si la imagen existe, se espera a que este su vista)
    .filter((x) => x.estado === 'pendiente' && x.instruccion && x.tipo !== 'prompt' && (!hechos?.imagenes?.[x.pieza] || !hechos?.vistas || hechos.vistas[x.pieza]))
    .sort((a, b) => String(a.fecha || a.id).localeCompare(String(b.fecha || b.id)) || String(a.id).localeCompare(String(b.id)))
    .slice(0, TOPES.ajustesPorTanda);
  if (ajustes.length) return { tipo: 'ajuste', pedidos: ajustes.map((x) => x.id), prioridad: PRIORIDAD.ajuste };

  const listas = piezas.filter((p) => recortesListos(est, hechos, p));
  const sinSimular = opciones.simulada ? [] : listas;
  // 2. la revision de lo que pidio el usuario: sin esperar a juntar
  const deUsuario = sinSimular.filter((p) => est.piezas[p].ronda === 'u');
  if (deUsuario.length) {
    const f = est.piezas[deUsuario[0]].formato;
    const tope = f === '1:1' ? cuadrados : TOPES.revisionVerticales;
    return revision(est, deUsuario.filter((p) => est.piezas[p].formato === f).slice(0, tope), PRIORIDAD['revision-u']);
  }

  const faltan = Object.keys(est.variaciones)
    .filter((v) => est.variaciones[v].prompt === 'falta')
    .sort(ordenDeV);
  const enEscritura = Object.values(est.variaciones).some((x) => x.prompt === 'en-tanda');
  const porHacer = piezas.filter((p) => FASES_DEL_MOTOR.has(est.piezas[p].fase)).length;
  const prompts = () => ({ tipo: 'prompts', ids: faltan.slice(0, porTanda), prioridad: PRIORIDAD.prompts });
  // 3. mas anuncios por escribir si al motor le queda poco
  if (faltan.length && porHacer < TOPES.motorBajo) return prompts();

  // 4 y 5. revision de cuadrados y de verticales
  const faltanPrompts = faltan.length > 0 || enEscritura;
  for (const [f, tope] of [
    ['1:1', cuadrados],
    ['9:16', TOPES.revisionVerticales],
    ['4:5', TOPES.revisionVerticales],
  ]) {
    const de = sinSimular.filter((p) => est.piezas[p].formato === f);
    if (!de.length) continue;
    const cuadradosEnMarcha = piezas.some((p) => est.piezas[p].formato === f && FASES_DEL_MOTOR.has(est.piezas[p].fase));
    const masVieja = Math.min(...de.map((p) => Date.parse(est.piezas[p].desde || '') || ahora));
    if (de.length >= tope || !faltanPrompts || !cuadradosEnMarcha || ahora - masVieja > TOPES.esperaRevisionMs) {
      return revision(est, de.slice(0, tope), PRIORIDAD.revision);
    }
  }
  // 6. los anuncios que faltan escribir
  if (faltan.length) return prompts();
  // 7. lo que quede por revisar
  for (const [f, tope] of [
    ['1:1', cuadrados],
    ['9:16', TOPES.revisionVerticales],
    ['4:5', TOPES.revisionVerticales],
  ]) {
    const de = sinSimular.filter((p) => est.piezas[p].formato === f);
    if (de.length) return revision(est, de.slice(0, tope), PRIORIDAD.revision);
  }
  return null;
}

function elegirLocal(est, hechos, piezas) {
  const tareas = [];
  const agregar = (t) => {
    if (tareas.length < TOPES.localALaVez && !tareas.some((x) => x.tipo === t.tipo && x.pieza === t.pieza)) tareas.push(t);
  };
  // vista y recortes de lo que espera revision (con la firma de su imagen)
  for (const p of piezas) {
    const x = est.piezas[p];
    if (x.fase === 'por-revisar' && x.firma && hechos?.recortes?.[p] !== x.firma && hechos?.imagenes?.[p]) agregar({ tipo: 'recortes', pieza: p });
  }
  // la vista de un cuadrado que hace falta (para revisar su vertical, o para un ajuste)
  const vistaHace = new Set();
  for (const p of piezas) {
    const x = est.piezas[p];
    if (x.formato !== '1:1' && x.fase === 'por-revisar') vistaHace.add(piezaId(x.v, '1:1'));
  }
  for (const ped of Object.values(est.pedidos || {})) if (ped.estado === 'pendiente' && ped.instruccion && ped.pieza) vistaHace.add(ped.pieza);
  for (const p of [...vistaHace].sort(ordenDePiezas)) {
    if (!est.piezas[p] || !hechos?.imagenes?.[p] || hechos?.vistas?.[p]) continue;
    if (['por-revisar', 'pedida'].includes(est.piezas[p].fase)) continue;
    agregar({ tipo: 'vista', pieza: p });
  }
  // el logo de lo que ya esta terminado
  if (hechos?.conLogo) {
    for (const p of piezas) {
      const x = est.piezas[p];
      if (x.fase === 'final' && hechos?.imagenes?.[p] && x.version >= 1 && !hechos?.finales?.[p]) agregar({ tipo: 'logo', pieza: p });
    }
  }
  return tareas;
}

function estaTerminado(est, hechos, piezas) {
  for (const v of Object.keys(est.variaciones)) if (['falta', 'en-tanda'].includes(est.variaciones[v].prompt)) return false;
  for (const p of piezas) {
    const x = est.piezas[p];
    if (est.variaciones[x.v]?.prompt === 'sin-prompt') continue;
    if (x.fase !== 'final') return false;
    if (hechos?.conLogo && hechos?.imagenes?.[p] && x.version >= 1 && !hechos?.finales?.[p]) return false;
  }
  if (pedidosActivos(est).length) return false;
  if (Object.values(est.tandas || {}).some((t) => t.estado === 'en-curso')) return false;
  if ((hechos?.ordenesVivas || []).length) return false;
  return true;
}

// ---------------------------------------------------------------- aplicar lo que volvio

/** Las piezas de una orden nueva ya estan en el motor. */
export function marcarOrden(est, trabajo, orden) {
  for (const x of orden.piezas) {
    const p = est.piezas[x.pieza];
    if (!p) continue;
    p.fase = 'pedida';
    p.orden = { ...(p.orden || {}), id: x.orden, modo: x.modo, version: x.version, trabajo };
  }
}

/**
 * Lo que dijo el motor de una pieza (su T###.resultado.json). Devuelve 'lista', 'sin-imagen' o null (sigue).
 * `firmaActual`: la firma de img/<pieza>.png en este momento (la que va a mirar la revision).
 */
export function aplicarResultado(est, pieza, res, { firmaActual = null, ahora = new Date().toISOString() } = {}) {
  const p = est.piezas[pieza];
  if (!p || p.fase !== 'pedida' || !p.orden || !res || res.orden !== p.orden.id) return null;
  if (Number.isFinite(Number(res.intentosApi))) p.intentosApi = Number(res.intentosApi);
  if (res.estado === 'lista') {
    p.version = Number(res.version) || p.orden.version || p.version + 1;
    p.firma = firmaActual || res.firma || null;
    p.fase = 'por-revisar';
    p.desde = ahora;
    if (p.orden.id === 'rev') p.reintentoAuto = 'hecho';
    p.ultimaOrden = p.orden.id;
    p.orden = null;
    p.motivo = null;
    p.mensaje = null;
    return 'lista';
  }
  if (res.estado === 'sin-imagen') {
    const mensaje = res.mensaje || 'kie no pudo hacer esta imagen';
    const id = p.orden.id;
    // (2026-11-21h) kie la rechazó por contenido (política): la IA reescribe lo que se ve, sin lo que frena, y se pide
    // otra vez (familias/imagen-ads.js corre la reescritura y llama terminarRescate). Hasta RESCATES_POR_CONTENIDO veces.
    const rescates = Number(p.rescates) || 0;
    if (!p.version && /^g(-r\d+)?$/.test(id) && /contenido/.test(String(res.motivo || '')) && formatoDe(pieza) === '1:1' && !p.local && rescates < RESCATES_POR_CONTENIDO) {
      p.fase = 'reescribiendo';
      p.rescate = { vez: rescates + 1, dijo: mensaje };
      p.ultimaOrden = id;
      p.orden = null;
      return 'reescribir';
    }
    if (!p.version) {
      p.fase = 'final';
      p.resultado = 'sin-imagen';
      p.motivo = res.motivo || 'otro';
      p.mensaje = mensaje;
    } else if (id === 'rev' || /^rev\d$/.test(id)) {
      // la imagen de antes sigue en img/: queda con los detalles que vio la revision
      p.fase = 'final';
      p.resultado = 'con-detalles';
      p.reintentoAuto = 'hecho';
      p.revision = { ...(p.revision || {}), problemas: [...(p.revision?.problemas || []), `No se pudo rehacer: ${mensaje}.`] };
    } else {
      p.fase = 'final'; // queda la de antes, con el resultado que tenia
    }
    if (!/^g(-r\d+)?$/.test(id)) p.fallo = { orden: id, mensaje };
    p.ultimaOrden = id;
    p.orden = null;
    return 'sin-imagen';
  }
  return null;
}

/**
 * Pedido (2026-11-21h): «si una imagen falla por política, que la vuelva a generar hasta que dé: que no se quede sin
 * generar». Cuantas veces se reescribe y se pide otra vez el cuadrado que kie rechazó por contenido.
 */
export const RESCATES_POR_CONTENIDO = 3;

/** Las piezas que esperan que la IA reescriba lo que se ve (kie las rechazó por contenido). */
export const piezasPorReescribir = (est) => Object.keys(est.piezas).filter((x) => est.piezas[x].fase === 'reescribiendo');

/** Volvió la reescritura de una pieza rechazada: con `ok`, se pide otra vez; si no, queda sin imagen como antes. */
export function terminarRescate(est, pieza, { ok, mensaje = null } = {}) {
  const p = est.piezas[pieza];
  if (!p || p.fase !== 'reescribiendo') return;
  p.rescates = (Number(p.rescates) || 0) + 1;
  if (ok) {
    p.fase = 'por-pedir';
    p.intentosApi = 0;
    // (el motor recuerda cada pieza por pieza|orden y la «g» ya quedó sin imagen: el nuevo pedido lleva su propia orden)
    p.orden = { id: `g-r${p.rescates}`, modo: 'generar', version: 1 };
    p.motivo = null;
    p.mensaje = null;
  } else {
    p.fase = 'final';
    p.resultado = 'sin-imagen';
    p.motivo = 'contenido';
    p.mensaje = mensaje || p.rescate?.dijo || 'kie rechazó esta imagen por su contenido';
  }
  delete p.rescate;
}

/** Una tanda nueva (o una que se vuelve a correr). `id`: su numero (E005, R003, A001). */
export function iniciarTanda(est, propuesta, id, uuid) {
  const ya = est.tandas[id];
  if (ya) return ya;
  const t = { tipo: propuesta.tipo, uuid, estado: 'en-curso' };
  if (propuesta.tipo === 'prompts') {
    t.ids = [...propuesta.ids];
    for (const v of t.ids) est.variaciones[v] = { prompt: 'en-tanda', tanda: id };
  } else if (propuesta.tipo === 'revision') {
    t.formato = propuesta.formato;
    t.piezas = propuesta.piezas.map((x) => ({ ...x }));
    for (const x of t.piezas) {
      const p = est.piezas[x.pieza];
      p.fase = 'revisando';
      p.tandaRevision = id;
    }
  } else if (propuesta.tipo === 'ajuste') {
    t.pedidos = [...propuesta.pedidos];
    for (const u of t.pedidos) {
      const ped = est.pedidos[u];
      ped.estado = 'ajustando';
      ped.ajuste = id;
      if (est.piezas[ped.pieza]?.fase === 'final') est.piezas[ped.pieza].fase = 'ajustando';
    }
  }
  est.tandas[id] = t;
  return t;
}

/** La tanda de anuncios termino bien: esas variaciones ya se pueden pedir al motor. */
export function aplicarPrompts(est, id) {
  const t = est.tandas[id];
  if (!t) return;
  for (const v of t.ids || []) est.variaciones[v] = { prompt: 'listo', tanda: id };
  t.estado = 'hecha';
}

/**
 * Lo que dijo la revision (`json` = { revisadas: [{ pieza, ok, problemas }] }). Solo vale para la firma que miro: si la
 * imagen cambio desde entonces, esa pieza vuelve a esperar revision. `firmas`: { pieza: firma actual }.
 */
export function aplicarRevision(est, id, json, firmas = {}) {
  const t = est.tandas[id];
  if (!t) return [];
  const aplicadas = [];
  for (const x of t.piezas || []) {
    const p = est.piezas[x.pieza];
    if (!p || p.fase !== 'revisando' || p.tandaRevision !== id) continue;
    delete p.tandaRevision;
    const actual = Object.hasOwn(firmas, x.pieza) ? firmas[x.pieza] : p.firma;
    if (!actual || actual !== x.firma) {
      p.fase = 'por-revisar';
      p.firma = actual;
      continue;
    }
    const e = (json?.revisadas || []).find((r) => r?.pieza === x.pieza);
    if (!e) {
      p.fase = 'por-revisar';
      continue;
    }
    // (2026-11-26b) los 7 puntajes contra la estructura ganadora: con alguno bajo 8, no pasa (queda para rehacer)
    const puntajes = e.puntajes && typeof e.puntajes === 'object' ? Object.fromEntries(CRITERIOS.map((k) => [k, Math.max(0, Math.min(10, Math.round(Number(e.puntajes[k]) || 0)))])) : null;
    const bajos = puntajes ? CRITERIOS.filter((k) => puntajes[k] < NOTA_MINIMA) : [];
    const ok = e.ok === true && !bajos.length;
    const problemas = [...(Array.isArray(e.problemas) ? e.problemas.map(String).filter((s) => s.trim()) : []), ...(bajos.length ? [`No llega a ${NOTA_MINIMA} en: ${bajos.map((k) => `${NOMBRES_CRITERIOS[k]} (${puntajes[k]})`).join(', ')}.`] : [])];
    const ronda = x.ronda ?? p.ronda;
    // lo que salio mal, en ingles y corto, para el modelo de imagen (lo escribe la revision cuando algo falla): si
    // despues piden «otra version» de esta imagen (o «Corregir esto»), va con ella para no repetir el error
    const correccion = !ok && typeof e.correccion_en === 'string' ? e.correccion_en.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
    // (2026-11-26a) la nota de venta (1-10) de los lotes de «Variantes» con el selector: la pantalla los ordena por ella
    const nota = Number.isInteger(e.nota) && e.nota >= 1 && e.nota <= 10 ? e.nota : null;
    p.revision = { tanda: id, ronda, ok, problemas, firma: x.firma, ...(correccion ? { correccion_en: correccion } : {}), ...(nota ? { nota } : {}), ...(puntajes ? { puntajes } : {}) };
    // Todo al primer intento: sin reintento automatico. Lo que vio la revision queda como nota de la pieza («con
    // detalles») y el usuario decide (Regenerar, con o sin instruccion). (ronda 2 solo viene de un lote de antes.)
    p.fase = 'final';
    p.resultado = ok ? (ronda === 2 ? 'arreglado' : 'listo') : 'con-detalles';
    aplicadas.push(x.pieza);
  }
  t.estado = 'hecha';
  return aplicadas;
}

/**
 * Lo que preparo la IA para los pedidos con instruccion (`json` = { pedidos: [{ id, aplicado, cambia_textos,
 * instruccion_en, resumen, motivo }] }).
 */
export function aplicarAjuste(est, id, json) {
  const t = est.tandas[id];
  if (!t) return;
  for (const u of t.pedidos || []) {
    const ped = est.pedidos[u];
    if (!ped || ped.estado !== 'ajustando') continue;
    const e = (json?.pedidos || []).find((x) => x?.id === u);
    const p = est.piezas[ped.pieza];
    if (p?.fase === 'ajustando') p.fase = 'final';
    if (!e || e.aplicado !== true) {
      ped.estado = 'no-aplicado';
      ped.motivo = String(e?.motivo || 'La IA no pudo preparar este cambio.');
      continue;
    }
    ped.instruccion_en = String(e.instruccion_en || '');
    ped.cambiaTextos = e.cambia_textos === true;
    ped.resumen = String(e.resumen || '');
    ped.pasos = pasosDelPedido(est, ped, { instruccionEn: ped.instruccion_en, cambiaTextos: ped.cambiaTextos });
    iniciarPaso(est, ped, 0);
  }
  t.estado = 'hecha';
}

/**
 * La revision es solo un aviso (decision de Diego, 2026-11-09): si la IA no puede revisar ahora (se acabo el uso de su
 * plan), esas piezas quedan «sin revisar» con su nota y el lote sigue (escribir los anuncios que faltan, en cambio, si
 * espera al plan). `piezas`: las de una tanda de revision o las que esperan revision; `tanda`: la tanda que no se pudo
 * correr (queda 'sin-plan' y no se vuelve a correr). Devuelve las piezas que quedaron «sin revisar».
 */
export function dejarSinRevisar(est, piezas, { tanda = null, mensaje = null, resultado = 'sin-revisar' } = {}) {
  const hechas = [];
  for (const id of piezas) {
    const p = est.piezas[id];
    if (!p || !['por-revisar', 'revisando'].includes(p.fase)) continue;
    if (tanda && p.fase === 'revisando' && p.tandaRevision !== tanda) continue;
    delete p.tandaRevision;
    p.fase = 'final';
    // (el modo rápido no lleva revisión de la IA: sus imágenes quedan «listo» apenas salen)
    p.resultado = resultado === 'listo' ? 'listo' : 'sin-revisar';
    p.mensaje = mensaje || null;
    hechas.push(id);
  }
  if (tanda && est.tandas?.[tanda]?.estado === 'en-curso') est.tandas[tanda].estado = 'sin-plan';
  return hechas;
}

/** Las piezas que esperan que la IA las revise (ya estan hechas). */
export const piezasPorRevisar = (est) => listaDePiezas(est).filter((p) => est.piezas[p].fase === 'por-revisar');

/** Dos fallos de verdad: el resultado de la tanda es definitivo (lo muestra el informe). */
export function marcarFallida(est, id) {
  const t = est.tandas[id];
  if (!t) return;
  if (t.tipo === 'prompts') {
    for (const v of t.ids || []) if (est.variaciones[v]?.tanda === id) est.variaciones[v] = { prompt: 'sin-prompt', tanda: id };
  } else if (t.tipo === 'revision') {
    for (const x of t.piezas || []) {
      const p = est.piezas[x.pieza];
      if (!p || p.fase !== 'revisando' || p.tandaRevision !== id) continue;
      delete p.tandaRevision;
      p.fase = 'final';
      p.resultado = 'sin-revisar';
    }
  } else if (t.tipo === 'ajuste') {
    for (const u of t.pedidos || []) {
      const ped = est.pedidos[u];
      if (!ped || ped.estado !== 'ajustando') continue;
      if (est.piezas[ped.pieza]?.fase === 'ajustando') est.piezas[ped.pieza].fase = 'final';
      ped.estado = 'no-aplicado';
      ped.motivo = 'La IA no pudo preparar este cambio. Prueba de nuevo, o sin instrucción para otra versión.';
    }
  }
  t.estado = 'fallida';
}

/** Los pedidos nuevos de pedidos.json (los escriben las rutas). Devuelve cuantos entraron. */
export function absorberPedidos(est, lista) {
  let n = 0;
  for (const x of Array.isArray(lista) ? lista : []) {
    if (!x?.id || est.pedidos[x.id]) continue;
    est.pedidos[x.id] = {
      id: x.id,
      ...(x.tipo === 'prompt' ? { tipo: 'prompt', v: x.v } : { pieza: x.pieza }),
      instruccion: typeof x.instruccion === 'string' ? x.instruccion.trim() : '',
      // (2026-11-26h) las imágenes que adjuntó el usuario al pedir el cambio (entrada/adjuntos/A0001.jpg)
      ...(Array.isArray(x.adjuntos) && x.adjuntos.length ? { adjuntos: x.adjuntos.filter((a) => RE_ADJUNTO.test(String(a))).slice(0, 3) } : {}),
      fecha: x.fecha || null,
      estado: 'pendiente',
    };
    n++;
  }
  return n;
}

/** Cuantas piezas hay en cada momento (para la frase de avance y la pantalla). */
export function cuentas(est) {
  const c = { total: 0, listas: 0, enMotor: 0, porRevisar: 0, revisando: 0, escritas: 0, variaciones: 0 };
  for (const p of Object.keys(est.piezas)) {
    const x = est.piezas[p];
    if (est.variaciones[x.v]?.prompt === 'sin-prompt') continue;
    c.total++;
    if (x.fase === 'final') c.listas++;
    if (x.fase === 'pedida') c.enMotor++;
    if (x.fase === 'por-revisar') c.porRevisar++;
    if (x.fase === 'revisando') c.revisando++;
  }
  for (const v of Object.keys(est.variaciones)) {
    c.variaciones++;
    if (est.variaciones[v].prompt === 'listo') c.escritas++;
  }
  return c;
}

export { numeroDeV };
