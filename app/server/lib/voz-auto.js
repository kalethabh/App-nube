// La VOZ DEL NARRADOR cuando el usuario no eligió una (2026-11-18, pedido: «si no selecciono la voz del narrador, que
// tome la más indicada o la más parecida a la del video de referencia»). La app elige entre las voces de su cuenta de
// ElevenLabs, comparando sus etiquetas (género, edad, acento, idioma, uso y descripción) con la voz que se busca:
//
//   1. la del video de referencia (Agregar o Clonar): el género y lo expresiva que es salen de MEDIR su audio
//      (produccion/medir-voz.js, gratis, en la computadora);
//   2. lo que pidió la IA al escribir el guion (temp/<slug>/voz-buscada.json: género, edad, acento, tono, motivo);
//   3. la ficha del producto (a quién le habla y en qué país).
//
//   vozBuscada({ carpeta, brief, ficha })        -> { genero, edad, acento, idioma, tono: [], deReferencia, motivo }
//   elegirVoz(voces, buscada, { ultima })        -> { voz, puntos, motivo } | null
//   asegurarVoz({ carpeta, brief, ficha })       -> { ok, voz } | { ok: false, mensaje }   (y la guarda en brief.json)
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON } from './archivos.js';
import { voces as vocesDeLaCuenta, mensajeSimple, VOZ_DE_PRUEBA } from './voces.js';
import { leerConfig } from './config.js';
import { medirVoz } from '../../../produccion/medir-voz.js';

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- la voz que se busca

/** La medida de la voz del video de referencia (la guarda en adn-base.json para no medirla dos veces). */
export function vozDeLaReferencia(carpeta) {
  for (const dir of [path.join(carpeta, 'referencia'), path.join(carpeta, 'material', 'referencia', 'ref01')]) {
    const rutaAdn = path.join(dir, 'adn-base.json');
    const adn = leerJSON(rutaAdn);
    if (!adn) continue;
    if (adn.voz !== undefined) return adn.voz;
    const audio = path.join(dir, 'audio-referencia.mp3');
    if (!fs.existsSync(audio)) return null;
    const palabras = (leerJSON(path.join(dir, 'transcripcion.json'))?.palabras || []).filter((p) => Number.isFinite(p.desde));
    const voz = palabras.length ? medirVoz(audio, palabras) : null;
    try {
      fs.writeFileSync(rutaAdn, JSON.stringify({ ...adn, voz }, null, 2));
    } catch {
      /* solo era para no medirla dos veces */
    }
    return voz;
  }
  return null;
}

const GENERO = (t) => {
  const x = sinTildes(t);
  if (/\b(femenin|mujer|female|woman)/.test(x)) return 'femenina';
  if (/\b(masculin|hombre|male\b|man\b)/.test(x)) return 'masculina';
  return null;
};

/** A quién le habla el producto (la ficha): «mujeres de 30 a 50» -> femenina. */
function generoDelPublico(publico) {
  const x = sinTildes(publico);
  const ellas = /\b(mujer|mujeres|mama|mamas|madre|ellas|chicas|senoras|femenin)/.test(x);
  const ellos = /\b(hombre|hombres|papa|papas|padre|ellos|chicos|senores|masculin)/.test(x);
  return ellas && !ellos ? 'femenina' : ellos && !ellas ? 'masculina' : null;
}

const PAISES_LATAM = /colombia|mexic|peru|chile|argentin|ecuador|guatemala|salvador|hondur|nicaragu|costa rica|panama|venezuel|bolivia|paragu|urugu|dominican|puerto rico|latam|latinoam/;

