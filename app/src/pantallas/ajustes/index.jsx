// Ajustes (#/ajustes): una sección a la vez (Conexiones, Modelos, Tu PC, Guardado, Inversión, Apariencia, Acerca de),
// elegida en el menú de la izquierda (arriba en pantallas angostas). #/ajustes?seccion=modelos abre esa sección.
// #/ajustes?bienvenida=1 abre la bienvenida de la primera vez.
// (Rediseño 2026-11-16: antes eran las siete secciones una debajo de otra, unos 5.400 px de página.)
// Preferencias (idioma, mercado y subtítulos por defecto) se quitó: el idioma y el mercado salen de la ficha de cada
// producto y los subtítulos se cambian en el editor (Diego, 2026-10-26: "si no se va a usar, hay que quitarlo").
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Cloud, Send, Cpu, Info, SunMoon, PlugZap, SlidersHorizontal, Sparkles, Wallet } from 'lucide-react';
import { Boton, CabeceraPagina, PuntoEstado, useAvisos } from '../../componentes/index.js';
import { useEstado } from '../../datos/api.js';
import { ir, rutas } from '../../datos/rutas.js';
import { idioma as nombreIdioma } from '../../datos/formato.js';
import { apiAjustes, mayuscula, useAjustes, useAlCambiarConexiones, useMotor } from './datos.js';
import { Conexiones } from './Conexiones.jsx';
import { Modelos, resumenModelos } from './Modelos.jsx';
import { TuPC } from './TuPC.jsx';
import { AcercaDe } from './AcercaDe.jsx';
import { Inversion } from './Inversion.jsx';
import { Apariencia } from './Apariencia.jsx';
import { Guardado } from './Guardado.jsx';
import { Conector } from './Conector.jsx';
import { Telegram } from './Telegram.jsx';
import { Bienvenida } from './Bienvenida.jsx';
import { ESTILOS_SUBTITULOS } from './Subtitulos.jsx';
import './ajustes.css';

