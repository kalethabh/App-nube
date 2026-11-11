// FASE 2.2 — genera las imagenes de un anuncio a partir de su manifiesto.
//
//   node produccion/generar-imagenes.js temp/mi-anuncio            todas las tomas
//   node produccion/generar-imagenes.js temp/mi-anuncio --tomas 1,12   solo esas
//   node produccion/generar-imagenes.js temp/mi-anuncio --broll 9      solo la imagen de ese B-roll (ninguna
//                                     toma; las hojas que ya estan no se tocan, ni con --rehacer)
//   node produccion/generar-imagenes.js temp/mi-anuncio --solo-plan    no gasta nada
//   node produccion/generar-imagenes.js temp/mi-anuncio --si           sin preguntar
//   node produccion/generar-imagenes.js temp/mi-anuncio --rehacer      regenera lo ya hecho
//   node produccion/generar-imagenes.js temp/mi-anuncio --todo-el-broll  pide tambien las imagenes del
//                                     B-roll que no entra en el video con esta voz (ver brollQueEntran,
//                                     planear-montaje.js; sin audio/tiempos.json se piden todas)
//   node produccion/generar-imagenes.js temp/mi-anuncio --tapar-huecos solo tapa los huecos de
//                                     los iconos que ya estan en img/ (no genera ni cobra nada)
//
// Lo que ya esta en disco NO se vuelve a generar: si el proceso se corta a la
// mitad, al reanudar solo paga lo que falta.
//
// Como se piden (2026-10-24, para que el motor tarde menos): en un pool
// continuo, no en tandas. Siempre hay hasta CONCURRENCIA pedidos en marcha y,
// cuando uno termina, entra el siguiente que este LISTO, en el orden del plan.
// Las hojas de referencia van al MISMO pool que las tomas, y cada trabajo
// arranca apenas estan las imagenes que pide (dependenciasDelPlan): el frame
// final de una toma, apenas esta su frame inicial; una toma que pide una hoja,
// apenas esta esa hoja. Un fallo no frena lo que no depende de el: se termina
// todo lo demas y al final se informa junto. Una tarea que kie.ai sigue
// generando NUNCA se vuelve a pedir (se pagaria dos veces): se espera, y si
// pasa el tope queda anotada para retomarla al volver a correr.
//
// Estilos hablados (podcast y entrevista, tomas tipo H; ver
// ESPECIFICACION-podcast-entrevista.md, secciones 2 y 5):
//
//   - Una toma H con "frame_inicial" NO genera su frame: la imagen de esa
//     referencia (la hoja img/<id>.png, o la foto aportada convertida a png
//     con ffmpeg) se copia tal cual a img/toma-N-inicial.png. Cuesta cero, no
//     entra en el costo ni pide confirmacion. Si la hoja todavia no existe, se
//     genera en esta corrida y la copia espera a que termine, igual que los
//     frames heredados esperan al frame final del que salen.
//   - Una toma H sin "frame_inicial" genera su frame como una toma A (prompt +
//     referencias).
//   - Los iconos (entrevista) salen de gpt-image-2 a 1K, cuadrados (1:1) y con
//     fondo transparente; respaldo, el modelo de siempre. Despues de descargar
//     cada icono se le tapan los huecos semitransparentes que el modelo deja a
//     veces DENTRO de la figura (el centro de un sol, el cielo de una luna) con
//     produccion/tapar-huecos.py (Python con Pillow y numpy; si falta, aviso y
//     sigue); la imagen sin tapar va a historial/ y se anota "huecosTapados".
//     Despues se mide con ffmpeg si el PNG trae transparencia real y se anota
//     en img/log-modelos.json ("transparente": true/false): el montaje lo
//     muestra recortado si la trae y dentro de una tarjeta blanca si no.
//
// Nada de esto corre en otro estilo: un manifiesto sin tomas H y de otro
// estilo produce exactamente el mismo plan que antes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  MODELOS,
  PRECIOS,
  CONCURRENCIA,
  KIE,
  MODELO_IMAGEN_UGC,
  RESOLUCION_IMAGEN_UGC,
  modeloImagenDelEstilo,
  ESTILOS_HABLADOS,
  MODELO_IMAGEN_ICONOS,
  RESOLUCION_IMAGEN_ICONOS,
  creditosAUsd,
  cargarEnv,
  requerirClave,
} from './config.js';
import { generarImagen, subirArchivo, consultarCreditos, esSigueEnKie, esPagadaSinBajar, clasificarFallo } from './kie-client.js';
import { validarManifiesto } from './validar-manifiesto.js';
import {
  listaDeReferencias,
  esGenerada,
  esAportada,
  esFotoDelUsuario,
  esHojaDesdeArchivo,
  archivoDeHoja,
  archivoDeReferencia,
  tomaDelBroll,
} from './referencias.js';
import { problemaConFotograma, promptConFotograma, rutaLimpia } from './fotogramas.js';
import { clipDeBiblioteca, fotogramaDe, itemDeTrabajo, modoSinCobro } from './clips-sin-cobro.js';
import { anotarHojaDeReferencia } from './estado.js';
import { archivarSiExiste } from './historial.js';
import { repetidas } from './imagenes-repetidas.js';
import { tieneContinuidad, referenciasSoloDelBrollDescartado } from './continuidad.js';
import { brollQueEntranEnCarpeta, lineasBrollQueNoEntra } from './planear-montaje.js';
import { ELECCION_POR_DEFECTO, leerEleccion, cascadaImagen } from './modelos-elegidos.js';
import { buscarPython, comandoPython, comandoInstalar, paquetesQueFaltan, PAQUETES_PYTHON, CANDIDATOS_PYTHON } from './recortar-host.js';

const REINTENTOS = 3;
const RESOLUCION = '1K';

/**
 * Iconos: por debajo de este valor del canal alfa (0 = invisible, 255 =
 * opaco) un pixel cuenta como transparente. Un icono con fondo transparente de
 * verdad tiene el fondo en 0; se deja margen porque algun modelo deja el fondo
 * casi en cero en vez de en cero. Un PNG sin canal alfa da 255 en todos.
 */
const ALFA_TRANSPARENTE_MAX = 128;

/**
 * Iconos con huecos (decision 14): el script que los tapa. Python se busca y
 * se corre IGUAL que en el recorte del host y en npm run verificar (seccion
 * 8), con buscarPython() de recortar-host.js: los mismos candidatos en el
 * mismo orden (en Windows "python", "py -3", "python3"; en macOS y Linux
 * "python3", "python"), el primer Python 3 que responde (el atajo de la
 * Microsoft Store y Python 2 no cuentan), detectado una sola vez por proceso,
 * y con -E -P (solo -E antes de Python 3.11, que no conoce -P), NO con -I: -I
 * deja fuera los paquetes instalados con pip --user, que es donde pip los pone
 * en un Python instalado para todos, y el alumno los instalaba y el motor
 * seguia diciendo que faltaban. -E no lee las variables PYTHON* y -P no carga
 * nada de la carpeta del script ni de la actual. Asi el comando de instalacion
 * que se imprime (comandoInstalar) es para ese mismo Python, el que revisa
 * verificar.
 */
const SCRIPT_TAPAR_HUECOS = fileURLToPath(new URL('./tapar-huecos.py', import.meta.url));
/** Los paquetes que necesita tapar-huecos.py, con su nombre de pip (pillow, numpy). */
const PAQUETES_ICONOS = PAQUETES_PYTHON.iconos.map(([, pip]) => pip);

/** Una toma H que copia su frame inicial de una referencia ("frame_inicial" con id). */
const copiaSuFrame = (t) => t.tipo === 'H' && typeof t.frame_inicial === 'string' && t.frame_inicial.trim().length > 0;

// ---------------------------------------------------------------- plan

/**
 * Convierte el manifiesto en una lista plana de imagenes a generar, en orden.
 * Con `soloBroll: [n]`, solo las hojas y las imagenes de esos B-roll (ninguna
 * toma ni icono): rehacer UN B-roll (la revision de los clips de la app).
 */
