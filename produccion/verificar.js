// Verificacion guiada del entorno. Pensado para un usuario no tecnico:
// dice exactamente que falta y como resolverlo.
// Uso:  npm run verificar

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, KIE, cargarEnv } from './config.js';
import { ELEVENLABS } from './elevenlabs-client.js';

const ok = (m) => console.log(`  OK    ${m}`);
const falla = (m, ayuda) => {
  console.log(`  FALTA ${m}`);
  if (ayuda) console.log(`        -> ${ayuda}`);
  problemas++;
};
const aviso = (m, ayuda) => {
  console.log(`  AVISO ${m}`);
  if (ayuda) console.log(`        -> ${ayuda}`);
};

let problemas = 0;

function version(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')[0].trim();
  } catch {
    return null;
  }
}

// Prueba la clave de ElevenLabs con una consulta gratis: la primera voz de la
// cuenta, lo mismo que pide el motor antes de cada voz en off (listarVoces).
// ElevenLabs contesta 401 a una clave inventada ({"detail":{"status":
// "invalid_api_key"}}) y TAMBIEN a una buena con permisos limitados
// ({"detail":{"status":"missing_permissions"}}, comprobado): esa sirve igual
// para lo que si tiene permitido, asi que es AVISO y no FALTA.
async function probarElevenLabs(clave) {
  try {
    const res = await fetch(`${ELEVENLABS.base}${ELEVENLABS.listarVoces}?page_size=1`, {
      headers: { 'xi-api-key': clave },
    });
    let detalle = {};
    try {
      detalle = (await res.json()).detail || {};
    } catch {
      // sin cuerpo JSON: cuenta solo el HTTP
    }
    if (res.ok) ok(`ElevenLabs respondio (HTTP ${res.status}) y acepto la clave`);
    else if (res.status === 401 && detalle.status === 'missing_permissions') {
      const permiso = (String(detalle.message || '').match(/permission (\w+)/) || [])[1] || 'voices_read';
      aviso(`ElevenLabs reconoce la clave, pero no tiene el permiso ${permiso}: sin el no se puede elegir la voz del narrador`,
        'en https://elevenlabs.io/app/settings/api-keys edita la clave y dale acceso a Voices (lectura), Text to Speech y Speech to Text');
    } else if (res.status === 401 || res.status === 403) falla(`ElevenLabs rechazo la clave (${res.status})`, 'revisa que copiaste la clave completa en el .env');
    else aviso(`ElevenLabs respondio HTTP ${res.status}: no se pudo comprobar la clave`, 'vuelve a correr npm run verificar en un rato');
  } catch (e) {
    falla(`no pude conectarme a ElevenLabs: ${e.message}`, 'revisa tu conexion a internet');
  }
}

console.log('\n=== 1. Programas necesarios ===');

const nodeMayor = Number(process.versions.node.split('.')[0]);
if (nodeMayor >= 20) ok(`Node.js ${process.version}`);
else falla(`Node.js ${process.version} es muy viejo`, 'instala la version LTS desde https://nodejs.org');

const ff = version('ffmpeg', ['-version']);
if (ff) ok(ff.replace(/ Copyright.*/, ''));
else falla('ffmpeg no esta instalado o no esta en el PATH',
  'En Windows: abre PowerShell y ejecuta  winget install Gyan.FFmpeg  ; despues cierra y vuelve a abrir la terminal.');

console.log('\n=== 2. Archivo .env y claves ===');

const rutaEnv = path.join(RAIZ, '.env');
if (!fs.existsSync(rutaEnv)) {
  falla('no existe el archivo .env', 'copia .env.example y renombralo a .env');
} else {
  ok('.env existe');
  cargarEnv();

  const kie = (process.env.KIE_API_KEY || '').trim();
  if (kie) ok(`KIE_API_KEY cargada (${kie.slice(0, 4)}...${kie.slice(-4)})`);
  else falla('KIE_API_KEY vacia',
    'crea tu cuenta en https://kie.ai , entra a https://kie.ai/api-key , copia la clave y pegala en el .env');

  const eleven = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (eleven) {
    ok(`ELEVENLABS_API_KEY cargada (${eleven.slice(0, 4)}...${eleven.slice(-4)})`);
    await probarElevenLabs(eleven);
  } else aviso('ELEVENLABS_API_KEY vacia (no hace falta para la Fase 1)',
    'https://elevenlabs.io -> tu perfil -> API Keys');

  const voz = (process.env.ELEVENLABS_VOICE_ID || '').trim();
  if (voz) ok(`ELEVENLABS_VOICE_ID = ${voz}`);
  else aviso('ELEVENLABS_VOICE_ID vacia (se define en la Fase 2.4)');
}

