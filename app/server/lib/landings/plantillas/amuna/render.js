// LA PLANTILLA AMUNA, ARMADA EN EL SERVIDOR (2026-11-27f). `htmlDeLanding(D)` devuelve la página completa (HTML + CSS + un
// script corto) a partir de los datos (el mismo formato que datos.js). Sin JavaScript ya se ve entera (las capturas de la
// revisión desactivan los scripts); el script solo mueve la galería, elige el combo, abre la ventana de pedido y muestra
// la barra fija. Una imagen «gris:<ancho>x<alto>:<qué va>» sale como recuadro gris con su medida (si GPT no la hizo).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
let css = null;
const estilos = () => (css ??= fs.readFileSync(path.join(AQUI, 'estilos.css'), 'utf8'));

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em class="dest">$1</em>');
export const cop = (v) => `$${Math.round(Number(v) || 0).toLocaleString('es-CO').replace(/,/g, '.')}`;
const lista = (x) => (Array.isArray(x) ? x : []);
const notaFoto=x=>x?.fotoNota?`<small class="nota-foto-ia">${esc(x.fotoNota)}</small>`:'';
const est = (n = 5) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** La medida de una imagen «gris:942x1670:…» -> [942, 1670] (o null). */
export const medidaGris = (x) => {
  const m = /^gris:(\d+)x(\d+)/.exec(String(x || ''));
  return m ? [Number(m[1]), Number(m[2])] : null;
};

/** Un recuadro gris del tamaño de la imagen que va ahí, como SVG (data:). Lo demás, tal cual. */
export function ph(x) {
  const m = /^gris:(\d+)x(\d+)(?::(.*))?$/.exec(String(x || ''));
  if (!m) return String(x || '');
  const W = 600;
  const H = Math.round((W * Number(m[2])) / Number(m[1]));
  const lineas = [];
  for (const p of (m[3] || '').trim().split(/\s+/).filter(Boolean)) {
    const u = lineas[lineas.length - 1];
    if (u && `${u} ${p}`.length <= 17) lineas[lineas.length - 1] = `${u} ${p}`;
    else lineas.push(p);
  }
  if (lineas.length) lineas.push(`${m[1]} × ${m[2]} px`);
  const fs2 = 34;
  const cy = H / 2 - (lineas.length ? (lineas.length * fs2 * 1.25) / 2 + 30 : 0);
  const e = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#E3E3E3"/><g transform="translate(${W / 2 - 50} ${cy - 40})" fill="none" stroke="#B4B4B4" stroke-width="6" stroke-linejoin="round"><rect x="3" y="3" width="94" height="74" rx="8"/><path d="M8 70l26-30 18 20 14-12 26 22"/><circle cx="70" cy="24" r="8"/></g>${lineas.map((l, i) => `<text x="${W / 2}" y="${cy + 80 + i * fs2 * 1.25}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${fs2}" font-weight="${i === lineas.length - 1 ? 500 : 600}" fill="${i === lineas.length - 1 ? '#9E9E9E' : '#8A8A8A'}">${e(l)}</text>`).join('')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const S = (x) => esc(ph(x));

// los colores de cada landing (D.tema) -> las variables del CSS
const VARS = { amarillo: '--amarillo', fuerte: '--amarillo-fuerte', suave: '--amarillo-suave', borde: '--amarillo-borde', estrella: '--estrella', sobre: '--sobre-acento', tinta: '--tinta-btn', pie: '--pie', aviso: '--aviso-fondo', ahorro: '--ahorro', enlace: '--enlace', chip: '--chip-res', foto: '--foto-fondo', sombra: '--sombra-btn', verde: '--verde', verdeSuave: '--verde-suave', fondo: '--fondo', fondo2: '--fondo-2' };
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

const ICO = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path style="fill:var(--amarillo)" d="M12 1l2.6 2.1 3.3-.4 1.2 3.1 3.1 1.2-.4 3.3L23 12l-2.1 2.6.4 3.3-3.1 1.2-1.2 3.1-3.3-.4L12 23l-2.6-2.1-3.3.4-1.2-3.1-3.1-1.2.4-3.3L1 12l2.1-2.6-.4-3.3 3.1-1.2 1.2-3.1 3.3.4z"/><path d="M7.5 12.3l3 3 6-6.3" fill="none" style="stroke:var(--tinta-btn)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  carro: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2 3h3l2.6 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 8H6"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" style="stroke:var(--amarillo-fuerte)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5" stroke-linecap="round"/></svg>',
  si: '<svg class="ico" viewBox="0 0 24 24" aria-label="Sí"><circle cx="12" cy="12" r="10" fill="none" style="stroke:var(--sobre-acento)" stroke-width="2"/><path d="M7.5 12.4l3 3 6-6.2" fill="none" style="stroke:var(--sobre-acento)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  no: '<svg class="ico" viewBox="0 0 24 24" aria-label="No"><circle cx="12" cy="12" r="10" fill="#111"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  escudo: '<svg class="escudo" viewBox="0 0 48 56" aria-hidden="true"><path d="M24 2L4 9v15c0 14 9 25 20 30 11-5 20-16 20-30V9z" style="fill:var(--amarillo)"/><path d="M15 28l7 7 12-13" fill="none" style="stroke:var(--tinta-btn)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function combosHtml(D, elegido) {
  return lista(D.oferta?.combos)
    .map((c) => {
      const ahorro = c.antes && c.antes > c.precio ? c.antes - c.precio : 0;
      return `<button type="button" class="combo" role="radio" aria-checked="${c.id === elegido}" data-combo="${esc(c.id)}">${c.insignia ? `<span class="insignia">${esc(c.insignia)}</span>` : ''}<span class="foto"><img src="${S(c.foto)}" alt="" loading="lazy"></span><span class="info"><span class="precio"><strong>${cop(c.precio)}</strong><span>COP</span>${ahorro ? `<s>${cop(c.antes)}</s>` : ''}</span><span class="nombre">${esc(c.nombre)}</span><span class="unid">${c.cantidad} ${esc(c.cantidad === 1 ? D.producto?.unidad : D.producto?.unidades)}</span>${ahorro ? `<span class="ahorro">Ahorras ${cop(ahorro)}</span>` : ''}</span></button>`;
    })
    .join('');
}
const acordeon = (items) => lista(items).map(([p, r]) => `<details><summary>${esc(p)}</summary><div class="resp">${fmt(r)}</div></details>`).join('');