export function construirPlan(m, { soloTomas, soloBroll = null, eleccion = ELECCION_POR_DEFECTO } = {}) {
  const trabajos = [];

  // Anuncio por bloques (UGC tipo R): sus hojas se generan con un modelo
  // propio (ver MODELO_IMAGEN_UGC en config.js) y el de siempre de respaldo.
  // Sin tomas R, los trabajos salen exactamente igual que antes.
  const hayR = (m.tomas || []).some((t) => t.tipo === 'R');

  // Cascada de imagen del estilo (config.js): MODELO_IMAGEN_POR_DEFECTO, GPT
  // Image 2.5 Sunburst a 2K para todos desde el 2026-10-24, salvo que el estilo
  // tenga su excepcion en MODELO_IMAGEN_POR_ESTILO. TODAS sus imagenes llevan
  // esa cascada y sus resoluciones.
  //
  // MODELOS ELEGIDOS (2026-11-08): si el anuncio eligio otro modelo de imagen
  // en Ajustes > Modelos (temp/<slug>/modelos.json), TODAS sus imagenes van
  // con esa cascada: hojas (tambien las de UGC), frames y B-roll. Los iconos
  // no cambian. Con la eleccion de siempre, todo como antes.
  const imagenElegida = eleccion && eleccion.imagen && eleccion.imagen !== ELECCION_POR_DEFECTO.imagen ? cascadaImagen(eleccion) : null;
  const delEstilo = imagenElegida ?? modeloImagenDelEstilo(m.estilo);

  // Con continuidad no hay B-roll: una hoja generada que SOLO usaba el B-roll
  // descartado (continuidad.broll_descartado) no tiene quien la use y no se
  // genera. Sin continuidad no se salta ninguna.
  const soloDelDescartado = tieneContinuidad(m) ? referenciasSoloDelBrollDescartado(m) : null;

  // Las referencias generadas van PRIMERO, todas, en el orden de la lista.
  // Las aportadas por el usuario no se generan: ya existen en disco.
  for (const r of listaDeReferencias(m).filter(esGenerada)) {
    if (soloDelDescartado?.has(r.id)) continue;
    // Una hoja se genera desde su prompt y nada mas... SALVO que declare
    // `generar_desde_archivo: true`, y entonces entra tambien la foto del
    // usuario como imagen de partida.
    //
    // Que la referencia se pida por su PROPIO id no es un truco: cuando este
    // trabajo corre, la clave ya tiene la URL de la foto subida (las aportadas
    // se suben antes de lanzar el pool, ver el CLI), y recien se sobrescribe
    // con la hoja cuando esta termina de generarse. Por eso las tomas que piden
    // esa hoja la esperan (dependenciasDelPlan): antes, la clave es la foto.
    const desdeArchivo = esHojaDesdeArchivo(r);
    // Una hoja tambien puede pedir OTRAS hojas que esten antes en la lista
    // (historias musicales, 2026-09-14: "protagonista_despues" se genera con
    // la hoja de "protagonista_antes" adjunta, para que sea la misma persona
    // con el cambio fisico). Las hojas van en paralelo, pero una que pide otra
    // espera a que esa termine (dependenciasDelPlan), asi que la pedida ya
    // tiene URL cuando le toca a esta. El validador exige que este antes.
    const otrasHojas = Array.isArray(r.referencias) ? r.referencias.filter((x) => x !== r.id) : [];
    trabajos.push({
      id: r.id,
      clase: 'referencia',
      archivo: archivoDeHoja(r),
      prompt: r.prompt,
      fotograma: r.fotograma || null,
      referencias: [...(desdeArchivo ? [r.id] : []), ...otrasHojas],
      descripcion:
        `hoja de referencia "${r.id}"${r.tipo ? ` (${r.tipo})` : ''}` +
        (desdeArchivo ? ` — generada A PARTIR DE ${r.archivo}` : '') +
        (otrasHojas.length ? ` — con ${otrasHojas.join(', ')} como referencia` : '') +
        ' — se reusa en todas las tomas que la pidan',
      ...(hayR && !imagenElegida
        ? {
            cascada: [MODELO_IMAGEN_UGC, MODELOS.imagen.principal],
            resoluciones: { [MODELO_IMAGEN_UGC]: RESOLUCION_IMAGEN_UGC },
          }
        : delEstilo),
    });
  }

  const tomas = soloBroll ? [] : soloTomas ? m.tomas.filter((t) => soloTomas.includes(t.n)) : m.tomas;

  // QUE REFERENCIAS SOBREVIVEN AL FRAME FINAL DE UNA TOMA TIPO B (§2.8.1).
  //
  // Se distinguen por su ORIGEN, no por su "tipo": el tipo es descriptivo y el
  // motor no ramifica por el (decision 3.2). Hay tres origenes y DOS de ellos
  // se conservan, por razones distintas:
  //
  //   1. La foto real del usuario (solo `archivo`)  -> SE CONSERVA.
  //      No arrastra encuadre, y su fidelidad es lo unico que se degrada al
  //      regenerar.
  //   2. La hoja generada desde un prompt (solo `prompt`) -> SE SACA.
  //      Suele ser un plano medio; mandada al frame final, el modelo arrastra
  //      ese encuadre y devuelve al personaje en la misma pose. Es la regla
  //      §2.8.1 entera.
  //   3. La hoja generada DESDE la foto (`generar_desde_archivo: true`)
  //      -> SE CONSERVA, y esto es una decision, no un efecto lateral de que
  //      la entrada tenga un `archivo`. Esa hoja existe justamente para fijar
  //      la apariencia del personaje entre tomas; sacarla del frame final
  //      seria quitarla del unico frame donde mas se nota que se mueva (los
  //      dos extremos del mismo clip).
  //
  // Para cualquier manifiesto que NO use el caso 3 este conjunto es identico
  // al de antes: esFotoDelUsuario() coincide con esAportada() cuando no hay
  // ninguna hoja-desde-archivo declarada.
  const conservaEnFrameFinal = new Set(
    listaDeReferencias(m)
      .filter((r) => esFotoDelUsuario(r) || esHojaDesdeArchivo(r))
      .map((r) => r.id)
  );

  for (const t of tomas) {
    // Bloque UGC tipo R: solo referencias, cero frames. El video se pide con
    // las hojas y la foto del producto como image_urls (generar-videos.js):
    // aqui no hay nada que generar para esta toma.
    if (t.tipo === 'R') continue;

    if (copiaSuFrame(t)) {
      // Toma hablada (H) con "frame_inicial": el frame inicial ES esa
      // referencia, tal cual (podcast: "host-a" / "host-b"; o una foto
      // aportada). Se copia img/<id>.png (hoja) o la foto convertida a png con
      // ffmpeg. Cuesta cero: no entra en el costo ni pide confirmacion. Si la
      // hoja aun no existe, se genera en esta corrida y la copia espera a que
      // termine (dependenciasDelPlan), igual que los heredados. Las
      // referencias ya estan dentro de esa imagen; al video de
      // una H nunca van (Omni no acepta frame inicial y referencias a la vez).
      const ref = listaDeReferencias(m).find((r) => r.id === t.frame_inicial);
      const origen = ref ? archivoDeReferencia(ref) : null;
      trabajos.push({
        id: `toma-${t.n}-inicial`,
        clase: 'copia-de-referencia',
        n: t.n,
        archivo: `toma-${t.n}-inicial.png`,
        // Relativo a la carpeta del anuncio (img/host-a.png, producto.jpg).
        copiarDe: origen,
        copiarDeId: t.frame_inicial,
        prompt: null,
        referencias: [],
        descripcion:
          `toma ${t.n} (H) frame inicial — copia de la referencia "${t.frame_inicial}"` +
          `${origen ? ` (${origen})` : ''} (no se genera, no se paga)`,
      });
    } else if (t.frame_inicial === 'heredado') {
      // Regla 4 de la skill de UGC: el frame inicial NO se genera, es el frame
      // final de la escena anterior. Se copia el archivo tal cual: cuesta cero
      // y garantiza continuidad exacta.
      trabajos.push({
        id: `toma-${t.n}-inicial`,
        clase: 'heredado',
        n: t.n,
        archivo: `toma-${t.n}-inicial.png`,
        copiarDe: `toma-${t.n - 1}-final.png`,
        copiarDeId: `toma-${t.n - 1}-final`,
        prompt: null,
        referencias: [],
        descripcion: `toma ${t.n} frame inicial — heredado de la toma ${t.n - 1} (no se genera, no se paga)`,
      });
    } else {
      trabajos.push({
        id: `toma-${t.n}-inicial`,
        clase: 'toma',
        n: t.n,
        archivo: `toma-${t.n}-inicial.png`,
        prompt: t.prompt_imagen_inicial,
        fotograma: t.fotograma || null,
        referencias: t.referencias || [],
        descripcion: `toma ${t.n} (${t.tipo}) frame inicial`,
        ...delEstilo,
      });
    }

    if (t.tipo === 'B') {
      // QUE REFERENCIA LLEVA EL FRAME FINAL. No es un detalle.
      //
      // El frame inicial de la escena va SIEMPRE (regla 10.4 de la skill): es
      // lo que hace que el final sea una evolucion de esa misma toma.
      //
      // En dialogo_nativo, ademas, se filtran las referencias segun su origen:
      // que se conserva y que se saca esta razonado arriba, en
      // `conservaEnFrameFinal`. En resumen: la hoja generada solo desde un
      // prompt se saca porque arrastra su encuadre al frame final y lo deja
      // estatico; la foto del usuario y la hoja generada desde esa foto se
      // conservan.
      //
      // No tocar en voz_en_off: ahi la hoja en el frame final acerto 40 de 40
      // imagenes en el piloto de crochet, y esa rama pasa la lista entera.
      const heredadas =
        m.modo_audio === 'dialogo_nativo'
          ? (t.referencias || []).filter((r) => conservaEnFrameFinal.has(r))
          : [...(t.referencias || [])];

      trabajos.push({
        id: `toma-${t.n}-final`,
        clase: 'toma',
        n: t.n,
        archivo: `toma-${t.n}-final.png`,
        prompt: t.prompt_imagen_final,
        fotograma: t.fotograma_final || null,
        referencias: [...heredadas, 'frame_inicial_de_esta_toma'],
        descripcion: `toma ${t.n} (B) frame final`,
        ...delEstilo,
      });
    }
  }

  const brolls = soloBroll
    ? (m.broll || []).filter((b) => soloBroll.includes(b.n))
    : soloTomas
      ? (m.broll || []).filter((b) => soloTomas.includes(tomaDelBroll(b)))
      : m.broll || [];
  for (const b of brolls) {
    trabajos.push({
      id: `broll-${b.n}`,
      clase: 'broll',
      n: b.n,
      archivo: `broll-${b.n}.png`,
      prompt: b.prompt_imagen,
      fotograma: b.fotograma || null,
      referencias: b.referencias || [],
      // La toma junto a la que va (despues o encima): de ella sale su "frame_anterior".
      deToma: tomaDelBroll(b),
      descripcion: `B-roll ${b.n} (toma ${tomaDelBroll(b)})`,
      ...delEstilo,
    });
  }

  // Iconos (entrevista; solo en ESTILOS_HABLADOS): un trabajo por icono de
  // cada grupo, archivo img/<id>.png, con MODELO_IMAGEN_ICONOS (gpt-image-2) a
  // 1K, cuadrado y con fondo transparente (contrato, seccion 5). De respaldo,
  // el modelo de siempre: ese ignora el fondo, y por eso el montaje mira
  // "transparente" en log-modelos.json y mete el icono en una tarjeta blanca
  // si hace falta. Con --tomas, solo los grupos que van sobre esas tomas.
  // Fuera de estos estilos no hay iconos y esto no agrega nada.
  if (ESTILOS_HABLADOS.includes(m.estilo) && !soloBroll) {
    const grupos = (Array.isArray(m.iconos) ? m.iconos : []).filter(
      (g) => g && typeof g === 'object' && (!soloTomas || soloTomas.includes(g.toma))
    );
    for (const g of grupos) {
      for (const ic of Array.isArray(g.iconos) ? g.iconos : []) {
        if (!ic || typeof ic.id !== 'string' || !ic.id.trim()) continue;
        trabajos.push({
          id: ic.id,
          clase: 'icono',
          grupo: g.grupo,
          toma: g.toma,
          archivo: `${ic.id}.png`,
          prompt: ic.prompt,
          referencias: [],
          descripcion: `icono "${ic.id}" (grupo "${g.grupo}", toma ${g.toma}) — 1:1, fondo transparente`,
          cascada: [MODELO_IMAGEN_ICONOS, MODELOS.imagen.principal],
          resoluciones: { [MODELO_IMAGEN_ICONOS]: RESOLUCION_IMAGEN_ICONOS, [MODELOS.imagen.principal]: RESOLUCION },
          aspectRatio: '1:1',
          fondo: 'transparente',
        });
      }
    }
  }

  return trabajos;
}

// ---------------------------------------------------------------- copias y transparencia

/**
 * Convierte una imagen (jpg, webp...) a PNG con ffmpeg, gratis. Escribe a un
 * temporal y despues renombra: una imagen a medio escribir nunca queda en img/.
 */
function convertirAPng(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = path.join(path.dirname(destino), `.${path.basename(destino, '.png')}.tmp.png`);
  try {
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', origen, '-frames:v', '1', tmp], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    const detalle = String(e.stderr || e.message || '').trim().split(/\r?\n/).slice(-2).join(' ');
    throw new Error(`no pude convertir ${path.basename(origen)} a png (ffmpeg: ${detalle})`);
  }
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size === 0) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`ffmpeg no devolvio ninguna imagen al convertir ${path.basename(origen)} a png`);
  }
  fs.renameSync(tmp, destino);
  return destino;
}

/**
 * Copia un PNG a un temporal y despues lo renombra, igual que convertirAPng:
 * con "npm run producir" el proceso de videos lee img/ MIENTRAS este genera, y
 * un frame copiado a medias que el lea se subiria cortado a kie.ai (y se
 * pagaria el clip). El rename en la misma carpeta es de una sola vez.
 */
