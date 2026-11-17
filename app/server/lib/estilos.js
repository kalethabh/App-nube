// Los 14 estilos (13 + Agregar), en palabras de la app. La skill de cada uno vive en .claude/skills/<skill>/SKILL.md
// y no se toca: aca solo esta como se le presenta al usuario.
//
// clave   = como aparece en manifiesto.json ("estilo")
// muestra = el anuncio de ejemplo de cada estilo (imagen y video). NO se escribe aca:
//           - en la PC de Diego sale de server/muestras-estilos.json ({ "<clave>": "<slug en temp/>" }), que Diego
//             edita a mano para elegir que video mostrar de cada estilo (se vuelve a leer solo cuando cambia);
//           - en la PC del alumno ese archivo no viaja: la muestra es la copia que trae el paquete en
//             app/muestras/<clave>/ (lib/muestras.js decide cual se usa).
import fs from 'node:fs';
import path from 'node:path';
import { APP } from './rutas.js';

export const ARCHIVO_MUESTRAS = path.join(APP, 'server', 'muestras-estilos.json');

let cacheMuestras = null; // { marca, valor }

/**
 * { clave: slug | null } leido de muestras-estilos.json. Las claves que empiezan con "_" son notas.
 * Una clave que falta o vale "" = ese estilo no usa un anuncio de temp/ (queda la del paquete, si la hay).
 * Sin el archivo (la PC del alumno) es {}. Si quedo roto (una coma de mas), sigue la ultima lectura buena.
 */
export function muestrasDeEstilos() {
  let st;
  try {
    st = fs.statSync(ARCHIVO_MUESTRAS);
  } catch {
    return {};
  }
  const marca = `${st.mtimeMs}:${st.size}`;
  if (cacheMuestras?.marca === marca) return cacheMuestras.valor;
  let valor;
  try {
    const crudo = JSON.parse(fs.readFileSync(ARCHIVO_MUESTRAS, 'utf8').replace(/^﻿/, ''));
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) throw new Error('no es un objeto { "clave": "slug" }');
    valor = {};
    for (const [clave, slug] of Object.entries(crudo)) {
      if (clave.startsWith('_')) continue;
      valor[clave] = typeof slug === 'string' && slug.trim() ? slug.trim() : null;
    }
  } catch (e) {
    console.warn(`[estilos] No pude leer muestras-estilos.json (${e.message}). Sigo con la ultima lectura buena.`);
    valor = cacheMuestras?.valor || {};
  }
  cacheMuestras = { marca, valor };
  return valor;
}

/** El slug del anuncio de muestra de un estilo en temp/, o null. */
export function muestraDe(clave) {
  const m = muestrasDeEstilos();
  return Object.hasOwn(m, clave) ? m[clave] : null;
}

export const FAMILIAS = {
  'voz-en-off': { nombre: 'Voz en off', descripcion: 'Un narrador cuenta la historia sobre las imágenes.' },
  hablado: { nombre: 'Hablado', descripcion: 'Los personajes hablan a cámara con su propia voz.' },
  cantado: { nombre: 'Cantado', descripcion: 'El anuncio entero es una canción.' },
  efecto: { nombre: 'Efecto', descripcion: 'Se suma a un estilo con narrador.' },
  referencia: { nombre: 'Desde tu video', descripcion: 'Subes un video y se rehace para tu producto, con su misma estructura y su mismo look.' },
};

