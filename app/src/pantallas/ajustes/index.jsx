// Ajustes (#/ajustes): Conexiones, Tu PC y Acerca de, con un índice a la izquierda.
// #/ajustes?bienvenida=1 abre la bienvenida de la primera vez.
// Preferencias (idioma, mercado y subtítulos por defecto) se quitó: el idioma y el mercado salen de la ficha de cada
// producto y los subtítulos se cambian en el editor (Diego, 2026-10-26: "si no se va a usar, hay que quitarlo").
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Cpu, Info, PlugZap, Sparkles, Wallet } from 'lucide-react';
import { Boton, CabeceraPagina, PuntoEstado, useAvisos } from '../../componentes/index.js';
import { useEstado } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { idioma as nombreIdioma } from '../../datos/formato.js';
import { apiAjustes, estadoClaude, useAjustes, useAlCambiarConexiones, useClaude } from './datos.js';
import { Conexiones } from './Conexiones.jsx';
import { TuPC } from './TuPC.jsx';
import { AcercaDe } from './AcercaDe.jsx';
import { Inversion } from './Inversion.jsx';
import { Guardado } from './Guardado.jsx';
import { Bienvenida } from './Bienvenida.jsx';
import { ESTILOS_SUBTITULOS } from './Subtitulos.jsx';
import './ajustes.css';

const SECCIONES = [
  { id: 'conexiones', texto: 'Conexiones', icono: PlugZap },
  { id: 'tu-pc', texto: 'Tu PC', icono: Cpu },
  { id: 'guardado', texto: 'Guardado', icono: Cloud },
  { id: 'inversion', texto: 'Inversión', icono: Wallet },
  { id: 'acerca', texto: 'Acerca de', icono: Info },
];

