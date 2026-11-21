// «Guardar en carpeta» (2026-11-21): un botón con un menú chico de tus carpetas (y «Nueva carpeta»). Guarda una imagen de
// un lote ({ tipo: 'imagen-lote', lote, pieza }) o un video terminado ({ tipo: 'video', archivo }) en la carpeta que
// elijas (Carpetas › imagenes/ o videos/). Servidor: POST /api/carpetas/:id/desde.
import { useEffect, useRef, useState } from 'react';
import { FolderInput, FolderPlus } from 'lucide-react';
import { Boton } from './Boton.jsx';
import { useAvisos } from './Avisos.jsx';
import { Tooltip } from './Tooltip.jsx';
import { invalidar, pedirNuevo, useDatos } from '../datos/api.js';
import '../pantallas/carpetas/carpetas.css';

export function GuardarEnCarpeta({ desde, soloIcono = false, tamano = 'chico', variante = 'fantasma', haciaAbajo = false, deshabilitado = false, bloque = false }) {
  const { aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const caja = useRef(null);
  const { datos, recargar } = useDatos('carpetas', () => pedirNuevo('/api/carpetas'));
  const carpetas = datos?.carpetas || [];
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const esc = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const guardar = async (c) => {
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/carpetas/${encodeURIComponent(c.id)}/desde`, { metodo: 'POST', cuerpo: desde });
      aviso({ tipo: 'ok', titulo: `Guardado en «${c.nombre}»`, texto: r.tipo === 'videos' ? 'Está en su carpeta de videos.' : 'Está en su carpeta de imágenes.' });
      invalidar('carpetas');
      invalidar(`carpeta:${c.id}`);
      setAbierto(false);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardarlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const crearYGuardar = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    setOcupado(true);
    try {
      const c = await pedirNuevo('/api/carpetas', { metodo: 'POST', cuerpo: { nombre: n } });
      setNombre('');
      await recargar?.();
      await guardar(c);
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude crear la carpeta', texto: err.message });
      setOcupado(false);
    }
  };

  const boton = (
    <Boton variante={variante} tamano={tamano} soloIcono={soloIcono} icono={FolderInput} etiqueta="Guardar en carpeta" onClick={() => setAbierto((x) => !x)} disabled={deshabilitado} cargando={ocupado} bloque={bloque} aria-expanded={abierto}>
      {soloIcono ? undefined : 'Guardar en carpeta'}
    </Boton>
  );
  return (
    <span className="gc" ref={caja}>
      {soloIcono ? <Tooltip texto="Guardar en carpeta">{boton}</Tooltip> : boton}
      {abierto ? (
        <div className={`gc__menu${haciaAbajo ? ' gc__menu--abajo' : ''}`} role="menu" aria-label="Guardar en carpeta">
          <span className="gc__titulo">{carpetas.length ? '¿En qué carpeta?' : 'Crea tu primera carpeta'}</span>
          {carpetas.map((c) => (
            <button key={c.id} type="button" role="menuitem" className="gc__opcion" onClick={() => guardar(c)} disabled={ocupado}>
              <FolderInput size={14} aria-hidden="true" /> {c.nombre}
            </button>
          ))}
          <form className="gc__nueva" onSubmit={crearYGuardar}>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nueva carpeta…" maxLength={60} aria-label="Nombre de la carpeta nueva" />
            <button type="submit" disabled={!nombre.trim() || ocupado} title="Crear y guardar aquí">
              <FolderPlus size={14} aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}
    </span>
  );
}
