// BIBLIOTECA (#/biblioteca): lo que se reutiliza de un anuncio a otro (traída de IA-VID-AUTOMATIC, 2026-11-08).
//   Avatares  las personas o personajes guardados, por estilo. Al crear un anuncio se elige uno y salen esas mismas
//             personas, sin pagar su imagen. Se hacen subiendo sus fotos, desde un anuncio ya hecho, o "como en un
//             anuncio de referencia" (los personajes de los subestilos, con su retrato y su prompt).
//   Música    la música de fondo que ya se pagó (la de cada anuncio terminado se guarda sola) y la que subas.
// Todo vive en mis_archivos/biblioteca/ y se sincroniza solo con el repositorio privado "biblioteca-anuncios" de tu
// GitHub, el mismo de IA-VID-AUTOMATIC (server/lib/biblioteca.js). #/biblioteca?desde=<slug> abre "Nuevo avatar"
// con los personajes de ese anuncio.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, Film, Image as ImageIcon, ImagePlus, Library, Music, Pencil, Plus, RefreshCw, Trash2, Trophy, Upload, Users } from 'lucide-react';
import { AreaTexto, Boton, CabeceraPagina, CampoTexto, EstadoVacio, Insignia, Modal, Pestanas, Selector, Tarjeta, useAvisos } from '../../componentes/index.js';
import { miniatura, useDatos } from '../../datos/api.js';
import { partirRuta, useHash } from '../../datos/rutas.js';
import { ESTILOS_BIBLIOTECA, biblioteca, claveDeCarpeta, nombreDeCarpeta, useBiblioteca } from './datos.js';
import { useFuncionan } from '../../datos/funcionan.js';
import { LoQueFunciona } from './LoQueFunciona.jsx';
import './biblioteca.css';

// ---------------------------------------------------------------- el estado de la sincronización

