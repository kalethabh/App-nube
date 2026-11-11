// Prueba de unidad SIN RED del selector de la IA (lib/motor-ia.js) y de la fila compartida (lib/ia/fila.js). No llama
// a ninguna IA de verdad: el Claude es uno de mentira que esta prueba escribe (contesta --version, auth status y una
// sesion que termina bien), y los ajustes son los de una app de prueba (temp/_modo-prueba-<puerto>/config.json, con
// ANUNCIOS_MODO_PRUEBA=1 y un PUERTO 474xx libre), nunca app/config.json. Al final borra lo suyo.
//
//   node app/herramientas/codex/unidad-motor-ia.mjs        sale con 0 si todo paso y con 1 si algo fallo
//
// Que prueba:
//   1. la fila: el orden de siempre sin tope, el tope por sesion, cancelar mientras espera, el registro de activas,
//      cancelarSesion y la cuenta de las sesiones de lotes;
//   2. claude.js vuelve a exportar la fila con los mismos nombres, y todo lo que hoy se importa de claude.js existe;
//   3. motor-ia: MOTORES, datosIA, nombreIA, motorElegido (AIA_MOTOR y config.json, nunca deducido);
//   4. migrarMotor con y sin bienvenidaVista, y que es idempotente; cerrar la bienvenida sin IA elegida no la marca
//      (PUT /api/ajustes/bienvenida), así el próximo arranque no le pone Claude a un alumno nuevo;
//   5. elegirMotor: 400, el 409 con una sesion registrada en la fila y con un lote ocupado, guardar y avisar;
//   6. lanzarSesion sin IA elegida, con Claude (el de mentira) y con Codex si codex.js todavia no esta;
//   7. estadoIA: solo la cuenta de la elegida (las dos con todos), instalando (alPreguntarInstalacion) y trabajando;
//      y que la cabecera de Nuevo anuncio no pega la versión del programa al nombre de la IA.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..', '..');
const RAIZ = path.resolve(APP, '..');
const TEMP = path.join(RAIZ, 'temp');
const LIB = path.join(APP, 'server', 'lib');

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
  return Boolean(ok);
}
const seccion = (t) => console.log(`\n== ${t}`);
const tic = () => new Promise((r) => setImmediate(r));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- un puerto y unas carpetas propias

const puertoLibre = (p) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)));
  });

async function elegirPuerto() {
  const probados = new Set();
  while (probados.size < 100) {
    const p = 47400 + crypto.randomInt(100);
    if (probados.has(p)) continue;
    probados.add(p);
    if (fs.existsSync(path.join(TEMP, `_modo-prueba-${p}`)) || fs.existsSync(path.join(TEMP, `_codex-unidad-${p}`))) continue;
    if (await puertoLibre(p)) return p;
  }
  return null;
}

const PUERTO = await elegirPuerto();
if (!PUERTO) {
  console.error('No encontré un puerto libre entre 47400 y 47499.');
  process.exit(1);
}
const DIR_PRUEBA = path.join(TEMP, `_modo-prueba-${PUERTO}`); // los ajustes de esta app de prueba (rutas.js)
const DIR_MIO = path.join(TEMP, `_codex-unidad-${PUERTO}`); // el Claude de mentira
const CLAUDE_MINI = path.join(DIR_MIO, 'claude-mini.mjs');

// Todo antes de cargar la app: modo prueba, el puerto, el Claude de mentira y sin IA forzada.
process.env.ANUNCIOS_MODO_PRUEBA = '1';
process.env.PUERTO = String(PUERTO);
process.env.ANUNCIOS_NO_RETOMAR = '1';
process.env.ANUNCIOS_CLAUDE_BIN = CLAUDE_MINI;
delete process.env.AIA_MOTOR;

