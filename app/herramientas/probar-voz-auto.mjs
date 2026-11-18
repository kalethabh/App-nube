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
  { const x = await va.vozBuscada({ carpeta, ficha }); check('Sin video ni pedido de la IA, manda la ficha (público de mujeres -> femenina, Colombia -> latino)', x.genero === 'femenina' && x.acento === 'latino', x); }
  fs.writeFileSync(path.join(carpeta, 'voz-buscada.json'), JSON.stringify({ genero: 'masculina', edad: 'adulta', acento: 'colombiano', tono: ['calmada'], motivo: 'un médico que explica' }));
  { const x = await va.vozBuscada({ carpeta, ficha }); check('Con voz-buscada.json, manda lo que pidió la IA', x.genero === 'masculina' && x.acento === 'colombiano' && x.edad === 'adulta', x); }
  if (hayFfmpeg) {
    fs.copyFileSync(tono(215), path.join(carpeta, 'referencia', 'audio-referencia.mp3'));
    fs.writeFileSync(path.join(carpeta, 'referencia', 'transcripcion.json'), JSON.stringify({ palabras: [{ texto: 'hola', desde: 0, hasta: 3 }] }));
    fs.writeFileSync(path.join(carpeta, 'referencia', 'adn-base.json'), JSON.stringify({ video: 'v.mp4' }));
    const x = await va.vozBuscada({ carpeta, ficha });
    check('Con video de referencia (voz aguda medida), manda el video aunque la IA pidiera masculina', x.genero === 'femenina' && x.deReferencia && /video de referencia/.test(x.motivo.join(' ')), x);
    check('La medida queda guardada en adn-base.json (no se mide dos veces)', JSON.parse(fs.readFileSync(path.join(carpeta, 'referencia', 'adn-base.json'), 'utf8')).voz?.genero === 'femenina');
  }

  // «Agregar» escrito antes de voz-buscada.json: lo que dice el plan de la voz
  const conPlan = path.join(TMP, 'con-plan');
  fs.mkdirSync(path.join(conPlan, 'app'), { recursive: true });
  fs.writeFileSync(path.join(conPlan, 'app', 'plan.json'), JSON.stringify({ conserva: ['la estructura: gancho y remate', 'la voz: mujer joven, firme y cercana, con acento colombiano'] }));
  const p = va.vozDelPlan(conPlan, {});
  check('Lee la voz del plan de «Agregar» (mujer joven, cercana, colombiana)', p.genero === 'femenina' && p.edad === 'joven' && p.acento === 'colombiano' && p.tono.includes('cercana'), p);
  const medellin = [...VOCES, { id: 'mede0006', nombre: 'Valentina - Conversational Medellin', etiquetas: { gender: 'female', age: 'young', language: 'es' } }];
  { const bp = await va.vozBuscada({ carpeta: conPlan, ficha: { pais: 'Colombia' } }); check('… y elige la voz de Medellín de tu cuenta (la ciudad cuenta como acento colombiano)', va.elegirVoz(medellin, bp)?.voz.id === 'mede0006', va.elegirVoz(medellin, bp)); }

  // la app no se queda ocupada mientras mide la voz de un video largo (antes congelaba las consultas a ElevenLabs)
  if (hayFfmpeg) {
    const largo = path.join(TMP, 'largo');
    fs.mkdirSync(path.join(largo, 'referencia'), { recursive: true });
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', "aevalsrc='0.5*sin(2*PI*120*t)+0.3*sin(4*PI*120*t)':s=44100:d=300", path.join(largo, 'referencia', 'audio-referencia.mp3')]);
    fs.writeFileSync(path.join(largo, 'referencia', 'adn-base.json'), '{}');
    let peor = 0;
    let antes = Date.now();
    const reloj = setInterval(() => {
      peor = Math.max(peor, Date.now() - antes);
      antes = Date.now();
    }, 20);
    const t0 = Date.now();
    const medida = await va.vozDeLaReferencia(largo);
    clearInterval(reloj);
    check(`Mide la voz de un video de 5 minutos sin congelar la app (${Date.now() - t0} ms; la app esperó como mucho ${peor} ms)`, medida?.genero === 'masculina' && peor < 300 && Date.now() - t0 < 20000, { medida, peor });
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

  // la lista de voces de ElevenLabs, pedida desde la app (como el saldo), contra un ElevenLabs simulado
  const http = await import('node:http');
  const vocesMod = await import('../server/lib/voces.js');
  let modo = 'ok';
  let sinConteo = true;
  const servidor = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/v2/voices' && u.searchParams.get('include_total_count') !== 'false') sinConteo = false;
    if (modo === 'clave' || req.headers['xi-api-key'] !== 'sk_prueba_123456789') return res.writeHead(401).end('{}');
    if (modo === 'v2-cae' && u.pathname === '/v2/voices') return res.writeHead(500).end('{}');
    const pagina = u.searchParams.get('next_page_token') ? 2 : 1;
    const voz = (id, n) => ({ voice_id: id, name: n, category: 'cloned', labels: { gender: 'female', accent: 'latin american' }, preview_url: `https://x/${id}.mp3` });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (u.pathname === '/v1/voices') return res.end(JSON.stringify({ voices: [voz('v1aaaa01', 'Legado')] }));
    res.end(JSON.stringify(pagina === 1 ? { voices: [voz('pag1aaaa', 'Uno')], has_more: true, next_page_token: 't2' } : { voices: [voz('pag2bbbb', 'Dos')], has_more: false }));
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  // (un .env de prueba: en tu computadora la clave de verdad nunca va al servidor simulado)
  const clavesMod = await import('../server/lib/claves.js');
  const envPrueba = path.join(TMP, '.env');
  fs.writeFileSync(envPrueba, 'ELEVENLABS_API_KEY=sk_prueba_123456789\n');
  clavesMod._paraPruebas({ archivo: envPrueba });
  const anterior = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const guardada = path.join(TMP, 'voces-guardadas.json');
  const puerto = servidor.address().port;
  vocesMod._paraPruebas({ servidor: `http://127.0.0.1:${puerto}`, archivo: guardada });
  const l1 = await vocesMod.voces({ fresco: true });
  check('Trae las voces de ElevenLabs desde la app, todas las páginas, con su muestra y etiquetas', l1.ok && l1.voces.map((v) => v.id).join() === 'pag1aaaa,pag2bbbb' && l1.voces[0].muestra && l1.voces[0].etiquetas.gender === 'female' && l1.voces[0].propia, l1);
  check('Pide la lista sin el conteo total (lo que la hace lenta)', sinConteo);
  check('Guarda la última lista que llegó bien', JSON.parse(fs.readFileSync(guardada, 'utf8')).voces.length === 2);
  modo = 'v2-cae';
  const l2 = await vocesMod.voces({ fresco: true });
  check('Si la lista nueva (v2) falla, usa la de siempre (v1)', l2.ok && l2.voces[0]?.id === 'v1aaaa01', l2);
  modo = 'clave';
  const l3 = await vocesMod.voces({ fresco: true });
  check('Clave rechazada: lo dice así (no como «error de conexión»)', !l3.ok && l3.motivo === 'clave' && /rechazó tu clave/.test(vocesMod.mensajeSimple(l3.mensaje)), l3);
  await new Promise((r) => servidor.close(r));
  modo = 'ok';
  const l4b = await vocesMod.voces({ fresco: true });
  check('ElevenLabs caído pero con una lista guardada: sigue con la guardada', l4b.ok && l4b.guardada && l4b.voces.length >= 1, l4b);
  vocesMod._paraPruebas({ servidor: `http://127.0.0.1:${puerto}`, archivo: guardada });
  const t0 = Date.now();
  const l4c = await vocesMod.voces({});
  check('Al abrir la app (sin la lista en memoria) muestra la guardada al instante y pide la nueva por detrás', l4c.ok && l4c.guardada && Date.now() - t0 < 200, { l4c, ms: Date.now() - t0 });
  await new Promise((r) => setTimeout(r, 300));
  fs.rmSync(guardada, { force: true });
  vocesMod._paraPruebas({ servidor: `http://127.0.0.1:${puerto}`, archivo: guardada });
  const l4 = await vocesMod.voces({ fresco: true });
  check('Servidor caído y sin lista guardada: «No pude conectar con ElevenLabs»', !l4.ok && l4.motivo === 'sin-conexion' && /No pude conectar/.test(vocesMod.mensajeSimple(l4.mensaje)), l4);
  fs.writeFileSync(envPrueba, '# sin clave\n');
  vocesMod._paraPruebas({ servidor: 'http://127.0.0.1:9', archivo: guardada });
  const l5 = await vocesMod.voces({ fresco: true });
  check('Sin clave: pide pegarla en Ajustes', !l5.ok && /Falta tu clave/.test(vocesMod.mensajeSimple(l5.mensaje)), l5);
  if (anterior) process.env.ELEVENLABS_API_KEY = anterior;
  vocesMod._paraPruebas({ archivo: path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '.cache', 'voces-elevenlabs.json') });
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);