// (2026-11-27g) las historias con el marco de Instagram de la MARCA (barritas, avatar, @usuario y un sticker), en HTML:
// el texto se ve nítido y nunca se corta
function historiasIG(D) {
  const fotos = lista(D.historias?.fotos);
  const usuario = String(D.historias?.usuario || '').trim();
  const ini = (String(D.producto?.marca || D.producto?.corto || D.producto?.nombre || '').trim()[0] || '•').toUpperCase();
  const stickers = lista(D.historias?.stickers);
  return fotos
    .map((src, k) => `<figure class="ig"><img src="${S(src)}" alt="" loading="lazy"><div class="ig-top" aria-hidden="true"><div class="ig-barras">${fotos.map((_, i) => `<i class="${i <= k ? 'ya' : ''}"></i>`).join('')}</div>${usuario ? `<div class="ig-quien"><span class="ig-ava">${esc(ini)}</span><b>${esc(usuario)}</b><small>${k + 2} h</small></div>` : ''}</div>${stickers[k] ? `<span class="ig-sticker">${esc(stickers[k])}</span>` : ''}</figure>`)
    .join('');
}

/** Las secciones de la página (solo el <main>). */
// (2026-11-27k) el usuario eligió «AMUNA tal cual»: el orden de su página (los combos arriba, justo después del título)
export const ORDEN_SCROLL = ['galeria', 'prueba-social', 'titulo-y-beneficios', 'oferta', 'testimonio-destacado', 'dudas-rapidas', 'aviso-pedido', 'creativo', 'ellas-cuentan', 'ingredientes', 'historias', 'ruta', 'experiencias', 'experiencias-fotos', 'pasos', 'franja', 'comparacion', 'compra-clara', 'cuidado', 'resenas', 'preguntas-frecuentes', 'pie'];

