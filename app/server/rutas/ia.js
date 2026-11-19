// La IA que escribe los guiones y los anuncios de imagen: Claude (Claude Code) o ChatGPT (Codex). Elegirla, instalar su
// programa e iniciar sesion, todo desde la app (lib/motor-ia.js, lib/instalar-motor.js y lib/codex.js).
//
// GET  /api/ia/estado[?todos=1]   -> estadoIA(): { elegido, nombre, programa, cuenta, planes, motores, instalando, login,
//                                    trabajando }. Solo pregunta por la cuenta de la IA elegida (tarda); las dos con todos=1.
// PUT  /api/ia/elegir { motor }   -> { ok, elegido, anterior, cambio }. 409 si la IA esta escribiendo algo.
// POST /api/ia/instalar { motor } -> { ok: true, listo, instalando }: instala en segundo plano; el avance y el final se
//                                    ven en `instalando` de /api/ia/estado (null = termino bien).
//                                    409 si ya hay una instalacion o (Codex) ChatGPT esta trabajando.
// POST /api/ia/login { motor, conCodigo? } -> Claude: { ok, mensaje } (una ventana, como /api/claude/login).
//                                    ChatGPT: { ok, login } (el navegador, o un codigo con conCodigo).
// POST /api/ia/login/cancelar     -> { ok }: corta el inicio de sesion de ChatGPT.
// POST /api/ia/salir { motor: 'codex' } -> { ok }: cierra la sesion de ChatGPT de la app.
// POST /api/ia/cambiar-cuenta { motor: 'claude' } -> { ok, mensaje }: cierra la sesion de Claude Code y abre el
//   inicio de sesion para entrar con OTRA cuenta (409 si Claude esta escribiendo algo en este momento)
//
// instalando = { motor, fase, porcentaje?, desde, error?, hasta? } | null
//   fase: la ultima frase de instalar-motor.js («Bajando Codex (unos 180 MB)…», «Preparando Codex…»…); porcentaje solo
//   llega al bajar el respaldo de la release. Con error, ya termino mal (queda hasta el proximo intento).
//
// Todo lo que cambia algo va con soloDesdeLaApp: una pagina web cualquiera no puede elegir, instalar ni abrir sesiones.
// codex.js se carga recien al usarlo (moduloCodex): si no esta, lo de ChatGPT responde que no se pudo y el resto anda.
// Si el CODEX_HOME de la app fuera la sesion del propio usuario (~/.codex, solo en pruebas), aca no se inicia ni se
// cierra sesion: esa sesion es del usuario.
import { motorElegido, elegirMotor, estadoIA, alPreguntarInstalacion } from '../lib/motor-ia.js';
import { abrirLogin, olvidarEstadoClaude } from '../lib/claude.js';
import { activas } from '../lib/ia/fila.js';
import { instalarClaude, instalarCodex } from '../lib/instalar-motor.js';
import { resolverCodex, carpetasCodex, esHomeDelUsuario } from '../lib/codex-rutas.js';
import { hayLoginAbierto } from '../lib/codex-app-server.js';
import { soloDesdeLaApp, ErrorApp } from '../lib/productos.js';
import { olvidarVersiones, moduloCodex } from './estado.js';
import { olvidarRevisiones } from './ajustes.js';

const MOTORES = ['claude', 'codex'];
const ELIGE = 'Elige Claude o ChatGPT.';
const NO_PUDE_INSTALAR = 'No pude instalarlo. Revisa tu internet y que tengas al menos 1 GB libre, y vuelve a intentarlo.';
const YA_INSTALANDO = {
  claude: 'Claude Code ya se está instalando. Espera a que termine.',
  codex: 'Codex ya se está instalando. Espera a que termine.',
};
const CODEX_EN_USO = 'ChatGPT está trabajando: espera a que termine para reinstalar Codex.';
const CODEX_EN_USO_SALIR = 'ChatGPT está trabajando: espera a que termine para cerrar la sesión.';
const SIN_CODEX = 'Falta Codex, el programa de ChatGPT, en tu PC. Ve a Ajustes › Conexiones y toca "Instalar".';
const NO_ABRE_LOGIN_CLAUDE = 'No pude abrir la ventana para iniciar sesión. Abre una terminal y escribe: claude auth login';
const NO_ABRE_LOGIN = 'No pude abrir el inicio de sesión de ChatGPT. Vuelve a intentarlo.';
const NO_CIERRA = 'No pude cerrar la sesión de ChatGPT. Vuelve a intentarlo.';
const SOLO_CHATGPT = 'Desde aquí solo se cierra la sesión de ChatGPT.';
const SESION_DEL_USUARIO = 'La app está usando la sesión de ChatGPT de esta PC: ahí no inicia ni cierra sesión.';

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const valido = (m) => (MOTORES.includes(m) ? m : null);
/** La IA del pedido ({ motor }), o la elegida si no dice. */
const motorDelPedido = (req) => valido(String(req.body?.motor ?? motorElegido() ?? '').trim().toLowerCase());
/** true si el CODEX_HOME de la app es ~/.codex (la sesion del propio usuario): ahi no se toca nada. */
const homeDelUsuario = () => esHomeDelUsuario(carpetasCodex().home);

