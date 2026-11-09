// Lo primero de «Nuevo anuncio» (#/nuevo sin nada más): qué quieres hacer.
//   - «Cambiar el producto» (una tarjeta más entre los estilos: con subtítulos y traducción) -> #/cambiar
//   - Un anuncio nuevo: se elige el estilo primero -> #/nuevo?estilo=<clave> (el estilo queda marcado en el paso 2)
//   - «Elegir el estilo después» -> #/nuevo?inicio=1 (el flujo de siempre)
import { Languages, Laugh, Repeat, Subtitles } from 'lucide-react';
import { CabeceraPagina, EsqueletoMiniaturas, MiniaturaVideo } from '../../componentes/index.js';
import { miniatura, useEstilos } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { disponible, iconoDe } from '../estilos/catalogo.js';
import '../estilos/estilos2.css';

export function Elegir() {
  const { datos, cargando } = useEstilos();
  const estilos = (datos?.estilos || []).filter((e) => e.clave === 'continuidad' || disponible(e.clave));
  const usar = (clave) => ir(clave === 'continuidad' ? rutas.nuevo({ estilo: 'estilo-pixar', continuidad: '1' }) : rutas.nuevo({ estilo: clave }));
  return (
    <div className="pagina nv">
      <CabeceraPagina titulo="Elige el tipo de anuncio" />

      <div className="nv-elegir__titulo">
        <span className="nv-elegir__paso">Paso 1 de 2 · tipo de anuncio</span>
        <a href={`#${rutas.nuevo({ inicio: '1' })}`}>Elegir después</a>
      </div>
      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={10} min={200} />
      ) : (
        <div className="es2-rejilla">
          <button type="button" className="miniatura miniatura--interactiva es2-tarjeta nv-tarjeta-cambiar" onClick={() => ir(rutas.cambiar())} aria-label="Usar Cambiar el producto">
            <div className="miniatura__marco nv-tarjeta-cambiar__marco" style={{ aspectRatio: '9 / 16' }}>
              <Repeat className="nv-tarjeta-cambiar__icono" size={42} strokeWidth={1.6} aria-hidden="true" />
              <span className="nv-tarjeta-cambiar__chips" aria-hidden="true">
                <span><Repeat size={12} /> Tu producto</span>
                <span><Subtitles size={12} /> Subtítulos</span>
                <span><Languages size={12} /> Traducción</span>
              </span>
            </div>
            <div className="miniatura__pie">
              <span className="miniatura__titulo">Cambiar el producto</span>
              <span className="miniatura__subtitulo">Un video que ya existe, con tu producto</span>
            </div>
          </button>
          <button type="button" className="miniatura miniatura--interactiva es2-tarjeta nv-tarjeta-cambiar" onClick={() => ir(rutas.sketch())} aria-label="Usar Sketch de comedia">
            <div className="miniatura__marco nv-tarjeta-cambiar__marco nv-tarjeta-sketch__marco" style={{ aspectRatio: '9 / 16' }}>
              <Laugh className="nv-tarjeta-cambiar__icono" size={42} strokeWidth={1.6} aria-hidden="true" />
              <span className="nv-tarjeta-cambiar__chips" aria-hidden="true">
                <span>Telenovela</span>
                <span>Con diálogo</span>
                <span>Sin narrador</span>
              </span>
            </div>
            <div className="miniatura__pie">
              <span className="miniatura__titulo">Sketch de comedia</span>
              <span className="miniatura__subtitulo">Telenovela que no parece anuncio</span>
            </div>
          </button>
          {estilos.map((e, i) => {
            const Icono = iconoDe(e.clave, e.familia);
            return (
              <MiniaturaVideo
                key={e.clave}
                className="es2-tarjeta"
                style={{ animationDelay: `${Math.min(i, 14) * 30}ms` }}
                imagen={e.muestra?.imagen ? miniatura(e.muestra.imagen, 480) : null}
                video={e.muestra?.video || null}
                titulo={e.nombre}
                subtitulo={e.lema}
                insignia={
                  <span className="es2-insignia">
                    <Icono size={13} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                }
                aria-label={`Usar ${e.nombre}`}
                onClick={() => usar(e.clave)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
