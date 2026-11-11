// Prueba de unidad de lo que puede leer, escribir y correr una IA sin herramientas (Codex), y del material que se le
// pega (app/server/lib/ia/reglas.js y material.js). Sin red, sin Codex, sin Claude y sin gastar nada: arma una raiz de
// mentira en temp/_codex-unidad/ (en una carpeta "José Ñandú/Anuncios con IA", con espacios y eñes) y la borra al final.
// Las tareas reales (app/server/claude/tarea-*.md, los textos de imagen ads y de voz en off) se leen, nunca se cambian.
//
//   node app/herramientas/codex/unidad-reglas-material.mjs        sale con 0 si todo paso y con 1 si algo fallo
//
// Que prueba:
//   1. las reglas de leer y de escribir de cada forma (relativa, exacta, absoluta, ~, prohibiciones), con rutas buenas
//      y malas (.env en cualquier carpeta, .., ~, otra unidad, CON y NUL, punto final, .claude, produccion,
//      node_modules, modelos.json, img/, video/, producto.json, app/brief.json…), y las reglas fijas aunque la tarea
//      no traiga las prohibiciones;
//   2. el modo «fuera» del Codex falso: ninguna de sus rutas se guarda;
//   3. los enlaces (una junction en Windows) y la comparacion en NFC y sin mayusculas (ñ separada, unidad en minuscula);
//   4. aplicarEdiciones (0, 1 y 2 apariciones, vacio, CRLF, todas o ninguna);
//   5. rutasEnTexto con las tareas reales (imagen ads: producto.json, plan.json, angulos.json, formatos/indice.json;
//      voz en off con rutas absolutas; cambios; ficha);
//   6. armarMaterial (orden, a pedido, noSeLeen, denegados, sin cambios, de nuevo), los topes, bloquesDeMensaje,
//      resolverLecturas, el reparto de imagenes y la conversion de imagenes con ffmpeg;
//   7. hojasDelManifiesto, contextosDe, tomasTocadas y su texto, estimarTokens;
//   8. los comandos: los 4 reales (validar-manifiesto del guion y del hablado, tiempos-cancion y --lineas) y variantes
//      que no pasan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..', '..');
const RAIZ = path.resolve(APP, '..');
const WIN = process.platform === 'win32';
const SIN_MAY = WIN || process.platform === 'darwin';

const reglasMod = await import('../../server/lib/ia/reglas.js');
const mat = await import('../../server/lib/ia/material.js');
const claude = await import('../../server/lib/claude.js');
const { traducir, aplicarEdiciones, prohibidasDeAnuncio, prohibidasDeProducto, MOTIVO_VIDEO } = reglasMod;
const { prohibidasComunes, enTerminales, textoClaude } = claude;

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
  return Boolean(ok);
}
const seccion = (t) => console.log(`\n== ${t}`);
const posix = (s) => String(s).replace(/\\/g, '/');
const igualRuta = (a, b) => (SIN_MAY ? posix(a).normalize('NFC').toLowerCase() === posix(b).normalize('NFC').toLowerCase() : posix(a).normalize('NFC') === posix(b).normalize('NFC'));
const contiene = (lista, x) => lista.some((y) => igualRuta(y, x));

// ---------------------------------------------------------------- la raiz de mentira

const BASE = path.join(RAIZ, 'temp', '_codex-unidad');
const R1 = path.join(BASE, 'José Ñandú'.normalize('NFC'), 'Anuncios con IA');
const FUERA = path.join(BASE, 'fuera');
const CACHE = path.join(BASE, 'codex-cache');
const CODEX_HOME = path.join(BASE, 'codex-home');
const SLUG = 'demo-slug';
const ANUNCIO = path.join(R1, 'temp', SLUG);
const PRODUCTO = path.join(R1, 'temp', '_productos', 'p1');

// un PNG de 2x2 de verdad, un GIF de 1x1 y un JPG cualquiera (para las extensiones)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function escribir(rel, contenido, base = R1) {
  const f = path.join(base, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenido);
  return f;
}
function enlazar(destino, enlace) {
  fs.mkdirSync(path.dirname(enlace), { recursive: true });
  fs.symlinkSync(destino, enlace, WIN ? 'junction' : 'dir');
}

const MANIFIESTO = {
  estilo: 'claymation',
  idioma: 'es',
  referencias: [
    { id: 'personaje', tipo: 'personaje', prompt: 'p' },
    { id: 'objeto', tipo: 'objeto', prompt: 'o' },
    { id: 'falta', tipo: 'objeto', prompt: 'f' },
  ],
  tomas: [1, 2, 3, 7, 12].map((n) => ({ n, tipo: 'A', duracion: 4, linea: `Línea ${n}`, prompt_imagen_inicial: `img ${n}. Negative prompt: x`, prompt_video: `video ${n}`, referencias: ['personaje'] })),
  broll: [1, 2].map((n) => ({ n, despues_de_toma: n, duracion: 2, prompt_imagen: `broll ${n}`, prompt_video: `bv ${n}`, referencias: [] })),
  voz_en_off: 'Línea 1 Línea 2 Línea 3',
  overlays: [{ texto: 'Día 3', toma: 2, momento: 'inicio' }],
};

function preparar() {
  fs.rmSync(BASE, { recursive: true, force: true });
  escribir(`temp/${SLUG}/manifiesto.json`, JSON.stringify(MANIFIESTO, null, 2));
  escribir(`temp/${SLUG}/transiciones.json`, '[]\n');
  escribir(`temp/${SLUG}/app/guion.json`, '{"titulo":"x"}\n');
  escribir(`temp/${SLUG}/app/brief.json`, '{"estilo":"claymation"}\n');
  escribir(`temp/${SLUG}/app/conductor.json`, '{"estado":"listo"}\n');
  for (const n of ['contexto-toma-1.txt', 'contexto-toma-2.txt', 'contexto-toma-10.txt', 'otro.txt']) escribir(`temp/${SLUG}/app/revision/${n}`, `contexto ${n}\n`);
  escribir(`temp/${SLUG}/producto.png`, PNG);
  escribir(`temp/${SLUG}/img/personaje.png`, PNG);
  escribir(`temp/${SLUG}/img/objeto.jpg`, PNG);
  escribir(`temp/${SLUG}/img/toma-1-inicial.png`, PNG);
  escribir(`temp/${SLUG}/img/log-modelos.json`, '{}\n');
  escribir(`temp/${SLUG}/qa/toma-1.jpg`, PNG);
  escribir(`temp/${SLUG}/video/clip.mp4`, Buffer.alloc(64));
  escribir(`temp/${SLUG}/registro.log`, 'log\n');
  escribir(`temp/${SLUG}/modelos.json`, '{"imagen":"barato"}\n');
  escribir(`temp/${SLUG}/estado.json`, '{}\n');
  escribir(`temp/${SLUG}/manifiesto-crlf.json`, '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n');
  escribir('temp/otro/x.json', '{"otro":true}\n');
  escribir('temp/_productos/p1/producto.json', '{"nombre":"p1"}\n');
  escribir('temp/_productos/p1/ficha.json', '{}\n');
  escribir('temp/_productos/p1/fotos/1.png', PNG);
  escribir('.claude/skills/anuncios-demo/SKILL.md', '# Skill de prueba\n');
  escribir('.claude/skills/anuncios-demo/angulos.json', '[]\n');
  escribir('.claude/skills/anuncios-demo/formatos/indice.json', '{"formatos":[]}\n');
  escribir('.claude/skills/otra/SKILL.md', '# Otra skill\n');
  escribir('recursos/esqueletos/catalogo.json', '[]\n');
  escribir('a.json', '{}\n', FUERA);
  enlazar(FUERA, path.join(ANUNCIO, 'enlace')); // un enlace que lleva fuera de la raiz
  enlazar(path.join(R1, 'temp', 'otro'), path.join(ANUNCIO, 'app', 'atajo')); // uno que lleva a otro anuncio
}

