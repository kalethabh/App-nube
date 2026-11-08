// Lo que está "en producción" ahora, contado igual en toda la app: el menú lateral, la píldora de la
// barra de arriba y el tablero leen esto mismo, así nunca dicen números distintos.
//
//   const p = useEnProduccion();
//   p.activos     anuncios que se están produciendo de verdad: los de la app (su conductor.json está
//                 esperando o corriendo) y los que se producen desde la terminal (cambiaron hace poco)
//   p.necesitan   anuncios de la app frenados: un paso falló o el saldo de kie no alcanza
//                 [{ anuncio, conductor, alto }] (ver altoDe)
//   p.guiones     anuncios de la app que esperan en el paso del guion: listo para aprobar, o con un error
//   p.pausados    carpetas viejas sin terminar que no cambian hace rato ("Quedaron a medio camino")
//   p.cantidad    cuántos están en producción (= p.activos.length)
//   p.ejemplos / p.esEjemplo   ya no hay ejemplos: siempre [] y false (el menú y la barra los siguen leyendo)
//
// El conductor de cada anuncio (temp/<slug>/app/conductor.json, GET /api/anuncios/:slug/conductor) dice en
// qué paso va. Aquí está todo lo que se calcula de él, para que la producción, el tablero y el menú
// lo cuenten igual: las etapas, el avance, el tiempo que falta y por qué está frenado. Sin precios.
import { invalidar, useAnuncios, useDatos } from './api.js';

export const TICK = 2000;

// ---------------------------------------------------------------- pedir y continuar

