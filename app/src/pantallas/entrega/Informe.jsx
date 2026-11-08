// El informe de la entrega en tres apartados: decisiones del montaje, lo que salió mal y el costo real.
// El costo real es el ÚNICO lugar de la app con precios (decisión de Diego): ninguna otra pantalla los muestra.
// Todo sale del motor (plan-montaje.json, log-modelos.json, historial/) traducido a palabras simples por
// GET /api/entrega/:slug. Cada toma con su segundo se puede tocar para verla en el reproductor.
//
// En los anuncios que produjo la app, la respuesta trae además `informe` (temp/<slug>/app/informe.json,
// armado por server/lib/informe.js al final de la producción): si está, manda sobre lo calculado.
// normalizarInforme() junta las dos cosas y acepta los nombres de campo de los dos lados.
import { useState } from 'react';
import {
  Captions,
  ChevronDown,
  CircleCheck,
  Clapperboard,
  Columns2,
  EighthNotes,
  Eye,
  Gauge,
  Images,
  Link2,
  Mic,
  Play,
  Sparkles,
  Spline,
  TriangleAlert,
  Type,
  Wallet,
} from 'lucide-react';
import { EstadoVacio, Estimado, Insignia, Seccion, Tarjeta, TarjetaCabecera } from '../../componentes/index.js';
import { arregladasSolas, creditos, dinero, duracion, numero } from '../../datos/formato.js';
import { MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';

// ---------------------------------------------------------------- informe.json de la app + lo calculado

const lista = (x) => (Array.isArray(x) ? x : null);

/** Un problema de informe.json con los nombres de esta pantalla: { id, tipo: 'arreglado'|'revisar', titulo, detalle, piezas }. */
function problemaDe(x, i) {
  if (!x || typeof x !== 'object') return null;
  const titulo = x.titulo || x.texto || x.mensaje;
  if (!titulo) return null;
  const arreglado = x.tipo === 'arreglado' || x.estado === 'arreglado' || x.arreglado === true || x.seArreglo === true;
  return {
    id: x.id || `informe-${i}`,
    tipo: arreglado ? 'arreglado' : 'revisar',
    titulo,
    detalle: x.detalle ?? (x.titulo ? x.texto : null) ?? null,
    unidad: x.unidad,
    piezas: lista(x.piezas) || [],
  };
}

/**
 * La respuesta de /api/entrega/:slug lista para el informe. Si trae `informe` (el de la app), sus
 * decisiones, problemas y costo van primero; lo que falte sale de lo calculado.
 */
export function normalizarInforme(entrega) {
  if (!entrega) return entrega;
  const app = entrega.informe && typeof entrega.informe === 'object' ? entrega.informe : null;
  if (!app) return { ...entrega, deLaApp: false };
  const decisiones = lista(app.decisiones)?.filter((d) => d?.titulo).map((d, i) => ({ id: d.id || `decision-${i}`, ...d, detalle: d.detalle ?? d.texto ?? '' }));
  const problemas = lista(app.problemas || app.loQueSalioMal)?.map(problemaDe).filter(Boolean);
  return {
    ...entrega,
    deLaApp: true,
    decisiones: decisiones?.length ? decisiones : entrega.decisiones,
    transiciones: lista(app.transiciones) || entrega.transiciones,
    problemas: problemas || entrega.problemas,
    costo: app.costo && typeof app.costo === 'object' ? { ...app.costo, deLaApp: true } : entrega.costo,
    modoPrueba: Boolean(app.modoPrueba ?? entrega.modoPrueba),
  };
}

const ICONOS = {
  voz: Mic,
  musica: EighthNotes,
  escena: Columns2,
  continuidad: Link2,
  ritmo: Gauge,
  broll: Images,
  transicion: Spline,
  subtitulos: Captions,
  textos: Type,
};

const UNIDAD = { toma: 'Toma', paso: 'Paso', 'B-roll': 'B-roll' };
const nombrePieza = (p, unidad) => {
  const u = p.unidad || unidad;
  if (p.n === null || p.n === undefined) return u || 'Pieza';
  return `${UNIDAD[u] || u || 'Toma'} ${p.n}`;
};

function Momento({ segundo, onIr, children, etiqueta }) {
  if (segundo === null || segundo === undefined) {
    return <span className="ent-pieza">{children}</span>;
  }
  return (
    <button type="button" className="ent-pieza ent-pieza--ir" onClick={() => onIr(segundo)} aria-label={`${etiqueta || 'Ver'}: ir al ${duracion(segundo)}`}>
      <Play size={10} strokeWidth={2.6} fill="currentColor" aria-hidden="true" />
      {children}
      <span className="ent-pieza__tiempo t-mono">{duracion(segundo)}</span>
    </button>
  );
}

// ---------------------------------------------------------------- 1. decisiones

function Decisiones({ informe, onIr }) {
  const { decisiones = [], transiciones = [] } = informe;
  // el detalle de cada transición (dónde y por qué) va detrás de "Ver más": arriba, solo lo esencial
  const [verTransiciones, setVerTransiciones] = useState(false);
  return (
    <Tarjeta className="ent-informe__tarjeta">
      <TarjetaCabecera icono={Clapperboard} titulo="Decisiones del montaje" subtitulo="Lo que el montaje decidió solo, y por qué." />
      {decisiones.length ? (
        <ul className="ent-decisiones">
          {decisiones.map((d) => {
            const Icono = ICONOS[d.icono] || Sparkles;
            return (
              <li key={d.id} className="ent-decision">
                <span className="ent-decision__icono" aria-hidden="true">
                  <Icono size={16} strokeWidth={2} />
                </span>
                <div className="ent-decision__textos">
                  <p className="ent-decision__titulo">
                    {d.titulo}
                    {d.color ? <span className="ent-muestra" style={{ background: d.color }} title="Color de la palabra resaltada" /> : null}
                  </p>
                  <p className="ent-decision__detalle">{d.detalle}</p>
                  {d.id === 'transiciones' && transiciones.length ? (
                    <button type="button" className="ent-ver-mas" aria-expanded={verTransiciones} onClick={() => setVerTransiciones((v) => !v)}>
                      <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                      {verTransiciones ? 'Ocultar' : `Ver dónde van las ${transiciones.length}`}
                    </button>
                  ) : null}
                  {d.id === 'transiciones' && transiciones.length && verTransiciones ? (
                    <ol className="ent-transiciones">
                      {transiciones.map((t) => (
                        <li key={`${t.toma}-${t.momento}`} className="ent-transicion">
                          <Momento segundo={t.momento} onIr={onIr} etiqueta={`Transición de la toma ${t.toma}`}>
                            Toma {t.toma}
                          </Momento>
                          <div className="ent-transicion__textos">
                            <span className="ent-transicion__como">
                              {t.animacion}
                              {t.efecto ? <span> + {t.efecto}</span> : null}
                            </span>
                            {t.porque ? <span className="ent-transicion__porque">{t.porque}</span> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EstadoVacio
          variante="compacto"
          icono={Clapperboard}
          tono="cian"
          titulo="Todavía no hay montaje"
          descripcion="Las decisiones aparecen cuando todas las piezas estén listas y se arme el video."
        />
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- 2. lo que salió mal

function Problemas({ informe, onIr }) {
  const lista = informe.problemas || [];
  const arreglados = lista.filter((p) => p.tipo === 'arreglado').length;
  const revisar = lista.length - arreglados;
  // contado por toma, como en la producción (la imagen y el clip de una toma son una)
  const partes = new Set(lista.filter((p) => p.tipo === 'arreglado').flatMap((p) => (p.piezas || []).filter((x) => x.n !== null && x.n !== undefined).map((x) => `${x.unidad}-${x.n}`)));
  const soloTomas = [...partes].every((k) => k.startsWith('toma-'));
  const hayMomentos = lista.some((p) => p.piezas?.some((x) => x.momento !== null && x.momento !== undefined));
  const resumen = [arreglados ? (partes.size ? arregladasSolas(partes.size, soloTomas) : `${arreglados} ${arreglados === 1 ? 'se arregló sola' : 'se arreglaron solas'}`) : null, revisar ? `${revisar} para mirar` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tarjeta className="ent-informe__tarjeta">
      <TarjetaCabecera
        icono={lista.length ? TriangleAlert : CircleCheck}
        tono={lista.length ? 'aviso' : 'ok'}
        titulo="Lo que salió mal"
        subtitulo={lista.length ? `${resumen}.${hayMomentos ? ' Toca una toma para verla en el video.' : ''}` : 'Nada que contar.'}
      />
      {lista.length ? (
        <ul className="ent-problemas">
          {lista.map((p) => (
            <li key={p.id || p.titulo} className={`ent-problema ent-problema--${p.tipo}`}>
              <div className="ent-problema__cabecera">
                {p.tipo === 'arreglado' ? (
                  <Insignia estado="arreglado" tamano="chico" />
                ) : (
                  <Insignia tono="neutro" icono={Eye} tamano="chico">
                    Para mirar
                  </Insignia>
                )}
                <p className="ent-problema__titulo">{p.titulo}</p>
              </div>
              {p.detalle ? <p className="ent-problema__detalle">{p.detalle}</p> : null}
              {p.piezas?.length ? (
                <div className="ent-piezas">
                  {p.piezas.map((x, i) => (
                    <Momento key={`${x.unidad || p.unidad}-${x.n}-${i}`} segundo={x.momento} onIr={onIr} etiqueta={nombrePieza(x, p.unidad)}>
                      {nombrePieza(x, p.unidad)}
                      {x.valor ? (
                        <span className="ent-pieza__valor" title={String(x.valor)}>
                          {x.valor}
                        </span>
                      ) : null}
                    </Momento>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="ent-limpio">
          <CircleCheck size={18} strokeWidth={2.2} aria-hidden="true" />
          <p>Todas las piezas pasaron la revisión a la primera y el montaje no dejó avisos.</p>
        </div>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- 3. costo real

const COLOR_PARTE = { imagenes: 'var(--pista-broll)', videos: 'var(--pista-video)', musica: 'var(--pista-musica)', voz: 'var(--pista-voz)' };
const NOMBRE_PARTE = { imagenes: 'Imágenes', videos: 'Videos', musica: 'Música', voz: 'Voz', guion: 'Guion' };

/**
 * Lo que se descuenta del plan de ElevenLabs según la familia que produjo el anuncio (server/lib/familias/*.js):
 *   voz en off y continuidad   la voz del narrador (generar-audio) y la transcripción de los clips (revisar-voces)
 *   los demás                   solo la transcripción: los personajes hablan dentro de su clip (objeto parlante, UGC,
 *                               podcast, entrevista) y en los cantados la voz es la canción, de Suno
 * `familia` es la del conductor (o la de la lista: voz-en-off · hablado · cantado). Sin familia, lo dice el gasto.
 */
const CON_NARRADOR = new Set(['voz-en-off', 'continuidad']);
const CANTADAS = new Set(['musical', 'historia-musical', 'cantado']);
const conNarrador = (familia, c) => (familia ? CON_NARRADOR.has(familia) : Number(c?.elevenlabs?.caracteres || c?.vozCaracteres) > 0);
const notaElevenLabs = (familia, c) =>
  conNarrador(familia, c) ? 'La voz y la transcripción se descuentan de tu plan de ElevenLabs.' : 'La transcripción se descuenta de tu plan de ElevenLabs.';
/** La línea "Voz" de un anuncio sin narrador: en los cantados no va (la voz es la canción); en los demás, va en cada clip. */
const VOZ_EN_EL_CLIP = 'Cada personaje habla en su propio clip';

/**
 * Las partes del costo, con lo que venga: `costo.partes` del informe de la app
 * ([{ id, nombre?, detalle?, dolares?, creditos?, piezas?, caracteres? }]) o el costo calculado del registro
 * del motor (imagenes / videos / musica con { piezas, creditos, dolares }).
 */
function partesDe(c, familia) {
  const dpc = c.dolaresPorCredito || 0.005;
  const usd = (x) => (Number.isFinite(Number(x?.dolares)) ? Number(x.dolares) : Number.isFinite(Number(x?.creditos)) ? Number(x.creditos) * dpc : null);
  if (Array.isArray(c.partes)) {
    const sinNarrador = familia && !CON_NARRADOR.has(familia);
    // sin narrador la voz sale en cada clip (va en el precio del video): no es del plan de ElevenLabs
    const enElClip = (x) => x.id === 'voz' && sinNarrador && !Number(x.caracteres);
    return c.partes
      .filter((x) => x && x.id !== 'guion')
      .filter((x) => !(x.id === 'voz' && CANTADAS.has(familia) && !Number(x.caracteres) && !Number.isFinite(Number(x.dolares))))
      .map((x) => ({
        id: x.id,
        nombre: x.nombre || NOMBRE_PARTE[x.id] || x.id,
        detalle:
          x.detalle ||
          (x.id === 'imagenes' && x.piezas ? `${numero(x.piezas)} ${x.piezas === 1 ? 'imagen' : 'imágenes'}` : null) ||
          (x.id === 'videos' && x.piezas ? `${numero(x.piezas)} ${x.piezas === 1 ? 'clip' : 'clips'} de video` : null) ||
          (x.id === 'musica' ? 'Suno, en kie.ai' : null) ||
          (x.caracteres ? `Unos ${numero(x.caracteres)} caracteres de tu plan de ElevenLabs` : null) ||
          (enElClip(x) ? VOZ_EN_EL_CLIP : ''),
        dolares: x.id === 'voz' && !Number.isFinite(Number(x.dolares)) ? null : usd(x),
        plan: x.id === 'voz' && !Number.isFinite(Number(x.dolares)) && !enElClip(x),
      }));
  }
  // el costo calculado con el registro del motor: si no cubre todo, se completa con el promedio por pieza
  const promImg = c.imagenes?.piezas ? c.imagenes.creditos / c.imagenes.piezas : 10;
  const promClip = c.videos?.piezas ? c.videos.creditos / c.videos.piezas : 84;
  const crImg = c.completo ? c.imagenes?.creditos || 0 : Math.max(c.piezas?.imagenes || 0, c.imagenes?.piezas || 0) * promImg;
  const crVid = c.completo ? c.videos?.creditos || 0 : Math.max(c.piezas?.clips || 0, c.videos?.piezas || 0) * promClip;
  const partes = [
    { id: 'imagenes', nombre: 'Imágenes', detalle: `${numero(c.piezas?.imagenes || 0)} ${c.piezas?.imagenes === 1 ? 'imagen' : 'imágenes'}`, dolares: crImg * dpc },
    { id: 'videos', nombre: 'Videos', detalle: `${numero(c.piezas?.clips || 0)} ${c.piezas?.clips === 1 ? 'clip' : 'clips'} de video`, dolares: crVid * dpc },
  ];
  if (c.musica && (c.musica.creditos || c.musica.dolares)) partes.push({ id: 'musica', nombre: 'Música', detalle: 'Suno, en kie.ai', dolares: usd(c.musica) });
  if (!c.vozCaracteres && familia && CANTADAS.has(familia)) return partes;
  partes.push({
    id: 'voz',
    nombre: 'Voz',
    detalle: c.vozCaracteres ? `Unos ${numero(c.vozCaracteres)} caracteres de tu plan de ElevenLabs` : VOZ_EN_EL_CLIP,
    dolares: null,
    plan: Boolean(c.vozCaracteres),
  });
  return partes;
}

function Costo({ informe, terminado, familia }) {
  const c = informe.costo;
  const modoPrueba = Boolean(informe.modoPrueba || c?.modoPrueba);

  if (!terminado) {
    // Mientras se produce no se muestra ningún gasto: el costo real aparece cuando el anuncio está hecho.
    return (
      <Tarjeta className="ent-informe__tarjeta">
        <TarjetaCabecera icono={Wallet} tono="ok" titulo="Costo real" subtitulo="Lo que costó hacer este anuncio." />
        <EstadoVacio
          variante="compacto"
          icono={Wallet}
          tono="ok"
          titulo="Aparece cuando tu anuncio esté terminado"
          descripcion="Mientras se produce, aquí no se cuenta nada. Al final ves cuánto costó cada parte."
        />
      </Tarjeta>
    );
  }

  const conPartes = Array.isArray(c?.partes);
  if (!c || (!conPartes && !c.hayRegistro && !Number.isFinite(Number(c.dolares)))) {
    // Sin registro del motor no hay costo real: se dice claro, sin números de ejemplo.
    return (
      <Tarjeta className="ent-informe__tarjeta">
        <TarjetaCabecera icono={Wallet} tono="ok" titulo="Costo real" subtitulo="Lo que costó hacer este anuncio." />
        <EstadoVacio
          variante="compacto"
          icono={Wallet}
          tono="ok"
          titulo="Esta carpeta no guardó el registro de gasto"
          descripcion="Sin ese registro no hay un costo real que mostrar. En los anuncios que produce la app, aquí ves cuánto costó cada parte."
        />
      </Tarjeta>
    );
  }

  const dpc = c.dolaresPorCredito || 0.005;
  // el de la app es real (suma sus registros de gasto de cada corrida) salvo que tenga piezas estimadas (la app se
  // cerro a mitad de una corrida) y el saldo de kie no lo confirme; el del motor, solo si cubre todas las piezas
  const coincide = (c.saldo?.coincide ?? c.verificacion?.coincide) === true;
  const real = c.deLaApp ? c.completo !== false && (c.estimado !== true || coincide) : Boolean(c.completo);
  const partes = partesDe(c, familia);
  const total =
    c.deLaApp && Number.isFinite(Number(c.dolares))
      ? Number(c.dolares)
      : Number.isFinite(Number(c.dolares)) && (real || !c.estimado)
        ? Number(c.dolares)
        : c.estimado?.dolares ?? partes.reduce((s, x) => s + (x.dolares || 0), 0);
  const totalCr = real || c.deLaApp ? c.creditos : c.estimado?.creditos ?? c.creditos;
  const conPrecio = partes.filter((x) => x.dolares);
  const suma = conPrecio.reduce((s, x) => s + x.dolares, 0);

  return (
    <Tarjeta className="ent-informe__tarjeta">
      <TarjetaCabecera
        icono={Wallet}
        tono="ok"
        titulo={modoPrueba ? 'Lo que habría costado' : real ? 'Costo real' : 'Costo'}
        subtitulo={
          modoPrueba
            ? 'Modo prueba: no se gastó nada. Son los números que dieron los simuladores, para revisar la cuenta.'
            : c.deLaApp
              ? 'Según los registros de gasto que guardó la app en cada paso de este anuncio.'
              : real
                ? 'Según el registro de gasto de kie.ai de este anuncio.'
                : 'El registro de esta carpeta no guardó todas las tandas: el total es un estimado.'
        }
      />
      <div className="ent-costo__total">
        <span className="ent-costo__numero t-num" title={Number.isFinite(Number(totalCr)) ? `${creditos(Math.round(totalCr))} de kie.ai` : undefined}>
          {dinero(total)}
        </span>
        {modoPrueba ? <MarcaModoPrueba /> : real ? <Insignia estado="listo" tamano="chico" texto="Real" /> : <Estimado />}
      </div>

      {suma > 0 ? (
        <div className="ent-costo__reparto" aria-hidden="true">
          {conPrecio.map((x) => (
            <span key={x.id} className="ent-costo__parte" style={{ width: `${(x.dolares / suma) * 100}%`, background: COLOR_PARTE[x.id] || 'var(--superficie-4)' }} />
          ))}
        </div>
      ) : null}

      <ul className="ent-costo__lineas">
        {partes.map((x) => (
          <li key={x.id}>
            <span className="ent-costo__clave" style={{ '--c-parte': COLOR_PARTE[x.id] || 'var(--superficie-4)' }}>
              {x.nombre}
            </span>
            <span className="t-3">{x.detalle}</span>
            {x.dolares !== null && x.dolares !== undefined ? <span className="t-num">{dinero(x.dolares)}</span> : <span className="t-num t-3">{x.plan ? 'tu plan' : 'incluida'}</span>}
          </li>
        ))}
        <li>
          <span className="ent-costo__clave">Guion</span>
          <span className="t-3">Lo escribió Claude Code con tu cuenta</span>
          <span className="t-num t-3">sin costo extra</span>
        </li>
      </ul>

      {coincide && !modoPrueba ? (
        <p className="ent-costo__nota ent-costo__nota--ok">
          <CircleCheck size={13} strokeWidth={2.4} aria-hidden="true" /> Coincide con lo que bajó tu saldo de kie mientras se hacía.
        </p>
      ) : null}
      {!real && !c.deLaApp ? (
        <p className="ent-costo__nota">Calculado con las piezas que hay en la carpeta y lo que cuesta cada una en kie.ai.</p>
      ) : (
        <p className="ent-costo__nota">
          1 crédito de kie.ai = {dinero(dpc, { decimales: 3 })}. {c.rehecho ? 'Incluye lo que se rehízo solo. ' : ''}
          {notaElevenLabs(familia, c)}
        </p>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- el informe

/** `familia`: la que produjo el anuncio (la del conductor, o la de la lista), para decir qué se descuenta de ElevenLabs. */
export function Informe({ informe, onIr, terminado = true, familia = null }) {
  return (
    <Seccion titulo="Informe" icono={Sparkles} descripcion="Lo que pasó mientras se hacía tu anuncio, en tres partes." className="ent-informe">
      <Decisiones informe={informe} onIr={onIr} />
      <Problemas informe={informe} onIr={onIr} />
      <Costo informe={informe} terminado={terminado} familia={familia} />
    </Seccion>
  );
}
