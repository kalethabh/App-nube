// Instala yt-dlp (gratis, de codigo abierto) para bajar videos de referencia
// desde un link (produccion/bajar-referencias.js). Usa el Python del computador.
//
//   npm run referencias:instalar

import { spawnSync } from 'node:child_process';
import { buscarPython } from './recortar-host.js';
import { comandoYtDlp } from './bajar-referencias.js';

if (comandoYtDlp()) {
  console.log('\n  yt-dlp ya esta instalado.\n');
  process.exit(0);
}
const py = buscarPython();
if (!py) {
  console.error('\n  Falta Python, que se usa para instalar yt-dlp. Instala Python (Paso 7 de INSTALAR.md) y vuelve a correr esto.');
  console.error('  En Mac tambien sirve:  brew install yt-dlp\n');
  process.exit(1);
}
const r = spawnSync(py.cmd, [...py.pre, '-m', 'pip', 'install', '--user', '--upgrade', 'yt-dlp'], { stdio: 'inherit', windowsHide: true });
if (r.status !== 0 || !comandoYtDlp()) {
  console.error('\n  No se pudo instalar yt-dlp con pip. En Mac:  brew install yt-dlp   ·   En Windows:  winget install yt-dlp\n');
  process.exit(1);
}
console.log('\n  Listo: yt-dlp instalado.\n');
