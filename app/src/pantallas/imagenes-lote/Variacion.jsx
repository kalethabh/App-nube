// Una variación del lote: V##, su ángulo y su formato, el cuadrado y el vertical lado a lado (a la misma altura) y,
// debajo de cada imagen, Descargar · Copiar prompt · Regenerar. La imagen aparece apenas existe, aunque todavía se
// esté revisando. Las insignias dicen lo que no es "lista": con aviso, sin revisar, sin imagen… Desde 2026-11-09 la
// revisión no rehace nada sola: lo que notó queda debajo («La revisión notó: …») con «Corregir esto» y Regenerar.
import { memo, useContext, useState } from 'react';
import { Clock, Copy, Download, ImageOff, LoaderCircle, PenLine, RefreshCw, ScanEye, WandSparkles } from 'lucide-react';
import { Boton, BotonFunciona, Insignia, Tooltip } from '../../componentes/index.js';
import { LoteFunciona } from '../../datos/funcionan.js';
import { ESTADOS_PIEZA, PIEZA_EN_MARCHA, PIEZA_FINAL, partesDePieza } from '../../datos/imagenes.js';

/** La insignia de una pieza (nada si está lista: en una galería de 100, "Lista" en cada una es ruido). */
export function InsigniaPieza({ p, variante = 'vidrio', tamano = 'chico' }) {
  if (!p) return null;
  if (p.pedido && PIEZA_FINAL.has(p.estado)) return <Insignia estado="generando" variante={variante} tamano={tamano} texto="Cambio en camino" />;
  if (p.estado === 'listo') return variante === 'vidrio' ? null : <Insignia estado="listo" tamano={tamano} texto="Lista" />;
  const e = ESTADOS_PIEZA[p.estado];
  if (!e) return null;
  return <Insignia estado={e.estado} tono={e.tono} variante={variante} tamano={tamano} texto={e.texto} />;
}

/**
 * Por qué no se puede regenerar ahora (para el globo del botón). `cuadrado`: el 1:1 de un vertical (un vertical sale
 * de su cuadrado: sin cuadrado, no hay vertical); `sinPrompt`: la variación no se pudo escribir.
 */
export function porQueNo(p, { cuadrado = null, sinPrompt = false } = {}) {
  if (p.pedido) return 'Ya tiene un cambio en camino';
  if (sinPrompt) return 'Primero toca «Escribir de nuevo»';
  if (partesDePieza(p.pieza).formato === '9:16' && cuadrado && PIEZA_FINAL.has(cuadrado.estado) && !cuadrado.url) return 'Regenera primero el cuadrado';
  if (!PIEZA_FINAL.has(p.estado)) return 'Espera a que termine de crearse';
  return 'Ahora no se puede regenerar';
}

