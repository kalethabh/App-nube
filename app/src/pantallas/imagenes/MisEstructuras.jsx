// (2026-11-26d) TUS ESTRUCTURAS GANADORAS. Pedido: «mejor que sean del Mayaverra y yo también pueda agregar». Subes (o
// pegas, o eliges de «Lo que me funciona») un anuncio que te funciona; tu IA lo mira y escribe su ficha; queda como P01,
// P02… y entra al sorteo «Al azar» con las de Mayaverra. Servidor: POST /api/imagen-ads/estructuras,
// GET /api/imagen-ads/estructuras/trabajos/:id, DELETE /api/imagen-ads/estructuras/:id.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { Boton, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function MisEstructuras({ propias = [], onCambio }) {
  const { aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [funciona, setFunciona] = useState(null);
  const [trabajando, setTrabajando] = useState('');
  const [listo, setListo] = useState(null);
  const subir = useRef(null);
  const { datos: fun } = useDatos('funcionan:imagen', () => pedirNuevo('/api/funcionan?tipo=imagen'));
  const items = (fun?.items || []).slice(0, 18);
  const local = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => local && URL.revokeObjectURL(local), [local]);
  const vista = local || funciona?.url || null;

  useEffect(() => {
    if (!abierto) return undefined;
    const alPegar = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => /^image\//.test(x.type));
      if (f) {
        setArchivo(f);
        setFunciona(null);
      }
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
  }, [abierto]);

  const elegir = (f) => {
    if (f && /^image\//.test(f.type)) {
      setArchivo(f);
      setFunciona(null);
      setListo(null);
    }
  };

  async function analizar() {
    if (trabajando || (!archivo && !funciona)) return;
    setTrabajando('Subiendo…');
    setListo(null);
    try {
      const q = funciona ? `?funciona=${encodeURIComponent(funciona.id)}` : '';
      const r = await fetch(`/api/imagen-ads/estructuras${q}`, { method: 'POST', headers: archivo ? { 'Content-Type': archivo.type } : {}, body: archivo || undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No pude subir el anuncio.');
      setTrabajando('Tu IA está mirando el anuncio… (tarda 1 o 2 minutos)');
      for (let i = 0; i < 400; i++) {
        await dormir(2500);
        const t = await pedirNuevo(`/api/imagen-ads/estructuras/trabajos/${d.trabajo}`);
        if (t.estado === 'listo') {
          setListo(t.estructura);
          setArchivo(null);
          setFunciona(null);
          await onCambio?.();
          return;
        }
        if (t.estado === 'error') throw new Error(t.mensaje);
      }
      throw new Error('Está tardando demasiado. Revisa tu IA en Ajustes y vuelve a intentarlo.');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude agregarlo', texto: e.message });
    } finally {
      setTrabajando('');
    }
  }

  async function quitar(x) {
    try {
      await pedirNuevo(`/api/imagen-ads/estructuras/${encodeURIComponent(x.id)}`, { metodo: 'DELETE' });
      await onCambio?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude quitarla', texto: e.message });
    }
  }

  return (
    <div className="enc-tuyas">
      <div className="enc-tuyas__arriba">
        <span className="enc-etiqueta">Tus estructuras {propias.length ? `(${propias.length})` : ''}</span>
        {!abierto ? (
          <Boton variante="secundario" tamano="chico" icono={Plus} onClick={() => setAbierto(true)}>
            Agregar un anuncio ganador
          </Boton>
        ) : null}
      </div>
      {propias.length ? (
        <ul className="enc-tuyas__lista">
          {propias.map((x) => (
            <li key={x.id} title={x.nombre}>
              <img src={`/api/imagen-ads/estructuras/${x.id}/imagen`} alt="" loading="lazy" />
              <span>
                <b>{x.id}</b> {x.nombre}
              </span>
              <button type="button" onClick={() => quitar(x)} aria-label={`Quitar ${x.id}`} title="Quitar">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : !abierto ? (
        <p className="enc-ayuda">Sube un anuncio que te funcione: tu IA lo analiza y entra al sorteo junto con los de Mayaverra.</p>
      ) : null}
      {abierto ? (
        <div className="enc-tuyas__nueva">
          <div
            className={`enc-soltar${vista ? ' enc-soltar--con' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              elegir(e.dataTransfer?.files?.[0]);
            }}
          >
            {vista ? (
              <div className="enc-tuyas__vista">
                <img src={vista} alt="" />
                <button type="button" onClick={() => { setArchivo(null); setFunciona(null); }} aria-label="Cambiar la imagen">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button type="button" className="enc-soltar__boton" onClick={() => subir.current?.click()}>
                <Upload size={20} aria-hidden="true" />
                <strong>Sube el anuncio ganador</strong>
                <small>o arrástralo aquí, o pégalo con Cmd/Ctrl + V</small>
              </button>
            )}
            <input ref={subir} type="file" accept="image/*" hidden onChange={(e) => elegir(e.target.files?.[0])} />
          </div>
          {items.length && !vista ? (
            <div className="enc-tuyas__funciona">
              <small className="enc-ayuda">O elige uno de «Lo que me funciona»:</small>
              <ul className="enc-funciona">
                {items.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => { setFunciona(x); setArchivo(null); setListo(null); }} title={x.titulo || ''}>
                      <img src={x.url} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="enc-tuyas__acciones">
            <Boton variante="primario" tamano="chico" onClick={analizar} cargando={Boolean(trabajando)} disabled={!vista}>
              {trabajando ? 'Analizando…' : 'Analizar y agregar'}
            </Boton>
            <Boton variante="fantasma" tamano="chico" onClick={() => setAbierto(false)} disabled={Boolean(trabajando)}>
              Cerrar
            </Boton>
            {trabajando ? <small className="enc-ayuda">{trabajando}</small> : null}
          </div>
          {listo ? (
            <p className="enc-nota enc-nota--ok">
              Quedó como <b>{listo.id}</b>: {listo.nombre}. Ya entra al sorteo.
            </p>
          ) : null}
          <p className="enc-ayuda">Usa tu IA (Claude o ChatGPT): no cuesta. Solo se usa como estructura; nunca se copia su texto ni su marca.</p>
        </div>
      ) : null}
    </div>
  );
}
