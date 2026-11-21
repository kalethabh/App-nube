// Prueba del chat con la coordinadora y del 👍/👎 que enseña (lib/oficina-chat.js), SIN GASTAR NADA.
//   node app/herramientas/probar-oficina-chat.mjs        (PUERTO=<n>, por defecto 4492)
// Arranca la app en MODO PRUEBA con el Claude falso y:
//   · crea un producto con su ficha;
//   · le escribe a la coordinadora «hazme 2 anuncios»: contesta, crea 2 guiones de Claymation (con el pedido en el brief) y la
//     acción muestra su estado en vivo; nada pasa a producción;
//   · «regla: …» se anota en los aprendizajes (general.md) y aparece en el panel de la coordinadora;
//   · el 👎 sin texto se rechaza; con texto y partes queda como regla del estilo y en el panel del agente de esa parte;
//   · (2026-11-20e) como asistente: le pasas una imagen y un texto (adjuntos); con la imagen encarga 3 anuncios de imagen
//     al agente, te dice el costo y espera; con «dale» los produce y, cuando terminan, te escribe sola con el enlace
//     (el seguimiento); con el texto escribe ella misma 10 variaciones (una «entrega»);
//   · al terminar deja todo como estaba (anuncios, producto, chat y aprendizajes).
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
const PUERTO = Number(process.env.PUERTO) || 4492;
const BASE = `http://127.0.0.1:${PUERTO}`;
const leerSesion = (slug) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', slug, 'app', 'sesion.json'), 'utf8'));
  } catch {
    return null;
  }
};
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
let fallas = 0;
let pasan = 0;
const check = (que, ok, detalle) => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${que}${ok || detalle === undefined ? '' : `\n        ${JSON.stringify(detalle).slice(0, 900)}`}`);
  return Boolean(ok);
};
async function pedir(ruta, o = {}) {
  const cuerpo = o.json !== undefined ? JSON.stringify(o.json) : o.cuerpo;
  const headers = { Accept: 'application/json', ...(o.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) };
  const r = await fetch(BASE + ruta, { method: o.metodo || (cuerpo !== undefined ? 'POST' : 'GET'), headers, body: cuerpo, signal: AbortSignal.timeout(60000) });
  const tipo = r.headers.get('content-type') || '';
  return { st: r.status, datos: tipo.includes('json') ? await r.json().catch(() => null) : await r.text() };
}
async function esperar(minutos, leer, listo) {
  const hasta = Date.now() + minutos * 60000;
  let ultimo = null;
  while (Date.now() < hasta) {
    try {
      ultimo = await leer();
      if (listo(ultimo)) return ultimo;
    } catch (e) {
      ultimo = { error: e.message };
    }
    await dormir(700);
  }
  return { ...ultimo, _seAcaboElTiempo: true };
}

/** La respuesta de la coordinadora a tu último mensaje (no sus avisos del seguimiento). */
const respuesta = (d) => {
  const k = d?.mensajes?.findLastIndex((m) => m.de === 'tu') ?? -1;
  return k < 0 ? null : d.mensajes.slice(k + 1).find((m) => m.de === 'coordinadora' && !m.aviso) || null;
};
const conRespuesta = (d) => d && !d.pensando && respuesta(d);

// lo que la prueba toca y deja como estaba
const APRENDIZAJES = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'aprendizajes');
const RESPALDOS = [path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`, 'config.json'), path.join(APRENDIZAJES, 'general.md'), path.join(APRENDIZAJES, 'claymation.md'), path.join(RAIZ, 'temp', '_oficina', 'chat.json'), path.join(RAIZ, 'temp', '_oficina', 'aprendido.json'), path.join(RAIZ, 'temp', '_oficina', 'votos-imagenes.json')];
const antes = new Map(RESPALDOS.map((f) => [f, fs.existsSync(f) ? fs.readFileSync(f) : null]));
const oficinaExistia = fs.existsSync(path.join(RAIZ, 'temp', '_oficina'));

