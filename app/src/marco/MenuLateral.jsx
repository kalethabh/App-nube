import { useEffect, useState } from 'react';
import { CirclePause, LayoutGrid, Palette, PanelLeftClose, PanelLeftOpen, Plus, Settings } from 'lucide-react';
import { Logo } from '../componentes/Logo.jsx';
import { Tooltip } from '../componentes/Tooltip.jsx';
import { VistaPrevia } from '../componentes/VistaPrevia.jsx';
import { BarraDeProgreso } from '../componentes/BarraDeProgreso.jsx';
import { PuntoEstado } from '../componentes/Insignia.jsx';
import { miniatura, useEstado } from '../datos/api.js';
import { useEnProduccion } from '../datos/produccion.js';
import { enlace } from '../datos/rutas.js';
import { porcentaje } from '../datos/formato.js';
import { estadoClaude, useAlCambiarConexiones, useClaude } from '../pantallas/ajustes/datos.js';

const ITEMS = [
  { id: 'tablero', texto: 'Mis anuncios', icono: LayoutGrid, href: enlace.tablero() },
  { id: 'nuevo', texto: 'Nuevo anuncio', icono: Plus, href: enlace.nuevo(), especial: true },
  { id: 'estilos', texto: 'Estilos', icono: Palette, href: enlace.estilos() },
  { id: 'ajustes', texto: 'Ajustes', icono: Settings, href: enlace.ajustes() },
];

const ETAPAS = { guion: 'Guion listo', voz: 'Voz', imagenes: 'Imágenes', videos: 'Videos', revision: 'Revisión', montaje: 'Montaje' };

const hora = (iso) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null);

/** Dos anuncios del mismo producto en el menú se distinguen por la hora en que se empezaron. */
function nombresVisibles(lista) {
  const cuenta = new Map();
  for (const a of lista) cuenta.set(a.titulo, (cuenta.get(a.titulo) || 0) + 1);
  // varios del mismo producto: se distinguen por su estilo (y, si también se repite, por la hora)
  const conEstilo = new Map();
  for (const a of lista) if (a.estiloNombre) conEstilo.set(`${a.titulo}|${a.estiloNombre}`, (conEstilo.get(`${a.titulo}|${a.estiloNombre}`) || 0) + 1);
  return (a) => {
    if (!(cuenta.get(a.titulo) > 1)) return a.titulo;
    if (a.estiloNombre && conEstilo.get(`${a.titulo}|${a.estiloNombre}`) === 1) return `${a.titulo} · ${a.estiloNombre}`;
    return hora(a.creado) ? `${a.titulo} · ${a.estiloNombre ? `${a.estiloNombre} · ` : ''}${hora(a.creado)}` : a.titulo;
  };
}

const QUE_NECESITA = { saldo: 'Recarga tu saldo', error: 'Se trabó', pausa: 'En pausa' };

/** Una fila de "Te necesita": el anuncio frenado (o su guion) y qué hace falta, con un punto rojo. */
function FilaNecesita({ href, titulo, imagen, que, plegado }) {
  const fila = (
    <a href={href} className="produccion-mini__item">
      <span className="produccion-mini__miniatura">{imagen ? <img src={miniatura(imagen, 160)} alt="" loading="lazy" /> : null}</span>
      <span className="produccion-mini__textos">
        <span className="produccion-mini__titulo">{titulo}</span>
        <span className="necesita-mini__que">
          <PuntoEstado tono="error" />
          {que}
        </span>
      </span>
    </a>
  );
  return plegado ? (
    <Tooltip texto={`${titulo} · ${que}`} lado="derecha" retraso={80}>
      {fila}
    </Tooltip>
  ) : (
    fila
  );
}

/** Una fila de "En producción": miniatura, nombre, etapa en palabras y barra cian. */
function FilaProduccion({ slug, titulo, imagen, etapa, avance, plegado }) {
  const fila = (
    <a href={enlace.produccion(slug)} className="produccion-mini__item">
      <span className="produccion-mini__miniatura">{imagen ? <img src={miniatura(imagen, 160)} alt="" loading="lazy" /> : null}</span>
      <span className="produccion-mini__textos">
        <span className="produccion-mini__titulo">{titulo}</span>
        <span className="produccion-mini__etapa t-num">{avance === null || avance === undefined ? etapa : `${etapa} · ${porcentaje(avance)}`}</span>
        <BarraDeProgreso valor={(avance ?? 0) * 100} tono={avance >= 1 ? 'ok' : 'cian'} grosor="fina" animada={!(avance >= 1)} />
      </span>
    </a>
  );
  return plegado ? (
    <Tooltip texto={avance === null || avance === undefined ? `${titulo} · ${etapa}` : `${titulo} · ${etapa} · ${porcentaje(avance)}`} lado="derecha" retraso={80}>
      {fila}
    </Tooltip>
  ) : (
    fila
  );
}