// Las mismas reglas que arma permisosGuion (anuncios-nuevos.js:687-709) para un anuncio, con SOLO_DE_LA_APP
// (copiado de anuncios-nuevos.js:681-685) y las prohibiciones nuevas de §2.10.
const SOLO_DE_LA_APP = [
  'brief.json', 'sesion.json', 'conductor.json', 'proceso.json', 'informe.json', 'montaje.json', 'edicion.json', 'voces.json',
  'ventanas.json', 'ugc.json', 'habla.json', 'manifiesto-antes-de-ventanas.json', '*-estado.json', 'cancion-*.json', 'clips-*.json',
  'control-final-*.json', 'rehacer/**', 'exportes/**', 'gasto/**', 'registro/**', 'historial-guion/**', 'edicion/**',
  'avisos.json', 'subidos.json',
];
function reglasDeGuion(slug, { conNuevas = true, opciones = {} } = {}) {
  const c = `./temp/${slug}`;
  const permitidas = [
    'Read(./.claude/skills/anuncios-demo/**)',
    `Read(${c}/**)`,
    'Read(./temp/_productos/p1/**)',
    `Write(${c}/**)`,
    `Edit(${c}/**)`,
    'Glob',
    'Grep',
    'TodoWrite',
    ...enTerminales(`node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json`, `node produccion\\validar-manifiesto.js temp\\${slug}\\manifiesto.json`),
  ];
  const prohibidas = [...prohibidasComunes({ terminal: true }), ...SOLO_DE_LA_APP.map((f) => `Edit(${c}/app/${f})`), ...(conNuevas ? prohibidasDeAnuncio(slug) : [])];
  return traducir(permitidas, prohibidas, { raiz: R1, codexHome: CODEX_HOME, ...opciones });
}

