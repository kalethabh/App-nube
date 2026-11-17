// Datos de Ajustes, de la Bienvenida y del pie del menú.
//
//   const { datos: ajustes } = useAjustes();   -> preferencias, bienvenidaVista, app (marca y versión), equipo ("Tu PC")
//   await apiAjustes.guardarPreferencias({ subtitulos: 'pop' })
//   await apiAjustes.marcarBienvenida(true)
//   await apiAjustes.guardarModelos({ vozEnOff: 'grok15' })  -> PUT /api/ajustes/modelos (ajustes.modelos: { eleccion, categorias })
//
//   await apiAjustes.guardarClave('kie', valor)   -> PUT /api/claves (la prueba antes de guardarla)
//   await apiAjustes.probarClave('elevenlabs')    -> POST /api/claves/probar: { ok, mensaje }
//   const { datos } = useSaldo(activo)            -> GET /api/saldo: { kie: { creditos, dolares, consultado } | { creditos: null, error } }
//   const motor = useMotor()                      -> tu IA (Claude o ChatGPT), GET /api/ia/estado, al día en todas las pantallas:
//     { id, nombre, programa, cuenta, planes, elegido, instalado, version, sesion, avisoPlan, listo, instalando, login,
//       elegir(m), instalar(), iniciarSesion({ conCodigo }), cancelarLogin(), salir() }
//
// Las claves viajan solo del navegador al servidor: ninguna respuesta trae su valor.
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { apiNuevo, invalidar, useDatos } from '../../datos/api.js';
import { useAvisos } from '../../componentes/Avisos.jsx';

class ErrorAjustes extends Error {
  constructor(mensaje, estado, datos) {
    super(mensaje);
    this.estado = estado;
    this.datos = datos;
  }
}

async function pedir(url, { metodo = 'GET', cuerpo } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: metodo,
      headers: { Accept: 'application/json', ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorAjustes('No pude conectar con la app. ¿Sigue abierta la ventana del servidor?', 0, null);
  }
  let datos = null;
  try {
    datos = await r.json();
  } catch {
    datos = null;
  }
  if (!r.ok) throw new ErrorAjustes(datos?.error || 'Algo salió mal. Vuelve a intentarlo.', r.status, datos);
  return datos;
}

// ---------------------------------------------------------------- avisar que cambió una conexión
// Cada pantalla tiene su propia copia de /api/estado y /api/saldo (el menú, Ajustes, la Bienvenida). Cuando se guarda
// una clave o cambia algo de tu IA, todas vuelven a mirar. Tu IA (/api/ia/estado) es una sola copia para todas.
const EVENTO = 'anuncios-ia:conexiones';

export function avisarConexiones() {
  invalidar('estado');
  invalidar('saldo');
  invalidar('claude-estado');
  refrescarIA();
  try {
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* sin ventana: nada que avisar */
  }
}

/** Llama a `recargar` cada vez que cambia una conexión (en cualquier pantalla). */
export function useAlCambiarConexiones(recargar) {
  useEffect(() => {
    if (!recargar) return undefined;
    const h = () => recargar();
    window.addEventListener(EVENTO, h);
    return () => window.removeEventListener(EVENTO, h);
  }, [recargar]);
}

