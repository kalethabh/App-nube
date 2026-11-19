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
import { asegurarVoz, faltaVoz } from './voz-auto.js';
import * as configApp from './config.js';
import { sesionActiva, prohibidasComunes, enTerminales, textoClaude, leerYValidar, matar } from './claude.js';
// la IA elegida (Claude o ChatGPT) con la pausa compartida: si su plan se acabo, no se abre otra sesion hasta que se
// renueve
import { lanzarSesion } from './colas.js';
import { nombreIA, lanzarSesion as preguntarIA, prohibidasComunes as prohibidasIA } from './motor-ia.js';
import { prohibidasDeAnuncio } from './ia/reglas.js';
import { ErrorApp, escribirJSON, aKebab, idValido as productoValido, leerProducto, leerFicha, fotoPrincipal, relProducto, detalleDelProducto, errorPublico, urlFoto } from './productos.js';
import { slugValido } from './anuncios.js';
import { ESTILOS as PRESENTACION } from './estilos.js';
import { brollDe } from './broll.js';
import { subestilosDe, idDeSubestilo } from './subestilos.js';
import { textoParaClaude as textoAprendizajes, textoAhorro } from './aprendizajes.js';
import { audioPorId, avatarPorId, carpetaDeEstilo, prepararAvatar, prepararMusica } from './biblioteca.js';
import { prepararReferencia, referenciaPedida, textoClonar } from './clonar.js';
import { textoEstructuras, textoInvestigacion, textoTendencias } from './estructuras.js';
import { conDuracion, entenderDuracion, leerDuracion, duracionAprox, segundosPedidos } from './duracion.js';
import { copiarModelosAlAnuncio, modeloDeLaPieza, nombreDeModelo } from './modelos.js';
import { copiarAlAnuncio as copiarMaterial, textoMaterial } from './material-propio.js';

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
  // Agregar: el video del usuario manda. `familia` queda en 'agregar' hasta que la IA mira el video y escribe el
  // manifiesto: ahi la app sabe si se produce como UGC (alguien habla a camara) o con voz en off (familiaDelAnuncio).
  // Lleva la voz del narrador por si sale con voz en off (si sale UGC, la voz la hace el video).
  agregar: { skill: 'anuncios-agregar', nombre: 'Agregar', familia: 'agregar', faseGuion: 'guion', transiciones: true, narrador: true, sinContinuidad: true, segunReferencia: true },
};
/** Las skills que sigue «Agregar» segun el formato del video (la de UGC, o la de realista con narrador y su base Pixar). */
const SKILLS_DE_AGREGAR = ['anuncios-ugc', 'anuncios-realista-narrado', 'anuncios-estilo-pixar'];
/** Las familias con las que se puede producir un anuncio «Agregar». */
export const FAMILIAS_DE_AGREGAR = ['ugc', 'voz-en-off'];
/** El nombre de la etapa 1 (cuando solo estaba claymation). */
export const ESTILOS_ACTIVOS = ESTILOS;
/** Los 6 de voz en off: los unicos donde se puede pedir continuidad. */
export const CON_CONTINUIDAD = Object.keys(ESTILOS).filter((k) => ESTILOS[k].narrador && !ESTILOS[k].sinContinuidad);

/**
 * La familia que produce este anuncio: la del estilo, o "continuidad" si la pidio en uno de voz en off. En «Agregar», la
 * que salio del video (brief.produccion: 'ugc' | 'voz-en-off'), o null mientras la IA todavia no lo miro.
 */
export function familiaDe(brief) {
  const def = ESTILOS[brief?.estilo];
  if (!def) return null;
  if (def.segunReferencia) return FAMILIAS_DE_AGREGAR.includes(brief.produccion) ? brief.produccion : null;
  return brief.continuidad && def.narrador && !def.sinContinuidad ? 'continuidad' : def.familia;
}

/**
 * «Agregar»: el plan que escribio la IA al mirar el video y leer el pedido (temp/<slug>/app/plan.json). Revisa que se
 * pueda seguir: el estilo existe, lo obligatorio de ese estilo esta, la duracion se entiende. { plan } o { errores }.
 */
export function revisarPlanDeAgregar(slug) {
  const ruta = path.join(appDe(slug), 'plan.json');
  const p = leerJSON(ruta);
  if (!p || typeof p !== 'object') return { errores: [`Falta temp/${slug}/app/plan.json (o no es JSON válido): escríbelo antes que nada, con el formato de la tarea.`] };
  const errores = [];
  const estilo = String(p.estilo || '');
  if (!ESTILOS[estilo]) errores.push(`plan.json → "estilo" tiene que ser "agregar" (el look del video) o uno de: ${Object.keys(ESTILOS).filter((k) => k !== 'agregar').join(', ')}.`);
  if (p.respuestas !== undefined && (typeof p.respuestas !== 'object' || Array.isArray(p.respuestas) || p.respuestas === null)) errores.push('plan.json → "respuestas" es un objeto { "<id de la pregunta>": "<respuesta>" }.');
  if (ESTILOS[estilo] && estilo !== 'agregar') {
    for (const [id, a] of Object.entries(AJUSTES[estilo] || {})) {
      if (a.falta && id !== 'clonar' && !(typeof p.respuestas?.[id] === 'string' && p.respuestas[id].trim())) errores.push(`plan.json → "respuestas.${id}" es obligatorio en ${ESTILOS[estilo].nombre}: ${a.falta}`);
    }
  }
  if (p.duracion !== undefined && p.duracion !== null && p.duracion !== '') {
    if (!entenderDuracion(String(p.duracion)).ok) errores.push(`plan.json → "duracion" no se entiende (${JSON.stringify(p.duracion)}): escríbela como "1:30", "90 s" o "2 minutos", o null para la del video.`);
  }
  if (!String(p.resumen || '').trim()) errores.push('plan.json → falta "resumen": una o dos frases de lo que vas a hacer.');
  if (!Array.isArray(p.conserva) || !p.conserva.length) errores.push('plan.json → falta "conserva": lo que se mantiene del original (estructura, gancho, ángulo, objeciones, frases clave).');
  return errores.length ? { errores } : { plan: p };
}

/** El plan como lo ve el usuario (y la IA del estilo destino): corto y sin rutas. */
function planParaMostrar(p, brief) {
  const corto = (x, n = 300) => String(x ?? '').trim().slice(0, n);
  return {
    estilo: p.estilo,
    estiloNombre: p.estilo === 'agregar' ? 'El mismo look de tu video' : ESTILOS[p.estilo]?.nombre || p.estilo,
    ...(p.estilo === 'agregar' && FAMILIAS_DE_AGREGAR.includes(p.formato) ? { formato: p.formato === 'ugc' ? 'Una persona habla a cámara' : 'Una voz cuenta sobre escenas' } : {}),
    duracion: p.duracion ? corto(p.duracion, 40) : null,
    idioma: p.idioma ? corto(p.idioma, 20) : null,
    resumen: corto(p.resumen, 400),
    conserva: (Array.isArray(p.conserva) ? p.conserva : []).map((x) => corto(x, 200)).filter(Boolean).slice(0, 8),
    cambia: (Array.isArray(p.cambia) ? p.cambia : []).map((x) => corto(x, 200)).filter(Boolean).slice(0, 8),
    porque: p.porque ? corto(p.porque, 300) : null,
    pedido: String(brief?.respuestas?.pedido || '').trim().slice(0, 600) || null,
  };
}

/**
 * «Agregar» con otro estilo (el pedido dice "estilo Pixar", "musical"…): desde aca el anuncio ES de ese estilo, con su
 * skill, su guion (o su letra) y su produccion de siempre. El brief cambia de estilo y guarda en `agregar` el pedido y
 * el plan; la duracion y las respuestas del estilo salen del plan; el video sigue en `clonar` (ya analizado).
 */
function pasarAlEstiloDelPlan(slug, brief, plan) {
  const destino = plan.estilo;
  const def = ESTILOS[destino];
  const respuestas = {
    ...limpiarRespuestas(destino, plan.respuestas || {}),
    clonar: brief.respuestas?.clonar,
    clonar_gancho: brief.respuestas?.clonar_gancho || 'Sí, adáptalo a mi producto',
  };
  let duracion = null;
  try {
    duracion = duracionPedida(destino, plan.duracion || null);
  } catch {
    duracion = conDuracion(destino) ? { decide: 'ia' } : null;
  }
  const nuevo = {
    ...brief,
    estilo: destino,
    faseGuion: def.faseGuion,
    duracion,
    continuidad: false,
    voz: def.narrador ? brief.voz : brief.voz || null,
    respuestas,
    opciones: opcionesDe(destino, respuestas),
    agregar: { pedido: brief.respuestas?.pedido || null, desde: ahora(), plan: planParaMostrar(plan, brief) },
  };
  delete nuevo.produccion;
  nuevo.familia = familiaDe(nuevo);
  escribirJSON(path.join(appDe(slug), 'brief.json'), nuevo);
  copiarModelosAlAnuncio(slug);
  return nuevo;
}

