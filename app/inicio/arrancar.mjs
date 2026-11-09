// Arranca el servidor de la app y lo vuelve a levantar cuando pide reiniciarse (código 75): así, después de
// «Actualizar», lo nuevo del servidor y del motor se usa sin cerrar la ventana. Lo usan los lanzadores
// («Abrir Anuncios con IA.command» y «.bat»). Cualquier otro final (cerrar la ventana, un error) termina aquí.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CODIGO_REINICIO = 75;
const SERVIDOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'index.js');

function arrancar() {
  const hijo = spawn(process.execPath, [SERVIDOR, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, AIA_SUPERVISADO: '1' } });
  const pasar = (senal) => () => hijo.kill(senal);
  const senales = ['SIGINT', 'SIGTERM', 'SIGHUP'].filter((s) => process.platform !== 'win32' || s !== 'SIGHUP');
  const manejadores = senales.map((s) => [s, pasar(s)]);
  for (const [s, f] of manejadores) process.on(s, f);
  hijo.on('exit', (codigo, senal) => {
    for (const [s, f] of manejadores) process.off(s, f);
    if (codigo === CODIGO_REINICIO) {
      console.log('\n Reiniciando la app con lo nuevo...\n');
      return arrancar();
    }
    process.exit(senal ? 1 : codigo ?? 1);
  });
}
arrancar();
