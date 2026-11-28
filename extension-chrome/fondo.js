// Guardar en Kads · el que habla con tu Kads Studio (el service worker de la extensión).
//
// Recibe UN anuncio de la pestaña (cuando tocas «Guardar en Kads») y lo manda a la app de tu computador con el código
// de emparejamiento (Opciones). Puede ser local o una dirección HTTPS autorizada por el usuario.
'use strict';
importScripts('direccion.js');

const POR_DEFECTO = 'http://127.0.0.1:4455';

function leerOpciones() {
  return new Promise((r) => chrome.storage.local.get({ direccion: POR_DEFECTO, codigo: '' }, r));
}

async function mandar(cuerpo) {
  const { direccion, codigo } = await leerOpciones();
  const base = direccionKads(direccion);
  if(!base)return {ok:false,mensaje:'Revisa la dirección de Kads en las opciones de la extensión.'};
  if (!codigo) {
    chrome.runtime.openOptionsPage();
    return { ok: false, mensaje: 'Falta el código de emparejamiento: cópialo en Kads › Inspiración › Botón de Chrome y pégalo en las Opciones (se abrieron).' };
  }
  let r;
  try {
    r = await fetch(`${base}/api/inspiracion/importar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kads-Codigo': codigo },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    return { ok: false, mensaje: `No encontré Kads Studio en ${base}. ¿Está abierta la app?` };
  }
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (r.ok) return { ok: true, mensaje: j?.mensaje || 'Guardado.', avisos: Array.isArray(j?.avisos) ? j.avisos.slice(0, 4) : [] };
  return { ok: false, mensaje: j?.error || `Kads respondió con un error (${r.status}).` };
}

chrome.runtime.onMessage.addListener((m, remitente, responder) => {
  if (m?.tipo === 'guardar' && m.anuncio && typeof m.anuncio === 'object') {
    mandar({ anuncio: m.anuncio }).then(responder);
    return true;
  }
  if (m?.tipo === 'probar') {
    mandar({ probar: true }).then(responder);
    return true;
  }
  return false;
});

chrome.action?.onClicked?.addListener(() => chrome.runtime.openOptionsPage());
