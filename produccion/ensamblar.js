// FASE 2.5 (paso 2) — renderiza el MP4 final con Remotion, a partir de plan-montaje.json.
//
//   node produccion/ensamblar.js temp/mi-anuncio
//   node produccion/ensamblar.js temp/mi-anuncio --solo-completa   (la app: solo la version completa)
//
// Este paso es OPCIONAL (seccion 8.1): quien prefiera editar a mano se lleva
// los clips y plan-montaje.txt a CapCut.
//
// AVISO DE LICENCIA: Remotion es gratis para individuos y empresas de menos de
// 3 empleados. Con 3 o mas hace falta licencia comercial, y el tier de
// automatizacion cobra por render. Ver el README.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RAIZ, DIR_OUTPUT, ESTILOS_HABLADOS, ESTILOS_SIN_MUSICA, ESCALA_RENDER } from './config.js';
import { escribirPlanLegible } from './plan-para-humanos.js';
import { PISTA_FIJA_POR_ESTILO } from './pista-fija.js';
import { tieneContinuidad, cadenaDeClips, medirClip } from './continuidad.js';
import { archivarSiExiste } from './historial.js';

const DIR_REMOTION = path.join(RAIZ, 'remotion');

// Calidad del h264. CRF es calidad constante: el codificador gasta bits donde
// hacen falta y ahorra donde no, en vez de forzar un bitrate fijo.
//
// 18 es el default de Remotion, pensado para material que se va a seguir
// editando: casi sin perdida, pero infla el archivo. 21 en 720x1280 es
// visualmente equivalente y pesa un tercio menos. Meta reencoda todo lo que
// se sube, asi que subir un archivo enorme no mejora lo que ve el usuario:
// solo tarda mas en cargar. Mas alto que 23 si empieza a notarse en las
// texturas de lana, que es justo donde vive este estilo.
const CRF = 21;

/**
 * CONTINUIDAD: lo que impide renderizar un plan de continuidad (o renderizar
 * con un plan viejo un anuncio que ya tiene continuidad). Sin el bloque ni en
 * el manifiesto ni en el plan, devuelve [] sin mirar nada mas.
 *
 *   - el manifiesto trae "continuidad" y el plan no, o al reves: el plan es de
 *     antes del cambio;
 *   - la cadena del manifiesto no es la del plan (cambiaron tomas o pasos);
 *   - el plan se hizo cuando un clip todavia no existia (falta: true): su
 *     velocidad salio del largo pedido, no del real;
 *   - un clip cambio de largo despues del plan (se rehizo): su velocidad ya
 *     no lo hace entrar justo en su lugar.
 */
function problemasDeContinuidad(carpeta, plan) {
  let manifiesto = null;
  try {
    manifiesto = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
  } catch {
    manifiesto = null;
  }
  const enManifiesto = tieneContinuidad(manifiesto);
  const enPlan = Boolean(plan.continuidad);
  if (!enManifiesto && !enPlan) return [];
  if (enManifiesto && !enPlan) return ['el manifiesto tiene continuidad y el plan es de antes: monta una toma por linea, con B-roll y cortes.'];
  if (!enManifiesto && enPlan && manifiesto) return ['el plan es de continuidad y el manifiesto ya no trae el bloque "continuidad".'];

  const problemas = [];
  if (manifiesto) {
    const enCadena = cadenaDeClips(manifiesto).map((c) => c.archivo).join(', ');
    if (enCadena !== plan.continuidad.clips.map((c) => c.archivo).join(', ')) {
      problemas.push('la cadena de clips del manifiesto ya no es la del plan (cambiaron las tomas o los pasos).');
    }
  }
  const sinClip = plan.continuidad.clips.filter((c) => c.falta).map((c) => c.archivo);
  if (sinClip.length) {
    problemas.push(`el plan se hizo cuando faltaba${sinClip.length > 1 ? 'n' : ''} ${sinClip.join(', ')}: su velocidad sale del largo pedido, no del real.`);
  }
  const cambiados = [];
  for (const c of plan.continuidad.clips) {
    const ruta = path.join(carpeta, 'video', c.archivo);
    if (c.falta || !fs.existsSync(ruta)) continue;
    const medida = medirClip(ruta);
    const distinto = Number.isInteger(c.frames) && Number.isInteger(medida.frames)
      ? medida.frames !== c.frames
      : Math.abs(medida.segundos - c.largoOriginal) > 0.01;
    if (distinto) cambiados.push(`${c.archivo} (en el plan ${c.largoOriginal.toFixed(3)}s, ahora ${medida.segundos.toFixed(3)}s)`);
  }
  if (cambiados.length) problemas.push(`cambio el largo de ${cambiados.join(', ')}: se rehizo despues del plan.`);
  return problemas;
}

// ---------------------------------------------------------------------------
// CARPETA PUBLICA LIVIANA
//
// Remotion COPIA la carpeta que recibe como --public-dir entera, archivo por
// archivo, a su carpeta temporal (bundler/copy-dir.js: copyFile, sin enlaces),
// y lo hace en CADA render. Antes recibia la carpeta del anuncio completa: en
// zenme-triptofano son 158 MB por render (historial/ 79, img/ 38, qa/ 4) para
// usar 36 (los clips, la voz, la musica y los efectos); en entrevista B, 188
// para usar 20.
//
// Que puede cargar la composicion. Recibe por props SOLO el plan (y los dos
// interruptores), y todos los staticFile de remotion/src arman la ruta con un
// valor del plan, tal cual o con "video/" adelante:
//
//   Anuncio.jsx  video/<pieza.archivo>   tomas, B-roll y cadena de continuidad
//                plan.musica.archivo     la musica
//                plan.transiciones[].archivo   los efectos de sonido
//                plan.audio.voz          la voz en off
//   Escena.jsx   video/<pieza.archivo>   los clips de la escena (podcast, entrevista)
//                pieza.archivo           imagenes, iconos y sonidos de la escena
//
// No hay ninguna ruta fija en el codigo ni fuentes que se carguen de archivo
// (los subtitulos usan Arial Black del sistema). Asi que lo que el render puede
// pedir es, exactamente, cada texto del plan que nombra un archivo de la
// carpeta, directo o dentro de video/. Se recorre el plan ENTERO en vez de
// listar esos campos a mano: si manana el plan nombra un archivo nuevo, entra
// solo, sin acordarse de tocar esto.
//
// Los archivos van como ENLACES DUROS (fs.linkSync): en NTFS no piden permisos
// de administrador, no ocupan lugar y se crean al instante. Por eso la carpeta
// vive DENTRO de la del anuncio: el enlace exige el mismo disco. Si el enlace
// no se puede (otro sistema de archivos), se copia. Borrar la carpeta borra
// los enlaces, nunca los originales.
// ---------------------------------------------------------------------------
const DIR_PUBLICO = '.render-publico';

