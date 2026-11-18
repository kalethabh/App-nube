// «Tus videos e imágenes» (opcional, 2026-11-19): al crear un anuncio, el usuario sube videos o imágenes que la IA
// puede usar: un video como escena, una imagen como la imagen exacta de una escena o como referencia (la persona, el
// lugar o el objeto). Con una nota por archivo («úsala en el antes y después»). Cada archivo se sube al elegirlo
// (POST /api/material) y al crear el anuncio va su id con la nota (lib/material-propio.js).
import { useRef, useState } from 'react';
import { CircleHelp, Film, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { CampoTexto, Tooltip } from '../../componentes/index.js';

const MAXIMO = 10;

async function subir(archivo) {
  const r = await fetch('/api/material', { method: 'POST', headers: { 'Content-Type': archivo.type || 'application/octet-stream', 'X-Nombre': encodeURIComponent(archivo.name || 'archivo'), Accept: 'application/json' }, body: archivo });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || 'No pude subir ese archivo.');
  return d;
}

/** lista: [{ id, nombre, tipo, nota, vista? }] · onCambio(lista) */
export function TusArchivos({ lista = [], onCambio, bloqueado }) {
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState(null);
  const agregar = async (archivos) => {
    const lugar = MAXIMO - lista.length;
    const elegidos = [...archivos].filter((a) => /^(video|image)\//.test(a.type)).slice(0, Math.max(0, lugar));
    if (!elegidos.length) return;
    setError(null);
    setSubiendo((n) => n + elegidos.length);
    let actual = lista;
    for (const a of elegidos) {
      try {
        const r = await subir(a);
        actual = [...actual, { id: r.id, nombre: r.nombre, tipo: r.tipo, nota: '', vista: a.type.startsWith('image/') ? URL.createObjectURL(a) : null }];
        onCambio(actual);
      } catch (e) {
        setError(e.message);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  };
  return (
    <div className="nv-archivos">
      <span className="nv-ajuste__etiqueta">
        <ImagePlus size={13} strokeWidth={2.2} aria-hidden="true" /> Tus videos e imágenes <span className="t-3">(opcional)</span>
        <Tooltip texto="La IA los usa en el guion: un video como una escena, una imagen como la escena exacta o como referencia de una persona, un lugar o un objeto. Esas escenas no se generan ni se pagan.">
          <CircleHelp size={13} strokeWidth={2} className="nv-ayuda" aria-label="Qué es esto" />
        </Tooltip>
      </span>
      {lista.length ? (
        <ul className="nv-archivos__lista">
          {lista.map((x, i) => (
            <li key={x.id} className="nv-archivos__item">
              <span className="nv-archivos__vista">{x.vista ? <img src={x.vista} alt="" /> : <Film size={18} strokeWidth={2} aria-hidden="true" />}</span>
              <div className="nv-archivos__textos">
                <span className="nv-archivos__nombre">{x.nombre}</span>
                <CampoTexto
                  aria-label={`Dónde usar ${x.nombre}`}
                  value={x.nota}
                  maxLength={300}
                  placeholder={x.tipo === 'video' ? '¿Dónde lo uso? Ej.: como escena del producto al final' : '¿Dónde la uso? Ej.: en el antes y después, o es la cara de la protagonista'}
                  onChange={(e) => onCambio(lista.map((y, k) => (k === i ? { ...y, nota: e.target.value } : y)))}
                  disabled={bloqueado}
                />
              </div>
              <button type="button" className="nv-archivos__quitar" onClick={() => onCambio(lista.filter((_, k) => k !== i))} disabled={bloqueado} aria-label={`Quitar ${x.nombre}`}>
                <X size={13} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {lista.length < MAXIMO ? (
        <button
          type="button"
          className="nv-archivos__agregar"
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!bloqueado) agregar(e.dataTransfer.files);
          }}
          disabled={bloqueado}
        >
          {subiendo ? <LoaderCircle size={15} strokeWidth={2.2} className="girando" aria-hidden="true" /> : <ImagePlus size={15} strokeWidth={2.2} aria-hidden="true" />}
          {subiendo ? `Subiendo ${subiendo}…` : 'Sube o arrastra videos e imágenes'}
        </button>
      ) : null}
      <input
        ref={entrada}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          agregar(e.target.files || []);
          e.target.value = '';
        }}
      />
      {error ? <p className="nv-archivos__error">{error}</p> : null}
    </div>
  );
}
