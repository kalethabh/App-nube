// Los anuncios nuevos que arma la app, desde el producto hasta el guion aprobado. Sirve a los 12 estilos (y a la
// continuidad, que va encima de uno de los 6 de voz en off).
//
//   temp/<slug>/                       lo del motor (manifiesto.json, transiciones.json, producto.<ext>, img/, video/…)
//   temp/<slug>/modelos.json           los modelos de IA del anuncio: la copia de Ajustes › Modelos al crearlo y al
//                                        aprobarlo (la escribe y la mantiene lib/modelos.js, copiarModelosAlAnuncio; la
//                                        lee el motor). Aprobado, ya no sigue a Ajustes.
//   temp/<slug>/app/brief.json         { slug, productoId, estilo, familia, faseGuion, duracion, voz: { id, nombre } | null,
//                                        continuidad, respuestas, opciones, creado }
//                                        duracion = { decide: "ia" } (la decide la IA, lo recomendado) o { decide:
//                                        "usuario", texto, segundos } (lo que dijo, aproximado); null en el musical. Los
//                                        anuncios de antes guardaban un numero: ver lib/duracion.js
//                                        respuestas = lo que eligio en el formulario del estilo, con las palabras de la
//                                        pantalla (lo que no viene = "que decida la IA"); opciones = lo mismo en valores
//                                        fijos para la produccion (ver opcionesDe)
//   temp/<slug>/app/sesion.json        { uuid, estado, ... } la conversacion de Claude que escribe el guion
//                                        estado: escribiendo | cambiando | listo | error | bloqueado | aprobado
//   temp/<slug>/app/guion.json         lo que ve el usuario para aprobar (lo escribe Claude; la app lo deja prolijo)
//   temp/<slug>/app/letras.json        los cantados. Musical: las 2 o 3 letras que escribe Claude; al aprobar, la app
//                                        le agrega "elegida" (n). Historia musical: la arma la app con la letra de
//                                        cancion/peticion.json (una sola opcion, ya elegida)
//   temp/<slug>/cancion/peticion.json  lo que se le pide a Suno. Historia musical: lo escribe Claude en el guion.
//                                        Musical: lo escribe la app al aprobar, con la letra elegida
//   temp/<slug>/app/bloqueo.json       Claude no pudo seguir sin un dato que la skill prohibe inventar
//   temp/<slug>/app/historial-guion/   el guion de antes de cada cambio pedido
//   temp/<slug>/app/registro/guion.log lo que hizo Claude, evento por evento
//
// slug = <producto>-<estilo>-<aaaammdd-hhmm>. Dos fases de guion (ESTILOS[estilo].faseGuion):
//   "guion"  Claude escribe el anuncio con la skill hasta el manifiesto y valida; la app da por bueno el guion si
//            guion.json pasa su esquema, el manifiesto valida (codigo 0) y estan las transiciones del estilo. Lo que se
//            dice en guion.json se copia siempre del manifiesto: lo que el usuario aprueba es lo que se produce.
//   "letras" los cantados: Claude escribe la letra, no las tomas (las tomas se escriben despues de la cancion, sobre
//            sus tiempos reales: eso ya es de la familia). Lo que se canta se copia siempre de letras.json o de
//            cancion/peticion.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { TEMP, RAIZ, APP, PUERTO_DE_PRUEBA, esDeEstaApp } from './rutas.js';
import { leerJSON, existe, listar, stat, segmentoValido } from './archivos.js';
import * as configApp from './config.js';
import { sesionActiva, prohibidasComunes, enTerminales, textoClaude, leerYValidar, matar } from './claude.js';
// la IA elegida (Claude o ChatGPT) con la pausa compartida: si su plan se acabo, no se abre otra sesion hasta que se
// renueve
import { lanzarSesion } from './colas.js';
import { nombreIA } from './motor-ia.js';
import { prohibidasDeAnuncio } from './ia/reglas.js';
import { ErrorApp, escribirJSON, aKebab, idValido as productoValido, leerProducto, leerFicha, fotoPrincipal, relProducto, detalleDelProducto, errorPublico, urlFoto } from './productos.js';
import { ESTILOS as PRESENTACION } from './estilos.js';
import { brollDe } from './broll.js';
import { subestilosDe, idDeSubestilo } from './subestilos.js';
import { textoParaClaude as textoAprendizajes, textoAhorro } from './aprendizajes.js';
import { audioPorId, avatarPorId, carpetaDeEstilo, prepararAvatar, prepararMusica } from './biblioteca.js';
import { prepararReferencia, referenciaPedida, textoClonar } from './clonar.js';
import { textoEstructuras, textoInvestigacion } from './estructuras.js';
import { conDuracion, entenderDuracion, leerDuracion, duracionAprox, segundosPedidos } from './duracion.js';
import { copiarModelosAlAnuncio } from './modelos.js';

// ---------------------------------------------------------------- los estilos

/**
 * Los 12 estilos que arma la app. familia = el modulo que lo produce (lib/familias/<familia>.js); con continuidad, los 6
 * de voz en off los produce "continuidad" (familiaDe).
 *   faseGuion     "guion" (hasta el manifiesto) o "letras" (los cantados: la letra y nada de tomas)
 *   transiciones  escribe transiciones.json en el guion (nunca con continuidad)
 *   narrador      lleva la voz de ElevenLabs que elige el usuario; solo estos pueden pedir continuidad
 */
