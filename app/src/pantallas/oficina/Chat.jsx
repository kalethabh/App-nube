// El chat con la coordinadora (2026-11-19r; 2026-11-20e: como una asistente de verdad). Le escribes como a una persona
// («hazme un video UGC de Aguaje», «dame 10 variaciones de este texto») y le pasas archivos (clip, pegar o arrastrar:
// imágenes, PDF, Word, texto). Ella reparte el trabajo y lo SIGUE: cuando el guion está listo te escribe con el costo y
// te pregunta si lo produce («Dale» aquí o escríbeselo), y cuando termina te deja el enlace. Lo que escribe ella misma
// (variaciones, revisiones, copies) llega como una «entrega» para copiar o descargar.
// Servidor: GET/POST/DELETE /api/oficina/chat y POST /api/oficina/chat/adjuntos (lib/oficina-chat.js).
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Eraser, FileText, Film, Loader2, Paperclip, Send, X } from 'lucide-react';
import { useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';

const CLAVE = 'oficina:chat';
const ESTADO = { escribiendo: 'escribiendo el guion…', aprobar: 'espera tu sí', produciendo: 'produciéndose', listo: 'listo', error: 'se frenó', 'no-esta': 'ya no está' };
const IDEAS = ['Hazme un video UGC de mi producto', 'Dame 10 variaciones de este texto', '5 anuncios de imagen desde la investigación', '¿Cómo va todo?'];
const MAX_ADJ = 6;
const dinero = (n) => `US$${(Math.round(Number(n) * 100) / 100).toFixed(2)}`;

function Adjunto({ a, onQuitar }) {
  const Icono = a.tipo === 'video' ? Film : FileText;
  return (
    <span className={`of-adj${a.subiendo ? ' of-adj--subiendo' : ''}`} title={a.nombre}>
      {a.tipo === 'imagen' && a.url ? <img src={a.url} alt="" /> : a.subiendo ? <Loader2 size={14} className="girando" aria-hidden="true" /> : <Icono size={14} aria-hidden="true" />}
      <span>{a.nombre}</span>
      {onQuitar ? (
        <button type="button" onClick={onQuitar} aria-label={`Quitar ${a.nombre}`}>
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}

function Entrega({ e }) {
  const { aviso } = useAvisos();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(e.texto);
      aviso({ tipo: 'exito', titulo: 'Copiado' });
    } catch {
      aviso({ tipo: 'error', titulo: 'No pude copiarlo', texto: 'Selecciónalo y cópialo a mano.' });
    }
  };
  const descargar = () => {
    const url = URL.createObjectURL(new Blob([e.texto], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${e.titulo.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'entrega'}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="of-entrega">
      <div className="of-entrega__cabeza">
        <strong>{e.titulo}</strong>
        <button type="button" onClick={copiar} aria-label="Copiar" title="Copiar">
          <Copy size={14} />
        </button>
        <button type="button" onClick={descargar} aria-label="Descargar" title="Descargar">
          <Download size={14} />
        </button>
      </div>
      <pre>{e.texto}</pre>
    </div>
  );
}

export function Chat({ coordinadora, onCerrar, inicial = '' }) {
  const { aviso } = useAvisos();
  const [texto, setTexto] = useState(inicial);
  const [adjuntos, setAdjuntos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [rapido, setRapido] = useState(false);
  const [encima, setEncima] = useState(false);
  const { datos, recargar } = useDatos(CLAVE, () => pedirNuevo('/api/oficina/chat'), { cadaMs: rapido ? 1500 : 6000 });
  const pensando = Boolean(datos?.pensando);
  const mensajes = datos?.mensajes || [];
  const pendientes = datos?.pendientes || [];
  const fondo = useRef(null);
  const elegir = useRef(null);
  useEffect(() => setRapido(pensando), [pensando]);
  useEffect(() => {
    fondo.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length, pensando]);
  const nombre = coordinadora?.nombre || 'Coordinadora';
  const subiendo = adjuntos.some((a) => a.subiendo);

  const agregar = async (archivos) => {
    const lista = [...archivos].slice(0, MAX_ADJ - adjuntos.length);
    if (!lista.length) return;
    for (const f of lista) {
      const tmp = `t${Math.random().toString(36).slice(2)}`;
      setAdjuntos((x) => [...x, { id: tmp, nombre: f.name || 'archivo', tipo: f.type.startsWith('image/') ? 'imagen' : 'documento', subiendo: true }]);
      try {
        const r = await pedirNuevo('/api/oficina/chat/adjuntos', { metodo: 'POST', binario: f, encabezados: { 'x-nombre': encodeURIComponent(f.name || 'archivo') } });
        setAdjuntos((x) => x.map((a) => (a.id === tmp ? r : a)));
      } catch (e) {
        setAdjuntos((x) => x.filter((a) => a.id !== tmp));
        aviso({ tipo: 'error', titulo: `No pude subir «${f.name}»`, texto: e.message });
      }
    }
  };

  const enviar = async (t = texto) => {
    const limpio = t.trim();
    if ((!limpio && !adjuntos.length) || enviando || pensando || subiendo) return;
    setEnviando(true);
    try {
      await pedirNuevo('/api/oficina/chat', { metodo: 'POST', cuerpo: { texto: limpio, adjuntos: adjuntos.map((a) => a.id) } });
      setTexto('');
      setAdjuntos([]);
      setRapido(true);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude enviarlo', texto: e.message });
    } finally {
      setEnviando(false);
    }
  };
  const borrar = async () => {
    try {
      await pedirNuevo('/api/oficina/chat', { metodo: 'DELETE' });
      invalidar(CLAVE);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude borrarlo', texto: e.message });
    }
  };

  return (
    <aside
      className={`of-chat${encima ? ' of-chat--encima' : ''}`}
      style={{ '--color': coordinadora?.color || '#a3e635' }}
      aria-label={`Chat con ${nombre}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        agregar(e.dataTransfer.files);
      }}
    >
      <header className="of-chat__cabeza">
        <span className="of-chat__cara" aria-hidden="true">{coordinadora?.avatar || '👩‍💼'}</span>
        <span className="of-chat__quien">
          <strong>{nombre}</strong>
          <span>{pensando ? 'escribiendo…' : 'Tu asistente · coordina al equipo'}</span>
        </span>
        {mensajes.length ? (
          <button type="button" className="of-chat__icono" onClick={borrar} aria-label="Borrar la conversación" title="Borrar la conversación">
            <Eraser size={15} />
          </button>
        ) : null}
        <button type="button" className="of-chat__icono" onClick={onCerrar} aria-label="Cerrar el chat">
          <X size={16} />
        </button>
      </header>
      <div className="of-chat__mensajes" role="log" aria-live="polite">
        {!mensajes.length ? (
          <div className="of-chat__vacio">
            <p>¡Hola! Soy {nombre} 👋 Pídeme lo que necesites, como a una persona: un video, imágenes, textos, que revise algo… Me puedes pasar archivos con el clip. Yo me encargo y te aviso; nada se cobra sin tu sí.</p>
            <div className="of-chat__ideas">
              {IDEAS.map((i) => (
                <button key={i} type="button" onClick={() => setTexto(i)} disabled={enviando || pensando}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {mensajes.map((m) => (
          <div key={m.id} className={`of-msg of-msg--${m.de}`}>
            {m.adjuntos?.length ? (
              <div className="of-msg__adjuntos">
                {m.adjuntos.map((a) =>
                  a.tipo === 'imagen' ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="of-msg__foto">
                      <img src={a.url} alt={a.nombre} />
                    </a>
                  ) : (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                      <Adjunto a={a} />
                    </a>
                  ),
                )}
              </div>
            ) : null}
            <p>{m.texto}</p>
            {m.entrega ? <Entrega e={m.entrega} /> : null}
            {m.acciones?.length ? (
              <ul className="of-msg__acciones">
                {m.acciones.map((a, i) => (
                  <li key={i}>
                    {a.href && a.ok ? (
                      <a href={a.href} className="of-accion">
                        <Check size={13} aria-hidden="true" /> <span>{a.titulo}</span>
                        {a.estado ? <small className={`of-accion__estado of-accion__estado--${a.estado}`}>{ESTADO[a.estado] || a.estado}</small> : null}
                      </a>
                    ) : (
                      <span className={`of-accion${a.ok === false ? ' of-accion--mal' : ''}`}>{a.titulo}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {pensando ? (
          <div className="of-msg of-msg--coordinadora of-msg--pensando" aria-label={`${nombre} está escribiendo`}>
            <span /> <span /> <span />
          </div>
        ) : null}
        <div ref={fondo} />
      </div>
      {pendientes.length && !pensando ? (
        <div className="of-chat__pendientes">
          {pendientes.slice(-3).map((p) => (
            <div key={p.id} className="of-pendiente">
              <span>
                {p.titulo} · <strong>{dinero(p.costo)}</strong>
              </span>
              <button type="button" onClick={() => enviar(`Dale, produce ${p.titulo} (${dinero(p.costo)})`)} disabled={enviando}>
                Dale
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {encima ? <div className="of-chat__soltar">Suéltalo aquí y se lo paso a {nombre}</div> : null}
      <form
        className="of-chat__escribir"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        {adjuntos.length ? (
          <div className="of-chat__adjuntos">
            {adjuntos.map((a) => (
              <Adjunto key={a.id} a={a} onQuitar={a.subiendo ? null : () => setAdjuntos((x) => x.filter((y) => y.id !== a.id))} />
            ))}
          </div>
        ) : null}
        <div className="of-chat__fila">
          <input ref={elegir} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.html,video/*" onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
          <button type="button" className="of-chat__clip" onClick={() => elegir.current?.click()} disabled={adjuntos.length >= MAX_ADJ} aria-label="Adjuntar un archivo" title="Adjuntar imagen, PDF o documento">
            <Paperclip size={16} />
          </button>
          <textarea
            rows={2}
            maxLength={2000}
            placeholder={`Escríbele a ${nombre}…`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={(e) => {
              const files = [...(e.clipboardData?.files || [])];
              if (files.length) {
                e.preventDefault();
                agregar(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            aria-label={`Mensaje para ${nombre}`}
          />
          <button type="submit" className="of-chat__enviar" disabled={(!texto.trim() && !adjuntos.length) || enviando || pensando || subiendo} aria-label="Enviar">
            <Send size={16} />
          </button>
        </div>
      </form>
    </aside>
  );
}
