// Lo que se puede hacer con el clip elegido (panel «Cambios rápidos», debajo de su foto):
//   - lo que notó la revisión (si dejó un aviso) y «Corregir esto»
//   - Regenerar (tal cual, con su costo) y «¿Qué salió mal?» (ModalRehacer); si ya está pedido: en la fila / regenerando
//   - Reemplazar con tu video (o arrastrarlo a la ventana) y «Volver al clip original»
//   - velocidad (0,5× a 2×) y deslizar lo que se ve, con las reglas de cada estilo (capas.queSePuedeConElClip)
//   - Descargar el clip
// Regenerar es lo único que cuesta (va en su botón); lo demás es gratis y se ve al instante en la vista previa (salvo
// tu video en los estilos donde la voz va dentro del clip: ahí la app vuelve a medir la voz y arma el anuncio de nuevo).
import { Clock, Download, Film, Gauge, LoaderCircle, MessageSquareText, MoveHorizontal, RefreshCw, RotateCcw, ScanEye, Upload, VolumeX, WandSparkles, X } from 'lucide-react';
import { Boton, Chip, Interruptor, Tooltip } from '../../componentes/index.js';
import { costoDeRegenerar, pedidoDeLaPieza } from '../../datos/regenerar.js';
import { Deslizador } from './piezas.jsx';
import { VELOCIDADES } from './modelo.js';

