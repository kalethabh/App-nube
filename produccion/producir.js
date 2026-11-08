// FASES 2.2 + 2.4 + 2.3 DE UN TIRON — imagenes, voz y videos encadenados, para
// que cada video arranque apenas sus imagenes estan (aprobado por Diego el
// 2026-10-24, para que el motor tarde menos).
//
//   node produccion/producir.js temp/mi-anuncio                  explica que hace; no gasta
//   node produccion/producir.js temp/mi-anuncio --solo-plan      el costo junto, sin gastar
//   node produccion/producir.js temp/mi-anuncio --si             genera
//   node produccion/producir.js temp/mi-anuncio --tomas 1,5 --si solo esas tomas (en imagenes y en videos)
//
// No reemplaza a nadie: npm run imagenes, audio y videos siguen igual que
// siempre. Esto solo los corre a la vez, cada uno en su proceso:
//
//   [img]  generar-imagenes.js --si       arranca enseguida
//   [voz]  generar-audio.js               solo voz en off, y solo si falta audio/voz.mp3;
//                                         al mismo tiempo que las imagenes
//   [vid]  generar-videos.js --si --esperar-imagenes
//                                         arranca enseguida, y cada clip se pide apenas
//                                         existen sus imagenes. En voz en off, solo si la
//                                         voz YA estaba (ver abajo)
//
// Cuando el proceso de imagenes termina se escribe <carpeta>/.imagenes-fin.json
// ({ codigo, fecha }): con eso el de videos da por fallido al clip cuya imagen
// no salio, en vez de seguir esperandola. Se borra al empezar.
//
// kie admite 20 createTask cada 10 s por CUENTA, y el limitador de kie-client
// es por PROCESO: con imagenes y videos a la vez, cada uno va con la mitad de
// LIMITE_CREACIONES (KIE_LIMITE_CREACIONES en su entorno), para que entre los
// dos no pasen de 18.
//
// Segun la familia del anuncio (familiaDe):
//
//   continuidad           solo las imagenes: los prompts de los pasos se escriben
//                         mirandolas (seccion 13 de COMO-PRODUCIR)
//   podcast, entrevista   solo las imagenes: las hojas y las imagenes se miran
//                         antes de pagar los clips (seccion 12)
//   UGC por bloques       solo las imagenes: la imagen de la persona se mira antes
//                         de pagar los bloques, porque esa cara va en todo el
//                         anuncio (seccion 11). Ademas aca producir no ganaba
//                         tiempo: todos los bloques esperan esa unica imagen
//   musica                la cancion y sus tiempos tienen que estar; si faltan, sale
//                         sin gastar (musical e historias musicales)
//   voz en off            con audio/voz.mp3 ya hecho, imagenes y videos a la vez.
//                         Si falta, la genera al mismo tiempo que las imagenes y
//                         NO pide los videos: el audio va antes que los videos
//                         para ver un desfase con la voz real ANTES de pagarlos
//                         (ESTADO-ACTUAL 3.1, NO REVERTIR), y eso lo mira alguien.
//                         En estilo lego la voz la elige el usuario (seccion 10):
//                         ahi no la genera, solo hace las imagenes
//   el resto              imagenes y videos a la vez (objeto parlante)
//
// No lanza la musica ni el montaje: siguen en su lugar del flujo.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ESTILOS_HABLADOS, ESTILOS_SIN_MUSICA, LIMITE_CREACIONES, creditosAUsd, cargarEnv, requerirClave } from './config.js';
import { validarManifiesto } from './validar-manifiesto.js';
import { tieneContinuidad } from './continuidad.js';
import { estimar } from './estimar-video.js';
import { construirPlan as planDeVideos } from './generar-videos.js';
import { brollQueEntranEnCarpeta } from './planear-montaje.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/** Los comandos de siempre. Van en un objeto para que una prueba pueda cambiar uno (ver producir()). */
export const SCRIPTS = {
  imagenes: path.join(AQUI, 'generar-imagenes.js'),
  audio: path.join(AQUI, 'generar-audio.js'),
  videos: path.join(AQUI, 'generar-videos.js'),
  estimar: path.join(AQUI, 'estimar-video.js'),
};

/** Las familias en las que producir hace solo las imagenes (alguien las mira antes de pagar los clips). */
const SOLO_IMAGENES = new Set(['continuidad', 'hablado', 'ugc']);

/**
 * Estilos de voz en off en los que la voz la elige el usuario siempre, antes de
 * npm run audio (COMO-PRODUCIR seccion 10). Con continuidad tambien, pero ese
 * camino ya va solo con las imagenes.
 */
const VOZ_LA_ELIGE_EL_USUARIO = new Set(['estilo-lego']);

const usd = (cr) => `US$${creditosAUsd(cr).toFixed(2)}`;
const seg = (ms) => `${Math.round(ms / 1000)} s`;

/**
 * Que camino sigue un anuncio. El orden importa: un anuncio con continuidad
 * tambien es voz en off, y un podcast y un UGC por bloques (tomas R; el
 * validador no deja mezclarlas con otras) son dialogo_nativo.
 */
