// Regenerar una pieza desde el proceso (lo mismo que el editor: src/datos/regenerar.js).
//
//   <RegenerarPieza p reh onPedido/>   en el panel de la pieza: «Corregir esto» (si la revisión dejó un aviso),
//                                      Regenerar (tal cual, con su costo) y «¿Qué salió mal?» con un campo. Lo que
//                                      no se puede (la hoja de la que salen todas las escenas, la foto de tu producto)
//                                      se explica en vez de ofrecerse.
//   <FilaRegenerar reh onAbrir/>       arriba de las piezas, mientras se regenera algo o hay pedidos en la fila: qué
//                                      se está haciendo y qué espera (con «Quitar»)
//
// Nada de esto te saca del proceso: la pieza nueva aparece sola en su lugar cuando el anuncio se vuelve a armar.
import { useEffect, useState } from 'react';
import { CircleAlert, Clock, LoaderCircle, MessageSquareText, RefreshCw, TriangleAlert, Wand, WandSparkles, X } from 'lucide-react';
import { AreaTexto, Boton, Interruptor, Modal, useAvisos } from '../../componentes/index.js';
import { cancelarDelLote, costoDeRegenerar, idsDelPedido, pedidoDeLaPieza, piezaDelProceso, regenerarEnMarcha } from '../../datos/regenerar.js';

const MINIMO = 3;
const MAXIMO = 600;

/** Por qué la fila espera (esperaA del servidor), en palabras. */
export function textoDeEspera(esperaA) {
  if (esperaA === 'produccion') return 'Se hace apenas termine de armarse el anuncio.';
  if (esperaA === 'exportacion') return 'Se hace cuando termine la exportación del editor.';
  if (esperaA === 'regenerando') return 'Va en la próxima vuelta, junto con lo que pidas mientras tanto.';
  return 'Arranca en un momento.';
}

/** Lo que pasa con un lote, en una frase (sin punto final). */
function fraseDelLote(t) {
  if (!t) return null;
  const sinPunto = (s) => String(s || '').trim().replace(/[.…]+$/, '');
  if (t.fase === 'prompts') return sinPunto(t.frase || 'Preparando lo que pediste');
  if (t.fase === 'aplicar') return sinPunto(t.frase || 'Guardando la versión de ahora y preparando la nueva');
  if (t.fase === 'produccion') {
    if (t.trabado?.mensaje) return sinPunto(t.trabado.mensaje);
    return t.paso?.nombre ? `Volviendo a armar el anuncio: ${t.paso.nombre.toLowerCase()}` : 'Volviendo a armar el anuncio con lo nuevo';
  }
  return t.frase ? sinPunto(t.frase) : null;
}

/**
 * Las acciones de una pieza en el panel. `p` = la pieza del modelo; `reh` = useRegenerar(); `onPedido` = después de
 * pedir (la pantalla vuelve a mirar el conductor).
 */