const rutas = await import(pathToFileURL(path.join(LIB, 'rutas.js')).href);
if (rutas.CONFIG === rutas.CONFIG_PRINCIPAL || path.dirname(rutas.CONFIG) !== DIR_PRUEBA) {
  console.error(`La prueba no usaría su propio config (${rutas.CONFIG}): no sigo.`);
  process.exit(1);
}
// De app/config.json solo se mira si cambio (fecha y tamaño), nunca lo que dice.
const marcaPrincipal = () => {
  try {
    const st = fs.statSync(rutas.CONFIG_PRINCIPAL);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return 'no-existe';
  }
};
const principalAntes = marcaPrincipal();

fs.mkdirSync(DIR_PRUEBA, { recursive: true });
fs.mkdirSync(DIR_MIO, { recursive: true });
// el config de prueba existe desde el principio: asi leerConfig() nunca cae en app/config.json
const ponerConfig = (c) => fs.writeFileSync(rutas.CONFIG, JSON.stringify(c, null, 2) + '\n');
const leerConfigPrueba = () => JSON.parse(fs.readFileSync(rutas.CONFIG, 'utf8'));
ponerConfig({});
fs.writeFileSync(
  CLAUDE_MINI,
  [
    '// Claude de mentira de unidad-motor-ia.mjs: --version, auth status y una sesion -p que termina bien enseguida.',
    'const args = process.argv.slice(2);',
    "if (args[0] === '--version') { console.log('2.1.288 (Claude Code)'); process.exit(0); }",
    "if (args[0] === 'auth' && args[1] === 'status') { console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'prueba@ejemplo.invalid', subscriptionType: 'max' })); process.exit(0); }",
    "let buf = '';",
    "process.stdin.on('data', (d) => {",
    '  buf += d;',
    "  if (!buf.includes('\\n')) return;",
    "  const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');",
    "  out({ type: 'system', subtype: 'init', model: 'falso', tools: [], permissionMode: 'dontAsk', apiKeySource: 'none', claude_code_version: '2.1.288', mcp_servers: [] });",
    "  out({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 1, total_cost_usd: 0 });",
    '  setTimeout(() => process.exit(0), 50);',
    '});',
    '',
  ].join('\n')
);

const sinAtrapar = [];
process.on('unhandledRejection', (e) => sinAtrapar.push(String(e?.message || e)));