export function vozBuscada({ carpeta, brief = {}, ficha = {} }) {
  const ref = vozDeLaReferencia(carpeta);
  const ia = leerJSON(path.join(carpeta, 'voz-buscada.json')) || {};
  const idiomaFicha = sinTildes(ficha.idioma || '');
  const idioma = /ingl|english|^en/.test(idiomaFicha) ? 'en' : /portug|^pt/.test(idiomaFicha) ? 'pt' : 'es';
  const pais = sinTildes(`${ficha.pais || ''} ${ficha.mercado || ''}`);
  const genero = ref?.genero || GENERO(ia.genero) || generoDelPublico(ficha.publico) || null;
  const motivo = [];
  if (ref?.genero) motivo.push(`voz ${ref.genero} como la del video de referencia (tono medio de ${ref.f0} Hz${ref.expresiva ? ', expresiva' : ''})`);
  else if (GENERO(ia.genero)) motivo.push(`voz ${GENERO(ia.genero)}${ia.motivo ? `: ${String(ia.motivo).slice(0, 160)}` : ''}`);
  else if (genero) motivo.push(`voz ${genero} para tu público`);
  return {
    genero,
    edad: /joven|young/.test(sinTildes(ia.edad)) ? 'joven' : /mayor|old|anciano/.test(sinTildes(ia.edad)) ? 'mayor' : /adult|media|middle/.test(sinTildes(ia.edad)) ? 'adulta' : null,
    acento: sinTildes(ia.acento) || (idioma === 'es' ? (/espana|spain/.test(pais) ? 'espanol' : PAISES_LATAM.test(pais) || !pais ? 'latino' : null) : null),
    idioma,
    tono: (Array.isArray(ia.tono) ? ia.tono : String(ia.tono || '').split(/[,;/]/)).map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 6),
    expresiva: ref ? Boolean(ref.expresiva) : null,
    deReferencia: Boolean(ref?.genero),
    motivo,
  };
}

// ---------------------------------------------------------------- comparar con las voces de la cuenta

// palabras del tono en español -> como las escribe ElevenLabs en sus etiquetas y descripciones
const TONOS = {
  calida: ['warm'],
  calmada: ['calm', 'soothing', 'relaxed'],
  tranquila: ['calm', 'soothing', 'relaxed'],
  energica: ['energetic', 'upbeat', 'lively', 'dynamic'],
  alegre: ['cheerful', 'upbeat', 'bright', 'happy'],
  profunda: ['deep'],
  grave: ['deep'],
  suave: ['soft', 'gentle'],
  seria: ['serious', 'authoritative', 'confident'],
  confiable: ['confident', 'trustworthy', 'authoritative'],
  amigable: ['friendly'],
  cercana: ['friendly', 'conversational', 'casual'],
  natural: ['natural', 'casual', 'conversational'],
  dramatica: ['dramatic', 'intense'],
  divertida: ['playful', 'fun', 'quirky'],
  narradora: ['narration', 'narrative', 'storytelling'],
};
const ACENTOS = {
  latino: /latin|mexic|colombi|argentin|venezuel|peru|chile|ecuador|caribbean|neutral spanish/,
  colombiano: /colombi/,
  mexicano: /mexic/,
  argentino: /argentin/,
  espanol: /spain|castil|peninsular|european spanish|accent:spanish\b/,
};

/** El texto de una voz para comparar: su nombre, descripción y etiquetas. */
function textoDe(v) {
  const e = v.etiquetas || {};
  return sinTildes([v.nombre, v.descripcion, ...Object.entries(e).map(([k, x]) => `${k}:${x}`)].join(' | '));
}

function generoDeLaVoz(v) {
  const g = sinTildes(v.etiquetas?.gender || '');
  if (/female|woman|femen/.test(g)) return 'femenina';
  if (/male|man|mascul/.test(g)) return 'masculina';
  const t = textoDe(v);
  if (/\b(female|woman|girl|mujer)\b/.test(t)) return 'femenina';
  if (/\b(male|man|guy|hombre)\b/.test(t)) return 'masculina';
  return null;
}

