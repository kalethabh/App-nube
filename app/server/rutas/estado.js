// GET /api/estado -> si estan las claves (si/no, NUNCA el valor), si esta Claude Code y los modelos
//                    que usa el motor:
//   {
//     claves: { archivoEnv, kie, elevenlabs },
//     claudeCode: { instalado, version },
//     modelos: { imagen, video, respaldo, musica },
//     modoPrueba: { activo, listo, error, salidasBloqueadas },   (la banda "Modo prueba: no se gasta nada")
//   }
//
// La sesion de la cuenta de Claude ("claude auth status") sale de GET /api/claude/estado y el saldo
// de kie de GET /api/saldo (rutas/claves.js): las dos tardan y esta respuesta la pide todo el menu.
// Las imagenes, los videos y la musica los hace siempre kie.ai (no hay otro proveedor).
import { execFile, exec } from 'node:child_process';
import { RAIZ } from '../lib/rutas.js';
import { entornoHijo, resolverClaude } from '../lib/claude.js';
import { clavesGuardadas, hayArchivoEnv } from '../lib/claves.js';
import { modelosDelMotor } from '../lib/modelos.js';
import { modoPrueba, iniciarModoPrueba, estadoModoPrueba } from '../lib/modo-prueba.js';

// ---------------------------------------------------------------- Claude Code (solo "claude --version")
// Se guarda 60 s si esta instalado y 5 s si no (para notar enseguida cuando lo instalan). Las
// consultas a la vez comparten la misma.
let cacheClaude = null; // { t, valor, promesa }

function versionClaude() {
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

  app.get('/api/estado', async (req, res) => {
    const claves = clavesGuardadas();
    const claude = await versionClaude();
    res.set('Cache-Control', 'no-store');
    res.json({
      // la marca de esta app: los lanzadores la miran para saber que lo que responde en el puerto es Anuncios con IA
      app: 'anuncios-con-ia',
      claves: { archivoEnv: hayArchivoEnv(), kie: claves.kie, elevenlabs: claves.elevenlabs },
      claudeCode: claude,
      // los nombres de los modelos que usa el motor hoy (leidos de produccion/config.js como texto)
      modelos: modelosDelMotor(),
      modoPrueba: modoPruebaParaLaPantalla(),
    });
  });
}
