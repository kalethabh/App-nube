// Lo que va a costar un anuncio (aprox.) y si tu saldo de kie alcanza: para «Me gusta, producir» y para la
// producción. Nada de esto cobra.
//
//   costoDeAnuncio(slug) -> {
//     falta:   { creditos, dolares }   lo que falta pagar (producir.js --solo-plan: lo ya hecho no cuenta; + Suno)
//     gastado: { creditos, dolares }   lo ya pagado (img/ y video/log-modelos.json)
//     total:   { creditos, dolares }   gastado + falta
//     saldo:   { creditos, dolares }   tu saldo de kie ahora
//     semaforo: 'sobra' | 'justo' | 'corto' | null
//   }
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { RAIZ, TEMP, DOLARES_POR_CREDITO } from './rutas.js';
import { leerJSON, existe, listar } from './archivos.js';
import { entornoDelMotor, consultarSaldoKie } from './procesos.js';
import { leerPlanDeCosto, caminoDeMusica } from './familias/voz-en-off.js';

const CREDITOS_SUNO = 12;
const usd = (cr) => Math.round(cr * DOLARES_POR_CREDITO * 100) / 100;
const conDolares = (cr) => (cr === null || cr === undefined ? null : { creditos: Math.round(cr), dolares: usd(cr) });

/** Verde si sobra (te queda al menos la mitad del anuncio o US$1), naranja si alcanza justo, rojo si no alcanza. */
export function semaforo(saldo, falta) {
  if (saldo === null || saldo === undefined || falta === null || falta === undefined) return null;
  if (saldo < falta) return 'corto';
  return saldo - falta >= Math.max(falta * 0.5, 200) ? 'sobra' : 'justo';
}

let saldoCache = { t: 0, valor: null };
async function saldoKie() {
  if (Date.now() - saldoCache.t < 60000 && saldoCache.valor !== null) return saldoCache.valor;
  const v = await consultarSaldoKie();
  if (v !== null) saldoCache = { t: Date.now(), valor: v };
  return v;
}

function correrPlan(slug) {
  return new Promise(async (ok) => {
    let env;
    try {
      env = await entornoDelMotor();
    } catch {
      return ok(null);
    }
    const p = spawn(process.execPath, [path.join(RAIZ, 'produccion', 'producir.js'), `temp/${slug}`, '--solo-plan'], { cwd: RAIZ, env, windowsHide: true });
    let texto = '';
    const t = setTimeout(() => p.kill(), 120000);
    p.stdout.on('data', (d) => (texto += d));
    p.stderr.on('data', (d) => (texto += d));
    p.on('close', () => {
      clearTimeout(t);
      ok(texto);
    });
    p.on('error', () => {
      clearTimeout(t);
      ok(null);
    });
  });
}

const sumaLog = (f, clave) => {
  const l = leerJSON(f)?.[clave];
  return Array.isArray(l) ? l.reduce((s, x) => s + (Number(x?.creditos) || 0), 0) : 0;
};

const cache = new Map(); // slug -> { firma, valor }

/** El costo aproximado de un anuncio (lo que falta, lo gastado y tu saldo). null si no hay guion todavía. */
export async function costoDeAnuncio(slug) {
  const dir = path.join(TEMP, slug);
  const fm = path.join(dir, 'manifiesto.json');
  if (!existe(fm)) return null;
  const brief = leerJSON(path.join(dir, 'app', 'brief.json')) || {};
  const estilo = brief.estilo || leerJSON(fm)?.estilo || null;
  // se recalcula cuando cambia el guion o llegan piezas nuevas
  const firma = [fs.statSync(fm).mtimeMs, listar(path.join(dir, 'img')).length, listar(path.join(dir, 'video')).length, listar(path.join(dir, 'musica')).length].join('|');
  let plan = cache.get(slug);
  if (plan) plan = { ...plan };
  if (!plan || plan.firma !== firma || Date.now() - plan.t > 10 * 60000) {
    const texto = await correrPlan(slug);
    const p = leerPlanDeCosto(texto || '');
    let falta = p.total;
    if (falta === null && texto) {
      // UGC: lo junto (imágenes + videos) va en otro bloque
      const junto = texto.slice(Math.max(0, texto.indexOf('=== Costo junto')));
      const n = (re) => Number(String(junto.match(re)?.[1] || '').replace(',', '.')) || 0;
      if (/Imagenes:|Videos:/.test(junto)) falta = n(/Imagenes:\s+([\d.]+) creditos/) + n(/Videos:\s+([\d.]+) creditos/);
    }
    // la música de Suno (si el estilo la genera y todavía no está)
    const sinMusica = !listar(path.join(dir, 'musica')).some((x) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(x));
    const familia = brief.familia || null;
    let suno = 0;
    try {
      if (falta !== null && sinMusica && !['hablado', 'cantado'].includes(familia) && !['podcast', 'entrevista', 'musical', 'historias-musicales'].includes(estilo) && caminoDeMusica(estilo) === 'suno') suno = CREDITOS_SUNO;
    } catch {
      /* estilo sin regla de música: sin Suno */
    }
    plan = { firma, t: Date.now(), falta: falta === null ? null : falta + suno, saldo: p.saldo };
    cache.set(slug, plan);
  }
  // terminado: ya no falta nada (el plan cuenta piezas que no hicieron falta, como B-roll que no entró)
  const cond = leerJSON(path.join(dir, 'app', 'conductor.json'));
  if (cond && ['listo', 'terminado'].includes(cond.estado)) plan = { ...plan, falta: 0 };
  const gastado = sumaLog(path.join(dir, 'img', 'log-modelos.json'), 'imagenes') + sumaLog(path.join(dir, 'video', 'log-modelos.json'), 'clips');
  const saldo = (await saldoKie()) ?? plan.saldo ?? null;
  return {
    falta: conDolares(plan.falta),
    gastado: conDolares(gastado),
    total: plan.falta === null ? null : conDolares(gastado + plan.falta),
    saldo: conDolares(saldo),
    semaforo: semaforo(saldo, plan.falta),
  };
}