console.log('\n=== 3. Conexion con kie.ai ===');

if (!(process.env.KIE_API_KEY || '').trim()) {
  aviso('salteado: no hay KIE_API_KEY que probar');
} else {
  try {
    const res = await fetch(`${KIE.base}${KIE.consultarTarea}?taskId=verificacion-de-entorno`, {
      headers: { Authorization: `Bearer ${process.env.KIE_API_KEY.trim()}` },
    });
    // kie.ai contesta HTTP 200 tambien con una clave mala: el rechazo viene en
    // el cuerpo, {"code":401,...} (comprobado). Con una clave buena, esta
    // consulta de una tarea que no existe da {"code":422,"msg":"recordInfo is null"}.
    let cuerpo = null;
    try {
      cuerpo = await res.json();
    } catch {
      // sin cuerpo JSON: cuenta solo el HTTP
    }
    const codigo = res.status !== 200 ? res.status : Number(cuerpo && cuerpo.code) || res.status;
    if (codigo === 401 || codigo === 403) falla(`kie.ai rechazo la clave (${codigo})`, 'revisa que copiaste la clave completa en el .env');
    else if (codigo === 429) aviso('kie.ai respondio 429 (limite de solicitudes), pero la clave es valida');
    else ok(`kie.ai respondio (HTTP ${res.status}, codigo ${codigo}) y acepto la clave`);
  } catch (e) {
    falla(`no pude conectarme a kie.ai: ${e.message}`, 'revisa tu conexion a internet');
  }
}

console.log('\n=== 4. Carpetas ===');
for (const d of ['temp', 'output', 'produccion', 'skills']) {
  const p = path.join(RAIZ, d);
  if (fs.existsSync(p)) ok(`${d}/`);
  else falla(`falta la carpeta ${d}/`, `creala con: mkdir ${d}`);
}

console.log('\n=== 5. Remotion (necesario recien en la Fase 2.5) ===');
const remotionPkg = path.join(RAIZ, 'remotion', 'package.json');
if (fs.existsSync(path.join(RAIZ, 'remotion', 'node_modules'))) ok('proyecto de Remotion instalado');
else if (fs.existsSync(remotionPkg)) aviso('remotion/ existe pero sin dependencias instaladas', 'entra a remotion/ y ejecuta: npm install');
else aviso('remotion/ todavia no existe (no hace falta para la Fase 1)');

