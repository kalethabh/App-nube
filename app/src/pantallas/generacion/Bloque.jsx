// (2026-11-26c) Dentro de la carpeta de un producto, cada generación (landing, lote, anuncio…) es un BLOQUE:
// su imagen arriba y un nombre que el usuario puede cambiar («Ángulo 1», «Ángulo 2»…). No es otra carpeta.
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ImageOff, PencilLine, Trash2, X } from 'lucide-react';
import { pedirNuevo } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';

// La landing se ve como una página de celular (390 px) achicada al ancho del bloque.
function Landing({ src }) {
  const caja = useRef(null);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const o = new ResizeObserver(([e]) => el.style.setProperty('--escala', String(e.contentRect.width / 390)));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return (
    <div className="ge-bloque__landing" aria-hidden="true" ref={caja}>
      <iframe src={src} title="" tabIndex={-1} loading="lazy" sandbox="allow-same-origin" scrolling="no" />
    </div>
  );
}

function Imagen({ p }) {
  const [rota, setRota] = useState(false);
  if (p.vista) return <Landing src={p.vista} />;
  const src = !rota && (p.miniatura || p.foto);
  if (src) return <img src={src} alt="" loading="lazy" className={p.miniatura ? '' : 'ge-bloque__foto'} onError={() => setRota(true)} />;
  return (
    <span className="ge-bloque__sin">
      <ImageOff size={28} strokeWidth={1.5} />
    </span>
  );
}

export default function BloqueGeneracion({ p, tipo, estado, onBorrar, onRenombrado }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const campo = useRef(null);
  useEffect(() => {
    if (editando) campo.current?.select();
  }, [editando]);

  const abrirEdicion = () => {
    setTexto(p.propio ? p.nombre : '');
    setError('');
    setEditando(true);
  };
  async function guardar() {
    if (guardando) return;
    const nombre = texto.trim();
    if (nombre === (p.propio ? p.nombre : '')) return setEditando(false);
    setGuardando(true);
    setError('');
    try {
      await pedirNuevo(`/api/generaciones/${tipo}/nombre`, { metodo: 'PUT', cuerpo: { id: p.id, nombre } });
      setEditando(false);
      await onRenombrado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <article className="ge-bloque">
      <a className="ge-bloque__imagen" href={p.href} aria-label={`Abrir ${p.nombre}`}>
        <Imagen p={p} />
        <span className="ge-bloque__estado">{estado}</span>
      </a>
      <div className="ge-bloque__cuerpo">
        {editando ? (
          <form
            className="ge-bloque__renombrar"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            <input
              ref={campo}
              value={texto}
              maxLength={80}
              placeholder={p.nombreOriginal || 'Ángulo 1'}
              aria-label="Nombre de la generación"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditando(false);
              }}
              disabled={guardando}
            />
            <button type="submit" className="ge-bloque__icono" aria-label="Guardar nombre" disabled={guardando}>
              <Check size={16} />
            </button>
            <button type="button" className="ge-bloque__icono" aria-label="Cancelar" onClick={() => setEditando(false)} disabled={guardando}>
              <X size={16} />
            </button>
          </form>
        ) : (
          <div className="ge-bloque__titulo">
            <h2 title={p.nombre}>{p.nombre}</h2>
            <button type="button" className="ge-bloque__icono" onClick={abrirEdicion} aria-label={`Cambiar el nombre de ${p.nombre}`} title="Cambiar el nombre">
              <PencilLine size={15} />
            </button>
          </div>
        )}
        {error ? <small className="ge-bloque__error">{error}</small> : null}
        <small>
          {[p.propio && p.nombreOriginal !== p.nombre ? p.nombreOriginal : null, p.detalle, p.fecha ? fechaRelativa(p.fecha) : null].filter(Boolean).join(' · ') || 'Guardado'}
        </small>
        <div className="ge-bloque__pie">
          <a href={p.href} className="ge-bloque__abrir">
            Abrir <ArrowUpRight size={15} />
          </a>
          <button type="button" className="ge-bloque__icono ge-bloque__borrar" onClick={onBorrar} aria-label={`Borrar generación ${p.nombre}`} title="Borrar">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}
