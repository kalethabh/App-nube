// GET /api/anuncios/:slug/produccion -> lo que la pantalla de producción necesita además del detalle:
//
//   arreglos   piezas que se rehicieron (con su versión anterior de historial/: el "antes")
//   modelos    con qué modelo salió cada pieza, si fue el de respaldo, cuántos intentos y cuántos créditos
//   revisiones la tira de 5 cuadros que miró la IA de cada clip (qa/)
//   oido       lo que se oyó en cada clip hablado (lineas-habladas.json, ya como texto)
//   fechas     cuándo llegó cada pieza (para el registro)
//
// Todo SOLO LECTURA desde temp/<slug>/. Nunca devuelve prompts: de qa/indice.json solo sale la tira.
//
// El conductor de produccion (lib/conductor.js), para los anuncios hechos por la app (con app/brief.json):
//
//   POST /api/anuncios/:slug/producir    aprueba el guion y arranca la produccion -> conductor.json
//   GET  /api/anuncios/:slug/conductor   conductor.json (404 si todavia no empezo)
//   POST /api/anuncios/:slug/continuar   reintenta el paso que fallo, sigue despues de recargar el saldo, o corta
//                                        la espera de un reintento y prueba ya. Lo ya hecho no se paga otra vez.
//   POST /api/anuncios/:slug/detener     corta lo que este corriendo; queda en pausa ("Continuar" sigue)
//   GET  /api/anuncios/:slug/informe     app/informe.json: decisiones, lo que salio mal y el costo real
//   GET  /api/produccion/fila            cuantos se hacen a la vez, cuales, cuales esperan su lugar y como van las
//                                        filas compartidas (Claude, kie, ElevenLabs, lo pesado). Sin precios.
//
// Varios a la vez: cada anuncio entra apenas se aprueba su guion, hasta los que diga Ajustes › Tu PC; los demas
// esperan en la fila (GET /conductor trae `fila` mientras tanto). Al cargar este archivo (al arrancar la app)
// cada anuncio que estaba en marcha sigue en su paso (retomarTodo).
// Los POST solo desde la propia app: una pagina web cualquiera podria mandarle un POST a 127.0.0.1 y aca eso
// es gastar plata.
import path from 'node:path';
import { TEMP, PUERTO } from '../lib/rutas.js';
import { leerJSON, listar, stat, existe, esImagen, esVideo, dentroDe } from '../lib/archivos.js';
import { slugValido, urlAnuncio } from '../lib/anuncios.js';
import { modelosDelMotor, nombreDeModelo } from '../lib/modelos.js';
import { iniciarProduccion, continuar, detener, leerConductor, retomarTodo, slugDeLaApp, estadoDeLaFila, estadoCompleto, esperarFamilias, familiaDe } from '../lib/conductor.js';

const ORIGENES = new Set([`http://127.0.0.1:${PUERTO}`, `http://localhost:${PUERTO}`, `http://[::1]:${PUERTO}`]);

/** true si el pedido viene de la app (o de este equipo sin navegador). Si no, ya respondio 403. */
function desdeLaApp(req, res) {
  const origen = req.headers.origin;
  const sitio = String(req.headers['sec-fetch-site'] || '');
  if ((origen && !ORIGENES.has(String(origen).toLowerCase())) || sitio === 'cross-site') {
    res.status(403).json({ error: 'Solo desde la app.' });
    return false;
  }
  return true;
}

/** aprobarGuion() de lib/anuncios-nuevos.js (el guion "listo" pasa a "aprobado", validado otra vez). */
async function aprobarElGuion(slug, { letra } = {}) {
  let mod;
  try {
    mod = await import('../lib/anuncios-nuevos.js');
  } catch (e) {
    console.error('[produccion] No pude cargar lib/anuncios-nuevos.js para aprobar el guion:', e?.message || e);
    return;
  }
  // Una carpeta de prueba ("_prueba-app") no es un anuncio de esa pantalla: va directo al conductor.
  if (typeof mod.esAnuncioNuevo === 'function' && !mod.esAnuncioNuevo(slug)) return;
  // (en el musical, aprobar es elegir la letra: { letra: n })
  if (typeof mod.aprobarGuion === 'function') await mod.aprobarGuion(slug, { letra });
}

/** conductor.json para la pantalla: sin los saldos de kie que guarda para el informe (ningun numero a la vista). */
function paraLaPantalla(c) {
  if (!c || typeof c !== 'object') return c;
  const { saldoInicial, saldoFinal, ...resto } = c;
  return resto;
}

