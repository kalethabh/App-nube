// #/oficina — OFICINA VIRTUAL (2026-11-19q): el trabajo real de la app repartido entre tus agentes, cada uno con su
// nombre y su personaje, en su departamento de una oficina en perspectiva. Cada uno muestra lo que está haciendo
// ahora, lo que te necesita (en rojo) y lo que terminó hoy. La primera vez, la bienvenida para ponerles nombre.
// Servidor: GET /api/oficina · PUT /api/oficina/agentes (lib/oficina.js).
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, GraduationCap, LayoutGrid, MessageCircle, Pencil, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Boton, CampoTexto, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';
import { Oficina3D } from './Oficina3D.jsx';
import { Chat } from './Chat.jsx';
import { Disenar } from './Disenar.jsx';
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
function Panel({ a, onCerrar, onEditar, onChat }) {
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
      {a.caida ? (
        <p className="of-panel__caida">
          <AlertTriangle size={14} aria-hidden="true" /> {a.caida}: lo suyo puede tardar o frenarse hasta que vuelva.
        </p>
      ) : null}
      {a.id === 'coordinacion' ? (
        <Boton variante="primario" tamano="chico" icono={MessageCircle} onClick={onChat}>
          Hablar con {a.nombre}
        </Boton>
      ) : null}
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

export default function Oficina() {
  const { datos, recargar } = useDatos(CLAVE, () => pedirNuevo('/api/oficina'), { cadaMs: 5000 });
  const [elegido, setElegido] = useState(null);
  const [nombres, setNombres] = useState(false);
  const [sinBienvenida, setSinBienvenida] = useState(false);
  const [chat, setChat] = useState(false);
  const [disenar, setDisenar] = useState(false);
  const ias = datos?.ias || [];
  const primera = Boolean(datos && !datos.configurada);
  const agentes = datos?.agentes || [];
  const a = useMemo(() => agentes.find((x) => x.id === elegido) || null, [agentes, elegido]);
  const r = datos?.resumen || {};
  return (
    <div className="pagina of">
      <header className="of-cabeza">
        <div>
          <span className="of-cabeza__sobre">Oficina virtual</span>
          <h1 className="of-cabeza__titulo">{datos?.nombre || 'Tu oficina'}</h1>
          <div className="of-resumen">
            <span className="of-chip of-chip--trabajando">{r.trabajando ?? 0} trabajando</span>
            <span className={`of-chip ${r.teNecesitan ? 'of-chip--te-necesita' : ''}`}>{r.teNecesitan ?? 0} te {r.teNecesitan === 1 ? 'necesita' : 'necesitan'}</span>
            <span className="of-chip">{r.hechosHoy ?? 0} terminados hoy</span>
            <a className="of-chip of-chip--enlace" href="#/aprendizajes">
              <GraduationCap size={12} aria-hidden="true" /> {r.aprendizajes ?? 0} aprendizajes
            </a>
            {ias.map((i) => (
              <span key={i.id} className={`of-chip of-chip--ia of-chip--${i.estado}`} title={i.detalle || undefined}>
                <AlertTriangle size={12} aria-hidden="true" /> {i.nombre} {i.estado === 'caido' ? 'caído' : i.estado === 'lento' ? 'lento' : 'con fallas'}
              </span>
            ))}
          </div>
        </div>
        <div className="of-cabeza__botones">
          <Boton variante="primario" tamano="chico" icono={MessageCircle} onClick={() => { setChat(true); setElegido('coordinacion'); }}>
            Hablar con {agentes.find((x) => x.id === 'coordinacion')?.nombre || 'la coordinadora'}
          </Boton>
          <Boton variante="secundario" tamano="chico" icono={LayoutGrid} onClick={() => setDisenar(true)}>
            Diseñar oficina
          </Boton>
          <Boton variante="secundario" tamano="chico" icono={Pencil} onClick={() => setNombres(true)}>
            Nombres y personajes
          </Boton>
        </div>
      </header>

      <div className={`of-cuerpo${a ? ' of-cuerpo--panel' : ''}`}>
        <div className="of-mundo" role="region" aria-label="La oficina en 3D: arrastra para girarla, rueda para acercarte, toca un agente">
          {agentes.length ? <Oficina3D agentes={agentes} zonas={datos?.zonas || []} elegido={elegido} onElegir={setElegido} /> : null}
          {ias.length ? (
            <div className="of-mundo__aviso" role="status">
              <AlertTriangle size={14} aria-hidden="true" />
              {ias.map((i) => `${i.nombre} ${i.estado === 'caido' ? 'está caído' : i.estado === 'lento' ? 'va lento' : 'tiene fallas'}`).join(' · ')}: los agentes que lo usan esperan.
            </div>
          ) : null}
          <p className="of-mundo__ayuda">Arrastra para girar · rueda para acercarte · toca a un agente</p>
        </div>
        {chat ? (
          <Chat coordinadora={agentes.find((x) => x.id === 'coordinacion')} onCerrar={() => setChat(false)} />
        ) : a ? (
          <Panel a={a} onCerrar={() => setElegido(null)} onEditar={() => setNombres(true)} onChat={() => setChat(true)} />
        ) : (
          <aside className="of-equipo">
            <h2 className="of-equipo__titulo">Tus agentes</h2>
            <ul>
              {agentes.map((x) => (
                <li key={x.id}>
                  <button type="button" className="of-equipo__fila" onClick={() => setElegido(x.id)} style={{ '--color': x.color }}>
                    <Avatar a={x} />
                    <span className="of-equipo__textos">
                      <strong>{x.nombre}</strong>
                      <span>{x.estado === 'te-necesita' ? <b className="of-rojo">te necesita</b> : x.estado === 'trabajando' ? x.ahora[0]?.titulo : x.rol}</span>
                    </span>
                    {x.estado === 'te-necesita' ? <span className="of-equipo__cuenta">{x.necesita.length}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <Disenar abierto={disenar} datos={datos} onCerrar={(guardo) => { setDisenar(false); if (guardo) { invalidar(CLAVE); recargar?.(); } }} />
      <Nombres abierto={(primera && !sinBienvenida) || nombres} primera={primera} datos={datos} onCerrar={(guardo) => { setNombres(false); setSinBienvenida(true); if (guardo) recargar?.(); }} />
    </div>
  );
}
