// Prueba de la voz del narrador que elige la app cuando el usuario no eligió una (2026-11-18), sin gastar nada:
//   node app/herramientas/probar-voz-auto.mjs
// Mide tonos sintéticos (grave y agudo), elige entre voces de ejemplo con etiquetas como las de ElevenLabs y revisa el
// orden de lo que manda: el video de referencia (medido) > lo que pidió la IA (voz-buscada.json) > la ficha.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { medirVoz } = await import('../../produccion/medir-voz.js');
const va = await import('../server/lib/voz-auto.js');

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 500)}`}`);
};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'voz-auto-'));
const tono = (f) => {
  const archivo = path.join(TMP, `tono-${f}.mp3`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `aevalsrc='0.5*sin(2*PI*${f}*t)+0.3*sin(4*PI*${f}*t)+0.15*sin(6*PI*${f}*t)':s=16000:d=3`, archivo]);
  return archivo;
};

const VOCES = [
  { id: 'adam0001', nombre: 'Adam', etiquetas: { gender: 'male', age: 'middle_aged', accent: 'american', use_case: 'narration', description: 'deep' } },
  { id: 'vale0002', nombre: 'Valentina', etiquetas: { gender: 'female', age: 'young', accent: 'latin american', language: 'es', use_case: 'social media', description: 'warm' } },
  { id: 'carl0003', nombre: 'Carlos', etiquetas: { gender: 'male', age: 'middle_aged', accent: 'colombian', language: 'es', use_case: 'narrative_story', description: 'calm' } },
  { id: 'luci0004', nombre: 'Lucía', etiquetas: { gender: 'female', age: 'middle_aged', accent: 'spanish', language: 'es', use_case: 'narration', description: 'soft' } },
  { id: 'rach0005', nombre: 'Rachel', etiquetas: { gender: 'female', age: 'young', accent: 'american', use_case: 'narration', description: 'calm' } },
];

try {
  const hayFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
  if (hayFfmpeg) {
    const graves = [95, 120, 150].map((f) => medirVoz(tono(f)));
    const agudas = [200, 230, 260].map((f) => medirVoz(tono(f)));
    check('Mide el tono: 95, 120 y 150 Hz son voces graves (masculinas)', graves.every((x, i) => x?.genero === 'masculina' && Math.abs(x.f0 - [95, 120, 150][i]) <= 3), graves);
    check('… y 200, 230 y 260 Hz agudas (femeninas), sin el error de la octava', agudas.every((x, i) => x?.genero === 'femenina' && Math.abs(x.f0 - [200, 230, 260][i]) <= 4), agudas);
  } else console.log('(sin ffmpeg: no mido tonos)');

  const b = (x) => ({ idioma: 'es', acento: 'latino', tono: [], motivo: [], ...x });
  check('Voz masculina en Latinoamérica -> la masculina latina que narra (no la americana)', va.elegirVoz(VOCES, b({ genero: 'masculina' }))?.voz.id === 'carl0003');
  check('Público de mujeres, cálida -> la femenina latina cálida', va.elegirVoz(VOCES, b({ genero: 'femenina', tono: ['cálida'] }))?.voz.id === 'vale0002');
  check('Mujer de España -> la de acento español', va.elegirVoz(VOCES, b({ genero: 'femenina', acento: 'espanol' }))?.voz.id === 'luci0004');
  const e = va.elegirVoz(VOCES, b({ genero: 'masculina', motivo: ['voz masculina como la del video de referencia (tono medio de 118 Hz)'] }));
  check('Dice por qué la eligió', /video de referencia/.test(e.motivo) && /Carlos/.test(e.motivo) && /acento latino/.test(e.motivo), e.motivo);

  // lo que manda: el video de referencia > lo que pidió la IA > la ficha
  const carpeta = path.join(TMP, 'anuncio');
  fs.mkdirSync(path.join(carpeta, 'app'), { recursive: true });
  fs.mkdirSync(path.join(carpeta, 'referencia'), { recursive: true });
  const ficha = { publico: 'Mujeres de 30 a 50', pais: 'Colombia', idioma: 'español' };
  check('Sin video ni pedido de la IA, manda la ficha (público de mujeres -> femenina, Colombia -> latino)', (() => { const x = va.vozBuscada({ carpeta, ficha }); return x.genero === 'femenina' && x.acento === 'latino'; })(), va.vozBuscada({ carpeta, ficha }));
  fs.writeFileSync(path.join(carpeta, 'voz-buscada.json'), JSON.stringify({ genero: 'masculina', edad: 'adulta', acento: 'colombiano', tono: ['calmada'], motivo: 'un médico que explica' }));
  check('Con voz-buscada.json, manda lo que pidió la IA', (() => { const x = va.vozBuscada({ carpeta, ficha }); return x.genero === 'masculina' && x.acento === 'colombiano' && x.edad === 'adulta'; })(), va.vozBuscada({ carpeta, ficha }));
  if (hayFfmpeg) {
    fs.copyFileSync(tono(215), path.join(carpeta, 'referencia', 'audio-referencia.mp3'));
    fs.writeFileSync(path.join(carpeta, 'referencia', 'transcripcion.json'), JSON.stringify({ palabras: [{ texto: 'hola', desde: 0, hasta: 3 }] }));
    fs.writeFileSync(path.join(carpeta, 'referencia', 'adn-base.json'), JSON.stringify({ video: 'v.mp4' }));
    const x = va.vozBuscada({ carpeta, ficha });
    check('Con video de referencia (voz aguda medida), manda el video aunque la IA pidiera masculina', x.genero === 'femenina' && x.deReferencia && /video de referencia/.test(x.motivo.join(' ')), x);
    check('La medida queda guardada en adn-base.json (no se mide dos veces)', JSON.parse(fs.readFileSync(path.join(carpeta, 'referencia', 'adn-base.json'), 'utf8')).voz?.genero === 'femenina');
  }

  // en el anuncio: la elige una vez, la guarda en el brief y no la cambia
  const brief = { slug: 'x', estilo: 'estilo-pixar', productoId: null, voz: { auto: true } };
  fs.writeFileSync(path.join(carpeta, 'app', 'brief.json'), JSON.stringify(brief));
  check('Pidió «que la elija la app» -> falta elegirla', va.faltaVoz(brief) && va.faltaVoz({ voz: null }) && !va.faltaVoz({ voz: { id: 'carl0003' } }));
  const r = await va.asegurarVoz({ carpeta, brief, ficha, voces: VOCES });
  const guardado = JSON.parse(fs.readFileSync(path.join(carpeta, 'app', 'brief.json'), 'utf8'));
  check('La elige y la guarda en el brief con su motivo (auto: true)', r.ok && guardado.voz?.id === r.voz.id && guardado.voz.auto === true && guardado.voz.motivo, guardado.voz);
  const otra = await va.asegurarVoz({ carpeta, brief: guardado, ficha, voces: [VOCES[0]] });
  check('Ya elegida, no cambia aunque cambien las voces (el anuncio suena siempre igual)', otra.voz.id === r.voz.id, otra);
  const eleg = await va.asegurarVoz({ carpeta, brief: { voz: { id: 'rach0005', nombre: 'Rachel' } }, ficha, voces: VOCES });
  check('Si el usuario eligió una voz, se respeta', eleg.voz.id === 'rach0005');
  const sin = await va.asegurarVoz({ carpeta, brief: { voz: { auto: true } }, ficha, voces: [] });
  check('Sin voces en la cuenta, lo dice claro', !sin.ok && /no tiene voces/.test(sin.mensaje), sin);
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);