export const ESTILOS = {
  claymation: { skill: 'anuncios-claymation', nombre: 'Claymation', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  crochet: { skill: 'anuncios-crochet', nombre: 'Crochet', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  'zack-d-films': { skill: 'anuncios-zack-d-films', nombre: 'Zack D Films', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  'estilo-pixar': { skill: 'anuncios-estilo-pixar', nombre: 'Estilo Pixar', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  'realista-narrado': { skill: 'anuncios-realista-narrado', nombre: 'Realista con narrador', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true, sinContinuidad: true },
  skeleton: { skill: 'anuncios-skeleton-ads', nombre: 'Esqueleto', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  'estilo-lego': { skill: 'anuncios-estilo-lego', nombre: 'Estilo Lego', familia: 'voz-en-off', faseGuion: 'guion', transiciones: true, narrador: true },
  'talking-object-pixar': { skill: 'anuncios-talking-object-pixar', nombre: 'Objeto parlante', familia: 'objeto-parlante', faseGuion: 'guion', transiciones: true },
  ugc: { skill: 'anuncios-ugc', nombre: 'UGC', familia: 'ugc', faseGuion: 'guion', transiciones: true },
  podcast: { skill: 'anuncios-podcast', nombre: 'Podcast', familia: 'hablado', faseGuion: 'guion', transiciones: false },
  entrevista: { skill: 'anuncios-entrevista', nombre: 'Entrevista callejera', familia: 'hablado', faseGuion: 'guion', transiciones: false },
  musical: { skill: 'anuncios-musicales', nombre: 'Musical', familia: 'musical', faseGuion: 'letras', transiciones: false },
  'historias-musicales': { skill: 'anuncios-historias-musicales', nombre: 'Historia musical', familia: 'historia-musical', faseGuion: 'letras', transiciones: false },
};
/** El nombre de la etapa 1 (cuando solo estaba claymation). */
export const ESTILOS_ACTIVOS = ESTILOS;
/** Los 6 de voz en off: los unicos donde se puede pedir continuidad. */
export const CON_CONTINUIDAD = Object.keys(ESTILOS).filter((k) => ESTILOS[k].narrador && !ESTILOS[k].sinContinuidad);

/** La familia que produce este anuncio: la del estilo, o "continuidad" si la pidio en uno de voz en off. */
export function familiaDe(brief) {
  const def = ESTILOS[brief?.estilo];
  if (!def) return null;
  return brief.continuidad && def.narrador && !def.sinContinuidad ? 'continuidad' : def.familia;
}

/**
 * La duracion que llega del formulario -> como queda en el brief. Sin nada (o "ia"), la decide la IA; con un texto
 * ("2 minutos", "35 s"), lo que dijo el usuario con sus segundos aproximados. Un numero (segundos) tambien se entiende.
 * El musical corto no lleva (null): la pone la cancion.
 */
export function duracionPedida(estilo, valor) {
  if (!conDuracion(estilo)) return null;
  if (valor === undefined || valor === null || valor === '' || valor === 'ia' || (typeof valor === 'object' && valor?.decide === 'ia')) return { decide: 'ia' };
  const texto =
    typeof valor === 'number'
      ? `${valor} s`
      : typeof valor === 'string'
        ? valor
        : typeof valor === 'object'
          ? String(valor.texto || (Number(valor.segundos) > 0 ? `${Number(valor.segundos)} s` : ''))
          : '';
  const r = entenderDuracion(texto);
  if (!r.ok) throw new ErrorApp(400, r.motivo, { tipo: 'duracion' });
  return { decide: 'usuario', texto: texto.trim().replace(/\s+/g, ' ').slice(0, 40), segundos: r.segundos };
}

// Las preguntas del formulario de cada estilo (las mismas ids que src/pantallas/estilos/catalogo.js). La respuesta llega
// con las palabras de la pantalla; la que no llega es "que decida la IA" (o `dice`, la de siempre, si tiene una).
// `falta` = obligatoria (la skill prohibe decidirla sola) y el mensaje si no viene. `valor` = como queda en
// brief.opciones para la produccion.
const de = (texto, pares) => {
  for (const [re, v] of pares) if (re.test(texto)) return v;
  return undefined;
};
const VOZ_CANTADA = (t) => de(t, [[/femenin|mujer|ella/i, 'f'], [/masculin|hombre|[eé]l\b/i, 'm']]);
const AJUSTES = {
  claymation: { angulo: {} },
  crochet: { angulo: {}, personaje: {} },
  'zack-d-films': {
    fondo: { falta: 'Elige el fondo de las tomas que explican el mecanismo.', valor: (t) => de(t, [[/estudio|limpio|sin grilla/i, 'estudio'], [/grilla|grid|azul/i, 'grilla']]) },
    angulo: {},
  },
  'estilo-pixar': { angulo: {} },
  'realista-narrado': { narra: {}, angulo: {} },
  skeleton: { formato: {} },
  'estilo-lego': { estructura: {} },
  'talking-object-pixar': { quien_habla: {} },
  ugc: { tipo: {}, ganchos: { valor: (t) => de(t, [[/^\s*no\b/i, false], [/s[ií]/i, true]]), porDefecto: true, dice: 'Sí, los 2 ganchos' } },
  podcast: { hosts: {}, edades: {}, modo: { valor: (t) => de(t, [[/esquina/i, 'esquina'], [/dividida/i, 'dividida']]), porDefecto: 'dividida', dice: 'Pantalla dividida' } },
  entrevista: {
    persona: { falta: 'Cuenta a quién paran en la calle (por ejemplo: mujer de 35, mamá que corre con los niños).' },
    ciudad: { falta: 'Escribe la ciudad donde ocurre la entrevista.' },
    idioma: { falta: 'Elige el idioma del anuncio.', valor: (t) => de(t, [[/ingl|english|\ben\b/i, 'en'], [/portug|\bpt\b/i, 'pt'], [/espa|\bes\b/i, 'es']]) },
    cta: { falta: 'Escribe el llamado a la acción que va en pantalla al final (por ejemplo: Pídelo en el botón de abajo).' },
    lado: { valor: (t) => de(t, [[/derech/i, 'derecha'], [/izquier/i, 'izquierda']]), porDefecto: 'izquierda', dice: 'Izquierda' },
    brazos: {},
    pronunciacion: { dice: 'se lee como se escribe' },
    variante: { valor: (t) => de(t, [[/^\s*a\b|callejero/i, 'A'], [/^\s*b\b|completa/i, 'B']]), porDefecto: null },
  },
  // (las de los cantados las leen tambien familias/musical.js y server/claude/estilos/musical.md)
  musical: {
    visual: { falta: 'Elige con qué estilo visual se hace el video de la canción.', valor: (t) => de(t, [[/crochet|tejid/i, 'crochet'], [/clay|plastilina/i, 'claymation'], [/zack|3d/i, 'zack-d-films']]) },
    genero: {},
    canta: { valor: VOZ_CANTADA, porDefecto: null },
  },
  'historias-musicales': {
    cuenta: {},
    villano: {},
    cierre: { valor: (t) => de(t, [[/tarjeta/i, 'tarjeta'], [/cantad|canci[oó]n/i, 'cantado']]), porDefecto: null },
    genero: {},
    canta: { valor: VOZ_CANTADA, porDefecto: null },
  },
};
// El subestilo (sacado de anuncios reales que venden) en cada estilo que tiene: va en ajustes y en brief.opciones con su id.
for (const [clave, def] of Object.entries(ESTILOS)) {
  if (!AJUSTES[clave] || !subestilosDe(def.skill).length) continue;
  AJUSTES[clave].subestilo = { valor: (t) => idDeSubestilo(def.skill, t), porDefecto: null };
}
// Clonar un video (lib/clonar.js): en todos los estilos menos los cantados. Se responde con un archivo subido o un link.
for (const [clave, def] of Object.entries(ESTILOS)) {
  if (!AJUSTES[clave] || def.faseGuion === 'letras') continue;
  AJUSTES[clave].clonar = { dice: 'sin video de referencia' };
  AJUSTES[clave].clonar_gancho = { dice: 'Sí, adáptalo a mi producto' };
}

const GUIA_SUBESTILO =
  '`subestilo`: si trae uno, es como si el mensaje dijera "Subestilo: <ese>" (búscalo por su id o su nombre en la tabla de subestilos de la skill) y sigues su ficha, sus fotogramas y su tabla de "fotograma" por toma. Cada `prompt_video` se escribe desde el movimiento del original: antes, mira con Read `subestilos/<id>/movimiento/<nombre del fotograma>.jpg` (seis cuadros de ese plano) y su duración en `movimiento/planos.json`, y describe ese mismo movimiento de cámara y del personaje, con el ritmo de cortes del original. Los personajes salen como en la sección «Los avatares» de la ficha (su retrato `avatar/<rol>.jpg` va como `"fotograma"` de su hoja, salvo las personas reales filmadas: de esas se describe el tipo y nunca se adjunta su foto); con "que decida la IA", eliges tú con la regla de la skill (o ninguno) y lo anotas en "decisiones".';

// como se llama cada cosa en brief.opciones (si no, la misma id)
const NOMBRE_OPCION = { modo: 'modoBroll', canta: 'vocalGender' };

/**
 * brief.opciones: las respuestas que cambian la produccion, en valores fijos (lo que no esta = que decida la IA, o el
 * de siempre). zack-d-films { fondo: 'grilla'|'estudio' } · ugc { ganchos: true|false } · podcast { modoBroll:
 * 'dividida'|'esquina' } · entrevista { idioma: 'es'|'en'|'pt', lado: 'izquierda'|'derecha', variante: 'A'|'B'|null } ·
 * musical { visual: 'crochet'|'claymation'|'zack-d-films', vocalGender: 'f'|'m'|null } · historias-musicales
 * { vocalGender, cierre: 'cantado'|'tarjeta'|null }. En los cantados, despues del guion manda lo que escribio Claude
 * (letras.json en el musical, cancion/peticion.json en la historia): el usuario lo puede cambiar pidiendo cambios.
 */
export function opcionesDe(estilo, respuestas = {}) {
  const fuera = {};
  for (const [id, p] of Object.entries(AJUSTES[estilo] || {})) {
    if (!p.valor && !Object.hasOwn(p, 'porDefecto')) continue;
    const r = respuestas[id];
    const v = typeof r === 'string' && r.trim() && p.valor ? p.valor(r) : typeof r === 'boolean' ? r : undefined;
    const final = v !== undefined ? v : p.porDefecto;
    if (final !== undefined) fuera[NOMBRE_OPCION[id] || id] = final;
  }
  return fuera;
}

const ahora = () => new Date().toISOString();
const SLUG = /^[a-z0-9][a-z0-9-]{2,120}$/;
const ID_VOZ = /^[A-Za-z0-9_-]{1,64}$/;

const dirDe = (slug) => path.join(TEMP, slug);
const appDe = (slug) => path.join(TEMP, slug, 'app');
const leerBrief = (slug) => leerJSON(path.join(appDe(slug), 'brief.json'));
const leerSesion = (slug) => leerJSON(path.join(appDe(slug), 'sesion.json'));
const rutaLetras = (slug) => path.join(appDe(slug), 'letras.json');
const rutaPeticion = (slug) => path.join(dirDe(slug), 'cancion', 'peticion.json');
const guardarSesion = (slug, s) => escribirJSON(path.join(appDe(slug), 'sesion.json'), { ...s, actualizado: ahora() });
const esLetras = (brief) => ESTILOS[brief?.estilo]?.faseGuion === 'letras';

/** true si `slug` es un anuncio que armo la app (tiene app/brief.json), aunque todavia no tenga manifiesto. */
export const esAnuncioNuevo = (slug) => segmentoValido(slug) && SLUG.test(slug) && existe(path.join(TEMP, slug, 'app', 'brief.json'));

// ---------------------------------------------------------------- crear

function marcaDeTiempo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** <producto>-<estilo>-<aaaammdd-hhmm>, sin palabras que el tablero esconde ("prueba", "referencia", "_"). */
export function slugNuevo(nombreProducto, estilo, fecha = new Date()) {
  let base = aKebab(nombreProducto, 30).replace(/(^|-)(prueba|referencia)(?=-|$)/g, '$1').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'producto';
  if (!/^[a-z0-9]/.test(base) || /^(prueba|referencia)/.test(base)) base = `p-${base}`;
  const raiz = `${base}-${estilo}-${marcaDeTiempo(fecha)}`;
  let slug = raiz;
  for (let i = 2; existe(dirDe(slug)); i++) slug = `${raiz}-${i}`;
  return slug;
}

/**
 * POST /api/anuncios { productoId, estilo, duracion, voz: { id, nombre }, continuidad, respuestas } -> { slug }
 * duracion: null (la decide la IA) o lo que escribio el usuario ("2 minutos"); ver duracionPedida.
 */
export function crearAnuncio(datos = {}) {
  const { productoId } = datos;
  if (!productoValido(productoId)) throw new ErrorApp(404, 'No encuentro ese producto. Vuelve al paso 1.');
  const ficha = leerFicha(productoId);
  if (!ficha) throw new ErrorApp(409, 'Primero arma la ficha de tu producto (paso 1).');
  const estilo = datos.estilo;
  const def = ESTILOS[estilo];
  if (!def) throw new ErrorApp(400, 'No conozco ese estilo. Elige uno de la galería.');
  const continuidad = Boolean(datos.continuidad);
  if (continuidad && !def.narrador) throw new ErrorApp(400, 'La continuidad solo se puede pedir en los estilos con narrador.');

  const duracion = duracionPedida(estilo, datos.duracion);

  let voz = null;
  if (def.narrador) {
    voz = datos.voz && typeof datos.voz === 'object' ? datos.voz : typeof datos.voz === 'string' ? { id: datos.voz } : null;
    if (!voz) voz = configApp.vozDeEstilo?.(estilo) || null;
    if (!voz || !ID_VOZ.test(String(voz.id || ''))) throw new ErrorApp(400, 'Elige la voz del narrador.');
    voz = { id: String(voz.id), nombre: String(voz.nombre || voz.id).slice(0, 80) };
  }

  const respuestas = datos.respuestas && typeof datos.respuestas === 'object' && !Array.isArray(datos.respuestas) ? limpiarRespuestas(estilo, datos.respuestas) : {};
  for (const [id, p] of Object.entries(AJUSTES[estilo] || {})) {
    if (p.falta && !(typeof respuestas[id] === 'string' && respuestas[id].trim())) throw new ErrorApp(400, p.falta, { tipo: 'falta-ajuste', campo: id });
  }

  // De la biblioteca (lib/biblioteca.js): las personas de un avatar guardado y una música ya pagada.
  const sel = (x) => (x && typeof x === 'object' && typeof x.id === 'string' && typeof x.estilo === 'string' ? { estilo: x.estilo, id: x.id } : null);
  const avatar = sel(datos.avatar);
  if (avatar && !avatarPorId(avatar.estilo, avatar.id)) throw new ErrorApp(404, 'No encuentro ese avatar en tu biblioteca. Elige otro o ninguno.');
  // sin música de fondo: los cantados (la canción es el audio), podcast y entrevista
  const musicaBiblioteca = ['musical', 'historia-musical', 'hablado'].includes(def.familia) ? null : sel(datos.musica);
  if (musicaBiblioteca && !audioPorId(musicaBiblioteca.estilo, musicaBiblioteca.id)) throw new ErrorApp(404, 'No encuentro esa música en tu biblioteca. Elige otra o ninguna.');

  const producto = leerProducto(productoId);
  const slug = slugNuevo(ficha.nombre || producto.nombre || productoId.replace(/-[a-z0-9]{4}$/, ''), estilo);
  fs.mkdirSync(appDe(slug), { recursive: true });
  const brief = { slug, productoId, estilo, familia: null, faseGuion: def.faseGuion, duracion, voz, continuidad, respuestas, opciones: opcionesDe(estilo, respuestas), ...(avatar ? { avatar } : {}), ...(musicaBiblioteca ? { musicaBiblioteca } : {}), creado: ahora(), ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}) };
  brief.familia = familiaDe(brief);
  escribirJSON(path.join(appDe(slug), 'brief.json'), brief);
  // los modelos de IA que eligio en Ajustes › Modelos (el motor los lee de temp/<slug>/modelos.json)
  copiarModelosAlAnuncio(slug);
  // la proxima vez, este estilo sugiere la misma voz
  if (voz) {
    if (configApp.recordarVoz) configApp.recordarVoz(estilo, voz);
    else configApp.guardarConfig({ vozPorEstilo: { ...(configApp.leerConfig().vozPorEstilo || {}), [estilo]: voz } });
  }

  const sesion = { uuid: crypto.randomUUID(), estado: 'escribiendo', tipo: 'guion', intentos: 0, progreso: [], inicio: ahora(), cambios: [] };
  guardarSesion(slug, sesion);
  lanzar(slug, { tipo: 'guion' });
  return { slug };
}

function limpiarRespuestas(estilo, r) {
  const conocidas = AJUSTES[estilo] ? new Set(Object.keys(AJUSTES[estilo])) : null;
  const fuera = {};
  for (const [k, v] of Object.entries(r).slice(0, 30)) {
    if (!/^[\wñ-]{1,60}$/i.test(k) || (conocidas && !conocidas.has(k))) continue;
    if (typeof v === 'string') {
      const t = v.trim().slice(0, 2000);
      if (t) fuera[k] = t;
    } else if (typeof v === 'number' || typeof v === 'boolean') fuera[k] = v;
  }
  return fuera;
}

// ---------------------------------------------------------------- comandos locales (gratis: no llaman a nadie)

function correrNode(script, args, { ms = 120000 } = {}) {
  return new Promise((resolve) => {
    let salida = '';
    let hijo;
    try {
      hijo = spawn(process.execPath, [path.join(RAIZ, 'produccion', script), ...args], { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return resolve({ codigo: -1, salida: e.message });
    }
    const reloj = setTimeout(() => matar(hijo), ms);
    hijo.stdout.on('data', (d) => (salida = (salida + d).slice(-40000)));
    hijo.stderr.on('data', (d) => (salida = (salida + d).slice(-40000)));
    hijo.on('error', (e) => {
      clearTimeout(reloj);
      resolve({ codigo: -1, salida: e.message });
    });
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      resolve({ codigo: codigo ?? -1, salida });
    });
  });
}

const fotoEnCarpeta = (slug) => listar(dirDe(slug)).find((n) => /^producto\.(jpg|jpeg|png|webp)$/i.test(n)) || null;

/** La foto principal del producto, dentro de la carpeta del anuncio (la corre la app, no Claude). */
async function prepararFoto(slug, brief) {
  if (fotoEnCarpeta(slug)) return fotoEnCarpeta(slug);
  const foto = fotoPrincipal(brief.productoId);
  if (!foto) return null;
  const r = await correrNode('preparar-producto.js', [foto, slug], { ms: 90000 });
  if (r.codigo !== 0 || !fotoEnCarpeta(slug)) {
    throw Object.assign(new Error('preparar-producto'), { publico: { mensaje: 'No pude preparar la foto de tu producto. Sube otra foto (JPG o PNG) en el paso 1 y toca "Reintentar".', tipo: 'otro', detalle: r.salida.trim().slice(-400) } });
  }
  return fotoEnCarpeta(slug);
}

/** validar-manifiesto: { codigo, errores: [lineas ERROR] } */
async function validar(slug) {
  const r = await correrNode('validar-manifiesto.js', [`temp/${slug}/manifiesto.json`], { ms: 120000 });
  const errores = r.salida.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('ERROR')).map((l) => l.replace(/^ERROR\s+/, ''));
  if (r.codigo !== 0 && !errores.length) errores.push(r.salida.trim().split(/\r?\n/).slice(-3).join(' ') || 'el manifiesto no valida');
  return { codigo: r.codigo, errores };
}

// ---------------------------------------------------------------- lo que se le manda a Claude

const CAMPOS_FICHA = ['nombre', 'queEs', 'tipo', 'beneficios', 'publico', 'dolor', 'oferta', 'comoCompra', 'idioma', 'mercado', 'pais', 'probo', 'prueba', 'ingredientes', 'comoSeUsa'];

/** Las respuestas del formulario del estilo, todas: lo que no eligio va como "que decida la IA". */
function ajustesParaClaude(brief) {
  const r = brief.respuestas || {};
  const ids = Object.keys(AJUSTES[brief.estilo] || {});
  const fuera = {};
  for (const id of ids) {
    const v = r[id];
    if (v !== undefined && v !== null && v !== '') fuera[id] = v;
    else fuera[id] = AJUSTES[brief.estilo][id].dice || 'que decida la IA';
  }
  for (const [k, v] of Object.entries(r)) if (!(k in fuera)) fuera[k] = v; // un anuncio de una version anterior
  return Object.keys(fuera).length ? fuera : { angulo: 'que decida la IA' };
}

/** La duracion como va en el brief de Claude: "que decida la IA" o lo que dijo el usuario, aproximado. */
function duracionParaClaude(brief) {
  const d = leerDuracion(brief.duracion, brief.estilo);
  if (!d) return null;
  return d.decide === 'usuario' ? `aproximada: ${d.texto} (unos ${d.segundos} s)` : 'que decida la IA';
}

/** Lo que dice la tarea sobre la duracion (va debajo del brief). Sin duracion (el musical), nada. */
function tareaDuracion(brief) {
  const d = leerDuracion(brief.duracion, brief.estilo);
  if (!d) return '';
  const historia = ESTILOS[brief.estilo]?.familia === 'historia-musical';
  if (d.decide === 'usuario') {
    return `- \`duracion\`: el usuario dijo «${d.texto}». Es aproximada: escribe ${historia ? 'la historia' : 'el guion'} para más o menos ese tiempo (${duracionAprox(d.segundos)}). Si sale un poco más ${historia ? 'larga o más corta' : 'largo o más corto'}, está bien.`;
  }
  return historia
    ? '- `duracion`: "que decida la IA". La decides tú con el criterio de la skill: la historia dura lo que necesite para contarse entera, acto por acto. No hay un número que alcanzar.'
    : '- `duracion`: "que decida la IA". La decides tú con el criterio de la skill: el anuncio dura lo que necesite para mostrar lo que tiene que mostrar (el gancho, el problema, la solución, la prueba y el llamado a la acción). No hay un número que alcanzar.';
}

function briefParaClaude(brief) {
  const p = leerProducto(brief.productoId) || {};
  const f = leerFicha(brief.productoId) || {};
  const producto = {};
  for (const k of CAMPOS_FICHA) if (f[k] !== undefined) producto[k] = f[k];
  producto.deducido = (f.deducido || []).filter((k) => !(f.correcciones && k in f.correcciones));
  const sinDato = (f.falta || []).map((x) => x.campo).filter(Boolean);
  if (sinDato.length) producto.sin_dato = sinDato;
  const otras = Object.entries(f.respuestas || {}).filter(([k]) => !CAMPOS_FICHA.includes(k));
  if (otras.length) producto.otras_respuestas_del_usuario = Object.fromEntries(otras);
  return {
    producto,
    lo_que_conto_el_usuario: p.descripcion || null,
    pagina_del_producto: p.url || null,
    estilo: brief.estilo,
    ...(brief.continuidad ? { continuidad: true } : {}),
    ...(duracionParaClaude(brief) ? { duracion: duracionParaClaude(brief) } : {}),
    formato: '9:16',
    ajustes_del_estilo: ajustesParaClaude(brief),
    guion_del_usuario: p.guionPropio || null,
  };
}

function textoFoto(slug, brief, foto) {
  const p = leerProducto(brief.productoId) || {};
  const otras = (p.fotos || []).slice(1).map((f) => `\`${relProducto(brief.productoId)}/${f}\``);
  const letras = esLetras(brief);
  if (!foto) {
    return letras
      ? 'El usuario no subió fotos del producto.'
      : 'El usuario no subió fotos del producto: el manifiesto va sin la entrada del producto (la sección de la foto del producto de la skill) y ninguna toma la declara.';
  }
  return [
    `La foto principal del producto ya está en la carpeta del anuncio: \`temp/${slug}/${foto}\` (la preparó la app). Mírala con Read antes de escribir${letras ? ': te sirve para la letra y la idea visual' : ', como dice la skill'}.`,
    letras
      ? 'Las tomas se escriben después de la canción: ahora no va ningún manifiesto. No corras el comando de la foto: ya está hecho.'
      : `En el manifiesto, la entrada del producto lleva \`"archivo": "${foto}"\`, exactamente ese nombre. No corras el comando de la foto que trae la skill: ya está hecho.`,
    otras.length ? `Otras fotos del producto, solo para mirar: ${otras.join(', ')}.` : '',
  ].filter(Boolean).join('\n');
}

const TEXTO_TRANSICIONES =
  'Con el guion terminado escribe `temp/{{slug}}/transiciones.json`: 3 o 4 puntos, cada uno en la primera toma de su parte del guion y decidido leyendo el guion (nunca "cada N tomas"): la entrada del problema (`deslizar-derecha` + `woosh`), la de la solución o el giro (`zoom` + `deep-woosh`), la de la prueba o el resultado (`deslizar-izquierda` + `woosh`) y la del CTA (`zoom` + `deep-woosh`). Cada punto lleva su "porque". Si dos caen en la misma toma o en tomas seguidas, deja uno. La toma 1 es el gancho y no lleva.{{bloques}} Formato: `{"efectos": {"woosh": "efectos/woosh.mp3", "deep-woosh": "efectos/deep-woosh.mp3"}, "puntos": [{"toma": 2, "animacion": "deslizar-derecha", "efecto": "woosh", "porque": "entrada del problema"}]}`. No copies los sonidos: los copia la app.';

// Lo que el formulario de cada estilo ya contesto de la skill (va en la tarea, debajo del brief).
const GUIA_AJUSTES = {
  claymation: '`angulo`: si dice "que decida la IA", usas el ángulo PRINCIPAL de la skill; si no, el que eligió.',
  crochet:
    'El checkpoint del Paso 2 (ángulo + personaje) ya está contestado, así que no hay pausa: `angulo` es el ángulo (con "que decida la IA" eliges tú del catálogo del 3.1) y `personaje` el personaje ("que decida la IA" es la opción A, tu sugerencia; "Sin personaje fijo" es la C; si el usuario lo describe, es la B con su descripción). Si el ángulo necesita dos personajes fijos, los defines tú (Opción D) y los cuentas en `personajes` de guion.json.',
  'zack-d-films':
    '`fondo` es la respuesta a la pregunta del fondo de las tomas de mecanismo del Paso 1 ("Grilla técnica azul" = A, grid técnico azul; "Estudio limpio" = B): úsala en todas las tomas que correspondan. `angulo`: con "que decida la IA", el PRINCIPAL.',
  'estilo-pixar': '`angulo`: con "que decida la IA", el PRINCIPAL de la skill; si no, el que eligió.',
  'realista-narrado':
    '`narra` es quién cuenta la historia (con "que decida la IA", un hijo o una hija adultos que cuentan lo de su papá o su mamá, como dice la skill). `angulo`: con "que decida la IA", el PRINCIPAL de la skill de Pixar que esta skill sigue; si no, el que eligió. Todo es fotorrealista menos el mecanismo, en anatomía médica 3D.',
  skeleton: '`formato`: con "que decida la IA", el formato principal (salvo que el producto pida el alterno, regla del 2.0). La variante del esqueleto la decides tú (3.1) y la anotas en decisiones.',
  'estilo-lego':
    '`estructura`: con "que decida la IA", la plantilla del estilo (2.1); si eligió otra, es un ángulo del 2.2. La voz ya la eligió el usuario en la app. Los plazos de la línea de tiempo los decides tú y los anotas en "decisiones", para que el usuario los vea y los corrija si no son los suyos.',
  'talking-object-pixar': '`quien_habla`: con "que decida la IA", el ángulo PRINCIPAL (la alternativa fallida confiesa); si no, el que eligió. Si el guion del usuario viene narrado en tercera persona, lo pasas a primera y lo cuentas en "decisiones".',
  ugc: 'El briefing del Paso 1 ya está contestado: las preguntas 1 a 5 con la ficha del producto (`prueba` es la prueba social real: si está vacía, no se inventa) y la 6 con `tipo` y `duracion`. Los dos ganchos alternativos (Sección E) los escribes siempre; `ganchos` dice si el usuario quiere que también se produzcan.',
  podcast:
    'El briefing del Paso 1 ya está contestado: las preguntas 1 a 5 con la ficha (`probo` es la objeción o lo que ya probó, `prueba` el dato real, `comoCompra` dónde se consigue), la 6 con `hosts` y `edades` (quién va a la izquierda está en `hosts`; con "que decida la IA", lo decides tú) y la 7 con `modo` ("Pantalla dividida" = `pantalla-dividida`, "Anfitrión en la esquina" = `esquina`). Lo que falte no se marca [AJUSTAR]: decides lo más razonable y lo anotas en "decisiones".',
  entrevista:
    'Las dos pausas ya están contestadas. Briefing (Paso 1): las preguntas 1 a 4 con la ficha; la 5 con `persona`, `ciudad`, `brazos` (color de piel de los brazos del entrevistador) y `lado` (del micrófono); la 6 con `cta` (el texto del llamado a la acción, tal cual) e `idioma`; `pronunciacion` es cómo se pronuncia la marca. Variante (Paso 2): `variante`; con "que decida la IA", eliges con las reglas para recomendar del Paso 2 y lo cuentas en "decisiones". Persona, ciudad, idioma y CTA vienen del usuario: nunca los cambies ni los inventes.',
  musical:
    'Las pausas de los Pasos 1 a 3 ya están contestadas: la ficha es el brief (si no hay página ni investigación, sigue con la ficha: el usuario ya la revisó). `genero` es el 2.1 (con "que decida la IA", lo eliges con el mapa del 2.1 según el público de la ficha); `canta` es la voz del 2.3 ("Voz femenina" = "f", "Voz masculina" = "m", "que decida la IA" = que elija Suno, null); `visual` es el estilo visual del 2.4 (Crochet = `crochet`, Claymation = `claymation`, Zack D Films = `zack-d-films`). El ángulo y la etapa de consciencia del Paso 3 los decides tú con su regla y los cuentas en "decisiones". La duración no se pregunta ni se pide (2.2).',
  'historias-musicales':
    'El briefing del Paso 1 ya está contestado: la ficha (producto, dolor y mecanismo, mercado, oferta), `duracion` y `ajustes_del_estilo`: `cuenta` es quién cuenta la historia, `villano` el detonante, `cierre` el tipo de cierre ("Cantado dentro de la canción" o "Solo tarjeta final"), `genero` el género musical y `canta` la voz ("Voz femenina" = "f", "Voz masculina" = "m"; con "que decida la IA", el género de quien cuenta la historia). Donde diga "que decida la IA", decides tú con la skill: nunca dejes un dato inventado sin contarlo en "decisiones".',
};

// ---- lo que se pide en cada fase (el texto de la tarea lo arma tarea-guion.md con estas piezas)

const FORMATO_GUION = `\`\`\`json
{
  "titulo": "un título corto para reconocer el anuncio: el producto y su gancho",
  "idioma": "es",
  "mercado": "LatAm",
  "duracionEstimada": 44.6,
  "de_que_va": "una o dos frases: de qué va el anuncio",
  "partes": [
    { "n": 1, "momento": "gancho", "dice": "lo que se dice en esa parte", "se_ve": "lo que se ve, en una frase sencilla" }
  ],
  "decisiones": ["lo que decidiste tú y conviene que el usuario sepa, en frases cortas"]
}
\`\`\``;

const REGLAS_GUION_COMUNES = [
  '`se_ve` es lo que pasa en la escena en una frase de todos los días (nunca el prompt, ni en inglés).',
  '`momento`: gancho, problema, giro, solución, prueba, oferta o cierre (una o dos palabras).',
  '`decisiones`: el ángulo que elegiste y por qué, lo que decidiste donde decía "que decida la IA", lo que dejaste fuera por falta de datos, lo que agregaste por la oferta o el pago… Entre 1 y 5, en español sencillo.',
  'Sin prompts, sin nombres de modelos, sin precios de producción y sin rutas.',
];

/** Como se escribe guion.json en cada familia (lo que se dice se copia del manifiesto; la app lo vuelve a copiar). */
function formatoGuion(def, brief) {
  const fam = def.familia;
  const r = [];
  if (fam === 'hablado' && brief.estilo === 'podcast') {
    r.push(
      'Una parte por línea de la conversación (`guion[]` del manifiesto), en el orden en que se oye: `n` es `guion[].orden`, `dice` es `guion[].texto` copiado carácter por carácter y `quien` el nombre del anfitrión que la dice. Las tomas de reacción sin diálogo no van.',
      'Agrega `"personajes"`: los dos anfitriones, `[{ "id": "A", "nombre": "…", "como_es": "una frase" }, { "id": "B", … }]` (A y B como en el manifiesto).',
      '`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.',
    );
  } else if (fam === 'hablado') {
    r.push(
      'Una parte por clip, con el mismo `n` que `tomas[].n` y en el mismo orden. `dice` es `tomas[].linea` copiado carácter por carácter.',
      'Agrega en cada parte `"dialogo"`: el `tomas[].dialogo` del manifiesto, línea por línea, como `{ "quien": "Entrevistador" o el nombre de la persona, "dice": "su texto, copiado" }`.',
      'Agrega `"personajes"`: la persona que paran, `[{ "nombre": "…", "como_es": "una frase" }]`, y `"variante"`: "A" o "B".',
      '`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.',
    );
  } else if (fam === 'ugc') {
    r.push(
      'Una parte por bloque, con el mismo `n` que `tomas[].n` y en el mismo orden. `dice` es `tomas[].linea` copiado carácter por carácter. `quien` no hace falta: habla la persona.',
      'Agrega `"personajes"`: la persona que habla a cámara, `[{ "nombre": "…", "como_es": "una frase" }]`.',
      'Agrega `"extras": { "ganchos": [{ "id": "1b", "idea": "el ángulo de ese arranque, en pocas palabras", "dice": "su línea, copiada de ganchos_alternativos" }, { "id": "1c", … }] }`.',
      '`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.',
    );
  } else {
    r.push('Una parte por toma, con el mismo `n` que `tomas[].n` y en el mismo orden.', '`dice` es `tomas[].linea` copiado del manifiesto carácter por carácter.');
    if (fam === 'objeto-parlante') {
      r.push(
        'Agrega en cada parte `"quien"`: el personaje que dice esa toma, como lo reconoce el usuario (por ejemplo "El humectante de farmacia" o "Tu producto").',
        'Agrega `"personajes"`: los que hablan, `[{ "nombre": "…", "como_es": "una frase" }]`.',
      );
    } else if (brief.estilo === 'crochet') {
      r.push('Si hay personaje fijo (o dos), agrega `"personajes"`: `[{ "nombre": "…", "como_es": "una frase" }]`.');
    }
    r.push('`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.');
  }
  return `${FORMATO_GUION}\n\n${[...r, ...REGLAS_GUION_COMUNES].map((x) => `- ${x}`).join('\n')}`;
}

// El formato de los cantados lo leen tambien familias/musical.js y familias/historia-musical.js (y lo nombran
// server/claude/estilos/musical.md e historias-musicales.md, que van en la misma tarea).
const FORMATO_LETRAS = `\`\`\`json
{
  "titulo": "un título corto para reconocer el anuncio: el producto y su gancho",
  "idioma": "es",
  "mercado": "LatAm",
  "visual": "crochet",
  "vocalGender": "f",
  "angulo": "el ángulo, en lenguaje de cliente",
  "etapa": "la etapa de consciencia",
  "opciones": [
    {
      "n": 1,
      "titulo": "el título de la canción",
      "concepto": "1 o 2 frases en español sencillo: el vibe y el punto de vista",
      "letra": "[Verso 1]\nprimera línea\nsegunda línea\n\n[Coro]\n…",
      "estiloSuno": "genre, vocal style, tempo/BPM, mood, production style",
      "ideaVisual": "2 o 3 frases en español: qué se ve, escrito para el estilo visual elegido"
    }
  ],
  "decisiones": ["el ángulo y la etapa que elegiste y por qué, el género si lo elegiste tú…"]
}
\`\`\`

- Entre 2 y 3 opciones (\`n\` 1, 2, 3), realmente distintas entre sí (regla 6 de la skill). No escribas \`"elegida"\`: lo pone la app cuando el usuario elige.
- \`letra\` va en el idioma del mercado, con sus marcas de sección entre corchetes en su propia línea y con sus tildes y su ñ de verdad.
- \`estiloSuno\` siempre en inglés, como dice el Paso 4 (máximo 25 palabras). Es lo único que no lee el usuario.
- \`visual\` y \`vocalGender\` son los del brief (\`vocalGender\` en null si dice "que decida la IA"); \`ideaVisual\` se escribe para ese estilo visual.
- \`concepto\`, \`ideaVisual\` y \`decisiones\` los lee el usuario: en español sencillo, sin prompts ni nombres de modelos.
- \`app/guion.json\` (el resumen de la lista de anuncios) lo arma la app con estas letras: no hace falta que lo escribas.`;

const FORMATO_HISTORIA = `\`\`\`json
{
  "titulo": "un título corto para reconocer el anuncio",
  "idioma": "es",
  "mercado": "LatAm",
  "duracionEstimada": 300,
  "de_que_va": "una o dos frases: de qué va la historia",
  "estilos_cancion": ["el estilo 1 en palabras sencillas, en español", "el estilo 2, igual"],
  "partes": [
    { "n": 1, "momento": "Acto 1 · gancho", "dice": "la línea exacta de la letra", "se_ve": "lo que se ve, en una frase de todos los días" }
  ],
  "decisiones": ["lo que decidiste tú y conviene que el usuario sepa, en frases cortas"]
}
\`\`\`

- \`partes\`: una por cada línea de la letra (sin las etiquetas de acto), en el mismo orden, con \`n\` = 1, 2, 3… y \`dice\` copiado de la letra de \`cancion/peticion.json\` carácter por carácter. \`momento\` dice el acto y el beat. \`se_ve\` es la columna "Qué se ve" de la tabla del Paso 2.3 (nunca un prompt, ni en inglés).
- \`duracionEstimada\`: lo que esperas que dure, en segundos. Es solo orientativa.
- \`estilos_cancion\`: los mismos dos estilos de \`peticion.json\`, contados en español sencillo y en el mismo orden (el usuario los ve al elegir la versión).
- \`decisiones\`: entre 1 y 5, en español sencillo. Sin prompts, sin nombres de modelos, sin precios y sin rutas.`;

function piezasDeLaTarea(slug, brief, def) {
  const delEstilo = textoDelEstilo(brief);
  const fam = def.familia;
  if (fam === 'musical') {
    return {
      intro:
        'El usuario ya revisó la ficha de su producto y eligió este estilo. Escribe solo la canción: los Pasos 1 a 4 de la skill (el ángulo, la etapa de consciencia y 2 o 3 letras, cada una con su concepto, su prompt de estilo para Suno y su idea visual). La app le va a mostrar las letras para que elija una o pida cambios; después genera la canción, el usuario elige la versión de oído y recién ahí se escriben las tomas, sobre los tiempos reales. Por eso ahora no va `cancion/peticion.json`, ni el manifiesto, ni nada de la skill visual.',
      pasos: ['Lee la skill entera.', 'Haz los Pasos 1 a 4, sin pausas.', `Escribe \`temp/${slug}/app/letras.json\` con el formato de abajo.`, 'Responde solo LISTO.'],
      archivo: `temp/${slug}/app/letras.json`,
      formato: FORMATO_LETRAS,
      delEstilo,
    };
  }
  if (fam === 'historia-musical') {
    return {
      intro:
        'El usuario ya revisó la ficha de su producto y eligió este estilo. Escribe los Pasos 1 a 3 de la skill: el guion por actos, la letra con sus etiquetas, los dos prompts de estilo y `cancion/peticion.json` (Paso 3.4). La app le va a mostrar la historia línea por línea para que la apruebe o pida cambios; después genera la canción, el usuario elige la versión de oído y recién ahí se escriben las líneas medidas, los personajes, las tomas y el manifiesto (eso no lo haces ahora). `guion_del_usuario`, si viene, es material para la historia: esta skill no tiene Paso 0.',
      pasos: [
        'Lee la skill entera.',
        'Haz los Pasos 1 a 3, sin pausas.',
        `Escribe \`temp/${slug}/cancion/peticion.json\` como dice el Paso 3.4 (con \`bloques\` si la letra pasa de 3.500 caracteres, \`duracion\` en null y \`vocalGender\` "f" o "m") y léelo para comprobar que conserva las tildes.`,
        `Escribe \`temp/${slug}/app/guion.json\` con el formato de abajo.`,
        'Responde solo LISTO.',
      ],
      archivo: `temp/${slug}/app/guion.json`,
      formato: FORMATO_HISTORIA,
      delEstilo,
    };
  }
  const conTransiciones = def.transiciones && !brief.continuidad;
  const transiciones = conTransiciones
    ? TEXTO_TRANSICIONES.replace(/\{\{slug\}\}/g, slug).replace('{{bloques}}', fam === 'ugc' ? ' Aquí "toma" es el número del bloque que empieza con esa parte.' : '')
    : brief.continuidad
      ? 'Este anuncio lleva el efecto continuidad (cada escena pasa a la siguiente sin cortes, lo arma la app después): escribe el anuncio del estilo como siempre, sin cambios, pero no escribas `transiciones.json`.'
      : 'Este estilo no lleva transiciones: no escribas `transiciones.json`.';
  return {
    intro:
      'El usuario ya revisó la ficha de su producto y eligió este estilo. Escribe el anuncio completo como dice la skill, hasta el manifiesto, con todos sus chequeos (y los archivos que la skill guarda aparte, si lleva). La app le va a mostrar el guion (lo que se dice y lo que se ve) para que lo apruebe o pida cambios, y después produce todo sola.',
    pasos: [
      'Lee la skill entera.',
      `Haz el trabajo de la skill hasta su manifiesto, con todos sus chequeos, en \`temp/${slug}/manifiesto.json\`.`,
      transiciones,
      `Valida con este comando, escrito exactamente así:\n\n   node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json\n\n   y corrige el manifiesto hasta que no quede ningún ERROR (los AVISO no frenan). El costo que imprime no se le muestra a nadie.`,
      `Escribe \`temp/${slug}/app/guion.json\` con el formato de abajo.`,
      'Responde solo LISTO.',
    ],
    archivo: `temp/${slug}/app/guion.json`,
    formato: formatoGuion(def, brief),
    delEstilo,
  };
}

// el musical tiene su archivo con el nombre de la skill ("musicales")
const OTRO_NOMBRE = { musical: 'musicales' };

/** Lo propio de cada estilo para la fase de guion: server/claude/estilos/<clave>.md (y continuidad.md), si existen. */
function textoDelEstilo(brief) {
  const delEstilo = [brief.estilo, OTRO_NOMBRE[brief.estilo]].filter(Boolean).find((n) => existe(path.join(APP, 'server', 'claude', 'estilos', `${n}.md`)));
  const nombres = [delEstilo, ...(brief.continuidad ? ['continuidad'] : [])].filter(Boolean);
  const partes = [];
  for (const n of nombres) {
    const ruta = path.join(APP, 'server', 'claude', 'estilos', `${n}.md`);
    if (!existe(ruta)) continue;
    try {
      const t = textoClaude(`estilos/${n}`, {});
      if (t) partes.push(t);
    } catch (e) {
      console.warn(`[guion] No pude leer server/claude/estilos/${n}.md: ${e.message}`);
    }
  }
  // cada archivo trae su propio titulo ("## Lo propio de Crochet")
  return partes.join('\n\n');
}

const lista = (pasos) => pasos.map((p, i) => `${i + 1}. ${p}`).join('\n');

/** Lo de la biblioteca para la tarea del guion: el avatar (sus imágenes ya copiadas a ref/) y la música elegida. */
function textoBiblioteca(slug, brief) {
  const partes = [];
  try {
    const avatar = brief.avatar ? prepararAvatar(slug, brief.avatar) : null;
    if (avatar) partes.push(avatar);
    const musica = brief.musicaBiblioteca ? prepararMusica(slug, brief.musicaBiblioteca) : null;
    if (musica) partes.push(`## La música de fondo\n\nYa está puesta: «${musica.nombre}», de la biblioteca del usuario (\`temp/${slug}/musica/\`). No se genera otra: no la cambies ni la pidas, y cuéntalo en "decisiones" en una línea.`);
  } catch (e) {
    console.warn(`[guion] ${slug}: no pude preparar lo de la biblioteca (${e.message})`);
  }
  return partes.join('\n\n');
}

/** ¿El usuario trajo su propio guion? (en los cantados es material para la letra, no un guion que se respeta tal cual) */
function tieneGuionPropio(brief) {
  if (esLetras(brief) || ESTILOS[brief?.estilo]?.familia === 'historia-musical') return false;
  return Boolean(String(leerProducto(brief.productoId)?.guionPropio || '').trim());
}

function promptGuion(slug, brief, foto, prepClonar = null) {
  const def = ESTILOS[brief.estilo];
  const t = piezasDeLaTarea(slug, brief, def);
  return textoClaude('tarea-guion', {
    slug,
    estiloNombre: brief.continuidad ? `${def.nombre}, con el efecto continuidad` : def.nombre,
    skill: def.skill,
    intro: t.intro,
    brief: JSON.stringify(briefParaClaude(brief), null, 2),
    ajustes: [GUIA_AJUSTES[brief.estilo], AJUSTES[brief.estilo]?.subestilo ? GUIA_SUBESTILO : null].filter(Boolean).map((g) => `- ${g}`).join('\n'),
    duracion: tareaDuracion(brief),
    guionDelUsuario: esLetras(brief)
      ? '- `guion_del_usuario`: si viene, es material de trabajo para la canción o la historia (este estilo no tiene Paso 0). Si es null, escribes desde cero.'
      : '- `guion_del_usuario`: si viene, es el guion que trae el usuario y aplica el Paso 0 de la skill: no cambias una sola palabra de ese texto, no escribes otro guion ni variantes, y no haces análisis de ángulo, investigación ni búsquedas para crear uno nuevo. Tu trabajo es solo partirlo en tomas y escribir lo que se ve. Si es null, escribes el guion desde cero.',
    carpetaProducto: relProducto(brief.productoId),
    detalleProducto: detalleDelProducto(brief.productoId, { vineta: true }),
    foto: textoFoto(slug, brief, foto),
    pasos: lista(t.pasos),
    delEstilo: [
      textoClonar(slug, brief, prepClonar, { guionPropio: tieneGuionPropio(brief) }),
      // la investigación del producto (deseo, beneficio, dolores, objeciones) y la estructura más adecuada (2026-11-16)
      textoInvestigacion({ slug, brief }).texto,
      esLetras(brief) ? '' : textoEstructuras({ slug, brief, familia: def.familia, conReferencia: referenciaPedida(brief), guionPropio: tieneGuionPropio(brief) }),
      textoBiblioteca(slug, brief), t.delEstilo, esLetras(brief) ? '' : textoAhorro(brief.estilo, { continuidad: Boolean(brief.continuidad), hablado: ['hablado', 'ugc', 'objeto-parlante'].includes(def.familia) }), textoAprendizajes(carpetaDeEstilo(brief.estilo), { conSubestilo: Boolean(AJUSTES[brief.estilo]?.subestilo) })].filter(Boolean).join('\n\n'),
    archivo: t.archivo,
    formato: t.formato,
  });
}

function promptCambios(slug, brief, pedido, { reintento = false } = {}) {
  const def = ESTILOS[brief.estilo];
  const fam = def.familia;
  const validarTxt = `Valida con este comando, escrito exactamente así:\n\n   node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json\n\n   y corrige hasta que no quede ningún ERROR.`;
  let queLeyo = 'el guion';
  let pasos;
  if (fam === 'musical') {
    queLeyo = 'las letras';
    pasos = [
      `Vuelve a leer \`temp/${slug}/app/letras.json\` tal como está ahora.`,
      'Haz el cambio con las reglas de la skill. Si nombra una opción (por su número o su título), cambias solo esa; si pide otra opción, puede haber hasta 3; si cambia el género, la voz o el estilo visual, actualiza `vocalGender`, `visual`, los prompts de estilo y las ideas visuales que dependan de eso.',
      `Reescribe \`temp/${slug}/app/letras.json\` entero, con el mismo formato de antes, y agrégale \`"cambios_hechos"\`: una lista corta, en español sencillo, de lo que cambiaste (por ejemplo "Opción 2: el coro ahora nombra el envío gratis").`,
      'Responde solo LISTO.',
    ];
  } else if (fam === 'historia-musical') {
    queLeyo = 'la historia';
    pasos = [
      `Vuelve a leer \`temp/${slug}/cancion/peticion.json\` y \`temp/${slug}/app/guion.json\` tal como están ahora.`,
      'Haz el cambio y actualiza todo lo que dependa de él: la letra en `peticion.json` (y `bloques`, si la letra va en bloques: su unión tiene que ser exactamente la letra), los `estilos` si pide otro sonido, y `vocalGender` si cambia la voz. Comprueba que conserva las tildes.',
      `Reescribe \`temp/${slug}/app/guion.json\` entero, con el mismo formato de antes (una parte por línea de la letra), y agrégale \`"cambios_hechos"\`: una lista corta, en español sencillo, de lo que cambiaste.`,
      'Responde solo LISTO.',
    ];
  } else {
    pasos = [
      `Vuelve a leer \`temp/${slug}/manifiesto.json\` tal como está ahora.`,
      `Haz el cambio y actualiza todo lo que dependa de él: lo que se dice en cada toma (\`linea\`, y también \`voz_en_off\`, \`guion[]\`, \`lineas\`, \`dialogo\`, \`tramos\` o \`ganchos_alternativos\` si este estilo los lleva: todo tiene que dar el mismo texto), duraciones, prompts de imagen y video de las tomas que cambian, el B-roll que sincroniza con lo cambiado${def.transiciones && !brief.continuidad ? ' y `transiciones.json` si alguna parte del guion se movió de toma' : ''}. La foto del producto queda como está.`,
      validarTxt,
      `Reescribe \`temp/${slug}/app/guion.json\` entero, con el mismo formato de antes, y agrégale \`"cambios_hechos"\`: una lista corta, en español sencillo, de lo que cambiaste (por ejemplo "Cambié el cierre: ahora dice que el envío es gratis").`,
      'Responde solo LISTO.',
    ];
  }
  return textoClaude('tarea-cambios', {
    slug,
    skill: def.skill,
    queLeyo,
    pedido: String(pedido).replace(/»/g, '"'),
    aviso: reintento ? `El intento anterior de este cambio no terminó y ${queLeyo === 'las letras' ? 'las letras volvieron' : `${queLeyo} volvió`} a como estaba antes. ` : '',
    pasos: lista(pasos),
  });
}

// Lo que la app escribe en temp/<slug>/app/ para llevar el anuncio (lo elegido, la aprobacion, la produccion, sus
// procesos, gastos y versiones). Claude escribe el guion (guion.json, letras.json, bloqueo.json), nunca esto: un
// conductor.json "esperando" escrito por Claude se produciria al abrir la app sin que nadie aprobara nada.
const SOLO_DE_LA_APP = [
  'brief.json', 'sesion.json', 'conductor.json', 'proceso.json', 'informe.json', 'montaje.json', 'edicion.json', 'voces.json',
  'ventanas.json', 'ugc.json', 'habla.json', 'manifiesto-antes-de-ventanas.json', '*-estado.json', 'cancion-*.json', 'clips-*.json',
  'control-final-*.json', 'rehacer/**', 'exportes/**', 'gasto/**', 'registro/**', 'historial-guion/**', 'edicion/**',
  'avisos.json', 'subidos.json', 'investigacion.md',
];

function permisosGuion(slug, brief) {
  const c = `./temp/${slug}`;
  const conTerminal = !esLetras(brief); // los cantados no corren ningun comando en el guion
  return {
    herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'TodoWrite', ...(conTerminal ? ['Bash', 'PowerShell'] : [])],
    permitidas: [
      `Read(./.claude/skills/${ESTILOS[brief.estilo].skill}/**)`,
      // el esqueleto: la skill sugiere elegir la variante mirando el catalogo (solo lectura)
      ...(brief.estilo === 'skeleton' ? ['Read(./recursos/esqueletos/**)'] : []),
      // realista con narrador sigue la skill de Pixar entera (su "proceso"): la lee tambien
      ...(brief.estilo === 'realista-narrado' ? ['Read(./.claude/skills/anuncios-estilo-pixar/**)'] : []),
      // clonar un video: la skill de la clonacion (sus Pasos 3 y 5)
      ...(referenciaPedida(brief) ? ['Read(./.claude/skills/anuncios-clonacion/**)'] : []),
      `Read(${c}/**)`,
      `Read(./${relProducto(brief.productoId)}/**)`,
      `Write(${c}/**)`,
      `Edit(${c}/**)`,
      'Glob',
      'Grep',
      'TodoWrite',
      // el unico comando: validar el manifiesto de ESTE anuncio (no llama a nadie, solo revisa y calcula). Exacto, sin
      // comodin: con un * se colarian opciones u otros archivos (y con npm, codigo que Claude mismo escribio)
      ...(conTerminal ? enTerminales(`node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json`, `node produccion\\validar-manifiesto.js temp\\${slug}\\manifiesto.json`) : []),
    ],
    // y nada de lo que decide que se cobra y que produce el motor (modelos.json, estado.json, img/, video/…): ninguna
    // tarea lo escribe y una pagina de producto con instrucciones escondidas podria pedirlo (para las dos IA)
    prohibidas: [...prohibidasComunes({ terminal: conTerminal }), ...SOLO_DE_LA_APP.map((f) => `Edit(${c}/app/${f})`), ...prohibidasDeAnuncio(slug)],
  };
}

// ---------------------------------------------------------------- las sesiones del guion, armadas

/** "Claude", "ChatGPT" o "Tu IA" (al principio de una frase). */
const laIA = () => {
  const n = nombreIA();
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const hayEnRaiz = (rel) => existe(path.join(RAIZ, ...rel.split('/')));

/** Archivos de referencia propios de Kads: sin videos, audio ni enlaces fuera de la carpeta. */
function materialPropio(slug, brief) {
  const textos = [];
  const imagenes = [];
  const aPedido = [];
  const archivos = (rel) => {
    const abs = path.join(RAIZ, ...rel.split('/'));
    let entradas;
    try { entradas = fs.readdirSync(abs, { withFileTypes: true }); } catch { return []; }
    return entradas.flatMap((e) => e.isDirectory() ? archivos(`${rel}/${e.name}`) : e.isFile() ? [`${rel}/${e.name}`] : []);
  };
  const esTexto = (f) => /\.(md|json|txt)$/i.test(f);
  const esImagen = (f) => /\.(png|jpe?g|webp|gif)$/i.test(f);
  const skill = `.claude/skills/${ESTILOS[brief.estilo].skill}`;
  if (brief.estilo === 'realista-narrado') textos.push('.claude/skills/anuncios-estilo-pixar/SKILL.md');
  const subestilo = brief.opciones?.subestilo;
  // La ficha se lee al principio; los fotogramas y movimientos quedan disponibles para pedirlos por su ruta.
  for (const f of archivos(`${skill}/subestilos`)) {
    if (/\.md$/i.test(f) && (!subestilo || f === `${skill}/subestilos/${subestilo}.md`)) textos.push(f);
    else if ((!subestilo || f.startsWith(`${skill}/subestilos/${subestilo}/`)) && (esTexto(f) || esImagen(f))) aPedido.push(f);
  }
  for (const f of archivos(`temp/${slug}/ref`)) if (esImagen(f)) imagenes.push(f);
  if (referenciaPedida(brief)) {
    textos.push('.claude/skills/anuncios-clonacion/SKILL.md');
    for (const f of archivos(`temp/${slug}/referencia`)) {
      if (esTexto(f)) textos.push(f);
      else if (esImagen(f)) imagenes.push(f);
    }
  }
  return { textos: textos.filter(hayEnRaiz), imagenes, aPedido };
}

/**
 * Lo que lee la IA en el guion (o.material; Claude lo abre con Read y a ChatGPT se lo pasa la app). Solo lo que existe:
 * la skill, la foto y las otras fotos del producto, su pagina y su ficha; con el esqueleto, el catalogo y sus
 * miniaturas; al retomar o reintentar (deAntes), lo que ya estaba escrito. Con continuidad, la tarea nombra la skill
 * de continuidad para decir que ahora no se sigue (estilos/continuidad.md): esa no se lee.
 */
function materialGuion(slug, brief, { foto = null, deAntes = false } = {}) {
  const def = ESTILOS[brief.estilo];
  const c = `temp/${slug}`;
  const prod = relProducto(brief.productoId);
  const p = leerProducto(brief.productoId) || {};
  const textos = [`.claude/skills/${def.skill}/SKILL.md`, `${prod}/pagina.txt`, `${prod}/ficha.json`];
  // (como textoFoto: sin foto principal, tampoco van las otras)
  const imagenes = foto ? [`${c}/${foto}`, ...(p.fotos || []).slice(1).map((f) => `${prod}/${f}`)] : [];
  if (brief.estilo === 'skeleton') {
    textos.push('recursos/esqueletos/catalogo.json');
    const miniaturas = listar(path.join(RAIZ, 'recursos', 'esqueletos')).filter((n) => /\.png$/i.test(n)).sort();
    imagenes.push(...miniaturas.map((n) => `recursos/esqueletos/${n}`));
  }
  if (deAntes) textos.push(...GUARDADOS.map((rel) => `${c}/${rel}`));
  textos.push(`${c}/app/investigacion.md`); // si el producto tiene investigación (la copia textoInvestigacion)
  const propios = materialPropio(slug, brief);
  return {
    textos: [...textos, ...propios.textos].filter(hayEnRaiz),
    imagenes: [...imagenes, ...propios.imagenes].filter(hayEnRaiz),
    aPedido: propios.aPedido,
    ...(brief.continuidad ? { noSeLeen: ['.claude/skills/anuncios-continuidad/**'] } : {}),
  };
}

/** Lo que el cambio puede tocar: el archivo del que sale lo que se dice (el manifiesto, la letra o la peticion). */
function archivosDelCambio(slug, brief) {
  const fam = ESTILOS[brief.estilo].familia;
  return [`temp/${slug}/${fam === 'musical' ? 'app/letras.json' : fam === 'historia-musical' ? 'cancion/peticion.json' : 'manifiesto.json'}`];
}

/** Lo que lee la IA en un cambio: la skill y lo escrito (lo que nombra la tarea de cambios de esa fase). */
function materialCambios(slug, brief) {
  const def = ESTILOS[brief.estilo];
  const c = `temp/${slug}`;
  const deLaFase =
    def.familia === 'musical'
      ? ['app/letras.json']
      : def.familia === 'historia-musical'
        ? ['cancion/peticion.json', 'app/guion.json']
        : ['manifiesto.json', 'app/guion.json', ...(def.transiciones && !brief.continuidad ? ['transiciones.json'] : [])];
  const propios = materialPropio(slug, brief);
  return { textos: [`.claude/skills/${def.skill}/SKILL.md`, ...propios.textos, ...deLaFase.map((rel) => `${c}/${rel}`)].filter(hayEnRaiz), imagenes: propios.imagenes, aPedido: propios.aPedido };
}

/**
 * La sesion del guion, lista para lanzarSesion({ ...armarSesionGuion(slug, …), uuid, alProgreso, registro }):
 * { tipo, resume, prompt, herramientas, permitidas, prohibidas, material, esfuerzo, fraseInicio, timeoutMs, silencioMs,
 * maxTurnos, correcciones, verificar }. `foto` es la del anuncio (la prepara antes la app, prepararFoto); sin ella, la
 * que ya este en su carpeta. Con `retomar` o `reintento`, sigue la conversacion desde lo que ya esta escrito.
 */
export function armarSesionGuion(slug, { brief = leerBrief(slug), foto = fotoEnCarpeta(slug), retomar = false, reintento = false, prepClonar = null } = {}) {
  const deAntes = retomar || reintento;
  let prompt = promptGuion(slug, brief, foto, prepClonar);
  if (deAntes) prompt = `(El intento anterior no terminó: revisa lo que ya está escrito en temp/${slug}/ y sigue desde ahí; lo que ya está bien no lo rehagas.)\n\n${prompt}`;
  return {
    tipo: 'guion',
    resume: deAntes,
    prompt,
    ...permisosGuion(slug, brief),
    material: materialGuion(slug, brief, { foto, deAntes }),
    esfuerzo: 'alto', // (Claude no lo usa)
    fraseInicio: esLetras(brief) ? `${laIA()} empezó a escribir la letra` : tieneGuionPropio(brief) ? `${laIA()} está repartiendo tu guion en escenas` : `${laIA()} empezó a escribir tu guion`,
    timeoutMs: 75 * 60000,
    silencioMs: 10 * 60000,
    maxTurnos: 80,
    correcciones: 1,
    verificar: () => verificarGuion(slug),
  };
}

/**
 * La sesion de un cambio pedido, como armarSesionGuion. `cambios` es para ChatGPT (Claude no lo usa): lo que pidio el
 * usuario, si el guion vino del usuario y el archivo que se compara antes y despues (el control de tomas tocadas).
 */
export function armarSesionCambios(slug, { brief = leerBrief(slug), pedido = leerSesion(slug)?.pedido || '', reintento = false } = {}) {
  const producto = leerProducto(brief.productoId) || {};
  return {
    tipo: 'cambios',
    resume: true,
    prompt: promptCambios(slug, brief, pedido, { reintento }),
    ...permisosGuion(slug, brief),
    material: materialCambios(slug, brief),
    esfuerzo: 'alto', // (Claude no lo usa)
    cambios: {
      pedido: String(pedido).replace(/»/g, '"'),
      guionDelUsuario: !esLetras(brief) && Boolean(String(producto.guionPropio || '').trim()),
      archivos: archivosDelCambio(slug, brief),
    },
    fraseInicio: `${laIA()} está leyendo tu pedido`,
    timeoutMs: 40 * 60000,
    silencioMs: 10 * 60000,
    maxTurnos: 60,
    correcciones: 1,
    verificar: () => verificarGuion(slug),
  };
}

// ---------------------------------------------------------------- revisar lo que escribio Claude

const ANIMACIONES = ['deslizar-derecha', 'deslizar-izquierda', 'zoom'];
const texto = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const r1 = (x) => Math.round(Number(x) * 10) / 10;

/**
 * El guion cuenta como terminado solo si: no hay bloqueo y lo que escribio Claude pasa su revision (ver cada fase).
 * Si pasa, guion.json (o letras.json) queda con lo que se dice copiado de la fuente de verdad.
 */
export async function verificarGuion(slug) {
  const brief = leerBrief(slug);
  const def = ESTILOS[brief?.estilo];
  if (!def) return { ok: false, final: true, error: 'Este anuncio es de un estilo que la app no conoce.' };

  const bloqueo = path.join(appDe(slug), 'bloqueo.json');
  if (existe(bloqueo)) {
    const b = leerYValidar(bloqueo, 'bloqueo');
    if (b.ok) return { ok: false, final: true, bloqueado: true, faltan: b.datos.faltan, error: b.datos.motivo };
    return { ok: false, errores: b.errores };
  }
  if (def.familia === 'musical') return verificarLetras(slug, brief);
  if (def.familia === 'historia-musical') return verificarHistoria(slug, brief);
  return verificarManifiesto(slug, brief, def);
}

async function verificarManifiesto(slug, brief, def) {
  const dir = dirDe(slug);
  const errores = [];
  const m = leerJSON(path.join(dir, 'manifiesto.json'));
  if (!m) return { ok: false, errores: [`Falta temp/${slug}/manifiesto.json (o no es JSON válido).`] };
  if (m.estilo !== brief.estilo) errores.push(`manifiesto.json → "estilo" tiene que ser "${brief.estilo}".`);
  const tomas = Array.isArray(m.tomas) ? m.tomas : [];
  if (!tomas.length) errores.push('manifiesto.json → no tiene tomas.');
  const podcast = brief.estilo === 'podcast';
  const lineasPodcast = podcast && Array.isArray(m.guion) ? m.guion.filter((g) => g && Number.isInteger(g.orden)) : [];
  if (podcast && !lineasPodcast.length) errores.push('manifiesto.json → el podcast tiene que traer "guion" (las líneas de la conversación con su "orden").');
  const numeros = new Set(podcast ? lineasPodcast.map((g) => g.orden) : tomas.map((t) => t?.n));

  const foto = fotoEnCarpeta(slug);
  if (foto) {
    const ref = (m.referencias || []).find((r) => r?.tipo === 'producto' || r?.id === 'producto');
    if (!ref) errores.push(`manifiesto.json → falta la entrada del producto en "referencias", con "archivo": "${foto}".`);
    else if (ref.archivo !== foto) errores.push(`manifiesto.json → la entrada del producto tiene que llevar "archivo": "${foto}" (es el nombre real de la foto).`);
  }

  // lo que eligio el usuario y cambia la produccion tiene que estar en el manifiesto
  const op = brief.opciones || {};
  if (podcast && op.modoBroll) {
    const quiere = op.modoBroll === 'esquina' ? 'esquina' : 'pantalla-dividida';
    if (m.podcast?.broll?.modo !== quiere) errores.push(`manifiesto.json → "podcast.broll.modo" tiene que ser "${quiere}" (lo eligió el usuario).`);
  }
  if (brief.estilo === 'entrevista') {
    if (op.lado && m.entrevista?.lado_mic && m.entrevista.lado_mic !== op.lado) errores.push(`manifiesto.json → "entrevista.lado_mic" tiene que ser "${op.lado}" (lo eligió el usuario).`);
    if (op.variante && m.entrevista?.variante && m.entrevista.variante !== op.variante) errores.push(`manifiesto.json → "entrevista.variante" tiene que ser "${op.variante}" (la eligió el usuario).`);
  }

  const v = await validar(slug);
  if (v.codigo !== 0) errores.push(...v.errores.slice(0, 8).map((e) => `validar-manifiesto → ${e}`));

  if (def.transiciones && !brief.continuidad) {
    const t = leerJSON(path.join(dir, 'transiciones.json'));
    if (!t) errores.push(`Falta temp/${slug}/transiciones.json (o no es JSON válido).`);
    else {
      const puntos = Array.isArray(t.puntos) ? t.puntos : [];
      const nTomas = new Set(tomas.map((x) => x?.n));
      if (!puntos.length || puntos.length > 5) errores.push('transiciones.json → tiene que traer de 1 a 4 puntos en "puntos".');
      if (!t.efectos?.woosh || !t.efectos?.['deep-woosh']) errores.push('transiciones.json → "efectos" tiene que traer "woosh" y "deep-woosh".');
      for (const p of puntos) {
        if (!nTomas.has(p?.toma)) errores.push(`transiciones.json → la toma ${p?.toma} no existe en el manifiesto.`);
        if (!ANIMACIONES.includes(p?.animacion)) errores.push(`transiciones.json → "animacion" tiene que ser ${ANIMACIONES.join(', ')}.`);
        if (!t.efectos?.[p?.efecto]) errores.push(`transiciones.json → el efecto "${p?.efecto}" no está en "efectos".`);
      }
    }
  }

  const g = leerYValidar(path.join(appDe(slug), 'guion.json'), 'guion');
  if (!g.ok) errores.push(...g.errores);
  // (en el podcast, la parte puede traer su "orden" aparte y en "n" la toma que la contiene)
  else for (const p of g.datos.partes) if (!numeros.has(podcast ? p.orden ?? p.n : p.n)) errores.push(`guion.json → la parte ${p.n} no es ${podcast ? 'una línea (guion[].orden)' : 'una toma'} del manifiesto.`);

  if (errores.length) return { ok: false, errores: [...new Set(errores)] };
  return { ok: true, ...normalizarGuion(slug, brief, g.datos, m) };
}

/** guion.json con lo que se dice copiado del manifiesto (la fuente de verdad), parte por parte y en orden. */
function normalizarGuion(slug, brief, g, m) {
  const porN = new Map(g.partes.map((p) => [brief.estilo === 'podcast' ? p.orden ?? p.n : p.n, p]));
  let ajustados = 0;
  const extra = (p) => ({ ...(p.momento ? { momento: p.momento } : {}) });
  const personajes = Array.isArray(g.personajes) ? g.personajes.filter((x) => x && typeof x === 'object') : [];
  let partes;
  let faltaban;
  const fam = ESTILOS[brief.estilo].familia;

  if (brief.estilo === 'podcast') {
    // la conversacion en el orden en que se oye (las tomas son bloques por anfitrion: no van en ese orden)
    const lado = (habla) => (String(habla).toUpperCase() === 'B' ? 'B' : 'A');
    // el nombre del anfitrion: por su id (A/B), o el primero y el segundo de "personajes"; nunca "host-a"
    const nombreDe = (habla) => {
      const x = personajes.find((y) => String(y.id || '').toUpperCase().replace(/^HOST-?/, '') === lado(habla)) || (personajes.length === 2 ? personajes[lado(habla) === 'A' ? 0 : 1] : null);
      return x?.nombre && !/^host[\s-]?[ab]$/i.test(x.nombre) ? x.nombre : null;
    };
    const lineas = m.guion.filter((x) => x && Number.isInteger(x.orden)).sort((a, b) => a.orden - b.orden);
    partes = lineas.map((l) => {
      const p = porN.get(l.orden) || {};
      const dice = texto(l.texto);
      if (p.dice !== undefined && p.dice !== dice) ajustados++;
      const suyo = typeof p.quien === 'string' && p.quien.trim() && !/^host[\s-]?[ab]$/i.test(p.quien.trim()) ? p.quien.trim().slice(0, 80) : null;
      const quien = nombreDe(l.habla) || suyo || `Anfitrión ${lado(l.habla)}`;
      return { n: l.orden, ...extra(p), ...(!p.momento && l.beat ? { momento: l.beat } : {}), quien, lado: lado(l.habla), dice, ...(p.se_ve ? { se_ve: p.se_ve } : {}) };
    });
    faltaban = lineas.length - g.partes.length;
  } else {
    const conLinea = m.tomas.filter((t) => texto(t.linea).trim() || (Array.isArray(t.dialogo) && t.dialogo.length));
    partes = conLinea.map((t) => {
      const p = porN.get(t.n) || {};
      const dice = texto(t.linea);
      if (p.dice !== undefined && p.dice !== dice) ajustados++;
      const parte = { n: t.n, ...extra(p), ...(!p.momento && t.fase ? { momento: t.fase } : {}), dice, ...(p.se_ve ? { se_ve: p.se_ve } : {}), ...(typeof t.duracion === 'number' ? { segundos: t.duracion } : {}) };
      if (Array.isArray(t.dialogo) && t.dialogo.length) {
        const persona = personajes[0]?.nombre || 'La persona';
        parte.dialogo = t.dialogo.map((d) => {
          const entrevistador = /entrevistador/i.test(texto(d.habla));
          return { quien: entrevistador ? 'Entrevistador' : persona, lado: entrevistador ? 'A' : 'B', dice: texto(d.texto) };
        });
      }
      if (fam === 'objeto-parlante' && typeof p.quien === 'string' && p.quien.trim()) parte.quien = p.quien.trim().slice(0, 80);
      return parte;
    });
    faltaban = conLinea.length - g.partes.length;
  }

  // lo que se oye: sin los clips de reacciones del podcast (no tienen linea)
  const total = m.tomas.filter((t) => texto(t.linea).trim() || (Array.isArray(t.lineas) && t.lineas.length) || (Array.isArray(t.dialogo) && t.dialogo.length)).reduce((s, t) => s + (Number(t.duracion) || 0), 0);
  const limpio = { ...g, idioma: g.idioma || m.idioma, mercado: g.mercado || m.mercado, duracionEstimada: r1(total) || g.duracionEstimada, partes };
  delete limpio.extras;
  // lo que va encima del guion y tambien se aprueba
  const extras = {};
  if (fam === 'ugc' && Array.isArray(m.ganchos_alternativos) && m.ganchos_alternativos.length && brief.opciones?.ganchos !== false) {
    const deClaude = new Map((Array.isArray(g.extras?.ganchos) ? g.extras.ganchos : []).map((x) => [x?.id, x]));
    extras.ganchos = m.ganchos_alternativos.map((x) => ({ id: texto(x.id), dice: texto(x.linea), ...(deClaude.get(x.id)?.idea ? { idea: texto(deClaude.get(x.id).idea).slice(0, 200) } : {}) }));
  }
  if (brief.estilo === 'entrevista') {
    if (m.entrevista?.cta?.texto) extras.cta = texto(m.entrevista.cta.texto);
    if (m.entrevista?.variante) limpio.variante = m.entrevista.variante;
  }
  if (Object.keys(extras).length) limpio.extras = extras;
  if (personajes.length) limpio.personajes = personajes.map((x) => ({ ...(x.id ? { id: texto(x.id) } : {}), nombre: texto(x.nombre).slice(0, 80), ...(x.como_es ? { como_es: texto(x.como_es).slice(0, 300) } : {}) }));
  escribirJSON(path.join(appDe(slug), 'guion.json'), limpio);
  return { ajustados, faltaban };
}

// ---- los cantados

const TILDES = { es: /[áéíóúñü]/i, pt: /[áâãàçéêíóôõú]/i };
const MARCA = /^\s*\[[^\]]*\]\s*$/; // [Verso 1], [Coro], [Verse 1 - soft, intimate]…
const sinTildes = (idioma, letra) => TILDES[idioma] && letra.length > 80 && !TILDES[idioma].test(letra);

/**
 * Lo que revisa la familia del estilo (familias/<familia>.js, verificarGuion(carpeta) -> { ok, errores }), si lo tiene:
 * asi la fase de guion pide lo mismo que despues usa la produccion. Si el modulo no esta, solo lo de aca.
 */
async function revisionDeLaFamilia(familia, slug) {
  try {
    const m = await import(`./familias/${familia}.js`);
    if (typeof m.verificarGuion !== 'function') return [];
    const r = await m.verificarGuion(dirDe(slug));
    return r && r.ok === false && Array.isArray(r.errores) ? r.errores : [];
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') console.warn(`[guion] ${slug}: la revisión de familias/${familia}.js falló: ${e?.message || e}`);
    return [];
  }
}

/**
 * Musical: letras.json con 2 o 3 opciones de verdad, con el estilo visual y la voz que eligio el usuario. Si pasa, la
 * app le numera las opciones (n = 1, 2, 3, el mismo numero que "elegida") y arma app/guion.json (el resumen de la
 * lista de anuncios: una parte por opcion).
 */
async function verificarLetras(slug, brief) {
  const ruta = rutaLetras(slug);
  const l = leerYValidar(ruta, 'letras');
  if (!l.ok) return { ok: false, errores: l.errores };
  const d = l.datos;
  const errores = [];
  const op = brief.opciones || {};
  if (op.visual && d.visual !== op.visual) errores.push(`letras.json → "visual" tiene que ser "${op.visual}" (lo eligió el usuario).`);
  if (op.vocalGender && d.vocalGender !== op.vocalGender) errores.push(`letras.json → "vocalGender" tiene que ser "${op.vocalGender}" (lo eligió el usuario).`);
  d.opciones.forEach((o, i) => {
    if (!o.letra.split(/\r?\n/).some((x) => x.trim() && !MARCA.test(x))) errores.push(`letras.json → la opción ${i + 1} no tiene letra (solo marcas).`);
    if (sinTildes(d.idioma, o.letra)) errores.push(`letras.json → la letra de la opción ${i + 1} no tiene ni una tilde: escríbela con sus tildes y su ñ de verdad (sin ellas Suno canta mal).`);
  });
  if (errores.length) return { ok: false, errores };
  // en su orden y numeradas 1, 2, 3 ("elegida" es ese numero)
  const opciones = [...d.opciones].sort((a, b) => (Number(a.n) || 0) - (Number(b.n) || 0)).map((o, i) => ({ ...o, n: i + 1 }));
  const limpio = { ...d, tipo: 'opciones', opciones };
  delete limpio.elegida;
  escribirJSON(ruta, limpio);
  // el resumen para la lista de anuncios (lo que se canta sale de letras.json)
  const previo = leerJSON(path.join(appDe(slug), 'guion.json'));
  const palabras = Math.max(...opciones.map((o) => lineasDe(o.letra).join(' ').split(/\s+/).filter(Boolean).length));
  escribirJSON(path.join(appDe(slug), 'guion.json'), {
    titulo: d.titulo,
    idioma: d.idioma,
    ...(d.mercado ? { mercado: d.mercado } : {}),
    duracionEstimada: Number(previo?.duracionEstimada) > 0 ? previo.duracionEstimada : Math.max(30, Math.round(palabras / 1.2)),
    ...(previo?.de_que_va ? { de_que_va: previo.de_que_va } : {}),
    partes: opciones.map((o) => ({ n: o.n, momento: `Opción ${o.n}`, dice: lineasDe(o.letra).join(' / '), ...(o.ideaVisual ? { se_ve: o.ideaVisual } : {}) })),
    decisiones: Array.isArray(d.decisiones) ? d.decisiones : [],
    ...(Array.isArray(d.cambios_hechos) ? { cambios_hechos: d.cambios_hechos } : {}),
  });
  const deLaFamilia = await revisionDeLaFamilia('musical', slug);
  if (deLaFamilia.length) return { ok: false, errores: deLaFamilia };
  return { ok: true, ajustados: 0 };
}

/** Las lineas que se cantan de una letra: sin las marcas de acto ni las lineas en blanco. */
const lineasDe = (letra) => texto(letra).split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !MARCA.test(x));