export function cuerpoDeLanding(D) {
  const P = D.producto || {};
  const g = lista(D.galeria);
  const elegido = lista(D.oferta?.combos).some((c) => c.id === D.oferta?.elegido) ? D.oferta.elegido : lista(D.oferta?.combos)[0]?.id;
  const R = D.resenas || {};
  const totalBarras = lista(R.barras).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const ellas = lista(D.ellas?.items);
  // las secciones; ORDEN_SCROLL dice en qué orden van
  const B = {
    'galeria': `
  <section class="galeria" data-seccion="galeria" aria-label="Imágenes del producto">
    <div class="g-principal"><img id="gMain" src="${S(g[0])}" alt="${esc(P.nombre)}"></div>
    <div class="g-nav">
      <button type="button" class="g-flecha" id="gPrev" aria-label="Imagen anterior">‹</button>
      <div class="g-mini" id="gMini">${g.map((s, k) => `<button type="button" data-k="${k}" data-src="${S(s)}" aria-label="Imagen ${k + 1}" aria-current="${k === 0}"><img src="${S(s)}" alt="" loading="lazy"></button>`).join('')}</div>
      <button type="button" class="g-flecha" id="gNext" aria-label="Imagen siguiente">›</button>
    </div>
  </section>`,
    'prueba-social': `
  ${D.pruebaSocial ? `<div class="social" data-seccion="prueba-social"><span class="avatares">${lista(D.pruebaSocial.avatares).map((s) => `<img src="${S(s)}" alt="">`).join('')}</span><b>${esc(D.pruebaSocial.texto)}</b> <u>${esc(D.pruebaSocial.enlace)}</u><span class="estrellas" aria-label="${esc(D.pruebaSocial.nota || 5)} de 5">${est(Math.round(Number(String(D.pruebaSocial.nota || 5).replace(',', '.')) || 5))}</span></div>` : ''}`,
    'titulo-y-beneficios': `
  <div class="titulo" data-seccion="titulo-y-beneficios">
    ${D.titulo?.titular ? `<p class="t-producto">${esc(P.nombre)}</p><h1>${fmt(D.titulo.titular)}</h1>${D.titulo?.subtitulo ? `<p class="t-sub">${fmt(D.titulo.subtitulo)}</p>` : ''}` : `<h1>${esc(P.nombre)}</h1>`}
    <p class="lede">${fmt(D.titulo?.lede)}</p>
    <ul class="checks">${lista(D.titulo?.checks).map((c) => `<li>${ICO.check}<span>${fmt(c)}</span></li>`).join('')}</ul>
    ${D.titulo?.boton ? `<a class="btn t-btn" href="#oferta" id="ctaArriba">${ICO.carro}<span>${esc(D.titulo.boton)}</span></a>` : ''}
  </div>`,
    'dolor': `
  ${D.dolor && lista(D.dolor.frases).length ? `<section class="sec dolor" data-seccion="dolor">
    <h2 class="titulo-sec" style="font-size:28px">${fmt(D.dolor.titulo)}</h2>
    <div class="dolor-frases">${lista(D.dolor.frases).map((f) => `<blockquote>“${esc(f)}”</blockquote>`).join('')}</div>
    ${D.dolor.cierre ? `<p class="dolor-cierre">${fmt(D.dolor.cierre)}</p>` : ''}
  </section>` : ''}`,
    'creativo': `
  ${D.creativo ? `<div class="imagen-full" data-seccion="creativo"><img src="${S(D.creativo)}" alt="${esc(P.nombre)}" loading="lazy"></div>` : ''}`,
    'ruta': `
  ${lista(D.ruta?.pasos).length ? `<section class="sec ruta" data-seccion="ruta">
    <h2 class="titulo-sec" style="font-size:34px">${fmt(D.ruta?.titulo)}</h2>
    <p class="sub-sec" style="font-weight:700">${fmt(D.ruta?.sub)}</p>
    <div class="linea">${lista(D.ruta?.pasos).map(([pill, t, p]) => `<div class="paso-ruta"><span class="pill">${esc(pill)}</span><h3>${esc(t)}</h3><p>${fmt(p)}</p></div>`).join('')}</div>
  </section>` : ''}`,
    'testimonio-destacado': `
  ${D.testimonio ? `<article class="testi" data-seccion="testimonio-destacado">${D.testimonio.foto ? `<img src="${S(D.testimonio.foto)}" alt="">` : `<span class="ini" aria-hidden="true">${esc(String(D.testimonio.nombre || '').split(/\s+/).map((x) => x[0] || '').slice(0, 2).join('').toUpperCase())}</span>`}<div><b>${esc(D.testimonio.nombre)}</b> <span class="estrellas">${est(D.testimonio.estrellas || 5)}</span><p>${fmt(D.testimonio.texto)}</p>${notaFoto(D.testimonio)}</div></article>` : ''}`,
    'ellas-cuentan': `
  ${ellas.length ? `<section class="sec ellas" data-seccion="ellas-cuentan">
    <h2 class="titulo-sec" style="font-size:26px">${fmt(D.ellas?.titulo)}</h2>
    <p class="sub-sec" style="font-weight:700;color:var(--negro)">${fmt(D.ellas?.sub)}</p>
    <div class="carril" style="margin-top:22px">${ellas.map((x) => (x.tarjeta ? `<img src="${S(x.foto)}" alt="${esc([x.nombre, x.texto].filter(Boolean).join(': '))}" loading="lazy">` : `<article><div class="ph"><img src="${S(x.foto)}" alt="" loading="lazy"></div>${notaFoto(x)}<div class="quien"><b>${esc(x.nombre)}</b>${x.ciudad ? `<span class="chip-ok">${esc(x.ciudad)}</span>` : ''}</div><div class="estrellas" aria-label="${x.estrellas || 5} de 5">${est(x.estrellas || 5)}</div><p>${fmt(x.texto)}</p></article>`)).join('')}</div>
  </section>` : ''}`,
    'historias': `
  ${lista(D.historias?.fotos).length ? `<section class="sec historias" data-seccion="historias">
    <h2 class="titulo-sec">${fmt(D.historias?.titulo)}</h2>
    <p class="sub-sec" style="font-size:16px;line-height:1.7">${fmt(D.historias?.texto)}</p>
    <a class="btn" href="#oferta" style="text-decoration:none">${esc(D.historias?.boton)} <span aria-hidden="true">↓</span></a>
    ${D.historias?.nota ? `<p class="nota">${fmt(D.historias.nota)}</p>` : ''}
    <div class="carril">${historiasIG(D)}</div>
  </section>` : ''}`,
    'experiencias': `
  ${lista(D.experiencias?.items).length ? `<section class="sec experiencias" data-seccion="experiencias">
    <span class="pill-borde"><span class="estrellas">★★★★★</span>${esc(D.experiencias?.pill)}</span>
    <h2 class="titulo-sec">${fmt(D.experiencias?.titulo)}</h2>
    <div class="carril">${lista(D.experiencias?.items).map((x) => `<article><img src="${S(x.foto)}" alt="" loading="lazy">${notaFoto(x)}<div class="cuerpo"><div class="quien"><span class="estrellas">${est(x.estrellas || 5)}</span><b>${esc(x.nombre)}</b></div><p>${fmt(x.texto)}</p><div class="mini-prod"><img src="${S(D.experiencias.fotoProducto)}" alt=""><div><b>${esc(P.nombre)}</b><span>${cop(D.experiencias.precioDesde)}</span></div></div></div></article>`).join('')}</div>
  </section>` : ''}`,
    'experiencias-fotos': `
  ${lista(D.ugc?.fotos).length ? `<section class="sec ugc" data-seccion="experiencias-fotos">
    <div class="carril">${lista(D.ugc?.fotos).map((s) => `<img src="${S(s)}" alt="" loading="lazy">`).join('')}</div>
    <h2 class="titulo-sec">${fmt(D.ugc?.titulo)}</h2>
    ${D.ugc?.estrellas ? '<div class="estrellas" aria-hidden="true">★★★★★</div>' : ''}
  </section>` : ''}`,
    'resenas': `
  ${lista(R.items).length ? `<section class="sec resenas" data-seccion="resenas">
    <h2 class="titulo-sec" style="font-size:22px">${fmt(R.titulo)}</h2>
    <div class="resumen"><span class="nota">${esc(R.nota)}</span><span class="cuantas">${esc(R.cuantas)}</span></div>
    <div class="barras">${lista(R.barras).map((n, k) => `<div><span>${5 - k}</span><i><b style="width:${Math.round((100 * (Number(n) || 0)) / totalBarras)}%"></b></i><span>${Number(n) || 0}</span></div>`).join('')}</div>
    <p class="chica">Calificaciones de las reseñas mostradas (${lista(R.items).length})</p>
    ${lista(R.fotos).length ? `<hr><div class="carril fotos-res">${lista(R.fotos).map((s) => `<img src="${S(s)}" alt="" loading="lazy">`).join('')}</div>` : ''}
    ${lista(R.items).length > 1 ? '<div class="ordenar"><select id="orden" aria-label="Ordenar reseñas"><option value="recientes">Más recientes primero</option><option value="mejores">Mejor calificadas</option><option value="peores">Peor calificadas</option></select></div>' : ''}
    <div class="lista-res" id="listaRes">${lista(R.items).map((x) => `<article class="res" data-estrellas="${x.estrellas || 5}"><div class="top"><b>${esc(x.nombre)}</b><span>Opinión de cliente</span></div><div class="estrellas" aria-label="${x.estrellas || 5} de 5">${est(x.estrellas || 5)}</div><div class="cuerpo"><div>${x.titulo ? `<h3>${esc(x.titulo)}</h3>` : ''}<p>${fmt(x.texto)}</p></div>${x.foto ? `<img src="${S(x.foto)}" alt="" loading="lazy">` : ''}</div>${notaFoto(x)}${x.lugar ? `<p class="lugar">${esc(x.lugar)}</p>` : ''}</article>`).join('')}</div>
  </section>` : ''}`,
    'ingredientes': `
  ${D.ingredientes ? `<div class="imagen-full" data-seccion="ingredientes"><img src="${S(D.ingredientes)}" alt="Ingredientes de ${esc(P.nombre)}" loading="lazy"></div>` : ''}`,
    'pasos': `
  ${lista(D.pasos?.items).length ? `<section class="sec pasos" data-seccion="pasos">
    <h2 class="titulo-sec">${fmt(D.pasos?.titulo)}</h2>
    <p class="sub-sec">${fmt(D.pasos?.sub)}</p>
    <div class="lista">${lista(D.pasos?.items).map((x, k) => `<div class="paso"><img src="${S(x.foto)}" alt="" loading="lazy"><div><div class="cab"><span class="num">${k + 1}</span><h3>${esc(x.titulo)}</h3></div><p>${fmt(x.texto)}</p></div></div>`).join('')}</div>
  </section>` : ''}`,
    'franja': `
  ${lista(D.franja).length ? `<div class="franja" data-seccion="franja" aria-label="${esc(lista(D.franja).join(' · '))}"><div class="tira" aria-hidden="true">${[0, 1, 2, 3].map(() => lista(D.franja).map((t) => `<span>${esc(t)}</span>`).join('')).join('')}</div></div>` : ''}`,
    'comparacion': `
  ${lista(D.comparacion?.filas).length ? `<section class="sec comparacion" data-seccion="comparacion">
    <h2 class="titulo-sec" style="font-size:32px">${fmt(D.comparacion?.titulo)}</h2>
    <p class="sub-sec">${fmt(D.comparacion?.sub)}</p>
    <div class="tabla" role="table" aria-label="Comparación">
      <div class="c cab" role="columnheader"></div>
      <div class="c cab nuestra" role="columnheader">${esc(D.comparacion?.nuestra)}<small>✓ ${esc(D.comparacion?.nuestraSub)}</small></div>
      <div class="c cab otra" role="columnheader">${esc(D.comparacion?.otra)}<small>✕ ${esc(D.comparacion?.otraSub)}</small></div>
      ${lista(D.comparacion?.filas).map((f, k, a) => `<div class="c izq" role="cell">${esc(f)}</div><div class="c nuestra${k === a.length - 1 ? ' ultima' : ''}" role="cell">${ICO.si}</div><div class="c otra" role="cell">${ICO.no}</div>`).join('')}
    </div>
  </section>` : ''}`,
    'oferta': `
  <section class="sec oferta" data-seccion="oferta" id="oferta">
    <h2>${esc(D.oferta?.titulo)}</h2>
    <div class="combos" role="radiogroup" aria-label="Combos">${combosHtml(D, elegido)}</div>
    <div class="envio"><span>${esc(D.oferta?.envio?.titulo)}</span><span class="envio-dot"><i></i><b>${esc(D.oferta?.envio?.texto)}</b></span></div>
    <button type="button" class="btn btn-carro" data-pedir id="ctaOferta">${ICO.carro}<span>${esc(D.oferta?.boton)}<small>${esc(D.oferta?.subBoton)}</small></span></button>
  </section>`,
    'aviso-pedido': `
  ${D.aviso ? `<div class="aviso" data-seccion="aviso-pedido">${ICO.info}<div><b>${esc(D.aviso.titulo)}</b>${fmt(D.aviso.texto)}</div></div>` : ''}`,
    'compra-clara': `
  ${D.compraClara ? `<section class="sec clara" data-seccion="compra-clara">
    ${ICO.escudo}
    <h2>${fmt(D.compraClara?.titulo)}</h2>
    <p>${fmt(D.compraClara?.texto)}</p>
    <button type="button" class="btn" data-pedir>${esc(D.compraClara?.boton)}</button>
    <div class="garantias">${lista(D.compraClara?.garantias).map((t) => `<div>${esc(t)}</div>`).join('')}</div>
  </section>` : ''}`,
    'dudas-rapidas': `
  ${lista(D.dudas).length ? `<div class="sec acord" data-seccion="dudas-rapidas" style="padding-bottom:8px">${acordeon(D.dudas)}</div>` : ''}`,
    'cuidado': `
  ${D.cuidado ? `<section class="sec cuidado" data-seccion="cuidado">
    ${D.cuidado.foto ? `<div class="ph"><img src="${S(D.cuidado.foto)}" alt="${D.cuidado.profesional ? esc(`${D.cuidado.profesional.nombre}, ${D.cuidado.profesional.especialidad}`) : 'Consulta médica'}" loading="lazy">${D.cuidado.profesional ? `<span class="care-badge">${esc(D.cuidado.profesional.nombre)} · ${esc(D.cuidado.profesional.especialidad)}</span>` : ''}</div>` : ''}
    <h2>${fmt(D.cuidado?.titulo)}</h2>
    ${lista(D.cuidado?.parrafos).map((p) => `<p>${fmt(p)}</p>`).join('')}
    ${D.cuidado?.nota ? `<p class="nota-img">${esc(D.cuidado.nota)}</p>` : ''}
    ${D.cuidado?.pie ? `<div class="pie-est"><span class="estrellas">★★★★★</span>${esc(D.cuidado.pie)}</div>` : ''}
  </section>` : ''}`,
    'preguntas-frecuentes': `
  ${lista(D.faq?.items).length ? `<section class="sec faq acord" data-seccion="preguntas-frecuentes">
    <h2 class="titulo-sec" style="font-size:34px">${fmt(D.faq?.titulo)}</h2>
    <p class="sub-sec" style="font-size:16px">${fmt(D.faq?.sub)}</p>
    <div class="caja">${acordeon(D.faq?.items)}</div>
  </section>` : ''}`,
    'pie': `
  <footer class="sec pie" data-seccion="pie">
    <h3>Contáctanos</h3><p>${fmt(D.pie?.contacto)}</p>
    <h3>Enlaces útiles</h3>${lista(D.pie?.enlaces).map((t) => `<span class="enl">${esc(t)}</span>`).join('')}
    <h3>Información de la tienda</h3>${lista(D.pie?.tienda).map((t) => `<span class="enl">${esc(t)}</span>`).join('')}
    ${D.pie?.correo ? `<p class="dato">${esc(D.pie.correo)}</p>` : ''}
    <p class="dato" style="margin-top:14px">${esc(D.pie?.empresa)}<br>${esc(D.pie?.pais)}</p>
    <div class="legal">${lista(D.pie?.legal).map((t) => `<p>${fmt(t)}</p>`).join('')}<p>${esc(D.pie?.copy)}</p></div>
  </footer>`
  };
  return ORDEN_SCROLL.map((k) => B[k] || '').join('\n');
}

