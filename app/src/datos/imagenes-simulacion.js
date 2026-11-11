// La simulación de "Anuncios de imagen" (Vista previa del diseño), SOLO con ?simular=1 (DISENO.md, regla 9):
//
//   #/imagenes?simular=1                       la portada ("Tus productos" y "Tus lotes") con productos y lotes de
//                                              ejemplo (…&vacio=1: sin lotes, la bienvenida)
//   #/imagenes/nuevo?simular=1                 el formulario con productos de ejemplo
//   #/imagenes/<lote>?simular=1                un lote de ejemplo de 10 variaciones (cuadrado + vertical, con logo)
//                                              que avanza solo, acelerado, de la estrategia a la galería
//   …&listo=1                                  el lote ya terminado, con su informe
//   …&alto=saldo|limite-claude|claude|ffmpeg|error|clave|bloqueo|detenido|fila    frenado por ese motivo
//   …&prueba=1                                 como si se hubiera hecho en modo prueba ("Lo que habría costado")
//
// La vista tiene la forma EXACTA de GET /api/imagen-ads/:lote (ESPECIFICACION-imagen-ads.md §9.2). Las imágenes son
// dibujos hechos aquí (SVG, marcados "Simulación"): nunca fotos ni textos de otro anuncio. Regenerar, Detener y
// Continuar también se simulan; no se le pide nada al servidor.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ErrorApi } from './api.js';
import { PIEZA_FINAL } from './imagenes.js';
import { nombreIAActual, programaIAActual } from '../pantallas/ajustes/datos.js';

export const LOTE_EJEMPLO = '_img-crema-luna-20261108-1200';
const PRODUCTO = { id: 'crema-luna-ejemplo', nombre: 'Crema Luna' };

// ---------------------------------------------------------------- los dibujos

const PALETAS = [
  ['#1E3A8A', '#3B5BDB'],
  ['#0F172A', '#334155'],
  ['#7C2D12', '#C2410C'],
  ['#14532D', '#15803D'],
  ['#4C1D95', '#6D28D9'],
  ['#831843', '#BE185D'],
  ['#134E4A', '#0F766E'],
  ['#1E293B', '#475569'],
  ['#78350F', '#B45309'],
  ['#312E81', '#4338CA'],
];

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enDatos = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Parte un titular en hasta 3 líneas de ~`ancho` letras. */
function lineas(texto, ancho) {
  const salida = [];
  let actual = '';
  for (const p of String(texto).split(/\s+/)) {
    if ((actual ? `${actual} ${p}` : p).length > ancho && actual) {
      salida.push(actual);
      actual = p;
    } else actual = actual ? `${actual} ${p}` : p;
  }
  if (actual) salida.push(actual);
  return salida.slice(0, 3);
}

/** El tarro de la crema, centrado en (cx, cy) con escala e. */
function tarro(cx, cy, e, color) {
  const w = 240 * e;
  const h = 220 * e;
  return `
    <ellipse cx="${cx}" cy="${cy + h / 2 + 18 * e}" rx="${w * 0.62}" ry="${22 * e}" fill="#000" opacity=".22"/>
    <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${34 * e}" fill="#F7F3EC"/>
    <rect x="${cx - w / 2 + 6 * e}" y="${cy - h / 2 + 6 * e}" width="${w * 0.18}" height="${h - 12 * e}" rx="${24 * e}" fill="#fff" opacity=".55"/>
    <rect x="${cx - w * 0.54}" y="${cy - h / 2 - 66 * e}" width="${w * 1.08}" height="${74 * e}" rx="${18 * e}" fill="#E4DCCD"/>
    <rect x="${cx - w * 0.34}" y="${cy - 34 * e}" width="${w * 0.68}" height="${84 * e}" rx="${12 * e}" fill="${color}"/>
    <text x="${cx}" y="${cy + 18 * e}" text-anchor="middle" font-family="Georgia, serif" font-size="${34 * e}" letter-spacing="${4 * e}" fill="#F7F3EC">LUNA</text>`;
}

const cacheDibujos = new Map();

