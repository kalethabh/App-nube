// Un "claude" falso para probar la app SIN gastar el plan de nadie: imita la salida stream-json de Claude Code
// (system/init, mensajes con herramientas, parciales, result, rate_limit_event) y escribe los archivos de cada tarea.
//
//   ANUNCIOS_CLAUDE_BIN=app/server/claude/pruebas/claude-falso.js   la app lo lanza en vez del claude de verdad
//
// Que hace, segun FALSO_MODO (o FALSO_CONFIG = un .json { "ficha": "ok", "guion": "mal", "cambios": "ok" } que se lee
// en cada sesion, para cambiarlo sin reiniciar la app):
//   ok            escribe lo que pide la tarea y termina bien
//   mal           la primera vez deja guion.json/ficha.json incompleto; cuando la app le pide corregir, lo arregla
//   mal-siempre   nunca lo arregla
//   limite        "You've hit your session limit" (con rate_limit_event rechazado)
//   sin-sesion    "Not logged in · Please run /login"
//   bloqueo       escribe app/bloqueo.json y responde BLOQUEADO
//   cuelga        despues del init no dice nada mas
//   muere         se cierra con codigo 1 despues del init
//   en-uso        con --session-id dice "already in use" (la app tiene que pasar a --resume)
//   sin-conversacion  con --resume dice "No conversation found" (la app tiene que pasar a --session-id)
//   cambios-roto  en cambios rompe el manifiesto y termina con error (la app tiene que devolver el guion de antes)
// FALSO_PAUSA=ms entre eventos. FALSO_ARGS=archivo: anota ahi los argumentos y las variables ANTHROPIC_*/CLAUDE_*
// que le llegaron (solo los nombres), para revisar que la app los mande bien.
//
// La tarea "guion" toma como base el manifiesto de temp/befen-regulador-apetito (solo para probar el circuito: un
// anuncio de verdad lo escribe Claude desde cero). Nunca llama a nadie.
//
// EL REPARTO. Este es el unico que se apunta con ANUNCIOS_CLAUDE_BIN: con el primer mensaje mira la TAREA y la
// familia del anuncio (su app/brief.json) y, si hay un falso propio para esa tarea, se lo pasa tal cual (mismos
// argumentos, el mismo stdin y su stdout) con FALSO_DESPACHADO=1, asi ese falso puede devolverle lo que no conoce:
//   guion, cambios (los 12 estilos y la continuidad)        claude-falso-estilos.js   (FALSO_MODO=ok|mal; los demas
//                                                           modos de arriba los hace este)
//   continuidad-imagenes / -pares / -cadena                 claude-falso-continuidad.js (FALSO_CONT=imagenes:rehacer,…)
//   rehacer (el editor)                                     claude-falso-rehacer.js
//   musical e historia musical (tomas, revision, letra)     claude-falso-cantados.js  (FALSO_REVISION=uno)
//   podcast y entrevista (revisar-imagenes, -clips, rechazo) claude-falso-hablado.js  (FALSO_HABLADO=ok|mal|limite)
//   UGC (revisar-persona, revisar-clips, rechazo)           claude-falso-ugc.js       (FALSO_UGC_CONFIG=<.json>)
//   voz en off y continuidad (revisar las imagenes), objeto parlante (rechazo, revisar-clips)
//                                                           claude-falso-compartidas.js (FALSO_REVISION=uno)
//   anuncios de imagen (imagen-ads-estrategia, -prompts, -revision, -ajuste)
//                                                           claude-falso-imagen-ads.js (FALSO_IMAGEN_ADS=ok|mal|bloqueo|limite)
// La ficha y lo que no tiene falso propio lo hace este.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

if (process.env.FALSO_ARGS) {
  const env = Object.keys(process.env).filter((k) => /^(ANTHROPIC_|CLAUDE_|CLAUDECODE$|KIE_|ELEVENLABS_)/i.test(k));
  fs.appendFileSync(process.env.FALSO_ARGS, JSON.stringify({ args, cwd: process.cwd(), env }) + '\n');
}

if (args[0] === '--version') {
  console.log('2.1.288 (Claude Code)');
  process.exit(0);
}
if (args[0] === 'auth' && args[1] === 'status') {
  const a = process.env.FALSO_AUTH || 'ok';
  console.log(JSON.stringify(a === 'ok' ? { loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email: 'alumno@ejemplo.com' } : a === 'api' ? { loggedIn: true, authMethod: 'api_key' } : { loggedIn: false, authMethod: 'none' }, null, 2));
  process.exit(a === 'ok' || a === 'api' ? 0 : 1);
}

