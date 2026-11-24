// Embudo visual: copy literal de la investigación, cinco imágenes independientes y correcciones por sección.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TEMP, RAIZ, PUERTO_DE_PRUEBA, esDeEstaApp } from '../rutas.js';
import { leerJSON } from '../archivos.js';
import { escribirJSON, ErrorApp, leerProducto, leerFicha, fotoPrincipal } from '../productos.js';
import { estado as investigacionDe, listar as productosInvestigados } from '../investigacion.js';
import { costoDeImagenAds } from '../costo-estimado.js';
import { motorDeImagenes, entornoParaImagenes } from '../motor-imagenes.js';
import { correr } from '../procesos.js';
import { turno, soltarTurno } from '../ia/fila.js';
import { avatarElegido, validarPerfil, claveAvatar, guardarRetrato, promptAvatar } from './avatares.js';
import { SECCIONES, firma, extraerTextos, construirPrompt } from './textos.js';

const RE_ID = /^e-[a-f0-9]{12}$/;
const RE_JOB = /^j-[a-f0-9]{16}$/;
const FORMATOS = ['9:16', '4:5', '1:1'];
const activas = new Set();
const ahora = () => new Date().toISOString();
const nuevoId = (p, n) => `${p}-${crypto.randomBytes(n).toString('hex')}`;
const carpeta = (id) => path.join(TEMP, `_embudo-${id}`);
const archivo = (id) => path.join(carpeta(id), 'embudo.json');
const guardar = (e) => escribirJSON(archivo(e.id), { ...e, actualizado: ahora() });
const fuente = (productoId) => {
  const x = investigacionDe(productoId);
  if (!x) throw new ErrorApp(404, 'No encuentro ese producto.');
  if (!x.investigacion) throw new ErrorApp(428, 'Primero termina la investigación de mercado del producto.');
  return { ...x, firma: firma({ investigacion: x.investigacion, ficha: leerFicha(productoId) }) };
};
const fotosCache = new Map();
const huellaFoto = (id) => {
  const f = fotoPrincipal(id); if (!f) return null;
  const st = fs.statSync(f), clave = `${st.mtimeMs}:${st.ctimeMs}:${st.size}`;
  const antes = fotosCache.get(f); if (antes?.clave === clave) return antes.firma;
  const h = firma(fs.readFileSync(f).toString('base64')); fotosCache.set(f, { clave, firma: h }); return h;
};
const opcionDe = (e, s) => e.textos[s]?.opciones.find((o) => o.id === e.seleccion[s]);
const firmaSeccion = (e, s) => firma({ opcion: opcionDe(e, s), contenido: e.textos[s]?.contenido, formato: e.formato, estilo: e.estilo, fuente: e.fuenteFirma, foto: e.fotoFirma, avatar: claveAvatar(e.avatar) });
function cargar(id) {
  if (!RE_ID.test(String(id))) throw new ErrorApp(404, 'No encuentro ese embudo.');
  const e = leerJSON(archivo(id));
  if (!e || !esDeEstaApp(e)) throw new ErrorApp(404, 'No encuentro ese embudo.');
  if (e.trabajo?.estado === 'generando' && !activas.has(id)) {
    // Puede haberse cerrado después de descargar/anotar una imagen y antes de actualizar el panel.
    const jobId = e.trabajo.id;
    const j = RE_JOB.test(jobId) ? leerJSON(path.join(carpeta(id), 'trabajos', jobId, 'trabajo.json')) : null;
    const terminadas = new Set();
    for (const p of j?.piezas || []) {
      if (p.id !== 'avatar' && !SECCIONES.some((s) => s.id === p.id)) continue;
      const dir = path.join(carpeta(id), 'trabajos', jobId);
      if (leerJSON(path.join(dir, `${p.id}.resultado.json`))?.ok && fs.existsSync(path.join(dir, `${p.id}.png`))) {
        terminadas.add(p.id);
        if (p.id === 'avatar') {
          try { e.avatar.guardado = guardarRetrato(e, dir, jobId, e.avatar.descripcion); e.avatarPendiente = null; } catch { e.avatarPendiente = jobId; }
          continue;
        }
        e.imagenes[p.id] = { archivo: `trabajos/${jobId}/${p.id}.png`, firma: p.firma, trabajoId: jobId, fecha: ahora(), url: `/api/embudos/${id}/imagenes/${jobId}/${p.id}` };
      }
    }
    e.trabajo.hechas = (e.trabajo.secciones || []).filter((s) => terminadas.has(s)).length;
    e.trabajo.actual = null;
    e.trabajo.estado = e.trabajo.hechas === e.trabajo.cantidad ? 'lista' : 'interrumpido';
    e.trabajo.error = e.trabajo.estado === 'lista' ? null : 'La generación se interrumpió. Revisa lo ya generado y retoma las secciones pendientes.';
    guardar(e);
  }
  return e;
}
function libre(e) {
  if (activas.has(e.id)) throw new ErrorApp(409, 'Espera a que termine la generación antes de cambiar el embudo.');
}
function vigente(e) {
  if (fuente(e.productoId).firma !== e.fuenteFirma || huellaFoto(e.productoId) !== e.fotoFirma) throw new ErrorApp(409, 'Cambió la investigación, la ficha o la foto. Actualiza los textos del embudo y revisa tu selección.');
}
function vista(e) {
  let fuenteCambio = true;
  try { fuenteCambio = fuente(e.productoId).firma !== e.fuenteFirma || huellaFoto(e.productoId) !== e.fotoFirma; } catch { /* producto o investigación borrados */ }
  return {
    id: e.id, productoId: e.productoId, nombre: e.nombre, formato: e.formato, estilo: e.estilo, version: e.version,
    fuenteCambio, fuenteFecha: e.fuenteFecha, trabajo: e.trabajo, actualizado: e.actualizado, avatar: e.avatar || { modo:'sin' }, avatarGuardado: (() => { const a=avatarElegido(e.avatar); return a ? { nombre:a.nombre, url:a.url, estilo:a.estilo, id:a.id } : null; })(), avatarPendiente: Boolean(e.avatarPendiente),
    secciones: SECCIONES.map((s) => ({ ...s, ...e.textos[s.id], elegida: e.seleccion[s.id] || null, correccion: e.correcciones[s.id] || '',
      imagen: e.imagenes[s.id] ? { ...e.imagenes[s.id], desactualizada: e.imagenes[s.id].firma !== firmaSeccion(e, s.id) } : null,
    })),
  };
}
export const ver = (id) => vista(cargar(id));
export function listar() {
  const embudos = [];
  if (fs.existsSync(TEMP)) for (const n of fs.readdirSync(TEMP).filter((n) => n.startsWith('_embudo-'))) {
    try { const e = cargar(n.slice(8)); embudos.push({ id: e.id, nombre: e.nombre, productoId: e.productoId, actualizado: e.actualizado, generadas: Object.keys(e.imagenes).length }); } catch { /* otra app o archivo incompleto */ }
  }
  return { embudos: embudos.sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))), productos: productosInvestigados() };
}
export function crear({ productoId }) {
  const f = fuente(productoId);
  if (!fotoPrincipal(productoId)) throw new ErrorApp(428, 'Agrega una foto del producto antes de crear el embudo.');
  const textos = extraerTextos(f.investigacion, leerFicha(productoId));
  const e = { id: nuevoId('e', 6), productoId, nombre: f.producto.nombre, puerto: PUERTO_DE_PRUEBA, version: 1, creado: ahora(), actualizado: ahora(),
    formato: '9:16', estilo: '', avatar: { modo:'nuevo', descripcion:'', semilla:nuevoId('a',6) }, fuenteFirma: f.firma, fuenteFecha: f.investigacion.fecha || null, fotoFirma: huellaFoto(productoId), textos,
    seleccion: Object.fromEntries(SECCIONES.map((s) => [s.id, textos[s.id].opciones.length === 1 ? textos[s.id].opciones[0].id : null])),
    correcciones: {}, imagenes: {}, presupuestos: {}, trabajo: null,
  };
  guardar(e);
  return vista(e);
}
export function editar(id, { version, seleccion, correcciones, formato, estilo, avatar, actualizarTextos = false }) {
  const e = cargar(id); libre(e);
  if (version !== e.version) throw new ErrorApp(409, 'El embudo cambió en otra ventana. Recarga antes de guardar.');
  if (actualizarTextos) {
    const f = fuente(e.productoId);
    e.nombre = f.producto.nombre;
    e.textos = extraerTextos(f.investigacion, leerFicha(e.productoId));
    e.fuenteFirma = f.firma; e.fuenteFecha = f.investigacion.fecha || null; e.fotoFirma = huellaFoto(e.productoId);
    for (const s of SECCIONES) if (!opcionDe(e, s.id)) e.seleccion[s.id] = e.textos[s.id].opciones.length === 1 ? e.textos[s.id].opciones[0].id : null;
  }
  for (const s of SECCIONES) {
    if (seleccion && Object.hasOwn(seleccion, s.id)) {
      const op = seleccion[s.id];
      if (op !== null && !e.textos[s.id].opciones.some((x) => x.id === op)) throw new ErrorApp(400, 'Elige una opción de la investigación de esa sección.');
      e.seleccion[s.id] = op;
    }
    if (correcciones && Object.hasOwn(correcciones, s.id)) {
      const t = correcciones[s.id];
      if (typeof t !== 'string' || t.length > 1200) throw new ErrorApp(400, 'La corrección puede tener hasta 1200 caracteres.');
      e.correcciones[s.id] = t.trim();
    }
  }
  if (avatar !== undefined) {
    if(e.avatarPendiente) throw new ErrorApp(409,'Guarda primero el avatar pendiente en la Biblioteca.');
    const p=validarPerfil(avatar,e.avatar);
    if(p.modo==='nuevo') p.semilla=p.guardado ? e.avatar.semilla : nuevoId('a',6);
    e.avatar=p; e.avatarPendiente=null;
  }
  if (formato !== undefined) { if (!FORMATOS.includes(formato)) throw new ErrorApp(400, 'Formato no válido.'); e.formato = formato; }
  if (estilo !== undefined) { if (typeof estilo !== 'string' || estilo.length > 1200) throw new ErrorApp(400, 'La dirección visual puede tener hasta 1200 caracteres.'); e.estilo = estilo.trim(); }
  e.version++; e.presupuestos = {};
  guardar(e); return vista(e);
}

