// El avance del lote: la frase de lo que se está haciendo, la barra, cuántas imágenes van, la línea de etapas,
// Detener / Continuar y, si algo lo frena, una tarjeta con lo que pasó y su botón (el saldo nunca con cifras).
// Al terminar queda una franja corta de "listo": lo importante pasa a ser la galería de abajo.
import {
  CircleAlert,
  CircleCheck,
  CirclePause,
  Hourglass,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  TriangleAlert,
  Wallet,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { BarraDeProgreso, Boton, Insignia, Tarjeta } from '../../componentes/index.js';
import { PIEZA_FINAL, altoDelLote, avanceDelLote, etapasDelLote, horaDe, loteTerminado, pedidoEnCamino } from '../../datos/imagenes.js';
import { enlace } from '../../datos/rutas.js';
import { Etapas } from '../produccion/Mando.jsx';
import { BandaModoPrueba } from '../produccion/ModoPrueba.jsx';
import { AvisoMotor, TarjetaFalla } from '../nuevo/piezas.jsx';
import { MOTORES, mayuscula, useMotor } from '../ajustes/datos.js';

const conPunto = (s) => {
  const t = String(s || '').trim();
  return !t ? '' : /[.!?…]$/.test(t) ? t : `${t}.`;
};

/** Lo que dice la tarjeta de cada alto (sin cifras) y qué se puede hacer. `ia`: el nombre de la IA del lote. */
function tarjetaDelAlto(alto, { onContinuar, enlaceOtro, ia = 'Claude' }) {
  const m = conPunto(alto.mensaje);
  switch (alto.tipo) {
    case 'saldo':
      return {
        icono: Wallet,
        titulo: 'Tu saldo de kie no alcanza: recarga para seguir',
        texto: 'Cuando recargues, toca «Continuar». Lo que ya está hecho no se vuelve a pagar.',
        principal: { texto: 'Continuar', icono: RotateCcw, alHacer: onContinuar },
        secundaria: { texto: 'Ver en Ajustes', icono: Settings, href: enlace.ajustes() },
      };
    case 'limite-claude': {
      const hora = horaDe(alto.hasta) || (/a las (\d{1,2}:\d{2})/.exec(alto.mensaje || '') || [])[1];
      return {
        icono: Hourglass,
        suave: true,
        sobre: 'Esperando',
        titulo: `Tu plan de ${ia} llegó a su límite por ahora`,
        texto: `${hora ? `Sigo solo a las ${hora}.` : 'Sigo solo apenas se renueve.'} Mientras tanto se terminan las imágenes que no necesitan a ${ia}. Lo ya hecho no se repite.`,
        principal: { texto: 'Probar ahora', icono: RefreshCw, alHacer: onContinuar, secundario: true },
      };
    }
    case 'conexion':
      return {
        icono: WifiOff,
        suave: true,
        sobre: 'Esperando',
        titulo: 'Esperando la conexión',
        texto: 'Apenas vuelva internet sigue sola desde donde quedó.',
        principal: { texto: 'Probar ahora', icono: RefreshCw, alHacer: onContinuar, secundario: true },
      };
    case 'reintento':
      return {
        icono: RefreshCw,
        suave: true,
        sobre: 'Esperando',
        titulo: 'Reintentando sola',
        texto: `${m ? `${m} ` : ''}Es un problema del servicio, no tuyo ni de tu internet: no tienes que tocar nada.`,
        principal: { texto: 'Probar ahora', icono: RefreshCw, alHacer: onContinuar, secundario: true },
      };
    case 'detenido':
      return {
        icono: CirclePause,
        suave: true,
        sobre: 'En pausa',
        titulo: 'Lo detuviste',
        texto: 'Toca «Continuar» para seguir desde donde quedó: lo ya hecho no se repite ni se vuelve a pagar.',
        principal: { texto: 'Continuar', icono: Play, alHacer: onContinuar },
      };
    case 'pausa':
      return { icono: CirclePause, titulo: 'Tu lote está en pausa', texto: `${m ? `${m} ` : ''}Toca «Continuar» para seguir desde donde quedó.`, principal: { texto: 'Continuar', icono: Play, alHacer: onContinuar } };
    case 'clave':
      return {
        icono: KeyRound,
        titulo: 'Revisa tu clave de kie',
        texto: `${m ? `${m} ` : ''}Ponla en Ajustes › Conexiones y después toca «Continuar». Lo ya hecho no se vuelve a pagar.`,
        principal: { texto: 'Ir a Ajustes', icono: Settings, href: enlace.ajustes() },
        secundaria: { texto: 'Continuar', icono: RotateCcw, alHacer: onContinuar },
      };
    case 'ffmpeg':
      return {
        icono: Wrench,
        titulo: 'Falta un programa para armar tus imágenes',
        texto: m || 'Falta un programa que la app necesita para revisar y armar tus imágenes. Cierra la app y vuelve a abrirla: se instala solo.',
        nota: 'Todavía no se pagó nada.',
        principal: { texto: 'Continuar', icono: RotateCcw, alHacer: onContinuar },
      };
    case 'bloqueo':
      return {
        icono: CircleAlert,
        titulo: 'Me falta un dato para escribir tus anuncios',
        texto: `${m ? `${m} ` : ''}Arma otro lote con ese dato en «Información adicional».`,
        principal: { texto: 'Hacer otro lote', icono: Plus, href: enlaceOtro },
        secundaria: { texto: 'Continuar', icono: RotateCcw, alHacer: onContinuar },
      };
    default:
      return {
        icono: TriangleAlert,
        titulo: 'Algo se trabó',
        texto: `${m ? `${m} ` : ''}Toca «Continuar» para reintentarlo. Lo que ya está hecho no se vuelve a pagar.`,
        principal: { texto: 'Continuar', icono: RotateCcw, alHacer: onContinuar },
      };
  }
}

const FRASE_DEL_ALTO = {
  saldo: 'Tu lote está en pausa',
  detenido: 'Tu lote está en pausa',
  pausa: 'Tu lote está en pausa',
  conexion: 'Tu lote sigue solo en un momento',
  reintento: 'Tu lote sigue solo en un momento',
};

function TarjetaAlto({ t, ocupado }) {
  const Icono = t.icono;
  const boton = (b, variante) =>
    b ? (
      <Boton variante={variante} icono={b.icono} href={b.href} onClick={b.alHacer} cargando={Boolean(b.alHacer) && ocupado === 'continuar'}>
        {b.texto}
      </Boton>
    ) : null;
  return (
    <div className={`lote-alto${t.suave ? ' lote-alto--suave' : ''}`} role={t.suave ? 'status' : 'alert'}>
      <span className="lote-alto__icono" aria-hidden="true">
        <Icono size={18} strokeWidth={2.2} />
      </span>
      <div className="lote-alto__textos">
        <span className="lote-alto__sobre">{t.sobre || (t.suave ? 'Esperando' : 'Te necesita')}</span>
        <strong className="lote-alto__titulo">{t.titulo}</strong>
        <p className="lote-alto__texto">{t.texto}</p>
        {t.nota ? <p className="lote-alto__nota">{t.nota}</p> : null}
      </div>
      <div className="lote-alto__acciones">
        {boton(t.secundaria, 'fantasma')}
        {boton(t.principal, t.principal?.secundario || t.suave ? 'secundario' : 'primario')}
      </div>
    </div>
  );
}

/** Tu IA (la usan la estrategia, cada anuncio y la revisión) no está lista: con su botón. */
function AltoDeIA({ alto, onContinuar, ocupado }) {
  const motor = useMotor();
  const m = String(alto.mensaje || '');
  const tipo = /no elegiste tu ia/i.test(m)
    ? 'sin-motor'
    : /no incluye codex/i.test(m)
      ? 'plan-sin-codex'
      : /sesi[oó]n|login|inicia/i.test(m)
        ? 'sin-sesion'
        : /encuentro|instal|falta (claude|codex)/i.test(m)
          ? 'sin-claude'
          : undefined;
  if (motor.falta) return <AvisoMotor motor={motor} para="armar la estrategia, escribir cada anuncio y revisar tus imágenes" />;
  return <TarjetaFalla error={{ mensaje: m, tipo }} que="tus anuncios" motor={motor} onReintentar={onContinuar} reintentando={ocupado === 'continuar'} />;
}

function Dato({ etiqueta, valor, de, sub }) {
  return (
    <div className="lote-dato">
      <span className="lote-dato__etiqueta">{etiqueta}</span>
      <span className="lote-dato__valor t-num">
        {valor}
        {de !== undefined ? <span className="lote-dato__de"> / {de}</span> : null}
      </span>
      {sub ? <span className="lote-dato__sub">{sub}</span> : null}
    </div>
  );
}

export function Avance({ vista, onContinuar, onDetener, ocupado, enlaceOtro }) {
  const elegida = mayuscula(useMotor().nombre);
  const c = vista.conductor;
  const a = vista.avance || {};
  const terminado = loteTerminado(vista);
  const alto = terminado ? null : altoDelLote(c);
  const piezas = (vista.variaciones || []).flatMap((x) => Object.values(x.piezas || {}).filter(Boolean));
  const conImagen = piezas.filter((p) => p.url).length;
  const teNecesitan = piezas.filter((p) => p.estado === 'te-necesita').length;
  const sinImagen = piezas.filter((p) => p.estado === 'sin-imagen').length;
  const sinRevisar = piezas.filter((p) => p.estado === 'sin-revisar').length;
  // listas para publicar: las que la revisión dio por buenas (las demás se cuentan aparte)
  const paraPublicar = piezas.filter((p) => p.url && (p.estado === 'listo' || p.estado === 'arreglado')).length;
  const total = Number(a.total) || piezas.length;
  // "lista" = terminada y con imagen: la misma cuenta que "Tus anuncios" de la galería
  const listas = piezas.filter((p) => PIEZA_FINAL.has(p.estado) && p.url).length;
  const enCamino = (vista.pedidos || []).filter(pedidoEnCamino).length;

  // ---- terminado: una franja corta
  if (terminado) {
    return (
      <>
        <Tarjeta variante="elevada" relleno="compacto" className="lote-avance lote-avance--listo">
          <div className="lote-listo">
            <span className="lote-listo__icono" aria-hidden="true">
              <CircleCheck size={20} strokeWidth={2.2} />
            </span>
            <div className="lote-listo__textos">
              <h2 className="lote-listo__titulo" aria-live="polite">
                Tu lote está listo
              </h2>
              <p className="lote-listo__sub">
                {paraPublicar === 1 ? '1 imagen lista para publicar' : `${paraPublicar} imágenes listas para publicar`}
                {teNecesitan ? ` · en ${teNecesitan === 1 ? '1 la revisión notó algo' : `${teNecesitan} la revisión notó algo`}: míralas abajo` : ''}
                {sinRevisar ? ` · ${sinRevisar === 1 ? '1 quedó sin revisar' : `${sinRevisar} quedaron sin revisar`}` : ''}
                {sinImagen ? ` · ${sinImagen === 1 ? '1 quedó sin imagen' : `${sinImagen} quedaron sin imagen`}` : ''}
              </p>
            </div>
          </div>
        </Tarjeta>
        {vista.modoPrueba ? <BandaModoPrueba>Las imágenes salieron del simulador de tu PC: no se le pidió nada a kie.</BandaModoPrueba> : null}
      </>
    );
  }

  // ---- en marcha (o frenado)
  const enFila = c.estado === 'esperando' && !alto;
  const detrasDe = Array.isArray(vista.fila?.detrasDe) ? vista.fila.detrasDe : [];
  // la IA del alto: la que llegó a su límite (si el servidor la manda) o la elegida
  const ia = MOTORES[alto?.motor]?.nombre || elegida;
  const tarjeta = alto && alto.tipo !== 'claude' ? tarjetaDelAlto(alto, { onContinuar, enlaceOtro, ia }) : null;
  // con un alto, la frase dice el estado en general y la tarjeta de abajo, qué pasó y qué hacer
  const frase = alto
    ? alto.tipo === 'limite-claude'
      ? `Tu lote espera a ${ia}`
      : FRASE_DEL_ALTO[alto.tipo] || 'Tu lote se trabó'
    : enFila
      ? 'Tu lote está en la fila'
      : a.frase || 'Creando tus anuncios';
  const valor = avanceDelLote(vista);
  const { etapas, estados, detalles } = etapasDelLote(vista);
  const frenado = Boolean(alto) && !['limite-claude', 'conexion', 'reintento'].includes(alto.tipo);
  const puedeDetener = c.estado === 'corriendo' || c.estado === 'esperando';
  // (rojo solo si te necesita de verdad: lo que detuviste tú queda en gris)
  const rojo = frenado && !['detenido', 'pausa'].includes(alto.tipo);
  // (si hay tarjeta del alto, "Continuar" está en ella: no se repite arriba)
  const puedeContinuar = (c.estado === 'pausado' || c.estado === 'error') && !alto;
  const insignia = frenado ? (
    alto.tipo === 'detenido' ? (
      <Insignia estado="en-cola" texto="Detenido" />
    ) : alto.tipo === 'saldo' ? (
      <Insignia estado="te-necesita" texto="Recarga tu saldo" />
    ) : (
      <Insignia estado="error" texto="Se trabó" />
    )
  ) : alto ? (
    <Insignia estado="en-cola" texto="Esperando" />
  ) : enFila ? (
    <Insignia estado="en-cola" texto="En la fila" />
  ) : (
    <Insignia estado="generando" texto={enCamino && c.estado === 'listo' ? 'Regenerando' : 'Creándose'} />
  );

  const detalle = alto
    ? null
    : enFila
      ? detrasDe.length
        ? `En la fila detrás de «${detrasDe[0]}»${detrasDe.length > 1 ? ` y ${detrasDe.length - 1 === 1 ? 'otro más' : `otros ${detrasDe.length - 1}`}` : ''}: empieza solo apenas termine. No tienes que hacer nada.`
        : 'Empieza solo apenas haya lugar. No tienes que hacer nada.'
      : conImagen
        ? 'Cada imagen aparece abajo apenas existe; la IA la revisa y, si ve algo, te deja una nota en esa imagen (no la rehace sola: tú decides).'
        : 'Las primeras imágenes suelen aparecer a los 10 o 15 minutos. No tienes que hacer nada.';

  return (
    <>
      <Tarjeta variante="elevada" relleno="ninguno" className={`lote-avance${rojo ? ' lote-avance--frenado prod-mando--espera' : ''}`}>
        <div className="lote-avance__cuerpo">
          <div className="lote-avance__arriba">
            {insignia}
            <div className="lote-avance__botones">
              {puedeContinuar ? (
                <Boton variante="primario" tamano="chico" icono={Play} cargando={ocupado === 'continuar'} onClick={onContinuar}>
                  Continuar
                </Boton>
              ) : null}
              {puedeDetener ? (
                <Boton variante="secundario" tamano="chico" icono={Pause} cargando={ocupado === 'detener'} onClick={onDetener}>
                  Detener
                </Boton>
              ) : null}
            </div>
          </div>
          <h2 className="lote-avance__frase" aria-live="polite">
            {frase}
          </h2>
          {detalle ? <p className="lote-avance__detalle">{detalle}</p> : null}
          <BarraDeProgreso valor={valor} tono={frenado ? 'aviso' : 'cian'} grosor="gruesa" animada={!alto && !enFila} mostrarValor etiqueta="Avance" />
          <div className="lote-datos">
            <Dato etiqueta="Imágenes" valor={listas} de={total} sub={enCamino ? `${enCamino === 1 ? '1 cambio' : `${enCamino} cambios`} en camino` : null} />
            <Dato etiqueta="Anuncios escritos" valor={Number(a.escritas) || 0} de={Number(vista.brief?.cantidad) || vista.variaciones?.length || 0} />
          </div>
          {alto?.tipo === 'claude' ? <AltoDeIA alto={alto} onContinuar={onContinuar} ocupado={ocupado} /> : tarjeta ? <TarjetaAlto t={tarjeta} ocupado={ocupado} /> : null}
        </div>
        <div className="lote-etapas" style={{ '--n': etapas.length }}>
          <Etapas etapas={etapas} estados={estados} detalles={detalles} />
        </div>
      </Tarjeta>
      {vista.modoPrueba ? <BandaModoPrueba>Las imágenes salen del simulador de tu PC: no se le pide nada a kie.</BandaModoPrueba> : null}
    </>
  );
}
