// Ajustes · Conexiones: Claude (guiones con la cuenta del alumno), kie.ai (imágenes, videos y música)
// con su clave y su saldo real, y ElevenLabs para la voz.
// Las claves solo dicen "Guardada" o "Falta". El saldo de kie es el único dinero que se ve fuera de la entrega.
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, Clapperboard, LogIn, PenLine, RefreshCw, ShieldCheck, TerminalSquare, UserRound, Wallet } from 'lucide-react';
import { Boton, Esqueleto, Insignia, PuntoEstado, Seccion, Tarjeta, Tooltip, useAvisos } from '../../componentes/index.js';
import { invalidar, miniatura } from '../../datos/api.js';
import { useMuestras } from '../../datos/muestras.js';
import { dinero, fechaRelativa, numero } from '../../datos/formato.js';
import {
  ENLACES_CLAVE,
  ENLACE_INSTALAR_CLAUDE,
  ENLACE_RECARGA_KIE,
  ESTILOS_DE_MUESTRA,
  apiAjustes,
  avisarConexiones,
  estadoClaude,
  textoCuenta,
  useClaude,
  useSaldo,
} from './datos.js';
import { CampoClave } from './piezas.jsx';

/** Los modelos que usa el motor hoy (vienen de /api/estado, leídos de produccion/config.js). */
function modelosDe(estado) {
  const m = estado?.modelos || { imagen: 'GPT Image 2.5', video: 'Omni Flash 1.1', respaldo: 'Kling 3.0', musica: 'Suno' };
  return [m.imagen, m.video, m.respaldo, m.musica].filter(Boolean);
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
 * Es el único lugar de la app, fuera del informe de la entrega, donde se ve dinero.
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

/** La ilustración de la tarjeta de Claude: anuncios reales y un guion escribiéndose. */
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

// Mientras la ventana de inicio de sesión está abierta, la app vuelve a mirar cada 3 s (hasta 5 min).
const CADA_MS = 3000;
const HASTA_MS = 5 * 60 * 1000;

/**
 * Cuenta de Claude: Claude Code instalado (claude --version) y la sesión real (claude auth status,
 * por GET /api/claude/estado). "Iniciar sesión" abre la ventana oficial de Claude (POST /api/claude/login).
 */
export function FilasClaude({ estado, compacto = false }) {
  const { aviso } = useAvisos();
  const { datos: claudeReal, recargar } = useClaude();
  const c = estadoClaude(estado, claudeReal);
  const [esperando, setEsperando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const inicioEspera = useRef(0);

  // esperando el inicio de sesión: vuelve a mirar hasta que entre (o hasta 5 min)
  useEffect(() => {
    if (!esperando) return undefined;
    if (c.listo) {
      setEsperando(false);
      avisarConexiones(); // el menú y el resumen de arriba se enteran
      aviso({ tipo: 'ok', titulo: 'Claude quedó conectado', texto: 'Ya puedes cerrar la ventana de Claude. Tus guiones se escriben con tu cuenta.' });
      return undefined;
    }
    if (Date.now() - inicioEspera.current > HASTA_MS) {
      setEsperando(false);
      return undefined;
    }
    const id = setTimeout(() => {
      invalidar('claude-estado');
      recargar();
    }, CADA_MS);
    return () => clearTimeout(id);
  }, [esperando, c.listo, claudeReal, recargar, aviso]);

  const iniciar = async () => {
    setAbriendo(true);
    try {
      await apiAjustes.iniciarSesionClaude();
      inicioEspera.current = Date.now();
      setEsperando(true);
      aviso({
        tipo: 'info',
        titulo: 'Se abrió la ventana de Claude',
        texto: 'Entra con tu cuenta Pro o Max en esa ventana. Cuando termines, vuelve aquí: la app lo nota sola. La app nunca ve tu contraseña.',
      });
    } catch (err) {
      aviso({
        tipo: 'error',
        titulo: 'No pude abrir la ventana de Claude',
        texto: err.estado === 404 ? 'Esta versión de la app todavía no abre el inicio de sesión. Abre una terminal y escribe: claude auth login' : err.message,
      });
    } finally {
      setAbriendo(false);
    }
  };

  const revisar = async () => {
    setRevisando(true);
    avisarConexiones();
    await recargar();
    setRevisando(false);
  };

  const detalleSesion = !c.instalado
    ? 'Primero instala Claude Code en esta PC'
    : c.sesion === null
      ? 'Revisando…'
      : c.sesion === 'ok'
        ? textoCuenta(c.cuenta) || 'Sesión iniciada con tu cuenta de Claude'
        : c.sesion === 'sin-sesion'
          ? esperando
            ? 'Esperando que entres en la ventana de Claude…'
            : c.motivo || 'Entras una sola vez con tu cuenta Pro o Max'
          : 'No pude comprobar tu sesión todavía';

  return (
    <div className={`claude-filas${compacto ? ' claude-filas--compacto' : ''}`}>
      <div className="claude-fila">
        <span className={`claude-fila__icono${c.instalado ? ' claude-fila__icono--ok' : ''}`} aria-hidden="true">
          <TerminalSquare size={17} strokeWidth={2} />
        </span>
        <span className="claude-fila__textos">
          <span className="claude-fila__titulo">Claude Code en esta PC</span>
          <span className="claude-fila__detalle">
            {c.instalado === null ? 'Revisando…' : c.instalado ? `Instalado · versión ${c.version || '—'}` : 'No lo encuentro en esta PC. Cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo.'}
          </span>
        </span>
        {c.instalado === null ? (
          <Esqueleto ancho={86} alto={24} />
        ) : c.instalado ? (
          <Insignia estado="listo" texto="Instalado" />
        ) : (
          <span className="claude-fila__acciones">
            <Tooltip texto="Ya lo instalé: volver a revisar">
              <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a revisar si está instalado" cargando={revisando} onClick={revisar} />
            </Tooltip>
            <Boton variante="primario" tamano="chico" iconoDerecha={ArrowUpRight} href={ENLACE_INSTALAR_CLAUDE} target="_blank" rel="noopener noreferrer">
              Cómo instalarlo
            </Boton>
          </span>
        )}
      </div>
      <div className="claude-fila">
        <span className={`claude-fila__icono${c.listo ? ' claude-fila__icono--ok' : ''}`} aria-hidden="true">
          <UserRound size={17} strokeWidth={2} />
        </span>
        <span className="claude-fila__textos">
          <span className="claude-fila__titulo">Tu cuenta de Claude</span>
          <span className="claude-fila__detalle">{detalleSesion}</span>
        </span>
        {c.instalado && c.sesion === null ? (
          <Esqueleto ancho={110} alto={32} />
        ) : c.listo ? (
          <Insignia estado="listo" texto="Conectada" />
        ) : c.instalado && c.sesion === 'desconocido' ? (
          <span className="claude-fila__acciones">
            <Tooltip texto="Volver a revisar tu sesión">
              <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta="Volver a revisar tu sesión" cargando={revisando} onClick={revisar} />
            </Tooltip>
            <Boton variante="secundario" tamano="chico" icono={LogIn} cargando={abriendo} onClick={iniciar}>
              Iniciar sesión
            </Boton>
          </span>
        ) : (
          <Boton variante={c.instalado ? 'primario' : 'secundario'} tamano="chico" icono={LogIn} cargando={abriendo || esperando} onClick={iniciar} disabled={!c.instalado}>
            {esperando ? 'Esperando…' : 'Iniciar sesión'}
          </Boton>
        )}
      </div>
    </div>
  );
}

export function Conexiones({ estado, recargar }) {
  const e = estado;

  return (
    <Seccion
      id="conexiones"
      className="ajustes__seccion"
      titulo="Conexiones"
      descripcion="Quién escribe tus guiones, quién hace las imágenes y los videos, y quién pone la voz."
    >
      {/* Claude */}
      <Tarjeta variante="elevada" relleno="ninguno" className="conexion-claude">
        <ArteGuion />
        <div className="conexion-claude__cuerpo">
          <div className="conexion-claude__cabecera">
            <div className="pila" style={{ '--hueco': '6px' }}>
              <span className="t-etiqueta">Guiones</span>
              <h3 className="conexion-claude__titulo">Claude</h3>
              <p className="conexion-claude__lema">Los guiones los escribe Claude con tu cuenta, la misma que ya usas.</p>
            </div>
          </div>
          <FilasClaude estado={e} />
          <p className="conexion-claude__nota">
            <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
            Nunca te pedimos una clave de Anthropic: usa el Claude Code que ya tienes.
          </p>
        </div>
      </Tarjeta>

      {/* Imágenes, videos y música: kie.ai, su clave y su saldo */}
      <Tarjeta className="conexion-bloque">
        <div className="conexion-bloque__cabecera">
          <div className="pila" style={{ '--hueco': '4px' }}>
            <h3 className="conexion-bloque__titulo">Imágenes, videos y música</h3>
            <p className="conexion-bloque__texto">Los hace kie.ai con tu cuenta, con estos modelos de IA:</p>
          </div>
          <span className="modelos-kie" aria-label="Modelos de IA">
            {modelosDe(e).map((m) => (
              <span key={m} className="modelos-kie__modelo">
                {m}
              </span>
            ))}
          </span>
        </div>
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