const sesion = val('--resume') || val('--session-id') || '00000000-0000-0000-0000-000000000000';
const pausa = Number(process.env.FALSO_PAUSA) || 5;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const emitir = (o) => process.stdout.write(JSON.stringify({ session_id: sesion, ...o }) + '\n');
let id = 0;
const usar = async (name, input) => {
  const tid = `toolu_${++id}`;
  emitir({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: tid, name, input }] } });
  await dormir(pausa);
  emitir({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tid, content: 'ok' }] } });
  await dormir(pausa);
};
// la misma herramienta, primero como parciales (asi la app puede decir que hace antes de que termine)
const usarConParciales = async (name, input) => {
  const json = JSON.stringify(input);
  emitir({ type: 'stream_event', event: { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: `toolu_p${id}`, name, input: {} } } });
  for (let i = 0; i < json.length; i += 40) emitir({ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + 40) } } });
  emitir({ type: 'stream_event', event: { type: 'content_block_stop', index: 1 } });
  await usar(name, input);
};
const resultado = (extra = {}) => emitir({ type: 'result', subtype: 'success', is_error: false, result: 'LISTO', num_turns: 4, total_cost_usd: 0.31, duration_ms: 1234, usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 30000 }, permission_denials: [], ...extra });

function modo(tarea) {
  let m = process.env.FALSO_MODO || 'ok';
  if (process.env.FALSO_CONFIG) {
    try {
      const c = JSON.parse(fs.readFileSync(process.env.FALSO_CONFIG, 'utf8'));
      m = c[tarea] || c.todo || m;
    } catch {
      /* sin archivo: el de siempre */
    }
  }
  return m;
}

const escribir = (rel, datos) => {
  const abs = path.join(RAIZ, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof datos === 'string' ? datos : JSON.stringify(datos, null, 2) + '\n', 'utf8');
};

// ---------------------------------------------------------------- las tareas

async function ficha(texto, m, intento) {
  const carpeta = texto.match(/Carpeta del producto: (\S+)/)?.[1];
  await usar('Read', { file_path: path.join(RAIZ, carpeta, 'producto.json') });
  if (fs.existsSync(path.join(RAIZ, carpeta, 'pagina.txt'))) await usar('Read', { file_path: path.join(RAIZ, carpeta, 'pagina.txt') });
  for (const f of fs.existsSync(path.join(RAIZ, carpeta, 'fotos')) ? fs.readdirSync(path.join(RAIZ, carpeta, 'fotos')) : []) await usar('Read', { file_path: path.join(RAIZ, carpeta, 'fotos', f) });
  const p = JSON.parse(fs.readFileSync(path.join(RAIZ, carpeta, 'producto.json'), 'utf8'));
  const ficha = {
    nombre: p.nombre || 'Producto de muestra',
    queEs: 'Un producto de muestra para probar la app',
    tipo: p.tipo || 'fisico',
    beneficios: ['Beneficio uno', 'Beneficio dos'],
    publico: 'Mujeres de 30 a 45',
    dolor: 'El antojo de la noche',
    oferta: '',
    comoCompra: 'Pago contra entrega',
    idioma: 'es',
    mercado: 'LatAm',
    deducido: ['publico', 'dolor', 'mercado'],
    falta: [{ campo: 'oferta', pregunta: '¿Cuánto cuesta y tienes alguna oferta?' }, { campo: 'prueba', pregunta: '¿Tienes reseñas reales?' }, { campo: 'comoSeUsa', pregunta: '¿Cómo se toma?' }, { campo: 'garantia', pregunta: '¿Tiene garantía?' }],
  };
  if ((m === 'mal' && intento === 1) || m === 'mal-siempre') delete ficha.queEs;
  await usarConParciales('Write', { file_path: path.join(RAIZ, carpeta, 'ficha.json'), content: JSON.stringify(ficha) });
  escribir(path.join(carpeta, 'ficha.json'), ficha);
}

function manifiestoDePrueba(slug) {
  const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'manifiesto.json'), 'utf8'));
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\.(jpg|jpeg|png|webp)$/i.test(n));
  const ref = m.referencias.find((r) => r.tipo === 'producto');
  if (foto) ref.archivo = foto;
  else {
    m.referencias = m.referencias.filter((r) => r.tipo !== 'producto');
    for (const t of [...m.tomas, ...m.broll]) t.referencias = (t.referencias || []).filter((x) => x !== ref.id);
  }
  return m;
}

