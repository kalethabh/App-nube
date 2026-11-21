// #/carpetas y #/carpetas/<id> — CARPETAS DE PRODUCTO (2026-11-21): tus carpetas (por ejemplo «Aguaje»), cada una con
// «Imágenes» y «Videos». Guardas ahí lo que te gusta desde Anuncios de imagen («Guardar en carpeta» en cada imagen) o
// desde la entrega de un video, subes tus propios archivos y descargas la carpeta entera en un zip.
// Servidor: /api/carpetas (lib/carpetas.js).
import { useRef, useState } from 'react';
import { Download, Film, FolderOpen, FolderPlus, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, EstadoVacio, Pestanas, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import './carpetas.css';

const tam = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const url = (id, tipo, nombre) => `/api/carpetas/${encodeURIComponent(id)}/archivo/${tipo}/${encodeURIComponent(nombre)}`;

function NuevaCarpeta({ alCrear }) {
  const { aviso } = useAvisos();
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const crear = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      const c = await pedirNuevo('/api/carpetas', { metodo: 'POST', cuerpo: { nombre } });
      setNombre('');
      invalidar('carpetas');
      alCrear?.(c);
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude crearla', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form className="cp-nueva" onSubmit={crear}>
      <CampoTexto placeholder="Nombre de la carpeta (por ejemplo, Aguaje)" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} aria-label="Nombre de la carpeta nueva" />
      <Boton variante="primario" icono={FolderPlus} cargando={ocupado} disabled={!nombre.trim()} type="submit">
        Crear carpeta
      </Boton>
    </form>
  );
}

