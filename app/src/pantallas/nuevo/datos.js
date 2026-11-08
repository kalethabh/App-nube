// Cómo lee "Nuevo anuncio" lo que devuelve el servidor (producto, ficha, guion, voces), en un solo lugar.
// Las respuestas se leen con cuidado (campos que pueden faltar o venir con otra forma) para que la
// pantalla nunca se rompa por un dato que todavía no llegó.
import { idioma as nombreIdioma, mercado as nombreMercado } from '../../datos/formato.js';

// ---------------------------------------------------------------- tareas de Claude (ficha y guion)

const CORRIENDO = new Set(['escribiendo', 'corriendo', 'analizando', 'esperando', 'pendiente', 'en-curso', 'trabajando', 'leyendo', 'cambiando']);
const FALLO = new Set(['error', 'fallo', 'fallida', 'fallo-claude', 'cancelada']);

/** Las frases de avance, siempre como lista de textos. */
export function frasesDe(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map((f) => (typeof f === 'string' ? f : f?.frase || f?.texto || '')).filter(Boolean);
}

/**
 * GET /api/productos/:id -> { producto, ficha, tarea } con la tarea normalizada:
 * tarea.estado: "sin" (nunca se analizó) | "analizando" | "lista" | "error"
 */
export function leerProducto(r) {
  if (!r) return { producto: null, ficha: null, tarea: { estado: 'sin', progreso: [], error: null } };
  const producto = r.producto || r;
  const ficha = r.ficha ?? producto.ficha ?? null;
  const t = r.tarea ?? r.analisis ?? producto.tarea ?? null;
  const crudo = typeof t === 'string' ? t : t?.estado;
  let estado = 'sin';
  if (CORRIENDO.has(crudo)) estado = 'analizando';
  else if (FALLO.has(crudo)) estado = 'error';
  else if (ficha) estado = 'lista';
  else if (crudo && crudo !== 'sin') estado = 'error'; // terminó sin dejar la ficha
  const error =
    estado !== 'error'
      ? null
      : (typeof t === 'object' && t?.error) || (crudo && !FALLO.has(crudo) ? 'Claude terminó, pero no dejó la ficha de tu producto.' : 'No pude armar la ficha.');
  return {
    producto,
    ficha: estado === 'analizando' ? null : ficha,
    tarea: {
      estado,
      progreso: frasesDe(typeof t === 'object' ? t?.progreso : r.progreso),
      error,
      limite: Boolean(typeof t === 'object' && t?.limite),
      reinicio: typeof t === 'object' ? t?.reinicio || null : null,
      inicio: typeof t === 'object' ? t?.inicio || null : null,
    },
  };
}

/**
 * GET /api/anuncios/:slug/guion -> { estado: "escribiendo" | "listo" | "error", fase: "guion" | "letras", guion, letras,
 * progreso, error }. En el musical lo que se lee son las letras (letras.opciones, letras.elegida).
 */
export function leerGuion(r) {
  // sin respuesta todavia: 'cargando' (nunca "Claude esta escribiendo" para un guion que quiza ya esta listo)
  if (!r) return { estado: 'cargando', fase: 'guion', guion: null, letras: null, progreso: [], error: null };
  const crudo = r.estado;
  const hay = Boolean(r.guion || r.letras);
  const estado = CORRIENDO.has(crudo) ? 'escribiendo' : FALLO.has(crudo) ? 'error' : crudo === 'listo' && hay ? 'listo' : crudo === 'listo' ? 'error' : 'escribiendo';
  return {
    estado,
    fase: r.fase || 'guion',
    familia: r.familia || null,
    letras: r.letras && Array.isArray(r.letras.opciones) ? r.letras : null,
    guion: r.guion || null,
    progreso: frasesDe(r.progreso),
    error: estado === 'error' ? r.error || (crudo === 'listo' ? 'El guion llegó vacío.' : 'No pude escribir el guion.') : null,
    limite: Boolean(r.limite || r.error?.limite),
    reinicio: r.reinicio || null,
    // un cambio en curso (o que falló) y lo que pidió el usuario
    cambiando: Boolean(r.cambiando),
    pedido: r.pedido || null,
    // ya aprobado: el anuncio está en producción (o ya terminó)
    aprobado: Boolean(r.aprobado),
    terminado: Boolean(r.terminado),
    piezas: r.piezas || null,
    puedeAprobar: r.puedeAprobar !== false,
    productoId: r.productoId || r.brief?.productoId || null,
    brief: r.brief || null,
    inicio: r.inicio || null,
  };
}