/** La definicion del estilo para ESTE anuncio: en «Agregar», con la familia que salio del video (si ya se sabe). */
function defDe(brief) {
  const def = ESTILOS[brief?.estilo];
  if (!def?.segunReferencia) return def;
  return { ...def, familia: FAMILIAS_DE_AGREGAR.includes(brief.produccion) ? brief.produccion : 'agregar' };
}

/** Lo que se eligio en el formulario de «Agregar» sobre como esta hecho el video: 'ugc' | 'voz-en-off' | null (la IA). */
export function formatoPedidoDeAgregar(brief) {
  const t = String(brief?.respuestas?.formato || '');
  if (/habla a c[aá]mara|persona habla/i.test(t)) return 'ugc';
  if (/voz (en off|cuenta)|narrador|sobre escenas/i.test(t)) return 'voz-en-off';
  return null;
}

/**
 * «Agregar»: la familia que sale del manifiesto que escribio la IA. Bloques R -> 'ugc'; voz en off -> 'voz-en-off'.
 * { familia } o { error } (en palabras para la IA, que lo corrige).
 */
export function familiaDelManifiesto(m) {
  const tomas = Array.isArray(m?.tomas) ? m.tomas : [];
  if (tomas.some((t) => t?.tipo === 'R')) {
    if (!tomas.every((t) => t?.tipo === 'R')) return { error: 'manifiesto.json → en el formato UGC todas las tomas son bloques R (la persona habla a cámara): no mezcles bloques R con tomas A o B.' };
    return { familia: 'ugc' };
  }
  if (m?.modo_audio === 'voz_en_off') return { familia: 'voz-en-off' };
  return { error: 'manifiesto.json → «Agregar» se produce de dos formas: como UGC (bloques R, "modo_audio": "dialogo_nativo", la skill anuncios-ugc) o con voz en off ("modo_audio": "voz_en_off", tomas A/B y B-roll, el proceso de anuncios-realista-narrado). Este manifiesto no es ninguna de las dos.' };
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
  // «Agregar»: el video es obligatorio (va en `clonar`, como Clonar un video: un archivo subido o un link)
  agregar: {
    clonar: { falta: 'Sube tu video (o pega su link): «Agregar» se arma a partir de él.' },
    pedido: { dice: 'nada en especial: el mismo video para mi producto, con su mismo look' },
    formato: {},
    angulo: {},
    antes_despues: {},
    clonar_gancho: { dice: 'Sí, adáptalo a mi producto' },
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
  AJUSTES[clave].clonar ??= { dice: 'sin video de referencia' };
  AJUSTES[clave].clonar_gancho ??= { dice: 'Sí, adáptalo a mi producto' };
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

  // la voz del narrador: la que eligió el usuario o, si no eligió (o pidió «que la elija la app»), { auto: true }: la
  // elige la app después del guion, la más parecida a la del video de referencia o la más indicada (lib/voz-auto.js)
  let voz = null;
  if (def.narrador) {
    const pedida = datos.voz && typeof datos.voz === 'object' ? datos.voz : typeof datos.voz === 'string' ? { id: datos.voz } : null;
    voz = pedida && pedida.id !== 'auto' && ID_VOZ.test(String(pedida.id || '')) ? { id: String(pedida.id), nombre: String(pedida.nombre || pedida.id).slice(0, 80) } : { auto: true };
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
  // lo que pidió el usuario en el chat de la oficina (2026-11-19r): la idea o el ángulo, y si es una de varias versiones
  const pedido = typeof datos.pedido === 'string' ? datos.pedido.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
  const brief = { slug, productoId, estilo, familia: null, faseGuion: def.faseGuion, duracion, voz, continuidad, respuestas, opciones: opcionesDe(estilo, respuestas), ...(avatar ? { avatar } : {}), ...(musicaBiblioteca ? { musicaBiblioteca } : {}), ...(pedido ? { pedido } : {}), creado: ahora(), ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}) };
  brief.familia = familiaDe(brief);
  // tus videos e imágenes (opcional, 2026-11-19): se copian al anuncio antes del guion (lib/material-propio.js)
  if (Array.isArray(datos.material) && datos.material.length) {
    try {
      const material = copiarMaterial(slug, datos.material);
      if (material.length) brief.material = material.length;
    } catch (e) {
      console.warn(`[guion] ${slug}: no pude copiar tus archivos (${e.message})`);
    }
  }
  escribirJSON(path.join(appDe(slug), 'brief.json'), brief);
  // los modelos de IA que eligio en Ajustes › Modelos (el motor los lee de temp/<slug>/modelos.json)
  copiarModelosAlAnuncio(slug);
  // la proxima vez, este estilo sugiere la misma voz (solo si la eligió el usuario)
  if (voz?.id) {
    if (configApp.recordarVoz) configApp.recordarVoz(estilo, voz);
    else configApp.guardarConfig({ vozPorEstilo: { ...(configApp.leerConfig().vozPorEstilo || {}), [estilo]: voz } });
  }

  const sesion = { uuid: crypto.randomUUID(), estado: 'escribiendo', tipo: 'guion', intentos: 0, progreso: [], inicio: ahora(), cambios: [] };
  guardarSesion(slug, sesion);
  lanzar(slug, { tipo: 'guion' });
  return { slug };
}

// ---------------------------------------------------------------- RECREAR para otro producto (2026-11-19p)
// Pedido: «recrear el video para otro producto siguiendo el mismo guion tal cual, ya que queda muy bien para productos
// que son parecidos: adaptar "Estas son las gotas" por "Estas son las pastillas", el diseño del producto y demás, y
// adaptar las partes que no van con el producto nuevo». Un anuncio NUEVO con el mismo estilo, voz, ajustes y personas;
// la IA parte del manifiesto del original y cambia solo lo del producto. Las hojas de personas y lugares del original
// se copian (mismas caras, sin pagarlas otra vez). Después: el guion para aprobar y la producción de siempre.

/** Lo que la tarea del guion dice cuando el anuncio es una copia de otro para un producto nuevo. */
/** Lo que pidió el usuario en el chat de la oficina (brief.pedido), para el guion. */
function textoPedido(brief) {
  return brief?.pedido ? `## Lo que pidió el usuario para este anuncio\n\n«${brief.pedido}». Respétalo en el ángulo, el gancho y el guion.` : '';
}

/** Lo obligatorio de un estilo: [{ campo, texto }] (lo que la coordinadora pregunta antes de crear). */
export function AJUSTES_OBLIGATORIOS(estilo) {
  return Object.entries(AJUSTES[estilo] || {}).filter(([, p]) => p.falta).map(([campo, p]) => ({ campo, texto: p.falta }));
}

function textoRecrear(brief) {
  const o = brief?.recrearDe;
  if (!o || !slugValido(o)) return '';
  const viejo = leerFicha(leerBrief(o)?.productoId || '') || {};
  return [
    '## Recrear un anuncio que ya funcionó, para OTRO producto',
    '',
    `Este anuncio es una copia de \`temp/${o}/\` (ya producido${viejo.nombre ? `, para «${viejo.nombre}»` : ''}) hecha para el producto de la ficha de arriba. NO escribes un guion nuevo: partes de ese.`,
    '',
    `1. Lee \`temp/${o}/manifiesto.json\` y \`temp/${o}/app/guion.json\` (y \`temp/${o}/transiciones.json\` y \`temp/${o}/notas-paquete.md\` si existen).`,
    `2. Escribe el manifiesto de ESTE anuncio partiendo del de ese: las mismas tomas, en el mismo orden y con las mismas duraciones, el mismo estilo, los mismos B-roll y las mismas personas y lugares (sus hojas con el mismo \`id\` y el MISMO prompt: ya están en \`temp/<este anuncio>/img/\` y se usan sin pagarlas otra vez). La referencia del producto apunta a la foto de ESTE anuncio.`,
    '3. **El guion va TAL CUAL, palabra por palabra**, salvo lo que es del producto: su nombre, qué es («estas son las gotas» → «estas son las pastillas»), cómo se toma o se usa, la dosis, los ingredientes, los beneficios y el envase. Y cualquier frase que con el producto nuevo no sea verdad o no encaje (un beneficio que no tiene, un ingrediente que no lleva, una forma de uso distinta): la adaptas con lo mínimo, con lo verdadero de su ficha, cuidando que dure lo mismo.',
    '4. En los prompts de imagen y de video, el producto es el nuevo: su forma, su envase, sus colores y su etiqueta como en su foto, y las acciones con el producto cambian con él (poner gotas bajo la lengua → tomar una pastilla con agua). Lo que no tiene producto queda igual.',
    '5. Si el anuncio trae `tramos`, `lineas`, `dialogo`, `guion[]`, `voz_en_off` o `ganchos_alternativos`, todos dicen el texto nuevo. Valida como siempre.',
    '6. En "decisiones", la lista corta de lo que cambiaste respecto del original (frase por frase) y por qué.',
  ].join('\n');
}