export function RegenerarPieza({ p, reh, onPedido }) {
  const { aviso } = useAvisos();
  const destino = piezaDelProceso(p.id);
  const info = destino ? reh.porPieza[destino.pieza] : null;
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [conImagen, setConImagen] = useState(false);
  const [enviando, setEnviando] = useState(null); // 'tal-cual' | 'pedido' | 'sugerencia'
  const [error, setError] = useState(null);

  useEffect(() => {
    setAbierto(false);
    setTexto('');
    setConImagen(false);
    setError(null);
    setEnviando(null);
  }, [p.id]);

  if (!destino || !reh.cargado) return null;
  if (!reh.disponible) {
    return reh.motivo ? <p className="prod-regenerar__nota">{reh.motivo}</p> : null;
  }
  if (destino.hoja || info?.motivoNo) {
    // con un aviso, el porqué y qué hacer ya están en «La revisión notó» (sin botones que no hacen nada)
    if (p.avisos?.length) return null;
    return (
      <div className="prod-regenerar">
        <p className="prod-regenerar__nota">{info?.motivoNo || 'Esta imagen no se regenera desde aquí: de ella salen los clips.'}</p>
      </div>
    );
  }
  if (!info) return null;
  // una imagen se regenera con su clip; si esa pieza no tiene imagen propia (sale de otra), no se ofrece
  const esImagen = destino.conImagen;
  if (esImagen && !info.imagen) {
    return (
      <div className="prod-regenerar">
        <p className="prod-regenerar__nota">Esta imagen sale de otra: si no te convence, regenera su clip o la escena de la que sale.</p>
      </div>
    );
  }

  const pedido = pedidoDeLaPieza(reh, destino.pieza);
  const enLote = pedido?.donde === 'lote';
  const conAviso = Boolean(p.avisos?.length);
  // «También su imagen» es solo de «¿Qué salió mal?»: Regenerar hace lo que dice su botón (y cuesta lo que dice)
  const conImg = esImagen || (conImagen && info.imagen);
  const costoTalCual = costoDeRegenerar(info, esImagen);
  const costo = costoDeRegenerar(info, conImg);
  // «Corregir esto» va con la imagen si se pide desde la imagen o si la revisión propuso una imagen nueva
  const corregirConImagen = esImagen || Boolean(info.aviso?.conImagen);
  const costoCorregir = costoDeRegenerar(info, corregirConImagen);
  const pasos = esImagen && info.costo?.pasos?.length ? info.costo.pasos.map((k) => k.replace('paso-', 'Paso ')) : [];
  const listo = texto.trim().length >= MINIMO;
  // una escena de inicio y final (tipo B, o con continuidad) tiene dos imágenes: regenerar una rehace las dos
  const dosImagenes = info.tipo === 'B' || Boolean(info.continuidad);
  const imagenes = dosImagenes ? 'las dos imágenes (inicio y final)' : 'la imagen';
  const que = esImagen ? (info.clip ? `${imagenes} y su clip` : imagenes) : p.clase === 'clip' ? 'el clip' : 'la pieza';

  const pedir = async (modo) => {
    if (modo === 'pedido' && !listo) {
      setError('Cuéntale a la IA qué salió mal (o usa Regenerar para hacerla igual otra vez).');
      return;
    }
    setEnviando(modo);
    setError(null);
    try {
      const cuerpo =
        modo === 'sugerencia'
          ? { pieza: destino.pieza, usarSugerencia: true, ...(esImagen ? { conImagen: true } : {}) }
          : { pieza: destino.pieza, pedido: modo === 'pedido' ? texto.trim().slice(0, MAXIMO) : '', conImagen: modo === 'pedido' ? conImg : esImagen };
      const r = await reh.pedir(cuerpo);
      // (en la fila si quedó esperando: otro lote en marcha, una exportación o el anuncio armándose)
      const enFila = (r?.cola || []).some((x) => x.id === r?.pedido?.id);
      aviso({
        tipo: 'info',
        titulo: `${enFila ? 'En la fila' : modo === 'sugerencia' ? 'Corrigiendo' : 'Regenerando'}: ${info.nombre}`,
        texto: enFila ? `${textoDeEspera(r.esperaA)} La pieza nueva aparece sola en su lugar.` : 'Puedes seguir mirando el anuncio y pedir otras: la pieza nueva aparece sola en su lugar.',
        duracion: 6500,
      });
      setAbierto(false);
      setTexto('');
      setConImagen(false);
      onPedido?.();
    } catch (e) {
      setError(e?.datos?.motivo === 'saldo' ? 'Tu saldo de kie no alcanza: recarga para seguir.' : e.message);
    } finally {
      setEnviando(null);
    }
  };

  const quitar = async () => {
    try {
      await reh.cancelar(pedido.item.id);
      aviso({ tipo: 'info', titulo: 'Lo saqué de la fila', texto: `${info.nombre} queda como estaba.` });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude sacarlo de la fila', texto: e.message });
    }
  };

  return (
    <section className="prod-regenerar" aria-label="Regenerar esta pieza">
      <span className="t-etiqueta prod-regenerar__titulo">
        <RefreshCw size={12} strokeWidth={2.4} aria-hidden="true" /> ¿No te convence?
      </span>

      {enLote ? (
        <div className="prod-regenerar__estado" role="status">
          <LoaderCircle size={16} strokeWidth={2.4} className="girando" aria-hidden="true" />
          <span>
            <strong>Regenerando {info.nombre}</strong>
            {fraseDelLote(reh.trabajo)}. Puedes seguir mirando: aparece sola en su lugar.
          </span>
        </div>
      ) : pedido?.donde === 'fila' ? (
        <div className="prod-regenerar__estado prod-regenerar__estado--fila" role="status">
          <Clock size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>
            <strong>En la fila</strong>
            {textoDeEspera(reh.esperaA)}
          </span>
          <Boton variante="fantasma" tamano="chico" icono={X} onClick={quitar}>
            Quitar
          </Boton>
        </div>
      ) : null}

      <div className="prod-regenerar__botones">
        {conAviso ? (
          <Boton variante="primario" icono={WandSparkles} cargando={enviando === 'sugerencia'} disabled={Boolean(enviando) || enLote} onClick={() => pedir('sugerencia')}>
            {`Corregir esto${costoCorregir ? ` · ${costoCorregir}` : ''}`}
          </Boton>
        ) : null}
        <Boton variante={conAviso ? 'secundario' : 'primario'} icono={RefreshCw} cargando={enviando === 'tal-cual'} disabled={Boolean(enviando) || enLote} onClick={() => pedir('tal-cual')}>
          {`Regenerar${costoTalCual ? ` · ${costoTalCual}` : ''}`}
        </Boton>
        <Boton variante="fantasma" icono={MessageSquareText} disabled={Boolean(enviando) || enLote} aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>
          ¿Qué salió mal?
        </Boton>
      </div>
      <p className="prod-regenerar__nota">
        {conAviso
          ? `${p.avisos.some((x) => x.sugerencia) ? '«Corregir esto» usa lo que ya sugirió la revisión' : '«Corregir esto» le cuenta a la IA lo que notó la revisión para que ajuste la instrucción (tarda un poco más)'}${corregirConImagen && !esImagen ? ` y también regenera ${dosImagenes ? 'sus dos imágenes' : 'su imagen'}` : ''}. `
          : ''}
        «Regenerar» hace de nuevo {que} con la misma instrucción.
        {pasos.length ? ` También se hacen de nuevo los pasos de al lado (${pasos.join(' y ')}).` : ''} La versión de ahora no se pierde: la ves en «Antes» y queda en la carpeta del anuncio.
        {pedido?.donde === 'fila' ? ' Si la pides de otra forma mientras espera, eso reemplaza a lo que está en la fila.' : ''}
      </p>

      {abierto ? (
        <div className="prod-regenerar__campo">
          <AreaTexto
            etiqueta="¿Qué salió mal?"
            filas={3}
            maxLength={MAXIMO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) pedir('pedido');
            }}
            placeholder={p.broll ? 'Ej.: el frasco salió con otra etiqueta' : p.clase === 'clip' ? 'Ej.: no mira a cámara y el frasco se ve muy chico' : 'Ej.: el personaje tiene otra cara que en su hoja'}
            ayuda="Con tus palabras: la IA ajusta la instrucción y regenera solo esta pieza."
            disabled={Boolean(enviando)}
            data-autofocus
          />
          {!esImagen && info.imagen ? (
            <Interruptor
              activado={conImagen}
              onCambio={setConImagen}
              etiqueta={dosImagenes ? 'También sus dos imágenes' : 'También su imagen'}
              descripcion="Úsalo si lo que falla es el dibujo (la escena, el personaje, el producto), no el movimiento."
            />
          ) : null}
          <Boton variante="primario" icono={Wand} cargando={enviando === 'pedido'} disabled={Boolean(enviando) || !listo} onClick={() => pedir('pedido')}>
            {`Regenerar con esto${costo ? ` · ${costo}` : ''}`}
          </Boton>
        </div>
      ) : null}

      {error ? (
        <p className="prod-regenerar__error" role="alert">
          <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Arriba de las piezas: lo que se está regenerando y lo que espera en la fila. `onCancelarLote()` devuelve la promesa
 * del pedido: «Cancelar» corta todo lo que se prepara (si es más de una pieza, lo pregunta antes) y avisa qué quedó como
 * estaba.
 */
export function FilaRegenerar({ reh, onAbrir, onCancelarLote }) {
  const { aviso } = useAvisos();
  const [confirmar, setConfirmar] = useState(null); // lo que corta «Cancelar» (cancelarDelLote), mientras se pregunta
  if (!reh?.cargado) return null;
  const t = reh.trabajo;
  const enMarcha = regenerarEnMarcha(t);
  const cola = reh.cola || [];
  if (!enMarcha && !cola.length) return null;
  const trabado = enMarcha && t.fase === 'produccion' && t.trabado && !t.trabado.espera;
  const quitar = async (x) => {
    try {
      await reh.cancelar(x.id);
      aviso({ tipo: 'info', titulo: 'Lo saqué de la fila', texto: `${x.nombre} queda como estaba.` });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude sacarlo de la fila', texto: e.message });
    }
  };
  const abrir = (x) => {
    const ids = idsDelPedido(x, reh.porPieza);
    if (ids.length) onAbrir?.(ids);
  };
  const piezas = enMarcha ? (t.piezas || []).filter((x) => x.estado !== 'cancelado') : [];
  const cancelar = async (c) => {
    setConfirmar(null);
    try {
      await onCancelarLote();
      aviso(c.aviso);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cancelarlo', texto: e.message });
    }
  };
  const pedirCancelar = () => {
    const c = cancelarDelLote(t);
    if (c.varias) setConfirmar(c);
    else cancelar(c);
  };
  return (
    <section className={`prod-fila${trabado ? ' prod-fila--trabado' : ''}`} aria-label="Lo que estás regenerando" role="status">
      <div className="prod-fila__cabeza">
        {trabado ? (
          <TriangleAlert size={18} strokeWidth={2.2} className="prod-fila__icono" aria-hidden="true" />
        ) : enMarcha ? (
          <LoaderCircle size={18} strokeWidth={2.4} className="prod-fila__icono girando" aria-hidden="true" />
        ) : (
          <Clock size={18} strokeWidth={2.2} className="prod-fila__icono" aria-hidden="true" />
        )}
        <div className="prod-fila__textos">
          <span className="prod-fila__titulo">{enMarcha ? `Regenerando ${t.nombre}` : cola.length === 1 ? `${cola[0].nombre} espera su turno` : `${cola.length} piezas esperan su turno`}</span>
          <span className="prod-fila__detalle">{enMarcha ? `${fraseDelLote(t)}.${trabado ? ' Mira la tarjeta de arriba para seguir.' : ''}` : textoDeEspera(reh.esperaA)}</span>
        </div>
        {enMarcha && t.fase === 'prompts' && onCancelarLote ? (
          <Boton variante="fantasma" tamano="chico" icono={X} onClick={pedirCancelar}>
            Cancelar
          </Boton>
        ) : null}
      </div>
      <Modal
        abierto={Boolean(confirmar)}
        onCerrar={() => setConfirmar(null)}
        icono={X}
        titulo="¿Cancelar todo lo que se prepara?"
        descripcion={confirmar?.pregunta}
        tamano="chico"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setConfirmar(null)}>
              Seguir
            </Boton>
            <Boton variante="primario" icono={X} onClick={() => cancelar(confirmar)}>
              Sí, cancelar
            </Boton>
          </>
        }
      />
      {piezas.length || cola.length ? (
        <ul className="prod-fila__lista">
          {piezas.map((x) => (
            <li key={x.id} className="prod-fila__item prod-fila__item--lote">
              {x.estado === 'error' ? <CircleAlert size={13} strokeWidth={2.4} aria-hidden="true" /> : <LoaderCircle size={13} strokeWidth={2.4} className="girando" aria-hidden="true" />}
              <button type="button" className="enlace-simple" onClick={() => abrir(x)}>
                {x.nombre}
              </button>
              {x.estado === 'error' ? <span className="t-3">· {x.error?.mensaje || 'no se pudo'}</span> : null}
            </li>
          ))}
          {cola.map((x) => (
            <li key={x.id} className="prod-fila__item">
              <Clock size={13} strokeWidth={2.4} aria-hidden="true" />
              <button type="button" className="enlace-simple" onClick={() => abrir(x)}>
                {x.nombre}
              </button>
              <Boton variante="fantasma" tamano="chico" soloIcono icono={X} etiqueta={`Quitar ${x.nombre} de la fila`} onClick={() => quitar(x)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
