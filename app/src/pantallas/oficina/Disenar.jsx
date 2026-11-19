// «Diseñar oficina» (2026-11-19r): el plano de la planta con sus 13 lugares. Tocas una oficina y después otro lugar
// para moverla (si está ocupado, se intercambian). Le cambias el nombre y el color, y creas las tuyas eligiendo el tipo
// de sala (escritorios, creativos, estudio, reuniones…). Las de «Próximamente» salen en construcción.
// Servidor: PUT /api/oficina/zonas (lib/oficina.js guardarZonas).
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { Boton, CampoTexto, Modal, useAvisos } from '../../componentes/index.js';
import { pedirNuevo } from '../../datos/api.js';

// cómo se dibuja cada lugar en el plano (fila, columna, cuántas columnas ocupa); 'logo' es el centro
const PLANO = [
  [0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1],
  [1, 1, 1], [1, 4, 1],
  [2, 1, 1], [2, 2, 2], [2, 4, 1],
  [3, 1, 1], [3, 2, 1], [3, 3, 1], [3, 4, 1],
];
const COLORES = ['#a3e635', '#22c55e', '#2dd4bf', '#38bdf8', '#60a5fa', '#a78bfa', '#c084fc', '#f472b6', '#fb7185', '#fb923c', '#f59e0b', '#facc15'];

export function Disenar({ abierto, datos, onCerrar }) {
  const { aviso } = useAvisos();
  const [zonas, setZonas] = useState([]);
  const [elegida, setElegida] = useState(null);
  const [guardando, setGuardando] = useState(false);
  // (se carga al abrir; la oficina se refresca cada 5 s y no debe borrar lo que estás moviendo)
  const cargado = useRef(false);
  useEffect(() => {
    if (!abierto) {
      cargado.current = false;
      return;
    }
    if (cargado.current || !datos?.zonas) return;
    cargado.current = true;
    setZonas(datos.zonas.map((z) => ({ ...z })));
    setElegida(null);
  }, [abierto, datos]);
  const enLugar = useMemo(() => Object.fromEntries(zonas.map((z) => [z.lugar, z])), [zonas]);
  const z = zonas.find((x) => x.id === elegida) || null;
  const tipos = datos?.tipos || {};

  const cambiar = (id, cambios) => setZonas((l) => l.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
  const tocarLugar = (n) => {
    const ahi = enLugar[n];
    if (!z) return setElegida(ahi?.id || null);
    if (ahi?.id === z.id) return setElegida(null);
    // mover (o intercambiar con la que está ahí)
    setZonas((l) => l.map((x) => (x.id === z.id ? { ...x, lugar: n } : ahi && x.id === ahi.id ? { ...x, lugar: z.lugar } : x)));
  };
  const nueva = () => {
    const libre = [...Array(datos?.lugares || 13).keys()].find((n) => !enLugar[n]);
    if (libre === undefined) return aviso({ tipo: 'error', titulo: 'No hay lugares libres', texto: 'Borra una de tus oficinas o mueve una para hacer espacio.' });
    const id = `nueva-${Date.now()}`;
    setZonas((l) => [...l, { id, nueva: true, propia: true, nombre: 'Mi oficina', tipo: 'escritorios', color: COLORES[(l.length * 5) % COLORES.length], lugar: libre }]);
    setElegida(id);
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      await pedirNuevo('/api/oficina/zonas', { metodo: 'PUT', cuerpo: { zonas: zonas.map((x) => ({ id: x.id, nueva: Boolean(x.nueva), lugar: x.lugar, nombre: x.nombre, color: x.color, tipo: x.tipo })) } });
      aviso({ tipo: 'ok', titulo: 'Tu oficina quedó así', texto: 'Los cambios ya se ven en 3D.' });
      onCerrar(true);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardarla', texto: e.message });
    } finally {
      setGuardando(false);
    }
  };

  if (!datos) return null;
  return (
    <Modal abierto={abierto} onCerrar={() => onCerrar(false)} titulo="Diseñar tu oficina" descripcion="Toca una oficina y después el lugar donde la quieres (si está ocupado, se intercambian). Crea las tuyas y personalízalas." icono={LayoutGrid} tamano="grande">
      <div className="of-disenar">
        <div className="of-plano" role="grid" aria-label="El plano de la oficina">
          <span className="of-plano__logo" style={{ gridRow: 2, gridColumn: '2 / span 2' }} aria-hidden="true">K</span>
          {PLANO.map(([fila, col, span], n) => {
            const x = enLugar[n];
            return (
              <button
                key={n}
                type="button"
                className={`of-plano__lugar${x ? '' : ' of-plano__lugar--libre'}${x?.id === elegida ? ' of-plano__lugar--elegida' : ''}${z && !x ? ' of-plano__lugar--destino' : ''}`}
                style={{ gridRow: fila + 1, gridColumn: `${col} / span ${span}`, '--color': x?.color || '#64748b' }}
                onClick={() => tocarLugar(n)}
                aria-pressed={x?.id === elegida}
              >
                {x ? (
                  <>
                    <strong>{x.nombre}</strong>
                    <small>{x.pronto ? 'Próximamente' : x.propia ? tipos[x.tipo] || 'Tuya' : x.de ? `de ${x.de}` : x.tipo === 'cafe' ? 'Para descansar' : x.tipo === 'sala' ? 'Para conversar' : ''}</small>
                  </>
                ) : (
                  <small>{z ? 'Mover aquí' : 'Libre'}</small>
                )}
              </button>
            );
          })}
        </div>
        <aside className="of-disenar__lado">
          {z ? (
            <div className="of-disenar__editar" style={{ '--color': z.color }}>
              <CampoTexto etiqueta="Nombre" maxLength={30} value={z.nombre || ''} onChange={(e) => cambiar(z.id, { nombre: e.target.value })} />
              <div className="of-disenar__campo">
                <span>Color</span>
                <div className="of-colores">
                  {COLORES.map((c) => (
                    <button key={c} type="button" className={`of-color${z.color === c ? ' of-color--activo' : ''}`} style={{ background: c }} onClick={() => cambiar(z.id, { color: c })} aria-label={`Color ${c}`} aria-pressed={z.color === c} />
                  ))}
                </div>
              </div>
              {z.propia ? (
                <div className="of-disenar__campo">
                  <span>Tipo de sala</span>
                  <div className="of-tipos">
                    {Object.entries(tipos).map(([id, nombre]) => (
                      <button key={id} type="button" className={`of-tipo${z.tipo === id ? ' of-tipo--activo' : ''}`} onClick={() => cambiar(z.id, { tipo: id })} aria-pressed={z.tipo === id}>
                        {nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="t-chico t-3">Toca otro lugar del plano para moverla.</p>
              {z.propia ? (
                <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={() => { setZonas((l) => l.filter((x) => x.id !== z.id)); setElegida(null); }}>
                  Borrar esta oficina
                </Boton>
              ) : null}
            </div>
          ) : (
            <p className="t-chico t-3">Toca una oficina del plano para moverla o cambiarle el nombre y el color.</p>
          )}
          <Boton variante="secundario" tamano="chico" icono={Plus} onClick={nueva}>
            Nueva oficina
          </Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            Guardar el diseño
          </Boton>
        </aside>
      </div>
    </Modal>
  );
}
