// «Más imágenes en este lote» (2026-11-26i). Pedido: «que me permita generar más imágenes en ese lote y me permita
// seleccionar la cantidad», con las dos formas: anuncios NUEVOS (otras estructuras y otros ganchos) o VARIANTES de una
// imagen que eliges (mismo anuncio, otra modelo, pose, escena y luz). De 1 a 10; el costo se ve antes de confirmar.
// Las imágenes que ya tienes no cambian.
import { useEffect, useState } from 'react';
import { ImagePlus, Minus, Plus, Sparkles, Copy } from 'lucide-react';
import { Boton, Modal, Pestanas } from '../../componentes/index.js';
import { costoDelLote } from '../../datos/costo-lote.js';
import { dinero } from '../../datos/formato.js';
import { PIEZA_FINAL } from '../../datos/imagenes.js';

export const MAXIMO_MAS = 10;

export function ModalMas({ abierto, variaciones = [], baseInicial = null, formatos = 1, precio, ocupado = false, onCerrar, onConfirmar }) {
  const [modo, setModo] = useState('nuevos');
  const [cantidad, setCantidad] = useState(3);
  const [base, setBase] = useState(null);
  // las que se pueden variar: su cuadrado ya está y tiene imagen
  const elegibles = variaciones.filter((x) => x.piezas?.['1:1']?.url && PIEZA_FINAL.has(x.piezas['1:1'].estado) && x.piezas['1:1'].estado !== 'sin-imagen');
  useEffect(() => {
    if (!abierto) return;
    setModo(baseInicial ? 'variantes' : 'nuevos');
    setBase(baseInicial || null);
    setCantidad(baseInicial ? 2 : 3);
  }, [abierto, baseInicial]);

  const imagenes = cantidad * Math.max(1, formatos);
  const costo = costoDelLote(precio, imagenes);
  const falta = modo === 'variantes' && !base;
  const textoCosto = !costo ? 'Calculando el costo…' : costo.gratis || costo.max === 0 ? 'Sin costo por imagen (con tu ChatGPT)' : `Hasta ${dinero(costo.max)} · ${imagenes} ${imagenes === 1 ? 'imagen' : 'imágenes'}`;

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => (ocupado ? null : onCerrar())}
      icono={ImagePlus}
      titulo="Más imágenes en este lote"
      descripcion="Se suman a las que ya tienes, que no cambian."
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={ImagePlus} cargando={ocupado} disabled={falta || !costo} onClick={() => onConfirmar({ modo, cantidad, base: modo === 'variantes' ? base : null, imagenes })}>
            {`Crear ${cantidad} ${cantidad === 1 ? 'imagen' : 'imágenes'}`}
          </Boton>
        </>
      }
    >
      <div className="lote-mas">
        <Pestanas
          variante="segmentado"
          etiqueta="Qué imágenes"
          items={[
            { id: 'nuevos', etiqueta: 'Anuncios nuevos', icono: Sparkles },
            { id: 'variantes', etiqueta: 'Variantes de una imagen', icono: Copy },
          ]}
          activa={modo}
          onCambio={setModo}
        />
        <p className="t-chico t-3">
          {modo === 'nuevos'
            ? 'Anuncios distintos de los que ya tienes: otras estructuras ganadoras y otros ganchos, con tu mismo producto y tu oferta.'
            : 'Otra foto del mismo anuncio: mismo diseño, gancho y oferta, con otra modelo, otra pose, otra escena y otra luz.'}
        </p>
        {modo === 'variantes' ? (
          elegibles.length ? (
            <div className="lote-mas__bases" role="radiogroup" aria-label="La imagen de la que quieres variantes">
              {elegibles.map((x) => (
                <button
                  key={x.v}
                  type="button"
                  role="radio"
                  aria-checked={base === x.v}
                  className={`lote-mas__base${base === x.v ? ' lote-mas__base--activa' : ''}`}
                  onClick={() => setBase(x.v)}
                  title={x.titular || x.v}
                >
                  <img src={x.piezas['1:1'].miniatura || x.piezas['1:1'].url} alt="" loading="lazy" />
                  <span className="t-num">{x.v}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="t-chico">Todavía no hay imágenes listas para variar: espera a que termine alguna.</p>
          )
        ) : null}
        <div className="lote-mas__cantidad">
          <span className="t-chico">
            <strong>¿Cuántas?</strong> De 1 a {MAXIMO_MAS}
          </span>
          <div className="fila" style={{ '--hueco': '6px' }}>
            <Boton variante="secundario" tamano="chico" soloIcono icono={Minus} etiqueta="Una menos" onClick={() => setCantidad((n) => Math.max(1, n - 1))} disabled={cantidad <= 1 || ocupado} />
            <span className="lote-mas__numero t-num" aria-live="polite">
              {cantidad}
            </span>
            <Boton variante="secundario" tamano="chico" soloIcono icono={Plus} etiqueta="Una más" onClick={() => setCantidad((n) => Math.min(MAXIMO_MAS, n + 1))} disabled={cantidad >= MAXIMO_MAS || ocupado} />
          </div>
        </div>
        <p className="lote-mas__costo t-chico">
          {textoCosto}
          {formatos > 1 ? ` (cada una en sus ${formatos} tamaños)` : ''}
        </p>
      </div>
    </Modal>
  );
}
