// #/componentes — Guía de diseño interna: todas las piezas compartidas con sus variantes.
// Sirve para revisar el diseño de un vistazo. No aparece en el menú.
import { useState } from 'react';
import {
  Bell,
  Captions,
  Clapperboard,
  Download,
  Film,
  Link as IconoLink,
  Mic,
  Music,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Wand,
  Star,
} from 'lucide-react';
import {
  AreaTexto,
  BarraDeProgreso,
  Boton,
  CabeceraPagina,
  CampoTexto,
  Chip,
  ESTADOS,
  Esqueleto,
  EstadoVacio,
  Insignia,
  Interruptor,
  MiniaturaVideo,
  Modal,
  Pestanas,
  PuntoEstado,
  Seccion,
  Selector,
  Tarjeta,
  TarjetaCabecera,
  Tooltip,
  VistaPrevia,
  useAvisos,
} from '../../componentes/index.js';
import { miniatura, useAnuncios } from '../../datos/api.js';
import './componentes.css';

const COLORES = [
  ['Fondo', '--fondo-1'],
  ['Menú', '--fondo-2'],
  ['Superficie 1', '--superficie-1'],
  ['Superficie 2', '--superficie-2'],
  ['Superficie 3', '--superficie-3'],
  ['Superficie 4', '--superficie-4'],
  ['Azul Toma', '--acento'],
  ['Azul fuerte', '--acento-fuerte'],
  ['Cian Cabezal', '--cian'],
  ['Listo', '--ok'],
  ['Se arregló sola', '--aviso'],
  ['Te necesita / falló', '--error'],
  ['Texto 1', '--texto-1'],
  ['Texto 2', '--texto-2'],
  ['Texto 3', '--texto-3'],
  ['Texto 4', '--texto-4'],
];

const TIPOS = [
  ['Portada · 52', 't-portada', 'Tu anuncio, listo'],
  ['Título 1 · 38', 't-h1', 'Mis anuncios'],
  ['Título 2 · 30', 't-h2', 'En producción'],
  ['Título 3 · 24', 't-h3', 'Crema hidratante · Rutina de noche'],
  ['Título 4 · 20', 't-h4', 'Cambios rápidos'],
  ['Destacado · 17', 't-destacado', 'Todo lo que hiciste, lo que se está haciendo y lo que te necesita.'],
  ['Cuerpo · 15', 't-cuerpo', 'Cada imagen se revisa apenas llega y su video sale en ese momento.'],
  ['Interfaz · 14', '', 'Voz, música, imágenes, videos y montaje.'],
  ['Chico · 13', 't-chico', 'Hace 3 días · 3 versiones'],
  ['Etiqueta · 11', 't-etiqueta', 'En producción'],
  ['Mono · números', 't-mono t-num', '00:42.18  ·  0:56'],
];

