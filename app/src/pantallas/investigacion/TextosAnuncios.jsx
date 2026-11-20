// «Textos para tus anuncios de imagen» (2026-11-18): los que dejó escritos la investigación de mercado para las
// plantillas de «Ángulos ganadores» (clones de anuncios validados), uno por concepto de la matriz de Andromeda. Cada uno
// se ve dibujado con la foto de tu producto y se corrige con «Editar»: la corrección queda guardada en la investigación,
// la usan los lotes de imágenes de este producto y se anota como aprendizaje para las próximas investigaciones.
import { useState } from 'react';
import { Images, PenLine } from 'lucide-react';
import { Boton, useAvisos } from '../../componentes/index.js';
import { apiImagenes } from '../../datos/imagenes.js';
import { apiInvestigacion } from '../../datos/investigacion.js';
import { enlace } from '../../datos/rutas.js';
import { ModalTextos } from '../imagenes-lote/ModalTextos.jsx';

/** El texto principal de un anuncio (para la tarjeta). */
function principal(t = {}) {
  const v = t.titular || t.titulo || t.pregunta || t.frase || (t.zona ? `${t.zona} ${t.mal || ''}` : '') || (Array.isArray(t.lineas) ? t.lineas.join(' ') : '') || t.marca || '';
  return String(v).replace(/\*/g, '');
}

function Muestra({ url, nombre }) {
  const [cargada, setCargada] = useState(false);
  return (
    <span className={`inv-anuncio__muestra${cargada ? ' inv-anuncio__muestra--cargada' : ''}`}>
      <img src={url} alt={`Muestra: ${nombre}`} loading="lazy" decoding="async" draggable="false" onLoad={() => setCargada(true)} />
    </span>
  );
}

/** inv: la investigación · plantillas: { id: { nombre, campos } } · id del producto · onCambio(): recargar */
export function TextosAnuncios({ id, inv, plantillas, onCambio }) {
  const { aviso } = useAvisos();
  const [editando, setEditando] = useState(null); // índice
  const lista = Array.isArray(inv?.anuncios_imagen) ? inv.anuncios_imagen : [];
  if (!lista.length) return null;
  const actual = editando !== null ? lista[editando] : null;
  const p = actual ? plantillas?.[actual.plantilla] : null;
  const guardar = async (_v, textos) => {
    await apiInvestigacion.editarAnuncio(id, editando, textos);
    setEditando(null);
    aviso({ tipo: 'exito', titulo: 'Texto corregido', texto: 'Tus anuncios de imagen de este producto ya lo usan, y la próxima investigación lo tendrá en cuenta.' });
    await onCambio?.();
  };
  return (
    <section className="inv-anuncios" aria-labelledby="inv-anuncios-titulo" data-seccion="Textos para tus anuncios de imagen">
      <header className="inv-anuncios__cabeza">
        <div>
          <h2 id="inv-anuncios-titulo" className="inv-anuncios__titulo">Textos para tus anuncios de imagen</h2>
          <p className="t-chico t-2">
            Uno por concepto para Meta, en plantillas que clonan anuncios ya validados (misma composición y letra, con tus colores y tu producto). Corrige los que no te gusten: la app aprende cómo los quieres.
          </p>
        </div>
        <Boton variante="primario" tamano="chico" icono={Images} href={enlace.crearImagenes({ producto: id, modo: 'investigacion' })}>
          Crear estos anuncios
        </Boton>
      </header>
      <div className="inv-anuncios__rejilla">
        {lista.map((a, i) => {
          const pl = plantillas?.[a.plantilla];
          if (!pl) return null;
          return (
            <article key={i} className="inv-anuncio">
              <Muestra url={apiImagenes.urlMuestra(a.plantilla, { producto: id, anuncio: i, version: a.editado || null })} nombre={pl.nombre} />
              <div className="inv-anuncio__cuerpo">
                <span className="inv-anuncio__formato">{pl.nombre}</span>
                {a.faceta || a.contexto ? <span className="inv-anuncio__concepto">{[a.faceta, a.contexto].filter(Boolean).join(' · ')}</span> : null}
                <p className="inv-anuncio__texto">{principal(a.textos)}</p>
                <div className="inv-anuncio__pie">
                  {a.editado ? <span className="inv-anuncio__editado">Corregido por ti</span> : <span />}
                  <Boton variante="secundario" tamano="chico" icono={PenLine} onClick={() => setEditando(i)}>
                    Editar
                  </Boton>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {actual && p ? (
        <ModalTextos
          variacion={{ v: editando + 1, plantilla: { id: actual.plantilla, nombre: p.nombre, campos: p.campos, textos: actual.textos } }}
          titulo={`Editar · ${p.nombre}`}
          descripcion="Escríbelo como lo quieres: tus anuncios de este producto usan este texto y la próxima investigación aprende de tu corrección."
          textoBoton="Guardar"
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </section>
  );
}