/** Historia musical: cancion/peticion.json como dice la skill y guion.json con una parte por linea de esa letra. */
async function verificarHistoria(slug, brief) {
  const errores = [];
  const pet = leerJSON(rutaPeticion(slug));
  if (!pet) return { ok: false, errores: [`Falta temp/${slug}/cancion/peticion.json (o no es JSON válido).`] };
  const letra = texto(pet.letra);
  const lineas = lineasDe(letra);
  if (!lineas.length) errores.push('cancion/peticion.json → "letra" está vacía.');
  if (!Array.isArray(pet.estilos) || pet.estilos.length !== 2 || pet.estilos.some((e) => typeof e !== 'string' || !e.trim())) errores.push('cancion/peticion.json → "estilos" tiene que traer los dos prompts de estilo.');
  if (pet.duracion !== null && pet.duracion !== undefined) errores.push('cancion/peticion.json → "duracion" va siempre en null (Suno corta la canción por el final).');
  if (!['f', 'm'].includes(pet.vocalGender)) errores.push('cancion/peticion.json → "vocalGender" tiene que ser "f" o "m".');
  const op = brief.opciones || {};
  if (op.vocalGender && pet.vocalGender && pet.vocalGender !== op.vocalGender) errores.push(`cancion/peticion.json → "vocalGender" tiene que ser "${op.vocalGender}" (lo eligió el usuario).`);
  if (pet.bloques !== undefined) {
    if (!Array.isArray(pet.bloques) || pet.bloques.some((b) => typeof b !== 'string')) errores.push('cancion/peticion.json → "bloques" tiene que ser una lista de textos.');
    else if (pet.bloques.length > 1 && pet.bloques.join('').replace(/\s+/g, '') !== letra.replace(/\s+/g, '')) errores.push('cancion/peticion.json → la unión de "bloques" tiene que ser exactamente la letra.');
  }
  const g = leerYValidar(path.join(appDe(slug), 'guion.json'), 'guion');
  if (!g.ok) errores.push(...g.errores);
  const idioma = g.ok ? g.datos.idioma : null;
  if (sinTildes(idioma || ({ spa: 'es', por: 'pt' }[pet.idioma] ?? null), letra)) errores.push('cancion/peticion.json → la letra no tiene ni una tilde: escríbela con sus tildes y su ñ de verdad.');
  if (g.ok && lineas.length && g.datos.partes.length !== lineas.length) errores.push(`guion.json → tiene ${g.datos.partes.length} partes y la letra ${lineas.length} líneas: va una parte por línea de la letra, en orden.`);
  if (errores.length) return { ok: false, errores: [...new Set(errores)] };

  // lo que se canta se copia de la letra (la fuente de verdad)
  let ajustados = 0;
  const partes = lineas.map((dice, i) => {
    const p = g.datos.partes[i] || {};
    if (p.dice !== dice) ajustados++;
    return { n: i + 1, ...(p.momento ? { momento: p.momento } : {}), dice, ...(p.se_ve ? { se_ve: p.se_ve } : {}) };
  });
  const palabras = lineas.join(' ').split(/\s+/).filter(Boolean).length;
  const limpio = { ...g.datos, duracionEstimada: Math.round((palabras / 125) * 60) || g.datos.duracionEstimada, partes };
  escribirJSON(path.join(appDe(slug), 'guion.json'), limpio);
  // la letra queda tambien como letras.json (una sola opcion, ya elegida): asi la lee la produccion
  escribirJSON(rutaLetras(slug), {
    tipo: 'historia',
    titulo: limpio.titulo,
    idioma: limpio.idioma,
    mercado: limpio.mercado || null,
    vocalGender: pet.vocalGender,
    opciones: [{ n: 1, titulo: texto(pet.titulo) || limpio.titulo, letra, estiloSuno: pet.estilos[0], estilos: pet.estilos }],
    elegida: 1,
  });
  const deLaFamilia = await revisionDeLaFamilia('historia-musical', slug);
  if (deLaFamilia.length) return { ok: false, errores: deLaFamilia };
  return { ok: true, ajustados };
}