/** Las hojas de personas y lugares del original, copiadas al anuncio nuevo (mismas caras y lugares, sin pagarlas). */
function copiarHojasDe(origen, slug) {
  const m = leerJSON(path.join(dirDe(origen), 'manifiesto.json'));
  const copiadas = [];
  fs.mkdirSync(path.join(dirDe(slug), 'img'), { recursive: true });
  for (const r of Array.isArray(m?.referencias) ? m.referencias : []) {
    if (!r?.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(String(r.id)) || r.tipo === 'producto' || r.id === 'producto' || !r.prompt) continue;
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      const de = path.join(dirDe(origen), 'img', `${r.id}.${ext}`);
      if (!existe(de)) continue;
      fs.copyFileSync(de, path.join(dirDe(slug), 'img', `${r.id}.${ext}`));
      copiadas.push(r.id);
      break;
    }
  }
  return copiadas;
}

/**
 * POST /api/anuncios/:slug/recrear { productoId } -> { slug }: el mismo anuncio para otro producto (ver arriba).
 * Se puede desde un anuncio con su guion escrito (manifiesto.json); no los cantados (su letra es de otro producto).
 */
export function recrearAnuncio(origen, { productoId } = {}) {
  if (!slugValido(origen) || !existe(path.join(dirDe(origen), 'manifiesto.json'))) throw new ErrorApp(404, 'Ese anuncio todavía no tiene guion para recrearlo.');
  const b = leerBrief(origen);
  if (!b?.estilo || !ESTILOS[b.estilo]) throw new ErrorApp(409, 'Ese anuncio no se hizo con un estilo de la app.');
  if (esLetras(b) || ['musical', 'historia-musical'].includes(defDe(b).familia)) throw new ErrorApp(409, 'Los anuncios cantados no se recrean: su canción es de otro producto. Haz uno nuevo para este producto.');
  if (!productoValido(productoId)) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (productoId === b.productoId) throw new ErrorApp(409, 'Elige otro producto: este anuncio ya es de ese.');
  const ficha = leerFicha(productoId);
  if (!ficha) throw new ErrorApp(409, 'Primero arma la ficha de ese producto (Nuevo anuncio, paso 1).');
  const producto = leerProducto(productoId);
  if (!(producto?.fotos || []).length) throw new ErrorApp(409, 'Ese producto no tiene foto: súbela primero.');
  const slug = slugNuevo(ficha.nombre || producto.nombre || productoId.replace(/-[a-z0-9]{4}$/, ''), b.estilo);
  fs.mkdirSync(appDe(slug), { recursive: true });
  const brief = {
    slug,
    productoId,
    estilo: b.estilo,
    familia: null,
    faseGuion: defDe(b).faseGuion,
    duracion: b.duracion,
    // la misma voz del original (si se eligió sola, la misma que quedó)
    voz: b.voz?.id ? { id: b.voz.id, nombre: b.voz.nombre || b.voz.id } : b.voz || null,
    continuidad: Boolean(b.continuidad),
    respuestas: b.respuestas || {},
    opciones: b.opciones || opcionesDe(b.estilo, b.respuestas || {}),
    ...(b.avatar ? { avatar: b.avatar } : {}),
    ...(b.musicaBiblioteca ? { musicaBiblioteca: b.musicaBiblioteca } : {}),
    ...(b.agregar ? { agregar: b.agregar } : {}),
    recrearDe: origen,
    creado: ahora(),
    ...(PUERTO_DE_PRUEBA ? { puerto: PUERTO_DE_PRUEBA } : {}),
  };
  brief.familia = familiaDe(brief);
  escribirJSON(path.join(appDe(slug), 'brief.json'), brief);
  copiarModelosAlAnuncio(slug);
  const hojas = copiarHojasDe(origen, slug);
  if (hojas.length) brief.hojasDelOriginal = hojas;
  escribirJSON(path.join(appDe(slug), 'brief.json'), brief);
  const sesion = { uuid: crypto.randomUUID(), estado: 'escribiendo', tipo: 'guion', intentos: 0, progreso: [], inicio: ahora(), cambios: [] };
  guardarSesion(slug, sesion);
  lanzar(slug, { tipo: 'guion' });
  return { slug, productoId, hojas };
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
  agregar:
    '`pedido` es lo que el usuario quiere, con sus palabras (el estilo, la duración, el idioma, lo que se conserva): **manda sobre todo lo demás**. `clonar` es el video del usuario (ya analizado: abajo dice dónde). `formato` es cómo está hecho ese video: "Una persona habla a cámara" = formato UGC, "Una voz cuenta sobre escenas" = formato voz en off; con "que decida la IA", lo decides tú mirando el video (Paso 4 de la skill). `angulo` es lo que tiene que notarse (la zona del cuerpo, el deseo o el resultado, por ejemplo "glúteos y piernas más levantados y firmes"); con "que decida la IA", lo sacas del video y de la ficha. `antes_despues`: "Sí" = va un antes y después con el cambio bien visible en esa zona; "No" = sin antes y después; con "que decida la IA", va si el video lo tiene o si el ángulo es un cambio del cuerpo. `clonar_gancho` dice si el gancho y el ángulo se adaptan al producto o se conservan del original.',
  'historias-musicales':
    'El briefing del Paso 1 ya está contestado: la ficha (producto, dolor y mecanismo, mercado, oferta), `duracion` y `ajustes_del_estilo`: `cuenta` es quién cuenta la historia, `villano` el detonante, `cierre` el tipo de cierre ("Cantado dentro de la canción" o "Solo tarjeta final"), `genero` el género musical y `canta` la voz ("Voz femenina" = "f", "Voz masculina" = "m"; con "que decida la IA", el género de quien cuenta la historia). Donde diga "que decida la IA", decides tú con la skill: nunca dejes un dato inventado sin contarlo en "decisiones".',
};

// «Agregar»: el plan (app/plan.json). Lo lee revisarPlanDeAgregar; lo ve el usuario en la revision del guion.
const FORMATO_PLAN = `\`\`\`json
{
  "estilo": "agregar",
  "formato": "voz-en-off",
  "duracion": "1:30",
  "idioma": "es",
  "respuestas": {},
  "resumen": "una o dos frases en español sencillo: qué vas a hacer con su video",
  "conserva": ["la estructura: gancho → problema → antes y después → producto → oferta", "el gancho: …", "el ángulo: …", "las objeciones y frases clave: …"],
  "cambia": ["lo que cambia y por qué (el estilo, la duración, el producto…)"],
  "porque": "por qué ese estilo y ese formato"
}
\`\`\`

- \`estilo\`: "agregar" = el mismo look del video (lo que pide la skill si el pedido no nombra un estilo). Si el pedido nombra uno de la app, su clave: ${'`'}claymation${'`'}, ${'`'}crochet${'`'}, ${'`'}zack-d-films${'`'}, ${'`'}estilo-pixar${'`'}, ${'`'}realista-narrado${'`'}, ${'`'}skeleton${'`'}, ${'`'}estilo-lego${'`'}, ${'`'}ugc${'`'}, ${'`'}talking-object-pixar${'`'}, ${'`'}podcast${'`'}, ${'`'}entrevista${'`'}, ${'`'}musical${'`'} o ${'`'}historias-musicales${'`'} (tabla del Paso 1 de la skill).
- \`formato\`: solo con "agregar": "ugc" o "voz-en-off" (Paso 4).
- \`duracion\`: la que pidió el usuario ("1:30", "90 s", "2 minutos") o null = la del video.
- \`respuestas\`: con otro estilo, las preguntas de ese estilo que el pedido ya contesta, con sus palabras de la pantalla (en el musical, \`visual\` es obligatorio: "Crochet", "Claymation" o "Zack D Films"; \`genero\` y \`canta\` si los dice). Lo que no dice queda fuera ("que decida la IA").
- \`resumen\`, \`conserva\`, \`cambia\` y \`porque\` los lee el usuario: en español sencillo, sin rutas ni nombres de archivos.`;

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
  // (2026-11-19k) «las escenas B-roll también deben ser detalladas»
  'Si el manifiesto trae B-roll (`broll[]`), agrega `"broll"`: uno por cada uno, con el mismo `n`, como `{ "n": 1, "se_ve": "…", "camara": "…" }`. `se_ve` es la escena en español, DETALLADA y muy visual, en 2 o 3 frases: qué se ve y quién, dónde y con qué luz, la acción que pasa de principio a fin, el detalle que engancha (el producto, la textura, la cara) y la emoción que deja; `camara` es el encuadre y el movimiento de cámara en pocas palabras ("primerísimo plano, la cámara se acerca despacio"). Es la misma escena que piden sus prompts de imagen y de video: escríbela primero aquí y pásala a los prompts (en inglés), sin contradecirla.',
];

