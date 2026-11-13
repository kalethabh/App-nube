// Publica la versión actual de la app para que CUALQUIER persona la instale con un comando (Mac o Windows).
//
//   npm run publicar
//
// 1. Arma el paquete limpio (el mismo de «npm run paquete»: sin tus anuncios, tus claves, tu biblioteca ni tu
//    contexto).
// 2. Lo sube como versión v<VERSION> al repositorio PÚBLICO kalethabh/kads-studio (lo crea la primera vez), que solo
//    guarda el instalador y los zips de cada versión: el código de trabajo y lo tuyo siguen en App-nube, privado.
// 3. Pone al día ahí los instaladores (instalar/), su README y la prueba automática en Mac y Windows.
//
// Quien ya la instaló, la actualiza volviendo a pegar el comando del README. Necesita gh (GitHub CLI) con sesión
// iniciada. No sube nada si VERSION no cambió desde la última publicada (con --forzar, vuelve a subir el zip).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = process.env.KADS_REPO_PUBLICO || 'kalethabh/kads-studio';
const ZIP = 'anuncios-con-ia-app.zip';
const forzar = process.argv.includes('--forzar');

const gh = (args, opciones = {}) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opciones });
const existe = (args) => {
  try {
    gh(args);
    return true;
  } catch {
    return false;
  }
};

function subirArchivo(rel, origen) {
  const contenido = fs.readFileSync(origen).toString('base64');
  let sha = null;
  try {
    sha = JSON.parse(gh(['api', `repos/${REPO}/contents/${rel}`])).sha;
  } catch {}
  const cuerpo = { message: `Instalador: ${rel}`, content: contenido, ...(sha ? { sha } : {}) };
  gh(['api', '-X', 'PUT', `repos/${REPO}/contents/${rel}`, '--input', '-'], { input: JSON.stringify(cuerpo) });
}

function principal() {
  try {
    gh(['auth', 'status']);
  } catch {
    console.error('\n  Falta iniciar sesión en GitHub CLI: corre «gh auth login» y vuelve a intentarlo.\n');
    process.exit(1);
  }
  const version = fs.readFileSync(path.join(RAIZ, 'VERSION'), 'utf8').trim();
  const etiqueta = `v${version}`;

  if (!existe(['repo', 'view', REPO])) {
    console.log(`  Creando el repositorio público ${REPO} (solo el instalador y los zips de cada versión)...`);
    gh(['repo', 'create', REPO, '--public', '--description', 'Kads Studio · Anuncios con IA: instalador para Mac y Windows']);
  }

  console.log('  Instaladores y README...');
  const dir = path.join(RAIZ, 'instalar');
  for (const rel of ['README.md', 'instalar-mac.sh', 'instalar-windows.ps1', '.github/workflows/probar-instalador.yml']) subirArchivo(rel, path.join(dir, rel));

  if (existe(['release', 'view', etiqueta, '--repo', REPO]) && !forzar) {
    console.log(`\n  La versión ${version} ya estaba publicada (los instaladores quedaron al día). Para subir el zip otra vez: npm run publicar -- --forzar\n`);
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-publicar-'));
  try {
    const zip = path.join(tmp, ZIP);
    console.log(`  Armando el paquete ${version}...`);
    execFileSync(process.execPath, [path.join(RAIZ, 'app', 'herramientas', 'paquete-compartir.mjs'), zip], { cwd: RAIZ, stdio: 'inherit' });
    const notas = path.join(tmp, 'notas.md');
    const cambios = fs.readFileSync(path.join(RAIZ, 'CAMBIOS.md'), 'utf8');
    const deEsta = cambios.split(/\n(?=## )/).find((b) => b.startsWith(`## ${version}`)) || `## ${version}`;
    fs.writeFileSync(notas, `${deEsta.trim()}\n\nPara instalar o actualizar, mira el README: un comando en Mac o en Windows.\n`);
    if (existe(['release', 'view', etiqueta, '--repo', REPO])) {
      console.log('  Subiendo el zip (reemplaza el anterior)...');
      gh(['release', 'upload', etiqueta, zip, '--repo', REPO, '--clobber'], { stdio: 'inherit' });
    } else {
      console.log('  Publicando la versión...');
      gh(['release', 'create', etiqueta, zip, '--repo', REPO, '--title', `Kads Studio ${version}`, '--notes-file', notas, '--latest'], { stdio: 'inherit' });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n  Listo: Kads Studio ${version} publicada en https://github.com/${REPO}`);
  console.log('  Mac:     curl -fsSL https://raw.githubusercontent.com/' + REPO + '/main/instalar-mac.sh | bash');
  console.log('  Windows: irm https://raw.githubusercontent.com/' + REPO + '/main/instalar-windows.ps1 | iex\n');
}

principal();