const BASE = [
  {
    skill: 'anuncios-claymation',
    clave: 'claymation',
    nombre: 'Claymation',
    lema: 'Plastilina en stop-motion',
    descripcion: 'Personajes de plastilina hechos a mano y un narrador que engancha con una pregunta y remata con un giro.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-crochet',
    clave: 'crochet',
    nombre: 'Crochet',
    lema: 'Un mundo tejido en lana',
    descripcion: 'Un diorama en miniatura tejido a ganchillo, cálido y artesanal, con tu producto también tejido.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-zack-d-films',
    clave: 'zack-d-films',
    nombre: 'Zack D Films',
    lema: 'Explicador 3D por capítulos',
    descripcion: 'Animación 3D de cine que muestra por dentro cómo funciona algo, capítulo a capítulo, con un giro al final.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-estilo-pixar',
    clave: 'estilo-pixar',
    nombre: 'Estilo Pixar',
    lema: 'Animación 3D cálida',
    descripcion: 'Animación 3D tierna, de película familiar, con un narrador que explica el mecanismo dentro del mundo del anuncio.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-realista-narrado',
    clave: 'realista-narrado',
    nombre: 'Realista con narrador',
    lema: 'Un antes y después real',
    descripcion: 'Personas que parecen reales, grabadas como con un celular en su vida, y la voz de alguien cercano que cuenta su transformación.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-skeleton-ads',
    clave: 'skeleton',
    nombre: 'Esqueleto',
    lema: 'El esqueleto viral de TikTok',
    descripcion: 'El esqueleto 3D que se volvió viral: "¿qué le pasa a tu cuerpo si…?" o "día 1 contra día 30".',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-estilo-lego',
    clave: 'estilo-lego',
    nombre: 'Estilo Lego',
    lema: 'Minifiguras y ladrillos',
    descripcion: 'Minifiguras y mundos de ladrillos; lo que no se puede mostrar se cuenta armado con piezas.',
    familia: 'voz-en-off',
  },
  {
    skill: 'anuncios-ugc',
    clave: 'ugc',
    nombre: 'UGC',
    lema: 'Una persona te habla a cámara',
    descripcion: 'Una persona creada con IA te habla a cámara con su propia voz: testimonio, reseña, rutina o recomendación.',
    familia: 'hablado',
  },
  {
    skill: 'anuncios-talking-object-pixar',
    clave: 'talking-object-pixar',
    nombre: 'Objeto parlante',
    lema: 'Tu producto habla',
    descripcion: 'Un objeto, ingrediente o parte del cuerpo animado en 3D que habla en primera persona, con la boca sincronizada.',
    familia: 'hablado',
  },
  {
    skill: 'anuncios-podcast',
    clave: 'podcast',
    nombre: 'Podcast',
    lema: 'Dos anfitriones conversando',
    descripcion: 'Dos anfitriones frente al micrófono; tu producto entra como una recomendación entre amigos, no como venta.',
    familia: 'hablado',
  },
  {
    skill: 'anuncios-entrevista',
    clave: 'entrevista',
    nombre: 'Entrevista callejera',
    lema: 'Preguntas en la calle',
    descripcion: 'Paran a alguien en la calle, le hacen preguntas incómodas y el producto aparece cuando ya se confesó.',
    familia: 'hablado',
  },
  {
    skill: 'anuncios-musicales',
    clave: 'musical',
    nombre: 'Musical',
    lema: 'Un jingle pegadizo',
    descripcion: 'Tu producto se vende con una canción original y corta, con coro, sobre imágenes de crochet, plastilina o 3D.',
    familia: 'cantado',
  },
  {
    skill: 'anuncios-historias-musicales',
    clave: 'historias-musicales',
    nombre: 'Historia musical',
    lema: 'Una historia cantada larga',
    descripcion: 'Una historia de 4 a 10 minutos cantada de principio a fin sobre animación 3D, como una carta de ventas.',
    familia: 'cantado',
  },
  {
    // «Agregar» (2026-11-17): el usuario sube un video y se rehace con su misma estructura, su misma gente y su mismo
    // look, para su producto. Lo produce la familia que calza con el video (UGC si alguien habla a cámara; voz en off
    // si una voz cuenta sobre escenas): lo decide la IA mirando el video (lib/anuncios-nuevos.js, familiaDelAnuncio).
    skill: 'anuncios-agregar',
    clave: 'agregar',
    nombre: 'Agregar',
    lema: 'Sube un video y di lo que quieres',
    descripcion: 'Subes un video y escribes lo que quieres («este mismo, pero estilo Pixar y de 1:30»). La IA lo mira entero (cómo está armado, las personas, el ángulo de venta y el antes y después) y lo rehace para tu producto: con su mismo look o en el estilo que pidas, eligiendo el mejor modelo para cada escena.',
    familia: 'referencia',
  },
  {
    skill: 'anuncios-continuidad',
    clave: 'continuidad',
    nombre: 'Continuidad',
    lema: 'Sin cortes entre escenas',
    descripcion: 'Un efecto para los estilos con narrador: cada escena se transforma en la siguiente, sin un solo corte.',
    familia: 'efecto',
  },
];

// Cada estilo con su `muestra` (slug) siempre al dia con muestras-estilos.json.
export const ESTILOS = BASE.map((e) =>
  Object.defineProperty({ ...e }, 'muestra', { enumerable: true, get: () => muestraDe(e.clave) })
);

const POR_CLAVE = new Map(ESTILOS.map((e) => [e.clave, e]));

/** El estilo de un manifiesto, en palabras de la app. */
export function estiloDeManifiesto(m) {
  const clave = m?.estilo || null;
  const e = clave ? POR_CLAVE.get(clave) : null;
  const cantado = m?.modo_audio === 'musica' && clave !== 'historias-musicales';
  return {
    clave,
    nombre: e?.nombre || (clave ? clave.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Sin estilo'),
    familia: cantado ? 'cantado' : e?.familia || null,
    continuidad: Boolean(m?.continuidad),
    musical: cantado,
  };
}