/** Cuánto se parece una voz a la buscada (más es mejor) y por qué. */
export function puntuar(v, b, { ultima = null } = {}) {
  const t = textoDe(v);
  const e = v.etiquetas || {};
  let p = 0;
  const por = [];
  const g = generoDeLaVoz(v);
  if (b.genero && g) {
    if (g === b.genero) {
      p += 6;
      por.push(`voz ${g}`);
    } else p -= 8;
  }
  const habla = sinTildes(`${e.language || ''} ${e.accent || ''}`);
  if (b.idioma === 'es') {
    if (/\bes\b|spanish|espanol|latin|mexic|colombi|argentin|castil|spain/.test(`${habla} ${t}`)) {
      p += 4;
      por.push('habla español');
    } else if (/american|british|australian|irish|english|indian|african/.test(habla)) p -= 3;
  } else if (b.idioma === 'en' && /american|british|english|\ben\b/.test(`${habla} ${t}`)) {
    p += 3;
    por.push('habla inglés');
  }
  const acento = b.acento && ACENTOS[b.acento] ? ACENTOS[b.acento] : null;
  if (acento && acento.test(t)) {
    p += b.acento === 'latino' ? 3 : 4;
    por.push(`acento ${b.acento}`);
  } else if (b.acento && b.acento !== 'espanol' && ACENTOS.espanol.test(t)) p -= 1;
  const edad = sinTildes(e.age || '');
  if (b.edad && edad) {
    const de = /young/.test(edad) ? 'joven' : /old/.test(edad) ? 'mayor' : 'adulta';
    if (de === b.edad) {
      p += 2;
      por.push(b.edad);
    } else p -= 1;
  }
  for (const tono of b.tono || []) {
    const claves = TONOS[sinTildes(tono)] || [sinTildes(tono)];
    if (claves.some((c) => t.includes(c))) {
      p += 1;
      por.push(tono);
    }
  }
  if (b.expresiva === true && /expressive|energetic|animated|upbeat|lively|dynamic/.test(t)) {
    p += 1;
    por.push('expresiva');
  } else if (b.expresiva === false && /calm|soft|neutral|soothing/.test(t)) p += 0.5;
  if (/narrat|storytell|audiobook|documentar/.test(t)) {
    p += 1.5;
    if (!por.includes('narradora')) por.push('hecha para narrar');
  }
  if (v.propia) p += 0.5;
  if (ultima && v.id === ultima) p += 0.5;
  return { puntos: +p.toFixed(2), por };
}

export function elegirVoz(voces, buscada, { ultima = null } = {}) {
  const lista = (voces || []).filter((v) => v?.id);
  if (!lista.length) return null;
  const puntuadas = lista.map((v) => ({ v, ...puntuar(v, buscada, { ultima }) })).sort((a, b) => b.puntos - a.puntos || String(a.v.nombre).localeCompare(String(b.v.nombre)));
  const g = puntuadas[0];
  const motivo = [...(buscada.motivo || []), g.por.length ? `«${g.v.nombre}»: ${[...new Set(g.por)].join(', ')}` : `«${g.v.nombre}» (la más cercana de tu cuenta)`].join(' · ');
  return { voz: { id: g.v.id, nombre: g.v.nombre }, puntos: g.puntos, motivo };
}

// ---------------------------------------------------------------- en el anuncio

const ID_VOZ = /^[A-Za-z0-9_-]{4,80}$/;

/** ¿Hay que elegir la voz? (pidió que la elija la app, o no trae ninguna) */
export const faltaVoz = (brief) => !(brief?.voz?.id && ID_VOZ.test(String(brief.voz.id)));

/**
 * Deja elegida la voz del narrador en el brief del anuncio (temp/<slug>/app/brief.json) si no la eligió el usuario.
 * Una vez elegida, no cambia (el anuncio suena siempre igual, aunque se repita un paso).
 */
export async function asegurarVoz({ carpeta, brief, ficha = {}, voces = null }) {
  if (!faltaVoz(brief)) return { ok: true, voz: brief.voz };
  // (voces: solo las pruebas la pasan; si no, las de la cuenta de ElevenLabs, que listarlas es gratis)
  const r = voces ? { ok: true, voces } : await vocesDeLaCuenta();
  let lista = r.ok ? r.voces : null;
  if (!lista && process.env.ANUNCIOS_MODO_PRUEBA === '1') lista = [VOZ_DE_PRUEBA];
  if (!lista) return { ok: false, mensaje: `No pude elegir la voz del narrador: ${mensajeSimple(r.mensaje)}` };
  const buscada = vozBuscada({ carpeta, brief, ficha });
  const ultima = (() => {
    const x = leerConfig().vozPorEstilo?.[brief?.estilo];
    return x?.id || x || null;
  })();
  const e = elegirVoz(lista, buscada, { ultima });
  if (!e) return { ok: false, mensaje: 'Tu cuenta de ElevenLabs no tiene voces: agrega una y vuelve a intentar.' };
  const voz = { ...e.voz, auto: true, motivo: e.motivo.slice(0, 400), elegida: new Date().toISOString() };
  brief.voz = voz;
  const ruta = path.join(carpeta, 'app', 'brief.json');
  const enDisco = leerJSON(ruta);
  if (enDisco) fs.writeFileSync(ruta, JSON.stringify({ ...enDisco, voz }, null, 2));
  return { ok: true, voz };
}
