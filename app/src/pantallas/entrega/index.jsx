// ENTREGA (#/anuncio/:slug): el anuncio terminado.
//   Izquierda: el reproductor 9:16 grande con la versión elegida, Descargar y Abrir carpeta.
//   Derecha:   el anuncio, "Abrir en el editor" (lo destacado), las versiones, el informe en tres
//              apartados (decisiones, lo que salió mal, costo real), «Lo que notó la revisión» (una línea por pieza
//              con un enlace que la abre en el proceso para regenerarla: ./Avisos.jsx) y otros anuncios del mismo
//              producto.
// En los anuncios de la app, el informe sale de su informe.json (ver normalizarInforme en ./Informe.jsx) y,
// si se hizo en modo prueba, arriba va la banda "Modo prueba: no se gasta nada".
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Clapperboard, Download, FileText, FolderOpen, Images, LayoutGrid, Scissors, SearchX, Users } from 'lucide-react';
import {
  Boton,
  CabeceraPagina,
  Chip,
  Esqueleto,
  EstadoVacio,
  Insignia,
  MiniaturaVideo,
  Seccion,
  Tarjeta,
  Tooltip,
  useAvisos,
  useBarraSuperior,
} from '../../componentes/index.js';
import { conVersion, miniatura, useAnuncio, useAnuncios } from '../../datos/api.js';
import { enlace, enlaceDelGuion } from '../../datos/rutas.js';
import { duracion, fechaCompleta, fechaRelativa, idioma, mercado, tamano } from '../../datos/formato.js';
import { imagenesDistintas } from '../../datos/variantes.js';
import { tieneConductor, useConductor } from '../../datos/produccion.js';
import { BandaModoPrueba } from '../produccion/ModoPrueba.jsx';
import { Reproductor } from './Reproductor.jsx';
import { Versiones } from './Versiones.jsx';
import { MasGanchos } from './MasGanchos.jsx';
import { EnLaNube } from './EnLaNube.jsx';
import { Informe, normalizarInforme } from './Informe.jsx';
import { AvisosRevision } from './Avisos.jsx';
import { NOMBRE_CORTO, abrirCarpeta, useEntrega } from './datos.js';
import './entrega.css';

function Cargando() {
  return (
    <div className="ent">
      <div className="ent__izquierda">
        <Esqueleto forma="miniatura" className="ent__esqueleto-video" />
      </div>
      <div className="ent__derecha pila" style={{ '--hueco': 'var(--e-6)' }}>
        <Esqueleto forma="texto" ancho={160} alto={10} />
        <Esqueleto ancho="70%" alto={40} />
        <Esqueleto alto={120} />
        <Esqueleto alto={220} />
      </div>
    </div>
  );
}

function SinVideo({ a }) {
  const enGuion = a.estado === 'guion';
  return (
    <div className="ent-sinvideo">
      {a.miniatura ? <img src={miniatura(a.miniatura, 720)} alt="" className="ent-sinvideo__fondo" /> : null}
      <div className="ent-sinvideo__velo" />
      <EstadoVacio
        variante="sin-borde"
        icono={enGuion ? FileText : Clapperboard}
        tono="cian"
        titulo={enGuion ? 'Primero va el guion' : 'El video todavía no está armado'}
        descripcion={enGuion ? 'La producción empieza apenas lo apruebes.' : 'Cuando estén todas las piezas y termine el montaje, aparece aquí.'}
        acciones={
          enGuion ? (
            <Boton variante="secundario" icono={FileText} href={enlaceDelGuion(a.slug, a.productoId)}>
              Ver el guion
            </Boton>
          ) : (
            <Boton variante="secundario" icono={LayoutGrid} href={enlace.produccion(a.slug)}>
              Ver producción
            </Boton>
          )
        }
      />
    </div>
  );
}

