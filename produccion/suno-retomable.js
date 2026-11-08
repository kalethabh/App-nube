// SUNO sin pagar dos veces si el proceso se corta: la cancion de los cantados y la musica de fondo.
//
//   node produccion/suno-retomable.js generar-cancion.js temp/mi-anuncio --si          las versiones de la cancion
//   node produccion/suno-retomable.js generar-cancion.js temp/mi-anuncio --elegir 2    la elegida (con sus extend)
//   node produccion/suno-retomable.js generar-musica.js temp/mi-anuncio --si           la musica de fondo
//
// Es el script que se nombra (generar-cancion.js o generar-musica.js) tal cual: mismos argumentos, misma salida,
// mismos archivos. Este archivo no cambia nada de su logica. Lo unico que agrega: cada tarea que se le pide a kie
// para Suno (una generacion o un extend) queda anotada apenas kie la crea, en <carpeta>/cancion/tareas-en-kie.json
// (la cancion) o en <carpeta>/musica/tareas-en-kie.json (la musica de fondo). Esos scripts esperan la tarea sin
// guardarla antes, asi que si el proceso se corta mientras Suno trabaja (se cerro la app, se fue internet), volver a
// correrlo pedia otra y se pagaba dos veces. Con esto, la corrida siguiente no crea otra: sigue esperando la misma
// tarea, que en kie ya estaba pagada.
//
// Cuando termina bien, lo anotado de esa corrida se borra (la "otra tanda" que pide el usuario es una tarea nueva, a
// proposito). Una tarea anotada que kie dice que fallo, o que kie ya no conoce, se olvida: la corrida siguiente pide
// otra (como siempre).
//
// Lo usa la app (app/server/lib/familias/). --solo-plan no pide nada: va derecho al script.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = { 'generar-cancion.js': 'cancion', 'generar-musica.js': 'musica' };
const script = process.argv[2];
if (!SCRIPTS[script]) {
  console.error(`\n  Uso: node produccion/suno-retomable.js <${Object.keys(SCRIPTS).join('|')}> <carpeta-del-anuncio> [argumentos del script]\n`);
  process.exit(1);
}
// el script ve sus argumentos como si lo hubieran lanzado solo
process.argv.splice(2, 1);
const args = process.argv.slice(2);
const carpetaArg = args.find((a, i) => !a.startsWith('--') && !['--elegir', '--estilo'].includes(args[i - 1]));
const soloPlan = args.includes('--solo-plan');
const eligiendo = args.includes('--elegir');
const RUTA = carpetaArg ? path.join(path.resolve(carpetaArg), SCRIPTS[script], 'tareas-en-kie.json') : null;

// Una tarea de Suno vive en kie mucho mas que esto; pasado este rato no se reusa (por las dudas).
const VIGENCIA_MS = 12 * 3600 * 1000;
// Los estados de fallo de Suno (generar-musica.js) y de la API de jobs (el extend).
const FALLO = /^(CREATE_TASK_FAILED|GENERATE_AUDIO_FAILED|CALLBACK_EXCEPTION|SENSITIVE_WORD_ERROR|fail|failed)$/i;

function leer() {
  try {
    const t = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
    return t && typeof t === 'object' ? t : {};
  } catch {
    return {};
  }
}

function escribir(tareas) {
  fs.mkdirSync(path.dirname(RUTA), { recursive: true });
  const tmp = `${RUTA}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(tareas, null, 2) + '\n', 'utf8');
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, RUTA);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (i + 1));
    }
  }
}

/** El pedido de una tarea de Suno: la generacion (/api/v1/generate) o el extend (createTask con ai-music-api). */
function tipoDePedido(u, metodo, cuerpo) {
  if (metodo !== 'POST') return null;
  if (/\/api\/v1\/generate\/?$/.test(u.pathname)) return 'generar';
  if (/\/api\/v1\/jobs\/createTask\/?$/.test(u.pathname) && /ai-music-api/.test(cuerpo)) return 'extend';
  return null;
}

const respuestaJSON = (datos) => new Response(JSON.stringify(datos), { status: 200, headers: { 'Content-Type': 'application/json' } });

if (RUTA && !soloPlan) {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, opciones = {}) => {
    let u;
    try {
      u = new URL(String(url?.url || url));
    } catch {
      return fetchOriginal(url, opciones);
    }
    const metodo = String(opciones?.method || 'GET').toUpperCase();
    const cuerpo = typeof opciones?.body === 'string' ? opciones.body : '';
    const tipo = tipoDePedido(u, metodo, cuerpo);

    if (tipo) {
      // el mismo pedido (la misma letra o musica, el mismo estilo, el mismo extend) que ya estaba en kie: se sigue esperando
      const clave = crypto.createHash('sha256').update(`${u.pathname}\n${cuerpo}`).digest('hex').slice(0, 24);
      const tareas = leer();
      const ya = tareas[clave];
      if (ya?.taskId && Date.now() - Date.parse(ya.creada) < VIGENCIA_MS) {
        console.log(`\n  (Suno ya estaba con este pedido en kie: sigo esperando esa tarea, ${ya.taskId}. No se pide otra.)`);
        return respuestaJSON({ code: 200, msg: 'retomada', data: { taskId: ya.taskId } });
      }
      const res = await fetchOriginal(url, opciones);
      const texto = await res.text();
      try {
        const json = JSON.parse(texto);
        if (json?.code === 200 && json?.data?.taskId) {
          tareas[clave] = { taskId: json.data.taskId, tipo, creada: new Date().toISOString() };
          escribir(tareas);
        }
      } catch {
        // no era JSON: el script lo dice con su mensaje de siempre
      }
      return new Response(texto, { status: res.status, statusText: res.statusText, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
    }

    const res = await fetchOriginal(url, opciones);
    // La consulta de una tarea anotada: si kie dice que fallo, o ya no la conoce, se olvida.
    const id = metodo === 'GET' ? u.searchParams.get('taskId') : null;
    if (id) {
      const tareas = leer();
      const clave = Object.keys(tareas).find((k) => tareas[k]?.taskId === id);
      if (clave) {
        let olvidar = false;
        try {
          const json = JSON.parse(await res.clone().text());
          const d = json?.data;
          const estado = d?.status || d?.state || null;
          olvidar = json?.code !== 200 || !d || (estado && FALLO.test(String(estado)));
        } catch {
          olvidar = !res.ok;
        }
        if (olvidar) {
          delete tareas[clave];
          escribir(tareas);
        }
      }
    }
    return res;
  };

  // Termino bien: lo anotado de esta corrida ya se uso (la "otra tanda" que pida el usuario es otra tarea).
  process.on('exit', (codigo) => {
    if (codigo !== 0) return;
    try {
      const tareas = leer();
      const quedan = Object.fromEntries(Object.entries(tareas).filter(([, t]) => t?.tipo !== (eligiendo ? 'extend' : 'generar')));
      if (Object.keys(quedan).length) escribir(quedan);
      else fs.rmSync(RUTA, { force: true });
    } catch {
      // queda: vence sola
    }
  });
}

// El script corre su parte de linea de comandos solo si es el que se lanzo.
process.argv[1] = path.join(AQUI, script);
await import(pathToFileURL(path.join(AQUI, script)).href);