export function familiaDe(m) {
  if (tieneContinuidad(m)) return 'continuidad';
  if (ESTILOS_HABLADOS.includes(m.estilo)) return 'hablado';
  if ((m.tomas || []).some((t) => t.tipo === 'R')) return 'ugc';
  if (m.modo_audio === 'musica') return 'musica';
  if (m.modo_audio === 'voz_en_off') return 'voz';
  return 'dialogo';
}

/** Igual que generar-audio.js: la voz esta hecha si existe audio/voz.mp3. */
const rutaVoz = (carpeta) => path.join(carpeta, 'audio', 'voz.mp3');

/**
 * Si --si pide los videos en esta corrida. No en las familias de SOLO_IMAGENES,
 * ni en voz en off sin la voz: la voz nueva se escucha (y se compara con lo
 * estimado) antes de pagar los videos (ESTADO-ACTUAL 3.1). Exportada para el
 * arnes de pruebas (probar-velocidad.js).
 */
export function haceVideos(familia, carpeta) {
  if (SOLO_IMAGENES.has(familia)) return false;
  return !(familia === 'voz' && !fs.existsSync(rutaVoz(carpeta)));
}

/** Si --si genera la voz: voz en off sin audio/voz.mp3, salvo que la voz la elija el usuario (estilo lego). */
export function generaVoz(familia, carpeta, m) {
  return familia === 'voz' && !fs.existsSync(rutaVoz(carpeta)) && !VOZ_LA_ELIGE_EL_USUARIO.has(m.estilo);
}
const rutaTiempos = (carpeta) => path.join(carpeta, 'audio', 'tiempos.json');
const rutaFin = (carpeta) => path.join(carpeta, '.imagenes-fin.json');

/** Lo que hace --si con este anuncio, en lineas para imprimir. */
function queHace(familia, { carpeta, carpetaArg, m }) {
  switch (familia) {
    case 'continuidad':
      return [
        'Continuidad: SOLO las imagenes. Los prompts de los pasos se escriben mirando las dos',
        `imagenes de cada par (npm run continuidad -- ${carpetaArg} --pares), y despues van los videos.`,
      ];
    case 'hablado':
      return [
        `Estilo ${m.estilo}: SOLO las imagenes. Las hojas y las imagenes se miran antes de pagar los`,
        `clips (seccion 12 de COMO-PRODUCIR); despues: npm run videos -- ${carpetaArg} --si`,
      ];
    case 'ugc':
      return [
        'UGC por bloques: SOLO la imagen de la persona. Esa cara va en todo el anuncio y se mira antes de',
        `pagar los bloques (seccion 11 de COMO-PRODUCIR); despues: npm run videos -- ${carpetaArg} --si`,
      ];
    case 'musica':
      return ['Musica: imagenes y videos a la vez. La cancion y sus tiempos ya tienen que estar.'];
    case 'voz':
      if (fs.existsSync(rutaVoz(carpeta))) return ['Voz en off: la voz ya esta (audio/voz.mp3). Imagenes y videos a la vez.'];
      if (VOZ_LA_ELIGE_EL_USUARIO.has(m.estilo)) {
        return [
          `Voz en off: falta la voz, y en ${m.estilo} la elige el usuario (seccion 10): SOLO las imagenes.`,
          'Los videos van despues de elegir la voz, generarla y escucharla.',
        ];
      }
      return [
        'Voz en off: falta la voz. Se genera (ElevenLabs) al mismo tiempo que las imagenes, y los videos',
        'NO van en esta corrida: la voz nueva se escucha antes de pagarlos. Con audio/voz.mp3 ya hecho',
        '(npm run audio primero), producir hace las imagenes y los videos a la vez.',
      ];
    default:
      return ['Imagenes y videos a la vez.'];
  }
}

// ---------------------------------------------------------------- procesos hijos

/**
 * Reenvia lo que escribe un hijo, linea por linea, con su prefijo. Una linea a
 * medias (process.stdout.write('  Subiendo... ') y despues 'listo') espera a
 * que llegue su fin de linea, para que dos hijos no se mezclen en una misma.
 */
function reenviarLineas(stream, prefijo, salida, captura) {
  let resto = '';
  stream.setEncoding('utf8');
  const escribir = (l) => salida.write(`${prefijo}${l.replace(/\r$/, '')}`.trimEnd() + '\n');
  stream.on('data', (d) => {
    if (captura) captura.push(d);
    resto += d;
    const lineas = resto.split('\n');
    resto = lineas.pop();
    for (const l of lineas) escribir(l);
  });
  stream.on('end', () => {
    if (resto) escribir(resto);
    resto = '';
  });
}

/**
 * Corre un comando del motor como proceso hijo y devuelve { codigo, ms, salida }.
 * stdin va cerrado: con --si nadie pregunta nada, y si algo preguntara (la voz
 * sin elegir) falla diciendolo en vez de quedarse esperando.
 */
