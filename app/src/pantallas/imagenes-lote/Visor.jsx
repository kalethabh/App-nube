// La imagen en grande: ← / → pasan a la variación de al lado, Cuadrado / Vertical cambia de formato y "Versiones
// anteriores" deja comparar Antes / Ahora. Abajo los mismos tres botones (Descargar · Copiar prompt · Regenerar) y,
// en "Más", copiar el anuncio entero en JSON (y bajar la imagen sin logo). El prompt nunca se muestra.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, Ellipsis, FileJson, Hand, History, ImageOff, LoaderCircle, RefreshCw, ScanEye } from 'lucide-react';
import { Boton, Modal, Pestanas, Tooltip } from '../../componentes/index.js';
import { PIEZA_FINAL, partesDePieza } from '../../datos/imagenes.js';
import { fechaRelativa } from '../../datos/formato.js';
import { InsigniaPieza, porQueNo } from './Variacion.jsx';

const MOTIVO_VERSION = {
  revision: 'La rehízo la revisión', // (solo en lotes de antes: desde 2026-11-09 la revisión no rehace nada sola)
  usuario: 'Le pediste un cambio',
  'cuadrado-nuevo': 'Cambió su cuadrado',
};

function MenuMas({ p, conLogo, onCopiarJson }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !caja.current?.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    requestAnimationFrame(() => caja.current?.querySelector('[role="menuitem"]')?.focus());
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  return (
    <div className="lote-menu lote-menu--arriba" ref={caja}>
      <Tooltip texto="Más">
        <Boton variante="fantasma" soloIcono icono={Ellipsis} etiqueta="Más opciones" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)} />
      </Tooltip>
      {abierto ? (
        <div
          className="lote-menu__lista"
          role="menu"
          aria-label="Más opciones"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setAbierto(false);
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="lote-menu__item"
            disabled={!p.hayPrompt}
            onClick={() => {
              setAbierto(false);
              onCopiarJson(p);
            }}
          >
            <FileJson size={16} strokeWidth={2} aria-hidden="true" />
            <span>
              Copiar el anuncio en JSON
              <small>La ficha completa de este anuncio</small>
            </span>
          </button>
          {conLogo && p.urlSinLogo ? (
            <a role="menuitem" className="lote-menu__item" href={p.urlSinLogo} download={p.descarga ? p.descarga.replace(/(\.\w+)$/, '-sin-logo$1') : true} onClick={() => setAbierto(false)}>
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              <span>
                Descargar sin logo
                <small>La misma imagen, limpia</small>
              </span>
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Visor({ vista, variaciones, abierto, onCerrar, onIr, onFormato, onRegenerar, onCopiar }) {
  const [verVersion, setVerVersion] = useState(null); // n de una versión anterior, o null = la de ahora
  const [comparar, setComparar] = useState('ahora');
  const irRef = useRef(onIr);
  irRef.current = onIr;
  const x = abierto ? variaciones.find((y) => y.v === abierto.v) : null;
  // (2026-11-26i) los tamaños de ESTA variación (el lote, más los que se crearon para ella: 9:16 o 4:5)
  const tamanos = x ? Object.keys(x.piezas || {}) : [];
  const conVertical = tamanos.length > 1;
  const formato = abierto?.formato && tamanos.includes(abierto.formato) ? abierto.formato : '1:1';
  const p = x?.piezas?.[formato] || null;
  const clave = p ? `${p.pieza}|${p.version}` : null;

  useEffect(() => {
    setVerVersion(null);
    setComparar('ahora');
  }, [clave]);

  // ← y → pasan a la variación de al lado (si no estás escribiendo)
  useEffect(() => {
    if (!abierto) return undefined;
    const tecla = (e) => {
      if (/^(input|textarea|select)$/i.test(e.target?.tagName || '')) return;
      // (en Cuadrado / Vertical, Antes / Ahora o un menú, las flechas son de ese control)
      if (e.target?.closest?.('[role="tablist"], [role="menu"], [role="radiogroup"]')) return;
      if (document.querySelectorAll('.modal-velo').length > 1) return; // con otro modal encima, manda ese
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        irRef.current?.(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        irRef.current?.(-1);
      }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);

  if (!abierto || !x) return null;
  const i = variaciones.findIndex((y) => y.v === x.v);
  const versiones = [...(p?.versiones || [])].sort((a, b) => b.n - a.n);
  const anterior = verVersion !== null ? versiones.find((o) => o.n === verVersion) : null;
  const mostrar = anterior && comparar === 'antes' ? anterior : null;
  const src = mostrar ? mostrar.url : p?.url;
  const vertical = formato === '9:16';
  const nombre = p ? partesDePieza(p.pieza).nombre : x.v;

  // los tres botones (y "Más") van en el pie del modal. Con una versión anterior a la vista, Descargar y Copiar
  // prompt son de esa versión; Regenerar siempre rehace la de ahora.
  const urlVista = mostrar ? mostrar.url : p?.url;
  const pie = p ? (
    <div className="lote-visor__acciones">
      <Boton
        variante="secundario"
        icono={Download}
        href={urlVista || undefined}
        download={p.descarga ? (mostrar ? p.descarga.replace(/(\.\w+)$/, `-v${mostrar.n}$1`) : p.descarga) : true}
        disabled={!urlVista}
      >
        Descargar
      </Boton>
      <Boton variante="secundario" icono={Copy} onClick={() => onCopiar(p, mostrar ? { version: mostrar.n } : undefined)} disabled={!p.hayPrompt}>
        Copiar prompt
      </Boton>
      <Tooltip texto={p.puedeRegenerar ? null : porQueNo(p, { cuadrado: x.piezas?.['1:1'], sinPrompt: x.estado === 'sin-prompt' })}>
        <Boton variante="primario" icono={RefreshCw} onClick={() => onRegenerar(p)} disabled={!p.puedeRegenerar}>
          Regenerar
        </Boton>
      </Tooltip>
      <MenuMas p={p} conLogo={Boolean(vista.brief?.logo?.url)} onCopiarJson={(q) => onCopiar(q, { como: 'json' })} />
    </div>
  ) : null;

  return (
    <Modal abierto onCerrar={onCerrar} tamano="grande" pie={pie} titulo={`${x.v}${x.angulo ? ` · ${x.angulo}` : ''}`} descripcion={[x.formato, x.titular ? `«${x.titular}»` : null].filter(Boolean).join(' · ')} className="lote-visor">
      <div className="lote-visor__barra">
        {conVertical ? (
          <Pestanas
            variante="segmentado"
            tamano="chico"
            etiqueta="Formato"
            items={[
              { id: '1:1', etiqueta: 'Cuadrado' },
              { id: '9:16', etiqueta: 'Vertical' },
              { id: '4:5', etiqueta: 'Retrato 4:5' },
            ].filter((t) => tamanos.includes(t.id))}
            activa={formato}
            onCambio={onFormato}
          />
        ) : (
          <span />
        )}
        <div className="fila" style={{ '--hueco': '4px' }}>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronLeft} etiqueta="Anuncio anterior" disabled={i <= 0} onClick={() => onIr(-1)} />
          <span className="lote-visor__pos t-num">
            {i + 1} / {variaciones.length}
          </span>
          <Boton variante="fantasma" tamano="chico" soloIcono icono={ChevronRight} etiqueta="Anuncio siguiente" disabled={i >= variaciones.length - 1} onClick={() => onIr(1)} />
        </div>
      </div>

      <div className={`lote-visor__escena${vertical ? ' lote-visor__escena--vertical' : ''}`}>
        <div className="lote-visor__media" style={{ aspectRatio: vertical ? '9 / 16' : formato === '4:5' ? '4 / 5' : '1 / 1' }} tabIndex={-1} data-autofocus>
          {src ? (
            <img key={src} src={src} alt={`${nombre}${mostrar ? `, versión ${mostrar.n}` : ''}`} decoding="async" style={p?.miniatura && !mostrar ? { backgroundImage: `url("${p.miniatura}")` } : undefined} />
          ) : (
            <div className="lote-visor__espera">
              {p?.estado === 'sin-imagen' ? <ImageOff size={24} strokeWidth={1.8} /> : PIEZA_FINAL.has(p?.estado) ? <Hand size={22} /> : <LoaderCircle size={22} className="girando" />}
              <span>{p?.estado === 'sin-imagen' ? p.motivo || 'kie no pudo hacer esta imagen' : 'Todavía se está creando'}</span>
            </div>
          )}
          {mostrar ? <span className="lote-visor__marca">Antes · versión {mostrar.n}</span> : null}
        </div>
      </div>

      <div className="lote-visor__info">
        <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
          <InsigniaPieza p={p} variante="suave" tamano="normal" />
          {p?.version > 1 ? <span className="t-mini t-3">Versión {p.version}</span> : null}
        </div>
        {p?.estado === 'te-necesita' && (p.problemas || []).length ? (
          <div className="lote-var__revision">
            <p className="lote-var__revision-titulo">
              <ScanEye size={13} strokeWidth={2.2} aria-hidden="true" /> La revisión notó:
            </p>
            <ul className="lote-var__problemas">
              {p.problemas.map((t, k) => (
                <li key={k}>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {p?.estado === 'sin-revisar' ? <p className="t-chico t-3">{p.motivo || 'La revisión de la IA no llegó a mirarla: revísala tú antes de publicarla.'}</p> : null}

        {versiones.length ? (
          <div className="lote-versiones">
            <div className="lote-versiones__cabecera">
              <span className="lote-versiones__titulo">
                <History size={14} strokeWidth={2.2} aria-hidden="true" /> Versiones anteriores
              </span>
              {anterior ? (
                <Pestanas
                  variante="segmentado"
                  tamano="chico"
                  etiqueta="Comparar"
                  items={[
                    { id: 'antes', etiqueta: 'Antes' },
                    { id: 'ahora', etiqueta: 'Ahora' },
                  ]}
                  activa={comparar}
                  onCambio={setComparar}
                />
              ) : null}
            </div>
            <ul className="lote-versiones__lista">
              {versiones.map((o) => {
                const sel = verVersion === o.n;
                return (
                  <li key={o.n}>
                    <button
                      type="button"
                      className={`lote-version${sel ? ' lote-version--sel' : ''}${vertical ? ' lote-version--vertical' : ''}`}
                      aria-pressed={sel}
                      onClick={() => {
                        setVerVersion(sel ? null : o.n);
                        setComparar(sel ? 'ahora' : 'antes');
                      }}
                    >
                      <span className="lote-version__img">{o.miniatura || o.url ? <img src={o.miniatura || o.url} alt="" loading="lazy" /> : null}</span>
                      <span className="lote-version__textos">
                        <span className="lote-version__n">Versión {o.n}</span>
                        <span className="lote-version__motivo">{[MOTIVO_VERSION[o.motivo], o.fecha ? fechaRelativa(o.fecha) : null].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

    </Modal>
  );
}
