import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import './Boton.css';

/**
 * Botón de la app.
 *
 *   <Boton variante="primario" icono={Plus}>Nuevo anuncio</Boton>
 *   <Boton variante="fantasma" soloIcono icono={X} etiqueta="Cerrar" />
 *   <Boton variante="marca" tamano="grande">Producir 3 anuncios</Boton>
 *   <Boton href="#/ajustes">Ir a ajustes</Boton>         (se dibuja como <a>)
 *
 * variante: primario | secundario | fantasma | peligro | marca (solo para el gran "Producir N anuncios")
 * tamano:   chico (32) | normal (40) | grande (48)
 */
export const Boton = forwardRef(function Boton(
  {
    variante = 'secundario',
    tamano = 'normal',
    icono: Icono,
    iconoDerecha: IconoDerecha,
    cargando = false,
    bloque = false,
    soloIcono = false,
    etiqueta,
    href,
    children,
    className = '',
    type = 'button',
    disabled,
    ...resto
  },
  ref
) {
  const clases = [
    'boton',
    `boton--${variante}`,
    `boton--${tamano}`,
    bloque && 'boton--bloque',
    soloIcono && 'boton--solo-icono',
    cargando && 'boton--cargando',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const tam = tamano === 'chico' ? 15 : tamano === 'grande' ? 19 : 17;
  const contenido = (
    <>
      {cargando ? (
        <LoaderCircle size={tam} className="girando" aria-hidden="true" />
      ) : Icono ? (
        <Icono size={tam} strokeWidth={2} aria-hidden="true" />
      ) : null}
      {!soloIcono && children !== undefined && children !== null ? <span className="boton__texto">{children}</span> : null}
      {IconoDerecha && !soloIcono ? <IconoDerecha size={tam} strokeWidth={2} className="boton__der" aria-hidden="true" /> : null}
    </>
  );
  const accesible = soloIcono ? { 'aria-label': etiqueta || (typeof children === 'string' ? children : undefined) } : {};

  if (href && !disabled) {
    return (
      <a ref={ref} href={href} className={clases} {...accesible} {...resto}>
        {contenido}
      </a>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={clases}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...accesible}
      {...resto}
    >
      {contenido}
    </button>
  );
});
