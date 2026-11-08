// Las claves de kie.ai y ElevenLabs, y el saldo de kie.
//
// GET  /api/claves          -> { kie: bool, elevenlabs: bool }               (nunca el valor)
// PUT  /api/claves          <- { kie?, elevenlabs? }  -> { kie, elevenlabs, avisos? }
//                              Antes de escribir el .env prueba cada clave (gratis): si el servicio
//                              dice que no existe, NO se guarda (asi no se pisa una clave buena con
//                              una mal copiada). Si no hay internet para comprobarla, se guarda igual
//                              y vuelve un aviso.
// POST /api/claves/probar   <- { cual: "kie" | "elevenlabs" } -> { ok, mensaje, saldoKie? }
// GET  /api/saldo[?fresco=1][&necesita=<creditos>]
//                           -> { kie: { creditos, dolares, alcanza?, consultado } }  o, si no se pudo,
//                              { kie: { creditos: null, motivo, error } }  (siempre 200: la pantalla
//                              muestra el motivo). El saldo es real y la consulta es gratis.
//
// Los valores de las claves solo viajan del navegador al servidor, nunca al reves, y no se anotan
// en ningun registro. Las respuestas de error dicen que paso en palabras simples.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { clavesGuardadas, guardarClaves, limpiarClave, probarClave, saldoKie, repararEnv, CLAVES } from '../lib/claves.js';
import { DOLARES_POR_CREDITO, PUERTO, RAIZ, TEMP } from '../lib/rutas.js';
import { stat, listar } from '../lib/archivos.js';
import { entornoDelMotor, modoPrueba } from '../lib/procesos.js';
import { slugDeLaApp, leerConductor } from '../lib/conductor.js';
import { leerPlanDeCosto } from '../lib/familias/voz-en-off.js';
import { CREDITOS_SUNO } from '../lib/gasto.js';

// Lo que escribe o consulta afuera solo se acepta desde la propia app (una pagina de otro sitio
// no puede guardar claves ni gastar consultas en nombre del usuario).
const ORIGENES = new Set([`http://127.0.0.1:${PUERTO}`, `http://localhost:${PUERTO}`, `http://[::1]:${PUERTO}`]);
function desdeLaApp(req, res, next) {
  const origen = req.headers.origin;
  if (origen && !ORIGENES.has(String(origen).toLowerCase())) return res.status(403).json({ error: 'Solo desde la app.' });
  next();
}

const nombreDe = (cual) => CLAVES[cual]?.nombre || cual;

/** El saldo que ve el motor: el real de kie, o en modo prueba el de la cuenta simulada. Mismo formato que saldoKie(). */
async function saldoActual({ fresco }) {
  if (!modoPrueba()) return saldoKie({ fresco });
  try {
    const { saldoSimulado } = await import('../lib/modo-prueba.js');
    const s = await saldoSimulado();
    if (s && Number.isFinite(Number(s.restante))) return { ok: true, creditos: Number(s.restante), consultado: new Date().toISOString() };
  } catch {
    /* los simuladores no arrancaron: abajo */
  }
  return { ok: false, motivo: 'servicio', mensaje: 'El modo prueba no está listo todavía.' };
}

// Lo que falta producir de un anuncio, en creditos (producir --solo-plan: no genera nada y no cobra nada). Se guarda
// mientras el manifiesto no cambie, y las consultas a la vez comparten la misma corrida.
const cacheNecesita = new Map(); // slug -> { firma, valor, promesa }

function correrSoloPlan(slug, env) {
  return new Promise((resolve) => {
    let salida = '';
    let hijo;
    try {
      hijo = spawn(process.execPath, [path.join(RAIZ, 'produccion', 'producir.js'), `temp/${slug}`, '--solo-plan'], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch {
      return resolve(null);
    }
    const reloj = setTimeout(() => hijo.kill(), 120000);
    hijo.stdout.on('data', (d) => (salida = (salida + d).slice(-60000)));
    hijo.stderr.on('data', (d) => (salida = (salida + d).slice(-60000)));
    hijo.on('error', () => {});
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      resolve(codigo === 0 ? salida : null);
    });
  });
}

