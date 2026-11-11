// Prueba de unidad SIN RED de las pruebas reales P1, P4 y P5 (app/herramientas/codex/tareas.mjs): no lanza ninguna IA,
// no copia el proyecto ni lee temp/ (solo mira si existen los anuncios de las tareas). Lo que prueba:
//   1. la lista de tareas: ids unicos, su punto y su fila de §3.2, que cubren las filas 1 y 4-24 (menos 2 y 3, que son
//      P2 y P3) y que cada funcion nombrada existe en el modulo de la app que dice;
//   2. los comandos de la prueba: solo los gratis y locales (y con sus banderas), nunca producir, generar ni ensamblar;
//   3. la copia fiel del editor: sus lineas siguen en rutas/editor.js (si alguien lo cambia, esto avisa);
//   4. lo que se cuenta de un registro de codex.js (mensajes, correcciones, intentos de herramientas, el aviso de Code
//      Mode, hilos y lo escrito) y donde queda el registro (-claude -> -codex);
//   5. comun(): --puntos, --solo y los grupos (P2 y P3 juntos, para tareas-guiones.mjs), sin escribir nada;
//   6. las copias de contextoDeGancho, lotesDeTomas y el mapa de la cancion, y el guion.json de una historia vieja.
//
//   node app/herramientas/codex/unidad-tareas.mjs        sale con 0 si todo paso y con 1 si algo fallo
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..', '..');

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
  return Boolean(ok);
}
const seccion = (t) => console.log(`\n== ${t}`);

// (la IA fija, como las otras pruebas de unidad: asi ningun modulo de la app lee app/config.json)
process.env.AIA_MOTOR = 'codex';
const t = await import('./tareas.mjs');

// -------------------------------------------------------------- 1. la lista
seccion('1. las tareas de P1, P4 y P5');
const ids = t.TAREAS.map((x) => x.id);
check('27 tareas, sin ids repetidos', ids.length === 27 && new Set(ids).size === ids.length, ids);
check('P1: las 3 fichas', t.TAREAS.filter((x) => x.punto === 'p1').length === 3);
check('P4: estrategia, prompts, revisión y ajuste', ['imagen-estrategia', 'imagen-prompts', 'imagen-revision', 'imagen-ajuste'].every((i) => t.TAREAS.find((x) => x.id === i)?.punto === 'p4'));
check('cada tarea tiene punto, fila, título, función, fuente y armar', t.TAREAS.every((x) => ['p1', 'p4', 'p5'].includes(x.punto) && Number.isInteger(x.fila) && x.titulo && x.funcion && x.fuente && typeof x.armar === 'function'));
const filas = new Set(t.TAREAS.map((x) => x.fila));
const esperadas = [1, ...Array.from({ length: 21 }, (_, i) => i + 4)];
check('cubren las filas 1 y 4-24 de §3.2 (2 y 3 son P2 y P3)', esperadas.every((f) => filas.has(f)) && !filas.has(2) && !filas.has(3), [...filas].sort((a, b) => a - b));
check('los 3 rechazos de texto (filas 6, 8 y 11) y el del B-roll (12)', [6, 8, 11, 12].every((f) => t.TAREAS.some((x) => x.fila === f)));

// las funciones nombradas existen en el modulo de la app
const MODULOS = {
  productos: 'app/server/lib/productos.js',
  'imagen-ads/sesiones': 'app/server/lib/imagen-ads/sesiones.js',
  'voz-en-off': 'app/server/lib/familias/voz-en-off.js',
  'objeto-parlante': 'app/server/lib/familias/objeto-parlante.js',
  ugc: 'app/server/lib/familias/ugc.js',
  hablado: 'app/server/lib/familias/hablado.js',
  'historia-musical': 'app/server/lib/familias/historia-musical.js',
  continuidad: 'app/server/lib/familias/continuidad.js',
};
const cargados = {};
const faltan = [];
for (const x of t.TAREAS) {
  const m = /^([a-z/-]+)\.([A-Za-z]+)/.exec(x.funcion);
  if (!m || !MODULOS[m[1]]) continue; // (el editor no exporta su armado: lo prueba la seccion 3)
  cargados[m[1]] ||= await import(pathToFileURL(path.join(RAIZ, MODULOS[m[1]])).href);
  if (typeof cargados[m[1]][m[2]] !== 'function') faltan.push(`${m[1]}.${m[2]}`);
}
check('cada función armarSesion…/sesion… nombrada está exportada por la app', !faltan.length, faltan);
check('la del editor dice que es una copia fiel', /copia fiel/.test(t.TAREAS.find((x) => x.id === 'editor-rehacer')?.funcion || ''));

