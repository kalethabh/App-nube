// Datos de Ajustes, de la Bienvenida y del pie del menú.
//
//   const { datos: ajustes } = useAjustes();   -> preferencias, bienvenidaVista, app (marca y versión), equipo ("Tu PC")
//   await apiAjustes.guardarPreferencias({ subtitulos: 'pop' })
//   await apiAjustes.marcarBienvenida(true)
//
//   await apiAjustes.guardarClave('kie', valor)   -> PUT /api/claves (la prueba antes de guardarla)
//   await apiAjustes.probarClave('elevenlabs')    -> POST /api/claves/probar: { ok, mensaje }
//   const { datos } = useSaldo(activo)            -> GET /api/saldo: { kie: { creditos, dolares, consultado } | { creditos: null, error } }
//   const { datos } = useClaude()                 -> GET /api/claude/estado: { instalado, version, sesion, cuenta? }
//   await apiAjustes.iniciarSesionClaude()        -> POST /api/claude/login (abre la ventana oficial de Claude)
//
// Las claves viajan solo del navegador al servidor: ninguna respuesta trae su valor.
import { useEffect } from 'react';
import { invalidar, useDatos } from '../../datos/api.js';

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
// Cada pantalla tiene su propia copia de /api/estado, /api/saldo y /api/claude/estado (el menú,
// Ajustes, la Bienvenida). Cuando se guarda una clave o entra la sesión de Claude, todas vuelven a mirar.
const EVENTO = 'anuncios-ia:conexiones';

export function avisarConexiones() {
  invalidar('estado');
  invalidar('saldo');
  invalidar('claude-estado');
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
};

/** Donde se recarga el saldo de kie (su página oficial). */
export const ENLACE_RECARGA_KIE = 'https://kie.ai/pricing';

/** Cómo instalar Claude Code (la guía oficial, en español). */
export const ENLACE_INSTALAR_CLAUDE = 'https://code.claude.com/docs/es/setup';
