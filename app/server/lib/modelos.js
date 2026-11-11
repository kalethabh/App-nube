// Los modelos de IA en la app: que se puede elegir, que eligio el usuario y que usa cada anuncio.
//
//   produccion/catalogo-modelos.json   el catalogo (JSON puro, lo comparten el motor y la app): las categorias de
//                                      Ajustes › Modelos, sus opciones y el orden en que se prueban los modelos de
//                                      cada una (la cascada: si el primero falla, el siguiente). La app lo LEE como
//                                      JSON: no se importa ni se ejecuta nada del motor.
//   app/config.json -> "modelos"       lo que eligio el usuario: { vozEnOff: 'omni', ..., imagen: 'gpt25' }
//                                      (en modo prueba, el config.json del modo prueba: lib/rutas.js)
//   temp/<slug>/modelos.json           la copia de cada anuncio ({ ...eleccion, guardado: ISO }), la que lee el motor.
//                                      Se escribe SOLO en copiarModelosAlAnuncio: al crear el anuncio, antes de cada
//                                      paso del motor (lib/procesos.js) mientras el anuncio no este aprobado ni tenga
//                                      nada generado, y al aprobarlo (y al elegir la cancion de los cantados).
//                                      Despues no se toca: un anuncio empezado sigue con los suyos. Sin archivo, el
//                                      motor usa los de siempre (los por defecto del catalogo).
//
//   catalogo() · eleccionPorDefecto() · normalizarEleccion(obj) · eleccionDeAjustes() · eleccionDeCarpeta(dir)
//   categoriasParaLaPantalla() · modelosParaConexiones() · nombreDeModelo(id) · esModeloConDialogo(id)
//   categoriaDeVideo(manifiesto, pieza) · cascadaVideo(eleccion, categoria, { referencias }) · cascadaDeLaPieza(...)
//   duracionPara(id, s) · creditosDeClip(id, s, { sonido }) · creditosDeImagen(eleccion)
//   copiarModelosAlAnuncio(slug, { alAprobar })
//
// Los nombres que ve el alumno salen del catalogo (nunca el id de kie). Las cascadas y la categoria de cada clip
// son las mismas que arma el motor (produccion/modelos-elegidos.js): si cambian alla, cambian aca.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, TEMP, DOLARES_POR_CREDITO, esDeEstaApp } from './rutas.js';
import { leerJSON, existe, listar, segmentoValido, escribirJSONSeguro } from './archivos.js';
import { leerConfig } from './config.js';
// Funciones puras: no cargan claves ni lanzan procesos. Comparten precios y resolución
// con el motor para que las estimaciones respeten 1080p y RESOLUCION_VIDEO.
import { MODELOS_VIDEO, RESOLUCION_VIDEO, duracionPara as duracionDelMotor, creditosClip as costoDelMotor } from '../../../produccion/config.js';

const RUTA_CATALOGO = path.join(RAIZ, 'produccion', 'catalogo-modelos.json');
export const ARCHIVO_DEL_ANUNCIO = 'modelos.json';

const OMNI = 'google/gemini-omni-flash-1-1';
const KLING = 'kling-3.0/video';
// Lo de siempre (antes de que se pudiera elegir), para una opcion sin la cascada pedida: como el motor.
const FRAMES_DE_SIEMPRE = Object.freeze([OMNI, KLING]);
const REFERENCIAS_DE_SIEMPRE = Object.freeze([OMNI]);
// Los estilos donde se habla a camara con B-roll de apoyo (produccion/config.js, ESTILOS_HABLADOS).
const ESTILOS_HABLADOS = ['podcast', 'entrevista'];

// ---------------------------------------------------------------- el catalogo

let cache = null; // { mtime, valor }
let avisado = false;

/** El catalogo de modelos ({ version, modelos, categorias }). Si no se puede leer: sin categorias (nada que elegir). */
export function catalogo() {
  let mtime = 0;
  try {
    mtime = fs.statSync(RUTA_CATALOGO).mtimeMs;
  } catch {
    /* sin catalogo: abajo */
  }
  if (cache && cache.mtime === mtime) return cache.valor;
  const c = leerJSON(RUTA_CATALOGO);
  const valido = c && typeof c === 'object' && c.modelos && typeof c.modelos === 'object' && Array.isArray(c.categorias);
  if (!valido && !avisado) {
    avisado = true;
    console.error('  [modelos] No pude leer produccion/catalogo-modelos.json: se usan los modelos de siempre.');
  }
  const valor = valido ? c : { version: 0, modelos: {}, categorias: [] };
  cache = { mtime, valor };
  return valor;
}

