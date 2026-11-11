// Deja listo el programa de la IA elegida. Lo llaman los dos lanzadores después de preparar-app.mjs, con Node.js ya
// en el PATH:
//   1. migrarMotor(): antes solo existía Claude, así que quien ya pasó la bienvenida usaba Claude (se guarda
//      `motor: 'claude'` una sola vez). Va antes que el servidor: así un alumno que se actualiza ya tiene su IA y su
//      Claude Code se reinstala si falta, como hacían los lanzadores.
//   2. Con la IA elegida:
//        ninguna   no instala nada: «Tu IA (Claude o ChatGPT) la eliges en la app.» (sin «Aviso:»)
//        claude    si falta Claude Code, lo instala con el instalador oficial de Anthropic
//        codex     si falta Codex 0.167.0, o hay otra versión, lo instala (npm ci con su lockfile; de respaldo, el
//                  paquete oficial de la release)
// Nunca frena el lanzador: sale siempre con 0. Si algo falla, lo dice y la app ayuda en Ajustes › Conexiones.
//   node app/inicio/preparar-motor.mjs [--motor claude|codex]      (--motor y AIA_MOTOR: solo para el CI)
const MAC = process.platform === 'darwin';
const decir = (t = '') => console.log(t ? ` ${t}` : '');

const i = process.argv.indexOf('--motor');
if (i >= 0) {
  const m = String(process.argv[i + 1] || '').toLowerCase();
  if (m === 'claude' || m === 'codex') process.env.AIA_MOTOR = m;
}

async function preparar() {
  // la IA elegida (con la migración de una sola vez antes; con AIA_MOTOR, el CI la fija sin tocar config.json)
  let motor;
  try {
    const ia = await import('../server/lib/motor-ia.js');
    if (!process.env.AIA_MOTOR) {
      try {
        ia.migrarMotor();
      } catch {
        /* sin poder guardar, se sigue con lo que haya */
      }
    }
    motor = ia.motorElegido();
  } catch {
    const m = String(process.env.AIA_MOTOR || '').toLowerCase();
    motor = m === 'claude' || m === 'codex' ? m : undefined;
  }
  if (motor === undefined) {
    decir('Aviso: no se pudo revisar el programa de tu IA. La app te ayuda en Ajustes › Conexiones.');
    return;
  }
  if (!motor) {
    decir('Tu IA (Claude o ChatGPT) la eliges en la app.');
    return;
  }
  const instalar = await import('../server/lib/instalar-motor.js');

  if (motor === 'claude') {
    const { resolverClaude } = await import('../server/lib/claude.js');
    // en Windows, como el lanzador de antes: solo el claude.exe del instalador oficial cuenta como listo (el claude.cmd
    // de npm puede ser una version vieja, sin --permission-prompts); se instala el oficial y la app lo prefiere
    const oficial = (b) => Boolean(b) && (process.platform !== 'win32' || b.via === 'exe' || b.via === 'prueba');
    if (oficial(resolverClaude())) {
      decir('Claude Code: listo.');
      return;
    }
    decir();
    decir('Instalando Claude Code con el instalador oficial de Anthropic (solo la primera vez)...');
    decir('Si tu internet es lento puede tardar varios minutos: no cierres esta ventana.');
    // (con su avance a la vista en esta ventana, como antes)
    const r = await instalar.instalarClaude({ verSalida: true });
    decir(r.ok && (r.simulado || oficial(resolverClaude())) ? 'Claude Code listo.' : 'Aviso: no se pudo instalar Claude Code. La app te ayuda a instalarlo en Ajustes › Conexiones.');
    return;
  }

  // codex (con AIA_CODEX_FORZAR_RELEASE=1, el CI, solo cuenta la instalación por la release, como en instalarCodex)
  if (await instalar.codexInstalado({ via: process.env.AIA_CODEX_FORZAR_RELEASE === '1' ? 'release' : undefined })) {
    decir('Codex: listo.');
    return;
  }
  decir();
  decir(`Instalando Codex (solo la primera vez, unos ${MAC ? 150 : 180} MB)...`);
  const r = await instalar.instalarCodex({
    // las frases del avance, sin el porcentaje (cada una una vez)
    alProgreso: (frase, extra) => {
      if (extra?.porcentaje === undefined) decir(frase);
    },
  });
  if (r.ok) return; // (la última frase ya fue «Codex listo.»)
  decir(r.ocupado ? r.error : 'Aviso: no se pudo instalar Codex. La app te ayuda a instalarlo en Ajustes › Conexiones.');
}

try {
  await preparar();
} catch {
  decir('Aviso: no se pudo revisar el programa de tu IA. La app te ayuda en Ajustes › Conexiones.');
}
process.exit(0);