// los anuncios de verdad que copian (solo si estan: en el CI no hay temp/)
const fuentes = [...new Set(t.TAREAS.map((x) => x.fuente))];
const hay = fuentes.filter((f) => fs.existsSync(path.join(RAIZ, ...f.split('/'))));
if (hay.length) check(`los anuncios, productos y lotes de las tareas están en temp/ (${hay.length} de ${fuentes.length})`, hay.length === fuentes.length, fuentes.filter((f) => !hay.includes(f)));
else console.log('(omitida: no hay anuncios reales en temp/, como en el CI)');

// -------------------------------------------------------------- 2. los comandos
seccion('2. los comandos de la prueba: solo lo gratis y local');
const si = [
  ['rehacer-toma.js', ['temp/x', '--toma', '3', '--contexto']],
  ['rehacer-toma.js', ['temp/x', '--broll', '2', '--contexto']],
  ['validar-manifiesto.js', ['temp/x/manifiesto.json']],
  ['tiempos-cancion.js', ['temp/x', '--lineas']],
  ['continuidad.js', ['temp/x', '--pares']],
  ['extraer-frames.js', ['temp/x', '--uniones']],
  ['generar-cancion.js', ['temp/x', '--solo-plan']],
];
const no = [
  ['producir.js', ['temp/x', '--si']],
  ['generar-imagenes.js', ['temp/x']],
  ['generar-videos.js', ['temp/x']],
  ['generar-audio.js', ['temp/x']],
  ['generar-musica.js', ['temp/x']],
  ['ensamblar.js', ['temp/x']],
  ['generar-imagen-ads.js', ['temp/x']],
  ['rehacer-toma.js', ['temp/x', '--toma', '3', '--aplicar', 'n.json']],
  ['rehacer-toma.js', ['temp/x', '--toma', '3']],
  ['rehacer-toma.js', ['temp/x', '--gancho', '1b', '--contexto']],
  ['continuidad.js', ['temp/x', '--preparar']],
  ['continuidad.js', ['temp/x', '--duraciones', '--pares']],
  ['generar-cancion.js', ['temp/x']],
  ['generar-cancion.js', ['temp/x', '--elegir', '1']],
  ['generar-cancion.js', ['temp/x', '--solo-plan', '--si']],
  ['verificar.js', []],
  ['pruebas/x.js', []],
  ['../app/server/index.js', []],
];
check('se corren: rehacer-toma --contexto, validar-manifiesto, tiempos-cancion, continuidad --pares, extraer-frames y generar-cancion --solo-plan', si.every(([s, a]) => t.scriptPermitido(s, a)), si.filter(([s, a]) => !t.scriptPermitido(s, a)));
check('no se corre nada que produzca, cobre o salga de produccion/', no.every(([s, a]) => !t.scriptPermitido(s, a)), no.filter(([s, a]) => t.scriptPermitido(s, a)));

// -------------------------------------------------------------- 3. la copia del editor
seccion('3. la copia fiel de rutas/editor.js');
const editor = fs.readFileSync(path.join(RAIZ, 'app', 'server', 'rutas', 'editor.js'), 'utf8');
check('las líneas de textoDeRehacer, sus permisos y validarPrompts siguen en editor.js', t.huellasQueFaltan(editor).length === 0, t.huellasQueFaltan(editor));
check('y se nota si cambian', t.huellasQueFaltan(editor.replace('TAREA: rehacer una pieza', 'TAREA: rehacer otra pieza')).length === 1);