const categoriaDe = (id) => catalogo().categorias.find((c) => c.id === id) || null;

// ---------------------------------------------------------------- la eleccion

/** { vozEnOff: 'omni', objetoParlante: 'omni', ugc: 'omni', podcastEntrevista: 'omni', brollHablado: 'kling', imagen: 'gpt25' } */
export function eleccionPorDefecto() {
  return Object.fromEntries(catalogo().categorias.map((c) => [c.id, c.porDefecto]));
}

/** Completa con los por defecto e ignora lo que no existe (categorias, opciones, "guardado"). Nunca lanza. */
export function normalizarEleccion(obj) {
  const entrada = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const salida = {};
  for (const c of catalogo().categorias) {
    const v = entrada[c.id];
    salida[c.id] = typeof v === 'string' && c.opciones.some((o) => o.id === v) ? v : c.porDefecto;
  }
  return salida;
}

/** Lo que eligio el usuario en Ajustes › Modelos (para los anuncios nuevos). */
export const eleccionDeAjustes = () => normalizarEleccion(leerConfig().modelos);

/** Lo que usa un anuncio: su temp/<slug>/modelos.json o, sin el, los de siempre (lo mismo que hace el motor). */
export function eleccionDeCarpeta(carpeta) {
  const crudo = carpeta ? leerJSON(path.join(carpeta, ARCHIVO_DEL_ANUNCIO)) : null;
  return normalizarEleccion(crudo);
}
export const eleccionDelAnuncio = (slug) => eleccionDeCarpeta(segmentoValido(slug) ? path.join(TEMP, slug) : null);

/**
 * Valida un cambio parcial { categoriaId: opcionId } contra el catalogo (listas cerradas).
 * { ok: true, eleccion } con la eleccion completa nueva, o { ok: false, error } en palabras simples.
 */
export function aplicarCambios(actual, cambios) {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) return { ok: false, error: 'Elige un modelo para guardar.' };
  const claves = Object.keys(cambios);
  if (!claves.length) return { ok: false, error: 'Elige un modelo para guardar.' };
  const nueva = normalizarEleccion(actual);
  for (const k of claves) {
    const c = categoriaDe(k);
    if (!c) return { ok: false, error: 'Ese tipo de anuncio no tiene modelos para elegir.' };
    const v = cambios[k];
    if (typeof v !== 'string' || !c.opciones.some((o) => o.id === v)) return { ok: false, error: `Ese modelo no está disponible en “${c.nombre}”.` };
    nueva[k] = v;
  }
  return { ok: true, eleccion: nueva };
}

// ---------------------------------------------------------------- nombres

/** El id del catalogo de un id de kie: el mismo, o el mas largo que sea su comienzo (kie devuelve variantes). */
function idDelCatalogo(id) {
  const s = String(id ?? '');
  if (!s) return null;
  const modelos = catalogo().modelos;
  if (Object.hasOwn(modelos, s)) return s;
  let mejor = null;
  for (const k of Object.keys(modelos)) if (s.startsWith(k) && (!mejor || k.length > mejor.length)) mejor = k;
  return mejor;
}

/**
 * El nombre que ve el alumno: el del catalogo ('google/gemini-omni-flash-1-1' -> 'Omni Flash 1.1',
 * 'nano-banana-2-1' -> 'Nano Banana 2.1'). Lo que no esta en el catalogo (Suno, un modelo viejo de un log) se
 * nombra por su id, con la version si la trae. null si no se sabe.
 */
