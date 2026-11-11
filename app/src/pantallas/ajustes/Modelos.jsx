// Ajustes · Modelos: con qué modelo de IA se hace cada parte de los anuncios nuevos (voz en off, personajes que
// hablan, UGC, podcast y entrevista, su B-roll e imágenes). Una fila por categoría del catálogo
// (produccion/catalogo-modelos.json, servido en GET /api/ajustes → modelos: { eleccion, categorias }).
// Guarda al cambiar (PUT /api/ajustes/modelos). Lo elegido vale para los anuncios nuevos: uno ya empezado
// sigue con los suyos (el servidor le copia la elección al crearlo y al aprobarlo, y después no la toca).
//
// Muestra el precio aproximado de cada modelo, que arma el servidor en dólares (costoTexto). La pantalla no calcula
// precios. (Fuera del informe, solo hay otro costo: el ESTIMADO antes de producir, en la tarjeta de «Me gusta,
// producir», que también deja cambiar el modelo con «Usar este»: pantallas/nuevo/CostoEstimado.jsx.)
import { Coins, Film, Images, LifeBuoy, Mic, MessageCircle, Podcast, SlidersHorizontal, Smartphone, Star, Info } from 'lucide-react';
import { EstadoVacio, Esqueleto, Insignia, Seccion, Selector, Tarjeta } from '../../componentes/index.js';

/** El icono de cada categoría del catálogo (una que no esté acá sale con el genérico). */
const ICONO_CATEGORIA = {
  vozEnOff: Mic,
  objetoParlante: MessageCircle,
  ugc: Smartphone,
  podcastEntrevista: Podcast,
  brollHablado: Film,
  imagen: Images,
};

/** "≈ US$0,23 por clip de 10 s" → { precio: "US$0,23", unidad: "por clip de 10 s" }. */
export function partesDelCosto(costoTexto) {
  const t = String(costoTexto || '').trim();
  const m = /^(.*?)\s+(por\s.+)$/.exec(t);
  // El ≈ no va en la etiqueta: la nota de abajo ya dice que el precio es aproximado.
  const precio = (m ? m[1] : t).replace(/^≈\s*/, '');
  return { precio, unidad: m ? m[2] : '' };
}

/**
 * "Grok Imagine 1.5 · US$0,23": lo que se lee en la lista desplegable. La unidad ("por clip de
 * 10 s") va debajo del selector, así el texto entra entero en el selector cerrado.
 */
export function etiquetaOpcion(o) {
  return [o.nombre, partesDelCosto(o.costoTexto).precio].filter(Boolean).join(' · ') + (o.recomendado ? ' (recomendado)' : '');
}

/** Cuántas categorías usan su modelo recomendado (para el índice de Ajustes). { recomendados, total } */
export function resumenModelos(modelos) {
  const categorias = Array.isArray(modelos?.categorias) ? modelos.categorias : [];
  const eleccion = modelos?.eleccion || {};
  let recomendados = 0;
  for (const c of categorias) {
    const id = eleccion[c.id] || c.porDefecto;
    if (c.opciones?.find((o) => o.id === id)?.recomendado) recomendados += 1;
  }
  return { recomendados, total: categorias.length };
}

function FilaModelo({ categoria: c, elegida, guardando, alCambiar }) {
  const Icono = ICONO_CATEGORIA[c.id] || SlidersHorizontal;
  const opciones = Array.isArray(c.opciones) ? c.opciones : [];
  const valor = opciones.some((o) => o.id === elegida) ? elegida : c.porDefecto;
  const opcion = opciones.find((o) => o.id === valor) || null;
  const idTitulo = `modelo-${c.id}`;
  const unidad = partesDelCosto(opcion?.costoTexto).unidad;
  return (
    <div className="modelo-fila" role="group" aria-labelledby={idTitulo}>
      <div className="pref-bloque__intro">
        <span className="pref-bloque__icono" aria-hidden="true">
          <Icono size={18} strokeWidth={2} />
        </span>
        <div className="pila" style={{ '--hueco': '4px' }}>
          <h3 className="modelo-fila__titulo" id={idTitulo}>
            {c.nombre}
            {opcion?.recomendado ? (
              <Insignia tono="acento" icono={Star} tamano="chico">
                Recomendado
              </Insignia>
            ) : null}
          </h3>
          {c.descripcion ? <p className="pref-bloque__texto">{c.descripcion}</p> : null}
        </div>
      </div>
      <div className="modelo-fila__eleccion">
        <Selector
          etiqueta="Modelo"
          className="modelo-fila__selector"
          value={valor || ''}
          disabled={guardando || opciones.length < 2}
          onChange={(ev) => alCambiar(c.id, ev.target.value)}
          opciones={opciones.map((o) => ({ valor: o.id, etiqueta: etiquetaOpcion(o) }))}
        />
        {unidad || opcion?.nota || opcion?.siFallaTexto ? (
          <ul className="modelo-fila__notas">
            {unidad ? (
              <li>
                <Coins size={14} strokeWidth={2} aria-hidden="true" />
                Precio aproximado {unidad}
              </li>
            ) : null}
            {opcion.nota ? (
              <li>
                <Info size={14} strokeWidth={2} aria-hidden="true" />
                {opcion.nota}
              </li>
            ) : null}
            {opcion.siFallaTexto ? (
              <li>
                <LifeBuoy size={14} strokeWidth={2} aria-hidden="true" />
                {opcion.siFallaTexto}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param ajustes   GET /api/ajustes (null mientras carga), con lo recién elegido ya puesto en ajustes.modelos.eleccion
 * @param guardando id de la categoría que se está guardando (su selector queda quieto hasta que responde)
 * @param alCambiar (categoriaId, opcionId) => void
 */
export function Modelos({ ajustes, guardando = null, alCambiar }) {
  const m = ajustes?.modelos;
  const categorias = Array.isArray(m?.categorias) ? m.categorias : [];
  return (
    <Seccion
      id="modelos"
      className="ajustes__seccion"
      titulo="Modelos"
      descripcion="Con qué modelo de IA se hace cada parte de tus anuncios. Lo que elijas se usa en los anuncios nuevos: uno que ya empezó sigue con los suyos."
    >
      {!ajustes ? (
        <Esqueleto alto={420} />
      ) : !categorias.length ? (
        <EstadoVacio
          variante="compacto"
          icono={SlidersHorizontal}
          titulo="Los modelos todavía no se pueden elegir"
          descripcion="Esta versión de la app usa siempre los recomendados. Cuando la actualices, aquí eliges con cuál se hace cada parte."
        />
      ) : (
        <Tarjeta relleno="ninguno" className="modelos-lista">
          {categorias.map((c) => (
            <FilaModelo key={c.id} categoria={c} elegida={m.eleccion?.[c.id]} guardando={guardando === c.id} alCambiar={alCambiar} />
          ))}
        </Tarjeta>
      )}
    </Seccion>
  );
}
