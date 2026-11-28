// Guardar en Kads · Opciones: emparejamiento local o con el Kads desplegado.
'use strict';

const POR_DEFECTO = 'http://127.0.0.1:4455';
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

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const codigo = $('codigo').value.trim().toUpperCase();
  const direccion = direccionKads($('direccion').value.trim() || POR_DEFECTO);
  if (!/^[A-Z0-9-]{20,40}$/.test(codigo)) return estado('Ese código no se ve bien: cópialo de nuevo desde Kads.', 'error');
  if (!direccion) return estado('Usa la dirección HTTPS de tu Kads, o http://127.0.0.1:4455 para la app local.', 'error');
  if(direccion.startsWith('https:') && !await chrome.permissions.request({origins:[direccion+'/*']}))return estado('Chrome no autorizó esa dirección. No se guardó el cambio.', 'error');
  chrome.storage.local.set({ codigo, direccion }, () => estado('Guardado. Toca «Probar conexión» para revisar.', 'ok'));
});

$('probar').addEventListener('click', () => {
  estado('Probando…');
  chrome.runtime.sendMessage({ tipo: 'probar' }, (r) => {
    if (chrome.runtime.lastError || !r) return estado('La extensión no respondió. Vuelve a intentar.', 'error');
    estado(r.ok ? 'Conectado con Kads Studio. Ya puedes guardar anuncios.' : r.mensaje, r.ok ? 'ok' : 'error');
  });
});