export default function Entrega({ params }) {
  const { slug } = params;
  const { datos: a, cargando, error, recargar } = useAnuncio(slug);
  const { datos: entrega, cargando: cargandoInforme } = useEntrega(a ? slug : null);
  const informe = useMemo(() => normalizarInforme(entrega), [entrega]);
  // el conductor solo lo tienen los anuncios de la app: de ahí sale si se hizo en modo prueba
  const { datos: lista } = useAnuncios();
  const enLista = lista?.anuncios?.find((x) => x.slug === slug);
  const { datos: conductor } = useConductor(informe?.deLaApp || tieneConductor(enLista) ? slug : null);
  const modoPrueba = Boolean(informe?.modoPrueba || conductor?.modoPrueba);
  const { aviso } = useAvisos();
  const reproductor = useRef(null);
  const [elegida, setElegida] = useState(null);
  const [abriendo, setAbriendo] = useState(false);

  const videos = useMemo(() => (a?.versiones || []).filter((v) => v.clase === 'video'), [a]);
  // variantes del mismo producto que empiezan igual: otro cuadro de su video (ver src/datos/variantes.js)
  const otraImagen = useMemo(() => imagenesDistintas(informe?.hermanos || []), [informe]);
  const version = videos.find((v) => v.archivo === elegida) || videos.find((v) => v.principal) || videos[0] || null;
  const srt = (a?.versiones || []).filter((v) => v.clase === 'subtitulos');
  const listo = a?.estado === 'listo' && Boolean(version);
  // el guion todavía se escribe o espera tu aprobación: no se está produciendo nada
  const enGuion = a?.estado === 'guion';
  // un segundo con subtítulos en pantalla para comparar las versiones
  const segundoMuestra = useMemo(() => {
    const s = a?.plan?.subtitulos?.[1] || a?.plan?.subtitulos?.[0];
    return s ? Math.round(((s.inicio + s.fin) / 2) * 10) / 10 : 2;
  }, [a]);

  useBarraSuperior({
    migas: [{ texto: 'Mis anuncios', href: enlace.tablero() }, { texto: a?.titulo || (error ? 'No encontrado' : '…') }],
  });

  const irA = (seg) => {
    reproductor.current?.irA(seg);
    if (window.innerWidth < 1000) document.querySelector('.ent__izquierda')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const abrir = async (donde) => {
    setAbriendo(donde);
    try {
      await abrirCarpeta({ slug, donde, archivo: donde === 'videos' ? version?.archivo : undefined });
      aviso({
        tipo: 'ok',
        titulo: donde === 'videos' ? 'Abrí la carpeta de tus videos' : 'Abrí la carpeta del anuncio',
        texto: donde === 'videos' ? `Está marcado "${version?.archivo}". Mira la ventana del explorador.` : 'Ahí están las imágenes, los clips, la voz y la música.',
      });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude abrir la carpeta', texto: e.message });
    } finally {
      setAbriendo(false);
    }
  };

  if (error) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          icono={SearchX}
          tono="error"
          titulo="No encuentro este anuncio"
          descripcion={
            error.estado === 404
              ? 'Puede que su carpeta se haya movido o borrado. Todos tus anuncios están en Mis anuncios.'
              : error.message
          }
          acciones={
            <>
              <Boton variante="primario" href={enlace.tablero()}>
                Ir a Mis anuncios
              </Boton>
              <Boton variante="secundario" onClick={recargar}>
                Reintentar
              </Boton>
            </>
          }
        />
      </div>
    );
  }

  if (cargando || !a) {
    return (
      <div className="pagina">
        <Cargando />
      </div>
    );
  }

  const estiloTexto = [a.estiloNombre, a.familiaNombre].filter(Boolean).join(' · ');

  return (
    <div className="pagina">
      <div className="ent">
        {/* ------------------------------------------------ izquierda: el video */}
        <div className="ent__izquierda">
          <div className="ent__marco">
            {version ? (
              <Reproductor
                ref={reproductor}
                src={conVersion(version.url, version.fecha)}
                duracion={version.duracion || a.duracion}
                poster={miniatura(version.url, 720, { segundo: 1 })}
                etiqueta={NOMBRE_CORTO[version.tipo] || version.nombre}
              />
            ) : (
              <SinVideo a={a} />
            )}
          </div>
          <div className="ent__archivo">
            <Boton variante="secundario" icono={Download} href={version ? conVersion(version.url, version.fecha) : undefined} download={version?.archivo} disabled={!version} bloque>
              Descargar video
            </Boton>
            <Boton
              variante="secundario"
              icono={FolderOpen}
              onClick={() => abrir(version ? 'videos' : 'piezas')}
              cargando={abriendo === 'videos' || (!version && abriendo === 'piezas')}
              bloque
            >
              Abrir carpeta
            </Boton>
          </div>
          {version ? (
            <p className="ent__pie-video t-num">
              {version.nombre} · {duracion(version.duracion)} · {tamano(version.tamano)} · MP4 9:16
            </p>
          ) : null}
          {version ? (
            <Boton
              variante="fantasma"
              tamano="chico"
              icono={Images}
              className="ent__piezas"
              onClick={() => abrir('piezas')}
              cargando={abriendo === 'piezas'}
            >
              Carpeta de las imágenes y los clips
            </Boton>
          ) : null}
          {version ? (
            <Boton variante="fantasma" tamano="chico" icono={Users} className="ent__piezas" href={enlace.biblioteca({ desde: a.slug, ...(a.estilo ? { estilo: a.estilo } : {}) })}>
              Guardar sus personajes como avatar
            </Boton>
          ) : null}
          <EnLaNube slug={a.slug} alTraer={recargar} />
          {version ? <MasGanchos slug={a.slug} /> : null}

        </div>

        {/* ------------------------------------------------ derecha: el anuncio */}
        <div className="ent__derecha">
          <CabeceraPagina
            className="ent__cabecera"
            sobretitulo={estiloTexto}
            titulo={a.titulo}
            extra={
              <div className="ent__chips">
                {enGuion ? (
                  <Insignia estado={a.etapaApp === 'aprobar' ? 'te-necesita' : 'generando'} texto={a.etapaApp === 'aprobar' ? 'Guion para aprobar' : 'Escribiendo el guion'} />
                ) : (
                  <Insignia estado={a.estado === 'listo' ? 'listo' : a.estado === 'error' ? 'error' : 'en-produccion'} />
                )}
                {a.continuidad ? (
                  <Chip tamano="chico" tono="cian">
                    Continuidad
                  </Chip>
                ) : null}
                {version?.duracion || a.duracion ? <Chip tamano="chico">{duracion(version?.duracion || a.duracion)}</Chip> : null}
                {a.idioma ? <Chip tamano="chico">{idioma(a.idioma)}</Chip> : null}
                {a.mercado ? <Chip tamano="chico">{mercado(a.mercado)}</Chip> : null}
                <span className="ent__fecha">
                  {listo ? 'Terminado' : 'Empezado'} el {fechaCompleta(listo && informe?.terminado ? informe.terminado : a.fecha)}
                  {Date.now() - Date.parse(listo && informe?.terminado ? informe.terminado : a.fecha) < 7 * 86400000 ? ` · ${fechaRelativa(listo && informe?.terminado ? informe.terminado : a.fecha)}` : ''}
                </span>
              </div>
            }
          />

          {/* lo destacado: abrir en el editor */}
          <Tarjeta variante="elevada" className="ent-editar">
            <span className="ent-editar__icono" aria-hidden="true">
              <Scissors size={20} strokeWidth={2} />
            </span>
            <div className="ent-editar__textos">
              <h2 className="ent-editar__titulo">{listo ? '¿Quieres cambiar algo?' : enGuion ? 'Primero va el guion' : 'Todavía se está armando'}</h2>
              <p className="ent-editar__texto">
                {listo
                  ? 'Música, subtítulos, textos, la velocidad de un clip o tu propio video en su lugar, sin volver a generar el anuncio. Si un clip no te convence, lo regeneras ahí. Exportas ahí mismo.'
                  : enGuion
                    ? 'La producción empieza apenas apruebes el guion. Desde ahí todo es automático hasta los videos.'
                    : 'Cuando termine el montaje vas a poder retocar aquí la música, los subtítulos, los textos o un clip.'}
              </p>
            </div>
            <div className="ent-editar__acciones">
              {enGuion ? (
                <Boton variante="primario" tamano="grande" icono={FileText} iconoDerecha={ArrowRight} href={enlaceDelGuion(a.slug, a.productoId)}>
                  Ver el guion
                </Boton>
              ) : listo && a.tienePlan ? (
                <Boton variante="primario" tamano="grande" icono={Scissors} iconoDerecha={ArrowRight} href={enlace.editor(a.slug)}>
                  Abrir en el editor
                </Boton>
              ) : (
                <Tooltip texto="Se puede editar cuando el video esté armado.">
                  <Boton variante="primario" tamano="grande" icono={Scissors} disabled>
                    Abrir en el editor
                  </Boton>
                </Tooltip>
              )}
              {!enGuion ? (
                <Boton variante="fantasma" icono={LayoutGrid} href={enlace.produccion(a.slug)}>
                  Ver producción
                </Boton>
              ) : null}
            </div>
          </Tarjeta>

          <Versiones
            videos={videos}
            esperadas={informe?.versionesEsperadas || []}
            elegida={version?.archivo}
            onElegir={setElegida}
            segundo={segundoMuestra}
            terminado={a.estado === 'listo'}
            slug={a.slug}
            editable={listo && Boolean(a.tienePlan)}
            haySubtitulos={Boolean(a.plan?.subtitulos?.length)}
            conMusica={Boolean(a.plan?.musica?.archivo)}
          />
          {srt.length ? (
            <div className="ent__srt">
              {srt.map((s) => (
                <Boton key={s.archivo} variante="fantasma" tamano="chico" icono={Download} href={s.url} download={s.archivo}>
                  Subtítulos {s.nombre !== s.tipo ? `(${s.nombre})` : ''} .srt
                </Boton>
              ))}
            </div>
          ) : null}

          {modoPrueba ? <BandaModoPrueba className="ent-prueba">Este anuncio se hizo con los simuladores de tu PC: sus imágenes, videos, voz y música son de mentira.</BandaModoPrueba> : null}

          {informe ? (
            <Informe informe={{ ...informe, modoPrueba }} onIr={irA} terminado={a.estado === 'listo'} familia={conductor?.familia || a.produccion || a.familia || null} avisosAparte={Boolean(entrega?.avisos?.length)} />
          ) : cargandoInforme ? (
            <div className="pila" style={{ '--hueco': 'var(--e-4)' }}>
              <Esqueleto ancho={120} alto={22} />
              <Esqueleto alto={260} />
              <Esqueleto alto={180} />
            </div>
          ) : null}

          {/* lo que notó la revisión: una línea por pieza, con su enlace al proceso para regenerarla */}
          <AvisosRevision slug={a.slug} avisos={entrega?.avisos} onIr={irA} deLaApp={Boolean(informe?.deLaApp || conductor)} editable={listo && Boolean(a.tienePlan)} />

          {informe?.hermanos?.length ? (
            <Seccion titulo="Del mismo producto" contador={informe.hermanos.length} descripcion="Otros estilos y versiones que hiciste para esta marca.">
              <div className="rejilla-videos ent-hermanos" style={{ '--min': '140px' }}>
                {informe.hermanos.map((h) => (
                  <MiniaturaVideo
                    key={h.slug}
                    imagen={otraImagen.get(h.slug) || h.miniatura}
                    video={h.estado === 'listo' ? h.video : undefined}
                    duracion={h.estado === 'listo' ? h.duracion : undefined}
                    estilo={h.estado === 'listo' ? h.estiloNombre : undefined}
                    insignia={
                      h.estado === 'guion' ? (
                        <Insignia estado="te-necesita" variante="vidrio" texto="Guion" />
                      ) : h.estado !== 'listo' ? (
                        <Insignia estado="en-cola" variante="vidrio" texto="Sin terminar" />
                      ) : null
                    }
                    atenuada={h.estado !== 'listo'}
                    titulo={h.estiloNombre || h.titulo}
                    anchoImagen={320}
                    href={h.estado === 'guion' ? enlaceDelGuion(h.slug, h.productoId) : enlace.anuncio(h.slug)}
                  />
                ))}
              </div>
            </Seccion>
          ) : null}
        </div>
      </div>
    </div>
  );
}
