import { desactualizado, motivoParaNoReiniciar, pedirReinicio, reinicioPedido } from '../lib/version.js';
import { soloDesdeLaApp } from '../lib/productos.js';
// GET /api/estado -> si estan las claves (si/no, NUNCA el valor), el programa de la IA elegida y los modelos que usa
//                    el motor:
//   {
//     app: 'anuncios-con-ia',
//     claves: { archivoEnv, kie, elevenlabs },
//     claudeCode: { instalado, version },                       (Claude Code: lo miran tambien los lanzadores)
//     motor: { elegido, nombre, programa, instalado, version }, (la IA elegida: 'claude' | 'codex' | null)
//     codex: { instalado, version },                            (Codex 0.167.0, el de la carpeta de programas de la app)
//     modelos: { imagen, video, respaldo, musica },             (lo elegido en Ajustes › Modelos, con sus nombres)
//     modoPrueba: { activo, listo, error, salidasBloqueadas },   (la banda "Modo prueba: no se gasta nada")
//   }
//
// La sesion de la cuenta (Claude o ChatGPT) sale de GET /api/ia/estado (rutas/ia.js; la de Claude tambien de GET
// /api/claude/estado) y el saldo de kie de GET /api/saldo (rutas/claves.js): las dos tardan y esta respuesta la pide
// todo el menu. Las imagenes, los videos y la musica los hace siempre kie.ai (no hay otro proveedor).
//
// Tambien exporta, para Tu PC (rutas/ajustes.js) y la instalacion (rutas/ia.js):
//   versionClaude() · versionCodex() -> { instalado, version }   olvidarVersiones()   moduloCodex() -> codex.js | null
import { execFile, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAIZ } from '../lib/rutas.js';
import { leerJSON } from '../lib/archivos.js';
import { entornoHijo, resolverClaude } from '../lib/claude.js';
import { VERSION_CODEX, carpetaProgramas, resolverCodex } from '../lib/codex-rutas.js';
import { codexInstalado } from '../lib/instalar-motor.js';
import { motorElegido, datosIA } from '../lib/motor-ia.js';
import { clavesGuardadas, hayArchivoEnv } from '../lib/claves.js';
import { modelosParaConexiones } from '../lib/modelos.js';
import { modoPrueba, iniciarModoPrueba, estadoModoPrueba } from '../lib/modo-prueba.js';

// ---------------------------------------------------------------- Claude Code (solo "claude --version")
// Se guarda 60 s si esta instalado y 5 s si no (para notar enseguida cuando lo instalan). Las
// consultas a la vez comparten la misma.
let cacheClaude = null; // { t, valor, promesa }

export function versionClaude() {
  if (cacheClaude?.promesa) return cacheClaude.promesa;
  if (cacheClaude && Date.now() - cacheClaude.t < (cacheClaude.valor?.instalado ? 60000 : 5000)) return Promise.resolve(cacheClaude.valor);
  const leer = (err, stdout) => {
    if (err) return null;
    const v = String(stdout).match(/\d+\.\d+\.\d+/);
    return { instalado: true, version: v ? v[0] : String(stdout).trim().slice(0, 40) };
  };
  const promesa = new Promise((resolve) => {
    // se busca igual que para lanzar las sesiones (resolverClaude): en el PATH y donde lo deja su instalador
    // oficial (~/.local/bin), aunque la app se haya abierto sin esa carpeta en el PATH
    const opciones = { cwd: RAIZ, timeout: 15000, windowsHide: true, env: entornoHijo() };
    const bin = resolverClaude();
    const porConsola = () =>
      // En Windows, si se instalo con npm es claude.cmd y hace falta la consola para abrirlo.
      exec('claude --version', opciones, (err2, stdout2) => resolve(leer(err2, stdout2) || { instalado: false, version: null }));
    if (!bin) return porConsola();
    execFile(bin.cmd, [...bin.pre, '--version'], opciones, (err, stdout) => {
      const ok = leer(err, stdout);
      if (ok) return resolve(ok);
      porConsola();
    });
  }).then((valor) => {
    cacheClaude = { t: Date.now(), valor, promesa: null };
    return valor;
  });
  cacheClaude = { ...(cacheClaude || {}), promesa };
  return promesa;
}

// ---------------------------------------------------------------- Codex (el binario, su huella y "codex --version")
// Igual que Claude Code: 60 s si esta instalado, 5 s si no. Mientras alguien lo instala (el candado
// <programas>/.instalando-codex de lib/instalar-motor.js, que tambien toma el lanzador) no se lo corre: en Windows un
// .exe abierto no se puede reemplazar.
let cacheCodex = null; // { t, valor, promesa }
const SIN_PROGRAMA = Object.freeze({ instalado: false, version: null });