/** Devuelve una propuesta exacta con versión y precio. Esto no genera ni cobra. */
export async function presupuestar(id, { version, secciones, corregir = false, retomar = null }) {
  let e = cargar(id); libre(e); vigente(e);
  if(e.avatarPendiente) throw new ErrorApp(409,'Primero guarda el avatar pendiente en la Biblioteca; no hace falta generarlo otra vez.');
  if (e.version !== version) throw new ErrorApp(409, 'Recarga el embudo antes de calcular el costo.');
  const motor = motorDeImagenes();
  const precio = await costoDeImagenAds();
  if (!precio || !Number.isFinite(precio.dolaresPorImagen)) throw new ErrorApp(503, 'No pude calcular el precio. Vuelve a intentarlo.');
  // El precio se calcula fuera del bloqueo: se comprueba otra vez antes de guardar el presupuesto.
  e = cargar(id); libre(e); vigente(e);
  if (e.version !== version) throw new ErrorApp(409, 'Cambió el embudo mientras calculaba el precio.');
  let piezas;
  if (retomar) {
    if (!RE_JOB.test(retomar) || e.trabajo?.id !== retomar || !['error', 'parcial', 'interrumpido'].includes(e.trabajo.estado)) throw new ErrorApp(400, 'No hay una generación pendiente que retomar.');
    const j = leerJSON(path.join(carpeta(id), 'trabajos', retomar, 'trabajo.json'));
    if (!j || j.version !== e.version || j.motor !== motor) throw new ErrorApp(409, 'Cambió el encargo o el motor: revisa los textos y crea una nueva generación.');
    piezas = j.piezas.filter((p) => !leerJSON(path.join(carpeta(id), 'trabajos', retomar, `${p.id}.resultado.json`))?.ok);
  } else {
    if (!Array.isArray(secciones) || !secciones.length || secciones.length > 5 || new Set(secciones).size !== secciones.length) throw new ErrorApp(400, 'Selecciona entre una y cinco secciones diferentes.');
    piezas = secciones.map((s) => {
      if (!SECCIONES.some((x) => x.id === s)) throw new ErrorApp(400, 'Sección no válida.');
      const opcion = opcionDe(e, s);
      if (!opcion?.titulo || !opcion?.subtitulo) throw new ErrorApp(428, `Elige un título y subtítulo completos para ${SECCIONES.find((x) => x.id === s).nombre}.`);
      if (corregir && (!e.imagenes[s] || !e.correcciones[s])) throw new ErrorApp(428, 'Primero genera la imagen y escribe qué quieres corregir.');
      const contenido = [...new Set([...(e.textos[s].contenido || []), ...(opcion.contenido || [])])].slice(0, 8);
      return { id: s, opcion, contenido, firma: firmaSeccion(e, s), correccion: corregir ? e.correcciones[s] : '', anterior: corregir ? e.imagenes[s].archivo : null };
    });
  }
  if(!retomar && e.avatar?.modo==='nuevo' && e.avatar.guardado && !avatarElegido(e.avatar)) throw new ErrorApp(404,'El avatar guardado ya no está en Biblioteca. Elige otro o prepara un avatar nuevo.');
  if (!retomar && e.avatar?.modo === 'biblioteca' && !avatarElegido(e.avatar)) throw new ErrorApp(404, 'El avatar elegido ya no está en tu Biblioteca.');
  if (!retomar && e.avatar?.modo === 'nuevo' && !avatarElegido(e.avatar) && piezas.some(p=>p.id!=='ingredientes')) piezas.unshift({ id:'avatar', firma:firma(claveAvatar(e.avatar)), crearAvatar:true });
  if (!piezas.length) throw new ErrorApp(409, 'No hay secciones pendientes.');
  const importe = Math.round(precio.dolaresPorImagen * piezas.length * 100) / 100;
  const q = { token: crypto.randomBytes(16).toString('hex'), version, motor, modelo: precio.modelo, importe, cantidad: piezas.length, creado: Date.now(), piezas, retomar, corregir, fotoFirma: e.fotoFirma, avatarFirma: firma(avatarElegido(e.avatar) ? fs.readFileSync(avatarElegido(e.avatar).archivo).toString('base64') : claveAvatar(e.avatar)) };
  e.presupuestos = { [q.token]: q }; guardar(e);
  return { token: q.token, version, importe, cantidad: q.cantidad, modelo: q.modelo, motor, secciones: piezas.map((p) => p.id), corregir, retomar };
}