async function necesitaDe(slug) {
  const st = stat(path.join(TEMP, slug, 'manifiesto.json'));
  if (!st) return null;
  const musica = listar(path.join(TEMP, slug, 'musica')).some((n) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(n));
  const firma = `${st.mtimeMs}:${st.size}:${musica}:${modoPrueba()}`;
  const c = cacheNecesita.get(slug);
  if (c?.firma === firma) return c.promesa || c.valor;
  const promesa = (async () => {
    let env;
    try {
      env = await entornoDelMotor();
    } catch {
      return null;
    }
    const salida = await correrSoloPlan(slug, env);
    if (salida === null) return null;
    const plan = leerPlanDeCosto(salida);
    return plan.total === null ? null : plan.total + (musica ? 0 : CREDITOS_SUNO);
  })();
  cacheNecesita.set(slug, { firma, promesa });
  const valor = await promesa;
  if (cacheNecesita.get(slug)?.promesa === promesa) {
    if (valor === null) cacheNecesita.delete(slug);
    else cacheNecesita.set(slug, { firma, valor });
  }
  return valor;
}

export default function rutasClaves(app) {
  repararEnv()
    .then((arreglado) => arreglado && console.log('  [claves] El .env venía con BOM (o en UTF-16): lo dejé en UTF-8 sin BOM para que el motor lo lea.'))
    .catch((e) => console.error('  [claves] No pude revisar el .env:', e?.message || e));
  app.get('/api/claves', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(clavesGuardadas());
  });

  app.put('/api/claves', desdeLaApp, async (req, res) => {
    const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
    const pedidas = Object.keys(CLAVES).filter((cual) => cuerpo[cual] !== undefined && cuerpo[cual] !== null && cuerpo[cual] !== '');
    if (!pedidas.length) return res.status(400).json({ error: 'Pega una clave para guardarla.' });

    const limpias = {};
    for (const cual of pedidas) {
      const v = limpiarClave(cual, cuerpo[cual]);
      if (!v) {
        return res.status(400).json({
          cual,
          error: `Eso no parece una clave de ${nombreDe(cual)}: copia solo la clave, sin espacios ni comillas.`,
        });
      }
      limpias[cual] = v;
    }

    // se prueban todas antes de escribir: o se guardan todas las que sirven, o ninguna
    const avisos = [];
    for (const cual of pedidas) {
      const p = await probarClave(cual, { valor: limpias[cual] });
      if (!p.ok && p.motivo === 'clave-invalida') return res.status(400).json({ cual, error: `${p.mensaje} No la guardé.` });
      if (!p.ok) avisos.push({ cual, mensaje: `La guardé, pero no pude comprobarla: ${p.mensaje}` });
    }

    const guardadas = await guardarClaves(limpias);
    res.json({ ...guardadas, ...(avisos.length ? { avisos } : {}) });
  });

  app.post('/api/claves/probar', desdeLaApp, async (req, res) => {
    const cual = req.body?.cual;
    if (!CLAVES[cual]) return res.status(400).json({ error: 'Esa conexión no existe.' });
    const p = await probarClave(cual);
    const r = { ok: p.ok, mensaje: p.mensaje };
    if (p.motivo) r.motivo = p.motivo;
    if (typeof p.saldoKie === 'number') r.saldoKie = p.saldoKie;
    res.json(r);
  });

  app.get('/api/saldo', desdeLaApp, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    if (slug) {
      // Para un anuncio: solo si alcanza (ningun numero sale para esa pantalla). Ya en produccion, lo dice el
      // conductor en su paso "saldo"; sin poder calcularlo, no se frena a nadie (alcanza queda sin decir).
      if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
      if (leerConductor(slug)) return res.json({ kie: {} });
      const [s, necesita] = await Promise.all([saldoActual({ fresco: req.query.fresco === '1' }), necesitaDe(slug)]);
      if (!s.ok) return res.json({ kie: { motivo: s.motivo, error: s.mensaje } });
      return res.json({ kie: necesita === null ? {} : { alcanza: s.creditos >= necesita } });
    }
    const s = await saldoActual({ fresco: req.query.fresco === '1' });
    if (!s.ok) return res.json({ kie: { creditos: null, motivo: s.motivo, error: s.mensaje } });
    // los dolares son orientativos (el mismo precio por credito que usa el motor): solo para Ajustes
    const kie = { creditos: s.creditos, dolares: Math.round(s.creditos * DOLARES_POR_CREDITO * 100) / 100, consultado: s.consultado };
    const necesita = Number(req.query.necesita);
    if (req.query.necesita !== undefined && Number.isFinite(necesita) && necesita >= 0) kie.alcanza = s.creditos >= necesita;
    if (modoPrueba()) kie.simulado = true;
    res.json({ kie });
  });
}