/** Como se escribe guion.json en cada familia (lo que se dice se copia del manifiesto; la app lo vuelve a copiar). */
function formatoGuion(def, brief) {
  const fam = def.familia;
  const r = [];
  if (fam === 'hablado' && brief.estilo === 'podcast') {
    r.push(
      'Una parte por línea de la conversación (`guion[]` del manifiesto), en el orden en que se oye: `n` es `guion[].orden`, `dice` es `guion[].texto` copiado carácter por carácter, `quien` el nombre del anfitrión que la dice y `actuacion` cómo la dice (emoción, tono, expresión, gesto, mirada; en español, una frase). Las tomas de reacción sin diálogo no van.',
      'Agrega `"personajes"`: los dos anfitriones, `[{ "id": "A", "nombre": "…", "como_es": "cómo se ve, una frase", "habla_asi": "su carácter y su manera de hablar, distinta del otro" }, { "id": "B", … }]` (A y B como en el manifiesto).',
      '`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.',
    );
  } else if (fam === 'hablado') {
    r.push(
      'Una parte por clip, con el mismo `n` que `tomas[].n` y en el mismo orden. `dice` es `tomas[].linea` copiado carácter por carácter.',
      'Agrega en cada parte `"dialogo"`: el `tomas[].dialogo` del manifiesto, línea por línea, como `{ "quien": "Entrevistador" o el nombre de la persona, "dice": "su texto, copiado", "como": "cómo lo dice: emoción, tono, expresión, gesto (en español, una frase)" }`.',
      'Agrega `"personajes"`: la persona que paran, `[{ "nombre": "…", "como_es": "cómo se ve, una frase", "habla_asi": "su carácter y su manera de hablar" }]` (y el entrevistador con `"id": "entrevistador"`, `"nombre": "Entrevistador"` y su `habla_asi`), y `"variante"`: "A" o "B".',
      '`duracionEstimada` es la suma de `tomas[].duracion`, en segundos.',
    );
  } else if (fam === 'agregar') {
    r.push(
      'Depende del formato que elegiste (Paso 4 de la skill). **UGC:** una parte por bloque, con el mismo `n` que `tomas[].n` y en el mismo orden; `dice` es `tomas[].linea` copiado carácter por carácter; agrega `"personajes"`: la persona que habla a cámara, `[{ "nombre": "…", "como_es": "una frase" }]`. **Voz en off:** una parte por toma, con el mismo `n` que `tomas[].n` y en el mismo orden; `dice` es `tomas[].linea` copiado del manifiesto carácter por carácter; si hay una persona que se repite (el antes y el después), agrega `"personajes"`.',
      'Agrega `"modelos"`: una línea por modelo que elegiste, en palabras sencillas, `[{ "modelo": "Omni Flash 1.2", "para": "las tomas donde ella habla", "porque": "mueve bien los labios" }]` (aquí sí va el nombre del modelo).',
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
  if (fam === 'agregar') {
    // «Agregar», antes de saber el estilo: primero el plan (el video + el pedido); si es el look del video, sigue hasta el
    // manifiesto; si es otro estilo, para ahi (la app pasa el anuncio a ese estilo y lo sigue otra sesion)
    const transicionesAgregar = TEXTO_TRANSICIONES.replace(/\{\{slug\}\}/g, slug).replace('{{bloques}}', ' Si lo haces en formato UGC, "toma" es el número del bloque que empieza con esa parte, y solo van en el corte entre dos bloques.');
    return {
      intro:
        'El usuario subió un video y escribió lo que quiere (`ajustes_del_estilo.pedido`). Primero entiendes el video y el pedido y escribes el plan; la app se lo muestra al usuario junto con el guion y el costo antes de gastar nada.',
      pasos: [
        'Lee la skill entera.',
        `Mira el video y lee el pedido (Pasos 2 y 3 de la skill): escribe \`temp/${slug}/referencia/adn.md\` y \`temp/${slug}/referencia/guion-clonado.md\`. Si el pedido trae una duración, el guion clonado ya va condensado a esa duración (Paso 5 de la skill).`,
        `Escribe \`temp/${slug}/app/plan.json\` con el formato de abajo (Paso 1 de la skill: el estilo, la duración y lo que se conserva).`,
        `**Si \`plan.estilo\` es otro estilo de la app**, termina aquí y responde solo LISTO: no escribas manifiesto, ni transiciones, ni \`app/guion.json\` (los escribe después la skill de ese estilo).`,
        `**Si \`plan.estilo\` es "agregar"** (el look del video), sigue: el manifiesto en \`temp/${slug}/manifiesto.json\` (Pasos 4 a 6), ${transicionesAgregar}`,
        `Valida con este comando, escrito exactamente así:\n\n   node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json\n\n   y corrige el manifiesto hasta que no quede ningún ERROR (los AVISO no frenan). El costo que imprime no se le muestra a nadie.`,
        `Escribe \`temp/${slug}/app/guion.json\` con el formato de abajo.`,
        'Responde solo LISTO.',
      ],
      archivo: `temp/${slug}/app/plan.json y, con el look del video, temp/${slug}/app/guion.json`,
      formato: `${FORMATO_PLAN}\n\nY \`app/guion.json\` (solo con "agregar"):\n\n${formatoGuion(def, brief)}`,
      delEstilo,
    };
  }
  const transiciones = conTransiciones
    ? TEXTO_TRANSICIONES.replace(/\{\{slug\}\}/g, slug).replace('{{bloques}}', fam === 'ugc' ? ' Aquí "toma" es el número del bloque que empieza con esa parte.' : fam === 'agregar' ? ' Si lo haces en formato UGC, "toma" es el número del bloque que empieza con esa parte, y solo van en el corte entre dos bloques.' : '')
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

/** Si la voz del narrador la elige la app: la IA describe la voz ideal en voz-buscada.json (lib/voz-auto.js la busca). */
function textoVozAuto(slug, brief, def) {
  if (!def?.narrador || brief?.voz?.id) return '';
  return [
    '## La voz del narrador (la elige la app)',
    '',
    `El usuario no eligió la voz: la app elige la de su cuenta de ElevenLabs que más se parece a la que describas. Al terminar el guion, escribe \`temp/${slug}/voz-buscada.json\`:`,
    '`{ "genero": "femenina" | "masculina", "edad": "joven" | "adulta" | "mayor", "acento": "latino" | "colombiano" | "mexicano" | "argentino" | "espanol" | "neutro", "tono": ["cálida", "cercana"], "motivo": "una línea" }`',
    'Si hay video de referencia, describe la voz de su narrador (la escuchas en la transcripción y la ves en las tomas: quién habla, su edad, su energía); la app además mide su audio. Si no hay, la más indicada para el estilo, el guion y el público de la ficha (por ejemplo, una voz femenina cálida para un producto de mujeres que cuenta una historia; una masculina y segura para un explicador). Tonos que se reconocen: cálida, calmada, enérgica, alegre, profunda, suave, seria, confiable, amigable, cercana, natural, dramática, divertida, narradora.',
  ].join('\n');
}

function promptGuion(slug, brief, foto, prepClonar = null) {
  const def = defDe(brief);
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
      textoClonar(slug, brief, prepClonar, { guionPropio: tieneGuionPropio(brief), agregar: Boolean(def.segunReferencia), desdeAgregar: !def.segunReferencia && brief.agregar ? brief.agregar : null }),
      // la investigación del producto (deseo, beneficio, dolores, objeciones) y la estructura más adecuada (2026-11-16)
      textoInvestigacion({ slug, brief }).texto,
      textoVozAuto(slug, brief, def),
      esLetras(brief) ? '' : textoEstructuras({ slug, brief, familia: def.familia === 'agregar' ? 'voz-en-off' : def.familia, conReferencia: referenciaPedida(brief), guionPropio: tieneGuionPropio(brief) }),
      textoTendencias(brief.estilo),
      textoBiblioteca(slug, brief), textoMaterial(slug), textoRecrear(brief), textoPedido(brief), t.delEstilo, esLetras(brief) ? '' : textoAhorro(brief.estilo, { continuidad: Boolean(brief.continuidad), hablado: ['hablado', 'ugc', 'objeto-parlante'].includes(def.familia) }), textoAprendizajes(carpetaDeEstilo(brief.estilo), { conSubestilo: Boolean(AJUSTES[brief.estilo]?.subestilo) })].filter(Boolean).join('\n\n'),
    archivo: t.archivo,
    formato: t.formato,
  });
}