function copiarEntero(origen, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = path.join(path.dirname(destino), `.${path.basename(destino, '.png')}.tmp.png`);
  try {
    fs.copyFileSync(origen, tmp);
    fs.renameSync(tmp, destino);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return destino;
}

/**
 * Toma H con "frame_inicial": deja en img/toma-N-inicial.png la imagen de su
 * referencia (trabajo.copiarDe, relativo a la carpeta del anuncio). Una hoja ya
 * es png y se copia; una foto aportada se convierte con ffmpeg. Si habia una
 * copia anterior, va a historial/. Solo archivos: no sube nada ni cobra nada.
 * Devuelve la ruta del archivo escrito.
 */
export function copiarFrameDeReferencia(trabajo, { carpeta, dirImg }) {
  if (!trabajo.copiarDe) {
    throw new Error(
      `${trabajo.descripcion}: la referencia "${trabajo.copiarDeId}" no esta en la lista de referencias, o no es una hoja (prompt) ni una foto (archivo).`
    );
  }
  const origen = path.join(carpeta, trabajo.copiarDe);
  if (!fs.existsSync(origen)) {
    throw new Error(
      `${trabajo.descripcion}: no encuentro ${trabajo.copiarDe}.\n` +
        '  Si es una hoja generada, se genera en esta misma corrida antes que las tomas (sin limitar con --tomas no puede faltar);\n' +
        '  si es una foto, dejala lista con preparar-producto.js.'
    );
  }
  const destino = path.join(dirImg, trabajo.archivo);
  archivarSiExiste(destino, carpeta);
  if (path.extname(origen).toLowerCase() === '.png') copiarEntero(origen, destino);
  else convertirAPng(origen, destino);
  return destino;
}

/**
 * Mide si un PNG trae transparencia REAL (iconos, contrato seccion 5): ffmpeg
 * lo pasa a rgba (un PNG sin canal alfa queda con alfa 255 en todo), extrae
 * el alfa (alphaextract) y signalstats da su minimo (YMIN). Un fondo
 * transparente deja pixeles en 0; por debajo de ALFA_TRANSPARENTE_MAX cuenta.
 *
 * Nunca lanza: si ffmpeg falla o no se puede leer, devuelve transparente:
 * false con el motivo (el montaje lo muestra en tarjeta blanca y listo).
 * Devuelve { transparente, alfaMinimo (0-255 o null), error? }.
 */
export function medirTransparencia(rutaPng) {
  try {
    const r = spawnSync(
      'ffmpeg',
      ['-hide_banner', '-nostdin', '-i', rutaPng, '-vf', 'format=rgba,alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YMIN:file=-', '-f', 'null', '-'],
      { encoding: 'utf8' }
    );
    const salida = `${r.stdout || ''}\n${r.stderr || ''}`;
    const mm = salida.match(/lavfi\.signalstats\.YMIN=(\d+)/);
    if (!mm) {
      const detalle = String(r.stderr || r.error?.message || '').trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || 'ffmpeg no devolvio YMIN';
      return { transparente: false, alfaMinimo: null, error: detalle };
    }
    const alfaMinimo = Number(mm[1]);
    return { transparente: alfaMinimo < ALFA_TRANSPARENTE_MAX, alfaMinimo };
  } catch (e) {
    return { transparente: false, alfaMinimo: null, error: e.message };
  }
}

/** La ultima linea de stdout que sea un objeto JSON (lo que imprime tapar-huecos.py), o null. */
function ultimoJson(texto) {
  const lineas = String(texto || '').trim().split(/\r?\n/).reverse();
  for (const l of lineas) {
    if (!l.trim().startsWith('{')) continue;
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Iconos con huecos (decision 14; solo clase icono, que solo existe en los
 * estilos hablados): gpt-image-2 a veces deja una mancha SEMITRANSPARENTE
 * dentro de la figura (el centro de un sol, el cielo de una luna) y sobre el
 * video se ve la calle a traves. produccion/tapar-huecos.py la rellena con el
 * color de alrededor; no toca los huecos totalmente transparentes (pueden ser a
 * proposito: un anillo, un asa) ni las zonas translucidas grandes respecto de
 * la figura (las informa). El detalle del algoritmo esta en el script.
 *
 * Si tapo algo, la imagen tal como vino del modelo va a
 * historial/<nombre>-sin-tapar--<fecha>.png y la tapada queda en su lugar (el
 * script escribe a un temporal y aca se renombra: nunca queda una imagen a
 * medio escribir en img/).
 *
 * Nunca lanza: sin Python o sin sus paquetes (Pillow, numpy) el icono queda
 * como vino y se devuelve huecosTapados: null con el motivo. Se usa UN solo
 * Python, el de buscarPython() (el mismo que revisa npm run verificar y para
 * el que se imprime el comando de instalacion): si ese no tiene los paquetes,
 * no se prueba otro.
 * Devuelve { huecosTapados (pixeles; 0 = no habia; null = no se pudo revisar),
 * sinTapar? (relativo a la carpeta del anuncio), regiones?, respetadas?, error? }.
 */
export function taparHuecosIcono(rutaPng, carpeta) {
  const dir = path.dirname(rutaPng);
  const base = path.basename(rutaPng, path.extname(rutaPng));
  const tmp = path.join(dir, `.${base}.tapado.tmp.png`);
  try {
    const python = buscarPython();
    if (!python) {
      return { huecosTapados: null, error: `no encontre Python 3 instalado; probe ${CANDIDATOS_PYTHON.map((p) => p.join(' ')).join(', ')}` };
    }
    const nombre = comandoPython(python);
    fs.rmSync(tmp, { force: true });
    const r = spawnSync(python.cmd, [...python.pre, ...python.banderas, SCRIPT_TAPAR_HUECOS, rutaPng, tmp], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
    });
    if (r.error) return { huecosTapados: null, error: `${nombre}: ${r.error.message}` };
    const res = ultimoJson(r.stdout);
    if (!res) {
      // Sin JSON: el script no llego a responder (se corto o fallo antes).
      const detalle = String(r.stderr || r.stdout || '').trim().split(/\r?\n/).filter(Boolean).slice(-1)[0];
      return { huecosTapados: null, error: `"${nombre}" no respondio (codigo ${r.status}${detalle ? `: ${detalle.slice(0, 160)}` : ''})` };
    }
    // Sin Pillow o numpy (res.faltan) u otro error del script.
    if (res.error) return { huecosTapados: null, error: `${nombre}: ${res.error}` };
    const tapados = Number(res.pixelesTapados) || 0;
    const respetadas = Array.isArray(res.respetadas) ? res.respetadas : [];
    if (tapados <= 0) return { huecosTapados: 0, respetadas };
    if (!fs.existsSync(tmp)) return { huecosTapados: null, error: `${nombre}: dijo que tapo ${tapados} pixeles pero no dejo la imagen` };
    // Primero la copia sin tapar en historial/, despues la tapada en su lugar:
    // si algo falla a la mitad, img/ sigue teniendo un icono entero.
    const historial = path.join(carpeta, 'historial');
    fs.mkdirSync(historial, { recursive: true });
    const sello = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const sinTapar = path.join(historial, `${base}-sin-tapar--${sello}.png`);
    fs.copyFileSync(rutaPng, sinTapar);
    try {
      fs.renameSync(tmp, rutaPng);
    } catch (e) {
      fs.rmSync(sinTapar, { force: true });
      throw e;
    }
    return {
      huecosTapados: tapados,
      sinTapar: path.relative(carpeta, sinTapar).split(path.sep).join('/'),
      regiones: Array.isArray(res.tapadas) ? res.tapadas : [],
      respetadas,
    };
  } catch (e) {
    return { huecosTapados: null, error: e.message };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Campos de img/log-modelos.json de un icono: huecos (taparHuecosIcono) y transparencia (medirTransparencia). */
function camposDeIcono(huecos, transparencia) {
  return {
    ...(huecos
      ? {
          huecosTapados: huecos.huecosTapados,
          ...(huecos.sinTapar ? { sinTapar: huecos.sinTapar, huecosRegiones: huecos.regiones } : {}),
          ...(huecos.respetadas?.length ? { huecosRespetados: huecos.respetadas } : {}),
          ...(huecos.error ? { huecosError: huecos.error } : {}),
        }
      : {}),
    ...(transparencia
      ? {
          transparente: transparencia.transparente,
          alfaMinimo: transparencia.alfaMinimo,
          ...(transparencia.error ? { transparenciaError: transparencia.error } : {}),
        }
      : {}),
  };
}

/** Lo que se dice de los huecos de un icono en la linea "OK" de la corrida. */
function textoDeHuecos(huecos) {
  if (!huecos) return '';
  if (huecos.huecosTapados === null) return '  [OJO: no pude revisar si tiene huecos]';
  const cuantos = (motivo) => (huecos.respetadas || []).filter((h) => h.motivo === motivo).length;
  return [
    huecos.huecosTapados > 0 ? `[hueco(s) tapado(s): ${huecos.huecosTapados} px; sin tapar en ${huecos.sinTapar}]` : '',
    cuantos('grande') ? `[OJO: ${cuantos('grande')} zona(s) translucida(s) grande(s) sin tapar: miralo]` : '',
    cuantos('transparente') ? `[${cuantos('transparente')} hueco(s) totalmente transparente(s): no se tocan]` : '',
  ]
    .filter(Boolean)
    .map((s) => `  ${s}`)
    .join('');
}

// ---------------------------------------------------------------- referencias

/**
 * URL de un frame ya generado. Primero mira lo hecho en esta corrida; si no
 * esta, lo busca en disco y lo sube.
 *
 * El segundo camino importa: al reanudar una corrida a medias, los frames que
 * ya estaban en disco se filtran del plan y nunca se registran. Sin esta caida
 * a disco, un frame final que pide "frame_inicial_de_esta_toma" moria con
 * "falta el frame inicial de su propia toma" aunque el archivo estuviera ahi.
 * En voz_en_off casi no se notaba; en dialogo_nativo TODAS las tomas son Tipo B
 * y lo piden siempre.
 */
async function urlDeFrame(ctx, id) {
  if (ctx.urlsPorId.has(id)) return ctx.urlsPorId.get(id);
  const ruta = path.join(ctx.dirImg, `${id}.png`);
  if (!fs.existsSync(ruta)) return null;
  const url = await subirArchivo(ruta);
  ctx.urlsPorId.set(id, url);
  return url;
}

/**
 * "frame_anterior" de cada trabajo: el frame que va JUSTO ANTES en el orden del
 * manifiesto (el plan completo, sin --tomas), sin contar hojas ni iconos. Para
 * una toma es el ultimo frame de la toma n-1 (el final si es tipo B).
 *
 * Antes era "el ultimo que termino" (ctx.urlUltimoFrame), que con concurrencia
 * no era determinista (ESTADO-ACTUAL 4.5.1): una toma 5 podia recibir el frame
 * de la toma 1. Ahora se resuelve por id, como "frame_inicial_de_esta_toma", y
 * no depende del orden de llegada. Se mira el plan completo para que --tomas 5
 * use el frame de la toma 4 que ya esta en disco, y no el de otra toma de la
 * corrida (o ninguno, que antes paraba con "no hay ninguno generado antes").
 *
 * Un B-roll va despues (o encima) de SU toma, y en el plan los B-roll van todos
 * al final: "justo antes en el plan" le daria el frame de la ultima toma del
 * anuncio. Su frame anterior es el ultimo frame de su toma (deToma), que es el
 * que se ve antes que el en el montaje.
 */
export function framesAnteriores(planCompleto) {
  const anterior = new Map();
  const ultimoDeToma = new Map(); // n de la toma -> su ultimo frame (el final si es tipo B)
  let previo = null;
  for (const t of planCompleto) {
    if (t.clase === 'referencia' || t.clase === 'icono') continue;
    const deSuToma = t.clase === 'broll' ? ultimoDeToma.get(t.deToma) : null;
    if (deSuToma || previo) anterior.set(t.id, deSuToma || previo);
    if (t.clase !== 'broll' && Number.isInteger(t.n)) ultimoDeToma.set(t.n, t);
    previo = t;
  }
  return anterior;
}

/**
 * Traduce las referencias del manifiesto a URLs concretas.
 * Este es el corazon de la consistencia: el personaje generado una sola vez y
 * la foto real del producto se reenvian en cada toma que las pida.
 *
 * Devuelve tambien, en el mismo orden, el ARCHIVO LOCAL de cada una (para la
 * huella del pedido, ver huellaDeImagen); undefined si no se sabe cual es.
 */
async function resolverReferencias(trabajo, ctx) {
  const urls = [];
  const usadas = [];
  const archivos = [];

  for (const r of trabajo.referencias) {
    if (r === 'frame_anterior') {
      const anterior = ctx.anteriorDe?.get(trabajo.id);
      if (!anterior) throw new Error(`${trabajo.id} pide el frame anterior pero no hay ninguno antes en el manifiesto`);
      const url = await urlDeFrame(ctx, anterior.id);
      if (!url) {
        throw new Error(
          `${trabajo.id} pide el frame anterior (${anterior.archivo}) y no esta.\n` +
            `  No esta en esta corrida ni en ${path.join(ctx.dirImg, anterior.archivo)}`
        );
      }
      urls.push(url);
      usadas.push('frame_anterior');
      archivos.push(path.join(ctx.dirImg, anterior.archivo));
    } else if (r === 'frame_inicial_de_esta_toma') {
      const url = await urlDeFrame(ctx, `toma-${trabajo.n}-inicial`);
      if (!url) {
        throw new Error(
          `${trabajo.id}: falta el frame inicial de su propia toma.\n` +
            `  No esta en esta corrida ni en ${path.join(ctx.dirImg, `toma-${trabajo.n}-inicial.png`)}`
        );
      }
      urls.push(url);
      usadas.push('frame inicial');
      archivos.push(path.join(ctx.dirImg, `toma-${trabajo.n}-inicial.png`));
    } else {
      // Cualquier otro valor es el id de una referencia de la lista.
      const url = ctx.urlsDeReferencias.get(r);
      if (!url) {
        throw new Error(
          `${trabajo.id} pide la referencia "${r}" y no esta disponible.\n` +
            `  Referencias listas: ${[...ctx.urlsDeReferencias.keys()].join(', ') || '(ninguna)'}`
        );
      }
      urls.push(url);
      usadas.push(r);
      archivos.push(ctx.archivosDeReferencias?.get(r));
    }
  }

  // El fotograma del subestilo, sin texto, va ULTIMO (ver fotogramas.js).
  if (trabajo.fotograma) {
    const problema = problemaConFotograma(trabajo.fotograma);
    if (problema) throw new Error(`${trabajo.id}: "fotograma" ${problema}`);
    const limpia = rutaLimpia(trabajo.fotograma);
    urls.push(await subirArchivo(limpia));
    usadas.push(`fotograma ${path.basename(trabajo.fotograma)}`);
    archivos.push(limpia);
  }

  return { urls, usadas, archivos };
}

// ---------------------------------------------------------------- huella del pedido

/** sha1 del CONTENIDO de un archivo, cacheado por ruta, tamano y fecha (una hoja la piden muchas tomas). */
function sha1DeArchivo(ruta, cache) {
  const st = fs.statSync(ruta);
  const clave = `${ruta}|${st.size}|${st.mtimeMs}`;
  let h = cache.get(clave);
  if (!h) {
    h = crypto.createHash('sha1').update(fs.readFileSync(ruta)).digest('hex');
    cache.set(clave, h);
  }
  return h;
}

/**
 * Huella de un pedido de imagen (contrato con kie-client.js): con ella,
 * generarImagen retoma una tarea que quedo en kie.ai de una corrida anterior
 * (img/<archivo>.kie-pendiente.json) en vez de pedir y pagar otra. Va el
 * modelo, el prompt que se manda, el aspecto, la resolucion, el fondo si lo hay
 * y el sha1 del CONTENIDO de cada imagen de entrada, en orden. Nunca las URLs:
 * cambian en cada corrida (cada subida da una nueva) y la huella no coincidiria
 * nunca. Si cambia el prompt o se regenera una hoja que entra, la huella cambia
 * y se pide de nuevo, que es lo correcto.
 *
 * null si falta el archivo local de alguna entrada: sin huella, generarImagen
 * hace lo de siempre (no deja pendiente ni retoma nada).
 */
export function huellaDeImagen({ modelo, prompt, aspecto, resolucion, fondo = null, archivos }, cache = new Map()) {
  if (!archivos.every((a) => a && fs.existsSync(a))) return null;
  const entradas = archivos.map((a) => sha1DeArchivo(a, cache));
  return crypto
    .createHash('sha1')
    .update(JSON.stringify({ modelo, prompt, aspecto, resolucion, ...(fondo ? { fondo } : {}), entradas }))
    .digest('hex');
}

/** La tarea que dejo anotada kie-client.js para esta imagen (contrato), o null. */
function leerPendiente(destino) {
  try {
    const p = JSON.parse(fs.readFileSync(`${destino}.kie-pendiente.json`, 'utf8'));
    return p && typeof p === 'object' && p.huella ? p : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- generacion

/**
 * Una tarea que kie.ai sigue generando pasado el tope de espera (o que no se
 * pudo consultar durante minutos): este trabajo falla, pero NO se reintenta ni
 * se pasa al respaldo. Pedir otra seria pagar dos veces si la primera termina.
 * La tarea queda anotada (img/<archivo>.kie-pendiente.json, lo hace
 * kie-client.js) y la proxima corrida la retoma.
 */
function errorSigueEnKie(trabajo, e) {
  const err = new Error(
    `${trabajo.descripcion}: la tarea ${e.taskId || '(sin id)'} sigue en kie.ai y no termino.\n` +
      `  Motivo: ${String(e.message).split(/\r?\n/)[0]}\n` +
      '  No se pidio otra igual, para no pagar dos veces. Al volver a correr el mismo comando (sin --rehacer)\n' +
      '  se retoma ESA misma tarea: si ya termino, solo se descarga.\n' +
      `  Si kie.ai la sigue teniendo trabada horas despues, borrar img/${trabajo.archivo}.kie-pendiente.json\n` +
      '  hace que se pida otra (si la primera terminara igual, se cobrarian las dos).'
  );
  err.trabajo = trabajo;
  err.sigueEnKie = true;
  err.taskId = e.taskId;
  return err;
}

/**
 * Una tarea que termino bien en kie.ai (ya cobrada) y cuyo resultado no se pudo
 * bajar (esPagadaSinBajar, ver kie-client.js): ni reintento ni respaldo, que
 * pedirian y pagarian otra. El mensaje de kie-client ya dice si al volver a
 * correr se baja esa misma o se pide una nueva.
 */
function errorPagadaSinBajar(trabajo, e, ctx) {
  const err = new Error(
    `${trabajo.descripcion}: ${e.message}\n` +
      '  No se reintento ni se paso al modelo de respaldo: los dos pedirian (y pagarian) otra.\n' +
      `  El mismo comando, sin --rehacer:  npm run imagenes -- ${ctx.carpetaArg}${ctx.soloTomas ? ` --tomas ${ctx.soloTomas.join(',')}` : ''}${ctx.soloBroll ? ` --broll ${ctx.soloBroll.join(',')}` : ''}${ctx.todoElBroll ? ' --todo-el-broll' : ''}`
  );
  err.trabajo = trabajo;
  err.pagadaSinBajar = true;
  err.taskId = e.taskId;
  return err;
}

/**
 * Genera una imagen con reintentos y cascada de modelos (seccion 6 de la
 * especificacion).
 *
 * Que se hace segun el fallo (clasificarFallo de kie-client.js):
 *   - contenido (politicas): el mismo prompt va a fallar igual, asi que no se
 *     gastan los otros intentos con ese modelo: pasa directo al siguiente de la
 *     cascada. Si era el ultimo, falla. Los rechazos no cobran.
 *   - sigue en kie (esSigueEnKie): ni reintento ni respaldo (errorSigueEnKie).
 *   - termino y no se pudo bajar (esPagadaSinBajar): tampoco; ya se cobro.
 *   - lo demas (servidor, otro): hasta REINTENTOS veces con ese modelo, como
 *     siempre, y despues el siguiente.
 */
async function generarConCascada(trabajo, ctx, log) {
  const { urls: referencias, usadas, archivos } = await resolverReferencias(trabajo, ctx);
  const destino = path.join(ctx.dirImg, trabajo.archivo);
  // Con --rehacer, la imagen anterior se archiva en vez de perderse.
  const archivado = archivarSiExiste(destino, ctx.carpeta);
  if (archivado) console.log(`      (la imagen anterior se guardo en historial/${path.basename(archivado)})`);

  // Cada trabajo trae su cascada y resolucion (ver construirPlan): la del estilo
  // (Sunburst 2K), la de las hojas UGC o la de los iconos. El par de
  // MODELOS.imagen queda solo para un trabajo que no traiga ninguna.
  const cascada = trabajo.cascada || [MODELOS.imagen.principal, MODELOS.imagen.respaldo];
  const fallos = [];
  let ultimaClase = null;

  // Los iconos van cuadrados (1:1) y con fondo transparente (solo el adaptador
  // de gpt-image-2 lo manda). Todo lo demas va con el aspecto del anuncio y
  // sin "fondo": el cuerpo de siempre.
  const aspecto = trabajo.aspectRatio || ctx.aspectRatio;
  const resolucionDe = (modelo) => trabajo.resoluciones?.[modelo] || RESOLUCION;
  const huellaDe = (modelo) =>
    huellaDeImagen(
      { modelo, prompt: promptConFotograma(trabajo.prompt, trabajo.fotograma), aspecto, resolucion: resolucionDe(modelo), fondo: trabajo.fondo || null, archivos },
      ctx.sha1s
    );

  // Una tarea que quedo en kie.ai de una corrida anterior se retoma con el
  // MISMO modelo con que se pidio: si fue con el de respaldo y se empezara por
  // el principal, la huella no coincidiria y se pediria (y pagaria) otra. La
  // retoma en si la hace (y la dice) generarImagen.
  let desde = 0;
  const pendiente = leerPendiente(destino);
  if (pendiente) {
    const k = cascada.findIndex((m) => huellaDe(m) === pendiente.huella);
    if (k > 0) {
      desde = k;
      console.log(`  ..  ${trabajo.descripcion}: la tarea que quedo en kie.ai se pidio con el respaldo (${cascada[k]}); se retoma con ese modelo`);
    }
  }

  for (let nivel = desde; nivel < cascada.length; nivel++) {
    const modelo = cascada[nivel];
    const huella = huellaDe(modelo);

    if (nivel > desde) {
      const anterior = cascada[nivel - 1];
      console.log(
        [
          '',
          ultimaClase === 'contenido'
            ? `  ! ${trabajo.descripcion}: ${anterior} lo rechazo por contenido (politicas). Con el mismo prompt fallaria igual: no se gastan los otros intentos.`
            : `  ! ${trabajo.descripcion}: fallo ${REINTENTOS} veces con ${anterior}.`,
          `    Motivo: ${fallos[fallos.length - 1]}`,
          `    Cambio al modelo de respaldo: ${modelo}. Puede haber diferencia visual con el resto.`,
          '',
        ].join('\n')
      );
    }

    for (let intento = 1; intento <= REINTENTOS; intento++) {
      try {
        const r = await generarImagen({
          modelo,
          prompt: promptConFotograma(trabajo.prompt, trabajo.fotograma),
          imagenesReferencia: referencias,
          aspectRatio: aspecto,
          resolucion: resolucionDe(modelo),
          formato: 'png',
          ...(trabajo.fondo ? { fondo: trabajo.fondo } : {}),
          rutaDestino: destino,
          huella,
          alAvisar: (segundos) =>
            console.log(
              `  ..  ${trabajo.descripcion}: sigue generando en kie a los ${segundos} s; se sigue esperando el MISMO pedido (no se pide otro para no pagar dos veces)`
            ),
        });

        // Icono: primero se tapan los huecos semitransparentes que el modelo
        // deja a veces dentro de la figura (la imagen sin tapar va a
        // historial/); despues se mide si el PNG trae transparencia real (el
        // modelo puede ignorar el fondo pedido). Nada de esto frena: se anota
        // en el log y el montaje decide (recorte o tarjeta blanca).
        const huecos = trabajo.clase === 'icono' ? taparHuecosIcono(r.ruta, ctx.carpeta) : null;
        const transparencia = trabajo.clase === 'icono' ? medirTransparencia(r.ruta) : null;

        log.push({
          id: trabajo.id,
          archivo: trabajo.archivo,
          modelo: r.modeloReal,
          respaldo: nivel > 0,
          intentos: intento,
          referencias: usadas,
          creditos: r.creditos,
          taskId: r.taskId,
          ...camposDeIcono(huecos, transparencia),
        });

        const etiqueta = usadas.length ? ` [refs: ${usadas.join(', ')}]` : '';
        const aviso = nivel > 0 ? '  (RESPALDO)' : '';
        const fondo = transparencia ? (transparencia.transparente ? '  [fondo transparente]' : '  [SIN transparencia real: ira en tarjeta blanca]') : '';
        console.log(`  OK  ${trabajo.descripcion}${etiqueta} — ${r.creditos ?? '?'} cr${aviso}${fondo}${textoDeHuecos(huecos)}`);
        return { url: r.url, ruta: r.ruta };
      } catch (e) {
        if (esSigueEnKie(e)) throw errorSigueEnKie(trabajo, e);
        if (esPagadaSinBajar(e)) throw errorPagadaSinBajar(trabajo, e, ctx);
        fallos.push(e.message);
        ultimaClase = clasificarFallo(e);
        if (ultimaClase === 'contenido') {
          const siguiente = cascada[nivel + 1];
          console.log(
            `  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} rechazado por contenido (${e.message.slice(0, 120)})` +
              ` — no se reintenta con el mismo prompt${siguiente ? `; paso a ${siguiente}` : ''}`
          );
          break;
        }
        const quedan = REINTENTOS - intento;
        console.log(`  ..  ${trabajo.descripcion}: intento ${intento}/${REINTENTOS} fallo (${e.message.slice(0, 120)})${quedan ? ' — reintento' : ''}`);
        if (quedan) await new Promise((r) => setTimeout(r, 2000 * intento));
      }
    }
  }

  const err = new Error(
    `${trabajo.descripcion} fallo con los dos modelos (${cascada.join(' y ')}).\n` +
      `  Ultimo motivo: ${fallos[fallos.length - 1]}\n` +
      (ultimaClase === 'contenido' ? '  Es un rechazo por contenido (politicas del modelo): con el mismo prompt va a volver a fallar.\n' : '') +
      '\n' +
      '  No voy a inventar un prompt distinto por mi cuenta. Decide tu:\n' +
      '    a) reescribir ese prompt en el manifiesto y volver a correr\n' +
      '    b) saltarte esa toma\n' +
      '    c) probar con otro modelo'
  );
  err.trabajo = trabajo;
  err.claseFallo = ultimaClase;
  throw err;
}

/**
 * De que depende cada trabajo de ESTA corrida. Devuelve Map id -> { necesita,
 * espera } (listas de ids, todos de esta corrida):
 *
 *   necesita  tienen que haber terminado BIEN; si uno falla, este no se lanza.
 *             - "frame_inicial_de_esta_toma": el frame inicial de su toma.
 *             - "frame_anterior": el frame de justo antes (framesAnteriores).
 *             - el id de una hoja que se genera en esta corrida (tambien entre
 *               hojas: historias musicales). Una hoja generada desde la foto
 *               se pide a si misma, y eso es la foto, no una dependencia.
 *             - heredado: el frame final de la toma anterior.
 *             - copia de referencia: la hoja que copia.
 *   espera    tienen que haber terminado, bien o mal. Solo "frame_anterior":
 *             es una BARRERA, espera a todo lo que va antes en el plan, como
 *             siempre, para no adelantarse a la cadena que sigue.
 *
 * Lo que no esta en esta corrida ya esta en disco (o falta, y lo dice
 * resolverReferencias al lanzarlo): no es una dependencia. Todo lo que se
 * pide va ANTES en el plan (el validador exige el orden de las hojas), asi
 * que no puede haber ciclos.
 */
export function dependenciasDelPlan(trabajos, anteriorDe = new Map()) {
  const enCorrida = new Set(trabajos.map((t) => t.id));
  const hojas = new Set(trabajos.filter((t) => t.clase === 'referencia').map((t) => t.id));
  const deps = new Map();
  trabajos.forEach((t, i) => {
    const necesita = new Set();
    const espera = new Set();
    const pedir = (id) => {
      if (id && id !== t.id && enCorrida.has(id)) necesita.add(id);
    };
    if (t.clase === 'heredado') pedir(t.copiarDeId);
    if (t.clase === 'copia-de-referencia' && hojas.has(t.copiarDeId)) pedir(t.copiarDeId);
    for (const r of t.referencias || []) {
      if (r === 'frame_inicial_de_esta_toma') pedir(`toma-${t.n}-inicial`);
      else if (r === 'frame_anterior') {
        pedir(anteriorDe.get(t.id)?.id);
        for (const previo of trabajos.slice(0, i)) espera.add(previo.id);
      } else if (hojas.has(r)) pedir(r);
    }
    for (const id of necesita) espera.delete(id);
    deps.set(t.id, { necesita: [...necesita], espera: [...espera] });
  });
  return deps;
}

/** Un trabajo del pool: copia (heredado, copia de referencia) o imagen generada. */
async function correrTrabajo(trabajo, ctx, log) {
  if (trabajo.clase === 'heredado') {
    const origen = path.join(ctx.dirImg, trabajo.copiarDe);
    if (!fs.existsSync(origen)) {
      throw new Error(
        `${trabajo.descripcion}: no encuentro ${trabajo.copiarDe}.\n` +
          '  El frame inicial heredado es el frame final de la toma anterior:\n' +
          '  hay que generar esa toma antes, o no limitar la corrida con --tomas.'
      );
    }
    const destino = path.join(ctx.dirImg, trabajo.archivo);
    archivarSiExiste(destino, ctx.carpeta);
    copiarEntero(origen, destino);
    const url = (await urlDeFrame(ctx, trabajo.copiarDeId)) || (await subirArchivo(destino));
    ctx.urlsPorId.set(trabajo.id, url);
    log.push({ id: trabajo.id, archivo: trabajo.archivo, modelo: null, heredadoDe: trabajo.copiarDe, creditos: 0 });
    console.log(`  ==  ${trabajo.descripcion} — 0 cr`);
    return;
  }
  if (trabajo.clase === 'copia-de-referencia') {
    // Toma H con "frame_inicial": la imagen de la referencia, tal cual.
    // La URL ya la tiene la referencia si se subio en esta corrida (hoja
    // generada o foto aportada: es la misma imagen); si no, se sube la copia.
    const destino = copiarFrameDeReferencia(trabajo, ctx);
    const url = ctx.urlsDeReferencias.get(trabajo.copiarDeId) || (await subirArchivo(destino));
    ctx.urlsPorId.set(trabajo.id, url);
    log.push({ id: trabajo.id, archivo: trabajo.archivo, modelo: null, copiaDe: trabajo.copiarDe, referencia: trabajo.copiarDeId, creditos: 0 });
    console.log(`  ==  ${trabajo.descripcion} — 0 cr`);
    return;
  }
  const r = await generarConCascada(trabajo, ctx, log);
  if (trabajo.clase === 'referencia') {
    // Hoja lista: desde ahora su id da ESTA imagen (antes, en una hoja generada
    // desde la foto, daba la foto). Se anota en estado.json al final, con las
    // demas y en el orden de la lista (ver el CLI).
    ctx.urlsDeReferencias.set(trabajo.id, r.url);
    ctx.archivosDeReferencias.set(trabajo.id, path.join(ctx.dirImg, trabajo.archivo));
    ctx.hojasListas?.add(trabajo.id);
    return;
  }
  ctx.urlsPorId.set(trabajo.id, r.url);
}

/**
 * Corre los trabajos en un pool continuo: hasta CONCURRENCIA pedidos a kie.ai
 * en marcha y, cuando uno termina, entra el siguiente LISTO (sus dependencias
 * terminaron, ver dependenciasDelPlan), en el orden del plan entre los listos.
 * Antes iba en tandas cerradas de CONCURRENCIA que esperaban a la mas lenta, y
 * con una barrera (esperar todo lo lanzado) antes de cada frame final, copia o
 * heredado; ahora cada uno espera solo lo que de verdad pide. Las copias no
 * piden nada a kie (son archivos): no ocupan lugar en el pool.
 *
 * Un fallo NO corta la corrida, como en los bloques R de generar-videos.js
 * (ejecutarR): se sigue con lo que no depende de el, lo que dependia no se
 * lanza, y al final se lanza UN error con todo junto.
 */
async function ejecutar(trabajos, ctx, log) {
  const deps = dependenciasDelPlan(trabajos, ctx.anteriorDe);
  const porId = new Map(trabajos.map((t) => [t.id, t]));
  const esCopia = (t) => t.clase === 'heredado' || t.clase === 'copia-de-referencia';
  const listos = new Set(); // ids que terminaron bien
  const caidos = new Map(); // id -> por que no esta (para explicar a los que dependian)
  const fallidos = []; // { trabajo, error }
  const omitidos = []; // { trabajo, motivo }
  const enMarcha = new Map(); // id -> promesa que nunca rechaza
  let pedidos = 0; // en marcha que piden a kie.ai (las copias no cuentan)
  let pendientes = [...trabajos];

  while (pendientes.length) {
    const quedan = [];
    for (const t of pendientes) {
      const { necesita, espera } = deps.get(t.id);
      const caido = necesita.find((id) => caidos.has(id));
      if (caido) {
        const cual = porId.get(caido).clase === 'referencia' ? `la hoja "${caido}"` : porId.get(caido).descripcion;
        omitidos.push({ trabajo: t, motivo: `necesita ${cual}, que ${caidos.get(caido)}.` });
        caidos.set(t.id, 'no se genero (dependia de otra que fallo)');
        continue;
      }
      const listo = necesita.every((id) => listos.has(id)) && espera.every((id) => listos.has(id) || caidos.has(id));
      if (!listo || (!esCopia(t) && pedidos >= CONCURRENCIA)) {
        quedan.push(t);
        continue;
      }
      if (!esCopia(t)) pedidos++;
      enMarcha.set(
        t.id,
        correrTrabajo(t, ctx, log).then(
          () => ({ t, error: null }),
          (error) => ({ t, error })
        )
      );
    }
    pendientes = quedan;
    // Nada en marcha y nada que se pueda lanzar: no deberia pasar (todo lo
    // que se pide va antes en el plan); si pasa, se informa y no se cuelga.
    if (!enMarcha.size) break;

    const { t, error } = await Promise.race(enMarcha.values());
    enMarcha.delete(t.id);
    if (!esCopia(t)) pedidos--;
    if (error) {
      fallidos.push({ trabajo: t, error });
      caidos.set(t.id, error.sigueEnKie ? 'sigue en kie.ai sin terminar' : error.pagadaSinBajar ? 'termino en kie.ai y no se pudo bajar' : 'fallo');
    } else {
      listos.add(t.id);
    }
  }
  // Lo que quedo en marcha cuando ya no habia pendientes.
  for (const { t, error } of await Promise.all(enMarcha.values())) {
    if (error) fallidos.push({ trabajo: t, error });
  }
  for (const t of pendientes) omitidos.push({ trabajo: t, motivo: 'no se pudo lanzar: espera algo que no esta en esta corrida.' });

  if (!fallidos.length && !omitidos.length) return;
  if (fallidos.length === 1 && !omitidos.length) throw fallidos[0].error;

  const L = [];
  const partes = [];
  const siguen = fallidos.filter((f) => f.error?.sigueEnKie).length;
  const fallaron = fallidos.length - siguen;
  if (fallaron) partes.push(`${fallaron} ${fallaron === 1 ? 'imagen fallo' : 'imagenes fallaron'}`);
  if (siguen) partes.push(`${siguen} ${siguen === 1 ? 'sigue' : 'siguen'} en kie.ai sin terminar`);
  if (omitidos.length) partes.push(`${omitidos.length} no se ${omitidos.length === 1 ? 'genero' : 'generaron'}`);
  L.push(`${partes.join(' y ')}. Lo que no dependia de ellas se genero igual.`);
  // Cada mensaje ya empieza con la descripcion de su imagen.
  for (const f of fallidos) L.push('', `  ${f.error?.message ?? String(f.error)}`);
  if (omitidos.length) {
    L.push('', '  No se generaron:');
    for (const o of omitidos) L.push(`    ${o.trabajo.descripcion}: ${o.motivo}`);
    L.push(
      fallaron
        ? '  Cuando la que fallo este bien, se generan con lo que falta (sin --rehacer, lo ya hecho no se vuelve a pagar):'
        : '  Al volver a correr se retoma la que sigue en kie.ai y despues se generan estas (sin --rehacer, lo ya hecho no se vuelve a pagar):'
    );
    L.push(`      npm run imagenes -- ${ctx.carpetaArg}${ctx.soloTomas ? ` --tomas ${ctx.soloTomas.join(',')}` : ''}${ctx.soloBroll ? ` --broll ${ctx.soloBroll.join(',')}` : ''}${ctx.todoElBroll ? ' --todo-el-broll' : ''}`);
    if (ctx.rehacer) {
      L.push('  (Con --rehacer: las que no se generaron siguen con su imagen anterior. Para rehacerlas, --tomas con');
      L.push('  esas tomas y --rehacer.)');
    }
  }
  const err = new Error(L.join('\n'));
  err.fallidos = fallidos;
  err.omitidos = omitidos;
  throw err;
}

/**
 * img/log-modelos.json va en el orden del PLAN, no en el de llegada: con el
 * pool las imagenes terminan en cualquier orden, y el archivo tiene que salir
 * igual que siempre (antes las hojas iban primero porque se hacian de a una).
 * Ordena en el lugar; lo que no este en el plan queda al final.
 */
function ordenarComoElPlan(log, plan) {
  const pos = new Map(plan.map((t, i) => [t.id, i]));
  const de = (x) => pos.get(x.id) ?? Number.MAX_SAFE_INTEGER;
  log.sort((a, b) => de(a) - de(b));
  return log;
}

// ---------------------------------------------------------------- CLI

// El cuerpo del CLI va en una funcion para poder salir con "return" despues de
// consultarCreditos(): un process.exit() justo despues de un fetch aborta en
// Windows con Node 24 ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)",
// src/win/async.c, codigo 127) aunque ya se imprimio todo. Sin process.exit el
// proceso cierra solo en menos de un segundo, como ya hace la corrida real con --si.
if (process.argv[1] && process.argv[1].endsWith('generar-imagenes.js')) await cli();

/**
 * Que escribir en img/log-modelos.json: SOLO en los estilos hablados se
 * conservan las entradas de corridas anteriores cuyo archivo no se volvio a
 * generar ahora. El montaje (planear-montaje.js) lee ahi "transparente" de
 * cada icono, y como el log se reescribia con las imagenes de ESA corrida, una
 * segunda corrida (p. ej. --tomas N) borraba la medida de los iconos y todos
 * caian a tarjeta blanca (revision del 2026-10-13). En los demas estilos el
 * archivo sale exactamente como siempre: solo lo de la corrida.
 */
function conservarLogAnterior(dirImg, log, manifiesto) {
  if (!ESTILOS_HABLADOS.includes(manifiesto?.estilo)) return log;
  const ruta = path.join(dirImg, 'log-modelos.json');
  if (!fs.existsSync(ruta)) return log;
  let anterior;
  try {
    anterior = JSON.parse(fs.readFileSync(ruta, 'utf8')).imagenes;
  } catch {
    return log;
  }
  if (!Array.isArray(anterior)) return log;
  const nuevos = new Set(log.map((x) => x.archivo));
  // Lo viejo primero (en su orden), despues lo de esta corrida.
  return [...anterior.filter((x) => x && x.archivo && !nuevos.has(x.archivo) && fs.existsSync(path.join(dirImg, x.archivo))), ...log];
}

/**
 * Al final de la corrida: que iconos tenian huecos y se taparon, cuales tienen
 * una zona translucida grande que no se toco, y cuales no se pudieron revisar
 * (sin Python o sin sus paquetes), con como arreglarlo sin volver a pagar.
 */
function avisarHuecos(entradas, carpetaArg) {
  const tapados = entradas.filter((x) => x.huecosTapados > 0);
  if (tapados.length) {
    console.log(`\n  Huecos tapados en ${tapados.length} icono(s): el modelo dejo partes semitransparentes dentro de la figura.`);
    console.log('  La imagen tal como vino quedo en historial/:');
    for (const x of tapados) console.log(`      ${x.archivo}: ${x.huecosTapados} px (sin tapar: ${x.sinTapar})`);
  }
  const grandes = entradas.filter((x) => (x.huecosRespetados || []).some((h) => h.motivo === 'grande'));
  if (grandes.length) {
    console.log(`\n  OJO: ${grandes.length} icono(s) con una zona translucida GRANDE dentro de la figura, que no se tapo`);
    console.log('  (puede ser parte del dibujo, como un vaso, o un hueco del modelo). Miralos; si es un hueco, regeneralos:');
    for (const x of grandes) console.log(`      ${x.archivo}`);
  }
  const vacios = entradas.filter((x) => (x.huecosRespetados || []).some((h) => h.motivo === 'transparente'));
  if (vacios.length) {
    console.log(`\n  ${vacios.length} icono(s) con un hueco TOTALMENTE transparente dentro de la figura, que no se toca porque`);
    console.log('  suele ser a proposito (un anillo, el asa de una taza). Si en alguno no lo es, regeneralo:');
    for (const x of vacios) console.log(`      ${x.archivo}`);
  }
  const sinRevisar = entradas.filter((x) => x.huecosTapados === null);
  if (sinRevisar.length) {
    console.log(`\n  OJO: no pude revisar si ${sinRevisar.length} icono(s) tienen huecos (${sinRevisar[0].huecosError || 'sin detalle'}):`);
    for (const x of sinRevisar) console.log(`      ${x.archivo}`);
    // El comando de instalacion, para el MISMO Python que se uso (buscarPython:
    // "py -3 -m pip ..." si ese es el que hay). Si ese Python ya tiene los dos
    // paquetes, el problema es otro (el error de arriba) y no se manda a instalar.
    const python = buscarPython();
    const faltan = python ? paquetesQueFaltan(python, PAQUETES_PYTHON.iconos) : null;
    if (!python) {
      console.log('  Para taparlos hace falta Python 3 con Pillow y numpy. Instalalo desde https://www.python.org/downloads/');
      console.log(`  (marca "Add python.exe to PATH"), abre otra terminal y despues: ${comandoInstalar(null, PAQUETES_ICONOS)}`);
      console.log('  Comprueba con  npm run verificar  (seccion 8) y despues, sin generar ni cobrar nada:');
    } else if (faltan === null || faltan.length) {
      console.log(`  Para taparlos hace falta Python 3 con Pillow y numpy: ${comandoInstalar(python, faltan?.length ? faltan : PAQUETES_ICONOS)}`);
      console.log('  (dentro de un entorno virtual, sin --user). Comprueba con  npm run verificar  (seccion 8) y despues,');
      console.log('  sin generar ni cobrar nada:');
    } else {
      console.log(`  ${comandoPython(python)} ya tiene Pillow y numpy: el problema es el de arriba. Cuando lo arregles, sin generar ni cobrar nada:`);
    }
    console.log(`  node produccion/generar-imagenes.js ${carpetaArg} --tapar-huecos`);
  }
}

/**
 * --tapar-huecos: tapa los huecos de los iconos que YA estan en img/, sin
 * generar ni cobrar nada (no pide la clave de kie.ai). Para un icono que se
 * genero cuando faltaba Python, o antes de que existiera este paso. Vuelve a
 * medir la transparencia y actualiza la entrada de cada icono en
 * img/log-modelos.json (si no tenia, la agrega); el resto del log no cambia.
 * Un icono ya tapado no vuelve a cambiar (el script no le encuentra huecos) y
 * conserva lo que se anoto cuando se tapo.
 */
function taparHuecosEnDisco(carpeta, manifiesto, soloTomas, carpetaArg) {
  console.log(`\n=== Huecos de los iconos — ${path.basename(carpeta)} (no genera ni cobra nada) ===\n`);
  if (!ESTILOS_HABLADOS.includes(manifiesto.estilo)) {
    console.log(`  El estilo "${manifiesto.estilo}" no tiene iconos. Nada que hacer.\n`);
    return;
  }
  const dirImg = path.join(carpeta, 'img');
  const iconos = construirPlan(manifiesto, { soloTomas }).filter((t) => t.clase === 'icono');
  if (!iconos.length) {
    console.log('  El manifiesto no tiene iconos. Nada que hacer.\n');
    return;
  }
  const rutaLog = path.join(dirImg, 'log-modelos.json');
  let registro = null;
  try {
    registro = fs.existsSync(rutaLog) ? JSON.parse(fs.readFileSync(rutaLog, 'utf8')) : null;
  } catch {
    registro = null;
  }
  if (!registro || typeof registro !== 'object' || !Array.isArray(registro.imagenes)) registro = { generado: new Date().toISOString(), imagenes: [] };

  const paraAvisar = [];
  for (const t of iconos) {
    const ruta = path.join(dirImg, t.archivo);
    if (!fs.existsSync(ruta)) {
      console.log(`  --  ${t.archivo}: no esta en img/ (se genera con la corrida normal, que ya tapa los huecos)`);
      continue;
    }
    const huecos = taparHuecosIcono(ruta, carpeta);
    const transparencia = medirTransparencia(ruta);
    let e = registro.imagenes.find((x) => x && x.archivo === t.archivo);
    if (!e) {
      e = { id: t.id, archivo: t.archivo, modelo: null, creditos: 0 };
      registro.imagenes.push(e);
    }
    // Ya tapado antes y ahora sin nada que tapar (o sin poder revisarlo): se
    // conserva lo anotado entonces (cuantos pixeles, donde quedo el original).
    const conservar = e.huecosTapados > 0 && !(huecos.huecosTapados > 0);
    for (const k of ['transparenciaError', ...(conservar ? [] : ['huecosTapados', 'sinTapar', 'huecosRegiones', 'huecosRespetados', 'huecosError'])]) delete e[k];
    Object.assign(e, camposDeIcono(conservar ? null : huecos, transparencia));
    if (!conservar) paraAvisar.push(e);
    const fondo = transparencia.transparente ? '  [fondo transparente]' : '  [SIN transparencia real: ira en tarjeta blanca]';
    const estado = conservar ? `  [ya estaba tapado: ${e.huecosTapados} px; sin tapar en ${e.sinTapar}]` : textoDeHuecos(huecos) || '  [sin huecos]';
    console.log(`  OK  ${t.archivo}${fondo}${estado}`);
  }
  fs.writeFileSync(rutaLog, JSON.stringify(registro, null, 2) + '\n', 'utf8');
  avisarHuecos(paraAvisar, carpetaArg);
  console.log('\n  Detalle por icono en img/log-modelos.json\n');
}

async function cli() {
  const args = process.argv.slice(2);
  const carpetaArg = args.find((a) => !a.startsWith('--'));
  const sinConfirmar = args.includes('--si');
  const soloPlan = args.includes('--solo-plan');
  const rehacer = args.includes('--rehacer');
  // Pide tambien las imagenes del B-roll que no entra en el video con esta voz (ver abajo).
  const todoElBroll = args.includes('--todo-el-broll');
  const idxTomas = args.indexOf('--tomas');
  const soloTomas =
    idxTomas !== -1 && args[idxTomas + 1]
      ? args[idxTomas + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
      : null;
  // Solo la imagen de esos B-roll, sin ninguna toma (la revision de los clips de la app rehace UN B-roll asi).
  const idxBroll = args.indexOf('--broll');
  const soloBroll =
    idxBroll !== -1 && args[idxBroll + 1] && !args[idxBroll + 1].startsWith('--')
      ? args[idxBroll + 1].split(',').map((s) => Number(s.trim())).filter(Number.isInteger)
      : null;

  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/generar-imagenes.js <carpeta-del-anuncio> [--tomas 1,12 | --broll 9] [--solo-plan] [--si] [--tapar-huecos] [--todo-el-broll]\n');
    process.exit(1);
  }
  if (idxBroll !== -1 && (!soloBroll || !soloBroll.length || idxTomas !== -1 || args.includes('--tapar-huecos'))) {
    console.error('\n  --broll lleva los numeros de los B-roll (--broll 9) y va solo: no se combina con --tomas ni --tapar-huecos.\n');
    process.exit(1);
  }

  const carpeta = path.resolve(carpetaArg);
  const rutaManifiesto = path.join(carpeta, 'manifiesto.json');
  if (!fs.existsSync(rutaManifiesto)) {
    console.error(`\n  No encuentro el manifiesto: ${rutaManifiesto}\n`);
    process.exit(1);
  }

  // --tapar-huecos: solo los iconos que ya estan en disco. No genera ni cobra
  // nada, asi que no pide la clave de kie.ai.
  if (args.includes('--tapar-huecos')) {
    taparHuecosEnDisco(carpeta, JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8')), soloTomas, carpetaArg);
    return;
  }

  cargarEnv();
  requerirClave('KIE_API_KEY', 'copiala desde https://kie.ai/api-key');

  const manifiesto = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));

  // Puerta de entrada: si el manifiesto esta mal, no se gasta un centavo.
  const { errores } = validarManifiesto(manifiesto, { carpeta });
  if (errores.length) {
    console.error('\n  El manifiesto tiene errores. No genero nada hasta que se arreglen:\n');
    for (const e of errores) console.error(`  ERROR  ${e}`);
    console.error('');
    process.exit(1);
  }

  const dirImg = path.join(carpeta, 'img');
  fs.mkdirSync(dirImg, { recursive: true });

  if (soloBroll) {
    const hay = new Set((manifiesto.broll || []).map((b) => b?.n));
    const noEstan = soloBroll.filter((n) => !hay.has(n));
    if (noEstan.length) {
      console.error(`\n  --broll ${soloBroll.join(',')}: el manifiesto no tiene ${noEstan.length === 1 ? 'el B-roll' : 'los B-roll'} ${noEstan.join(', ')}.`);
      console.error(`  B-roll de este anuncio: ${[...hay].join(', ') || '(ninguno)'}\n`);
      process.exit(1);
    }
  }

  // Los modelos de ESTE anuncio (temp/<slug>/modelos.json); sin el, los de siempre.
  const eleccion = leerEleccion(carpeta);
  let plan = construirPlan(manifiesto, { soloTomas, soloBroll, eleccion });
  // --broll: las hojas que ya estan no se tocan (tampoco con --rehacer): solo se rehace la imagen del B-roll.
  if (soloBroll) plan = plan.filter((t) => t.clase !== 'referencia' || !fs.existsSync(path.join(dirImg, t.archivo)));

  // Tomas y B-roll que usan un clip de la biblioteca (clips-sin-cobro.js): sus
  // imagenes son el primer (y en las B el ultimo) fotograma de ese clip. No se
  // generan ni se pagan.
  const deBiblioteca = plan.filter((t) => (t.clase === 'toma' || t.clase === 'broll') && modoSinCobro(itemDeTrabajo(manifiesto, t)) === 'biblioteca');
  if (deBiblioteca.length) {
    plan = plan.filter((t) => !deBiblioteca.includes(t));
    console.log(`\n  De la biblioteca de clips (no se generan, no se pagan): ${deBiblioteca.map((t) => t.archivo).join(', ')}`);
    if (!args.includes('--solo-plan')) {
      fs.mkdirSync(dirImg, { recursive: true });
      for (const t of deBiblioteca) {
        if (fs.existsSync(path.join(dirImg, t.archivo)) && !args.includes('--rehacer')) continue;
        try {
          fotogramaDe(clipDeBiblioteca(itemDeTrabajo(manifiesto, t)), path.join(dirImg, t.archivo), t.archivo.endsWith('-final.png') ? 'ultimo' : 'primero');
        } catch (e) {
          console.log(`  !!  no pude sacar ${t.archivo} del clip de la biblioteca (${e.message.slice(0, 120)})`);
        }
      }
    }
  }

  // B-ROLL QUE NO ENTRA (2026-10-26). En voz en off y musica, con la voz ya
  // hecha (audio/tiempos.json), la imagen de un B-roll cuya frase es corta no
  // se pide: su video tampoco (generar-videos) y el montaje no lo usaria
  // (brollQueEntran, la misma regla de planear-montaje). Con --rehacer
  // tampoco. Sin tiempos todavia (imagenes antes de la voz), o con unos que no
  // son de este guion, se piden todas, como antes. --todo-el-broll las pide igual.
  // ("frame_anterior" se sigue resolviendo sobre el plan completo: ninguna
  // toma depende de la imagen de un B-roll.)
  const reglaBroll = brollQueEntranEnCarpeta(manifiesto, carpeta);
  const brollEnPlan = plan.filter((t) => t.clase === 'broll');
  let brollNoEntra = [];
  if (reglaBroll.aplica && brollEnPlan.length) {
    const fueraPorN = new Map(reglaBroll.fuera.map((f) => [f.n, f]));
    brollNoEntra = brollEnPlan.filter((t) => fueraPorN.has(t.n)).map((t) => fueraPorN.get(t.n));
    if (!todoElBroll) plan = plan.filter((t) => !(t.clase === 'broll' && fueraPorN.has(t.n)));
  }

  // La misma imagen pedida dos veces (mismo prompt, referencias y fotograma) se
  // genera una sola: la otra se copia como un heredado, 0 cr. Ver
  // imagenes-repetidas.js. Va despues de sacar las de la biblioteca y el B-roll
  // que no entra, para no copiar de una imagen que no se va a pedir.
  for (const [t, de] of repetidas(plan)) {
    Object.assign(t, {
      clase: 'heredado',
      copiarDe: de.archivo,
      copiarDeId: de.id,
      prompt: null,
      referencias: [],
      fotograma: null,
      descripcion: `${t.descripcion} — igual a ${de.archivo} (no se genera, no se paga)`,
    });
  }

  // Lo ya generado no se vuelve a pagar.
  const yaHechos = plan.filter((t) => fs.existsSync(path.join(dirImg, t.archivo)));
  if (!rehacer && yaHechos.length) plan = plan.filter((t) => !fs.existsSync(path.join(dirImg, t.archivo)));

  const creditosPorImagen = PRECIOS.imagen[MODELOS.imagen.principal][RESOLUCION];
  // Una hoja de un anuncio por bloques, o cualquier imagen de un estilo con
  // modelo propio, se cobra con SU modelo y resolucion (ver construirPlan);
  // null = precio no verificado en config.js.
  const creditosDe = (t) =>
    t.cascada ? PRECIOS.imagen[t.cascada[0]]?.[t.resoluciones?.[t.cascada[0]] || RESOLUCION] ?? null : creditosPorImagen;
  // Los frames heredados se copian, no se generan: no entran en el costo.
  // Igual las copias de referencia de las tomas H ("frame_inicial").
  const aGenerar = plan.filter((t) => t.clase !== 'heredado' && t.clase !== 'copia-de-referencia');
  const heredados = plan.filter((t) => t.clase === 'heredado');
  const copias = plan.filter((t) => t.clase === 'copia-de-referencia');
  const creditosTotal = aGenerar.reduce((s, t) => s + (creditosDe(t) ?? 0), 0);
  const hayBloquesR = manifiesto.tomas.some((t) => t.tipo === 'R');
  // Estilo hablado (podcast, entrevista): copias de referencia e iconos.
  const hablado = ESTILOS_HABLADOS.includes(manifiesto.estilo);

  console.log(`\n=== Generacion de imagenes — ${path.basename(carpeta)} ===\n`);
  if (soloTomas) console.log(`  Limitado a las tomas: ${soloTomas.join(', ')}\n`);
  if (soloBroll) console.log(`  Limitado a ${soloBroll.length === 1 ? 'la imagen del B-roll' : 'las imagenes de los B-roll'} ${soloBroll.join(', ')} (ninguna toma)\n`);
  if (hayBloquesR) {
    console.log('  Anuncio por bloques (tomas R): los bloques no llevan frames.');
    console.log('  Aqui solo se generan las hojas de los personajes; el producto es la foto real.\n');
  }
  if (hablado) {
    console.log(`  Estilo ${manifiesto.estilo} (tomas habladas, H): el frame inicial de una toma con "frame_inicial" es la`);
    console.log('  imagen de esa referencia copiada tal cual (0 cr); el resto de frames se genera como siempre.');
    if (plan.some((t) => t.clase === 'icono')) {
      console.log(`  Los iconos salen de ${MODELO_IMAGEN_ICONOS} a ${RESOLUCION_IMAGEN_ICONOS}, cuadrados y con fondo transparente; despues se tapan los`);
      console.log('  huecos semitransparentes que el modelo deje dentro de la figura (con Python) y se mide si la');
      console.log('  transparencia es real (si no, el montaje los pone en una tarjeta blanca).');
    }
    console.log('');
  }
  // Continuidad: sin B-roll, y sin las hojas que solo usaba el B-roll descartado.
  const sinUso = tieneContinuidad(manifiesto) ? referenciasSoloDelBrollDescartado(manifiesto) : new Set();
  if (tieneContinuidad(manifiesto)) {
    const guardados = Array.isArray(manifiesto.continuidad?.broll_descartado) ? manifiesto.continuidad.broll_descartado.length : 0;
    console.log(`  Continuidad: sin B-roll (${guardados} guardado(s) en continuidad.broll_descartado, que no se generan).`);
    if (sinUso.size) console.log(`  Tampoco se generan las hojas que solo usaba ese B-roll: ${[...sinUso].join(', ')}.`);
    console.log('');
  }

  if (yaHechos.length && !rehacer) {
    console.log(`  Ya generadas (no se vuelven a pagar): ${yaHechos.length}`);
    for (const t of yaHechos) console.log(`      ${t.archivo}`);
    console.log('');
  }
  // La imagen del B-roll que no entra en el video con esta voz: una por linea, con su porque.
  if (brollNoEntra.length && !todoElBroll) {
    const yaEstan = new Set(brollNoEntra.filter((f) => fs.existsSync(path.join(dirImg, `broll-${f.n}.png`))).map((f) => f.n));
    // Pedida cuando entraba (con otra voz) y con su tarea todavia en kie: esta corrida no la retoma.
    const enKie = new Set(brollNoEntra.filter((f) => fs.existsSync(path.join(dirImg, `broll-${f.n}.png.kie-pendiente.json`))).map((f) => f.n));
    const que = rehacer ? 'sus imagenes no se piden ni se rehacen' : 'sus imagenes no se piden';
    for (const l of lineasBrollQueNoEntra(brollNoEntra, { yaEstan, enKie, que, carpetaArg, comando: 'imagenes' })) console.log(l);
    console.log('');
  } else if (brollNoEntra.length) {
    console.log(`  --todo-el-broll: se piden tambien las imagenes de ${brollNoEntra.length} B-roll que no entran en el video con esta voz (${brollNoEntra.map((f) => f.n).join(', ')}).\n`);
  } else if (!reglaBroll.aplica && brollEnPlan.length && (reglaBroll.sinTiempos || reglaBroll.tiemposQueNoSirven)) {
    // Voz en off o musica sin unos tiempos que sirvan: no se sabe cual entra.
    console.log(`  B-roll: se piden todas sus imagenes (${brollEnPlan.length}): ${reglaBroll.motivo}. Con la voz hecha se piden solo las de los que entran en el video.\n`);
  }

  if (plan.length === 0) {
    console.log('  No hay nada que generar. Todo listo.\n');
    process.exit(0);
  }

  console.log('  Se van a generar:');
  for (const t of plan) console.log(`      ${t.archivo.padEnd(24)} ${t.descripcion}`);

  const saldo = await consultarCreditos();
  console.log(
    `\n  Imagenes:  ${aGenerar.length} a generar` +
      (heredados.length ? ` + ${heredados.length} heredada(s), que no se pagan` : '') +
      (copias.length ? ` + ${copias.length} copiada(s) de su referencia, que no se pagan` : '')
  );
  const conModeloPropio = aGenerar.find((t) => t.cascada);
  if (hablado) {
    // Estilo hablado: hojas, frames y B-roll con el modelo de siempre, iconos
    // con el suyo. Una linea por modelo, con lo que cuesta cada imagen.
    const porModelo = new Map();
    for (const t of aGenerar) {
      const modelo = t.cascada?.[0] || MODELOS.imagen.principal;
      const res = t.resoluciones?.[modelo] || RESOLUCION;
      const k = `${modelo} a ${res}`;
      const e = porModelo.get(k) || { modelo, res, n: 0, cu: creditosDe(t), respaldo: t.cascada?.[1] ?? null, iconos: t.clase === 'icono' };
      e.n++;
      porModelo.set(k, e);
    }
    let primera = true;
    for (const [k, e] of porModelo) {
      const precio = e.cu === null ? 'precio NO verificado' : `${e.cu} creditos c/u`;
      const que = e.iconos ? ' (iconos, 1:1, fondo transparente)' : '';
      console.log(`  ${primera ? 'Modelo:   ' : '          '} ${k}${que}: ${e.n} imagen(es), ${precio}`);
      if (e.respaldo) console.log(`             si falla ${e.n > 1 ? 'alguno' : 'el icono'}, respaldo: ${e.respaldo} a ${RESOLUCION} (sin fondo transparente: tarjeta blanca)`);
      primera = false;
    }
    if (!porModelo.size) console.log(`  Modelo:    ${MODELOS.imagen.principal} a ${RESOLUCION} (${creditosPorImagen} creditos c/u)`);
  } else if (conModeloPropio) {
    const [modeloR, respaldoR] = conModeloPropio.cascada;
    const resR = conModeloPropio.resoluciones?.[modeloR] || RESOLUCION;
    const cu = creditosDe(conModeloPropio);
    console.log(`  Modelo:    ${modeloR} a ${resR} (${cu === null ? 'precio NO verificado' : `${cu} creditos c/u`})`);
    const resRespaldo = conModeloPropio.resoluciones?.[respaldoR] || RESOLUCION;
    const cual = aGenerar.length > 1 ? 'alguna' : conModeloPropio.clase === 'referencia' ? 'la hoja' : 'la imagen';
    console.log(`             si falla ${cual}, respaldo: ${respaldoR} a ${resRespaldo}`);
  } else {
    console.log(`  Modelo:    ${MODELOS.imagen.principal} a ${RESOLUCION} (${creditosPorImagen} creditos c/u)`);
  }
  console.log(`  Costo:     ${creditosTotal} creditos = US$${creditosAUsd(creditosTotal).toFixed(2)}`);
  if (saldo !== null) {
    console.log(`  Tu saldo:  ${saldo} creditos = US$${creditosAUsd(saldo).toFixed(2)}`);
    if (saldo < creditosTotal) console.log('  ATENCION:  no te alcanza el saldo para todo esto.');
  }
  console.log(`  Precios consultados el ${PRECIOS.consultado} en ${KIE.precios}\n`);

  if (soloPlan) {
    console.log('  --solo-plan: no se genero nada y no se cobro nada.\n');
    return;
  }

  if (!sinConfirmar) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const r = (await rl.question('  Genero? Se cobra a tu cuenta de kie.ai [s/N]: ')).trim().toLowerCase();
    rl.close();
    if (r !== 's' && r !== 'si') {
      console.log('\n  Cancelado. No se genero nada ni se cobro nada.\n');
      return;
    }
  }

  // Referencias: se suben una sola vez y se reusan en todas las tomas.
  const ctx = {
    carpeta,
    carpetaArg,
    dirImg,
    soloTomas,
    soloBroll,
    rehacer,
    // Para los comandos de reintento: sin el, la imagen de un B-roll que no entra (y su tarea en kie) no se pide.
    todoElBroll,
    aspectRatio: manifiesto.aspect_ratio || '9:16',
    urlsPorId: new Map(),
    urlsDeReferencias: new Map(),
    // id de referencia -> su archivo local (la foto o la hoja), para la huella.
    archivosDeReferencias: new Map(),
    // "frame_anterior" se resuelve por id sobre el plan completo (sin --tomas).
    anteriorDe: framesAnteriores(construirPlan(manifiesto, { eleccion })),
    sha1s: new Map(),
    // Las hojas que estan (en disco o recien generadas), para estado.json.
    hojasListas: new Set(),
  };

  const log = [];
  const t0 = Date.now();

  try {
    const lista = listaDeReferencias(manifiesto);

    // 1) Las aportadas por el usuario: solo se suben.
    for (const r of lista.filter(esAportada)) {
      process.stdout.write(`\n  Subiendo la referencia "${r.id}" (${r.archivo})... `);
      ctx.urlsDeReferencias.set(r.id, await subirArchivo(path.join(carpeta, r.archivo)));
      ctx.archivosDeReferencias.set(r.id, path.join(carpeta, r.archivo));
      console.log('listo');
    }

    // 2) Las generadas que YA estan en disco no se vuelven a pagar: solo se
    //    suben, antes de lanzar nada. Las que faltan van al MISMO pool que las
    //    tomas (ejecutar): cada una arranca en cuanto estan las hojas que pide,
    //    y cada toma en cuanto estan las suyas. Todas se anotan en estado.json
    //    al final, en el orden de la lista (como antes, cuando se hacian de a
    //    una): con el pool terminan en cualquier orden.
    for (const r of lista.filter(esGenerada)) {
      // Continuidad: la que solo usaba el B-roll descartado ni se genera ni se sube.
      if (sinUso.has(r.id)) continue;
      if (plan.some((t) => t.clase === 'referencia' && t.id === r.id)) continue;
      const archivo = archivoDeHoja(r);
      const rutaHoja = path.join(dirImg, archivo);
      if (!fs.existsSync(rutaHoja)) continue;
      process.stdout.write(`\n  Subiendo la hoja ya generada de "${r.id}"... `);
      ctx.urlsDeReferencias.set(r.id, await subirArchivo(rutaHoja));
      ctx.archivosDeReferencias.set(r.id, rutaHoja);
      ctx.hojasListas.add(r.id);
      console.log('listo');
    }

    console.log('');
    try {
      await ejecutar(plan, ctx, log);
    } finally {
      ordenarComoElPlan(log, plan);
      // El progreso va a estado.json, NO al manifiesto: el manifiesto es el
      // contrato que emitio la skill y no cambia mientras el pipeline corre.
      // Tambien si algo fallo: las hojas que si estan quedan anotadas.
      for (const r of lista.filter(esGenerada)) {
        if (ctx.hojasListas.has(r.id)) anotarHojaDeReferencia(carpeta, r.id, `img/${archivoDeHoja(r)}`);
      }
    }

    const creditosReales = log.reduce((s, x) => s + (x.creditos || 0), 0);
    const conRespaldo = log.filter((x) => x.respaldo);
    const seg = ((Date.now() - t0) / 1000).toFixed(0);

    fs.writeFileSync(
      path.join(dirImg, 'log-modelos.json'),
      JSON.stringify({ generado: new Date().toISOString(), segundos: Number(seg), imagenes: conservarLogAnterior(dirImg, log, manifiesto) }, null, 2) + '\n',
      'utf8'
    );

    console.log(`\n  Listo en ${seg}s. ${log.length} imagenes en ${dirImg}`);
    console.log(`  Gasto real: ${creditosReales} creditos = US$${creditosAUsd(creditosReales).toFixed(2)}`);
    if (conRespaldo.length) {
      console.log(`\n  ATENCION: ${conRespaldo.length} imagen(es) salieron del modelo de respaldo y pueden verse distintas:`);
      for (const x of conRespaldo) console.log(`      ${x.archivo} -> ${x.modelo}`);
    }
    // Iconos sin transparencia real: no es un error, el montaje los pone en
    // una tarjeta blanca; se dice para que se sepa como van a verse.
    const sinTransparencia = log.filter((x) => x.transparente === false);
    if (sinTransparencia.length) {
      console.log(`\n  OJO: ${sinTransparencia.length} icono(s) llegaron SIN transparencia real (el montaje los muestra en una tarjeta blanca):`);
      for (const x of sinTransparencia) console.log(`      ${x.archivo} -> ${x.modelo}${x.transparenciaError ? ` (no se pudo medir: ${x.transparenciaError})` : ''}`);
    }
    // Iconos: huecos tapados, zonas translucidas grandes y los que no se
    // pudieron revisar (sin Python). Solo lo de esta corrida.
    avisarHuecos(log, carpetaArg);
    console.log(`  Detalle por imagen en img/log-modelos.json\n`);
  } catch (e) {
    console.error(`\n  SE DETUVO\n\n  ${e.message}\n`);
    if (log.length) {
      fs.writeFileSync(
        path.join(dirImg, 'log-modelos.json'),
        JSON.stringify({ generado: new Date().toISOString(), parcial: true, imagenes: conservarLogAnterior(dirImg, log, manifiesto) }, null, 2) + '\n',
        'utf8'
      );
      const cr = log.reduce((s, x) => s + (x.creditos || 0), 0);
      console.error(`  Se alcanzaron a generar ${log.length} imagenes (${cr} creditos). Al volver a correr, esas no se repiten.\n`);
    }
    process.exitCode = 1;
  }
}
