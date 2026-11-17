// "Tus lotes" de la portada (#/imagenes): arriba la fila "Tus productos" (TusProductos.jsx, para ver los de uno) y una
// cuadrícula que llena el ancho. Cada lote es un mosaico limpio de sus primeros cuadrados (los manda el servidor en
// `mosaico`; mientras se crea, abajo su barra cian) y debajo el producto, «N anuncios · 1:1 y 9:16» y su estado con la
// fecha ("Creándose · 4 de 8 imágenes listas", "Listo · hace 2 h"): la insignia no tapa la imagen. Lo que se está
// creando va primero, después lo que te necesita y después el resto, del más nuevo al más viejo. Un borrador (un lote
// que se creó pero no arrancó, nada pagado) se puede borrar.
import { useState } from 'react';
import { Images, Plus, Trash2 } from 'lucide-react';
import { BarraDeProgreso, Boton, Insignia, Modal, Seccion, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { CLAVE_LOTES, apiImagenes, miniaturaLote } from '../../datos/imagenes.js';
import { fechaRelativa, plural } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import { MOTORES } from '../ajustes/datos.js';

export const loteEnMarcha = (l) => l.estado === 'corriendo' || l.estado === 'esperando';
export const loteTeNecesita = (l) => l.estado === 'error' || (l.estado === 'pausado' && l.motivo !== 'detenido');

/** Lo que se está creando primero, después lo que te necesita y después el resto (del más nuevo al más viejo). */
export function ordenarLotes(lotes) {
  const prioridad = (l) => (loteEnMarcha(l) ? 0 : loteTeNecesita(l) ? 1 : 2);
  const reciente = (l) => Date.parse(l.actualizado || l.terminado || l.creado) || 0;
  return [...(lotes || [])].sort((a, b) => prioridad(a) - prioridad(b) || reciente(b) - reciente(a));
}

/**
 * La insignia de un lote: en la fila, creándose, listo o por qué está frenado (sin cifras).
 * `ia`: el nombre de la IA elegida; si el lote dice cuál lo espera (l.motor), esa.
 */
function InsigniaLote({ l, ia }) {
  const props = { tamano: 'chico' };
  if (l.estado === 'borrador') return <Insignia estado="borrador" texto="Sin empezar" {...props} />;
  if (l.estado === 'listo') return <Insignia estado="listo" {...props} />;
  if (l.estado === 'corriendo') return <Insignia estado="generando" texto="Creándose" {...props} />;
  if (l.estado === 'esperando') return <Insignia estado="en-cola" texto={l.motivo === 'limite-claude' ? `Espera a ${MOTORES[l.motor]?.nombre || ia}` : 'En la fila'} {...props} />;
  if (l.estado === 'pausado') return l.motivo === 'detenido' ? <Insignia estado="en-cola" texto="Detenido" {...props} /> : <Insignia estado="te-necesita" texto={l.motivo === 'saldo' ? 'Recarga tu saldo' : 'En pausa'} {...props} />;
  if (l.estado === 'error') return <Insignia estado="error" texto="Se trabó" {...props} />;
  return null;
}

/** Trozos que no se cortan por la mitad: si no entran en una línea, pasan enteros a la siguiente ("10 anuncios ·" y abajo "1:1 y 9:16"). */
function Trozos({ partes }) {
  const lista = partes.filter(Boolean);
  return lista.map((t, i) => (
    <span key={i}>
      <span className="img-lote__trozo">{i < lista.length - 1 ? `${t} ·` : t}</span>
      {i < lista.length - 1 ? ' ' : ''}
    </span>
  ));
}

/** "10 anuncios · 1:1 y 9:16" */
function queTiene(l) {
  const formatos = Array.isArray(l.formatos) && l.formatos.length ? l.formatos : ['1:1'];
  return [plural(Number(l.cantidad) || 0, 'anuncio', 'anuncios'), formatos.includes('9:16') ? '1:1 y 9:16' : 'solo 1:1'];
}

/** Al lado de la insignia: "4 de 8 imágenes listas" mientras se crea; si no, cuándo se hizo. */
function cuando(l) {
  if (loteEnMarcha(l) && Number(l.total)) return `${l.listas || 0} de ${l.total} imágenes listas`;
  const fecha = fechaRelativa(l.terminado || l.creado);
  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

/** Las imágenes del mosaico: las del servidor y, si es un lote de antes (sin `mosaico`), su portada. */
function imagenesDe(l) {
  if (Array.isArray(l.mosaico) && l.mosaico.length) return l.mosaico.slice(0, 4);
  return l.portada ? [miniaturaLote(l.portada, 480)] : [];
}

function Celda({ url, creando }) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  if (!url || fallo) return <span className={`img-mosaico__hueco${creando ? ' img-mosaico__hueco--creando' : ''}`} />;
  return (
    <span className="img-mosaico__celda">
      <img src={url} alt="" draggable="false" loading="lazy" decoding="async" className={cargada ? 'img-mosaico__img--cargada' : ''} onLoad={() => setCargada(true)} onError={() => setFallo(true)} />
    </span>
  );
}

/** El mosaico de un lote: 1, 2, 3 o 4 lugares según cuántos anuncios tiene; los que todavía no existen, vacíos. */
function Mosaico({ l }) {
  const imagenes = imagenesDe(l);
  const lugares = Math.max(1, Math.min(4, Number(l.cantidad) || imagenes.length || 1));
  const creando = loteEnMarcha(l);
  const avance = Number(l.total) ? (100 * (Number(l.listas) || 0)) / Number(l.total) : 0;
  const vacio = !imagenes.length;
  return (
    <span className={`img-mosaico img-mosaico--${lugares}${vacio ? ' img-mosaico--vacio' : ''}`}>
      {vacio ? (
        <span className={`img-mosaico__sin${creando ? ' img-mosaico__sin--creando' : ''}`}>
          <Images size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>{l.estado === 'borrador' ? 'No llegó a empezar' : creando ? 'Las imágenes aparecen aquí' : 'Todavía sin imágenes'}</span>
        </span>
      ) : (
        Array.from({ length: lugares }, (_, i) => <Celda key={i} url={imagenes[i]} creando={creando} />)
      )}
      {creando ? (
        <>
          <span className="img-mosaico__sombra" aria-hidden="true" />
          <span className="img-mosaico__avance">
            <BarraDeProgreso valor={avance} tono="cian" grosor="fina" animada />
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * filtro: con un producto elegido en "Tus productos", { nombre: «Crema Luna» o «Crema Luna · 5 nov», resumen }; o null.
 * crearMas: { href, texto }: el formulario con ese producto (el elegido, o el único que hay; null si ya no está).
 * productos: la fila de chips "Tus productos" (va arriba de la cuadrícula).
 */
export function TusLotes({ lotes, ia, simulando = false, filtro = null, crearMas = null, productos = null, recargar }) {
  const [borrar, setBorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const { aviso } = useAvisos();
  const sufijo = simulando ? '?simular=1' : '';

  const confirmarBorrar = async () => {
    if (simulando) {
      setBorrar(null);
      aviso({ tipo: 'info', titulo: 'En la simulación no se borra nada' });
      return;
    }
    setBorrando(true);
    try {
      await apiImagenes.borrar(borrar.lote);
      invalidar(CLAVE_LOTES);
      await recargar?.();
      aviso({ tipo: 'ok', titulo: borrar.estado === 'borrador' ? 'Borrador borrado' : 'Lote eliminado' });
      setBorrar(null);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude borrarlo', texto: e.message });
    } finally {
      setBorrando(false);
    }
  };

  return (
    <Seccion
      titulo="Tus lotes"
      icono={Images}
      contador={lotes.length || null}
      descripcion={filtro ? `Los de «${filtro.nombre}»: ${filtro.resumen}.` : 'Toca un lote para ver sus imágenes, descargarlas o regenerar alguna.'}
      acciones={
        crearMas ? (
          <Boton variante="secundario" tamano="chico" icono={Plus} href={crearMas.href} className="img-lotes__crear">
            {crearMas.texto}
          </Boton>
        ) : null
      }
      className="img-lotes-seccion"
      id="tus-lotes"
    >
      {productos}
      <div className="img-lotes escalonado" key={filtro?.nombre || 'todos'}>
        {lotes.map((l) => (
          <article key={l.lote} className={`img-lote${loteTeNecesita(l) ? ' img-lote--necesita' : ''}`}>
            <a className="img-lote__enlace" href={`${enlace.loteImagenes(l.lote)}${sufijo}`}>
              <Mosaico l={l} />
              <span className="img-lote__textos">
                <span className="img-lote__titulo t-recortar">{l.titulo || 'Tu lote'}</span>
                <span className="img-lote__detalle t-num">
                  <Trozos partes={queTiene(l)} />
                </span>
                <span className="img-lote__estado t-num">
                  <InsigniaLote l={l} ia={ia} />
                  <span className="img-lote__cuando">{cuando(l)}</span>
                </span>
              </span>
            </a>
            {!loteEnMarcha(l) ? (
              <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => setBorrar(l)} className="img-lote__borrar">
                {l.estado === 'borrador' ? 'Borrar' : 'Eliminar'}
              </Boton>
            ) : null}
          </article>
        ))}
      </div>
      <Modal
        abierto={Boolean(borrar)}
        onCerrar={() => (borrando ? null : setBorrar(null))}
        tamano="chico"
        icono={Trash2}
        tono="error"
        titulo={borrar?.estado === 'borrador' ? '¿Borrar este borrador?' : '¿Eliminar este lote?'}
        descripcion={
          borrar?.estado === 'borrador'
            ? 'Este lote no llegó a empezar: no se hizo ni se pagó nada. Se borra su carpeta y no se puede deshacer.'
            : `Sale de tus lotes${borrar?.listas ? ` con sus ${borrar.listas} ${borrar.listas === 1 ? 'imagen' : 'imágenes'}` : ''}. No se borra nada: queda guardado aparte (temp/_descartados) por si lo necesitas recuperar.`
        }
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setBorrar(null)} disabled={borrando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" icono={Trash2} cargando={borrando} onClick={confirmarBorrar}>
              {borrar?.estado === 'borrador' ? 'Sí, borrarlo' : 'Sí, eliminarlo'}
            </Boton>
          </>
        }
      />
    </Seccion>
  );
}