let fallo = null;
try {
  preparar();

  // -------------------------------------------------------------- 1. leer y escribir
  seccion('1. Reglas de leer');
  const g = reglasDeGuion(SLUG);
  const leeBien = [
    `temp/${SLUG}/manifiesto.json`,
    `./temp/${SLUG}/img/personaje.png`,
    `temp\\${SLUG}\\app\\guion.json`,
    path.join(ANUNCIO, 'manifiesto.json'),
    '.claude/skills/anuncios-demo/SKILL.md',
    'temp/_productos/p1/fotos/1.png',
    `temp/${SLUG}/img`,
    `temp/${SLUG}`,
  ];
  for (const r of leeBien) {
    const x = g.puedeLeer(r);
    check(`lee ${r.replace(BASE, '<prueba>')}`, x.ok, x);
  }
  check('una carpeta se lee como carpeta', g.puedeLeer(`temp/${SLUG}/img`).tipo === 'carpeta');
  check('una imagen se lee como imagen y un .json como texto', g.puedeLeer(`temp/${SLUG}/producto.png`).tipo === 'imagen' && g.puedeLeer(`temp/${SLUG}/manifiesto.json`).tipo === 'texto');
  const otraUnidad = WIN ? `${R1[0].toUpperCase() === 'C' ? 'D' : 'C'}:/x/temp/${SLUG}/manifiesto.json` : `C:/x/temp/${SLUG}/manifiesto.json`;
  const leeMal = [
    '.env',
    `temp/${SLUG}/.env`,
    `temp/${SLUG}/.env.local`,
    `temp/${SLUG}/sub/.ENV`,
    '../.env',
    `temp/${SLUG}/../../.env`,
    '~/.claude/settings.json',
    path.join(os.homedir(), '.codex', 'auth.json'),
    path.join(os.homedir(), '.claude', 'x.md'),
    otraUnidad,
    'temp/otro/x.json',
    'produccion/validar-manifiesto.js',
    'produccion/datos.json',
    'node_modules/x/datos.json',
    'remotion/x.json',
    `temp/${SLUG}/auth.json`,
    `temp/${SLUG}/config.toml`,
    `temp/${SLUG}/credentials.json`,
    'app/config.json',
    'temp/_modo-prueba-47400/config.json',
    '.git/config',
    `temp/${SLUG}/registro.log`,
    'CON',
    `temp/${SLUG}/NUL.json`,
    `temp/${SLUG}/nombre.`,
    `temp/${SLUG}/a\u0000b.json`,
    `temp/${SLUG}/enlace/a.json`,
    `temp/${SLUG}/app/atajo/x.json`,
    `//servidor/carpeta/temp/${SLUG}/manifiesto.json`,
    '',
  ];
  for (const r of leeMal) {
    const x = g.puedeLeer(r);
    check(`no lee ${JSON.stringify(r.replace(BASE, '<prueba>'))}`, !x.ok && x.motivo, x);
  }
  const video = g.puedeLeer(`temp/${SLUG}/video/clip.mp4`);
  check('un video se rechaza con su texto', !video.ok && video.motivo === MOTIVO_VIDEO, video);
  const enSesion = traducir([`Read(./temp/${SLUG}/**)`], [], { raiz: R1, codexHome: path.join(ANUNCIO, 'sesion-ia') });
  escribir(`temp/${SLUG}/sesion-ia/x.json`, '{}\n');
  check('la carpeta de la sesión de la IA no se lee aunque la regla la cubra', !enSesion.puedeLeer(`temp/${SLUG}/sesion-ia/x.json`).ok);
  check('un Read prohibido entero no deja leer nada', !traducir([`Read(./temp/${SLUG}/**)`], ['Read'], { raiz: R1 }).puedeLeer(`temp/${SLUG}/manifiesto.json`).ok);
  check('sin un Read permitido no se lee nada', !traducir(['Glob', 'Grep'], [], { raiz: R1 }).puedeLeer(`temp/${SLUG}/manifiesto.json`).ok);
  const absoluta = traducir([`Read(//${posix(ANUNCIO)}/**)`], [], { raiz: R1 });
  check('una regla absoluta (//) vale', absoluta.puedeLeer(`temp/${SLUG}/manifiesto.json`).ok, absoluta.puedeLeer(`temp/${SLUG}/manifiesto.json`));
  // un producto «Credentials Card Holder»: su anuncio y su producto se leen; un ARCHIVO credentials*, auth.json o
  // config.toml no, en ninguna carpeta (la regla fija mira el nombre del archivo, §2.6)
  const CRED = 'credentials-x-claymation-20261109-1000';
  escribir(`temp/${CRED}/manifiesto.json`, JSON.stringify(MANIFIESTO));
  escribir(`temp/${CRED}/credentials.json`, '{}\n');
  escribir(`temp/${CRED}/app/config.toml`, 'x = 1\n');
  escribir('temp/_productos/credentials-x-ab12/fotos/foto-1.png', PNG);
  escribir('temp/x/credentials.json', '{}\n');
  escribir('temp/x/auth.json', '{}\n');
  const cred = traducir([`Read(./temp/${CRED}/**)`, 'Read(./temp/_productos/credentials-x-ab12/**)', 'Read(./temp/x/**)'], prohibidasComunes({ terminal: true }), { raiz: R1, codexHome: CODEX_HOME });
  for (const r of [`temp/${CRED}/manifiesto.json`, 'temp/_productos/credentials-x-ab12/fotos/foto-1.png', `temp/${CRED}`]) {
    const x = cred.puedeLeer(r);
    check(`lee ${r} (un producto «Credentials …»)`, x.ok, x);
  }
  for (const r of [`temp/${CRED}/credentials.json`, `temp/${CRED}/app/config.toml`, 'temp/x/credentials.json', 'temp/x/auth.json']) {
    const x = cred.puedeLeer(r);
    check(`no lee ${r}`, !x.ok && /no se lee nunca/.test(x.motivo || ''), x);
  }
  const listaCred = await mat.resolverLecturas([`temp/${CRED}`], cred, { cacheDir: CACHE });
  const nombresCred = (listaCred.carpetas[0]?.entradas || []).map((e) => e.nombre);
  check('la lista de la carpeta nombra el manifiesto y la carpeta app/, no credentials.json', nombresCred.includes('manifiesto.json') && nombresCred.includes('app') && !nombresCred.includes('credentials.json'), listaCred.carpetas);
  const listaProd = await mat.resolverLecturas(['temp/_productos'], traducir(['Read(./temp/_productos/**)'], [], { raiz: R1, codexHome: CODEX_HOME }), { cacheDir: CACHE });
  check('una carpeta «credentials-…» se nombra en la lista de su carpeta de arriba', (listaProd.carpetas[0]?.entradas || []).some((e) => e.nombre === 'credentials-x-ab12' && e.carpeta), listaProd.carpetas);

  seccion('1b. Reglas de escribir');
  const escribeBien = [
    `temp/${SLUG}/manifiesto.json`,
    `./temp/${SLUG}/app/guion.json`,
    `temp\\${SLUG}\\transiciones.json`,
    path.join(ANUNCIO, 'app', 'revision.json'),
    `temp/${SLUG}/app/nuevo/carpeta/z.md`,
    `temp/${SLUG}/datos-editor.md`,
    `temp/${SLUG}/cancion/lineas.txt`,
    `temp/${SLUG}/app/bloqueo.json`,
  ];
  for (const r of escribeBien) {
    const x = g.puedeEscribir(r);
    check(`escribe ${r.replace(BASE, '<prueba>')}`, x.ok, x);
  }
  check('la ruta absoluta pasa a relativa', g.puedeEscribir(path.join(ANUNCIO, 'app', 'revision.json')).rel === `temp/${SLUG}/app/revision.json`);
  check('existe dice si ya estaba', g.puedeEscribir(`temp/${SLUG}/manifiesto.json`).existe === true && g.puedeEscribir(`temp/${SLUG}/datos-editor.md`).existe === false);
  const escribeMal = [
    `temp/${SLUG}/modelos.json`,
    `temp/${SLUG}/estado.json`,
    `temp/${SLUG}/img/x.png`,
    `temp/${SLUG}/img/log-modelos.json`,
    `temp/${SLUG}/video/x.json`,
    `temp/${SLUG}/audio/a.json`,
    `temp/${SLUG}/musica/m.json`,
    `temp/${SLUG}/qa/q.json`,
    `temp/${SLUG}/efectos/e.json`,
    `temp/${SLUG}/app/brief.json`,
    `temp/${SLUG}/app/conductor.json`,
    `temp/${SLUG}/app/revision-estado.json`,
    `temp/${SLUG}/app/registro/x.json`,
    `temp/${SLUG}/x.js`,
    `temp/${SLUG}/x.mjs`,
    `temp/${SLUG}/x.py`,
    `temp/${SLUG}/package.json`,
    `temp/${SLUG}/.claude/x.json`,
    `temp/${SLUG}/.env`,
    `temp/${SLUG}/produccion/x.json`,
    `temp/${SLUG}/node_modules/x.json`,
    `temp/${SLUG}/remotion/x.json`,
    '../.env',
    '~/x.json',
    'temp/otro/x.json',
    'app/brief.json',
    'app/config.json',
    'x.json',
    `temp/${SLUG}/CON.json`,
    `temp/${SLUG}/aux`,
    `temp/${SLUG}/com1.txt`,
    `temp/${SLUG}/x.json.`,
    `temp/${SLUG}/carpeta /x.json`,
    `temp/${SLUG}/a:b.json`,
    `temp/${SLUG}/modelos.json::$DATA`,
    `temp/${SLUG}/MODELO~1.JSO`,
    `temp/${SLUG}/a\u0000.json`,
    `temp/${SLUG}/enlace/x.json`,
    `temp/${SLUG}/app/atajo/x.json`,
    otraUnidad,
    `temp/${SLUG}/img`,
  ];
  for (const r of escribeMal) {
    const x = g.puedeEscribir(r);
    check(`no escribe ${JSON.stringify(r)}`, !x.ok && x.motivo, x);
  }
  check('una ruta que pasa por un archivo no se escribe', !g.puedeEscribir(`temp/${SLUG}/manifiesto.json/x.json`).ok);
  if (SIN_MAY) check('ni con una ſ en vez de s, ni con una ı en vez de i (el disco las toma por la misma letra)', !g.puedeEscribir(`temp/${SLUG}/eſtado.json`).ok && !g.puedeEscribir(`temp/${SLUG}/ımg/x.json`).ok && !g.puedeEscribir(`temp/${SLUG}/efectoſ/x.json`).ok);
  if (SIN_MAY) check('MODELOS.JSON en mayúsculas tampoco',!g.puedeEscribir(`temp/${SLUG}/MODELOS.JSON`).ok && !g.puedeEscribir(`TEMP/${SLUG.toUpperCase()}/Img/x.json`).ok);
  check('el tope de 1,5 MB por archivo', !g.puedeEscribir(`temp/${SLUG}/manifiesto.json`, { bytes: 1.6 * 1024 * 1024 }).ok && g.puedeEscribir(`temp/${SLUG}/manifiesto.json`, { bytes: 1024 }).ok);

  const sinNuevas = reglasDeGuion(SLUG, { conNuevas: false });
  check('las reglas fijas valen aunque la tarea no traiga las prohibiciones nuevas', ['modelos.json', 'estado.json', 'img/log-modelos.json', 'video/x.json'].every((f) => !sinNuevas.puedeEscribir(`temp/${SLUG}/${f}`).ok));
  check('prohibidasDeAnuncio tiene la forma de las reglas de Claude', JSON.stringify(prohibidasDeAnuncio('x')) === JSON.stringify(['Edit(./temp/x/modelos.json)', 'Edit(./temp/x/estado.json)', 'Edit(./temp/x/img/**)', 'Edit(./temp/x/video/**)', 'Edit(./temp/x/audio/**)', 'Edit(./temp/x/musica/**)', 'Edit(./temp/x/qa/**)', 'Edit(./temp/x/efectos/**)']), prohibidasDeAnuncio('x'));
  check('prohibidasDeProducto tiene la forma de las reglas de Claude', JSON.stringify(prohibidasDeProducto('temp/_productos/p1')) === JSON.stringify(['Edit(./temp/_productos/p1/producto.json)']) && prohibidasDeProducto('./temp/_productos/p1')[0] === 'Edit(./temp/_productos/p1/producto.json)');
  let tiro = false;
  try {
    prohibidasDeAnuncio('../x');
  } catch {
    tiro = true;
  }
  check('prohibidasDeAnuncio no acepta un slug con barras', tiro);

  // la ficha: Write(<producto>/**), y producto.json nunca (con y sin la prohibicion nueva)
  const c = './temp/_productos/p1';
  const ficha = traducir([`Read(${c}/**)`, `Write(${c}/**)`, `Edit(${c}/**)`, 'Glob', 'Grep'], [...prohibidasComunes({ terminal: false }), ...prohibidasDeProducto('temp/_productos/p1')], { raiz: R1 });
  const fichaSin = traducir([`Read(${c}/**)`, `Write(${c}/**)`, `Edit(${c}/**)`, 'Glob', 'Grep'], prohibidasComunes({ terminal: false }), { raiz: R1 });
  check('la ficha escribe ficha.json', ficha.puedeEscribir('temp/_productos/p1/ficha.json').ok);
  check('la ficha nunca pisa producto.json (con la regla nueva y sin ella)', !ficha.puedeEscribir('temp/_productos/p1/producto.json').ok && !fichaSin.puedeEscribir('temp/_productos/p1/producto.json').ok);
  check('la ficha no corre comandos', ficha.comandos.length === 0 && ficha.describirComandos() === 'Ninguno.' && !ficha.comandoPermitido('node produccion/validar-manifiesto.js temp/x/manifiesto.json').ok);

  // un archivo exacto (las revisiones): solo ese
  const rev = traducir([`Read(./temp/${SLUG}/**)`, `Write(./temp/${SLUG}/app/revision.json)`, `Edit(./temp/${SLUG}/app/revision.json)`], prohibidasComunes({ terminal: false }), { raiz: R1 });
  check('una regla exacta deja escribir solo ese archivo', rev.puedeEscribir(`temp/${SLUG}/app/revision.json`).ok && !rev.puedeEscribir(`temp/${SLUG}/manifiesto.json`).ok && !rev.puedeEscribir(`temp/${SLUG}/app/revision2.json`).ok);
  // un lote de imagen (imagen-ads/sesiones.js:permisos): la estrategia escribe producto.json, plan.json y V01-V04
  const L = './temp/_img-demo';
  const escribeLote = ['producto.json', 'estrategia.json', 'plan.json', 'V01.json', 'app/imagen-ads/bloqueo.json'];
  const loteR = traducir([`Read(${L}/**)`, 'Read(./.claude/skills/anuncios-demo/**)', 'Glob', 'Grep', ...escribeLote.flatMap((f) => [`Write(${L}/${f})`, `Edit(${L}/${f})`])], prohibidasComunes({ terminal: false }), { raiz: R1 });
  check('un lote de imagen: escribe su producto.json, plan.json y los V##.json', escribeLote.every((f) => loteR.puedeEscribir(`temp/_img-demo/${f}`).ok), escribeLote.map((f) => loteR.puedeEscribir(`temp/_img-demo/${f}`)));
  check('un lote de imagen: nada en img/ ni un V que no le toca', !loteR.puedeEscribir('temp/_img-demo/img/V01_1x1.json').ok && !loteR.puedeEscribir('temp/_img-demo/V05.json').ok);
  check('Edit vale también para Write',traducir([`Edit(./temp/${SLUG}/app/a.json)`], [], { raiz: R1 }).puedeEscribir(`temp/${SLUG}/app/a.json`).ok);
  check('un Edit prohibido entero no deja escribir nada', !traducir([`Write(./temp/${SLUG}/**)`], ['Edit'], { raiz: R1 }).puedeEscribir(`temp/${SLUG}/manifiesto.json`).ok);

  seccion('1c. Lo que puedes escribir, en palabras');
  const desc = g.describirEscribible();
  check('el comodín de la carpeta del anuncio, con lo que es de la app', desc.includes(`cualquier archivo \`.json\`, \`.md\` o \`.txt\` dentro de \`temp/${SLUG}/\``) && desc.includes('`app/brief.json`') && desc.includes('`app/rehacer/`') && desc.includes('`modelos.json`') && desc.includes('`img/`') && desc.includes('(son de la app)'), desc);
  check('una sola línea por Write y Edit de la misma ruta', desc.split('\n').length === 1, desc);
  const descRev = rev.describirEscribible();
  check('una regla exacta, en una línea', descRev === `- \`temp/${SLUG}/app/revision.json\``, descRev);
  check('la ficha: menos producto.json', ficha.describirEscribible().includes('`producto.json`'), ficha.describirEscribible());
  check('sin nada que escribir', traducir([`Read(./temp/${SLUG}/**)`], [], { raiz: R1 }).describirEscribible().startsWith('Nada'));

  // -------------------------------------------------------------- 2. el modo «fuera»
  seccion('2. El modo «fuera» del Codex falso: nada se guarda');
  const fuera = ['../.env', 'app/config.json', 'temp/otro/x.json', `temp/${SLUG}/app/conductor.json`, `temp/${SLUG}/x.js`];
  const antesOtro = fs.readFileSync(path.join(R1, 'temp', 'otro', 'x.json'), 'utf8');
  const antesConductor = fs.readFileSync(path.join(ANUNCIO, 'app', 'conductor.json'), 'utf8');
  let guardados = 0;
  for (const r of fuera) {
    const x = g.puedeEscribir(r);
    check(`«fuera» no guarda ${r}`, !x.ok, x);
    if (x.ok) {
      fs.writeFileSync(x.abs, 'pisado');
      guardados++;
    }
  }
  check('«fuera»: no se escribió ninguno', guardados === 0 && !fs.existsSync(path.join(R1, 'app', 'config.json')) && !fs.existsSync(path.join(ANUNCIO, 'x.js')) && !fs.existsSync(path.resolve(R1, '..', '.env')));
  check('«fuera»: lo que ya estaba quedó igual', fs.readFileSync(path.join(R1, 'temp', 'otro', 'x.json'), 'utf8') === antesOtro && fs.readFileSync(path.join(ANUNCIO, 'app', 'conductor.json'), 'utf8') === antesConductor);

  // -------------------------------------------------------------- 3. enlaces, NFC y mayusculas
  seccion('3. Enlaces, ñ separada y unidad en minúscula');
  check('un enlace que sale de la raíz no deja leer', /enlace/.test(g.puedeLeer(`temp/${SLUG}/enlace/a.json`).motivo || ''), g.puedeLeer(`temp/${SLUG}/enlace/a.json`));
  check('un enlace a otro anuncio no deja escribir (las reglas se miran en la ruta real)', !g.puedeEscribir(`temp/${SLUG}/app/atajo/nuevo.json`).ok);
  const nfd = R1.normalize('NFD');
  check('la raíz de prueba tiene una ñ que cambia en NFD', nfd !== R1);
  const conCaso = WIN ? (nfd[0] === nfd[0].toUpperCase() ? nfd[0].toLowerCase() : nfd[0].toUpperCase()) + nfd.slice(1) : nfd;
  const absNFD = path.join(conCaso, 'temp', SLUG, 'app', 'guion.json');
  const wNFD = g.puedeEscribir(absNFD);
  check('una ruta absoluta con la ñ separada y la unidad cambiada se acepta', wNFD.ok && wNFD.rel === `temp/${SLUG}/app/guion.json` && wNFD.abs === path.join(R1, 'temp', SLUG, 'app', 'guion.json'), wNFD);
  check('y también se lee', g.puedeLeer(path.join(conCaso, 'temp', SLUG, 'manifiesto.json')).ok);
  const gNFD = traducir([`Read(./temp/${SLUG}/**)`, `Write(./temp/${SLUG}/**)`], [], { raiz: nfd });
  check('con la raíz escrita en NFD, las escrituras siguen pasando', gNFD.puedeEscribir(`temp/${SLUG}/manifiesto.json`).ok && gNFD.puedeEscribir(path.join(R1, 'temp', SLUG, 'manifiesto.json')).ok, gNFD.puedeEscribir(`temp/${SLUG}/manifiesto.json`));
  if (SIN_MAY) check('sin mayúsculas: TEMP/Demo-Slug/App/guion.json', g.puedeEscribir(`TEMP/Demo-Slug/App/guion.json`).ok);

  // -------------------------------------------------------------- 4. ediciones
  seccion('4. aplicarEdiciones');
  const base = 'uno\ndos\ntres\ndos y medio\n';
  let e = aplicarEdiciones(base, [{ buscar: 'tres', reemplazar: 'TRES' }]);
  check('1 aparición: se aplica', e.ok && e.texto === 'uno\ndos\nTRES\ndos y medio\n', e);
  e = aplicarEdiciones(base, [{ buscar: 'cuatro', reemplazar: 'x' }]);
  check('0 apariciones: no se aplica y dice 0 veces', !e.ok && e.veces === 0 && e.texto === base && e.indice === 0 && /aparece 0 veces/.test(e.error), e);
  e = aplicarEdiciones(base, [{ buscar: 'dos', reemplazar: 'x' }]);
  check('2 apariciones: no se aplica y dice 2 veces', !e.ok && e.veces === 2 && e.texto === base && /edición 1 busca un texto que aparece 2 veces/.test(e.error), e);
  e = aplicarEdiciones(base, [{ buscar: '', reemplazar: 'x' }]);
  check('buscar vacío: se rechaza', !e.ok && /vacío/.test(e.error) && e.texto === base, e);
  e = aplicarEdiciones(base, [{ buscar: 'uno', reemplazar: 'UNO' }, { buscar: 'cuatro', reemplazar: 'x' }]);
  check('todas o ninguna: la segunda falla y la primera no queda', !e.ok && e.indice === 1 && e.texto === base && /edición 2/.test(e.error), e);
  e = aplicarEdiciones(base, [{ buscar: 'uno', reemplazar: 'cero' }, { buscar: 'cero\ndos\n', reemplazar: 'cero\nDOS\n' }]);
  check('en orden: cada una sobre el resultado de la anterior', e.ok && e.texto === 'cero\nDOS\ntres\ndos y medio\n', e);
  const crlf = '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n';
  e = aplicarEdiciones(crlf, [{ buscar: '"a": 1,\n  "b": 2', reemplazar: '"a": 1,\n  "b": 3' }]);
  check('CRLF: buscar con \\n se prueba con \\r\\n y el reemplazo queda con \\r\\n', e.ok && e.texto === '{\r\n  "a": 1,\r\n  "b": 3\r\n}\r\n', e);
  e = aplicarEdiciones('{\r\n  "a": 1\r\n}\r\n', [{ buscar: '"a": 1', reemplazar: '"a": 1,\n  "b": 2' }]);
  check('CRLF: un reemplazo con \\n en un archivo todo CRLF queda con \\r\\n', e.ok && e.texto === '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n', e);
  e = aplicarEdiciones(base, [{ buscar: 'tres', reemplazar: '$& y $1' }]);
  check('el reemplazo va tal cual (un $& no se expande)', e.ok && e.texto.includes('$& y $1'), e);
  e = aplicarEdiciones(base, []);
  check('sin ediciones: no hay nada que aplicar', !e.ok);

  // -------------------------------------------------------------- 5. rutasEnTexto con las tareas reales
  seccion('5. rutasEnTexto con las tareas reales');
  const lotes = fs.readdirSync(path.join(RAIZ, 'temp')).filter((n) => n.startsWith('_img-') && fs.existsSync(path.join(RAIZ, 'temp', n, 'plan.json')) && fs.existsSync(path.join(RAIZ, 'temp', n, 'producto.json')));
  if (!lotes.length) console.log('(omitida: no hay ningún lote de imagen real en temp/, como en el CI)');
  else {
    const lote = lotes.sort().pop();
    const carpeta = path.join(RAIZ, 'temp', lote);
    const ses = await import('../../server/lib/imagen-ads/sesiones.js');
    const plan = JSON.parse(fs.readFileSync(path.join(carpeta, 'plan.json'), 'utf8'));
    const ids = (plan.variaciones || []).slice(0, 2).map((v) => v.id);
    const sp = ses.sesionPrompts({ carpeta, lote, brief: {}, ids });
    const rp = mat.rutasEnTexto(sp.prompt);
    check('tarea-imagen-ads-prompts.md:6 encuentra producto.json y plan.json del lote', contiene(rp, `temp/${lote}/producto.json`) && contiene(rp, `temp/${lote}/plan.json`), rp);
    check('y la SKILL.md de imagen ads', contiene(rp, '.claude/skills/anuncios-imagen-ads/SKILL.md'), rp);
    const conRef = (plan.variaciones || []).slice(0, 2).filter((v) => v.fuente === 'referencia' && v.referencia);
    if (conRef.length) check('y la referencia de cada variación que sale de una', conRef.every((v) => rp.some((r) => r.endsWith(posix(v.referencia).split('/').pop()))), rp);
    const se = ses.sesionEstrategia({ carpeta, lote, brief: { cantidad: 4, formatos: ['1:1'], datos: {}, referencias: [] } });
    const re = mat.rutasEnTexto(se.prompt);
    check('tarea-imagen-ads-estrategia.md:6 encuentra angulos.json y formatos/indice.json de la skill', contiene(re, '.claude/skills/anuncios-imagen-ads/angulos.json') && contiene(re, '.claude/skills/anuncios-imagen-ads/formatos/indice.json'), re);
    check('y la SKILL.md', contiene(re, '.claude/skills/anuncios-imagen-ads/SKILL.md'), re);
    check('ninguna ruta con <id> ni fuera de la raíz', re.every((r) => !/[<>]/.test(r) && !r.includes('..')));
  }
  const anuncios = fs.readdirSync(path.join(RAIZ, 'temp')).filter((n) => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', n, 'manifiesto.json'), 'utf8'));
      return ['claymation', 'crochet', 'zack-d-films', 'estilo-pixar', 'skeleton', 'estilo-lego'].includes(m.estilo) && fs.existsSync(path.join(RAIZ, 'temp', n, 'img'));
    } catch {
      return false;
    }
  });
  if (!anuncios.length) console.log('(omitida: no hay ningún anuncio de voz en off real en temp/, como en el CI)');
  else {
    const slug = anuncios.sort()[0];
    const carpeta = path.join(RAIZ, 'temp', slug);
    const m = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8'));
    const voz = await import('../../server/lib/familias/voz-en-off.js');
    const t = voz.textoDeRevision({ slug, carpeta }, m);
    const rv = mat.rutasEnTexto(t);
    check('voz en off: las rutas absolutas (el manifiesto y la carpeta img)', contiene(rv, `temp/${slug}/manifiesto.json`) && contiene(rv, `temp/${slug}/img`), rv);
    const tomaA = (m.tomas || []).find((x) => ['A', 'B', 'C'].includes(x.tipo) && fs.existsSync(path.join(carpeta, 'img', `toma-${x.n}-inicial.png`)));
    if (tomaA) check('voz en off: la imagen de una toma', contiene(rv, `temp/${slug}/img/toma-${tomaA.n}-inicial.png`), rv);
    check('voz en off: la skill, y nada con N ni fuera de la raíz', rv.some((r) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(r)) && rv.every((r) => !/contexto-toma-N/.test(r) && !r.includes('..')), rv);
    const cambios = textoClaude('tarea-cambios', { slug, skill: 'anuncios-claymation', pedido: 'más corto', queLeyo: 'el guion', aviso: '', pasos: `1. Vuelve a leer \`temp/${slug}/manifiesto.json\` tal como está ahora.\n2. Pon al día \`app/guion.json\`.` });
    const rc = mat.rutasEnTexto(cambios);
    check('cambios: el manifiesto y la skill', contiene(rc, `temp/${slug}/manifiesto.json`) && contiene(rc, '.claude/skills/anuncios-claymation/SKILL.md'), rc);
    if (fs.existsSync(path.join(carpeta, 'app', 'guion.json'))) check('cambios: app/guion.json suelto, contra la carpeta del anuncio', contiene(rc, `temp/${slug}/app/guion.json`), rc);
  }
  const productos = fs.existsSync(path.join(RAIZ, 'temp', '_productos')) ? fs.readdirSync(path.join(RAIZ, 'temp', '_productos')).filter((n) => fs.existsSync(path.join(RAIZ, 'temp', '_productos', n, 'producto.json'))) : [];
  if (productos.length) {
    const id = productos.sort()[0];
    const fotos = fs.existsSync(path.join(RAIZ, 'temp', '_productos', id, 'fotos')) ? fs.readdirSync(path.join(RAIZ, 'temp', '_productos', id, 'fotos')) : [];
    const rel = `temp/_productos/${id}`;
    const tf = textoClaude('tarea-ficha', { carpeta: rel, datos: '{}', fotos: fotos.map((f) => `- ${rel}/fotos/${f}`).join('\n') || '- No subió fotos.', pagina: 'no dio el link de una página.' });
    const rf = mat.rutasEnTexto(tf);
    check('ficha: producto.json y las fotos', contiene(rf, `${rel}/producto.json`) && fotos.every((f) => contiene(rf, `${rel}/fotos/${f}`)), rf);
  }

  seccion('5b. rutasEnTexto: las tres formas');
  const texto = [
    `Carpeta del anuncio: ${ANUNCIO}`,
    `1. Lee ${path.join(ANUNCIO, 'manifiesto.json')}: qué tiene cada toma.`,
    `2. Las hojas están en ${posix(path.join(ANUNCIO, 'img'))} (una por referencia).`,
    `3. Con la ñ separada: ${path.join(R1.normalize('NFD'), 'temp', SLUG, 'transiciones.json')}, y fin.`,
    '4. Lee `.claude/skills/anuncios-demo/SKILL.md` y su `angulos.json` y su `formatos/indice.json`.',
    `5. Mira ./temp/${SLUG}/producto.png, recursos/esqueletos/catalogo.json y \`app/guion.json\`; después temp/${SLUG}/app/revision/contexto-toma-N.txt y temp/${SLUG}/<id>.json.`,
    `6. No: temporal.json, ${R1}-2/temp/x.json, plan.jsonl, los recursos del anuncio, temp y recursos.`,
  ].join('\n');
  const rt = mat.rutasEnTexto(texto, { raiz: R1 });
  const esperadas = [
    `temp/${SLUG}`,
    `temp/${SLUG}/manifiesto.json`,
    `temp/${SLUG}/img`,
    `temp/${SLUG}/transiciones.json`,
    '.claude/skills/anuncios-demo/SKILL.md',
    '.claude/skills/anuncios-demo/angulos.json',
    '.claude/skills/anuncios-demo/formatos/indice.json',
    `temp/${SLUG}/producto.png`,
    'recursos/esqueletos/catalogo.json',
    `temp/${SLUG}/app/guion.json`,
  ];
  check('las tres formas, en orden y sin repetidos', JSON.stringify(rt) === JSON.stringify(esperadas), rt);
  const enJSON = mat.rutasEnTexto(JSON.stringify({ ruta: path.join(ANUNCIO, 'manifiesto.json') }), { raiz: R1 });
  check('una ruta absoluta escrita dentro de un JSON (con \\\\)', JSON.stringify(enJSON) === JSON.stringify([`temp/${SLUG}/manifiesto.json`]), enJSON);
  check('carpetaTarea y skills por parámetro',JSON.stringify(mat.rutasEnTexto('lee `app/guion.json` y `angulos.json`', { raiz: R1, carpetaTarea: `temp/${SLUG}`, skills: ['anuncios-demo'] })) === JSON.stringify([`temp/${SLUG}/app/guion.json`, '.claude/skills/anuncios-demo/angulos.json']));

  // -------------------------------------------------------------- 6. armarMaterial
  seccion('6. armarMaterial');
  const prompt = [
    `Carpeta del anuncio: temp/${SLUG}`,
    'Lee `.claude/skills/anuncios-demo/SKILL.md` y su `angulos.json`.',
    `Mira temp/${SLUG}/producto.png y lee \`manifiesto.json\`. Las hojas están en temp/${SLUG}/img.`,
    'Ahora no sigas `.claude/skills/otra/SKILL.md`. No mires temp/otro/x.json.',
  ].join('\n');
  const o = {
    prompt,
    material: {
      textos: [`temp/${SLUG}/app/guion.json`],
      imagenes: [`temp/${SLUG}/img/toma-1-inicial.png`, `temp/${SLUG}/producto.png`],
      aPedido: ['.claude/skills/anuncios-demo/formatos/indice.json'],
      noSeLeen: ['.claude/skills/otra/SKILL.md'],
    },
  };
  let mt = await mat.armarMaterial(o, g, { cacheDir: CACHE });
  const rels = (l) => l.map((x) => (typeof x === 'string' ? x : x.rel));
  check('textos: primero o.material, después lo que nombra la tarea', JSON.stringify(rels(mt.textos)) === JSON.stringify([`temp/${SLUG}/app/guion.json`, '.claude/skills/anuncios-demo/SKILL.md', '.claude/skills/anuncios-demo/angulos.json', `temp/${SLUG}/manifiesto.json`]), rels(mt.textos));
  check('imágenes: las del texto y después las de o.material, sin repetir', JSON.stringify(rels(mt.imagenes)) === JSON.stringify([`temp/${SLUG}/producto.png`, `temp/${SLUG}/img/toma-1-inicial.png`]), rels(mt.imagenes));
  check('carpetas: la del anuncio y img, como lista', JSON.stringify(rels(mt.carpetas)) === JSON.stringify([`temp/${SLUG}`, `temp/${SLUG}/img`]) && mt.carpetas[1].entradas.some((x) => x.nombre === 'personaje.png'), rels(mt.carpetas));
  check('a pedido: lo de o.material.aPedido', JSON.stringify(mt.aPedido) === JSON.stringify(['.claude/skills/anuncios-demo/formatos/indice.json']), mt.aPedido);
  check('la que la tarea nombra y no deja leer va a nombradasSinPermiso, no a denegados', contiene(mt.nombradasSinPermiso, 'temp/otro/x.json') && mt.denegados.length === 0, mt);
  check('noSeLeen: ni se manda ni se anota', !contiene(rels(mt.textos), '.claude/skills/otra/SKILL.md') && !contiene(mt.nombradasSinPermiso, '.claude/skills/otra/SKILL.md'));
  check('cada texto con su sha1 y su contenido', mt.textos.every((x) => /^[0-9a-f]{40}$/.test(x.sha1) && typeof x.contenido === 'string' && x.bytes > 0));
  check('sin error de tamaño', !mt.error && mt.caracteres > 0);

  const bloques = mat.bloquesDeMensaje(mt);
  check('encabezados de ARCHIVO y FIN exactos', bloques.includes(`===== ARCHIVO: temp/${SLUG}/manifiesto.json (`) && /===== ARCHIVO: temp\/demo-slug\/manifiesto\.json \(\d+ KB\) =====\n/.test(bloques) && bloques.includes(`\n===== FIN: temp/${SLUG}/manifiesto.json =====`), bloques.slice(0, 600));
  check('la carpeta como lista', bloques.includes(`===== CARPETA: temp/${SLUG}/img (`) && /\n- personaje\.png \(\d+ KB\)\n/.test(bloques) && bloques.includes(`===== FIN: temp/${SLUG}/img =====`), bloques);
  check('IMÁGENES ADJUNTAS con Image #N = ruta', bloques.includes('## IMÁGENES ADJUNTAS (en este orden)\n') && bloques.includes(`Image #1 = temp/${SLUG}/producto.png\nImage #2 = temp/${SLUG}/img/toma-1-inicial.png`), bloques);
  check('DISPONIBLES con su tamaño', bloques.includes('## DISPONIBLES SI LOS PIDES EN `leer`\n- .claude/skills/anuncios-demo/formatos/indice.json (1 KB)'), bloques);
  check('el orden: MATERIAL, IMÁGENES, DISPONIBLES', bloques.indexOf('## MATERIAL') === 0 && bloques.indexOf('## MATERIAL') < bloques.indexOf('## IMÁGENES') && bloques.indexOf('## IMÁGENES') < bloques.indexOf('## DISPONIBLES'));

  mt = await mat.armarMaterial({ ...o, material: { ...o.material, skillsAPedido: true } }, g, { cacheDir: CACHE });
  check('skillsAPedido: las skills que nombra la tarea pasan a la lista', contiene(mt.aPedido, '.claude/skills/anuncios-demo/SKILL.md') && contiene(mt.aPedido, '.claude/skills/anuncios-demo/angulos.json') && !mt.textos.some((x) => x.rel.startsWith('.claude/')), mt.aPedido);

  const man = mt.textos.find((x) => x.rel.endsWith('manifiesto.json'));
  mt = await mat.armarMaterial(o, g, { cacheDir: CACHE, enviados: { [man.rel]: man.sha1 } });
  check('enviados: lo que no cambió va como una línea', contiene(mt.sinCambios, `temp/${SLUG}/manifiesto.json`) && !mt.textos.some((x) => x.rel.endsWith('manifiesto.json')) && mat.bloquesDeMensaje(mt).includes(`(sin cambios desde la última vez: temp/${SLUG}/manifiesto.json)`), mt.sinCambios);
  mt = await mat.armarMaterial(o, g, { cacheDir: CACHE, enviados: { [man.rel]: man.sha1 }, deNuevo: true, escritos: [`temp/${SLUG}/transiciones.json`, `temp/${SLUG}/no-existe.json`] });
  check('deNuevo: se manda todo otra vez, más lo que ya había escrito', mt.sinCambios.length === 0 && mt.textos.some((x) => x.rel.endsWith('manifiesto.json')) && contiene(rels(mt.textos), `temp/${SLUG}/transiciones.json`), rels(mt.textos));

  mt = await mat.armarMaterial({ prompt: 'nada', material: { textos: ['temp/otro/x.json', '../.env', `temp/${SLUG}/video/clip.mp4`, `temp/${SLUG}/no-existe.json`] } }, g, { cacheDir: CACHE });
  check('lo que pone o.material y no se puede leer va a denegados', mt.denegados.length === 3 && mt.denegados.every((d) => d.tipo === 'leer' && d.motivo) && contiene(mt.faltan, `temp/${SLUG}/no-existe.json`), mt);

  seccion('6b. Los topes');
  check('los topes exportados', mat.TOPE_MENSAJE === 900000 && mat.TOPE_ARCHIVO === 400000 && mat.TOPE_IMAGENES === 48);
  const t350 = 'x'.repeat(350000);
  escribir(`temp/${SLUG}/g1.txt`, t350);
  escribir(`temp/${SLUG}/g4.txt`, t350);
  escribir(`temp/${SLUG}/g5.txt`, t350);
  escribir('.claude/skills/anuncios-demo/g2.md', t350);
  escribir('.claude/skills/anuncios-demo/g3.md', t350);
  escribir(`temp/${SLUG}/enorme.txt`, 'y'.repeat(450000));
  mt = await mat.armarMaterial({ prompt: 'p', material: { textos: [`temp/${SLUG}/g1.txt`, '.claude/skills/anuncios-demo/g2.md', '.claude/skills/anuncios-demo/g3.md'] } }, g, { cacheDir: CACHE });
  check('si no entra, primero las skills pasan a «a pedido»', !mt.error && rels(mt.textos).length === 1 && contiene(mt.aPedido, '.claude/skills/anuncios-demo/g2.md') && contiene(mt.aPedido, '.claude/skills/anuncios-demo/g3.md'), { error: mt.error, textos: rels(mt.textos), aPedido: mt.aPedido });
  mt = await mat.armarMaterial({ prompt: 'p', material: { textos: [`temp/${SLUG}/g1.txt`, `temp/${SLUG}/g4.txt`, `temp/${SLUG}/g5.txt`] } }, g, { cacheDir: CACHE });
  check('si igual no entra: el error de §2.6 con los tamaños', mt.error === 'Lo que hay que leer para esta tarea no entra de una vez.' && /900\.000/.test(mt.detalle) && /g1\.txt/.test(mt.detalle), { error: mt.error, detalle: mt.detalle });
  mt = await mat.armarMaterial({ prompt: `lee temp/${SLUG}/enorme.txt`, material: { textos: [`temp/${SLUG}/enorme.txt`] } }, g, { cacheDir: CACHE });
  check('un archivo de más de 400.000 caracteres no se pega', mt.textos.length === 0 && mt.denegados.length === 1 && /grande/.test(mt.denegados[0].motivo), mt.denegados);
  const muchas = Array.from({ length: 50 }, (_, i) => ({ rel: `i${i}.png` }));
  const tandas = mat.repartirImagenes(muchas);
  check('repartirImagenes: 50 en 48 + 2; 48 en una; 0 en ninguna', tandas.length === 2 && tandas[0].length === 48 && tandas[1].length === 2 && mat.repartirImagenes(muchas.slice(0, 48)).length === 1 && mat.repartirImagenes([]).length === 0);
  check('la segunda tanda numera desde 49 si se pide', mat.bloquesDeMensaje({ textos: [], imagenes: tandas[1] }, { desde: 49 }).includes('Image #49 = i48.png'));
  check('la línea de las imágenes que faltan', mat.lineaFaltanImagenes(5) === 'Faltan 5 imágenes: llegan en el próximo mensaje. Ahora responde solo con `estado` "SEGUIR", sin archivos.');

  seccion('6c. resolverLecturas');
  const rl = await mat.resolverLecturas(['.claude/skills/anuncios-demo/formatos/indice.json', '../.env', `temp/${SLUG}/video/clip.mp4`, `temp/${SLUG}/no-existe.json`, `temp/${SLUG}/img/personaje.png`, 'temp/otro/x.json', 42], g, { cacheDir: CACHE });
  check('manda lo que puede (texto e imagen)', JSON.stringify(rels(rl.textos)) === JSON.stringify(['.claude/skills/anuncios-demo/formatos/indice.json']) && JSON.stringify(rels(rl.imagenes)) === JSON.stringify([`temp/${SLUG}/img/personaje.png`]), rl);
  const motivoDe = (r) => rl.denegados.find((d) => d.ruta === r)?.motivo || '';
  check('niega ../.env, otro anuncio y lo que no es una ruta', rl.denegados.length === 5 && motivoDe('temp/otro/x.json') && rl.denegados.some((d) => d.ruta === '42'), rl.denegados);
  check('un video, con el texto de §2.6', motivoDe(`temp/${SLUG}/video/clip.mp4`) === 'No te puedo mandar videos: mira los cuadros que ya están en `qa/`', rl.denegados);
  check('lo que no existe, con su motivo', motivoDe(`temp/${SLUG}/no-existe.json`) === 'ese archivo no existe', rl.denegados);
  const rl2 = await mat.resolverLecturas([`temp/${SLUG}/g1.txt`, `temp/${SLUG}/g4.txt`, `temp/${SLUG}/g5.txt`], g, { cacheDir: CACHE });
  check('lo que no entra en un mensaje se pide en el próximo', rl2.textos.length === 2 && rl2.denegados.length === 1 && /próximo/.test(rl2.denegados[0].motivo), rl2.denegados);
  check('MATERIAL NUEVO para lo que pidió', mat.bloquesDeMensaje(rl, { titulo: 'MATERIAL NUEVO' }).startsWith('## MATERIAL NUEVO\n\n===== ARCHIVO: .claude/skills/anuncios-demo/formatos/indice.json'));

  seccion('6d. Imágenes convertidas');
  escribir(`temp/${SLUG}/img/animada.gif`, GIF);
  escribir(`temp/${SLUG}/img/toma-grande.png`, Buffer.concat([PNG, Buffer.alloc(10.5 * 1024 * 1024)]));
  escribir(`temp/${SLUG}/revision/V01_1x1_r1.png`, Buffer.concat([PNG, Buffer.alloc(10.5 * 1024 * 1024)]));
  const chica = await mat.convertirImagenSiHaceFalta(path.join(ANUNCIO, 'producto.png'), CACHE);
  check('una imagen chica no se toca', !chica.convertida && chica.abs === path.join(ANUNCIO, 'producto.png'));
  const recorte = await mat.convertirImagenSiHaceFalta(path.join(ANUNCIO, 'revision', 'V01_1x1_r1.png'), CACHE);
  check('un recorte _r1 nunca se convierte, aunque pese', !recorte.convertida);
  const { buscarPrograma } = await import('../../server/lib/programas.js');
  if (buscarPrograma('ffmpeg')) {
    const gif = await mat.convertirImagenSiHaceFalta(path.join(ANUNCIO, 'img', 'animada.gif'), CACHE);
    check('un .gif pasa a JPEG en <cache>/<sha1>/animada.jpg', gif.convertida && /[\\/][0-9a-f]{40}[\\/]animada\.jpg$/.test(gif.abs) && fs.existsSync(gif.abs), gif);
    const grande = await mat.convertirImagenSiHaceFalta(path.join(ANUNCIO, 'img', 'toma-grande.png'), CACHE);
    check('una de más de 10 MB pasa a JPEG con su nombre original', grande.convertida && path.basename(grande.abs) === 'toma-grande.jpg' && fs.statSync(grande.abs).size < 1024 * 1024, grande);
    const otraVez = await mat.convertirImagenSiHaceFalta(path.join(ANUNCIO, 'img', 'toma-grande.png'), CACHE);
    check('la segunda vez sale de la caché', otraVez.convertida && otraVez.abs === grande.abs);
    const conImg = await mat.armarMaterial({ prompt: `mira temp/${SLUG}/img/toma-grande.png`, material: {} }, g, { cacheDir: CACHE });
    check('en el material: -i con la copia, y la lista con la ruta original', conImg.imagenes[0]?.convertida && conImg.imagenes[0].abs === grande.abs && mat.bloquesDeMensaje(conImg).includes(`Image #1 = temp/${SLUG}/img/toma-grande.png`), conImg.imagenes);
  } else {
    check('ffmpeg en esta PC (para probar la conversión)', false, 'no está ffmpeg: no se pudo probar la conversión');
  }

  // -------------------------------------------------------------- 7. ayudas
  seccion('7. hojasDelManifiesto, contextosDe, tomasTocadas, estimarTokens');
  const hojas = mat.hojasDelManifiesto(ANUNCIO, MANIFIESTO, { raiz: R1 });
  check('hojasDelManifiesto: las que existen, png o jpg', JSON.stringify(hojas) === JSON.stringify([`temp/${SLUG}/img/personaje.png`, `temp/${SLUG}/img/objeto.jpg`]), hojas);
  check('hojasDelManifiesto con la carpeta relativa', JSON.stringify(mat.hojasDelManifiesto(`temp/${SLUG}`, MANIFIESTO, { raiz: R1 })) === JSON.stringify(hojas));
  const ctxs = mat.contextosDe(path.join(ANUNCIO, 'app', 'revision'), 'contexto-toma-*.txt', { raiz: R1 });
  check('contextosDe: en orden natural, solo los que calzan', JSON.stringify(ctxs) === JSON.stringify([1, 2, 10].map((n) => `temp/${SLUG}/app/revision/contexto-toma-${n}.txt`)), ctxs);
  check('contextosDe sin carpeta: vacío', mat.contextosDe(path.join(ANUNCIO, 'no-hay'), 'contexto-*.txt', { raiz: R1 }).length === 0);

  const antes = JSON.parse(JSON.stringify(MANIFIESTO));
  const ahora = JSON.parse(JSON.stringify(MANIFIESTO));
  ahora.tomas.find((t) => t.n === 3).linea = 'Otra línea';
  ahora.tomas.find((t) => t.n === 7).prompt_imagen_inicial = 'img 7 sin el negative prompt';
  ahora.tomas.find((t) => t.n === 12).referencias = ['personaje', 'objeto'];
  ahora.broll.find((b) => b.n === 2).prompt_video = 'otro';
  ahora.voz_en_off = 'otra voz';
  let k = mat.tomasTocadas(antes, ahora);
  check('tomasTocadas: tomas 3, 7 y 12, el B-roll 2 y voz_en_off', JSON.stringify(k.tomas) === '[3,7,12]' && JSON.stringify(k.broll) === '[2]' && JSON.stringify(k.otros) === '["voz_en_off"]' && k.hayCambios, k);
  check('tomasTocadas: guarda lo de antes', k.antes.tomas[3].linea === 'Línea 3' && k.antes.broll[2].prompt_video === 'bv 2' && k.antes.otros.voz_en_off === antes.voz_en_off);
  check('tomasTocadas: igual = nada', !mat.tomasTocadas(antes, JSON.stringify(antes, null, 4)).hayCambios);
  const sinToma = JSON.parse(JSON.stringify(antes));
  sinToma.tomas = sinToma.tomas.filter((t) => t.n !== 2);
  check('tomasTocadas: una toma quitada también cuenta', JSON.stringify(mat.tomasTocadas(antes, sinToma).tomas) === '[2]');
  const txt = mat.textoTomasTocadas(k, { pedido: 'cambia la toma 3', delUsuario: true });
  check('el mensaje de §3.3', txt.startsWith('Cambiaste las tomas 3, 7 y 12 (y el B-roll 2 y `voz_en_off`). El usuario pidió: «cambia la toma 3». Si alguna de esas no la pidió, déjala exactamente como estaba (te la copio abajo) con `ediciones`. Si todas eran parte del pedido, responde LISTO.') && txt.includes('El guion es del usuario: fuera de lo que pidió, no cambia ni una palabra de `linea`.') && txt.includes('===== ANTES: toma 3 =====') && txt.includes('"linea": "Línea 3"'), txt);
  check('sin cambios no hay mensaje', mat.textoTomasTocadas(mat.tomasTocadas(antes, antes)) === null);
  const pet = { letra: '[Verse 1]\nuno\ndos\ntres\n[Chorus]\ncoro', estilos: ['pop'], titulo: 't' };
  k = mat.tomasTocadas(pet, { ...pet, letra: '[Verse 1]\nuno\nDOS\ntres\n[Chorus]\ncoro' });
  check('peticion.json: la línea 3 de la letra', k.lineas.length === 1 && k.lineas[0].n === 3 && k.lineas[0].antes === 'dos' && k.lineas[0].ahora === 'DOS' && k.otros.length === 0, k);
  check('y su mensaje', /^Cambiaste la línea 3 de la letra\./.test(mat.textoTomasTocadas(k, { pedido: 'x' })));
  const letras = { titulo: 't', idioma: 'es', visual: 'crochet', opciones: [{ n: 1, titulo: 'a', letra: 'l1\nl2', estiloSuno: 'pop' }, { n: 2, titulo: 'b', letra: 'm1\nm2\nm3', estiloSuno: 'rock' }] };
  const letras2 = JSON.parse(JSON.stringify(letras));
  letras2.opciones[1].letra = 'm1\nm2 cambiada\nm3';
  letras2.cambios_hechos = ['Opción 2: la segunda línea'];
  k = mat.tomasTocadas(letras, letras2);
  check('letras.json: la línea 2 de la opción 2, sin contar cambios_hechos', k.lineas.length === 1 && k.lineas[0].donde === 'opción 2' && k.lineas[0].n === 2 && k.otros.length === 0, k);
  check('estimarTokens = caracteres / 3,5 + 1.300 por imagen', mat.estimarTokens('x'.repeat(35), 2) === 10 + 2600 && mat.estimarTokens(7) === 2);

  // -------------------------------------------------------------- 8. comandos (con la raiz de verdad: produccion/ existe)
  seccion('8. Comandos');
  const s = 'mi-anuncio-1';
  const validar = enTerminales(`node produccion/validar-manifiesto.js temp/${s}/manifiesto.json`, `node produccion\\validar-manifiesto.js temp\\${s}\\manifiesto.json`);
  const tiempos = enTerminales(`node produccion/tiempos-cancion.js temp/${s}`, `node produccion\\tiempos-cancion.js temp\\${s}`);
  const lineas = enTerminales(`node produccion/tiempos-cancion.js temp/${s} --lineas`, `node produccion\\tiempos-cancion.js temp\\${s} --lineas`);
  const guion = traducir([`Read(./temp/${s}/**)`, ...validar], prohibidasComunes({ terminal: true }));
  const hablado = traducir([`Read(./temp/${s}/**)`, ...validar], prohibidasComunes({ terminal: true }));
  const musical = traducir([`Read(./temp/${s}/**)`, ...validar, ...tiempos, ...lineas], prohibidasComunes().filter((x) => !/tiempos-cancion/.test(x)));
  check('guion: un solo comando (las formas con / y con \\ son el mismo)', JSON.stringify(guion.comandos) === JSON.stringify([`node produccion/validar-manifiesto.js temp/${s}/manifiesto.json`]), guion.comandos);
  check('hablado: el mismo validar', JSON.stringify(hablado.comandos) === JSON.stringify(guion.comandos));
  check('historia musical: validar, tiempos-cancion y --lineas', JSON.stringify(musical.comandos) === JSON.stringify([`node produccion/validar-manifiesto.js temp/${s}/manifiesto.json`, `node produccion/tiempos-cancion.js temp/${s}`, `node produccion/tiempos-cancion.js temp/${s} --lineas`]), musical.comandos);
  const reales = [
    [guion, `node produccion/validar-manifiesto.js temp/${s}/manifiesto.json`, 'validar-manifiesto.js', [`temp/${s}/manifiesto.json`]],
    [hablado, `node produccion\\validar-manifiesto.js temp\\${s}\\manifiesto.json`, 'validar-manifiesto.js', [`temp/${s}/manifiesto.json`]],
    [musical, `node  produccion/tiempos-cancion.js   temp/${s}`, 'tiempos-cancion.js', [`temp/${s}`]],
    [musical, `node produccion/tiempos-cancion.js temp/${s} --lineas`, 'tiempos-cancion.js', [`temp/${s}`, '--lineas']],
  ];
  for (const [r, cmd, script, args] of reales) {
    const x = r.comandoPermitido(cmd);
    check(`corre «${cmd}»`, x.ok && x.script === script && JSON.stringify(x.args) === JSON.stringify(args), x);
  }
  const noPasan = [
    [guion, `node produccion/validar-manifiesto.js temp/${s}/manifiesto.json --otra`],
    [guion, `node produccion/validar-manifiesto.js temp/otro/manifiesto.json`],
    [guion, `node produccion/validar-manifiesto.js temp/${s}/manifiesto.json && del x`],
    [guion, `node produccion/validar-manifiesto.js temp/${s}/manifiesto.json; type .env`],
    [guion, `node -e "require('fs')" produccion/validar-manifiesto.js`],
    [guion, 'npm run validar'],
    [guion, `node produccion/generar-imagenes.js temp/${s}`],
    [guion, `node produccion/tiempos-cancion.js temp/${s}`],
    [guion, `cd temp && node produccion/validar-manifiesto.js temp/${s}/manifiesto.json`],
    [guion, `NODE produccion/validar-manifiesto.js temp/${s}/manifiesto.json`],
    [guion, ''],
    [musical, `node produccion/tiempos-cancion.js temp/${s} --lineas --otra`],
  ];
  for (const [r, cmd] of noPasan) {
    const x = r.comandoPermitido(cmd);
    check(`no corre ${JSON.stringify(cmd)}`, !x.ok && x.motivo, x);
  }
  check('con el motivo de §2.11', guion.comandoPermitido('npm run validar').motivo === 'tu tarea no tiene ese comando');
  const tapada = traducir([...tiempos], prohibidasComunes({ terminal: true }));
  check('tiempos-cancion permitido pero prohibido por prohibidasComunes: no corre', tapada.comandos.length === 0 && !tapada.comandoPermitido(`node produccion/tiempos-cancion.js temp/${s}`).ok);
  const sinTerminal = traducir([...validar], prohibidasComunes({ terminal: false }));
  check('con Bash y PowerShell prohibidos enteros: ninguno', sinTerminal.comandos.length === 0 && sinTerminal.describirComandos() === 'Ninguno.');
  const inventado = traducir(enTerminales('node produccion/no-existe-este.js temp/x'), []);
  check('un script que no existe en produccion/: no corre', !inventado.comandoPermitido('node produccion/no-existe-este.js temp/x').ok && inventado.comandos.length === 0);
  check('describirComandos: los exactos, uno por línea', musical.describirComandos() === musical.comandos.map((x) => `- \`${x}\``).join('\n'), musical.describirComandos());
} catch (e) {
  fallo = e;
  check('la prueba terminó sin tirar un error', false, e?.stack || String(e));
} finally {
  fs.rmSync(BASE, { recursive: true, force: true });
  check('temp/_codex-unidad quedó borrada', !fs.existsSync(BASE));
}

const mal = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - mal.length} de ${resultados.length} bien${mal.length ? `; fallaron ${mal.length}:\n${mal.map((r) => `  - ${r.nombre}`).join('\n')}` : '.'}`);
process.exit(mal.length || fallo ? 1 : 0);