// ---------------------------------------------------------------- el trabajo (en segundo plano)

const enMarcha = new Map(); // slug -> promesa

function lanzar(slug, opciones) {
  if (enMarcha.has(slug)) return false;
  const p = trabajar(slug, opciones)
    .catch((e) => {
      console.error(`[guion] ${slug}:`, e);
      const s = leerSesion(slug) || {};
      if (opciones.tipo === 'cambios') restaurar(slug, s.respaldo);
      guardarSesion(slug, { ...s, estado: 'error', fin: ahora(), cambioFallido: opciones.tipo === 'cambios' || undefined, error: e.publico || { mensaje: 'Algo salió mal al escribir el guion. Toca "Reintentar".', tipo: 'otro', detalle: String(e.message || e).slice(0, 400) } });
    })
    .finally(() => enMarcha.delete(slug));
  enMarcha.set(slug, p);
  return true;
}

async function trabajar(slug, { tipo, pedido = null, retomar = false, reintento = false }) {
  const brief = leerBrief(slug);
  let s = leerSesion(slug);
  s = { ...s, estado: tipo === 'cambios' ? 'cambiando' : 'escribiendo', tipo, intentos: (s.intentos || 0) + 1, error: null, inicioIntento: ahora() };
  if (!retomar) s.progreso = [];
  guardarSesion(slug, s);
  const avanzar = (f) => {
    if (!f) return;
    const actual = leerSesion(slug) || s;
    const progreso = [...(actual.progreso || [])];
    if (progreso[progreso.length - 1] !== f) progreso.push(f);
    s = guardarSesion(slug, { ...actual, progreso: progreso.slice(-30) });
  };

  const letras = esLetras(brief);
  let sesion;
  if (tipo === 'cambios') {
    sesion = armarSesionCambios(slug, { brief, pedido, reintento });
  } else {
    avanzar('Preparando la foto de tu producto');
    const foto = await prepararFoto(slug, brief);
    const prepClonar = referenciaPedida(brief) ? await prepararReferencia(slug, brief, avanzar) : null;
    sesion = armarSesionGuion(slug, { brief, foto, retomar, reintento, prepClonar });
    fs.rmSync(path.join(appDe(slug), 'bloqueo.json'), { force: true });
  }

  const r = await lanzarSesion({
    ...sesion,
    uuid: s.uuid,
    alProgreso: avanzar,
    registro: path.join(appDe(slug), 'registro', tipo === 'cambios' ? 'cambios.log' : 'guion.log'),
  });

  s = leerSesion(slug) || s;
  const medida = { tipo, fecha: ahora(), ok: r.ok, turnos: r.turnos, duracionMs: r.duracionMs, uso: r.uso, costoEstimado: r.costo, modelo: r.init?.modelo || null, herramientas: r.init?.herramientas || null, denegados: r.denegados?.length || 0, motor: r.motor || null };
  const medidas = [...(s.medidas || []), medida].slice(-20);
  if (r.ok) {
    const cambios = (s.cambios || []).map((c, i, a) => (i === a.length - 1 && tipo === 'cambios' ? { ...c, ok: true } : c));
    guardarSesion(slug, { ...s, estado: 'listo', fin: ahora(), error: null, limite: false, reinicio: null, cambioFallido: undefined, bloqueado: undefined, faltan: undefined, respaldo: tipo === 'cambios' ? null : s.respaldo, medidas, cambios, ajustados: r.verificacion?.ajustados || 0 });
    return;
  }
  if (tipo === 'cambios' && !r.cancelado) restaurar(slug, s.respaldo);
  guardarSesion(slug, {
    ...s,
    estado: r.bloqueado ? 'bloqueado' : 'error',
    fin: ahora(),
    error: tipo === 'cambios' && !r.limite && !r.sinSesion && !r.sinClaude && !r.planSinCodex ? { ...errorPublico(r), mensaje: `No pude hacer el cambio que pediste: ${r.error} ${letras ? 'Tus letras anteriores siguen' : 'Tu guion anterior sigue'} igual.` } : errorPublico(r),
    limite: !!r.limite,
    reinicio: r.reinicio || null,
    bloqueado: r.bloqueado || undefined,
    faltan: r.faltan || undefined,
    cambioFallido: tipo === 'cambios' || undefined,
    medidas,
  });
}

