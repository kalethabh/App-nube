// Ajustes · Conexiones: tu IA (Claude o ChatGPT: guiones y anuncios de imagen con la cuenta del alumno), kie.ai
// (imágenes, videos y música) con su clave y su saldo real, y ElevenLabs para la voz.
// Las claves solo dicen "Guardada" o "Falta". Fuera de la entrega, el único dinero que se ve es el saldo de kie
// y el costo aproximado de cada modelo en Ajustes › Modelos.
// Tu IA: sin elegir, las dos tarjetas ("Conectar con Claude" / "Conectar con ChatGPT"); elegida, sus dos filas (el
// programa, con "Instalar", y la cuenta, con "Iniciar sesión") y "Cambiar de IA". Sin logos: solo iconos de lucide.
import { useState } from 'react';
import {
  ArrowLeftRight,
  ArrowUpRight,
  AudioLines,
  Clapperboard,
  Copy,
  Download,
  LogIn,
  MessageCircle,
  PenLine,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  UserRound,
  Wallet,
} from 'lucide-react';
import { BarraDeProgreso, Boton, Esqueleto, Insignia, Modal, PuntoEstado, Seccion, Tarjeta, Tooltip, useAvisos } from '../../componentes/index.js';
import { invalidar, miniatura } from '../../datos/api.js';
import { useMuestras } from '../../datos/muestras.js';
import { dinero, fechaRelativa, numero } from '../../datos/formato.js';
import {
  ENLACES_CLAVE,
  ENLACE_INSTALAR_CLAUDE,
  ENLACE_RECARGA_KIE,
  ESTILOS_DE_MUESTRA,
  MOTORES,
  apiAjustes,
  avisarConexiones,
  copiarTexto,
  mayuscula,
  otraIA,
  useMotor,
  useSaldo,
} from './datos.js';
import { CampoClave } from './piezas.jsx';
import { TarjetaChatGPTImagenes, ImagenesDeVideos } from './ChatGPTImagenes.jsx';

/**
 * Los modelos elegidos en Ajustes › Modelos (vienen de /api/estado: el catálogo + tu elección): la imagen, el video
 * de la voz en off, su respaldo y la música. Sin repetir: el mismo nombre va una sola vez.
 */
function modelosDe(estado) {
  const m = estado?.modelos || { imagen: 'GPT Image 2.5', video: 'Omni Flash 1.2', respaldo: 'Kling 3.0', musica: 'Suno' };
  return [...new Set([m.imagen, m.video, m.respaldo, m.musica].filter(Boolean))];
}

/** La clave de kie.ai (imágenes, videos y la música de fondo). */
export function ClaveKie({ estado, compacto = false, alCambiar }) {
  return (
    <CampoClave
      id="kie"
      nombre="kie.ai"
      para={compacto ? undefined : 'Imágenes, videos y la música de fondo'}
      icono={Clapperboard}
      tono="acento"
      guardada={estado ? Boolean(estado.claves?.kie) : null}
      enlace={ENLACES_CLAVE.kie}
      compacto={compacto}
      alCambiar={alCambiar}
    />
  );
}

/** La clave de ElevenLabs (la voz). */
export function ClaveElevenLabs({ estado, compacto = false, alCambiar }) {
  return (
    <CampoClave
      id="elevenlabs"
      nombre="ElevenLabs"
      para={compacto ? undefined : 'La voz de tus anuncios'}
      icono={AudioLines}
      tono="ok"
      guardada={estado ? Boolean(estado.claves?.elevenlabs) : null}
      enlace={ENLACES_CLAVE.elevenlabs}
      compacto={compacto}
      alCambiar={alCambiar}
    />
  );
}

/**
 * El saldo real de kie, junto a su clave (GET /api/saldo, una consulta gratis).
 * Junto con el costo aproximado de cada modelo (Ajustes › Modelos), es el único dinero fuera del informe de la entrega.
 */
