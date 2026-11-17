// Del plan de montaje del anuncio (plan-montaje.json, vía /api/anuncios/:slug) a lo que el editor
// necesita: las pistas de la línea de tiempo y el contexto de la vista previa. Todo es cálculo puro: aquí
// no se guarda ni se pide nada.
//
// Lo que se ve en el video (el plan con los cambios, los subtítulos corregidos, la música, los textos) se
// calcula en remotion/src/edicion/capas.mjs: la misma cuenta que hace el render al exportar, así lo que se
// ve en el editor es lo que sale en el MP4.
import { miniatura } from '../../datos/api.js';
import {
  familia,
  modoVoz,
  numDe,
  musicaDeEdicion,
  textosEnPantalla,
  tomasDeEdicion,
  brollsDeEdicion,
  quietoDeToma,
  cortesPosibles,
  planAjustado as ajustarPlan,
  tramosMusica,
  piezaDeArchivo,
  queSePuedeConElClip,
  ajusteDeClip,
  tramosVoz,
  audiosDeEdicion,
} from '@composicion/edicion/capas.mjs';
import { urlMusica } from './estado.js';

export {
  FPS,
  ANCHO,
  ALTO,
  familia,
  modoVoz,
  subtitulosEditados,
  planAjustado,
  ajustesSubtitulos,
  ajustesMusica,
  cortesPosibles,
  FUENTES_TEXTO,
  LUGAR_TEXTO,
  LUGAR_IMAGEN,
  MINIMO,
  VELOCIDADES,
  VELOCIDAD_MIN,
  VELOCIDAD_MAX,
  queSePuedeConElClip,
  ajusteDeClip,
  completarEdicion,
  piezaEnTiempo,
  encuadreLimpio,
  buscarDichas,
  palabrasDeLaVoz,
  censurasDe,
  normalPalabra,
  tramosVoz,
  datosNivelVoz,
  nivelVoz,
  FUNDIDO_MAX,
  colorLimpio,
  filtroDeColor,
} from '@composicion/edicion/capas.mjs';

const codificar = (rel) => String(rel).split('/').map(encodeURIComponent).join('/');
export const urlDe = (a, rel) => `${a.base}/${codificar(rel)}`;

/**
 * La url de un archivo del anuncio con su versión («?v=<fecha>», del detalle: a.versionArchivos): una pieza regenerada
 * se llama igual que la de antes y el navegador seguiría mostrando la vieja (la miniatura, el clip del panel).
 */
export function urlConVersion(a, rel) {
  const v = a?.versionArchivos?.[rel];
  return v ? `${urlDe(a, rel)}?v=${v}` : urlDe(a, rel);
}

/** Lo mismo para una url que ya viene en el detalle del anuncio (/archivos/anuncio/<slug>/img/…). */
function versionarUrl(a, url) {
  const pre = `${a.base}/`;
  if (!url || !String(url).startsWith(pre) || String(url).includes('?')) return url;
  try {
    return urlConVersion(a, decodeURIComponent(String(url).slice(pre.length)));
  } catch {
    return url;
  }
}

const capaDe = (p) => p.capa ?? (p.tipo === 'clip' ? 0 : 3);
const capital = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

function nombreEfecto(efecto) {
  const e = String(efecto || '').toLowerCase();
  if (e === 'deep-woosh') return 'Woosh grave';
  if (e.includes('woosh') || e.includes('whoosh')) return 'Woosh';
  if (e.includes('pop')) return 'Pop';
  if (e.includes('golpe') || e.includes('impact')) return 'Golpe';
  return capital(e.replace(/[-_]/g, ' ')) || 'Transición';
}
function nombreSonido(archivo) {
  const base = String(archivo || '').split('/').pop().replace(/\.[^.]+$/, '');
  if (base === 'check') return 'Check';
  if (base === 'congelado') return 'Golpe del congelado';
  return capital(base.replace(/[-_]/g, ' '));
}
const nombreIcono = (archivo) => capital(String(archivo || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/^icono-/, '').replace(/[-_]/g, ' '));