const TMP = fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-oficina-'));
const FOTO = path.join(TMP, 'producto.png');
cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xcc3355:s=640x640', '-frames:v', '1', FOTO]);
const ENV = path.join(RAIZ, '.env');
const envPropio = !fs.existsSync(ENV);
if (envPropio) fs.writeFileSync(ENV, '# Lo escribió probar-oficina-chat.mjs: claves falsas.\nKIE_API_KEY=simulada\nELEVENLABS_API_KEY=simulada\n');
const env = { ...process.env };
for (const k of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH|KIE_|ELEVENLABS_|OPENAI_|CODEX_)/i.test(k)) delete env[k];
Object.assign(env, { PUERTO: String(PUERTO), ANUNCIOS_MODO_PRUEBA: '1', ANUNCIOS_PRUEBA_LIMPIO: '1', ANUNCIOS_SIN_GUARDADO: '1', ANUNCIOS_CLAUDE_BIN: path.join(APP, 'server', 'claude', 'pruebas', 'claude-falso.js'), AIA_MOTOR: 'claude', OFICINA_SEGUIMIENTO_MS: '1500' });
const log = fs.createWriteStream(path.join(TMP, 'app.log'));
const app = cp.spawn(process.execPath, ['server/index.js'], { cwd: APP, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
app.stdout.pipe(log);
app.stderr.pipe(log);
const t0 = Date.now();
const creados = { slugs: [], producto: null, lotes: [], referencias: [] };

async function principal() {
  let arriba = false;
  for (let i = 0; i < 120 && !arriba; i++) {
    try {
      arriba = (await pedir('/api/estilos')).st === 200;
    } catch {
      await dormir(500);
    }
  }
  if (!check('La app de prueba arranca', arriba)) return;
  await pedir('/api/oficina/chat', { metodo: 'DELETE' });

  let r = await pedir('/api/productos', { json: { nombre: 'Producto Oficina', tipo: 'fisico', descripcion: 'Un colágeno en polvo para la piel. Una cucharada al día.' } });
  const id = r.datos?.id;
  creados.producto = id;
  if (!check('Se crea el producto', r.st === 201 && id, r)) return;
  await pedir(`/api/productos/${id}/fotos/1`, { metodo: 'PUT', cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png' } });
  await pedir(`/api/productos/${id}/analizar`, { json: {} });
  const ficha = await esperar(5, async () => (await pedir(`/api/productos/${id}`)).datos, (d) => ['lista', 'error'].includes(d?.tarea?.estado));
  if (!check('La ficha queda lista', ficha?.tarea?.estado === 'lista', ficha?.tarea)) return;

  // ------------------------------------------------------------ el chat
  r = await pedir('/api/oficina/chat', { json: { texto: '   ' } });
  check('Un mensaje vacío se rechaza (400)', r.st === 400, r);
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme 2 anuncios para vender más' } });
  check('El mensaje se guarda y la coordinadora queda «pensando»', r.st === 200 && r.datos?.mensajes?.at(-1)?.de === 'tu' && r.datos?.pensando === true, r.datos);
  const r2 = await pedir('/api/oficina/chat', { json: { texto: 'otro' } });
  check('Mientras contesta no se le puede escribir otra vez (409)', r2.st === 409, r2);
  let c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  const resp = respuesta(c);
  check('Contesta la coordinadora', resp?.de === 'coordinadora' && /guion/i.test(resp?.texto || ''), c);
  const anuncios = (resp?.acciones || []).filter((a) => a.tipo === 'anuncio' && a.ok);
  creados.slugs.push(...anuncios.map((a) => a.slug));
  check('Crea los 2 guiones de Claymation con su enlace', anuncios.length === 2 && anuncios.every((a) => /^#\/nuevo\?producto=/.test(a.href) && a.slug), resp?.acciones);
  const brief = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', anuncios[0]?.slug || '-', 'app', 'brief.json'), 'utf8'));
  check('El pedido llega al brief del guion (con «versión 1 de 2»)', brief.estilo === 'claymation' && /versión 1 de 2/.test(brief.pedido || ''), brief);
  // (el Claude falso escribe el guion copiando la muestra temp/befen-regulador-apetito; sin ella, solo se ve que arrancó)
  const hayMuestra = fs.existsSync(path.join(RAIZ, 'temp', 'befen-regulador-apetito', 'manifiesto.json'));
  if (hayMuestra) {
    c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, (d) => respuesta(d)?.acciones?.filter((a) => a.slug).every((a) => a.estado === 'aprobar'));
    check('El estado de cada guion se ve en vivo y queda esperando tu aprobación', respuesta(c)?.acciones?.filter((a) => a.slug).every((a) => a.estado === 'aprobar'), respuesta(c)?.acciones);
  } else {
    c = (await pedir('/api/oficina/chat')).datos;
    const acc = respuesta(c)?.acciones?.filter((a) => a.slug) || [];
    check('Cada guion arrancó y su estado se ve en vivo (sin la muestra del Claude falso no se termina)', acc.length === 2 && acc.every((a) => a.estado && a.estado !== 'no-esta' && leerSesion(a.slug)?.tipo === 'guion'), acc);
    // y como el guion falso no puede terminar, ella misma avisa que se trabó (el seguimiento)
    c = await esperar(2, async () => (await pedir('/api/oficina/chat')).datos, (d) => d?.mensajes?.filter((x) => x.aviso && /Se me trabó el guion/.test(x.texto)).length === 2);
    check('Si un guion se traba, te avisa sola con su enlace', c?.mensajes?.filter((x) => x.aviso && /Se me trabó el guion/.test(x.texto) && x.acciones?.[0]?.slug).length === 2, c?.mensajes?.slice(-3));
  }
  check('Nada pasó a producción', anuncios.every((a) => !fs.existsSync(path.join(RAIZ, 'temp', a.slug, 'app', 'conductor.json'))));

  r = await pedir('/api/oficina/chat', { json: { texto: 'regla: los ganchos de prueba duran menos de 3 segundos' } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  const regla = respuesta(c)?.acciones?.[0];
  check('«regla: …» queda anotada', regla?.tipo === 'regla' && regla.ok, respuesta(c));
  const general = fs.readFileSync(path.join(APRENDIZAJES, 'general.md'), 'utf8');
  check('…en los aprendizajes generales (general.md)', general.includes('- los ganchos de prueba duran menos de 3 segundos'));

  // ------------------------------------------------------------ como asistente: archivos, imágenes con su sí, entregas
  r = await pedir('/api/oficina/chat/adjuntos', { cuerpo: Buffer.from([0, 1, 2, 3, 0, 9, 9, 9, 0, 0, 0, 0, 1]), headers: { 'Content-Type': 'application/octet-stream', 'x-nombre': 'raro.bin' } });
  check('Un archivo que no se puede leer se rechaza (400)', r.st === 400, r);
  const img = await pedir('/api/oficina/chat/adjuntos', { cuerpo: fs.readFileSync(FOTO), headers: { 'Content-Type': 'image/png', 'x-nombre': encodeURIComponent('mi anuncio ganador.png') } });
  const doc = await pedir('/api/oficina/chat/adjuntos', { cuerpo: Buffer.from('Tu piel te lo va a agradecer desde la primera semana.\nSegunda línea.'), headers: { 'Content-Type': 'text/plain', 'x-nombre': 'copy.txt' } });
  check('Se adjuntan una imagen y un texto (con su tipo)', img.st === 200 && img.datos?.tipo === 'imagen' && doc.st === 200 && doc.datos?.tipo === 'documento' && img.datos.nombre === 'mi anuncio ganador.png', { img: img.datos, doc: doc.datos });
  const ver = await fetch(BASE + img.datos.url);
  check('La imagen adjunta se puede ver', ver.status === 200 && /image/.test(ver.headers.get('content-type') || ''), ver.status);
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme 3 imágenes con esta referencia', adjuntos: [img.datos.id] } });
  check('El mensaje lleva su imagen adjunta', r.st === 200 && r.datos?.mensajes?.at(-1)?.adjuntos?.[0]?.tipo === 'imagen', r.datos?.mensajes?.at(-1));
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  let m = respuesta(c);
  const accImg = m?.acciones?.find((a) => a.tipo === 'imagenes');
  if (accImg?.lote) creados.lotes.push(accImg.lote);
  check('Lee la imagen y encarga 3 anuncios de imagen al agente (con tu referencia)', /Vi tu anuncio/.test(m?.texto || '') && accImg?.ok && accImg.lote, m);
  const briefLote = accImg?.lote ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accImg.lote, 'app', 'brief.json'), 'utf8')) : null;
  check('…el lote va en «Replicar validado» (lo de siempre con referencia; el agente solo si lo pide) con tu imagen como referencia', briefLote?.replicar === true && !briefLote.agente && briefLote.modo === 'variantes' && briefLote.referencias?.length === 1, briefLote);
  check('Te dice el costo, pregunta «¿Le doy?» y lo deja esperando tu sí (sin arrancar)', /US\$\d+\.\d\d\. ¿Le doy\?/.test(m?.texto || '') && c.pendientes?.length === 1 && c.pendientes[0].costo > 0 && !fs.existsSync(path.join(RAIZ, 'temp', accImg.lote, 'app', 'conductor.json')), { texto: m?.texto, pendientes: c?.pendientes });
  r = await pedir('/api/oficina/chat', { json: { texto: 'dale' } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  check('Con «dale» arranca la generación', m?.acciones?.[0]?.ok && /Generando/.test(m.acciones[0].titulo) && fs.existsSync(path.join(RAIZ, 'temp', accImg.lote, 'app', 'conductor.json')) && !c.pendientes?.length, m);
  c = await esperar(5, async () => (await pedir('/api/oficina/chat')).datos, (d) => d?.mensajes?.some((x) => /Ya están tus/.test(x.texto)));
  m = c?.mensajes?.find((x) => /Ya están tus/.test(x.texto));
  check('Cuando terminan, te escribe sola con el enlace (el seguimiento)', m?.de === 'coordinadora' && m.acciones?.[0]?.href === `#/imagenes/${accImg.lote}` && m.acciones[0].estado === 'listo', c?.mensajes?.slice(-2));
  // (2026-11-21d) VARIACIONES EN EL CHAT de su anuncio ganador: las escribe ella, salen aquí con su semáforo 🟢/🔴
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme 4 variaciones de este anuncio ganador', adjuntos: [img.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const accVar = m?.acciones?.find((a) => a.tipo === 'imagenes');
  if (accVar?.lote) creados.lotes.push(accVar.lote);
  const bVar = accVar?.lote ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accVar.lote, 'app', 'brief.json'), 'utf8')) : null;
  check('«Variaciones de este anuncio»: las escribe ella (4, con su titular y qué cambia) y van directo, sin estrategia ni el agente', accVar?.ok && accVar.enChat && bVar?.variacionesChat?.length === 4 && bVar.rapido === true && !bVar.replicar && !bVar.agente && bVar.origen === 'chat', { accVar, b: bVar && { n: bVar.variacionesChat?.length, rapido: bVar.rapido, replicar: bVar.replicar, agente: bVar.agente } });
  if (!c.pendientes?.length || !c.pendientes.some((p) => p.id === accVar?.lote)) {
    /* sin costo: ya arrancó */
  } else {
    await pedir('/api/oficina/chat', { json: { texto: 'dale' } });
    await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  }
  const vVar = await esperar(5, async () => (await pedir(`/api/imagen-ads/${accVar.lote}`)).datos, (d) => d?.conductor?.estado === 'listo');
  const v1 = JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accVar.lote, 'V01.json'), 'utf8'));
  check('Salen las 4 imágenes, cada una con su titular y su cambio (y el titular juega con el ganador)', vVar?.conductor?.estado === 'listo' && vVar.variaciones.every((x) => x.piezas['1:1']?.url) && v1.text_layers[0].text === bVar.variacionesChat[0].titular && /WHAT CHANGES IN THIS VARIATION/.test(v1.visual_prompt) && /PLAYS with the winning headline/.test(v1.visual_prompt), { estado: vVar?.conductor?.estado, v1: v1.visual_prompt?.slice(-500) });
  let vt = await pedir('/api/oficina/imagenes/voto', { json: { lote: accVar.lote, pieza: 'V01_1x1', voto: 'bien' } });
  const vt2 = await pedir('/api/oficina/imagenes/voto', { json: { lote: accVar.lote, pieza: 'V02_1x1', voto: 'mal', motivo: 'el antes y después no se nota' } });
  const votos = (await pedir(`/api/oficina/imagenes/${accVar.lote}/votos`)).datos;
  check('🟢 y 🔴 se guardan (con el motivo y una copia de la imagen)', vt.st === 200 && vt2.st === 200 && votos?.V01_1x1?.voto === 'bien' && votos?.V02_1x1?.motivo === 'el antes y después no se nota' && fs.existsSync(path.join(RAIZ, vt.datos.archivo)), { votos, vt: vt.datos });
  vt = await pedir('/api/oficina/imagenes/voto', { json: { lote: accVar.lote, pieza: 'V99_1x1', voto: 'otro' } });
  check('Un voto raro se rechaza', vt.st === 400);
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme 2 variaciones más de este', adjuntos: [img.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const accVar2 = m?.acciones?.find((a) => a.tipo === 'imagenes');
  if (accVar2?.lote) creados.lotes.push(accVar2.lote);
  const bVar2 = accVar2?.lote ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accVar2.lote, 'app', 'brief.json'), 'utf8')) : null;
  check('La próxima vez ella ve lo que votaste (🟢 y 🔴) y el modelo también', /teniendo en cuenta lo que te gustó/.test(m?.texto || '') && bVar2?.leccionesChat?.includes(bVar.variacionesChat[0].titular) && /antes y después no se nota/.test(bVar2.leccionesChat), { texto: m?.texto, lecciones: bVar2?.leccionesChat });
  if (c.pendientes?.some((p) => p.id === accVar2?.lote)) {
    await pedir('/api/oficina/chat', { json: { texto: 'dale' } });
    await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  }
  await esperar(5, async () => (await pedir(`/api/imagen-ads/${accVar2.lote}`)).datos, (d) => d?.conductor?.estado === 'listo');
  r = await pedir('/api/oficina/chat', { json: { texto: 'Dame 10 variaciones de este texto', adjuntos: [doc.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const lineas = (m?.entrega?.texto || '').split('\n');
  check('Lee el texto y escribe ella misma las 10 variaciones (una entrega)', lineas.length === 10 && lineas.every((l) => /agradecer/.test(l)) && /aquí van/i.test(m.texto), m);
  check('…con su autoevaluación (6 criterios y la nota, el promedio)', m?.entrega?.nota === 8.7 && Object.keys(m.entrega.criterios || {}).length === 6, m?.entrega);
  // (2026-11-20h) un VIDEO adjunto para clonar en otro estilo, y dictar por voz
  const VIDEO = path.join(TMP, 'referencia.mp4');
  cp.execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x568:rate=24', '-t', '2', '-pix_fmt', 'yuv420p', VIDEO]);
  const vid = await pedir('/api/oficina/chat/adjuntos', { cuerpo: fs.readFileSync(VIDEO), headers: { 'Content-Type': 'video/mp4', 'x-nombre': encodeURIComponent('2 - VTD TT.mp4') } });
  check('Se adjunta un video (tipo video)', vid.st === 200 && vid.datos?.tipo === 'video', vid.datos);
  r = await pedir('/api/oficina/chat', { json: { texto: 'Necesito un video tal cual este en formato Zack, replica la estructura y que dure 1:50', adjuntos: [vid.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const accVid = m?.acciones?.find((a) => a.tipo === 'anuncio');
  if (accVid?.slug) creados.slugs.push(accVid.slug);
  const briefVid = accVid?.slug ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accVid.slug, 'app', 'brief.json'), 'utf8')) : null;
  check('Con el video, encarga el anuncio que lo CLONA en Zack (sin mandarte a otra pantalla)', accVid?.ok && /clonando tu video/.test(accVid.titulo) && briefVid?.estilo === 'zack-d-films' && briefVid.respuestas?.clonar === `subido:${vid.datos.id}|2 - VTD TT.mp4` && /Sí, adáptalo/.test(briefVid.respuestas?.clonar_gancho || ''), { m, brief: briefVid?.respuestas });
  const refVid = path.join(RAIZ, 'temp', '_referencias', `${vid.datos.id}.mp4`);
  creados.referencias.push(refVid);
  check('…el video queda donde «Clonar un video» lo busca', fs.existsSync(refVid) && fs.statSync(refVid).size === fs.statSync(VIDEO).size);
  // (2026-11-21b) «replícalo tal cual» SIN nombrar un estilo: «Agregar», el mismo look y la misma estructura de SU video
  r = await pedir('/api/oficina/chat', { json: { texto: 'Clónalo tal cual este video para mi producto, igual, misma estructura', adjuntos: [vid.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const accTal = m?.acciones?.find((a) => a.tipo === 'anuncio');
  if (accTal?.slug) creados.slugs.push(accTal.slug);
  const briefTal = accTal?.slug ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accTal.slug, 'app', 'brief.json'), 'utf8')) : null;
  check('«Clónalo tal cual» sin estilo: lo hace IGUAL a su video («Agregar»: mismo look y estructura), no con un estilo de la app', accTal?.ok && /Igual a tu video/.test(accTal.titulo) && (briefTal?.estilo === 'agregar' || briefTal?.agregar) && briefTal.respuestas?.clonar === `subido:${vid.datos.id}|2 - VTD TT.mp4` && /tal cual/.test(briefTal.respuestas?.pedido || ''), { m, brief: briefTal && { estilo: briefTal.estilo, respuestas: briefTal.respuestas } });
  // (2026-11-20m) un cantado (Musical) con video: no clona, va con la LETRA transcrita del video
  r = await pedir('/api/oficina/chat', { json: { texto: 'Hazme un musical igual a este, copia la letra palabra por palabra', adjuntos: [vid.datos.id] } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  m = respuesta(c);
  const accMus = m?.acciones?.find((a) => a.tipo === 'anuncio');
  if (accMus?.slug) creados.slugs.push(accMus.slug);
  const briefMus = accMus?.slug ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'temp', accMus.slug, 'app', 'brief.json'), 'utf8')) : null;
  check('Musical con video: lleva la letra transcrita del video (y no intenta clonarlo)', accMus?.ok && briefMus?.estilo === 'musical' && /piernas flacas/.test(briefMus.letraOriginal || '') && !briefMus.respuestas?.clonar, { m, brief: briefMus });
  check('…y la transcripción queda guardada para no pagarla dos veces', fs.existsSync(path.join(RAIZ, 'temp', '_oficina', 'adjuntos', vid.datos.id, 'transcripcion.txt')));
  if (briefMus) {
    const { armarSesionGuion } = await import(path.join(APP, 'server', 'lib', 'anuncios-nuevos.js'));
    const ses = armarSesionGuion(accMus.slug);
    check('…y la tarea del guion trae la letra y pide la opción 1 palabra por palabra', /La letra del video original/.test(ses.prompt) && /piernas flacas/.test(ses.prompt) && /OPCIÓN 1/.test(ses.prompt));
  }
  r = await pedir('/api/oficina/chat/voz', { cuerpo: Buffer.alloc(2000, 1), headers: { 'Content-Type': 'audio/webm' } });
  check('Dictar por voz (el respaldo grabado) devuelve el texto', r.st === 200 && /dictado por voz/.test(r.datos?.texto || ''), r);
  r = await pedir('/api/oficina/chat/voz', { cuerpo: Buffer.alloc(10, 1), headers: { 'Content-Type': 'audio/webm' } });
  check('Un audio vacío se rechaza (400)', r.st === 400, r);

  r = await pedir('/api/oficina/chat', { json: { texto: 'dale' } });
  c = await esperar(3, async () => (await pedir('/api/oficina/chat')).datos, conRespuesta);
  check('Un «dale» sin nada esperando no produce nada', respuesta(c) && !respuesta(c).acciones?.some((a) => /Generando|Produciendo/.test(a.titulo)), respuesta(c));

  // ------------------------------------------------------------ el 👍/👎
  const slug = anuncios[0].slug;
  r = await pedir(`/api/anuncios/${slug}/opinion`, { json: { voto: 'mal', partes: ['clips'] } });
  check('👎 sin decir qué no gustó se rechaza (400)', r.st === 400, r);
  r = await pedir(`/api/anuncios/${slug}/opinion`, { json: { voto: 'mal', partes: ['clips', 'guion'], texto: 'los clips de prueba se ven oscuros' } });
  check('👎 con texto queda como regla', r.st === 200 && /Evitar .*clips.*: los clips de prueba se ven oscuros/.test(r.datos?.reglas?.[0] || ''), r);
  const ugc = fs.readFileSync(path.join(APRENDIZAJES, 'claymation.md'), 'utf8');
  check('…de su estilo (claymation.md)', ugc.includes('los clips de prueba se ven oscuros'));
  r = await pedir(`/api/anuncios/${slug}/opinion`);
  check('La entrega sabe que ya opinaste', r.datos?.opinion?.voto === 'mal', r);
  const of = (await pedir('/api/oficina')).datos;
  const video = of.agentes.find((a) => a.id === 'video');
  const guion = of.agentes.find((a) => a.id === 'guion');
  const coord = of.agentes.find((a) => a.id === 'coordinacion');
  check('El productor de video (clips) y el guionista cuentan el 👎 y lo aprendido esta semana', video.opiniones.mal === 1 && video.semana.some((s) => /oscuros/.test(s.regla)) && guion.opiniones.mal === 1, { video, guion: guion.opiniones });
  check('La coordinadora muestra la regla del chat', coord.semana.some((s) => /3 segundos/.test(s.regla)), coord.semana);
  // ------------------------------------------------------------ mujer u hombre (lo elige el usuario)
  r = await pedir('/api/oficina/agentes', { metodo: 'PUT', json: { agentes: { guion: { genero: 'mujer' }, arte: { genero: 'otro' } } } });
  check('Se guarda si el agente se ve como mujer u hombre (y un valor raro no cambia nada)', r.st === 200 && r.datos.agentes.find((a) => a.id === 'guion').genero === 'mujer' && r.datos.agentes.find((a) => a.id === 'arte').genero === 'mujer', r.datos?.agentes?.map((a) => [a.id, a.genero]));
  await pedir('/api/oficina/agentes', { metodo: 'PUT', json: { agentes: { guion: { genero: 'hombre' } } } });

  // ------------------------------------------------------------ diseñar la oficina
  let d = (await pedir('/api/oficina')).datos;
  const base = d.zonas.map((z) => ({ id: z.id, lugar: z.lugar, nombre: z.nombre, color: z.color, tipo: z.tipo }));
  const cafe = base.find((z) => z.id === 'sala');
  const guionZ = base.find((z) => z.id === 'imagen');
  const libre = [...Array(d.lugares).keys()].find((n) => !base.some((z) => z.lugar === n));
  const cambiada = base.map((z) => (z.id === 'sala' ? { ...z, lugar: guionZ.lugar } : z.id === 'imagen' ? { ...z, lugar: cafe.lugar, nombre: 'Creativos', color: '#38bdf8' } : z));
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: [...cambiada, { nueva: true, nombre: 'Tráfico pago', tipo: 'datos', color: '#fb923c', lugar: libre }] } });
  const z2 = r.datos?.zonas || [];
  const propia = z2.find((z) => z.propia);
  check('Se intercambian dos salas, se renombra una y se crea una propia en el lugar libre', r.st === 200 && z2.find((z) => z.id === 'sala')?.lugar === guionZ.lugar && z2.find((z) => z.id === 'imagen')?.nombre === 'Creativos' && propia?.nombre === 'Tráfico pago' && propia.tipo === 'datos' && propia.lugar === libre, r);
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: [...cambiada, { nueva: true, nombre: 'Otra', tipo: 'datos', lugar: cafe.lugar }] } });
  check('Dos salas en el mismo lugar se rechazan (400)', r.st === 400, r);
  r = await pedir('/api/oficina/zonas', { metodo: 'PUT', json: { zonas: base } });
  check('Guardar sin la propia la borra y todo vuelve a su lugar', r.st === 200 && !r.datos.zonas.some((z) => z.propia) && r.datos.zonas.find((z) => z.id === 'sala')?.lugar === cafe.lugar, r.datos?.zonas);
  r = await pedir(`/api/anuncios/no-existe/opinion`, { json: { voto: 'bien' } });
  check('Opinar de un anuncio que no existe da 404', r.st === 404, r);
}

