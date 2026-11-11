// Piezas compartidas de "Nuevo anuncio": lo que falta para que tu IA (Claude o ChatGPT) pueda trabajar, el avance en
// vivo de una tarea de tu IA (ficha o guion) y la tarjeta de lo que salió mal, con el botón que corresponde.
//
//   const motor = useMotor();                       // de ../ajustes/datos.js: { nombre, programa, listo, falta, iniciarSesion… }
//   <AvisoMotor motor={motor} para="escribir tu guion" />
//   <Progreso titulo="Claude está escribiendo tu guion" frases={progreso} suele="Suele tardar de 5 a 15 min" />
//   <TarjetaFalla error={error} que="el guion" motor={motor} onReintentar={…} />
import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Download, Hourglass, KeyRound, LoaderCircle, MessageCircle, PenLine, RotateCcw, Settings, Sparkles, TriangleAlert } from 'lucide-react';
import { BarraDeProgreso, Boton, EstadoVacio } from '../../componentes/index.js';
import { duracion as formatoDuracion } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import { MOTORES, mayuscula, useMotor } from '../ajustes/datos.js';
import { AccionesLoginCodex, BarraInstalando, DetalleLoginCodex, NO_PUDE_INSTALAR, textoErrorLogin, textoInstalando } from '../ajustes/Conexiones.jsx';
import { mensajeDe, tipoDeFalla } from './datos.js';

// ---------------------------------------------------------------- lo que falta para que tu IA trabaje

/** «Claude Code usa tu cuenta de Claude (Pro o Max).» / «Codex usa tu cuenta de ChatGPT.» */
const usaTuCuenta = (motor) => `${motor.programa} usa ${motor.cuenta}${motor.planes ? ` (${motor.planes})` : ''}`;
/** Dónde se inicia sesión: Claude abre una ventana; ChatGPT, tu navegador. */
const dondeSeAbre = (motor) => (motor.id === 'codex' ? 'tu navegador' : 'una ventana');

/** Los dos botones «Conectar con Claude» / «Conectar con ChatGPT» (eligen y, si falta el programa, lo instalan). */
function BotonesConectar({ motor }) {
  const [eligiendo, setEligiendo] = useState(null);
  const conectar = async (id) => {
    setEligiendo(id);
    await motor.conectarCon(id);
    setEligiendo(null);
  };
  return (
    <>
      <Boton variante="secundario" icono={Sparkles} cargando={eligiendo === 'claude'} disabled={Boolean(eligiendo)} onClick={() => conectar('claude')}>
        Conectar con Claude
      </Boton>
      <Boton variante="secundario" icono={MessageCircle} cargando={eligiendo === 'codex'} disabled={Boolean(eligiendo)} onClick={() => conectar('codex')}>
        Conectar con ChatGPT
      </Boton>
    </>
  );
}

/** Falta el programa de tu IA: «Instalar», con su avance (o por qué no se puede ahora). */
function FaltaPrograma({ motor, variante }) {
  const [pidiendo, setPidiendo] = useState(false);
  const esCodex = motor.id === 'codex';
  const instalar = async () => {
    setPidiendo(true);
    await motor.instalar();
    setPidiendo(false);
  };
  const aAjustes = (
    <Boton variante="secundario" icono={Settings} href={enlace.ajustes()}>
      Ir a Ajustes
    </Boton>
  );
  let descripcion = `La app usa ${motor.programa} con tu cuenta de ${motor.nombre}. Toca «Instalar»: la primera vez tarda unos minutos.`;
  let principal = (
    <Boton variante="primario" icono={Download} cargando={pidiendo} onClick={instalar}>
      Instalar
    </Boton>
  );
  let barra = null;
  if (motor.instalandoAhora) {
    descripcion = textoInstalando(motor.id);
    principal = null;
    barra = <BarraInstalando instalando={motor.instalando} className="ia-aviso__barra" />;
  } else if (esCodex && motor.enUso) {
    descripcion = 'ChatGPT está trabajando: espera a que termine para reinstalar Codex.';
    principal = (
      <Boton variante="primario" icono={Download} disabled>
        Instalar
      </Boton>
    );
  } else if (motor.respaldo) {
    // un servidor de antes: Claude Code lo instala el lanzador
    descripcion = `La app usa ${motor.programa} con tu cuenta de ${motor.nombre}. Cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo.`;
    principal = (
      <Boton variante="primario" icono={RotateCcw} onClick={motor.recargar}>
        Ya lo instalé
      </Boton>
    );
  } else if (motor.falloInstalar) {
    descripcion = NO_PUDE_INSTALAR;
    principal = (
      <Boton variante="primario" icono={RotateCcw} cargando={pidiendo} onClick={instalar}>
        Reintentar
      </Boton>
    );
  } else if (motor.otraVersion) {
    descripcion = 'Hay que dejar la versión que usa la app. Toca «Instalar»: la primera vez tarda unos minutos.';
  }
  return (
    <EstadoVacio
      variante={variante}
      tono="error"
      icono={TriangleAlert}
      titulo={`Falta ${motor.programa} en tu PC`}
      descripcion={descripcion}
      acciones={
        <>
          {principal}
          {aAjustes}
        </>
      }
    >
      {barra}
    </EstadoVacio>
  );
}

