// El chat con la coordinadora (2026-11-19r; 2026-11-20e: como una asistente de verdad). Le escribes como a una persona
// («hazme un video UGC de Aguaje», «dame 10 variaciones de este texto») y le pasas archivos (clip, pegar o arrastrar:
// imágenes, PDF, Word, texto). Ella reparte el trabajo y lo SIGUE: cuando el guion está listo te escribe con el costo y
// te pregunta si lo produce («Dale» aquí o escríbeselo), y cuando termina te deja el enlace. Lo que escribe ella misma
// (variaciones, revisiones, copies) llega como una «entrega» para copiar o descargar.
// Servidor: GET/POST/DELETE /api/oficina/chat y POST /api/oficina/chat/adjuntos (lib/oficina-chat.js).
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Eraser, FileText, Film, Loader2, Mic, Paperclip, Send, Square, X } from 'lucide-react';
import { useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';

const CLAVE = 'oficina:chat';
const ESTADO = { escribiendo: 'escribiendo el guion…', aprobar: 'espera tu sí', produciendo: 'produciéndose', listo: 'listo', error: 'se frenó', 'no-esta': 'ya no está' };
const IDEAS = ['Hazme un video UGC de mi producto', 'Te paso un video: hazme uno igual en estilo Zack', 'Dame 10 variaciones de este texto', '5 anuncios de imagen desde la investigación', '¿Cómo va todo?'];
const MAX_ADJ = 6;
const LARGO_MENSAJE = 2000; // (lo que guarda el servidor por mensaje: oficina-chat.js)
const LARGO_PEGADO = 1500; // un texto pegado más largo va como documento adjunto, entero
// (2026-11-20h) DICTAR POR VOZ: el dictado del navegador (Chrome, Edge, Safari) escribe mientras hablas; si no lo trae,
// se graba y se pasa a texto con ElevenLabs (POST /api/oficina/chat/voz). El texto queda en la caja para revisarlo.
const Dictado = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const idiomaVoz = () => (typeof navigator !== 'undefined' && /^es/i.test(navigator.language || '') ? navigator.language : 'es-CO');

function useDictado({ texto, setTexto, aviso }) {
  const [estado, setEstado] = useState('quieto'); // quieto | escuchando | grabando | transcribiendo
  const rec = useRef(null);
  const grab = useRef(null);
  const juntar = (base, dicho) => `${base}${base && dicho && !/\s$/.test(base) ? ' ' : ''}${dicho}`;
  useEffect(() => () => {
    rec.current?.abort?.();
    grab.current?.stream?.getTracks().forEach((t) => t.stop());
  }, []);
  const grabar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const partes = [];
      const base = texto;
      mr.ondataavailable = (e) => e.data.size && partes.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setEstado('transcribiendo');
        try {
          const blob = new Blob(partes, { type: mr.mimeType || 'audio/webm' });
          const r = await pedirNuevo('/api/oficina/chat/voz', { metodo: 'POST', binario: blob });
          setTexto(juntar(base, r.texto));
        } catch (e) {
          aviso({ tipo: 'error', titulo: 'No pude pasar tu voz a texto', texto: e.message });
        } finally {
          setEstado('quieto');
        }
      };
      grab.current = { mr, stream };
      mr.start();
      setEstado('grabando');
    } catch {
      aviso({ tipo: 'error', titulo: 'No tengo permiso para el micrófono', texto: 'Permítelo en el candado de la barra de direcciones y vuelve a tocar el micrófono.' });
      setEstado('quieto');
    }
  };
  const empezar = () => {
    if (!Dictado) return grabar();
    const r = new Dictado();
    r.lang = idiomaVoz();
    r.continuous = true;
    r.interimResults = true;
    const base = texto;
    r.onresult = (e) => {
      let dicho = '';
      for (let i = 0; i < e.results.length; i++) dicho += e.results[i][0].transcript;
      setTexto(juntar(base, dicho.trim()));
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') aviso({ tipo: 'error', titulo: 'No tengo permiso para el micrófono', texto: 'Permítelo en el candado de la barra de direcciones y vuelve a tocar el micrófono.' });
      else if (e.error === 'network') {
        // el dictado del navegador necesita internet de su lado: se graba y se transcribe en la app
        rec.current = null;
        grabar();
        return;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') aviso({ tipo: 'error', titulo: 'Se cortó el dictado', texto: 'Vuelve a tocar el micrófono.' });
    };
    r.onend = () => setEstado((x) => (x === 'escuchando' ? 'quieto' : x));
    rec.current = r;
    try {
      r.start();
      setEstado('escuchando');
    } catch {
      grabar();
    }
  };
  const parar = () => {
    if (estado === 'escuchando') rec.current?.stop();
    if (estado === 'grabando') grab.current?.mr?.stop();
    if (estado === 'escuchando') setEstado('quieto');
  };
  return { estado, alternar: () => (estado === 'quieto' ? empezar() : parar()) };
}

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