export function nombreDeModelo(m) {
  const k = idDelCatalogo(m);
  if (k && catalogo().modelos[k]?.nombre) return catalogo().modelos[k].nombre;
  const s = String(m || '').toLowerCase();
  if (!s) return null;
  if (s.includes('omni')) {
    const v = s.match(/flash[-_ ]?(\d+)[-_.](\d+)/);
    return v ? `Omni Flash ${v[1]}.${v[2]}` : 'Omni Flash';
  }
  if (s.includes('kling')) {
    const v = s.match(/kling[-_ v]*(\d+(?:\.\d+)?)/);
    return v ? `Kling ${v[1]}` : 'Kling';
  }
  if (s.includes('grok')) {
    const v = s.match(/grok-imagine-video-(\d+)-(\d+)/);
    return v ? `Grok Imagine ${v[1]}.${v[2]}` : 'Grok Imagine';
  }
  if (s.includes('pixverse')) {
    const v = s.match(/pixverse-v(\d+(?:\.\d+)?)/);
    return v ? `PixVerse V${v[1]}` : 'PixVerse';
  }
  if (s.includes('sunburst')) {
    const v = s.match(/gpt-image-(\d+)-(\d+)/);
    return v ? `GPT Image ${v[1]}.${v[2]}` : 'GPT Image';
  }
  if (s.includes('gpt-image')) {
    const v = s.match(/gpt-image-(\d+)(?:-(\d+))?/);
    return v ? `GPT Image ${v[1]}${v[2] ? `.${v[2]}` : ''}` : 'GPT Image';
  }
  if (s.includes('nano-banana')) {
    const v = s.match(/nano-banana-(\d+)(?:-(\d+))?/);
    return v ? `Nano Banana ${v[1]}${v[2] ? `.${v[2]}` : ''}` : 'Nano Banana';
  }
  if (s.includes('seedream')) return 'Seedream';
  if (s.includes('veo')) return 'Veo';
  if (s.includes('suno')) return 'Suno';
  return null;
}

/**
 * Si el modelo hace hablar al personaje (campo "dialogo" del catalogo). Un id que el catalogo no conoce: null (no
 * se sabe; quien pregunta decide con lo de antes).
 */
export function esModeloConDialogo(id) {
  const k = idDelCatalogo(id);
  return k ? catalogo().modelos[k].dialogo === true : null;
}

/**
 * Si un clip salio sin el dialogo, segun su registro (log-modelos.json del motor o clips-modelos.json de la app):
 * manda su campo "dialogo"; si no lo trae, el catalogo por su modelo; si tampoco, lo de antes (el respaldo era Kling,
 * que no habla).
 */
export function clipSinDialogo(registro) {
  if (!registro || typeof registro !== 'object') return false;
  if (typeof registro.dialogo === 'boolean') return !registro.dialogo;
  const conDialogo = registro.modelo ? esModeloConDialogo(registro.modelo) : null;
  if (conDialogo !== null) return !conDialogo;
  return Boolean(registro.respaldo);
}

// ---------------------------------------------------------------- cascadas (las mismas que arma el motor)

/** Si la pieza va por el camino de referencias (bloque R de UGC, gancho, toma H por ingredientes). */
export function usaReferencias(pieza) {
  const t = pieza || {};
  return t.tipo === 'R' || t.clase === 'gancho' || t.porIngredientes === true || (t.tipo === 'H' && Array.isArray(t.ingredientes) && t.ingredientes.length > 0);
}

/**
 * La categoria de un clip (como categoriaDeVideo del motor): 'vozEnOff' | 'objetoParlante' | 'ugc' |
 * 'podcastEntrevista' | 'brollHablado'. `pieza` es una toma o un B-roll del manifiesto ({ clase: 'broll' } basta).
 */
export function categoriaDeVideo(manifiesto, pieza = null) {
  const m = manifiesto || {};
  const t = pieza || {};
  const esBroll = t.clase === 'broll' || t.tipo === 'broll';
  if (ESTILOS_HABLADOS.includes(m.estilo)) return esBroll ? 'brollHablado' : 'podcastEntrevista';
  if (t.tipo === 'R' || t.clase === 'gancho' || (m.tomas || []).some((x) => x?.tipo === 'R')) return 'ugc';
  if (m.continuidad != null) return 'vozEnOff';
  if (m.modo_audio === 'voz_en_off' || m.modo_audio === 'musica') return 'vozEnOff';
  return 'objetoParlante';
}

function opcionElegida(eleccion, idCategoria) {
  const c = categoriaDe(idCategoria);
  if (!c) return null;
  const id = normalizarEleccion(eleccion)[idCategoria];
  return c.opciones.find((o) => o.id === id) || c.opciones.find((o) => o.id === c.porDefecto) || null;
}