function instalandoCodexAhora() {
  const c = leerJSON(path.join(carpetaProgramas(), '.instalando-codex'));
  if (!c) return false;
  if (Date.now() - (Date.parse(c.hora || '') || 0) > 20 * 60000) return false; // vencido (como en instalar-motor.js)
  try {
    process.kill(Number(c.pid), 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

export function versionCodex() {
  if (cacheCodex?.promesa) return cacheCodex.promesa;
  if (cacheCodex && Date.now() - cacheCodex.t < (cacheCodex.valor?.instalado ? 60000 : 5000)) return Promise.resolve(cacheCodex.valor);
  if (!resolverCodex()) return Promise.resolve(SIN_PROGRAMA); // sin el binario no hay nada que correr
  if (instalandoCodexAhora()) return Promise.resolve(SIN_PROGRAMA);
  const promesa = codexInstalado()
    .then((ok) => (ok ? { instalado: true, version: VERSION_CODEX } : SIN_PROGRAMA))
    .catch(() => SIN_PROGRAMA)
    .then((valor) => {
      cacheCodex = { t: Date.now(), valor, promesa: null };
      return valor;
    });
  cacheCodex = { ...(cacheCodex || {}), promesa };
  return promesa;
}

/** Que la proxima consulta vuelva a mirar los dos programas (despues de instalar, o "Volver a revisar"). */
export function olvidarVersiones() {
  if (!cacheClaude?.promesa) cacheClaude = null;
  if (!cacheCodex?.promesa) cacheCodex = null;
}

// ---------------------------------------------------------------- codex.js, cuando hace falta
// Se carga recien al usarlo (como en lib/motor-ia.js): si no esta o no carga, lo de Codex no se puede hacer y el
// resto de la app anda igual.
const RUTA_CODEX = fileURLToPath(new URL('../lib/codex.js', import.meta.url));
let avisoCodex = '';

export async function moduloCodex() {
  if (!fs.existsSync(RUTA_CODEX)) return null;
  try {
    return await import('../lib/codex.js');
  } catch (e) {
    const texto = `no pude cargar codex.js: ${e?.message || e}`;
    if (texto !== avisoCodex) console.error(`[ia] ${texto}`);
    avisoCodex = texto;
    return null;
  }
}

/** Lo que la pantalla necesita del modo prueba (sin las direcciones de los simuladores). */
function modoPruebaParaLaPantalla() {
  const e = estadoModoPrueba();
  if (!e.activo) return { activo: false };
  return { activo: true, listo: e.listo, error: e.error ? 'Los simuladores no arrancaron: no se corre nada para no gastar.' : null, salidasBloqueadas: e.salidasBloqueadas.total };
}

export default function rutasEstado(app) {
  // En modo prueba los simuladores y la guardia arrancan con la app (y no recien con el primer paso del motor):
  // asi la banda lo dice desde el principio y un problema se ve antes de producir nada.
  if (modoPrueba()) iniciarModoPrueba().catch((e) => console.error(`\n  [modo prueba] ${e?.message || e}\n`));
  // la primera "codex --version" puede tardar (el antivirus revisa el .exe): se adelanta si la IA es ChatGPT
  if (motorElegido() === 'codex') versionCodex();

  app.get('/api/estado', async (req, res) => {
    const claves = clavesGuardadas();
    const elegido = motorElegido();
    // Codex no hace esperar a esta ruta (los lanzadores la miran con 20 s de tope, lo mismo que tarda en cortarse un
    // `codex --version` lento): con Claude, lo que ya se sabe (se refresca de fondo); con ChatGPT, como mucho 5 s
    const yaSabido = () => cacheCodex?.valor || SIN_PROGRAMA;
    const [claude, codex] = await Promise.all([
      versionClaude(),
      elegido === 'codex'
        ? Promise.race([versionCodex(), new Promise((r) => setTimeout(r, 5000).unref?.()).then(yaSabido)])
        : (versionCodex().catch(() => {}), yaSabido()),
    ]);
    const ia = datosIA(elegido);
    const delMotor = elegido === 'codex' ? codex : elegido === 'claude' ? claude : SIN_PROGRAMA;
    res.set('Cache-Control', 'no-store');
    res.json({
      // la marca de esta app: los lanzadores la miran para saber que lo que responde en el puerto es Anuncios con IA
      app: 'anuncios-con-ia',
      claves: { archivoEnv: hayArchivoEnv(), kie: claves.kie, elevenlabs: claves.elevenlabs },
      claudeCode: claude,
      // la IA elegida (null: todavia no se eligio) y si su programa esta en esta PC
      motor: { elegido, nombre: ia.nombre, programa: ia.programa, instalado: delMotor.instalado === true, version: delMotor.version ?? null },
      codex: { instalado: codex.instalado, version: codex.version },
      // las pastillas de Conexiones: los modelos elegidos en Ajustes › Modelos (el catalogo + la eleccion)
      modelos: modelosParaConexiones(),
      modoPrueba: modoPruebaParaLaPantalla(),
      servidor: { desactualizado: desactualizado(), ocupado: motivoParaNoReiniciar(), reinicioPedido: reinicioPedido() },
    });
  });
  app.post('/api/reiniciar', soloDesdeLaApp, (req, res) => {
    if (!pedirReinicio()) return res.status(202).json({ ok: true, pendiente: true, mensaje: motivoParaNoReiniciar() });
    res.json({ ok: true });
  });
}