// -------------------------------------------------------------- 4. el registro
seccion('4. lo que se cuenta del registro de codex.js');
check('-claude.jsonl pasa a -codex.jsonl', t.registroDeCodex(path.join('a', 'revision-claude.jsonl')) === path.join('a', 'revision-codex.jsonl'));
check('sin -claude, se agrega -codex', t.registroDeCodex(path.join('a', 'ficha.log')) === path.join('a', 'ficha-codex.log') && t.registroDeCodex(path.join('a', 'imagen-ads-E001.jsonl')) === path.join('a', 'imagen-ads-E001-codex.jsonl'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unidad-tareas-'));
try {
  const H1 = '0199a1c0-0000-7000-8000-000000000001';
  const H2 = '0199a1c0-0000-7000-8000-000000000002';
  const L = (o) => JSON.stringify(o);
  const lineas = [
    L({ type: 'app', modo: 'exec', clase: 'inicial' }),
    L({ type: 'thread.started', thread_id: H1 }),
    L({ type: 'item.completed', item: { id: 'e0', type: 'error', message: 'Code Mode is unavailable because code-mode host is disabled. Enable the code_mode_host feature to use it.' } }),
    L({ type: 'turn.started' }),
    L({ type: 'item.started', item: { id: 'c1', type: 'collab_tool_call' } }),
    L({ type: 'item.completed', item: { id: 'c1', type: 'collab_tool_call' } }),
    L({ type: 'app', intento: 'herramienta', stderr: 'ERROR codex_core::tools::router: error=code-mode host is disabled' }),
    L({ type: 'item.completed', item: { id: 'e1', type: 'error', message: 'tool exec is not available' } }),
    L({ type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: L({ estado: 'SEGUIR', respuesta: '', archivos: [], ediciones: [], leer: [], comandos: [] }) } }),
    L({ type: 'app', guardo: [{ ruta: 'temp/x/app/revision.json', bytes: 10 }], edito: [], estado: 'SEGUIR' }),
    L({ type: 'app', modo: 'resume', clase: 'siguiente' }),
    L({ type: 'app', correccion: ['falta algo'] }),
    L({ type: 'item.completed', item: { id: 'm2', type: 'agent_message', text: L({ estado: 'HECHO' }) } }),
    L({ type: 'app', modo: 'exec', clase: 'deNuevo' }),
    L({ type: 'thread.started', thread_id: H2 }),
    L({ type: 'app', edito: [{ ruta: 'temp/x/manifiesto.json', ediciones: 2 }], estado: 'LISTO' }),
    'esto no es JSON',
  ];
  const ruta = path.join(dir, 'x-codex.jsonl');
  fs.writeFileSync(ruta, `${lineas.join('\n')}\n`);
  const r = t.leerRegistro(ruta);
  check('mensajes (exec y resume) y correcciones', r.mensajes === 3 && r.exec === 2 && r.resume === 1 && r.correcciones === 1, r);
  check('intentos de herramientas: el item de una herramienta (una vez), la línea del router y un error que no es el de Code Mode', r.herramientas.items === 1 && r.herramientas.router === 1 && r.herramientas.errores === 1 && r.herramientas.tipos.collab_tool_call === 1, r.herramientas);
  check('el aviso de Code Mode no cuenta', !r.erroresDeCodex.some((e) => /Code Mode/.test(e)));
  check('los hilos que se crearon, sin repetir', JSON.stringify(r.hilos) === JSON.stringify([H1, H2]), r.hilos);
  check('lo que escribió (entero y con ediciones) y los estados', r.guardo.length === 1 && r.edito.length === 1 && r.estados.join() === 'SEGUIR,LISTO', r);
  check('un estado fuera del enum se cuenta', r.fueraDelEnum === 1);
  check('un registro que no está da null', t.leerRegistro(path.join(dir, 'no-esta.jsonl')) === null);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// -------------------------------------------------------------- 5. comun()
seccion('5. comun(): los puntos, --solo y los grupos');
const armar = (args) => {
  const notas = [];
  const opcion = (n) => {
    const i = args.indexOf(n);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  };
  const c = t.comun({ raiz: RAIZ, args, opcion, anotar: (n, ok, d) => (notas.push({ n, ok, d }), ok), nota: () => {}, appServer: null, rutas: { VERSION_CODEX: '0.167.0' } });
  return { c, notas };
};
const grupos = (c) => c.grupos.map((g) => `${g.de}:${g.puntos.join('+')}`).join(' ');
const informeAntes = fs.existsSync(path.join(RAIZ, 'temp', '_codex-prueba', 'falso', 'informe.json')) ? fs.statSync(path.join(RAIZ, 'temp', '_codex-prueba', 'falso', 'informe.json')).mtimeMs : null;
let x = armar(['--tareas']);
check('sin --puntos: P1, P2+P3 (a tareas-guiones.mjs), P4 y P5, en ese orden', grupos(x.c) === 'propias:p1 guiones:p2+p3 propias:p4 propias:p5', grupos(x.c));
check('sin --home-usuario va con el Codex falso, y su informe en temp/_codex-prueba/falso/', x.c.opciones.falso === true && /_codex-prueba[\\/]falso$/.test(x.c.opciones.dirPrueba));
x = armar(['--tareas', '--puntos', 'p5,p1,p4']);
check('--puntos p5,p1,p4: en orden de número', grupos(x.c) === 'propias:p1 propias:p4 propias:p5', grupos(x.c));
x = armar(['--tareas', '--puntos', 'p3,medium']);
check('--puntos p3,medium: un solo grupo para tareas-guiones.mjs', grupos(x.c) === 'guiones:p3+medium', grupos(x.c));
x = armar(['--tareas', '--solo', 'voz-lego']);
check('--solo voz-lego: solo P5 (la tarea es de este módulo)', grupos(x.c) === 'propias:p5' && x.c.opciones.solo === 'voz-lego', grupos(x.c));
x = armar(['--tareas', '--solo', 'claymation']);
check('--solo claymation (un estilo de P2): va a tareas-guiones.mjs', grupos(x.c) === 'guiones:p2+p3', grupos(x.c));
x = armar(['--tareas', '--puntos', 'p9']);
check('--puntos p9: no lo conoce y no sigue', x.c.ok === false && x.notas.some((n) => !n.ok && /p9/.test(n.d)));
x = armar(['--tareas', '--home-usuario']);
check('con --home-usuario: Codex de verdad y su informe en temp/_codex-prueba/', x.c.opciones.falso === (process.env.AIA_TAREAS_CODEX_FALSO === '1') && /_codex-prueba$/.test(x.c.opciones.dirPrueba));
const informeDespues = fs.existsSync(path.join(RAIZ, 'temp', '_codex-prueba', 'falso', 'informe.json')) ? fs.statSync(path.join(RAIZ, 'temp', '_codex-prueba', 'falso', 'informe.json')).mtimeMs : null;
check('comun() no escribe nada', informeAntes === informeDespues);

// -------------------------------------------------------------- 6. las copias de lo que no se exporta
seccion('6. contextoDeGancho y lotesDeTomas');
const m = {
  ganchos_alternativos: [{ id: '1b', reemplaza: 1, duracion: 10, referencias: ['personaje', 'producto'], tramos: [{ desde: 0, hasta: 4.5, linea: 'Hola' }, { desde: 4.5, hasta: 10 }], prompt_video: 'PROMPT' }],
  tomas: [
    ...Array.from({ length: 10 }, (_, i) => ({ n: i + 1, tipo: 'B' })),
    ...Array.from({ length: 6 }, (_, i) => ({ n: i + 11, tipo: 'A' })),
    { n: 17, tipo: 'H' },
  ],
};
const g = t.contextoDeGancho(m, '1b');
check('el contexto del gancho: lo que no se toca, sus tramos y su prompt', /otro arranque para el bloque 1/.test(g) && /duracion:\s+10s/.test(g) && /1\) personaje {2}2\) producto/.test(g) && /\[0\.0–4\.5s\]\s+"Hola"/.test(g) && /\(sin dialogo\)/.test(g) && /--- video ---\nPROMPT/.test(g), g);
check('un gancho que no está: vacío', t.contextoDeGancho(m, '9z') === '');
const lotes = t.lotesDeTomas(m);
check('lotes de hasta 24 imágenes (una B son dos) y sin las tomas H', lotes.length === 2 && lotes[0].length === 14 && lotes[1].length === 2 && !lotes.flat().some((x) => x.tipo === 'H'), lotes.map((l) => l.map((x) => x.n)));