try {
  await principal();
} catch (e) {
  check('La prueba no se cae', false, String(e?.stack || e));
} finally {
  try {
    process.kill(-app.pid, 'SIGTERM');
    await dormir(1500);
    process.kill(-app.pid, 'SIGKILL');
  } catch {
    /* ya cerró */
  }
  for (const slug of [...creados.slugs, ...creados.lotes]) if (slug) fs.rmSync(path.join(RAIZ, 'temp', slug), { recursive: true, force: true });
  for (const f of creados.referencias) fs.rmSync(f, { force: true });
  if (creados.producto) fs.rmSync(path.join(RAIZ, 'temp', '_productos', creados.producto), { recursive: true, force: true });
  for (const [f, v] of antes) {
    if (v === null) fs.rmSync(f, { force: true });
    else fs.writeFileSync(f, v);
  }
  if (!oficinaExistia) fs.rmSync(path.join(RAIZ, 'temp', '_oficina'), { recursive: true, force: true });
  fs.rmSync(path.join(RAIZ, 'temp', `_modo-prueba-${PUERTO}`), { recursive: true, force: true });
  if (envPropio) fs.rmSync(ENV, { force: true });
  if (fallas) console.log(`\n  Registro de la app: ${path.join(TMP, 'app.log')}`);
  else fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n  ${pasan} bien, ${fallas} mal · ${Math.round((Date.now() - t0) / 1000)} s\n`);
  process.exit(fallas ? 1 : 0);
}
