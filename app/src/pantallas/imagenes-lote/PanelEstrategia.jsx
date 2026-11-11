// "Ver estrategia": lo que decidió la IA para el lote, en español sencillo. Se abre apenas existe la estrategia y no
// frena nada (no hay que aprobarla). La paleta con sus muestras, la tipografía, el estilo, los beneficios y las
// características, y la tabla de cada variación: ángulo, formato y titular.
import { Sparkles } from 'lucide-react';
import { Modal } from '../../componentes/index.js';
import { porNumero } from '../../datos/imagenes.js';

const HEX = /^#[0-9a-f]{6}$/i;

function Lista({ titulo, items }) {
  const lista = (items || []).filter((t) => typeof t === 'string' && t.trim());
  if (!lista.length) return null;
  return (
    <div className="lote-estr__bloque">
      <h3 className="lote-estr__titulo">{titulo}</h3>
      <ul className="lote-estr__lista">
        {lista.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function PanelEstrategia({ estrategia: e, abierto, onCerrar }) {
  if (!abierto || !e) return null;
  const paleta = (e.paleta || []).filter((c) => HEX.test(String(c?.hex || '')));
  const plan = [...(e.plan || [])].sort(porNumero);
  return (
    <Modal abierto onCerrar={onCerrar} tamano="grande" icono={Sparkles} titulo="La estrategia de tu lote" descripcion={e.resumen || 'Lo que decidió la IA para tus anuncios.'} className="lote-estr">
      <div className="lote-estr__cuerpo">
        {paleta.length ? (
          <div className="lote-estr__bloque">
            <h3 className="lote-estr__titulo">Paleta</h3>
            <ul className="lote-estr__paleta">
              {paleta.map((c) => (
                <li key={c.hex} className="lote-estr__color">
                  {/* (la muestra es el color de la marca del usuario: un dato, no un color de la interfaz) */}
                  <span className="lote-estr__muestra" style={{ background: c.hex }} aria-hidden="true" />
                  <span className="lote-estr__color-textos">
                    <span className="lote-estr__color-nombre">{c.nombre || 'Color'}</span>
                    <span className="lote-estr__hex t-mono">{c.hex.toUpperCase()}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="lote-estr__dos">
          {e.tipografia ? (
            <div className="lote-estr__bloque">
              <h3 className="lote-estr__titulo">Tipografía</h3>
              <p className="lote-estr__texto">{e.tipografia}</p>
            </div>
          ) : null}
          {e.estilo ? (
            <div className="lote-estr__bloque">
              <h3 className="lote-estr__titulo">Estilo</h3>
              <p className="lote-estr__texto">{e.estilo}</p>
            </div>
          ) : null}
        </div>

        <div className="lote-estr__dos">
          <Lista titulo="Beneficios" items={e.beneficios} />
          <Lista titulo="Características" items={e.caracteristicas} />
        </div>

        {plan.length ? (
          <div className="lote-estr__bloque">
            <h3 className="lote-estr__titulo">Cada anuncio</h3>
            <div className="lote-estr__tabla" role="table" aria-label="Cada anuncio: ángulo, formato y titular">
              <div className="lote-estr__fila lote-estr__fila--cabecera" role="row">
                <span role="columnheader">V</span>
                <span role="columnheader">Ángulo</span>
                <span role="columnheader">Formato</span>
                <span role="columnheader">Titular</span>
              </div>
              {plan.map((f) => (
                <div key={f.v} className="lote-estr__fila" role="row">
                  <span role="cell" className="lote-estr__v t-num">
                    {f.v}
                  </span>
                  <span role="cell">{f.angulo || '—'}</span>
                  <span role="cell" className="t-3">
                    {f.formato || '—'}
                  </span>
                  <span role="cell" className="lote-estr__titular">
                    {f.titular || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
