// Guardar en Kads · el botón en cada tarjeta de la Biblioteca de anuncios.
//
// Mira lo que ya está en pantalla (y lo que aparece cuando TÚ te desplazas) y le pone a cada tarjeta un botoncito
// «Guardar en Kads». Solo cuando lo tocas lee esa tarjeta (leer-tarjeta.js) y se la manda a tu Kads Studio por medio
// de fondo.js. No hace clic por ti, no se desplaza y no abre otras páginas de Facebook.
(function () {
  'use strict';
  if (window.__kadsListo) return;
  window.__kadsListo = true;

  var LEER = window.KadsLeer;

  function aviso(texto, tono) {
    var viejo = document.getElementById('kads-aviso');
    if (viejo) viejo.remove();
    var d = document.createElement('div');
    d.id = 'kads-aviso';
    d.className = 'kads-aviso kads-aviso--' + (tono || 'ok');
    d.setAttribute('role', 'status');
    d.textContent = texto;
    document.body.appendChild(d);
    setTimeout(function () {
      d.classList.add('kads-aviso--sale');
      setTimeout(function () { d.remove(); }, 400);
    }, tono === 'error' ? 7000 : 4500);
  }

  function guardar(marcador, boton) {
    var r;
    try {
      r = LEER.leer(marcador);
    } catch (e) {
      aviso('No pude leer este anuncio. Facebook pudo cambiar su página: prueba recargándola.', 'error');
      return;
    }
    if (!r.anuncio.libraryId) {
      aviso('No encontré el identificador de la biblioteca de este anuncio.', 'error');
      return;
    }
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    chrome.runtime.sendMessage({ tipo: 'guardar', anuncio: r.anuncio }, function (resp) {
      boton.disabled = false;
      if (chrome.runtime.lastError || !resp) {
        boton.textContent = 'Guardar en Kads';
        aviso('La extensión no respondió. Recarga la página y vuelve a intentar.', 'error');
        return;
      }
      if (!resp.ok) {
        boton.textContent = 'Guardar en Kads';
        aviso(resp.mensaje || 'No se pudo guardar.', 'error');
        return;
      }
      boton.textContent = 'Guardado ✓';
      boton.classList.add('kads-boton--hecho');
      var extra = (resp.avisos || []).concat(r.faltan.length ? ['No pude leer ' + r.faltan.join(', ') + '.'] : []);
      aviso('Guardado en Kads › Inspiración › Desde Chrome.' + (extra.length ? ' ' + extra.join(' ') : ''), extra.length ? 'aviso' : 'ok');
    });
  }

  function ponerBotones() {
    var lista = LEER.marcadores(document.body);
    lista.forEach(function (m) {
      if (m.getAttribute('data-kads') === '1') return;
      var c = LEER.contenedorDe(m);
      if (c.querySelector('[data-kads-boton]')) {
        m.setAttribute('data-kads', '1');
        return;
      }
      m.setAttribute('data-kads', '1');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'kads-boton';
      b.setAttribute('data-kads-boton', '1');
      b.textContent = 'Guardar en Kads';
      b.title = 'Manda este anuncio a tu Kads Studio (Inspiración › Desde Chrome)';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        guardar(m, b);
      });
      m.insertAdjacentElement('afterend', b);
    });
  }

  var reloj = null;
  new MutationObserver(function () {
    clearTimeout(reloj);
    reloj = setTimeout(ponerBotones, 500);
  }).observe(document.body, { childList: true, subtree: true });
  ponerBotones();
})();