/** La aprobación usa el presupuesto exacto, no una cifra libre enviada por el cliente. Idempotente por token. */
export async function generar(id, { token, version }) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ''))) throw new ErrorApp(428, 'Primero revisa y confirma el costo de la generación.');
  let e = cargar(id);
  if (e.trabajo?.token === token) return vista(e);
  libre(e); vigente(e);
  const q = e.presupuestos[token];
  if (!q || version !== e.version || q.version !== version || Date.now() - q.creado > 20 * 60000) throw new ErrorApp(428, 'Vuelve a revisar y confirmar el costo de esta generación.');
  const precio = await costoDeImagenAds();
  e = cargar(id);
  if (e.trabajo?.token === token) return vista(e);
  libre(e); vigente(e);
  if (e.version !== version || !e.presupuestos[token] || motorDeImagenes() !== q.motor || !precio || precio.modelo !== q.modelo || precio.dolaresPorImagen * q.cantidad > q.importe + .001) throw new ErrorApp(428, 'Cambió el encargo, el modelo o el precio. Confirma un presupuesto nuevo.');
  const avatarActual = avatarElegido(e.avatar);
  const avatarFirma = firma(avatarActual ? fs.readFileSync(avatarActual.archivo).toString('base64') : claveAvatar(e.avatar));
  if (q.avatarFirma !== avatarFirma) throw new ErrorApp(428, 'Cambió el avatar. Revisa el presupuesto otra vez.');
  const jobId = q.retomar || nuevoId('j', 8);
  const dir = path.join(carpeta(id), 'trabajos', jobId);
  fs.mkdirSync(dir, { recursive: true });
  if (!q.retomar) {
    const foto = fotoPrincipal(e.productoId);
    const productoFoto = `producto${path.extname(foto)}`;
    fs.copyFileSync(foto, path.join(dir, productoFoto));
    const ficha = leerFicha(e.productoId) || {};
    const inv = fuente(e.productoId).investigacion;
    const estilo = `${/^#[a-f0-9]{6}$/i.test(inv.color || '') ? `Color de la investigación: ${inv.color}. ` : ''}${e.estilo || 'Identidad adaptada a la categoría, el público y el empaque real del producto. Consistencia de marca entre las cinco secciones.'}`;
    const usarAvatar = ['nuevo','biblioteca'].includes(e.avatar?.modo) && q.piezas.some(p=>p.id!=='ingredientes');
    const avatarArchivo = avatarActual && usarAvatar ? `avatar-base${path.extname(avatarActual.archivo)}` : usarAvatar ? 'avatar.png' : null;
    if(avatarActual && usarAvatar) fs.copyFileSync(avatarActual.archivo,path.join(dir,avatarArchivo));
    const piezas = q.piezas.map((p) => ({ ...p, prompt: p.id === 'avatar' ? promptAvatar(e,ficha) : construirPrompt({ seccion: p.id, opcion: p.opcion, contenido: p.contenido, producto: e.nombre, ficha, estilo, formato: e.formato, correccion: p.correccion }) }));
    escribirJSON(path.join(dir, 'trabajo.json'), { id: jobId, version, motor: q.motor, formato: e.formato, foto: productoFoto, usarAvatar, avatarArchivo, piezas, creado: ahora() });
  }
  e.trabajo = { id: jobId, token, estado: 'generando', motor: q.motor, cantidad: q.cantidad, importeAprobado: q.importe, inicio: ahora(), secciones: q.piezas.map((p) => p.id), hechas: 0 };
  e.presupuestos = {}; guardar(e);
  activas.add(id);
  ejecutar(id, jobId, q.piezas).catch(() => {
    const x = cargar(id); x.trabajo.estado = 'error'; x.trabajo.error = 'No se completó la generación. Revisa las secciones y retoma lo pendiente.'; guardar(x);
  }).finally(() => activas.delete(id));
  return vista(e);
}

