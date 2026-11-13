// Panel derecho: "Cambios rápidos". Lo que se toca aquí se ve y se oye al instante en la vista previa
// sin generar nada. Lo único que vuelve a generar es Regenerar un clip (./AccionesClip.jsx): su costo va en su botón
// (los precios del motor); el costo del anuncio se ve en el informe de la entrega.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpDown,
  AudioLines,
  Baseline,
  Captions,
  CaptionsOff,
  Check,
  Clapperboard,
  Clock,
  Eye,
  Film,
  Lock,
  Music,
  PaintBucket,
  Palette,
  PencilLine,
  RotateCcw,
  ALargeSmall,
  Scissors,
  Snowflake,
  Trash2,
  TriangleAlert,
  Type,
  Upload,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import { Boton, CampoTexto, Interruptor, Tooltip } from '../../componentes/index.js';
import { codigoDeTiempo, duracion as formatoDuracion } from '../../datos/formato.js';
import { ESTILO_POR_ID } from './subtitulos/estilos.jsx';
import { FUENTES } from './subtitulos/fuentes.js';
import { Deslizador } from './piezas.jsx';
import { FUENTES_TEXTO, LUGAR_IMAGEN, LUGAR_TEXTO } from './modelo.js';
import { AccionesClip } from './AccionesClip.jsx';

const NOMBRES_COLOR = {
  '#E8442A': 'Coral',
  '#F5A524': 'Ámbar',
  '#2F7DE1': 'Azul',
  '#159A5B': 'Verde',
  '#B5279B': 'Magenta',
  '#E01E5A': 'Frambuesa',
  '#7B3FE4': 'Violeta',
  '#0FA3B1': 'Turquesa',
  '#D64500': 'Naranja',
  '#3B7A2A': 'Oliva',
  '#FFD43B': 'Amarillo',
};
const PALETA_RESPALDO = ['#E8442A', '#F5A524', '#2F7DE1', '#159A5B', '#B5279B', '#E01E5A', '#7B3FE4', '#0FA3B1', '#D64500', '#3B7A2A'];
NOMBRES_COLOR['#FFFFFF'] = 'Blanco';
NOMBRES_COLOR['#111111'] = 'Negro';
const coma = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
/** Lo más largo que puede ser un texto en pantalla (más que eso ya no se lee y no entra en el cuadro). */
const LARGO_TEXTO = 80;

