// GET /api/anuncios         -> los anuncios reales de temp/ (el tablero), con los nuevos que arma la app
// GET /api/anuncios/:slug   -> el detalle de uno (tomas, b-roll, audio, versiones y el plan para el editor)
//
// Los anuncios que arma la app (temp/<slug>/app/brief.json) aparecen aunque todavia no tengan manifiesto, con el
// estado de la app: "guion" (Claude lo escribe o espera tu aprobacion), "produciendo" (el conductor esta en marcha,
// en pausa o esperando), "listo" o "error". Cuando ya tienen manifiesto, el resto de los datos (piezas, miniatura,
// versiones, costo) sale de la misma lectura que los de siempre (lib/anuncios.js).
import path from 'node:path';
import { listarAnuncios, detalleAnuncio, slugValido } from '../lib/anuncios.js';
import { leerJSON } from '../lib/archivos.js';
import { TEMP } from '../lib/rutas.js';

/**
 * Los nombres de los que hablan, del guion que aprobo el usuario (app/guion.json): { A: 'Laura', B: 'Pedro' } en el
 * podcast, y el de la persona en la entrevista y el UGC. Asi la pantalla no dice "Host A" ni "el anfitrion A".
 */
function nombresDelGuion(slug) {
  const g = leerJSON(path.join(TEMP, slug, 'app', 'guion.json'));
  if (!g) return null;
  const generico = (n) => !n || /^(host|anfitri[oó]n)[\s-]?[ab]$/i.test(String(n).trim());
  const pers = (Array.isArray(g.personajes) ? g.personajes : []).filter((x) => x && typeof x === 'object' && x.nombre && !generico(x.nombre));
  const porLado = (lado) => {
    const x = pers.find((y) => String(y.id || '').toUpperCase().replace(/^HOST-?/, '') === lado) || (pers.length === 2 ? pers[lado === 'A' ? 0 : 1] : null);
    if (x) return String(x.nombre).slice(0, 40);
    const p = (g.partes || []).find((y) => y?.lado === lado && y.quien && !generico(y.quien));
    return p ? String(p.quien).slice(0, 40) : null;
  };
  return { A: porLado('A'), B: porLado('B'), persona: pers[0]?.nombre ? String(pers[0].nombre).slice(0, 40) : null };
}
import { listarAnunciosNuevos, anuncioNuevo } from '../lib/anuncios-nuevos.js';

/** Los de siempre y los de la app en una sola lista, sin repetidos (un slug, un anuncio). */
function todos() {
  const delMotor = listarAnuncios();
  const porSlug = new Map(delMotor.map((a) => [a.slug, a]));
  const nuevos = listarAnunciosNuevos();
  const vistos = new Set();
  const lista = [];
  for (const n of nuevos) {
    vistos.add(n.slug);
    const m = porSlug.get(n.slug);
    if (!m) {
      lista.push(n);
      continue;
    }
    // Lo del motor (piezas, miniatura, versiones) con el estado de la app. Un "listo" de la app sin MP4 todavia no
    // es listo para el tablero, y al reves: el MP4 de un anuncio que la app sigue produciendo (el control final lo
    // puede volver a exportar) no lo da por terminado.
    lista.push({
      ...m,
      nuevo: true,
      productoId: n.productoId,
      // el nombre del producto (el manifiesto no siempre lo trae y entonces saldria el slug)
      titulo: n.titulo || m.titulo,
      tituloGuion: n.tituloGuion,
      estado: n.estado === 'listo' && m.estado !== 'listo' ? 'produciendo' : n.estado,
      etapaApp: n.etapa,
      // con que familia lo produce la app, y si va con continuidad (lo pidio el usuario: el manifiesto lo dice despues)
      produccion: n.produccion,
      continuidad: Boolean(n.continuidad || m.continuidad),
      // un musical lleva el estilo visual en su manifiesto (Crochet): se ve como lo que es
      ...(n.estilo === 'musical' ? { estiloNombre: `Musical · ${m.estiloNombre}` } : {}),
      modoPrueba: n.modoPrueba,
      teNecesita: n.teNecesita,
      enGuion: n.enGuion,
      error: n.error,
      errorTipo: n.errorTipo,
      reinicio: n.reinicio,
      motor: n.motor,
      miniatura: m.miniatura || n.miniatura,
      creado: n.creado || m.creado,
      fecha: Date.parse(n.fecha) > Date.parse(m.fecha) ? n.fecha : m.fecha,
    });
  }
  for (const a of delMotor) if (!vistos.has(a.slug)) lista.push(a);
  return lista.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

export default function rutasAnuncios(app) {
  app.get('/api/anuncios', (req, res) => {
    const anuncios = todos();
    res.set('Cache-Control', 'no-store');
    res.json({
      anuncios,
      totales: {
        todos: anuncios.length,
        // los de modo prueba (barras de colores de los simuladores) no son para publicar
        listos: anuncios.filter((a) => a.estado === 'listo' && !a.modoPrueba).length,
        enProduccion: anuncios.filter((a) => a.estado === 'en-produccion' || a.estado === 'produciendo').length,
      },
    });
  });

  app.get('/api/anuncios/:slug', (req, res) => {
    const { slug } = req.params;
    if (!slugValido(slug)) return res.status(404).json({ error: 'No encuentro ese anuncio.' });
    const detalle = detalleAnuncio(slug);
    if (!detalle) return res.status(404).json({ error: 'No pude leer ese anuncio.' });
    // solo este anuncio (no la lista entera: con la PC ocupada, listar todo temp/ en cada pedido frenaba la app)
    const nuevo = anuncioNuevo(slug);
    if (nuevo) {
      Object.assign(detalle, {
        nuevo: true,
        productoId: nuevo.productoId,
        titulo: nuevo.titulo || detalle.titulo,
        tituloGuion: nuevo.tituloGuion,
        estado: nuevo.estado === 'listo' && detalle.estado !== 'listo' ? 'produciendo' : nuevo.estado,
        etapaApp: nuevo.etapa,
        produccion: nuevo.produccion,
        continuidad: Boolean(nuevo.continuidad || detalle.continuidad),
        ...(nuevo.estilo === 'musical' ? { estiloNombre: `Musical · ${detalle.estiloNombre}` } : {}),
        modoPrueba: nuevo.modoPrueba,
        enGuion: nuevo.enGuion,
        error: nuevo.error,
      });
      const nombres = nombresDelGuion(slug);
      if (nombres) {
        detalle.nombresHabla = { A: nombres.A, B: nombres.B };
        for (const h of detalle.hojas || []) {
          const lado = String(h.id).match(/^host-([ab])$/i)?.[1]?.toUpperCase();
          if (lado && nombres[lado]) h.nombre = nombres[lado];
          else if (h.id === 'persona' && nombres.persona) h.nombre = nombres.persona;
        }
      }
    }
    res.json(detalle);
  });
}
