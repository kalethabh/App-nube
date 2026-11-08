// Simulación de la producción (VISTA PREVIA DEL DISEÑO): con las piezas reales de un anuncio ya
// terminado, recrea cómo irían llegando desde kie: la voz y la música primero, las hojas, cada imagen
// que sale apenas está su hoja, cada clip que sale apenas está su imagen, la revisión, el montaje, el
// render y el control final. Los tiempos imitan los de la propuesta (Omni ~1-1,5 min por clip,
// Sunburst ~1-2 min por imagen, 10 a la vez por anuncio) y se ven acelerados.
//
// Nada de esto llama a kie: es solo un reloj que recorre las piezas que ya están en el disco.
import { useEffect, useRef, useState } from 'react';
import { fraseArreglo, quien } from './modelo.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';

const CARRILES = { imagen: 10, clip: 10 };
export const POST = { revision: 25, montaje: 55, render: 75, control: 15 };
export const DURACION_REHACER = 60;

// Azar repetible: la misma pieza tarda lo mismo cada vez que se repite la simulación.
function azar(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function duracionDe(p) {
  const r = azar(p.id);
  let d;
  if (p.tipo === 'hoja') d = 55 + r * 55;
  else if (p.clase === 'imagen') d = 42 + r * 66;
  else d = 52 + r * 46;
  if (p.estado === 'arreglado' && !['voz-colada', 'reintento'].includes(p.motivo)) d *= 1.75;
  else if (p.estado === 'arreglado') d *= 1.25;
  return d;
}

/** La pieza que en la simulación sale con un defecto que te necesita (solo voz en off y cantados). */
function elegirDefecto(modelo, forzado) {
  // desde el tablero ("¿Rehago la toma 7?") se pide una pieza en particular
  if (forzado && modelo.porId.get(forzado)?.url) return forzado;
  if (modelo.hablado) return null;
  const candidatas = modelo.piezas.filter((p) => p.tipo === 'inicial' && p.estado === 'listo' && p.url);
  if (candidatas.length < 4) return null;
  return candidatas[Math.floor(candidatas.length * 0.55)].id;
}

export const TEXTO_DEFECTO = 'el personaje no se parece al de su hoja';

/**
 * Calcula cuándo empieza y termina cada pieza (en segundos simulados), con carriles de 10 imágenes
 * y 10 clips a la vez, respetando de qué depende cada una.
 */
export function planificar(modelo, { defecto: forzado = null, problema = null } = {}) {
  const defecto = elegirDefecto(modelo, forzado);
  const tiempos = new Map();
  const pend = new Map(modelo.piezas.map((p) => [p.id, new Set(p.depende.filter((d) => modelo.porId.has(d)))]));
  const listos = new Set();
  const enCurso = { imagen: [], clip: [] };
  const voz = modelo.conVoz && !modelo.cantado && !modelo.hablado ? { inicio: 0, fin: 16 + azar(modelo.slug) * 8 } : null;
  const musica = modelo.conMusica && !modelo.cantado ? { inicio: 0, fin: 70 + azar(`${modelo.slug}-m`) * 60 } : null;
  const inicioHojas = modelo.cantado ? 4 : 0;

  let t = 0;
  let guarda = 0;
  const disponibles = () =>
    modelo.piezas
      .filter((p) => !tiempos.has(p.id) && pend.get(p.id).size === 0)
      .sort((a, b) => a.prioridad - b.prioridad || a.id.localeCompare(b.id, 'es', { numeric: true }));

  while (listos.size < modelo.piezas.length && guarda++ < 5000) {
    for (const p of disponibles()) {
      const carril = enCurso[p.clase];
      if (carril.length >= CARRILES[p.clase]) continue;
      const inicio = Math.max(t, p.tipo === 'hoja' || p.tipo === 'icono' ? inicioHojas : 0);
      const d = duracionDe(p);
      const fin = inicio + d;
      const repite = p.estado === 'arreglado' ? inicio + d * 0.55 : null;
      tiempos.set(p.id, { inicio, fin, repite });
      carril.push(p.id);
    }
    const corriendo = [...enCurso.imagen, ...enCurso.clip];
    if (!corriendo.length) break; // dependencias rotas: lo que quede, queda en espera
    const proximo = Math.min(...corriendo.map((id) => tiempos.get(id).fin));
    t = proximo;
    for (const lado of ['imagen', 'clip']) {
      enCurso[lado] = enCurso[lado].filter((id) => {
        if (tiempos.get(id).fin > t + 1e-6) return true;
        listos.add(id);
        for (const dep of modelo.dependientes.get(id) || []) pend.get(dep)?.delete(id);
        return false;
      });
    }
  }

  const fin = (lista) => Math.max(0, ...lista.filter((p) => tiempos.has(p.id)).map((p) => tiempos.get(p.id).fin));
  const finImagenes = fin(modelo.imagenes);
  const finClips = fin(modelo.clips);
  // Todos los que dependen (directa o indirectamente) del defecto: se frenan solo ellos.
  const frenados = new Set();
  if (defecto) {
    const cola = [defecto];
    while (cola.length) {
      for (const d of modelo.dependientes.get(cola.shift()) || []) {
        if (frenados.has(d)) continue;
        frenados.add(d);
        cola.push(d);
      }
    }
  }
  return { tiempos, voz, musica, defecto, frenados, finImagenes, finClips, inicioHojas, problema: (defecto && problema) || TEXTO_DEFECTO };
}

/** El segundo de la simulación en que ya llegaron todas las imágenes y todos los clips. */
export function finDePiezas(modelo, plan) {
  const m = estadoEn(modelo, plan, 0, { defecto: null, aprobada: null }).marcas;
  return Math.max(m.videos.fin, m.imagenes.fin);
}

/**
 * El estado de todo en el segundo `t` de la simulación.
 * decisiones: { defecto: { decision: 'bien'|'rehacer', en } | null, aprobada: segundo | null }
 */
export function estadoEn(modelo, plan, t, decisiones) {
  const { tiempos, defecto, frenados } = plan;
  const dDef = decisiones.defecto;
  const finDefecto = defecto ? tiempos.get(defecto)?.fin ?? 0 : 0;
  // Cuándo queda resuelto el defecto (Infinity mientras nadie decide)
  const resueltoEn = !defecto ? 0 : !dDef ? Infinity : dDef.decision === 'rehacer' ? dDef.en + DURACION_REHACER : dDef.en;
  const corrimiento = defecto && Number.isFinite(resueltoEn) ? Math.max(0, resueltoEn - finDefecto) : 0;

  const estados = new Map();
  let ultimo = null;
  const conteo = { imagenes: 0, clips: 0, generandoImg: 0, generandoClip: 0, arreglados: 0, necesitan: 0 };
  const finDe = (id) => {
    const x = tiempos.get(id);
    if (!x) return Infinity;
    if (frenados.has(id)) return Number.isFinite(resueltoEn) ? x.fin + corrimiento : Infinity;
    return x.fin;
  };
  const inicioDe = (id) => {
    const x = tiempos.get(id);
    if (!x) return Infinity;
    if (frenados.has(id)) return Number.isFinite(resueltoEn) ? x.inicio + corrimiento : Infinity;
    return x.inicio;
  };

  for (const p of modelo.piezas) {
    const ini = inicioDe(p.id);
    const fin = finDe(p.id);
    let estado;
    let nota = null;
    if (p.id === defecto) {
      if (t < ini) estado = 'en-cola';
      else if (t < fin) estado = 'generando';
      else if (!dDef) estado = 'te-necesita';
      else if (dDef.decision === 'rehacer' && t < dDef.en + DURACION_REHACER) {
        estado = 'generando';
        nota = 'rehaciendo';
      } else estado = dDef.decision === 'rehacer' ? 'arreglado' : 'listo';
    } else if (t < ini) {
      estado = 'en-cola';
      if (frenados.has(p.id) && !Number.isFinite(resueltoEn)) nota = 'frenada';
    } else if (t < fin) {
      estado = 'generando';
      const rep = tiempos.get(p.id)?.repite;
      if (rep && t >= rep) nota = 'repitiendo';
    } else estado = p.estado;

    estados.set(p.id, { estado, nota });
    const terminada = estado === 'listo' || estado === 'arreglado' || estado === 'te-necesita';
    if (terminada) {
      if (p.clase === 'imagen') conteo.imagenes++;
      else conteo.clips++;
      if (estado === 'arreglado') conteo.arreglados++;
      if (estado === 'te-necesita') conteo.necesitan++;
      const llegada = p.id === defecto && dDef?.decision === 'rehacer' ? dDef.en + DURACION_REHACER : fin;
      if (Number.isFinite(llegada) && llegada <= t && (!ultimo || llegada >= ultimo.t)) ultimo = { id: p.id, t: llegada };
    } else if (estado === 'generando') {
      if (p.clase === 'imagen') conteo.generandoImg++;
      else conteo.generandoClip++;
    }
  }

  // ---------------------------------------------------------------- etapas
  const maxFin = (lista) => {
    let m = 0;
    for (const p of lista) {
      const f = p.id === defecto ? resueltoEn : finDe(p.id);
      if (!Number.isFinite(f)) return Infinity;
      m = Math.max(m, f);
    }
    return m;
  };
  const tImagenes = maxFin(modelo.imagenes.filter((p) => !(modelo.hablado && p.tipo === 'hoja')));
  const tHojas = maxFin(modelo.imagenes.filter((p) => p.tipo === 'hoja'));
  const tClips = maxFin(modelo.clips);
  const tVoz = modelo.cantado ? 4 : modelo.hablado ? tHojas : plan.voz ? plan.voz.fin : 4;
  const tVideos = Math.max(tClips, tImagenes);
  const tRevision = modelo.hablado ? (decisiones.aprobada !== null && decisiones.aprobada !== undefined ? Math.max(decisiones.aprobada, tVideos) : Infinity) : tVideos + POST.revision;
  const tMontaje = tRevision + POST.montaje;
  const tRender = tMontaje + POST.render;
  const tControl = tRender + POST.control;
  const primerInicio = (lista) => Math.min(Infinity, ...lista.map((p) => inicioDe(p.id)));
  const marcas = {
    voz: { inicio: 0, fin: tVoz },
    imagenes: { inicio: primerInicio(modelo.imagenes), fin: tImagenes },
    videos: { inicio: primerInicio(modelo.clips), fin: tClips },
    revision: { inicio: tVideos, fin: tRevision },
    montaje: { inicio: tRevision, fin: tMontaje },
    render: { inicio: tMontaje, fin: tRender },
    control: { inicio: tRender, fin: tControl },
  };
  const etapa = {};
  for (const [id, m] of Object.entries(marcas)) etapa[id] = t >= m.fin ? 'hecha' : t >= m.inicio ? 'en-marcha' : 'pendiente';

  const terminado = Number.isFinite(tControl) && t >= tControl;
  const revisionPendiente = modelo.hablado && Number.isFinite(tVideos) && t >= tVideos && (decisiones.aprobada === null || decisiones.aprobada === undefined);
  const defectoPendiente = Boolean(defecto && !dDef && t >= finDefecto);
  // "te necesita" = hay una decisión tuya pendiente; "en pausa" = además ya no queda nada más andando
  const necesita = defectoPendiente || revisionPendiente;
  const enCamino = conteo.generandoImg + conteo.generandoClip;
  const esperandoTu = revisionPendiente || (defectoPendiente && enCamino === 0);
  // Lo que falta: si algo te espera, se calcula como si decidieras ahora mismo.
  let finEstimado = tControl;
  if (!Number.isFinite(finEstimado)) {
    const corrAhora = defecto ? Math.max(0, (Number.isFinite(resueltoEn) ? resueltoEn : t) - finDefecto) : 0;
    let videosSupuesto = 0;
    for (const p of [...modelo.imagenes, ...modelo.clips]) {
      const x = tiempos.get(p.id);
      if (!x) continue;
      const f = frenados.has(p.id) ? x.fin + corrAhora : p.id === defecto ? Math.max(x.fin, t) : x.fin;
      videosSupuesto = Math.max(videosSupuesto, f);
    }
    finEstimado = Math.max(t, videosSupuesto) + (modelo.hablado ? 0 : POST.revision) + POST.montaje + POST.render + POST.control;
  }

  return {
    t,
    estados,
    conteo,
    etapa,
    marcas,
    ultimo,
    terminado,
    esperandoTu,
    necesita,
    falta: Math.max(0, finEstimado - t),
    total: finEstimado,
    vozLista: !plan.voz || t >= plan.voz.fin,
    musicaLista: !plan.musica || t >= plan.musica.fin,
    defecto,
    resueltoEn,
  };
}

/** El registro de la simulación: cada cosa que pasó hasta el segundo t, del más nuevo al más viejo. */
export function registroSimulado(a, modelo, plan, vista, decisiones) {
  const r = [];
  const { t } = vista;
  const add = (en, estado, texto, extra = {}) => {
    if (Number.isFinite(en) && en <= t) r.push({ en, estado, texto, ...extra });
  };
  add(0, 'generando', 'Empezó la producción.');
  if (plan.voz) add(plan.voz.fin, 'listo', `Voz lista${a.duracion ? ` (${fmtDuracion(a.duracion)})` : ''}.`);
  if (modelo.cantado) add(2, 'listo', 'Tu canción ya estaba elegida: arrancan las imágenes.');
  if (plan.musica) add(plan.musica.fin, 'listo', 'Música de fondo lista.');
  for (const h of modelo.hojas) {
    const x = plan.tiempos.get(h.id);
    if (x) add(x.fin, h.estado === 'arreglado' ? 'arreglado' : 'listo', h.estado === 'arreglado' ? `${quien(h)}: ${fraseArreglo(h.motivo, h.clase)}.` : `${quien(h)} lista.`, { pieza: h.id });
  }
  // los arreglos (lo que se repitió solo)
  for (const p of modelo.piezas) {
    if (p.tipo === 'hoja' || p.tipo === 'icono' || p.estado !== 'arreglado' || p.id === plan.defecto) continue;
    const e = vista.estados.get(p.id);
    const x = plan.tiempos.get(p.id);
    if (!x || !e) continue;
    if (e.estado === 'arreglado') add(x.fin, 'arreglado', `${quien(p)}: ${fraseArreglo(p.motivo, p.clase)}.`, { pieza: p.id });
  }
  // hitos de clips: 25 %, 50 %, 75 %
  const finClips = modelo.clips
    .map((p) => (vista.estados.get(p.id)?.estado === 'listo' || vista.estados.get(p.id)?.estado === 'arreglado' ? plan.tiempos.get(p.id)?.fin : null))
    .filter((x) => x !== null && x !== undefined)
    .sort((x, y) => x - y);
  const total = modelo.clips.length;
  for (const q of [0.25, 0.5, 0.75]) {
    const k = Math.ceil(total * q);
    if (k > 0 && k < total && finClips[k - 1] !== undefined) add(finClips[k - 1], 'generando', `${k} de ${total} clips listos.`);
  }
  const m = vista.marcas;
  if (modelo.imagenes.some((p) => p.tipo !== 'hoja')) add(m.imagenes.fin, 'listo', `Todas las imágenes listas (${modelo.imagenes.length}).`);
  add(m.videos.fin, 'listo', `Todos los clips listos (${total}).`);
  if (plan.defecto) {
    const p = modelo.porId.get(plan.defecto);
    const x = plan.tiempos.get(plan.defecto);
    add(x.fin, 'te-necesita', `${quien(p)}: ${plan.problema}. Ya se repitió una vez: te toca decidir.`, { pieza: p.id });
    const d = decisiones.defecto;
    if (d?.decision === 'bien') add(d.en, 'listo', `${quien(p)}: la dejaste así. El clip sigue.`, { pieza: p.id });
    if (d?.decision === 'rehacer') {
      add(d.en, 'generando', `${quien(p)}: se rehace con el mismo guion.`, { pieza: p.id });
      add(d.en + DURACION_REHACER, 'listo', `${quien(p)}: lista la nueva versión.`, { pieza: p.id });
    }
  }
  if (modelo.hablado) {
    add(m.revision.inicio, 'te-necesita', `Te toca revisar los ${clipsHablados(modelo)} clips antes de montar.`, { revision: true });
    if (decisiones.aprobada !== null && decisiones.aprobada !== undefined) add(m.revision.fin, 'listo', 'Aprobaste los clips. Empieza el montaje.');
  } else add(m.revision.fin, 'listo', `La IA revisó los ${total} clips: sin voces coladas, cuadros negros ni congelados.`);
  add(m.montaje.fin, 'listo', 'Montaje armado: transiciones, subtítulos y música.');
  add(m.render.fin, 'listo', 'Versión completa lista. Las otras salen del editor.');
  add(m.control.fin, 'listo', 'Control final sin problemas. ¡Tu anuncio está listo!', { destacado: true });
  // sin repetidos (la misma frase de la misma pieza en el mismo segundo)
  const vistas = new Set();
  return r
    .filter((x) => {
      const k = claveRegistro(x);
      if (vistas.has(k)) return false;
      vistas.add(k);
      return true;
    })
    .sort((x, y) => y.en - x.en);
}

/** Identifica una línea del registro (sirve de key en la lista). */
export const claveRegistro = (e) => `${e.pieza || ''}|${e.texto}|${e.en ?? e.fecha}`;

const clipsHablados = (modelo) => modelo.tomas.filter((g) => g.flujo.some((p) => p.tipo === 'clip')).length;

/** "ahora" · "hace 40 s" · "hace 3 min" (en tiempo simulado) */
export function haceSim(seg) {
  const s = Math.max(0, Math.round(seg));
  if (s < 8) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.floor(s / 60)} min`;
}

/**
 * Reloj de la simulación. `factor` = segundos simulados por segundo real.
 * Devuelve [t, { reiniciar, fijar }]. Se detiene solo en `hasta`.
 */
export function useReloj({ activo, factor, pausado, hasta }) {
  const [t, setT] = useState(0);
  const ref = useRef({ t: 0, ultimo: 0 });
  useEffect(() => {
    if (!activo || pausado) return undefined;
    ref.current.ultimo = performance.now();
    const id = setInterval(() => {
      const ahora = performance.now();
      const dt = ((ahora - ref.current.ultimo) / 1000) * factor;
      ref.current.ultimo = ahora;
      const siguiente = Math.min(hasta ?? Infinity, ref.current.t + dt);
      if (siguiente === ref.current.t) return;
      ref.current.t = siguiente;
      setT(siguiente);
    }, 140);
    return () => clearInterval(id);
  }, [activo, pausado, factor, hasta]);
  const fijar = (v) => {
    ref.current.t = v;
    ref.current.ultimo = performance.now();
    setT(v);
  };
  return [t, { fijar, reiniciar: () => fijar(0) }];
}