console.log('\n=== 6. Skills: lo ejecutado vs lo empaquetado ===');
{
  const { revisar } = await import('./skills-sync.js');
  const filas = revisar();
  const desfase = filas.filter((f) => f.estado === 'desfase');
  const instaladas = filas.filter((f) => f.bytesEjecutada != null);

  if (instaladas.length === 0) {
    aviso('no hay ninguna skill instalada en .claude/skills/', 'node produccion/skills-sync.js --desempaquetar');
  } else if (desfase.length === 0) {
    ok(`${instaladas.length} skill(s) instalada(s), alineadas con su .skill`);
  } else {
    for (const f of desfase) {
      falla(
        `${f.nombre}: lo que se EJECUTA no es lo que dice el .skill`,
        'node produccion/skills-sync.js   (te dice en que direccion sincronizar)'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Efectos de transicion: donde cae el golpe de cada uno.
//
// INFORMATIVO, no bloquea. El motor se adapta solo: planear-montaje.js mide
// este mismo pico y adelanta la reproduccion para que caiga en el corte
// (resolverTransiciones -> adelantoSeg). Un efecto que golpea a los 0.40s
// funciona igual de bien que uno que golpea a los 0.00s.
//
// Se muestra porque el numero explica lo que se oye. Hasta el 2026-09-06 el
// sonido se montaba desde el corte sin adelanto, y como el deep-woosh es un
// SWELL que tarda 0.40s en picar, su golpe llegaba despues de que la animacion
// (0.28s) habia terminado. Se oia desfasado en los seis anuncios.
//
// La primera version de este chequeo FALLABA si el pico no estaba al principio,
// y eso era pedirle al archivo que se adaptara al motor. Se invirtio: el motor
// se adapta al archivo, y aqui solo se informa.
// ---------------------------------------------------------------------------
console.log('\n=== 7. Efectos de transicion: donde golpea cada uno ===');

const DIR_EFECTOS = path.join(RAIZ, 'recursos', 'efectos-transiciones');

// Se usa LA MISMA funcion que el montaje, importada, no una copia. Tenerla dos
// veces ya salio mal una vez: esta seccion siguio reportando el PICO despues de
// que el motor pasara a anclar el ATAQUE, y decia un adelanto que no era el que
// se aplicaba.
const { segundoDelGolpe } = await import('./planear-montaje.js');

if (!fs.existsSync(DIR_EFECTOS)) {
  aviso('no existe recursos/efectos-transiciones/');
} else {
  // Los archivos con "--" en el nombre son respaldos.
  const efectos = fs.readdirSync(DIR_EFECTOS).filter((f) => f.endsWith('.mp3') && !f.includes('--'));

  for (const nombre of efectos) {
    const adelanto = segundoDelGolpe(path.join(DIR_EFECTOS, nombre));

    if (adelanto === 0) {
      ok(`${nombre}: ataque al empezar — suena desde el corte`);
    } else {
      ok(`${nombre}: ataque en t=${adelanto.toFixed(2)}s — el motor lo adelanta ${adelanto.toFixed(2)}s para que caiga en el corte`);
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Lo que solo usan los estilos hablados (podcast y entrevista): Python 3
// con Pillow y numpy (tapar los huecos de los iconos de la entrevista), rembg
// y onnxruntime (recortar al host del podcast en esquina) y el codificador VP9
// de ffmpeg (el .webm con alfa del host recortado).
//
// Solo AVISOS, nunca FALTA: quien no hace esos estilos no necesita nada de
// esto, y el resultado ("Todo listo" y el codigo de salida) no cambia. Python
// se busca y se corre igual que en el motor (recortar-host.js: -E -P, no -I,
// para ver tambien los paquetes instalados con pip --user). Los paquetes se
// buscan sin importarlos (instantaneo); el chequeo completo del recorte, con
// el modelo, es  npm run recortar -- --verificar.
// ---------------------------------------------------------------------------
console.log('\n=== 8. Podcast y entrevista: Python y VP9 (solo para esos estilos) ===');
{
  const { buscarPython, comandoPython, comandoInstalar, paquetesQueFaltan, PAQUETES_PYTHON, ffmpegConVp9 } = await import(
    './recortar-host.js'
  );
  const python = buscarPython();
  if (!python) {
    aviso(
      'no encuentro Python 3: la entrevista lo usa para tapar los huecos de los iconos y el podcast en esquina para recortar al host',
      'instalalo desde https://www.python.org/downloads/ (marca "Add python.exe to PATH"), abre otra terminal y despues: ' +
        'python -m pip install --user pillow numpy rembg onnxruntime  ; comprueba con: npm run verificar'
    );
  } else {
    ok(`Python ${python.version} (${comandoPython(python)}; el motor lo corre con ${python.banderas.join(' ')})`);
    const deIconos = PAQUETES_PYTHON.iconos;
    const delRecorte = PAQUETES_PYTHON.recorte.filter(([m]) => !deIconos.some(([x]) => x === m));
    const faltanIconos = paquetesQueFaltan(python, deIconos);
    const faltanRecorte = paquetesQueFaltan(python, delRecorte);
    if (faltanIconos === null || faltanRecorte === null) {
      aviso(`Python ${python.version} no pudo decir que paquetes tiene`, 'npm run recortar -- --verificar  (muestra el error completo)');
    } else {
      if (faltanIconos.length) {
        aviso(
          `a Python le faltan ${faltanIconos.join(' y ')}: la entrevista los usa para tapar los huecos de los iconos`,
          `${comandoInstalar(python, faltanIconos)}  ; comprueba con: npm run verificar`
        );
      } else ok('Pillow y numpy (huecos de los iconos de la entrevista)');
      if (faltanRecorte.length) {
        aviso(
          `a Python le faltan ${faltanRecorte.join(' y ')}: el podcast en esquina los usa para recortar al host`,
          `${comandoInstalar(python, faltanRecorte)}  ; comprueba con: npm run recortar -- --verificar`
        );
      } else ok('rembg y onnxruntime (host recortado del podcast en esquina)');
    }
  }
  // Sin ffmpeg (null) ya salio arriba como FALTA.
  const vp9 = ffmpegConVp9();
  if (vp9 === false) {
    aviso(
      'ffmpeg no trae el codificador VP9 (libvpx-vp9): el podcast en esquina lo usa para el video con alfa del host recortado',
      'En Windows: winget install Gyan.FFmpeg  (la version "full"); despues cierra y vuelve a abrir la terminal.'
    );
  } else if (vp9) ok('ffmpeg con VP9 (libvpx-vp9, host recortado del podcast en esquina)');
}

console.log('');
if (problemas === 0) {
  console.log('Todo listo. Siguiente paso:  npm run test:imagen\n');
} else {
  console.log(`Hay ${problemas} cosa(s) por resolver antes de seguir. Ver arriba.\n`);
  process.exitCode = 1;
}