/** Una imagen de anuncio de ejemplo (1:1 de 1024 o 9:16 de 720×1280), con o sin el logo pegado. */
function dibujoAnuncio({ i, v, formato, version, conLogo, titular }) {
  // (con la paleta y el titular en la clave: el mosaico de cada lote de ejemplo de la portada tiene sus propios dibujos)
  const clave = `${i}|${v}|${formato}|${version}|${conLogo ? 1 : 0}|${titular}`;
  if (cacheDibujos.has(clave)) return cacheDibujos.get(clave);
  const vertical = formato === '9:16';
  const W = vertical ? 720 : 1024;
  const H = vertical ? 1280 : 1024;
  const [c1, c2] = PALETAS[(i + Math.max(0, version - 1) * 3) % PALETAS.length];
  const fs = vertical ? 56 : 66;
  const ls = lineas(titular, vertical ? 17 : 20);
  const yTitulo = vertical ? 0.27 * H : 0.17 * H;
  const titulo = ls.map((l, k) => `<text x="${W / 2}" y="${yTitulo + k * fs * 1.12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="#fff">${xml(l)}</text>`).join('');
  const cyTarro = vertical ? 0.58 * H : 0.6 * H;
  const yCta = vertical ? 0.79 * H : 0.86 * H;
  const lw = Math.round(0.12 * W);
  const lh = Math.round(lw * 0.42);
  const ly = vertical ? Math.round(0.155 * H) : Math.round(0.045 * H);
  const logo = conLogo
    ? `<rect x="${(W - lw) / 2}" y="${ly}" width="${lw}" height="${lh}" rx="${lh / 2}" fill="#fff" opacity=".94"/><text x="${W / 2}" y="${ly + lh * 0.68}" text-anchor="middle" font-family="Georgia, serif" font-size="${lh * 0.5}" letter-spacing="2" fill="${c1}">LUNA</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <radialGradient id="l" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#f)"/>
    <circle cx="${W / 2}" cy="${cyTarro}" r="${W * 0.36}" fill="url(#l)"/>
    ${titulo}
    ${tarro(W / 2, cyTarro, vertical ? 1.05 : 1.15, c1)}
    <rect x="${W / 2 - (vertical ? 190 : 210)}" y="${yCta}" width="${vertical ? 380 : 420}" height="${vertical ? 70 : 76}" rx="${vertical ? 35 : 38}" fill="#fff"/>
    <text x="${W / 2}" y="${yCta + (vertical ? 46 : 50)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${vertical ? 28 : 31}" fill="${c1}">Envío gratis hoy</text>
    ${logo}
    <text x="${W * 0.04}" y="${H - H * 0.025}" font-family="Arial, Helvetica, sans-serif" font-size="${vertical ? 18 : 20}" fill="#fff" opacity=".55">Simulación · ${v} · versión ${version}</text>
  </svg>`;
  const url = enDatos(svg);
  cacheDibujos.set(clave, url);
  return url;
}