const NOMBRE_CRITERIO = { interes: 'interés', claridad: 'claridad', credibilidad: 'credibilidad', valor: 'valor', conversacion: 'conversación', narrativa: 'narrativa' };

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
        {e.nota ? (
          <span className={`of-entrega__nota${e.nota >= 8.5 ? ' of-entrega__nota--bien' : ''}`} title={`Su autoevaluación: ${Object.entries(e.criterios || {}).map(([k, v]) => `${NOMBRE_CRITERIO[k] || k} ${v}`).join(' · ')}`}>
            {e.nota.toFixed(1)}/10
          </span>
        ) : null}
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
  const voz = useDictado({ texto, setTexto, aviso });
  const hablando = voz.estado !== 'quieto';

  const agregar = async (archivos) => {
    const lista = [...archivos].slice(0, MAX_ADJ - adjuntos.length);
    if (!lista.length) return;
    for (const f of lista) {
      const tmp = `t${Math.random().toString(36).slice(2)}`;
      setAdjuntos((x) => [...x, { id: tmp, nombre: f.name || 'archivo', tipo: f.type.startsWith('image/') ? 'imagen' : f.type.startsWith('video/') ? 'video' : 'documento', subiendo: true }]);
      try {
        const r = await pedirNuevo('/api/oficina/chat/adjuntos', { metodo: 'POST', binario: f, encabezados: { 'x-nombre': encodeURIComponent(f.name || 'archivo') } });
        setAdjuntos((x) => x.map((a) => (a.id === tmp ? r : a)));
      } catch (e) {
        setAdjuntos((x) => x.filter((a) => a.id !== tmp));
        aviso({ tipo: 'error', titulo: `No pude subir «${f.name}»`, texto: e.message });
      }
    }
  };

  // (2026-11-20u) PEGAR: imágenes y archivos (también los que el navegador da solo como «items», p. ej. una captura o
  // una imagen copiada de una página) y textos largos (un prompt, un documento, una tabla): lo que no cabe en el
  // mensaje (o es muy largo) llega entero como un documento adjunto que ella lee.
  const pegar = (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const archivos = [...(cd.files || [])];
    if (!archivos.length) for (const it of cd.items || []) if (it.kind === 'file') {
      const f = it.getAsFile();
      if (f) archivos.push(f);
    }
    if (archivos.length) {
      e.preventDefault();
      agregar(archivos.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pegado-${Date.now()}-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))));
      return;
    }
    const t = cd.getData('text/plain') || '';
    const cabe = LARGO_MENSAJE - texto.length;
    if (t.length > LARGO_PEGADO || t.length > cabe) {
      e.preventDefault();
      const primera = t.trim().split('\n')[0].replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 40) || 'texto';
      agregar([new File([t], `${primera.replace(/\s+/g, '-')}.md`, { type: 'text/markdown' })]);
      aviso({ tipo: 'info', titulo: 'Lo adjunté completo', texto: `El texto pegado (${t.length.toLocaleString('es')} caracteres) va como documento para que le llegue entero.` });
    }
  };

  const enviar = async (t = texto) => {
    const limpio = t.trim();
    if ((!limpio && !adjuntos.length) || enviando || pensando || subiendo) return;
    setEnviando(true);
    try {
      if (voz.estado === 'escuchando' || voz.estado === 'grabando') voz.alternar();
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
      onPaste={(e) => {
        if (e.target?.tagName !== 'TEXTAREA') pegar(e);
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
          <button
            type="button"
            className={`of-chat__mic${hablando ? ' of-chat__mic--activo' : ''}`}
            onClick={voz.alternar}
            disabled={voz.estado === 'transcribiendo'}
            aria-pressed={hablando}
            aria-label={hablando ? 'Terminar de dictar' : 'Dictar por voz'}
            title={hablando ? 'Terminar de dictar' : 'Dictar por voz'}
          >
            {voz.estado === 'transcribiendo' ? <Loader2 size={16} className="girando" /> : hablando ? <Square size={14} /> : <Mic size={16} />}
          </button>
          <textarea
            rows={2}
            maxLength={LARGO_MENSAJE}
            placeholder={voz.estado === 'escuchando' || voz.estado === 'grabando' ? 'Te escucho… toca el cuadrado al terminar' : voz.estado === 'transcribiendo' ? 'Pasando tu voz a texto…' : `Escríbele o díctale a ${nombre}…`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={pegar}
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
