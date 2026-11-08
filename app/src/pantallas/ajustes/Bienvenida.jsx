// La bienvenida de la primera vez: 3 pasos (tu cuenta de Claude, tus claves, tu PC) y, si ya tienes un anuncio
// terminado, el botón para estrenar el editor con él. Las ilustraciones usan las muestras de los estilos
// (GET /api/estilos). Se abre sola la primera vez (BienvenidaPrimeraVez, para App.jsx) y desde Ajustes con
// "Ver la bienvenida" (o #/ajustes?bienvenida=1).
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpenText,
  Check,
  Clapperboard,
  Cpu,
  Film,
  Globe,
  HardDrive,
  MemoryStick,
  MessageSquareText,
  PenLine,
  Play,
  Scissors,
  Server,
  Sparkles,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { Boton, Logo, Modal, PuntoEstado } from '../../componentes/index.js';
import { miniatura, useAnuncio, useAnuncios, useEstado, useEstilos } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { duracion } from '../../datos/formato.js';
import { useMuestras } from '../../datos/muestras.js';
import { ESTILOS_DE_MUESTRA, ESTILO_EJEMPLO, apiAjustes, estadoClaude, gb, useAjustes, useAlCambiarConexiones, useClaude } from './datos.js';
import { ClaveElevenLabs, ClaveKie, FilasClaude } from './Conexiones.jsx';
import { Casillas, ICONO_REVISION, TEXTO_REVISION, nombreProcesador } from './TuPC.jsx';
// ajustes.css trae las piezas que comparte con Ajustes (claves, filas de Claude, casillas): la bienvenida
// también se abre sola desde App.jsx, sin que se haya cargado la pantalla de Ajustes.
import './ajustes.css';
import './bienvenida.css';

const PASOS = [
  { id: 'claude', corto: 'Tu cuenta de Claude' },
  { id: 'claves', corto: 'Tus claves' },
  { id: 'pc', corto: 'Tu PC' },
];

// ---------------------------------------------------------------- ilustraciones (columna izquierda)