/** ChatGPT trabajando o con un inicio de sesion abierto (codex.js); sin codex.js, lo que se puede saber desde aca. */
function codexEnUso(codex) {
  try {
    if (typeof codex?.codexEnUso === 'function') return Boolean(codex.codexEnUso());
  } catch {
    /* no se sabe: se mira lo de abajo */
  }
  return hayLoginAbierto() || (motorElegido() === 'codex' && activas.size > 0);
}

/** Lo que se sabia de los programas y de las cuentas se vuelve a preguntar (despues de instalar o elegir). */
async function olvidarLoDeLaIA() {
  olvidarVersiones();
  olvidarRevisiones();
  olvidarEstadoClaude();
  try {
    (await moduloCodex())?.olvidarEstadoCodex?.();
  } catch {
    /* no frena */
  }
}

// ---------------------------------------------------------------- la instalacion en segundo plano

let instalando = null; // { motor, fase, porcentaje?, desde, error?, hasta? } (y por dentro: listo, ocupado)
const instalandoAhora = () => Boolean(instalando && !instalando.error);

/** Lo que se muestra de la instalacion (sin lo de adentro). */
const paraLaPantalla = (i) =>
  i ? { motor: i.motor, fase: i.fase, ...(i.porcentaje !== undefined ? { porcentaje: i.porcentaje } : {}), desde: i.desde, ...(i.error ? { error: i.error, hasta: i.hasta } : {}) } : null;

// /api/ia/estado (estadoIA de motor-ia.js) la devuelve en `instalando`
alPreguntarInstalacion(() => paraLaPantalla(instalando));

/** Lanza la instalacion. -> { este, fin } (fin se cumple cuando termina, bien o mal). */
function lanzarInstalacion(motor) {
  const este = { motor, fase: null, desde: new Date().toISOString() };
  instalando = este;
  const alProgreso = (frase, extra) => {
    if (instalando !== este) return;
    if (frase) este.fase = frase;
    if (Number.isFinite(extra?.porcentaje)) este.porcentaje = Math.max(0, Math.min(100, Math.round(extra.porcentaje)));
  };
  const instalar = motor === 'codex' ? instalarCodex : instalarClaude;
  const fin = Promise.resolve()
    .then(() => instalar({ alProgreso }))
    .catch((e) => ({ ok: false, error: NO_PUDE_INSTALAR, detalle: e?.message || String(e) }))
    .then(async (r) => {
      if (r?.ok) {
        este.listo = true;
        await olvidarLoDeLaIA();
        if (instalando === este) instalando = null;
        return;
      }
      if (r?.detalle) console.error(`[instalar ${motor}] ${r.detalle}`);
      este.error = r?.error || NO_PUDE_INSTALAR;
      este.hasta = new Date().toISOString();
      // otra instalacion (el lanzador, u otra app) tiene el candado: esta no empezo, la que corre es la otra
      if (r?.ocupado) {
        este.ocupado = true;
        if (instalando === este) instalando = null;
      }
    })
    .catch((e) => console.error(`[instalar ${motor}] ${e?.message || e}`));
  return { este, fin };
}

// ---------------------------------------------------------------- rutas