/** Qué tipo de falla es (para mostrar el botón que corresponde). */
export function tipoDeFalla(error, { limite = false } = {}) {
  if (!error && !limite) return null;
  const e = typeof error === 'string' ? { mensaje: error } : error || {};
  const tipo = String(e.tipo || e.codigo || '').toLowerCase();
  const texto = `${tipo} ${e.mensaje || e.message || ''}`.toLowerCase();
  if (limite || e.limite || tipo === 'limite' || /l[ií]mite de uso|usage limit|hit your .*limit|rate.?limit/.test(texto)) return 'limite';
  if (tipo === 'sin-claude' || /no est[aá] instalad|instala claude|falta claude code/.test(texto)) return 'sin-claude';
  if (tipo === 'sin-sesion' || /sin sesi[oó]n|inicia(r)? sesi[oó]n|no hay sesi[oó]n|not logged|auth login/.test(texto)) return 'sin-sesion';
  if (tipo === 'bloqueo' || Array.isArray(e.faltan)) return 'bloqueo';
  if (tipo === 'no-valido' || tipo === 'validacion' || /valid|esquema|schema|no pas[oó]/.test(texto)) return 'no-valido';
  if (tipo === 'tiempo' || /tard[oó] demasiado|timeout|se pas[oó] de tiempo/.test(texto)) return 'tiempo';
  return 'otro';
}

export const mensajeDe = (error) => (typeof error === 'string' ? error : error?.mensaje || error?.message || '');

// ---------------------------------------------------------------- la ficha del producto

/** Los campos de ficha.json que se muestran, en el orden de la tarjeta. */
export const CAMPOS_FICHA = [
  { id: 'queEs', etiqueta: 'Qué es' },
  { id: 'beneficios', etiqueta: 'Beneficios', lista: true },
  { id: 'publico', etiqueta: 'Para quién es' },
  { id: 'dolor', etiqueta: 'El dolor' },
  { id: 'oferta', etiqueta: 'Precio y oferta' },
  { id: 'comoCompra', etiqueta: 'Cómo compra tu cliente' },
  { id: 'mercado', etiqueta: 'Dónde vendes', formato: nombreMercado },
  { id: 'idioma', etiqueta: 'Idioma del anuncio', formato: nombreIdioma },
  // Lo que Claude saca de la página (reseñas, cifras, dosis…) también entra al guion: se ve y se corrige. Vacías y
  // sin pregunta, no se muestran.
  { id: 'prueba', etiqueta: 'Un dato real o una prueba', opcional: true },
  { id: 'comoSeUsa', etiqueta: 'Cómo se usa', opcional: true },
  { id: 'ingredientes', etiqueta: 'Ingredientes', opcional: true },
  { id: 'probo', etiqueta: 'Lo que ya probó', opcional: true },
  { id: 'pais', etiqueta: 'País', opcional: true },
];

// Nombres de los campos que la ficha puede pedir y no están arriba.
const OTROS_CAMPOS = {
  nombre: 'Nombre del producto',
  precio: 'Precio',
  resenas: 'Reseñas reales',
  reseñas: 'Reseñas reales',
  dosis: 'Cómo se toma',
  modoDeUso: 'Cómo se usa',
  comoSeUsa: 'Cómo se usa',
  pais: 'País',
  ingredientes: 'Ingredientes',
  garantia: 'Garantía',
  envio: 'Envío',
  probo: 'Lo que ya probó',
  objecion: 'La objeción',
  prueba: 'Un dato real o una prueba',
  marca: 'Cómo se pronuncia la marca',
};

