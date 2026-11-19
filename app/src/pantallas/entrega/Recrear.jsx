// «Recrear para otro producto» (2026-11-19p): el mismo anuncio, con el mismo guion tal cual, para otro de tus
// productos. Tu IA cambia solo lo del producto (qué es, cómo se usa, su envase…) y lo que no encaje con él; las mismas
// personas y lugares (sin pagarlas otra vez). Después ves el guion y lo apruebas como siempre (con su costo).
// Servidor: POST /api/anuncios/:slug/recrear (lib/anuncios-nuevos.js recrearAnuncio).
import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { Boton, Modal, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';
import { enlace, ir } from '../../datos/rutas.js';

export function Recrear({ slug, productoId = null, estilo = null }) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const { aviso } = useAvisos();
  const { datos } = useDatos(abierto ? 'productos:lista' : null, () => pedirNuevo('/api/productos'));
  // (los cantados no: su canción es de otro producto)
  if (['musical', 'historias-musicales'].includes(estilo)) return null;
  const productos = (datos?.productos || []).filter((p) => p.id !== productoId && p.foto);
  const recrear = async () => {
    if (!elegido) return;
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/recrear`, { metodo: 'POST', cuerpo: { productoId: elegido } });
      aviso({ tipo: 'ok', titulo: 'Tu IA está adaptando el guion', texto: 'Mismo guion, con lo de tu otro producto. Lo revisas y lo apruebas antes de producir.' });
      ir(enlace.nuevo({ producto: elegido, paso: '2', anuncios: r.slug }));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude recrearlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <>
      <Boton variante="secundario" icono={Repeat2} onClick={() => setAbierto(true)} bloque>
        Recrear para otro producto
      </Boton>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Recrear para otro producto" descripcion="El mismo guion, tal cual, para otro de tus productos: cambia lo del producto (qué es, cómo se usa, su envase) y lo que no encaje con él. Mismas personas y escenas." icono={Repeat2}>
        <div className="ent-recrear">
          {!datos ? <p className="t-chico t-3">Cargando tus productos…</p> : null}
          {datos && !productos.length ? <p className="t-chico t-3">No tienes otro producto con foto. Créalo en Nuevo anuncio (paso 1) y vuelve.</p> : null}
          <ul className="ent-recrear__lista">
            {productos.map((p) => (
              <li key={p.id}>
                <button type="button" className={`ent-recrear__producto${elegido === p.id ? ' ent-recrear__producto--elegido' : ''}`} onClick={() => setElegido(p.id)} aria-pressed={elegido === p.id} disabled={!p.fichaLista}>
                  <img src={p.foto} alt="" />
                  <span>
                    <strong>{p.nombre}</strong>
                    {!p.fichaLista ? <small>Primero arma su ficha</small> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="t-chico t-3">Las personas y los lugares del anuncio se reutilizan (no se pagan otra vez). El resto se produce de nuevo: antes de producir ves el guion y el costo.</p>
          <Boton variante="primario" icono={Repeat2} onClick={recrear} cargando={ocupado} disabled={!elegido}>
            Adaptar el guion
          </Boton>
        </div>
      </Modal>
    </>
  );
}