const SECCIONES = [
  { id: 'conexiones', texto: 'Conexiones', icono: PlugZap },
  { id: 'modelos', texto: 'Modelos', icono: SlidersHorizontal },
  { id: 'tu-pc', texto: 'Tu PC', icono: Cpu },
  { id: 'guardado', texto: 'Guardado', icono: Cloud },
  { id: 'inversion', texto: 'Inversión', icono: Wallet },
  { id: 'telegram', texto: 'Telegram', icono: Send },
  { id: 'conector', texto: 'Conector para Claude', icono: Bot },
  { id: 'apariencia', texto: 'Apariencia', icono: SunMoon },
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
  const motor = useMotor();
  const { datos: ajustesServidor, recargar } = useAjustes();
  const { aviso } = useAvisos();
  const [cambiosLocales, setCambiosLocales] = useState({});
  const [modelosLocales, setModelosLocales] = useState({});
  const [guardandoModelo, setGuardandoModelo] = useState(null);
  const pedida = consulta?.get('seccion');
  const [activa, setActiva] = useState(() => (SECCIONES.some((s) => s.id === pedida) ? pedida : 'conexiones'));
  const [bienvenida, setBienvenida] = useState(() => consulta?.has('bienvenida') || false);
  const contenedor = useRef(null);

  // lo que el usuario acaba de elegir se ve al instante, sin esperar al servidor
  const ajustes = useMemo(() => {
    if (!ajustesServidor) return null;
    const m = ajustesServidor.modelos;
    return {
      ...ajustesServidor,
      preferencias: { ...ajustesServidor.preferencias, ...cambiosLocales },
      modelos: m ? { ...m, eleccion: { ...m.eleccion, ...modelosLocales } } : m,
    };
  }, [ajustesServidor, cambiosLocales, modelosLocales]);

  // Modelos: guarda al cambiar. Vale para los anuncios nuevos (uno ya empezado sigue con los suyos).
  const guardarModelo = useCallback(
    async (categoriaId, opcionId) => {
      const categoria = ajustesServidor?.modelos?.categorias?.find((c) => c.id === categoriaId);
      const opcion = categoria?.opciones?.find((o) => o.id === opcionId);
      setModelosLocales((c) => ({ ...c, [categoriaId]: opcionId }));
      setGuardandoModelo(categoriaId);
      try {
        await apiAjustes.guardarModelos({ [categoriaId]: opcionId });
        await Promise.all([recargar(), recargarEstado()]);
        aviso({
          tipo: 'ok',
          titulo: 'Guardado',
          texto: categoria && opcion ? `${categoria.nombre}: tus anuncios nuevos usan ${opcion.nombre}. Los que ya empezaste siguen igual.` : 'Tus anuncios nuevos usan ese modelo.',
        });
      } catch (err) {
        aviso({ tipo: 'error', titulo: 'No se pudo guardar', texto: err.message });
      } finally {
        setModelosLocales((c) => {
          const n = { ...c };
          delete n[categoriaId];
          return n;
        });
        setGuardandoModelo(null);
      }
    },
    [ajustesServidor, aviso, recargar, recargarEstado]
  );

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

  // #/ajustes?seccion=<id> (un enlace de otra pantalla, o volver atrás) elige la sección
  useEffect(() => {
    if (pedida && SECCIONES.some((s) => s.id === pedida)) setActiva(pedida);
  }, [pedida]);

  // en pantallas angostas el menú es una fila que se desplaza: la sección elegida queda a la vista
  useEffect(() => {
    contenedor.current?.querySelector('.indice__item--activo')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activa]);

  const irA = (id) => {
    setActiva(id);
    ir(`${rutas.ajustes()}?seccion=${id}`, { reemplazar: true });
    window.scrollTo({ top: 0 });
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
  // Tu IA: elegida, instalada y con la sesión iniciada. Si la sesión no se pudo comprobar (o todavía se está
  // revisando), queda "Sin comprobar" en gris, nunca "Falta".
  const conexiones = estado
    ? [
        { nombre: mayuscula(motor.nombre) || 'Tu IA', ok: motor.revisando || motor.listo, sinComprobar: motor.revisando || (motor.listo && !motor.conectado) },
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
    modelos: (() => {
      const { recomendados, total } = resumenModelos(ajustes?.modelos);
      if (!total) return null;
      return { texto: recomendados === total ? 'Los recomendados' : `${recomendados} de ${total} recomendados` };
    })(),
    'tu-pc': ajustes?.equipo ? { texto: `${ajustes.produccion?.ahora ?? ajustes.equipo.recomendacion.aLaVez ?? 1} a la vez` } : null,
    acerca: ajustes?.app?.version ? { texto: `Versión ${ajustes.app.version}` } : null,
  };

  return (
    <div className="pagina ajustes">
      <CabeceraPagina
        sobretitulo="Ajustes"
        titulo={titulo}
        descripcion="Tus claves nunca se muestran: solo si están guardadas o faltan."
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
        <div className="ajustes__secciones" key={activa}>
          {activa === 'conexiones' ? <Conexiones estado={estado} recargar={recargarEstado} alElegirModelos={() => irA('modelos')} /> : null}
          {activa === 'modelos' ? <Modelos ajustes={ajustes} guardando={guardandoModelo} alCambiar={guardarModelo} /> : null}
          {activa === 'tu-pc' ? <TuPC ajustes={ajustes} recargar={recargar} alCambiarALaVez={(v) => guardarPreferencia({ aLaVez: v })} /> : null}
          {activa === 'guardado' ? <Guardado /> : null}
          {activa === 'inversion' ? <Inversion /> : null}
          {activa === 'telegram' ? <Telegram estado={estado} recargar={recargarEstado} /> : null}
          {activa === 'conector' ? <Conector /> : null}
          {activa === 'apariencia' ? <Apariencia /> : null}
          {activa === 'acerca' ? <AcercaDe ajustes={ajustes} alVerBienvenida={abrirBienvenida} /> : null}
        </div>
      </div>

      <Bienvenida abierto={bienvenida} onCerrar={cerrarBienvenida} />
    </div>
  );
}