async function guion(texto, m, intento) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  await usar('Read', { file_path: path.join(RAIZ, '.claude', 'skills', 'anuncios-claymation', 'SKILL.md') });
  const foto = fs.readdirSync(path.join(RAIZ, 'temp', slug)).find((n) => /^producto\./.test(n));
  if (foto) await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, foto) });
  if (m === 'bloqueo') {
    escribir(`temp/${slug}/app/bloqueo.json`, { motivo: 'No sé en qué país vendes y la skill no lo puede inventar.', faltan: ['El país donde vendes'] });
    await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'bloqueo.json') });
    return 'BLOQUEADO';
  }
  const man = manifiestoDePrueba(slug);
  // «Tus videos e imágenes» (2026-11-19): si el usuario subió material, la imagen va como la imagen exacta de la toma 1
  // y el video como la escena del primer B-roll (sin generar ni pagar)
  const material = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'material', 'material.json'), 'utf8'));
    } catch {
      return [];
    }
  })();
  const img = material.find((x) => x.tipo === 'imagen');
  const vid = material.find((x) => x.tipo === 'video');
  if (img && man.tomas[0]) man.tomas[0].imagen_propia = `temp/${slug}/material/${img.archivo}`;
  if (vid && man.broll?.[0]) man.broll[0].desde_biblioteca = `temp/${slug}/material/${vid.archivo}`;
  await usarConParciales('Write', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json'), content: JSON.stringify(man).slice(0, 2000) });
  escribir(`temp/${slug}/manifiesto.json`, man);
  const trans = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'transiciones.json'), 'utf8'));
  delete trans._nota;
  escribir(`temp/${slug}/transiciones.json`, trans);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'transiciones.json') });
  await usar('PowerShell', { command: `node produccion/validar-manifiesto.js temp/${slug}/manifiesto.json` });
  const g = {
    titulo: 'Campana del hambre (prueba)',
    idioma: 'es',
    mercado: 'LatAm',
    duracionEstimada: 40,
    de_que_va: 'Una campana adentro del estómago que no deja de sonar.',
    partes: man.tomas.map((t, i) => ({ n: t.n, momento: i === 0 ? 'gancho' : 'historia', dice: i === 2 ? `${t.linea} ` : t.linea, se_ve: 'Una escena de plastilina' })),
    decisiones: ['Elegí el ángulo principal de la skill.'],
  };
  if ((m === 'mal' && intento === 1) || m === 'mal-siempre') delete g.partes[0].dice;
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
  return 'LISTO';
}

async function cambios(texto, m) {
  const slug = texto.match(/Carpeta del anuncio: temp\/(\S+)/)?.[1];
  const pedido = texto.match(/«([\s\S]*?)»/)?.[1] || '';
  await usar('Read', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json') });
  if (m === 'cambios-roto') {
    escribir(`temp/${slug}/manifiesto.json`, '{ "esto": "quedo a medias"');
    return 'ROTO';
  }
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'manifiesto.json'), 'utf8'));
  man.tomas[0].prompt_video = `${man.tomas[0].prompt_video}\nKeep the camera still.`;
  escribir(`temp/${slug}/manifiesto.json`, man);
  await usar('Edit', { file_path: path.join(RAIZ, 'temp', slug, 'manifiesto.json') });
  const g = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'app', 'guion.json'), 'utf8'));
  g.cambios_hechos = [`Hice lo que pediste: ${pedido.slice(0, 80)}`];
  escribir(`temp/${slug}/app/guion.json`, g);
  await usar('Write', { file_path: path.join(RAIZ, 'temp', slug, 'app', 'guion.json') });
  return 'LISTO';
}

// ---------------------------------------------------------------- la sesion

const tareaDe = (t) => (/TAREA: ficha/.test(t) ? 'ficha' : /TAREA: guion/.test(t) ? 'guion' : /TAREA: cambios/.test(t) ? 'cambios' : /TAREA: revision/.test(t) ? 'revision' : 'otra');
let tareaActual = null;
let textoTarea = ''; // el primer mensaje: el de la tarea (los siguientes son correcciones)
let intento = 0;
let iniciado = false;