// ---------------------------------------------------------------- cambios, reintentar y aprobar

const GUARDADOS = ['manifiesto.json', 'transiciones.json', 'app/guion.json', 'app/letras.json', 'cancion/peticion.json'];

function respaldar(slug) {
  const base = path.join(appDe(slug), 'historial-guion');
  const n = listar(base).length + 1;
  const dir = path.join(base, String(n).padStart(2, '0'));
  for (const rel of GUARDADOS) {
    const desde = path.join(dirDe(slug), rel);
    if (existe(desde)) {
      const hasta = path.join(dir, path.basename(rel));
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(desde, hasta);
    }
  }
  return path.relative(appDe(slug), dir).replace(/\\/g, '/');
}

function restaurar(slug, respaldo) {
  if (!respaldo) return;
  const dir = path.join(appDe(slug), respaldo);
  for (const rel of GUARDADOS) {
    const desde = path.join(dir, path.basename(rel));
    if (existe(desde)) {
      fs.mkdirSync(path.dirname(path.join(dirDe(slug), rel)), { recursive: true });
      fs.copyFileSync(desde, path.join(dirDe(slug), rel));
    }
  }
}

/** Lo que Claude dejo escrito para mostrar: guion.json, o letras.json en el musical. */
function hayHoja(slug, brief) {
  if (ESTILOS[brief?.estilo]?.familia === 'musical') return existe(path.join(appDe(slug), 'letras.json'));
  if (ESTILOS[brief?.estilo]?.familia === 'historia-musical') return existe(path.join(appDe(slug), 'guion.json')) && existe(path.join(dirDe(slug), 'cancion', 'peticion.json'));
  return existe(path.join(appDe(slug), 'guion.json')) && existe(path.join(dirDe(slug), 'manifiesto.json'));
}