// Dos motores del embudo como máximo; con ChatGPT también se respeta la fila compartida de la app.
let motores = 0; const espera = [];
async function entrar() { if (motores < 2) { motores++; return; } await new Promise((r) => espera.push(r)); }
function salir() { const siguiente = espera.shift(); if (siguiente) siguiente(); else motores--; }
async function ejecutar(id, jobId, piezas) {
  const relDir = path.relative(RAIZ, path.join(carpeta(id), 'trabajos', jobId));
  let fallas = 0;
  for (const p of piezas) {
    let e = cargar(id); e.trabajo.actual = p.id; guardar(e);
    await entrar(); let conTurno = false;
    try {
      if (e.trabajo.motor === 'chatgpt') conTurno = await turno();
      if (e.trabajo.motor === 'chatgpt' && !conTurno) throw new Error('Sin turno.');
      const r = await correr({ slug: `_embudo-${id}`, paso: `embudo-${jobId}-${p.id}`, script: 'generar-embudo.js', args: [relDir, p.id], env: { ...entornoParaImagenes(), EMBUDO_MOTOR: e.trabajo.motor } });
      const dir = path.join(carpeta(id), 'trabajos', jobId);
      const res = leerJSON(path.join(dir, `${p.id}.resultado.json`));
      e = cargar(id);
      if (r.codigo === 0 && res?.ok && fs.existsSync(path.join(dir, `${p.id}.png`))) {
        if (p.id === 'avatar') {
          try { e.avatar.guardado = guardarRetrato(e, dir, jobId, e.avatar.descripcion); e.avatarPendiente=null; } catch { e.avatarPendiente=jobId; }
        } else {
        const archivo = `trabajos/${jobId}/${p.id}.png`;
        e.imagenes[p.id] = { archivo, firma: p.firma, trabajoId: jobId, fecha: ahora(), url: `/api/embudos/${id}/imagenes/${jobId}/${p.id}` };
        }
        e.trabajo.hechas++;
      } else { fallas++; e.trabajo.error = 'Alguna sección no se completó. Las imágenes anteriores se conservan. Puedes retomar lo pendiente.'; }
      guardar(e);
    } catch { fallas++; }
    finally { if (conTurno) soltarTurno(); salir(); }
  }
  const e = cargar(id);
  if (fallas) e.trabajo.error = 'Alguna sección no se completó. Las imágenes anteriores se conservan. Puedes retomar lo pendiente.';
  e.trabajo.estado = fallas ? (e.trabajo.hechas ? 'parcial' : 'error') : 'lista';
  e.trabajo.fin = ahora(); e.trabajo.actual = null; guardar(e);
}
export function imagen(id, jobId, seccion) {
  const e = cargar(id);
  if (!RE_JOB.test(jobId) || !SECCIONES.some((s) => s.id === seccion)) throw new ErrorApp(404, 'No encuentro esa imagen.');
  const f = path.join(carpeta(e.id), 'trabajos', jobId, `${seccion}.png`);
  if (!leerJSON(path.join(path.dirname(f), `${seccion}.resultado.json`))?.ok || !fs.existsSync(f)) throw new ErrorApp(404, 'La imagen todavía no está lista.');
  return f;
}

export function guardarAvatarPendiente(id) { const e=cargar(id); libre(e); const j=e.avatarPendiente; if(!RE_JOB.test(j||'')) throw new ErrorApp(404,'No hay un avatar pendiente de guardar.'); const dir=path.join(carpeta(id),'trabajos',j); if(!leerJSON(path.join(dir,'avatar.resultado.json'))?.ok) throw new ErrorApp(409,'El retrato todavía no está listo.'); e.avatar.guardado=guardarRetrato(e,dir,j,e.avatar.descripcion); e.avatarPendiente=null; guardar(e); return vista(e); }