/** Los modelos, en orden de intento, de una categoria (frames o, con `referencias`, el camino de referencias). */
export function cascadaVideo(eleccion, idCategoria, { referencias = false } = {}) {
  const tipo = referencias ? 'referencias' : 'frames';
  const c = categoriaDe(idCategoria);
  const lista = opcionElegida(eleccion, idCategoria)?.cascadas?.[tipo];
  if (Array.isArray(lista) && lista.length) return [...lista];
  const porDefecto = c?.opciones.find((o) => o.id === c.porDefecto)?.cascadas?.[tipo];
  if (Array.isArray(porDefecto) && porDefecto.length) return [...porDefecto];
  return [...(referencias ? REFERENCIAS_DE_SIEMPRE : FRAMES_DE_SIEMPRE)];
}

/** La cascada de una pieza del manifiesto (toma o B-roll). */
export const cascadaDeLaPieza = (eleccion, manifiesto, pieza) =>
  cascadaVideo(eleccion, categoriaDeVideo(manifiesto, pieza), { referencias: usaReferencias(pieza) });

/** El modelo que hace los clips de una categoria (el primero de su cascada), con su nombre. */
export function modeloPrincipal(eleccion, idCategoria, opciones) {
  const id = cascadaVideo(eleccion, idCategoria, opciones)[0];
  return { id, nombre: nombreDeModelo(id) };
}

// ---------------------------------------------------------------- duraciones y creditos (solo para estimar)

// Las duraciones y los precios se leen de la misma tabla pura que usa el motor.
/** El largo que se pide para cubrir `segundos` con ese modelo (como duracionPara del motor). null si no llega. */
export function duracionPara(id, segundos) {
  const modelo = idDelCatalogo(id) || id;
  return MODELOS_VIDEO[modelo] ? duracionDelMotor(modelo, Number(segundos) || 0) : null;
}

/** Lo mas largo que hace un clip de la cascada entera (el tope del que menos llega): 10 con Omni. */
export function duracionMaximaDeCascada(cascada) {
  const topes = (cascada || []).map((id) => {
    const def = MODELOS_VIDEO[idDelCatalogo(id) || id];
    if (!def) return null;
    return def.duraciones ? Math.max(...def.duraciones) : def.duracionMax ?? null;
  }).filter((x) => x !== null);
  return topes.length ? Math.min(...topes) : null;
}

/**
 * Los creditos de un clip de `segundos` con ese modelo (a la resolución configurada). `sonido: false` = Kling sin audio (el B-roll de
 * los hablados). null si el modelo no hace ese largo o no se conoce.
 */
export function creditosDeClip(id, segundos, { sonido } = {}) {
  const modelo = idDelCatalogo(id) || id;
  if (!MODELOS_VIDEO[modelo]) return null;
  return costoDelMotor(modelo, segundos, RESOLUCION_VIDEO, { sonido }).creditos;
}

/**
 * Lo que costaria un clip con su cascada: `primero` = el primer modelo que hace ese largo (lo esperable);
 * `peor` = el mas caro de los que lo hacen (por si falla el primero). null si ninguno.
 */
export function creditosDeCascada(cascada, segundos, { sonido } = {}) {
  const precios = (cascada || []).map((id) => creditosDeClip(id, segundos, { sonido })).filter((c) => c !== null);
  return precios.length ? { primero: precios[0], peor: Math.max(...precios) } : null;
}

/** Los creditos de una imagen con la eleccion de imagen (el costo de su opcion en el catalogo). */
export function creditosDeImagen(eleccion) {
  const o = opcionElegida(eleccion, 'imagen');
  const c = Number(o?.costo?.min);
  return Number.isFinite(c) && c > 0 ? c : 10;
}

/** Si la pieza va con sonido (el B-roll de los hablados va mudo, como lo pide el motor). */
export const sonidoDeLaPieza = (manifiesto, pieza) => (categoriaDeVideo(manifiesto, pieza) === 'brollHablado' ? false : undefined);

/**
 * Lo tipico de un anuncio, para estimar lo que no tiene registro: { imagen, clip } en creditos. El clip, uno de 6 s
 * con el primer modelo de su categoria principal (con Omni, 84: lo de siempre).
 */
