// Piezas compartidas de "Nuevo anuncio": la sesión de Claude Code, el avance en vivo de una tarea de
// Claude (ficha o guion) y la tarjeta de lo que salió mal, con el botón que corresponde.
//
//   const claude = useSesionClaude();               // { estado, listo, iniciar, esperando }
//   <AvisoClaude claude={claude} para="escribir tu guion" />
//   <Progreso titulo="Claude está escribiendo tu guion" frases={progreso} suele="Suele tardar de 5 a 15 min" />
//   <TarjetaFalla error={error} que="el guion" onReintentar={…} />
import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Hourglass, KeyRound, LoaderCircle, PenLine, RotateCcw, Settings, TriangleAlert } from 'lucide-react';
import { BarraDeProgreso, Boton, EstadoVacio, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, useClaudeEstado } from '../../datos/api.js';
import { duracion as formatoDuracion } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import { mensajeDe, tipoDeFalla } from './datos.js';

// ---------------------------------------------------------------- la sesión de Claude Code

/**
 * Si Claude Code está instalado y tiene la sesión de la cuenta de Claude del usuario.
 * `iniciar()` abre "claude auth login" en una ventana y se queda mirando hasta que la sesión aparece.
 */
export function useSesionClaude() {
  const [esperando, setEsperando] = useState(false);
  const { datos, error, recargar } = useClaudeEstado({ cadaMs: esperando ? 3000 : undefined });
  const { aviso } = useAvisos();
  const desde = useRef(0);

  useEffect(() => {
    if (!esperando) return;
    if (datos?.sesion === 'ok') {
      setEsperando(false);
      aviso({ tipo: 'ok', titulo: 'Listo, ya tienes tu sesión de Claude', texto: 'Claude Code escribe con tu cuenta. Puedes seguir.' });
    } else if (Date.now() - desde.current > 10 * 60 * 1000) setEsperando(false); // a los 10 min deja de mirar
  }, [datos, esperando, aviso]);

  const iniciar = async () => {
    try {
      await apiNuevo.iniciarSesionClaude();
      desde.current = Date.now();
      setEsperando(true);
      aviso({
        tipo: 'info',
        titulo: 'Se abrió una ventana para iniciar sesión',
        texto: 'Entra con tu cuenta de Claude (Pro o Max). Cuando termines, vuelve aquí: la app lo nota sola.',
        duracion: 9000,
      });
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude abrir el inicio de sesión', texto: e.message });
    }
  };

  const listo = Boolean(datos?.instalado) && datos?.sesion !== 'sin-sesion';
  return {
    estado: datos,
    error,
    listo,
    esperando,
    iniciar,
    recargar: () => {
      invalidar('claude-estado');
      return recargar();
    },
  };
}

/** Lo que falta para que Claude Code pueda trabajar (nada si ya está listo). */
export function AvisoClaude({ claude, para = 'escribir tu guion', variante = 'compacto' }) {
  const e = claude.estado;
  if (!e || claude.listo) return null;
  if (!e.instalado) {
    return (
      <EstadoVacio
        variante={variante}
        tono="error"
        icono={TriangleAlert}
        titulo="Falta Claude Code en tu PC"
        descripcion={`Para ${para}, la app usa Claude Code con tu propia cuenta de Claude. Cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo.`}
        acciones={
          <>
            <Boton variante="primario" icono={Settings} href={enlace.ajustes()}>
              Ir a Ajustes
            </Boton>
            <Boton variante="secundario" icono={RotateCcw} onClick={claude.recargar}>
              Ya lo instalé
            </Boton>
          </>
        }
      />
    );
  }
  return (
    <EstadoVacio
      variante={variante}
      tono="aviso"
      icono={KeyRound}
      titulo="Inicia sesión con tu cuenta de Claude"
      descripcion={`Para ${para}, Claude Code usa tu cuenta de Claude (Pro o Max), sin claves aparte. Se abre una ventana: entra con tu cuenta y vuelve aquí.`}
      acciones={
        <Boton variante="primario" icono={claude.esperando ? undefined : KeyRound} cargando={claude.esperando} onClick={claude.iniciar}>
          {claude.esperando ? 'Esperando tu sesión…' : 'Iniciar sesión en Claude'}
        </Boton>
      }
    />
  );
}

// ---------------------------------------------------------------- avance en vivo

/** Segundos desde `inicio` (ISO o ms), contando cada segundo. Sin inicio, desde que se montó. */
function useCronometro(inicio) {
  const base = useRef(inicio ? new Date(inicio).getTime() || Date.now() : Date.now());
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (inicio) base.current = new Date(inicio).getTime() || base.current;
  }, [inicio]);
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, (ahora - base.current) / 1000);
}

/**
 * Lo que Claude va haciendo, en frases ("Leyendo la skill", "Escribiendo el guion"…), la última viva.
 * frases: las del servidor; pasosPropios: lo que hace la app antes (guardar, subir fotos).
 */
