// Editor (#/editor, 2026-11-14): tus propios videos para editar. Subes uno («Editar un video tuyo») y se abre en el
// editor; los que ya preparaste quedan aquí para volver a abrirlos. Son los anuncios de estilo "video-propio".
import { Clapperboard, Scissors } from 'lucide-react';
import { AccionesAnuncio, CabeceraPagina, EsqueletoMiniaturas, EstadoVacio, MiniaturaVideo } from '../../componentes/index.js';
import { useAnuncios } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { BotonEditarVideo } from '../editor/EditarVideoPropio.jsx';

export default function EditorVideos() {
  const { datos, cargando, recargar } = useAnuncios({ cadaMs: 10000 });
  const videos = (datos?.anuncios || []).filter((a) => a.estilo === 'video-propio').sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  return (
    <div className="pagina">
      <CabeceraPagina
        titulo="Editor"
        descripcion="Sube cualquier video y edítalo: quita escenas, ponle textos, tu logo, subtítulos y música. Es gratis."
        acciones={<BotonEditarVideo variante="primario" />}
      />
      {cargando && !datos ? (
        <EsqueletoMiniaturas cantidad={4} />
      ) : videos.length ? (
        <div className="rejilla-videos" style={{ '--min': '196px' }}>
          {videos.map((a) => (
            <div key={a.slug} className="con-acciones">
              <MiniaturaVideo
                imagen={a.miniatura}
                video={a.video}
                duracion={a.duracion}
                estilo="Tu video"
                titulo={a.titulo}
                aria-label={`Editar ${a.titulo}`}
                href={enlace.editor(a.slug)}
              />
              {/* «Me funciona» (variantes ganadoras) y Eliminar */}
              <AccionesAnuncio slug={a.slug} titulo={a.titulo} funciona={Boolean(a.video)} onEliminado={recargar} />
            </div>
          ))}
        </div>
      ) : (
        <EstadoVacio
          icono={Clapperboard}
          titulo="Todavía no editaste videos tuyos"
          descripcion="Sube un video desde tu PC y se abre en el editor, dividido en escenas y con su audio."
          acciones={<BotonEditarVideo variante="primario" />}
        />
      )}
      <p className="t-chico" style={{ color: 'var(--texto-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Scissors size={14} aria-hidden="true" /> También puedes abrir aquí el video de «Cambiar el producto»: en su resultado, toca «Editar».
      </p>
    </div>
  );
}
