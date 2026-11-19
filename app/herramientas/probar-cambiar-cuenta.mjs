// Prueba de «Cambiar de cuenta» de Claude (lib/claude.js abrirLogin({ cambiar }) y el aviso al conductor), con un
// Claude Code de mentira que guarda su cuenta en un archivo, sin internet ni cuentas de verdad:
//   node app/herramientas/probar-cambiar-cuenta.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cuenta-claude-'));
const CUENTA = path.join(TMP, 'cuenta.txt');
const PASOS = path.join(TMP, 'pasos.txt');
const FALSO = path.join(TMP, 'claude-falso.js');
fs.writeFileSync(CUENTA, 'primera@ejemplo.com');
fs.writeFileSync(
  FALSO,
  `const fs = require('node:fs');
const a = process.argv.slice(2);
const cuenta = ${JSON.stringify(CUENTA)};
const pasos = ${JSON.stringify(PASOS)};
fs.appendFileSync(pasos, a.join(' ') + '\\n');
if (a[0] === '--version') console.log('2.1.300 (Claude Code)');
else if (a[0] === 'auth' && a[1] === 'status') {
  const email = fs.existsSync(cuenta) ? fs.readFileSync(cuenta, 'utf8').trim() : '';
  console.log(JSON.stringify(email ? { loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email } : { loggedIn: false }));
} else if (a[0] === 'auth' && a[1] === 'logout') fs.rmSync(cuenta, { force: true });
else if (a[0] === 'auth' && a[1] === 'login') setTimeout(() => fs.writeFileSync(cuenta, 'segunda@ejemplo.com'), 300);
`
);
process.env.ANUNCIOS_CLAUDE_BIN = FALSO;

const claude = await import('../server/lib/claude.js');
const colas = await import('../server/lib/colas.js');
await import('../server/lib/conductor.js'); // (escucha el cambio de cuenta)

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 400)}`}`);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const antes = await claude.estadoClaude();
  check('Arranca con la primera cuenta', antes.sesion === 'ok' && antes.cuenta?.email === 'primera@ejemplo.com', antes);
  colas.pausarClaude({ motor: 'claude' });
  check('Se acabó el uso: la fila de Claude queda en pausa', Boolean(colas.pausaDeClaude('claude')));
  const avisos = [];
  claude.alCambiarCuentaClaude((x) => avisos.push(x));

  check('«Cambiar de cuenta» abre el inicio de sesión', claude.abrirLogin({ cambiar: true }) === true);
  let ahora = null;
  for (let i = 0; i < 40; i++) {
    await dormir(250);
    ahora = await claude.estadoClaude();
    if (ahora.cuenta?.email === 'segunda@ejemplo.com') break;
  }
  const pasos = fs.readFileSync(PASOS, 'utf8').split('\n').filter((l) => l.startsWith('auth ') && l !== 'auth status');
  check('Primero cierra la sesión de la cuenta anterior y después abre el inicio de sesión', pasos.join(',') === 'auth logout,auth login', pasos);
  check('La app nota la cuenta nueva en segundos (no espera 10 min)', ahora?.cuenta?.email === 'segunda@ejemplo.com', ahora);
  check('Avisa que entró otra cuenta', avisos.length === 1 && avisos[0].antes === 'primera@ejemplo.com' && avisos[0].ahora === 'segunda@ejemplo.com', avisos);
  check('Con la cuenta nueva, la fila de Claude sale de la pausa', colas.pausaDeClaude('claude') === null);
  claude.olvidarEstadoClaude();
  await claude.estadoClaude();
  check('La misma cuenta otra vez no vuelve a avisar', avisos.length === 1, avisos);
  const fila = colas.claudeEnFila({ lanzarSesion: async () => ({ ok: false, limite: true, motor: 'claude' }) });
  await fila.lanzarSesion({}); // (se acaba el uso: pausa)
  const msj = (await fila.lanzarSesion({})).error || '';
  colas.reanudarClaude('claude');
  check('El aviso de «se acabó el uso» dice que puedes cambiar de cuenta', /Cambiar de cuenta/.test(msj), msj);
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);