/** "cutaway: A levanta las cejas con un "hmm?" justo despues de ..." -> "A levanta las cejas con un «hmm?»" */
function describirReaccion(porque) {
  let t = String(porque || '').replace(/^cutaway:\s*/i, '');
  t = t.split(/\s+justo\s+|\s+despu[eé]s\s+de\s+|;|\s+\(/)[0];
  t = t.replace(/"([^"]+)"/g, '“$1”').trim();
  // un nombre interno ("b-reaccion-1", "host-a") no dice nada: mejor sin texto
  if (/^(host[\s_-]*)?[ab]?[\s_-]*reacci[oó]n[\s_-]*\d*$/i.test(t) || /^[\w]+(-[\w]+)+$/.test(t)) return null;
  return t ? capital(t) : null;
}

/** La línea del guion que suena en el segundo t. */
/** 'A' -> 'Anfitrión A' · 'entrevistador' -> 'Entrevistador' (para la línea de tiempo). */
export function nombreDeQuienHabla(h) {
  if (!h) return null;
  const s = String(h).trim();
  if (/^[ab]$/i.test(s)) return `Anfitrión ${s.toUpperCase()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lineaEn(plan, t) {
  return (plan.bloques || []).find((b) => t >= b.inicio - 0.05 && t < b.fin) || null;
}

/** Imágenes para las miniaturas: la imagen de la toma o del B-roll si existe; si no, un cuadro del clip. */
function fotos(a) {
  const tomas = new Map((a.tomas || []).map((t) => [t.n, t]));
  const broll = new Map((a.broll || []).map((b) => [b.n, b]));
  return (archivo, segundo = 0.6) => {
    let img = null;
    const nt = numDe(archivo, 'toma');
    if (nt !== null && tomas.get(nt)?.imagenInicial) img = versionarUrl(a, tomas.get(nt).imagenInicial);
    const nb = numDe(archivo, 'broll');
    if (!img && nb !== null && broll.get(nb)?.imagen) img = versionarUrl(a, broll.get(nb).imagen);
    if (!img && /^img\//.test(archivo || '')) img = urlConVersion(a, archivo);
    if (img) return { miniatura: miniatura(img, 160), foto: miniatura(img, 480) };
    const clip = urlConVersion(a, `video/${archivo}`);
    return { miniatura: miniatura(clip, 160, { segundo }), foto: miniatura(clip, 480, { segundo }) };
  };
}

// ---------------------------------------------------------------- música

/**
 * La música que suena ahora (o null), con la dirección desde donde la toca la vista previa: la canción que
 * arrastró el usuario (su archivo en este navegador o la copia guardada en el anuncio), la de otro anuncio o
 * la del anuncio. En los musicales la canción es el anuncio: no hay música aparte.
 */
export function musicaActual(a, plan, ed) {
  return musicaDeEdicion(plan, ed, (fuente, m) => {
    if (fuente === 'propia') return urlMusica(m.id);
    if (fuente === 'biblioteca') return m.url;
    return plan.musica?.archivo ? urlDe(a, plan.musica.archivo) : null;
  });
}

/** El contexto de la composición AnuncioEditado en la vista previa (el render arma el suyo con lo mismo). */
export function contextoDeVista(a, plan, ed, colorAnuncio) {
  return { titulo: a.titulo || '', overlays: a.overlays || [], color: colorAnuncio, musica: musicaActual(a, plan, ed) };
}

// ---------------------------------------------------------------- pistas de la línea de tiempo

export function construirPistas(a, plan, ed, subtitulos, colorAnuncio = null) {
  const dur = plan.duracion || 1;
  const fam = familia(plan);
  const foto = fotos(a);
  const quitados = new Set(ed.quitados);
  const video = [];
  const broll = [];
  const efectos = [];
  const textos = [];

  if (fam === 'bloques') {
    // las tomas y los B-roll con los cortes del usuario (sin cortes, tal como se entregaron)
    const cortes = cortesPosibles(plan);
    const segs = tomasDeEdicion(plan, ed);
    const lista = brollsDeEdicion(plan, ed);
    const visibles = lista.filter((x) => !quitados.has(x.id));
    const partes = (ids) => {
      const cuenta = new Map();
      const n = new Map();
      ids.forEach(({ b }) => cuenta.set(b, (cuenta.get(b) || 0) + 1));
      return ids.map(({ b }) => {
        if (cuenta.get(b) < 2) return null;
        n.set(b, (n.get(b) || 0) + 1);
        return n.get(b);
      });
    };
    const parteToma = partes(segs);
    segs.forEach((s, i) => {
      const o = plan.bloques[s.b];
      // el número y el nombre salen del clip ORIGINAL del plan: con tu video la pieza sigue llamándose igual
      const n = numDe(o.toma.archivo, 'toma') ?? o.linea;
      video.push({
        id: s.id,
        inicio: s.inicio,
        fin: s.fin,
        nombre: parteToma[i] ? `Escena ${n} · ${parteToma[i]}` : `Escena ${n}`,
        n,
        archivo: s.archivo,
        pieza: s.pieza,
        reemplazado: s.reemplazado,
        mudo: s.mudo,
        clip: urlConVersion(a, `video/${s.archivo}`),
        texto: o.texto,
        largo: s.largo || o.toma.largoOriginal || null,
        entrada: s.entrada,
        entradaBase: s.entrada,
        entradaVista: s.entradaVista,
        velocidad: s.velocidad,
        velocidadApp: s.reemplazado ? 1 : Number(o.toma?.velocidad) || 1,
        cubre: s.cubre,
        // segundos que se ve quieta al final (su clip no alcanza y ninguna imagen de apoyo la tapa)
        quieto: s.congelado ? 0 : quietoDeToma(s, visibles),
        congelado: s.congelado,
        editable: cortes.tomas,
        ...foto(s.archivo, 0.5),
      });
    });
    const quietoTotal = (bs) => segs.reduce((t, s) => t + quietoDeToma(s, bs), 0);
    const ahora = quietoTotal(visibles);
    const parteBroll = partes(lista);
    lista.forEach((x, i) => {
      const o = plan.bloques[x.b].broll;
      const quitado = quitados.has(x.id);
      // Sin este B-roll, lo que tapa de las tomas queda a la vista: si sus clips no alcanzan, se ven quietos.
      const sin = quitado ? ahora : quietoTotal(visibles.filter((y) => y.id !== x.id));
      const con = quitado ? quietoTotal([...visibles, x]) : ahora;
      const quieto = Math.round((sin - con) * 10) / 10;
      broll.push({
        quietoSiLoQuitas: quieto >= 0.3 ? quieto : 0,
        id: x.id,
        tipo: 'broll',
        inicio: x.desde,
        fin: x.fin,
        nombre: parteBroll[i] ? `Imagen de apoyo ${x.n} · ${parteBroll[i]}` : `Imagen de apoyo ${x.n}`,
        n: x.n,
        archivo: x.archivo,
        pieza: x.pieza,
        reemplazado: x.reemplazado,
        mudo: x.mudo,
        clip: urlConVersion(a, `video/${x.archivo}`),
        texto: o.sincroniza_con || null,
        largo: x.largo || o.largoOriginal || null,
        entrada: x.entrada,
        entradaBase: x.entrada,
        entradaVista: x.entradaVista,
        velocidad: x.velocidad,
        velocidadApp: x.reemplazado ? 1 : Number(o.velocidad) || 1,
        cubre: x.cubre,
        quieto: x.cubre !== null && x.fin - x.desde > x.cubre + 0.1 ? Math.round((x.fin - x.desde - x.cubre) * 10) / 10 : 0,
        quitado,
        removible: true,
        editable: cortes.brolls,
        ...foto(x.archivo, 0.5),
      });
    });
  } else if (fam === 'continuidad') {
    const clips = plan.continuidad.clips;
    // con tu video en un paso o una escena: el archivo, su largo y su velocidad salen del plan con los cambios
    const ajustados = ajustarPlan(plan, ed).continuidad?.clips || clips;
    clips.forEach((c, i) => {
      const np = numDe(c.archivo, 'paso');
      const nt = numDe(c.archivo, 'toma');
      const inicio = i === 0 ? 0 : c.desde;
      const cj = ajustados[i] || c;
      const reemplazado = Boolean(cj.reemplazo);
      video.push({
        id: `v${i}`,
        inicio,
        fin: i + 1 < clips.length ? clips[i + 1].desde : dur,
        nombre: np !== null ? `Paso ${np}` : nt !== null ? `Escena ${nt}` : 'Clip',
        n: np ?? nt,
        archivo: cj.archivo,
        pieza: piezaDeArchivo(c.archivo),
        reemplazado,
        mudo: Boolean(cj.mudo),
        clip: urlConVersion(a, `video/${cj.archivo}`),
        texto: lineaEn(plan, inicio + 0.05)?.texto || null,
        largo: cj.largoOriginal || c.largoOriginal || null,
        entradaBase: 0,
        entradaVista: reemplazado ? Number(cj.recorteInicio) || 0 : 0,
        velocidad: reemplazado ? cj.velocidadFija ?? 1 : null,
        velocidadApp: 1,
        continuidad: true,
        ...foto(cj.archivo, 0.4),
      });
    });
  } else {
    const piezas = plan.escena.piezas;
    const base = piezas
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => capaDe(p) === 0 && (p.tipo === 'clip' || p.tipo === 'imagen'))
      .sort((x, y) => x.p.desde - y.p.desde);
    base.forEach(({ p, idx }, i) => {
      const inicio = i === 0 ? 0 : p.desde;
      const nt = numDe(p.archivo, 'toma');
      const linea = lineaEn(plan, p.desde + 0.05);
      video.push({
        id: `e${idx}`,
        inicio,
        fin: i + 1 < base.length ? base[i + 1].p.desde : dur,
        // en podcast y entrevista la misma toma vuelve varias veces: los bloques se numeran en orden
        // y llevan el nombre de quien habla ("3 · Anfitrión A")
        nombre: p.tipo === 'imagen' ? 'Congelado' : linea?.habla ? `${i + 1} · ${nombreDeQuienHabla(linea.habla)}` : `Bloque ${i + 1}`,
        n: nt,
        archivo: p.archivo,
        clip: p.tipo === 'clip' ? urlConVersion(a, `video/${p.archivo}`) : null,
        texto: linea?.texto || null,
        habla: linea?.habla || null,
        largo: (a.tomas || []).find((t) => t.n === nt)?.duracionClip || null,
        oculto: p.marco === 'oculto',
        ...(p.tipo === 'imagen' ? { miniatura: miniatura(urlConVersion(a, p.archivo), 160), foto: miniatura(urlConVersion(a, p.archivo), 480) } : foto(p.archivo, (p.recorteInicio || 0) + 0.4)),
      });
    });
    const tapaUnaOculta = (p) => base.some(({ p: q }) => q.marco === 'oculto' && p.desde >= q.desde - 0.05 && p.desde < q.desde + (q.duracion || 0));
    // las imágenes de apoyo con tu video, su velocidad y su deslizar (las piezas quedan en el mismo orden sin quitar nada)
    const ajustadas = ajustarPlan(plan, { ...ed, quitados: [] }).escena?.piezas || piezas;
    piezas.forEach((p, idx) => {
      const capa = capaDe(p);
      if (p.tipo === 'clip' && capa > 0 && p.marco !== 'mitad-inferior') {
        const nb = numDe(p.archivo, 'broll');
        const id = `e${idx}`;
        const pj = ajustadas[idx] && ajustadas[idx].desde === p.desde ? ajustadas[idx] : p;
        const reemplazado = Boolean(pj.reemplazo);
        const largoOriginal = (a.broll || []).find((b) => b.n === nb)?.duracionClip || null;
        broll.push({
          id,
          tipo: nb !== null ? 'broll' : 'reaccion',
          inicio: p.desde,
          fin: Math.min(dur, p.desde + (p.duracion || 0)),
          nombre: nb !== null ? `Imagen de apoyo ${nb}` : 'Reacción',
          n: nb,
          archivo: pj.archivo,
          pieza: nb !== null ? piezaDeArchivo(p.archivo) : null,
          reemplazado,
          mudo: Boolean(pj.mudo),
          clip: urlConVersion(a, `video/${pj.archivo}`),
          texto: nb !== null ? lineaEn(plan, p.desde + 0.05)?.texto || null : describirReaccion(p.porque),
          largo: reemplazado ? pj.largoOriginal || null : largoOriginal,
          entradaBase: reemplazado ? 0 : Number(p.recorteInicio) || 0,
          entradaVista: Number(pj.recorteInicio) || 0,
          velocidad: pj.velocidad ?? null,
          velocidadApp: reemplazado ? 1 : Number(p.velocidad) || 1,
          quitado: quitados.has(id),
          removible: !tapaUnaOculta(p),
          ...foto(pj.archivo, (pj.recorteInicio || 0) + 0.4),
        });
      } else if (p.tipo === 'icono') {
        textos.push({ id: `e${idx}`, tipo: 'icono', inicio: p.desde, fin: Math.min(dur, p.desde + (p.duracion || 1)), texto: nombreIcono(p.archivo), imagen: miniatura(urlConVersion(a, p.archivo), 160), fijo: true });
      } else if (p.tipo === 'texto') {
        textos.push({ id: `e${idx}`, tipo: 'texto', inicio: p.desde, fin: Math.min(dur, p.desde + (p.duracion || 1)), texto: p.texto, fijo: true });
      } else if (p.tipo === 'sonido') {
        efectos.push({ t: p.desde, nombre: nombreSonido(p.archivo), detalle: null });
      }
    });
  }

  // la animación y el sonido de entrada siguen a su toma (con cortes, en su nuevo lugar)
  for (const tr of (fam === 'bloques' ? ajustarPlan(plan, ed) : plan).transiciones || []) {
    efectos.push({ t: tr.desde, nombre: nombreEfecto(tr.efecto || tr.animacion), detalle: tr.porque || null, animacion: tr.animacion || null });
  }

  // Textos sugeridos del manifiesto (hoy no se dibujan en el video entregado: el usuario los activa). La misma
  // cuenta que usa la composición para dibujarlos.
  // Y los que agregó el usuario, con su aspecto ya resuelto (la misma cuenta que usa la composición).
  // (una imagen que subió el usuario lleva su miniatura en la pista, como los iconos)
  textos.push(...textosEnPantalla(plan, ed, a.overlays, colorAnuncio).map((x) => ({ ...x, editable: true, ...(x.archivo ? { imagen: urlConVersion(a, x.archivo) } : {}) })));
  textos.sort((x, y) => x.inicio - y.inicio);

  // La pieza de cada clip ("toma-3", "broll-2", "paso-4"): con ella se regenera, se reemplaza con tu video y se le
  // cambia la velocidad (sale del plan ORIGINAL: con tu video la pieza sigue siendo la misma). Y lo que se puede hacer
  // con ese clip en el editor (capas.queSePuedeConElClip: velocidad, deslizar, reemplazar y por qué no).
  for (const x of [...video, ...broll]) {
    if (x.pieza === undefined) x.pieza = piezaDeArchivo(x.archivo);
    x.puede = x.pieza ? queSePuedeConElClip(plan, x.pieza, ed) : { velocidad: false, deslizar: false, reemplazar: null, motivo: null };
    x.ajuste = x.pieza ? ajusteDeClip(plan, ed, x.pieza) : null;
    x.conColor = Boolean(x.ajuste?.color);
    // la velocidad que elegiste tú (null: la que puso la app, o la de tu video tal cual)
    const propia = Number(ed?.clips?.[x.pieza]?.velocidad);
    x.velocidadPropia = x.pieza && x.puede.velocidad && Number.isFinite(propia) && propia > 0 ? x.ajuste?.velocidad ?? null : null;
    if (x.velocidadApp === undefined) x.velocidadApp = 1;
  }
  efectos.sort((x, y) => x.t - y.t);

  // Voz: un archivo (voz en off / canción) o las líneas habladas dentro de los clips
  const mv = modoVoz(plan);
  let voz;
  if (mv !== 'en-clips') {
    voz = { modo: mv, segmentos: [{ id: 'voz', inicio: 0, fin: dur, nombre: mv === 'cancion' ? 'Canción' : plan.videoPropio ? 'Audio del video' : 'Voz en off', url: urlDe(a, plan.audio.voz) }] };
  } else {
    const hojas = new Map((a.hojas || []).map((h) => [h.id, h.imagen]));
    voz = {
      modo: mv,
      segmentos: (plan.bloques || []).map((b, i) => {
        const avatar = b.habla ? hojas.get(`host-${String(b.habla).toLowerCase()}`) : null;
        return { id: `l${i}`, inicio: b.inicio, fin: Math.min(dur, b.fin), habla: b.habla || null, avatar: avatar ? miniatura(avatar, 160) : null, texto: b.texto };
      }),
    };
  }

  // las partes de la voz (dividirla para darle a cada parte su volumen y sus fundidos; la voz no se mueve), las
  // censuras (palabras con pitido o en silencio, y los tramos silenciados a mano) y tus audios
  voz.tramos = tramosVoz(plan, ed);
  const censuras = (ed.censuras || []).map((c) => ({ ...c, inicio: c.desde, fin: c.hasta }));
  const audios = audiosDeEdicion(plan, ed).map((x) => ({ ...x, inicio: x.desde, fin: x.hasta, url: urlDe(a, x.archivo) }));
  const musica = musicaActual(a, plan, ed);
  return { duracion: dur, familia: fam, cortes: cortesPosibles(plan), video, broll, efectos, textos, voz, censuras, audios, musica, tramosMusica: musica ? tramosMusica(plan, ed, musica) : [], subtitulos };
}

// ---------------------------------------------------------------- precarga de la vista previa

/**
 * Los archivos que usa la composición, en el orden en que suenan o se ven (rutas relativas al anuncio,
 * como las pide Anuncio.jsx con staticFile). Se precargan para que ningún clip se vea en negro la
 * primera vez. Como mucho `maximo`, para no llenar la memoria con un anuncio de 10 minutos.
 */
export function mediosDelPlan(plan, maximo = 48) {
  const lista = [];
  const sumar = (rel) => {
    if (rel && !lista.includes(rel)) lista.push(rel);
  };
  sumar(plan.audio?.voz);
  sumar(plan.musica?.archivo);
  for (const t of plan.transiciones || []) sumar(t.archivo);
  const fam = familia(plan);
  if (fam === 'bloques') {
    for (const b of plan.bloques || []) {
      if (b.toma?.archivo) sumar(`video/${b.toma.archivo}`);
      if (b.broll?.archivo) sumar(`video/${b.broll.archivo}`);
    }
  } else if (fam === 'continuidad') {
    for (const c of plan.continuidad.clips) sumar(`video/${c.archivo}`);
  } else {
    for (const p of [...plan.escena.piezas].sort((x, y) => x.desde - y.desde)) {
      if (p.tipo === 'clip') sumar(`video/${p.archivo}`);
      else if (p.tipo === 'sonido') sumar(p.archivo);
    }
  }
  return lista.slice(0, maximo);
}

// ---------------------------------------------------------------- galería

/**
 * Tres bloques seguidos (con 2+ palabras) del primer tercio del anuncio, y la foto de esa toma.
 * Se prefieren bloques a la altura normal (en el podcast, durante el B-roll en pantalla dividida, los
 * subtítulos suben a la unión de las dos mitades: eso no se entendería en una muestra chica).
 */
export function muestraDeGaleria(subs, pistas) {
  const lista = subs.filter((b) => !b.oculto && (b.palabras || []).length >= 2);
  if (!lista.length) return null;
  const desde = Math.min(Math.max(0, lista.length - 3), Math.floor(lista.length * 0.28));
  const buscar = (pide) => {
    for (let i = desde; i < lista.length - 2; i++) {
      const tres = lista.slice(i, i + 3);
      if (tres[2].id - tres[0].id === 2 && tres[2].inicio - tres[0].inicio < 4.5 && tres.every(pide)) return i;
    }
    return -1;
  };
  let k = buscar((b) => b.desdeAbajo === undefined || b.desdeAbajo === null);
  if (k < 0) k = buscar(() => true);
  if (k < 0) k = desde;
  const bloques = lista.slice(k, k + 3);
  const t0 = bloques[0].inicio;
  const enVideo = pistas.video.find((v) => t0 >= v.inicio && t0 < v.fin) || pistas.video[0];
  const enBroll = pistas.familia === 'escena' ? null : pistas.broll.find((b) => !b.quitado && t0 >= b.inicio && t0 < b.fin);
  const pieza = enBroll || enVideo;
  return { bloques, desde: t0 - 0.06, hasta: bloques[bloques.length - 1].fin + 0.3, fondo: pieza?.foto || null };
}

// ---------------------------------------------------------------- rehacer con IA

// Los largos en que se puede pedir un clip de nuevo: con Omni Flash 1.2, un entero de 3 a 15 s (el 1.1 pedía 4, 6, 8 o 10).
const LARGO_MIN = 3;
const LARGO_MAX = 15;

/** Rehacer un clip con IA: el largo en que se pide (el que se ve en el anuncio, redondeado hacia arriba). */
export function segundosRehacer(largoSeg) {
  const largo = Number(largoSeg) || 6;
  return Math.min(LARGO_MAX, Math.max(LARGO_MIN, Math.ceil(largo - 1e-6)));
}
