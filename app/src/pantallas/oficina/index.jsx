// #/oficina — OFICINA VIRTUAL (2026-11-19q): el trabajo real de la app repartido entre tus agentes, cada uno con su
// nombre y su personaje, en su departamento de una oficina en perspectiva. Cada uno muestra lo que está haciendo
// ahora, lo que te necesita (en rojo) y lo que terminó hoy. La primera vez, la bienvenida para ponerles nombre.
// Servidor: GET /api/oficina · PUT /api/oficina/agentes (lib/oficina.js).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Compass, GraduationCap, LayoutGrid, MessageCircle, PanelRightClose, PanelRightOpen, Pencil, Send, Sparkles, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react';
import { Boton, CampoTexto, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';
import { Oficina3D } from './Oficina3D.jsx';
import { Chat } from './Chat.jsx';
import { Disenar } from './Disenar.jsx';
import { Actividad, Minimapa, Recorrido, Vistas, pasosDelRecorrido } from './Hud.jsx';
import { EstacionDeAgente, PanelDepartamento, PanelLinea } from './Departamento.jsx';
import { Encargar } from './Encargar.jsx';
import './oficina.css';

const CLAVE = 'oficina';
const AVATARES = ['👩‍💼', '🧑‍💼', '👨‍💼', '✍️', '🎨', '🎬', '✂️', '🔍', '🔭', '🧑‍🎨', '👩‍💻', '🧑‍💻', '👩‍🔬', '🧑‍🚀', '🦊', '🐼', '🦉', '🐯', '🤖', '👾', '🦄', '🐙', '🌵', '⭐'];
const ESTADO = { 'te-necesita': 'Te necesita', trabajando: 'Trabajando', libre: 'Libre' };


function Avatar({ a, grande = false }) {
  return (
    <span className={`of-avatar of-avatar--${a.estado}${grande ? ' of-avatar--grande' : ''}`} style={{ '--color': a.color }} aria-hidden="true">
      <span className="of-avatar__cara">{a.avatar}</span>
      <span className="of-avatar__punto" />
    </span>
  );
}



function Lista({ titulo, items, vacio, tono }) {
  return (
    <section className="of-panel__seccion">
      <h3 className={`of-panel__titulo${tono ? ` of-panel__titulo--${tono}` : ''}`}>
        {titulo} <span className="t-num">{items.length}</span>
      </h3>
      {items.length ? (
        <ul className="of-tareas">
          {items.map((t, i) => (
            <li key={i}>
              <a href={t.href || undefined} className="of-tarea">
                <strong>{t.titulo}</strong>
                {t.detalle ? <span>{t.detalle}</span> : null}
                {t.cuando ? <small>{fechaRelativa(t.cuando)}</small> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="of-panel__vacio">{vacio}</p>
      )}
    </section>
  );
}

/** El panel de un agente: quién es, qué hace, lo que te necesita, lo que hace ahora y lo que terminó hoy. */
function Panel({ a, onCerrar, onEditar, onChat, onPedir, produccion, agentes }) {
  return (
    <aside className="of-panel" style={{ '--color': a.color }}>
      <header className="of-panel__cabeza">
        <Avatar a={a} grande />
        <div className="of-panel__quien">
          <strong>{a.nombre}</strong>
          <span>{a.rol} · {a.depto}</span>
          <span className={`of-chip of-chip--${a.estado}`}>{ESTADO[a.estado]}</span>
        </div>
        <button type="button" className="of-panel__cerrar" onClick={onCerrar} aria-label="Cerrar">
          <X size={16} />
        </button>
      </header>
      <p className="of-panel__hace">{a.hace}</p>
      <EstacionDeAgente a={a} produccion={produccion} agentes={agentes} />
      {a.caida ? (
        <p className="of-panel__caida">
          <AlertTriangle size={14} aria-hidden="true" /> {a.caida}: lo suyo puede tardar o frenarse hasta que vuelva.
        </p>
      ) : null}
      {a.id === 'coordinacion' ? (
        <Boton variante="primario" tamano="chico" icono={MessageCircle} onClick={onChat}>
          Hablar con {a.nombre}
        </Boton>
      ) : a.enEstacion === 'pronto' ? null : (
        <Boton variante="secundario" tamano="chico" icono={Send} onClick={() => onPedir(a)}>
          Pedirle algo a {a.nombre}
        </Boton>
      )}
      {a.necesita.length ? <Lista titulo="Te necesita" items={a.necesita} tono="rojo" /> : null}
      <Lista titulo="Ahora" items={a.ahora} vacio="Nada en marcha: está libre." tono="verde" />
      <Lista titulo="Terminó hoy" items={a.hechos} vacio="Todavía nada hoy." />
      <section className="of-panel__seccion">
        <h3 className="of-panel__titulo">
          Lo que aprendió esta semana
          {a.opiniones?.bien || a.opiniones?.mal ? (
            <span className="of-votos">
              <ThumbsUp size={12} aria-label="me gustó" /> {a.opiniones.bien} <ThumbsDown size={12} aria-label="no me gustó" /> {a.opiniones.mal}
            </span>
          ) : null}
        </h3>
        {a.semana?.length ? (
          <ul className="of-reglas">
            {a.semana.map((r, i) => (
              <li key={i}>
                {r.regla} <small>{fechaRelativa(r.fecha)}</small>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="of-panel__vacio">
          {a.aprendizajes ? `${a.aprendizajes} reglas aprendidas de tus correcciones.` : 'Aprende de tus 👍/👎 en cada anuncio, de lo que corriges y de lo que hay que rehacer.'}{' '}
          <a href="#/aprendizajes">Ver aprendizajes</a>
        </p>
      </section>
      <Boton variante="fantasma" tamano="chico" icono={Pencil} onClick={onEditar}>
        Cambiar nombre o personaje
      </Boton>
    </aside>
  );
}

/** La bienvenida (y «Nombres y personajes»): un nombre y un personaje para cada agente. */
function Nombres({ abierto, datos, onCerrar, primera }) {
  const { aviso } = useAvisos();
  const [nombreOficina, setNombreOficina] = useState('');
  const [agentes, setAgentes] = useState({});
  const [eligiendo, setEligiendo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!abierto || !datos) return;
    setNombreOficina(datos.nombre === 'Tu oficina' ? '' : datos.nombre);
    setAgentes(Object.fromEntries(datos.agentes.map((a) => [a.id, { nombre: a.nombre, avatar: a.avatar, genero: a.genero }])));
  }, [abierto, datos]);
  const guardar = async () => {
    setGuardando(true);
    try {
      await pedirNuevo('/api/oficina/agentes', { metodo: 'PUT', cuerpo: { agentes, ...(nombreOficina.trim() ? { nombreOficina: nombreOficina.trim() } : {}) } });
      invalidar(CLAVE);
      onCerrar(true);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardar', texto: e.message });
    } finally {
      setGuardando(false);
    }
  };
  if (!datos) return null;
  return (
    <Modal abierto={abierto} onCerrar={() => onCerrar(false)} titulo={primera ? 'Bienvenido a tu oficina virtual' : 'Nombres y personajes'} descripcion={primera ? 'Aquí trabajan tus agentes: cada uno hace una parte de tus anuncios. Ponles nombre y elige su personaje (lo puedes cambiar cuando quieras).' : 'El nombre y el personaje de cada agente.'} icono={Sparkles} tamano="grande">
      <div className="of-nombres">
        <CampoTexto etiqueta="Nombre de tu oficina" opcional placeholder="Ej.: Estudio Kads" maxLength={50} value={nombreOficina} onChange={(e) => setNombreOficina(e.target.value)} />
        <ul className="of-nombres__lista">
          {datos.agentes.map((a) => {
            const x = agentes[a.id] || {};
            return (
              <li key={a.id} className="of-nombres__fila" style={{ '--color': a.color }}>
                <button type="button" className="of-nombres__avatar" onClick={() => setEligiendo(eligiendo === a.id ? null : a.id)} aria-label={`Elegir el personaje de ${a.rol}`} aria-expanded={eligiendo === a.id}>
                  {x.avatar || a.avatar}
                </button>
                <div className="of-nombres__textos">
                  <span className="of-nombres__rol">{a.rol}</span>
                  <CampoTexto aria-label={`Nombre de ${a.rol}`} maxLength={40} value={x.nombre ?? ''} onChange={(e) => setAgentes((s) => ({ ...s, [a.id]: { ...s[a.id], nombre: e.target.value } }))} />
                  <span className="of-nombres__genero" role="group" aria-label={`Cómo se ve ${a.rol}`}>
                    {[['mujer', 'Mujer'], ['hombre', 'Hombre']].map(([g, t]) => (
                      <button key={g} type="button" className={(x.genero || a.genero) === g ? 'of-genero of-genero--activo' : 'of-genero'} aria-pressed={(x.genero || a.genero) === g} onClick={() => setAgentes((s) => ({ ...s, [a.id]: { ...s[a.id], genero: g } }))}>
                        {t}
                      </button>
                    ))}
                  </span>
                  <span className="of-nombres__hace">{a.hace}</span>
                </div>
                {eligiendo === a.id ? (
                  <div className="of-nombres__galeria" role="group" aria-label="Personajes">
                    {AVATARES.map((e) => (
                      <button key={e} type="button" className={(x.avatar || a.avatar) === e ? 'of-nombres__opcion of-nombres__opcion--activa' : 'of-nombres__opcion'} onClick={() => { setAgentes((s) => ({ ...s, [a.id]: { ...s[a.id], avatar: e } })); setEligiendo(null); }}>
                        {e}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Boton variante="primario" icono={Sparkles} onClick={guardar} cargando={guardando}>
          {primera ? 'Abrir la oficina' : 'Guardar'}
        </Boton>
      </div>
    </Modal>
  );
}

const RECORRIDO_VISTO = 'oficina:recorrido-visto';
const leerLocal = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardarLocal = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sin almacenamiento */
  }
};

export default function Oficina() {
  const { datos, recargar } = useDatos(CLAVE, () => pedirNuevo('/api/oficina'), { cadaMs: 5000 });
  const [elegido, setElegido] = useState(null);
  const [nombres, setNombres] = useState(false);
  const [sinBienvenida, setSinBienvenida] = useState(false);
  const [chat, setChat] = useState(null); // null o { inicial }
  const [disenar, setDisenar] = useState(false);
  const [lateral, setLateral] = useState(true);
  const [vista, setVista] = useState('general');
  const [modo, setModo] = useState(() => leerLocal('oficina:modo') || 'dia');
  const [foco, setFoco] = useState(null);
  const [posiciones, setPosiciones] = useState({});
  const [eventos, setEventos] = useState([]); // las transferencias reales que vio la oficina desde que la abriste
  const [depElegido, setDepElegido] = useState(null);
  const [linea, setLinea] = useState(null);
  const [resaltar, setResaltar] = useState(null);
  const [encargo, setEncargo] = useState(null); // el departamento al que le encargas algo
  const [actividad, setActividad] = useState(false);
  const [paso, setPaso] = useState(null); // el paso del recorrido (null = cerrado)
  // la oficina ocupa todo el alto que queda en la ventana (debajo de la barra de arriba)
  const escenario = useRef(null);
  const [anchoLado, setAnchoLado] = useState(0);
  useEffect(() => {
    const medir = () => {
      const el = escenario.current;
      if (!el) return;
      const arriba = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty('--alto-escenario', `${Math.max(560, window.innerHeight - arriba - 16)}px`);
      setAnchoLado(window.innerWidth > 900 ? (el.querySelector('.of-lateral')?.offsetWidth || 0) : 0);
    };
    medir();
    const t = setTimeout(medir, 400);
    window.addEventListener('resize', medir);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', medir);
    };
  }, [lateral, datos?.configurada]);
  const ias = datos?.ias || [];
  const primera = Boolean(datos && !datos.configurada);
  const agentes = datos?.agentes || [];
  const a = useMemo(() => agentes.find((x) => x.id === elegido) || null, [agentes, elegido]);
  const r = datos?.resumen || {};
  const coordinadora = agentes.find((x) => x.id === 'coordinacion');
  const pasos = useMemo(() => pasosDelRecorrido(agentes, datos?.nombre || 'tu oficina'), [agentes, datos?.nombre]);

  // la primera vez (después de ponerles nombre), el recorrido solo
  useEffect(() => {
    if (datos?.configurada && !leerLocal(RECORRIDO_VISTO) && paso === null && !nombres) setPaso(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos?.configurada]);
  // cada paso del recorrido mueve la cámara
  useEffect(() => {
    if (paso === null) return;
    const p = pasos[paso];
    if (!p) return;
    setChat(null);
    if (p.agente) {
      setFoco(null);
      setElegido(p.agente);
    } else {
      setElegido(null);
      if (p.zona) setFoco({ zona: p.zona, n: Date.now() });
      else {
        setFoco(null);
        setVista(p.vista || 'general');
      }
    }
  }, [paso, pasos]);
  const cerrarRecorrido = () => {
    setPaso(null);
    setElegido(null);
    setFoco(null);
    setVista('general');
    guardarLocal(RECORRIDO_VISTO, '1');
  };
  const elegirAgente = (id) => {
    setFoco(null);
    setDepElegido(null);
    setLinea(null);
    setChat(null);
    setElegido(id);
    setLateral(true);
  };
  const elegirDepartamento = (id) => {
    setElegido(null);
    setLinea(null);
    setChat(null);
    setResaltar(null);
    setDepElegido(id);
    setFoco({ zona: id, n: Date.now() });
    setLateral(true);
  };
  const prod = datos?.produccion || null;
  const dep = prod?.departamentos?.find((d) => d.id === (depElegido || linea?.dep)) || null;
  // el aviso de arriba (4 s) cuando algo termina, se devuelve, se frena o entra un trabajo nuevo
  const [aviso3d, setAviso3d] = useState(null);
  const alEvento = useCallback((e) => {
    setEventos((l) => [e, ...l].slice(0, 40));
    if (e.tipo === 'listo' || e.tipo === 'error' || e.tipo === 'devuelve' || /^Nuevo:/.test(e.detalle || '')) setAviso3d({ ...e, n: Date.now() });
  }, []);
  useEffect(() => {
    if (!aviso3d) return undefined;
    const t = setTimeout(() => setAviso3d(null), 4500);
    return () => clearTimeout(t);
  }, [aviso3d]);
  const cambiarModo = (m) => {
    setModo(m);
    guardarLocal('oficina:modo', m);
  };
  const cambiarVista = (v) => {
    setElegido(null);
    setFoco(null);
    setVista(v);
  };

  return (
    <div className="pagina of of--pro">
      <div ref={escenario} className={`of-escenario${lateral ? '' : ' of-escenario--sin-lateral'}`}>
        <div className="of-mundo" role="region" aria-label="La oficina en 3D: arrastra para girarla, rueda para acercarte, toca un agente">
          {agentes.length ? <Oficina3D agentes={agentes} zonas={datos?.zonas || []} produccion={prod} elegido={elegido} onElegir={elegirAgente} onDepartamento={elegirDepartamento} onLinea={(l) => { setElegido(null); setDepElegido(null); setChat(null); setLinea(l); setLateral(true); }} resaltar={resaltar} foco={foco} vista={vista} modo={modo} onPosiciones={setPosiciones} onEvento={alEvento} desplazar={lateral ? Math.round((anchoLado + 14) / 2) : 0} /> : null}
        </div>

        {/* arriba: quién eres, cómo va todo y las acciones */}
        <header className="of-hud-arriba">
          <div className="of-marca of-vidrio">
            <span className="of-marca__logo" aria-hidden="true">K</span>
            <div>
              <span className="of-cabeza__sobre">Oficina virtual</span>
              <h1 className="of-marca__titulo">{datos?.nombre || 'Tu oficina'}</h1>
            </div>
            <div className="of-resumen">
              <span className="of-chip of-chip--trabajando">
                <i className="of-punto of-punto--verde" /> {r.trabajando ?? 0} trabajando
              </span>
              <span className={`of-chip ${r.teNecesitan ? 'of-chip--te-necesita' : ''}`}>
                <i className="of-punto of-punto--rojo" /> {r.teNecesitan ?? 0} te {r.teNecesitan === 1 ? 'necesita' : 'necesitan'}
              </span>
              <span className="of-chip">{r.hechosHoy ?? 0} hoy</span>
              <a className="of-chip of-chip--enlace" href="#/aprendizajes">
                <GraduationCap size={12} aria-hidden="true" /> {r.aprendizajes ?? 0}
              </a>
              {ias.map((i) => (
                <span key={i.id} className={`of-chip of-chip--ia of-chip--${i.estado}`} title={i.detalle || undefined}>
                  <AlertTriangle size={12} aria-hidden="true" /> {i.nombre} {i.estado === 'caido' ? 'caído' : i.estado === 'lento' ? 'lento' : 'con fallas'}
                </span>
              ))}
            </div>
          </div>
          <div className="of-acciones of-vidrio">
            <button type="button" className="of-boton of-boton--primario" onClick={() => { setChat({ inicial: '' }); setElegido('coordinacion'); setLateral(true); }}>
              <MessageCircle size={15} aria-hidden="true" /> Hablar con {coordinadora?.nombre || 'la coordinadora'}
            </button>
            <button type="button" className="of-boton" onClick={() => setPaso(0)}>
              <Compass size={15} aria-hidden="true" /> Cómo funciona
            </button>
            <button type="button" className="of-boton" onClick={() => setDisenar(true)}>
              <LayoutGrid size={15} aria-hidden="true" /> Diseñar
            </button>
            <button type="button" className="of-boton" onClick={() => setNombres(true)}>
              <Pencil size={15} aria-hidden="true" /> Personajes
            </button>
            <button type="button" className="of-boton of-boton--icono" onClick={() => setLateral((v) => !v)} aria-label={lateral ? 'Ocultar el panel' : 'Mostrar el panel'} title={lateral ? 'Ocultar el panel' : 'Mostrar el panel'}>
              {lateral ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </div>
        </header>

        {ias.length ? (
          <div className="of-mundo__aviso" role="status">
            <AlertTriangle size={14} aria-hidden="true" />
            {ias.map((i) => `${i.nombre} ${i.estado === 'caido' ? 'está caído' : i.estado === 'lento' ? 'va lento' : 'tiene fallas'}`).join(' · ')}: los agentes que lo usan esperan.
          </div>
        ) : null}

        {aviso3d ? (
          <div key={aviso3d.n} className={`of-toast of-toast--${aviso3d.tipo}`} role="status">
            <span className="of-toast__icono" aria-hidden="true">{aviso3d.tipo === 'listo' ? '🎉' : aviso3d.tipo === 'error' ? '⚠️' : aviso3d.tipo === 'devuelve' ? '↩' : '✨'}</span>
            {aviso3d.detalle}
          </div>
        ) : null}

        {/* a la derecha: el equipo, el panel de un agente o el chat */}
        {lateral ? (
          <div className="of-lateral">
            {chat ? (
              <Chat key={chat.inicial} coordinadora={coordinadora} inicial={chat.inicial} onCerrar={() => setChat(null)} />
            ) : linea && dep ? (
              <PanelLinea linea={linea} dep={dep} agentes={agentes} eventos={eventos} onCerrar={() => setLinea(null)} />
            ) : depElegido && dep ? (
              <PanelDepartamento dep={dep} agentes={agentes} resaltar={resaltar} onResaltar={setResaltar} onAgente={elegirAgente} onEncargar={setEncargo} onCerrar={() => { setDepElegido(null); setResaltar(null); setFoco(null); }} />
            ) : a ? (
              <Panel a={a} produccion={prod} agentes={agentes} onCerrar={() => setElegido(null)} onEditar={() => setNombres(true)} onChat={() => setChat({ inicial: '' })} onPedir={(x) => setChat({ inicial: `Pídele a ${x.nombre} que ` })} />
            ) : (
              <aside className="of-equipo">
                <h2 className="of-equipo__titulo">
                  <Users size={14} aria-hidden="true" /> Tu empresa
                </h2>
                <ul>
                  {coordinadora ? (
                    <li>
                      <button type="button" className="of-equipo__fila" onClick={() => elegirAgente(coordinadora.id)} style={{ '--color': coordinadora.color }}>
                        <Avatar a={coordinadora} />
                        <span className="of-equipo__textos">
                          <strong>{coordinadora.nombre}</strong>
                          <span>{coordinadora.estado === 'te-necesita' ? <b className="of-rojo">{coordinadora.necesita.length} cosas esperan tu decisión</b> : 'Coordinación general'}</span>
                        </span>
                      </button>
                    </li>
                  ) : null}
                  {(prod?.departamentos || []).map((d) => {
                    const gente = agentes.filter((x) => x.dep === d.id);
                    const activos = gente.filter((x) => ['trabajando', 'revisando', 'corrigiendo'].includes(x.enEstacion)).length;
                    const errores = gente.filter((x) => x.enEstacion === 'error').length;
                    const enMarcha = d.trabajos.filter((t) => t.estado === 'activo' || t.estado === 'te-necesita').length;
                    return (
                      <li key={d.id}>
                        <button type="button" className="of-equipo__fila of-dep" onClick={() => elegirDepartamento(d.id)} style={{ '--color': d.color }}>
                          <span className="of-dep__caras" aria-hidden="true">
                            {gente.slice(0, 3).map((x) => (
                              <span key={x.id}>{x.avatar}</span>
                            ))}
                          </span>
                          <span className="of-equipo__textos">
                            <strong>{d.nombre}</strong>
                            <span>{d.pronto ? 'En construcción' : errores ? <b className="of-rojo">{errores} con error</b> : activos ? `${activos} trabajando · ${enMarcha} en marcha` : enMarcha ? `${enMarcha} en marcha` : `${gente.length} agentes · en espera`}</span>
                          </span>
                          {activos ? <span className="of-dep__vivo" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="of-leyenda">
                  <i className="of-leyenda__verde" /> pasa al siguiente · <i className="of-leyenda__naranja" /> la revisión devuelve · <i className="of-leyenda__roja" /> se frenó
                </p>
              </aside>
            )}
          </div>
        ) : null}

        {/* abajo: lo que pasa, el minimapa y las vistas */}
        <Actividad agentes={agentes} eventos={eventos} departamentos={prod?.departamentos || []} abierta={actividad} onAbrir={() => setActividad((v) => !v)} onAgente={elegirAgente} />
        <div className="of-abajo-derecha">
          {datos?.zonas?.length ? <Minimapa zonas={datos.zonas} agentes={agentes} posiciones={posiciones} onZona={(id) => (prod?.departamentos?.some((d) => d.id === id) || id === 'coordinacion' ? elegirDepartamento(id) : (setElegido(null), setFoco({ zona: id, n: Date.now() })))} /> : null}
          <Vistas vista={vista} onVista={cambiarVista} modo={modo} onModo={cambiarModo} />
        </div>
        {paso !== null ? <Recorrido pasos={pasos} paso={paso} onPaso={setPaso} onCerrar={cerrarRecorrido} /> : null}
      </div>
      {encargo ? (
        <Encargar
          dep={encargo}
          onCerrar={() => setEncargo(null)}
          onListo={(lote) => {
            setEncargo(null);
            recargar?.();
            elegirDepartamento(encargo.id);
            if (lote) setResaltar(lote);
          }}
          onPedirAValentina={() => {
            setEncargo(null);
            setDepElegido(null);
            setChat({ inicial: 'Hazme un anuncio de video de ' });
            setElegido('coordinacion');
          }}
        />
      ) : null}
      <Disenar abierto={disenar} datos={datos} onCerrar={(guardo) => { setDisenar(false); if (guardo) { invalidar(CLAVE); recargar?.(); } }} />
      <Nombres abierto={(primera && !sinBienvenida) || nombres} primera={primera} datos={datos} onCerrar={(guardo) => { setNombres(false); setSinBienvenida(true); if (guardo) recargar?.(); }} />
    </div>
  );
}