function Lista() {
  const { datos, cargando } = useDatos('carpetas', () => pedirNuevo('/api/carpetas'));
  const carpetas = datos?.carpetas || [];
  return (
    <div className="pagina cp pila" style={{ '--hueco': 'var(--e-5)' }}>
      <CabeceraPagina sobretitulo="Tu contenido" titulo="Carpetas" descripcion="Una carpeta por producto (o como quieras), con sus imágenes y sus videos. Guarda ahí lo que te gusta desde Anuncios de imagen o desde la entrega de un video, y descárgala entera cuando la necesites." />
      <NuevaCarpeta alCrear={(c) => (window.location.hash = enlace.carpeta(c.id))} />
      {!carpetas.length && !cargando ? (
        <EstadoVacio icono={FolderOpen} titulo="Todavía no tienes carpetas" descripcion="Crea la primera arriba; después, en cada imagen o video, toca «Guardar en carpeta»." />
      ) : (
        <div className="cp-grilla">
          {carpetas.map((c) => (
            <a key={c.id} className="cp-tarjeta" href={enlace.carpeta(c.id)}>
              <span className="cp-tarjeta__portada">{c.portada ? <img src={url(c.id, 'imagenes', c.portada)} alt="" loading="lazy" /> : <FolderOpen size={34} aria-hidden="true" />}</span>
              <strong>{c.nombre}</strong>
              <span className="cp-tarjeta__cuenta">
                <ImageIcon size={13} aria-hidden="true" /> {c.imagenes} · <Film size={13} aria-hidden="true" /> {c.videos}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Detalle({ id }) {
  const { aviso } = useAvisos();
  const { datos, recargar, error } = useDatos(`carpeta:${id}`, () => pedirNuevo(`/api/carpetas/${encodeURIComponent(id)}`));
  const [tab, setTab] = useState('imagenes');
  const [subiendo, setSubiendo] = useState(0);
  const [encima, setEncima] = useState(false);
  const elegir = useRef(null);
  if (error) return <div className="pagina"><EstadoVacio tono="error" titulo="No encuentro esa carpeta" descripcion={error.message} acciones={<Boton href={enlace.carpetas()}>Ver tus carpetas</Boton>} /></div>;
  const lista = datos?.[tab] || [];
  const subir = async (archivos) => {
    const l = [...archivos];
    if (!l.length) return;
    setSubiendo(l.length);
    let ok = 0;
    for (const f of l) {
      try {
        await pedirNuevo(`/api/carpetas/${encodeURIComponent(id)}/archivos`, { metodo: 'POST', binario: f, encabezados: { 'x-nombre': encodeURIComponent(f.name) } });
        ok++;
      } catch (e) {
        aviso({ tipo: 'error', titulo: `No pude subir «${f.name}»`, texto: e.message });
      }
      setSubiendo((n) => n - 1);
    }
    if (ok) aviso({ tipo: 'ok', titulo: ok === 1 ? 'Guardado en la carpeta' : `${ok} archivos guardados` });
    invalidar('carpetas');
    await recargar?.();
  };
  const quitar = async (nombre) => {
    if (!window.confirm(`¿Quitar «${nombre}» de la carpeta?`)) return;
    try {
      await pedirNuevo(`/api/carpetas/${encodeURIComponent(id)}/archivo/${tab}/${encodeURIComponent(nombre)}`, { metodo: 'DELETE' });
      invalidar('carpetas');
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude quitarlo', texto: e.message });
    }
  };
  const borrarCarpeta = async () => {
    if (!window.confirm(`¿Borrar la carpeta «${datos?.nombre}» con todo lo que tiene? Lo original (tus anuncios y lotes) no se toca.`)) return;
    try {
      await pedirNuevo(`/api/carpetas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
      invalidar('carpetas');
      window.location.hash = enlace.carpetas();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude borrarla', texto: e.message });
    }
  };
  const total = (datos?.imagenes?.length || 0) + (datos?.videos?.length || 0);
  return (
    <div
      className={`pagina cp pila${encima ? ' cp--encima' : ''}`}
      style={{ '--hueco': 'var(--e-5)' }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        subir(e.dataTransfer.files);
      }}
    >
      <CabeceraPagina
        sobretitulo="Carpeta"
        titulo={datos?.nombre || '…'}
        descripcion="Arrastra aquí imágenes o videos, o súbelos con el botón. Cada uno va solo a «Imágenes» o a «Videos»."
        acciones={
          <div className="cp-acciones">
            <input ref={elegir} type="file" multiple hidden accept="image/*,video/*" onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
            <Boton variante="secundario" icono={Upload} cargando={subiendo > 0} onClick={() => elegir.current?.click()}>
              Subir archivos
            </Boton>
            <Boton variante="primario" icono={Download} href={total ? `/api/carpetas/${encodeURIComponent(id)}/zip` : undefined} disabled={!total}>
              Descargar carpeta (.zip)
            </Boton>
          </div>
        }
      />
      <Pestanas
        etiqueta="Contenido de la carpeta"
        activa={tab}
        onCambio={setTab}
        items={[
          { id: 'imagenes', etiqueta: `Imágenes (${datos?.imagenes?.length || 0})` },
          { id: 'videos', etiqueta: `Videos (${datos?.videos?.length || 0})` },
        ]}
      />
      {!lista.length ? (
        <EstadoVacio icono={tab === 'imagenes' ? ImageIcon : Film} titulo={tab === 'imagenes' ? 'Sin imágenes todavía' : 'Sin videos todavía'} descripcion={tab === 'imagenes' ? 'En Anuncios de imagen, toca «Guardar en carpeta» en una imagen, o súbelas aquí.' : 'En la entrega de un anuncio, toca «Guardar en carpeta», o súbelos aquí.'} />
      ) : (
        <div className="cp-archivos">
          {lista.map((x) => (
            <figure key={x.nombre} className="cp-archivo">
              <a href={url(id, tab, x.nombre)} target="_blank" rel="noreferrer" className="cp-archivo__vista">
                {tab === 'imagenes' ? <img src={url(id, tab, x.nombre)} alt={x.nombre} loading="lazy" /> : <video src={url(id, tab, x.nombre)} preload="metadata" muted playsInline />}
              </a>
              <figcaption>
                <span className="cp-archivo__nombre" title={x.nombre}>{x.nombre}</span>
                <span className="cp-archivo__meta">{tam(x.bytes)}</span>
                <span className="cp-archivo__botones">
                  <Boton variante="fantasma" tamano="chico" soloIcono icono={Download} etiqueta={`Descargar ${x.nombre}`} href={url(id, tab, x.nombre)} download={x.nombre} />
                  <Boton variante="fantasma" tamano="chico" soloIcono icono={Trash2} etiqueta={`Quitar ${x.nombre}`} onClick={() => quitar(x.nombre)} />
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div>
        <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={borrarCarpeta}>
          Borrar la carpeta
        </Boton>
      </div>
    </div>
  );
}

export default function Carpetas({ params }) {
  return params?.id ? <Detalle id={params.id} /> : <Lista />;
}