function EstadoSync({ estado, onSincronizar, sincronizando }) {
  const e = estado?.estado;
  const ok = e === 'listo';
  const texto =
    e === 'listo'
      ? `Al día con tu GitHub${estado.ultima ? ` · ${new Date(estado.ultima).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : e === 'sincronizando'
        ? 'Sincronizando con tu GitHub…'
        : e === 'sin-git'
          ? 'Modo prueba: se guarda solo en este computador'
          : e === 'local'
            ? 'Se guarda en este computador'
          : e === 'sin-empezar'
            ? 'Se sincroniza al abrir la app'
            : estado?.error || 'Se guarda solo en este computador';
  const Icono = ok ? CircleCheck : CircleAlert;
  return (
    <div className="bib-sync">
      <Icono size={15} strokeWidth={2} className={ok ? 'bib-sync__ok' : 'bib-sync__aviso'} aria-hidden="true" />
      <span className="bib-sync__texto">{texto}</span>
      {estado?.crearEn ? (
        <a className="bib-sync__enlace" href={estado.crearEn} target="_blank" rel="noreferrer">
          Crear el repositorio
        </a>
      ) : null}
      <Boton variante="fantasma" tamano="chico" icono={RefreshCw} onClick={onSincronizar} cargando={sincronizando || e === 'sincronizando'}>
        Sincronizar
      </Boton>
    </div>
  );
}

// ---------------------------------------------------------------- subir un archivo

function BotonSubir({ texto = 'Subir imagen', acepta = 'image/png,image/jpeg,image/webp', icono = Upload, onSubido, tamano = 'chico' }) {
  const ref = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const { aviso } = useAvisos();
  const alElegir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSubiendo(true);
    try {
      onSubido(await biblioteca.subir(f), f);
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No se pudo subir', texto: err.message });
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <>
      <input ref={ref} type="file" accept={acepta} hidden onChange={alElegir} />
      <Boton variante="secundario" tamano={tamano} icono={icono} cargando={subiendo} onClick={() => ref.current?.click()}>
        {texto}
      </Boton>
    </>
  );
}

// ---------------------------------------------------------------- nuevo avatar

/** Un personaje del avatar: su imagen (subida, de un anuncio o de una referencia) y cómo es. */
function Personaje({ rol, valor, onCambio, onQuitar }) {
  return (
    <div className="bib-persona">
      <div className="bib-persona__imagen">
        {valor?.url ? <img src={miniatura(valor.url, 240)} alt="" /> : <ImagePlus size={22} strokeWidth={1.6} aria-hidden="true" />}
      </div>
      <div className="bib-persona__datos">
        <div className="bib-persona__cabecera">
          <strong>{rol.nombre}</strong>
          {rol.desc ? <span className="bib-nota">{rol.desc}</span> : null}
        </div>
        {rol.extra ? (
          <CampoTexto etiqueta="Nombre" value={valor?.nombre || ''} onChange={(e) => onCambio({ ...valor, nombre: e.target.value })} placeholder="Ej.: La amiga" />
        ) : null}
        <AreaTexto
          etiqueta="Cómo es"
          opcional
          filas={2}
          value={valor?.descripcion || ''}
          onChange={(e) => onCambio({ ...valor, descripcion: e.target.value })}
          placeholder="Edad, aspecto, ropa, voz…"
        />
        <div className="bib-persona__acciones">
          <BotonSubir texto={valor?.url ? 'Cambiar imagen' : 'Subir imagen'} onSubido={(s) => onCambio({ ...valor, imagen: s.ref, url: s.url })} />
          {onQuitar ? (
            <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={onQuitar}>
              Quitar
            </Boton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** "Como en un anuncio de referencia": los personajes de los subestilos del estilo, con su retrato y su prompt. */
function DeReferencia({ estilo, roles, onUsar }) {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const { aviso } = useAvisos();
  useEffect(() => {
    let vivo = true;
    setLista(null);
    biblioteca
      .referencias(estilo)
      .then((r) => vivo && setLista(r.personajes || []))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [estilo]);
  if (!lista?.length) return null;
  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      aviso({ tipo: 'ok', titulo: 'Prompt copiado', texto: 'Pégalo en ChatGPT o Gemini, y sube aquí la imagen que te guste.' });
    } catch {
      aviso({ tipo: 'error', titulo: 'No pude copiar', texto: 'Selecciona el texto y cópialo a mano.' });
    }
  };
  const p = abierto !== null ? lista[abierto] : null;
  return (
    <div className="bib-ref">
      <div className="bib-ref__titulo">
        <Film size={15} strokeWidth={2} aria-hidden="true" />
        <strong>Como en un anuncio de referencia</strong>
        <span className="bib-nota">los personajes de los anuncios reales de este estilo</span>
      </div>
      <div className="bib-ref__tira">
        {lista.map((x, i) => (
          <button key={`${x.subestilo}-${x.rol}`} type="button" className={`bib-ref__item${abierto === i ? ' bib-ref__item--activo' : ''}`} onClick={() => setAbierto(abierto === i ? null : i)}>
            <img src={miniatura(x.url, 160)} alt="" loading="lazy" />
            <span>{x.nombre}</span>
          </button>
        ))}
      </div>
      {p ? (
        <div className="bib-ref__detalle">
          <ul className="bib-ref__como">
            {p.como.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <div className="bib-ref__prompt">
            <span className="bib-nota">Prompt para hacer su imagen (en ChatGPT, Gemini o donde prefieras):</span>
            <pre>{p.prompt}</pre>
          </div>
          <div className="bib-persona__acciones">
            <Boton variante="secundario" tamano="chico" icono={Copy} onClick={() => copiar(p.prompt)}>
              Copiar el prompt
            </Boton>
            {p.adjuntar
              ? roles.map((r) => (
                  <Boton key={r.id} variante="secundario" tamano="chico" onClick={() => onUsar(r.id, { imagen: p.imagen, url: p.url, descripcion: p.como.join(' ') })}>
                    Usar este retrato como {r.nombre}
                  </Boton>
                ))
              : roles.map((r) => (
                  <Boton key={r.id} variante="fantasma" tamano="chico" onClick={() => onUsar(r.id, { descripcion: p.como.join(' ') })}>
                    Usar su descripción para {r.nombre}
                  </Boton>
                ))}
          </div>
          {!p.adjuntar ? <p className="bib-nota">Es una persona real filmada: su foto nunca se usa. Haz su imagen con el prompt y súbela.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Los personajes de un anuncio ya hecho, para guardarlos como avatar. */
function DeUnAnuncio({ slug, roles, onUsar }) {
  const [lista, setLista] = useState(null);
  useEffect(() => {
    if (!slug) return undefined;
    let vivo = true;
    biblioteca
      .personajes(slug)
      .then((r) => vivo && setLista(r.personajes || []))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [slug]);
  if (!slug || !lista) return null;
  if (!lista.length) return <p className="bib-nota">Ese anuncio no tiene hojas de personajes para guardar.</p>;
  return (
    <div className="bib-ref">
      <div className="bib-ref__titulo">
        <Users size={15} strokeWidth={2} aria-hidden="true" />
        <strong>Los personajes de tu anuncio</strong>
      </div>
      <div className="bib-ref__tira">
        {lista.map((x) => (
          <div key={x.id} className="bib-ref__item bib-ref__item--fijo">
            <img src={miniatura(x.url, 160)} alt="" loading="lazy" />
            <span>{x.id}</span>
            <div className="bib-ref__usar">
              {roles.map((r) => (
                <Boton key={r.id} variante="fantasma" tamano="chico" onClick={() => onUsar(r.id, { imagen: x.imagen, url: x.url, descripcion: x.descripcion })}>
                  Usar como {r.nombre}
                </Boton>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalNuevoAvatar({ abierto, onCerrar, inicial }) {
  const [estilo, setEstilo] = useState(inicial?.estilo || 'ugc');
  const [nombre, setNombre] = useState('');
  const [personas, setPersonas] = useState({});
  const [extras, setExtras] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const { datos } = useBiblioteca(estilo);
  const { aviso } = useAvisos();
  const roles = datos?.roles?.roles || [];
  const maxExtras = datos?.roles?.extras || 0;

  useEffect(() => {
    if (!abierto) return;
    setEstilo(inicial?.estilo || 'ugc');
    setNombre('');
    setPersonas({});
    setExtras([]);
    setError(null);
  }, [abierto, inicial?.estilo]);
  useEffect(() => {
    setPersonas({});
    setExtras([]);
  }, [estilo]);

  const todosLosRoles = [...roles, ...extras.map((id, i) => ({ id, nombre: `Personaje extra ${i + 1}`, extra: true }))];
  const usar = (rol, v) => setPersonas((p) => ({ ...p, [rol]: { ...p[rol], ...v } }));
  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      const lista = todosLosRoles.filter((r) => personas[r.id]?.imagen).map((r) => ({ rol: r.id, nombre: personas[r.id]?.nombre || r.nombre, imagen: personas[r.id].imagen, descripcion: personas[r.id]?.descripcion || '' }));
      await biblioteca.crearAvatar({ estilo, nombre, personas: lista });
      aviso({ tipo: 'ok', titulo: 'Avatar guardado', texto: 'Ya lo puedes elegir al crear un anuncio de este estilo.' });
      onCerrar(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal
      abierto={abierto}
      onCerrar={() => onCerrar(false)}
      titulo="Nuevo avatar"
      descripcion="Las personas o personajes que quieres que salgan iguales en varios anuncios. Su imagen no se vuelve a pagar."
      icono={Users}
      tamano="grande"
      pie={
        <>
          <Boton variante="fantasma" onClick={() => onCerrar(false)}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            Guardar avatar
          </Boton>
        </>
      }
    >
      <div className="bib-modal">
        <div className="bib-modal__fila">
          <Selector etiqueta="Estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)} opciones={ESTILOS_BIBLIOTECA.map((e) => ({ valor: e.clave, etiqueta: e.nombre }))} />
          <CampoTexto etiqueta="Nombre del avatar" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Valeria, mamá de 35" />
        </div>
        <DeUnAnuncio slug={inicial?.desde} roles={todosLosRoles} onUsar={usar} />
        <DeReferencia estilo={estilo} roles={todosLosRoles} onUsar={usar} />
        {todosLosRoles.map((r) => (
          <Personaje
            key={r.id}
            rol={r}
            valor={personas[r.id]}
            onCambio={(v) => setPersonas((p) => ({ ...p, [r.id]: v }))}
            onQuitar={r.extra ? () => setExtras((x) => x.filter((id) => id !== r.id)) : null}
          />
        ))}
        {extras.length < maxExtras ? (
          <Boton variante="fantasma" tamano="chico" icono={Plus} onClick={() => setExtras((x) => [...x, `extra-${Date.now().toString(36)}`])}>
            Agregar otro personaje
          </Boton>
        ) : null}
        {error ? (
          <p className="bib-error" role="alert">
            <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" /> {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- avatares

function TarjetaAvatar({ a, onBorrar, onRenombrar }) {
  return (
    <Tarjeta className="bib-avatar" relleno="chico">
      <div className="bib-avatar__caras">
        {a.personas.map((p) => (
          <figure key={p.rol} className="bib-avatar__cara">
            <img src={miniatura(p.url, 320)} alt={p.nombre} loading="lazy" />
            <figcaption>{p.nombre}</figcaption>
          </figure>
        ))}
      </div>
      <div className="bib-avatar__pie">
        <div>
          <strong className="bib-avatar__nombre">{a.nombre}</strong>
          <Insignia tono="neutro">{nombreDeCarpeta(a.estilo)}</Insignia>
        </div>
        <div className="bib-avatar__acciones">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Pencil} etiqueta="Cambiar el nombre" onClick={() => onRenombrar(a)} />
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar" onClick={() => onBorrar(a)} />
        </div>
      </div>
    </Tarjeta>
  );
}

function Confirmar({ abierto, titulo, texto, onSi, onNo, cargando }) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={onNo}
      titulo={titulo}
      descripcion={texto}
      icono={Trash2}
      tono="error"
      tamano="chico"
      pie={
        <>
          <Boton variante="fantasma" onClick={onNo}>
            No
          </Boton>
          <Boton variante="peligro" onClick={onSi} cargando={cargando}>
            Sí, borrar
          </Boton>
        </>
      }
    />
  );
}

function Renombrar({ avatar, onCerrar }) {
  const [nombre, setNombre] = useState(avatar?.nombre || '');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setNombre(avatar?.nombre || ''), [avatar]);
  const guardar = async () => {
    setGuardando(true);
    try {
      await biblioteca.editarAvatar(avatar.estilo, avatar.id, { nombre });
      onCerrar(true);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal
      abierto={Boolean(avatar)}
      onCerrar={() => onCerrar(false)}
      titulo="Cambiar el nombre"
      icono={Pencil}
      tamano="chico"
      pie={
        <Boton variante="primario" onClick={guardar} cargando={guardando}>
          Guardar
        </Boton>
      }
    >
      <CampoTexto etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} data-autofocus />
    </Modal>
  );
}

// ---------------------------------------------------------------- música

function ModalSubirMusica({ abierto, onCerrar }) {
  const [estilo, setEstilo] = useState('general');
  const [nombre, setNombre] = useState('');
  const [subida, setSubida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (abierto) {
      setNombre('');
      setSubida(null);
      setError(null);
    }
  }, [abierto]);
  const guardar = async () => {
    setError(null);
    setGuardando(true);
    try {
      if (!subida) throw new Error('Primero sube el audio.');
      await biblioteca.guardarAudio({ estilo, nombre, ruta: subida.ref, tipo: 'musica' });
      onCerrar(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };
  return (
    <Modal
      abierto={abierto}
      onCerrar={() => onCerrar(false)}
      titulo="Subir música"
      descripcion="Una pista tuya para usarla de fondo en tus anuncios. Con ella no se genera música nueva."
      icono={Music}
      pie={
        <Boton variante="primario" onClick={guardar} cargando={guardando}>
          Guardar
        </Boton>
      }
    >
      <div className="bib-modal">
        <Selector
          etiqueta="Para qué estilo"
          value={estilo}
          onChange={(e) => setEstilo(e.target.value)}
          opciones={[{ valor: 'general', etiqueta: 'Para todos los estilos' }, ...ESTILOS_BIBLIOTECA.filter((e) => !['podcast', 'entrevista', 'musical', 'historias-musicales'].includes(e.clave)).map((e) => ({ valor: e.clave, etiqueta: e.nombre }))]}
        />
        <CampoTexto etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Pop latino alegre" />
        <BotonSubir texto={subida ? 'Cambiar el audio' : 'Elegir el audio'} acepta="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg" icono={Music} tamano="normal" onSubido={(s, f) => {
          setSubida(s);
          if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, ''));
        }} />
        {subida ? <audio controls src={subida.url} className="bib-audio" /> : null}
        {error ? (
          <p className="bib-error" role="alert">
            <CircleAlert size={14} strokeWidth={2.2} aria-hidden="true" /> {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- agrupado por estilo

const TIPOS = { producto: 'Producto', lugar: 'Lugar', broll: 'B-roll', personaje: 'Personaje', otro: 'Otro', ingrediente: 'Ingrediente', mecanismo: 'Mecanismo', escena: 'Escena', clip: 'Clip' };
const ORDEN_ESTILOS = ['general', ...ESTILOS_BIBLIOTECA.map((e) => e.carpeta)];

/** La lista partida en una sección por estilo (en el orden de los estilos; "Para todos" primero). */
function PorEstilo({ lista, clase, children }) {
  const grupos = new Map();
  for (const x of lista) {
    if (!grupos.has(x.estilo)) grupos.set(x.estilo, []);
    grupos.get(x.estilo).push(x);
  }
  const orden = [...grupos.keys()].sort((a, b) => (ORDEN_ESTILOS.indexOf(a) + 1 || 99) - (ORDEN_ESTILOS.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return (
    <div className="bib-grupos">
      {orden.map((estilo, i) => (
        <section key={estilo} className="bib-grupo" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
          <h2 className="bib-grupo__titulo">
            {nombreDeCarpeta(estilo)}
            <span className="bib-grupo__cuenta t-num">{grupos.get(estilo).length}</span>
          </h2>
          <div className={clase}>{grupos.get(estilo).map(children)}</div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- la pantalla

export default function Biblioteca() {
  const hash = useHash();
  const desde = useMemo(() => partirRuta(hash).consulta.get('desde'), [hash]);
  const estiloDesde = useMemo(() => partirRuta(hash).consulta.get('estilo'), [hash]);
  const [pestana, setPestana] = useState('avatares');
  const [filtro, setFiltro] = useState('');
  const { datos, cargando, recargar } = useBiblioteca(null, { cadaMs: 15000 });
  const [nuevo, setNuevo] = useState(Boolean(desde));
  const [subirMusica, setSubirMusica] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [renombrar, setRenombrar] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const { aviso } = useAvisos();

  useEffect(() => {
    if (desde) setNuevo(true);
  }, [desde]);

  const { datos: datosImagenes, recargar: recargarImagenes } = useDatos('biblioteca:imagenes', biblioteca.imagenes, { cadaMs: 30000 });
  const { datos: datosClips, recargar: recargarClips } = useDatos('biblioteca:clips', biblioteca.clips, { cadaMs: 30000 });
  const { datos: datosFunciona } = useFuncionan();
  const delFiltro = (x) => !filtro || claveDeCarpeta(x.estilo) === filtro || x.estilo === 'general';
  const avatares = (datos?.avatares || []).filter(delFiltro);
  const audios = (datos?.audios || []).filter(delFiltro);
  const imagenes = (datosImagenes?.imagenes || []).filter(delFiltro);
  const clips = (datosClips?.clips || []).filter(delFiltro);
  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await biblioteca.sincronizar();
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo sincronizar', texto: e.message });
    } finally {
      setSincronizando(false);
    }
  };
  const borrar = async () => {
    setBorrando(true);
    try {
      if (aBorrar.tipo === 'avatar') await biblioteca.borrarAvatar(aBorrar.x.estilo, aBorrar.x.id);
      else if (aBorrar.tipo === 'audio') await biblioteca.borrarAudio(aBorrar.x.estilo, aBorrar.x.id);
      else await biblioteca.borrarDe(aBorrar.tipo, aBorrar.x.estilo, aBorrar.x.id);
      setABorrar(null);
      await Promise.all([recargar?.(), recargarImagenes?.(), recargarClips?.()]);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo borrar', texto: e.message });
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div className="pagina bib">
      <CabeceraPagina
        titulo="Biblioteca"
        descripcion="Las personas, la música, las imágenes y los clips que reutilizas de un anuncio a otro, sin volver a pagarlos, ordenados por estilo. Es la misma biblioteca de tu otra app (IA-VID-AUTOMATIC): se guarda sola en tu GitHub."
        acciones={
          pestana === 'avatares' ? (
            <Boton variante="primario" icono={Plus} onClick={() => setNuevo(true)}>
              Nuevo avatar
            </Boton>
          ) : pestana === 'musica' ? (
            <Boton variante="primario" icono={Upload} onClick={() => setSubirMusica(true)}>
              Subir música
            </Boton>
          ) : null
        }
        extra={<EstadoSync estado={datos?.estado} onSincronizar={sincronizar} sincronizando={sincronizando} />}
      />
      <div className="bib-barra">
        <Pestanas
          items={[
            { id: 'avatares', etiqueta: 'Avatares', icono: Users, contador: datos?.avatares?.length },
            { id: 'musica', etiqueta: 'Música', icono: Music, contador: datos?.audios?.length },
            { id: 'imagenes', etiqueta: 'Imágenes', icono: ImageIcon, contador: datosImagenes?.imagenes?.length },
            { id: 'clips', etiqueta: 'Clips', icono: Film, contador: datosClips?.clips?.length },
            { id: 'funciona', etiqueta: 'Lo que me funciona', icono: Trophy, contador: datosFunciona?.items?.length },
          ]}
          activa={pestana}
          onCambio={setPestana}
        />
        {pestana === 'funciona' ? null : (
        <Selector
          className="bib-filtro"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          opciones={[{ valor: '', etiqueta: 'Todos los estilos' }, ...ESTILOS_BIBLIOTECA.map((e) => ({ valor: e.clave, etiqueta: e.nombre }))]}
          aria-label="Filtrar por estilo"
        />
        )}
      </div>

      {pestana === 'funciona' ? (
        <LoQueFunciona />
      ) : cargando && !datos ? null : pestana === 'avatares' ? (
        avatares.length ? (
          <PorEstilo lista={avatares} clase="bib-rejilla">
            {(a) => <TarjetaAvatar key={`${a.estilo}/${a.id}`} a={a} onBorrar={(x) => setABorrar({ tipo: 'avatar', x })} onRenombrar={setRenombrar} />}
          </PorEstilo>
        ) : (
          <EstadoVacio
            icono={Library}
            titulo="Todavía no hay avatares"
            descripcion="Guarda las personas o personajes que quieres repetir: súbelas, sácalas de un anuncio o hazlas como en un anuncio de referencia."
            acciones={
              <Boton variante="primario" icono={Plus} onClick={() => setNuevo(true)}>
                Nuevo avatar
              </Boton>
            }
          />
        )
      ) : pestana === 'musica' ? (
        audios.length ? (
          <PorEstilo lista={audios} clase="bib-lista">
            {(a) => (
              <Tarjeta key={`${a.estilo}/${a.id}`} className="bib-pista" relleno="chico">
                <span className="bib-pista__icono" aria-hidden="true">
                  <Music size={16} strokeWidth={2} />
                </span>
                <div className="bib-pista__textos">
                  <strong>{a.nombre}</strong>
                  {a.notas ? <span className="bib-nota">{a.notas}</span> : null}
                </div>
                <audio controls preload="none" src={a.url} className="bib-audio" />
                <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar" onClick={() => setABorrar({ tipo: 'audio', x: a })} />
              </Tarjeta>
            )}
          </PorEstilo>
        ) : (
          <EstadoVacio icono={Music} titulo="Todavía no hay música" descripcion="La música de cada anuncio que termines se guarda aquí sola. También puedes subir la tuya." />
        )
      ) : pestana === 'imagenes' ? (
        imagenes.length ? (
          <PorEstilo lista={imagenes} clase="bib-rejilla bib-rejilla--chica">
            {(x) => (
              <Tarjeta key={`${x.estilo}/${x.id}`} className="bib-avatar" relleno="chico">
                <img className="bib-miniatura" src={miniatura(x.url, 320)} alt={x.nombre} loading="lazy" />
                <div className="bib-avatar__pie">
                  <div>
                    <strong className="bib-avatar__nombre">{x.nombre}</strong>
                    <span className="bib-nota">{[TIPOS[x.tipo] || x.tipo, x.producto].filter(Boolean).join(' · ')}</span>
                  </div>
                  <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar" onClick={() => setABorrar({ tipo: 'imagenes', x })} />
                </div>
              </Tarjeta>
            )}
          </PorEstilo>
        ) : (
          <EstadoVacio icono={ImageIcon} titulo="Todavía no hay imágenes" descripcion="El producto, los lugares y los B-roll que se repiten de un anuncio a otro se guardan aquí y no se vuelven a pagar." />
        )
      ) : clips.length ? (
        <PorEstilo lista={clips} clase="bib-rejilla bib-rejilla--chica">
          {(x) => (
            <Tarjeta key={`${x.estilo}/${x.id}`} className="bib-avatar" relleno="chico">
              {x.urlVideo ? (
                <video className="bib-miniatura" src={x.urlVideo} poster={x.url || undefined} muted loop playsInline preload="none" onMouseEnter={(e) => e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()} />
              ) : (
                <img className="bib-miniatura" src={miniatura(x.url, 320)} alt={x.nombre} loading="lazy" />
              )}
              <div className="bib-avatar__pie">
                <div>
                  <strong className="bib-avatar__nombre">{x.nombre}</strong>
                  <span className="bib-nota">{[TIPOS[x.tipo] || x.tipo, x.duracion ? `${x.duracion.toFixed(1)} s` : null, x.urlVideo ? null : 'el video está en el otro computador'].filter(Boolean).join(' · ')}</span>
                </div>
                <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta="Borrar" onClick={() => setABorrar({ tipo: 'clips', x })} />
              </div>
            </Tarjeta>
          )}
        </PorEstilo>
      ) : (
        <EstadoVacio icono={Film} titulo="Todavía no hay clips" descripcion="Los clips que otro anuncio del mismo producto puede usar tal cual (el producto en mano, un ingrediente, el mecanismo) se guardan aquí." />
      )}

      <ModalNuevoAvatar
        abierto={nuevo}
        inicial={{ desde, estilo: estiloDesde || undefined }}
        onCerrar={(ok) => {
          setNuevo(false);
          if (ok) recargar?.();
        }}
      />
      <ModalSubirMusica
        abierto={subirMusica}
        onCerrar={(ok) => {
          setSubirMusica(false);
          if (ok) recargar?.();
        }}
      />
      <Renombrar
        avatar={renombrar}
        onCerrar={(ok) => {
          setRenombrar(null);
          if (ok) recargar?.();
        }}
      />
      <Confirmar
        abierto={Boolean(aBorrar)}
        titulo={{ avatar: '¿Borrar este avatar?', audio: '¿Borrar esta música?', imagenes: '¿Borrar esta imagen?', clips: '¿Borrar este clip?' }[aBorrar?.tipo] || '¿Borrarlo?'}
        texto={`«${aBorrar?.x?.nombre || ''}» se borra de la biblioteca de las dos apps. Los anuncios que ya lo usaron no cambian.`}
        onSi={borrar}
        onNo={() => setABorrar(null)}
        cargando={borrando}
      />
    </div>
  );
}