/** POST /api/anuncios/:slug/guion/cambios { pedido } */
export function pedirCambios(slug, pedido) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const elPedido = String(pedido || '').trim();
  const brief = leerBrief(slug);
  const que = ESTILOS[brief?.estilo]?.familia === 'musical' ? 'de las letras' : 'del guion';
  if (elPedido.length < 3) throw new ErrorApp(400, `Escribe qué quieres cambiar ${que}.`);
  if (elPedido.length > 2000) throw new ErrorApp(400, 'El pedido es muy largo: cuéntalo en menos palabras.');
  const s = leerSesion(slug);
  if (enMarcha.has(slug) || sesionActiva(s?.uuid)) throw new ErrorApp(409, `${laIA()} todavía está trabajando en este guion. Espera a que termine.`);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Este guion ya se aprobó y está en producción.');
  const reabierto = s?.estado === 'aprobado' && guionReabierto(slug);
  if (!(s?.estado === 'listo' || reabierto || (s?.estado === 'error' && s.cambioFallido && hayHoja(slug, brief)))) throw new ErrorApp(409, 'El guion todavía no está listo para pedir cambios.');
  const respaldo = respaldar(slug);
  guardarSesion(slug, { ...s, estado: 'cambiando', pedido: elPedido, respaldo, cambios: [...(s.cambios || []), { pedido: elPedido, fecha: ahora() }] });
  lanzar(slug, { tipo: 'cambios', pedido: elPedido });
  return { ok: true };
}