function promptCambios(slug, brief, pedido, { reintento = false } = {}) {
  const def = defDe(brief);
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
      // Agregar produce con el proceso de UGC o con el de realista con narrador (que sigue el de Pixar): las lee
      ...(ESTILOS[brief.estilo]?.segunReferencia ? SKILLS_DE_AGREGAR.map((k) => `Read(./.claude/skills/${k}/**)`) : []),
      // «Agregar» que paso a otro estilo: la tabla de modelos por escena esta en su skill
      ...(brief.agregar && !ESTILOS[brief.estilo]?.segunReferencia ? ['Read(./.claude/skills/anuncios-agregar/**)'] : []),
      // clonar un video: la skill de la clonacion (sus Pasos 3 y 5)
      ...(referenciaPedida(brief) ? ['Read(./.claude/skills/anuncios-clonacion/**)'] : []),
      `Read(${c}/**)`,
      `Read(./${relProducto(brief.productoId)}/**)`,
      // recrear para otro producto: el anuncio original (solo lectura)
      ...(brief.recrearDe && slugValido(brief.recrearDe) ? [`Read(./temp/${brief.recrearDe}/**)`] : []),
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
  if (ESTILOS[brief.estilo]?.segunReferencia) textos.push(...SKILLS_DE_AGREGAR.map((k) => `.claude/skills/${k}/SKILL.md`));
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
  const def = defDe(brief);
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
  if (brief.recrearDe && slugValido(brief.recrearDe)) textos.push(...['manifiesto.json', 'app/guion.json', 'transiciones.json', 'notas-paquete.md'].map((r) => `temp/${brief.recrearDe}/${r}`));
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
  const fam = defDe(brief).familia;
  return [`temp/${slug}/${fam === 'musical' ? 'app/letras.json' : fam === 'historia-musical' ? 'cancion/peticion.json' : 'manifiesto.json'}`];
}

/** Lo que lee la IA en un cambio: la skill y lo escrito (lo que nombra la tarea de cambios de esa fase). */
function materialCambios(slug, brief) {
  const def = defDe(brief);
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
  let def = ESTILOS[brief?.estilo];
  if (!def) return { ok: false, final: true, error: 'Este anuncio es de un estilo que la app no conoce.' };

  const bloqueo = path.join(appDe(slug), 'bloqueo.json');
  if (existe(bloqueo)) {
    const b = leerYValidar(bloqueo, 'bloqueo');
    if (b.ok) return { ok: false, final: true, bloqueado: true, faltan: b.datos.faltan, error: b.datos.motivo };
    return { ok: false, errores: b.errores };
  }
  if (def.familia === 'musical') return verificarLetras(slug, brief);
  if (def.familia === 'historia-musical') return verificarHistoria(slug, brief);
  if (def.segunReferencia) {
    // «Agregar», primero el plan (el video + el pedido): si es otro estilo, la app pasa el anuncio a ese estilo y su
    // guion lo escribe otra sesion (trabajar). Con el look del video, la IA siguio hasta el manifiesto en el formato que
    // calza (UGC o voz en off): desde aca la app sabe con que familia se produce y lo deja en el brief.
    const rp = revisarPlanDeAgregar(slug);
    if (rp.errores) return { ok: false, errores: rp.errores };
    if (rp.plan.estilo !== 'agregar') return { ok: true, otroEstilo: rp.plan };
    brief.agregar = { pedido: brief.respuestas?.pedido || null, plan: planParaMostrar(rp.plan, brief) };
    const m = leerJSON(path.join(dirDe(slug), 'manifiesto.json'));
    if (m) {
      const f = familiaDelManifiesto(m);
      if (f.error) return { ok: false, errores: [f.error] };
      const pedido = formatoPedidoDeAgregar(brief);
      if (pedido && pedido !== f.familia) {
        return {
          ok: false,
          errores: [
            pedido === 'ugc'
              ? 'El usuario eligió que su video es una persona que habla a cámara: el manifiesto va en bloques R (formato UGC, la skill anuncios-ugc), no con voz en off.'
              : 'El usuario eligió que su video es una voz que cuenta sobre escenas: el manifiesto va con "modo_audio": "voz_en_off" (el proceso de anuncios-realista-narrado), no en bloques R.',
          ],
        };
      }
      escribirJSON(path.join(appDe(slug), 'brief.json'), { ...brief, produccion: f.familia, familia: f.familia });
      brief.produccion = f.familia;
      brief.familia = f.familia;
      def = defDe(brief);
    }
  }
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

/**
 * Las escenas que piden su propio modelo ("modelo_video", estilo Agregar), agrupadas por modelo para la pantalla:
 * [{ modelo: 'Grok Imagine 1.5', para: 'B-roll 2 y 4', porque: '…' }]. Vacio si ninguna lo pide.
 */
export function modelosPorEscena(m) {
  const grupos = new Map();
  const piezas = [...(m?.tomas || []).map((t) => ({ t, que: 'toma' })), ...(m?.broll || []).map((t) => ({ t, que: 'broll' }))];
  for (const { t, que } of piezas) {
    const id = t && !t.quieto && !t.desde_biblioteca ? modeloDeLaPieza(t) : null;
    if (!id) continue;
    const g = grupos.get(id) || { tomas: [], broll: [], porque: [] };
    g[que === 'toma' ? 'tomas' : 'broll'].push(t.n);
    const p = texto(t.modelo_porque).trim();
    if (p && !g.porque.includes(p)) g.porque.push(p);
    grupos.set(id, g);
  }
  const y = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : String(xs[0]));
  return [...grupos].map(([id, g]) => ({
    modelo: nombreDeModelo(id) || id,
    para: [g.tomas.length ? `${g.tomas.length === 1 ? 'toma' : 'tomas'} ${y(g.tomas)}` : '', g.broll.length ? `B-roll ${y(g.broll)}` : ''].filter(Boolean).join(' · '),
    ...(g.porque.length ? { porque: g.porque.slice(0, 2).join(' ').slice(0, 300) } : {}),
  }));
}

// (2026-11-19j) cómo dice cada línea quien habla (podcast y entrevista): emoción, tono, expresión, gesto
const actuacionDe = (a) => (typeof a === 'string' && a.trim() ? { actuacion: a.replace(/\s+/g, ' ').trim().slice(0, 300) } : {});