/** Una imagen con sus tres botones. `nombre` va arriba cuando la pieza se ve sola (Cuadrados / Verticales). */
export const TarjetaPieza = memo(function TarjetaPieza({ p, formato, onAbrir, onRegenerar, onCopiar, nombre, cuadrado = null }) {
  const [cargada, setCargada] = useState(false);
  const lote = useContext(LoteFunciona);
  if (!p) return null;
  const vertical = formato === '9:16';
  const src = p.miniatura || p.url;
  const enMarcha = PIEZA_EN_MARCHA.has(p.estado);
  const estado = ESTADOS_PIEZA[p.estado] || ESTADOS_PIEZA['en-cola'];
  const quien = partesDePieza(p.pieza).nombre;
  const abrible = Boolean(src) || p.estado === 'sin-imagen';

  const contenido = (
    <>
      {src ? (
        <img
          key={src}
          className={`lote-pieza__img${cargada ? ' lote-pieza__img--cargada' : ''}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
          onLoad={() => setCargada(true)}
        />
      ) : (
        <span className={`lote-pieza__vacia lote-pieza__vacia--${p.estado}`} aria-hidden="true">
          {p.estado === 'sin-imagen' ? (
            <>
              <ImageOff size={20} strokeWidth={1.8} />
              <span className="lote-pieza__motivo">{p.motivo || 'kie no pudo hacer esta imagen'}</span>
            </>
          ) : enMarcha ? (
            <LoaderCircle size={18} strokeWidth={2.2} className="girando" />
          ) : (
            <Clock size={16} strokeWidth={2} />
          )}
        </span>
      )}
      {src && !cargada ? <span className="lote-pieza__cargando" aria-hidden="true" /> : null}
      {enMarcha ? <span className="lote-pieza__barrido" aria-hidden="true" /> : null}
      <span className="lote-pieza__arriba">
        <span className="lote-pieza__formato">{vertical ? '9:16' : '1:1'}</span>
        <InsigniaPieza p={p} />
      </span>
    </>
  );

  return (
    <div className={`lote-pieza lote-pieza--${p.estado}${vertical ? ' lote-pieza--vertical' : ''}`}>
      {nombre ? <span className="lote-pieza__nombre t-mini">{nombre}</span> : null}
      {abrible ? (
        <button type="button" className="lote-pieza__marco" style={{ aspectRatio: vertical ? '9 / 16' : '1 / 1' }} onClick={() => onAbrir(p.pieza)} aria-label={`${quien}: ${estado.texto}. Verla en grande`}>
          {contenido}
        </button>
      ) : (
        <div className="lote-pieza__marco" style={{ aspectRatio: vertical ? '9 / 16' : '1 / 1' }} role="img" aria-label={`${quien}: ${estado.texto}`}>
          {contenido}
        </div>
      )}
      <div className="lote-pieza__acciones">
        <Tooltip texto={p.url ? 'Descargar' : 'Todavía no hay imagen'}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Download} etiqueta={`Descargar ${quien}`} href={p.url || undefined} download={p.descarga || true} disabled={!p.url} />
        </Tooltip>
        <Tooltip texto={p.hayPrompt ? 'Copiar prompt' : 'Todavía no se escribió'}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={Copy} etiqueta={`Copiar el prompt de ${quien}`} onClick={() => onCopiar(p)} disabled={!p.hayPrompt} />
        </Tooltip>
        <Tooltip texto={p.puedeRegenerar ? 'Regenerar' : porQueNo(p, { cuadrado })}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={RefreshCw} etiqueta={`Regenerar ${quien}`} onClick={() => onRegenerar(p)} disabled={!p.puedeRegenerar} />
        </Tooltip>
        {/* «Me funciona»: la guardas para hacer variantes ganadoras (Anuncios de imagen → Variantes) */}
        {lote && p.url ? <BotonFunciona tipo="imagen" lote={lote} pieza={p.pieza} /> : null}
      </div>
    </div>
  );
});

export const Variacion = memo(function Variacion({ x, ia = 'tu IA', conVertical, onAbrir, onRegenerar, onCopiar, onEscribir, escribiendo }) {
  const cuadrado = x.piezas?.['1:1'];
  const vertical = conVertical ? x.piezas?.['9:16'] : null;
  const datos = [x.angulo, x.formato].filter(Boolean).join(' · ');

  if (x.estado === 'sin-prompt') {
    return (
      <article className="lote-var lote-var--sin-prompt">
        <header className="lote-var__cabecera">
          <span className="lote-var__v t-num">{x.v}</span>
          {datos ? <span className="lote-var__datos t-mini t-recortar">{datos}</span> : null}
        </header>
        <div className="lote-var__sin">
          <PenLine size={18} strokeWidth={2} aria-hidden="true" />
          <p>No se pudo escribir este anuncio: {ia} lo intentó dos veces. Pídelo de nuevo y se crean sus imágenes solas.</p>
          <Boton variante="secundario" tamano="chico" icono={PenLine} cargando={escribiendo} onClick={() => onEscribir(x.v)}>
            Escribir de nuevo
          </Boton>
        </div>
      </article>
    );
  }

  const conProblemas = [cuadrado, vertical].filter((p) => p?.estado === 'te-necesita' && (p.problemas || []).length);
  return (
    <article className={`lote-var${vertical ? ' lote-var--doble' : ''}`} aria-label={`${x.v}${x.titular ? `: ${x.titular}` : ''}`}>
      <header className="lote-var__cabecera">
        <span className="lote-var__v t-num">{x.v}</span>
        {datos ? (
          <span className="lote-var__datos t-mini t-recortar" title={datos}>
            {datos}
          </span>
        ) : null}
      </header>
      {x.titular ? <p className="lote-var__titular t-dos-lineas">{x.titular}</p> : null}
      <div className="lote-var__par">
        <TarjetaPieza p={cuadrado} formato="1:1" onAbrir={onAbrir} onRegenerar={onRegenerar} onCopiar={onCopiar} />
        {vertical ? <TarjetaPieza p={vertical} formato="9:16" cuadrado={cuadrado} onAbrir={onAbrir} onRegenerar={onRegenerar} onCopiar={onCopiar} /> : null}
      </div>
      {conProblemas.length ? (
        <div className="lote-var__revision">
          <p className="lote-var__revision-titulo">
            <ScanEye size={13} strokeWidth={2.2} aria-hidden="true" /> La revisión notó:
          </p>
          <ul className="lote-var__problemas">
            {conProblemas.flatMap((p) =>
              p.problemas.map((t, i) => (
                <li key={`${p.pieza}-${i}`}>
                  <span>
                    <strong>{partesDePieza(p.pieza).formato === '9:16' ? 'Vertical' : 'Cuadrado'}:</strong> {t}
                  </span>
                </li>
              ))
            )}
          </ul>
          <div className="lote-var__corregir">
            {conProblemas.map((p) => (
              <Boton key={p.pieza} variante="secundario" tamano="chico" icono={WandSparkles} onClick={() => onRegenerar(p, { corregir: true })} disabled={!p.puedeRegenerar}>
                {conProblemas.length > 1 ? `Corregir el ${partesDePieza(p.pieza).formato === '9:16' ? 'vertical' : 'cuadrado'}` : 'Corregir esto'}
              </Boton>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
});
