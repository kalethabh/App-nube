// «Editar textos» de un anuncio hecho con una plantilla: los campos de su plantilla (titular, rótulos, burbujas, datos…).
// Al guardar, la app vuelve a dibujar solo esa imagen (en cuadrado y en vertical) en 1-2 s: sin IA y sin costo.
// Una palabra entre *asteriscos* en el titular va con el color de acento.
import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Modal } from '../../componentes/index.js';

const comoTexto = (c, v) => {
  if (c.tipo === 'lista') return (Array.isArray(v) ? v : []).join('\n');
  if (c.tipo === 'numero') return String(Number(v) || 0);
  if (c.tipo === 'pares') return Array.from({ length: c.cuantos || 4 }, (_, i) => ({ ingrediente: v?.[i]?.ingrediente || '', beneficio: v?.[i]?.beneficio || '' }));
  if (c.tipo === 'datos') return Array.from({ length: c.cuantos || 3 }, (_, i) => ({ valor: v?.[i]?.valor || '', etiqueta: v?.[i]?.etiqueta || '' }));
  return typeof v === 'string' ? v : '';
};
const deTexto = (c, v) => {
  if (c.tipo === 'lista') return String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (c.tipo === 'numero') return Number(v) || 0;
  return v;
};

/** variacion: { v, plantilla: { id, nombre, campos, textos } } · onGuardar(v, textos) -> Promise · onCerrar */
export function ModalTextos({ variacion, onGuardar, onCerrar }) {
  const p = variacion?.plantilla;
  const [valores, setValores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!p) return;
    setValores(Object.fromEntries(p.campos.map((c) => [c.clave, comoTexto(c, p.textos?.[c.clave])])));
    setError(null);
    setEnviando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variacion?.v, p?.id]);
  if (!p) return null;
  const poner = (k, v) => setValores((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await onGuardar(variacion.v, Object.fromEntries(p.campos.map((c) => [c.clave, deTexto(c, valores[c.clave])])));
    } catch (e) {
      setError(e?.message || 'No pude guardarlo. Vuelve a intentarlo.');
      setEnviando(false);
    }
  };
  return (
    <Modal
      abierto
      onCerrar={enviando ? undefined : onCerrar}
      icono={PenLine}
      titulo={`Editar textos · ${variacion.v}`}
      descripcion={`${p.nombre}. Se vuelve a dibujar en un segundo, sin IA y sin costo.`}
      pie={
        <>
          <Boton variante="fantasma" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton variante="primario" icono={PenLine} cargando={enviando} onClick={guardar}>
            Guardar y dibujar
          </Boton>
        </>
      }
    >
      <div className="pila lote-textos" style={{ '--hueco': '12px' }}>
        {p.campos.map((c) => {
          const v = valores[c.clave];
          if (c.tipo === 'pares' || c.tipo === 'datos') {
            const [a, b] = c.tipo === 'pares' ? ['ingrediente', 'beneficio'] : ['valor', 'etiqueta'];
            return (
              <fieldset key={c.clave} className="lote-textos__grupo">
                <legend>{c.etiqueta}</legend>
                {(Array.isArray(v) ? v : []).map((x, i) => (
                  <div key={i} className="lote-textos__par">
                    <CampoTexto etiqueta={c.etiquetas ? `${c.etiquetas[0]} ${i + 1}` : c.tipo === 'pares' ? `Ingrediente ${i + 1}` : `Valor ${i + 1}`} value={x[a]} maxLength={c.tipo === 'pares' ? 30 : 14} onChange={(e) => poner(c.clave, v.map((y, k) => (k === i ? { ...y, [a]: e.target.value } : y)))} disabled={enviando} />
                    <CampoTexto etiqueta={c.etiquetas ? c.etiquetas[1] : c.tipo === 'pares' ? 'Beneficio' : 'Etiqueta'} value={x[b]} maxLength={c.max} onChange={(e) => poner(c.clave, v.map((y, k) => (k === i ? { ...y, [b]: e.target.value } : y)))} disabled={enviando} />
                  </div>
                ))}
              </fieldset>
            );
          }
          if (c.tipo === 'parrafo' || c.tipo === 'lista') {
            return (
              <AreaTexto
                key={c.clave}
                etiqueta={c.etiqueta}
                filas={c.tipo === 'lista' ? Math.min(6, c.cuantos || 3) : 4}
                maxLength={c.tipo === 'lista' ? (c.max + 1) * (c.cuantos || 6) : c.max}
                value={v ?? ''}
                onChange={(e) => poner(c.clave, e.target.value)}
                ayuda={c.tipo === 'lista' ? `Hasta ${c.cuantos}, uno por línea.` : undefined}
                disabled={enviando}
              />
            );
          }
          return (
            <CampoTexto
              key={c.clave}
              etiqueta={c.etiqueta}
              type={c.tipo === 'numero' ? 'number' : 'text'}
              min={c.tipo === 'numero' ? 0 : undefined}
              max={c.tipo === 'numero' ? c.max : undefined}
              maxLength={c.tipo === 'numero' ? undefined : c.max}
              value={v ?? ''}
              onChange={(e) => poner(c.clave, e.target.value)}
              ayuda={c.clave === 'titular' ? 'Una palabra entre *asteriscos* sale con el color de acento.' : undefined}
              disabled={enviando}
            />
          );
        })}
        {error ? (
          <p className="t-chico" role="alert" style={{ color: 'var(--peligro, #d33)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