let codigo = 1;
try {
  await probar();
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - fallas}/${resultados.length} OK`);
  codigo = fallas ? 1 : 0;
} catch (e) {
  console.error(`\nLa prueba se cortó: ${e?.stack || e}`);
} finally {
  fs.rmSync(DIR_PRUEBA, { recursive: true, force: true });
  fs.rmSync(DIR_MIO, { recursive: true, force: true });
}
process.exit(codigo);

async function probar() {
  const fila = await import(pathToFileURL(path.join(LIB, 'ia', 'fila.js')).href);
  const claude = await import(pathToFileURL(path.join(LIB, 'claude.js')).href);
  const ia = await import(pathToFileURL(path.join(LIB, 'motor-ia.js')).href);

  // ------------------------------------------------------------ 1. la fila
  seccion('1. La fila compartida (lib/ia/fila.js)');
  check('MAX_SESIONES = 2 y MAX_SESIONES_CODEX entre 1 y 2', fila.MAX_SESIONES === 2 && fila.MAX_SESIONES_CODEX >= 1 && fila.MAX_SESIONES_CODEX <= fila.MAX_SESIONES, [fila.MAX_SESIONES, fila.MAX_SESIONES_CODEX]);
  check('Empieza vacía', igual(fila.sesionesEnCurso(), { trabajando: 0, esperando: 0, maximo: 2, deLotes: 0, maximoDeLotes: 0 }) && fila.enCurso === 0, fila.sesionesEnCurso());

  {
    const c = [0, 1, 2, 3].map(() => new AbortController());
    const a = await fila.turno(c[0].signal);
    const b = await fila.turno(c[1].signal);
    check('Sin tope entran 2 enseguida', a === true && b === true && fila.enCurso === 2 && claude.sesionesEnCurso().trabajando === 2);
    check('Con 2 trabajando, la tercera tendría que esperar', fila.tieneQueEsperar() === true);
    const orden = [];
    fila.turno(c[2].signal).then((v) => orden.push(['tercera', v]));
    fila.turno(c[3].signal).then((v) => orden.push(['cuarta', v]));
    await tic();
    check('La tercera y la cuarta esperan', orden.length === 0 && fila.sesionesEnCurso().esperando === 2, fila.sesionesEnCurso());
    fila.soltarTurno();
    await tic();
    check('El lugar que se libera pasa a la primera de la cola (sigue en 2)', igual(orden, [['tercera', true]]) && fila.enCurso === 2 && fila.sesionesEnCurso().esperando === 1, { orden, s: fila.sesionesEnCurso() });
    c[3].abort();
    await tic();
    check('Cancelar mientras espera: sale con false y deja la cola', igual(orden[1], ['cuarta', false]) && fila.sesionesEnCurso().esperando === 0, { orden, s: fila.sesionesEnCurso() });
    fila.soltarTurno();
    fila.soltarTurno();
    check('Al soltar las dos queda en 0', fila.enCurso === 0);
    fila.soltarTurno();
    check('Soltar de más no baja de 0', fila.enCurso === 0);
  }

  {
    const c = [0, 1, 2, 3, 4].map(() => new AbortController());
    await fila.turno(c[0].signal);
    check('Con 1 trabajando: tope 1 esperaría, sin tope no', fila.tieneQueEsperar({ tope: 1 }) === true && fila.tieneQueEsperar() === false);
    const orden = [];
    fila.turno(c[1].signal, { tope: 1 }).then((v) => orden.push(['tope1', v]));
    await tic();
    check('Una con tope 1 espera si ya hay 1 trabajando', orden.length === 0 && fila.sesionesEnCurso().esperando === 1);
    const sinTope = await fila.turno(c[2].signal);
    check('Una sin tope entra igual (hay lugar para 2)', sinTope === true && fila.enCurso === 2 && orden.length === 0);
    fila.turno(c[3].signal).then((v) => orden.push(['sinTope', v]));
    await tic();
    fila.soltarTurno();
    await tic();
    check('Al soltar con 2: el lugar no va a la de tope 1 (quedaría en 2) sino a la siguiente sin tope', igual(orden, [['sinTope', true]]) && fila.enCurso === 2, { orden, enCurso: fila.enCurso });
    fila.soltarTurno();
    await tic();
    check('Al quedar 1 trabajando, la de tope 1 sigue esperando', orden.length === 1 && fila.enCurso === 1 && fila.sesionesEnCurso().esperando === 1, { orden, s: fila.sesionesEnCurso() });
    fila.soltarTurno();
    await tic();
    check('Con 0 trabajando, la de tope 1 entra', igual(orden[1], ['tope1', true]) && fila.enCurso === 1, { orden, enCurso: fila.enCurso });
    fila.soltarTurno();
    const grande = await fila.turno(c[4].signal, { tope: 9 });
    check('Un tope más grande que MAX_SESIONES no deja pasar de 2', grande === true && fila.tieneQueEsperar({ tope: 9 }) === false && fila.enCurso === 1);
    fila.soltarTurno();
    check('La fila queda vacía', fila.enCurso === 0 && fila.sesionesEnCurso().esperando === 0, fila.sesionesEnCurso());
  }

  {
    const uuid = crypto.randomUUID();
    let cortada = false;
    const control = new AbortController();
    control.signal.addEventListener('abort', () => (cortada = true));
    let sinControl = false;
    try {
      fila.registrarActiva(crypto.randomUUID(), { hijo: null });
    } catch {
      sinControl = true;
    }
    check('registrarActiva sin control se rechaza', sinControl && fila.activas.size === 0);
    const entrada = fila.registrarActiva(uuid, { control, hijo: null, tipo: 'imagen-ads-estrategia', conTurno: false });
    check('registrarActiva: la ve sesionActiva, también la de claude.js y la de motor-ia', fila.sesionActiva(uuid) && claude.sesionActiva(uuid) && ia.sesionActiva(uuid) && entrada.control === control);
    check('Esperando turno no cuenta como sesión de lotes trabajando', fila.sesionesEnCurso().deLotes === 0);
    entrada.conTurno = true;
    fila.anotarLotes('imagen-ads-estrategia');
    check('anotarLotes: cuenta la de lotes con turno', fila.sesionesEnCurso().deLotes === 1 && fila.sesionesEnCurso().maximoDeLotes === 1, fila.sesionesEnCurso());
    fila.anotarLotes('guion');
    check('anotarLotes con otro tipo no cambia nada', fila.sesionesEnCurso().maximoDeLotes === 1);
    check('cancelarSesion corta la señal de la sesión', ia.cancelarSesion(uuid) === true && cortada && control.signal.aborted);
    check('cancelarSesion de una que no existe: false', fila.cancelarSesion(crypto.randomUUID()) === false);
    check('quitarActiva la saca del registro', fila.quitarActiva(uuid) === true && !fila.sesionActiva(uuid) && fila.activas.size === 0);
    fila.matar(null); // no hace nada (y no rompe)
    check('matar(null) no rompe', true);
  }

  // ------------------------------------------------------------ 2. claude.js
  seccion('2. claude.js vuelve a exportar la fila');
  check('Los mismos objetos que ia/fila.js', claude.sesionActiva === fila.sesionActiva && claude.sesionesEnCurso === fila.sesionesEnCurso && claude.cancelarSesion === fila.cancelarSesion && claude.matar === fila.matar && claude.MAX_SESIONES === fila.MAX_SESIONES);

  // Todo lo que hoy se importa de lib/claude.js (con nombre) tiene que seguir existiendo.
  const exportados = new Set(Object.keys(claude));
  const faltan = [];
  let archivosQueImportan = 0;
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules') recorrer(ruta);
      } else if (/\.(m?js)$/.test(e.name)) {
        const texto = fs.readFileSync(ruta, 'utf8');
        for (const m of texto.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']*claude\.js)'/g)) {
          if (path.resolve(path.dirname(ruta), m[2]) !== path.join(LIB, 'claude.js')) continue;
          archivosQueImportan++;
          for (const nombre of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!exportados.has(nombre)) faltan.push(`${path.relative(APP, ruta)}: ${nombre}`);
        }
      }
    }
  };
  recorrer(path.join(APP, 'server'));
  check(`Los ${archivosQueImportan} imports con nombre de lib/claude.js encuentran todo`, archivosQueImportan >= 8 && faltan.length === 0, faltan);
  const usadosDinamicos = ['lanzarSesion', 'sesionesEnCurso', 'validarEsquema', 'cargarEsquema', 'prohibidasComunes', 'enTerminales', 'describirHerramienta', 'estadoClaude', 'abrirLogin', 'resolverClaude', 'entornoHijo', 'olvidarClaude'];
  check('Lo que se usa de claude.js por import() sigue ahí', usadosDinamicos.every((n) => typeof claude[n] === 'function'), usadosDinamicos.filter((n) => typeof claude[n] !== 'function'));
  const productos = await import(pathToFileURL(path.join(LIB, 'productos.js')).href);
  const rutasClaude = await import(pathToFileURL(path.join(APP, 'server', 'rutas', 'claude.js')).href);
  check('productos.js y rutas/claude.js cargan', typeof productos.ErrorApp === 'function' && typeof rutasClaude.default === 'function');

  // ------------------------------------------------------------ 3. motor-ia: nombres y eleccion
  seccion('3. motor-ia: MOTORES, datosIA, nombreIA y motorElegido');
  check('MOTORES tal cual el diseño', igual(ia.MOTORES, {
    claude: { id: 'claude', nombre: 'Claude', programa: 'Claude Code', cuenta: 'tu cuenta de Claude', planes: 'Pro o Max' },
    codex: { id: 'codex', nombre: 'ChatGPT', programa: 'Codex', cuenta: 'tu cuenta de ChatGPT', planes: '' },
  }), ia.MOTORES);
  check('MENSAJE_SIN_MOTOR exacto', ia.MENSAJE_SIN_MOTOR === 'Todavía no elegiste tu IA. Ve a Ajustes › Conexiones y elige Claude o ChatGPT.');
  check('Exporta lo del diseño (§1.2) y los tres registradores', ['motorElegido', 'migrarMotor', 'elegirMotor', 'motorActual', 'datosIA', 'nombreIA', 'lanzarSesion', 'estadoIA', 'alCambiarDeMotor', 'alPreguntarLotesOcupados', 'alPreguntarInstalacion'].every((n) => typeof ia[n] === 'function'));
  check('La forma del módulo de claude.js (para colas.claudeEnFila y ctx.claude())', ['lanzarSesion', 'prohibidasComunes', 'enTerminales', 'describirHerramienta', 'sesionActiva', 'sesionesEnCurso', 'cancelarSesion', 'motorActual'].every((n) => typeof ia[n] === 'function') && ia.prohibidasComunes === claude.prohibidasComunes && ia.enTerminales === claude.enTerminales && ia.describirHerramienta === claude.describirHerramienta && ia.sesionesEnCurso === fila.sesionesEnCurso);

  ponerConfig({});
  check('Sin motor en config.json: null (aunque Claude esté "instalado")', ia.motorElegido() === null && ia.motorActual() === null);
  check('nombreIA() y datosIA() sin IA: tu IA', ia.nombreIA() === 'tu IA' && igual(ia.datosIA(), { id: null, nombre: 'tu IA', programa: 'el programa de tu IA', cuenta: 'tu cuenta', planes: '' }), ia.datosIA());
  check("nombreIA('claude') = Claude, nombreIA('codex') = ChatGPT, nombreIA(null) = tu IA", ia.nombreIA('claude') === 'Claude' && ia.nombreIA('codex') === 'ChatGPT' && ia.nombreIA(null) === 'tu IA' && ia.nombreIA('toString') === 'tu IA');
  const d = ia.datosIA('codex');
  d.nombre = 'otro';
  check('datosIA devuelve una copia', ia.MOTORES.codex.nombre === 'ChatGPT' && ia.datosIA('codex').programa === 'Codex');
  ponerConfig({ motor: 'codex' });
  check("config { motor: 'codex' } → codex · nombreIA() = ChatGPT", ia.motorElegido() === 'codex' && ia.nombreIA() === 'ChatGPT' && ia.datosIA().cuenta === 'tu cuenta de ChatGPT');
  ponerConfig({ motor: 'gpt' });
  check('Un motor que no existe cuenta como ninguno', ia.motorElegido() === null);
  process.env.AIA_MOTOR = 'claude';
  check('AIA_MOTOR (pruebas) manda sobre config.json', ia.motorElegido() === 'claude' && ia.nombreIA() === 'Claude');
  process.env.AIA_MOTOR = 'otra';
  ponerConfig({ motor: 'codex' });
  check('Un AIA_MOTOR que no existe no cuenta: vale config.json', ia.motorElegido() === 'codex');
  delete process.env.AIA_MOTOR;

  // ------------------------------------------------------------ 4. migrarMotor
  seccion('4. migrarMotor');
  ponerConfig({ vozPorEstilo: { claymation: { id: 'abc', nombre: 'Voz' } } });
  let m = ia.migrarMotor();
  check('Sin bienvenidaVista no se migra (ve las dos opciones)', igual(m, { motor: null, migrado: false }) && !('motor' in leerConfigPrueba()), { m, c: leerConfigPrueba() });
  ponerConfig({ bienvenidaVista: false });
  m = ia.migrarMotor();
  check('Con bienvenidaVista: false tampoco', igual(m, { motor: null, migrado: false }) && !('motor' in leerConfigPrueba()));
  ponerConfig({ bienvenidaVista: true, vozPorEstilo: { claymation: { id: 'abc', nombre: 'Voz' } } });
  m = ia.migrarMotor();
  const tras = leerConfigPrueba();
  check("Con bienvenidaVista: true guarda motor: 'claude' y deja lo demás", igual(m, { motor: 'claude', migrado: true }) && tras.motor === 'claude' && tras.bienvenidaVista === true && tras.vozPorEstilo?.claymation?.id === 'abc', { m, tras });
  const marca = fs.statSync(rutas.CONFIG).mtimeMs;
  m = ia.migrarMotor();
  check('La segunda vez no hace nada (idempotente)', igual(m, { motor: 'claude', migrado: false }) && fs.statSync(rutas.CONFIG).mtimeMs === marca);
  ponerConfig({ bienvenidaVista: true, motor: 'codex' });
  m = ia.migrarMotor();
  check('Con una IA ya elegida no la cambia', igual(m, { motor: 'codex', migrado: false }) && leerConfigPrueba().motor === 'codex');
  process.env.AIA_MOTOR = 'codex';
  ponerConfig({ bienvenidaVista: true });
  m = ia.migrarMotor();
  check('AIA_MOTOR no cambia la migración (mira el config)', igual(m, { motor: 'claude', migrado: true }));
  delete process.env.AIA_MOTOR;
  // Un alumno nuevo que cierra la bienvenida sin elegir IA («Ahora no», la X o «Empezar»): no cuenta como vista, así
  // que el próximo arranque no lo toma por un alumno de antes ni le pone Claude (§0.2)
  const rutasAjustes = (await import(pathToFileURL(path.join(APP, 'server', 'rutas', 'ajustes.js')).href)).default;
  const handlers = {};
  rutasAjustes({ get() {}, post() {}, put: (ruta, ...fns) => (handlers[ruta] = fns.at(-1)), use() {}, delete() {} });
  const marcar = (vista) => {
    let enviado = null;
    handlers['/api/ajustes/bienvenida']({ body: { vista } }, { json: (x) => (enviado = x), set() {}, status() {} });
    return enviado;
  };
  ponerConfig({});
  let rb = marcar(true);
  check('Sin IA elegida, cerrar la bienvenida no la marca como vista', rb?.bienvenidaVista === false && leerConfigPrueba().bienvenidaVista !== true, { rb, c: leerConfigPrueba() });
  m = ia.migrarMotor();
  check('…y el próximo arranque no le pone Claude (sigue sin IA, ve las dos tarjetas)', igual(m, { motor: null, migrado: false }) && !('motor' in leerConfigPrueba()), { m, c: leerConfigPrueba() });
  ponerConfig({ motor: 'codex' });
  rb = marcar(true);
  check('Con una IA elegida sí se marca como vista', rb?.bienvenidaVista === true && leerConfigPrueba().bienvenidaVista === true && leerConfigPrueba().motor === 'codex');
  rb = marcar(false);
  check('«Ver la bienvenida otra vez» (vista: false) la desmarca', rb?.bienvenidaVista === false);

  // ------------------------------------------------------------ 5. elegirMotor
  seccion('5. elegirMotor');
  const errorDe = async (f) => {
    try {
      await f();
      return null;
    } catch (e) {
      return e;
    }
  };
  ponerConfig({ bienvenidaVista: true, motor: 'claude' });
  const avisos = [];
  const sacarAviso = ia.alCambiarDeMotor((x) => avisos.push(x));
  const sacarQueFalla = ia.alCambiarDeMotor(() => {
    throw new Error('un oyente que falla (esperado en la prueba)');
  });
  const sacarQueFallaLuego = ia.alCambiarDeMotor(async () => {
    throw new Error('un oyente que falla en una promesa (esperado en la prueba)');
  });
  let e = await errorDe(() => ia.elegirMotor('gpt'));
  check('Un id que no es claude ni codex: 400', e instanceof productos.ErrorApp && e.status === 400 && e.message === 'Elige Claude o ChatGPT.', e?.message);

  const uuid = crypto.randomUUID();
  fila.registrarActiva(uuid, { control: new AbortController(), hijo: null, tipo: 'guion', conTurno: false });
  e = await errorDe(() => ia.elegirMotor('codex'));
  check('Con una sesión registrada en la fila (consultando la cuenta o esperando turno): 409', e instanceof productos.ErrorApp && e.status === 409 && e.message === 'Tu IA está escribiendo algo ahora. Espera a que termine y vuelve a intentarlo.', e?.message);
  check('El 409 no cambia nada ni avisa', leerConfigPrueba().motor === 'claude' && avisos.length === 0);
  const igualQueAntes = await ia.elegirMotor('claude');
  check('Elegir la misma IA con una sesión en curso no es un error y no cambia nada', igual(igualQueAntes, { ok: true, elegido: 'claude', anterior: 'claude', cambio: false }) && avisos.length === 0, igualQueAntes);
  fila.quitarActiva(uuid);

  const sacarLotes = ia.alPreguntarLotesOcupados(() => true);
  e = await errorDe(() => ia.elegirMotor('codex'));
  check('Con un lote de imagen revisando o ajustando: 409', e?.status === 409 && leerConfigPrueba().motor === 'claude');
  sacarLotes();
  const sacarLotes2 = ia.alPreguntarLotesOcupados(async () => true);
  e = await errorDe(() => ia.elegirMotor('codex'));
  check('La pregunta de los lotes puede ser una promesa', e?.status === 409);
  sacarLotes2();
  const sacarLotes3 = ia.alPreguntarLotesOcupados(() => {
    throw new Error('no pude mirar');
  });
  ia.alPreguntarLotesOcupados(() => false);

  const r = await ia.elegirMotor('codex');
  await tic();
  check('Sin nada trabajando: guarda la nueva', igual(r, { ok: true, elegido: 'codex', anterior: 'claude', cambio: true }) && leerConfigPrueba().motor === 'codex' && leerConfigPrueba().bienvenidaVista === true && ia.motorElegido() === 'codex', { r, c: leerConfigPrueba() });
  check('Avisa una vez con la nueva y la anterior (y un oyente que falla no frena)', igual(avisos, [{ motor: 'codex', anterior: 'claude' }]), avisos);
  sacarLotes3();
  sacarAviso();
  sacarQueFalla();
  sacarQueFallaLuego();
  await ia.elegirMotor('claude');
  check('Un oyente que se sacó ya no se entera', avisos.length === 1 && leerConfigPrueba().motor === 'claude');
  ponerConfig({});
  const r2 = await ia.elegirMotor('claude');
  check('Desde ninguna: anterior null', r2.anterior === null && r2.cambio === true && leerConfigPrueba().motor === 'claude');

  // ------------------------------------------------------------ 6. lanzarSesion
  seccion('6. lanzarSesion');
  ponerConfig({ bienvenidaVista: true });
  const u1 = crypto.randomUUID();
  const sinIA = await ia.lanzarSesion({ uuid: u1, prompt: 'hola', tipo: 'guion' });
  check('Sin IA elegida: no lanza nada y lo dice', igual(sinIA, { ok: false, sinClaude: true, sinMotor: true, error: ia.MENSAJE_SIN_MOTOR, sesion: u1, turnos: 0, costo: 0, frases: [], motor: null }) && fila.activas.size === 0, sinIA);

  const RUTA_CODEX = path.join(LIB, 'codex.js');
  if (!fs.existsSync(RUTA_CODEX)) {
    process.env.AIA_MOTOR = 'codex';
    const u2 = crypto.randomUUID();
    const sinCodex = await ia.lanzarSesion({ uuid: u2, prompt: 'hola', tipo: 'guion' });
    check('Con ChatGPT y sin codex.js: «Falta Codex…»', igual(sinCodex, { ok: false, sinClaude: true, error: 'Falta Codex, el programa de ChatGPT, en tu PC. Ve a Ajustes › Conexiones y toca "Instalar".', sesion: u2, turnos: 0, costo: 0, frases: [], motor: 'codex' }), sinCodex);
    delete process.env.AIA_MOTOR;
  } else console.log('(omitida: «Falta Codex» sin codex.js; codex.js ya existe)');

  ponerConfig({ bienvenidaVista: true, motor: 'claude' });
  e = await errorDe(() => ia.lanzarSesion({ uuid: 'no-es-un-uuid', prompt: 'hola' }));
  check('Con Claude, lanzarSesion va a claude.js (su validación del uuid)', /uuid válido/.test(e?.message || ''), e?.message);
  const u3 = crypto.randomUUID();
  const frases = [];
  const conClaude = await ia.lanzarSesion({ uuid: u3, prompt: 'Responde LISTO.', tipo: 'guion', alProgreso: (f) => frases.push(f), timeoutMs: 60000 });
  check('Con Claude (el de mentira): termina bien y trae motor: claude', conClaude?.ok === true && conClaude.motor === 'claude' && conClaude.resultado === 'LISTO' && conClaude.sesion === u3, conClaude);
  check('Después, la fila queda libre', fila.enCurso === 0 && fila.activas.size === 0 && !ia.sesionActiva(u3), fila.sesionesEnCurso());

  // ------------------------------------------------------------ 7. estadoIA
  seccion('7. estadoIA');
  ponerConfig({ bienvenidaVista: true, motor: 'claude' });
  const est = await ia.estadoIA();
  check('Con Claude: nombre, programa, cuenta y planes', est.elegido === 'claude' && est.nombre === 'Claude' && est.programa === 'Claude Code' && est.cuenta === 'tu cuenta de Claude' && est.planes === 'Pro o Max', est);
  check('Solo pregunta por la elegida', est.motores?.claude?.sesion === 'ok' && est.motores.claude.instalado === true && est.motores.claude.version === '2.1.288' && !('codex' in est.motores), est.motores);
  check('trabajando sale de la fila y login va en null', igual(est.trabajando, fila.sesionesEnCurso()) && est.login === null && 'instalando' in est, est);
  check('Sin nadie que instale: instalando null', est.instalando === null, est.instalando);
  const instalando = { motor: 'claude', fase: 'instalando', desde: 1 };
  const sacarFalla = ia.alPreguntarInstalacion(() => {
    throw new Error('no pude mirar');
  });
  const sacarInstalacion = ia.alPreguntarInstalacion(async () => instalando);
  check('instalando: lo que dice quien instala (una que falla no cuenta)', igual((await ia.estadoIA()).instalando, instalando));
  sacarInstalacion();
  sacarFalla();
  check('Al sacarlo vuelve a null', (await ia.estadoIA()).instalando === null);
  ponerConfig({});
  const sinElegir = await ia.estadoIA();
  check('Sin IA elegida: tu IA y ninguna cuenta consultada', sinElegir.elegido === null && sinElegir.nombre === 'tu IA' && igual(sinElegir.motores, {}), sinElegir);
  if (!fs.existsSync(RUTA_CODEX)) {
    const todos = await ia.estadoIA({ todos: true });
    check('Con todos y sin codex.js: Codex no instalado', igual(todos.motores.codex, { instalado: false, sesion: 'sin-sesion' }) && todos.motores.claude?.sesion === 'ok', todos.motores);
  } else console.log('(omitida: estadoIA con todos sin codex.js; codex.js ya existe)');

  // La cabecera de Nuevo anuncio (EstadoIA en pantallas/nuevo/index.jsx): «Escribe {nombre} · con tu cuenta», sin la
  // versión del programa pegada al nombre de la IA (§5.5; la versión solo va en Ajustes › Conexiones).
  const nuevo = fs.readFileSync(path.join(APP, 'src', 'pantallas', 'nuevo', 'index.jsx'), 'utf8').replace(/\r\n/g, '\n'); // (git en Windows puede dejarlo en CRLF)
  const cabecera = nuevo.match(/\nfunction EstadoIA\([\s\S]*?\n}\n/)?.[0] || '';
  check('Cabecera de Nuevo anuncio: «Escribe {nombre} · con tu cuenta», sin la versión del programa', cabecera.includes('`Escribe ${motor.nombre}`') && cabecera.includes("' · con tu cuenta'") && !/\bmotor\.version\b/.test(cabecera), cabecera.slice(0, 200) || 'no encontré EstadoIA');

  // ------------------------------------------------------------ al final
  seccion('Al final');
  await tic();
  check('Ninguna promesa rechazada sin atrapar', sinAtrapar.length === 0, sinAtrapar);
  check('app/config.json no se tocó', marcaPrincipal() === principalAntes);
}
