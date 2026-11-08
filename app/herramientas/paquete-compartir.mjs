// El paquete para compartir la app con otras personas: un zip limpio, sin nada tuyo.
//
//   npm run paquete                      deja anuncios-con-ia-app.zip en tu Escritorio (o en esta carpeta)
//   node app/herramientas/paquete-compartir.mjs <destino.zip>
//
// Lleva solo lo que está en el repositorio (git ls-files): nunca el .env (tus claves), ni temp/ ni output/ (tus
// anuncios: van vacías), ni mis_archivos/ (tus preferencias, tu biblioteca, tus anuncios de GitHub), ni el contexto
// del proyecto. En su lugar van unas preferencias en blanco, el LEEME sin la parte de clonar tu repositorio y la
// guía corta EMPIEZA-AQUI.md.
//
// Cada persona que lo abre instala todo con el lanzador, pega SUS claves (kie.ai y ElevenLabs) en Ajustes y usa SU
// cuenta de Claude. Nada de lo suyo llega a tu GitHub: sin repositorio propio, la app guarda todo en su computador.
// El nombre del zip es el mismo que espera «Actualizar la app» (Ajustes, Acerca de): con uno nuevo se actualizan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escribirZip, esEjecutable } from './zip.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARPETA = 'Anuncios con IA';

// lo que nunca va (además de lo que no está en el repositorio)
const FUERA = [/^mis_archivos\//, /^temp\//, /^output\//, /^respaldos\//, /^CONTEXTO-PROYECTO\.md$/, /^app\/esp\.png$/, /^\.github\//, /^\.claude\/settings\.local\.json$/, /(^|\/)\.env$/];

const PREFERENCIAS = `# Mis preferencias

Valen para todos los anuncios que hace la app. Claude las lee al escribir cada guion y van por encima de su
criterio. Escribe una regla por viñeta, en español sencillo. También se editan desde la app: Ajustes → Aprendizajes.

## Ejemplos (bórralos o cámbialos)
- Las personas se ven ultra realistas, como un video de celular, nunca con "cara de IA".
- Cuando hablan varios personajes, cada uno con una voz distinta.
`;

const EMPIEZA = `# Empieza aquí · anuncios-IA

De tu producto a un anuncio listo para Meta y TikTok, en tu propio computador (Mac o Windows).

## Lo que necesitas

- **Tu cuenta de Claude** con un plan de pago (Pro o Max). Los guiones los escribe Claude con TU cuenta.
- **Una clave de kie.ai** con saldo (imágenes, videos y música): https://kie.ai/api-key — saldo en https://kie.ai/billing
- **Una clave de ElevenLabs** (la voz): https://elevenlabs.io/app/settings/api-keys
- Unos **5 GB libres** en el disco.

Cada uno paga solo lo suyo. Tus claves quedan en tu computador: nunca se las pases a nadie.

## En 4 pasos

1. **Descomprime el zip** y deja la carpeta «${CARPETA}» en tu carpeta de usuario
   (no en Escritorio, Documentos ni Descargas).
2. **Doble clic en el lanzador:** «Abrir ${CARPETA}.command» en Mac o «Abrir ${CARPETA}.bat» en Windows.
   La primera vez instala lo que falte (tarda unos minutos) y abre la app en el navegador.
   - Mac: la primera vez, clic derecho sobre el archivo → Abrir → Abrir.
   - Windows: si dice «Windows protegió su PC», toca «Más información» → «Ejecutar de todas formas».
3. **Inicia sesión en Claude** cuando la app te lo pida (la bienvenida te guía).
4. **Pega tus dos claves** en Ajustes → Conexiones. Listo: toca «Nuevo anuncio».

Deja abierta la ventana negra mientras uses la app. Más detalle en LEEME.md.
`;

function leemeSinRepositorio() {
  let t = fs.readFileSync(path.join(RAIZ, 'LEEME.md'), 'utf8');
  // la parte de clonar el repositorio es solo para quien lo tiene; el paquete se usa desde el zip
  t = t.replace(/### Desde GitHub[\s\S]*?(?=### Desde el zip)/, '');
  return t.replace('### Desde el zip', '### Cómo empezar desde el zip');
}

function principal(destinoArg) {
  let archivos;
  try {
    archivos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }).toString('utf8').split('\0').filter(Boolean);
  } catch {
    console.error('Esta carpeta no es un repositorio de git: el paquete se arma desde el repositorio, para no llevar nada tuyo.');
    process.exit(1);
  }
  const escritorio = path.join(os.homedir(), 'Desktop');
  const destino = path.resolve(destinoArg || path.join(fs.existsSync(escritorio) ? escritorio : RAIZ, 'anuncios-con-ia-app.zip'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-anuncios-'));
  const generado = (nombre, texto) => {
    const f = path.join(tmp, nombre.replace(/\//g, '_'));
    fs.writeFileSync(f, texto, 'utf8');
    return f;
  };
  const reemplazos = {
    'LEEME.md': generado('LEEME.md', leemeSinRepositorio()),
  };

  const entradas = [];
  let fuera = 0;
  for (const rel of archivos) {
    if (FUERA.some((r) => r.test(rel))) {
      fuera++;
      continue;
    }
    const origen = reemplazos[rel] || path.join(RAIZ, rel);
    if (!fs.existsSync(origen) || !fs.statSync(origen).isFile()) continue;
    entradas.push({ nombre: `${CARPETA}/${rel}`, origen, ejecutable: esEjecutable(rel) });
  }
  entradas.push({ nombre: `${CARPETA}/EMPIEZA-AQUI.md`, origen: generado('EMPIEZA-AQUI.md', EMPIEZA) });
  entradas.push({ nombre: `${CARPETA}/mis_archivos/preferencias.md`, origen: generado('preferencias.md', PREFERENCIAS) });
  for (const v of ['temp', 'output']) entradas.push({ nombre: `${CARPETA}/${v}/`, origen: null });

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  escribirZip(destino, entradas);
  fs.rmSync(tmp, { recursive: true, force: true });
  const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(0);
  console.log(`\n  Paquete listo: ${destino}`);
  console.log(`  ${entradas.length} archivos, ${mb} MB. Quedaron fuera ${fuera} archivos tuyos (anuncios, biblioteca, preferencias).`);
  console.log('  Súbelo a Google Drive y comparte el link. Quien lo baje empieza por EMPIEZA-AQUI.md.\n');
}

principal(process.argv[2]);