export function creditosTipicos(carpeta) {
  const eleccion = eleccionDeCarpeta(carpeta);
  const m = carpeta ? leerJSON(path.join(carpeta, 'manifiesto.json')) : null;
  const toma = (m?.tomas || [])[0] || null;
  const cascada = cascadaDeLaPieza(eleccion, m, toma);
  return { imagen: creditosDeImagen(eleccion), clip: creditosDeCascada(cascada, 6)?.primero ?? 84 };
}

// ---------------------------------------------------------------- para la pantalla

const dinero = (creditos) => {
  const usd = Math.round(Number(creditos) * DOLARES_POR_CREDITO * 100 + 1e-6) / 100;
  return usd.toFixed(2).replace('.', ',');
};

/** "≈ US$0,63 por clip de 10 s" · "≈ US$0,23 a 0,36 por clip de 10 s" · "≈ US$0,05 por imagen". */
export function costoTexto(costo) {
  const min = Number(costo?.min);
  const max = Number(costo?.max ?? costo?.min);
  if (!Number.isFinite(min)) return null;
  const por = costo?.por ? ` por ${costo.por}` : '';
  const a = dinero(min);
  const b = Number.isFinite(max) ? dinero(max) : a;
  return `≈ US$${a}${b !== a ? ` a ${b}` : ''}${por}`;
}

/**
 * "Si falla, usa Omni Flash 1.1 y después Kling 3.0": los modelos que siguen al primero en sus cascadas, sin
 * repetir y sin los que ya nombra la opcion (PixVerse V6 + Grok Imagine 1.5). null si no hay ninguno.
 */
export function siFallaTexto(opcion) {
  const propios = new Set(String(opcion?.nombre || '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean));
  const listas = Array.isArray(opcion?.cascada) ? [opcion.cascada] : Object.values(opcion?.cascadas || {});
  const nombres = [];
  for (const lista of listas) {
    for (const id of (Array.isArray(lista) ? lista : []).slice(1)) {
      const n = nombreDeModelo(id);
      if (n && !propios.has(n) && !nombres.includes(n)) nombres.push(n);
    }
  }
  if (!nombres.length) return null;
  if (nombres.length === 1) return `Si falla, usa ${nombres[0]}`;
  return `Si falla, usa ${nombres.slice(0, -1).join(', después ')} y después ${nombres.at(-1)}`;
}

/** El precio de una opción a la resolución efectiva; conserva los precios de imágenes. */
export function costoDeOpcion(categoria, opcion) {
  if (categoria?.id === 'imagen' || !opcion?.cascadas) return opcion?.costo;
  const propios = String(opcion.nombre || '').split(/\s*\+\s*/).map((s) => s.trim());
  const modelos = [...new Set(Object.values(opcion.cascadas).flat())];
  const elegidos = modelos.filter((id) => propios.includes(nombreDeModelo(id)));
  const precios = (elegidos.length ? elegidos : modelos.slice(0, 1))
    .map((id) => creditosDeClip(id, 10, { sonido: categoria.id === 'brollHablado' ? false : undefined }))
    .filter((x) => x !== null);
  return precios.length ? { ...opcion.costo, min: Math.min(...precios), max: Math.max(...precios) } : opcion.costo;
}

/** Las categorias como las muestra Ajustes › Modelos (sin ids de kie ni cascadas). */
export function categoriasParaLaPantalla() {
  return catalogo().categorias.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    porDefecto: c.porDefecto,
    opciones: c.opciones.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      recomendado: o.recomendado === true,
      nota: o.nota || null,
      costoTexto: costoTexto(costoDeOpcion(c, o)),
      siFallaTexto: siFallaTexto(o),
    })),
  }));
}

/** Lo que va en GET /api/ajustes y en la respuesta del PUT: { eleccion, categorias }. */
export const modelosParaAjustes = () => ({ eleccion: eleccionDeAjustes(), categorias: categoriasParaLaPantalla() });

/**
 * Las pastillas de Ajustes › Conexiones: { imagen, video, respaldo, musica }. video = lo elegido para la voz en off;
 * respaldo = el primer modelo de su cascada que la opcion no nombra.
 */
