// «Salud de plataformas» (barra de arriba, 2026-11-18): un punto de color con el estado de los servicios que usa la
// app (ElevenLabs, kie.ai, Claude, ChatGPT) y, al tocarlo, el detalle de cada uno con su página de estado. Lo arma el
// servidor (GET /api/salud, lib/salud.js) leyendo las páginas de estado oficiales y probando las claves gratis.
// Se revisa cada 2 minutos y al abrir la ventana.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, RotateCcw } from 'lucide-react';
import { PuntoEstado } from '../componentes/Insignia.jsx';
import { fechaRelativa } from '../datos/formato.js';

const CADA_MS = 2 * 60000;
const TONO = { operativo: 'ok', lento: 'aviso', degradado: 'aviso', caido: 'error', desconocido: 'neutro' };
const TEXTO = { operativo: 'Operativo', lento: 'Lento', degradado: 'Con fallas', caido: 'Sin respuesta', desconocido: 'Sin revisar' };
const GENERAL = { operativo: 'Todo operativo', lento: 'Algo va lento', degradado: 'Un servicio tiene fallas', caido: 'Un servicio no responde', desconocido: 'Revisando…' };

async function pedirSalud(fresco = false, servicio = null) {
  const q = servicio ? `?servicio=${encodeURIComponent(servicio)}` : fresco ? '?fresco=1' : '';
  const r = await fetch(`/api/salud${q}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function SaludPlataformas() {
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [uno, setUno] = useState(null); // el servicio que se está revisando con su ↻
  const [abiertos, setAbiertos] = useState({}); // los desplegables abiertos (kie: por modelo)
  const caja = useRef(null);
  const revisarUno = async (id) => {
    setUno(id);
    try {
      setDatos(await pedirSalud(false, id));
    } catch {
      /* se ve el estado de antes */
    } finally {
      setUno(null);
    }
  };

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
              {g.servicios.map((s) => {
                const conModelos = Array.isArray(s.modelos) && s.modelos.length > 0;
                const abierto = Boolean(abiertos[s.id]);
                return (
                  <div key={s.id} className="salud__item">
                    <div className="salud__servicio">
                      <PuntoEstado tono={TONO[s.estado]} />
                      {conModelos ? (
                        <button type="button" className="salud__nombre salud__nombre--boton" aria-expanded={abierto} onClick={() => setAbiertos((x) => ({ ...x, [s.id]: !x[s.id] }))}>
                          {s.nombre}
                          <ChevronDown size={13} strokeWidth={2.4} className={abierto ? 'salud__flecha salud__flecha--abierta' : 'salud__flecha'} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="salud__nombre">{s.nombre}</span>
                      )}
                      <span className={`salud__estado salud__estado--${TONO[s.estado]}`}>{TEXTO[s.estado]}</span>
                      <button type="button" className="salud__mini" onClick={() => revisarUno(s.id)} disabled={uno !== null} title={`Revisar ${s.nombre} ahora`} aria-label={`Revisar ${s.nombre} ahora`}>
                        <RotateCcw size={12} strokeWidth={2.2} className={uno === s.id ? 'girando' : ''} aria-hidden="true" />
                      </button>
                      {s.enlace ? (
                        <a className="salud__mini" href={s.enlace} target="_blank" rel="noreferrer noopener" title={`Página de estado de ${s.nombre}`} aria-label={`Página de estado de ${s.nombre}`}>
                          <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                    {s.estado !== 'operativo' && s.detalle ? <p className={`salud__detalle salud__detalle--${TONO[s.estado]}`}>{s.detalle}</p> : null}
                    {conModelos && abierto ? (
                      <ul className="salud__modelos">
                        {s.modelos.map((m) => (
                          <li key={m.nombre} title={m.detalle}>
                            <PuntoEstado tono={TONO[m.estado]} />
                            <span className="salud__modelo">{m.nombre}</span>
                            <span className={`salud__estado salud__estado--${TONO[m.estado]}`}>{TEXTO[m.estado]}</span>
                          </li>
                        ))}
                        <li className="salud__modelos-nota">Según tus generaciones de los últimos 7 días</li>
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
          <p className="salud__pie">{datos ? `Revisado ${fechaRelativa(datos.revisado)}` : 'Revisando…'}</p>
        </div>
      ) : null}
    </div>
  );
}