function correrHijo(script, args, { prefijo = '', env = process.env, capturar = false } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const captura = capturar ? [] : null;
    const hijo = spawn(process.execPath, [script, ...args], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    reenviarLineas(hijo.stdout, prefijo, process.stdout, captura);
    reenviarLineas(hijo.stderr, prefijo, process.stderr, captura);
    let errorAlArrancar = null;
    hijo.on('error', (e) => {
      errorAlArrancar = e;
    });
    hijo.on('close', (codigo) => {
      if (errorAlArrancar) process.stderr.write(`${prefijo}  !  No pude arrancar ${path.basename(script)}: ${errorAlArrancar.message}\n`);
      resolve({ codigo: typeof codigo === 'number' ? codigo : 1, ms: Date.now() - t0, salida: captura ? captura.join('') : '' });
    });
  });
}

/** Escribe .imagenes-fin.json de una vez (temporal + rename): el de videos nunca lo ve a medias. */
function escribirFin(carpeta, codigo) {
  const ruta = rutaFin(carpeta);
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ codigo, fecha: new Date().toISOString() }, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, ruta);
}

// ---------------------------------------------------------------- lo que salio

/** Los archivos que ya estaban en img/ y video/ antes de empezar. */
function fotoDeCarpetas(carpeta) {
  const ya = new Set();
  for (const sub of ['img', 'video']) {
    try {
      for (const f of fs.readdirSync(path.join(carpeta, sub))) ya.add(`${sub}/${f}`);
    } catch {
      // todavia no existe
    }
  }
  return ya;
}

/**
 * Lo de ESTA corrida en un log-modelos.json: el log tiene que haberse escrito
 * despues de empezar, y de sus entradas cuentan solo las de archivos que no
 * estaban antes (en podcast y entrevista el de imagenes conserva las de antes,
 * y con continuidad el de videos se fusiona con el anterior). null si no hay
 * log de esta corrida.
 */
