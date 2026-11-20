// #/investigacion/:id — el informe de la investigación de mercado de un producto, hecho para LEERSE: el veredicto y lo
// más importante arriba (deseo central, beneficio principal y el dolor más fuerte), gráficas de barras para los dolores,
// los beneficios, los ángulos y los precios de la competencia, y el resto en bloques cortos.
//
// RESALTAR: selecciona cualquier texto del informe y toca «Resaltar». Queda marcado, se junta en «Lo que resaltaste»
// (arriba a la derecha, junto al botón «Crear anuncios de imagen») y es lo primero que leen tus anuncios de imagen de este producto.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, Download, ExternalLink, Highlighter, Images, LoaderCircle, Megaphone, RotateCcw, Star, Telescope, TriangleAlert, X } from 'lucide-react';
import { Boton, CampoTexto, Esqueleto, EstadoVacio, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { CLAVE_INVESTIGACIONES, apiInvestigacion, claveInvestigacion, useInvestigacion } from '../../datos/investigacion.js';
import { fechaRelativa } from '../../datos/formato.js';
import { enlace } from '../../datos/rutas.js';
import '../imagenes/imagenes.css';
import './investigacion.css';
import { Documento } from './Documento.jsx';
import { MercadoApp } from './MercadoApp.jsx';
import { Competencia } from './Competencia.jsx';
import { TextosAnuncios } from './TextosAnuncios.jsx';

// ---------------------------------------------------------------- el texto, con lo resaltado marcado

const Resaltados = createContext([]);
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Un texto del informe: lo que el usuario resaltó sale marcado. */
function T({ children }) {
  const lista = useContext(Resaltados);
  const texto = typeof children === 'string' ? children : children === null || children === undefined ? '' : String(children);
  const partes = useMemo(() => {
    const claves = lista.map((r) => r.texto).filter((x) => x.length >= 3 && texto.includes(x));
    if (!claves.length) return [texto];
    const re = new RegExp(`(${claves.sort((a, b) => b.length - a.length).map(escapar).join('|')})`, 'g');
    return texto.split(re);
  }, [lista, texto]);
  if (partes.length === 1) return texto;
  return partes.map((p, i) => (i % 2 ? <mark key={i} className="inv-marca">{p}</mark> : p));
}

const hay = (x) => (Array.isArray(x) ? x.length > 0 : typeof x === 'string' ? x.trim().length > 0 : x && typeof x === 'object' ? Object.values(x).some(hay) : x !== null && x !== undefined);
const num = (x, def = 0) => (Number.isFinite(Number(x)) ? Number(x) : def);

// ---------------------------------------------------------------- piezas

function Bloque({ id, titulo, descripcion, children, ancho = false }) {
  return (
    <section className={`inv-bloque${ancho ? ' inv-bloque--ancho' : ''}`} data-seccion={titulo} id={id}>
      <h2 className="inv-bloque__titulo">{titulo}</h2>
      {descripcion ? <p className="inv-bloque__desc">{descripcion}</p> : null}
      {children}
    </section>
  );
}

const EVIDENCIA = { verificado: ['Verificado', 'inv-chip--ok'], vendedor: ['Lo dice el vendedor', 'inv-chip--aviso'], inferencia: ['Inferencia', ''] };
function Evidencia({ tipo }) {
  const e = EVIDENCIA[tipo];
  return e ? <span className={`inv-chip ${e[1]}`}>{e[0]}</span> : null;
}

/** Barras horizontales: [{ etiqueta, valor, detalle?, extra? }] sobre `max`. */
function Barras({ items, max = 10, sufijo = '/10', tono = 'acento' }) {
  const tope = Math.max(max, ...items.map((x) => num(x.valor)));
  return (
    <ul className={`inv-barras inv-barras--${tono}`}>
      {items.map((x, i) => (
        <li key={i} className="inv-barra">
          <div className="inv-barra__cabeza">
            <span className="inv-barra__etiqueta">
              <T>{x.etiqueta}</T>
            </span>
            <span className="inv-barra__valor t-num">
              {x.textoValor || `${num(x.valor)}${sufijo}`}
            </span>
          </div>
          <div className="inv-barra__pista" aria-hidden="true">
            <span className="inv-barra__relleno" style={{ width: `${Math.max(3, Math.min(100, (num(x.valor) / tope) * 100))}%` }} />
          </div>
          {x.detalle || x.extra ? (
            <p className="inv-barra__detalle">
              {x.extra} {x.detalle ? <T>{x.detalle}</T> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Lista({ titulo, items }) {
  const l = (items || []).filter((x) => typeof x === 'string' && x.trim());
  if (!l.length) return null;
  return (
    <div className="inv-sub">
      {titulo ? <h3 className="inv-sub__titulo">{titulo}</h3> : null}
      <ul className="inv-puntos">
        {l.map((x, i) => (
          <li key={i}>
            <T>{x}</T>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Parrafo({ titulo, texto }) {
  if (!hay(texto)) return null;
  return (
    <div className="inv-sub">
      {titulo ? <h3 className="inv-sub__titulo">{titulo}</h3> : null}
      <p className="inv-texto">
        <T>{texto}</T>
      </p>
    </div>
  );
}

/** Fichas: [{ etiqueta, valor }] en cuadritos. */
function Fichas({ items, grande = false }) {
  const l = (items || []).filter((x) => hay(x?.valor));
  if (!l.length) return null;
  return (
    <dl className={`inv-fichas${grande ? ' inv-fichas--grande' : ''}`}>
      {l.map((x, i) => (
        <div key={i} className="inv-ficha">
          <dt>{x.etiqueta}</dt>
          <dd>
            <T>{x.valor}</T>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Tabla({ columnas, filas }) {
  const l = (filas || []).filter((f) => columnas.some((c) => hay(f?.[c.clave])));
  if (!l.length) return null;
  return (
    <div className="inv-tabla" role="table">
      <div className="inv-tabla__fila inv-tabla__fila--cabeza" role="row" style={{ '--cols': columnas.length }}>
        {columnas.map((c) => (
          <span key={c.clave} role="columnheader">
            {c.titulo}
          </span>
        ))}
      </div>
      {l.map((f, i) => (
        <div key={i} className="inv-tabla__fila" role="row" style={{ '--cols': columnas.length }}>
          {columnas.map((c) => (
            <span key={c.clave} role="cell" data-titulo={c.titulo}>
              <T>{f?.[c.clave] ?? ''}</T>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const VEREDICTO = {
  si: ['Viable', 'inv-veredicto--ok', CircleCheck],
  'con-condiciones': ['Viable con condiciones', 'inv-veredicto--aviso', TriangleAlert],
  no: ['No viable', 'inv-veredicto--error', CircleAlert],
};
const CAPAS = [
  ['funcional', 'Funcional'],
  ['visible', 'Visible'],
  ['emocional', 'Emocional'],
  ['identidad', 'Identidad'],
];
const USO = [
  ['frase_madre', 'Frase madre'],
  ['hook', 'Gancho'],
  ['titular_landing', 'Titular de la landing'],
  ['promesa_whatsapp', 'Promesa de WhatsApp'],
];
const POSICION = [
  ['categoria', 'Categoría'],
  ['enemigo', 'Enemigo'],
  ['mecanismo', 'Mecanismo único'],
  ['promesa', 'Promesa central'],
];

// ---------------------------------------------------------------- el informe

function Informe({ inv, producto }) {
  const { aviso } = useAvisos();
  const a = inv.avatar || {};
  const m = inv.mercado || {};
  const imp = inv.impulso || {};
  const e = inv.estrategia || {};
  const [vTexto, vClase, VIcono] = VEREDICTO[inv.veredicto?.viable] || VEREDICTO['con-condiciones'];
  const dolores = [...(inv.puntos_dolor || [])].sort((x, y) => num(y.intensidad) - num(x.intensidad));
  const competencia = (m.competencia || []).filter((c) => hay(c?.producto));
  const conPrecio = competencia.filter((c) => Number.isFinite(Number(c.precio_unidad_valor)) && Number(c.precio_unidad_valor) > 0);
  const grupos = useMemo(() => {
    const g = new Map();
    for (const t of inv.titulos || []) {
      const k = (t.dolor || 'Otros').trim() || 'Otros';
      g.set(k, [...(g.get(k) || []), t]);
    }
    return [...g.entries()];
  }, [inv.titulos]);
  const copiar = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      aviso({ tipo: 'ok', titulo: 'Copiado', texto: t.slice(0, 80), duracion: 1800 });
    } catch {
      /* sin portapapeles */
    }
  };

  return (
    <div className="inv-informe">
      <section className={`inv-veredicto ${vClase}`} data-seccion="Veredicto">
        <span className="inv-veredicto__foto">{producto.foto ? <img src={producto.foto} alt="" /> : null}</span>
        <div className="inv-veredicto__textos">
          <span className="inv-veredicto__sello">
            <VIcono size={15} strokeWidth={2.4} aria-hidden="true" /> {vTexto}
          </span>
          <h1 className="inv-veredicto__nombre">
            {inv.producto}
            {inv.pais ? <span className="inv-veredicto__pais"> · {inv.pais}</span> : null}
          </h1>
          <p className="inv-veredicto__texto">
            <T>{inv.veredicto?.texto}</T>
          </p>
          {hay(inv.veredicto?.posicionamiento) ? (
            <p className="inv-veredicto__pos">
              <strong>Posicionamiento:</strong> <T>{inv.veredicto.posicionamiento}</T>
            </p>
          ) : null}
        </div>
      </section>

      <div className="inv-claves" data-seccion="Lo más importante">
        <div className="inv-clave inv-clave--deseo">
          <span className="inv-clave__sobre">Deseo central</span>
          <p className="inv-clave__texto">
            «<T>{inv.deseo_central?.frase}</T>»
          </p>
        </div>
        <div className="inv-clave inv-clave--beneficio">
          <span className="inv-clave__sobre">Beneficio principal</span>
          <p className="inv-clave__texto">
            <T>{inv.beneficio_principal}</T>
          </p>
        </div>
        <div className="inv-clave inv-clave--dolor">
          <span className="inv-clave__sobre">{hay(a.dolor_masivo) ? 'El dolor que no lo deja dormir' : 'El dolor más fuerte'}</span>
          <p className="inv-clave__texto">
            <T>{hay(a.dolor_masivo) ? a.dolor_masivo : dolores[0]?.dolor}</T>
          </p>
        </div>
      </div>

      {hay(inv.alertas) ? (
        <Bloque titulo="Alertas antes de lanzar" ancho>
          <ol className="inv-alertas">
            {inv.alertas.map((x, i) => (
              <li key={i}>
                <span className="inv-alertas__n t-num">{i + 1}</span>
                <span>
                  <T>{x}</T>
                </span>
              </li>
            ))}
          </ol>
        </Bloque>
      ) : null}

      <div className="inv-rejilla">
        <Bloque titulo="Puntos de dolor" descripcion="Del más fuerte al menos, con las palabras del cliente.">
          <Barras
            tono="error"
            items={dolores.map((d) => ({
              etiqueta: d.dolor,
              valor: d.intensidad,
              extra: <Evidencia tipo={d.evidencia} />,
              detalle: [d.sentimiento && `Siente: ${d.sentimiento}`, d.solucion_que_piden && `Pide: ${d.solucion_que_piden}`].filter(Boolean).join(' · '),
            }))}
          />
        </Bloque>

        {hay(imp.beneficios) ? (
          <Bloque titulo="Beneficios que más pesan" descripcion="En el orden en que mueven la compra.">
            <Barras tono="ok" items={[...imp.beneficios].sort((x, y) => num(y.peso) - num(x.peso)).map((b) => ({ etiqueta: b.beneficio, valor: b.peso }))} />
            <Lista titulo="Resultados que quiere" items={imp.resultados_deseados} />
          </Bloque>
        ) : null}
      </div>

      <Bloque titulo="El deseo central, por capas" ancho>
        <Fichas grande items={CAPAS.map(([k, t]) => ({ etiqueta: t, valor: inv.deseo_central?.capas?.[k] }))} />
        <Fichas items={USO.map(([k, t]) => ({ etiqueta: t, valor: inv.deseo_central?.uso?.[k] }))} />
        <Tabla
          columnas={[
            { clave: 'hallazgo', titulo: 'Hallazgo' },
            { clave: 'donde', titulo: 'Dónde apareció' },
            { clave: 'revela', titulo: 'Qué revela' },
          ]}
          filas={inv.deseo_central?.hallazgos}
        />
      </Bloque>

      <Bloque titulo={`Tu cliente: ${a.nombre || 'el avatar'}`} ancho>
        <div className="inv-avatar">
          <div className="inv-avatar__cara" aria-hidden="true">
            {(a.nombre || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="inv-avatar__datos">
            <strong className="inv-avatar__nombre">{a.nombre}</strong>
            <span className="t-chico t-2">{[a.edad, a.ocupacion, a.ciudad].filter(hay).join(' · ')}</span>
            {hay(a.resultado_deseado) ? (
              <p className="inv-avatar__cita">
                «<T>{a.resultado_deseado}</T>»
              </p>
            ) : null}
          </div>
        </div>
        <Fichas items={(a.demografia || []).map((d) => ({ etiqueta: d?.dato, valor: d?.valor }))} />
        <div className="inv-rejilla inv-rejilla--tres">
          <Lista titulo="Lo que le duele" items={a.dolores} />
          <Lista titulo="Qué lo hace comprar o dudar" items={a.puntos_debiles} />
          <Lista titulo="Lo que lo mueve" items={a.motivaciones} />
        </div>
        <Tabla
          columnas={[
            { clave: 'quien', titulo: 'También compra' },
            { clave: 'angulo', titulo: 'Con qué ángulo' },
          ]}
          filas={a.otros}
        />
      </Bloque>

      <div className="inv-rejilla">
        {hay(e.angulos) ? (
          <Bloque titulo="Ángulos creativos" descripcion="Los mensajes con más fuerza para tus anuncios.">
            <Barras items={[...e.angulos].sort((x, y) => num(y.fuerza) - num(x.fuerza)).map((x) => ({ etiqueta: x.nombre, valor: x.fuerza, detalle: x.idea }))} />
          </Bloque>
        ) : null}
        {hay(inv.lenguaje) || hay(imp.disparadores) ? (
          <Bloque titulo="Cómo lo dice tu cliente">
            <Tabla
              columnas={[
                { clave: 'patron', titulo: 'Así lo dice' },
                { clave: 'angulo', titulo: 'Ángulo que sale de ahí' },
              ]}
              filas={inv.lenguaje}
            />
            <Lista titulo="Qué dispara la compra" items={imp.disparadores} />
          </Bloque>
        ) : null}
      </div>

      {grupos.length ? (
        <Bloque titulo="Títulos para tus imágenes" descripcion="Con estrella, los tres para probar primero. Toca uno para copiarlo." ancho>
          <div className="inv-titulos">
            {grupos.map(([dolor, lista]) => (
              <div key={dolor} className="inv-titulos__grupo">
                <h3 className="inv-sub__titulo">{dolor}</h3>
                {lista.map((t, i) => (
                  <button key={i} type="button" className={`inv-titulo${t.probar_primero ? ' inv-titulo--primero' : ''}`} onClick={() => copiar(t.titulo)} title="Copiar">
                    <span className="inv-titulo__texto">
                      {t.probar_primero ? <Star size={13} strokeWidth={2.4} aria-label="Probar primero" /> : null}
                      <T>{t.titulo}</T>
                    </span>
                    {hay(t.apoyo) ? (
                      <span className="inv-titulo__apoyo">
                        <T>{t.apoyo}</T>
                      </span>
                    ) : null}
                    <Copy size={12} strokeWidth={2} aria-hidden="true" className="inv-titulo__copiar" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Bloque>
      ) : null}

      <Bloque titulo="El mercado" ancho>
        {hay(m.datos) ? (
          <div className="inv-numeros">
            {m.datos
              .filter((d) => hay(d?.etiqueta) && Number.isFinite(Number(d?.valor)))
              .map((d, i) => (
                <div key={i} className="inv-numero">
                  <span className="inv-numero__valor t-num">
                    {Number(d.valor).toLocaleString('es')}
                    <small>{d.unidad || ''}</small>
                  </span>
                  <span className="inv-numero__etiqueta">
                    <T>{d.etiqueta}</T>
                  </span>
                  {hay(d.fuente) ? <span className="inv-numero__fuente">{d.fuente}</span> : null}
                </div>
              ))}
          </div>
        ) : null}
        <div className="inv-rejilla">
          <Parrafo titulo="El problema" texto={m.problema} />
          <Parrafo titulo="El activo y la evidencia" texto={m.activo} />
          <Parrafo titulo="Tendencia" texto={m.tendencia} />
          <Parrafo titulo="Regulación" texto={m.regulacion} />
        </div>
        {hay(m.hueco) ? (
          <p className="inv-hueco">
            <strong>El hueco de mercado:</strong> <T>{m.hueco}</T>
          </p>
        ) : null}
      </Bloque>

      {competencia.length ? (
        <Bloque titulo="Competencia y precios" ancho>
          {conPrecio.length >= 2 ? (
            <Barras
              tono="cian"
              max={0}
              items={[...conPrecio]
                .sort((x, y) => Number(y.precio_unidad_valor) - Number(x.precio_unidad_valor))
                .map((c) => ({ etiqueta: c.producto, valor: Number(c.precio_unidad_valor), textoValor: c.precio_unidad || `${c.precio_unidad_valor} ${c.moneda || ''}` }))}
            />
          ) : null}
          <Tabla
            columnas={[
              { clave: 'producto', titulo: 'Producto' },
              { clave: 'activo', titulo: 'Activo' },
              { clave: 'tamano', titulo: 'Tamaño' },
              { clave: 'precio', titulo: 'Precio' },
              { clave: 'precio_unidad', titulo: 'Por unidad' },
            ]}
            filas={competencia}
          />
        </Bloque>
      ) : null}

      <Bloque titulo="Estrategia" ancho>
        <Fichas grande items={POSICION.map(([k, t]) => ({ etiqueta: t, valor: e.posicionamiento?.[k] }))} />
        <Parrafo titulo="Oferta y precio" texto={e.oferta} />
        <Fichas items={(e.unit_economics || []).map((d) => ({ etiqueta: d?.dato, valor: d?.valor }))} />
        <div className="inv-rejilla inv-rejilla--tres">
          <Lista titulo="Fases de entrada" items={e.fases} />
          <Lista titulo="Canales" items={e.canales} />
          <Lista titulo="Qué medir" items={e.kpis} />
        </div>
        <Tabla
          columnas={[
            { clave: 'objecion', titulo: 'Objeción' },
            { clave: 'respuesta', titulo: 'Cómo responderla' },
          ]}
          filas={e.objeciones}
        />
        <Parrafo titulo="Guion de WhatsApp" texto={e.whatsapp} />
        <Lista titulo="Cumplimiento: lo que no se puede decir" items={e.cumplimiento} />
      </Bloque>

      <div className="inv-rejilla">
        {hay(inv.problemas) ? (
          <Bloque titulo="Problemas que resuelve">
            <Tabla
              columnas={[
                { clave: 'categoria', titulo: 'Tipo' },
                { clave: 'problema', titulo: 'Problema' },
                { clave: 'como_lo_aborda', titulo: 'Cómo lo aborda' },
              ]}
              filas={inv.problemas}
            />
          </Bloque>
        ) : null}
        {hay(imp.tiempos) ? (
          <Bloque titulo="Tiempos de transformación" descripcion="No son promesas clínicas.">
            <ol className="inv-tiempos">
              {imp.tiempos.map((t, i) => (
                <li key={i}>
                  <strong>
                    <T>{t.tiempo}</T>
                  </strong>
                  <span>
                    <T>{t.etapa}</T>
                  </span>
                  <Evidencia tipo={t.evidencia} />
                </li>
              ))}
            </ol>
          </Bloque>
        ) : null}
      </div>

      {hay(inv.plataformas) ? (
        <Bloque titulo="Qué se dice en cada plataforma" ancho>
          <Tabla
            columnas={[
              { clave: 'plataforma', titulo: 'Plataforma' },
              { clave: 'hallazgo', titulo: 'Qué se encontró' },
              { clave: 'dicen', titulo: 'Qué dicen los compradores' },
            ]}
            filas={inv.plataformas}
          />
        </Bloque>
      ) : null}

      {hay(inv.heros) ? (
        <Bloque titulo="Propuestas para la landing" ancho>
          <div className="inv-heros">
            {inv.heros.map((h, i) => (
              <button key={i} type="button" className="inv-hero" onClick={() => copiar(`${h.titular}\n${h.subtitulo || ''}`)} title="Copiar">
                <strong>
                  <T>{h.titular}</T>
                </strong>
                <span>
                  <T>{h.subtitulo}</T>
                </span>
              </button>
            ))}
          </div>
        </Bloque>
      ) : null}

      <div className="inv-rejilla">
        <Bloque titulo="Ficha del producto">
          <Fichas items={(inv.ficha || []).map((d) => ({ etiqueta: d?.dato, valor: d?.valor }))} />
        </Bloque>
        <Bloque titulo={`Fuentes (${(inv.fuentes || []).length})`} descripcion="Las páginas que se consultaron.">
          <ul className="inv-fuentes">
            {(inv.fuentes || []).map((f, i) => (
              <li key={i}>
                <a href={f.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={12} strokeWidth={2} aria-hidden="true" /> {f.titulo || f.url}
                </a>
              </li>
            ))}
          </ul>
        </Bloque>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- lo que resaltaste

function PanelResaltados({ lista, onQuitar, onNota, hrefAnuncios }) {
  return (
    <aside className="inv-lado" aria-label="Lo que resaltaste">
      <div className="inv-lado__caja">
        <h2 className="inv-lado__titulo">
          <Highlighter size={15} strokeWidth={2.2} aria-hidden="true" /> Lo que resaltaste
          {lista.length ? <span className="inv-lado__n t-num">{lista.length}</span> : null}
        </h2>
        {lista.length ? (
          <ul className="inv-lado__lista">
            {lista.map((r) => (
              <li key={r.id} className="inv-res">
                <p className="inv-res__texto">{r.texto}</p>
                {r.seccion ? <span className="inv-res__seccion">{r.seccion}</span> : null}
                <input className="inv-res__nota" placeholder="Agrega una nota (opcional)" defaultValue={r.nota || ''} maxLength={300} onBlur={(e) => e.target.value.trim() !== (r.nota || '') && onNota(r.id, e.target.value)} aria-label="Tu nota" />
                <button type="button" className="inv-res__quitar" onClick={() => onQuitar(r.id)} aria-label="Quitar el resaltado">
                  <X size={13} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="inv-lado__vacio">Selecciona cualquier texto del informe y toca «Resaltar». Lo que resaltes es lo primero que tienen en cuenta tus anuncios.</p>
        )}
        <Boton variante="primario" icono={Images} href={hrefAnuncios} bloque>
          Crear anuncios de imagen
        </Boton>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- la pantalla

export default function PantallaInforme({ params }) {
  const id = params.id;
  const { aviso } = useAvisos();
  const [cadaMs, setCadaMs] = useState(undefined);
  const { datos, cargando, recargar } = useInvestigacion(id, { cadaMs });
  const estado = datos?.tarea?.estado || null;
  useEffect(() => setCadaMs(estado === 'investigando' ? 4000 : undefined), [estado]);
  const [pais, setPais] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [lanzando, setLanzando] = useState(false);
  const [resaltados, setResaltados] = useState(null);
  useEffect(() => {
    if (datos?.resaltados) setResaltados((r) => r ?? datos.resaltados);
  }, [datos]);
  const lista = resaltados || datos?.resaltados || [];
  const cuerpo = useRef(null);
  const [flotante, setFlotante] = useState(null); // { x, y, texto, seccion }

  // seleccionar texto del informe -> aparece «Resaltar»
  useEffect(() => {
    const mirar = () => {
      const s = window.getSelection();
      const texto = s && !s.isCollapsed ? s.toString().replace(/\s+/g, ' ').trim() : '';
      const nodo = s?.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement : s?.anchorNode;
      if (!texto || texto.length < 3 || texto.length > 600 || !cuerpo.current || !nodo || !cuerpo.current.contains(nodo)) return setFlotante(null);
      const r = s.getRangeAt(0).getBoundingClientRect();
      setFlotante({ x: Math.min(window.innerWidth - 150, Math.max(12, r.left + r.width / 2 - 60)), y: Math.max(64, r.top - 44), texto, seccion: nodo.closest('[data-seccion]')?.dataset.seccion || '' });
    };
    const soltar = () => setTimeout(mirar, 0);
    const mover = () => setFlotante(null);
    document.addEventListener('mouseup', soltar);
    document.addEventListener('keyup', soltar);
    window.addEventListener('scroll', mover, true);
    return () => {
      document.removeEventListener('mouseup', soltar);
      document.removeEventListener('keyup', soltar);
      window.removeEventListener('scroll', mover, true);
    };
  }, []);

  const guardar = async (nueva) => {
    setResaltados(nueva);
    try {
      const r = await apiInvestigacion.resaltar(id, nueva);
      setResaltados(r.resaltados);
      invalidar(CLAVE_INVESTIGACIONES);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardar lo resaltado', texto: e?.message || 'Vuelve a intentarlo.' });
    }
  };
  const resaltar = () => {
    if (!flotante) return;
    if (!lista.some((r) => r.texto === flotante.texto)) guardar([...lista, { id: Math.random().toString(36).slice(2, 10), texto: flotante.texto, seccion: flotante.seccion, nota: '' }]);
    window.getSelection()?.removeAllRanges();
    setFlotante(null);
  };

  const investigar = async ({ andromeda = false } = {}) => {
    setLanzando(true);
    try {
      await (andromeda ? apiInvestigacion.agregarAndromeda(id) : apiInvestigacion.investigar(id, pais.trim(), competencia.trim()));
      invalidar(claveInvestigacion(id));
      invalidar(CLAVE_INVESTIGACIONES);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: andromeda ? 'No pude agregar los conceptos para Meta' : 'No pude empezar la investigación', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setLanzando(false);
    }
  };

  if (cargando && !datos) return <Esqueleto alto={320} />;
  if (!datos) return <EstadoVacio icono={Telescope} titulo="No encuentro ese producto" acciones={<Boton variante="secundario" href={enlace.investigacion()}>Volver</Boton>} />;
  const { producto, tarea, investigacion: inv } = datos;

  if (tarea.estado === 'investigando' && tarea.modo === 'andromeda') {
    return (
      <div className="pagina inv inv-espera">
        <span className="inv-espera__foto">{producto.foto ? <img src={producto.foto} alt="" /> : null}</span>
        <LoaderCircle size={28} className="girando" aria-hidden="true" />
        <h1 className="inv-espera__titulo">Armando los conceptos y textos para Meta de «{producto.nombre}»</h1>
        <p className="t-2">Tarda unos minutos: la IA lee tu investigación y arma las facetas del cliente, los momentos, 8 conceptos distintos para Andromeda y los textos de tus anuncios de imagen. Puedes irte de esta pantalla; sigue sola.</p>
        <ul className="inv-espera__pasos" aria-live="polite">
          {(tarea.progreso || []).slice(-5).map((p, i, l) => (
            <li key={`${i}-${p}`} className={i === l.length - 1 ? 'inv-espera__paso--ahora' : ''}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (tarea.estado === 'investigando') {
    return (
      <div className="pagina inv inv-espera">
        <span className="inv-espera__foto">{producto.foto ? <img src={producto.foto} alt="" /> : null}</span>
        <LoaderCircle size={28} className="girando" aria-hidden="true" />
        <h1 className="inv-espera__titulo">Investigando el mercado de «{producto.nombre}»</h1>
        <p className="t-2">Las dos partes van a la vez: el mercado (la IA lee la foto, busca tu producto y revisa lo que dicen los compradores) y tu competencia en TrendTrack. Puedes irte de esta pantalla; sigue sola.</p>
        <ul className="inv-espera__pasos" aria-live="polite">
          {(tarea.progreso || []).slice(-5).map((p, i, l) => (
            <li key={`${i}-${p}`} className={i === l.length - 1 ? 'inv-espera__paso--ahora' : ''}>
              {p}
            </li>
          ))}
        </ul>
        {tarea.inicio ? <span className="t-mini t-3">Empezó {fechaRelativa(tarea.inicio)}</span> : null}
      </div>
    );
  }

  const formulario = (
    <div className="inv-empezar__campos">
      <CampoTexto etiqueta="País" opcional placeholder="Colombia" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} disabled={lanzando} ayuda="Sin país, la investigación es general." />
      <CampoTexto etiqueta="Competencia a investigar" opcional placeholder="Link de TrendTrack o dominio de la tienda" maxLength={400} value={competencia} onChange={(e) => setCompetencia(e.target.value)} disabled={lanzando} ayuda="Se investiga a la vez, en TrendTrack. Si la dejas vacía, la IA busca la tienda que más vende algo como tu producto." />
      <Boton variante="primario" icono={inv ? RotateCcw : Telescope} onClick={() => investigar()} cargando={lanzando}>
        {inv ? 'Volver a investigar' : tarea.estado === 'error' ? 'Reintentar' : 'Investigar este producto'}
      </Boton>
    </div>
  );

  if (!inv) {
    return (
      <div className="pagina inv inv-espera">
        <span className="inv-espera__foto">{producto.foto ? <img src={producto.foto} alt="" /> : null}</span>
        <h1 className="inv-espera__titulo">{producto.nombre}</h1>
        {tarea.estado === 'error' ? (
          <p className="img-nota img-nota--aviso" role="alert">
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
            {tarea.error?.mensaje || 'La investigación no terminó.'}
          </p>
        ) : (
          <p className="t-2">Este producto todavía no tiene investigación de mercado. Se hace una sola vez, con su foto, y tarda de 10 a 30 minutos.</p>
        )}
        {formulario}
      </div>
    );
  }

  return (
    <Resaltados.Provider value={lista}>
      <div className="pagina inv">
        <header className="inv-cabeza">
          <div className="inv-cabeza__textos">
            <span className="inv-cabeza__sobre">Investigación de mercado</span>
            <div className="inv-cabeza__fila">
              <h1 className="inv-cabeza__titulo">{producto.nombre}</h1>
              <details className="inv-otra">
                <summary>
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" /> Volver a investigar
                </summary>
                <div className="inv-otra__caja">
                  <p className="t-chico t-2">Reemplaza esta investigación por una nueva (lo que resaltaste se conserva).</p>
                  {formulario}
                </div>
              </details>
            </div>
            <p className="inv-cabeza__desc">{tarea.fin ? `Hecha ${fechaRelativa(tarea.fin)}. ` : ''}Selecciona cualquier texto para resaltarlo.</p>
            {inv.formato === 'documento' ? (
              <div className="inv-cabeza__acciones">
                <Boton variante="secundario" tamano="chico" icono={Download} onClick={() => window.print()}>
                  Descargar PDF
                </Boton>
                {!(inv.secciones || []).some((sec) => /andromeda/i.test(sec?.titulo || '')) || (inv.anuncios_imagen || []).length < 10 ? (
                  <Boton variante="primario" tamano="chico" icono={Megaphone} onClick={() => investigar({ andromeda: true })} cargando={lanzando} title="Facetas del cliente, momentos, 8 conceptos distintos para Meta y los textos de tus anuncios de imagen, sacados de esta investigación (unos minutos, sin rehacerla)">
                    Agregar conceptos y textos para Meta
                  </Boton>
                ) : null}
              </div>
            ) : null}
          </div>
          <PanelResaltados
            lista={lista}
            onQuitar={(rid) => guardar(lista.filter((r) => r.id !== rid))}
            onNota={(rid, nota) => guardar(lista.map((r) => (r.id === rid ? { ...r, nota: nota.trim() } : r)))}
            hrefAnuncios={enlace.crearImagenes({ producto: id, modo: 'investigacion' })}
          />
        </header>
        {tarea.estado === 'error' ? (
          <p className="img-nota img-nota--aviso" role="alert">
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
            El último intento no terminó ({tarea.error?.mensaje || 'sin detalle'}). Esta es la investigación anterior.
          </p>
        ) : null}
        <div ref={cuerpo} className="inv-cuerpo">
          {/* (2026-11-19o) la primera parte con el mismo estilo que la segunda; el PDF de siempre solo al imprimir */}
          {inv.formato === 'documento' ? (
            <>
              <div className="inv-solo-pantalla">
                <MercadoApp inv={inv} foto={producto.foto} T={T} />
              </div>
              <div className="inv-solo-impresion">
                <Documento inv={inv} foto={producto.foto} T={T} />
              </div>
            </>
          ) : (
            <Informe inv={inv} producto={producto} />
          )}
          {inv.formato === 'documento' ? <TextosAnuncios id={id} inv={inv} plantillas={datos.plantillas} onCambio={async () => { invalidar(claveInvestigacion(id)); await recargar?.(); }} /> : null}
          <Competencia id={id} pais={inv.pais || 'Colombia'} T={T} />
        </div>
        {flotante ? (
          <button type="button" className="inv-flotante" style={{ left: flotante.x, top: flotante.y }} onMouseDown={(e) => e.preventDefault()} onClick={resaltar}>
            <Highlighter size={14} strokeWidth={2.4} aria-hidden="true" /> Resaltar
          </button>
        ) : null}
      </div>
    </Resaltados.Provider>
  );
}
