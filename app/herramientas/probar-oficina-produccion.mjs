// Prueba de las cadenas de producción de la oficina (lib/oficina-produccion.js): cada paso real cae en su estación,
// lo que la revisión devolvió se cuenta como corrección y un paso con error queda en rojo. Sin gastar nada: arma un
// anuncio y un lote de prueba en temp/ (con sus archivos de estado) y los borra al terminar.
//   node app/herramientas/probar-oficina-produccion.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPARTAMENTOS, estacionDelPaso, produccion, _paraPruebas } from '../server/lib/oficina-produccion.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};
const escribir = (rel, d) => {
  fs.mkdirSync(path.dirname(path.join(RAIZ, rel)), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, rel), JSON.stringify(d));
};
const SLUG = 'zz-prueba-oficina-video';
const LOTE = '_img-zz-prueba-oficina';

try {
  check('Seis departamentos: video, imagen e investigación con su cadena; landing, WhatsApp y análisis en construcción', DEPARTAMENTOS.length === 6 && DEPARTAMENTOS.filter((d) => d.pronto).map((d) => d.id).join() === 'landing,whatsapp,analisis' && DEPARTAMENTOS.every((d) => d.estaciones.length >= 5 && d.estaciones.length <= 6));
  const casos = { validar: 'v-plan', saldo: 'v-plan', persona: 'v-imagenes', imagenes: 'v-imagenes', 'revision-imagenes': 'v-revision', 'imagenes-y-videos': 'v-produccion', bloques: 'v-produccion', voces: 'v-produccion', musica: 'v-produccion', montaje: 'v-edicion', render: 'v-edicion', 'control-final': 'v-revision', informe: 'v-edicion' };
  const mal = Object.entries(casos).filter(([p, e]) => estacionDelPaso(p) !== e);
  check('Cada paso de un anuncio de video cae en su estación', !mal.length, mal.map(([p, e]) => `${p}: ${estacionDelPaso(p)} (esperaba ${e})`));

  // un anuncio de video produciendo: imágenes hechas, la revisión rehízo 2 tomas, ahora los clips
  escribir(`temp/${SLUG}/app/conductor.json`, {
    estado: 'corriendo',
    paso: 'videos',
    rehechos: { 'toma-2': 1, 'toma-4': 1, 'bloque-1': 1 },
    pasos: [
      { id: 'validar', estado: 'hecho' }, { id: 'saldo', estado: 'hecho' }, { id: 'imagenes', estado: 'hecho' }, { id: 'revision-imagenes', estado: 'hecho' },
      { id: 'videos', estado: 'corriendo' }, { id: 'montaje', estado: 'pendiente' }, { id: 'render', estado: 'pendiente' }, { id: 'control-final', estado: 'pendiente' },
    ],
  });
  let v = _paraPruebas.trabajoDeVideo({ slug: SLUG, estado: 'produciendo', etapa: 'videos', titulo: 'Prueba' });
  check('Video: guion, plan e imágenes hechos; producción trabajando; edición pendiente', v.estaciones['v-guion'] === 'hecho' && v.estaciones['v-plan'] === 'hecho' && v.estaciones['v-imagenes'] === 'hecho' && v.estaciones['v-produccion'] === 'trabajando' && v.estaciones['v-edicion'] === 'pendiente' && v.actual === 'v-produccion', v);
  check('Video: lo que la revisión devolvió cuenta como corrección de su estación (2 tomas → imágenes, 1 bloque → producción)', v.correcciones['v-imagenes'] === 2 && v.correcciones['v-produccion'] === 1, v.correcciones);
  escribir(`temp/${SLUG}/app/conductor.json`, { estado: 'error', paso: 'montaje', pasos: [{ id: 'validar', estado: 'hecho' }, { id: 'videos', estado: 'hecho' }, { id: 'montaje', estado: 'error', error: { mensaje: 'Falló el montaje' } }] });
  v = _paraPruebas.trabajoDeVideo({ slug: SLUG, estado: 'error', etapa: 'montaje', titulo: 'Prueba' });
  check('Video: un paso con error deja su estación en rojo con el mensaje', v.estaciones['v-edicion'] === 'error' && v.error?.estacion === 'v-edicion' && /montaje/.test(v.error.mensaje) && v.estado === 'error', v);
  v = _paraPruebas.trabajoDeVideo({ slug: 'zz-no-existe', estado: 'guion', etapa: 'aprobar', titulo: 'Guion', teNecesita: true });
  check('Video sin producir: el guion espera tu aprobación (hecho y «te necesita»)', v.estaciones['v-guion'] === 'hecho' && v.estado === 'te-necesita', v);

  // un lote de imágenes: estrategia y prompts hechos, una revisión en curso y una pieza devuelta a los prompts
  escribir(`temp/${LOTE}/app/conductor.json`, { estado: 'corriendo', paso: 'anuncios', pasos: [{ id: 'preparar', estado: 'hecho' }, { id: 'saldo', estado: 'hecho' }, { id: 'estrategia', estado: 'hecho' }, { id: 'anuncios', estado: 'corriendo' }, { id: 'informe', estado: 'pendiente' }] });
  escribir(`temp/${LOTE}/app/imagen-ads/estado.json`, {
    tandas: { E001: { tipo: 'prompts', estado: 'hecha' }, R001: { tipo: 'revision', estado: 'en-curso' } },
    piezas: { V01_1x1: { resultado: 'listo', ronda: 1, revision: { ok: true } }, V02_1x1: { resultado: 'listo', ronda: 2, revision: { ok: false, problemas: ['texto cortado'] } }, V03_1x1: { resultado: null, fase: 'imagen' } },
  });
  let l = _paraPruebas.trabajoDeLote({ lote: LOTE, titulo: 'Lote', total: 3, estado: 'corriendo' });
  check('Imagen: investigación, estrategia y prompts hechos; generación y revisión trabajando', l.estaciones['i-investigacion'] === 'hecho' && l.estaciones['i-estrategia'] === 'hecho' && l.estaciones['i-prompts'] === 'hecho' && l.estaciones['i-generacion'] === 'trabajando' && l.estaciones['i-revision'] === 'revisando' && l.estaciones['i-entrega'] === 'pendiente', l.estaciones);
  check('Imagen: la pieza que la revisión no aprobó vuelve a los prompts (corrección)', l.correcciones['i-prompts'] === 1 && l.actual === 'i-revision', l);
  escribir(`temp/${LOTE}/app/imagen-ads/estado.json`, { tandas: { A001: { tipo: 'ajuste', estado: 'en-curso' } }, piezas: { V02_1x1: { resultado: 'listo', ronda: 2 } } });
  l = _paraPruebas.trabajoDeLote({ lote: LOTE, titulo: 'Lote', total: 1, estado: 'corriendo' });
  check('Imagen: con un ajuste en curso, los prompts están «corrigiendo»', l.estaciones['i-prompts'] === 'corrigiendo', l.estaciones);
  const p = await produccion();
  check('produccion() trae los seis departamentos con sus estaciones y sus trabajos', p.departamentos.length === 6 && p.departamentos.every((d) => Array.isArray(d.trabajos) && d.estaciones.length));
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  fs.rmSync(path.join(RAIZ, 'temp', SLUG), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', LOTE), { recursive: true, force: true });
}
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);
