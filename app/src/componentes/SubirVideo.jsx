// Subir un video arrastrándolo (o eligiéndolo), o pegar su link. Sube con POST /api/referencias.
// Valor: "subido:<id>|<nombre>" o el link (o null).
import { useState } from 'react';
import { Film, LoaderCircle, Upload, X } from 'lucide-react';
import { Boton } from './Boton.jsx';
import { CampoTexto } from './Campo.jsx';
import './SubirVideo.css';

export function SubirVideo({ valor, onCambio, deshabilitado, conLink = true }) {
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState(null);
  const subido = typeof valor === 'string' ? valor.match(/^subido:[a-z0-9]+\|(.*)$/) : null;
  const subir = async (archivo) => {
    if (!archivo) return;
    if (!/^video\//.test(archivo.type || '') && !/\.(mp4|mov|m4v|webm)$/i.test(archivo.name)) return setError('Eso no es un video.');
    setSubiendo(true);
    setError(null);
    try {
      const r = await fetch('/api/referencias', { method: 'POST', headers: { 'Content-Type': archivo.type || 'video/mp4', 'X-Nombre': encodeURIComponent(archivo.name).slice(0, 80), Accept: 'application/json' }, body: archivo });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error(d?.error || 'No pude subir ese video.');
      onCambio(`subido:${d.id}|${archivo.name.slice(0, 80)}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  };
  if (subido) {
    return (
      <div className="cb-subido">
        <Film size={18} strokeWidth={2} aria-hidden="true" />
        <span>{subido[1] || 'Video subido'}</span>
        <Boton variante="fantasma" tamano="chico" icono={X} onClick={() => onCambio(null)} disabled={deshabilitado}>
          Quitar
        </Boton>
      </div>
    );
  }
  const texto = typeof valor === 'string' ? valor : '';
  return (
    <div className="pila" style={{ '--hueco': '8px' }}>
      <label
        className={`cb-soltar${encima ? ' cb-soltar--encima' : ''}${deshabilitado || subiendo ? ' cb-soltar--off' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          if (!deshabilitado && !subiendo) subir(e.dataTransfer.files?.[0]);
        }}
      >
        <input type="file" accept="video/*" hidden disabled={deshabilitado || subiendo} onChange={(e) => subir(e.target.files?.[0])} />
        {subiendo ? <LoaderCircle size={22} className="girando" aria-hidden="true" /> : <Upload size={22} strokeWidth={2} aria-hidden="true" />}
        <strong>{subiendo ? 'Subiendo el video…' : 'Arrastra aquí el video'}</strong>
        <span>o toca para elegirlo</span>
      </label>
      {conLink ? <CampoTexto aria-label="O pega el link del video" placeholder="O pega el link: TikTok, Instagram, Facebook, YouTube" value={texto} disabled={deshabilitado || subiendo} maxLength={600} onChange={(e) => onCambio(e.target.value.trim() ? e.target.value : null)} error={error} /> : error ? <span className="cb-error" role="alert">{error}</span> : null}
    </div>
  );
}