export const apiAjustes = {
  leer: () => pedir('/api/ajustes'),
  guardarPreferencias: async (cambios) => {
    const r = await pedir('/api/ajustes/preferencias', { metodo: 'PUT', cuerpo: cambios });
    invalidar('ajustes');
    return r;
  },
  /**
   * Los modelos de IA de los anuncios nuevos: { vozEnOff: 'grok15' } (solo lo que cambia).
   * Responde { ok, modelos: { eleccion, categorias } }. Las pastillas de Conexiones salen de /api/estado: también se refrescan.
   * Los costos estimados guardados (pantallas/nuevo/CostoEstimado.jsx) se calcularon con la elección de antes: se olvidan
   * todos (lo cambies aquí o con «Usar este»).
   */
  guardarModelos: async (cambios) => {
    const r = await pedir('/api/ajustes/modelos', { metodo: 'PUT', cuerpo: cambios });
    invalidar('ajustes');
    invalidar('estado');
    invalidar('costo:');
    return r;
  },
  /** "Volver a revisar" de Tu PC: el servidor mide todo de nuevo en la próxima lectura (después, recargar). */
  revisarPC: () => pedir('/api/ajustes/revisar', { metodo: 'POST', cuerpo: {} }),
  marcarBienvenida: async (vista = true) => {
    const r = await pedir('/api/ajustes/bienvenida', { metodo: 'PUT', cuerpo: { vista } });
    invalidar('ajustes');
    return r;
  },

  // ---------------------------------------------------------------- claves y saldo
  /** { kie, elevenlabs, avisos? }. Si el servicio dice que la clave no existe, tira el error y no se guarda. */
  guardarClave: async (cual, valor) => {
    try {
      return await pedir('/api/claves', { metodo: 'PUT', cuerpo: { [cual]: valor } });
    } finally {
      avisarConexiones();
    }
  },
  /** { ok, mensaje, motivo?, saldoKie? }: una consulta gratis al servicio. */
  probarClave: async (cual) => {
    try {
      return await pedir('/api/claves/probar', { metodo: 'POST', cuerpo: { cual } });
    } finally {
      if (cual === 'kie') avisarConexiones();
    }
  },
  saldo: ({ fresco = false } = {}) => pedir(`/api/saldo${fresco ? '?fresco=1' : ''}`),
  // ---------------------------------------------------------------- cuenta de Claude
  /**
   * { instalado, version, sesion: "ok" | "sin-sesion" | "desconocido", cuenta? }.
   * Nunca tira: si la ruta no responde vuelve { sinRespuesta: true } y la sesión queda "sin comprobar".
   */
  claude: async () => {
    try {
      return await pedir('/api/claude/estado');
    } catch {
      return { sinRespuesta: true };
    }
  },
  iniciarSesionClaude: async () => {
    try {
      return await pedir('/api/claude/login', { metodo: 'POST', cuerpo: {} });
    } finally {
      invalidar('claude-estado');
    }
  },
};

export const useAjustes = () => useDatos('ajustes', apiAjustes.leer);

/** El saldo real de kie. `activo` en false (sin clave guardada) no pregunta nada. */
export function useSaldo(activo = true) {
  const r = useDatos(activo ? 'saldo' : null, () => apiAjustes.saldo());
  useAlCambiarConexiones(activo ? r.recargar : null);
  return r;
}

// ---------------------------------------------------------------- tu IA (Claude o ChatGPT)
// La IA se nombra por su nombre ("Claude" o "ChatGPT") y "tu IA" si todavía no hay una elegida. Los programas
// (Claude Code y Codex) se nombran en Ajustes y en los avisos de lo que falta para que trabaje.

/** Las dos IA, con los mismos textos que el servidor (lib/motor-ia.js, MOTORES). */
export const MOTORES = Object.freeze({
  claude: Object.freeze({ id: 'claude', nombre: 'Claude', programa: 'Claude Code', cuenta: 'tu cuenta de Claude', planes: 'Pro o Max' }),
  codex: Object.freeze({ id: 'codex', nombre: 'ChatGPT', programa: 'Codex', cuenta: 'tu cuenta de ChatGPT', planes: '' }),
});
const SIN_IA = Object.freeze({ id: null, nombre: 'tu IA', programa: 'el programa de tu IA', cuenta: 'tu cuenta', planes: '' });

export const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
/** La otra IA ('claude' <-> 'codex'). */
export const otraIA = (id) => (id === 'codex' ? 'claude' : 'codex');
/** El nombre de la IA de algo que ya se hizo (lo que mandó el servidor). Sin dato, Claude: antes solo existía Claude. */
export const nombreDeIA = (id, porDefecto = 'Claude') => MOTORES[id]?.nombre || porDefecto;

/** Lo que tarda en mirar de nuevo mientras se instala o se inicia sesión, y hasta cuándo espera la ventana de Claude. */
const MIRAR_MS = 3000;
const ESPERA_CLAUDE_MS = 10 * 60 * 1000;
const INSTALACION_MAX_MS = 40 * 60 * 1000;

// Una sola copia de /api/ia/estado para todas las pantallas (el menú, la cabecera, los avisos…): lo que ve una lo ven
// todas, y mientras algo se instala o se inicia sesión la mira un solo reloj.
const ia = {
  datos: null,
  t: 0,
  promesa: null,
  otraVez: null, // un pedido forzado que llegó con otra consulta en camino: se pregunta de nuevo cuando termine
  fallos: 0, // las veces seguidas que no respondió sin haber respondido nunca (para espaciar los reintentos)
  version: 0,
  esperaClaude: 0, // cuándo se abrió la ventana de Claude (0 = no se espera)
  anterior: null, // la IA de antes, después de "Cambiar de IA": el enlace "Volver a …"
  porPuerto: false, // el navegador no pudo abrir el inicio de sesión de ChatGPT: se entra con un código
  sinCodigo: false, // ChatGPT no deja entrar con un código: queda solo el navegador
};
const oyentes = new Set();
let reloj = null;