/** POST /api/anuncios/:slug/guion/reintentar: vuelve a correr lo que fallo (o lo que quedo a medias). */
export function reintentarGuion(slug) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const s = leerSesion(slug);
  if (!s) throw new ErrorApp(409, 'Este anuncio no tiene guion para reintentar.');
  if (enMarcha.has(slug) || sesionActiva(s.uuid)) return { ok: true, yaEstaba: true };
  if (s.estado === 'listo' || s.estado === 'aprobado' || yaEnProduccion(slug)) return { ok: true, nada: true };
  if (s.cambioFallido && s.pedido && hayHoja(slug, leerBrief(slug))) {
    const respaldo = respaldar(slug);
    guardarSesion(slug, { ...s, estado: 'cambiando', respaldo });
    lanzar(slug, { tipo: 'cambios', pedido: s.pedido, reintento: true });
    return { ok: true };
  }
  if (s.estado === 'bloqueado') {
    // el usuario completo la ficha: guion desde cero, en una conversacion nueva (con el brief de ahora)
    guardarSesion(slug, { ...s, uuid: crypto.randomUUID(), estado: 'escribiendo', progreso: [] });
    lanzar(slug, { tipo: 'guion' });
    return { ok: true };
  }
  lanzar(slug, { tipo: 'guion', reintento: true });
  return { ok: true };
}

const PAUSA = new Int32Array(new SharedArrayBuffer(4));

/**
 * DELETE /api/anuncios/:slug: un anuncio que todavia no se produce (el guion espera tu aprobacion o no salio) se
 * saca del tablero. No se borra nada: la carpeta pasa a temp/_descartados/ (las carpetas con "_" no se listan).
 */
export function descartarAnuncio(slug) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const s = leerSesion(slug);
  if (enMarcha.has(slug) || sesionActiva(s?.uuid)) throw new ErrorApp(409, `${laIA()} está trabajando en este guion. Espera a que termine para descartarlo.`);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Este anuncio ya se está produciendo: no se puede descartar.');
  const papelera = path.join(TEMP, '_descartados');
  fs.mkdirSync(papelera, { recursive: true });
  let destino = path.join(papelera, slug);
  for (let i = 2; existe(destino); i++) destino = path.join(papelera, `${slug}-${i}`);
  // En Windows un archivo abierto un instante (la pantalla pide el guion cada 2 s) frena el renombre: se reintenta.
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(dirDe(slug), destino);
      break;
    } catch (e) {
      if (i >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw new ErrorApp(409, 'No pude mover la carpeta del anuncio (algún programa la tiene abierta). Vuelve a intentarlo en un momento.');
      Atomics.wait(PAUSA, 0, 0, 60 * (i + 1));
    }
  }
  console.log(`[guion] descartado ${slug} -> ${path.relative(TEMP, destino)}`);
  return { ok: true, descartado: slug };
}

/**
 * POST /api/anuncios/:slug/guion/letra { n }: el usuario elige una de las letras del musical (todavia sin producir; la
 * puede cambiar hasta aprobar). Queda en letras.json ("elegida" = 1, 2 o 3: la posicion en "opciones").
 */
export function elegirLetra(slug, n) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const brief = leerBrief(slug);
  if (ESTILOS[brief?.estilo]?.familia !== 'musical') throw new ErrorApp(400, 'Este anuncio no tiene letras para elegir.');
  const s = leerSesion(slug);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Esta letra ya se aprobó y está en producción.');
  if (!(s?.estado === 'listo' || (s?.estado === 'aprobado' && guionReabierto(slug))) || enMarcha.has(slug)) throw new ErrorApp(409, 'Las letras todavía no están listas.');
  const l = leerJSON(rutaLetras(slug));
  const elegida = Number(n);
  if (!Number.isInteger(elegida) || elegida < 1 || elegida > (l?.opciones?.length || 0)) throw new ErrorApp(400, 'Esa letra no existe. Elige una de las opciones.');
  escribirJSON(rutaLetras(slug), { ...l, elegida, elegidaEn: ahora() });
  return { ok: true, elegida };
}

/**
 * Deja el guion aprobado (sin arrancar nada). Lo usa POST /producir; el conductor puede llamarlo tambien.
 * En el musical aprobar es elegir la letra ({ letra: n }, o la que ya eligio con elegirLetra): queda en letras.json
 * ("elegida") y con eso la familia (familias/musical.js, paso "letra") escribe cancion/peticion.json.
 */
export async function aprobarGuion(slug, { letra } = {}) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const s = leerSesion(slug);
  if (aprobadoYProduciendo(slug, s)) return s;
  if (enMarcha.has(slug) || sesionActiva(s?.uuid) || s?.estado === 'escribiendo' || s?.estado === 'cambiando') throw new ErrorApp(409, `${laIA()} todavía está escribiendo el guion. Espera a que termine.`);
  if (s?.estado !== 'listo' && !(s?.estado === 'aprobado' && guionReabierto(slug))) throw new ErrorApp(409, 'El guion no está listo: no se puede aprobar todavía.');
  const brief = leerBrief(slug);
  const fam = ESTILOS[brief?.estilo]?.familia;
  // lo aprobado tiene que seguir valido (nadie lo toco a mano entre medio)
  if (fam === 'musical') {
    const l = leerYValidar(rutaLetras(slug), 'letras');
    if (!l.ok) throw new ErrorApp(409, 'Las letras quedaron con un problema. Pide un cambio o toca "Reintentar".', { detalle: l.errores.slice(0, 5) });
    const n = Number(letra ?? l.datos.elegida ?? (l.datos.opciones.length === 1 ? 1 : NaN));
    if (!Number.isInteger(n) || n < 1 || n > l.datos.opciones.length) throw new ErrorApp(409, 'Elige una de las letras antes de producir.', { tipo: 'elegir-letra' });
    const ahoraEs = ahora();
    escribirJSON(rutaLetras(slug), { ...l.datos, elegida: n, elegidaEn: l.datos.elegida === n ? l.datos.elegidaEn || ahoraEs : ahoraEs });
  } else if (fam === 'historia-musical') {
    const v = await verificarHistoria(slug, brief);
    if (!v.ok) throw new ErrorApp(409, 'La historia quedó con un problema. Pide un cambio o toca "Reintentar".', { detalle: (v.errores || []).slice(0, 5) });
  } else {
    const v = await validar(slug);
    if (v.codigo !== 0) throw new ErrorApp(409, 'El guion quedó con un problema. Pide un cambio o toca "Reintentar".', { detalle: v.errores.slice(0, 5) });
  }
  // los modelos con los que se aprueba (los de Ajustes, los del costo estimado que se vio): desde aca el anuncio se
  // queda con ellos aunque despues cambies Ajustes (lib/modelos.js, copiarModelosAlAnuncio)
  copiarModelosAlAnuncio(slug, { alAprobar: true });
  return guardarSesion(slug, { ...s, estado: 'aprobado', aprobado: ahora() });
}

