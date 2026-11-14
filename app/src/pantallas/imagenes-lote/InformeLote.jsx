// El informe del lote terminado: cómo salió la revisión (lo que pasó la revisión, lo que la revisión notó y quedó
// para que decidas, lo que quedó sin revisar, sin imagen o sin escribir; «se arreglaron solas» solo en lotes de antes:
// desde 2026-11-09 la revisión no rehace nada sola) y el COSTO real, que solo se ve aquí,
// con el lote ya hecho (DISENO.md, regla 7; antes de generar, el formulario muestra el costo ESTIMADO). El costo sale
// del servidor (informe.costo): la pantalla no lo calcula.
import { CircleCheck, ImageOff, PenLine, Receipt, RefreshCw, ScanEye, WandSparkles, Wrench } from 'lucide-react';
import { Boton, Estimado, Insignia, Seccion, Tarjeta, TarjetaCabecera } from '../../componentes/index.js';
import { dinero, plural } from '../../datos/formato.js';
import { motorDelLote, partesDePieza } from '../../datos/imagenes.js';
import { nombreDeIA } from '../ajustes/datos.js';
import { MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';

const nombre = (id) => partesDePieza(id).nombre;
const idDe = (x) => (typeof x === 'string' ? x : x?.pieza);

function Grupo({ icono: Icono, tono, titulo, children }) {
  return (
    <div className={`lote-inf__grupo lote-inf__grupo--${tono}`}>
      <h3 className="lote-inf__titulo">
        <Icono size={15} strokeWidth={2.2} aria-hidden="true" />
        {titulo}
      </h3>
      {children}
    </div>
  );
}

export function InformeLote({ vista, onRegenerar, onAbrir, onEscribir, escribiendo }) {
  const inf = vista.informe;
  // la IA que hizo este lote (sin dato, Claude: antes solo existía Claude)
  const ia = nombreDeIA(motorDelLote(vista));
  const r = inf.revision || {};
  const c = inf.costo || null;
  const modoPrueba = Boolean(inf.modoPrueba ?? vista.modoPrueba);
  const piezas = new Map((vista.variaciones || []).flatMap((x) => Object.values(x.piezas || {}).filter(Boolean).map((p) => [p.pieza, p])));
  const archivos = Number(inf.archivos) || 0;
  const arregladas = (r.arregladas || []).map(idDe).filter(Boolean);
  const rehechas = (r.rehechasPorTi || []).map(idDe).filter(Boolean);
  const conDetalles = (r.conDetalles || []).filter((x) => idDe(x));
  const sinRevisar = (r.sinRevisar || []).map(idDe).filter(Boolean);
  const sinImagen = (r.sinImagen || []).filter((x) => idDe(x));
  const sinPrompt = (r.sinPrompt || []).map((x) => (typeof x === 'string' ? x : x?.v)).filter(Boolean);

  const regenerar = (id) => {
    const p = piezas.get(id);
    if (p) onRegenerar(p);
  };
  const puede = (id) => Boolean(piezas.get(id)?.puedeRegenerar);
  const enlacePieza = (id) => (
    <button type="button" className="lote-inf__pieza" onClick={() => onAbrir(id)}>
      {nombre(id)}
    </button>
  );

  return (
    <Seccion titulo="Tu informe" icono={ScanEye} className="lote-informe">
      <div className="lote-informe__rejilla">
        <Tarjeta variante="elevada" className="lote-inf">
          <TarjetaCabecera icono={ScanEye} titulo="La revisión" subtitulo="La IA miró cada imagen contra tu producto y sus textos, letra por letra." />
          <div className="lote-inf__resumen">
            <span className="lote-inf__grande t-num">{Number(r.aLaPrimera) || 0}</span>
            <span className="lote-inf__de">
              de {plural(archivos, 'imagen', 'imágenes')} pasaron la revisión
            </span>
          </div>

          {arregladas.length ? (
            <Grupo icono={Wrench} tono="aviso" titulo={arregladas.length === 1 ? '1 se arregló sola' : `${arregladas.length} se arreglaron solas`}>
              <p className="lote-inf__texto">Tenían un error y la app las hizo otra vez. Ya están bien.</p>
              <div className="lote-inf__piezas">{arregladas.map((id) => <span key={id}>{enlacePieza(id)}</span>)}</div>
            </Grupo>
          ) : null}

          {rehechas.length ? (
            <Grupo icono={RefreshCw} tono="neutro" titulo={rehechas.length === 1 ? '1 la regeneraste tú' : `${rehechas.length} las regeneraste tú`}>
              <p className="lote-inf__texto">Pediste un cambio y ya están bien.</p>
              <div className="lote-inf__piezas">{rehechas.map((id) => <span key={id}>{enlacePieza(id)}</span>)}</div>
            </Grupo>
          ) : null}

          {conDetalles.length ? (
            <Grupo icono={ScanEye} tono="aviso" titulo={conDetalles.length === 1 ? 'En 1 la revisión notó algo' : `En ${conDetalles.length} la revisión notó algo`}>
              <p className="lote-inf__texto">No se rehicieron solas: míralas antes de publicarlas y, si quieres, corrígelas o regenéralas (con «Corregir esto» la IA ya sabe qué salió mal).</p>
              <ul className="lote-inf__lista">
                {conDetalles.map((x) => {
                  const id = idDe(x);
                  return (
                    <li key={id} className="lote-inf__fila">
                      <div className="lote-inf__fila-textos">
                        {enlacePieza(id)}
                        {(x.problemas || []).map((t, i) => (
                          <span key={i} className="lote-inf__problema">
                            {t}
                          </span>
                        ))}
                      </div>
                      {/* (abre el mismo cuadro, con lo que notó la revisión y su «Corregir esto») */}
                      <Boton variante="secundario" tamano="chico" icono={WandSparkles} onClick={() => regenerar(id)} disabled={!puede(id)}>
                        Corregir o regenerar
                      </Boton>
                    </li>
                  );
                })}
              </ul>
            </Grupo>
          ) : null}

          {sinRevisar.length ? (
            <Grupo icono={ScanEye} tono="neutro" titulo={sinRevisar.length === 1 ? '1 quedó sin revisar' : `${sinRevisar.length} quedaron sin revisar`}>
              <p className="lote-inf__texto">La revisión de la IA no llegó a mirarlas. Revísalas tú antes de publicarlas.</p>
              <div className="lote-inf__piezas">{sinRevisar.map((id) => <span key={id}>{enlacePieza(id)}</span>)}</div>
            </Grupo>
          ) : null}

          {sinImagen.length ? (
            <Grupo icono={ImageOff} tono="error" titulo={sinImagen.length === 1 ? '1 quedó sin imagen' : `${sinImagen.length} quedaron sin imagen`}>
              <ul className="lote-inf__lista">
                {sinImagen.map((x) => {
                  const id = idDe(x);
                  return (
                    <li key={id} className="lote-inf__fila">
                      <div className="lote-inf__fila-textos">
                        <span className="lote-inf__nombre">{nombre(id)}</span>
                        <span className="lote-inf__problema">{x.motivo || 'kie no pudo hacer esta imagen'}</span>
                      </div>
                      <Boton variante="secundario" tamano="chico" icono={RefreshCw} onClick={() => regenerar(id)} disabled={!puede(id)}>
                        Intentar de nuevo
                      </Boton>
                    </li>
                  );
                })}
              </ul>
            </Grupo>
          ) : null}

          {sinPrompt.length ? (
            <Grupo icono={PenLine} tono="error" titulo={sinPrompt.length === 1 ? '1 anuncio no se pudo escribir' : `${sinPrompt.length} anuncios no se pudieron escribir`}>
              <ul className="lote-inf__lista">
                {sinPrompt.map((v) => (
                  <li key={v} className="lote-inf__fila">
                    <div className="lote-inf__fila-textos">
                      <span className="lote-inf__nombre">{v}</span>
                      <span className="lote-inf__problema">{ia} lo intentó dos veces y no le salió.</span>
                    </div>
                    <Boton variante="secundario" tamano="chico" icono={PenLine} cargando={escribiendo} onClick={() => onEscribir(v)}>
                      Escribir de nuevo
                    </Boton>
                  </li>
                ))}
              </ul>
            </Grupo>
          ) : null}

          {!arregladas.length && !rehechas.length && !conDetalles.length && !sinRevisar.length && !sinImagen.length && !sinPrompt.length ? (
            <p className="lote-inf__todo-bien">
              <CircleCheck size={15} strokeWidth={2.4} aria-hidden="true" /> Todas salieron bien.
            </p>
          ) : null}
        </Tarjeta>

        {c ? (
          <Tarjeta variante="elevada" className="lote-costo">
            <TarjetaCabecera icono={Receipt} titulo={modoPrueba ? 'Lo que habría costado' : 'Costo real'} subtitulo={Number(c.dolares) === 0 && !modoPrueba ? 'Las imágenes de este lote las hizo tu ChatGPT: sin costo por imagen.' : 'Las imágenes de este lote en kie.ai, con lo que regeneraste.'} />
            <div className="lote-costo__total">
              <span className="lote-costo__numero t-num">{dinero(c.dolares)}</span>
              {modoPrueba ? (
                <MarcaModoPrueba />
              ) : c.estimado ? (
                <Estimado explicacion="Algunas imágenes no quedaron anotadas (la app se cerró de golpe): esas se calcularon a su precio de siempre." />
              ) : (
                <Insignia estado="listo" tamano="chico" texto="Real" />
              )}
            </div>
            <p className="lote-costo__detalle">
              {plural(Number(c.piezas) || 0, 'imagen hecha', 'imágenes hechas')}
              {Number(c.estimadas) ? ` · ${c.estimadas} ${Number(c.estimadas) === 1 ? 'estimada' : 'estimadas'}` : ''}
            </p>
            <p className="lote-costo__nota">La estrategia, los anuncios y la revisión los hizo {ia} con tu plan: no se cobra aparte.</p>
          </Tarjeta>
        ) : null}
      </div>
    </Seccion>
  );
}
