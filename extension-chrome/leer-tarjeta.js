// Guardar en Kads · leer UNA tarjeta de la Biblioteca de anuncios de Meta (lo que se ve en pantalla).
//
// El HTML de Facebook está ofuscado y cambia seguido, así que nada se apoya en clases: se busca el texto visible
// «Library ID: 123…» / «Identificador de la biblioteca: 123…», se sube hasta el contenedor de esa tarjeta (el más
// grande que tiene UN solo identificador) y adentro se busca el video, la imagen y los textos.
// Solo lee: no hace clic, no se desplaza y no pide nada a Facebook.
(function () {
  'use strict';

  var RE_ID = /(?:Library ID|Identificador de la biblioteca|ID de la biblioteca|Identificador de biblioteca|ID da biblioteca)\s*:?\s*(\d{5,25})/i;
  var RE_ID_G = /(?:Library ID|Identificador de la biblioteca|ID de la biblioteca|Identificador de biblioteca|ID da biblioteca)\s*:?\s*\d{5,25}/gi;
  var RE_DESDE = /(?:Started running on|Circulando desde(?: el)?|En circulaci[oó]n desde(?: el)?|Se empez[oó] a (?:publicar|mostrar) el|Comenz[oó] a circular el|Veiculando desde)\s*:?\s*([^\n·|]{4,40}?\d{4})/i;
  var RE_CREATIVOS = /(\d[\d.,]*)\s+(?:ads use this creative and text|ads use this creative|anuncios usan (?:este|esta) (?:contenido|creatividad|texto)[^\n]*|anuncios utilizan (?:este|esta) (?:contenido|creatividad)[^\n]*)/i;
  var RE_INACTIVO = /\b(Inactive|Inactivo|Inativo)\b/;
  var RE_ACTIVO = /\b(Active|Activo|Ativo)\b/;
  var NO_SON_CTA = /^(see ad details|ver detalles del anuncio|ver los detalles del anuncio|see summary details|ver detalles del resumen|guardar en kads|open dropdown|abrir|…|\.\.\.)$/i;
  var DOMINIO = /^[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}$/i;

  function textoDe(el) {
    return (el && (el.innerText || el.textContent) || '').replace(/ /g, ' ');
  }

  function cuantosIds(el) {
    var m = (el.textContent || '').match(RE_ID_G);
    return m ? m.length : 0;
  }

  /** Los elementos que muestran «Library ID: …» (el más chico que lo tiene). */
  function marcadores(raiz) {
    var lista = [];
    var caminante = document.createTreeWalker(raiz || document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = caminante.nextNode())) {
      if (!/\d{5,}/.test(n.nodeValue)) continue;
      var el = n.parentElement;
      // el número puede venir en un nodo aparte del rótulo: se sube hasta 3 niveles
      for (var i = 0; el && i < 3; i++) {
        if (RE_ID.test(el.textContent || '')) {
          if (lista.indexOf(el) < 0) lista.push(el);
          break;
        }
        el = el.parentElement;
      }
    }
    return lista;
  }

  /** El contenedor de la tarjeta: el ancestro más alto que todavía tiene UN solo identificador. */
  function contenedorDe(marcador) {
    var el = marcador;
    var mejor = marcador;
    for (var i = 0; el && el !== document.body && i < 25; i++) {
      if (cuantosIds(el) > 1) break;
      mejor = el;
      el = el.parentElement;
    }
    return mejor;
  }

  function area(el) {
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    var w = r.width || el.width || el.naturalWidth || 0;
    var h = r.height || el.height || el.naturalHeight || 0;
    return w * h;
  }

  function esHttps(u) {
    return typeof u === 'string' && /^https:\/\//i.test(u);
  }

  function leer(marcador) {
    var c = contenedorDe(marcador);
    var todo = textoDe(c);
    var faltan = [];
    var id = (textoDe(marcador).match(RE_ID) || todo.match(RE_ID) || [])[1] || null;

    // el avatar (chico) y el nombre de la página
    var imgs = Array.prototype.slice.call(c.querySelectorAll('img'));
    var chicas = imgs.filter(function (i) { return area(i) > 0 && area(i) <= 80 * 80; });
    var avatar = chicas[0] || null;
    var pagina = null;
    var paginaId = null;
    var enlaces = Array.prototype.slice.call(c.querySelectorAll('a[href]'));
    for (var k = 0; k < enlaces.length; k++) {
      var a = enlaces[k];
      var t = textoDe(a).trim();
      var href = a.getAttribute('href') || '';
      if (!t || t.length > 80 || /\/ads\/library/.test(href) || NO_SON_CTA.test(t) || /^https?:\/\/l\.facebook\.com/.test(href)) continue;
      if (/facebook\.com\/|^\/[^/]/.test(href)) {
        pagina = t;
        var m = href.match(/[?&]id=(\d{3,25})/) || href.match(/facebook\.com\/(\d{3,25})(?:[/?]|$)/);
        if (m) paginaId = m[1];
        break;
      }
    }
    if (!pagina && avatar) {
      // sin enlace: el primer texto corto después del avatar
      var cerca = avatar.parentElement;
      for (var s = 0; cerca && s < 4 && !pagina; s++) {
        var linea = textoDe(cerca).split('\n').map(function (x) { return x.trim(); }).filter(Boolean)[0];
        if (linea && linea.length <= 80 && !RE_ID.test(linea)) pagina = linea;
        cerca = cerca.parentElement;
      }
    }
    if (!pagina) faltan.push('el nombre de la página');

    // el video, su miniatura o la imagen grande
    var video = null;
    var poster = null;
    var v = c.querySelector('video');
    if (v) {
      var src = v.currentSrc || v.getAttribute('src') || '';
      if (!src) {
        var fuente = v.querySelector('source[src]');
        if (fuente) src = fuente.getAttribute('src');
      }
      if (esHttps(src)) video = src;
      if (esHttps(v.getAttribute('poster'))) poster = v.getAttribute('poster');
      if (!video) faltan.push('el video');
    }
    var imagen = null;
    var grandes = imgs.filter(function (i) { return i !== avatar && esHttps(i.currentSrc || i.src) && area(i) > 80 * 80; });
    grandes.sort(function (x, y) { return area(y) - area(x); });
    if (grandes[0]) imagen = grandes[0].currentSrc || grandes[0].src;
    if (!video && !imagen) faltan.push('la imagen');

    // el texto del anuncio: el bloque con saltos de línea respetados, o el texto más largo de la tarjeta
    var copy = null;
    var bloques = Array.prototype.slice.call(c.querySelectorAll('[style*="pre-wrap"], [style*="pre-line"]'));
    bloques.forEach(function (b) {
      var t = textoDe(b).trim();
      if (t && !RE_ID.test(t) && (!copy || t.length > copy.length)) copy = t;
    });
    if (!copy) {
      Array.prototype.slice.call(c.querySelectorAll('div, span, p')).forEach(function (b) {
        if (b.children.length > 3) return;
        var t = textoDe(b).trim();
        if (t.length >= 25 && t.length < 4000 && !RE_ID.test(t) && !RE_DESDE.test(t) && (!copy || t.length > copy.length)) copy = t;
      });
    }
    if (!copy) faltan.push('el texto');

    // debajo del medio: el dominio (en mayúsculas), el título y el botón
    var caption = null;
    var titulo = null;
    var cta = null;
    var hojas = Array.prototype.slice.call(c.querySelectorAll('div, span, a'))
      .filter(function (e) { return e.children.length === 0; })
      .map(function (e) { return { el: e, t: textoDe(e).trim() }; })
      .filter(function (x) { return x.t; });
    for (var h = 0; h < hojas.length; h++) {
      if (!caption && DOMINIO.test(hojas[h].t) && hojas[h].t === hojas[h].t.toUpperCase()) {
        caption = hojas[h].t;
        var sig = hojas[h + 1];
        if (sig && sig.t.length >= 3 && sig.t.length <= 200 && sig.t !== copy) titulo = sig.t;
      }
    }
    var botones = Array.prototype.slice.call(c.querySelectorAll('[role="button"], button'));
    for (var b = 0; b < botones.length; b++) {
      if (botones[b].hasAttribute('data-kads-boton')) continue;
      var tb = textoDe(botones[b]).trim();
      if (tb && tb.length <= 30 && !NO_SON_CTA.test(tb)) {
        cta = tb;
        break;
      }
    }

    var desde = (todo.match(RE_DESDE) || [])[1] || null;
    if (!desde) faltan.push('la fecha en que empezó');
    var creativos = (todo.match(RE_CREATIVOS) || [])[1] || null;
    var activo = RE_INACTIVO.test(todo) ? false : RE_ACTIVO.test(todo) ? true : null;

    return {
      anuncio: {
        libraryId: id,
        pagina: pagina,
        paginaId: paginaId,
        avatar: avatar && esHttps(avatar.src) ? avatar.src : null,
        desde: desde ? desde.trim() : null,
        activo: activo,
        copy: copy,
        titulo: titulo,
        cta: cta,
        caption: caption,
        video: video,
        poster: poster,
        imagen: imagen,
        creativos: creativos ? creativos.replace(/[.,]/g, '') : null,
        url: location.href.slice(0, 300),
      },
      faltan: faltan,
      contenedor: c,
    };
  }

  window.KadsLeer = { marcadores: marcadores, contenedorDe: contenedorDe, leer: leer, RE_ID: RE_ID };
})();