// el script de la página: galería, combos, ventana de pedido, barra fija y orden de reseñas
const SCRIPT = `(function(){
var O=JSON.parse(document.getElementById('kads-oferta').textContent),el=O.elegido,$=function(s){return document.querySelector(s)};
function cop(v){return '$'+Math.round(v).toLocaleString('es-CO').replace(/,/g,'.')}
function combo(){for(var i=0;i<O.combos.length;i++)if(O.combos[i].id===el)return O.combos[i];return O.combos[0]}
function marcar(){document.querySelectorAll('[data-combo]').forEach(function(b){b.setAttribute('aria-checked',String(b.getAttribute('data-combo')===el))});var c=combo();$('#fImg').src=c.foto;$('#fNombre').textContent=c.nombre;$('#fPrecio').textContent=cop(c.precio)+' COP'}
var mini=[].slice.call(document.querySelectorAll('#gMini button')),k=0;
function ver(n){if(!mini.length)return;k=(n+mini.length)%mini.length;$('#gMain').src=mini[k].getAttribute('data-src');mini.forEach(function(b,i){b.setAttribute('aria-current',String(i===k))});mini[k].scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})}
mini.forEach(function(b,i){b.addEventListener('click',function(){ver(i)})});
$('#gPrev')&&$('#gPrev').addEventListener('click',function(){ver(k-1)});$('#gNext')&&$('#gNext').addEventListener('click',function(){ver(k+1)});
var m=$('#modal');
document.addEventListener('click',function(e){var c=e.target.closest('[data-combo]');if(c){el=c.getAttribute('data-combo');marcar();return}
if(e.target.closest('[data-pedir]')){if(m&&m.showModal&&!m.open)m.showModal();return}});
$('#mCerrar')&&$('#mCerrar').addEventListener('click',function(){m.close()});
m&&m.addEventListener('click',function(e){if(e.target===m)m.close()});
$('#mPedir')&&$('#mPedir').addEventListener('click',function(){var c=combo();if(c.url&&c.url!=='#')location.href=c.url;else m.close()});
var f=$('#fija');function fija(){var b=$('#ctaArriba')||$('#ctaOferta'),p=b?b.getBoundingClientRect().bottom<0:scrollY>600;f.classList.toggle('ver',p);f.setAttribute('aria-hidden',String(!p))}
addEventListener('scroll',fija,{passive:true});marcar();fija();
var ord=$('#orden'),lr=$('#listaRes');if(ord&&lr){var rs=[].slice.call(lr.children);rs.forEach(function(x,i){x.setAttribute('data-i',i)});ord.addEventListener('change',function(){var v=ord.value;rs.slice().sort(function(a,b){var ea=+a.getAttribute('data-estrellas'),eb=+b.getAttribute('data-estrellas'),d=v==='mejores'?eb-ea:v==='peores'?ea-eb:0;return d||(+a.getAttribute('data-i'))-(+b.getAttribute('data-i'))}).forEach(function(x){lr.appendChild(x)})})}
})();`;

