import './Pagina.css';

/**
 * Cabecera grande de una pantalla (debajo de la barra superior).
 *   <CabeceraPagina sobretitulo="Tablero" titulo="Mis anuncios"
 *                   descripcion="Todo lo que hiciste, lo que se está haciendo y lo que te necesita."
 *                   acciones={<Boton variante="primario" icono={Plus} href="#/nuevo">Nuevo anuncio</Boton>} />
 */
export function CabeceraPagina({ sobretitulo, titulo, descripcion, acciones, extra, className = '' }) {
  return (
    <header className={`cabecera-pagina ${className}`}>
      <div className="cabecera-pagina__texto">
        {sobretitulo ? <span className="cabecera-pagina__sobre">{sobretitulo}</span> : null}
        {titulo ? <h1 className="cabecera-pagina__titulo">{titulo}</h1> : null}
        {descripcion ? <p className="cabecera-pagina__descripcion">{descripcion}</p> : null}
        {extra}
      </div>
      {acciones ? <div className="cabecera-pagina__acciones">{acciones}</div> : null}
    </header>
  );
}

/**
 * Bloque con título dentro de una pantalla.
 *   <Seccion titulo="En producción" contador={2} icono={LoaderCircle} acciones={…}>…</Seccion>
 */
export function Seccion({ titulo, descripcion, contador, icono: Icono, tono = 'acento', acciones, children, className = '', ...resto }) {
  return (
    <section className={`seccion ${className}`} {...resto}>
      {titulo || acciones ? (
        <div className="seccion__cabecera">
          <div className="seccion__textos">
            {titulo ? (
              <h2 className="seccion__titulo">
                {Icono ? (
                  <span className={`seccion__icono seccion__icono--${tono}`} aria-hidden="true">
                    <Icono size={15} strokeWidth={2.2} />
                  </span>
                ) : null}
                {titulo}
                {contador !== undefined && contador !== null ? <span className="seccion__contador t-num">{contador}</span> : null}
              </h2>
            ) : null}
            {descripcion ? <p className="seccion__descripcion">{descripcion}</p> : null}
          </div>
          {acciones ? <div className="seccion__acciones">{acciones}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