function loDeEstaCorrida(carpeta, sub, campo, desde, previos) {
  const ruta = path.join(carpeta, sub, 'log-modelos.json');
  let log;
  try {
    log = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
  if (!(Date.parse(log.generado) >= desde)) return null;
  const nuevas = (Array.isArray(log[campo]) ? log[campo] : []).filter((x) => x?.archivo && !previos.has(`${sub}/${x.archivo}`));
  return {
    n: nuevas.length,
    creditos: nuevas.reduce((s, x) => s + (Number(x.creditos) || 0), 0),
    respaldo: nuevas.filter((x) => x.respaldo).map((x) => `${x.archivo} -> ${x.modelo}`),
    parcial: log.parcial === true,
  };
}

/**
 * Las tareas que siguen en kie (kie-client deja <archivo>.kie-pendiente.json y
 * las retoma al volver a correr): { siguen, brollFuera }. En brollFuera van las
 * de un B-roll que con esta voz NO entra en el video (se pidio cuando entraba y
 * despues cambio la voz): imagenes y videos ya no lo piden, asi que volver a
 * correr NO las retoma. Ya estan pagadas: se pueden bajar sin pagar otra con
 * --todo-el-broll. [{ archivo, sub, n, toma }]
 */
function pendientesEnKie(carpeta, m) {
  const siguen = [];
  const brollFuera = [];
  let fuera = null;
  for (const sub of ['img', 'video']) {
    let archivos = [];
    try {
      archivos = fs.readdirSync(path.join(carpeta, sub));
    } catch {
      // sin esa carpeta
    }
    for (const f of archivos) {
      if (!f.endsWith('.kie-pendiente.json')) continue;
      const archivo = `${sub}/${f.replace(/\.kie-pendiente\.json$/, '')}`;
      const b = f.match(/^broll-(\d+)\.\w+\.kie-pendiente\.json$/);
      if (b) {
        if (fuera === null) {
          let r = { aplica: false };
          try {
            r = brollQueEntranEnCarpeta(m, carpeta);
          } catch {
            // sin regla: se trata como siempre
          }
          fuera = new Map(r.aplica ? r.fuera.map((x) => [x.n, x]) : []);
        }
        const x = fuera.get(Number(b[1]));
        if (x) {
          brollFuera.push({ archivo, sub, n: x.n, toma: x.toma });
          continue;
        }
      }
      siguen.push(archivo);
    }
  }
  return { siguen, brollFuera };
}

/** El paso siguiente del flujo, segun la familia (COMO-PRODUCIR secciones 1, 10, 11, 12 y 13). */
function pasoSiguiente(familia, { carpeta, carpetaArg, m, conVideos, argsTomas = [] }) {
  const tomas = argsTomas.length ? ` ${argsTomas.join(' ')}` : '';
  if (familia === 'continuidad') {
    const faltaVoz = !fs.existsSync(rutaVoz(carpeta));
    return [
      '  Paso siguiente (seccion 13): revisar las imagenes. Despues, en este orden',
      `  (${faltaVoz ? 'la voz la elige el usuario con npm run voces; ' : ''}--pares: mirar las dos imagenes de cada par y escribir su prompt;`,
      '  el costo de los videos se dice y se espera el si):',
      ...(faltaVoz ? [`      npm run audio        -- ${carpetaArg}`] : []),
      `      npm run continuidad  -- ${carpetaArg} --duraciones`,
      `      npm run continuidad  -- ${carpetaArg} --pares`,
      `      npm run plan         -- ${carpetaArg} --prediccion`,
      `      npm run validar      -- ${carpetaArg}/manifiesto.json`,
      `      npm run videos       -- ${carpetaArg} --solo-plan`,
    ];
  }
  if (familia === 'hablado') {
    return [
      '  Paso siguiente (seccion 12): mirar las hojas y las imagenes antes de pagar los clips. Si estan bien:',
      `      npm run videos -- ${carpetaArg}${tomas} --si`,
    ];
  }
  if (familia === 'ugc') {
    return [
      '  Paso siguiente (seccion 11): mirar la imagen de la persona antes de pagar los bloques. Si salio con',
      '  texto, con algo en las manos o con otra persona, se le muestra al usuario y, con su si:',
      `      npm run imagenes -- ${carpetaArg} --rehacer --si`,
      '  Si esta bien, los bloques (con --ganchos si los aprobo):',
      `      npm run videos -- ${carpetaArg}${tomas} --si`,
    ];
  }
  if (familia === 'voz' && !conVideos) {
    if (!fs.existsSync(rutaVoz(carpeta))) {
      return [
        `  Paso siguiente (seccion 10): en ${m.estilo} la voz la elige el usuario. Las de la cuenta:`,
        '      npm run voces',
        '  La elegida va al .env (ELEVENLABS_VOICE_ID=...). Despues, y con la voz escuchada, los videos:',
        `      npm run audio  -- ${carpetaArg}`,
        `      npm run videos -- ${carpetaArg}${tomas} --si`,
      ];
    }
    return [
      '  Paso siguiente: escuchar la voz y mirar arriba, en las lineas [voz], la tabla de cada toma (real',
      '  contra prevista) y si dice ATENCION. Un desfase grande se arregla ANTES de pagar los videos. Si esta bien:',
      `      npm run videos -- ${carpetaArg}${tomas} --si`,
    ];
  }
  return ['  Paso siguiente: el checkpoint obligatorio.', `      npm run revisar -- ${carpetaArg}`];
}

// ---------------------------------------------------------------- --solo-plan

/**
 * El costo junto, sin gastar: el de las imagenes (generar-imagenes --solo-plan,
 * lo que falta) y el de los videos (estimar-video, que no necesita que existan
 * las imagenes). estimar-video cuenta el anuncio entero: aca se le restan los
 * clips que ya estan en video/ y, con --tomas, los que no entran, igual que hace
 * generar-videos al armar su plan.
 */
async function soloPlan({ carpeta, carpetaArg, m, familia, soloTomas, argsTomas, scripts = SCRIPTS }) {
  console.log('  --solo-plan: el costo de las imagenes y el de los videos, sin gastar nada.\n');

  const rImg = await correrHijo(scripts.imagenes, [carpetaArg, '--solo-plan', ...argsTomas], { capturar: true });
  if (rImg.codigo !== 0) {
    console.error(`\n  !  El plan de las imagenes salio con codigo ${rImg.codigo} (arriba dice por que). No sigo.\n`);
    return 1;
  }
  const costoImg = rImg.salida.match(/Costo:\s+(\d+) creditos = US\$/);
  const creditosImg = costoImg ? Number(costoImg[1]) : 0;
  const saldo = rImg.salida.match(/Tu saldo:\s+(\d+) creditos/);

  const rVid = await correrHijo(scripts.estimar, [carpetaArg], { capturar: true });
  if (rVid.codigo !== 0) {
    console.error(`\n  !  La estimacion de los videos salio con codigo ${rVid.codigo} (arriba dice por que). No sigo.\n`);
    return 1;
  }
  const totalVid = rVid.salida.match(/TOTAL:\s+(\d+) creditos/);
  let creditosVid = totalVid ? Number(totalVid[1]) : 0;

  // Lo que estimar-video cuenta y esta corrida no paga. Con continuidad su
  // cadena se estima con los tiempos de la voz y la deja como la imprimio.
  const notasVid = [];
  if (familia !== 'continuidad') {
    // Con la voz hecha, igual que estimar-video: sin el B-roll que no entra en
    // el video. La regla con la carpeta (brollQueEntranEnCarpeta), la misma con
    // la que generar-imagenes y generar-videos deciden que piden: con unos
    // tiempos de una voz que ya no esta (falta audio/voz.mp3) no decide nada, y
    // las imagenes y los videos cuentan todo el B-roll, igual que lo pedirian.
    const est = estimar(m, { reglaBroll: brollQueEntranEnCarpeta(m, carpeta) });
    const enPlan = new Set(planDeVideos(m, { soloTomas }).map((t) => t.id));
    const fuera = { n: 0, cr: 0 };
    const hechos = { n: 0, cr: 0 };
    let cuenta = 0;
    // (uno que ya esta en video/, de antes, tampoco se pagaria: no cuenta como ahorro)
    const noEntran = est.brollQueNoEntra.filter((f) => enPlan.has(`broll-${f.n}`) && !fs.existsSync(path.join(carpeta, 'video', `broll-${f.n}.mp4`)));
    if (noEntran.length) {
      const cr = noEntran.reduce((s, f) => s + f.creditos, 0);
      notasVid.push(
        `${noEntran.length} B-roll no entran en el video con esta voz: no se piden ni sus imagenes ni sus videos ` +
          `(${cr} creditos menos de video): ${noEntran.map((f) => f.n).join(', ')}`
      );
    } else if (!est.reglaBroll.aplica && (est.reglaBroll.sinTiempos || est.reglaBroll.tiemposQueNoSirven) && (m.broll || []).length) {
      notasVid.push(`cuenta todo el B-roll: es un maximo (${est.reglaBroll.motivo}); con la voz hecha se piden solo los que entran en el video`);
    }
    for (const d of est.detalle) {
      if (!enPlan.has(d.id)) {
        fuera.n++;
        fuera.cr += d.creditos;
      } else if (fs.existsSync(path.join(carpeta, 'video', `${d.id}.mp4`))) {
        hechos.n++;
        hechos.cr += d.creditos;
      } else cuenta += d.creditos;
    }
    if (fuera.n) notasVid.push(`--tomas ${soloTomas.join(',')}: ${fuera.n} clip(s) no entran (${fuera.cr} creditos menos)`);
    if (hechos.n) notasVid.push(`ya estan en video/ ${hechos.n} clip(s): no se vuelven a pagar (${hechos.cr} creditos menos)`);
    if (fuera.n || hechos.n) creditosVid = cuenta;
  }

  console.log(`\n=== Costo junto — ${path.basename(carpeta)} ===\n`);
  const soloImagenes = !haceVideos(familia, carpeta);
  console.log(`  Imagenes:   ${String(creditosImg).padStart(5)} creditos = ${usd(creditosImg)}`);
  console.log(
    `  Videos:     ${String(creditosVid).padStart(5)} creditos = ${usd(creditosVid)}` +
      (familia === 'continuidad' ? '   (estimado; se fija cuando los pasos tengan su duracion)' : '   (estimado como npm run estimar:video)')
  );
  for (const n of notasVid) console.log(`              ${n}`);
  if (soloImagenes) {
    console.log(`\n  Esta corrida (--si) paga SOLO las imagenes: ${creditosImg} creditos = ${usd(creditosImg)}`);
    console.log(`  Los videos van despues, por separado (npm run videos). Todo el anuncio: ${creditosImg + creditosVid} creditos = ${usd(creditosImg + creditosVid)}`);
  } else {
    console.log(`  TOTAL:      ${String(creditosImg + creditosVid).padStart(5)} creditos = ${usd(creditosImg + creditosVid)}`);
  }
  if (saldo) {
    const s = Number(saldo[1]);
    const pagaAhora = soloImagenes ? creditosImg : creditosImg + creditosVid;
    console.log(`  Tu saldo:   ${String(s).padStart(5)} creditos = ${usd(s)}`);
    if (s < pagaAhora) console.log('  ATENCION:   no te alcanza el saldo para todo esto.');
  }
  console.log('');

  // Lo que no entra en el numero, y lo que --si haria distinto.
  if (familia === 'voz' && !fs.existsSync(rutaVoz(carpeta))) {
    if (generaVoz(familia, carpeta, m)) {
      console.log('  La voz falta: --si la genera con ElevenLabs (se descuenta de tu cuota de caracteres, no de kie.ai)');
      console.log('  al mismo tiempo que las imagenes, y NO pide los videos: la voz nueva se escucha antes de pagarlos.');
    } else {
      console.log(`  La voz falta, y en ${m.estilo} la elige el usuario (npm run voces): --si hace solo las imagenes.`);
    }
  }
  if (familia === 'musica' && !fs.existsSync(rutaTiempos(carpeta))) {
    console.log(`  !  Falta audio/tiempos.json: --si no arranca hasta que este (npm run tiempos -- ${carpetaArg}).`);
  }
  if (!ESTILOS_SIN_MUSICA.includes(m.estilo) && m.modo_audio !== 'musica') {
    console.log(`  No incluye la musica de fondo: npm run musica -- ${carpetaArg} --solo-plan (seccion 3).`);
  }
  if (Array.isArray(m.ganchos_alternativos) && m.ganchos_alternativos.length) {
    console.log(`  Tampoco los ganchos alternativos (opcionales): van aparte, con npm run videos -- ${carpetaArg} --ganchos --si`);
  }
  console.log('\n  --solo-plan: no se genero nada y no se cobro nada.');
  console.log('  Con el si del usuario:');
  console.log(`      npm run producir -- ${carpetaArg}${argsTomas.length ? ` ${argsTomas.join(' ')}` : ''} --si\n`);
  return 0;
}

// ---------------------------------------------------------------- --si

/** La corrida de verdad. Devuelve el codigo de salida: 0 si todo salio. */
export async function producir({ carpeta, carpetaArg, m, familia, argsTomas = [], scripts = SCRIPTS }) {
  const t0 = Date.now();
  const previos = fotoDeCarpetas(carpeta);
  const conVideos = haceVideos(familia, carpeta);
  const faltaVoz = familia === 'voz' && !fs.existsSync(rutaVoz(carpeta));
  const conVoz = generaVoz(familia, carpeta, m);

  // Entre los dos procesos no pasan de LIMITE_CREACIONES; solo, el de imagenes va con todo.
  const mitad = Math.max(1, Math.floor(LIMITE_CREACIONES.maximo / 2));
  const envKie = conVideos ? { ...process.env, KIE_LIMITE_CREACIONES: String(mitad) } : process.env;

  const argsImg = [carpetaArg, '--si', ...argsTomas];
  const argsVid = [carpetaArg, '--si', '--esperar-imagenes', ...argsTomas];
  console.log('  Procesos:');
  console.log(`      [img]  node produccion/generar-imagenes.js ${argsImg.join(' ')}`);
  if (conVoz) console.log(`      [voz]  node produccion/generar-audio.js ${carpetaArg}            (falta audio/voz.mp3)`);
  if (conVideos) {
    console.log(`      [vid]  node produccion/generar-videos.js ${argsVid.join(' ')}`);
    console.log(`  Limite:   ${mitad} createTask cada 10 s en cada uno (${mitad * 2} entre los dos; kie admite 20)`);
  } else if (faltaVoz) {
    console.log(`      [vid]  no en esta corrida: ${conVoz ? 'la voz nueva se escucha antes de pagar los videos' : 'primero el usuario elige la voz'}`);
  }
  console.log('');

  // Un aviso viejo haria que los videos dieran por perdidas imagenes que se van a generar ahora.
  fs.rmSync(rutaFin(carpeta), { force: true });

  const pImg = correrHijo(scripts.imagenes, argsImg, { prefijo: '[img] ', env: envKie }).then((r) => {
    escribirFin(carpeta, r.codigo);
    console.log(`${r.codigo === 0 ? '  OK  ' : '  !  '}Imagenes terminadas a los ${seg(Date.now() - t0)}${r.codigo === 0 ? '' : ` (codigo ${r.codigo})`}.`);
    return r;
  });

  // La voz va al mismo tiempo que las imagenes; con ella nueva no van los
  // videos (haceVideos), asi que nadie la espera.
  let pVoz = Promise.resolve(null);
  if (conVoz) {
    pVoz = correrHijo(scripts.audio, [carpetaArg], { prefijo: '[voz] ' }).then((r) => {
      const lista = fs.existsSync(rutaVoz(carpeta));
      console.log(
        lista
          ? `  OK  La voz esta lista a los ${seg(Date.now() - t0)}: se escucha antes de pagar los videos (no van en esta corrida).`
          : `  !  La voz no se genero (codigo ${r.codigo}).`
      );
      return { ...r, lista };
    });
  }

  const pVid = conVideos ? correrHijo(scripts.videos, argsVid, { prefijo: '[vid] ', env: envKie }) : Promise.resolve(null);

  const [rImg, rVoz, rVid] = await Promise.all([pImg, pVoz, pVid]);
  const ms = Date.now() - t0;

  // ---- el resumen
  const img = loDeEstaCorrida(carpeta, 'img', 'imagenes', t0, previos);
  const vid = conVideos ? loDeEstaCorrida(carpeta, 'video', 'clips', t0, previos) : null;
  const pendientes = pendientesEnKie(carpeta, m);
  const fallo = rImg.codigo !== 0 || (rVoz && rVoz.codigo !== 0) || (conVideos && (!rVid || rVid.codigo !== 0));

  const estado = (codigo) => (codigo === 0 ? 'OK' : `SE DETUVO (codigo ${codigo})`);
  // Sin log de esta corrida no se genero nada (todo estaba hecho, o se corto antes de empezar).
  const nuevas = (x, que) => (x ? `${x.n} ${que} (${x.creditos} creditos = ${usd(x.creditos)})${x.parcial ? ', log parcial' : ''}` : 'nada nuevo');

  console.log(`\n=== Produccion — ${path.basename(carpeta)}: resumen ===\n`);
  console.log(`  Imagenes:    ${estado(rImg.codigo)}, ${nuevas(img, 'nuevas')}, en ${seg(rImg.ms)}`);
  if (familia === 'voz') {
    if (!faltaVoz) console.log('  Voz:         ya estaba (audio/voz.mp3)');
    else if (!rVoz) console.log(`  Voz:         falta; en ${m.estilo} la elige el usuario (abajo)`);
    else if (rVoz.lista) console.log(`  Voz:         ${rVoz.codigo === 0 ? 'OK' : `generada, pero salio con codigo ${rVoz.codigo} (arriba, en [voz], dice que falta)`}, en ${seg(rVoz.ms)}`);
    else console.log(`  Voz:         NO SE GENERO (codigo ${rVoz.codigo}): el motivo esta arriba, en las lineas [voz]`);
  }
  if (conVideos) console.log(`  Videos:      ${estado(rVid.codigo)}, ${nuevas(vid, 'nuevos')}, en ${seg(rVid.ms)}`);
  else if (faltaVoz) console.log(`  Videos:      no van en esta corrida: ${conVoz ? 'la voz se escucha antes de pagarlos' : 'falta la voz'}`);
  const gasto = (img?.creditos || 0) + (vid?.creditos || 0);
  console.log(`  Gasto real:  ${gasto} creditos = ${usd(gasto)}   (de img/log-modelos.json${conVideos ? ' y video/log-modelos.json' : ''})`);
  console.log(`  Tiempo:      ${seg(ms)}`);

  const respaldo = [...(img?.respaldo || []), ...(vid?.respaldo || [])];
  if (respaldo.length) {
    console.log(`\n  ATENCION: ${respaldo.length} salieron del modelo de respaldo y pueden verse distintos:`);
    for (const r of respaldo) console.log(`      ${r}`);
  }
  if (pendientes.siguen.length) {
    // Siguen generando, o terminaron y no se pudieron bajar (kie-client deja el
    // pendiente en los dos casos).
    console.log(`\n  Quedan en kie ${pendientes.siguen.length} tarea(s) sin bajar, anotadas junto a su archivo:`);
    for (const p of pendientes.siguen) console.log(`      ${p}`);
    console.log('  Al volver a correr se retoman esas mismas tareas: no se pide otra igual ni se paga dos veces.');
  }
  if (pendientes.brollFuera.length) {
    // De un B-roll que con esta voz ya no entra: nadie las retoma solo (no se
    // piden), y el video no las necesita. Ya se pagaron: si se quieren igual,
    // --todo-el-broll las baja sin pedir otra.
    const lista = pendientes.brollFuera;
    console.log(`\n  ${lista.length === 1 ? 'Una tarea ya pagada en kie es' : `${lista.length} tareas ya pagadas en kie son`} de B-roll que con esta voz no entran en el video:`);
    for (const p of lista) console.log(`      ${p.archivo}   (B-roll ${p.n}, toma ${p.toma})`);
    console.log('  El video no los necesita y volver a correr no las baja. Si los quieres igual (para montar a mano), se bajan');
    console.log('  sin pagar otra:');
    for (const [sub, comando] of [['img', 'imagenes'], ['video', 'videos']]) {
      const tomas = [...new Set(lista.filter((p) => p.sub === sub).map((p) => p.toma))];
      if (tomas.length) console.log(`      npm run ${comando} -- ${carpetaArg} --tomas ${tomas.join(',')} --todo-el-broll --si`);
    }
  }

  const comando = `npm run producir -- ${carpetaArg}${argsTomas.length ? ` ${argsTomas.join(' ')}` : ''} --si`;
  if (fallo) {
    console.log('\n  Algo no salio. El detalle esta arriba, en las lineas [img], [voz] o [vid] que dicen que paso.');
    console.log('  Para retomar, el mismo comando:');
    console.log(`      ${comando}`);
    console.log('  Lo ya hecho no se paga otra vez, y las tareas que seguian en kie se retoman.');
    if (rImg.codigo !== 0 || (rVid && rVid.codigo !== 0)) {
      console.log('  Si el motivo es un rechazo por contenido, volver a correr no alcanza: ese mensaje dice que hacer.');
    }
    // La voz quedo hecha pero algo de despues fallo (la nivelacion de estilo
    // lego): producir no la vuelve a generar, asi que eso se arregla aparte.
    if (rVoz?.lista && rVoz.codigo !== 0) console.log('  La voz quedo generada con un problema: el comando que lo arregla esta en las lineas [voz].');
    console.log('');
    return 1;
  }
  console.log('');
  for (const l of pasoSiguiente(familia, { carpeta, carpetaArg, m, conVideos, argsTomas })) console.log(l);
  console.log('');
  return 0;
}

// ---------------------------------------------------------------- CLI

function ayuda(carpetaArg) {
  console.log('  npm run producir genera las imagenes y los videos de un tiron: cada video se pide apenas');
  console.log('  estan sus imagenes, sin esperar a que terminen todas. Cobra en kie.ai lo mismo que');
  console.log('  npm run imagenes + npm run audio + npm run videos (esos siguen funcionando igual).\n');
  console.log('  El costo junto, sin gastar:');
  console.log(`      npm run producir -- ${carpetaArg} --solo-plan`);
  console.log('  Con el si del usuario:');
  console.log(`      npm run producir -- ${carpetaArg} --si`);
  console.log('  --tomas 1,5   solo esas tomas, en las imagenes y en los videos\n');
  console.log('  No lanza la musica ni el montaje: siguen en su lugar del flujo. Sin --si no se pregunta');
  console.log('  nada: en la terminal de Claude Code nadie puede contestar.\n');
  console.log('  No se genero nada ni se cobro nada.\n');
}

/**
 * El comando entero. Devuelve el codigo de salida. `scripts` existe solo para
 * las pruebas (un generar-audio que no llame a ElevenLabs); desde la terminal
 * van siempre los de SCRIPTS.
 */
export async function cli(args = process.argv.slice(2), { scripts = SCRIPTS } = {}) {
  const idxTomas = args.indexOf('--tomas');
  const valorTomas = idxTomas !== -1 ? args[idxTomas + 1] : undefined;
  const carpetaArg = args.find((a, i) => !a.startsWith('--') && !(idxTomas !== -1 && i === idxTomas + 1));
  const conocidos = new Set(['--si', '--solo-plan', '--tomas']);
  const desconocidos = args.filter((a) => a.startsWith('--') && !conocidos.has(a));

  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/producir.js <carpeta-del-anuncio> [--solo-plan | --si] [--tomas 1,5]\n');
    return 1;
  }
  if (desconocidos.length) {
    // Nada de --rehacer ni de flags a medias: lo que no es de producir va con su comando.
    console.error(`\n  producir no lleva ${desconocidos.join(' ')}. Lleva solo --solo-plan, --si y --tomas.`);
    console.error('  Para lo demas estan los comandos de siempre:');
    console.error(`      npm run imagenes -- ${carpetaArg} ...`);
    console.error(`      npm run videos   -- ${carpetaArg} ...    (--sin-broll, --todo-el-broll, --rehacer, --ganchos, --duracion, --pasos)\n`);
    return 1;
  }
  let soloTomas = null;
  if (idxTomas !== -1) {
    soloTomas = valorTomas && !valorTomas.startsWith('--') ? valorTomas.split(',').map((s) => Number(s.trim())).filter(Number.isInteger) : [];
    if (!soloTomas.length) {
      console.error(`\n  --tomas necesita los numeros de las tomas, separados por coma:  npm run producir -- ${carpetaArg} --tomas 1,5 --si\n`);
      return 1;
    }
  }
  const argsTomas = soloTomas ? ['--tomas', soloTomas.join(',')] : [];

  const carpeta = path.resolve(carpetaArg);
  const rutaManifiesto = path.join(carpeta, 'manifiesto.json');
  if (!fs.existsSync(rutaManifiesto)) {
    console.error(`\n  No encuentro el manifiesto: ${rutaManifiesto}\n`);
    return 1;
  }
  const m = JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'));
  const familia = familiaDe(m);
  const ctx = { carpeta, carpetaArg, m };

  console.log(`\n=== Produccion — ${path.basename(carpeta)} ===\n`);
  console.log(`  Anuncio:  ${m.estilo}, ${m.modo_audio}${tieneContinuidad(m) ? ', con continuidad' : ''}${soloTomas ? `   (limitado a las tomas ${soloTomas.join(', ')})` : ''}`);
  const lineasQueHace = queHace(familia, ctx);
  for (const [i, l] of lineasQueHace.entries()) console.log(`  ${i === 0 ? 'Que hace: ' : '          '}${l}`);
  console.log('');

  const soloPlanPedido = args.includes('--solo-plan');
  if (!soloPlanPedido && !args.includes('--si')) {
    ayuda(carpetaArg);
    return 0;
  }

  try {
    cargarEnv();
    requerirClave('KIE_API_KEY', 'copiala desde https://kie.ai/api-key');
  } catch (e) {
    console.error(`  ${e.message}\n`);
    return 1;
  }

  // (1) Puerta de entrada: con el manifiesto mal no se gasta un centavo.
  const { errores, avisos } = validarManifiesto(m, { carpeta });
  for (const a of avisos) console.log(`  AVISO  ${a}`);
  if (errores.length) {
    console.error(`${avisos.length ? '\n' : ''}  El manifiesto tiene errores. No genero nada hasta que se arreglen:\n`);
    for (const e of errores) console.error(`  ERROR  ${e}`);
    console.error('');
    return 1;
  }
  if (avisos.length) console.log('');

  if (soloPlanPedido) return soloPlan({ ...ctx, familia, soloTomas, argsTomas, scripts });

  // (2) Lo que cada familia necesita antes de pagar nada.
  if (familia === 'musica' && !fs.existsSync(rutaTiempos(carpeta))) {
    console.error('  Falta audio/tiempos.json: en musica las ventanas de cada toma salen de los tiempos de la cancion.');
    console.error('  Primero:');
    console.error(`      npm run tiempos -- ${carpetaArg}\n`);
    console.error('  No se genero nada ni se cobro nada.\n');
    return 1;
  }
  if (generaVoz(familia, carpeta, m)) {
    // generar-audio preguntaria la voz si falta, y aca no hay a quien: se dice
    // ANTES de lanzar las imagenes, no a mitad de camino.
    const sinClave = !(process.env.ELEVENLABS_API_KEY || '').trim();
    const sinVoz = !(process.env.ELEVENLABS_VOICE_ID || '').trim();
    if (sinClave || sinVoz) {
      console.error(`  Falta la voz del anuncio y no la puedo generar: falta ${sinClave ? 'ELEVENLABS_API_KEY' : 'ELEVENLABS_VOICE_ID'} en el .env.`);
      if (sinVoz && !sinClave) {
        console.error('  La voz la elige el usuario. Para ver las de la cuenta:');
        console.error('      npm run voces');
        console.error('  y el ID elegido va al .env:  ELEVENLABS_VOICE_ID=el_id_que_elegiste');
      }
      console.error('\n  No se genero nada ni se cobro nada.\n');
      return 1;
    }
  }

  return producir({ ...ctx, familia, argsTomas, scripts });
}

// Sin process.exit al final: un exit justo despues de un fetch aborta en
// Windows con Node 24 (ver generar-imagenes.js); el proceso cierra solo.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await cli();