function EscenaClaude({ activa, muestras, lineas, estilo }) {
  return (
    <div className={`escena escena--claude${activa ? ' escena--activa' : ''}`} aria-hidden="true">
      <div className="escena-claude__abanico">
        {muestras.slice(0, 3).map((a, i) => (
          <span key={a.slug || a.clave} className={`escena-claude__carta escena-claude__carta--${i + 1}`}>
            {a.miniatura ? <img src={miniatura(a.miniatura, 320)} alt="" draggable="false" /> : null}
          </span>
        ))}
      </div>
      <div className="escena-claude__guion">
        <div className="escena-claude__guion-cabecera">
          <span className="escena-claude__pluma">
            <PenLine size={14} strokeWidth={2.2} />
          </span>
          <span className="escena-claude__guion-titulo">Guion · {estilo || 'Claymation'}</span>
          <span className="escena-claude__escribiendo">
            <PuntoEstado estado="generando" />
            Escribiendo
          </span>
        </div>
        <ol className="escena-claude__lineas">
          {lineas.map((l, i) => (
            <li key={i} style={{ '--i': i }}>
              <span className="escena-claude__n t-mono">{String(i + 1).padStart(2, '0')}</span>
              <span className={i === lineas.length - 1 ? 'escena-claude__ultima' : undefined}>{l}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Nodo({ icono: Icono, tono, nombre, para, ok, className }) {
  return (
    <div className={`nodo nodo--${tono} ${className}`}>
      <span className="nodo__icono">
        <Icono size={18} strokeWidth={2} />
      </span>
      <span className="nodo__textos">
        <span className="nodo__nombre">{nombre}</span>
        <span className="nodo__para">{para}</span>
      </span>
      <PuntoEstado tono={ok === null ? 'neutro' : ok ? 'ok' : 'error'} etiqueta={ok ? 'Listo' : 'Falta'} />
    </div>
  );
}

function EscenaClaves({ activa, estado }) {
  const { datos: claudeReal } = useClaude();
  const claude = estadoClaude(estado, claudeReal);
  return (
    <div className={`escena escena--claves${activa ? ' escena--activa' : ''}`} aria-hidden="true">
      <svg className="escena-claves__cables" viewBox="0 0 380 520" preserveAspectRatio="none">
        <path d="M190 262 C 190 200, 190 170, 190 128" />
        <path d="M190 262 C 150 300, 110 330, 96 392" />
        <path d="M190 262 C 230 300, 270 330, 284 392" />
      </svg>
      <div className="escena-claves__centro">
        <span className="escena-claves__aro escena-claves__aro--1" />
        <span className="escena-claves__aro escena-claves__aro--2" />
        <Logo tamano={58} />
      </div>
      <Nodo className="escena-claves__nodo--arriba" icono={PenLine} tono="cian" nombre="Claude" para="Guiones" ok={claude.revisando ? null : claude.listo || (claude.instalado && claude.sesion === 'desconocido')} />
      <Nodo className="escena-claves__nodo--izq" icono={Clapperboard} tono="acento" nombre="kie.ai" para="Imágenes y videos" ok={estado ? Boolean(estado.claves?.kie) : null} />
      <Nodo className="escena-claves__nodo--der" icono={AudioLines} tono="ok" nombre="ElevenLabs" para="Voz" ok={estado ? Boolean(estado.claves?.elevenlabs) : null} />
    </div>
  );
}

function EscenaPC({ activa, ejemplo }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (activa) {
      const p = v.play();
      if (p?.catch) p.catch(() => {});
    } else v.pause();
  }, [activa, ejemplo?.video]);
  return (
    <div className={`escena escena--pc${activa ? ' escena--activa' : ''}`} aria-hidden="true">
      <div className="escena-pc__telefono">
        {ejemplo?.video ? (
          <video
            ref={ref}
            src={ejemplo.video}
            poster={ejemplo.miniatura ? miniatura(ejemplo.miniatura, 480) : undefined}
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : ejemplo?.miniatura ? (
          <img src={miniatura(ejemplo.miniatura, 480)} alt="" />
        ) : null}
        <span className="escena-pc__brillo" />
        <span className="escena-pc__chips">
          <span className="escena-pc__chip">{ejemplo?.estiloNombre || 'Claymation'}</span>
          <span className="escena-pc__chip t-mono">{duracion(ejemplo?.duracion)}</span>
        </span>
      </div>
      <span className="escena-pc__pista">
        <span className="escena-pc__pista-video" />
        <span className="escena-pc__pista-voz" />
        <span className="escena-pc__pista-musica" />
        <span className="escena-pc__cabezal" />
      </span>
      <span className="escena-pc__etiqueta">
        <Play size={12} strokeWidth={2.4} />
        Un anuncio de ejemplo
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- pasos (columna derecha)

function PasoClaude({ estado }) {
  const { datos: estilos } = useEstilos();
  const cuantos = estilos?.estilos?.filter((e) => e.familia !== 'efecto').length || 12;
  return (
    <>
      <FilasClaude estado={estado} compacto />
      <ul className="bv-beneficios">
        <li>
          <BookOpenText size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong>Lee tu producto</strong> y arma la ficha con lo que encuentra en tu página.
          </span>
        </li>
        <li>
          <MessageSquareText size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong>Escribe el guion</strong> de cada estilo en tu idioma, todos a la vez.
          </span>
        </li>
        <li>
          <Wand2 size={16} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong>Lo cambia</strong> cuando se lo pides con tus palabras.
          </span>
        </li>
      </ul>
      <dl className="bv-cifras">
        <div>
          <dt className="t-num">{cuantos}</dt>
          <dd>estilos que ya sabe escribir</dd>
        </div>
        <div>
          <dt className="t-num">0</dt>
          <dd>claves de Anthropic que pegar</dd>
        </div>
        <div>
          <dt>1 vez</dt>
          <dd>inicias sesión y listo</dd>
        </div>
      </dl>
    </>
  );
}

function PasoClaves({ estado, recargar }) {
  return (
    <div className="pila" style={{ '--hueco': 'var(--e-4)' }}>
      <div className="pila" style={{ '--hueco': '8px' }}>
        <span className="bv-subtitulo">kie.ai hace tus imágenes, videos y música</span>
        <ClaveKie estado={estado} compacto alCambiar={recargar} />
      </div>
      <div className="pila" style={{ '--hueco': '8px' }}>
        <span className="bv-subtitulo">ElevenLabs pone la voz</span>
        <ClaveElevenLabs estado={estado} compacto alCambiar={recargar} />
      </div>
    </div>
  );
}

function PasoPC({ equipo, activo, ejemplo, alAbrirEditor }) {
  const filas = useMemo(() => {
    if (!equipo) return [];
    const rev = Object.fromEntries((equipo.revisiones || []).map((r) => [r.id, r]));
    const bien = (id) => rev[id]?.ok !== false; // lo que el servidor no revisó no se marca como falta
    const video = bien('ffmpeg') && bien('ffprobe');
    const lista = [
      { id: 'memoria', icono: MemoryStick, titulo: 'Memoria', detalle: `${equipo.memoria.nominalGB} GB · ${gb(equipo.memoria.libre, { decimales: 1 })} libres`, ok: true },
      { id: 'cpu', icono: Cpu, titulo: `${equipo.procesador.nucleos} núcleos`, detalle: nombreProcesador(equipo.procesador.modelo), ok: true },
      { id: 'disco', icono: HardDrive, titulo: 'Espacio libre', detalle: equipo.disco ? `${gb(equipo.disco.libre)} en ${equipo.disco.unidad}` : 'No pude leer el disco', ok: Boolean(equipo.disco) },
      { id: 'ffmpeg', icono: Film, titulo: TEXTO_REVISION.ffmpeg.titulo, detalle: video ? 'Instalado' : TEXTO_REVISION.ffmpeg.mal, ok: video },
      // se baja solo con el primer video: no es una falta
      { id: 'navegador', icono: Globe, titulo: TEXTO_REVISION.navegador.titulo, detalle: bien('navegador') ? 'Ya está bajado' : TEXTO_REVISION.navegador.mal, ok: true },
    ];
    // lo demás aparece solo si falta (con todo instalado se ve igual que siempre)
    for (const id of ['remotion', 'node', 'python']) {
      if (bien(id)) continue;
      const t = TEXTO_REVISION[id];
      lista.push({ id, icono: ICONO_REVISION[id] || Server, titulo: t.titulo, detalle: t.corto || t.mal, ok: false });
    }
    return lista;
  }, [equipo]);

  // las revisiones aparecen de a una, como si se fueran haciendo
  const [hechas, setHechas] = useState(0);
  useEffect(() => {
    if (!activo || !filas.length) {
      setHechas(0);
      return undefined;
    }
    setHechas(0);
    const ids = filas.map((_, i) => setTimeout(() => setHechas(i + 1), 380 + i * 360));
    return () => ids.forEach(clearTimeout);
  }, [activo, filas]);
  const terminado = filas.length > 0 && hechas >= filas.length;
  const rec = equipo?.recomendacion;
  const cifra = rec?.aLaVez ?? null;
  // "lista" solo si no falta nada obligatorio para producir (lo de Claude se ve en el paso 1)
  const obligatorioFalta = (equipo?.revisiones || []).some((r) => r.obligatorio && !r.ok && r.id !== 'claude');
  const faltaPython = (equipo?.revisiones || []).some((r) => r.id === 'python' && !r.ok);
  const nota = !terminado
    ? 'Calculando lo que aguanta tu PC…'
    : obligatorioFalta
      ? 'Faltan programas. Cierra la ventana negra y vuelve a abrir Anuncios con IA: los instala solo.'
      : faltaPython
        ? 'Tu PC está lista para producir. Falta Python (podcast en esquina, entrevista e iconos): lo instala el lanzador.'
        : 'Tu PC está lista para producir.';

  return (
    <div className="pila" style={{ '--hueco': 'var(--e-4)' }}>
      <div className="bv-revision">
        {(filas.length ? filas : PASOS).map((f, i) => {
          const lista = filas.length && i < hechas;
          return (
            <div key={f.id} className={`bv-revision__fila${lista ? ' bv-revision__fila--lista' : ''}${lista && !f.ok ? ' bv-revision__fila--falta' : ''}`}>
              <span className="bv-revision__icono" aria-hidden="true">
                {f.icono ? <f.icono size={15} strokeWidth={2} /> : null}
              </span>
              <span className="bv-revision__titulo">{f.titulo || ' '}</span>
              <span className="bv-revision__detalle t-recortar">{lista ? f.detalle : 'Revisando…'}</span>
              <span className="bv-revision__marca" aria-label={lista ? (f.ok ? 'Bien' : 'Falta') : 'Revisando'}>
                {lista ? f.ok ? <Check size={13} strokeWidth={3} /> : <TriangleAlert size={12} strokeWidth={2.6} /> : <span className="bv-revision__giro" />}
              </span>
            </div>
          );
        })}
      </div>

      <div className={`bv-resultado${terminado ? ' bv-resultado--listo' : ''}`} aria-live="polite">
        <div className="bv-resultado__texto">
          <span className="bv-resultado__cifra t-num">{cifra ?? '—'}</span>
          <span>
            <strong>{cifra === 1 ? 'anuncio a la vez' : 'anuncios a la vez'}</strong>
            <span className="bv-resultado__nota">{nota}</span>
          </span>
        </div>
        <Casillas encendidas={terminado && cifra ? cifra : 0} />
      </div>

      {/* solo con un anuncio terminado del usuario: nunca lleva a uno que no está */}
      {ejemplo ? (
        <button type="button" className="bv-ejemplo" onClick={alAbrirEditor}>
          <span className="bv-ejemplo__miniatura">
            {ejemplo.miniatura ? <img src={miniatura(ejemplo.miniatura, 160)} alt="" /> : null}
            <Scissors size={14} strokeWidth={2.2} className="bv-ejemplo__tijera" aria-hidden="true" />
          </span>
          <span className="bv-ejemplo__textos">
            <span className="bv-ejemplo__titulo">Estrena el editor con un anuncio de ejemplo</span>
            <span className="bv-ejemplo__detalle">
              {`${ejemplo.titulo} · ${ejemplo.estiloNombre} · ${duracion(ejemplo.duracion)}`} · cámbiale la música o los subtítulos y exporta
            </span>
          </span>
          <span className="bv-ejemplo__ir">
            Abrir el editor
            <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- la bienvenida

const TEXTOS = {
  claude: {
    titulo: 'Conecta tu cuenta de Claude',
    texto: 'Los guiones los escribe Claude con tu cuenta, la misma que ya usas en tu PC.',
  },
  claves: {
    titulo: 'Pega tus claves',
    texto: 'Se guardan solo en tu PC. Después aquí solo vas a ver si están guardadas o si faltan, nunca la clave.',
  },
  pc: {
    titulo: 'Revisamos tu PC y listo',
    texto: 'Miro la memoria, el procesador, el espacio y los programas que usa la app para saber cuántos anuncios puedes hacer a la vez.',
  },
};

export function Bienvenida({ abierto, onCerrar, pasoInicial = 0 }) {
  const [paso, setPaso] = useState(pasoInicial);
  const { datos: estado, recargar: recargarEstado } = useEstado();
  useAlCambiarConexiones(recargarEstado);
  const { datos: ajustes } = useAjustes();
  const { datos: lista } = useAnuncios();
  const { muestras: deEstilos } = useMuestras(ESTILOS_DE_MUESTRA);
  // la muestra que se ve en el teléfono del paso 3 (y cuyo guion se escribe en el paso 1)
  const muestra = deEstilos.find((m) => m.clave === ESTILO_EJEMPLO) || deEstilos[0] || null;
  const { datos: detalleMuestra } = useAnuncio(abierto && muestra?.slug ? muestra.slug : null);
  // El editor se estrena con un anuncio terminado del usuario: el de la muestra si es suyo y si no, el último que
  // terminó. Sin ninguno (o si no se puede abrir en el editor), el botón no aparece.
  const paraEditor = useMemo(() => {
    const listos = (lista?.anuncios || []).filter((a) => a.estado === 'listo' && !a.modoPrueba);
    return listos.find((a) => muestra?.slug && a.slug === muestra.slug) || listos[0] || null;
  }, [lista, muestra]);
  const { datos: detalleEditor } = useAnuncio(abierto && paraEditor ? paraEditor.slug : null);
  const ejemplo = paraEditor && detalleEditor?.slug === paraEditor.slug && detalleEditor.tienePlan ? detalleEditor : null;

  useEffect(() => {
    if (abierto) setPaso(pasoInicial);
  }, [abierto, pasoInicial]);

  const muestras = useMemo(() => {
    const conImagen = deEstilos.filter((m) => m.miniatura);
    return conImagen.length >= 3 ? conImagen.slice(0, 3) : (lista?.anuncios || []).filter((a) => a.miniatura).slice(0, 3);
  }, [deEstilos, lista]);

  const lineas = useMemo(() => {
    const t = (detalleMuestra?.tomas || []).map((x) => x.linea).filter(Boolean);
    // sin el guion de la muestra (la del paquete no lo trae): lo que se escribe es siempre de tu producto
    return t.length ? t.slice(0, 4) : ['El gancho, escrito para tu producto.', 'El giro que engancha, en tu idioma.', 'La prueba y el cierre, listos para grabar.'];
  }, [detalleMuestra]);

  const terminar = async ({ editor = false } = {}) => {
    try {
      await apiAjustes.marcarBienvenida(true);
    } catch {
      /* si no se pudo guardar, la próxima vez se vuelve a ver: no pasa nada */
    }
    onCerrar?.();
    if (editor && ejemplo) ir(rutas.editor(ejemplo.slug));
  };

  const id = PASOS[paso].id;
  const ultimo = paso === PASOS.length - 1;

  return (
    <Modal abierto={abierto} onCerrar={() => terminar()} tamano="grande" cerrarAfuera={false} className="bienvenida">
      <div className="bienvenida__marco">
        <div className="bienvenida__escenario">
          <span className="bienvenida__luz" data-paso={id} aria-hidden="true" />
          <EscenaClaude activa={id === 'claude'} muestras={muestras} lineas={lineas} estilo={muestra?.estiloNombre} />
          <EscenaClaves activa={id === 'claves'} estado={estado} />
          <EscenaPC activa={id === 'pc'} ejemplo={muestra} />
        </div>

        <div className="bienvenida__lado">
          <header className="bienvenida__cabecera">
            <span className="bienvenida__marca">
              <Logo tamano={22} />
              Bienvenido a <strong>anuncios-IA</strong> by Kalethabh
            </span>
            <ol className="pasos" aria-label="Pasos">
              {PASOS.map((p, i) => (
                <li key={p.id} className={`pasos__paso${i === paso ? ' pasos__paso--actual' : ''}${i < paso ? ' pasos__paso--hecho' : ''}`} aria-current={i === paso ? 'step' : undefined}>
                  <span className="pasos__numero t-num">{i < paso ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span className="pasos__texto">{p.corto}</span>
                </li>
              ))}
            </ol>
          </header>

          <div key={id} className="bienvenida__paso">
            <span className="t-etiqueta">
              Paso {paso + 1} de {PASOS.length}
            </span>
            <h2 className="bienvenida__titulo" tabIndex={-1} data-autofocus="">
              {TEXTOS[id].titulo}
            </h2>
            <p className="bienvenida__texto">{TEXTOS[id].texto}</p>
            <div className="bienvenida__contenido">
              {id === 'claude' ? <PasoClaude estado={estado} /> : null}
              {id === 'claves' ? <PasoClaves estado={estado} recargar={recargarEstado} /> : null}
              {id === 'pc' ? <PasoPC equipo={ajustes?.equipo} activo={id === 'pc'} ejemplo={ejemplo} alAbrirEditor={() => terminar({ editor: true })} /> : null}
            </div>
          </div>

          <footer className="bienvenida__pie">
            {paso === 0 ? (
              <Boton variante="fantasma" onClick={() => terminar()}>
                Ahora no
              </Boton>
            ) : (
              <Boton variante="fantasma" icono={ArrowLeft} onClick={() => setPaso((p) => p - 1)}>
                Atrás
              </Boton>
            )}
            {ultimo ? (
              <Boton variante="primario" icono={Sparkles} onClick={() => terminar()}>
                Empezar
              </Boton>
            ) : (
              <Boton variante="primario" iconoDerecha={ArrowRight} onClick={() => setPaso((p) => p + 1)}>
                Siguiente
              </Boton>
            )}
          </footer>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Se abre sola la primera vez que se usa la app (hasta que se cierra o se termina).
 * Va UNA vez en App.jsx, al lado de las pantallas:  <BienvenidaPrimeraVez />
 */
export function BienvenidaPrimeraVez() {
  const { datos } = useAjustes();
  const [cerrada, setCerrada] = useState(false);
  return <Bienvenida abierto={Boolean(datos && !datos.bienvenidaVista && !cerrada)} onCerrar={() => setCerrada(true)} />;
}

export default BienvenidaPrimeraVez;