/** Lo que falta para que tu IA pueda trabajar (nada si ya está lista o si todavía no se sabe). */
export function AvisoMotor({ motor, para = 'escribir tus guiones', variante = 'compacto' }) {
  if (!motor || motor.revisando || motor.listo) return null;
  if (!motor.elegido) {
    return (
      <EstadoVacio
        variante={variante}
        tono="aviso"
        icono={Sparkles}
        titulo="Elige tu IA"
        descripcion={`Para ${para}, la app usa tu cuenta de Claude o de ChatGPT.`}
        acciones={<BotonesConectar motor={motor} />}
      />
    );
  }
  if (!motor.instalado || motor.otraVersion || motor.instalandoAhora) return <FaltaPrograma motor={motor} variante={variante} />;
  const esCodex = motor.id === 'codex';
  const titulo = `Inicia sesión con tu cuenta de ${motor.nombre}`;
  if (esCodex && motor.login?.enCurso) {
    return (
      <EstadoVacio variante={variante} tono="aviso" icono={KeyRound} titulo={titulo} descripcion={<DetalleLoginCodex motor={motor} />} acciones={<AccionesLoginCodex motor={motor} tamano="normal" />} />
    );
  }
  const descripcion = motor.otraCuenta
    ? esCodex
      ? 'Codex entró con una clave de API, no con tu cuenta de ChatGPT. Inicia sesión con tu cuenta.'
      : motor.motivo || `${usaTuCuenta(motor)}. Se abre una ventana: entras una sola vez.`
    : textoErrorLogin(motor) || `${usaTuCuenta(motor)}. Se abre ${dondeSeAbre(motor)}: entras una sola vez.`;
  return (
    <EstadoVacio
      variante={variante}
      tono="aviso"
      icono={KeyRound}
      titulo={titulo}
      descripcion={descripcion}
      acciones={
        <Boton variante="primario" icono={motor.esperando ? undefined : KeyRound} cargando={motor.esperando} onClick={() => motor.iniciarSesion()}>
          {motor.esperando ? 'Esperando tu sesión…' : `Iniciar sesión en ${motor.nombre}`}
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
 * Lo que tu IA va haciendo, en frases ("Leyendo la skill", "Escribiendo el guion"…), la última viva.
 * frases: las del servidor; pasosPropios: lo que hace la app antes (guardar, subir fotos).
 */
export function Progreso({ titulo, frases = [], inicio, suele, nota, icono: Icono = PenLine, maximo = 6 }) {
  const { nombre } = useMotor();
  const seg = useCronometro(inicio);
  const lista = frases.length ? frases : [`Arrancando ${nombre} con tu cuenta`];
  const visibles = lista.slice(-maximo);
  const antes = lista.length - visibles.length;
  // esperando su turno (tu IA hace 2 tareas a la vez): se dice arriba, y no "suele tardar…" de una tarea que no empezó
  const enFila = /^Esperando turno/i.test(lista[lista.length - 1] || '');
  if (enFila) {
    titulo = `En la fila: ${nombre} termina otra tarea y sigue con esta`;
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

/** "16:31" de la hora en que se renueva el plan de tu IA (la misma que dice el tablero). null si no se sabe. */
function horaDeReinicio(reinicio) {
  const d = reinicio ? new Date(reinicio) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * La falla de una tarea de tu IA, en palabras simples y con su botón.
 *   que: "el guion" | "la ficha" (para los textos)
 *   motor: el de useMotor() (si no viene, lo lee esta tarjeta). La IA que falló sale de error.motor; si no viene, la elegida.
 */
export function TarjetaFalla({ error, limite = false, reinicio = null, que = 'el guion', motor: motorDado, onReintentar, reintentando = false, onVolver, textoReintentar }) {
  const actual = useMotor();
  const motor = motorDado || actual;
  const tipo = tipoDeFalla(error, { limite });
  const mensaje = mensajeDe(error);
  const deLaFalla = error && typeof error === 'object' && MOTORES[error.motor] ? MOTORES[error.motor].nombre : mayuscula(motor.nombre);
  const reintentar = (variante = 'primario', texto = textoReintentar || 'Reintentar') =>
    onReintentar ? (
      <Boton variante={variante} icono={RotateCcw} cargando={reintentando} onClick={onReintentar}>
        {texto}
      </Boton>
    ) : null;

  const sinElegir = !motor.revisando && !motor.elegido;
  if (['sin-motor', 'sin-claude', 'sin-sesion'].includes(tipo) && sinElegir) {
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={Sparkles}
        titulo="Elige tu IA"
        descripcion={`Para escribir ${que}, la app usa tu cuenta de Claude o de ChatGPT. Elige una y después toca «Reintentar».`}
        acciones={
          <>
            <BotonesConectar motor={motor} />
            {reintentar('fantasma')}
          </>
        }
      />
    );
  }
  if (tipo === 'sin-sesion' && motor.elegido) {
    const esCodex = motor.id === 'codex';
    const enCurso = esCodex && motor.login?.enCurso;
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={KeyRound}
        titulo={`${motor.programa} no tiene tu sesión iniciada`}
        descripcion={
          enCurso ? (
            <DetalleLoginCodex motor={motor} />
          ) : (
            `${textoErrorLogin(motor) ? `${textoErrorLogin(motor)} ` : ''}Para escribir ${que}, ${usaTuCuenta(motor)}. Inicia sesión en ${esCodex ? 'tu navegador' : 'la ventana que se abre'} y después toca «Reintentar».`
          )
        }
        acciones={
          <>
            {enCurso ? (
              <AccionesLoginCodex motor={motor} tamano="normal" />
            ) : (
              <Boton variante="primario" icono={motor.esperando ? undefined : KeyRound} cargando={motor.esperando} onClick={() => motor.iniciarSesion()}>
                {motor.esperando ? 'Esperando tu sesión…' : `Iniciar sesión en ${motor.nombre}`}
              </Boton>
            )}
            {reintentar('secundario')}
          </>
        }
      />
    );
  }
  if (tipo === 'sin-motor' && motor.elegido) {
    // cuando se pidió todavía no había IA elegida; ahora sí
    return (
      <EstadoVacio variante="compacto" tono="aviso" icono={Sparkles} titulo={`No pude escribir ${que}`} descripcion={`Ya elegiste ${motor.nombre}: toca «Reintentar».`} acciones={reintentar()} />
    );
  }
  if (tipo === 'sin-claude' && motor.elegido) {
    return (
      <EstadoVacio
        variante="compacto"
        tono="error"
        icono={TriangleAlert}
        titulo={`Falta ${motor.programa} en tu PC`}
        descripcion={`Para escribir ${que}, la app usa ${motor.programa} con tu cuenta de ${motor.nombre}. Instálalo en Ajustes › Conexiones y vuelve a intentarlo.`}
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
  if (tipo === 'plan-sin-codex') {
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={Hourglass}
        titulo="Tu plan de ChatGPT no incluye Codex o ya no le queda uso"
        descripcion="Revisa tu plan en chatgpt.com y después toca «Reintentar». Lo ya hecho no se repite."
        acciones={reintentar()}
      />
    );
  }
  if (tipo === 'limite') {
    const hora = horaDeReinicio(reinicio);
    return (
      <EstadoVacio
        variante="compacto"
        tono="aviso"
        icono={Hourglass}
        titulo={`Tu plan de ${deLaFalla} llegó a su límite de uso`}
        descripcion={
          hora
            ? `Sigo solo a las ${hora}. Lo ya hecho no se repite.`
            : 'Se libera solo: el límite se renueva cada pocas horas (o la semana que viene, si es el tope semanal). Lo ya hecho no se repite.'
        }
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
        descripcion={`${deLaFalla} lo escribió, pero le faltó algo para poder producirlo sin errores. Vuelve a intentarlo: casi siempre sale a la segunda.`}
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
        titulo={`${deLaFalla} tardó demasiado`}
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
