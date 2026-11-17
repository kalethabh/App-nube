// Guardar en Kads · Opciones: el código de emparejamiento y la dirección de la app (solo de este computador).
'use strict';

const POR_DEFECTO = 'http://127.0.0.1:4455';
const DIRECCION_VALIDA = /^http:\/\/(127\.0\.0\.1|localhost)(:\d{2,5})?$/;
const $ = (id) => document.getElementById(id);

function estado(texto, tono) {
  const e = $('estado');
  e.textContent = texto;
  e.className = tono || '';
}

chrome.storage.local.get({ direccion: POR_DEFECTO, codigo: '' }, (o) => {
  $('codigo').value = o.codigo;
  $('direccion').value = o.direccion;
  if (!o.codigo) estado('Todavía no pegaste el código.', 'aviso');
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const codigo = $('codigo').value.trim().toUpperCase();
  const direccion = ($('direccion').value.trim() || POR_DEFECTO).replace(/\/+$/, '');
  if (!/^[A-Z0-9-]{20,40}$/.test(codigo)) return estado('Ese código no se ve bien: cópialo de nuevo desde Kads.', 'error');
  if (!DIRECCION_VALIDA.test(direccion)) return estado('La dirección tiene que ser de este computador, por ejemplo http://127.0.0.1:4455', 'error');
  chrome.storage.local.set({ codigo, direccion }, () => estado('Guardado. Toca «Probar conexión» para revisar.', 'ok'));
});

$('probar').addEventListener('click', () => {
  estado('Probando…');
  chrome.runtime.sendMessage({ tipo: 'probar' }, (r) => {
    if (chrome.runtime.lastError || !r) return estado('La extensión no respondió. Vuelve a intentar.', 'error');
    estado(r.ok ? 'Conectado con Kads Studio. Ya puedes guardar anuncios.' : r.mensaje, r.ok ? 'ok' : 'error');
  });
});