function instalacionEnMarcha(ins) {
  if (!ins || ins.error || ins.ok === true || ins.terminado || ins.listo) return false;
  if (typeof ins.fase === 'string' && /\blisto\.?$/i.test(ins.fase.trim())) return false;
  const desde = ins.desde ? new Date(ins.desde).getTime() : NaN;
  return !(Number.isFinite(desde) && Date.now() - desde > INSTALACION_MAX_MS);
}

function hayQueMirar() {
  const d = ia.datos;
  if (!d) return false;
  if (d.sinRespuesta) return true; // nunca respondió: se vuelve a preguntar mientras haya una pantalla abierta
  if (instalacionEnMarcha(d.instalando) || d.login?.enCurso) return true;
  if (ia.esperaClaude && Date.now() - ia.esperaClaude < ESPERA_CLAUDE_MS) {
    const c = d.motores?.claude;
    return !(c?.instalado && c?.sesion === 'ok');
  }
  return false;
}

function programar() {
  clearTimeout(reloj);
  reloj = null;
  // (sin ninguna respuesta todavía, después del segundo intento cada 10 s)
  const ms = ia.datos?.sinRespuesta && ia.fallos > 1 ? 10000 : MIRAR_MS;
  if (oyentes.size && hayQueMirar()) reloj = setTimeout(() => refrescarIA(), ms);
}

function cambio() {
  ia.version += 1;
  for (const f of oyentes) f();
  programar();
}

/** Vuelve a preguntar por tu IA (todas las pantallas se enteran). Sin `forzar`, sirve lo leído hace menos de 5 s. */
export function refrescarIA({ forzar = true } = {}) {
  if (ia.promesa) {
    // la que está en camino salió antes del cambio (elegir otra IA, iniciar sesión…): un pedido forzado pregunta otra
    // vez cuando termine, y todos los que lleguen mientras tanto comparten esa
    if (!forzar) return ia.promesa;
    if (!ia.otraVez)
      ia.otraVez = ia.promesa.then(() => {
        ia.otraVez = null;
        return refrescarIA();
      });
    return ia.otraVez;
  }
  if (!forzar && ia.datos && Date.now() - ia.t < 5000) return Promise.resolve(ia.datos);
  ia.promesa = apiNuevo.ia
    .estado()
    .then(
      (d) => {
        ia.datos = d && typeof d === 'object' ? d : { sinRespuesta: true };
        ia.fallos = ia.datos.sinRespuesta ? ia.fallos + 1 : 0;
      },
      () => {
        // sin respuesta: lo de antes sigue; sin nada antes, "sin comprobar" (nunca "Falta" sin saber)
        if (!ia.datos) ia.datos = { sinRespuesta: true };
        if (ia.datos.sinRespuesta) ia.fallos += 1;
      }
    )
    .then(() => {
      ia.t = Date.now();
      ia.promesa = null;
      cambio();
      return ia.datos;
    });
  return ia.promesa;
}

function suscribir(f) {
  oyentes.add(f);
  if (oyentes.size === 1) programar();
  return () => {
    oyentes.delete(f);
    if (!oyentes.size) {
      clearTimeout(reloj);
      reloj = null;
    }
  };
}
const leerVersion = () => ia.version;

/** El nombre de la IA elegida ahora, para lo que no es una pantalla (la simulación). Sin elegir, `porDefecto`. */
export const nombreIAActual = (porDefecto = 'Claude') => MOTORES[ia.datos?.elegido]?.nombre || porDefecto;
/** El programa de la IA elegida ahora ("Claude Code" o "Codex"). */
export const programaIAActual = (porDefecto = 'Claude Code') => MOTORES[ia.datos?.elegido]?.programa || porDefecto;

/** "Free" / "Go": el plan como lo dice la gente. */
const nombrePlan = (p) => (p ? String(p).replace(/^./, (c) => c.toUpperCase()) : '');