export function modelosParaConexiones() {
  const eleccion = eleccionDeAjustes();
  const voz = opcionElegida(eleccion, 'vozEnOff');
  const img = opcionElegida(eleccion, 'imagen');
  const cascada = cascadaVideo(eleccion, 'vozEnOff');
  const propios = new Set(String(voz?.nombre || '').split(/\s*\+\s*/).map((s) => s.trim()));
  const respaldo = cascada.slice(1).map(nombreDeModelo).find((n) => n && !propios.has(n)) || null;
  return {
    imagen: img?.nombre || nombreDeModelo(img?.cascada?.[0]) || 'GPT Image 2.5',
    video: voz?.nombre || nombreDeModelo(cascada[0]) || 'Omni Flash 1.1',
    respaldo,
    musica: 'Suno',
  };
}

// ---------------------------------------------------------------- la copia de cada anuncio

const PIEZA_GENERADA = /\.(png|jpe?g|webp|mp4|webm|mov)$|\.kie-pendiente\.json$/i;

/** Si el anuncio ya tiene algo generado (o pedido a kie): una imagen en img/ o un video en video/. */
export function hayAlgoGenerado(carpeta) {
  const mirar = (dir, profundidad) => {
    for (const n of listar(dir)) {
      const ruta = path.join(dir, n);
      let st;
      try {
        st = fs.statSync(ruta);
      } catch {
        continue;
      }
      if (st.isFile() && PIEZA_GENERADA.test(n)) return true;
      if (st.isDirectory() && profundidad < 2 && mirar(ruta, profundidad + 1)) return true;
    }
    return false;
  };
  return mirar(path.join(carpeta, 'img'), 0) || mirar(path.join(carpeta, 'video'), 0);
}

const mismaEleccion = (a, b) => Object.keys(b).every((k) => a?.[k] === b[k]);

/**
 * El UNICO lugar que escribe temp/<slug>/modelos.json: lo elegido en Ajustes, mientras el anuncio no tenga nada
 * generado y todavia no este aprobado (al crearlo y antes de cada paso del motor: si el usuario cambia Ajustes antes
 * de aprobar, se usa lo nuevo). Con algo generado no se toca nunca, y un anuncio viejo sin archivo sigue sin el (el
 * motor usa los de siempre). Solo en los anuncios de esta app (esDeEstaApp, por su brief): una app de prueba en otro
 * puerto no le escribe sus modelos a un anuncio del usuario, ni al reves. Devuelve la eleccion que queda en el
 * anuncio, o null si no escribio nada. Nunca lanza.
 *
 * Ya aprobado (tiene app/conductor.json) se queda con lo que tenia al aprobarlo: si mientras espera su turno o hace
 * la voz cambias Ajustes (o tocas «Usar este» en el costo estimado de OTRO anuncio), este no cambia, y cuesta lo que
 * decia su costo estimado al aprobarlo. Solo `alAprobar` copia de nuevo: al aprobar el guion (aprobarGuion de
 * anuncios-nuevos.js, tambien uno reabierto) y al elegir la version de la cancion de los cantados (rutas/cancion.js:
 * esa pausa muestra el costo con lo de Ajustes y deja cambiarlo).
 */
export function copiarModelosAlAnuncio(slug, { alAprobar = false } = {}) {
  try {
    if (!segmentoValido(slug)) return null;
    const carpeta = path.join(TEMP, slug);
    if (!existe(carpeta) || hayAlgoGenerado(carpeta)) return null;
    const brief = leerJSON(path.join(carpeta, 'app', 'brief.json'));
    if (!esDeEstaApp(brief)) return null;
    // un lote de anuncios de imagen no lleva modelos.json: va siempre con GPT Image 2.5 a 2K (y lo que quede sin
    // registro se estima a ese precio, con los de siempre)
    if (brief?.familia === 'imagen-ads') return null;
    const ruta = path.join(carpeta, ARCHIVO_DEL_ANUNCIO);
    const actual = leerJSON(ruta);
    // aprobado: con lo que tenia al aprobarlo (sin archivo, como antes: se copia)
    if (!alAprobar && actual && existe(path.join(carpeta, 'app', 'conductor.json'))) return null;
    const eleccion = eleccionDeAjustes();
    if (!Object.keys(eleccion).length) return null; // sin catalogo no hay nada que copiar
    if (mismaEleccion(actual, eleccion)) return eleccion;
    escribirJSONSeguro(ruta, { ...eleccion, guardado: new Date().toISOString() });
    return eleccion;
  } catch (e) {
    console.error(`  [modelos] No pude guardar los modelos de ${slug}: ${e?.message || e}`);
    return null;
  }
}