export function Progreso({ titulo, frases = [], inicio, suele, nota, icono: Icono = PenLine, maximo = 6 }) {
  const seg = useCronometro(inicio);
  const lista = frases.length ? frases : ['Arrancando Claude Code con tu cuenta'];
  const visibles = lista.slice(-maximo);
  const antes = lista.length - visibles.length;
  // esperando su turno (Claude hace 2 tareas a la vez): se dice arriba, y no "suele tardar…" de una tarea que no empezó
  const enFila = /^Esperando turno/i.test(lista[lista.length - 1] || '');
  if (enFila) {
    titulo = 'En la fila: Claude termina otra tarea y sigue con esta';
    suele = 'empieza sola apenas se libere';
  }
  return (
    <div className="nv-progreso">
      <div className="nv-progreso__cabecera">
        <span className="nv-progreso__icono" aria-hidden="true">
          <Icono size={20} strokeWidth={1.9} />
        </span>
        <div className="nv-progreso__textos">
          <h3 className="nv-progreso__titulo">{titulo}</h3>
          <p className="nv-progreso__sub">
            <span className="t-num">Lleva {formatoDuracion(seg)}</span>
            {suele ? <> · {suele}</> : null}
          </p>
        </div>
      </div>
      <BarraDeProgreso indeterminada tono="cian" grosor="fina" />
      <ol className="nv-analisis nv-progreso__lista" aria-live="polite">
        {antes > 0 ? <li className="nv-progreso__antes">{antes === 1 ? 'Ya hizo 1 paso más' : `Ya hizo ${antes} pasos más`}</li> : null}
        {visibles.map((f, i) => {
          const viva = i === visibles.length - 1;
          return (
            <li key={`${antes + i}-${f}`} className={`nv-analisis__paso nv-analisis__paso--${viva ? 'activo' : 'hecho'}`}>
              <span className="nv-analisis__icono" aria-hidden="true">
                {viva ? <LoaderCircle size={14} strokeWidth={2.4} className="girando" /> : <Check size={14} strokeWidth={2.4} />}
              </span>
              {f}
            </li>
          );
        })}
      </ol>
      {nota ? <p className="nv-progreso__nota">{nota}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- lo que salió mal

/** "16:31" de la hora en que se renueva el plan de Claude (la misma que dice el tablero). null si no se sabe. */
function horaDeReinicio(reinicio) {
  const d = reinicio ? new Date(reinicio) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * La falla de una tarea de Claude, en palabras simples y con su botón.
 *   que: "el guion" | "la ficha" (para los textos)
 */
export function TarjetaFalla({ error, limite = false, reinicio = null, que = 'el guion', claude, onReintentar, reintentando = false, onVolver, textoReintentar }) {
  const tipo = tipoDeFalla(error, { limite });
  const mensaje = mensajeDe(error);
  const reintentar = (variante = 'primario', texto = textoReintentar || 'Reintentar') =>
    onReintentar ? (
      <Boton variante={variante} icono={RotateCcw} cargando={reintentando} onClick={onReintentar}>
        {texto}
      </Boton>
    ) : null;

  if (tipo === 'sin-sesion') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={KeyRound}
        titulo="Claude Code no tiene tu sesión iniciada"
        descripcion={`Para escribir ${que}, Claude Code usa tu cuenta de Claude (Pro o Max). Inicia sesión en la ventana que se abre y después toca «Reintentar».`}
        acciones={
          <>
            {claude ? (
              <Boton variante="primario" icono={claude.esperando ? undefined : KeyRound} cargando={claude.esperando} onClick={claude.iniciar}>
                {claude.esperando ? 'Esperando tu sesión…' : 'Iniciar sesión en Claude'}
              </Boton>
            ) : null}
            {reintentar('secundario')}
          </>
        }
      />
    );
  }
  if (tipo === 'sin-claude') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="error"
        icono={TriangleAlert}
        titulo="Falta Claude Code en tu PC"
        descripcion={`Para escribir ${que}, la app usa Claude Code con tu cuenta de Claude. Instálalo (en Ajustes te dice cómo) y vuelve a intentarlo.`}
        acciones={
          <>
            <Boton variante="primario" icono={Settings} href={enlace.ajustes()}>
              Ir a Ajustes
            </Boton>
            {reintentar('secundario')}
          </>
        }
      />
    );
  }
  if (tipo === 'limite') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={Hourglass}
        titulo="Tu plan de Claude llegó a su límite de uso"
        descripcion={`${horaDeReinicio(reinicio) ? `Se libera solo: se renueva a las ${horaDeReinicio(reinicio)}.` : 'Se libera solo: el límite se renueva cada pocas horas (o la semana que viene, si es el tope semanal).'} Todo lo que hiciste queda guardado; vuelve a intentarlo después.`}
        acciones={reintentar('secundario', 'Intentarlo de nuevo')}
      />
    );
  }
  if (tipo === 'bloqueo') {
    const faltan = Array.isArray(error?.faltan) ? error.faltan : [];
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={CircleAlert}
        titulo={`Me falta un dato para escribir ${que}`}
        descripcion={error?.motivo || mensaje || 'Hay algo de tu producto que no puedo inventar.'}
        acciones={
          <>
            {onVolver ? (
              <Boton variante="primario" onClick={onVolver}>
                Completarlo en tu producto
              </Boton>
            ) : null}
            {reintentar('secundario')}
          </>
        }
      >
        {faltan.length ? (
          <ul className="nv-falla__faltan">
            {faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
      </EstadoVacio>
    );
  }
  if (tipo === 'no-valido') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="error"
        icono={TriangleAlert}
        titulo={`${que[0].toUpperCase()}${que.slice(1)} no pasó la revisión de la app`}
        descripcion="Claude lo escribió, pero le faltó algo para poder producirlo sin errores. Vuelve a intentarlo: casi siempre sale a la segunda."
        acciones={reintentar('primario', 'Volver a escribirlo')}
      />
    );
  }
  if (tipo === 'tiempo') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="error"
        icono={Hourglass}
        titulo="Claude tardó demasiado"
        descripcion="Lo corté para que no quedara trabado. Vuelve a intentarlo; si se repite, revisa tu conexión a internet."
        acciones={reintentar()}
      />
    );
  }
  return (
    <EstadoVacio
      variante="compacto"
      tono="error"
      icono={TriangleAlert}
      titulo={`No pude escribir ${que}`}
      descripcion={mensaje || 'Algo salió mal. Vuelve a intentarlo.'}
      acciones={reintentar()}
    />
  );
}