/**
 * Tu IA, al día en todas las pantallas:
 *   id / elegido     'claude' | 'codex' | null (todavía no elegiste)
 *   nombre, programa, cuenta, planes   'Claude' · 'Claude Code' · 'tu cuenta de Claude' · 'Pro o Max' (sin elegir: 'tu IA'…)
 *   instalado        true | false | null (revisando) · version · otraVersion (Codex que no es la de la app)
 *   sesion           'ok' | 'sin-sesion' | 'desconocido' | null · email · otraCuenta (entró con una clave de API)
 *   avisoPlan        el plan de ChatGPT (Free o Go) que puede no incluir Codex, o ''
 *   listo            elegida, instalada y sin "falta la sesión" (una sesión sin comprobar no frena; un inicio de sesión
 *                    de ChatGPT abierto sí: hasta que termina no está lista)
 *   conectado        con la sesión comprobada · revisando (todavía no se sabe) · falta (se sabe que no está lista)
 *   instalando       { motor, fase, desde, porcentaje?, error? } de esta IA · instalandoAhora · falloInstalar · enUso
 *   login            el inicio de sesión de ChatGPT { enCurso, modo, url?, enlace?, codigo?, error? } · esperando
 *   elegir(m), volverA(m), instalar(), iniciarSesion({ conCodigo }), cancelarLogin(), salir(), recargar()
 */