async function pedirJSON(url, { metodo = 'GET', opcional = false } = {}) {
  let r;
  try {
    r = await fetch(url, { method: metodo, headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?');
  }
  if (opcional && r.status === 404) return null;
  const datos = await r.json().catch(() => null);
  if (!r.ok) throw new Error(datos?.error || 'No pude leer los datos.');
  return datos;
}

/** El conductor de un anuncio, o null si el anuncio no lo tiene (carpetas hechas desde la terminal). */
export async function leerConductor(slug) {
  const c = await pedirJSON(`/api/anuncios/${encodeURIComponent(slug)}/conductor`, { opcional: true });
  return c && Array.isArray(c.pasos) ? c : null;
}

/** El conductor de un anuncio (null si no tiene). `cadaMs` vuelve a mirarlo cada tanto (2 s en producción). */
export const useConductor = (slug, opciones) => useDatos(slug ? `conductor:${slug}` : null, () => leerConductor(slug), opciones);

/** Los conductores de varios anuncios de una vez: { [slug]: conductor | null }. */
export function useConductores(slugs, opciones) {
  const lista = [...new Set(slugs)].sort();
  const clave = lista.length ? `conductores:${lista.join('|')}` : null;
  return useDatos(
    clave,
    async () => {
      // todos en un solo pedido (antes iba uno por anuncio y, con la PC ocupada, el menú esperaba al más lento).
      // Si la app está cerrada tira el error y se queda lo último que se vio: el avance no vuelve a 0.
      const r = await pedirJSON(`/api/conductores?slugs=${encodeURIComponent(lista.join(','))}`);
      const todos = r?.conductores || {};
      return Object.fromEntries(lista.map((s) => [s, todos[s] && Array.isArray(todos[s].pasos) ? todos[s] : null]));
    },
    opciones
  );
}

/** "Continuar": reintenta el paso que falló (o sigue después de recargar el saldo). Lo ya hecho no se paga. */
export async function continuarProduccion(slug) {
  const r = await pedirJSON(`/api/anuncios/${encodeURIComponent(slug)}/continuar`, { metodo: 'POST' });
  invalidar(`conductor:${slug}`);
  invalidar('conductores:');
  return r;
}

// ---------------------------------------------------------------- los pasos en palabras

/**
 * Cada paso del conductor (de las 7 familias: voz en off, continuidad, objeto parlante, UGC, podcast y entrevista,
 * musical e historia musical), como lo ve el usuario: lo que se está haciendo, el detalle y lo que queda en el
 * registro cuando termina. Si llega un paso que no está aquí, se usa su `nombre`.
 */
export const PASOS = {
  validar: {
    haciendo: 'Revisando el guion antes de empezar',
    detalle: 'Se comprueba que cada toma tenga todo lo que necesita. Esto no gasta nada.',
    hecho: 'Guion revisado: todo en orden.',
  },
  saldo: {
    haciendo: 'Mirando tu saldo de kie',
    detalle: 'Antes de gastar, la app comprueba que te alcance para el anuncio entero.',
    hecho: 'Tu saldo de kie alcanza para todo el anuncio.',
  },
  voz: {
    haciendo: 'Grabando la voz',
    detalle: 'ElevenLabs lee el guion con la voz que elegiste. De sus tiempos salen los de cada toma.',
    hecho: 'Voz lista.',
  },
  ventanas: {
    haciendo: 'Ajustando cada toma a la voz',
    detalle: 'Ninguna toma puede quedar más corta que su frase: si hace falta, se alarga antes de pedirla.',
    hecho: 'Cada toma quedó a la medida de su frase.',
  },
  'imagenes-y-videos': {
    haciendo: 'Generando las imágenes y los videos',
    detalle: 'Cada clip sale apenas llega su imagen. Si el modelo principal falla, sale con el de respaldo.',
    hecho: 'Llegaron todas las imágenes y los videos.',
  },
  'revision-imagenes': {
    haciendo: 'La IA revisa las imágenes',
    detalle: 'Mira cada toma contra sus hojas: el personaje, tu producto y las letras. Si una salió mal, la rehace una vez.',
    hecho: 'Imágenes revisadas.',
  },
  voces: {
    haciendo: 'Buscando voces coladas en los clips',
    detalle: 'Si un clip trae una voz que no va, se silencia solo.',
    hecho: 'Clips revisados: sin voces que no van.',
  },
  musica: {
    haciendo: 'Poniendo la música de fondo',
    detalle: 'La pista del estilo, o una que Suno compone para tu anuncio, y los sonidos de las transiciones.',
    hecho: 'Música de fondo lista.',
  },
  montaje: {
    haciendo: 'Armando el montaje',
    detalle: 'Cortes, subtítulos y música sobre los tiempos reales de lo que se dice o se canta.',
    hecho: 'Montaje armado, con sus subtítulos.',
  },
  render: {
    haciendo: 'Renderizando tu video',
    detalle: 'Tu PC arma el video completo. Las otras versiones salen del editor. Es lo que más tarda al final.',
    hecho: 'Video renderizado.',
  },
  'control-final': {
    haciendo: 'Último control',
    detalle: 'Se busca cualquier cuadro negro o congelado antes de entregártelo. Si aparece uno, se vuelve a renderizar solo.',
    hecho: 'Control final: sin cuadros negros ni congelados.',
  },
  informe: {
    haciendo: 'Escribiendo tu informe',
    detalle: 'Lo que decidió el montaje y lo que se arregló solo, en palabras simples.',
    hecho: 'Informe listo.',
  },

  // ---- continuidad (cada escena pasa a la siguiente sin cortes)
  'preparar-cadena': {
    haciendo: 'Preparando el anuncio sin cortes',
    detalle: 'Cada escena va a pasar a la siguiente en un solo movimiento. Esto no gasta nada.',
    hecho: 'Listo para encadenar las escenas.',
  },
  imagenes: {
    haciendo: 'Generando las imágenes',
    detalle: 'Primero las hojas de los personajes y después la imagen de cada escena. Los clips esperan a que la IA las revise.',
    hecho: 'Llegaron todas las imágenes.',
  },
  duraciones: {
    haciendo: 'Midiendo cada paso con la voz',
    detalle: 'Cada paso entre dos escenas dura lo que tarda su frase.',
    hecho: 'Cada paso quedó a la medida de su frase.',
  },
  pares: {
    haciendo: 'Escribiendo el paso entre cada escena',
    detalle: 'La IA mira la imagen de cada escena y la de la siguiente, y escribe cómo se pasa de una a otra sin cortes.',
    hecho: 'Escritos todos los pasos entre escenas.',
  },
  videos: {
    haciendo: 'Generando los clips',
    detalle: 'Cada clip sale de sus imágenes. Si el modelo principal no puede, sale con el de respaldo.',
    hecho: 'Llegaron todos los clips.',
  },
  'revision-cadena': {
    haciendo: 'La IA revisa las uniones',
    detalle: 'Mira dónde termina cada clip y dónde empieza el siguiente. Si uno no llega bien, lo rehace una vez.',
    hecho: 'Uniones revisadas.',
  },

  // ---- los que hablan dentro del clip (objeto parlante, UGC, podcast y entrevista)
  'revision-clips': {
    haciendo: 'Revisando los clips y lo que dice cada personaje',
    detalle: 'Se escucha cada clip y se compara con su frase del guion; la IA mira también cómo se ve cada clip y cada B-roll. Lo que no sale bien se rehace solo.',
    hecho: 'Clips revisados: cada personaje dice su frase.',
  },
  persona: {
    haciendo: 'Creando la imagen de la persona',
    detalle: 'Es la persona que habla a cámara en todo el anuncio.',
    hecho: 'Imagen de la persona lista.',
  },
  'revision-persona': {
    haciendo: 'La IA revisa a la persona',
    detalle: 'Antes de hacer los videos mira que la persona y tu producto estén bien. Si algo salió mal, la rehace una vez.',
    hecho: 'Persona revisada.',
  },
  bloques: {
    haciendo: 'Generando los videos de la persona hablando',
    detalle: 'Cada bloque es la persona diciendo su parte del guion, con su voz.',
    hecho: 'Llegaron todos los bloques.',
  },
  'revision-bloques': {
    haciendo: 'Revisando cada bloque',
    detalle: 'Se escucha cada bloque y se compara con el guion; la IA mira la cara y el producto. Lo que no sale limpio se rehace solo.',
    hecho: 'Bloques revisados.',
  },
  ganchos: {
    haciendo: 'Armando las versiones con otro gancho',
    detalle: 'El mismo anuncio con otro arranque, para probar en tus campañas cuál vende más.',
    hecho: 'Versiones con otro gancho listas.',
  },
  'revision-habla': {
    haciendo: 'Revisando cada clip',
    detalle: 'Se escucha cada clip y se compara con su frase; la IA mira también cómo se ve cada clip y cada B-roll. Lo que no sale bien se rehace solo.',
    hecho: 'Clips revisados: cada uno dice su frase.',
  },
  'voz-historia': {
    haciendo: 'Preparando la voz de la historia',
    detalle: 'Se recorta la voz de la persona para la parte en que cuenta su historia.',
    hecho: 'Voz de la historia lista.',
  },
  'recorte-host': {
    haciendo: 'Recortando al anfitrión',
    detalle: 'Tu PC recorta al anfitrión para ponerlo en la esquina. Es lo que más tarda y va solo, sin nada al lado.',
    hecho: 'Anfitrión recortado.',
  },

  // ---- los cantados (musical e historia musical)
  letra: {
    haciendo: 'Preparando la letra',
    detalle: 'Se revisa la letra que aprobaste, con cada tilde, antes de pedir la canción. Esto no gasta nada.',
    hecho: 'Letra lista para cantar.',
  },
  'saldo-cancion': {
    haciendo: 'Mirando tu saldo para la canción',
    detalle: 'Antes de pedir la canción, la app comprueba que te alcance.',
    hecho: 'Tu saldo alcanza para la canción.',
  },
  cancion: {
    haciendo: 'Componiendo tu canción',
    detalle: 'Suno canta tu letra en varias versiones, para que elijas la que más te guste.',
    hecho: 'Versiones de la canción listas.',
  },
  'elegir-cancion': {
    haciendo: 'Te toca elegir la canción',
    detalle: 'Escucha las versiones y quédate con una: es lo único que espera. Después sigue sola.',
    hecho: 'Canción elegida.',
  },
  tomas: {
    haciendo: 'Escribiendo las escenas sobre la canción',
    detalle: 'La IA escribe una escena por cada parte de la canción, sobre sus tiempos reales.',
    hecho: 'Escenas escritas.',
  },
  tiempos: {
    haciendo: 'Midiendo cada escena en la canción',
    detalle: 'Cada escena dura lo que dura su parte de la canción.',
    hecho: 'Cada escena quedó a la medida de la canción.',
  },
};

/** Las etapas que se ven en la línea de la producción: cada una junta uno o más pasos del conductor. */
export const ETAPAS_VOZ_EN_OFF = [
  { id: 'preparar', nombre: 'Preparación', icono: 'ClipboardCheck', pasos: ['validar', 'saldo'] },
  { id: 'voz', nombre: 'Voz', icono: 'Mic', pasos: ['voz', 'ventanas'] },
  { id: 'piezas', nombre: 'Imágenes y videos', icono: 'Images', pasos: ['imagenes-y-videos'] },
  { id: 'revision', nombre: 'Revisión', icono: 'ScanEye', pasos: ['revision-imagenes', 'voces'] },
  { id: 'musica', nombre: 'Música', icono: 'Music', pasos: ['musica'] },
  { id: 'montaje', nombre: 'Montaje', icono: 'Scissors', pasos: ['montaje'] },
  { id: 'render', nombre: 'Render', icono: 'Clapperboard', pasos: ['render'] },
  { id: 'control', nombre: 'Control final', icono: 'ShieldCheck', pasos: ['control-final', 'informe'] },
];

const PREPARAR = { id: 'preparar', nombre: 'Preparación', icono: 'ClipboardCheck', pasos: ['validar', 'saldo'] };
const MUSICA = { id: 'musica', nombre: 'Música', icono: 'Music', pasos: ['musica'] };
const MONTAJE = { id: 'montaje', nombre: 'Montaje', icono: 'Scissors', pasos: ['montaje'] };
const RENDER = { id: 'render', nombre: 'Render', icono: 'Clapperboard', pasos: ['render'] };
const CONTROL = { id: 'control', nombre: 'Control final', icono: 'ShieldCheck', pasos: ['control-final', 'informe'] };

/** Las etapas de cada familia (conductor.familia). La que no está aquí usa las de voz en off. */
export const ETAPAS_POR_FAMILIA = {
  'voz-en-off': ETAPAS_VOZ_EN_OFF,
  continuidad: [
    { ...PREPARAR, pasos: ['validar', 'preparar-cadena', 'saldo'] },
    { id: 'voz', nombre: 'Voz', icono: 'Mic', pasos: ['voz'] },
    { id: 'imagenes', nombre: 'Imágenes', icono: 'Images', pasos: ['imagenes', 'revision-imagenes'] },
    { id: 'pasos', nombre: 'Pasos entre escenas', icono: 'Link2', pasos: ['duraciones', 'pares'] },
    { id: 'videos', nombre: 'Videos', icono: 'Film', pasos: ['videos', 'revision-cadena', 'voces'] },
    MUSICA,
    MONTAJE,
    RENDER,
    CONTROL,
  ],
  'objeto-parlante': [
    PREPARAR,
    { id: 'piezas', nombre: 'Imágenes y videos', icono: 'Images', pasos: ['imagenes-y-videos'] },
    { id: 'revision', nombre: 'Revisión', icono: 'ScanEye', pasos: ['revision-clips', 'voces'] },
    MUSICA,
    MONTAJE,
    RENDER,
    CONTROL,
  ],
  ugc: [
    PREPARAR,
    { id: 'persona', nombre: 'Persona', icono: 'UserRound', pasos: ['persona', 'revision-persona'] },
    { id: 'bloques', nombre: 'Bloques', icono: 'Film', pasos: ['bloques', 'revision-bloques'] },
    MUSICA,
    MONTAJE,
    RENDER,
    { ...CONTROL, pasos: ['control-final'] },
    { id: 'ganchos', nombre: 'Otros ganchos', icono: 'Shuffle', pasos: ['ganchos', 'informe'] },
  ],
  hablado: [
    PREPARAR,
    { id: 'imagenes', nombre: 'Imágenes', icono: 'Images', pasos: ['imagenes', 'revision-imagenes'] },
    { id: 'videos', nombre: 'Clips', icono: 'Film', pasos: ['videos', 'revision-habla'] },
    { ...MONTAJE, pasos: ['voz-historia', 'montaje', 'recorte-host'] },
    RENDER,
    CONTROL,
  ],
  musical: [
    { id: 'cancion', nombre: 'Canción', icono: 'Music', pasos: ['letra', 'saldo-cancion', 'cancion', 'elegir-cancion'] },
    { id: 'escenas', nombre: 'Escenas', icono: 'PenLine', pasos: ['tomas', 'tiempos', 'ventanas'] },
    { id: 'piezas', nombre: 'Imágenes y videos', icono: 'Images', pasos: ['saldo', 'imagenes-y-videos'] },
    { id: 'revision', nombre: 'Revisión', icono: 'ScanEye', pasos: ['revision-imagenes', 'voces'] },
    MONTAJE,
    RENDER,
    CONTROL,
  ],
};
ETAPAS_POR_FAMILIA['historia-musical'] = ETAPAS_POR_FAMILIA.musical;

/** Las etapas de la familia de este conductor. */
export const etapasDeFamilia = (familia) => ETAPAS_POR_FAMILIA[familia] || ETAPAS_VOZ_EN_OFF;

const HECHO = new Set(['hecho', 'saltado']);

/** El paso en el que va el conductor (o el que falló). */
export function pasoActual(c) {
  if (!c?.pasos?.length) return null;
  return c.pasos.find((p) => p.id === c.paso) || c.pasos.find((p) => p.estado === 'error') || c.pasos.find((p) => p.estado === 'corriendo') || null;
}

/** Lo que dice el paso para el usuario: { haciendo, detalle, hecho }. */
export function textoDePaso(p) {
  if (!p) return { haciendo: 'Preparando tu anuncio', detalle: 'Arranca en un momento.', hecho: 'Listo.' };
  const nombre = p.nombre || 'Un paso';
  let t = PASOS[p.id] || { haciendo: nombre, detalle: 'No tienes que hacer nada: sigue solo.', hecho: `${nombre}: listo.` };
  // ya elegiste (o pediste otras versiones): lo que se está haciendo con tu canción, no el texto de la pausa
  if (p.id === 'elegir-cancion' && p.estado === 'corriendo') {
    t = { ...t, haciendo: p.detalle || 'Preparando tu canción', detalle: 'Con lo que elegiste. No tienes que hacer nada: sigue sola.' };
  }
  // esperando su lugar en una fila que comparte con otros anuncios (el armado final, ElevenLabs)
  const turno = p.estado === 'corriendo' ? TEXTO_TURNO[p.turno?.recurso] : null;
  return turno ? { ...t, detalle: turno } : t;
}

/** Lo que se dice mientras un paso espera su lugar en una fila compartida con otros anuncios. */
const TEXTO_TURNO = {
  pesada: 'Espera su turno: tu PC está armando el video de otro anuncio. Sigue solo apenas termine.',
  elevenlabs: 'Espera su turno con ElevenLabs, que está con otro de tus anuncios. Sigue solo en un momento.',
};

/**
 * Por qué está frenado el anuncio (o null si no lo está):
 *   saldo     el saldo de kie no alcanza: hay que recargar y tocar "Continuar"
 *   error     un paso falló (con su mensaje en palabras simples): "Continuar" lo reintenta
 *   pausa     en pausa por otra razón: "Continuar"
 *   conexion  se fue internet: se reintenta solo al volver (o con "Continuar")
 *   reintento el servicio (kie, ElevenLabs) falló: se reintenta solo a una hora (o con "Continuar"). No es tu internet
 *   cancion   los cantados: la canción está lista y espera que elijas la versión (la única pausa de su producción)
 */
export function altoDe(c) {
  if (!c?.pasos) return null;
  const paso = pasoActual(c);
  const mensaje = paso?.error?.mensaje || c.error?.mensaje || null;
  if (esperaLaCancion(c)) return { tipo: 'cancion', paso, mensaje: null };
  const esSaldo = c.motivo === 'saldo' || paso?.error?.motivo === 'saldo' || /saldo|recarg/i.test(mensaje || '');
  // (frenado en el paso del saldo es falta de saldo, salvo que lo hayas detenido tú)
  const enElSaldo = c.motivo !== 'detenido' && (paso?.id === 'saldo' || paso?.id === 'saldo-cancion');
  if (c.estado === 'pausado') return { tipo: esSaldo || enElSaldo ? 'saldo' : 'pausa', paso, mensaje };
  if (c.estado === 'error') return { tipo: esSaldo ? 'saldo' : 'error', paso, mensaje };
  // "Esperando la conexión" solo si de verdad se fue internet: un error de kie no es culpa de tu wifi
  if (c.estado === 'esperando' && mensaje) return { tipo: paso?.error?.motivo === 'conexion' ? 'conexion' : 'reintento', paso, mensaje };
  return null;
}

/**
 * El primer paso se frenó por el guion (o la letra) aprobado, antes de gastar nada: se arregla pidiendo el cambio en
 * la pantalla del guion y aprobándolo otra vez ("Continuar" volvería a frenar igual).
 */
export const frenoPorElGuion = (alto) => alto?.tipo === 'error' && alto.paso?.error?.motivo === 'guion' && ['validar', 'letra'].includes(alto.paso?.id);
export const TEXTO_GUION = 'Lo apruebas otra vez y sigue desde aquí: todavía no se gastó nada.';

/**
 * Un cantado (musical, historia musical) antes de que se escriban sus escenas todavía no tiene manifiesto: su detalle
 * (GET /api/anuncios/:slug) no existe y pedirlo da 404. Con el conductor: hasta que el paso "tomas" esté hecho. Sin él,
 * lo dice la lista (`a`, de useAnuncios): trae `piezas` recién cuando hay manifiesto.
 */
export function sinEscenasAun(a, c = null) {
  if (!['musical', 'historia-musical'].includes(c?.familia || a?.produccion)) return false;
  if (c?.pasos?.length) return !c.pasos.some((p) => p.id === 'tomas' && HECHO.has(p.estado));
  return !a?.piezas;
}

/** ¿La producción espera que elijas la canción? (cantados: conductor "pausado" en el paso "elegir-cancion") */
export const esperaLaCancion = (c) => Boolean(c && c.estado === 'pausado' && c.paso === 'elegir-cancion');

/** Frenado pero sigue solo (sin internet, o reintentando un servicio que falló): no te necesita. */
export const esperaSola = (alto) => alto?.tipo === 'conexion' || alto?.tipo === 'reintento';

/**
 * Por qué espera en la fila (o null si no espera a otro). La app hace a la vez los que diga Ajustes › Tu PC:
 *   "Empieza cuando termine «Matcha Calma»: haces un anuncio a la vez."
 *   "Empieza apenas termine uno de los 3 que se están haciendo."
 *   "Hay 2 antes que este: empieza cuando se libere un lugar (se hacen 3 a la vez)."
 */
export function textoDeFila(c) {
  const f = c?.fila;
  const antes = Array.isArray(f?.antes) ? f.antes : [];
  if (!antes.length) return null;
  const aLaVez = Number(f.aLaVez) || 1;
  const delante = Number.isFinite(Number(f.delante)) ? Number(f.delante) : Math.max(0, antes.length - aLaVez);
  if (aLaVez <= 1) {
    const quien = antes.length === 1 ? `termine «${antes[0]}»` : `terminen «${antes[0]}» y ${antes.length - 1 === 1 ? 'otro' : `otros ${antes.length - 1}`}`;
    return `Empieza cuando ${quien}: haces un anuncio a la vez (lo cambias en Ajustes, Tu PC).`;
  }
  const enMarcha = Number(f.enMarcha) || aLaVez;
  if (!delante) return enMarcha === 1 ? `Empieza apenas termine «${antes[0]}».` : `Empieza apenas termine uno de los ${enMarcha} que se están haciendo.`;
  return `${delante === 1 ? 'Hay 1 antes que este' : `Hay ${delante} antes que este`}: empieza cuando se libere un lugar (se hacen ${aLaVez} a la vez).`;
}

/** Las frases fijas de cada tipo de alto (sin números: nunca se muestra el saldo). */
export const TEXTO_ALTO = {
  saldo: { titulo: 'Tu saldo de kie no alcanza: recarga para seguir', texto: 'Cuando recargues, toca “Continuar”. Lo que ya está hecho no se vuelve a pagar.' },
  error: { titulo: 'Algo se trabó', texto: 'Toca “Continuar” para reintentarlo. Lo que ya está hecho no se vuelve a pagar.' },
  pausa: { titulo: 'La producción está en pausa', texto: 'Toca “Continuar” para seguir desde donde quedó.' },
  conexion: { titulo: 'Esperando la conexión', texto: 'Apenas vuelva internet sigue sola desde donde quedó.' },
  reintento: { titulo: 'Reintentando sola', texto: 'Es un problema del servicio, no tuyo ni de tu internet: no tienes que tocar nada.' },
  cancion: { titulo: 'Elige la versión de tu canción', texto: 'Escúchalas y quédate con una: es lo único que espera. Después sigue sola.' },
};

// ---------------------------------------------------------------- etapas, avance y tiempo

/**
 * La línea de etapas de un conductor, en el orden de sus pasos. Cada etapa: { id, nombre, icono,
 * pasos: [paso del conductor], estado: 'hecha' | 'en-marcha' | 'error' | 'pendiente' }.
 * Un paso que no está en ETAPAS_VOZ_EN_OFF va como su propia etapa, con su nombre.
 */
export function etapasDeConductor(c) {
  if (!c?.pasos?.length) return [];
  const etapas = [];
  const porId = new Map();
  const deLaFamilia = etapasDeFamilia(c.familia);
  for (const p of c.pasos) {
    const base = deLaFamilia.find((e) => e.pasos.includes(p.id)) || { id: `paso-${p.id}`, nombre: p.nombre || p.id, icono: 'Sparkles' };
    if (!porId.has(base.id)) {
      const e = { id: base.id, nombre: base.nombre, icono: base.icono, pasos: [] };
      porId.set(base.id, e);
      etapas.push(e);
    }
    porId.get(base.id).pasos.push(p);
  }
  const anda = c.estado === 'corriendo' || c.estado === 'esperando';
  // esperando su turno (ningun paso en marcha ni esperando un reintento): ninguna etapa esta "en marcha"
  const enFila = c.estado === 'esperando' && !c.pasos.some((p) => p.estado === 'corriendo' || p.error);
  for (const e of etapas) {
    const es = e.pasos.map((p) => p.estado);
    if (es.includes('error')) e.estado = 'error';
    else if (es.every((x) => HECHO.has(x))) e.estado = 'hecha';
    else if (enFila) e.estado = 'pendiente';
    else if (es.includes('corriendo') || (es.some((x) => HECHO.has(x)) && (anda || c.estado === 'pausado'))) e.estado = 'en-marcha';
    else e.estado = e.pasos.some((p) => p.id === c.paso) && c.estado !== 'listo' ? 'en-marcha' : 'pendiente';
    e.saltada = es.every((x) => x === 'saltado');
  }
  return etapas;
}

/** Qué parte de las imágenes y los clips ya está, con la lista de anuncios ({ piezas }) o el modelo de la producción. */
export function fraccionDePiezas(a) {
  const pz = a?.piezas;
  if (!pz) return 0;
  const total = (pz.imagenes?.total || 0) + (pz.clips?.total || 0);
  return total ? Math.min(1, ((pz.imagenes?.hechas || 0) + (pz.clips?.hechos || 0)) / total) : 0;
}

// Cuánto pesa cada paso en la barra de avance y cuánto suele tardar (segundos). Las imágenes y los
// videos se miden con las piezas que ya llegaron.
const PESO = {
  validar: 1, saldo: 1, voz: 5, ventanas: 1, 'imagenes-y-videos': 52, 'revision-imagenes': 6, voces: 3, musica: 5, montaje: 6, render: 8, 'control-final': 2, informe: 2,
  // continuidad
  'preparar-cadena': 1, imagenes: 18, duraciones: 1, pares: 6, videos: 34, 'revision-cadena': 6,
  // los que hablan dentro del clip
  'revision-clips': 8, persona: 4, 'revision-persona': 2, bloques: 40, 'revision-bloques': 8, ganchos: 10, 'revision-habla': 8, 'voz-historia': 2, 'recorte-host': 20,
  // los cantados
  letra: 1, 'saldo-cancion': 1, cancion: 6, 'elegir-cancion': 1, tomas: 6, tiempos: 1,
};
const SEGUNDOS = {
  validar: 5, saldo: 5, voz: 45, ventanas: 5, 'imagenes-y-videos': 480, 'revision-imagenes': 180, voces: 90, musica: 120, montaje: 60, render: 300, 'control-final': 40, informe: 5,
  'preparar-cadena': 10, imagenes: 240, duraciones: 10, pares: 240, videos: 420, 'revision-cadena': 180,
  'revision-clips': 240, persona: 90, 'revision-persona': 60, bloques: 420, 'revision-bloques': 240, ganchos: 600, 'revision-habla': 240, 'voz-historia': 30, 'recorte-host': 3600,
  letra: 10, 'saldo-cancion': 5, cancion: 180, 'elegir-cancion': 0, tomas: 300, tiempos: 10,
};
// Lo que tarda distinto en una familia: el podcast renderiza de a un cuadro, la historia dura minutos y el UGC arma
// también sus ganchos. Medido en las pruebas del 2026-10-25 (con la PC cargada, más) con dos renders por anuncio;
// desde el 2026-10-26 la app renderiza solo la versión completa (un render: la mitad) y el control final mide solo
// esa (las otras salen del editor).
const SEGUNDOS_DE_FAMILIA = {
  hablado: { render: 1200, 'control-final': 50 },
  'historia-musical': { render: 1800, 'control-final': 100, tomas: 600 },
  musical: { render: 450 },
  ugc: { ganchos: 900 },
};

/** Los pasos que van midiendo las piezas que ya llegaron (la barra avanza con ellas). */
const DE_PIEZAS = new Set(['imagenes-y-videos', 'videos', 'bloques']);

/** 0..1: el avance del anuncio según su conductor. Sin terminar nunca llega al 100 %. */
export function avanceDeConductor(c, fraccion = 0) {
  if (!c?.pasos?.length) return 0;
  if (c.estado === 'listo') return 1;
  let total = 0;
  let hecho = 0;
  for (const p of c.pasos) {
    const w = PESO[p.id] ?? 3;
    total += w;
    if (HECHO.has(p.estado)) hecho += w;
    else if (DE_PIEZAS.has(p.id) && p.estado !== 'pendiente') hecho += w * Math.max(0, Math.min(1, fraccion));
    else if (p.estado === 'corriendo') hecho += w * 0.35;
  }
  return total ? Math.min(0.99, hecho / total) : 0;
}

/**
 * Segundos que faltan, estimados con lo que suele tardar cada paso. `faltan` = piezas que todavía no
 * llegaron ({ imagenes, clips }); 10 a la vez, como el motor.
 */
export function faltaDeConductor(c, faltan = null) {
  if (!c?.pasos?.length || c.estado === 'listo') return 0;
  const piezas = faltan ? Math.max(60, Math.ceil((faltan.imagenes || 0) / 10) * 90 + Math.ceil((faltan.clips || 0) / 10) * 80) : null;
  let s = 0;
  for (const p of c.pasos) {
    if (HECHO.has(p.estado)) continue;
    // exportando: lo que dice Remotion que le falta (y los renders que le siguen), no un número fijo
    const r = p.estado === 'corriendo' ? p.render : null;
    if (r && Number.isFinite(r.restante) && Date.now() - Date.parse(r.en) < 120000) {
      const porCuadro = r.total > r.hechos ? r.restante / (r.total - r.hechos) : 0;
      s += r.restante + Math.max(0, (r.renders || 1) - (r.n || 1)) * porCuadro * (r.total || 0);
      continue;
    }
    let d = DE_PIEZAS.has(p.id) && piezas !== null ? piezas : (SEGUNDOS_DE_FAMILIA[c.familia]?.[p.id] ?? SEGUNDOS[p.id] ?? 30);
    if (p.estado === 'corriendo' && !DE_PIEZAS.has(p.id) && p.inicio) {
      const pasaron = (Date.now() - Date.parse(p.inicio)) / 1000;
      if (Number.isFinite(pasaron)) d = Math.max(15, d - pasaron);
    }
    s += d;
  }
  return s;
}

/** El nombre de la etapa en la que va, el mismo de la línea de la producción ("Revisión", "Render"…). */
export function nombreDeEtapa(c) {
  const p = pasoActual(c);
  if (!p) return null;
  return etapasDeFamilia(c.familia).find((e) => e.pasos.includes(p.id))?.nombre || p.nombre || null;
}

/**
 * Lo que tardaría la producción entera, antes de aprobar el guion: la misma cuenta que hace la pantalla de
 * producción al arrancar (así "unos N min" y "≈ N min" coinciden). piezas = { imagenes, clips } del manifiesto.
 */
export function estimadoAntesDeProducir(piezas, familia = 'voz-en-off') {
  const pasos = etapasDeFamilia(familia)
    .flatMap((e) => e.pasos)
    .filter((id) => id !== 'recorte-host' && id !== 'voz-historia') // solo en algunos anuncios de la familia
    .map((id) => ({ id, estado: 'pendiente' }));
  return faltaDeConductor({ pasos, estado: 'esperando' }, piezas || null);
}

/** Con qué familia se produce un estilo (la misma cuenta que el servidor; continuidad solo en los de narrador). */
const FAMILIA_DE_ESTILO = {
  claymation: 'voz-en-off', crochet: 'voz-en-off', 'zack-d-films': 'voz-en-off', 'estilo-pixar': 'voz-en-off', skeleton: 'voz-en-off', 'estilo-lego': 'voz-en-off',
  'talking-object-pixar': 'objeto-parlante', ugc: 'ugc', podcast: 'hablado', entrevista: 'hablado', musical: 'musical', 'historias-musicales': 'historia-musical',
};
export const familiaDeEstilo = (clave, continuidad = false) => (continuidad && FAMILIA_DE_ESTILO[clave] === 'voz-en-off' ? 'continuidad' : FAMILIA_DE_ESTILO[clave] || 'voz-en-off');

/** En qué va, en las palabras cortas del menú lateral ('voz', 'imagenes', 'videos', 'revision' o 'montaje'). */
function etapaCorta(c, a) {
  const p = pasoActual(c);
  if (!p) return a?.etapa || 'guion';
  if (p.id === 'imagenes-y-videos') {
    const img = a?.piezas?.imagenes;
    return img && img.total && img.hechas >= img.total ? 'videos' : 'imagenes';
  }
  if (['imagenes', 'persona'].includes(p.id)) return 'imagenes';
  if (['videos', 'bloques', 'pares', 'duraciones'].includes(p.id)) return 'videos';
  if (/^revision/.test(p.id)) return 'revision';
  if (['voces', 'musica', 'montaje', 'voz-historia', 'recorte-host', 'render', 'control-final', 'ganchos', 'informe'].includes(p.id)) return 'montaje';
  return 'voz';
}

// ---------------------------------------------------------------- actividad (GET /api/tablero)

/** { actividad: { [slug]: { ultima, activo } } }: si nada cambió en 15 min, el anuncio quedó a medio camino. */
export const useActividad = (opciones) => useDatos('tablero', () => pedirJSON('/api/tablero'), opciones);

// Los estados de la lista de anuncios que tienen conductor (los de la app). 'en-produccion' es el de las
// carpetas hechas desde la terminal: esas no tienen conductor.
const CON_CONDUCTOR = new Set(['produciendo', 'error', 'pausado', 'esperando']);
export const tieneConductor = (a) => CON_CONDUCTOR.has(a?.estado);

/**
 * Ver el comentario de arriba. `cadaMs` vuelve a mirar el disco cada tanto (el menú: 15 s; el tablero: 5 s);
 * sin `cadaMs` (la barra de arriba) mira cada 15 s, así la píldora no se queda con un número viejo.
 * Los conductores se miran más seguido (5 a 10 s): son archivos chicos.
 */
export function useEnProduccion({ cadaMs } = {}) {
  const ms = cadaMs || 15000;
  const { datos, cargando } = useAnuncios({ cadaMs: ms });
  const { datos: tablero } = useActividad({ cadaMs: ms });
  const anuncios = datos?.anuncios || [];
  // (los que siguen en el paso del guion no se producen todavía: van como "Tu guion está listo" o con su error)
  const deLaApp = anuncios.filter((a) => tieneConductor(a) && !a.enGuion);
  const guiones = anuncios.filter((a) => a.enGuion && (a.teNecesita || a.estado === 'error'));
  const { datos: conductores } = useConductores(
    deLaApp.map((a) => a.slug),
    { cadaMs: cadaMs ? Math.min(cadaMs, 5000) : 10000 }
  );
  const actividad = tablero?.actividad || null;

  const activos = [];
  const necesitan = [];
  for (const a of deLaApp) {
    const c = conductores ? conductores[a.slug] || null : null;
    // mientras no llegaron los conductores no se inventa un estado (nada de "0 % · Voz" de uno que va por el render)
    const sinLeer = !conductores;
    if (c?.estado === 'listo') continue; // la lista se pone al día sola en unos segundos
    // mientras llega su conductor, uno que la lista ya marca con error va a "Te necesitan"
    const alto = c ? altoDe(c) : a.estado === 'error' ? { tipo: 'error', paso: null, mensaje: null } : null;
    if (alto && !esperaSola(alto)) {
      necesitan.push({ anuncio: a, conductor: c, alto });
      continue;
    }
    // recién aprobado (todavía sin conductor) o andando: en producción
    activos.push({
      ...a,
      conductor: c,
      alto,
      avance: c ? avanceDeConductor(c, fraccionDePiezas(a)) : sinLeer ? null : 0,
      etapa: c ? etapaCorta(c, a) : null,
      etapaNombre: c ? (c.estado === 'esperando' && !alto ? 'En la fila' : nombreDeEtapa(c)) : null,
      sinLeer,
    });
  }
  // los que se producen desde la terminal: activos si algo cambió hace poco
  const viejos = anuncios.filter((a) => a.estado === 'en-produccion');
  // mientras no se sabe la actividad, nada se muestra como activo (mejor "a medio camino" que un punto vivo falso)
  const viejosActivos = actividad ? viejos.filter((a) => actividad[a.slug]?.activo) : [];
  // los borradores viejos quietos ya no llegan (el servidor no los lista); mientras no se sabe la actividad, nada
  const pausados = actividad ? viejos.filter((a) => !viejosActivos.includes(a)) : [];
  activos.push(...viejosActivos.map((a) => ({ ...a, conductor: null, alto: null })));
  // lo que te necesita, en el mismo orden en el tablero y en el menú: lo frenado en la producción (falta de saldo y
  // errores) antes que los guiones, y en cada grupo el más reciente primero
  const urgencia = (n) => (n.alto.tipo === 'saldo' ? 0 : n.alto.tipo === 'error' ? 1 : 2);
  const fechaDe = (x) => Date.parse(x) || 0;
  necesitan.sort((x, y) => urgencia(x) - urgencia(y) || fechaDe(y.conductor?.actualizado || y.anuncio.fecha) - fechaDe(x.conductor?.actualizado || x.anuncio.fecha));
  guiones.sort((x, y) => fechaDe(y.fecha) - fechaDe(x.fecha));

  return {
    cargando: cargando || !datos,
    anuncios,
    actividad,
    conductores: conductores || {},
    activos,
    necesitan,
    guiones,
    pausados,
    ejemplos: [],
    esEjemplo: false,
    cantidad: activos.length,
    modoPrueba: Object.values(conductores || {}).some((c) => c?.modoPrueba && c.estado !== 'listo'),
  };
}
