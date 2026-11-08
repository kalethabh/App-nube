// Cómo se escriben números, tiempos y dinero en toda la app (español, sin jerga).

const conPuntos = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 56.05 -> "0:56" · 287 -> "4:47" · 3725 -> "1:02:05" */
export function duracion(seg) {
  if (seg === null || seg === undefined || Number.isNaN(Number(seg))) return '—';
  const s = Math.max(0, Math.round(Number(seg)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** 56 -> "56 s" · 287 -> "4 min 47 s" · 600 -> "10 min" */
export function duracionEnPalabras(seg) {
  if (seg === null || seg === undefined) return '—';
  const s = Math.max(0, Math.round(Number(seg)));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** Código de tiempo del editor: 12.4 -> "00:12.40" (minutos:segundos.centésimas) */
export function codigoDeTiempo(seg) {
  const s = Math.max(0, Number(seg) || 0);
  const m = Math.floor(s / 60);
  const resto = s - m * 60;
  return `${String(m).padStart(2, '0')}:${resto.toFixed(2).padStart(5, '0')}`;
}

/** 9.71 -> "US$ 9,71" */
export function dinero(usd, { decimales = 2 } = {}) {
  if (usd === null || usd === undefined || Number.isNaN(Number(usd))) return '—';
  const n = Number(usd).toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales, useGrouping: true });
  return `US$ ${n}`;
}

/** 1942 -> "1.942 cr" */
export function creditos(n) {
  if (n === null || n === undefined) return '—';
  return `${conPuntos(n)} cr`;
}

/** 1942 -> "1.942" */
export function numero(n) {
  if (n === null || n === undefined) return '—';
  return conPuntos(n);
}

/** 0.423 -> "42 %" */
export function porcentaje(x) {
  if (x === null || x === undefined) return '—';
  return `${Math.round(Number(x) * 100)} %`;
}

/** 19480597 -> "18,6 MB" */
export function tamano(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = Number(bytes);
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: i >= 2 ? 1 : 0 })} ${u[i]}`;
}

/** ISO -> "hace 5 min", "ayer", "hace 3 días", "12 sept." */
export function fechaRelativa(iso) {
  if (!iso) return '—';
  const t = new Date(iso);
  const dif = (Date.now() - t.getTime()) / 1000;
  if (dif < 60) return 'hace un momento';
  if (dif < 3600) return `hace ${Math.floor(dif / 60)} min`;
  if (dif < 86400) return `hace ${Math.floor(dif / 3600)} h`;
  const dias = Math.floor(dif / 86400);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return t.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(dias > 300 ? { year: 'numeric' } : {}) });
}

/** ISO -> "12 de septiembre, 22:15" */
export function fechaCompleta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** "es" -> "Español" · "LatAm" -> "Latinoamérica" */
export function idioma(cod) {
  return { es: 'Español', en: 'Inglés', pt: 'Portugués' }[cod] || cod || '—';
}
export function mercado(m) {
  return { LatAm: 'Latinoamérica', US: 'Estados Unidos', EEUU: 'Estados Unidos', BR: 'Brasil' }[m] || m || '—';
}

/** plural(3, 'clip', 'clips') -> "3 clips" */
/** "1 toma se arregló sola" · "3 partes se arreglaron solas": la producción y el informe cuentan igual (por toma). */
export const arregladasSolas = (n, soloTomas = true) => `${n} ${soloTomas ? (n === 1 ? 'toma' : 'tomas') : n === 1 ? 'parte' : 'partes'} se ${n === 1 ? 'arregló sola' : 'arreglaron solas'}`;

/** "La IA revisa" -> "la IA revisa": solo la primera letra, y no si es una sigla ("IA", "ElevenLabs" quedan igual). */
export function enMinuscula(s) {
  const t = String(s || '');
  if (!t || /^[A-ZÁÉÍÓÚÑ]{2}/.test(t) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+[A-Z]/.test(t.split(' ')[0])) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

export function plural(n, uno, varios) {
  return `${numero(n)} ${n === 1 ? uno : varios}`;
}
