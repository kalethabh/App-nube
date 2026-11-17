// «Tu lote»: el panel de la derecha de «Crear anuncios de imagen» (#/imagenes/nuevo). Queda fijo al bajar por el
// formulario (en pantallas angostas va abajo, después del último paso) y muestra lo que va a salir: la foto del
// producto elegido, cuántos anuncios, los tamaños, el logo y su posición, las referencias, el costo estimado (DISENO.md,
// regla 7, excepción 2) y el único botón, «Generar N anuncios». No calcula nada: todo le llega del formulario.
import { useState } from 'react';
import { Package } from 'lucide-react';
import { Boton, Tarjeta } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { AvisoMotor } from '../nuevo/piezas.jsx';
import { LineaCosto } from '../nuevo/CostoEstimado.jsx';

const VISIBLES = 4;

function Foto({ url, fondoClaro = true, className = '' }) {
  const [fallo, setFallo] = useState(false);
  return (
    <span className={`img-resumen__foto${fondoClaro ? ' img-resumen__foto--claro' : ''} ${className}`}>
      {url && !fallo ? <img src={url.startsWith('blob:') ? url : miniatura(url, 320)} alt="" draggable="false" onError={() => setFallo(true)} /> : <Package size={22} strokeWidth={1.8} aria-hidden="true" />}
    </span>
  );
}

function Fila({ etiqueta, children }) {
  return (
    <div className="img-resumen__fila">
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * producto: { nombre, foto, nueva } · cantidad: { valida, n, maximo } · conVertical · logo: { url, posicion } | null
 * referencias: [{ id, url, heic }] · costo: { rango, etiqueta, chica } | null · motor (useMotor) · fase · textoBoton
 */
export function ResumenLote({ producto, cantidad, conVertical, logo, referencias, plantillas = null, costo, motor, ocupado, fase, textoBoton, onGenerar }) {
  const { valida, n, maximo } = cantidad;
  const usadas = valida ? Math.min(n, referencias.length) : referencias.length;
  const sobran = referencias.length - VISIBLES;
  return (
    <aside className="img-resumen" aria-label="Tu lote">
      <Tarjeta variante="destacada" relleno="ninguno" className="img-resumen__tarjeta">
        <div className="img-resumen__producto">
          <Foto url={producto.foto} />
          <div className="img-resumen__producto-textos">
            <span className="img-resumen__sobre">Tu lote</span>
            <h2 className="img-resumen__nombre t-dos-lineas">{producto.nombre || 'Tu producto'}</h2>
            <span className="img-resumen__detalle">
              {producto.foto ? (producto.nueva ? 'Foto nueva: se guarda como producto al generar' : 'Con la foto que elegiste') : 'Elige tu producto o sube su foto'}
            </span>
          </div>
        </div>

        <dl className="img-resumen__lista">
          <Fila etiqueta="Anuncios">{valida ? <span className="t-num">{n === 1 ? '1 anuncio' : `${n} anuncios`}</span> : <span className="img-resumen__falta">Elige de 1 a {maximo}</span>}</Fila>
          <Fila etiqueta="Tamaños">
            <span className="img-resumen__formatos">
              <span className="img-resumen__forma img-resumen__forma--cuadrado" aria-hidden="true" />
              1:1
              {conVertical ? (
                <>
                  <span className="img-resumen__forma img-resumen__forma--vertical" aria-hidden="true" />
                  9:16
                </>
              ) : null}
            </span>
            <span className="img-resumen__nota t-num">{valida ? `${conVertical ? n * 2 : n} ${(conVertical ? n * 2 : n) === 1 ? 'imagen' : 'imágenes'}` : null}</span>
          </Fila>
          {/* (los lotes ya no llevan logo: solo se ve en los de antes) */}
          {logo ? (
          <Fila etiqueta="Logo">
            {logo ? (
              <span className="img-resumen__con-vista">
                <span className="img-resumen__logo" aria-hidden="true">
                  {logo.url ? <img src={logo.url} alt="" draggable="false" /> : null}
                </span>
                {logo.posicion}
              </span>
            ) : (
              <span className="img-resumen__falta">Sin logo</span>
            )}
          </Fila>
          ) : null}
          {plantillas ? (
            <Fila etiqueta="Formatos">
              <span>{plantillas.elegidas ? `${plantillas.elegidas} ${plantillas.elegidas === 1 ? 'elegido' : 'elegidos'}` : 'Que la app elija (mezcla)'}</span>
              {plantillas.escenas !== null ? <span className="img-resumen__nota t-num">{plantillas.escenas ? `${plantillas.escenas} con escena` : 'Todos gratis'}</span> : null}
            </Fila>
          ) : (
          <Fila etiqueta="Referencias">
            {referencias.length ? (
              <span className="img-resumen__con-vista">
                <span className="img-resumen__refs" aria-hidden="true">
                  {referencias.slice(0, VISIBLES).map((r) => (
                    <span key={r.id} className="img-resumen__ref">
                      {r.url && !r.heic ? <img src={r.url} alt="" draggable="false" /> : null}
                    </span>
                  ))}
                  {sobran > 0 ? <span className="img-resumen__ref img-resumen__ref--mas t-num">+{sobran}</span> : null}
                </span>
                <span className="t-num">{usadas < referencias.length ? `Se usan ${usadas} de ${referencias.length}` : referencias.length === 1 ? '1 referencia' : `${referencias.length} referencias`}</span>
              </span>
            ) : (
              <span className="img-resumen__falta">Ninguna: la IA elige los formatos</span>
            )}
          </Fila>
          )}
        </dl>

        <div className="img-resumen__accion">
          {costo ? (
            <LineaCosto rango={costo.rango} etiqueta={costo.etiqueta} className="img-resumen__costo">
              <p className="costo-linea__chica">{costo.chica}</p>
            </LineaCosto>
          ) : null}
          {motor.falta ? <AvisoMotor motor={motor} para="armar la estrategia, escribir cada anuncio y revisar tus imágenes" /> : null}
          {!costo ? <p className="t-chico t-3" role="status">Calculando el costo antes de generar…</p> : null}
          <Boton variante="marca" tamano="grande" bloque cargando={ocupado} disabled={!costo} onClick={onGenerar}>
            {fase || textoBoton}
          </Boton>
          <p className="img-resumen__pie">{plantillas ? 'Al generar confirmas el costo mostrado. La app dibuja los textos con tus colores y tus letras; después puedes cambiar cualquier texto gratis.' : 'Al generar confirmas el costo mostrado. Cada imagen sale de tu referencia y la foto de tu producto, con un título distinto.'}</p>
        </div>
      </Tarjeta>
    </aside>
  );
}