/** La página completa. */
export function htmlDeLanding(D) {
  const P = D.producto || {};
  const combos = lista(D.oferta?.combos);
  const elegido = combos.some((c) => c.id === D.oferta?.elegido) ? D.oferta.elegido : combos[0]?.id;
  const c0 = combos.find((c) => c.id === elegido) || combos[0] || { precio: 0, nombre: '' };
  const tema = Object.entries(D.tema || {})
    .filter(([k, v]) => VARS[k] && COLOR.test(String(v)))
    .map(([k, v]) => `${VARS[k]}:${v}`)
    .join(';');
  const oferta = { elegido, combos: combos.map((c) => ({ id: c.id, nombre: c.nombre, precio: c.precio, foto: ph(c.foto), url: c.url || '#' })) };
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(D.tituloPagina || P.nombre || 'Landing')}</title>
${D.descripcion ? `<meta name="description" content="${esc(D.descripcion)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link id="kads-fuentes" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
<style>
${estilos()}
[hidden]{display:none!important}
.testi .ini{flex:none;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-weight:800;background:var(--amarillo);color:var(--tinta-btn)}
${tema ? `:root{${tema}}` : ''}
</style>
</head>
<body>
<main class="pagina" id="landing">${cuerpoDeLanding(D)}</main>
<div class="fija" id="fija" aria-hidden="true"><div>
  <img id="fImg" src="${S(c0.foto)}" alt="">
  <div class="t"><span class="estrellas">★★★★★</span><b id="fNombre">${esc(c0.nombre)}</b><strong id="fPrecio">${cop(c0.precio)} COP</strong></div>
  <button type="button" data-pedir>${esc(D.oferta?.boton || 'Pedir y pagar al recibir')}</button>
</div></div>
<dialog id="modal" aria-labelledby="mTitulo"><div class="modal">
  <div class="cab"><div><h2 id="mTitulo">${esc(D.oferta?.titulo || 'Elige tu tratamiento')}</h2><p class="sub-sec" style="text-align:left;margin-top:4px;font-size:13.5px">Selecciona tu combo y revisa el total antes de confirmar.</p></div><button type="button" class="cerrar" id="mCerrar" aria-label="Cerrar">✕</button></div>
  <div class="combos" role="radiogroup" aria-label="Combos">${combosHtml(D, elegido)}</div>
  <button type="button" class="btn" id="mPedir">${esc(D.oferta?.boton || 'Pedir y pagar al recibir')}</button>
</div></dialog>
<script type="application/json" id="kads-oferta">${JSON.stringify(oferta).replace(/</g, '\\u003c')}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