/** guion.json con lo que se dice copiado del manifiesto (la fuente de verdad), parte por parte y en orden. */
function normalizarGuion(slug, brief, g, m) {
  const porN = new Map(g.partes.map((p) => [brief.estilo === 'podcast' ? p.orden ?? p.n : p.n, p]));
  let ajustados = 0;
  const extra = (p) => ({ ...(p.momento ? { momento: p.momento } : {}) });
  const personajes = Array.isArray(g.personajes) ? g.personajes.filter((x) => x && typeof x === 'object') : [];
  let partes;
  let faltaban;
  const fam = defDe(brief).familia;

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
      return { n: l.orden, ...extra(p), ...(!p.momento && l.beat ? { momento: l.beat } : {}), quien, lado: lado(l.habla), dice, ...(p.se_ve ? { se_ve: p.se_ve } : {}), ...actuacionDe(p.actuacion) };
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
        const persona = personajes.find((x) => !/entrevistador/i.test(`${x.id || ''} ${x.nombre || ''}`))?.nombre || 'La persona';
        // (cómo dice cada línea: lo que escribió la IA en esa misma línea de su guion, por orden)
        const suyas = Array.isArray(p.dialogo) ? p.dialogo : [];
        parte.dialogo = t.dialogo.map((d, i) => {
          const entrevistador = /entrevistador/i.test(texto(d.habla));
          return { quien: entrevistador ? 'Entrevistador' : persona, lado: entrevistador ? 'A' : 'B', dice: texto(d.texto), ...(suyas[i]?.como ? { como: texto(suyas[i].como).slice(0, 300) } : {}) };
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
  // (2026-11-19k) el B-roll, con su escena detallada: lo escribe la IA (`broll` de guion.json) y dónde va sale del
  // manifiesto; uno sin escena escrita igual se ve, con lo que dice su línea de sincronía
  const brollDeLaIA = new Map((Array.isArray(g.broll) ? g.broll : []).filter((x) => x && Number.isInteger(x.n)).map((x) => [x.n, x]));
  const brollGuion = (Array.isArray(m.broll) ? m.broll : [])
    .filter((b) => b && Number.isInteger(b.n))
    .map((b) => {
      const suyo = brollDeLaIA.get(b.n) || {};
      const sv = texto(suyo.se_ve).replace(/\s+/g, ' ').trim();
      return {
        n: b.n,
        ...(Number.isInteger(b.encima_de_toma) ? { encima: b.encima_de_toma } : Number.isInteger(b.despues_de_toma) ? { despues: b.despues_de_toma } : {}),
        ...(b.sincroniza_con ? { con: texto(b.sincroniza_con).slice(0, 160) } : {}),
        ...(typeof b.duracion === 'number' ? { segundos: b.duracion } : {}),
        ...(sv ? { se_ve: sv.slice(0, 700) } : {}),
        ...(suyo.camara ? { camara: texto(suyo.camara).replace(/\s+/g, ' ').trim().slice(0, 200) } : {}),
        ...(b.desde_biblioteca && /\/material\//.test(String(b.desde_biblioteca)) ? { tuyo: true } : {}),
      };
    });
  if (brollGuion.length) limpio.broll = brollGuion;
  else delete limpio.broll;
  // «Agregar»: el modelo de cada escena, contado desde el manifiesto (lo que de verdad se va a pedir), con el porque
  const porModelo = modelosPorEscena(m);
  if (porModelo.length) limpio.modelos = porModelo;
  if (personajes.length) limpio.personajes = personajes.map((x) => ({ ...(x.id ? { id: texto(x.id) } : {}), nombre: texto(x.nombre).slice(0, 80), ...(x.como_es ? { como_es: texto(x.como_es).slice(0, 300) } : {}), ...(x.habla_asi ? { habla_asi: texto(x.habla_asi).slice(0, 300) } : {}) }));
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

async function trabajar(slug, { tipo, pedido = null, retomar = false, reintento = false, seguir = false }) {
  const brief = leerBrief(slug);
  let s = leerSesion(slug);
  s = { ...s, estado: tipo === 'cambios' ? 'cambiando' : 'escribiendo', tipo, intentos: (s.intentos || 0) + 1, error: null, inicioIntento: ahora() };
  if (!retomar && !seguir) s.progreso = []; // (seguir: «Agregar» que paso a otro estilo, con lo que ya se vio)
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
    // «Agregar» no tiene guion sin su video: si no se pudo preparar, se para aca (sin gastar la sesion de la IA)
    if (ESTILOS[brief.estilo]?.segunReferencia && !prepClonar?.ok) {
      throw Object.assign(new Error('referencia'), { publico: { mensaje: prepClonar?.aviso || 'Falta tu video: súbelo (o pega su link) en los ajustes del anuncio y toca "Reintentar".', tipo: 'otro' } });
    }
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
  if (r.ok && r.verificacion?.otroEstilo && tipo === 'guion') {
    // «Agregar» con otro estilo: el anuncio pasa a ese estilo y su guion (o su letra) lo escribe una sesion nueva, con
    // la skill de ese estilo, el ADN y el guion condensado que ya quedaron en referencia/
    const nuevo = pasarAlEstiloDelPlan(slug, brief, r.verificacion.otroEstilo);
    s = guardarSesion(slug, { ...s, uuid: crypto.randomUUID(), medidas: [...(s.medidas || []), medida].slice(-20), intentos: 0 });
    avanzar(`Tu pedido: ${ESTILOS[nuevo.estilo].nombre}${nuevo.duracion?.texto ? ` · ${nuevo.duracion.texto}` : ''}. ${laIA()} escribe ${esLetras(nuevo) ? 'la letra' : 'el guion'} de ese estilo`);
    return trabajar(slug, { tipo: 'guion', seguir: true });
  }
  if (r.ok && tipo === 'guion' && defDe(brief)?.narrador && faltaVoz(leerJSON(path.join(appDe(slug), 'brief.json')) || brief)) {
    // la voz que eligió la app (la más parecida a la del video de referencia o la más indicada): ya, para verla en el plan
    try {
      const b = leerJSON(path.join(appDe(slug), 'brief.json')) || brief;
      const v = await asegurarVoz({ carpeta: path.join(TEMP, slug), brief: b, ficha: leerFicha(b.productoId) || {} });
      if (v.ok) avanzar(`La voz del narrador: ${v.voz.nombre} (la eligió la app)`);
    } catch (e) {
      console.warn(`[guion] ${slug}: no pude elegir la voz todavía (${e.message}); se elige al producir`);
    }
  }
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

/**
 * PUT /api/anuncios/:slug/guion/lineas { lineas: [{ n, dice }] }: el usuario edita A MANO lo que se dice (2026-11-18).
 * - Con narrador (voz en off, la voz todavía no generada): se aplica directo y gratis al manifiesto (la línea de la
 *   toma, el texto de voz_en_off y donde la toma la repita) y a guion.json; se valida el manifiesto y, si no pasa,
 *   vuelve todo como estaba. -> { directo: true, cambiadas }
 * - Donde alguien habla en el video (UGC, podcast, entrevista, objeto parlante…), la frase va dentro de los prompts
 *   de video con sus tiempos: se lo pide a la IA (la misma conversación del guion) con el texto exacto. -> { conIA: true }
 */
export async function editarLineas(slug, lineas) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const brief = leerBrief(slug);
  const def = defDe(brief);
  if (def?.familia === 'musical' || def?.familia === 'historia-musical') throw new ErrorApp(409, 'Las letras se cambian pidiéndolo con tus palabras.');
  const s = leerSesion(slug);
  if (enMarcha.has(slug) || sesionActiva(s?.uuid)) throw new ErrorApp(409, `${laIA()} todavía está trabajando en este guion. Espera a que termine.`);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Este guion ya se aprobó y está en producción: los textos se cambian en el editor.');
  if (s?.estado !== 'listo') throw new ErrorApp(409, 'El guion todavía no está listo para editarlo.');
  const g = leerJSON(path.join(appDe(slug), 'guion.json'));
  const antes = new Map((g?.partes || []).map((p) => [p.n, String(p.dice || '')]));
  const seVeAntes = new Map((g?.partes || []).map((p) => [p.n, String(p.se_ve || '').replace(/\s+/g, ' ').trim()]));
  const limpio = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
  const lista = Array.isArray(lineas) ? lineas : [];
  const pedidas = lista
    .filter((x) => !x?.nueva)
    .map((x) => ({ n: Number(x?.n), dice: limpio(x?.dice), ...(x?.se_ve !== undefined ? { se_ve: limpio(x.se_ve).slice(0, 600) } : {}) }))
    .filter((x) => Number.isInteger(x.n) && antes.has(x.n));
  // (2026-11-18z) partes NUEVAS: { nueva: true, despuesDe: n (0 = al comienzo), dice, se_ve? }
  const nuevas = lista
    .filter((x) => x?.nueva)
    .map((x) => ({ despuesDe: Number(x?.despuesDe) || 0, dice: limpio(x?.dice), se_ve: limpio(x?.se_ve).slice(0, 600) }))
    .filter((x) => x.dice);
  if (nuevas.length > 10) throw new ErrorApp(400, 'Agrega como mucho 10 partes nuevas a la vez.');
  if (pedidas.some((x) => !x.dice)) throw new ErrorApp(400, 'Una parte quedó vacía: escribe lo que se dice o deja el texto que tenía.');
  if ([...pedidas, ...nuevas].some((x) => x.dice.length > 600)) throw new ErrorApp(400, 'Una parte es muy larga (más de 600 letras): pártela en dos o acórtala.');
  const cambios = pedidas.filter((x) => x.dice !== antes.get(x.n) || (x.se_ve !== undefined && x.se_ve && x.se_ve !== seVeAntes.get(x.n)));
  if (!cambios.length && !nuevas.length) return { directo: true, cambiadas: 0 };
  // lo que se ve cambió o hay partes nuevas: las escenas (imágenes y videos) tienen que seguir a lo nuevo, así que lo
  // hace la IA (igual que un cambio pedido con tus palabras); solo el texto, con narrador, va directo (más abajo)
  const cambiaLoQueSeVe = nuevas.length > 0 || cambios.some((x) => x.se_ve !== undefined && x.se_ve && x.se_ve !== seVeAntes.get(x.n));

  const m = leerJSON(path.join(dirDe(slug), 'manifiesto.json'));
  const conNarrador = m?.modo_audio === 'voz_en_off' && Array.isArray(m.tomas) && !existe(path.join(TEMP, slug, 'audio', 'voz.mp3'));
  if (!conNarrador || cambiaLoQueSeVe) {
    const pedido = [
      'El usuario editó A MANO el guion. Pon EXACTAMENTE estos textos, palabra por palabra (no los mejores ni los acortes), y ajusta todo lo demás de esas tomas para que digan eso mismo: los tramos y sus tiempos, la duración, el prompt de video y los subtítulos. Donde trae «se ve», esa es la escena: rehaz el prompt de imagen y de video de esa toma para mostrar eso (con los mismos personajes, el mismo estilo y la misma continuidad del anuncio) y pon ese texto en `se_ve` de la hoja. No cambies las otras tomas.',
      ...cambios.map((x) => `- Parte ${x.n}: dice «${x.dice}»${x.se_ve && x.se_ve !== seVeAntes.get(x.n) ? `; se ve: ${x.se_ve}` : ''}`),
      ...(nuevas.length
        ? [
            'Partes NUEVAS (agrégalas como tomas nuevas, con su imagen, su video, su tiempo y sus subtítulos, como las demás; renumera las tomas y las partes de la hoja en orden y ajusta la voz en off y la duración total):',
            ...nuevas.map((x) => `- Después de la parte ${x.despuesDe || 'del comienzo (va primera)'}: dice «${x.dice}»${x.se_ve ? `; se ve: ${x.se_ve}` : ' (tú decides lo que se ve, siguiendo el anuncio)'}`),
          ]
        : []),
    ].join('\n');
    const resumen = [cambios.length ? `${cambios.length === 1 ? 'la parte' : 'las partes'} ${cambios.map((x) => x.n).join(', ')}` : null, nuevas.length ? `${nuevas.length === 1 ? 'una parte nueva' : `${nuevas.length} partes nuevas`}` : null].filter(Boolean).join(' y ');
    const respaldo = respaldar(slug);
    guardarSesion(slug, { ...s, estado: 'cambiando', pedido, respaldo, cambios: [...(s.cambios || []), { pedido: `Editaste a mano ${resumen}`, aMano: true, fecha: ahora() }] });
    lanzar(slug, { tipo: 'cambios', pedido });
    return { conIA: true };
  }

  // con narrador: directo al manifiesto (lo que de verdad se produce) y a la hoja. Lo que ya no validaba antes (por
  // ejemplo, una foto que quedó en la nube) no cuenta: solo se deshace si la edición agrega un error nuevo.
  const yaHabia = new Set((await validar(slug)).errores);
  const respaldo = respaldar(slug);
  let vozEnOff = String(m.voz_en_off || '');
  let rehacer = false;
  for (const x of cambios) {
    const t = m.tomas.find((y) => y?.n === x.n);
    if (!t) continue;
    const viejo = String(t.linea || '');
    t.linea = x.dice;
    if (viejo && vozEnOff.includes(viejo)) vozEnOff = vozEnOff.replace(viejo, x.dice);
    else rehacer = true;
    // donde la toma repite la frase (el prompt de video entre comillas, los subtítulos): la nueva
    if (viejo) for (const [k, v] of Object.entries(t)) if (k !== 'linea' && typeof v === 'string' && v.includes(viejo)) t[k] = v.split(viejo).join(x.dice);
  }
  m.voz_en_off = rehacer ? m.tomas.map((t) => String(t.linea || '').trim()).filter(Boolean).join(' ') : vozEnOff;
  escribirJSON(path.join(dirDe(slug), 'manifiesto.json'), m);
  const v = await validar(slug);
  const nuevos = v.errores.filter((e) => !yaHabia.has(e));
  if (v.codigo !== 0 && nuevos.length) {
    restaurar(slug, respaldo);
    throw new ErrorApp(409, `No pude aplicar el cambio sin romper el guion: ${nuevos.slice(0, 2).join(' · ')}. Quedó como estaba.`);
  }
  const nuevo = new Map(cambios.map((x) => [x.n, x.dice]));
  const hechos = Array.isArray(g.cambios_hechos) ? g.cambios_hechos : [];
  escribirJSON(path.join(appDe(slug), 'guion.json'), {
    ...g,
    partes: g.partes.map((p) => (nuevo.has(p.n) ? { ...p, dice: nuevo.get(p.n) } : p)),
    cambios_hechos: [...hechos, `Editaste a mano ${cambios.length === 1 ? 'la parte' : 'las partes'} ${cambios.map((x) => x.n).join(', ')}.`].slice(-20),
  });
  guardarSesion(slug, { ...s, cambios: [...(s.cambios || []), { pedido: `Editaste a mano ${cambios.length === 1 ? 'la parte' : 'las partes'} ${cambios.map((x) => x.n).join(', ')}`, aMano: true, ok: true, fecha: ahora() }] });
  return { directo: true, cambiadas: cambios.length };
}

/**
 * POST /api/anuncios/:slug/guion/regenerar-linea { n, actual?, idea? } -> { dice }: otra versión de lo que se dice en
 * UNA parte, escrita por la IA con el guion completo como contexto (2026-11-18). No guarda nada: la pantalla la pone en
 * el cuadro de «Editar a mano» y el usuario la guarda (editarLineas) o pide otra. Es una consulta corta, aparte de la
 * sesión del guion (no la toca) y fuera de la cola, para que tarde segundos.
 */
export async function regenerarLinea(slug, { n, actual = '', idea = '', nueva = false, despuesDe = 0 } = {}) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const brief = leerBrief(slug);
  const s = leerSesion(slug);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Este guion ya se aprobó y está en producción.');
  const g = leerJSON(path.join(appDe(slug), 'guion.json'));
  const partes = Array.isArray(g?.partes) ? g.partes : [];
  // (2026-11-18 · 2026-11-19) una parte NUEVA que el usuario agrega al editar: { nueva: true, despuesDe }
  const despues = Number(despuesDe) || 0;
  if (nueva && despues && !partes.some((p) => p.n === despues)) throw new ErrorApp(404, 'No encuentro esa parte del guion.');
  const vecina = nueva ? partes.find((p) => p.n === despues) || partes[0] : null;
  const parte = nueva ? { n: despues ? despues + 0.5 : 0.5, momento: 'parte nueva', dice: '' } : partes.find((p) => p.n === Number(n));
  if (!parte) throw new ErrorApp(404, 'No encuentro esa parte del guion.');
  const ficha = leerFicha(brief.productoId) || {};
  const def = defDe(brief);
  const id = crypto.randomBytes(4).toString('hex');
  const salida = path.join(appDe(slug), `linea-${nueva ? 'nueva' : parte.n}-${id}.json`);
  const rel = path.relative(RAIZ, salida).replace(/\\/g, '/');
  const largo = String((nueva ? vecina?.dice : parte.dice) || '').split(/\s+/).filter(Boolean).length || 12;
  const enPantalla = String(actual || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const prompt = `TAREA: regenerar una línea del guion de un anuncio (${def?.nombre || brief.estilo}). Te ejecuta la app Kads Studio, sin chat: no preguntes nada.

El producto: ${ficha.nombre || ''}${ficha.queEs ? ` (${ficha.queEs})` : ''}. Público: ${ficha.publico || 'el de la ficha'}. País e idioma: ${[ficha.pais, ficha.idioma, g.idioma].filter(Boolean).join(', ') || 'Colombia, español'}.
${g.de_que_va ? `De qué va el anuncio: ${g.de_que_va}\n` : ''}
El guion completo, parte por parte (n | momento | lo que se dice | lo que se ve):
${partes.map((p) => `${p.n} | ${p.momento || ''} | ${String(p.dice || '').replace(/\n/g, ' ')} | ${String(p.se_ve || '').slice(0, 160)}`).join('\n')}

${nueva ? `Escribe lo que se dice en una parte NUEVA que va ${despues ? `justo después de la parte ${despues}` : 'al comienzo, antes de la parte 1'}: que enganche con la parte de antes y lleve a la de después, que sume algo que el anuncio todavía no dice (sin repetir frases de otras partes), en el mismo idioma, con las mismas palabras del público y el mismo tono. Más o menos del largo de las partes de al lado (unas ${largo} palabras).` : `Reescribe SOLO lo que se dice en la parte ${parte.n} («${parte.momento || 'sin momento'}»): una versión distinta y mejor que la actual, que cumpla la misma función en esa parte del anuncio, enganche con la parte anterior y lleve a la siguiente, en el mismo idioma y con las mismas palabras del público. Más o menos el mismo largo (unas ${largo} palabras, para que entre en el mismo tiempo), sin repetir frases de otras partes.`}${enPantalla && enPantalla !== parte.dice ? `\nAhora en el cuadro dice: «${enPantalla}» (da otra opción, distinta también de esa).` : ''}${idea ? `\nLo que pidió el usuario para esta parte: ${String(idea).slice(0, 300)}` : ''}
Reglas: nada de curar, tratar ni resultados garantizados; sin cifras, precios ni reseñas que no estén en el guion; sin comillas ni etiquetas, solo lo que se dice.

Escribe ${rel} con este JSON y nada más: { "dice": "…" }
Tu respuesta final: solo LISTO.`;
  let r = { ok: false };
  try {
    r = await preguntarIA({
      tipo: 'guion',
      uuid: crypto.randomUUID(),
      prompt,
      herramientas: ['Write'],
      permitidas: [`Write(./${rel})`, `Edit(./${rel})`],
      prohibidas: prohibidasIA({ terminal: false }),
      registro: path.join(appDe(slug), 'registro', `regenerar-linea-${nueva ? 'nueva' : parte.n}.log`),
      timeoutMs: 3 * 60000,
      maxTurnos: 4,
      verificar: async () => {
        const d = leerJSON(salida);
        return typeof d?.dice === 'string' && d.dice.trim() ? { ok: true } : { ok: false, errores: [`Escribe ${rel} con { "dice": "…" }.`] };
      },
    });
  } catch (e) {
    r = { ok: false, error: e.message };
  }
  const d = leerJSON(salida);
  fs.rmSync(salida, { force: true });
  const dice = String(d?.dice || '').replace(/\s+/g, ' ').replace(/^["«“]+|["»”]+$/g, '').trim().slice(0, 600);
  if (!dice) throw new ErrorApp(502, r?.sinMotor ? 'Elige tu IA en Ajustes › Conexiones.' : r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora.` : `${laIA()} no pudo escribir otra versión. Vuelve a intentarlo.`);
  return { dice };
}

/**
 * POST /api/anuncios/:slug/guion/se-ve { n?, despuesDe?, dice } -> { se_ve }: LO QUE SE VE (el contexto visual) para lo
 * que el usuario escribió en una parte, o en una parte nueva (2026-11-18z: «en base a lo que escriba, genere
 * automáticamente el texto de abajo»). Una consulta corta como regenerarLinea: no guarda nada; la pantalla lo pone
 * debajo del cuadro y se guarda con «Guardar» (editarLineas, que rehace la escena con la IA).
 */
export async function contextoVisual(slug, { n = null, despuesDe = null, dice = '' } = {}) {
  if (!esAnuncioNuevo(slug)) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  const brief = leerBrief(slug);
  const s = leerSesion(slug);
  if (aprobadoYProduciendo(slug, s)) throw new ErrorApp(409, 'Este guion ya se aprobó y está en producción.');
  const texto = String(dice || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!texto) throw new ErrorApp(400, 'Escribe primero lo que se dice.');
  const g = leerJSON(path.join(appDe(slug), 'guion.json'));
  const partes = Array.isArray(g?.partes) ? g.partes : [];
  const parte = n != null ? partes.find((p) => p.n === Number(n)) : null;
  if (n != null && !parte) throw new ErrorApp(404, 'No encuentro esa parte del guion.');
  const ficha = leerFicha(brief.productoId) || {};
  const def = defDe(brief);
  const personajes = (Array.isArray(g?.personajes) ? g.personajes : []).filter((x) => x?.nombre).map((x) => `${x.nombre}${x.como_es ? ` (${x.como_es})` : ''}`).join('; ');
  const id = crypto.randomBytes(4).toString('hex');
  const salida = path.join(appDe(slug), `se-ve-${id}.json`);
  const rel = path.relative(RAIZ, salida).replace(/\\/g, '/');
  const donde = parte ? `la parte ${parte.n} («${parte.momento || 'sin momento'}»)` : `una parte NUEVA que va ${Number(despuesDe) ? `después de la parte ${Number(despuesDe)}` : 'al comienzo'}`;
  const prompt = `TAREA: lo que se ve en una parte del guion de un anuncio (${def?.nombre || brief.estilo}). Te ejecuta la app Kads Studio, sin chat: no preguntes nada.

El producto: ${ficha.nombre || ''}${ficha.queEs ? ` (${ficha.queEs})` : ''}. Público: ${ficha.publico || 'el de la ficha'}.
${g?.de_que_va ? `De qué va el anuncio: ${g.de_que_va}\n` : ''}${personajes ? `Quién aparece: ${personajes}\n` : ''}
El guion completo, parte por parte (n | momento | lo que se dice | lo que se ve):
${partes.map((p) => `${p.n} | ${p.momento || ''} | ${String(p.dice || '').replace(/\n/g, ' ')} | ${String(p.se_ve || '').slice(0, 160)}`).join('\n')}

El usuario escribió para ${donde}: «${texto}»
Escribe LO QUE SE VE en esa parte mientras se dice eso: una escena MUY VISUAL Y LLAMATIVA que lo muestre y frene el scroll, con los mismos personajes, el mismo estilo (${def?.nombre || brief.estilo}) y la continuidad de las partes de al lado. Detállala bien: quién aparece y cómo se ve (expresión, ropa, pose), dónde está, qué hace, qué se ve en primer plano (el problema o el resultado bien visible, el producto si va), la luz, los colores y el encuadre de la cámara. En español sencillo, de todos los días (nunca un prompt técnico, ni en inglés), de unas 35 a 70 palabras.

Escribe ${rel} con este JSON y nada más: { "se_ve": "…" }
Tu respuesta final: solo LISTO.`;
  let r = { ok: false };
  try {
    r = await preguntarIA({
      tipo: 'guion',
      uuid: crypto.randomUUID(),
      prompt,
      herramientas: ['Write'],
      permitidas: [`Write(./${rel})`, `Edit(./${rel})`],
      prohibidas: prohibidasIA({ terminal: false }),
      registro: path.join(appDe(slug), 'registro', 'se-ve.log'),
      timeoutMs: 3 * 60000,
      maxTurnos: 4,
      verificar: async () => {
        const d = leerJSON(salida);
        return typeof d?.se_ve === 'string' && d.se_ve.trim() ? { ok: true } : { ok: false, errores: [`Escribe ${rel} con { "se_ve": "…" }.`] };
      },
    });
  } catch (e) {
    r = { ok: false, error: e.message };
  }
  const d = leerJSON(salida);
  fs.rmSync(salida, { force: true });
  const seVe = String(d?.se_ve || '').replace(/\s+/g, ' ').replace(/^["«“]+|["»”]+$/g, '').trim().slice(0, 600);
  if (!seVe) throw new ErrorApp(502, r?.sinMotor ? 'Elige tu IA en Ajustes › Conexiones.' : r?.limite ? `Se acabó el uso de tu plan de ${nombreIA(r.motor)} por ahora.` : `${laIA()} no pudo escribir lo que se ve. Escríbelo tú o vuelve a intentarlo.`);
  return { se_ve: seVe };
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
/**
 * PUT /api/anuncios/:slug/voz: la voz del narrador de un anuncio ya creado, antes de que se genere la voz.
 *   { id, nombre }  la que elige el usuario de su cuenta de ElevenLabs
 *   { auto: true }  que la elija la app ya (la más parecida al video de referencia o la más indicada)
 * -> { voz }
 */
export async function cambiarVoz(slug, cuerpo = {}) {
  const ruta = path.join(appDe(slug), 'brief.json');
  const brief = leerJSON(ruta);
  if (!brief) throw new ErrorApp(404, 'No encuentro ese anuncio.');
  if (!defDe(brief)?.narrador) throw new ErrorApp(409, 'Este anuncio no lleva narrador: la voz sale del video o de la canción.');
  if (existe(path.join(TEMP, slug, 'audio', 'voz.mp3'))) throw new ErrorApp(409, 'La voz de este anuncio ya se generó. Para cambiarla, pídelo en el editor o crea el anuncio de nuevo.');
  if (cuerpo.auto === true) {
    vozQueFallo.delete(slug);
    vozQueFalloEn.delete(slug);
    const b = { ...brief, voz: { auto: true } };
    escribirJSON(ruta, b);
    const v = await asegurarVoz({ carpeta: path.join(TEMP, slug), brief: b, ficha: leerFicha(b.productoId) || {} });
    if (!v.ok) throw new ErrorApp(502, v.mensaje);
    return { voz: v.voz };
  }
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(String(cuerpo.id || ''))) throw new ErrorApp(400, 'Elige una voz de la lista.');
  const voz = { id: String(cuerpo.id), nombre: String(cuerpo.nombre || cuerpo.id).slice(0, 80) };
  escribirJSON(ruta, { ...brief, voz });
  if (configApp.recordarVoz) configApp.recordarVoz(brief.estilo, voz);
  return { voz };
}

// las voces que la app está eligiendo ahora (para no pedirlas dos veces mientras la pantalla pregunta cada 2 s)
const eligiendoVoz = new Set();
const vozQueFallo = new Map(); // slug -> el mensaje (para la tarjeta de la voz)
const vozQueFalloEn = new Map(); // slug -> cuándo falló (para no reintentar solo enseguida)

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
  // la voz que elige la app: si el guion ya está y todavía no la eligió (o falló al terminar el guion), se elige ahora,
  // de fondo, para que la pantalla la muestre (la próxima consulta ya la trae)
  // (si falló, no se reintenta solo antes de 10 minutos: pedirle a ElevenLabs una y otra vez puede hacer que frene la
  // cuenta; el usuario reintenta cuando quiera con «Volver a intentar»)
  const falloReciente = vozQueFallo.has(slug) && Date.now() - (vozQueFalloEn.get(slug) || 0) < 10 * 60000;
  if (estado === 'listo' && brief && defDe(brief)?.narrador && faltaVoz(brief) && !eligiendoVoz.has(slug) && !falloReciente && !existe(path.join(TEMP, slug, 'audio', 'voz.mp3'))) {
    eligiendoVoz.add(slug);
    asegurarVoz({ carpeta: path.join(TEMP, slug), brief: { ...brief }, ficha: leerFicha(brief.productoId) || {} })
      .then((v) => {
        if (!v.ok) {
          vozQueFallo.set(slug, v.mensaje);
          vozQueFalloEn.set(slug, Date.now());
        } else vozQueFallo.delete(slug);
      })
      .catch((e) => {
        vozQueFallo.set(slug, String(e.message || e));
        vozQueFalloEn.set(slug, Date.now());
      })
      .finally(() => eligiendoVoz.delete(slug));
  }
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
    // la tarjeta «Voz del narrador»: si lleva narrador, si ya se generó (no se cambia) y si la app no pudo elegirla
    voz: brief && defDe(brief)?.narrador ? { ...(brief.voz || {}), generada: existe(path.join(TEMP, slug, 'audio', 'voz.mp3')), eligiendo: eligiendoVoz.has(slug) && faltaVoz(brief), error: faltaVoz(brief) ? vozQueFallo.get(slug) || null : null, produccion: brief.produccion || null } : null,
    // «Agregar»: lo que entendio la IA del video y del pedido (el estilo, la duracion y lo que se conserva)
    plan: brief?.agregar?.plan || null,
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
    estiloNombre: brief?.agregar && brief.estilo !== 'agregar' ? `Agregar · ${ESTILOS[brief.estilo]?.nombre || brief.estilo}` : ESTILOS[brief?.estilo]?.nombre || brief?.estilo || null,
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
