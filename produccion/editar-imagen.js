// Editar UNA imagen ya generada con un pedido puntual («quítale el logo de la camiseta», «que sonría»): el modelo de
// imagen recibe la imagen y cambia SOLO eso; lo demás queda igual. La imagen vieja va a historial/ (no se pierde).
//
//   node produccion/editar-imagen.js temp/<slug> img/<archivo> --pedido "..." [--si]
//     sin --si: dice lo que cuesta y no gasta nada · con --si: la edita (cobra una imagen en kie.ai)
//
// Lo usa la app (Producción → una imagen → «Editar esta imagen»). Si la imagen ya tenía su clip, la app decide si
// también lo rehace.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RAIZ, cargarEnv, PRECIOS, creditosAUsd } from './config.js';
import { generarImagen, subirArchivo } from './kie-client.js';
import { archivarSiExiste } from './historial.js';

const MODELO = 'nano-banana-2';
const RESOLUCION = '2K';

export const creditosDeEdicion = () => PRECIOS.imagen[MODELO][RESOLUCION];

function medidas(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', f], { encoding: 'utf8' });
  try {
    const s = JSON.parse(r.stdout).streams[0];
    return { w: s.width, h: s.height };
  } catch {
    return null;
  }
}
/** La proporción más cercana que acepta el modelo. */
function proporcion(m) {
  if (!m) return '9:16';
  const r = m.w / m.h;
  const ops = [['9:16', 9 / 16], ['2:3', 2 / 3], ['3:4', 3 / 4], ['4:5', 4 / 5], ['1:1', 1], ['5:4', 5 / 4], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9]];
  return ops.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a))[0];
}

export async function editarImagen(carpeta, archivo, pedido) {
  const dir = path.resolve(carpeta);
  const f = path.resolve(dir, archivo);
  if (!f.startsWith(dir + path.sep) || !fs.existsSync(f)) throw new Error(`No encuentro la imagen: ${archivo}`);
  const texto = String(pedido || '').trim();
  if (!texto) throw new Error('Falta el pedido: qué cambiar en la imagen.');
  const prompt = `Edit this image. Apply ONLY this change (the request is in Spanish): «${texto}».
Keep EVERYTHING else exactly the same: the same people and faces, the same product and label, clothes, pose, background, framing, camera angle, lighting, colors and art style. Do not add text, captions, logos or watermarks.`;
  const url = await subirArchivo(f);
  const tmp = f.replace(/(\.[a-z]+)$/i, '.editando$1');
  await generarImagen({ modelo: MODELO, prompt, imagenesReferencia: [url], aspectRatio: proporcion(medidas(f)), resolucion: RESOLUCION, rutaDestino: tmp });
  if (!fs.existsSync(tmp)) throw new Error('kie.ai no devolvió la imagen editada.');
  archivarSiExiste(f, dir);
  fs.renameSync(tmp, f);
  return f;
}

// ---------------------------------------------------------------- uso directo
const [, script, ...args] = process.argv;
if (script && path.resolve(script) === fileURLToPath(import.meta.url)) {
  const carpeta = args[0];
  const archivo = args[1];
  const i = args.indexOf('--pedido');
  const pedido = i >= 0 ? args[i + 1] : '';
  const cr = creditosDeEdicion();
  if (!carpeta || !archivo) {
    console.error('Uso: node produccion/editar-imagen.js temp/<slug> img/<archivo> --pedido "..." [--si]');
    process.exit(1);
  }
  console.log(`  Editar ${archivo}: ${cr} créditos (US$${creditosAUsd(cr).toFixed(2)}) en kie.ai.`);
  if (!args.includes('--si')) {
    console.log('  (no se gastó nada: con --si se hace)');
    process.exit(0);
  }
  cargarEnv();
  editarImagen(path.resolve(RAIZ, carpeta), archivo, pedido)
    .then((f) => console.log(`  Listo: ${f}`))
    .catch((e) => {
      console.error(`  ${e.message}`);
      process.exit(1);
    });
}
