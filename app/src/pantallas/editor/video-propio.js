// Tus propios videos en el editor (plan.videoPropio, 2026-11-14): quitar una escena o recortar su borde quita esos
// segundos de verdad (imagen y audio) y el video queda más corto. Lo hace el servidor (POST
// /api/videos-propios/:slug/quitar, que rehace el plan y el audio); aquí se corre lo del editor que va en tiempos
// del video: los textos e imágenes, la música y los subtítulos (por índice, con el mapa que devuelve el servidor).
// Cada corte es un paso del historial del editor: ed.corte guarda la versión del video, y deshacer o rehacer la pone.
import { pedirNuevo } from '../../datos/api.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
/** Un segundo del video de antes en el de ahora, si se quitó [a, b]. */
const correr = (t, a, b) => (t <= a ? t : t >= b ? t - (b - a) : a);

function remapear(obj, mapa) {
  const salida = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const n = mapa[k];
    if (n !== null && n !== undefined) salida[n] = v;
  }
  return salida;
}

/** Los cambios del editor después de quitar [a, b] del video. */
export function edicionSinTramo(ed, a, b, mapa = {}) {
  const intervalo = (x) => {
    if (x.inicio === undefined || x.fin === undefined || x.inicio === null || x.fin === null) return x;
    const inicio = r3(correr(Number(x.inicio), a, b));
    const fin = r3(correr(Number(x.fin), a, b));
    return fin - inicio < 0.1 ? null : { ...x, inicio, fin };
  };
  // lo que sigue a un texto del video: sus puntos también se corren (los de la parte quitada se van)
  const conSigue = (x) => {
    const sigue = x?.sigue;
    if (!sigue) return x;
    const listas = Array.isArray(sigue.pistas) ? sigue.pistas : Array.isArray(sigue.puntos) ? [sigue.puntos] : [];
    const pistas = listas.map((ps) => ps.filter((p) => !(p[0] > a && p[0] < b)).map((p) => [r3(correr(p[0], a, b)), ...p.slice(1)])).filter((ps) => ps.length);
    const { puntos: _viejos, ...resto } = sigue;
    return { ...x, sigue: pistas.length ? { ...resto, pistas } : undefined };
  };
  const textosNuevos = (ed.textosNuevos || []).map(intervalo).filter(Boolean).map(conSigue);
  const ajustesTextos = Object.fromEntries(
    Object.entries(ed.ajustesTextos || {})
      .map(([id, x]) => [id, intervalo(x)])
      .filter(([, x]) => x)
  );
  let musica = ed.musica;
  if (Array.isArray(musica?.tramos)) {
    const tramos = musica.tramos
      .map((x) => {
        const desde = r3(correr(x.desde, a, b));
        const hasta = r3(correr(x.hasta, a, b));
        if (hasta - desde < 0.1) return null;
        // si se quitó su comienzo, la canción sigue donde iba
        const entrada = x.desde > a && x.desde < b ? r3((x.entrada || 0) + (b - x.desde)) : x.entrada;
        return { ...x, desde, hasta, entrada };
      })
      .filter(Boolean);
    musica = { ...musica, tramos: tramos.length ? tramos : null };
  }
  const ocultos = (ed.ocultos || []).map((i) => mapa[i]).filter((i) => i !== null && i !== undefined);
  return {
    ...ed,
    tomas: null, // las escenas ya son otras (las divisiones que no se usaron se pierden)
    brolls: null,
    textosNuevos,
    ajustesTextos,
    musica,
    correcciones: remapear(ed.correcciones, mapa),
    lugaresSubtitulos: remapear(ed.lugaresSubtitulos, mapa),
    ocultos,
  };
}

export const quitarTramo = (slug, desde, hasta) =>
  pedirNuevo(`/api/videos-propios/${encodeURIComponent(slug)}/quitar`, { metodo: 'POST', cuerpo: { desde, hasta } });

/** Pone el video en esa versión (deshacer y rehacer del editor: ed.corte dice cuál va). */
export const ponerVersion = (slug, version) =>
  pedirNuevo(`/api/videos-propios/${encodeURIComponent(slug)}/version`, { metodo: 'POST', cuerpo: { version } });