/** La foto de un producto de ejemplo (fondo claro, el tarro al centro). */
function fotoDeProducto(color = '#1E3A8A', fondo = '#ECEAE6') {
  return enDatos(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${fondo}"/>${tarro(400, 440, 1.5, color)}</svg>`);
}
const LOGO = enDatos(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="160" viewBox="0 0 420 160"><text x="210" y="108" text-anchor="middle" font-family="Georgia, serif" font-size="88" letter-spacing="12" fill="#1E3A8A">LUNA</text></svg>'
);

// ---------------------------------------------------------------- el formulario y "Tus lotes"

export function opcionesDeEjemplo() {
  return {
    angulos: [
      { id: 'dolor', nombre: 'Dolor / problema', queAtaca: 'Nombra el problema que el cliente vive hoy.' },
      { id: 'transformacion', nombre: 'Transformación / resultado', queAtaca: 'Muestra el antes y el después.' },
      { id: 'beneficio-principal', nombre: 'Beneficio principal', queAtaca: 'Lo mejor que hace tu producto.' },
      { id: 'prueba-social', nombre: 'Prueba social', queAtaca: 'Lo que dicen otros clientes.' },
      { id: 'objecion-precio', nombre: 'Objeción de precio', queAtaca: '¿Vale lo que cuesta?' },
      { id: 'rutina-uso', nombre: 'Rutina / momento de uso', queAtaca: 'Cuándo y cómo se usa.' },
      { id: 'oferta', nombre: 'Oferta / promoción', queAtaca: 'Una razón para comprar hoy.' },
    ],
    posiciones: null,
    maximo: 100,
    maxReferencias: 10,
    idiomaPorDefecto: 'es',
    costo: { creditosPorImagen: 10, dolaresPorImagen: 0.05, dolaresPorCredito: 0.005, margen: 0.2, modelo: 'GPT Image 2.5' },
  };
}

export function productosDeEjemplo() {
  const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
  return {
    productos: [
      {
        id: PRODUCTO.id,
        nombre: PRODUCTO.nombre,
        fotos: [
          { n: 1, url: fotoDeProducto('#1E3A8A'), deLaPagina: false },
          { n: 2, url: fotoDeProducto('#1E3A8A', '#DCE3F2'), deLaPagina: true },
        ],
        fotoSugerida: 1,
        creado: hace(5.2),
        ultimoLote: {
          datos: {
            nombre: 'Crema Luna',
            publico: 'Mujeres de 25 a 45',
            precio: '79.90',
            moneda: 'S/',
            cta: 'Pago contra entrega',
            pais: 'Perú',
            idioma: 'es',
            adicional: 'Se usa de noche. Dura dos meses.',
            angulo: null,
          },
        },
      },
      { id: 'serum-glow-ejemplo', nombre: 'Sérum Glow', fotos: [{ n: 1, url: fotoDeProducto('#831843', '#F3E4EA'), deLaPagina: false }], fotoSugerida: 1, ultimoLote: null, creado: hace(9) },
      { id: 'protector-sol-ejemplo', nombre: 'Protector Sol', fotos: [{ n: 1, url: fotoDeProducto('#C2410C', '#F6EDE4'), deLaPagina: false }], fotoSugerida: 1, ultimoLote: null, creado: hace(0.2) },
      // (otro producto con el mismo nombre: la portada y el formulario los distinguen por la foto y la fecha)
      { id: 'crema-luna-noche-ejemplo', nombre: 'Crema Luna', fotos: [{ n: 1, url: fotoDeProducto('#14532D', '#E6EEE6'), deLaPagina: false }], fotoSugerida: 1, ultimoLote: null, creado: hace(7.1) },
    ],
  };
}

/** Los primeros cuadrados de un lote de ejemplo (el `mosaico` de "Tus lotes"): `hechas` de ellos, con su paleta. */
function mosaicoDeEjemplo({ hechas, desde = 0, conLogo = false, titulares = VARIACIONES.map((x) => x.titular) }) {
  return Array.from({ length: hechas }, (_, k) => dibujoAnuncio({ i: desde + k, v: `V${String(k + 1).padStart(2, '0')}`, formato: '1:1', version: 1, conLogo, titular: titulares[k % titulares.length] }));
}

export function lotesDeEjemplo() {
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  return {
    lotes: [
      {
        lote: LOTE_EJEMPLO,
        titulo: 'Crema Luna',
        motor: 'claude',
        productoId: PRODUCTO.id,
        cantidad: 10,
        formatos: ['1:1', '9:16'],
        estado: 'corriendo',
        motivo: null,
        listas: 12,
        total: 20,
        portada: dibujoAnuncio({ i: 0, v: 'V01', formato: '1:1', version: 1, conLogo: true, titular: VARIACIONES[0].titular }),
        mosaico: mosaicoDeEjemplo({ hechas: 2, conLogo: true }),
        foto: fotoDeProducto('#1E3A8A'),
        creado: hace(14),
        terminado: null,
      },
      {
        lote: '_img-protector-sol-20261110-0915',
        motor: 'claude',
        titulo: 'Protector Sol',
        productoId: 'protector-sol-ejemplo',
        cantidad: 8,
        formatos: ['1:1', '9:16'],
        estado: 'pausado',
        motivo: 'saldo',
        listas: 9,
        total: 16,
        portada: dibujoAnuncio({ i: 2, v: 'V01', formato: '1:1', version: 1, conLogo: false, titular: 'Sol todo el día sin brillo' }),
        mosaico: mosaicoDeEjemplo({ hechas: 4, desde: 2, titulares: ['Sol todo el día sin brillo', 'No deja la cara blanca', 'FPS 50 que sí se siente ligero', 'Tu piel, protegida en la playa'] }),
        foto: fotoDeProducto('#C2410C', '#F6EDE4'),
        creado: hace(60 * 2),
        terminado: null,
      },
      {
        lote: '_img-serum-glow-20261107-0930',
        motor: 'claude',
        titulo: 'Sérum Glow',
        productoId: 'serum-glow-ejemplo',
        cantidad: 3,
        formatos: ['1:1'],
        estado: 'listo',
        motivo: null,
        listas: 3,
        total: 3,
        portada: dibujoAnuncio({ i: 5, v: 'V01', formato: '1:1', version: 1, conLogo: false, titular: 'Brillo de verdad en 7 días' }),
        mosaico: mosaicoDeEjemplo({ hechas: 3, desde: 5, titulares: ['Brillo de verdad en 7 días', 'Tu piel con luz propia', 'Unas gotas por la mañana'] }),
        foto: fotoDeProducto('#831843', '#F3E4EA'),
        creado: hace(60 * 26),
        terminado: hace(60 * 25),
      },
      {
        lote: '_img-crema-luna-20261105-1030',
        motor: 'claude',
        titulo: 'Crema Luna',
        productoId: PRODUCTO.id,
        cantidad: 10,
        formatos: ['1:1', '9:16'],
        estado: 'listo',
        motivo: null,
        listas: 20,
        total: 20,
        portada: dibujoAnuncio({ i: 3, v: 'V01', formato: '1:1', version: 1, conLogo: true, titular: VARIACIONES[3].titular }),
        mosaico: mosaicoDeEjemplo({ hechas: 4, desde: 3, conLogo: true, titulares: VARIACIONES.slice(3).map((x) => x.titular) }),
        foto: fotoDeProducto('#1E3A8A'),
        creado: hace(60 * 24 * 5),
        terminado: hace(60 * 24 * 5 - 25),
      },
      {
        lote: '_img-crema-luna-20261103-1900',
        motor: 'claude',
        titulo: 'Crema Luna',
        productoId: 'crema-luna-noche-ejemplo',
        cantidad: 5,
        formatos: ['1:1'],
        estado: 'listo',
        motivo: null,
        listas: 5,
        total: 5,
        portada: dibujoAnuncio({ i: 6, v: 'V01', formato: '1:1', version: 1, conLogo: false, titular: 'Duerme y despierta radiante' }),
        mosaico: mosaicoDeEjemplo({ hechas: 4, desde: 6, titulares: ['Duerme y despierta radiante', 'Tu rutina de noche', 'Hidratación profunda', 'Hecha con aloe'] }),
        foto: fotoDeProducto('#14532D', '#E6EEE6'),
        creado: hace(60 * 24 * 7),
        terminado: hace(60 * 24 * 7 - 12),
      },
      {
        lote: '_img-crema-luna-20261106-1800',
        motor: 'claude',
        titulo: 'Crema Luna',
        productoId: PRODUCTO.id,
        cantidad: 20,
        formatos: ['1:1', '9:16'],
        estado: 'borrador',
        motivo: null,
        listas: 0,
        total: 40,
        portada: null,
        creado: hace(60 * 48),
        terminado: null,
      },
    ],
  };
}

// ---------------------------------------------------------------- el lote de ejemplo

const VARIACIONES = [
  { v: 'V01', angulo: 'Dolor / problema', formato: 'Antes / Después', titular: 'Piel seca al despertar' },
  { v: 'V02', angulo: 'Beneficio principal', formato: 'Producto protagonista', titular: 'Hidratación que dura toda la noche' },
  { v: 'V03', angulo: 'Prueba social', formato: 'Muro de reseñas', titular: '4,9 de 5 en más de 2.000 reseñas' },
  { v: 'V04', angulo: 'Característica estrella', formato: 'Anatomía del producto', titular: 'Ácido hialurónico y manzanilla' },
  { v: 'V05', angulo: 'Comparación con la alternativa', formato: 'Nosotros vs. ellos', titular: 'Lo que tu crema de siempre no hace' },
  { v: 'V06', angulo: 'Oferta / promoción', formato: 'Oferta / combo', titular: 'Hoy con envío gratis' },
  { v: 'V07', angulo: 'Rutina / momento de uso', formato: 'Cómo funciona 1-2-3', titular: 'Tres pasos antes de dormir' },
  { v: 'V08', angulo: 'Objeción de confianza', formato: 'Mito vs. realidad', titular: '¿Grasosa? Se absorbe en un minuto' },
  { v: 'V09', angulo: 'Transformación / resultado', formato: 'Lifestyle en uso', titular: 'Te levantas con la cara descansada' },
  { v: 'V10', angulo: 'Testimonio', formato: 'Tarjeta de testimonio', titular: 'Por fin una crema que sí se nota' },
];
const N = VARIACIONES.length;
const T_ESTRATEGIA = 10; // la estrategia y los 4 primeros anuncios
const T_PROMPTS = 24; // los demás anuncios (V10 no sale: "Escribir de nuevo")
const GEN = 9; // lo que tarda kie en una imagen (acelerado)
const REV = 5; // la revisión de un cuadrado
const REV_V = 4; // la revisión de un vertical (y la de una regenerada)
const PROBLEMA = '(prueba) el titular tiene una letra cambiada';
const SIN_IMAGEN = 'kie no quiso hacer esta imagen por sus reglas de contenido';

const ESTRATEGIA = {
  resumen:
    'Una marca suave y nocturna: azul profundo con crema cálida, mucha luz sobre el envase y titulares cortos. Habla de dormir bien y despertar con la piel descansada.',
  paleta: [
    { hex: '#1E3A8A', nombre: 'Azul noche' },
    { hex: '#F7F3EC', nombre: 'Crema' },
    { hex: '#C9A66B', nombre: 'Dorado suave' },
    { hex: '#0F172A', nombre: 'Tinta' },
  ],
  tipografia: 'Poppins Bold para los titulares y Poppins Regular para el resto',
  estilo: 'Fotografía limpia de producto con luz suave de noche y fondos de color de la marca',
  beneficios: ['Hidrata toda la noche', 'La piel amanece descansada', 'No deja la cara grasosa', 'Un frasco dura dos meses'],
  caracteristicas: ['Ácido hialurónico', 'Extracto de manzanilla', 'Sin perfume', 'Frasco de 50 ml'],
};

/** Cada tramo de la vida de una pieza: desde qué segundo está en qué estado, con qué versión. */
function sumar(tramos, desde, estado, extra = {}) {
  const previo = tramos[tramos.length - 1] || { version: 0, versiones: [] };
  tramos.push({ version: previo.version, versiones: previo.versiones, problemas: [], motivo: null, ...extra, desde, estado });
}
const conVersionNueva = (tramos, motivo, desde) => {
  const previo = tramos[tramos.length - 1];
  // (una pieza que quedó sin imagen no tiene versión anterior que guardar)
  return { version: previo.version + 1, versiones: previo.version >= 1 ? [...previo.versiones, { n: previo.version, motivo, desde }] : previo.versiones };
};

/** La vida de base del cuadrado de la variación i (sin los pedidos del usuario). */
function vidaCuadrado(i, escrita) {
  const t = [];
  sumar(t, 0, 'en-cola');
  if (escrita === null) return t;
  const s = escrita + 1.2 * (i < 4 ? i : i - 4);
  sumar(t, s, 'generando');
  sumar(t, s + GEN, 'revisando', { version: 1 });
  const r = s + GEN + REV;
  const v = VARIACIONES[i].v;
  // la revisión ya no rehace nada sola (2026-11-09): lo que nota queda «con aviso», con su nota
  if (v === 'V02' || v === 'V03') sumar(t, r, 'te-necesita', { problemas: [PROBLEMA] });
  else if (v === 'V07') sumar(t, r, 'sin-revisar');
  else sumar(t, r, 'listo');
  return t;
}

/** La vida de base del vertical: sale del cuadrado apenas este termina. */
function vidaVertical(i, finCuadrado) {
  const t = [];
  sumar(t, 0, 'en-cola');
  if (!Number.isFinite(finCuadrado)) return t;
  const v = VARIACIONES[i].v;
  const s = finCuadrado + 0.5 + (i % 3) * 0.6;
  sumar(t, s, 'generando');
  if (v === 'V09') {
    sumar(t, s + GEN, 'sin-imagen', { motivo: SIN_IMAGEN });
    return t;
  }
  sumar(t, s + GEN, 'revisando', { version: 1 });
  // (el vertical de V02 sale de un cuadrado con aviso y la revisión también nota algo en él)
  if (v === 'V02') sumar(t, s + GEN + REV_V, 'te-necesita', { problemas: [PROBLEMA] });
  else sumar(t, s + GEN + REV_V, 'listo');
  return t;
}

const finDe = (tramos) => {
  const u = tramos[tramos.length - 1];
  return PIEZA_FINAL.has(u.estado) ? u.desde : Infinity;
};
const enEl = (tramos, t) => {
  let actual = tramos[0];
  for (const x of tramos) if (x.desde <= t) actual = x;
  return actual;
};

/** Un pedido de "Regenerar" sobre una pieza ya terminada: (ajustando) → rehaciendo → revisando → lista, versión nueva. */
function sumarRegeneracion(tramos, desde, { instruccion, motivo = 'usuario' }) {
  let s = Math.max(desde, finDe(tramos));
  if (!Number.isFinite(s)) return { inicio: desde, generando: desde, revisando: desde, fin: Infinity };
  const inicio = s;
  if (instruccion) {
    sumar(tramos, s, 'ajustando', { problemas: [] });
    s += 3;
  }
  const generando = s;
  sumar(tramos, s, 'regenerando', { problemas: [], motivo: null });
  sumar(tramos, s + GEN, 'revisando', conVersionNueva(tramos, motivo, s + GEN));
  sumar(tramos, s + GEN + REV_V, 'listo');
  return { inicio, generando, revisando: s + GEN, fin: s + GEN + REV_V };
}

/**
 * Una simulación: el reloj (que se frena con Detener o con un `alto`), los pedidos y la vista en la forma de §9.2.
 * Todos los tiempos son segundos desde que "se tocó Generar".
 */
function crearSimulacion(lote, { alto = null, listo = false, prueba = false } = {}) {
  const sim = {
    lote,
    acumulado: listo ? 999 : alto ? (['ffmpeg', 'fila'].includes(alto) ? 1 : ['claude', 'bloqueo'].includes(alto) ? 6 : 34) : 0,
    desde: Date.now(),
    alto: listo ? null : alto,
    pedidos: [],
    creado: Date.now(),
  };
  sim.creado -= sim.acumulado * 1000;
  const reloj = () => sim.acumulado + (sim.alto ? 0 : (Date.now() - sim.desde) / 1000);
  const fecha = (seg) => new Date(sim.creado + seg * 1000).toISOString();

  /** La vida de todas las piezas con los pedidos aplicados (se recalcula entera: son pocas). */
  function vidas() {
    const escritas = VARIACIONES.map((x, i) => (i < 4 ? T_ESTRATEGIA : i < N - 1 ? T_PROMPTS : null));
    const deTexto = sim.pedidos.filter((p) => p.tipo === 'prompt');
    for (const p of deTexto) escritas[VARIACIONES.findIndex((x) => x.v === p.v)] = p.t0 + 4;
    const vida = {};
    const ciclos = {};
    VARIACIONES.forEach((x, i) => {
      vida[`${x.v}_1x1`] = vidaCuadrado(i, escritas[i]);
      vida[`${x.v}_9x16`] = vidaVertical(i, finDe(vida[`${x.v}_1x1`]));
    });
    for (const p of sim.pedidos.filter((q) => q.pieza)) {
      const c = sumarRegeneracion(vida[p.pieza], p.t0, { instruccion: p.instruccion });
      ciclos[p.id] = c;
      // el cuadrado rehecho rehace también su vertical, para que sigan siendo el mismo anuncio
      if (p.pieza.endsWith('_1x1')) sumarRegeneracion(vida[p.pieza.replace('_1x1', '_9x16')], c.fin + 0.5, { motivo: 'cuadrado-nuevo' });
    }
    return { escritas, vida, ciclos };
  }

  function estadoDePedido(p, t, ciclos, escritas) {
    if (p.tipo === 'prompt') return t < escritas[VARIACIONES.findIndex((x) => x.v === p.v)] ? 'ajustando' : 'listo';
    const c = ciclos[p.id];
    if (!c || t < c.inicio) return 'en-espera';
    if (t < c.generando) return 'ajustando';
    if (t < c.revisando) return 'generando';
    if (t < c.fin) return 'revisando';
    return 'listo';
  }

  function vista() {
    const t = reloj();
    const { escritas, vida, ciclos } = vidas();
    const pedidos = sim.pedidos.map((p) => {
      const estado = estadoDePedido(p, t, ciclos, escritas);
      return {
        id: p.id,
        ...(p.pieza ? { pieza: p.pieza } : { v: p.v }),
        estado,
        resumen: estado === 'listo' ? (p.tipo === 'prompt' ? 'Lo escribí de nuevo' : p.instruccion ? 'Hice el cambio que pediste' : 'Hice otra versión') : null,
      };
    });
    const pendiente = (pieza) => pedidos.find((p) => p.pieza === pieza && !['listo', 'no-aplicado'].includes(p.estado)) || null;

    const variaciones = VARIACIONES.map((x, i) => {
      const escrita = escritas[i] !== null && t >= escritas[i];
      const sinPrompt = !escrita && (escritas[i] === null) && t >= T_PROMPTS;
      const piezas = {};
      for (const [formato, sufijo, nombre] of [
        ['1:1', '1x1', 'cuadrado'],
        ['9:16', '9x16', 'vertical'],
      ]) {
        const id = `${x.v}_${sufijo}`;
        const e = enEl(vida[id], t);
        const conImagen = e.version >= 1;
        const ped = pendiente(id);
        const dibujo = (version, conLogo) => dibujoAnuncio({ i, v: x.v, formato, version, conLogo, titular: x.titular });
        piezas[formato] = {
          pieza: id,
          estado: e.estado,
          url: conImagen ? dibujo(e.version, true) : null,
          urlSinLogo: conImagen ? dibujo(e.version, false) : null,
          miniatura: conImagen ? dibujo(e.version, true) : null,
          descarga: `crema-luna-${x.v}-${nombre}.svg`,
          version: e.version,
          versiones: e.versiones.map((o) => ({ n: o.n, url: dibujo(o.n, true), miniatura: dibujo(o.n, true), fecha: fecha(o.desde), motivo: o.motivo })),
          problemas: e.problemas || [],
          motivo: e.motivo || null,
          hayPrompt: escrita && (conImagen || e.estado !== 'en-cola'),
          puedeRegenerar: escrita && PIEZA_FINAL.has(e.estado) && !ped && !sim.alto,
          pedido: ped ? { id: ped.id, estado: ped.estado } : null,
        };
      }
      return { v: x.v, angulo: x.angulo, formato: x.formato, titular: x.titular, estado: sinPrompt ? 'sin-prompt' : 'ok', piezas };
    });

    // el final: todas las piezas quietas (o sin anuncio escrito) y ningún pedido en camino
    const todas = variaciones.flatMap((x) => Object.values(x.piezas).map((p) => ({ p, sinPrompt: x.estado === 'sin-prompt' })));
    const quietas = todas.every(({ p, sinPrompt }) => sinPrompt || PIEZA_FINAL.has(p.estado));
    const hayPedidos = pedidos.some((p) => !['listo', 'no-aplicado'].includes(p.estado));
    const ultimo = Math.max(T_PROMPTS, ...Object.values(vida).map(finDe).filter(Number.isFinite), ...Object.values(ciclos).map((c) => c.fin).filter(Number.isFinite));
    const terminado = quietas && !hayPedidos && t >= ultimo + 2 && t >= T_PROMPTS;
    const paso = terminado ? 'informe' : t < 1.5 ? 'preparar' : t < 3 ? 'saldo' : t < T_ESTRATEGIA ? 'estrategia' : quietas && !hayPedidos ? 'informe' : 'anuncios';

    // el conductor (con el alto pedido, si lo hay)
    const PASOS = [
      ['preparar', 'Preparando tu lote'],
      ['saldo', 'Revisando tu saldo de kie'],
      ['estrategia', 'La IA arma la estrategia'],
      ['anuncios', 'Creando tus anuncios'],
      ['informe', 'Armando tu informe'],
    ];
    const iPaso = PASOS.findIndex(([id]) => id === paso);
    const altoAhora = sim.alto && !terminado ? sim.alto : null;
    const ALTOS = {
      saldo: { estado: 'pausado', motivo: 'saldo', error: { mensaje: 'Tu saldo de kie no alcanza: recarga para seguir.', motivo: 'saldo' } },
      'limite-claude': {
        estado: 'esperando',
        motivo: 'limite-claude',
        error: { mensaje: `Se acabó por ahora el uso de tu plan de ${nombreIAActual()}: sigo solo a las ${new Date(Date.now() + 95 * 60000).toTimeString().slice(0, 5)}. Lo ya hecho no se repite.`, motivo: 'limite-claude', reintentoEn: new Date(Date.now() + 95 * 60000).toISOString() },
      },
      claude: { estado: 'error', motivo: 'claude', error: { mensaje: `No encuentro ${programaIAActual()} en esta computadora.`, motivo: 'claude' } },
      ffmpeg: {
        estado: 'error',
        motivo: 'ffmpeg',
        error: { mensaje: 'Falta un programa que la app necesita para revisar y armar tus imágenes (ffmpeg). Cierra la app y vuelve a abrirla: se instala solo.', motivo: 'ffmpeg' },
      },
      error: { estado: 'error', motivo: 'servidor', error: { mensaje: 'kie no respondió dos veces seguidas.', motivo: 'servidor', detalle: 'fetch failed' } },
      clave: { estado: 'error', motivo: 'clave', error: { mensaje: 'Tu clave de kie no es válida o se venció.', motivo: 'clave' } },
      bloqueo: { estado: 'error', motivo: 'bloqueo', error: { mensaje: 'Para hacer estos anuncios necesito saber qué incluye el producto: el formulario no lo dice.', motivo: 'bloqueo' } },
      detenido: { estado: 'pausado', motivo: 'detenido', error: null },
      fila: { estado: 'esperando', motivo: null, error: null },
    };
    const a = altoAhora ? ALTOS[altoAhora] || ALTOS.error : null;
    const estado = terminado ? 'listo' : a ? a.estado : 'corriendo';
    const pasos = PASOS.map(([id, nombre], k) => ({
      id,
      nombre,
      estado: terminado ? 'hecho' : k < iPaso ? 'hecho' : k === iPaso ? (a?.estado === 'error' ? 'error' : a ? 'pendiente' : 'corriendo') : 'pendiente',
      ...(k === iPaso && a?.error ? { error: a.error } : {}),
    }));

    // el avance
    const de1x1 = variaciones.map((x) => x.piezas['1:1']);
    const de9x16 = variaciones.map((x) => x.piezas['9:16']);
    const listas = todas.filter(({ p }) => PIEZA_FINAL.has(p.estado) && p.url).length;
    const nEscritas = variaciones.filter((x, i) => escritas[i] !== null && t >= escritas[i]).length;
    const sinPrompt = variaciones.filter((x) => x.estado === 'sin-prompt').length;
    const creando = todas.filter(({ p }) => p.estado === 'generando' || p.estado === 'regenerando').length;
    const revisando = todas.filter(({ p }) => p.estado === 'revisando').length;
    const frase = terminado
      ? 'Tu lote está listo'
      : paso === 'preparar'
        ? 'Preparando tu lote'
        : paso === 'saldo'
          ? 'Revisando tu saldo de kie'
          : paso === 'estrategia'
            ? 'La IA arma la estrategia de tu lote'
            : paso === 'informe'
              ? 'Armando tu informe'
              : [
                  creando ? `Creando ${creando} ${creando === 1 ? 'imagen' : 'imágenes'}` : null,
                  revisando ? `${nombreIAActual()} está revisando ${revisando}` : null,
                  t < T_PROMPTS && t >= T_ESTRATEGIA ? `${nombreIAActual()} escribe los anuncios que faltan` : null,
                  `${listas} de ${N * 2} listas`,
                ]
                  .filter(Boolean)
                  .join(' · ');

    const avance = {
      listas,
      total: N * 2,
      escritas: nEscritas,
      frase,
      etapas: [
        { id: 'estrategia', estado: t >= T_ESTRATEGIA ? 'hecho' : t >= 3 ? 'en-curso' : 'pendiente' },
        { id: 'prompts', hechas: nEscritas + sinPrompt, total: N },
        { id: 'cuadrados', hechas: de1x1.filter((p) => p.url || p.estado === 'sin-imagen').length, total: N },
        { id: 'revision', hechas: todas.filter(({ p }) => PIEZA_FINAL.has(p.estado)).length, total: N * 2 },
        { id: 'verticales', hechas: de9x16.filter((p) => p.url || p.estado === 'sin-imagen').length, total: N },
        { id: 'logo', hechas: todas.filter(({ p }) => PIEZA_FINAL.has(p.estado) && p.url).length, total: N * 2 },
      ],
    };

    // el informe, solo al final (con el costo: 10 créditos por cada imagen hecha, versiones incluidas)
    let informe = null;
    if (terminado) {
      const fin = (estadoPieza) => todas.filter(({ p }) => p.estado === estadoPieza).map(({ p }) => p);
      const imagenes = todas.reduce((s, { p }) => s + (p.version || 0), 0);
      informe = {
        tipo: 'imagen-ads',
        fecha: fecha(ultimo + 2),
        variaciones: N,
        archivos: listas,
        modoPrueba: prueba,
        revision: {
          aLaPrimera: todas.filter(({ p }) => p.estado === 'listo' && p.version === 1).length,
          arregladas: fin('arreglado').map((p) => p.pieza),
          conDetalles: fin('te-necesita').map((p) => ({ pieza: p.pieza, problemas: p.problemas })),
          sinRevisar: fin('sin-revisar').map((p) => p.pieza),
          sinImagen: fin('sin-imagen').map((p) => ({ pieza: p.pieza, motivo: p.motivo })),
          sinPrompt: variaciones.filter((x) => x.estado === 'sin-prompt').map((x) => x.v),
        },
        costo: { creditos: imagenes * 10, dolares: imagenes * 10 * 0.005, piezas: imagenes, estimadas: 0, estimado: false },
      };
    }

    return {
      lote,
      titulo: 'Crema Luna',
      modoPrueba: prueba,
      motor: 'claude', // la IA que hizo la estrategia (como vistaDelLote del servidor)
      brief: { cantidad: N, formatos: ['1:1', '9:16'], idioma: 'es', logo: { posicion: 'arriba-centro', url: LOGO, transparente: true } },
      producto: { id: PRODUCTO.id, nombre: PRODUCTO.nombre, foto: fotoDeProducto('#1E3A8A') },
      conductor: { estado, paso: a && !terminado && altoAhora === 'ffmpeg' ? 'preparar' : paso, motivo: a?.motivo || null, pasos, error: a?.estado === 'error' ? a.error : null },
      fila: altoAhora === 'fila' ? { detrasDe: ['Anuncios de imagen: Sérum Glow'] } : null,
      avance,
      estrategia: t >= T_ESTRATEGIA ? { ...ESTRATEGIA, plan: VARIACIONES.map(({ v, angulo, formato, titular }) => ({ v, angulo, formato, titular })) } : null,
      variaciones,
      pedidos,
      informe,
    };
  }

  const ahora = () => {
    // congela el reloj donde está
    sim.acumulado = reloj();
    sim.desde = Date.now();
  };
  let siguiente = 1;
  const acciones = {
    simulada: true,
    async regenerar(cuerpo) {
      const v = vista();
      if (cuerpo?.tipo === 'prompt') {
        if (sim.pedidos.some((p) => p.tipo === 'prompt' && p.v === cuerpo.v)) throw new ErrorApi('Este anuncio ya se está escribiendo de nuevo.', 409);
        const id = `U${String(siguiente++).padStart(4, '0')}`;
        sim.pedidos.push({ id, v: cuerpo.v, tipo: 'prompt', t0: reloj() });
        return { pedido: { id, estado: 'pendiente' } };
      }
      const p = v.variaciones.flatMap((x) => Object.values(x.piezas)).find((x) => x.pieza === cuerpo?.pieza);
      if (!p) throw new ErrorApi('No encuentro esa imagen.', 404);
      if (p.pedido || !p.puedeRegenerar) throw new ErrorApi('Esta imagen ya tiene un cambio en camino.', 409);
      const id = `U${String(siguiente++).padStart(4, '0')}`;
      sim.pedidos.push({ id, pieza: cuerpo.pieza, instruccion: String(cuerpo.instruccion || '').trim(), t0: reloj() });
      return { pedido: { id, estado: 'pendiente' } };
    },
    async detener() {
      ahora();
      sim.alto = 'detenido';
      return vista().conductor;
    },
    async continuar() {
      ahora();
      sim.alto = null;
      return vista().conductor;
    },
    async prompt(pieza, { como } = {}) {
      await new Promise((r) => setTimeout(r, 250));
      const x = VARIACIONES.find((y) => pieza.startsWith(y.v));
      if (como === 'json') return { texto: JSON.stringify({ ad_info: { variation_id: x?.v, simulacion: true }, titular: x?.titular }, null, 2) };
      return { texto: `(Simulación) En un lote de verdad aquí va el texto exacto que recibió el modelo para ${pieza}.` };
    },
  };
  return { lote, vista, acciones };
}

/**
 * La simulación de un lote como si fuera useLote(): { datos, cargando, error, recargar, leido, alDia, acciones }.
 * lote null = apagada (no corre ningún reloj). Se pone al día cada segundo.
 */
export function useLoteSimulado(lote, consulta) {
  const opciones = useMemo(
    () => ({ alto: consulta?.get('alto') || null, listo: consulta?.get('listo') === '1', prueba: consulta?.get('prueba') === '1' }),
    [consulta?.toString()] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ref = useRef(null);
  const clave = lote ? `${lote}|${JSON.stringify(opciones)}` : null;
  if (clave && ref.current?.clave !== clave) ref.current = { clave, sim: crearSimulacion(lote, opciones) };
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!clave) return undefined;
    const id = setInterval(() => setTic((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [clave]);
  if (!clave) return { datos: null, cargando: false, error: null, recargar: () => Promise.resolve(), leido: false, alDia: false, acciones: null };
  const { sim } = ref.current;
  return { datos: sim.vista(), cargando: false, error: null, recargar: () => Promise.resolve(setTic((x) => x + 1)), leido: true, alDia: true, acciones: sim.acciones };
}