export function SaldoKie({ guardada }) {
  const { datos, cargando, recargar } = useSaldo(guardada === true);
  const [actualizando, setActualizando] = useState(false);
  const s = datos?.kie || null;
  const tiene = typeof s?.creditos === 'number';

  const actualizar = async () => {
    setActualizando(true);
    try {
      await apiAjustes.saldo({ fresco: true });
    } catch {
      /* el error se ve al recargar */
    }
    invalidar('saldo');
    await recargar();
    setActualizando(false);
  };

  const revisando = guardada === null || (guardada && cargando && !datos);
  const detalle = revisando
    ? 'Revisando…'
    : !guardada
      ? 'Guarda tu clave de kie.ai y aquí vas a ver tu saldo.'
      : tiene
        ? [typeof s.dolares === 'number' ? `Unos ${dinero(s.dolares)}` : null, s.consultado ? `consultado ${fechaRelativa(s.consultado)}` : 'recién consultado'].filter(Boolean).join(' · ')
        : s?.error || 'No pude consultar tu saldo.';

  return (
    <div className={`saldo${tiene ? ' saldo--con-dato' : ''}${guardada && s && !tiene ? ' saldo--sin-dato' : ''}`}>
      <span className="saldo__icono" aria-hidden="true">
        <Wallet size={17} strokeWidth={2} />
      </span>
      <span className="saldo__textos">
        <span className="saldo__titulo">Tu saldo de kie.ai</span>
        <span className="saldo__detalle">{detalle}</span>
      </span>
      {revisando ? (
        <Esqueleto ancho={110} alto={28} />
      ) : tiene ? (
        <span className="saldo__valor t-num">
          {numero(s.creditos)}
          <span className="saldo__unidad">créditos</span>
        </span>
      ) : (
        <span className="saldo__pendiente">{!guardada ? 'Sin clave' : s?.motivo === 'clave-invalida' ? 'Revisa la clave' : s?.motivo === 'sin-conexion' ? 'Sin conexión' : 'Sin consultar'}</span>
      )}
      {guardada ? (
        <Tooltip texto="Volver a consultar (gratis)">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a consultar el saldo" cargando={actualizando} onClick={actualizar} />
        </Tooltip>
      ) : null}
      <a className="saldo__recargar" href={ENLACE_RECARGA_KIE} target="_blank" rel="noopener noreferrer">
        Recargar
        <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
      </a>
    </div>
  );
}

