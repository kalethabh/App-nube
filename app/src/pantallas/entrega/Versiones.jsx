// Las versiones del anuncio como tarjetas con un cuadro real de cada una (recortado donde van los
// subtítulos, así se ve la diferencia). Clic = verla en el reproductor. Las que faltan: "Preparando".
//
// La app entrega solo la completa (decisión de Diego, 2026-10-26): en vez de las otras versiones va un aviso que
// lleva al editor con Exportar abierto (#/anuncio/<slug>/editor?exportar=1), donde salen sin subtítulos, sin
// música o limpia. Un anuncio viejo que ya trae las otras las sigue mostrando, sin el aviso.
import { ArrowRight, Check, Download, Film, Scissors } from 'lucide-react';
import { Boton, Insignia, Tarjeta, TarjetaCabecera } from '../../componentes/index.js';
import { miniatura } from '../../datos/api.js';
import { duracion, tamano } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import { VERSION_ESPERADA } from './datos.js';

// Las versiones que la app ya no entrega (salen del editor). Si un anuncio trae alguna, es de antes.
const OTRAS = new Set(['solo-subtitulos', 'sin-subtitulos-sin-musica']);

/** "¿La quieres sin subtítulos o sin música?" según lo que tiene el anuncio (null si no hay nada que sacar). */
function preguntaDelEditor(haySubtitulos, conMusica) {
  if (haySubtitulos && conMusica) return '¿La quieres sin subtítulos o sin música?';
  if (haySubtitulos) return '¿La quieres sin subtítulos?';
  if (conMusica) return '¿La quieres sin música?';
  return null;
}

export function Versiones({ videos, esperadas = [], elegida, onElegir, segundo = 2, terminado = false, slug = null, editable = false, haySubtitulos = false, conMusica = false }) {
  const tipos = new Set(videos.map((v) => v.tipo));
  const faltan = esperadas.filter((t) => !tipos.has(t));
  const listas = videos.length;
  // solo la completa (lo nuevo): ninguna de las versiones que ahora salen del editor
  const soloLaCompleta = !videos.some((v) => OTRAS.has(v.tipo) || (v.tipo === 'sin-subtitulos' && tipos.has('con-subtitulos')));
  const pregunta = terminado && editable && slug && soloLaCompleta ? preguntaDelEditor(haySubtitulos, conMusica) : null;
  // con el anuncio terminado, la que falta ya no se está preparando: no salió (se exporta desde el editor)
  const subtitulo = faltan.length
    ? terminado
      ? `${listas} de ${listas + faltan.length} listas. ${faltan.length === 1 ? 'La que falta no salió' : 'Las que faltan no salieron'}: puedes exportarla${faltan.length === 1 ? '' : 's'} desde el editor.`
      : listas
        ? `${listas} de ${listas + faltan.length} listas; las demás se están preparando.`
        : 'Aparecen apenas termine el montaje.'
    : soloLaCompleta
      ? 'Lista para publicar.'
      : 'La completa para publicar y las demás para editar en CapCut.';

  return (
    <Tarjeta className="ent-versiones">
      <TarjetaCabecera icono={Film} titulo="Versiones" subtitulo={subtitulo} />
      <div className="ent-versiones__lista" role="listbox" aria-label="Elegir versión">
        {videos.map((v) => {
          const activa = v.archivo === elegida;
          return (
            <div key={v.archivo} className={`ent-version${activa ? ' ent-version--activa' : ''}`}>
              <button type="button" role="option" aria-selected={activa} className="ent-version__elegir" onClick={() => onElegir(v.archivo)}>
                <span className="ent-version__cuadro">
                  <img src={miniatura(v.url, 320, { segundo })} alt="" loading="lazy" decoding="async" draggable="false" />
                  {activa ? (
                    <span className="ent-version__viendo">
                      <Check size={12} strokeWidth={2.8} aria-hidden="true" /> Viendo
                    </span>
                  ) : null}
                </span>
                <span className="ent-version__textos">
                  <span className="ent-version__nombre">{v.nombre}</span>
                  <span className="ent-version__desc">{v.descripcion}</span>
                  <span className="ent-version__meta t-num">
                    {duracion(v.duracion)} · {tamano(v.tamano)}
                  </span>
                </span>
              </button>
              <Boton
                className="ent-version__bajar"
                variante="fantasma"
                tamano="chico"
                soloIcono
                icono={Download}
                etiqueta={`Descargar ${v.nombre}`}
                href={v.url}
                download={v.archivo}
              />
            </div>
          );
        })}
        {faltan.map((t) => {
          const info = VERSION_ESPERADA[t] || { nombre: t, descripcion: '' };
          return (
            <div key={t} className="ent-version ent-version--preparando" aria-disabled="true">
              <div className="ent-version__elegir">
                <span className="ent-version__cuadro ent-version__cuadro--vacio">
                  {terminado ? <Insignia estado="en-cola" variante="vidrio" tamano="chico" texto="No salió" /> : <Insignia estado="generando" variante="vidrio" tamano="chico" texto="Preparando" />}
                </span>
                <span className="ent-version__textos">
                  <span className="ent-version__nombre">{info.nombre}</span>
                  <span className="ent-version__desc">{info.descripcion}</span>
                  <span className="ent-version__meta">{terminado ? 'Sácala en el editor, en «Otras versiones»' : t === 'con-subtitulos' ? 'Sale al terminar el montaje' : 'Sale después de la completa'}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {pregunta ? (
        <div className="ent-versiones__editor">
          <span className="ent-versiones__editor-icono" aria-hidden="true">
            <Scissors size={16} strokeWidth={2} />
          </span>
          <div className="ent-versiones__editor-textos">
            <span className="ent-versiones__editor-titulo">{pregunta}</span>
            <span className="ent-versiones__editor-texto">Sácala en el editor: toca «Otras versiones», junto a «Descargar video», y elige la versión.</span>
          </div>
          <Boton variante="secundario" tamano="chico" iconoDerecha={ArrowRight} href={`${enlace.editor(slug)}?exportar=1`}>
            Sacarla en el editor
          </Boton>
        </div>
      ) : null}
    </Tarjeta>
  );
}