/**
 * Aprueba el guion y arranca el conductor (lib/conductor.js, iniciarProduccion). Hoy POST /api/anuncios/:slug/producir
 * lo atiende rutas/produccion.js llamando directo a iniciarProduccion; esto queda para quien quiera las dos cosas.
 */
export async function aprobarYProducir(slug, opciones = {}) {
  await aprobarGuion(slug, opciones);
  const { iniciarProduccion } = await import('./conductor.js');
  return { ok: true, aprobado: true, conductor: await iniciarProduccion(slug) };
}

/**
 * La produccion se freno en su primer paso porque el guion (o la letra) aprobado no se puede usar, antes de gastar
 * nada: el guion vuelve a abrirse. Se pide el cambio con palabras, se aprueba otra vez y la produccion sigue desde
 * ese paso (rutas/produccion.js: /producir con el conductor ya creado).
 */
export function guionReabierto(slug) {
  const c = leerJSON(path.join(appDe(slug), 'conductor.json'));
  if (!c || c.estado !== 'error' || !Array.isArray(c.pasos)) return false;
  const p = c.pasos.find((x) => x.id === c.paso);
  return Boolean(p && ['validar', 'letra'].includes(p.id) && p.error?.motivo === 'guion');
}

const yaEnProduccion = (slug) => existe(path.join(appDe(slug), 'conductor.json')) && !guionReabierto(slug);
/** Aprobado y en produccion (un guion reabierto no cuenta: se puede cambiar y aprobar otra vez). */
const aprobadoYProduciendo = (slug, s) => (s?.estado === 'aprobado' && !guionReabierto(slug)) || yaEnProduccion(slug);

// ---------------------------------------------------------------- lo que lee la pantalla

/** Las letras del musical para la pantalla: sin el prompt de estilo de Suno (nada de prompts a la vista). */
function letrasParaLaPantalla(l) {
  if (!l || !Array.isArray(l.opciones)) return null;
  return {
    tipo: l.tipo || 'opciones',
    titulo: l.titulo || null,
    idioma: l.idioma || null,
    mercado: l.mercado || null,
    angulo: l.angulo || null,
    etapa: l.etapa || null,
    visual: l.visual || null,
    vocalGender: l.vocalGender ?? null,
    opciones: l.opciones.map((o, i) => ({ n: i + 1, titulo: o.titulo || null, concepto: o.concepto || null, letra: o.letra || '', ideaVisual: o.ideaVisual || null })),
    elegida: l.elegida ?? null,
    decisiones: Array.isArray(l.decisiones) ? l.decisiones : [],
    cambios_hechos: Array.isArray(l.cambios_hechos) ? l.cambios_hechos : [],
  };
}

/** Lo que se muestra del guion de un anuncio: guion.json (en el musical lo arma la app con sus letras), o null. */
function leerHoja(slug, brief) {
  const g = leerJSON(path.join(appDe(slug), 'guion.json'));
  if (g || ESTILOS[brief?.estilo]?.familia !== 'musical') return g;
  const l = leerJSON(rutaLetras(slug));
  return l ? { titulo: l.titulo || l.opciones?.[0]?.titulo || null, idioma: l.idioma || null, mercado: l.mercado || null, duracionEstimada: null, partes: [] } : null;
}

/** GET /api/anuncios/:slug/guion */
export function estadoGuion(slug) {
  if (!esAnuncioNuevo(slug)) return null;
  const brief = leerBrief(slug);
  const def = ESTILOS[brief?.estilo];
  const s = leerSesion(slug) || {};
  const trabajando = enMarcha.has(slug) || sesionActiva(s.uuid) || s.estado === 'escribiendo' || s.estado === 'cambiando';
  const estado = trabajando ? 'escribiendo' : s.estado === 'listo' || s.estado === 'aprobado' ? 'listo' : 'error';
  // solo un guion que paso la revision (o el de antes de un cambio): nunca uno a medio escribir
  const mostrar = estado === 'listo' || s.estado === 'cambiando' || s.cambioFallido;
  const musical = def?.familia === 'musical';
  const letras = mostrar && musical ? letrasParaLaPantalla(leerJSON(rutaLetras(slug))) : null;
  let guion = mostrar ? leerHoja(slug, brief) : null;
  if (musical && !letras) guion = null;
  const error = estado !== 'error' ? null : s.estado === 'bloqueado' ? { ...(s.error || {}), tipo: 'bloqueo', faltan: s.faltan || s.error?.faltan || [] } : s.error || { mensaje: 'El guion no terminó. Toca "Reintentar".', tipo: 'otro' };
  const enProduccion = aprobadoYProduciendo(slug, s); // /producir lo atiende el conductor
  const c = enProduccion ? leerJSON(path.join(appDe(slug), 'conductor.json')) : null;
  // las piezas que va a pedir (para estimar cuanto tarda la produccion, igual que la pantalla de produccion). Con la
  // voz ya hecha, sin los B-roll que no entran en el video (no se piden: lib/broll.js); antes, todos.
  const m = guion && def?.faseGuion === 'guion' ? leerJSON(path.join(dirDe(slug), 'manifiesto.json')) : null;
  const regla = m ? brollDe(dirDe(slug), m) : null;
  const brollQueSePide = m ? (m.broll || []).filter((b) => regla.entra(b?.n)).length : 0;
  const piezas = m
    ? {
        imagenes: (m.tomas || []).reduce((n, t) => n + (t?.prompt_imagen_inicial ? 1 : 0) + (t?.prompt_imagen_final ? 1 : 0), 0) + brollQueSePide + (m.referencias || []).filter((r) => r?.prompt).length,
        clips: (m.tomas || []).length + brollQueSePide,
      }
    : null;
  // un guion reabierto (la produccion se freno en su primer paso por el guion) se aprueba otra vez despues del cambio
  const listoParaAprobar = estado === 'listo' && s.estado === 'listo' && !enProduccion;
  const reabierto = !enProduccion && guionReabierto(slug);
  return {
    slug,
    estado,
    fase: def?.faseGuion || 'guion',
    familia: familiaDe(brief),
    cambiando: s.estado === 'cambiando',
    aprobado: enProduccion,
    reabierto,
    guion: guion || null,
    letras,
    progreso: s.progreso || [],
    error,
    limite: !!s.limite,
    reinicio: s.reinicio || null,
    cambioFallido: !!s.cambioFallido,
    // en el musical, con mas de una letra, se aprueba eligiendo una (Producir manda { letra: n })
    puedeAprobar: listoParaAprobar,
    terminado: c?.estado === 'listo',
    piezas,
    pedido: s.estado === 'cambiando' || s.cambioFallido ? s.pedido || null : null,
    cambios: (s.cambios || []).length,
    productoId: brief?.productoId || null,
    // duracion: null (el musical) | { decide: 'ia' } | { decide: 'usuario', texto, segundos }, tambien de un anuncio de antes
    brief: brief ? { estilo: brief.estilo, duracion: leerDuracion(brief.duracion, brief.estilo), voz: brief.voz, productoId: brief.productoId, continuidad: Boolean(brief.continuidad), respuestas: brief.respuestas || {} } : null,
    inicio: s.inicioIntento || s.inicio || null,
  };
}

/**
 * Los anuncios que armo la app, para el tablero (GET /api/anuncios los junta con los de siempre; ver el informe).
 * estado: guion | produciendo | listo | error
 */
// La lista de los anuncios de la app se pide seguido (el tablero, el menu, cada pantalla): cada anuncio se lee de
// disco solo si cambio alguno de sus archivos (o la ficha de su producto). Con la PC ocupada (renders, otras apps),
// leer todo temp/ en cada pedido frenaba la app entera.
const ARCHIVOS_DEL_RESUMEN = ['brief.json', 'sesion.json', 'guion.json', 'letras.json', 'conductor.json'];
const resumenes = new Map(); // slug -> { firma, fechas, productoId, uuid, valor }

/** La IA que escribio o intento el guion: 'claude' | 'codex' | null (la de su ultima medida, o la del error). */
export function motorDeSesion(s) {
  const valida = (m) => (m === 'claude' || m === 'codex' ? m : null);
  const medidas = Array.isArray(s?.medidas) ? s.medidas : [];
  for (let i = medidas.length - 1; i >= 0; i--) if (valida(medidas[i]?.motor)) return medidas[i].motor;
  return valida(s?.error?.motor);
}

function calcularResumen(slug, fechas) {
  const brief = leerBrief(slug);
  const s = leerSesion(slug) || {};
  const c = leerJSON(path.join(appDe(slug), 'conductor.json'));
  const g = leerHoja(slug, brief);
  const f = brief?.productoId ? leerFicha(brief.productoId) : null;
  const trabajando = enMarcha.has(slug) || sesionActiva(s.uuid);
  let estado;
  if (c) estado = c.estado === 'listo' ? 'listo' : c.estado === 'error' ? 'error' : 'produciendo';
  else if (s.estado === 'aprobado') estado = 'produciendo';
  else if (!trabajando && (s.estado === 'error' || s.estado === 'bloqueado')) estado = 'error';
  else estado = 'guion';
  const etapa = c ? c.paso || null : estado === 'guion' ? (s.estado === 'listo' ? 'aprobar' : s.estado === 'cambiando' ? 'cambiando' : 'escribiendo') : null;
  const p = brief?.productoId ? leerProducto(brief.productoId) : null;
  const primera = p?.fotos?.[0];
  const pres = PRESENTACION.find((e) => e.clave === brief?.estilo);
  const valor = {
    slug,
    nuevo: true,
    titulo: f?.nombre || p?.nombre || g?.titulo || slug,
    tituloGuion: g?.titulo || null,
    estilo: brief?.estilo || null,
    estiloNombre: ESTILOS[brief?.estilo]?.nombre || brief?.estilo || null,
    // la familia como la muestra la app (voz-en-off | hablado | cantado) y la que lo produce (lib/familias/)
    familia: pres?.familia || ESTILOS[brief?.estilo]?.familia || null,
    produccion: familiaDe(brief),
    continuidad: Boolean(brief?.continuidad),
    productoId: brief?.productoId || null,
    estado,
    etapa,
    // hecho con los simuladores (sin gastar): el tablero no lo cuenta entre los listos para publicar
    modoPrueba: Boolean(c?.modoPrueba),
    teNecesita: (estado === 'guion' && s.estado === 'listo') || (c?.estado === 'pausado' && c?.paso === 'elegir-cancion'),
    // todavia en el paso del guion (sin conductor): un error aca se arregla en la pantalla del guion, no con "Continuar"
    // (y uno cuya produccion se freno en su primer paso por el guion: se arregla pidiendo el cambio, guionReabierto)
    enGuion: (!c && s.estado !== 'aprobado') || guionReabierto(slug),
    idioma: g?.idioma || f?.idioma || null,
    mercado: g?.mercado || f?.mercado || null,
    duracion: g?.duracionEstimada ?? segundosPedidos(brief) ?? null,
    duracionOrigen: g?.duracionEstimada ? 'estimada' : segundosPedidos(brief) ? 'pedida' : null,
    miniatura: primera ? urlFoto(brief.productoId, Number(primera.match(/(\d+)\./)?.[1])) : null,
    error: estado === 'error' ? (c?.pasos?.find((x) => x.estado === 'error')?.error?.mensaje || s.error?.mensaje || null) : null,
    // de un guion que no salio: que tipo de falla (limite, sin-sesion, bloqueo…) y cuando se renueva el plan
    errorTipo: estado === 'error' && !c ? (s.estado === 'bloqueado' ? 'bloqueo' : s.limite ? 'limite' : s.error?.tipo || 'otro') : null,
    reinicio: estado === 'error' && !c ? s.reinicio || null : null,
    // la IA que escribio (o intento) el guion: la de su ultima medida, o la del error (TeNecesitan la nombra)
    motor: motorDeSesion(s),
    creado: brief?.creado || null,
    fecha: new Date(Math.max(...fechas) || Date.now()).toISOString(),
  };
  return { valor, uuid: s.uuid || null };
}

/** El resumen de un anuncio de la app (lo de la lista del tablero), o null si no es uno de la app. */
export function anuncioNuevo(slug) {
  if (!esAnuncioNuevo(slug)) {
    resumenes.delete(slug);
    return null;
  }
  const dir = appDe(slug);
  const fechas = ARCHIVOS_DEL_RESUMEN.map((n) => stat(path.join(dir, n))?.mtimeMs || 0);
  const previo = resumenes.get(slug);
  const mismos = previo && previo.fechas[0] === fechas[0] && previo.fechas[1] === fechas[1];
  const productoId = mismos ? previo.productoId : leerBrief(slug)?.productoId || null;
  const uuid = mismos ? previo.uuid : leerSesion(slug)?.uuid || null;
  const delProducto = productoId ? ['ficha.json', 'producto.json'].map((n) => stat(path.join(TEMP, '_productos', productoId, n))?.mtimeMs || 0) : [];
  const trabajando = enMarcha.has(slug) || sesionActiva(uuid);
  const firma = `${fechas.join(',')}|${delProducto.join(',')}|${trabajando ? 1 : 0}`;
  if (previo && previo.firma === firma) return { ...previo.valor };
  const r = calcularResumen(slug, fechas);
  resumenes.set(slug, { firma, fechas, productoId: r.valor.productoId, uuid: r.uuid, valor: r.valor });
  return { ...r.valor };
}

export function listarAnunciosNuevos() {
  return listar(TEMP)
    .map((slug) => anuncioNuevo(slug))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

/** Al abrir la app: los guiones que quedaron a medias siguen solos, en la misma conversacion de Claude. */
export function retomarGuiones() {
  for (const slug of listar(TEMP)) {
    if (!esAnuncioNuevo(slug) || enMarcha.has(slug)) continue;
    if (!esDeEstaApp(leerBrief(slug))) continue; // el de una app de prueba lo sigue esa (y al reves)
    const s = leerSesion(slug);
    if (!s || sesionActiva(s.uuid)) continue;
    if (s.estado === 'escribiendo') lanzar(slug, { tipo: 'guion', retomar: true });
    else if (s.estado === 'cambiando' && s.pedido) {
      restaurar(slug, s.respaldo); // lo que haya quedado a medio editar vuelve a como estaba, y el cambio se hace de nuevo
      lanzar(slug, { tipo: 'cambios', pedido: s.pedido, reintento: true });
    } else continue;
    console.log(`[guion] retomo ${slug}`);
  }
}