function Indice({ activa, metas, alIr }) {
  return (
    <nav className="indice" aria-label="Secciones de ajustes">
      {SECCIONES.map((s) => {
        const Icono = s.icono;
        const meta = metas[s.id];
        return (
          <button key={s.id} type="button" className={`indice__item${activa === s.id ? ' indice__item--activo' : ''}`} aria-current={activa === s.id ? 'true' : undefined} onClick={() => alIr(s.id)}>
            <span className="indice__icono" aria-hidden="true">
              <Icono size={16} strokeWidth={2} />
            </span>
            <span className="indice__textos">
              <span className="indice__texto">{s.texto}</span>
              {meta ? (
                <span className="indice__meta">
                  {meta.tono ? <PuntoEstado tono={meta.tono} /> : null}
                  {meta.texto}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default function Ajustes({ consulta }) {
  const { datos: estado, recargar: recargarEstado } = useEstado();
  useAlCambiarConexiones(recargarEstado);
  const { datos: claudeReal } = useClaude();
  const { datos: ajustesServidor, recargar } = useAjustes();
  const { aviso } = useAvisos();
  const [cambiosLocales, setCambiosLocales] = useState({});
  const [activa, setActiva] = useState('conexiones');
  const [bienvenida, setBienvenida] = useState(() => consulta?.has('bienvenida') || false);
  const contenedor = useRef(null);

  // lo que el usuario acaba de elegir se ve al instante, sin esperar al servidor
  const ajustes = useMemo(() => {
    if (!ajustesServidor) return null;
    return { ...ajustesServidor, preferencias: { ...ajustesServidor.preferencias, ...cambiosLocales } };
  }, [ajustesServidor, cambiosLocales]);

  const guardarPreferencia = useCallback(
    async (cambio) => {
      setCambiosLocales((c) => ({ ...c, ...cambio }));
      try {
        await apiAjustes.guardarPreferencias(cambio);
        await recargar();
        setCambiosLocales((c) => {
          const n = { ...c };
          for (const k of Object.keys(cambio)) delete n[k];
          return n;
        });
        const k = Object.keys(cambio)[0];
        const textos = {
          subtitulos: () => `Tus anuncios nuevos salen con subtítulos ${ESTILOS_SUBTITULOS.find((s) => s.id === cambio.subtitulos)?.nombre || ''}.`,
          idioma: () => `Los guiones nuevos se escriben en ${nombreIdioma(cambio.idioma).toLowerCase()}.`,
          mercado: () => 'Los guiones nuevos se piensan para ese mercado.',
          aLaVez: () => (cambio.aLaVez === 'auto' ? 'La app decide cuántos anuncios hace a la vez.' : `La app hace hasta ${cambio.aLaVez} a la vez.`),
        };
        aviso({ tipo: 'ok', titulo: 'Guardado', texto: textos[k]?.() });
      } catch (err) {
        setCambiosLocales({});
        aviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: err.message });
      }
    },
    [aviso, recargar]
  );

  // el índice sigue la sección que se está leyendo
  useEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return undefined;
    const secciones = SECCIONES.map((s) => raiz.querySelector(`#${s.id}`)).filter(Boolean);
    if (!secciones.length) return undefined;
    // la que ya pasó la línea de lectura (42 % de la ventana); la última es corta y nunca llega arriba,
    // así que al tocar el fondo de la página es la que se está leyendo
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const fondo = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (fondo) return setActiva(secciones[secciones.length - 1].id);
      const linea = window.innerHeight * 0.42;
      let actual = secciones[0];
      for (const s of secciones) if (s.getBoundingClientRect().top <= linea) actual = s;
      setActiva(actual.id);
    };
    const alDesplazar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      if (cuadro) cancelAnimationFrame(cuadro);
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, []);

  const irA = (id) => {
    setActiva(id);
    const el = contenedor.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // #/ajustes?bienvenida=1 también la abre si ya estabas en Ajustes (la pantalla no se vuelve a montar)
  const pideBienvenida = consulta?.has('bienvenida') || false;
  useEffect(() => {
    if (pideBienvenida) setBienvenida(true);
  }, [pideBienvenida]);

  const abrirBienvenida = () => setBienvenida(true);
  const cerrarBienvenida = () => {
    setBienvenida(false);
    if (consulta?.has('bienvenida')) ir(rutas.ajustes(), { reemplazar: true });
  };

  // ---------------------------------------------------------------- resumen de arriba
  // Claude: instalado (claude --version) y con la sesión iniciada (claude auth status). Si la sesión
  // no se pudo comprobar, queda "Sin comprobar" en gris, nunca "Falta".
  const claude = estadoClaude(estado, claudeReal);
  const conexiones = estado
    ? [
        { nombre: 'Claude', ok: Boolean(claude.instalado) && claude.sesion !== 'sin-sesion', sinComprobar: Boolean(claude.instalado) && !claude.listo },
        { nombre: 'kie.ai', ok: Boolean(estado.claves?.kie) },
        { nombre: 'ElevenLabs', ok: Boolean(estado.claves?.elevenlabs) },
      ]
    : null;
  const faltan = conexiones ? conexiones.filter((c) => !c.ok).length : 0;
  const sinComprobar = conexiones ? conexiones.filter((c) => c.ok && c.sinComprobar).length : 0;
  const listas = conexiones ? conexiones.filter((c) => c.ok && !c.sinComprobar).length : 0;
  const titulo = !conexiones
    ? 'Ajustes'
    : faltan
      ? `Te ${faltan === 1 ? 'falta' : 'faltan'} ${faltan} ${faltan === 1 ? 'conexión' : 'conexiones'}`
      : sinComprobar
        ? 'Casi todo listo para crear'
        : 'Todo listo para crear';

  const metas = {
    conexiones: conexiones
      ? {
          tono: faltan ? 'error' : sinComprobar ? 'neutro' : 'ok',
          texto: faltan ? `Falta${faltan === 1 ? "" : "n"} ${faltan}` : sinComprobar ? `${listas} listas · ${sinComprobar} sin comprobar` : `${listas} de ${conexiones.length} listas`,
        }
      : null,
    'tu-pc': ajustes?.equipo ? { texto: `${ajustes.produccion?.ahora ?? ajustes.equipo.recomendacion.aLaVez ?? 1} a la vez` } : null,
    acerca: ajustes?.app?.version ? { texto: `Versión ${ajustes.app.version}` } : null,
  };

  return (
    <div className="pagina ajustes">
      <CabeceraPagina
        sobretitulo="Ajustes"
        titulo={titulo}
        descripcion="Tus conexiones y tu PC. Tus claves nunca se muestran: solo si están guardadas o faltan."
        extra={
          conexiones ? (
            <div className="ajustes__resumen">
              {conexiones.map((c) => {
                const estadoTexto = !c.ok ? 'Falta' : c.sinComprobar ? 'Sin comprobar' : 'Listo';
                return (
                  <span key={c.nombre} className={`ajustes__pastilla${c.ok ? '' : ' ajustes__pastilla--falta'}${c.ok && c.sinComprobar ? ' ajustes__pastilla--neutra' : ''}`}>
                    <PuntoEstado tono={!c.ok ? 'error' : c.sinComprobar ? 'neutro' : 'ok'} etiqueta={estadoTexto} />
                    {c.nombre}
                    <span className="ajustes__pastilla-estado">{estadoTexto}</span>
                  </span>
                );
              })}
            </div>
          ) : null
        }
        acciones={
          <Boton variante="secundario" icono={Sparkles} onClick={abrirBienvenida}>
            Ver la bienvenida
          </Boton>
        }
      />

      <div className="ajustes__cuerpo" ref={contenedor}>
        <aside className="ajustes__indice">
          <Indice activa={activa} metas={metas} alIr={irA} />
        </aside>
        <div className="ajustes__secciones">
          <Conexiones estado={estado} recargar={recargarEstado} />
          <TuPC ajustes={ajustes} recargar={recargar} alCambiarALaVez={(v) => guardarPreferencia({ aLaVez: v })} />
          <Guardado />
          <Inversion />
          <AcercaDe ajustes={ajustes} alVerBienvenida={abrirBienvenida} />
        </div>
      </div>

      <Bienvenida abierto={bienvenida} onCerrar={cerrarBienvenida} />
    </div>
  );
}
