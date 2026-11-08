// La duracion de un anuncio, en un solo lugar (la usan el servidor y la pantalla: src/ la importa tal cual, asi que
// aca no va nada de Node).
//
// En el sistema la duracion no se elige: la IA escribe el guion con el tiempo que el anuncio necesita para mostrar
// lo que tiene que mostrar (gancho, problema, solucion, prueba, llamado a la accion). Si el usuario dice un tiempo
// ("2 minutos"), ese tiempo es APROXIMADO: la IA escribe para mas o menos ese tiempo, y si se pasa o le falta un poco
// esta bien. Nunca se calcula nada por la velocidad de la voz.
//
// Como queda en temp/<slug>/app/brief.json (brief.duracion):
//   { "decide": "ia" }                                              la decide la IA (lo recomendado, y lo de siempre)
//   { "decide": "usuario", "texto": "2 minutos", "segundos": 120 }   lo que escribio el usuario, y sus segundos aprox.
//   null                                                            el musical corto: no lleva duracion (la pone la cancion)
// Los anuncios de antes guardaban un numero (30, 45, 60; 240 a 600 en la historia musical): se leen como lo que dijo
// el usuario, aproximado (leerDuracion).

/** Los estilos sin duracion: el musical corto (la pone la cancion). */
export const conDuracion = (estilo) => estilo !== 'musical';

export const MINIMO_S = 10;
export const MAXIMO_S = 20 * 60;

const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

const UNIDADES = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const SUELTOS = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, cien: 100,
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const MIN = 'minutos?|mins?|m|minutes?';
const SEG = 'segundos?|segs?|s|secs?|seconds?';
const NUM = '\\d+(?:\\.\\d+)?';
const RELLENO = /\b(?:aprox(?:imadamente|imado|\.)?|alrededor de|cerca de|mas o menos|maximo|minimo|unos|unas|como|de|que dure|dure|durar|quiero|quisiera|tipo|entre)\b|[~≈±]/g;

/** "dos minutos y medio" -> "2.5 min" · "treinta y cinco segundos" -> "35 segundos" (sin tildes, en minusculas). */
function numerosEnCifras(t) {
  return t
    .replace(new RegExp(`\\b(${Object.keys(DECENAS).join('|')})(?:\\s+y\\s+(${Object.keys(UNIDADES).join('|')}))?\\b`, 'g'), (_, d, u) => String(DECENAS[d] + (u ? UNIDADES[u] : 0)))
    .replace(new RegExp(`\\b(${Object.keys(SUELTOS).join('|')})\\b`, 'g'), (_, w) => String(SUELTOS[w]))
    .replace(new RegExp(`\\b(${Object.keys(UNIDADES).join('|')})\\b`, 'g'), (_, w) => String(UNIDADES[w]))
    .replace(/\bmedio\s+(minuto|min)\b/g, '0.5 min')
    .replace(new RegExp(`(${NUM})\\s*(?:${MIN})\\s+y\\s+medio\\b`, 'g'), (_, n) => `${Number(n) + 0.5} min`)
    .replace(/\bminuto\s+y\s+medio\b/g, '1.5 min')
    .replace(/\bmedia\s+hora\b/g, '0.5 h');
}

/**
 * Lo que escribio el usuario ("35 s", "1 minuto", "2 minutos", "1:30", "minuto y medio", "1 min 20 s", "40-50 s"),
 * en segundos aproximados: { ok: true, segundos } o { ok: false, motivo } (el motivo se le muestra tal cual).
 */