const coma = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
/** «0,75» para las de los botones; las demás (la que puso la app para calzar, p. ej. 1,03) con un decimal: «1» */
const verVelocidad = (n) => (VELOCIDADES.some((v) => Math.abs(v - n) < 0.001) ? coma(n) : String(Math.round(n * 10) / 10).replace('.', ','));
const conSigno = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${coma(Math.abs(n))} s`;

/** Lo que pasa con lo pedido de esta pieza, en una línea (o null). */
function EstadoDelPedido({ pedido, reh, onQuitar }) {
  if (!pedido) return null;
  if (pedido.donde === 'lote') {
    return (
      <p className="ed-nota ed-nota--cian" role="status">
        <LoaderCircle size={13} strokeWidth={2.4} className="girando" aria-hidden="true" />
        Regenerándose: {String(pedido.frase || 'preparando').replace(/\.$/, '').toLowerCase()}. Cuando esté, aparece sola en la vista previa.
      </p>
    );
  }
  return (
    <div className="ed-nota ed-nota--fila" role="status">
      <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
      <span>
        En la fila: {reh.esperaA === 'exportacion' ? 'se hace cuando termine la exportación.' : reh.esperaA === 'produccion' ? 'se hace apenas termine de armarse el anuncio.' : 'se hace cuando termine lo de ahora.'} Si la pides
        de otra forma mientras espera, eso reemplaza a lo que está en la fila.
      </span>
      <Boton variante="fantasma" tamano="chico" icono={X} onClick={onQuitar}>
        Quitar
      </Boton>
    </div>
  );
}

export function AccionesClip({ item, acciones, slug }) {
  const reh = acciones.reh;
  const info = item.pieza && reh?.cargado ? reh.porPieza[item.pieza] : null;
  const pedido = item.pieza ? pedidoDeLaPieza(reh, item.pieza) : null;
  const enLote = pedido?.donde === 'lote';
  const puede = item.puede || {};
  const ajuste = item.ajuste || {};
  const reemplazoEdicion = puede.reemplazar === 'edicion' && Boolean(acciones.reemplazoDe(item.pieza));
  const subidaEnAnuncio = Boolean(info?.subida);
  const subiendo = acciones.subiendo === item.pieza;
  const costo = info ? costoDeRegenerar(info, false) : null;
  // «Corregir esto» va con su imagen si la revisión propuso una imagen nueva (el servidor lo dice en aviso.conImagen)
  const costoCorregir = info?.aviso ? costoDeRegenerar(info, Boolean(info.aviso.conImagen)) : null;
  // la que elegiste tú (null si no) y la que puso la app (la del montaje, p. ej. un poco más rápido para calzar con su
  // frase; con tu video, 1): sin la tuya, va marcado «Como la puso la app»
  const velocidad = item.velocidadPropia ?? null;
  const propia = velocidad !== null && Number.isFinite(Number(velocidad));
  const deLaApp = propia ? Number(item.velocidadApp) || 1 : Number(item.velocidad) || Number(item.velocidadApp) || 1;
  const velocidadVista = propia ? Number(velocidad) : deLaApp;
  const desliza = Number(ajuste.desliza) || 0;
  const largo = Number(item.largo) || null;
  const base = Number(item.entradaBase) || 0;
  const minDesliza = -base;
  // lo más que se puede deslizar sin que el clip se acabe antes que su lugar: a esta velocidad, su lugar en el anuncio
  // gasta (ventana × velocidad) segundos del clip (sin esto, deslizar al tope lo dejaba quieto entero). Si ya está
  // deslizado más que eso (p. ej. subiste la velocidad después), el tope es lo de ahora: se puede volver hacia atrás.
  const ventana = Math.max(0, (Number(item.fin) || 0) - (Number(item.inicio) || 0));
  const maxDesliza = largo ? Math.max(0, minDesliza, desliza, largo - base - ventana * velocidadVista) : Math.max(3, -minDesliza);
  const nombre = item.nombre?.replace(/ · \d+$/, '') || 'este clip';

  return (
    <div className="ed-clip">
      {/* en tu versión va TU video: lo que notó la revisión y regenerar son del clip de la app, que aquí no se ve */}
      {reemplazoEdicion ? (
        <p className="ed-nota">
          En tu versión va tu video: regenerar el clip de la app no cambia lo que se ve aquí. Si quieres regenerarlo, primero vuelve al clip original.
        </p>
      ) : info?.aviso ? (
        <div className="ed-clip__aviso" role="note">
          <strong>
            <ScanEye size={14} strokeWidth={2.2} aria-hidden="true" /> La revisión notó:
          </strong>
          <p>{info.aviso.texto}</p>
          <p className="t-mini t-3">
            {info.aviso.sugerencia
              ? 'No se rehízo sola: tú decides. «Corregir esto» usa lo que la revisión ya sugirió.'
              : 'No se rehízo sola: tú decides. «Corregir esto» le cuenta a la IA lo que notó la revisión para que ajuste la instrucción (tarda un poco más).'}
          </p>
        </div>
      ) : null}

      {/* ---- regenerar (lo único que cuesta) */}
      {reemplazoEdicion ? null : reh?.cargado && reh.disponible && info && !info.motivoNo ? (
        <div className="ed-clip__grupo">
          <EstadoDelPedido pedido={pedido} reh={reh} onQuitar={() => acciones.quitarDeLaFila(pedido.item)} />
          <div className="ed-clip__botones">
            {info.aviso ? (
              <Boton variante="primario" tamano="chico" icono={WandSparkles} disabled={enLote} onClick={() => acciones.regenerar(item, 'sugerencia')}>
                {`Corregir esto${costoCorregir ? ` · ${costoCorregir}` : ''}`}
              </Boton>
            ) : null}
            <Tooltip texto="Lo hace de nuevo con la misma instrucción. La versión de ahora queda en la carpeta del anuncio (en el proceso, en «Antes»).">
              <Boton variante={info.aviso ? 'secundario' : 'primario'} tamano="chico" icono={RefreshCw} disabled={enLote} onClick={() => acciones.regenerar(item, 'tal-cual')}>
                {`Regenerar${costo ? ` · ${costo}` : ''}`}
              </Boton>
            </Tooltip>
            <Boton variante="fantasma" tamano="chico" icono={MessageSquareText} disabled={enLote} onClick={() => acciones.abrirRehacer(item)}>
              ¿Qué salió mal?
            </Boton>
          </div>
        </div>
      ) : info?.motivoNo ? (
        <p className="ed-nota">{info.motivoNo}</p>
      ) : reh?.cargado && !reh.disponible && reh.motivo && item.pieza ? (
        <p className="ed-nota">{reh.motivo}</p>
      ) : null}

      {/* ---- tu propio video */}
      {puede.reemplazar ? (
        <div className="ed-clip__grupo">
          <span className="ed-clip__titulo">
            <Film size={13} strokeWidth={2.2} aria-hidden="true" /> Tu video
          </span>
          {reemplazoEdicion ? (
            <p className="ed-nota">
              <span>
                En lugar de {nombre} va <strong>{acciones.reemplazoDe(item.pieza)?.nombre || 'tu video'}</strong>. El anuncio original no se toca: lo ves aquí y sale al exportar.
              </span>
            </p>
          ) : subidaEnAnuncio ? (
            <p className="ed-nota">
              <span>
                {nombre} es <strong>{info.subida.nombre || 'tu video'}</strong> en el anuncio.
              </span>
            </p>
          ) : (
            <p className="ed-nota">
              {puede.reemplazar === 'anuncio'
                ? 'Súbelo con su voz: la app vuelve a medir lo que dice y arma el anuncio de nuevo (no cuesta nada en kie).'
                : 'Por ejemplo uno hecho en Google Flow. También puedes arrastrarlo a la ventana. Gratis.'}
            </p>
          )}
          <div className="ed-clip__botones">
            <Boton variante="secundario" tamano="chico" icono={subiendo ? LoaderCircle : Upload} cargando={subiendo} disabled={Boolean(acciones.subiendo) || enLote} onClick={() => acciones.elegirVideo(item)}>
              {subiendo ? 'Preparando tu video…' : reemplazoEdicion || subidaEnAnuncio ? 'Usar otro video' : 'Reemplazar con tu video'}
            </Boton>
            {reemplazoEdicion || subidaEnAnuncio ? (
              <Boton variante="fantasma" tamano="chico" icono={RotateCcw} disabled={enLote} onClick={() => acciones.volverAlClipOriginal(item, subidaEnAnuncio && !reemplazoEdicion)}>
                Volver al clip original
              </Boton>
            ) : null}
          </div>
          {reemplazoEdicion ? (
            <Interruptor
              tamano="chico"
              activado={!acciones.reemplazoDe(item.pieza)?.mudo}
              etiqueta="Con su sonido"
              descripcion="Apagado, tu video va mudo y se oye la voz del anuncio."
              onCambio={(v) => acciones.mudoReemplazo(item, !v)}
            />
          ) : null}
        </div>
      ) : null}

      {/* ---- velocidad y deslizar (gratis) */}
      {item.pieza ? (
        <div className="ed-clip__grupo">
          <span className="ed-clip__titulo">
            <Gauge size={13} strokeWidth={2.2} aria-hidden="true" /> Velocidad
            <span className="ed-control__valor t-num">{verVelocidad(velocidadVista)}×</span>
          </span>
          {puede.velocidad ? (
            <div className="ed-velocidades" role="group" aria-label="Velocidad del clip">
              {/* sin velocidad tuya, la que puso la app (p. ej. un poco más rápido para que entre con su frase) va marcada */}
              <Chip tamano="chico" activo={!propia} onClick={() => acciones.velocidad(item, null)}>
                {`${item.reemplazado ? 'Como viene' : 'Como la puso la app'} (${verVelocidad(deLaApp)}×)`}
              </Chip>
              {VELOCIDADES.map((v) => (
                <Chip key={v} tamano="chico" activo={propia && Math.abs(velocidad - v) < 0.001} onClick={() => acciones.velocidad(item, v)}>
                  {coma(v)}×
                </Chip>
              ))}
            </div>
          ) : (
            <p className="ed-nota">{puede.motivo || 'La velocidad de este clip la pone la app.'}</p>
          )}
          {puede.deslizar ? (
            <Deslizador
              icono={MoveHorizontal}
              etiqueta="Deslizar lo que se ve"
              valor={desliza}
              min={minDesliza}
              max={maxDesliza}
              paso={0.05}
              porDefecto={0}
              formato={(v) => (Math.abs(v) < 0.001 ? 'Como venía' : conSigno(v))}
              onCambio={(v) => acciones.deslizar(item, v)}
              ayuda="Cambia qué parte del clip se ve sin moverlo: para que calce con la voz o con la boca. En la línea de tiempo, arrástralo con Alt."
            />
          ) : null}
        </div>
      ) : null}

      <div className="ed-clip__botones">
        <Boton variante="fantasma" tamano="chico" icono={Download} href={item.clip} download={`${slug}-${(item.pieza || item.id || 'clip').replace(/^toma-/, 'escena-').replace(/^broll-/, 'apoyo-')}.mp4`}>
          Descargar el clip
        </Boton>
        {item.mudo && item.reemplazado ? (
          <span className="t-mini t-3 ed-clip__mudo">
            <VolumeX size={11} strokeWidth={2.2} aria-hidden="true" /> va mudo
          </span>
        ) : null}
      </div>
    </div>
  );
}
