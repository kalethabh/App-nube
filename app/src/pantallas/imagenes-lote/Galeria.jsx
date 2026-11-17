// La galería del lote: se va llenando mientras se crea, con cada imagen apenas existe. "Juntos" muestra cada
// variación con su cuadrado y su vertical; "Cuadrados" y "Verticales", solo esas. Arriba: "Descargar todo" (con logo,
// sin logo, con los prompts) y "Hacer otro lote".
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Images, Plus } from 'lucide-react';
import { Boton, EstadoVacio, Pestanas, Seccion, Tooltip } from '../../componentes/index.js';
import { PIEZA_FINAL, motorDelLote } from '../../datos/imagenes.js';
import { MOTORES, mayuscula, useMotor } from '../ajustes/datos.js';
import { TarjetaPieza, Variacion } from './Variacion.jsx';

/**
 * "Descargar todo": un menú chico con Con logo / Sin logo y la casilla "Incluir los prompts". "Con logo" baja solo las
 * que ya tienen su logo (`conSuLogo` de `conImagen`): mientras se crean, las demás todavía no lo tienen.
 */
function DescargarTodo({ conLogo, conSuLogo = 0, conImagen = 0, deshabilitado, urlDescarga, onSimulado }) {
  const [abierto, setAbierto] = useState(false);
  const [prompts, setPrompts] = useState(false);
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !caja.current?.contains(e.target) && setAbierto(false);
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        caja.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    requestAnimationFrame(() => caja.current?.querySelector('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const bajar = (logo) => {
    setAbierto(false);
    if (!urlDescarga) return onSimulado?.();
    // un enlace de descarga (el servidor manda el zip como adjunto: la pantalla no se va)
    const a = document.createElement('a');
    a.href = urlDescarga({ logo, prompts });
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // flechas arriba / abajo entre las opciones
  const alTeclado = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(caja.current?.querySelectorAll('[role^="menuitem"]') || [])];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const boton = (
    <Boton
      variante="secundario"
      icono={Download}
      iconoDerecha={ChevronDown}
      disabled={deshabilitado}
      aria-haspopup="menu"
      aria-expanded={abierto}
      onClick={() => setAbierto((x) => !x)}
    >
      Descargar todo
    </Boton>
  );

  return (
    <div className="lote-menu" ref={caja}>
      {deshabilitado ? (
        <Tooltip texto="Cuando haya imágenes, las bajas todas de una vez">
          <span>{boton}</span>
        </Tooltip>
      ) : (
        boton
      )}
      {abierto ? (
        <div className="lote-menu__lista" role="menu" aria-label="Descargar todo" onKeyDown={alTeclado}>
          {conLogo ? (
            <>
              <button type="button" role="menuitem" className="lote-menu__item" onClick={() => bajar(true)} disabled={!conSuLogo}>
                <Download size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  Con logo
                  <small>
                    {!conSuLogo
                      ? 'Todavía ninguna tiene su logo'
                      : conSuLogo < conImagen
                        ? `Solo las que ya tienen su logo (${conSuLogo} de ${conImagen})`
                        : 'Listas para publicar'}
                  </small>
                </span>
              </button>
              <button type="button" role="menuitem" className="lote-menu__item" onClick={() => bajar(false)}>
                <Download size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  Sin logo
                  <small>Las mismas imágenes, limpias</small>
                </span>
              </button>
            </>
          ) : (
            <button type="button" role="menuitem" className="lote-menu__item" onClick={() => bajar(false)}>
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              <span>
                Todas las imágenes
                <small>En un solo zip, ordenadas</small>
              </span>
            </button>
          )}
          <span className="lote-menu__separador" role="separator" />
          <button type="button" role="menuitemcheckbox" aria-checked={prompts} className="lote-menu__item lote-menu__item--casilla" onClick={() => setPrompts((x) => !x)}>
            <span className={`lote-menu__casilla${prompts ? ' lote-menu__casilla--si' : ''}`} aria-hidden="true">
              {prompts ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span>
              Incluir los prompts
              <small>Un texto por imagen, en su carpeta</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Galeria({ vista, variaciones, filtro, onFiltro, onAbrir, onRegenerar, onCopiar, onEscribir, escribiendo, enlaceOtro, urlDescarga, onDescargarSimulado, onEditarTextos, onPulir }) {
  // la IA que escribe los anuncios de este lote: la que lo hizo (si el servidor la manda) o la elegida
  const elegida = mayuscula(useMotor().nombre);
  const ia = MOTORES[motorDelLote(vista)]?.nombre || elegida;
  const conVertical = (vista.brief?.formatos || []).includes('9:16');
  const piezas = variaciones.flatMap((x) => Object.values(x.piezas || {}).filter(Boolean));
  const conImagen = piezas.filter((p) => p.url).length;
  const conSuLogo = piezas.filter((p) => p.url && p.urlSinLogo && p.url !== p.urlSinLogo).length; // con el logo ya pegado
  const cuadrados = variaciones.map((x) => x.piezas?.['1:1']).filter(Boolean);
  const verticales = variaciones.map((x) => x.piezas?.['9:16']).filter(Boolean);
  const cuadradoDe = new Map(variaciones.map((x) => [x.v, x.piezas?.['1:1']]));
  const vista_ = conVertical ? filtro : 'juntos';
  const listas = piezas.filter((p) => PIEZA_FINAL.has(p.estado) && p.url).length;

  const acciones = (
    <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
      <DescargarTodo conLogo={Boolean(vista.brief?.logo?.url)} conSuLogo={conSuLogo} conImagen={conImagen} deshabilitado={!conImagen} urlDescarga={urlDescarga} onSimulado={onDescargarSimulado} />
      <Boton variante="secundario" icono={Plus} href={enlaceOtro}>
        Hacer otro lote
      </Boton>
    </div>
  );

  let contenido;
  if (!variaciones.length) {
    contenido = (
      <EstadoVacio
        variante="compacto"
        icono={Images}
        tono="cian"
        titulo="Aquí aparece cada anuncio apenas se crea"
        descripcion="Primero la IA arma la estrategia y escribe los anuncios; después llegan las imágenes, una por una."
      />
    );
  } else if (vista_ === 'juntos') {
    contenido = (
      <div className={`rejilla lote-rejilla${conVertical ? ' lote-rejilla--doble' : ''}`}>
        {variaciones.map((x) => (
          <Variacion key={x.v} x={x} ia={ia} conVertical={conVertical} onAbrir={onAbrir} onRegenerar={onRegenerar} onCopiar={onCopiar} onEscribir={onEscribir} escribiendo={escribiendo} onEditarTextos={onEditarTextos} onPulir={onPulir} />
        ))}
      </div>
    );
  } else {
    const lista = vista_ === 'cuadrados' ? cuadrados : verticales;
    const formato = vista_ === 'cuadrados' ? '1:1' : '9:16';
    contenido = (
      <div className={`rejilla lote-rejilla lote-rejilla--${vista_}`}>
        {lista.map((p) => (
          <TarjetaPieza
            key={p.pieza}
            p={p}
            formato={formato}
            nombre={p.pieza.slice(0, p.pieza.indexOf('_'))}
            cuadrado={formato === '9:16' ? cuadradoDe.get(p.pieza.slice(0, p.pieza.indexOf('_'))) : null}
            onAbrir={onAbrir}
            onRegenerar={onRegenerar}
            onCopiar={onCopiar}
          />
        ))}
      </div>
    );
  }

  return (
    <Seccion titulo="Tus anuncios" icono={Images} contador={piezas.length ? `${listas} / ${piezas.length}` : null} acciones={acciones} className="lote-galeria">
      {conVertical && variaciones.length ? (
        <Pestanas
          variante="segmentado"
          etiqueta="Qué ver"
          items={[
            { id: 'juntos', etiqueta: 'Juntos' },
            { id: 'cuadrados', etiqueta: 'Cuadrados', contador: cuadrados.length },
            { id: 'verticales', etiqueta: 'Verticales', contador: verticales.length },
          ]}
          activa={filtro}
          onCambio={onFiltro}
          className="lote-galeria__filtro"
        />
      ) : null}
      {contenido}
    </Seccion>
  );
}
