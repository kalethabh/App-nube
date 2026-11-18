// «Voz del narrador» en la pantalla del guion (2026-11-18): la voz de tu cuenta de ElevenLabs que se va a usar. Si no
// elegiste una, la que eligió la app (la más parecida a la del video de referencia o la más indicada) y por qué. Se
// escucha y se cambia aquí mismo hasta que se genera la voz.
import { useMemo, useState } from 'react';
import { Mic, RotateCcw, Sparkles } from 'lucide-react';
import { Boton, Selector, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, useVoces } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { leerVoces } from './datos.js';
import { BotonEscuchar } from './BotonEscuchar.jsx';

const AUTO = '__auto__';

/** voz: la del estado del guion ({ id?, nombre?, auto?, motivo?, generada, eligiendo, error }) · onCambio(): recargar */
export function VozDelGuion({ slug, estilo, voz, onCambio }) {
  const { aviso } = useAvisos();
  const { datos, cargando, error, recargar } = useVoces(estilo);
  const { voces } = useMemo(() => leerVoces(datos, estilo), [datos, estilo]);
  const [guardando, setGuardando] = useState(false);
  if (!voz) return null;
  const elegida = voces.find((v) => v.id === voz.id);
  const cambiar = async (valor) => {
    setGuardando(true);
    try {
      if (valor === AUTO) await apiNuevo.cambiarVoz(slug, { auto: true });
      else {
        const v = voces.find((x) => x.id === valor);
        if (!v) return;
        await apiNuevo.cambiarVoz(slug, { id: v.id, nombre: v.nombre });
      }
      await onCambio?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cambiar la voz', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setGuardando(false);
    }
  };
  const valor = voz.auto || !voz.id ? (voz.id ? voz.id : AUTO) : voz.id;
  return (
    <Tarjeta relleno="compacto">
      <div className="nv-voz-guion">
        <span className="nv-voz-guion__titulo">
          <Mic size={14} strokeWidth={2.2} aria-hidden="true" /> Voz del narrador
        </span>
        {error ? (
          <div className="nv-voz nv-voz--falla" role="alert">
            <p>No pude traer tus voces de ElevenLabs. {error.message}</p>
            <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
              <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={recargar}>
                Reintentar
              </Boton>
              <Boton variante="fantasma" tamano="chico" href={enlace.ajustes()}>
                Revisar en Ajustes
              </Boton>
            </div>
          </div>
        ) : (
          <div className="nv-voz">
            <Selector
              aria-label="Voz del narrador"
              value={valor}
              disabled={voz.generada || guardando || (cargando && !voces.length)}
              onChange={(e) => cambiar(e.target.value)}
              opciones={[
                { valor: AUTO, etiqueta: voz.eligiendo && !voz.error ? 'La app la está eligiendo…' : 'Que la elija la app' },
                ...(voz.id && !elegida ? [{ valor: voz.id, etiqueta: voz.nombre || voz.id }] : []),
                ...voces.map((v) => ({ valor: v.id, etiqueta: v.detalle ? `${v.nombre} · ${v.detalle}` : v.nombre })),
              ]}
            />
            <BotonEscuchar id={`voz-guion-${slug}-${voz.id || 'ninguna'}`} url={elegida?.muestra} disabled={!elegida?.muestra} />
          </div>
        )}
        {voz.auto && voz.id ? (
          <p className="nv-voz-guion__nota">
            <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" /> La eligió la app: {voz.motivo || 'la más indicada de tu cuenta'}.
          </p>
        ) : null}
        {!voz.id && voz.error ? (
          <>
            <p className="nv-voz-guion__nota nv-voz-guion__nota--error">{voz.error}</p>
            <div>
              <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={() => cambiar(AUTO)} cargando={guardando}>
                Volver a intentar
              </Boton>
            </div>
          </>
        ) : null}
        {!voz.id && !voz.error ? <p className="nv-voz-guion__nota">{voz.eligiendo ? 'Buscando en tu cuenta de ElevenLabs la más parecida a la que pide el guion…' : 'Se elige sola de tu cuenta de ElevenLabs al terminar el guion, o elige tú una.'}</p> : null}
        {voz.generada ? <p className="nv-voz-guion__nota">La voz ya se generó con esta voz.</p> : null}
        {voz.produccion === 'ugc' ? <p className="nv-voz-guion__nota">Tu video se hace con una persona que habla a cámara: esta voz no se usa.</p> : null}
      </div>
    </Tarjeta>
  );
}