/** La ilustración de la tarjeta de tu IA: anuncios reales y un guion escribiéndose. */
function ArteGuion() {
  // las muestras de los estilos (GET /api/estilos)
  const { muestras } = useMuestras(ESTILOS_DE_MUESTRA);
  // (ninguna línea de otro anuncio: lo que se escribe es siempre de tu producto)
  const lineas = ['El gancho, escrito para tu producto.', 'La prueba y el cierre, en tu idioma.'];
  const fotos = muestras.filter((a) => a.miniatura).slice(0, 3);
  return (
    <div className="conexion-claude__arte" aria-hidden="true">
      <div className="arte-guion__abanico">
        {fotos.map((a, i) => (
          <span key={a.slug || a.clave} className={`arte-guion__carta arte-guion__carta--${i}`}>
            <img src={miniatura(a.miniatura, 200)} alt="" draggable="false" />
          </span>
        ))}
      </div>
      <div className="arte-guion__hoja">
        <div className="arte-guion__cabecera">
          <span className="arte-guion__pluma">
            <PenLine size={12} strokeWidth={2.4} />
          </span>
          Guion
          <span className="arte-guion__vivo">
            <PuntoEstado estado="generando" />
            Escribiendo
          </span>
        </div>
        <ol className="arte-guion__lineas">
          {lineas.map((l, i, todas) => (
            <li key={i} style={{ '--i': i }} className={i === todas.length - 1 ? 'es-ultima' : undefined}>
              {l}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- elegir tu IA

const OPCIONES_IA = [
  { id: 'claude', icono: Sparkles, titulo: 'Claude', texto: 'Con tu cuenta de Claude (Pro o Max).', boton: 'Conectar con Claude' },
  { id: 'codex', icono: MessageCircle, titulo: 'ChatGPT', texto: 'Con tu cuenta de ChatGPT. Usa Codex, el programa de OpenAI.', boton: 'Conectar con ChatGPT' },
];

/**
 * Las dos tarjetas iguales para elegir tu IA (una al lado de la otra; una debajo de la otra en el celular).
 * "Conectar con …" la elige y, si le falta su programa, lo empieza a instalar.
 */
export function TarjetasIA({ motor, nota = 'Las dos hacen lo mismo en la app. Puedes cambiar cuando quieras en Ajustes › Conexiones.' }) {
  const [eligiendo, setEligiendo] = useState(null);
  const conectar = async (id) => {
    setEligiendo(id);
    try {
      await motor.conectarCon(id);
    } finally {
      setEligiendo(null);
    }
  };
  return (
    <div className="ia-eleccion">
      <div className="ia-eleccion__tarjetas">
        {OPCIONES_IA.map((o) => {
          const Icono = o.icono;
          return (
            <div key={o.id} className="ia-opcion">
              <span className="ia-opcion__icono" aria-hidden="true">
                <Icono size={20} strokeWidth={2} />
              </span>
              <span className="ia-opcion__titulo">{o.titulo}</span>
              <span className="ia-opcion__texto">{o.texto}</span>
              <Boton variante="secundario" bloque cargando={eligiendo === o.id} disabled={Boolean(eligiendo) && eligiendo !== o.id} onClick={() => conectar(o.id)}>
                {o.boton}
              </Boton>
            </div>
          );
        })}
      </div>
      {nota ? <p className="ia-eleccion__nota">{nota}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- el inicio de sesión de ChatGPT

// solo se enlaza a la página oficial de OpenAI (lo demás que llegara no se convierte en un enlace)
const DE_OPENAI = /^https:\/\/auth\.openai\.com\//;
const ENLACE_CODIGO = 'https://auth.openai.com/codex/device';

/** Qué hacer mientras se inicia sesión en ChatGPT: el navegador (con sus enlaces) o el código para escribir. */
export function DetalleLoginCodex({ motor }) {
  const l = motor.login;
  if (!l?.enCurso) return null;
  const antes = motor.porPuerto ? 'No pude abrir el inicio de sesión en el navegador. Entra con un código: ' : '';
  if (l.codigo) {
    const enlace = DE_OPENAI.test(l.enlace || '') ? l.enlace : ENLACE_CODIGO;
    return (
      <span className="ia-login">
        {antes}Abre{' '}
        <a href={enlace} target="_blank" rel="noopener noreferrer" className="ia-login__enlace">
          <strong>auth.openai.com/codex/device</strong>
        </a>{' '}
        y escribe este código: <strong className="ia-login__codigo t-mono">{l.codigo}</strong>. Vence en 15 minutos.
      </span>
    );
  }
  if (motor.porPuerto || /c[oó]digo/i.test(String(l.modo || ''))) return <span className="ia-login">{antes || ''}Pidiendo tu código…</span>;
  return (
    <span className="ia-login">
      Se abrió tu navegador. Entra con tu cuenta de ChatGPT y vuelve aquí.
      <span className="ia-login__enlaces">
        {DE_OPENAI.test(l.url || '') ? (
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="ia-enlace">
            ¿No se abrió? Ábrelo aquí
          </a>
        ) : null}
        {!motor.sinCodigo ? (
          <button type="button" className="ia-enlace" onClick={() => motor.iniciarSesion({ conCodigo: true })}>
            Entrar con un código
          </button>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Por qué no se pudo iniciar sesión en ChatGPT (el último intento ya terminó), en palabras simples; null si no hay
 * nada que explicar. login.error lo deja el servidor: 'puerto', 'sin-codigo', 'tiempo', 'fallo' o 'sin-codex'.
 */
export function textoErrorLogin(motor) {
  const l = motor?.id === 'codex' ? motor.login : null;
  if (!l || l.enCurso || typeof l.error !== 'string' || !l.error) return null;
  switch (l.error) {
    case 'fallo':
    case 'sin-codex':
      return 'No pude abrir el inicio de sesión de ChatGPT. Vuelve a intentarlo.';
    case 'tiempo':
      return 'El inicio de sesión venció. Vuelve a intentarlo.';
    case 'sin-codigo':
      return motor.porPuerto ? 'No pude abrir tu navegador y tu cuenta no deja entrar con un código. Vuelve a intentarlo en un momento.' : 'Tu cuenta no deja entrar con un código. Entra con el navegador.';
    case 'puerto':
      // (la pantalla que lo pidió pasa sola al código; esto lo ve otra que no lo pidió)
      return 'No pude abrir el inicio de sesión en el navegador. Vuelve a intentarlo.';
    default:
      return /\s/.test(l.error) ? l.error : null;
  }
}

/** Los botones mientras se inicia sesión en ChatGPT: «Copiar código» (si hay) y «Cancelar». */
export function AccionesLoginCodex({ motor, tamano = 'chico' }) {
  const { aviso } = useAvisos();
  const [cancelando, setCancelando] = useState(false);
  const codigo = motor.login?.codigo;
  const copiar = async () => {
    const ok = await copiarTexto(codigo);
    aviso(ok ? { tipo: 'ok', titulo: 'Código copiado' } : { tipo: 'aviso', titulo: 'No pude copiarlo', texto: 'Escríbelo tal cual lo ves.' });
  };
  const cancelar = async () => {
    setCancelando(true);
    await motor.cancelarLogin();
    setCancelando(false);
  };
  return (
    <>
      {codigo ? (
        <Boton variante="primario" tamano={tamano} icono={Copy} onClick={copiar}>
          Copiar código
        </Boton>
      ) : null}
      <Boton variante={codigo ? 'fantasma' : 'secundario'} tamano={tamano} cargando={cancelando} onClick={cancelar}>
        Cancelar
      </Boton>
    </>
  );
}

// ---------------------------------------------------------------- las filas de tu IA

// Codex pesa unos 180 MB en Windows y unos 150 MB en la Mac
const MB_CODEX = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || '') ? 150 : 180;
export const NO_PUDE_INSTALAR = 'No pude instalarlo. Revisa tu internet y que tengas al menos 1 GB libre, y vuelve a intentarlo.';
/** Lo que se dice mientras se instala el programa de esa IA. */
export const textoInstalando = (id) =>
  id === 'codex' ? `Bajando Codex (unos ${MB_CODEX} MB). La primera vez tarda unos minutos.` : 'Instalando Claude Code con el instalador oficial…';

/** La barra del avance de la instalación (con la frase del momento y el porcentaje, si se sabe). */
export function BarraInstalando({ instalando, className = 'ia-fila__barra' }) {
  const ins = instalando || {};
  const porcentaje = Number(ins.porcentaje);
  const sabe = Number.isFinite(porcentaje) && porcentaje > 0;
  // (la frase de "Bajando…" / "Instalando…" ya está arriba de la barra: solo se suman las que siguen)
  const fase = typeof ins.fase === 'string' && ins.fase.trim() && !/^(Bajando|Instalando)\b/.test(ins.fase.trim()) ? ins.fase : undefined;
  return (
    <BarraDeProgreso
      className={className}
      tono="cian"
      grosor="fina"
      valor={sabe ? porcentaje : 0}
      indeterminada={!sabe}
      animada
      etiqueta={fase}
      mostrarValor={sabe}
    />
  );
}

/** La fila del programa de tu IA: «{programa} en esta PC», con «Instalar» y su avance. */
function FilaPrograma({ motor, revisar, revisando }) {
  const [pidiendo, setPidiendo] = useState(false);
  const esCodex = motor.id === 'codex';
  const instalar = async () => {
    setPidiendo(true);
    await motor.instalar();
    setPidiendo(false);
  };
  const botonInstalar = (texto = 'Instalar', { apagado = false, icono = Download } = {}) => (
    <Boton variante="primario" tamano="chico" icono={icono} cargando={pidiendo} disabled={apagado} onClick={instalar}>
      {texto}
    </Boton>
  );
  const aMano = !esCodex ? (
    <Boton variante="fantasma" tamano="chico" iconoDerecha={ArrowUpRight} href={ENLACE_INSTALAR_CLAUDE} target="_blank" rel="noopener noreferrer">
      Cómo instalarlo a mano
    </Boton>
  ) : null;
  // Claude Code se puede instalar a mano: "volver a revisar" lo encuentra
  const revisarClaude = !esCodex ? (
    <Tooltip texto="Ya lo instalé: volver a revisar">
      <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a revisar si está instalado" cargando={revisando} onClick={revisar} />
    </Tooltip>
  ) : null;

  let detalle;
  let acciones;
  const ok = Boolean(motor.instalado && !motor.otraVersion && !motor.instalandoAhora);
  if (motor.instalandoAhora) {
    detalle = (
      <>
        {textoInstalando(motor.id)}
        <BarraInstalando instalando={motor.instalando} />
      </>
    );
    acciones = <Insignia estado="generando" texto="Instalando" />;
  } else if (motor.instalado === null) {
    detalle = 'Revisando…';
    acciones = <Esqueleto ancho={86} alto={24} />;
  } else if (ok) {
    detalle = `Instalado${motor.version ? ` · versión ${motor.version}` : ''}`;
    acciones = <Insignia estado="listo" texto="Instalado" />;
  } else if (esCodex && motor.enUso) {
    detalle = 'ChatGPT está trabajando: espera a que termine para reinstalar Codex.';
    acciones = botonInstalar('Instalar', { apagado: true });
  } else if (motor.respaldo) {
    // un servidor de antes: Claude Code lo instala el lanzador
    detalle = 'No lo encuentro en esta PC. Cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo.';
    acciones = (
      <>
        {revisarClaude}
        {aMano}
      </>
    );
  } else if (motor.falloInstalar) {
    detalle = NO_PUDE_INSTALAR;
    acciones = (
      <>
        {aMano}
        {botonInstalar('Reintentar', { icono: RotateCcw })}
      </>
    );
  } else if (motor.otraVersion) {
    detalle = 'Hay que dejar la versión que usa la app.';
    acciones = botonInstalar();
  } else {
    detalle = 'No está en esta PC.';
    acciones = (
      <>
        {revisarClaude}
        {botonInstalar()}
      </>
    );
  }

  return (
    <div className="claude-fila">
      <span className={`claude-fila__icono${ok ? ' claude-fila__icono--ok' : ''}`} aria-hidden="true">
        <TerminalSquare size={17} strokeWidth={2} />
      </span>
      <span className="claude-fila__textos">
        <span className="claude-fila__titulo">{motor.programa} en esta PC</span>
        <span className="claude-fila__detalle">{detalle}</span>
      </span>
      <span className="claude-fila__acciones">{acciones}</span>
    </div>
  );
}

/** La fila de la cuenta: «Tu cuenta de Claude» / «Tu cuenta de ChatGPT», con «Iniciar sesión». */
function FilaCuenta({ motor, revisar, revisando }) {
  const [abriendo, setAbriendo] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const esCodex = motor.id === 'codex';
  const iniciar = async () => {
    setAbriendo(true);
    await motor.iniciarSesion();
    setAbriendo(false);
  };
  const salir = async () => {
    setSaliendo(true);
    await motor.salir();
    setSaliendo(false);
  };
  const sinPrograma = !motor.instalado || motor.otraVersion || motor.instalandoAhora;
  const botonIniciar = (variante = 'primario') => (
    <Boton variante={variante} tamano="chico" icono={LogIn} cargando={abriendo} disabled={sinPrograma} onClick={iniciar}>
      Iniciar sesión
    </Boton>
  );
  const conPlanes = `${motor.cuenta}${motor.planes ? ` (${motor.planes})` : ''}`;

  let detalle;
  let acciones;
  let notas = null;
  if (sinPrograma) {
    detalle = `Primero instala ${motor.programa} en esta PC`;
    acciones = botonIniciar('secundario');
  } else if (motor.sesion === null) {
    detalle = 'Revisando…';
    acciones = <Esqueleto ancho={110} alto={32} />;
  } else if (motor.conectado) {
    detalle = `Sesión iniciada con ${motor.cuenta}${motor.email ? ` (${motor.email})` : ''}.`;
    acciones = <Insignia estado="listo" texto="Conectada" />;
    if (esCodex) {
      notas = (
        <>
          {motor.avisoPlan ? (
            <span className="claude-fila__nota claude-fila__nota--aviso">
              Tu plan de ChatGPT ({motor.avisoPlan}) puede no incluir Codex o traer muy poco uso. Si la app te avisa que no le queda uso, revisa tu plan en chatgpt.com.
            </span>
          ) : null}
          <button type="button" className="ia-enlace ia-enlace--chico" disabled={saliendo} onClick={salir}>
            Cerrar sesión en la app
          </button>
        </>
      );
    }
  } else if (esCodex && motor.login?.enCurso) {
    detalle = <DetalleLoginCodex motor={motor} />;
    acciones = <AccionesLoginCodex motor={motor} />;
  } else if (motor.esperandoClaude) {
    detalle = 'Se abrió la ventana de Claude. Entra con tu cuenta Pro o Max y vuelve aquí.';
    acciones = (
      <Boton variante="primario" tamano="chico" icono={LogIn} cargando onClick={iniciar}>
        Esperando…
      </Boton>
    );
  } else if (motor.otraCuenta) {
    detalle = esCodex
      ? 'Codex entró con una clave de API, no con tu cuenta de ChatGPT. Inicia sesión con tu cuenta.'
      : motor.motivo || 'Tu Claude Code entró con una clave de API, no con tu cuenta de Claude. Inicia sesión con tu cuenta (Pro o Max).';
    acciones = botonIniciar();
  } else if (motor.sesion === 'desconocido') {
    detalle = 'No pude comprobar tu sesión todavía';
    acciones = (
      <>
        <Tooltip texto="Volver a revisar tu sesión">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a revisar tu sesión" cargando={revisando} onClick={revisar} />
        </Tooltip>
        {botonIniciar('secundario')}
      </>
    );
  } else {
    detalle = textoErrorLogin(motor) || `Inicia sesión con ${conPlanes}.`;
    acciones = botonIniciar();
  }

  return (
    <div className="claude-fila">
      <span className={`claude-fila__icono${motor.conectado ? ' claude-fila__icono--ok' : ''}`} aria-hidden="true">
        <UserRound size={17} strokeWidth={2} />
      </span>
      <span className="claude-fila__textos">
        <span className="claude-fila__titulo">{mayuscula(motor.cuenta)}</span>
        <span className="claude-fila__detalle">{detalle}</span>
        {notas}
      </span>
      <span className="claude-fila__acciones">{acciones}</span>
    </div>
  );
}

/**
 * Tu IA elegida en dos filas: su programa en esta PC («Instalar», con el avance) y tu cuenta («Iniciar sesión»).
 * Sin IA elegida no muestra nada (van las dos tarjetas de TarjetasIA).
 */
export function FilasMotor({ compacto = false }) {
  const motor = useMotor();
  const [revisando, setRevisando] = useState(false);
  if (!motor.elegido) return null;
  const revisar = async () => {
    setRevisando(true);
    avisarConexiones();
    await motor.recargar();
    setRevisando(false);
  };
  return (
    <div className={`claude-filas${compacto ? ' claude-filas--compacto' : ''}`}>
      <FilaPrograma motor={motor} revisar={revisar} revisando={revisando} />
      <FilaCuenta motor={motor} revisar={revisar} revisando={revisando} />
    </div>
  );
}

/** «Volver a Claude» / «Volver a ChatGPT»: deshace en un clic el cambio de IA, mientras la nueva no está lista. */
export function VolverAIA({ motor }) {
  const { aviso } = useAvisos();
  const [volviendo, setVolviendo] = useState(false);
  if (!motor.anterior || !MOTORES[motor.anterior]) return null;
  const volver = async () => {
    setVolviendo(true);
    try {
      await motor.volverA(motor.anterior);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude volver', texto: e.message });
    } finally {
      setVolviendo(false);
    }
  };
  return (
    <button type="button" className="ia-enlace" disabled={volviendo} onClick={volver}>
      Volver a {MOTORES[motor.anterior].nombre}
    </button>
  );
}

/** «Cambiar de IA»: se confirma y se elige la otra. Lo ya escrito no se pierde. */
function CambiarIA({ motor }) {
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState(null);
  const otra = MOTORES[otraIA(motor.id)].nombre;
  const cambiar = async () => {
    setCambiando(true);
    setError(null);
    try {
      await motor.elegir(otraIA(motor.id), { recordar: true });
      setAbierto(false);
    } catch (e) {
      setError(e.estado === 409 ? 'Tu IA está escribiendo algo ahora. Espera a que termine y vuelve a intentarlo.' : e.message);
    } finally {
      setCambiando(false);
    }
  };
  return (
    <>
      <Boton
        variante="secundario"
        tamano="chico"
        icono={ArrowLeftRight}
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
      >
        Cambiar de IA
      </Boton>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        tamano="chico"
        icono={ArrowLeftRight}
        titulo={`¿Cambiar a ${otra}?`}
        descripcion={`Lo que ya está escrito no se pierde. Lo nuevo lo escribe ${otra} con tu cuenta.`}
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" cargando={cambiando} onClick={cambiar}>
              Cambiar a {otra}
            </Boton>
          </>
        }
      >
        {error ? (
          <p className="ia-cambio__error" role="alert">
            {error}
          </p>
        ) : null}
      </Modal>
    </>
  );
}

/** `alElegirModelos`: lleva a la sección Modelos de Ajustes (sin él, el botón no aparece). */
export function Conexiones({ estado, recargar, alElegirModelos }) {
  const e = estado;
  const motor = useMotor();

  return (
    <Seccion
      id="conexiones"
      className="ajustes__seccion"
      titulo="Conexiones"
      descripcion="Quién escribe tus guiones, quién hace las imágenes y los videos, y quién pone la voz."
    >
      {/* Tu IA */}
      <Tarjeta variante="elevada" relleno="ninguno" className="conexion-claude">
        <ArteGuion />
        <div className="conexion-claude__cuerpo">
          <div className="conexion-claude__cabecera">
            <div className="pila" style={{ '--hueco': '6px' }}>
              <span className="t-etiqueta">Guiones y textos</span>
              <h3 className="conexion-claude__titulo">{motor.elegido ? `Tu IA: ${motor.nombre}` : 'Tu IA'}</h3>
              <p className="conexion-claude__lema">
                {motor.elegido
                  ? `Los guiones y los anuncios de imagen los escribe ${motor.nombre} con tu cuenta.`
                  : 'Tus guiones y tus anuncios de imagen los escribe una IA con tu propia cuenta. Elige la que ya usas: no necesitas ninguna clave.'}
              </p>
            </div>
            {motor.elegido && !motor.respaldo ? <CambiarIA motor={motor} /> : null}
          </div>
          {motor.revisando && !motor.elegido ? <Esqueleto alto={124} /> : motor.elegido ? <FilasMotor /> : <TarjetasIA motor={motor} nota="Las dos hacen lo mismo en la app." />}
          {motor.anterior ? (
            <p className="ia-volver">
              <VolverAIA motor={motor} />
            </p>
          ) : null}
          <p className="conexion-claude__nota">
            <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
            {motor.elegido ? `Nunca te pedimos una clave: usa tu cuenta de ${motor.nombre}.` : 'Nunca te pedimos una clave: usa tu cuenta.'}
          </p>
        </div>
      </Tarjeta>

      {/* Las imágenes de los anuncios de imagen: tu ChatGPT (sin costo por imagen) o kie.ai */}
      <TarjetaChatGPTImagenes />

      {/* Imágenes, videos y música: kie.ai, su clave y su saldo */}
      <Tarjeta className="conexion-bloque">
        <div className="conexion-bloque__cabecera">
          <div className="pila" style={{ '--hueco': '4px' }}>
            <h3 className="conexion-bloque__titulo">Videos, música e imágenes de los videos</h3>
            <p className="conexion-bloque__texto">Los hace kie.ai con tu cuenta, con los modelos de IA que elegiste:</p>
          </div>
          <div className="modelos-kie__fila">
            <span className="modelos-kie" aria-label="Modelos de IA">
              {modelosDe(e).map((m) => (
                <span key={m} className="modelos-kie__modelo">
                  {m}
                </span>
              ))}
            </span>
            {alElegirModelos ? (
              <Boton variante="fantasma" tamano="chico" icono={SlidersHorizontal} onClick={alElegirModelos}>
                Cambiar modelos
              </Boton>
            ) : null}
          </div>
        </div>
        <ImagenesDeVideos />
        <ClaveKie estado={e} alCambiar={recargar} />
        <SaldoKie guardada={e ? Boolean(e.claves?.kie) : null} />
      </Tarjeta>

      {/* Voz */}
      <Tarjeta className="conexion-bloque">
        <div className="conexion-bloque__cabecera">
          <div className="pila" style={{ '--hueco': '4px' }}>
            <h3 className="conexion-bloque__titulo">Voz</h3>
            <p className="conexion-bloque__texto">ElevenLabs pone la voz del narrador y saca los tiempos de cada palabra para los subtítulos.</p>
          </div>
        </div>
        <ClaveElevenLabs estado={e} alCambiar={recargar} />
      </Tarjeta>
    </Seccion>
  );
}
