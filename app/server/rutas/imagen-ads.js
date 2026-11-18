// La seccion "Anuncios de imagen": un lote de anuncios de imagen (1:1 y 9:16) para un producto (ESPECIFICACION-imagen-ads.md §9).
//
// GET    /api/imagen-ads/opciones                    angulos, posiciones del logo, topes, idioma por defecto y `costo`:
//                                                    { creditosPorImagen, dolaresPorImagen, dolaresPorCredito, margen, modelo }
//                                                    (el modelo de los lotes es fijo: no se compara)
// GET    /api/imagen-ads/productos                   los productos de esta app con foto
// GET    /api/imagen-ads                             { lotes: [...] } (el mas nuevo primero)
// POST   /api/imagen-ads                             crea el borrador -> 201 { lote, brief }
// PUT    /api/imagen-ads/:lote/referencias/:n        una referencia (binario; n de 1 a 10; solo en borrador)
// DELETE /api/imagen-ads/:lote/referencias/:n
// PUT    /api/imagen-ads/:lote/investigacion         la investigación de mercado (texto pegado, .txt, .md, .docx o .pdf;
//                                                    solo en borrador) -> { tipo: 'texto'|'pdf', caracteres }
// DELETE /api/imagen-ads/:lote/investigacion
// POST   /api/imagen-ads/tendencias?categoria=&marca=  una ganadora tuya (binario)  ·  DELETE /api/imagen-ads/tendencias/:id
// GET    /api/imagen-ads/biblioteca                  { referencias: [{ id, url, miniatura, fecha }] }: tu biblioteca de
//                                                    referencias (cada una que subes a un lote queda guardada sola)
// POST   /api/imagen-ads/biblioteca                  guarda una imagen (binario) -> { id, nueva }
// DELETE /api/imagen-ads/biblioteca/:id
// PUT    /api/imagen-ads/:lote/logo                  el logo (binario). En un lote ya hecho cambia el archivo (misma posicion)
// DELETE /api/imagen-ads/:lote/logo
// POST   /api/imagen-ads/:lote/generar               arranca con costoMaximoConfirmado del formulario
// GET    /api/imagen-ads/:lote                       la vista del lote (con ETag)
// GET    /api/imagen-ads/:lote/prompt/:pieza         { texto }: el prompt exacto que recibio kie (o el V##.json con como=json)
// POST   /api/imagen-ads/:lote/regenerar             { pieza, instruccion? } o { v, tipo: 'prompt' } -> 202 { pedido }
// POST   /api/imagen-ads/:lote/continuar · /detener
// GET    /api/imagen-ads/:lote/descargar?logo=1|0&prompts=0|1   el zip (en streaming)
// DELETE /api/imagen-ads/:lote                       solo un borrador (nada pagado)
// GET    /archivos/imagen-ads/:lote/<ruta>           una imagen del lote (lista cerrada)
// GET    /archivos/miniatura/imagen-ads/:lote/<ruta>?ancho=480
//
// EXCEPCION (decision de Diego): GET /api/imagen-ads/:lote/prompt/:pieza es la UNICA ruta de la app que devuelve un
// prompt. La pantalla nunca lo muestra: solo lo copia con el boton "Copiar prompt". Ninguna otra ruta devuelve prompts.
// Sin precios en la vista del lote: el costo real sale solo en `informe`, y solo con el lote terminado. La unica
// excepcion es el precio por imagen de /opciones, para el costo estimado del formulario (decision de Diego del
// 2026-11-09).
// Los POST, PUT y DELETE, solo desde la propia app (soloDesdeLaApp).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { TIPOS_MEDIO, dentroDe, stat, listar, existe } from '../lib/archivos.js';
import { ErrorApp, soloDesdeLaApp, formatoDeBytes, rutaFoto } from '../lib/productos.js';
import { aLaPapelera } from '../lib/papelera.js';
import { TEMP, RAIZ } from '../lib/rutas.js';
import { iniciarProduccion, continuar, detener, leerConductor, esperarFamilias, reabrir, estadoDeLaFila, tomarElMando } from '../lib/conductor.js';
import { modoPrueba } from '../lib/procesos.js';
import { miniatura, anchoPermitido } from '../lib/miniaturas.js';
import { R, RE_LOTE, RE_PIEZA, carpetaDe, guardarJSON, firma, vDe, formatoDe, nombreFormato, nombreSeguro, ordenDePiezas, idsDelLote, piezaId, MAXIMO_REFERENCIAS, POSICIONES, fotoDelLote } from '../lib/imagen-ads/disco.js';
import * as lotes from '../lib/imagen-ads/lotes.js';
import { vistaDelLote, leerEstado } from '../lib/imagen-ads/estado.js';
import * as local from '../lib/imagen-ads/local.js';
import { prepararZip, enviarZip } from '../lib/imagen-ads/zip.js';
import { estadoDelTurno } from '../lib/imagen-ads/turno-claude.js';
import { costoDeImagenAds } from '../lib/costo-estimado.js';
import { costoMaximoDeLaAccion, costoAprobado } from '../lib/imagen-ads/costo.js';
import * as biblioteca from '../lib/imagen-ads/biblioteca-referencias.js';
import * as plantillasRef from '../lib/imagen-ads/plantillas-referencia.js';
import { estadoTitulos, proponerTitulos, seleccionarTitulos, titulosEnCurso } from '../lib/imagen-ads/titulos.js';
import * as plantillas from '../lib/imagen-ads/plantillas.js';
import { POR_ID as PLANTILLA_POR_ID } from '../lib/imagen-ads/catalogo-plantillas.js';
import { renderizar, composicionDe, calentar as calentarPlantillas } from '../lib/plantillas/render.js';
import { leerJSON } from '../lib/archivos.js';
import { idValido } from '../lib/productos.js';
import * as videoImagenes from '../lib/imagen-ads/video-imagenes.js';
import { rutaDeReferencia } from './referencias.js';

// ---------------------------------------------------------------- utilidades

const conErrores = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ErrorApp || (Number.isInteger(e?.status) && e.status >= 400 && e.status < 600)) {
      if (!res.headersSent) return res.status(e.status).json({ error: e.message });
      return;
    }
    next(e);
  }
};