export function useMotor() {
  useSyncExternalStore(suscribir, leerVersion, leerVersion);
  const { aviso } = useAvisos();
  const pidio = useRef(null); // la IA a la que ESTA pantalla le pidió iniciar sesión (para avisar cuando entra)

  useEffect(() => {
    refrescarIA({ forzar: false });
  }, []);

  const d = ia.datos && !ia.datos.sinRespuesta ? ia.datos : null;
  const elegido = d && MOTORES[d.elegido] ? d.elegido : null;
  const info = elegido ? MOTORES[elegido] : SIN_IA;
  const m = elegido ? d.motores?.[elegido] || null : null;
  const instalado = !d ? null : !elegido ? false : typeof m?.instalado === 'boolean' ? m.instalado : null;
  const otraVersion = elegido === 'codex' && Boolean(m?.instalado && m?.actualizar);
  const sesion = !instalado ? null : ['ok', 'sin-sesion'].includes(m?.sesion) ? m.sesion : 'desconocido';
  // mientras se inicia sesión en ChatGPT el servidor dice 'desconocido': no está lista (así se ven el código, «Cancelar»…)
  const enLogin = elegido === 'codex' && Boolean(d?.login?.enCurso);
  const listo = Boolean(elegido && instalado && !otraVersion && sesion !== 'sin-sesion' && !enLogin);
  const conectado = Boolean(elegido && instalado && !otraVersion && sesion === 'ok');
  const revisando = !d || Boolean(elegido && instalado === null);
  const ins = d?.instalando && (!d.instalando.motor || d.instalando.motor === elegido) ? d.instalando : null;
  const login = elegido === 'codex' && d?.login && typeof d.login === 'object' ? d.login : null;
  const esperandoClaude = elegido === 'claude' && ia.esperaClaude > 0 && Date.now() - ia.esperaClaude < ESPERA_CLAUDE_MS && sesion !== 'ok';
  const datosCuenta = m?.cuenta && typeof m.cuenta === 'object' ? m.cuenta : null;
  const avisoPlan = elegido === 'codex' && sesion === 'ok' && m?.avisoPlan ? nombrePlan(typeof m.avisoPlan === 'string' ? m.avisoPlan : datosCuenta?.plan) || 'Free' : '';

  const iniciarSesion = useCallback(
    async ({ conCodigo = false } = {}) => {
      const id = MOTORES[ia.datos?.elegido] ? ia.datos.elegido : null;
      if (!id) return;
      let r;
      try {
        r = await apiNuevo.ia.login(id, { conCodigo });
      } catch (e) {
        aviso({ tipo: 'error', titulo: 'No pude abrir el inicio de sesión', texto: e.message });
        return;
      }
      pidio.current = id;
      if (id === 'claude') {
        ia.esperaClaude = Date.now();
        aviso({ tipo: 'info', titulo: 'Se abrió la ventana de Claude', texto: 'Entra con tu cuenta Pro o Max y vuelve aquí.', duracion: 9000 });
      } else if (!conCodigo) {
        ia.porPuerto = false;
        // solo si de verdad quedó abierto (con el puerto ocupado ya vuelve cerrado y con su error: lo explica la fila)
        const l = r?.login;
        if (!l || (l.enCurso !== false && !l.error)) aviso({ tipo: 'info', titulo: 'Se abrió tu navegador', texto: 'Entra con tu cuenta de ChatGPT y vuelve aquí.', duracion: 9000 });
      }
      await refrescarIA();
    },
    [aviso]
  );

  // la sesión que pidió esta pantalla: avisa cuando entra, y si el navegador no pudo abrirse, pasa al código
  const errorLogin = login && !login.enCurso ? login.error || null : null;
  useEffect(() => {
    const id = pidio.current;
    if (!id || id !== elegido) return;
    if (conectado) {
      pidio.current = null;
      ia.esperaClaude = 0;
      ia.porPuerto = false;
      aviso({ tipo: 'ok', titulo: `${MOTORES[id].nombre} quedó conectado`, texto: 'Tus guiones se escriben con tu cuenta.' });
      avisarConexiones();
      return;
    }
    if (id !== 'codex' || !errorLogin) return;
    if (errorLogin === 'puerto' && !ia.porPuerto) {
      ia.porPuerto = true;
      iniciarSesion({ conCodigo: true });
    } else if (errorLogin === 'sin-codigo' && !ia.sinCodigo) {
      ia.sinCodigo = true;
      cambio();
    }
  }, [conectado, elegido, errorLogin, aviso, iniciarSesion]);

  /** Guarda otra IA. Tira el error del servidor (409: tu IA está escribiendo algo ahora). */
  const elegir = useCallback(async (nueva, { recordar = false } = {}) => {
    const antes = MOTORES[ia.datos?.elegido] ? ia.datos.elegido : null;
    const r = await apiNuevo.ia.elegir(nueva);
    ia.anterior = recordar && antes && antes !== nueva ? antes : null;
    ia.esperaClaude = 0;
    ia.porPuerto = false;
    pidio.current = null;
    avisarConexiones();
    await refrescarIA();
    return r;
  }, []);

  /** Elige la IA y, si le falta su programa, lo empieza a instalar (los botones "Conectar con …"). */
  const conectarCon = useCallback(
    async (nueva, { recordar = false } = {}) => {
      try {
        await elegir(nueva, { recordar });
      } catch (e) {
        aviso({ tipo: 'error', titulo: 'No pude elegir tu IA', texto: e.message });
        return;
      }
      const e = ia.datos?.motores?.[nueva];
      const falta = e && (e.instalado === false || (nueva === 'codex' && e.actualizar)) && !e.enUso;
      if (falta && !instalacionEnMarcha(ia.datos?.instalando)) {
        try {
          await apiNuevo.ia.instalar(nueva);
        } catch (err) {
          aviso({ tipo: 'error', titulo: 'No pude empezar a instalarlo', texto: err.message });
        }
        await refrescarIA();
      }
    },
    [elegir, aviso]
  );

  const instalar = useCallback(async () => {
    const id = MOTORES[ia.datos?.elegido] ? ia.datos.elegido : null;
    if (!id) return;
    try {
      await apiNuevo.ia.instalar(id);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar a instalarlo', texto: e.message });
    }
    await refrescarIA();
  }, [aviso]);

  const cancelarLogin = useCallback(async () => {
    const id = ia.datos?.elegido;
    pidio.current = null;
    ia.esperaClaude = 0;
    ia.porPuerto = false;
    if (id === 'codex') {
      try {
        await apiNuevo.ia.cancelarLogin();
      } catch (e) {
        aviso({ tipo: 'error', titulo: 'No pude cancelar', texto: e.message });
      }
    }
    await refrescarIA();
  }, [aviso]);

  const salir = useCallback(async () => {
    const id = ia.datos?.elegido;
    if (!id) return;
    try {
      await apiNuevo.ia.salir(id);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cerrar la sesión', texto: e.message });
    }
    avisarConexiones();
    await refrescarIA();
  }, [aviso]);

  const anterior = ia.anterior && elegido && ia.anterior !== elegido && !conectado ? ia.anterior : null;

  return {
    id: elegido,
    elegido,
    nombre: info.nombre,
    programa: info.programa,
    cuenta: info.cuenta,
    planes: info.planes,
    instalado,
    version: m?.version || null,
    otraVersion,
    sesion,
    email: datosCuenta?.email || datosCuenta?.correo || null,
    otraCuenta: Boolean(m?.otraCuenta),
    // lo que dice el servidor en palabras simples (p. ej. "entró con una clave de API, no con tu cuenta")
    motivo: typeof m?.motivo === 'string' ? m.motivo : null,
    avisoPlan,
    listo,
    conectado,
    revisando,
    falta: !revisando && !listo,
    instalando: ins,
    instalandoAhora: instalacionEnMarcha(ins),
    falloInstalar: Boolean(ins?.error),
    enUso: Boolean(m?.enUso),
    login,
    porPuerto: ia.porPuerto,
    sinCodigo: ia.sinCodigo,
    esperandoClaude,
    esperando: esperandoClaude || Boolean(login?.enCurso),
    anterior,
    // un servidor de antes, sin /api/ia (solo Claude, sin "Instalar")
    respaldo: Boolean(d?.respaldo),
    elegir,
    volverA: (id) => elegir(id),
    conectarCon,
    instalar,
    iniciarSesion,
    cancelarLogin,
    salir,
    recargar: () => refrescarIA(),
  };
}