function ItemMenu({ item, activo, plegado, extra }) {
  const Icono = item.icono;
  const contenido = (
    <a href={item.href} className={`nav__item${activo ? ' nav__item--activo' : ''}${item.especial ? ' nav__item--especial' : ''}`} aria-current={activo ? 'page' : undefined}>
      <span className="nav__icono" aria-hidden="true">
        <Icono size={item.especial ? 15 : 18} strokeWidth={item.especial ? 2.6 : 2} />
      </span>
      <span className="nav__texto">{item.texto}</span>
      {extra ? <span className="nav__extra">{extra}</span> : null}
    </a>
  );
  return plegado ? (
    <Tooltip texto={item.texto} lado="derecha" retraso={80}>
      {contenido}
    </Tooltip>
  ) : (
    contenido
  );
}

/**
 * Las carpetas viejas sin terminar: en gris, sin punto vivo, en una sola fila que lleva al tablero
 * (ahí está la lista "Quedaron a medio camino"). No se cuentan como "en producción".
 */
function MedioCaminoMini({ lista, plegado }) {
  const texto = `${lista.length} ${lista.length === 1 ? 'quedó' : 'quedaron'} a medio camino`;
  const fila = (
    <a href={enlace.tablero()} className="medio-mini" aria-label={`${texto}: no se están produciendo. Ver en Mis anuncios`}>
      <span className="medio-mini__fotos" aria-hidden="true">
        {lista.slice(0, 3).map((a) => (
          <span key={a.slug} className="medio-mini__foto">
            {a.miniatura ? <img src={miniatura(a.miniatura, 96)} alt="" loading="lazy" /> : null}
          </span>
        ))}
      </span>
      <span className="medio-mini__textos">
        <span className="medio-mini__titulo">
          <CirclePause size={12} strokeWidth={2.2} aria-hidden="true" />
          {texto}
        </span>
        <span className="medio-mini__detalle">En pausa: no se están produciendo</span>
      </span>
    </a>
  );
  return plegado ? (
    <Tooltip texto={texto} lado="derecha" retraso={80}>
      {fila}
    </Tooltip>
  ) : (
    fila
  );
}

// ok: true (listo) | false (falta) | null (todavía revisando: nunca se muestra "Falta" antes de saber)
function Conexion({ ok, nombre, para, falta = 'Falta', plegado }) {
  const revisando = ok === null;
  const fila = (
    <div className="conexion">
      <PuntoEstado tono={revisando ? 'neutro' : ok ? 'ok' : 'error'} etiqueta={revisando ? `${nombre}: revisando` : ok ? `${nombre}: conectado` : `${nombre}: ${falta.toLowerCase()}`} />
      <span className="conexion__nombre">{nombre}</span>
      <span className="conexion__para">{revisando ? 'Revisando…' : ok ? para : falta}</span>
    </div>
  );
  return plegado ? (
    <Tooltip texto={`${nombre} · ${revisando ? 'revisando' : ok ? 'listo' : falta === 'Falta' ? 'falta configurarlo' : falta.toLowerCase()}`} lado="derecha" retraso={80}>
      {fila}
    </Tooltip>
  ) : (
    fila
  );
}