/** slug -> titulo de los anuncios de la app (para decir a cual espera). */
async function titulosDeAnuncios() {
  try {
    const { listarAnunciosNuevos } = await import('../lib/anuncios-nuevos.js');
    return new Map(listarAnunciosNuevos().map((a) => [a.slug, a.titulo]));
  } catch {
    return new Map(); // sin titulos: "otro anuncio"
  }
}

/**
 * Si el anuncio espera su lugar en la fila: { antes: [titulos], enMarcha, delante, aLaVez }. `antes` son los que
 * se producen o esperan antes que el (los que se producen primero), `enMarcha` cuantos se producen ahora,
 * `delante` cuantos esperan antes que el y `aLaVez` cuantos se hacen a la vez. null si no esta en la fila.
 */
async function filaDe(slug) {
  const f = estadoDeLaFila();
  const i = f.fila.indexOf(slug);
  if (i < 0) return null;
  const titulos = await titulosDeAnuncios();
  return {
    antes: [...f.activos, ...f.fila.slice(0, i)].map((s) => titulos.get(s) || 'otro anuncio'),
    enMarcha: f.activos.length,
    delante: i,
    aLaVez: f.maximo,
  };
}

/** Corre una accion del conductor y responde su conductor.json, o el error con su codigo. */
async function responder(res, accion) {
  try {
    res.json(paraLaPantalla(await accion()));
  } catch (e) {
    if (e?.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
}

// Nombres de los modelos como los conoce el alumno (sin códigos): la versión sale del nombre que guardó
// el motor (kling-3.0 -> Kling 3.0); si no trae versión, la del respaldo que usa el motor hoy.
const nombreModelo = (m) => nombreDeModelo(m, { respaldoActual: modelosDelMotor().respaldo });

const PIEZA = /((?:toma|broll|paso)-\d+(?:-(?:inicial|final))?)$/;
const FECHA = /(\d{4}-\d{2}-\d{2})(?:T(\d{2})-(\d{2})(?:-(\d{2}))?)?/;

// Por qué se rehizo, según cómo la guardó el motor en historial/ (prefijo o sufijo del nombre).
function motivoDe(prefijo, sufijo) {
  const t = `${prefijo || ''} ${sufijo || ''}`.toLowerCase();
  if (t.includes('con-voz')) return 'voz-colada';
  if (t.includes('manos')) return 'manos';
  if (t.includes('ojos')) return 'ojos';
  if (t.includes('clon-viejo')) return 'voz-anterior';
  if (/\bv\d\b/.test(t)) return 'version-anterior';
  return null;
}

function fechaDeNombre(texto, respaldo) {
  const r = String(texto || '').match(FECHA);
  if (!r) return respaldo;
  const [, dia, h, m, s] = r;
  const iso = h ? `${dia}T${h}:${m}:${s || '00'}` : `${dia}T12:00:00`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? respaldo : new Date(t).toISOString();
}

function fechasDe(dir, archivos) {
  const r = {};
  for (const n of archivos) {
    const st = stat(path.join(dir, n));
    if (st?.isFile()) r[n.replace(/\.[^.]+$/, '')] = st.mtime.toISOString();
  }
  return r;
}

export default function rutasProduccion(app) {
  // ---------------------------------------------------------------- conductor
  app.post('/api/anuncios/:slug/producir', (req, res) => {
    if (!desdeLaApp(req, res)) return;
    return responder(res, async () => {
      const { slug } = req.params;
      await esperarFamilias(); // al arrancar la app, las familias tardan unos milisegundos en cargarse
      // La primera vez: el guion tiene que estar listo y seguir valido, y queda aprobado (sesion.json). Un estilo que
      // la app todavia no produce no se aprueba (iniciarProduccion dice por que).
      const brief = slugDeLaApp(slug) ? leerJSON(path.join(TEMP, slug, 'app', 'brief.json')) : null;
      // (y un guion reabierto: la produccion se freno en su primer paso por el guion, lo cambiaste y lo apruebas otra vez)
      const reabierto = leerConductor(slug) ? (await import('../lib/anuncios-nuevos.js')).guionReabierto?.(slug) : false;
      if (brief && familiaDe(brief) && (!leerConductor(slug) || reabierto)) await aprobarElGuion(slug, { letra: req.body?.letra });
      return iniciarProduccion(slug);
    });
  });

  app.get('/api/anuncios/:slug/conductor', async (req, res) => {
    const { slug } = req.params;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const c = leerConductor(slug);
    if (!c) return res.status(404).json({ error: 'Este anuncio todavía no empezó a producirse.', estado: 'sin-empezar' });
    const fila = c.estado === 'esperando' ? await filaDe(slug) : null;
    res.set('Cache-Control', 'no-store').json({ ...paraLaPantalla(c), ...(fila ? { fila } : {}) });
  });

  // Los conductores de varios anuncios en un solo pedido (el menu y el tablero; antes iba uno por anuncio cada pocos
  // segundos). { conductores: { slug: conductor | null } }
  app.get('/api/conductores', async (req, res) => {
    const slugs = [...new Set(String(req.query.slugs || '').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 80);
    const conductores = {};
    for (const slug of slugs) {
      const c = slugDeLaApp(slug) ? leerConductor(slug) : null;
      if (!c) {
        conductores[slug] = null;
        continue;
      }
      const fila = c.estado === 'esperando' ? await filaDe(slug) : null;
      conductores[slug] = { ...paraLaPantalla(c), ...(fila ? { fila } : {}) };
    }
    res.set('Cache-Control', 'no-store').json({ conductores });
  });

  app.post('/api/anuncios/:slug/continuar', (req, res) => {
    if (!desdeLaApp(req, res)) return;
    return responder(res, () => continuar(req.params.slug));
  });

  app.post('/api/anuncios/:slug/detener', (req, res) => {
    if (!desdeLaApp(req, res)) return;
    return responder(res, () => detener(req.params.slug));
  });

  app.get('/api/anuncios/:slug/informe', (req, res) => {
    const { slug } = req.params;
    if (!slugDeLaApp(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const informe = leerJSON(path.join(TEMP, slug, 'app', 'informe.json'));
    if (!informe) return res.status(404).json({ error: 'El informe todavía no está listo.' });
    // El costo real sí (es lo único con precio en la app); el saldo de la cuenta no.
    const v = informe.costo?.verificacion;
    if (v) informe.costo.verificacion = { diferencia: v.diferencia, coincide: v.coincide };
    res.set('Cache-Control', 'no-store').json(informe);
  });

  // Cuantos se hacen a la vez y como van las filas compartidas (para Tu PC, el tablero y las pruebas).
  app.get('/api/produccion/fila', async (req, res) => {
    const e = await estadoCompleto();
    const titulos = await titulosDeAnuncios();
    const conTitulo = (s) => ({ slug: s, titulo: titulos.get(s) || null });
    const lugares = (f) => ({ lugares: f.lugares, ocupados: f.ocupados.length, esperando: f.esperando.length });
    res.set('Cache-Control', 'no-store').json({
      aLaVez: e.maximo,
      tope: e.tope,
      enMarcha: e.activos.map(conTitulo),
      enFila: e.fila.map(conTitulo),
      esperandoAClaude: e.esperandoAClaude.map(conTitulo),
      filas: {
        claude: { trabajando: e.filas.claude.trabajando ?? 0, esperando: e.filas.claude.esperando ?? 0, lugares: e.filas.claude.maximo ?? 2, pausaHasta: e.filas.claude.pausa?.hasta || null },
        kie: { procesos: e.filas.kie.procesos.length },
        elevenlabs: lugares(e.filas.elevenlabs),
        pesada: lugares(e.filas.pesada),
      },
    });
  });

  // Al abrir la app, lo que estaba en marcha sigue solo (sin esperar: la app arranca igual). ANUNCIOS_NO_RETOMAR=1
  // (pruebas): no retoma nada.
  if (!process.env.ANUNCIOS_NO_RETOMAR) {
    retomarTodo()
      .then((s) => s.length && console.log(`  Producción retomada: ${s.join(', ')}`))
      .catch((e) => console.error('[conductor] No pude retomar la producción:', e?.stack || e));
  }

  // ---------------------------------------------------------------- lo que se ve de la produccion
  app.get('/api/anuncios/:slug/produccion', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const dir = path.join(TEMP, slug);
    const url = (rel) => urlAnuncio(slug, rel);

    const img = listar(path.join(dir, 'img')).filter(esImagen);
    const video = listar(path.join(dir, 'video')).filter(esVideo);
    const imgIds = new Set(img.map((n) => n.replace(/\.[^.]+$/, '')));
    const vidIds = new Set(video.map((n) => n.replace(/\.[^.]+$/, '')));

    // ---------------------------------------------------------------- arreglos (historial/)
    const arreglos = {};
    const dirHist = path.join(dir, 'historial');
    for (const n of listar(dirHist)) {
      const st = stat(path.join(dirHist, n));
      if (!st?.isFile()) continue;
      const esImg = esImagen(n);
      const esVid = esVideo(n);
      if (!esImg && !esVid) continue;
      const base = n.replace(/\.[^.]+$/, '');
      const [izq, ...resto] = base.split('--');
      const sufijo = resto.join('--');
      let id = null;
      let prefijo = '';
      const p = izq.match(PIEZA);
      if (p) {
        id = p[1];
        prefijo = izq.slice(0, p.index).replace(/-$/, '');
      } else {
        const sinOriginal = izq.replace(/-original$/, '');
        if ((esImg ? imgIds : vidIds).has(sinOriginal)) id = sinOriginal;
      }
      if (!id) continue;
      const actuales = esImg ? imgIds : vidIds;
      if (!actuales.has(id)) continue; // sin "después" no hay arreglo que mostrar
      const clave = `${esImg ? 'img' : 'vid'}:${id}`;
      (arreglos[clave] ||= []).push({
        antes: url(`historial/${n}`),
        fecha: fechaDeNombre(sufijo, st.mtime.toISOString()),
        // si el nombre trae solo el día (sin hora), la hora no se muestra
        soloDia: FECHA.test(sufijo) && !/T\d{2}-/.test(sufijo),
        motivo: motivoDe(prefijo, sufijo),
      });
    }
    for (const lista of Object.values(arreglos)) lista.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));

    // ---------------------------------------------------------------- modelos (log-modelos.json)
    const modelos = {};
    const anotar = (tipo, lista) => {
      for (const x of Array.isArray(lista) ? lista : []) {
        if (!x?.id || typeof x.id !== 'string') continue;
        modelos[`${tipo}:${x.id}`] = {
          modelo: nombreModelo(x.modelo),
          respaldo: Boolean(x.respaldo),
          intentos: Number(x.intentos) || 1,
          creditos: Number.isFinite(Number(x.creditos)) ? Number(x.creditos) : null,
        };
      }
    };
    anotar('img', leerJSON(path.join(dir, 'img', 'log-modelos.json'))?.imagenes);
    anotar('vid', leerJSON(path.join(dir, 'video', 'log-modelos.json'))?.clips);

    // ---------------------------------------------------------------- lo que miró la IA (qa/)
    const revisiones = {};
    const qa = leerJSON(path.join(dir, 'qa', 'indice.json'));
    for (const c of Array.isArray(qa?.clips) ? qa.clips : []) {
      if (typeof c?.clip !== 'string' || typeof c?.tira !== 'string') continue;
      const abs = dentroDe(dir, c.tira);
      if (!abs || !esImagen(abs) || !existe(abs)) continue;
      const id = c.clip.replace(/\.[^.]+$/, '');
      revisiones[`vid:${id}`] = {
        tira: url(path.relative(dir, abs).split(path.sep).join('/')),
        cuadros: Array.isArray(c.segundos) ? c.segundos.length : Number(qa.frames) || 5,
        segundos: Array.isArray(c.segundos) ? c.segundos.map(Number).filter(Number.isFinite) : [],
      };
    }

    // ---------------------------------------------------------------- lo que se oyó (Scribe)
    const oido = {};
    const lh = leerJSON(path.join(dir, 'lineas-habladas.json'));
    for (const [n, t] of Object.entries(lh?.tomas || {})) {
      const palabras = Array.isArray(t?.palabras) ? t.palabras : [];
      const texto = palabras
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+([,.;:!?…])/g, '$1')
        .trim();
      if (!texto) continue;
      oido[n] = { texto, calidad: Number.isFinite(Number(t.calidad)) ? Number(t.calidad) : null };
    }

    // ---------------------------------------------------------------- cuándo llegó cada cosa
    const audio = {};
    for (const [clave, rel] of [
      ['voz', 'audio/voz.mp3'],
      ['cancion', 'audio/cancion.mp3'],
      ['musica', 'musica/fondo.mp3'],
    ]) {
      const st = stat(path.join(dir, rel));
      if (st?.isFile()) audio[clave] = st.mtime.toISOString();
    }

    res.json({
      arreglos,
      modelos,
      revisiones,
      oido,
      fechas: {
        imagenes: fechasDe(path.join(dir, 'img'), img),
        clips: fechasDe(path.join(dir, 'video'), video),
        audio,
      },
    });
  });
}