export function entenderDuracion(texto) {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return { ok: false, motivo: 'Escribe cuánto quieres que dure, por ejemplo 45 s o 2 minutos.' };
  let t = numerosEnCifras(sinTildes(crudo.toLowerCase()).replace(/(\d),(\d)/g, '$1.$2'));
  t = t.replace(RELLENO, ' ').replace(/\s+/g, ' ').trim();
  let seg = null;
  let m;
  if ((m = t.match(/^(\d{1,2}):([0-5]\d)(?:\s*(?:min|minutos?))?$/))) seg = Number(m[1]) * 60 + Number(m[2]);
  // "1 hora", "media hora": se entiende, para decir que es muy largo (no "no entiendo")
  else if ((m = t.match(new RegExp(`^(${NUM})\\s*(?:horas?|hrs?|h)$`)))) seg = Number(m[1]) * 3600;
  else if ((m = t.match(new RegExp(`^(${NUM})\\s*(?:-|–|a|y|o)\\s*(${NUM})\\s*(${MIN}|${SEG})$`)))) {
    seg = ((Number(m[1]) + Number(m[2])) / 2) * (new RegExp(`^(?:${MIN})$`).test(m[3]) ? 60 : 1);
  } else {
    // pares numero + unidad: "1 min 30 s", "1 minuto y 20 segundos", "1m30s"; "2 min 30" (sin unidad despues de minutos)
    const pares = [...t.matchAll(new RegExp(`(${NUM})\\s*(${MIN}|${SEG})?(?![a-z])`, 'g'))];
    const resto = t.replace(new RegExp(`(${NUM})\\s*(${MIN}|${SEG})?(?![a-z])`, 'g'), ' ').replace(/\b(?:y|con)\b|[,.+]/g, ' ').trim();
    if (!pares.length || resto) return { ok: false, motivo: `No entiendo «${crudo.slice(0, 40)}». Escríbelo así: 35 s, 1 minuto o 2 minutos.` };
    if (!pares[0][2] && Number(pares[0][1]) > 0) return { ok: false, motivo: '¿Segundos o minutos? Escríbelo así: 45 s o 2 min.' };
    if (!pares[0][2]) return { ok: false, motivo: `Es muy corto: pon al menos ${MINIMO_S} s.` };
    seg = 0;
    let anterior = null;
    for (const [, n, u] of pares) {
      const unidad = u ? (new RegExp(`^(?:${MIN})$`).test(u) ? 'min' : 's') : anterior === 'min' ? 's' : null;
      if (!unidad || (anterior && unidad === anterior)) return { ok: false, motivo: `No entiendo «${crudo.slice(0, 40)}». Escríbelo así: 35 s, 1 minuto o 2 minutos.` };
      seg += Number(n) * (unidad === 'min' ? 60 : 1);
      anterior = unidad;
    }
  }
  seg = Math.round(seg);
  if (!Number.isFinite(seg) || seg < 0) return { ok: false, motivo: `No entiendo «${crudo.slice(0, 40)}». Escríbelo así: 35 s, 1 minuto o 2 minutos.` };
  if (seg < MINIMO_S) return { ok: false, motivo: `Es muy corto: pon al menos ${MINIMO_S} s.` };
  if (seg > MAXIMO_S) return { ok: false, motivo: `Es muy largo: pon como mucho ${MAXIMO_S / 60} min.` };
  return { ok: true, segundos: seg };
}

/** 35 -> "35 s" · 120 -> "2 min" · 150 -> "2 min 30 s" */
export function duracionCorta(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  if (s < 60) return `${s} s`;
  const r = s % 60;
  return r ? `${Math.floor(s / 60)} min ${r} s` : `${s / 60} min`;
}

/** 35 -> "unos 35 s" · 60 -> "cerca de 1 min" · 120 -> "unos 2 min" · 150 -> "unos 2 min 30 s" */
export function duracionAprox(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  return s >= 60 && s < 120 ? `cerca de ${duracionCorta(s)}` : `unos ${duracionCorta(s)}`;
}

/** Un largo de antes (segundos) como lo habria escrito el usuario: 45 -> "45 s" · 300 -> "5 min". */
const largoDeAntes = (s) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);

/**
 * brief.duracion (el de ahora o el numero de antes) -> null (sin duracion) | { decide: 'ia' } |
 * { decide: 'usuario', texto, segundos }. `estilo` (opcional): el musical corto nunca lleva duracion.
 */
export function leerDuracion(valor, estilo) {
  if (estilo && !conDuracion(estilo)) return null;
  if (typeof valor === 'number') return valor > 0 ? { decide: 'usuario', texto: largoDeAntes(valor), segundos: valor } : { decide: 'ia' };
  if (valor && typeof valor === 'object' && valor.decide === 'usuario' && Number(valor.segundos) > 0) {
    return { decide: 'usuario', texto: String(valor.texto || largoDeAntes(Number(valor.segundos))), segundos: Number(valor.segundos) };
  }
  if (valor && typeof valor === 'object' && valor.decide === 'ia') return { decide: 'ia' };
  // un texto suelto ("2 minutos") o lo que dijo sin los segundos, si alguien lo escribio a mano en el brief
  const texto = typeof valor === 'string' ? valor : valor && typeof valor === 'object' && valor.decide === 'usuario' ? String(valor.texto ?? '') : '';
  const r = texto.trim() ? entenderDuracion(texto) : null;
  if (r?.ok) return { decide: 'usuario', texto: texto.trim(), segundos: r.segundos };
  return estilo ? { decide: 'ia' } : null;
}

/** Lo que pidio el usuario, en segundos aproximados (null si la decide la IA o el estilo no lleva). */
export function segundosPedidos(brief) {
  const d = leerDuracion(brief?.duracion, brief?.estilo);
  return d?.decide === 'usuario' ? d.segundos : null;
}

/**
 * Lo que dice el informe de la duracion pedida: solo el dato, sin compararlo con lo que salio (" Pediste unos 2 min.").
 * Con la duracion que decide la IA (o sin duracion), nada.
 */
export function notaPedida(brief) {
  const s = segundosPedidos(brief);
  return s ? ` Pediste ${duracionAprox(s)}.` : '';
}
