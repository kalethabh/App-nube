// Lo primero de «Nuevo anuncio» (#/nuevo sin nada más): qué quieres hacer.
//   - Solo cambiar el producto de un video (con subtítulos y traducción) -> #/cambiar
//   - Un anuncio nuevo: se elige el estilo primero -> #/nuevo?estilo=<clave> (el estilo queda marcado en el paso 2)
//   - «Elegir el estilo después» -> #/nuevo?inicio=1 (el flujo de siempre)
import { ArrowRight, Languages, Repeat, Subtitles } from 'lucide-react';
import { CabeceraPagina, EsqueletoMiniaturas, MiniaturaVideo } from '../../componentes/index.js';
import { miniatura, useEstilos } from '../../datos/api.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { disponible, iconoDe } from '../estilos/catalogo.js';
import '../estilos/estilos2.css';

export function Elegir() {
  const { datos, cargando } = useEstilos();
  const estilos = (datos?.estilos || []).filter((e) => e.clave === 'continuidad' || disponible(e.clave));
  const usar = (clave) => ir(clave === 'continuidad' ? rutas.nuevo({ estilo: 'estilo-pixar', continuidad: '1' }) : rutas.nuevo({ estilo: clave }));
  return (
    <div className="pagina nv">
      <CabeceraPagina sobretitulo="Nuevo anuncio" titulo="¿Qué quieres hacer?" descripcion="Elige el estilo de tu anuncio, o cambia solo el producto de un video que ya existe." />

      <a className="nv-solo-cambiar" href={enlace.cambiar()}>
        <span className="nv-solo-cambiar__icono" aria-hidden="true">
          <Repeat size={24} strokeWidth={2} />
        </span>
        <span className="nv-solo-cambiar__texto">
          <strong>Solo cambiar el producto de un video</strong>
          <span>Subes el video y queda igual, pero con tu producto, la voz en español y subtítulos nuevos.</span>
          <span className="nv-solo-cambiar__chips">
            <span><Repeat size={13} aria-hidden="true" /> Tu producto</span>
            <span><Subtitles size={13} aria-hidden="true" /> Subtítulos</span>
            <span><Languages size={13} aria-hidden="true" /> Traducción</span>
          </span>
        </span>
        <ArrowRight className="nv-solo-cambiar__flecha" size={20} aria-hidden="true" />
      </a>

      <div className="nv-elegir__titulo">
        <h2>O elige el estilo de un anuncio nuevo</h2>
        <a href={`#${rutas.nuevo({ inicio: '1' })}`}>Elegir el estilo después</a>
      </div>
      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={10} min={200} />
      ) : (
        <div className="es2-rejilla">
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