export default function rutasIA(app) {
  app.get('/api/ia/estado', async (req, res) => {
    const estado = await estadoIA({ todos: req.query.todos === '1' });
    res.set('Cache-Control', 'no-store');
    res.json(estado);
  });

  app.put('/api/ia/elegir', soloDesdeLaApp, async (req, res, next) => {
    try {
      const r = await elegirMotor(req.body?.motor);
      if (r.cambio) await olvidarLoDeLaIA(); // Tu PC y la pantalla muestran el programa y la cuenta de la elegida
      res.json(r);
    } catch (e) {
      if (e instanceof ErrorApp || Number.isInteger(e?.status)) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });

  app.post('/api/ia/instalar', soloDesdeLaApp, async (req, res) => {
    const motor = motorDelPedido(req);
    if (!motor) return res.status(400).json({ error: ELIGE });
    if (instalandoAhora()) return res.status(409).json({ error: YA_INSTALANDO[instalando.motor] });
    // en Windows no se puede reemplazar un .exe que esta corriendo
    if (motor === 'codex' && codexEnUso(await moduloCodex())) return res.status(409).json({ error: CODEX_EN_USO });
    if (instalandoAhora()) return res.status(409).json({ error: YA_INSTALANDO[instalando.motor] }); // (otro pedido, mientras se miraba)
    const { este, fin } = lanzarInstalacion(motor);
    // si el candado lo tiene otra instalacion, instalarCodex vuelve enseguida con `ocupado`: eso es un 409
    await Promise.race([fin, pausa(1500)]);
    if (este.ocupado) return res.status(409).json({ error: este.error });
    res.json({ ok: true, listo: este.listo === true, instalando: paraLaPantalla(instalando) });
  });

  app.post('/api/ia/login', soloDesdeLaApp, async (req, res) => {
    const motor = motorDelPedido(req);
    if (!motor) return res.status(400).json({ error: ELIGE });
    if (motor === 'claude') {
      if (!abrirLogin()) return res.status(503).json({ error: NO_ABRE_LOGIN_CLAUDE });
      return res.json({ ok: true, mensaje: 'Se abrió una ventana: inicia sesión con tu cuenta de Claude y vuelve aquí.' });
    }
    if (homeDelUsuario()) return res.status(409).json({ error: SESION_DEL_USUARIO });
    if (instalandoAhora() && instalando.motor === 'codex') return res.status(409).json({ error: YA_INSTALANDO.codex });
    if (!resolverCodex()) return res.status(409).json({ error: SIN_CODEX });
    const codex = await moduloCodex();
    if (typeof codex?.abrirLoginCodex !== 'function') return res.status(503).json({ error: NO_ABRE_LOGIN });
    let r;
    try {
      // abre el login y vuelve; si tarda (busca el enlace en lo que dice Codex), se contesta igual con lo que haya
      const abierto = Promise.resolve(codex.abrirLoginCodex({ conCodigo: Boolean(req.body?.conCodigo) }));
      abierto.catch((e) => console.error(`[ia] login: ${e?.message || e}`));
      r = await Promise.race([abierto, pausa(15000).then(() => undefined)]);
    } catch (e) {
      console.error(`[ia] login: ${e?.message || e}`);
      return res.status(503).json({ error: NO_ABRE_LOGIN });
    }
    if (r && r.ok === false) return res.status(Number.isInteger(r.status) ? r.status : 503).json({ error: typeof r.error === 'string' && r.error ? r.error : NO_ABRE_LOGIN });
    let login = null;
    try {
      login = typeof codex.estadoLoginCodex === 'function' ? (codex.estadoLoginCodex() ?? null) : (r?.login ?? null);
    } catch {
      /* sin el estado: la pantalla lo ve en /api/ia/estado */
    }
    res.json({ ok: true, login });
  });

  app.post('/api/ia/login/cancelar', soloDesdeLaApp, async (req, res) => {
    const codex = await moduloCodex();
    try {
      await codex?.cancelarLoginCodex?.();
    } catch (e) {
      console.error(`[ia] cancelar login: ${e?.message || e}`);
    }
    res.json({ ok: true });
  });

  app.post('/api/ia/cambiar-cuenta', soloDesdeLaApp, (req, res) => {
    const motor = valido(String(req.body?.motor ?? 'claude').trim().toLowerCase());
    if (motor !== 'claude') return res.status(400).json({ error: 'Para cambiar la cuenta de ChatGPT, cierra la sesión y vuelve a iniciarla.' });
    // (cerrar la sesion corta lo que Claude este escribiendo: primero que termine)
    if (motorElegido() === 'claude' && activas.size > 0 && !req.body?.igual) {
      return res.status(409).json({ error: `Claude está escribiendo ${activas.size === 1 ? 'algo' : `${activas.size} cosas`} ahora mismo: si cambias de cuenta se corta. Espera a que termine o vuelve a tocar «Cambiar de cuenta» para cortarlo.`, enUso: activas.size });
    }
    if (!abrirLogin({ cambiar: true })) return res.status(503).json({ error: NO_ABRE_LOGIN_CLAUDE });
    res.json({ ok: true, mensaje: 'Se abrió una ventana: primero se cierra la cuenta anterior y después entras con la otra.' });
  });

  app.post('/api/ia/salir', soloDesdeLaApp, async (req, res) => {
    const motor = valido(String(req.body?.motor ?? 'codex').trim().toLowerCase());
    if (motor !== 'codex') return res.status(400).json({ error: SOLO_CHATGPT });
    if (homeDelUsuario()) return res.status(409).json({ error: SESION_DEL_USUARIO });
    const codex = await moduloCodex();
    if (typeof codex?.cerrarSesionCodex !== 'function') return res.status(503).json({ error: NO_CIERRA });
    if (codexEnUso(codex)) return res.status(409).json({ error: CODEX_EN_USO_SALIR });
    let r;
    try {
      r = await codex.cerrarSesionCodex();
    } catch (e) {
      console.error(`[ia] cerrar sesión: ${e?.message || e}`);
      return res.status(500).json({ error: NO_CIERRA });
    }
    try {
      codex.olvidarEstadoCodex?.();
    } catch {
      /* no frena */
    }
    if (r && r.ok === false) return res.status(500).json({ error: typeof r.error === 'string' && r.error ? r.error : NO_CIERRA });
    res.json({ ok: true });
  });
}