// El binario llega crudo (el JSON de la app tiene un tope de 2 MB).
const crudo = express.raw({ type: () => true, limit: '25mb' });
const leerBinario = (req, res, next) =>
  crudo(req, res, (err) => {
    if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Esa imagen pesa demasiado (más de 25 MB). Prueba con una más liviana.' : 'No pude leer esa imagen.' });
    next();
  });

/** El lote de la URL: valido, de anuncios de imagen y de esta app. Si no, 404. */
function elLote(req) {
  const lote = String(req.params.lote || '');
  if (!RE_LOTE.test(lote) || !lotes.esLoteDeEstaApp(lote)) throw new ErrorApp(404, 'No encuentro ese lote.');
  const carpeta = carpetaDe(lote);
  if (['PUT', 'DELETE'].includes(req.method) && titulosEnCurso(carpeta)) throw new ErrorApp(409, 'Espera a que termine de preparar los títulos antes de cambiar o borrar este lote.');
  return { lote, carpeta, brief: lotes.leerBrief(carpeta) };
}

const enBorrador = (lote) => !leerConductor(lote);

async function comprobarCostoConfirmado(brief, cuerpo, { loteCompleto = false } = {}) {
  const precio = await costoDeImagenAds();
  const maximo = costoMaximoDeLaAccion(precio, brief, loteCompleto ? null : cuerpo);
  if (maximo === null) throw new ErrorApp(503, 'No pude calcular el costo. Vuelve a intentarlo antes de generar.');
  if (!costoAprobado(cuerpo, maximo)) throw new ErrorApp(428, 'Confirma el costo de esta generación antes de continuar. Si cambió el precio, recarga la pantalla.');
}
const enMarcha = (lote) => {
  const f = estadoDeLaFila();
  return f.activos.includes(lote) || f.fila.includes(lote);
};

/** conductor.json para la pantalla, sin los saldos (ningun numero a la vista). */
function paraLaPantalla(c) {
  if (!c || typeof c !== 'object') return c;
  const { saldoInicial, saldoFinal, ...resto } = c;
  return resto;
}

function guardarBrief(carpeta, brief) {
  guardarJSON(R.brief(carpeta), brief);
  return brief;
}

/** Vuelve a pegar el logo en todo lo que ya tiene imagen (con el lote quieto: lo hace la ruta, de fondo). */
function recomponerLogo(lote, carpeta) {
  const brief = lotes.leerBrief(carpeta);
  const est = leerEstado(carpeta);
  for (const p of Object.keys(est?.piezas || {}).sort(ordenDePiezas)) {
    if (!existe(R.img(carpeta, p))) continue;
    local.componerLogo(carpeta, lote, p, brief).catch((e) => console.error(`[imagen-ads] ${lote}: no pude poner el logo en ${p}: ${e?.message || e}`));
  }
}

// La lista cerrada de lo que se puede abrir de un lote (nunca un JSON ni un prompt).
const PERMITIDOS = [
  /^img\/V\d{2,3}_(1x1|9x16)\.png$/,
  /^final\/V\d{2,3}_(1x1|9x16)\.png$/,
  /^versiones\/V\d{2,3}_(1x1|9x16)\.v\d+\.png$/,
  /^entrada\/producto\.(png|jpe?g|webp)$/,
  /^entrada\/referencias\/R\d{2}\.(png|jpe?g|webp)$/,
  /^entrada\/logo\.png$/,
];

function archivoDelLote(req) {
  const lote = String(req.params.lote || '');
  if (!RE_LOTE.test(lote) || !lotes.esLoteDeEstaApp(lote)) return null; // de imagen-ads y de esta app (como la API)
  const partes = Array.isArray(req.params.ruta) ? req.params.ruta : String(req.params.ruta || '').split('/');
  const rel = partes.join('/');
  if (!PERMITIDOS.some((re) => re.test(rel))) return null;
  const abs = dentroDe(carpetaDe(lote), partes);
  return abs ? { lote, rel, abs } : null;
}

// (copia de enviar() de rutas/archivos.js, que no esta exportada)
function enviar(res, abs) {
  const tipo = TIPOS_MEDIO[path.extname(abs).toLowerCase()];
  if (!tipo) return res.status(404).json({ error: 'Ese archivo no se puede abrir desde la app.' });
  const st = stat(abs);
  if (!st?.isFile()) return res.status(404).json({ error: 'No encuentro ese archivo.' });
  res.sendFile(abs, {
    dotfiles: 'deny',
    acceptRanges: true,
    cacheControl: true,
    maxAge: 0,
    headers: { 'Content-Type': tipo, 'X-Content-Type-Options': 'nosniff' },
  });
}

/** El ETag de la vista: cambia cuando cambia algo de lo que la arma. */
function etagDe(lote, carpeta) {
  const marcas = [R.conductor(carpeta), R.estado(carpeta), R.pedidos(carpeta), R.informe(carpeta), R.brief(carpeta), R.plan(carpeta), R.estrategia(carpeta), R.indiceVersiones(carpeta), R.dirImg(carpeta), R.dirFinal(carpeta), R.entrada(carpeta), R.logo(carpeta)].map((r) => {
    const s = stat(r);
    return s ? `${s.size}:${s.mtimeMs}` : '-';
  });
  for (const n of listar(R.motor(carpeta)).filter((x) => /\.resultado\.json$/.test(x)).sort()) {
    const s = stat(path.join(R.motor(carpeta), n));
    marcas.push(s ? `${n}:${s.mtimeMs}` : n);
  }
  const f = estadoDeLaFila();
  marcas.push(f.activos.includes(lote) ? 'a' : f.fila.includes(lote) ? `f${f.fila.indexOf(lote)}` : '-', modoPrueba() ? 'p' : 'r');
  return `"${crypto.createHash('sha1').update(marcas.join('|')).digest('hex').slice(0, 24)}"`;
}

/** Si el lote espera en la fila: { detrasDe: ['Anuncios de imagen: Sérum Glow'] }. */
function filaDe(lote) {
  const f = estadoDeLaFila();
  const i = f.fila.indexOf(lote);
  if (i < 0) return null;
  const titulos = lotes.titulosDeLotes();
  const delante = [...f.activos, ...f.fila.slice(0, i)].filter((s) => titulos.has(s));
  return { detrasDe: delante.map((s) => titulos.get(s)) };
}