/** Las rutas (relativas a la carpeta) de cada archivo que el plan nombra. */
function archivosDelPlan(carpeta, plan) {
  const raiz = path.resolve(carpeta);
  const hallados = new Set();
  const visitar = (valor) => {
    if (typeof valor === 'string') {
      // Solo lo que parece un nombre de archivo: el plan trae tambien cientos de
      // palabras de subtitulos, y ninguna termina en ".mp4".
      if (valor.length > 300 || !/\.[a-z0-9]{2,5}$/i.test(valor)) return;
      for (const rel of [valor, `video/${valor}`]) {
        const abs = path.resolve(raiz, rel);
        // Nada de fuera de la carpeta del anuncio: Remotion no lo serviria.
        if (!abs.startsWith(raiz + path.sep)) continue;
        try {
          if (fs.statSync(abs).isFile()) hallados.add(path.relative(raiz, abs));
        } catch {
          // no existe: el plan lo nombra pero no es un archivo de aca
        }
      }
    } else if (Array.isArray(valor)) {
      for (const v of valor) visitar(v);
    } else if (valor && typeof valor === 'object') {
      for (const v of Object.values(valor)) visitar(v);
    }
  };
  visitar(plan);
  return [...hallados].sort();
}

/**
 * Arma <carpeta>/.render-publico/ con lo que el plan nombra, en las mismas
 * rutas relativas. Una sola vez por corrida: sirve para todos los renders.
 * Una carpeta vieja (de un render cortado con Ctrl+C) se borra antes.
 */
function armarCarpetaPublica(carpeta, plan) {
  const destino = path.join(carpeta, DIR_PUBLICO);
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  let enlaces = 0;
  let copias = 0;
  let bytes = 0;
  const archivos = archivosDelPlan(carpeta, plan);
  for (const rel of archivos) {
    const origen = path.join(carpeta, rel);
    const final = path.join(destino, rel);
    fs.mkdirSync(path.dirname(final), { recursive: true });
    try {
      fs.linkSync(origen, final);
      enlaces++;
    } catch {
      fs.copyFileSync(origen, final);
      copias++;
    }
    bytes += fs.statSync(origen).size;
  }
  return { destino, archivos: archivos.length, enlaces, copias, bytes };
}

// ---------------------------------------------------------------------------
// CONCURRENCIA SEGUN LA MEMORIA LIBRE (cuando no se pasa --concurrencia)
//
// Lo medido. Con poca memoria libre el extractor de Remotion falla con "No
// frame found at position" al principio del render, en clips que estan bien:
//
//   2026-10-05  Lego 2: fallo dos veces a 6x (el defecto); salio a 2x.
//   2026-10-11  Cayenne continuidad, 2,5 GB libres: fallo a 6x (dos veces) y
//               a 2x; salio a 1x (21 min las tres versiones).
//   2026-10-13  prueba en seco de entrevista A, 2,5 GB libres: igual, solo 1x.
//               La laptop tenia 16 GB y ~2,8 GB libres en uso normal.
//   2026-10-24  la PC ya tiene 32 GB: con 16,5 GB libres la regla da 6 (el
//               defecto) y zenme-triptofano salio a 6x, 52 s por version.
//
// La regla: 2 GB de reserva (Chrome, el compositor y el sistema) y 1 GB por
// fotograma en paralelo, con techo en lo que Remotion usa por defecto (la mitad
// de los hilos, maximo 8: renderer/get-concurrency.js). Con 2,5 GB da 1, justo
// lo unico que salio; con 4 GB da 2; con 8 GB o mas, el defecto de siempre
// (6 en los 12 hilos de esta PC). Si aun asi falla, el reintento de abajo baja.
// ---------------------------------------------------------------------------
function concurrenciaSegunMemoria() {
  const libresGB = os.freemem() / 1024 ** 3;
  const techo = Math.round(Math.min(8, Math.max(1, os.cpus().length / 2)));
  return Math.max(1, Math.min(techo, Math.floor(libresGB - 2)));
}

/**
 * Como se ve, en el stderr de Remotion, un render que se cayo por falta de
 * memoria: el "No frame found at position" del extractor (lo medido, arriba),
 * Chrome que se muere ("Target closed", "Page crashed") o el sistema sin
 * memoria. Solo ese fallo se reintenta con menos concurrencia.
 */
const FIRMA_SIN_MEMORIA = /No frame found|Target closed|Page crashed|ENOMEM|out of memory|allocation failed/i;

/**
 * Arma un MP4 con el video de `conVideo` y el audio de `conAudio`, copiando los
 * dos streams sin recodificar (ver "DOS RENDERS EN VEZ DE TRES" abajo). Los
 * metadatos del contenedor salen del de video, como en un render, y el moov va
 * al principio (faststart) igual que en los MP4 de Remotion. -movie_timescale
 * 1000 es la escala del ffmpeg de Remotion: el ffmpeg 9 del sistema usa otra
 * (720000) y el MP4 quedaba igual de bien pero con otros bytes en la cabecera.
 * Con ella, contra un render completo de la misma version difiere solo el
 * numero de version de "encoder" (medido con zenme-triptofano el 2026-10-24).
 * Se escribe a un temporal y se renombra: nunca queda un MP4 a medias con el
 * nombre final. Devuelve null si salio; si no, el motivo.
 */
