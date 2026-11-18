// «Salud de plataformas» (barra de arriba, 2026-11-18): un punto de color con el estado de los servicios que usa la
// app (ElevenLabs, kie.ai, Claude, ChatGPT) y, al tocarlo, el detalle de cada uno con su página de estado. Lo arma el
// servidor (GET /api/salud, lib/salud.js) leyendo las páginas de estado oficiales y probando las claves gratis.
// Se revisa cada 2 minutos y al abrir la ventana.
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { PuntoEstado } from '../componentes/Insignia.jsx';
import { fechaRelativa } from '../datos/formato.js';

const CADA_MS = 2 * 60000;
const TONO = { operativo: 'ok', lento: 'aviso', degradado: 'aviso', caido: 'error', desconocido: 'neutro' };
const TEXTO = { operativo: 'Operativo', lento: 'Lento', degradado: 'Con fallas', caido: 'Sin respuesta', desconocido: 'Sin revisar' };
const GENERAL = { operativo: 'Todo operativo', lento: 'Algo va lento', degradado: 'Un servicio tiene fallas', caido: 'Un servicio no responde', desconocido: 'Revisando…' };

async function pedirSalud(fresco = false) {
  const r = await fetch(`/api/salud${fresco ? '?fresco=1' : ''}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function SaludPlataformas() {
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const caja = useRef(null);

  const revisar = async (fresco = false) => {
    setRevisando(true);
    try {
      setDatos(await pedirSalud(fresco));
    } catch {
      /* se vuelve a intentar en la próxima vuelta */
    } finally {
      setRevisando(false);
    }
  };
  useEffect(() => {
    revisar();
    const t = setInterval(() => revisar(), CADA_MS);
    return () => clearInterval(t);
  }, []);
  // se cierra tocando afuera o con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => caja.current && !caja.current.contains(e.target) && setAbierto(false);
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const general = datos?.general || 'desconocido';
  return (
    <div className="salud" ref={caja}>
      <button
        type="button"
        className={`salud__boton salud__boton--${TONO[general]}`}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => {
          setAbierto((x) => !x);
          if (!abierto) revisar();
        }}
      >
        <PuntoEstado tono={TONO[general]} latido={general === 'caido' || general === 'degradado'} />
        <span className="salud__texto">Salud de plataformas</span>
      </button>
      {abierto ? (
        <div className="salud__caja" role="dialog" aria-label="Estado de las plataformas">
          <div className="salud__cabeza">
            <div>
              <strong>Estado de las plataformas</strong>
              <span className={`salud__general salud__general--${TONO[general]}`}>{GENERAL[general]}</span>
            </div>
            <button type="button" className="salud__revisar" onClick={() => revisar(true)} disabled={revisando} title="Revisar ahora" aria-label="Revisar ahora">
              <RotateCcw size={14} strokeWidth={2.2} className={revisando ? 'girando' : ''} aria-hidden="true" />
            </button>
          </div>
          {(datos?.grupos || []).map((g) => (
            <section key={g.titulo} className="salud__grupo">
              <h3 className="salud__grupo-titulo">{g.titulo}</h3>
              {g.servicios.map((s) => (
                <div key={s.id} className="salud__servicio">
                  <PuntoEstado tono={TONO[s.estado]} />
                  <div className="salud__servicio-textos">
                    <span className="salud__nombre">{s.nombre}</span>
                    <span className="salud__para">{s.para}</span>
                    {s.detalle ? <span className={`salud__detalle salud__detalle--${TONO[s.estado]}`}>{s.detalle}</span> : null}
                    <span className="salud__fuente">
                      {s.fuente}
                      {s.otros ? ` · ${s.otros}` : ''}
                    </span>
                  </div>
                  <span className={`salud__estado salud__estado--${TONO[s.estado]}`}>{TEXTO[s.estado]}</span>
                  {s.enlace ? (
                    <a className="salud__enlace" href={s.enlace} target="_blank" rel="noreferrer noopener" aria-label={`Página de estado de ${s.nombre}`}>
                      <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
          {!datos ? <p className="salud__pie">Revisando…</p> : <p className="salud__pie">Revisado {fechaRelativa(datos.revisado)}. Si algo sale rojo o amarillo, no es la app: es el servicio.</p>}
        </div>
      ) : null}
    </div>
  );
}