// ---------------------------------------------------------------- las rutas

export default function rutasImagenAds(app) {
  // con el costo de cada imagen para el estimado del formulario (null si no se pudo leer: el formulario va sin numero)
  app.get('/api/imagen-ads/opciones', async (req, res) => res.json({ ...lotes.opciones(), costo: await costoDeImagenAds() }));

  app.get('/api/imagen-ads/productos', (req, res) => res.set('Cache-Control', 'no-store').json({ productos: lotes.productosConFoto() }));

  // las plantillas (anuncios validados que van al modelo como referencia, lib/imagen-ads/plantillas-referencia.js)
  // GET /api/imagen-ads/plantillas-relacionadas/:producto -> { temas, ids }  las de productos como el tuyo
  app.get('/api/imagen-ads/plantillas-relacionadas/:producto', (req, res) => res.set('Cache-Control', 'no-store').json(plantillasRef.relacionadas(String(req.params.producto))));
  app.get(['/api/imagen-ads/plantillas-referencia/:archivo', '/api/imagen-ads/plantillas-referencia/mini/:archivo'], (req, res) => {
    const abs = plantillasRef.rutaDeArchivo(req.params.archivo, req.path.includes('/mini/'));
    if (!abs) return res.status(404).json({ error: 'No encuentro esa plantilla.' });
    res.set({ 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff' }).type('image/jpeg').sendFile(abs);
  });

  // ------------------------------------------------------------ tu biblioteca de referencias
  app.get('/api/imagen-ads/biblioteca', (req, res) => res.set('Cache-Control', 'no-store').json({ referencias: biblioteca.listar() }));

  // las referencias de tendencia (TrendTrack, mis_archivos/referencias-tendencia/): para elegir como cualquier otra
  app.get('/api/imagen-ads/tendencias', (req, res) => res.set('Cache-Control', 'no-store').json(biblioteca.listarTendencias()));
  app.get('/api/imagen-ads/tendencias/:categoria/:archivo', (req, res) => {
    const abs = biblioteca.rutaTendencia(req.params.categoria, req.params.archivo);
    if (!abs) return res.status(404).json({ error: 'No encuentro esa referencia.' });
    res.set({ 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).type(abs.endsWith('.png') ? 'image/png' : 'image/jpeg').sendFile(abs);
  });

  // agregar una ganadora tuya (subida o pegada; ?categoria=<id o nombre nuevo>&marca=) y borrar cualquiera
  app.post('/api/imagen-ads/tendencias', soloDesdeLaApp, leerBinario, conErrores(async (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes?.length) throw new ErrorApp(400, 'No llegó ninguna imagen.');
    const formato = formatoDeBytes(bytes);
    if (!formato) throw new ErrorApp(400, 'Eso no parece una imagen. Sube una JPG, PNG o WEBP.');
    const categoria = String(req.query.categoria || '').trim();
    if (!categoria) throw new ErrorApp(400, 'Elige la categoría de esta ganadora.');
    const dir = path.join(biblioteca.DIR_TENDENCIAS, '.subiendo');
    const abs = await local.normalizarImagen(bytes, path.join(dir, `g-${process.pid}-${Date.now()}`), formato);
    try {
      res.status(201).json(biblioteca.agregarTendencia(abs, { categoria, marca: String(req.query.marca || '') }));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }));

  app.delete('/api/imagen-ads/tendencias/:id', soloDesdeLaApp, conErrores((req, res) => {
    if (!biblioteca.borrarTendencia(req.params.id)) throw new ErrorApp(404, 'Esa ganadora ya no está.');
    res.json({ ok: true });
  }));

  app.post('/api/imagen-ads/biblioteca', soloDesdeLaApp, leerBinario, conErrores(async (req, res) => {
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes?.length) throw new ErrorApp(400, 'No llegó ninguna imagen.');
    const formato = formatoDeBytes(bytes);
    if (!formato) throw new ErrorApp(400, 'Eso no parece una imagen. Sube una JPG, PNG o WEBP.');
    const dir = path.join(biblioteca.DIR_REFERENCIAS, '.subiendo');
    const abs = await local.normalizarImagen(bytes, path.join(dir, `r-${process.pid}-${Date.now()}`), formato);
    try {
      res.status(201).json(biblioteca.guardar(abs));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }));

  app.delete('/api/imagen-ads/biblioteca/:id', soloDesdeLaApp, conErrores((req, res) => {
    if (!biblioteca.borrar(req.params.id)) throw new ErrorApp(404, 'Esa referencia ya no está en tu biblioteca.');
    res.json({ ok: true });
  }));

  app.get('/api/imagen-ads', (req, res) => {
    const t = estadoDelTurno();
    res.set('Cache-Control', 'no-store').json({ lotes: lotes.listarLotes(), sesionesDeLotes: { ahora: t.enCurso, maximo: t.maximo } });
  });

  app.post('/api/imagen-ads', soloDesdeLaApp, conErrores(async (req, res) => {
    const cuerpo = req.body || {};
    // «De un video, imágenes»: la cantidad es la de los cuadros elegidos y el lote va con plantillas
    const v = cuerpo.video && typeof cuerpo.video === 'object' ? cuerpo.video : null;
    if (!v) return res.status(201).json(lotes.crearLote(cuerpo));
    const e = videoImagenes.estadoTrabajo(String(v.id || ''));
    if (!e) throw new ErrorApp(404, 'No encuentro ese video. Súbelo otra vez.');
    // (2026-11-19) con el ÁNGULO del video: los conceptos (con lo que editó el usuario) van a un lote con las plantillas
    // ganadoras y el modelo de imagen (rapido.js lee brief.desdeVideo)
    if (Array.isArray(v.conceptos)) {
      if (e.angulo?.estado !== 'listo') throw new ErrorApp(409, 'Espera a que tu IA termine de analizar el video.');
      const analisis = videoImagenes.limpiarAnalisis({ video: e.angulo.video, conceptos: v.conceptos });
      if (!analisis.conceptos.length) throw new ErrorApp(400, 'Deja al menos un anuncio con su titular.');
      const { temasDeTexto } = await import('../lib/imagen-ads/plantillas-referencia.js');
      const r = lotes.crearLote({
        ...cuerpo,
        video: undefined,
        cantidad: analisis.conceptos.length,
        modo: 'nuevos',
        rapido: true,
        plantillas: undefined,
        plantillasReferencia: { elegidas: cuerpo.plantillasReferencia?.elegidas || [] },
        temasExtra: temasDeTexto(Object.values(analisis.video).join(' ')),
      });
      const carpeta = carpetaDe(r.lote);
      const brief = lotes.leerBrief(carpeta);
      brief.desdeVideo = { id: e.id, ...analisis };
      guardarBrief(carpeta, brief);
      return res.status(201).json({ lote: r.lote, brief });
    }
    if (e.estado !== 'listo') throw new ErrorApp(409, 'Espera a que termine de analizar tu video.');
    const seleccion = (Array.isArray(v.seleccion) && v.seleccion.length ? v.seleccion : e.seleccion || videoImagenes.eleccionSinIA(e.cuadros, Number(cuerpo.cantidad) || 6))
      .filter((x) => Array.isArray(x?.cuadros) && x.cuadros.length)
      .slice(0, 10);
    if (!seleccion.length) throw new ErrorApp(400, 'Elige al menos un cuadro de tu video.');
    const r = lotes.crearLote({ ...cuerpo, cantidad: seleccion.length, modo: 'nuevos', rapido: true, plantillas: { elegidas: [], ...(cuerpo.plantillas?.kit ? { kit: cuerpo.plantillas.kit } : {}) } });
    const carpeta = carpetaDe(r.lote);
    const cuadros = await videoImagenes.copiarAlLote(e.id, carpeta, seleccion);
    const brief = lotes.leerBrief(carpeta);
    brief.cantidad = cuadros.length;
    brief.video = { id: e.id, cuadros };
    guardarBrief(carpeta, brief);
    res.status(201).json({ lote: r.lote, brief });
  }));

  // ------------------------------------------------------------ referencias (solo en borrador)
  app.put('/api/imagen-ads/:lote/referencias/:n', soloDesdeLaApp, leerBinario, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    if (!enBorrador(lote)) throw new ErrorApp(409, 'Este lote ya empezó: sus referencias ya no se cambian.');
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > MAXIMO_REFERENCIAS) throw new ErrorApp(400, `Puedes subir hasta ${MAXIMO_REFERENCIAS} referencias.`);
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes?.length) throw new ErrorApp(400, 'No llegó ninguna imagen.');
    const formato = formatoDeBytes(bytes);
    if (!formato) throw new ErrorApp(400, 'Eso no parece una imagen. Sube una JPG, PNG o WEBP.');
    const nombre = `R${String(n).padStart(2, '0')}`;
    const abs = await local.normalizarImagen(bytes, path.join(R.referencias(carpeta), nombre), formato);
    const rel = `entrada/referencias/${path.basename(abs)}`;
    const otras = (brief.referencias || []).filter((r) => !path.basename(r).startsWith(`${nombre}.`));
    brief.referencias = [...otras, rel].sort((a, b) => Number(path.basename(a).slice(1, 3)) - Number(path.basename(b).slice(1, 3)));
    guardarBrief(carpeta, brief);
    // queda también en tu biblioteca de referencias, para usarla con otros productos (las de «Variantes» no: ya están
    // en «Me funciona», y la biblioteca es de los anuncios que te gustan)
    if (brief.modo !== 'variantes') {
      try {
        biblioteca.guardar(abs);
      } catch {
        /* si no se pudo guardar en la biblioteca, el lote sigue igual */
      }
    }
    res.json({ n, url: `/archivos/imagen-ads/${encodeURIComponent(lote)}/${rel}?v=${firma(abs)}` });
  }));

  app.delete('/api/imagen-ads/:lote/referencias/:n', soloDesdeLaApp, conErrores((req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    if (!enBorrador(lote)) throw new ErrorApp(409, 'Este lote ya empezó: sus referencias ya no se cambian.');
    const nombre = `R${String(Number(req.params.n) || 0).padStart(2, '0')}`;
    for (const x of listar(R.referencias(carpeta))) if (x.startsWith(`${nombre}.`)) fs.rmSync(path.join(R.referencias(carpeta), x), { force: true });
    brief.referencias = (brief.referencias || []).filter((r) => !path.basename(r).startsWith(`${nombre}.`));
    guardarBrief(carpeta, brief);
    res.json({ ok: true });
  }));

  // ------------------------------------------------------------ la investigación de mercado (solo en borrador)
  app.put('/api/imagen-ads/:lote/investigacion', soloDesdeLaApp, leerBinario, conErrores((req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    if (!enBorrador(lote)) throw new ErrorApp(409, 'Este lote ya empezó: su investigación ya no se cambia.');
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes?.length) throw new ErrorApp(400, 'No llegó la investigación.');
    const r = biblioteca.investigacionATexto(bytes, String(req.headers['x-nombre'] || ''));
    if (!r) throw new ErrorApp(400, 'No pude leer esa investigación. Pega el texto, o súbela en .txt, .md, Word (.docx) o PDF.');
    fs.mkdirSync(R.entrada(carpeta), { recursive: true });
    for (const ext of ['md', 'pdf']) fs.rmSync(R.investigacion(carpeta, ext), { force: true });
    if (r.pdf) fs.writeFileSync(R.investigacion(carpeta, 'pdf'), bytes);
    else fs.writeFileSync(R.investigacion(carpeta, 'md'), r.texto);
    brief.investigacion = `entrada/investigacion.${r.pdf ? 'pdf' : 'md'}`;
    guardarBrief(carpeta, brief);
    res.json({ tipo: r.pdf ? 'pdf' : 'texto', caracteres: r.pdf ? null : r.texto.length });
  }));

  app.delete('/api/imagen-ads/:lote/investigacion', soloDesdeLaApp, conErrores((req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    if (!enBorrador(lote)) throw new ErrorApp(409, 'Este lote ya empezó: su investigación ya no se cambia.');
    for (const ext of ['md', 'pdf']) fs.rmSync(R.investigacion(carpeta, ext), { force: true });
    brief.investigacion = null;
    guardarBrief(carpeta, brief);
    res.json({ ok: true });
  }));

  // ------------------------------------------------------------ el logo
  app.put('/api/imagen-ads/:lote/logo', soloDesdeLaApp, leerBinario, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes?.length) throw new ErrorApp(400, 'No llegó ningún logo.');
    const formato = formatoDeBytes(bytes);
    if (!['png', 'jpg', 'webp'].includes(formato)) throw new ErrorApp(400, 'Sube tu logo en PNG (mejor sin fondo), JPG o WEBP.');
    const borrador = enBorrador(lote);
    const pedida = typeof req.query.posicion === 'string' ? req.query.posicion : null;
    if (pedida && !POSICIONES.includes(pedida)) throw new ErrorApp(400, 'Elige dónde va el logo.');
    if (!borrador && !brief.logo?.posicion) throw new ErrorApp(409, 'Este lote se hizo sin logo: no se le puede agregar uno. Haz otro lote con tu logo.');
    if (!borrador && pedida && pedida !== brief.logo.posicion) throw new ErrorApp(409, 'La posición del logo quedó fija al crear las imágenes: puedes cambiar el archivo, no el lugar.');
    const info = await local.prepararLogo(carpeta, bytes, formato);
    const posicion = borrador ? pedida || brief.logo?.posicion || 'arriba-centro' : brief.logo.posicion;
    brief.logo = { posicion, archivo: 'entrada/logo.png' };
    guardarBrief(carpeta, brief);
    // con el lote en marcha lo pega su carril local; quieto, se pega aca, de fondo (un solo escritor: local.enFilaDelLote)
    if (!borrador && !enMarcha(lote)) recomponerLogo(lote, carpeta);
    res.json({ url: `/archivos/imagen-ads/${encodeURIComponent(lote)}/entrada/logo.png?v=${firma(R.logo(carpeta))}`, ancho: info.ancho, alto: info.alto, transparente: info.transparente });
  }));

  app.delete('/api/imagen-ads/:lote/logo', soloDesdeLaApp, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    fs.rmSync(R.logo(carpeta), { force: true });
    fs.rmSync(R.logoJson(carpeta), { force: true });
    if (enBorrador(lote)) brief.logo = null;
    else if (brief.logo) {
      brief.logo = { posicion: brief.logo.posicion, archivo: null }; // la posicion queda: la zona ya se reservo al generar
      await local.quitarFinales(carpeta, lote);
    }
    guardarBrief(carpeta, brief);
    res.json({ ok: true });
  }));

  app.get('/api/imagen-ads/:lote/titulos', conErrores((req, res) => {
    const { carpeta, brief } = elLote(req);
    res.json(estadoTitulos(carpeta, brief));
  }));
  app.post('/api/imagen-ads/:lote/titulos', soloDesdeLaApp, conErrores((req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    if (!enBorrador(lote)) throw new ErrorApp(409, 'Este lote ya empezó.');
    const falta = lotes.faltaDelBorrador(carpeta, brief);
    if (falta) throw new ErrorApp(400, falta);
    // La sesión solo puede leer archivos de su lote.
    if (!fotoDelLote(carpeta)) {
      const foto = rutaFoto(brief.productoId, brief.fotoProducto ?? 1);
      fs.copyFileSync(foto, path.join(R.entrada(carpeta), `producto${path.extname(foto)}`));
    }
    res.status(202).json(proponerTitulos(carpeta, lote, brief));
  }));

  // ------------------------------------------------------------ arrancar, seguir, detener
  app.post('/api/imagen-ads/:lote/generar', soloDesdeLaApp, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    await esperarFamilias();
    if (leerConductor(lote)) throw new ErrorApp(409, 'Este lote ya empezó.');
    if (brief.elegirTitulos) {
      const seleccion = seleccionarTitulos(carpeta, brief, req.body?.titulos);
      brief.seleccionTitulos = seleccion;
    }
    await comprobarCostoConfirmado(brief, req.body, { loteCompleto: true });
    guardarBrief(carpeta, brief);
    const c = iniciarProduccion(lote);
    res.json({ lote, conductor: paraLaPantalla(c) });
  }));

  app.post('/api/imagen-ads/:lote/continuar', soloDesdeLaApp, conErrores((req, res) => {
    const { lote } = elLote(req);
    res.json(paraLaPantalla(continuar(lote)));
  }));

  app.post('/api/imagen-ads/:lote/detener', soloDesdeLaApp, conErrores(async (req, res) => {
    const { lote } = elLote(req);
    res.json(paraLaPantalla(await detener(lote)));
  }));

  // ------------------------------------------------------------ la vista
  app.get('/api/imagen-ads/:lote', conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    await lotes.asegurarPedidos(lote);
    const etag = etagDe(lote, carpeta);
    res.set('Cache-Control', 'no-cache');
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    const conductor = paraLaPantalla(leerConductor(lote));
    // (plantillas con el lote quieto: si algo quedó sin dibujar o cambió —el producto ya sin fondo, otra escena—, se
    // dibuja de fondo y la pantalla lo ve en la próxima vuelta)
    if (brief.plantillas && conductor && !enMarcha(lote)) plantillas.componerPendientes(carpeta, brief).catch(() => {});
    res.json(vistaDelLote({ lote, carpeta, brief, conductor, fila: conductor?.estado === 'esperando' ? filaDe(lote) : null, modoPrueba: conductor ? Boolean(conductor.modoPrueba) : modoPrueba() }));
  }));

  // ------------------------------------------------------------ el prompt (para "Copiar prompt": nunca se muestra)
  app.get('/api/imagen-ads/:lote/prompt/:pieza', conErrores((req, res) => {
    const { carpeta, brief } = elLote(req);
    const pieza = String(req.params.pieza || '');
    if (!RE_PIEZA.test(pieza) || !idsDelLote(brief.cantidad).includes(vDe(pieza)) || !(brief.formatos || []).includes(formatoDe(pieza))) throw new ErrorApp(404, 'No encuentro esa imagen en el lote.');
    res.set('Cache-Control', 'no-store');
    if (req.query.como === 'json') {
      let texto = null;
      try {
        texto = fs.readFileSync(R.v(carpeta, vDe(pieza)), 'utf8');
      } catch {
        throw new ErrorApp(404, 'Todavía no se escribió este anuncio.');
      }
      return res.json({ texto });
    }
    const actual = leerEstado(carpeta)?.piezas?.[pieza]?.version || null;
    const n = req.query.version !== undefined ? Number(req.query.version) : null;
    const ruta = n && Number.isInteger(n) && n !== actual ? R.versionTxt(carpeta, pieza, n) : R.prompt(carpeta, pieza);
    let texto;
    try {
      texto = fs.readFileSync(ruta, 'utf8');
    } catch {
      throw new ErrorApp(404, 'Todavía no se creó esta imagen.');
    }
    res.json({ texto });
  }));

  // ------------------------------------------------------------ regenerar
  app.post('/api/imagen-ads/:lote/regenerar', soloDesdeLaApp, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    const c = leerConductor(lote);
    if (!c) throw new ErrorApp(409, 'Este lote todavía no empezó.');
    if (Boolean(c.modoPrueba) !== modoPrueba()) {
      throw new ErrorApp(409, c.modoPrueba ? 'Este lote se empezó en modo prueba. Abre la app en modo prueba para cambiarlo (así no se gasta nada).' : 'Este lote se empezó de verdad. Abre la app sin el modo prueba para cambiarlo.');
    }
    if (!tomarElMando()) throw new ErrorApp(409, 'La app ya está abierta en otra ventana, y es esa la que produce. Usa esa ventana.');
    // PLANTILLAS: una que dibuja solo la app sale otra versión de sus textos, gratis y al instante; una con escena pide
    // otra escena (la del cuadrado: el vertical la reutiliza) y la nota del usuario va a la escena, sin la IA de texto.
    if (brief.plantillas && req.body?.tipo !== 'prompt') {
      const pieza = String(req.body?.pieza || '');
      const v = pieza.split('_')[0];
      const ap = plantillas.plantillaDe(carpeta, v);
      if (!ap) throw new ErrorApp(404, 'No encuentro esa imagen en el lote.');
      if (!ap.escena) {
        const r = await plantillas.otraVersion(carpeta, v);
        return res.json({ pedido: { id: null, estado: 'listo' }, gratis: true, ms: r.ms });
      }
      const instruccion = typeof req.body?.instruccion === 'string' ? req.body.instruccion.trim().slice(0, 600) : '';
      await comprobarCostoConfirmado(brief, { ...req.body, carpeta });
      plantillas.notaParaEscena(carpeta, v, instruccion);
      req.body = { pieza: piezaId(v, '1:1') };
    } else await comprobarCostoConfirmado(brief, req.body);
    const pedido = lotes.agregarPedido(lote, req.body || {});
    // Lo detuviste: el pedido queda guardado y se hace al tocar "Continuar" (reabrir lo continuaria entero, con todo lo
    // que faltaba). Terminado, en pausa por saldo o por el plan de Claude, o con error: se reabre o sigue ya; en
    // marcha: lo toma en su proxima vuelta.
    if (c.estado === 'pausado' && c.motivo === 'detenido' && !enMarcha(lote)) return res.status(202).json({ pedido: { id: pedido.id, estado: 'en-espera' } });
    try {
      reabrir(lote, 'anuncios');
    } catch (e) {
      console.error(`[imagen-ads] ${lote}: no pude reabrir el lote para ${pedido.id}: ${e?.message || e}`);
    }
    res.status(202).json({ pedido: { id: pedido.id, estado: 'pendiente' } });
  }));

  // ------------------------------------------------------------ plantillas: editar los textos (sin IA y sin costo)
  // POST /api/imagen-ads/:lote/textos { v, textos } -> { ms, piezas }: guarda y vuelve a dibujar esa variación (1-2 s)
  app.post('/api/imagen-ads/:lote/textos', soloDesdeLaApp, conErrores(async (req, res) => {
    const { carpeta, brief } = elLote(req);
    if (!brief.plantillas) throw new ErrorApp(409, 'Este lote no es de plantillas: sus textos los dibuja el modelo de imagen.');
    const v = String(req.body?.v || '');
    if (!/^V\d{2,3}$/.test(v) || !idsDelLote(brief.cantidad).includes(v)) throw new ErrorApp(404, 'No encuentro ese anuncio en el lote.');
    try {
      res.json(await plantillas.editarTextos(carpeta, v, req.body?.textos));
    } catch (e) {
      if (e?.status) throw new ErrorApp(e.status, e.message);
      throw e;
    }
  }));

  // ------------------------------------------------------------ el kit de marca de un producto
  app.get('/api/imagen-ads/kit/:producto', conErrores(async (req, res) => {
    const id = String(req.params.producto || '');
    if (!idValido(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.set('Cache-Control', 'no-store').json({ kit: await plantillas.kitDe(id), fuentesTitulo: plantillas.FUENTES_TITULO, fuentesMano: plantillas.FUENTES_MANO, stickers: plantillas.STICKERS });
  }));
  app.put('/api/imagen-ads/kit/:producto', soloDesdeLaApp, conErrores((req, res) => {
    const id = String(req.params.producto || '');
    if (!idValido(id)) throw new ErrorApp(404, 'No encuentro ese producto.');
    res.json({ kit: plantillas.guardarKit(id, req.body?.kit || req.body || {}) });
  }));

  // ------------------------------------------------------------ la muestra de cada plantilla (con tu producto y tu kit)
  // GET /api/imagen-ads/plantillas/muestra/:id?producto=<id>&foto=<n>&p=#hex&s=#hex&ft=&fs=&st=  -> PNG (guardado)
  app.get('/api/imagen-ads/plantillas/muestra/:id', conErrores(async (req, res) => {
    const id = String(req.params.id || '');
    const cat = PLANTILLA_POR_ID.get(id);
    if (!cat) throw new ErrorApp(404, 'No existe esa plantilla.');
    const productoId = String(req.query.producto || '');
    const n = Number(req.query.foto) || 1;
    const foto = idValido(productoId) ? rutaFoto(productoId, n) : null;
    const muestra = path.join(RAIZ, 'app', 'muestras', 'plantillas', 'producto-muestra.png');
    const kitBase = idValido(productoId) ? await plantillas.kitDe(productoId) : {};
    const kit = plantillas.limpiarKit({ ...kitBase, ...(req.query.p ? { primario: String(req.query.p) } : {}), ...(req.query.s ? { secundario: String(req.query.s) } : {}), ...(req.query.ft ? { fuenteTitulo: String(req.query.ft) } : {}), ...(req.query.fs ? { fuenteScript: String(req.query.fs) } : {}), ...(req.query.st ? { sticker: String(req.query.st) } : {}) });
    const archivo = foto || muestra;
    const ficha = idValido(productoId) ? leerJSON(path.join(TEMP, '_productos', productoId, 'ficha.json')) : null;
    const anuncio = /^\d{1,2}$/.test(String(req.query.anuncio || '')) ? Number(req.query.anuncio) : null;
    const textos = plantillas.textosDeMuestra(id, productoId, ficha, anuncio);
    const clave = crypto.createHash('sha1').update(JSON.stringify({ id, archivo, f: firma(archivo), kit, textos, v: 4 })).digest('hex').slice(0, 20);
    const salida = path.join(RAIZ, '.cache', 'plantillas-muestras', `${clave}.png`);
    if (!existe(salida)) {
      await renderizar({ composicion: composicionDe('1:1'), props: { plantilla: id, formato: '1:1', textos, kit, producto: { archivo, recortado: archivo === muestra }, escena: cat.escena ? { espera: 'Aquí va la escena (sin texto)' } : null, logo: null }, salida });
    }
    res.set({ 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }).type('image/png').sendFile(salida, { dotfiles: 'allow' });
  }));

  // ------------------------------------------------------------ «De un video, imágenes» (gratis salvo la IA y «Pulir con IA»)
  // POST /api/imagen-ads/video { subido: 'subido:<id>|<nombre>' } | { anuncio: <slug> }  -> 201 { id } (analiza de fondo)
  app.post('/api/imagen-ads/video', soloDesdeLaApp, conErrores(async (req, res) => {
    const b = req.body || {};
    let video = null;
    let transcripcion = '';
    let origen = null;
    const subido = typeof b.subido === 'string' ? /^subido:([a-z0-9]{6,30})\|/.exec(b.subido)?.[1] : null;
    if (subido) {
      video = rutaDeReferencia(subido);
      origen = { tipo: 'subido', id: subido };
    } else if (typeof b.anuncio === 'string') {
      const a = await videoImagenes.videoDeAnuncio(b.anuncio);
      video = a?.video || null;
      transcripcion = a?.transcripcion || '';
      origen = { tipo: 'anuncio', slug: b.anuncio };
    }
    if (!video) throw new ErrorApp(404, 'No encuentro ese video. Súbelo otra vez.');
    res.status(201).json(videoImagenes.crearTrabajo({ video, origen, transcripcion }));
  }));
  app.get('/api/imagen-ads/video/:id', conErrores((req, res) => {
    const e = videoImagenes.estadoTrabajo(String(req.params.id || ''));
    if (!e) throw new ErrorApp(404, 'No encuentro ese video.');
    res.set('Cache-Control', 'no-store').json(e);
  }));
  // POST /api/imagen-ads/video/:id/angulo { productoId, cantidad } -> { estado }: tu IA analiza el ángulo del video y
  // propone conceptos para tu producto (de fondo: la pantalla lo sigue con GET /video/:id, campo angulo)
  app.post('/api/imagen-ads/video/:id/angulo', soloDesdeLaApp, conErrores((req, res) => {
    const id = String(req.params.id || '');
    if (!videoImagenes.estadoTrabajo(id)) throw new ErrorApp(404, 'No encuentro ese video.');
    const productoId = String(req.body?.productoId || '');
    if (!idValido(productoId)) throw new ErrorApp(400, 'Elige primero tu producto: los anuncios se hacen para él.');
    res.json(videoImagenes.analizarAngulo(id, { productoId, cantidad: Number(req.body?.cantidad) || 6 }));
  }));
  // POST /api/imagen-ads/video/:id/elegir { cantidad, conIA, productoId } -> { seleccion, conIA, ms, motivo? }
  app.post('/api/imagen-ads/video/:id/elegir', soloDesdeLaApp, conErrores(async (req, res) => {
    const id = String(req.params.id || '');
    if (!videoImagenes.estadoTrabajo(id)) throw new ErrorApp(404, 'No encuentro ese video.');
    const productoId = String(req.body?.productoId || '');
    let contexto = null;
    if (idValido(productoId)) {
      try {
        const { contextoDelLote } = await import('../lib/imagen-ads/textos-plantillas.js');
        contexto = contextoDelLote(path.join(TEMP, '_productos', productoId), { productoId, datos: {} });
      } catch {
        contexto = null;
      }
    }
    try {
      res.json(await videoImagenes.elegir(id, { cantidad: Number(req.body?.cantidad) || 6, conIA: req.body?.conIA === true, contexto }));
    } catch (e) {
      if (e?.status) throw new ErrorApp(e.status, e.message);
      throw e;
    }
  }));
  app.get('/archivos/video-imagenes/:id/cuadros/:archivo', (req, res) => {
    const abs = videoImagenes.rutaArchivo(String(req.params.id || ''), `cuadros/${String(req.params.archivo || '')}`);
    if (!abs) return res.status(404).json({ error: 'No encuentro ese cuadro.' });
    res.set({ 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }).type('image/png').sendFile(abs, { dotfiles: 'allow' });
  });

  // «Pulir con IA» un cuadro del video: el modelo de imagen lo rehace limpio y nítido (sin texto). Cuesta 1 imagen.
  app.post('/api/imagen-ads/:lote/pulir', soloDesdeLaApp, conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    const c = leerConductor(lote);
    if (!c) throw new ErrorApp(409, 'Este lote todavía no empezó.');
    if (Boolean(c.modoPrueba) !== modoPrueba()) throw new ErrorApp(409, c.modoPrueba ? 'Este lote se empezó en modo prueba. Abre la app en modo prueba para cambiarlo.' : 'Este lote se empezó de verdad. Abre la app sin el modo prueba para cambiarlo.');
    if (!tomarElMando()) throw new ErrorApp(409, 'La app ya está abierta en otra ventana, y es esa la que produce. Usa esa ventana.');
    const v = String(req.body?.v || '');
    if (!/^V\d{2,3}$/.test(v) || !idsDelLote(brief.cantidad).includes(v)) throw new ErrorApp(404, 'No encuentro ese anuncio en el lote.');
    await comprobarCostoConfirmado(brief, { ...req.body, pulir: true, carpeta });
    try {
      plantillas.prepararPulido(carpeta, v);
    } catch (e) {
      if (e?.status) throw new ErrorApp(e.status, e.message);
      throw e;
    }
    const pedido = lotes.agregarPedido(lote, { pieza: piezaId(v, '1:1') });
    try {
      reabrir(lote, 'anuncios');
    } catch (e) {
      console.error(`[imagen-ads] ${lote}: no pude reabrir el lote para pulir ${v}: ${e?.message || e}`);
    }
    res.status(202).json({ pedido: { id: pedido.id, estado: 'pendiente' } });
  }));

  // ------------------------------------------------------------ el zip
  app.get('/api/imagen-ads/:lote/descargar', conErrores(async (req, res) => {
    const { lote, carpeta, brief } = elLote(req);
    const conLogo = !brief.plantillas && req.query.logo !== '0' && Boolean(brief.logo?.posicion && existe(R.logo(carpeta)));
    const conPrompts = req.query.prompts === '1';
    const titulo = nombreSeguro(brief.titulo || brief.datos?.nombre, 'Anuncios');
    const shaLogo = conLogo ? local.sha1DelLogo(carpeta) : null;
    const entradas = [];
    for (const v of idsDelLote(brief.cantidad)) {
      for (const f of brief.formatos || ['1:1']) {
        const p = piezaId(v, f);
        // (plantillas: la imagen dibujada, y solo si ya tiene su escena: nunca una vista previa)
        if (brief.plantillas) {
          const e = plantillas.estadoComposicion(carpeta, p);
          if (e.existe && e.completa) entradas.push({ nombre: `${titulo}/${v}-${nombreFormato(f)}.png`, origen: R.final(carpeta, p) });
          continue;
        }
        if (!existe(R.img(carpeta, p))) continue;
        // "Con logo" lleva solo las que ya tienen su logo pegado (las que todavia se revisan o se rehacen, todavia no):
        // nunca una mezcla con y sin logo. La pantalla dice cuantas van.
        const final = conLogo && local.finalAlDia(carpeta, p, { posicion: brief.logo.posicion, shaLogo });
        if (conLogo && !final) continue;
        entradas.push({ nombre: `${titulo}/${v}-${nombreFormato(f)}.png`, origen: final ? R.final(carpeta, p) : R.img(carpeta, p) });
        if (conPrompts && existe(R.prompt(carpeta, p))) entradas.push({ nombre: `${titulo}/prompts/${v}-${nombreFormato(f)}.txt`, origen: R.prompt(carpeta, p) });
      }
    }
    if (!entradas.some((e) => e.nombre.endsWith('.png'))) throw new ErrorApp(404, conLogo ? 'Todavía no hay imágenes con tu logo para descargar.' : 'Todavía no hay imágenes para descargar.');
    const plan = await prepararZip(entradas);
    const archivo = `${titulo}${conLogo ? '' : ' (sin logo)'}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Length': String(plan.tamano),
      'Content-Disposition': `attachment; filename="${archivo.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(archivo)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    await enviarZip(res, plan); // si algo falla a mitad, corta la respuesta: la descarga sale fallida, nunca colgada
  }));

  // ------------------------------------------------------------ eliminar un lote
  // Un borrador (no se hizo ni se pagó nada) se borra. Un lote que ya tiene imágenes no se borra: pasa a
  // temp/_descartados/ (lib/papelera.js), por si lo necesitas recuperar. Mientras se crea, primero hay que detenerlo.
  app.delete('/api/imagen-ads/:lote', soloDesdeLaApp, conErrores((req, res) => {
    const { lote, carpeta } = elLote(req);
    if (enMarcha(lote)) throw new ErrorApp(409, 'Este lote se está creando: detenlo primero y después elimínalo.');
    if (enBorrador(lote)) {
      fs.rmSync(carpeta, { recursive: true, force: true });
      return res.json({ ok: true, borrado: true });
    }
    const destino = aLaPapelera(carpeta);
    console.log(`[papelera] lote ${lote} -> ${path.relative(TEMP, destino)}`);
    res.json({ ok: true, papelera: path.relative(path.dirname(TEMP), destino) });
  }));

  // ------------------------------------------------------------ los archivos
  app.get('/archivos/imagen-ads/:lote/*ruta', (req, res) => {
    const a = archivoDelLote(req);
    if (!a) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    enviar(res, a.abs);
  });

  app.get('/archivos/miniatura/imagen-ads/:lote/*ruta', async (req, res) => {
    const a = archivoDelLote(req);
    if (!a || !stat(a.abs)?.isFile()) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    try {
      const archivo = await miniatura(a.abs, anchoPermitido(req.query.ancho || 480));
      res.sendFile(archivo, { dotfiles: 'allow', cacheControl: true, maxAge: 0, headers: { 'X-Content-Type-Options': 'nosniff' } });
    } catch {
      res.redirect(302, `/archivos/imagen-ads/${encodeURIComponent(a.lote)}/${a.rel}`);
    }
  });

  // El dibujante de las plantillas se calienta al arrancar (arma o lee el armado guardado y abre su navegador): así la
  // primera imagen de un lote ya sale en 1-2 s.
  if (!process.env.ANUNCIOS_SIN_CALENTAR_PLANTILLAS) setTimeout(() => calentarPlantillas().catch((e) => console.error('[plantillas] no pude calentar:', e?.message || e)), 4000).unref();

  // Los pedidos que quedaron colgados (la app se cerro justo despues de un "Regenerar"): un barrido al arrancar.
  if (!process.env.ANUNCIOS_NO_RETOMAR) {
    setTimeout(async () => {
      try {
        await esperarFamilias();
        if (!tomarElMando()) return;
        for (const lote of lotes.lotesDeEstaApp()) await lotes.asegurarPedidos(lote);
      } catch (e) {
        console.error('[imagen-ads] No pude revisar los pedidos pendientes:', e?.message || e);
      }
    }, 15000).unref();
  }
}