export function etiquetaDeCampo(campo) {
  const c = CAMPOS_FICHA.find((x) => x.id === campo);
  if (c) return c.etiqueta;
  if (OTROS_CAMPOS[campo]) return OTROS_CAMPOS[campo];
  const t = String(campo || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return t ? t[0].toUpperCase() + t.slice(1) : 'Dato';
}

const vacio = (v) => v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

/** Lo que la IA no sabe y pregunta: [{ campo, pregunta }] (sin repetidos). */
export function faltanDe(ficha) {
  const vistos = new Set();
  return (Array.isArray(ficha?.falta) ? ficha.falta : [])
    .map((f) => (typeof f === 'string' ? { campo: f, pregunta: '' } : f))
    .filter((f) => f?.campo && !vistos.has(f.campo) && vistos.add(f.campo))
    .map((f) => ({ campo: f.campo, pregunta: f.pregunta || `¿${etiquetaDeCampo(f.campo)}?` }));
}

/**
 * Las filas de la ficha, cada una con su origen:
 *   pagina (de tu página, tus fotos o lo que contaste) · dedujo (amarillo) · falta (rojo, se pregunta abajo)
 *   vacio (sin dato y sin pregunta: se puede escribir) · corregido (lo cambiaste tú) · respondido (lo contestaste abajo)
 */
export function filasDeFicha(ficha, correcciones = {}, respuestas = {}) {
  if (!ficha) return [];
  const deducido = new Set(Array.isArray(ficha.deducido) ? ficha.deducido : []);
  const faltan = new Map(faltanDe(ficha).map((f) => [f.campo, f]));
  const filas = CAMPOS_FICHA.map((c) => ({ ...c, valor: ficha[c.id] }));
  // lo que falta y no tiene fila propia (p. ej. "dosis") también se ve, en rojo
  for (const f of faltan.values()) {
    if (f.campo !== 'nombre' && !filas.some((x) => x.id === f.campo)) filas.push({ id: f.campo, etiqueta: etiquetaDeCampo(f.campo), valor: ficha[f.campo] });
  }
  return filas
    .map((c) => {
      const corregido = correcciones[c.id];
      const respondido = respuestas[c.id];
      let origen = 'pagina';
      let valor = c.valor;
      if (!vacio(corregido)) {
        origen = 'corregido';
        valor = corregido;
      } else if (!vacio(respondido)) {
        origen = 'respondido';
        // la respuesta se suma a lo que ya decia el campo (asi la guarda la app): se ve lo que va a usar el guion
        const base = typeof c.valor === 'string' ? c.valor.trim() : '';
        const resp = String(respondido).trim();
        valor = base && !base.includes(resp) ? `${base.replace(/[.\s]+$/, '')}. ${resp}` : base || respondido;
      } else if (faltan.has(c.id)) origen = vacio(valor) ? 'falta' : 'completar';
      else if (vacio(valor)) origen = 'vacio';
      else if (deducido.has(c.id)) origen = 'dedujo';
      if (origen !== 'corregido' && origen !== 'respondido' && c.formato && typeof valor === 'string') valor = c.formato(valor);
      return { ...c, valor, origen, pregunta: faltan.get(c.id)?.pregunta || null };
    })
    .filter((c) => !(c.opcional && c.origen === 'vacio'));
}

export const TIPOS_PRODUCTO = { fisico: 'Físico', digital: 'Digital', servicio: 'Servicio' };

// ---------------------------------------------------------------- voces de ElevenLabs

// Las etiquetas de ElevenLabs vienen en inglés: las más comunes, en palabras de la app.
const PALABRAS_VOZ = {
  female: 'mujer',
  male: 'hombre',
  neutral: 'neutra',
  young: 'joven',
  'middle aged': 'de mediana edad',
  middle_aged: 'de mediana edad',
  'middle-aged': 'de mediana edad',
  old: 'mayor',
  'latin american': 'acento latino',
  latino: 'acento latino',
  mexican: 'acento mexicano',
  argentine: 'acento argentino',
  colombian: 'acento colombiano',
  peruvian: 'acento peruano',
  spanish: 'acento de España',
  castilian: 'acento de España',
  american: 'acento estadounidense',
  british: 'acento británico',
  brazilian: 'acento brasileño',
};

/** GET /api/voces -> { voces: [{ id, nombre, muestra, detalle }], porDefecto } */
export function leerVoces(r, estilo) {
  const lista = Array.isArray(r) ? r : Array.isArray(r?.voces) ? r.voces : [];
  const voces = lista
    .map((v) => {
      const et = v.etiquetas || v.labels;
      const partes = Array.isArray(et) ? et : et && typeof et === 'object' ? [et.gender, et.age, et.accent] : [];
      const detalle = partes
        .filter(Boolean)
        .map((p) => PALABRAS_VOZ[String(p).toLowerCase()] || String(p).toLowerCase())
        .slice(0, 3)
        .join(', ');
      return { id: v.id || v.voice_id, nombre: v.nombre || v.name || 'Voz sin nombre', muestra: v.muestra || v.preview_url || null, detalle, ultima: Boolean(v.ultima || v.porDefecto) };
    })
    .filter((v) => v.id);
  const marcada = voces.find((v) => v.ultima)?.id;
  const delServidor = r?.vozPorEstilo?.[estilo];
  const porDefecto = [typeof delServidor === 'object' ? delServidor?.id : delServidor, marcada, recordado(`voz:${estilo}`)].find((id) => id && voces.some((v) => v.id === id));
  return { voces, porDefecto: porDefecto || '' };
}

// ---------------------------------------------------------------- slugs

/** "befen-claymation-20261025-1432" -> "claymation" (la clave del estilo va en el medio del slug). */
export function estiloDeSlug(slug, claves) {
  const s = String(slug || '');
  return [...claves].sort((a, b) => b.length - a.length).find((c) => s.includes(`-${c}-`) || s.startsWith(`${c}-`)) || null;
}

// ---------------------------------------------------------------- lo que recuerda este navegador
// Solo comodidades (el borrador del formulario, la última voz): lo que importa vive en el servidor.

export function recordado(clave, porDefecto = null) {
  try {
    const v = window.localStorage.getItem(`anuncios-ia:nuevo:${clave}`);
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}

export function recordar(clave, valor) {
  try {
    if (valor === null || valor === undefined) window.localStorage.removeItem(`anuncios-ia:nuevo:${clave}`);
    else window.localStorage.setItem(`anuncios-ia:nuevo:${clave}`, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}