export function MenuLateral({ activo, plegado, onPlegar }) {
  // lo mismo que cuentan la barra de arriba y el tablero (src/datos/produccion.js). Mientras algo se produce se
  // mira cada 5 s, como el tablero: el avance y la etapa no se quedan atrás de la pantalla de producción
  const [cadaMs, setCadaMs] = useState(15000);
  const p = useEnProduccion({ cadaMs });
  useEffect(() => setCadaMs(p.cantidad ? 5000 : 15000), [p.cantidad]);
  const necesitan = [
    ...p.necesitan.map((n) => ({ a: n.anuncio, href: enlace.produccion(n.anuncio.slug), que: QUE_NECESITA[n.alto.tipo] || 'Te necesita' })),
    ...(p.guiones || []).map((a) => ({
      a,
      href: enlace.nuevo({ paso: '2', anuncios: a.slug, ...(a.productoId ? { producto: a.productoId } : {}) }),
      que: a.estado === 'error' ? 'El guion no salió' : 'Tu guion está listo',
    })),
  ];
  const nombre = nombresVisibles([...necesitan.map((n) => n.a), ...p.activos]);
  const { datos: estado, recargar: recargarEstado } = useEstado();
  useAlCambiarConexiones(recargarEstado); // guardaste una clave o entraste a Claude: el pie se pone al día
  const { datos: claudeReal } = useClaude();
  const totalAnuncios = p.cargando ? null : p.anuncios.length;
  // las claves y el saldo de kie viven en Ajustes > Conexiones; aca solo si estan o faltan
  const claveKie = estado ? Boolean(estado.claves?.kie) : null;
  const claveVoz = estado ? Boolean(estado.claves?.elevenlabs) : null;
  // Claude: instalado y con la sesion iniciada. Si la sesion no se pudo comprobar, no se marca como falta.
  const claude = estadoClaude(estado, claudeReal);
  const claudeOk = claude.revisando ? null : Boolean(claude.instalado) && claude.sesion !== 'sin-sesion';
  const falta = estado && (!claveKie || !claveVoz || claudeOk === false);

  return (
    <aside className={`menu${plegado ? ' menu--plegado' : ''}`} aria-label="Menú principal">
      <div className="menu__cabecera">
        <a href={enlace.tablero()} className="menu__marca" aria-label="Anuncios con IA, ir a Mis anuncios">
          <Logo tamano={30} />
          <span className="menu__marca-textos">
            <span className="menu__nombre">Anuncios con IA</span>
            <span className="menu__lema">Estudio</span>
          </span>
        </a>
        <button type="button" className="menu__plegar" onClick={onPlegar} aria-label={plegado ? 'Abrir el menú' : 'Achicar el menú'} title={plegado ? 'Abrir el menú' : 'Achicar el menú'}>
          {plegado ? <PanelLeftOpen size={17} strokeWidth={2} /> : <PanelLeftClose size={17} strokeWidth={2} />}
        </button>
      </div>

      <nav className="nav">
        {ITEMS.map((item) => (
          <ItemMenu
            key={item.id}
            item={item}
            activo={activo === item.id}
            plegado={plegado}
            extra={
              item.id === 'tablero' && totalAnuncios !== null ? (
                <span className="nav__contador t-num">{totalAnuncios}</span>
              ) : item.id === 'ajustes' && falta ? (
                <PuntoEstado tono="error" etiqueta="Falta configurar algo" />
              ) : null
            }
          />
        ))}
      </nav>

      {necesitan.length ? (
        <div className="menu__bloque">
          <div className="menu__grupo menu__grupo--necesita">
            <span>Te necesita</span>
            <span className="menu__grupo-cuenta t-num">{necesitan.length}</span>
          </div>
          <div className="produccion-mini">
            {necesitan.slice(0, 4).map((n) => (
              <FilaNecesita key={n.a.slug} href={n.href} titulo={nombre(n.a)} imagen={n.a.miniatura} que={n.que} plegado={plegado} />
            ))}
          </div>
        </div>
      ) : null}

      {p.cantidad ? (
        <div className="menu__bloque">
          <div className="menu__grupo">
            <span>En producción</span>
            {p.esEjemplo ? (
              <VistaPrevia texto="Ejemplo" className="menu__grupo-marca" explicacion="Vista previa del diseño: así se verán tus anuncios mientras se producen. Estos dos avanzan solos sobre anuncios reales." />
            ) : (
              <PuntoEstado estado="generando" />
            )}
          </div>
          <div className="produccion-mini">
            {p.esEjemplo
              ? p.ejemplos.map(({ e, l, s: est, anuncio }) => (
                  <FilaProduccion
                    key={e.slug}
                    slug={e.slug}
                    titulo={anuncio.titulo}
                    imagen={anuncio.miniatura}
                    etapa={l.corto}
                    avance={est.etapa === 'listo' ? 1 : Math.min(0.99, l.avance)}
                    plegado={plegado}
                  />
                ))
              : p.activos.slice(0, 4).map((a) => (
                  <FilaProduccion key={a.slug} slug={a.slug} titulo={nombre(a)} imagen={a.miniatura} etapa={a.etapaNombre || ETAPAS[a.etapa] || 'En producción'} avance={a.avance} plegado={plegado} />
                ))}
          </div>
        </div>
      ) : null}

      {p.pausados.length ? (
        <MedioCaminoMini lista={p.pausados} plegado={plegado} />
      ) : null}

      <a href={enlace.ajustes()} className="menu__pie" aria-label="Conexiones, ir a Ajustes">
        <div className="menu__conexiones">
          <Conexion ok={claveKie} nombre="kie.ai" para="Imágenes y videos" plegado={plegado} />
          <Conexion ok={claveVoz} nombre="ElevenLabs" para="Voz" plegado={plegado} />
          <Conexion ok={claudeOk} nombre="Claude" para="Guiones" falta={claude.instalado ? 'Inicia sesión' : 'Falta'} plegado={plegado} />
        </div>
      </a>
    </aside>
  );
}