/** Una fila de colores para elegir uno (con "Sin fondo" si se pide). */
function Colores({ etiqueta, icono: Icono, valor, opciones, onElegir, conNinguno = false, ocupado = null, motivoOcupado = '' }) {
  const actual = valor ? String(valor).toUpperCase() : null;
  // el color que ya usa la otra fila (letra o fondo): con los dos iguales el texto no se leería
  const fuera = ocupado ? String(ocupado).toUpperCase() : null;
  return (
    <div className="ed-control">
      <span className="ed-control__etiqueta">
        <Icono size={14} strokeWidth={2} aria-hidden="true" /> {etiqueta}
        <span className="ed-control__valor">{actual ? NOMBRES_COLOR[actual] || 'Propio' : 'Sin fondo'}</span>
      </span>
      <div className="ed-colores" role="radiogroup" aria-label={etiqueta}>
        {conNinguno ? (
          <button type="button" role="radio" aria-checked={!actual} aria-label="Sin fondo" title="Sin fondo" className={`ed-color ed-color--ninguno${!actual ? ' es-sel' : ''}`} onClick={() => onElegir(null)}>
            {!actual ? <Check size={12} strokeWidth={3.2} aria-hidden="true" /> : null}
          </button>
        ) : null}
        {opciones.map((c) => {
          const sel = c === actual;
          const bloqueado = !sel && c === fuera;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={sel}
              aria-label={NOMBRES_COLOR[c] || c}
              title={bloqueado ? motivoOcupado : NOMBRES_COLOR[c] || c}
              disabled={bloqueado}
              className={`ed-color${sel ? ' es-sel' : ''}`}
              data-claro={c === '#FFFFFF' || c === '#FFD43B' ? '' : undefined}
              style={{ '--c': c }}
              onClick={() => onElegir(c)}
            >
              {sel ? <Check size={12} strokeWidth={3.2} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Dividir y borrar lo que está elegido (los mismos de la línea de tiempo). */
function BotonesCorte({ acciones, borrar = 'Borrar', dividir = true }) {
  return (
    <div className="ed-botones-corte">
      {dividir ? (
        <Tooltip texto="Lo corta en dos donde está el cursor (Ctrl B)">
          <Boton variante="secundario" tamano="chico" icono={Scissors} onClick={acciones.dividir}>
            Dividir
          </Boton>
        </Tooltip>
      ) : null}
      <Tooltip texto="Se puede deshacer (Supr)">
        <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={acciones.borrar} disabled={!acciones.puedeBorrar}>
          {borrar}
        </Boton>
      </Tooltip>
    </div>
  );
}

/** El texto en pantalla elegido: qué dice, sus colores, tamaño, lugar y tipo de letra. */
function EditorTexto({ x, acciones, paleta }) {
  const campo = useRef(null);
  const id = x.id;
  const e = x.estilo;
  const ajustar = (cambios, etiqueta, grupo) => acciones.ajustarTexto(id, cambios, { etiqueta, grupo });
  // un texto recién agregado: el campo queda listo para escribir
  useEffect(() => {
    if (acciones.textoNuevoId !== id) return;
    const el = campo.current;
    if (el) {
      el.focus();
      el.select?.();
    }
  }, [acciones.textoNuevoId, id]);
  const colores = ['#FFFFFF', '#111111', ...paleta.filter((c) => c !== '#FFFFFF' && c !== '#111111')];
  const lado = (v) => (Math.abs(v - 0.5) < 0.02 ? 'Al centro' : v < 0.5 ? 'A la izquierda' : 'A la derecha');
  const altura = (v) => (v < 0.36 ? 'Arriba' : v < 0.62 ? 'Al centro' : 'Abajo');
  return (
    <>
      <CampoTexto ref={campo} etiqueta="Texto" value={x.texto} maxLength={LARGO_TEXTO} onChange={(ev) => ajustar({ texto: ev.target.value.slice(0, LARGO_TEXTO) }, 'Cambiar texto', `texto-${id}`)} ayuda="Se ve en mayúsculas. Corto se lee mejor." />
      <Colores etiqueta="Color de letra" icono={Baseline} valor={e.color} opciones={colores} ocupado={e.fondo} motivoOcupado="Es el color del fondo: no se leería" onElegir={(c) => ajustar({ color: c }, 'Color de letra')} />
      <Colores etiqueta="Fondo" icono={PaintBucket} valor={e.fondo} opciones={colores} conNinguno ocupado={e.color} motivoOcupado="Es el color de la letra: no se leería" onElegir={(c) => ajustar({ fondo: c }, c ? 'Color de fondo' : 'Texto sin fondo')} />
      <div className="ed-control">
        <span className="ed-control__etiqueta">
          <Type size={14} strokeWidth={2} aria-hidden="true" /> Tipo de letra
          <span className="ed-control__valor">{FUENTES_TEXTO.find((f) => f.id === e.fuente)?.nombre}</span>
        </span>
        <div className="ed-fuentes" role="radiogroup" aria-label="Tipo de letra">
          {FUENTES_TEXTO.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={e.fuente === f.id} className={`ed-fuente${e.fuente === f.id ? ' es-sel' : ''}`} onClick={() => ajustar({ fuente: f.id }, `Letra ${f.nombre}`)}>
              <span className="ed-fuente__muestra" style={{ fontFamily: FUENTES[f.id] }} aria-hidden="true">
                Aa
              </span>
              <span className="ed-fuente__nombre">{f.nombre}</span>
            </button>
          ))}
        </div>
      </div>
      <Deslizador icono={ALargeSmall} etiqueta="Tamaño" valor={e.tamano} min={0.6} max={1.8} porDefecto={1} onCambio={(v) => ajustar({ tamano: v }, 'Tamaño del texto', `tamano-${id}`)} />
      <Deslizador icono={ArrowUpDown} etiqueta="Altura" valor={e.y} min={0.05} max={0.85} porDefecto={LUGAR_TEXTO.y} formato={altura} onCambio={(v) => ajustar({ y: v }, 'Altura del texto', `y-${id}`)} />
      <Deslizador icono={ArrowLeftRight} etiqueta="Hacia los lados" valor={e.x} min={0.2} max={0.8} porDefecto={LUGAR_TEXTO.x} formato={lado} onCambio={(v) => ajustar({ x: Math.abs(v - 0.5) < 0.02 ? 0.5 : v }, 'Mover el texto a un lado', `x-${id}`)} />
      <p className="ed-nota">Arrástralo en el video para moverlo. Para que aparezca antes o después, arrastra el texto en la línea de tiempo; sus bordes cambian cuánto dura.</p>
    </>
  );
}

/** La imagen elegida: su tamaño y su lugar (también se mueve arrastrándola en el video). */
function EditorImagen({ x, acciones }) {
  const id = x.id;
  const e = x.imagenEstilo || {};
  const ajustar = (cambios, etiqueta, grupo) => acciones.ajustarTexto(id, cambios, { etiqueta, grupo });
  const pct = (v) => `${Math.round(v * 100)} %`;
  const lado = (v) => (Math.abs(v - 0.5) < 0.02 ? 'Al centro' : v < 0.5 ? 'A la izquierda' : 'A la derecha');
  const altura = (v) => (v < 0.36 ? 'Arriba' : v < 0.62 ? 'Al centro' : 'Abajo');
  return (
    <>
      {x.imagen ? <img className="ed-elegido__imagen" src={x.imagen} alt="" /> : null}
      <Deslizador icono={ALargeSmall} etiqueta="Tamaño" valor={e.ancho ?? LUGAR_IMAGEN.ancho} min={0.1} max={1.2} porDefecto={LUGAR_IMAGEN.ancho} formato={pct} onCambio={(v) => ajustar({ ancho: v }, 'Tamaño de la imagen', `ancho-${id}`)} />
      <Deslizador icono={ArrowUpDown} etiqueta="Altura" valor={e.y ?? LUGAR_IMAGEN.y} min={0} max={1} porDefecto={LUGAR_IMAGEN.y} formato={altura} onCambio={(v) => ajustar({ y: v }, 'Altura de la imagen', `y-${id}`)} />
      <Deslizador icono={ArrowLeftRight} etiqueta="Hacia los lados" valor={e.x ?? LUGAR_IMAGEN.x} min={0} max={1} porDefecto={LUGAR_IMAGEN.x} formato={lado} onCambio={(v) => ajustar({ x: Math.abs(v - 0.5) < 0.02 ? 0.5 : v }, 'Mover la imagen a un lado', `x-${id}`)} />
      <p className="ed-nota">Arrástrala en el video para ponerla donde quieras. Para que aparezca antes o después, muévela en la línea de tiempo; sus bordes cambian cuánto dura.</p>
    </>
  );
}

/**
 * Cómo se mueven los subtítulos al arrastrarlos en el video: todos juntos (como la Altura) o solo el que se arrastra.
 * Con `bloque` (un subtítulo elegido) también deja volverlo a donde van todos.
 */
function MoverSubtitulos({ acciones, ed, bloque = null }) {
  const movidos = Object.keys(ed.lugaresSubtitulos || {}).length;
  const propio = bloque !== null && ed.lugaresSubtitulos?.[bloque];
  return (
    <div className="ed-mover-sub">
      <Interruptor
        tamano="chico"
        activado={acciones.moverSoloEste}
        etiqueta="Mover solo el subtítulo que arrastro"
        descripcion={acciones.moverSoloEste ? 'Al arrastrar uno en el video, se mueve solo ese.' : 'Al arrastrar uno en el video, se mueven todos.'}
        onCambio={(v) => acciones.setMoverSoloEste(v)}
      />
      {propio ? (
        <Boton variante="fantasma" tamano="chico" icono={RotateCcw} onClick={() => acciones.lugarSubtitulo(bloque, null)}>
          Volver a donde van todos
        </Boton>
      ) : bloque === null && movidos ? (
        <Boton variante="fantasma" tamano="chico" icono={RotateCcw} onClick={() => acciones.lugarSubtitulo('todos', null)}>
          {movidos === 1 ? 'Volver el movido a su lugar' : `Volver los ${movidos} movidos a su lugar`}
        </Boton>
      ) : null}
    </div>
  );
}

/** Un tramo de la música: dónde suena, sus fundidos y desde qué segundo de la canción arranca. */
function EditorTramo({ tramo, musica, acciones }) {
  const ajustar = (cambios, etiqueta, grupo) => acciones.ajustarTramo(tramo.id, cambios, { etiqueta, grupo });
  const largo = tramo.hasta - tramo.desde;
  const tope = Math.max(0.5, Math.min(5, largo / 2));
  const segundos = (v) => `${coma(v)} s`;
  // una canción que no se repite tiene que alcanzar hasta el final de esta parte: no puede arrancar tan tarde
  const maxArranque = musica?.repetir ? Math.floor(musica.duracion - 2) : Math.floor((musica?.duracion || 0) - largo);
  return (
    <>
      <p className="ed-nota">
        Suena de {codigoDeTiempo(tramo.desde).replace(/\.\d+$/, '')} a {codigoDeTiempo(tramo.hasta).replace(/\.\d+$/, '')}. Arrástrala para que empiece antes o después; sus bordes la recortan.
      </p>
      <Deslizador icono={Music} etiqueta="Fundido de entrada" valor={tramo.fadeIn} min={0} max={tope} paso={0.1} porDefecto={0} formato={segundos} onCambio={(v) => ajustar({ fadeIn: v }, 'Fundido de entrada', `fi-${tramo.id}`)} />
      <Deslizador icono={Music} etiqueta="Fundido de salida" valor={tramo.fadeOut} min={0} max={tope} paso={0.1} porDefecto={0} formato={segundos} onCambio={(v) => ajustar({ fadeOut: v }, 'Fundido de salida', `fo-${tramo.id}`)} />
      {musica?.duracion > 4 && maxArranque >= 1 ? (
        <Deslizador
          icono={Clock}
          etiqueta="La canción arranca en"
          valor={Math.min(tramo.entrada, maxArranque)}
          min={0}
          max={maxArranque}
          paso={0.5}
          porDefecto={0}
          formato={(v) => formatoDuracion(v)}
          onCambio={(v) => ajustar({ entrada: v }, 'Dónde arranca la canción', `entrada-${tramo.id}`)}
        />
      ) : null}
    </>
  );
}

function Seccion({ icono: Icono, titulo, accion, children, id, resaltada }) {
  return (
    <section className={`ed-seccion${resaltada ? ' es-resaltada' : ''}`} id={id} aria-label={titulo}>
      <header className="ed-seccion__cabecera">
        <h3 className="ed-seccion__titulo">
          {Icono ? <Icono size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
          {titulo}
        </h3>
        {accion}
      </header>
      <div className="ed-seccion__cuerpo">{children}</div>
    </section>
  );
}

function Atajo({ icono: Icono, titulo, valor, onClick, activo, tono = 'acento', etiqueta, deshabilitado, onSoltar }) {
  const [encima, setEncima] = useState(false);
  return (
    <button
      type="button"
      className={`ed-atajo ed-atajo--${tono}${activo ? ' es-activo' : ''}${encima ? ' es-encima' : ''}`}
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta || titulo}
      onDragOver={
        onSoltar
          ? (e) => {
              e.preventDefault();
              setEncima(true);
            }
          : undefined
      }
      onDragLeave={onSoltar ? () => setEncima(false) : undefined}
      onDrop={
        onSoltar
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setEncima(false);
              onSoltar(e.dataTransfer.files?.[0]);
            }
          : undefined
      }
    >
      <span className="ed-atajo__icono" aria-hidden="true">
        <Icono size={16} strokeWidth={2} />
      </span>
      <span className="ed-atajo__textos">
        <span className="ed-atajo__titulo">{titulo}</span>
        <span className="ed-atajo__valor">{valor}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- lo que el usuario eligió en la línea de tiempo

function Elegido({ seleccion, pistas, subs, ed, cambiar, acciones, alCerrar, paleta }) {
  const campo = useRef(null);
  if (!seleccion) return null;
  const { pista, id } = seleccion;

  if (pista === 'subtitulos') {
    const b = subs.find((x) => x.id === id);
    if (!b) return null;
    const oculto = ed.ocultos.includes(id);
    return (
      <Seccion
        icono={Captions}
        titulo={`Subtítulo ${id + 1}`}
        resaltada
        accion={<span className="ed-seccion__dato t-mono">{codigoDeTiempo(b.inicio)}</span>}
      >
        <CampoTexto
          ref={campo}
          etiqueta="Texto"
          value={b.texto}
          onChange={(e) => {
            const texto = e.target.value;
            cambiar((s) => ({ ...s, correcciones: { ...s.correcciones, [id]: texto } }), { etiqueta: `Corregir subtítulo ${id + 1}`, grupo: `texto-${id}` });
          }}
          ayuda="Se ve al instante. Los tiempos de las palabras no se mueven."
        />
        <div className="ed-fila-entre">
          <Interruptor
            tamano="chico"
            activado={!oculto}
            etiqueta="Se ve en el video"
            onCambio={(v) => cambiar((s) => ({ ...s, ocultos: v ? s.ocultos.filter((x) => x !== id) : [...s.ocultos, id] }), { etiqueta: v ? 'Mostrar subtítulo' : 'Ocultar subtítulo' })}
          />
          {b.corregido ? (
            <Boton
              variante="fantasma"
              tamano="chico"
              icono={RotateCcw}
              onClick={() =>
                cambiar(
                  (s) => {
                    const c = { ...s.correcciones };
                    delete c[id];
                    return { ...s, correcciones: c };
                  },
                  { etiqueta: 'Volver al texto original' }
                )
              }
            >
              Original
            </Boton>
          ) : null}
        </div>
        {b.corregido ? (
          <p className="ed-nota">
            Decía: <q>{b.original}</q>
          </p>
        ) : null}
        <MoverSubtitulos acciones={acciones} ed={ed} bloque={id} />
      </Seccion>
    );
  }

  if (pista === 'video' || pista === 'broll') {
    const lista = pista === 'video' ? pistas.video : pistas.broll;
    const item = lista.find((x) => x.id === id);
    if (!item) return null;
    return (
      <Seccion icono={pista === 'video' ? Film : Clapperboard} titulo={item.nombre} resaltada accion={<span className="ed-seccion__dato t-mono">{codigoDeTiempo(item.inicio)}</span>}>
        <div className="ed-elegido">
          <img className="ed-elegido__foto" src={item.foto || item.miniatura} alt="" />
          <div className="ed-elegido__textos">
            {item.texto ? <q className="ed-elegido__cita">{item.texto}</q> : <span className="t-chico t-3">Sin frase asociada</span>}
            <span className="t-mini t-3">
              <Clock size={11} strokeWidth={2.2} aria-hidden="true" /> {formatoDuracion(item.fin - item.inicio)} en el anuncio
            </span>
          </div>
        </div>
        {item.quieto && !item.quitado ? (
          <p className="ed-nota ed-nota--aviso">
            <Snowflake size={13} strokeWidth={2.2} aria-hidden="true" />
            {/* (si lo causó tu velocidad o tu deslizado, el consejo es ese) */}
            {Number(item.ajuste?.desliza) > 0 || (item.velocidadPropia !== null && item.velocidadPropia !== undefined)
              ? `Se ve ${pista === 'video' ? 'quieta' : 'quieto'} ${coma(item.quieto)} s al final: con esa velocidad y ese deslizado, su clip no alcanza. Desliza menos o baja la velocidad.`
              : pista === 'video'
                ? `Se ve quieta ${coma(item.quieto)} s al final: su clip no alcanza. Acórtala o alarga la escena de al lado.`
                : `Se ve quieto ${coma(item.quieto)} s al final: su clip no alcanza. Acórtalo.`}
          </p>
        ) : null}
        {pista === 'video' ? (
          pistas.cortes?.tomas ? (
            <>
              <p className="ed-nota">Arrástrala para cambiarla de lugar; sus bordes la recortan y la escena de al lado se estira. La voz no se mueve.</p>
              <BotonesCorte acciones={acciones} borrar="Borrar escena" />
            </>
          ) : (
            <p className="ed-nota ed-nota--candado">
              <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
              {item.oculto ? 'Esta escena solo se oye: la tapa una imagen de apoyo.' : pistas.cortes?.motivo || 'Los cortes los pone la voz: esta escena dura lo que dura su frase.'}
            </p>
          )
        ) : (
          <Interruptor
            tamano="chico"
            activado={!item.quitado}
            deshabilitado={!item.removible}
            etiqueta="Se ve en el video"
            descripcion={
              !item.removible
                ? 'Tapa una escena que solo se oye: no se puede quitar.'
                : item.quietoSiLoQuitas
                  ? `${item.quitado ? 'Quitado: debajo se ve la escena' : 'Si lo quitas, se ve la escena que va debajo'}, y su clip no alcanza: queda quieta ${String(item.quietoSiLoQuitas).replace('.', ',')} s al final.`
                  : item.quitado
                    ? 'Quitado: debajo se ve la escena.'
                    : 'Si lo quitas, se ve la escena que va debajo.'
            }
            onCambio={(v) => cambiar((s) => ({ ...s, quitados: v ? s.quitados.filter((x) => x !== id) : [...s.quitados, id] }), { etiqueta: v ? `Volver a poner ${item.nombre}` : `Quitar ${item.nombre}` })}
          />
        )}
        {pista === 'broll' && item.editable ? <BotonesCorte acciones={acciones} borrar="Borrar" /> : null}
        {item.tipo !== 'reaccion' && item.clip ? <AccionesClip item={item} acciones={acciones} slug={acciones.slug} /> : null}
      </Seccion>
    );
  }

  if (pista === 'textos') {
    const x = pistas.textos.find((y) => y.id === id);
    if (!x) return null;
    if (x.archivo) {
      return (
        <Seccion icono={Type} titulo="Tu imagen" resaltada accion={<span className="ed-seccion__dato t-mono">{codigoDeTiempo(x.inicio)}</span>}>
          <EditorImagen key={id} x={x} acciones={acciones} />
          <BotonesCorte acciones={acciones} dividir={false} borrar="Borrar imagen" />
        </Seccion>
      );
    }
    if (x.fijo) {
      return (
        <Seccion icono={Type} titulo={x.tipo === 'icono' ? 'Icono en pantalla' : 'Texto en pantalla'} resaltada accion={<span className="ed-seccion__dato t-mono">{codigoDeTiempo(x.inicio)}</span>}>
          <p className="ed-elegido__cita ed-elegido__cita--grande">{x.texto}</p>
          <p className="ed-nota">Lo pone el estilo de este anuncio en el momento justo.</p>
        </Seccion>
      );
    }
    return (
      <Seccion
        icono={Type}
        titulo={x.tipo === 'sugerido' ? 'Texto sugerido' : 'Tu texto'}
        resaltada
        accion={
          x.tipo === 'sugerido' && x.editado ? (
            <Tooltip texto="Vuelve a su texto, su aspecto y su momento">
              <Boton variante="fantasma" tamano="chico" icono={RotateCcw} onClick={() => acciones.restablecerTexto(id)}>
                Como venía
              </Boton>
            </Tooltip>
          ) : (
            <span className="ed-seccion__dato t-mono">{codigoDeTiempo(x.inicio)}</span>
          )
        }
      >
        {x.tipo === 'sugerido' ? (
          <Interruptor
            tamano="chico"
            activado={x.visible}
            etiqueta="Se ve en el video"
            descripcion="Lo sugirió la IA al escribir el guion. En el video entregado no va."
            onCambio={(v) => cambiar((s) => ({ ...s, textos: v ? [...s.textos, id] : s.textos.filter((y) => y !== id) }), { etiqueta: v ? 'Mostrar texto' : 'Ocultar texto' })}
          />
        ) : null}
        <EditorTexto key={id} x={x} acciones={acciones} paleta={paleta} />
        {x.visible ? <BotonesCorte acciones={acciones} dividir={false} borrar={x.tipo === 'sugerido' ? 'Quitar del video' : 'Borrar texto'} /> : null}
      </Seccion>
    );
  }

  if (pista === 'musica') {
    const tramo = (pistas.tramosMusica || []).find((y) => y.id === id);
    if (!tramo || !pistas.musica) return null;
    const varios = pistas.tramosMusica.length > 1;
    return (
      <Seccion icono={Music} titulo={varios ? `Música · parte ${pistas.tramosMusica.indexOf(tramo) + 1}` : 'Música'} resaltada accion={<span className="ed-seccion__dato t-mono">{codigoDeTiempo(tramo.desde)}</span>}>
        <EditorTramo tramo={tramo} musica={pistas.musica} acciones={acciones} />
        <BotonesCorte acciones={acciones} borrar={varios ? 'Borrar esta parte' : 'Quitar la música'} />
      </Seccion>
    );
  }

  if (pista === 'voz') {
    const s = pistas.voz.segmentos.find((x) => x.id === id);
    return (
      <Seccion icono={AudioLines} titulo={pistas.voz.modo === 'cancion' ? 'Canción' : s?.habla ? `Voz · habla ${s.habla}` : 'Voz'} resaltada accion={<Boton variante="fantasma" tamano="chico" onClick={alCerrar}>Listo</Boton>}>
        {s?.texto ? <q className="ed-elegido__cita">{s.texto}</q> : null}
        <p className="ed-nota ed-nota--candado">
          <Lock size={13} strokeWidth={2.2} aria-hidden="true" />
          {pistas.voz.modo === 'cancion' ? 'La canción no se corta ni se mueve: el video la sigue.' : 'La voz no se corta ni se mueve: todo el anuncio la sigue. Su volumen sí lo cambias abajo.'}
        </p>
      </Seccion>
    );
  }
  return null;
}

// ---------------------------------------------------------------- el panel

export function PanelCambios({ plan, pistas, subs, ed, cambiar, seleccion, onSeleccionar, acciones, colorAnuncio, enfoque, hayCambios }) {
  const [resaltar, setResaltar] = useState(null);
  const cuerpo = useRef(null);
  const estilo = ESTILO_POR_ID[ed.subtitulos.estilo] || ESTILO_POR_ID.caja;
  const e = plan.estiloSubtitulos || {};
  const paleta = [...new Set([...(e.coloresResaltado || PALETA_RESPALDO).map((c) => c.toUpperCase()), '#FFD43B'])];
  const colorActual = (ed.subtitulos.color || estilo.colorPropio || e.colorResaltado || '#E8442A').toUpperCase();
  const alturaBase = e.desdeAbajo ?? 0.26;
  const altura = ed.subtitulos.altura ?? alturaBase;
  const musica = pistas.musica;
  const esCancion = pistas.voz?.modo === 'cancion';
  const hayVoz = pistas.voz?.segmentos?.length > 0;
  const haySubtitulos = subs.length > 0;
  const actual = seleccion?.pista === 'musica' || seleccion?.pista === 'voz' ? 'sonido' : null;

  // los atajos de "Volumen" y "Cambiar música" llevan al bloque de Sonido
  useEffect(() => {
    if (!enfoque) return undefined;
    const el = cuerpo.current?.querySelector(`#ed-${enfoque.seccion}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setResaltar(enfoque.seccion);
    const id = setTimeout(() => setResaltar(null), 1400);
    return () => clearTimeout(id);
  }, [enfoque]);

  // valores cortos: en una línea al lado del título, sin cortarse (también a 1280 de ancho)
  const nombreMusica = esCancion ? 'Es la canción' : musica ? (musica.falta ? 'Falta tu canción' : musica.nombre === 'Música del anuncio' ? 'La del anuncio' : musica.nombre) : 'Sin música';

  return (
    <aside className="ed-panel ed-panel--cambios" aria-label="Cambios rápidos">
      <header className="ed-panel__cabecera">
        <div>
          <h2 className="ed-panel__titulo">Cambios rápidos</h2>
          <p className="ed-panel__bajada">Se ven y se oyen al instante</p>
        </div>
        {hayCambios ? (
          <Tooltip texto="Vuelve todo a como te lo entregamos (se puede deshacer)" lado="abajo">
            <Boton variante="fantasma" tamano="chico" icono={RotateCcw} onClick={acciones.volverAlOriginal}>
              Original
            </Boton>
          </Tooltip>
        ) : null}
      </header>

      <div className="ed-panel__cuerpo" ref={cuerpo}>
        <div className="ed-atajos">
          <Atajo icono={Captions} titulo="Estilo de subtítulos" valor={estilo.nombre} onClick={acciones.abrirGaleria} deshabilitado={!haySubtitulos} />
          <Atajo
            icono={Music}
            tono="musica"
            titulo="Cambiar música"
            valor={nombreMusica}
            onClick={acciones.pedirMusica}
            onSoltar={esCancion ? undefined : acciones.usarArchivo}
            deshabilitado={esCancion}
            etiqueta="Cambiar música: elige o arrastra tu canción"
          />
          <Atajo icono={PencilLine} tono="subtitulos" titulo="Corregir palabra" valor="La que suena" onClick={acciones.corregirActual} deshabilitado={!haySubtitulos} />
          <Atajo icono={Volume2} tono="voz" titulo="Volumen" valor={`${esCancion ? 'Canción' : 'Voz'} ${Math.round(ed.voz.volumen * 100)} %${musica && !esCancion ? ` · Música ${Math.round(ed.musica.volumen * 100)} %` : ''}`} onClick={() => acciones.enfocar('sonido')} />
          <Atajo
            icono={ed.subtitulos.visible ? CaptionsOff : Captions}
            tono="neutro"
            titulo={ed.subtitulos.visible ? 'Quitar subtítulos' : 'Poner subtítulos'}
            valor={ed.subtitulos.visible ? 'Hoy se ven' : 'Ahora no se ven'}
            activo={!ed.subtitulos.visible}
            onClick={acciones.alternarSubtitulos}
            deshabilitado={!haySubtitulos}
          />
          {acciones.rehacerDisponible ? <Atajo icono={WandSparkles} tono="ia" titulo="¿Qué salió mal?" valor="Regenera el clip que se ve" onClick={() => acciones.abrirRehacer()} /> : null}
        </div>

        <Elegido seleccion={seleccion} pistas={pistas} subs={subs} ed={ed} cambiar={cambiar} acciones={acciones} alCerrar={() => onSeleccionar(null)} paleta={paleta} />

        {haySubtitulos ? (
          <Seccion
            icono={Captions}
            titulo="Subtítulos"
            id="ed-subtitulos"
            resaltada={resaltar === 'subtitulos'}
            accion={<Interruptor tamano="chico" activado={ed.subtitulos.visible} onCambio={acciones.alternarSubtitulos} etiqueta={<span className="visualmente-oculto">Mostrar subtítulos</span>} />}
          >
            <button type="button" className="ed-estilo-actual" onClick={acciones.abrirGaleria}>
              <span className="ed-estilo-actual__muestra" style={{ '--c': colorActual }} aria-hidden="true">
                Aa
              </span>
              <span className="ed-estilo-actual__textos">
                <span className="ed-estilo-actual__nombre">{estilo.nombre}</span>
                <span className="ed-estilo-actual__lema">{estilo.id === 'caja' ? 'El de siempre' : estilo.lema}</span>
              </span>
              <span className="ed-estilo-actual__ir">Ver los 10</span>
            </button>

            <div className="ed-control">
              <span className="ed-control__etiqueta">
                <Palette size={14} strokeWidth={2} aria-hidden="true" /> Color
                <span className="ed-control__valor">{NOMBRES_COLOR[colorActual] || 'Propio'}</span>
              </span>
              <div className="ed-colores" role="radiogroup" aria-label="Color de los subtítulos">
                {paleta.map((c) => {
                  const sel = c === colorActual;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      aria-label={NOMBRES_COLOR[c] || c}
                      title={NOMBRES_COLOR[c] || c}
                      className={`ed-color${sel ? ' es-sel' : ''}`}
                      style={{ '--c': c }}
                      onClick={() => cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, color: c } }), { etiqueta: `Color ${NOMBRES_COLOR[c] || ''}`.trim() })}
                    >
                      {sel ? <Check size={12} strokeWidth={3.2} aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <Deslizador
              icono={ALargeSmall}
              etiqueta="Tamaño"
              valor={ed.subtitulos.tamano}
              min={0.7}
              max={1.4}
              porDefecto={1}
              onCambio={(v) => cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, tamano: v } }), { etiqueta: 'Tamaño de subtítulos', grupo: 'tamano-sub' })}
              ayuda="Si crecen mucho, pasan solos a dos líneas para no salirse."
            />
            <Deslizador
              icono={ArrowUpDown}
              etiqueta="Altura"
              valor={altura}
              min={0.1}
              max={0.6}
              porDefecto={alturaBase}
              formato={(v) => (Math.abs(v - alturaBase) < 0.005 ? 'Como siempre' : v > alturaBase ? 'Más arriba' : 'Más abajo')}
              onCambio={(v) => cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, altura: Math.abs(v - alturaBase) < 0.005 ? null : v } }), { etiqueta: 'Altura de subtítulos', grupo: 'altura-sub' })}
              ayuda={
                altura < 0.2 ? (
                  <span className="ed-aviso-chico">
                    <TriangleAlert size={12} strokeWidth={2.4} aria-hidden="true" /> Muy abajo: el botón de Meta puede taparlos.
                  </span>
                ) : (
                  'Por encima de la zona donde Meta pone su botón.'
                )
              }
            />
            <Deslizador
              icono={ArrowLeftRight}
              etiqueta="Hacia los lados"
              valor={Number(ed.subtitulos.lado) || 0}
              min={-0.35}
              max={0.35}
              porDefecto={0}
              formato={(v) => (Math.abs(v) < 0.01 ? 'Al centro' : v < 0 ? 'A la izquierda' : 'A la derecha')}
              onCambio={(v) => cambiar((s) => ({ ...s, subtitulos: { ...s.subtitulos, lado: Math.abs(v) < 0.01 ? 0 : v } }), { etiqueta: 'Subtítulos a un lado', grupo: 'lado-sub' })}
            />
            <MoverSubtitulos acciones={acciones} ed={ed} />
            <p className="ed-nota">También puedes arrastrarlos en el video.</p>
          </Seccion>
        ) : null}

        <Seccion icono={Volume2} titulo="Sonido" id="ed-sonido" resaltada={resaltar === 'sonido' || actual === 'sonido'}>
          {hayVoz ? (
            <Deslizador
              icono={AudioLines}
              etiqueta={esCancion ? 'Canción' : pistas.voz.modo === 'en-clips' ? 'Voz de los personajes' : 'Voz en off'}
              valor={ed.voz.silenciada ? 0 : ed.voz.volumen}
              porDefecto={1}
              extra={
                <Tooltip texto={esCancion ? 'La canción no se corta ni se mueve' : 'La voz no se corta ni se mueve: solo cambias su volumen'}>
                  <span className="ed-candado" tabIndex={0}>
                    <Lock size={11} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                </Tooltip>
              }
              onCambio={(v) => cambiar((s) => ({ ...s, voz: { ...s.voz, volumen: v, silenciada: false } }), { etiqueta: 'Volumen de voz', grupo: 'vol-voz' })}
            />
          ) : null}

          {esCancion ? (
            <p className="ed-nota">En los musicales la canción es el anuncio: no lleva música aparte y la canción no se cambia.</p>
          ) : (
            <>
              <div className={`ed-musica${seleccion?.pista === 'musica' ? ' es-sel' : ''}`}>
                <span className="ed-musica__disco" aria-hidden="true">
                  <Music size={16} strokeWidth={2} />
                </span>
                <span className="ed-musica__textos">
                  <span className="ed-musica__nombre t-recortar">{nombreMusica}</span>
                  <span className="ed-musica__origen t-recortar">
                    {musica?.falta
                      ? 'No está en este equipo: elígela otra vez'
                      : musica?.fuente === 'propia'
                        ? `Tu canción${musica.duracion ? ` · ${formatoDuracion(musica.duracion)}` : ''}`
                        : musica?.fuente === 'biblioteca'
                          ? `De «${musica.origen || 'otro anuncio'}»`
                          : musica
                            ? `La que eligió la IA${musica.duracion ? ` · ${formatoDuracion(musica.duracion)}` : ''}`
                            : 'Arrastra un MP3 o elige uno'}
                  </span>
                </span>
                <span className="ed-musica__acciones">
                  <Tooltip texto="Elegir otra canción">
                    <Boton variante="secundario" tamano="chico" soloIcono icono={Upload} etiqueta="Elegir otra canción" onClick={acciones.pedirMusica} />
                  </Tooltip>
                  {musica ? (
                    <Tooltip texto="Quitar la música">
                      <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Quitar la música" onClick={acciones.quitarMusica} />
                    </Tooltip>
                  ) : null}
                </span>
              </div>
              {musica && !musica.falta ? (
                <Deslizador
                  icono={Music}
                  etiqueta="Música"
                  valor={ed.musica.silenciada ? 0 : ed.musica.volumen}
                  max={2}
                  porDefecto={1}
                  onCambio={(v) => cambiar((s) => ({ ...s, musica: { ...s.musica, volumen: v, silenciada: false } }), { etiqueta: 'Volumen de música', grupo: 'vol-musica' })}
                  ayuda="100 % es el nivel que eligió la IA, por debajo de la voz."
                />
              ) : null}
              {musica && !musica.falta && musica.fuente !== 'original' && musica.duracion > 8 && !ed.musica.tramos ? (
                <Deslizador
                  icono={Clock}
                  etiqueta="Empieza en"
                  valor={ed.musica.inicio || 0}
                  min={0}
                  max={Math.max(1, Math.floor(musica.duracion - 5))}
                  paso={0.5}
                  porDefecto={0}
                  formato={(v) => formatoDuracion(v)}
                  onCambio={(v) => cambiar((s) => ({ ...s, musica: { ...s.musica, inicio: v } }), { etiqueta: 'Inicio de la música', grupo: 'inicio-musica' })}
                  ayuda="Si es más corta que el anuncio, se repite sola."
                />
              ) : null}
            </>
          )}
        </Seccion>

        <p className="ed-panel__pie">
          <Eye size={13} strokeWidth={2} aria-hidden="true" />
          Lo que ves es lo que sale: la vista previa usa el mismo montaje que el video final.
        </p>
      </div>
    </aside>
  );
}