async function alMensaje(texto) {
  intento++;
  if (!tareaActual) {
    tareaActual = tareaDe(texto);
    textoTarea = texto;
  }
  const m = modo(tareaActual);
  if (m === 'en-uso' && val('--session-id')) {
    process.stderr.write(`Error: Session ID ${sesion} is already in use.\n`);
    process.exit(1);
  }
  if (m === 'sin-conversacion' && val('--resume')) {
    process.stderr.write(`No conversation found with session ID: ${sesion}\n`);
    process.exit(1);
  }
  if (!iniciado) {
    iniciado = true;
    emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: String(val('--tools') || '').split(',').filter(Boolean), model: 'claude-falso', permissionMode: val('--permission-mode'), apiKeySource: process.env.FALSO_CLAVE || 'none', claude_code_version: '2.1.288', mcp_servers: [] });
  } else emitir({ type: 'system', subtype: 'init', cwd: process.cwd(), tools: [], model: 'claude-falso' });
  await dormir(pausa);
  if (m === 'cuelga') return;
  if (m === 'muere') {
    process.stderr.write('algo se rompio adentro\n');
    process.exit(1);
  }
  if (m === 'limite') {
    emitir({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: Math.floor(Date.now() / 1000) + 3600, rateLimitType: 'five_hour' } });
    emitir({ type: 'assistant', error: 'rate_limit', message: { role: 'assistant', content: [{ type: 'text', text: "You've hit your session limit · resets 3pm" }] } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", num_turns: 1, total_cost_usd: 0 });
  }
  if (m === 'sin-sesion') {
    emitir({ type: 'assistant', error: 'authentication_failed', message: { role: 'assistant', content: [{ type: 'text', text: 'Not logged in · Please run /login' }] } });
    return emitir({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login', num_turns: 0 });
  }
  let r = 'LISTO';
  // «regenerar una línea» (el ícono ✨ de «Editar a mano»): escribe otra versión de esa parte
  const linea = /TAREA: regenerar una l[ií]nea/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (linea) {
    const n = (/Reescribe SOLO lo que se dice en la parte (\d+)/.exec(textoTarea) || [])[1] || '?';
    const nueva = /Escribe lo que se dice en una parte NUEVA/.test(textoTarea);
    fs.writeFileSync(path.join(RAIZ, linea[1]), JSON.stringify({ dice: nueva ? 'Una parte nueva de prueba, escrita por la IA.' : `Otra versión de prueba de la parte ${n}, escrita por la IA.` }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-21h) una imagen que el filtro rechazó: la misma descripción sin la palabra que frena (SIM-PROHIBIDO)
  const rechazo = /TAREA: reescribir la descripción de una imagen/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (rechazo) {
    const antes = (/La descripción que rechazó:\n<<<\n([\s\S]*?)\n>>>/.exec(textoTarea) || [])[1] || 'A calm clay scene in a kitchen.';
    fs.writeFileSync(path.join(RAIZ, rechazo[1]), JSON.stringify({ prompt: antes.replace(/\s*\bSIM-PROHIBIDO\b\s*/g, ' ').trim(), motivo: 'Saqué la palabra que frenaba al filtro; la escena es la misma.' }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-21h) un anuncio de imagen que el filtro rechazó: el mismo anuncio sin la palabra que frena
  const rechazoAd = /TAREA: imagen de anuncio rechazada/.test(textoTarea) ? /Edita (temp\/\S+\.json)/.exec(textoTarea) : null;
  if (rechazoAd) {
    const ruta = path.join(RAIZ, rechazoAd[1]);
    fs.writeFileSync(ruta, fs.readFileSync(ruta, 'utf8').replace(/\s*\bSIM-PROHIBIDO\b/g, '').replace('Variation ', 'A calm, friendly scene. Variation '));
    return resultado({ result: 'LISTO' });
  }
  // «De un video»: el ángulo del video y N conceptos de prueba para el producto
  const anguloVideo = /analizar el ÁNGULO de un video/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (anguloVideo) {
    const n = Number((/Propón (\d+) anuncios/.exec(textoTarea) || [])[1]) || 4;
    const facetas = ['La que va a la playa', 'La mamá ocupada', 'La que trabaja', 'La que se prepara para diciembre', 'La del jean', 'La que se toma fotos'];
    fs.writeFileSync(path.join(RAIZ, anguloVideo[1]), JSON.stringify({
      video: { angulo: 'Glúteos más llenos sin gimnasio', gancho: 'Una pregunta a cámara', dolor: 'Se siente plana', deseo: 'Llenar el jean', promesa: 'Curvas naturales', publico: 'Mujeres de 20 a 40', formato: 'Una persona a cámara', por_que_funciona: 'Habla del dolor en sus palabras' },
      conceptos: Array.from({ length: n }, (_, i) => ({ titular: `Titular de prueba ${i + 1}: por fin lleno el jean`, angulo: ['dolor', 'deseo', 'beneficio', 'objecion'][i % 4], faceta: facetas[i % facetas.length], momento: 'Un sábado', escena: `Escena de prueba ${i + 1}` })),
    }));
    return resultado({ result: 'LISTO' });
  }
  // «lo que se ve» (debajo de lo que escribiste en «Editar a mano»): una escena de prueba con ese texto
  const seVe = /TAREA: lo que se ve en una parte/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (seVe) {
    const dijo = (/El usuario escribió para .*?: «(.*?)»/.exec(textoTarea) || [])[1] || '';
    fs.writeFileSync(path.join(RAIZ, seVe[1]), JSON.stringify({ se_ve: `Escena de prueba que muestra: ${dijo.slice(0, 60)}` }));
    return resultado({ result: 'LISTO' });
  }
  // ✨ otra escena para una imagen de apoyo (B-roll)
  const escenaB = /TAREA: escena de apoyo/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (escenaB) {
    const nb = (/La imagen de apoyo (\d+)/.exec(textoTarea) || [])[1] || '?';
    const quiere = (/El usuario quiere: «(.*?)»/.exec(textoTarea) || [])[1] || '';
    fs.writeFileSync(path.join(RAIZ, escenaB[1]), JSON.stringify({ se_ve: `Escena de apoyo de prueba ${nb}${quiere ? `: ${quiere.slice(0, 60)}` : ''}, con el producto en primer plano y luz cálida.`, camara: 'primer plano, la cámara se acerca despacio' }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-21) los textos de los anuncios «Desde 0» (uno por formato, en el orden pedido)
  const desde0 = /TAREA: anuncios nuevos desde cero/.test(textoTarea) ? /Escribe (temp\/\S+\/entrada\/plan-desde0\.json)/.exec(textoTarea) : null;
  if (desde0) {
    const formatos = [...textoTarea.matchAll(/^\d+\. ([a-z-]+) \(/gm)].map((m) => m[1]);
    const tit = { hero: 'Más curvas sin cirugía', 'antes-despues': 'Glúteos más firmes de forma natural', 'nosotros-vs-ellos': 'No es lo mismo: es 3 en 1', testimonio: 'Toda mi vida fui la plana', 'pregunta-respuesta': '¿Sientes la cola plana?', bodegon: 'Tres extractos en 1 para tus curvas', nota: 'La fórmula que recomiendan para curvas', temporada: 'Esta Navidad, estrena tus curvas' };
    fs.writeFileSync(path.join(RAIZ, desde0[1]), JSON.stringify({
      anuncios: formatos.map((f, k) => ({
        formato: f,
        titular: `${tit[f]}${formatos.indexOf(f) === k ? '' : ` ${['ya', 'hoy', 'así'][k % 3]}`}`,
        plantilla_titular: 'Más [deseo] sin [sacrificio]',
        beneficios: ['Más volumen natural', 'Curvas más firmes'],
        sello: '3 EN 1 · TRIPLE ACCIÓN',
        cta: 'Pide el tuyo',
        emocion: 'segura y feliz',
        ...(f === 'testimonio' ? { cita: 'Por fin me queda bien el jean' } : {}),
        ...(f === 'pregunta-respuesta' ? { respuesta: 'Te faltaba el 3 en 1' } : {}),
        ...(f === 'nosotros-vs-ellos' ? { comparacion: [{ nuestro: 'Natural', otro: 'Químicos' }, { nuestro: '3 en 1', otro: 'Solo uno' }, { nuestro: 'Pagas al recibir', otro: 'Pago anticipado' }] } : {}),
        ...(f === 'bodegon' ? { ingredientes: ['Aguaje', 'Fenogreco', 'Maca'] } : {}),
        ...(f === 'temporada' ? { ocasion: 'Navidad' } : {}),
      })),
    }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-21) el MAPA de una referencia validada (modo «Replicar validado»): zonas, jerarquía, letra y paleta, ángulo
  // y N titulares con la misma promesa
  const mapaRef = /TAREA: mapa de la referencia validada/.test(textoTarea) ? /Escribe (temp\/\S+\/entrada\/mapa-R\d{2}\.json)/.exec(textoTarea) : null;
  if (mapaRef) {
    const n = Number((/REPLICARLO EXACTO en (\d+) variaciones/.exec(textoTarea) || [])[1]) || 3;
    const otras = ['Adiós a la cola plana', 'Chao a los glúteos planos', 'Despídete de la cola plana', 'Olvida los glúteos planos', 'Basta de cola plana', 'Nunca más glúteos planos', 'Se acabó la cola plana', 'Fuera los glúteos planos', 'Dile adiós a la cola plana', 'Ya no más cola plana', 'Hasta nunca, cola plana', 'Sin glúteos planos nunca más'];
    fs.writeFileSync(path.join(RAIZ, mapaRef[1]), JSON.stringify({
      zonas: { titular: 'arriba, centrado, 90 % del ancho, letra enorme', modelo: 'mitad izquierda, 55 % de la imagen, de espaldas', producto: 'abajo a la derecha, 30 % del alto, de frente', beneficios: 'derecha, 3 checks verdes uno debajo del otro', oferta_cta: 'franja inferior amarilla con botón negro', otros: 'no hay' },
      jerarquia: ['el titular', 'el antes y después', 'el frasco y la oferta'],
      tipografia_paleta: { fuentes: 'titular en sans condensada negra, mayúsculas; checks en sans regular', colores: 'fondo rosa #F7C6D0, texto negro #111111, checks verdes #22C55E', fondos_de_bloques: 'titular sin fondo; oferta en cinta amarilla #FACC15' },
      angulo: { deseo: 'tener glúteos redondos y levantados', beneficio: 'más volumen en glúteos', dolor: 'la cola plana' },
      titular_original: 'Bye bye glúteos planos',
      textos: [{ zona: 'check 1', texto: 'Más volumen' }, { zona: 'oferta', texto: 'Envío gratis hoy' }, { zona: 'CTA', texto: 'Pídelo ya' }],
      titulares: Array.from({ length: n }, (_, k) => otras[k % otras.length] + (k >= otras.length ? ` ${k}` : '')),
    }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-20r) la IA en una tienda de Shopify: cambia el botón del tema y, si le piden una página, propone crearla
  const tiendaShop = /TAREA: tienda shopify/.test(textoTarea) ? /(temp\/_shopify\/trabajos\/[a-z0-9-]+)\/tema\//.exec(textoTarea) : null;
  if (tiendaShop) {
    const dir = path.join(RAIZ, tiendaShop[1]);
    const pedido = (/te pide, sobre su tienda[^\n]*\n«([^»]*)»/.exec(textoTarea) || [])[1] || '';
    const boton = path.join(dir, 'tema', 'sections', 'boton.liquid');
    if (/bot[oó]n/i.test(pedido) && fs.existsSync(boton)) fs.writeFileSync(boton, fs.readFileSync(boton, 'utf8').replace('Comprar', 'Pídelo ya').replace('#000', '#16a34a'));
    const admin = /p[aá]gina/i.test(pedido) && /mutación GraphQL/.test(textoTarea) ? [{ titulo: 'Crear la página «Preguntas frecuentes»', query: 'mutation($p:PageCreateInput!){ pageCreate(page:$p){ page{ id handle } userErrors{ message } } }', variables: { p: { title: 'Preguntas frecuentes', handle: 'preguntas', isPublished: true } } }] : [];
    fs.writeFileSync(path.join(dir, 'resumen.json'), JSON.stringify({ resumen: /bot[oó]n/i.test(pedido) ? 'Cambié el botón de comprar a verde y ahora dice «Pídelo ya».' : 'No hizo falta tocar el tema.', admin }));
    return resultado({ result: 'LISTO' });
  }
  // (2026-11-20q) la landing adaptada: cambia los textos que nombran la marca de la original y pide la imagen 0
  const landing = /TAREA: landing adaptada/.test(textoTarea) ? /Escribe (temp\/_landings\/\S+\/nuevos-textos\.json)/.exec(textoTarea) : null;
  if (landing) {
    const prod = (/^Su producto: (.+)$/m.exec(textoTarea) || [])[1] || 'Producto';
    const nuevos = {};
    for (const [, k, t] of textoTarea.matchAll(/^(\d+)\t(.*)$/gm)) if (/MARCAORIGINAL/.test(t)) nuevos[k] = t.replace(/MARCAORIGINAL/g, prod);
    fs.writeFileSync(path.join(RAIZ, landing[1]), JSON.stringify(nuevos));
    fs.writeFileSync(path.join(RAIZ, landing[1].replace('nuevos-textos', 'nuevas-imagenes')), JSON.stringify([{ id: 0, prompt: 'the product on a white table', aspecto: '1:1' }]));
    return resultado({ result: 'LISTO' });
  }
  // la coordinadora de la oficina (chat): «anuncio» crea uno de Claymation del primer producto con ficha, «regla:» anota una regla
  const coord = /TAREA: coordinadora de la oficina/.test(textoTarea) ? /Escribe (temp\/\S+\.json) con este JSON/.exec(textoTarea) : null;
  if (coord) {
    const ultimo = (textoTarea.match(/^USUARIO: (.*)$/gm) || []).pop()?.slice(9) || '';
    const prod = (/^(\S+) \| [^|\n]+ \| sí \|/m.exec(textoTarea) || [])[1];
    const conFoto = (/^(\S+) \| [^|\n]+ \| (?:sí|no) \| sí \|/m.exec(textoTarea) || [])[1];
    const acciones = [];
    let respuesta = `Hola, soy la coordinadora de prueba. Me dijiste: ${ultimo.slice(0, 80)}`;
    let entrega = null;
    // (2026-11-20e) los archivos que adjuntó (los lee como lo haría la IA, por su ruta) y lo que espera su sí
    const imagenAdj = (/\(imagen, en (temp\/_oficina\/adjuntos\/\S+)\) \[id ([a-f0-9]{12})\]/.exec(ultimo) || []);
    const docAdj = (/su texto en (temp\/_oficina\/adjuntos\/\S+?)\)/.exec(ultimo) || [])[1];
    const esperaSi = (/^(\S+) \| [^\n]* \| ESPERA EL SÍ/m.exec(textoTarea) || [])[1];
    const videoAdj = (/\(un VIDEO: [^)]*\) \[id ([a-f0-9]{12})\]/.exec(ultimo) || [])[1];
    if (videoAdj && /musical/i.test(ultimo) && prod) {
      acciones.push({ tipo: 'crear-anuncio', productoId: prod, estilo: 'musical', cantidad: 1, duracion: null, respuestas: { visual: 'crochet' }, idea: 'copiar la letra del video palabra por palabra cambiando solo el producto', video: videoAdj });
      respuesta = 'Listo: saco la letra de tu video y el guionista la copia tal cual con tu producto.';
    } else if (videoAdj && /igual|replic|clon|estructura/i.test(ultimo) && prod) {
      // (2026-11-21b) sin un estilo nombrado: «agregar» (el mismo look y estructura del video)
      if (/zack/i.test(ultimo)) {
        acciones.push({ tipo: 'crear-anuncio', productoId: prod, estilo: 'zack-d-films', cantidad: 1, duracion: '1:50', respuestas: { fondo: 'estudio' }, idea: 'replicar la estructura del video', video: videoAdj, conservar_gancho: false });
        respuesta = 'Va, le paso tu video al guionista para que lo replique en Zack de 1:50.';
      } else {
        acciones.push({ tipo: 'crear-anuncio', productoId: prod, estilo: 'agregar', cantidad: 1, duracion: null, respuestas: {}, idea: 'tal cual este video, misma estructura', video: videoAdj, conservar_gancho: false });
        respuesta = 'Listo, lo replico tal cual tu video: misma estructura y mismo look, con tu producto.';
      }
    } else if (/^dale/i.test(ultimo) && esperaSi) {
      acciones.push({ tipo: 'producir', id: esperaSi });
      respuesta = 'Va, arranco ya 💪';
    } else if (/variaci/i.test(ultimo) && imagenAdj[2] && conFoto) {
      // (2026-11-21d) variaciones de su anuncio ganador, en el chat: las escribe ella misma
      const n = Number((/(\d+)/.exec(ultimo) || [])[1]) || 3;
      const leyoVotos = /LE GUSTARON/.test(textoTarea);
      acciones.push({ tipo: 'imagenes', productoId: conFoto, formato: '1:1', referencia: imagenAdj[2], pais: 'Colombia', publico: null, idea: 'variaciones de su ganador', indicaciones: 'misma oferta', variaciones: Array.from({ length: n }, (_, k) => ({ titular: ['Glúteos, piernas y caderas con más volumen en 7 días', 'Más volumen en glúteos y caderas en 7 días', 'En 7 días: piernas, glúteos y caderas con volumen', 'Tus glúteos y caderas con más volumen en una semana'][k % 4], cambio: `otra modelo (${['morena de 30', 'rubia de 40', 'trigueña de 25', 'pelirroja de 35'][k % 4]}) en ${['su cuarto', 'el gimnasio', 'la playa', 'un probador'][k % 4]}${leyoVotos ? ' · siguiendo lo que le gustó' : ''}` })) });
      respuesta = leyoVotos ? 'Listo, van tus variaciones teniendo en cuenta lo que te gustó 👇' : 'Listo, van tus variaciones 👇';
    } else if (/imágenes|imagenes/i.test(ultimo) && conFoto) {
      const n = Number((/(\d+)/.exec(ultimo) || [])[1]) || 3;
      acciones.push({ tipo: 'imagenes', productoId: conFoto, cantidad: n, formato: '1:1', referencia: imagenAdj[2] || null, pais: 'Colombia', publico: null, idea: 'variaciones de prueba' });
      respuesta = imagenAdj[1] && fs.existsSync(path.join(RAIZ, imagenAdj[1])) ? 'Vi tu anuncio, me gusta. Le paso las variaciones al equipo.' : 'Listo, se lo paso al equipo de imágenes.';
    } else if (/variaciones/i.test(ultimo) && docAdj) {
      const base = fs.readFileSync(path.join(RAIZ, docAdj), 'utf8').trim().split('\n')[0];
      const n = Number((/(\d+)/.exec(ultimo) || [])[1]) || 10;
      entrega = { titulo: `${n} variaciones`, texto: Array.from({ length: n }, (_, k) => `${k + 1}. ${base} (versión ${k + 1})`).join('\n'), criterios: { interes: 9, claridad: 9, credibilidad: 8.5, valor: 9, conversacion: 8, narrativa: 8.5 } };
      respuesta = `Listo, aquí van las ${n} 👇`;
    } else if (/anuncio/i.test(ultimo) && prod) {
      const n = Number((/(\d+)/.exec(ultimo) || [])[1]) || 1;
      acciones.push({ tipo: 'crear-anuncio', productoId: prod, estilo: 'claymation', cantidad: n, duracion: null, respuestas: {}, idea: 'ángulo de prueba' });
      respuesta = `Listo, le pedí a Mateo ${n} guion${n > 1 ? 'es' : ''} de Claymation. Te aviso cuando esperen tu aprobación.`;
    } else if (/tienda/i.test(ultimo) && /^(\S+) \| [^|\n]+ \| \S+\.myshopify\.com \|/m.test(textoTarea)) {
      const tienda = /^(\S+) \| [^|\n]+ \| \S+\.myshopify\.com \|/m.exec(textoTarea)[1];
      acciones.push({ tipo: 'shopify', tienda, pedido: ultimo, motor: 'claude' });
      respuesta = 'Va, le pido al equipo el cambio en tu tienda. Te queda como tema sin publicar para que lo revises.';
    } else if (/landing/i.test(ultimo) && /https?:\/\/\S+/.test(ultimo)) {
      acciones.push({ tipo: 'landing', url: /https?:\/\/\S+/.exec(ultimo)[0], modo: 'tal-cual', motor: 'claude' });
      respuesta = 'Listo, la estoy clonando. Te aviso cuando esté.';
    } else if (/regla:/i.test(ultimo)) {
      acciones.push({ tipo: 'regla', texto: ultimo.split(/regla:/i)[1].trim(), estilo: null });
      respuesta = 'Anotado: lo aplicamos de ahora en adelante.';
    }
    fs.writeFileSync(path.join(RAIZ, coord[1]), JSON.stringify({ respuesta, acciones, entrega }));
    return resultado({ result: 'LISTO' });
  }
  if (tareaActual === 'ficha') await ficha(textoTarea, m, intento);
  else if (tareaActual === 'guion') r = await guion(textoTarea, m, intento);
  else if (tareaActual === 'cambios') r = await cambios(textoTarea, m);
  if (r === 'ROTO') return emitir({ type: 'result', subtype: 'error_during_execution', is_error: true, result: '', num_turns: 2 });
  resultado({ result: r });
}

// ---------------------------------------------------------------- el reparto

const AQUI = path.dirname(fileURLToPath(import.meta.url));
// estilo -> familia (por si el brief no la trae, o la carpeta no es de la app)
const FAMILIA_DE_ESTILO = {
  claymation: 'voz-en-off', crochet: 'voz-en-off', 'zack-d-films': 'voz-en-off', 'estilo-pixar': 'voz-en-off', skeleton: 'voz-en-off', 'estilo-lego': 'voz-en-off',
  'talking-object-pixar': 'objeto-parlante', ugc: 'ugc', podcast: 'hablado', entrevista: 'hablado', musical: 'musical', musicales: 'musical', 'historias-musicales': 'historia-musical',
};
// los modos de este archivo que no hace el falso de los estilos (limite, sin-sesion, bloqueo, cuelga…)
const MODOS_DE_ESTILOS = new Set(['ok', 'mal']);

/** La familia del anuncio del que habla la tarea (la primera carpeta temp/<slug> que nombra). */
function familiaDelTexto(texto) {
  for (const r of String(texto).matchAll(/temp[\\/]([a-z0-9][a-z0-9._-]*)/gi)) {
    const dir = path.join(RAIZ, 'temp', r[1]);
    if (!fs.existsSync(dir)) continue;
    const leer = (rel) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));
      } catch {
        return null;
      }
    };
    const b = leer(path.join('app', 'brief.json'));
    if (b?.familia) return b.familia;
    if (b?.estilo) return b.continuidad && FAMILIA_DE_ESTILO[b.estilo] === 'voz-en-off' ? 'continuidad' : FAMILIA_DE_ESTILO[b.estilo] || null;
    const m = leer('manifiesto.json');
    if (m?.estilo) return FAMILIA_DE_ESTILO[m.estilo] || null;
  }
  return null;
}

/** El falso propio de esta tarea, o null si la hace este. */
function especialista(texto) {
  if (process.env.FALSO_DESPACHADO) return null;
  const tarea = (String(texto).match(/^TAREA: ([^\n]+)/m) || [])[1] || '';
  if (!tarea || /^ficha\b/.test(tarea) || /^regenerar una l[ií]nea/.test(tarea) || /^lo que se ve en una parte/.test(tarea) || /^escena de apoyo/.test(tarea) || /^coordinadora/.test(tarea) || /^reescribir la descripci[oó]n/.test(tarea) || /^imagen de anuncio rechazada/.test(tarea)) return null;
  if (/^imagen-ads-/.test(tarea)) return 'claude-falso-imagen-ads.js';
  if (/^(guion|cambios)\b/.test(tarea)) return MODOS_DE_ESTILOS.has(modo(tarea.split(/\s/)[0])) ? 'claude-falso-estilos.js' : null;
  if (/^continuidad-/.test(tarea)) return 'claude-falso-continuidad.js';
  if (/^rehacer\b/.test(tarea)) return 'claude-falso-rehacer.js';
  const fam = familiaDelTexto(texto);
  if (fam === 'musical' || fam === 'historia-musical') return 'claude-falso-cantados.js';
  if (fam === 'hablado') return 'claude-falso-hablado.js';
  if (fam === 'ugc') return 'claude-falso-ugc.js';
  if (fam === 'voz-en-off' || fam === 'continuidad' || fam === 'objeto-parlante') return 'claude-falso-compartidas.js';
  return null;
}

let hijo = null; // el falso propio al que se le paso la sesion
let vistoPrimero = false;

const rl = readline.createInterface({ input: process.stdin });
let cola = Promise.resolve();
rl.on('line', (linea) => {
  if (hijo) return hijo.stdin.write(linea + '\n');
  let ev;
  try {
    ev = JSON.parse(linea);
  } catch {
    return;
  }
  if (ev.type !== 'user') return;
  const c = ev.message?.content;
  const texto = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text || '').join('\n') : '';
  if (!vistoPrimero) {
    vistoPrimero = true;
    const otro = especialista(texto);
    if (otro) {
      hijo = spawn(process.execPath, [path.join(AQUI, otro), ...args], { cwd: process.cwd(), env: { ...process.env, FALSO_DESPACHADO: '1' }, stdio: ['pipe', 'inherit', 'inherit'] });
      hijo.stdin.on('error', () => {});
      hijo.on('exit', (codigo) => process.exit(codigo ?? 0));
      hijo.stdin.write(linea + '\n');
      return;
    }
  }
  cola = cola.then(() => alMensaje(texto));
});
rl.on('close', () => {
  if (hijo) hijo.stdin.end();
  else cola.then(() => process.exit(0));
});