// el mapa de la cancion y el guion.json de una historia de antes de la app (musical-tomas)
const cjPrueba = {
  duracion: 30,
  palabras: [
    { texto: 'Hola', inicio: 3, fin: 3.5 },
    { texto: 'mundo', inicio: 4, fin: 4.6 },
    { texto: 'otra', inicio: 12, fin: 12.4 },
    { texto: 'vez', inicio: 12.5, fin: 13 },
    { texto: 'sin', inicio: null, fin: null },
  ],
};
const mapa = t.mapaDeCancion(cjPrueba);
check(
  'el mapa de la canción: empieza en la marca, tramos cantados, huecos sin letra (también el del final) y sin «Siguiente paso»',
  mapa.startsWith('--- MAPA DE LA CANCION ---') && /0\.00s ->\s+3\.00s\s+3\.0s {2}SIN LETRA/.test(mapa) && /3\.00s ->\s+4\.60s\s+1\.6s {2}cantado: Hola mundo/.test(mapa) && /13\.00s ->\s+30\.00s\s+17\.0s {2}SIN LETRA/.test(mapa) && /2 tramo\(s\) cantado\(s\)/.test(mapa) && !/Siguiente paso/.test(mapa) && mapa.endsWith('\n'),
  mapa
);
const gp = t.guionDeLaPeticion({ titulo: 'T', idioma: 'es', estilos: ['a', 'b'], letra: '[Verse 1 - soft]\nLínea uno.\nLínea dos.\n\n[Chorus]\nLínea tres.' }, { slug: 'x' });
check(
  'el guion.json de una historia de antes de la app: una parte por línea, sin las etiquetas, con su momento, y marcado deLaPrueba',
  gp.partes.length === 3 && gp.partes[0].dice === 'Línea uno.' && gp.partes[2].momento === 'Chorus' && gp.partes.every((p, i) => p.n === i + 1 && p.se_ve === '') && gp.estilos_cancion.length === 2 && /temp\/x/.test(gp.deLaPrueba),
  gp
);

const bien = resultados.filter((r) => r.ok).length;
console.log(`\n${bien} de ${resultados.length} bien.`);
console.log(`RESULTADO ${JSON.stringify({ bien, mal: resultados.length - bien })}`);
process.exit(bien === resultados.length ? 0 : 1);