function unirVideoYAudio(conVideo, conAudio, salida) {
  const temporal = salida.replace(/\.mp4$/i, '.armando.mp4');
  const r = spawnSync(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', conVideo,
      '-i', conAudio,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c', 'copy',
      '-map_metadata', '0',
      '-movflags', '+faststart',
      '-movie_timescale', '1000',
      temporal,
    ],
    { encoding: 'utf8' }
  );
  if (r.error || r.status !== 0 || !fs.existsSync(temporal)) {
    fs.rmSync(temporal, { force: true });
    if (r.error) return r.error.code === 'ENOENT' ? 'ffmpeg no esta instalado o no esta en el PATH' : r.error.message;
    const detalle = String(r.stderr || '').trim();
    if (/matches no streams/.test(detalle)) return `${path.basename(conAudio)} no trae pista de audio`;
    return detalle.split('\n')[0].slice(0, 200) || `ffmpeg termino con codigo ${r.status}`;
  }
  try {
    fs.renameSync(temporal, salida);
  } catch (e) {
    fs.rmSync(temporal, { force: true });
    return e.message;
  }
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('ensamblar.js')) {
  const args = process.argv.slice(2);
  const carpetaArg = args.find(
    (a) => !a.startsWith('--') && !['--musica-db', '--sub-tamano', '--concurrencia'].includes(args[args.indexOf(a) - 1])
  );

  // --concurrencia N: cuantos fotogramas renderiza Remotion a la vez. Sin el,
  // sale de la memoria libre (concurrenciaSegunMemoria, arriba): con poca
  // memoria (2,5 GB medidos el 2026-10-11 con Cayenne y el 2026-10-13 con la
  // prueba en seco de entrevista A) el extractor falla con "No frame found at
  // position" y con concurrencia 1 sale bien, mas lento. Vale para todos los
  // estilos y no cambia nada del montaje.
  const iCon = args.indexOf('--concurrencia');
  const concurrencia = iCon !== -1 && args[iCon + 1] !== undefined ? Number(args[iCon + 1]) : null;

  // --musica-db N: renderiza SOLO la version con musica, a ese nivel, y le pone
  // el nivel en el nombre del archivo. Sirve para elegir de oido cuanto tiene
  // que sonar la musica sin volver a planear ni gastar creditos: renderizar es
  // gratis. El valor elegido despues se fija en REGLAS, no aca.
  const iDb = args.indexOf('--musica-db');
  const musicaDbForzado = iDb !== -1 && args[iDb + 1] !== undefined ? Number(args[iDb + 1]) : null;

  // --sub-tamano N: renderiza SOLO la version con subtitulos, con ese tamano de
  // letra (proporcion del ancho), y lo pone en el nombre del archivo. Igual que
  // --musica-db: sirve para elegir de ojo sin gastar creditos.
  //
  // OJO: el tamano de subtitulos vive en REGLAS.subtitulos, que es COMPARTIDO
  // por todos los estilos. Si el valor probado aca se adopta, cambia tambien
  // crochet, claymation y los demas. No es un ajuste de UGC.
  const iSub = args.indexOf('--sub-tamano');
  const subTamanoForzado = iSub !== -1 && args[iSub + 1] !== undefined ? Number(args[iSub + 1]) : null;

  // --solo-completa: renderiza SOLO la version completa (con subtitulos y, si el estilo la lleva, musica): un
  // render, sin el segundo ni el remux de "solo subtitulos". La usa la app (decision de Diego, 2026-10-26: la app
  // entrega la completa y las demas se sacan desde su editor, que exporta sin subtitulos o sin musica). El archivo
  // es el mismo que sale hoy para esa version. Sin la opcion, todo sigue igual (Claude Code y el paquete de
  // alumnos). Ver "SOLO LA COMPLETA" mas abajo.
  const soloCompleta = args.includes('--solo-completa');

  if (!carpetaArg) {
    console.error('\n  Uso: node produccion/ensamblar.js <carpeta-del-anuncio>\n');
    process.exit(1);
  }

  const carpeta = path.resolve(carpetaArg);
  const rutaPlan = path.join(carpeta, 'plan-montaje.json');

  if (!fs.existsSync(rutaPlan)) {
    console.error(`\n  Falta ${rutaPlan}.\n  Genera el plan primero:\n      npm run plan -- ${carpetaArg}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(DIR_REMOTION, 'node_modules'))) {
    console.error('\n  Remotion no esta instalado. Entra a remotion/ y ejecuta: npm install\n');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(rutaPlan, 'utf8'));
  // CONTINUIDAD: el plan trae la cadena de clips (plan.continuidad.clips) y los
  // bloques van sin `toma`. Sin ese bloque, todo sigue como siempre.
  const continuidad = plan.continuidad ?? null;
  // ESTILOS HABLADOS (podcast, entrevista): el plan trae `escena`, las capas de
  // video que renderiza Remotion (clips, congelado, iconos, sticker, texto del
  // CTA, sonidos); los bloques son solo la linea de tiempo del audio. Sin
  // `escena`, todo sigue como siempre.
  const escena = plan.escena ?? null;

  // Verifica que exista todo lo que el plan nombra, antes de arrancar el render.
  const faltan = [];
  if (continuidad) {
    for (const c of continuidad.clips) {
      if (!fs.existsSync(path.join(carpeta, 'video', c.archivo))) faltan.push(c.archivo);
    }
  } else {
    for (const b of plan.bloques) {
      if (!fs.existsSync(path.join(carpeta, 'video', b.toma.archivo))) faltan.push(b.toma.archivo);
      if (b.broll && !fs.existsSync(path.join(carpeta, 'video', b.broll.archivo))) faltan.push(b.broll.archivo);
    }
  }
  if (escena) {
    // Las piezas de la escena: los clips viven en video/, el resto (congelado,
    // iconos, foto del producto, efectos) relativo a la carpeta del anuncio.
    for (const p of escena.piezas || []) {
      if (!p.archivo) continue;
      const ruta = p.tipo === 'clip' ? path.join(carpeta, 'video', p.archivo) : path.join(carpeta, p.archivo);
      if (!fs.existsSync(ruta) && !faltan.includes(p.archivo)) faltan.push(p.archivo);
    }
  }
  // La voz en off solo se exige si el plan la declara. En dialogo_nativo el
  // personaje habla dentro del clip y no hay pista aparte.
  if (plan.audio?.voz && !fs.existsSync(path.join(carpeta, plan.audio.voz))) faltan.push(plan.audio.voz);
  // La musica y los efectos de las transiciones tambien: si falta uno, Remotion
  // no lo encuentra (404 de su servidor) y el render se cae a mitad de camino.
  if (plan.musica?.archivo && !fs.existsSync(path.join(carpeta, plan.musica.archivo))) faltan.push(plan.musica.archivo);
  for (const t of plan.transiciones || []) {
    if (t?.archivo && !fs.existsSync(path.join(carpeta, t.archivo)) && !faltan.includes(t.archivo)) faltan.push(t.archivo);
  }
  if (faltan.length) {
    console.error(`\n  Faltan archivos que el plan necesita:\n`);
    for (const f of faltan) console.error(`      ${f}`);
    console.error('');
    process.exit(1);
  }

  // CONTINUIDAD: que el plan sea de la cadena que hay en disco. Si no, Remotion
  // montaria el anuncio de antes o pondria un clip a una velocidad pensada
  // para otro largo (y entonces se cortaria o se congelaria).
  const problemas = problemasDeContinuidad(carpeta, plan);
  if (problemas.length) {
    console.error('\n  El plan de montaje no corresponde a lo que hay en la carpeta:\n');
    for (const p of problemas) console.error(`  !  ${p}`);
    console.error(`\n  Vuelve a planear (gratis) y despues ensambla:\n      npm run plan -- ${carpetaArg}\n`);
    process.exit(1);
  }

  const REGLAS_SUBTITULOS_DEFECTO = 0.06137;
  const nombre = path.basename(carpeta);

  if (musicaDbForzado !== null) {
    if (!plan.musica?.archivo) {
      console.error('\n  --musica-db pero este anuncio no tiene pista de musica.\n');
      process.exit(1);
    }
    plan.musica.db = musicaDbForzado;
    console.log(`\n  Prueba de nivel: la musica va a ${musicaDbForzado} dB (solo la version con musica).`);
  }
  fs.mkdirSync(DIR_OUTPUT, { recursive: true });

  // FASE 2.7 — TRES versiones del mismo montaje: mismos cortes, mismas
  // duraciones. Lo unico que cambia son las capas que se apagan.
  //
  //   con-subtitulos              la que se sube a Meta
  //   solo-subtitulos             subtitulos SI, musica NO: para ponerle otra pista
  //   sin-subtitulos-sin-musica   para llevar a CapCut y ponerle lo propio
  //
  // La tercera NO apaga el audio de los clips ni la voz en off: eso es el
  // contenido, no una capa de arreglo. Apaga musica y subtitulos, nada mas.
  // Existe porque hoy hay que elegir entre el MP4 terminado y los clips
  // sueltos, y el punto medio -montado pero sin las capas que uno quiere
  // cambiar- no existia.
  //
  // La SEGUNDA cambio el 2026-09-05 (decision de Diego, vale para TODOS los
  // estilos): antes era "sin subtitulos con musica" y ahora es al reves,
  // "con subtitulos sin musica". El caso real es querer cambiar la pista
  // musical sin perder el subtitulado, que es el trabajo caro. La combinacion
  // vieja -musica sin subtitulos- ya la cubre la tercera para quien la quiera.
  //
  // EXCEPCION — modo_audio "musica": salen DOS, no tres.
  //
  // Las tres de arriba existen para poder cambiar la pista musical. En un
  // anuncio musical no hay pista que cambiar: la cancion es el contenido, no
  // una capa, y va por `audio.voz` justamente para que `sinMusica` no la
  // toque. Con eso, la primera y la segunda version saldrian identicas y la
  // tercera solo se distinguiria por el subtitulo. Quedan dos: con y sin.
  //
  // La app pide solo la primera (--solo-completa, ver SOLO LA COMPLETA): las otras
  // las saca el usuario desde su editor.
  const rutaManifiesto = path.join(carpeta, 'manifiesto.json');
  const manifiesto = fs.existsSync(rutaManifiesto)
    ? JSON.parse(fs.readFileSync(rutaManifiesto, 'utf8'))
    : null;
  const modoAudio = manifiesto?.modo_audio ?? null;
  const esMusical = modoAudio === 'musica';
  // Estilos sin musica por decision del estilo (podcast, entrevista): salen DOS
  // versiones, como el musical, y no se avisa de musica ni de transiciones.
  const sinMusicaPorEstilo = Boolean(manifiesto && ESTILOS_SIN_MUSICA.includes(manifiesto.estilo));

  // Un anuncio hablado (podcast, entrevista) con un plan sin `escena` es un plan
  // de antes de estos estilos: montaria una toma por linea y nada de lo que se
  // ve encima. Igual que con continuidad, se pide volver a planear (gratis).
  if (manifiesto && ESTILOS_HABLADOS.includes(manifiesto.estilo) && !escena) {
    console.error(`\n  El plan de montaje no trae la escena del estilo "${manifiesto.estilo}" (es de antes).`);
    console.error(`\n  Vuelve a planear (gratis) y despues ensambla:\n      npm run plan -- ${carpetaArg}\n`);
    process.exit(1);
  }

  // ---------------------------------------------------------------------
  // Lo que el motor NO comprobaba: la musica de fondo y las transiciones.
  //
  // Las dos son obligatorias en todos los estilos menos los dos cantados
  // (musical e historias musicales), pero un anuncio
  // sin ellas se renderiza perfecto, pasa todas las verificaciones y sale
  // plano. Nadie se entera. Encontrado el 2026-09-08 en la primera prueba
  // del paquete para alumnos: el anuncio salio sin ninguna de las dos.
  //
  // Esto NO detiene el render — a veces se renderiza a proposito sin ellas
  // para probar algo. Solo avisa, y lo hace ANTES y DESPUES, para que el
  // aviso no se pierda entre las lineas de progreso de Remotion.
  //
  // Las de PISTA_FIJA_POR_ESTILO (estilo-lego) las copia el plan solo: si aun
  // asi falta, es que el plan es de antes y basta con volver a planear.
  const PISTA_PROPIA = {
    skeleton: 'esqueleto.mp3',
    'zack-d-films': 'zack-d-films.mp3',
    ...PISTA_FIJA_POR_ESTILO,
  };

  const faltantes = [];
  if (manifiesto && !esMusical && !sinMusicaPorEstilo) {
    if (!plan.musica?.archivo) {
      const propia = PISTA_PROPIA[manifiesto.estilo];
      faltantes.push(
        propia
          ? `SIN MUSICA. El estilo "${manifiesto.estilo}" usa su pista fija:\n` +
            (PISTA_FIJA_POR_ESTILO[manifiesto.estilo]
              ? `     el plan la copia sola de recursos/musica/${propia}:  npm run plan -- ${carpetaArg}`
              : `     copia  recursos/musica/${propia}  ->  ${path.basename(carpeta)}/musica/fondo.mp3`)
          : `SIN MUSICA. En "${manifiesto.estilo}" es obligatoria:\n` +
            `     npm run musica -- ${carpetaArg}`
      );
    }
    // En continuidad no van: el paso entre escenas lo hace cada clip.
    if (!plan.transiciones?.length && !continuidad) {
      faltantes.push(
        'SIN TRANSICIONES. Falta transiciones.json o no declara ningun punto.\n' +
          '     Van 4: entrada del problema, de la solucion, de la prueba y del CTA.\n' +
          `     Y los efectos se copian de recursos/efectos-transiciones/ a ${path.basename(carpeta)}/efectos/`
      );
    }
  }

  const avisarFaltantes = (donde) => {
    if (!faltantes.length) return;
    console.log(`\n  ${'='.repeat(66)}`);
    console.log(`  ESTE ANUNCIO LE FALTA ALGO OBLIGATORIO DE SU ESTILO${donde}`);
    console.log(`  ${'='.repeat(66)}`);
    for (const f of faltantes) console.log(`\n  !  ${f}`);
    console.log('\n  El render funciona igual, pero el anuncio sale plano.');
    console.log(`  ${'='.repeat(66)}\n`);
  };

  avisarFaltantes('');

  // B-roll que con la voz final entran en el video y no tienen clip (el plan
  // los anota en brollSinClip; su toma va con toda la frase). No es una
  // decision del montaje como un B-roll que no entra: falta un clip que el
  // video lleva (fallo al generarse, o no se pidio con la voz de antes).
  const brollSinClip = Array.isArray(plan.brollSinClip) ? plan.brollSinClip : [];
  const avisarBrollSinClip = (donde) => {
    if (!brollSinClip.length) return;
    const uno = brollSinClip.length === 1;
    console.log(
      `\n  !  ${uno ? 'Un B-roll entra' : `${brollSinClip.length} B-roll entran`} en el video y ${uno ? 'no tiene' : 'no tienen'} clip${donde}: ` +
        `${brollSinClip.join(', ')}. Su toma va con toda la frase, sin hueco.`
    );
    console.log('     No es una decision del montaje: falta ese clip. Para sumarlo (paga solo lo que falta) y volver a armar:');
    console.log(`         npm run producir -- ${carpetaArg} --si`);
    console.log(`         npm run plan     -- ${carpetaArg}`);
    console.log(`         npm run ensamblar -- ${carpetaArg}\n`);
  };
  avisarBrollSinClip('');

  //
  // Lo mismo en los estilos SIN musica por decision del estilo (podcast,
  // entrevista, ESTILOS_SIN_MUSICA): no hay pista que cambiar, asi que las
  // versiones con y sin musica serian la misma. Quedan dos: con y sin subtitulos.
  const versiones = esMusical || sinMusicaPorEstilo
    ? [
        {
          archivo: `${nombre}_9x16_con-subtitulos.mp4`,
          sinSubtitulos: false,
          sinMusica: true,
          etiqueta: 'con subtitulos',
        },
        {
          archivo: `${nombre}_9x16_sin-subtitulos.mp4`,
          sinSubtitulos: true,
          sinMusica: true,
          etiqueta: 'sin subtitulos',
        },
      ]
    : [
    { archivo: `${nombre}_9x16_con-subtitulos.mp4`, sinSubtitulos: false, sinMusica: false, etiqueta: 'con subtitulos y musica' },
    {
      archivo: `${nombre}_9x16_solo-subtitulos.mp4`,
      sinSubtitulos: false,
      sinMusica: true,
      etiqueta: 'solo subtitulos, sin musica',
    },
    {
      archivo: `${nombre}_9x16_sin-subtitulos-sin-musica.mp4`,
      sinSubtitulos: true,
      sinMusica: true,
      etiqueta: 'sin subtitulos y sin musica (para CapCut)',
    },
  ];

  // Un archivo que se llama "con-subtitulos" y no los tiene es un archivo
  // que miente. Si todavia no se generaron, esa version no se renderiza.
  const haySubtitulos = Boolean(plan.subtitulos?.length);

  // SOLO LA COMPLETA (--solo-completa). De la lista de arriba queda la primera, la que se sube a Meta, tal cual
  // (mismo nombre, mismas capas). Con --musica-db o --sub-tamano no cambia nada: ya renderizan una sola.
  //
  // Sin subtitulos todavia (se cayeron), la completa no puede salir con ese nombre (ver abajo): sale la mas
  // completa que se puede, la misma pero sin subtitulos, como <slug>_9x16_sin-subtitulos.mp4. En los estilos
  // con musica, CON su musica: es la que se publicaria. El control final la da por faltante igual (falta la
  // completa), como hoy cuando no hay subtitulos.
  //
  // El registro queda en qa/versiones.json ({ soloCompleta: true, versiones }): control-final.js lo lee para
  // esperar solo esa version. Un render sin la opcion lo borra al empezar (vuelven a tocar todas).
  const soloLaCompleta = soloCompleta && subTamanoForzado === null && musicaDbForzado === null;
  if (soloLaCompleta) {
    const completa = versiones[0];
    versiones.length = 0;
    if (haySubtitulos) versiones.push(completa);
    else {
      versiones.push({
        archivo: `${nombre}_9x16_sin-subtitulos.mp4`,
        sinSubtitulos: true,
        sinMusica: completa.sinMusica,
        etiqueta: completa.sinMusica ? 'sin subtitulos' : 'con musica, sin subtitulos',
      });
      console.log('');
      console.log('  Todavia no hay subtitulos: sale la completa sin ellos. Cuando existan, volve a');
      console.log('  correr esto y sale la completa con subtitulos.');
    }
  }

  if (subTamanoForzado !== null) {
    if (!plan.subtitulos?.length) {
      console.error('\n  --sub-tamano pero este anuncio todavia no tiene subtitulos.\n');
      process.exit(1);
    }
    plan.estiloSubtitulos = { ...plan.estiloSubtitulos, tamano: subTamanoForzado };
    const conSubs = versiones.filter((v) => !v.sinSubtitulos);
    versiones.length = 0;
    versiones.push({
      ...conSubs[0],
      archivo: `${nombre}_9x16_subs-${String(subTamanoForzado).replace('.', 'p')}.mp4`,
      etiqueta: `subtitulos a ${subTamanoForzado} del ancho`,
    });
    console.log(`\n  Prueba de tamano de subtitulos: ${subTamanoForzado} (por defecto ${REGLAS_SUBTITULOS_DEFECTO}).`);
  }

  if (musicaDbForzado !== null) {
    // Para probar niveles de musica sirve cualquier version QUE LA LLEVE. Desde
    // que la segunda version pasó a ser "solo subtitulos", la unica con musica
    // es la primera; buscar ademas por "sin subtitulos" dejaba la lista vacia y
    // reventaba al hacer el spread de undefined.
    const conMusica = versiones.filter((v) => !v.sinMusica);
    versiones.length = 0;
    versiones.push({
      ...conMusica[0],
      archivo: `${nombre}_9x16_musica-${String(musicaDbForzado).replace('-', 'menos')}dB.mp4`,
      etiqueta: `musica a ${musicaDbForzado} dB`,
    });
  }

  // Sin subtitulos, las versiones que dicen llevarlos no se renderizan (haySubtitulos, arriba).
  if (!haySubtitulos && subTamanoForzado === null) {
    // Se quitan las versiones que DICEN llevar subtitulos, no "la primera":
    // con --musica-db la lista trae otra cosa en esa posicion y se quedaba en cero.
    const fuera = versiones.filter((v) => !v.sinSubtitulos);
    for (const v of fuera) versiones.splice(versiones.indexOf(v), 1);
    if (fuera.length) {
    console.log('');
    console.log(`  Todavia no hay subtitulos, asi que NO se renderiza "${fuera[0].etiqueta}".`);
    console.log('  Salen las demas. Cuando existan los subtitulos, volve a correr esto');
    console.log('  y se genera la que falta.');
    }
  }

  if (versiones.length === 0) {
    console.error('\n  No queda ninguna version para renderizar.\n');
    process.exit(1);
  }

  console.log(`\n=== Render final — ${nombre} ===\n`);
  console.log(`  Duracion:   ${plan.duracion.toFixed(2)}s`);
  if (continuidad) {
    const cuantos = (rol) => continuidad.clips.filter((c) => c.rol === rol).length;
    console.log(
      `  Piezas:     ${continuidad.clips.length} en cadena (${cuantos('paso')} pasos + ${cuantos('propio')} propios B + ${cuantos('cierre')} cierre), ` +
        'seguidas y sin cortes: solo cambia la velocidad'
    );
  } else if (escena) {
    const cuantos = (tipo) => (escena.piezas || []).filter((p) => p.tipo === tipo).length;
    const partes = ['clip', 'imagen', 'icono', 'texto', 'sonido'].filter((t) => cuantos(t)).map((t) => `${cuantos(t)} ${t}${cuantos(t) > 1 ? 's' : ''}`);
    console.log(`  Piezas:     ${(escena.piezas || []).length} en la escena (${partes.join(' + ')}), sobre ${plan.bloques.length} trozos hablados`);
  } else {
    const piezas = plan.bloques.length + plan.bloques.filter((b) => b.broll).length;
    console.log(`  Piezas:     ${piezas} (${plan.bloques.length} tomas + ${piezas - plan.bloques.length} B-roll)`);
  }
  // DOS RENDERS EN VEZ DE TRES (2026-10-24, decision de Diego: mas rapido).
  //
  // "solo subtitulos" tiene los MISMOS fotogramas que "con subtitulos y musica"
  // (sinMusica solo apaga un <Audio>: no dibuja nada) y el MISMO audio que "sin
  // subtitulos y sin musica" (los subtitulos no suenan). Las dos cosas ya salen
  // de esos dos renders, asi que se arma uniendo el video del primero con el
  // audio del otro, copiando los dos streams tal cual (ffmpeg -c copy: no se
  // recodifica nada). Es lo mismo que hace Remotion al final de cada render:
  // codifica el audio aparte (AAC, 48 kHz, estereo) y lo mete en el MP4 con
  // -c:a copy (renderer/stitch-frames-to-video.js). El audio armado es el de
  // un render completo de esta version, bit a bit.
  //
  // No se usa un render SOLO DE AUDIO (--codec=aac existe y no saca
  // fotogramas): seria un tercer render, aunque corto, para conseguir un audio
  // que el render sin musica ya trae.
  //
  // Solo con las tres versiones. En musical y en los estilos sin musica las dos
  // versiones difieren en los fotogramas, y con --musica-db o --sub-tamano queda
  // una sola: ahi se renderiza todo, como siempre.
  //
  // Sin ffmpeg en el PATH no se puede armar: se dice de entrada y salen los
  // tres renders, como antes (no recien despues de los dos primeros).
  const conTodo = versiones.find((v) => !v.sinSubtitulos && !v.sinMusica);
  const soloSubs = versiones.find((v) => !v.sinSubtitulos && v.sinMusica);
  const sinNada = versiones.find((v) => v.sinSubtitulos && v.sinMusica);
  const hayFfmpeg = () => {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8' });
    return !r.error && r.status === 0;
  };
  let sinFfmpeg = false;
  if (conTodo && soloSubs && sinNada) {
    if (hayFfmpeg()) soloSubs.armada = { video: conTodo, audio: sinNada };
    else sinFfmpeg = true;
  }
  // La primera que se renderiza sigue siendo la completa: es la que se sube.
  const aRenderizar = versiones.filter((v) => !v.armada);

  const pedida = Number.isInteger(concurrencia) && concurrencia > 0 ? concurrencia : null;
  let concurrenciaRender = pedida ?? concurrenciaSegunMemoria();

  console.log(`  Formato:    9:16 vertical, ${ESCALA_RENDER === 1 ? '720x1280' : `${Math.round(720 * ESCALA_RENDER)}x${Math.round(1280 * ESCALA_RENDER)}`}, h264, CRF ${CRF}`);
  // Las etiquetas ya dicen que es cada version; enumerarlas a mano aqui hacia
  // que en modo musica —donde salen dos— el texto siguiera nombrando tres.
  console.log(`  Versiones:  ${versiones.length} (${versiones.map((v) => v.etiqueta).join(' / ')})`);
  if (soloLaCompleta) {
    console.log('  Solo la completa (--solo-completa): las demas se sacan desde el editor de la app.');
  } else if (soloSubs?.armada) {
    console.log(`  Renders:    ${aRenderizar.length}: "${soloSubs.etiqueta}" se arma con el video de la primera y el audio de la ultima`);
  } else if (sinFfmpeg) {
    console.log(`  Renders:    ${aRenderizar.length}`);
    console.log(`  !  ffmpeg no esta en el PATH: "${soloSubs.etiqueta}" no se puede armar y se renderiza entera, como antes.`);
  }
  console.log(
    `  Concurrencia: ${concurrenciaRender} fotograma${concurrenciaRender > 1 ? 's' : ''} a la vez (` +
      (pedida
        ? 'pedida con --concurrencia'
        : `${(os.freemem() / 1024 ** 3).toFixed(1)} GB libres de ${(os.totalmem() / 1024 ** 3).toFixed(1)}, ${os.cpus().length} hilos`) +
      ')'
  );

  // El registro de "solo la completa" (qa/versiones.json, ver SOLO LA COMPLETA) es de un render de la app. Un
  // render de todas las versiones lo borra al empezar: desde aca el control final vuelve a esperarlas todas.
  // Las pruebas de --musica-db y --sub-tamano no lo tocan (no cambian las versiones que se entregan).
  const rutaVersiones = path.join(carpeta, 'qa', 'versiones.json');
  if (!soloLaCompleta && subTamanoForzado === null && musicaDbForzado === null) fs.rmSync(rutaVersiones, { force: true });

  // Una sola carpeta publica para todos los renders (ver armarCarpetaPublica).
  // Si no se puede armar, se usa la carpeta entera, que es lo de antes: mas
  // lento, pero el render sale igual.
  let publico = carpeta;
  try {
    const p = armarCarpetaPublica(carpeta, plan);
    publico = p.destino;
    // 'exit' corre tambien con process.exit(1) de un render que fallo. Si no
    // se puede borrar no importa: son enlaces, y la proxima corrida la rehace.
    // Con Ctrl+C, cerrando la ventana o con taskkill 'exit' no corre y la
    // carpeta queda (solo enlaces, nada que se pueda perder) hasta la proxima
    // corrida, que la borra al empezar (armarCarpetaPublica). No se agrega un
    // manejador de SIGINT a proposito: con el, un render cortado a mano
    // volveria por renderConReintentos en vez de cortar.
    process.on('exit', () => {
      try {
        fs.rmSync(p.destino, { recursive: true, force: true });
      } catch {
        // se borra al principio de la proxima corrida
      }
    });
    console.log(
      `  Archivos:   ${p.archivos} que nombra el plan, ${(p.bytes / 1024 / 1024).toFixed(1)} MB ` +
        `(${p.copias ? `${p.copias} copiados, ${p.enlaces} enlazados` : 'enlazados, sin copiar'}) en ${DIR_PUBLICO}/`
    );
  } catch (e) {
    fs.rmSync(path.join(carpeta, DIR_PUBLICO), { recursive: true, force: true });
    console.log(`  !  No se pudo armar ${DIR_PUBLICO}/ (${e.message}): se renderiza con la carpeta entera, como antes.`);
  }
  console.log('');

  // Los props van por archivo: el plan es grande para la linea de comandos.
  const rutaProps = path.join(carpeta, '.props-remotion.json');
  // OJO en Windows: desde Node 20.12 no se puede lanzar un .cmd (npx.cmd) sin
  // shell: true — lo bloquea por seguridad y el spawn falla con EINVAL sin
  // mensaje claro. Por eso va con shell y las rutas entrecomilladas.
  const q = (s) => `"${s}"`;
  // Devuelve { ok, memoria, cortado }: memoria = el error tiene la firma de la
  // falta de memoria (ver renderConReintentos); cortado = lo cortaron a mano.
  // El stderr de Remotion (sus errores y avisos; el progreso va por stdout) se
  // lee para eso y se muestra igual, al terminar ese render.
  const renderizar = (v, salida, conc) => {
    fs.writeFileSync(rutaProps, JSON.stringify({ plan, sinSubtitulos: v.sinSubtitulos, sinMusica: v.sinMusica }), 'utf8');
    const r = spawnSync(
      'npx',
      [
        'remotion',
        'render',
        'src/index.jsx',
        'Anuncio',
        q(salida),
        q(`--props=${rutaProps}`),
        q(`--public-dir=${publico}`),
        `--crf=${CRF}`,
        '--log=info',
        `--concurrency=${conc}`,
        ...(ESCALA_RENDER !== 1 ? [`--scale=${ESCALA_RENDER}`] : []),
      ],
      { cwd: DIR_REMOTION, stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 }
    );
    fs.rmSync(rutaProps, { force: true });
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.status === 0) return { ok: true };
    // Remotion deja "<salida>.<uuid>.remotion-in-progress" junto a la salida
    // cuando se cae: se borra, para no juntar uno por intento en output/.
    try {
      for (const f of fs.readdirSync(path.dirname(salida))) {
        if (f.startsWith(`${path.basename(salida)}.`) && f.endsWith('.remotion-in-progress')) fs.rmSync(path.join(path.dirname(salida), f), { force: true });
      }
    } catch {
      // si no se puede, queda como quedaba antes
    }
    return { ok: false, memoria: FIRMA_SIN_MEMORIA.test(String(r.stderr || '')), cortado: r.status === null || Boolean(r.signal) };
  };

  // Un render que falla POR MEMORIA se reintenta una vez con la mitad de
  // concurrencia y otra con 1: el "No frame found" de poca memoria se va
  // bajando, y a 1 salio siempre. Recien si falla a 1 se corta, como antes. La
  // que funciono queda para los renders que siguen: si la primera version
  // necesito bajar, la segunda fallaria igual arrancando de arriba.
  //
  // Solo cuando la concurrencia salio de la memoria libre (sin --concurrencia),
  // y solo con la firma de la falta de memoria en el error. Con --concurrencia N
  // se renderiza a N y un fallo corta, como siempre; y un fallo que no es de
  // memoria (un archivo roto, la salida tomada por un reproductor) fallaria
  // igual a 1, despues de tres renders enteros.
  const renderConReintentos = (v, salida) => {
    const intentos = pedida ? [concurrenciaRender] : [...new Set([concurrenciaRender, Math.max(1, Math.floor(concurrenciaRender / 2)), 1])];
    for (let i = 0; i < intentos.length; i++) {
      if (i > 0) {
        console.log(
          `\n  !  El render "${v.etiqueta}" fallo por falta de memoria con concurrencia ${intentos[i - 1]}. ` +
            `Se reintenta con ${intentos[i]}: tarda mas, pero usa menos memoria.\n`
        );
      }
      const r = renderizar(v, salida, intentos[i]);
      if (r.ok) {
        if (intentos[i] !== concurrenciaRender) {
          console.log(`\n  ..  Salio con concurrencia ${intentos[i]}: los renders que siguen arrancan con esa.`);
          concurrenciaRender = intentos[i];
        }
        return;
      }
      if (!r.memoria || r.cortado) break;
    }
    console.error(`\n  El render "${v.etiqueta}" fallo. Mira el detalle de Remotion arriba.\n`);
    process.exit(1);
  };

  const t0 = Date.now();
  const hechas = [];
  // Cada version se avisa apenas esta: la primera se puede ir mirando
  // mientras se renderiza la siguiente.
  const lista = (v, salida) => {
    const bytes = fs.statSync(salida).size;
    hechas.push({ ...v, salida, bytes });
    console.log(`\n  OK  Lista: ${v.archivo}  (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);
  };

  for (const v of aRenderizar) {
    const salida = path.join(DIR_OUTPUT, v.archivo);
    console.log(`  --- ${v.etiqueta} ---`);
    renderConReintentos(v, salida);
    lista(v, salida);
  }

  for (const v of versiones.filter((x) => x.armada)) {
    const salida = path.join(DIR_OUTPUT, v.archivo);
    console.log(`  --- ${v.etiqueta} ---`);
    const t = Date.now();
    const error = unirVideoYAudio(path.join(DIR_OUTPUT, v.armada.video.archivo), path.join(DIR_OUTPUT, v.armada.audio.archivo), salida);
    if (error) {
      // Sin ffmpeg, o un MP4 sin pista de audio: se renderiza entera, como antes.
      console.log(`  !  No se pudo armar (${error}). Se renderiza entera.\n`);
      renderConReintentos(v, salida);
    } else {
      console.log(
        `  OK  Video de "${v.armada.video.etiqueta}" + audio de "${v.armada.audio.etiqueta}", ` +
          `sin recodificar (${((Date.now() - t) / 1000).toFixed(1)}s)`
      );
    }
    lista(v, salida);
  }
  // El resumen, en el orden de siempre aunque la armada salga al final.
  const orden = versiones.map((v) => v.archivo);
  hechas.sort((a, b) => orden.indexOf(a.archivo) - orden.indexOf(b.archivo));

  // SOLO LA COMPLETA: el registro para el control final y, fuera de output/ (a historial/ del anuncio, sin borrar
  // nada), las otras versiones de ANTES de este
  // montaje. Una "solo subtitulos" o una "para CapCut" mas vieja que plan-montaje.json es de otro montaje (un clip
  // que se rehizo, otro corte): ya no es este anuncio sin subtitulos o sin musica, y la app la mostraria al lado
  // de la nueva como si lo fuera. Es el mismo corte que usa el control final para llamarla "version vieja"
  // (5.10.4). Las de este montaje se quedan, y las del editor (<slug>_editado-N.mp4) no se tocan nunca.
  const quitadas = [];
  if (soloLaCompleta) {
    const mtimePlan = fs.statSync(rutaPlan).mtimeMs;
    for (const tipo of ['con-subtitulos', 'solo-subtitulos', 'sin-subtitulos', 'sin-subtitulos-sin-musica']) {
      const archivo = `${nombre}_9x16_${tipo}.mp4`;
      if (versiones.some((v) => v.archivo === archivo)) continue;
      const ruta = path.join(DIR_OUTPUT, archivo);
      let st = null;
      try {
        st = fs.statSync(ruta);
      } catch {
        continue; // no esta
      }
      if (st.mtimeMs >= mtimePlan - 2000) continue; // es de este montaje
      try {
        archivarSiExiste(ruta, carpeta);
        quitadas.push(archivo);
      } catch (e) {
        console.log(`  !  No pude apartar ${archivo}, que es de antes de este montaje (${e.code || e.message}): puede estar abierto en un reproductor.`);
      }
    }
    fs.mkdirSync(path.dirname(rutaVersiones), { recursive: true });
    const registro = {
      generado: new Date().toISOString(),
      soloCompleta: true,
      versiones: versiones.map((v) => ({ tipo: v.archivo.slice(`${nombre}_9x16_`.length).replace(/\.mp4$/i, ''), archivo: v.archivo })),
    };
    fs.writeFileSync(rutaVersiones, JSON.stringify(registro, null, 2) + '\n', 'utf8');
  }

  // El plan legible se deja siempre, se haya usado Remotion o no (seccion 8.1).
  const planTxt = escribirPlanLegible(carpeta);

  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n  Listo en ${seg}s.\n`);
  for (const h of hechas) {
    const mb = h.bytes / 1024 / 1024;
    const mbps = (h.bytes * 8) / plan.duracion / 1e6;
    console.log(`  ${h.archivo}`);
    console.log(`      ${mb.toFixed(1)} MB   ${mbps.toFixed(2)} Mbps`);
  }
  if (quitadas.length) console.log(`\n  Apartadas a historial/ por ser de antes de este montaje: ${quitadas.join(', ')}`);
  console.log(`\n  Plan para editar a mano: ${planTxt}\n`);

  // Otra vez al final: entre el aviso del principio y aqui pasan cientos de
  // lineas de progreso de Remotion, y un aviso que queda arriba no lo lee nadie.
  avisarFaltantes(' (repetido: se dijo antes de renderizar)');
  avisarBrollSinClip(' (repetido: se dijo antes de renderizar)');
}
