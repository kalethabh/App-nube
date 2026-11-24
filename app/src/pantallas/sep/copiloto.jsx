// S.E.P › Copiloto (2026-11-24): el chat con tu IA (Claude o ChatGPT, la de Ajustes) que te asesora con el método
// S.E.P: lee tus objetivos, el avance del día y la bitácora, y contesta con diagnóstico → qué apagar → qué duplicar
// → proyección. Solo aconseja: nunca toca tu cuenta de Meta. Servidor: GET/POST /api/sep/copiloto (lib/sep-plan.js).
import { useEffect, useRef, useState } from 'react';
import { Bot, PauseCircle, Rocket, Send, Sun, TrendingUp } from 'lucide-react';
import { Boton } from '../../componentes/index.js';
import { pedirNuevo, useDatos, refrescar } from '../../datos/api.js';
import { fechaRelativa } from '../../datos/formato.js';

const RAPIDOS = [
  { icono: Sun, texto: 'Analicemos el día' },
  { icono: PauseCircle, texto: '¿Qué apago?' },
  { icono: TrendingUp, texto: '¿Qué escalo?' },
  { icono: Rocket, texto: 'Proyecta el cierre' },
];

export default function SepCopiloto() {
  const { datos, error } = useDatos('sep:copiloto', () => pedirNuevo('/api/sep/copiloto'), { cadaMs: 4000 });
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState('');
  const fondo = useRef(null);
  const mensajes = datos?.mensajes || [];
  const pensando = Boolean(datos?.pensando);

  useEffect(() => {
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes.length, pensando]);

  const enviar = async (t) => {
    const m = String(t ?? texto).trim();
    if (!m || enviando || pensando) return;
    setEnviando(true);
    setFalla('');
    try {
      await pedirNuevo('/api/sep/copiloto', { metodo: 'POST', cuerpo: { texto: m } });
      setTexto('');
      refrescar('sep:copiloto');
    } catch (e) {
      setFalla(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="sep-copiloto">
      <div className="sep-copiloto__rapidos" role="group" aria-label="Preguntas rápidas">
        {RAPIDOS.map(({ icono: Icono, texto: t }) => (
          <button key={t} type="button" disabled={enviando || pensando} onClick={() => enviar(t)}>
            <Icono size={14} aria-hidden="true" /> {t}
          </button>
        ))}
      </div>
      <div className="sep-copiloto__chat" ref={fondo}>
        {!mensajes.length ? (
          <div className="sep-copiloto__hola">
            <Bot size={28} aria-hidden="true" />
            <p><b>Soy tu copiloto S.E.P.</b> Conozco tu método (barrer anuncio → conjunto → campaña en 3/5/14 días, escalar duplicando, 1.2.5 y 1.5.5), tus objetivos, el avance del día y tu bitácora. Cuéntame cómo va el día o usa un botón de arriba. Solo aconsejo: nunca toco tu cuenta de Meta.</p>
          </div>
        ) : mensajes.map((m) => (
          <div key={m.id} className={`sep-copiloto__msj sep-copiloto__msj--${m.de === 'tu' ? 'tu' : 'el'}`}>
            <p>{m.texto}</p>
            <small>{fechaRelativa(m.fecha)}</small>
          </div>
        ))}
        {pensando ? <div className="sep-copiloto__msj sep-copiloto__msj--el sep-copiloto__pensando"><p>Pensando<span className="puntos"><i>.</i><i>.</i><i>.</i></span></p></div> : null}
      </div>
      {error || falla ? <p className="sep-error" role="alert">{falla || error.message}</p> : null}
      <div className="sep-copiloto__caja">
        <textarea
          rows={2}
          placeholder="Cuéntale al copiloto cómo va el día (pedidos, gasto, qué ves en Meta)…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <Boton variante="primario" icono={Send} cargando={enviando} disabled={pensando} onClick={() => enviar()}>Enviar</Boton>
      </div>
    </div>
  );
}