/** Copia un texto (el código de ChatGPT) al portapapeles. true si se pudo. */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = texto;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** La cuenta de Claude (GET /api/claude/estado), al día en todas las pantallas. */
export function useClaude(opciones) {
  const r = useDatos('claude-estado', apiAjustes.claude, opciones);
  useAlCambiarConexiones(r.recargar);
  return r;
}

/**
 * Claude junto en un solo lugar, con lo de /api/estado (claude --version) de respaldo mientras
 * /api/claude/estado no responde:
 *   { revisando, instalado, version, sesion: "ok" | "sin-sesion" | "desconocido" | null, cuenta, motivo, listo }
 * listo = instalado y con la sesión iniciada.
 */
export function estadoClaude(estado, claude) {
  const cc = estado?.claudeCode || null;
  const real = claude && !claude.sinRespuesta && typeof claude.instalado === 'boolean' ? claude : null;
  const instalado = real ? Boolean(real.instalado) : cc ? Boolean(cc.instalado) : null;
  const sesion = !instalado ? null : real ? (['ok', 'sin-sesion'].includes(real.sesion) ? real.sesion : 'desconocido') : claude ? 'desconocido' : null;
  return {
    revisando: instalado === null || (instalado && sesion === null),
    instalado,
    version: real?.version || cc?.version || null,
    sesion,
    cuenta: real?.cuenta ?? null,
    // lo que dice la app en palabras simples (p. ej. "entró con una clave de API, no con tu cuenta")
    motivo: typeof real?.motivo === 'string' ? real.motivo : null,
    listo: Boolean(instalado && sesion === 'ok'),
  };
}

/** La cuenta en una línea ("tu@correo.com · Max"), venga como texto o como { email, plan }. */
export function textoCuenta(cuenta) {
  if (!cuenta) return '';
  if (typeof cuenta === 'string') return cuenta;
  const plan = cuenta.plan || cuenta.suscripcion || cuenta.subscriptionType;
  return [cuenta.email || cuenta.correo, plan ? String(plan).replace(/^./, (c) => c.toUpperCase()) : null].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- textos

export const IDIOMAS = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'en', etiqueta: 'Inglés' },
  { valor: 'pt', etiqueta: 'Portugués' },
];

export const MERCADOS = [
  { valor: 'LatAm', etiqueta: 'Latinoamérica' },
  { valor: 'US', etiqueta: 'Estados Unidos' },
  { valor: 'BR', etiqueta: 'Brasil' },
];

/** Bytes a GB redondeados como los dice la gente: 34053414912 -> "32 GB"; 895342223360 -> "834 GB". */
export function gb(bytes, { decimales = 0 } = {}) {
  if (!bytes && bytes !== 0) return '—';
  const v = bytes / 1024 ** 3;
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: decimales, minimumFractionDigits: decimales })} GB`;
}

/** Los estilos cuyas muestras (GET /api/estilos) van en las ilustraciones de la bienvenida, en este orden. */
export const ESTILOS_DE_MUESTRA = ['claymation', 'crochet', 'zack-d-films', 'skeleton', 'talking-object-pixar'];

/** El estilo cuya muestra se ve en el teléfono de la bienvenida. */
export const ESTILO_EJEMPLO = 'claymation';

/** Donde se saca cada clave (las páginas oficiales). */
export const ENLACES_CLAVE = {
  kie: 'https://kie.ai/api-key',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
  meta: 'https://developers.facebook.com/tools/explorer/',
};

/** Donde se recarga el saldo de kie (su página oficial). */
export const ENLACE_RECARGA_KIE = 'https://kie.ai/pricing';

/** Cómo instalar Claude Code a mano (la guía oficial, en español). La app encuentra Claude Code en el PATH. */
export const ENLACE_INSTALAR_CLAUDE = 'https://code.claude.com/docs/es/setup';
// (Codex no tiene enlace "a mano": la app solo usa el Codex que instala ella, en su propia carpeta)