export default function Componentes() {
  const { datos } = useAnuncios();
  const { aviso } = useAvisos();
  const [pestana, setPestana] = useState('medios');
  const [vista, setVista] = useState('cuadricula');
  const [interruptor, setInterruptor] = useState(true);
  const [modal, setModal] = useState(false);
  const [chips, setChips] = useState({ voz: true, hablado: false, cantado: false });
  const muestras = (datos?.anuncios || []).filter((a) => a.destacado && a.estado === 'listo').slice(0, 5);
  const enProduccion = (datos?.anuncios || []).find((a) => a.estado === 'en-produccion' && a.miniatura);

  return (
    <div className="pagina guia">
      <CabeceraPagina
        sobretitulo="Interno"
        titulo="Guía de diseño"
        descripcion="Las piezas compartidas de la app con todas sus variantes. Todo sale de src/estilos/tokens.css y src/componentes/."
        acciones={<VistaPrevia texto="Solo para revisar" explicacion="Esta página no aparece en el menú: es para ver todas las piezas juntas." />}
      />

      <Seccion titulo="Colores" descripcion="Grafito neutro para que brillen los videos, azul con degradado para la acción, cian para lo que se mueve.">
        <div className="guia__colores">
          {COLORES.map(([nombre, v]) => (
            <div key={v} className="guia__color">
              <span className="guia__muestra" style={{ background: `var(${v})` }} />
              <span className="guia__color-nombre">{nombre}</span>
              <span className="t-mini t-mono">{v}</span>
            </div>
          ))}
          <div className="guia__color">
            <span className="guia__muestra" style={{ background: 'var(--acento-boton)' }} />
            <span className="guia__color-nombre">Botón primario</span>
            <span className="t-mini t-mono">--acento-boton</span>
          </div>
          <div className="guia__color">
            <span className="guia__muestra" style={{ background: 'var(--marca-degradado)' }} />
            <span className="guia__color-nombre">Degradado de marca</span>
            <span className="t-mini t-mono">--marca-degradado</span>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Tipografía" descripcion="Bricolage Grotesque en títulos, Inter en la interfaz, Geist Mono en tiempos y números.">
        <Tarjeta>
          <div className="guia__tipos">
            {TIPOS.map(([nombre, clase, texto]) => (
              <div key={nombre} className="guia__tipo">
                <span className="t-mini">{nombre}</span>
                {clase.includes('t-h') || clase === 't-portada' ? <h3 className={clase}>{texto}</h3> : <p className={clase}>{texto}</p>}
              </div>
            ))}
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Botones" descripcion="Un primario por zona. El de marca, solo para el gran “Sí”.">
        <Tarjeta>
          <div className="pila" style={{ '--hueco': 'var(--e-5)' }}>
            <div className="fila fila--envolver">
              <Boton variante="primario" icono={Plus}>
                Nuevo anuncio
              </Boton>
              <Boton variante="secundario" icono={Download}>
                Descargar
              </Boton>
              <Boton variante="fantasma">Cancelar</Boton>
              <Boton variante="peligro" icono={Trash2}>
                Descartar
              </Boton>
              <Boton variante="primario" cargando>
                Guardando
              </Boton>
              <Boton variante="secundario" disabled>
                No disponible
              </Boton>
              <Tooltip texto="Botón solo con icono: siempre con etiqueta">
                <Boton variante="secundario" soloIcono icono={Bell} etiqueta="Avisos" />
              </Tooltip>
            </div>
            <div className="fila fila--envolver">
              <Boton variante="primario" tamano="chico" icono={Plus}>
                Chico
              </Boton>
              <Boton variante="primario" icono={Plus}>
                Normal
              </Boton>
              <Boton variante="primario" tamano="grande" icono={Plus}>
                Grande
              </Boton>
            </div>
            <div className="fila fila--envolver">
              <Boton variante="marca" tamano="grande" icono={Sparkles}>
                Producir 3 anuncios
              </Boton>
            </div>
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Estados" descripcion="Color + icono + texto, siempre. Sobre imágenes, la variante de vidrio.">
        <Tarjeta>
          <div className="pila" style={{ '--hueco': 'var(--e-5)' }}>
            <div className="fila fila--envolver">
              {Object.keys(ESTADOS).map((k) => (
                <Insignia key={k} estado={k} />
              ))}
            </div>
            <div className="fila fila--envolver">
              {Object.keys(ESTADOS).map((k) => (
                <Insignia key={k} estado={k} tamano="chico" />
              ))}
            </div>
            <div className="fila fila--envolver guia__sobre-imagen" style={muestras[0]?.miniatura ? { backgroundImage: `url(${miniatura(muestras[0].miniatura, 960)})` } : undefined}>
              {['generando', 'listo', 'arreglado', 'te-necesita', 'error'].map((k) => (
                <Insignia key={k} estado={k} variante="vidrio" />
              ))}
            </div>
            <div className="fila fila--envolver" style={{ '--hueco': '18px' }}>
              {['listo', 'generando', 'arreglado', 'te-necesita', 'error', 'en-cola'].map((k) => (
                <span key={k} className="fila t-chico" style={{ '--hueco': '8px' }}>
                  <PuntoEstado estado={k} /> {ESTADOS[k].texto}
                </span>
              ))}
            </div>
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Chips y filtros">
        <Tarjeta>
          <div className="pila" style={{ '--hueco': 'var(--e-4)' }}>
            <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
              <Chip activo={chips.voz} onClick={() => setChips((c) => ({ ...c, voz: !c.voz }))} icono={Mic} contador={6}>
                Voz en off
              </Chip>
              <Chip activo={chips.hablado} onClick={() => setChips((c) => ({ ...c, hablado: !c.hablado }))} icono={Captions} contador={4}>
                Hablado
              </Chip>
              <Chip activo={chips.cantado} onClick={() => setChips((c) => ({ ...c, cantado: !c.cantado }))} icono={Music} contador={2}>
                Cantado
              </Chip>
            </div>
            <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
              <Chip>Claymation</Chip>
              <Chip tono="acento" icono={Sparkles}>
                Recomendado
              </Chip>
              <Chip tono="cian">9:16</Chip>
              <Chip tono="ok" tamano="chico">
                Listo
              </Chip>
              <Chip tono="aviso" tamano="chico">
                Se arregló sola
              </Chip>
            </div>
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Progreso">
        <Tarjeta>
          <div className="rejilla" style={{ '--min': '240px', '--hueco': 'var(--e-6)' }}>
            <BarraDeProgreso etiqueta="Imágenes" valor={72} mostrarValor />
            <BarraDeProgreso etiqueta="Clips" valor={45} tono="cian" animada detalle="9 de 20" />
            <BarraDeProgreso etiqueta="Render" indeterminada tono="cian" />
            <BarraDeProgreso etiqueta="Listo" valor={100} tono="ok" grosor="fina" />
            <BarraDeProgreso etiqueta="Tu tanda" valor={64} tono="marca" grosor="gruesa" detalle="2 de 3 anuncios" />
            <BarraDeProgreso etiqueta="Algo falló" valor={100} tono="error" />
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Pestañas">
        <Tarjeta>
          <div className="pila" style={{ '--hueco': 'var(--e-6)' }}>
            <Pestanas
              activa={pestana}
              onCambio={setPestana}
              items={[
                { id: 'medios', etiqueta: 'Medios', icono: Film, contador: 30 },
                { id: 'musica', etiqueta: 'Música', icono: Music },
                { id: 'subtitulos', etiqueta: 'Subtítulos', icono: Captions },
                { id: 'estilo', etiqueta: 'Estilo', icono: Palette, deshabilitada: true },
              ]}
            />
            <Pestanas
              variante="segmentado"
              activa={vista}
              onCambio={setVista}
              items={[
                { id: 'cuadricula', etiqueta: 'Cuadrícula' },
                { id: 'lista', etiqueta: 'Lista' },
                { id: 'linea', etiqueta: 'Línea de tiempo' },
              ]}
            />
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Campos">
        <Tarjeta>
          <div className="rejilla" style={{ '--min': '260px', '--hueco': 'var(--e-5)' }}>
            <CampoTexto etiqueta="Link de tu página" icono={IconoLink} placeholder="https://tutienda.com/producto" ayuda="La IA la lee y llena la ficha." />
            <CampoTexto etiqueta="Nombre de la marca" placeholder="Como lo dice tu etiqueta" opcional />
            <Selector
              etiqueta="Duración"
              defaultValue="45"
              opciones={[
                { valor: '30', etiqueta: '30 segundos' },
                { valor: '45', etiqueta: '45 segundos' },
                { valor: '60', etiqueta: '60 segundos' },
              ]}
            />
            <CampoTexto etiqueta="Nombre del producto" defaultValue="" error="Falta el nombre: lo necesita el guion." />
            <AreaTexto etiqueta="Cuéntame" placeholder="El dolor, el público, el mercado y lo que quieres ver…" className="guia__ancho" />
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Interruptor">
        <Tarjeta>
          <div className="pila" style={{ '--hueco': 'var(--e-5)' }}>
            <Interruptor activado={interruptor} onCambio={setInterruptor} etiqueta="¿Deseas continuidad?" descripcion="Cada escena se transforma en la siguiente, sin cortes." />
            <Interruptor activado={false} deshabilitado etiqueta="Quitar subtítulos" descripcion="Deshabilitado" />
            <Interruptor activado tamano="chico" etiqueta="Chico" />
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Tarjetas">
        <div className="rejilla" style={{ '--min': '240px' }}>
          <Tarjeta>
            <TarjetaCabecera icono={Clapperboard} titulo="Normal" subtitulo="La superficie de siempre." />
          </Tarjeta>
          <Tarjeta variante="elevada">
            <TarjetaCabecera icono={Film} tono="cian" titulo="Elevada" subtitulo="Paneles flotantes y menús." />
          </Tarjeta>
          <Tarjeta variante="destacada">
            <TarjetaCabecera icono={Star} tono="acento" titulo="Destacada" subtitulo="Lo más importante de la pantalla." />
          </Tarjeta>
          <Tarjeta variante="contorno">
            <TarjetaCabecera icono={Plus} tono="neutro" titulo="Contorno" subtitulo="Lugares para agregar algo." />
          </Tarjeta>
          <Tarjeta interactiva tabIndex={0}>
            <TarjetaCabecera icono={Wand} titulo="Interactiva" subtitulo="Pasa el mouse." />
          </Tarjeta>
          <Tarjeta seleccionada>
            <TarjetaCabecera icono={Sparkles} titulo="Seleccionada" subtitulo="Lo que elegiste." />
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion titulo="Miniaturas de video" descripcion="Pasa el mouse: el video arranca sin sonido y la línea azul muestra cuánto va.">
        <div className="rejilla-videos" style={{ '--min': '170px' }}>
          {muestras.map((a, i) => (
            <MiniaturaVideo
              key={a.slug}
              imagen={a.miniatura}
              video={a.video}
              duracion={a.duracion}
              estilo={a.estiloNombre}
              titulo={a.titulo}
              subtitulo="Miniatura real"
              insignia={i === 0 ? <Insignia estado="listo" variante="vidrio" /> : i === 1 ? <Insignia estado="te-necesita" variante="vidrio" /> : null}
              seleccionada={i === 2}
            />
          ))}
          {enProduccion ? (
            <MiniaturaVideo
              imagen={enProduccion.miniatura}
              estilo={enProduccion.estiloNombre}
              titulo={enProduccion.titulo}
              subtitulo="En producción"
              insignia={<Insignia estado="generando" variante="vidrio" />}
              atenuada
            >
              <BarraDeProgreso valor={enProduccion.avance * 100} tono="cian" grosor="fina" animada />
            </MiniaturaVideo>
          ) : null}
          <MiniaturaVideo titulo="Sin imagen todavía" subtitulo="Estado de espera" estilo="Crochet" />
        </div>
      </Seccion>

      <Seccion titulo="Cargando">
        <Tarjeta>
          <div className="fila" style={{ alignItems: 'flex-start', '--hueco': 'var(--e-6)' }}>
            <div style={{ width: 120 }}>
              <Esqueleto forma="miniatura" />
            </div>
            <div className="pila" style={{ flex: 1, '--hueco': '12px' }}>
              <div className="fila">
                <Esqueleto forma="circulo" ancho={36} />
                <Esqueleto forma="texto" ancho="40%" />
              </div>
              <Esqueleto forma="texto" lineas={3} />
              <Esqueleto alto={42} ancho={160} />
            </div>
          </div>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Estado vacío">
        <div className="rejilla" style={{ '--min': '320px' }}>
          <EstadoVacio
            icono={Clapperboard}
            titulo="Todavía no tienes anuncios"
            descripcion="Cuéntale a la IA tu producto y en unos minutos tienes tu primer video."
            acciones={
              <Boton variante="primario" icono={Plus}>
                Nuevo anuncio
              </Boton>
            }
          />
          <EstadoVacio variante="compacto" icono={Music} tono="cian" titulo="Arrastra tu música aquí" descripcion="MP3 o WAV. Si es más corta que el anuncio, se repite." />
        </div>
      </Seccion>

      <Seccion titulo="Ventanas y avisos">
        <Tarjeta>
          <div className="fila fila--envolver">
            <Boton variante="secundario" onClick={() => setModal(true)}>
              Abrir ventana
            </Boton>
            <Boton variante="secundario" onClick={() => aviso({ tipo: 'ok', titulo: 'Exportado', texto: 'Tu video quedó en la carpeta de salida.' })}>
              Aviso listo
            </Boton>
            <Boton variante="secundario" onClick={() => aviso({ tipo: 'info', titulo: 'Generando los clips 11 a 15', texto: 'Te aviso cuando estén.' })}>
              Aviso info
            </Boton>
            <Boton variante="secundario" onClick={() => aviso({ tipo: 'aviso', titulo: 'Toma 7 se repitió sola', texto: 'La etiqueta salió ilegible la primera vez.' })}>
              Aviso arreglo
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => aviso({ tipo: 'error', titulo: 'No se pudo exportar', texto: 'Falta espacio en el disco.', accion: { etiqueta: 'Reintentar', alHacer: () => {} } })}
            >
              Aviso error
            </Boton>
            <Tooltip texto="Un globo de ayuda corto, nunca más de dos líneas.">
              <Boton variante="fantasma">Pasa el mouse</Boton>
            </Tooltip>
            <VistaPrevia />
          </div>
          <div style={{ marginTop: 'var(--e-5)' }}>
            <VistaPrevia variante="banda">Esta parte todavía no está conectada: cuando lo esté, aquí aparecen tus datos.</VistaPrevia>
          </div>
        </Tarjeta>
      </Seccion>

      <Modal
        abierto={modal}
        onCerrar={() => setModal(false)}
        icono={Wand}
        titulo="¿Rehacer la toma 7 con IA?"
        descripcion="La IA vuelve a generar ese clip con el mismo guion. Lo anterior queda guardado en el historial."
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setModal(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={() => setModal(false)}>
              Sí, rehacer
            </Boton>
          </>
        }
      >
        <div className="fila" style={{ '--hueco': '10px' }}>
          <Chip tono="cian" tamano="chico">
            Clip de 6 s
          </Chip>
          <span className="t-chico">Tarda un minuto y medio, más o menos</span>
        </div>
      </Modal>
    </div>
  );
}
