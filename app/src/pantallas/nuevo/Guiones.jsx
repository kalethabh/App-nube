// El guion de cada anuncio: "Escribir el guion" -> tu IA (Claude o ChatGPT) lo escribe con la cuenta del usuario
// (POST /api/anuncios lanza la sesión "guion") -> se ve el avance real, frase por frase -> aparece el
// guion real (GET /api/anuncios/:slug/guion): lo que se dice, parte por parte, y lo que decidió la IA.
// Dos salidas: "Me gusta, producir" (POST …/producir y a la producción de ese anuncio) o "Pedir cambios"
// con palabras normales (POST …/guion/cambios: la misma sesión de tu IA, y vuelve el avance).
// Prompts, imágenes y el manifiesto van por dentro: nunca se muestran.
//
// Cada estilo se lee a su manera:
//   voz en off      lo que dice el narrador y lo que se ve, toma por toma
//   objeto parlante quién habla en cada toma
//   UGC             bloque por bloque, y los 2 arranques para probar (si los pidió)
//   podcast         la conversación en el orden en que se oye, con quién dice cada línea
//   entrevista      clip por clip, con su diálogo y el llamado a la acción del final
//   musical         las 2 o 3 letras: el usuario elige una (POST …/guion/letra) y la produce, o pide cambios
//   historia        la historia que se canta, acto por acto, y cómo va a sonar
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, FileText, Lightbulb, MessageSquareText, Mic, Music, PenLine, Send, Sparkles, Users } from 'lucide-react';
import { AreaTexto, Boton, Chip, Esqueleto, Pestanas, Seccion, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, useGuion, useSaldoKie } from '../../datos/api.js';
import { duracionEnPalabras } from '../../datos/formato.js';
import { ir, rutas } from '../../datos/rutas.js';
import { DETALLES, faltaDe, queDiceElGuion } from '../estilos/catalogo.js';
import { conDuracion, duracionAprox, duracionDeAjuste } from '../../datos/duracion.js';
import { leerGuion, tipoDeFalla } from './datos.js';
import { AvisoMotor, Progreso, TarjetaFalla } from './piezas.jsx';
import { useMotor } from '../ajustes/datos.js';
import { Producir } from './Producir.jsx';
import { BotonDescartar } from './Descartar.jsx';
import { SelloEstilo } from './SelloEstilo.jsx';

/** Sugerencias para pedir cambios en palabras normales, según lo que se lee. */
const CAMBIOS_RAPIDOS = {
  guion: ['Haz el gancho más corto', 'Que suene más cercano', 'Menciona la oferta', 'Cambia el cierre'],
  musical: ['Haz el coro más pegadizo', 'Que sea más corta', 'Menciona la oferta', 'Dame otra opción distinta'],
  historia: ['Haz el gancho más fuerte', 'Que sea más corta', 'Cambia el villano', 'Menciona la garantía'],
};
const EJEMPLO_CAMBIO = {
  guion: 'Ej.: que el gancho sea más corto y que diga que el envío es gratis.',
  musical: 'Ej.: en la opción 2, que el coro diga que el envío es gratis.',
  historia: 'Ej.: que la suegra sea la que la humilla y que el cierre mencione la garantía.',
};
// Lo que suele tardar, por IA. Claude, medido: 2,6 min el guion de un claymation de 30 s (cuenta Max, 2026-10-25); los
// demás, a estimar. ChatGPT, medido en las pruebas reales del 2026-11-09 (esfuerzo alto, 2 corridas de los 13 estilos):
// los guiones con manifiesto, de 4,3 a 11,1 min (Lego, el más largo); las letras del musical, 2,3 y 2,4; la historia
// musical, 3,5 y 4,0.
const SUELE = {
  claude: { guion: 'suele tardar de 3 a 10 min', musical: 'suele tardar de 3 a 8 min', historia: 'suele tardar de 5 a 15 min' },
  codex: { guion: 'suele tardar de 5 a 12 min', musical: 'suele tardar de 2 a 6 min', historia: 'suele tardar de 4 a 10 min' },
};
/** El "suele tardar" de esa IA (sin elegir, el de Claude). */
const sueleDe = (motor, tipo) => (SUELE[motor] || SUELE.claude)[tipo];
// Los guiones largos se muestran hasta la parte 14 y el resto con un botón.
const LARGO_SIN_PLEGAR = 20;
const VISIBLES = 14;

const palabrasDe = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const MARCA = /^\s*\[[^\]]*\]\s*$/; // [Verso 1], [Coro]…

/** Cómo se lee el guion de cada estilo. */
function tipoDeHoja(clave) {
  if (clave === 'musical') return 'musical';
  if (clave === 'historias-musicales') return 'historia';
  return 'guion';
}

const mayuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * El largo que se ve arriba del guion: el que estima el guion ("≈ 52 s"; duracionEstimada puede venir en segundos o ya
 * escrita) o, mientras se escribe, la duración elegida: "Duración: la decide la IA" o "Unos 2 min".
 */
function largoDe(guion, ajuste, clave) {
  const d = guion?.duracionEstimada ?? guion?.duracion_s;
  if (typeof d === 'number' && d > 0) return `≈ ${duracionEnPalabras(d)}`;
  if (typeof d === 'string' && d.trim()) return `≈ ${d.trim()}`;
  if (!conDuracion(clave)) return null;
  const a = duracionDeAjuste(ajuste?.duracion);
  if (a.decide === 'ia') return 'Duración: la decide la IA';
  return a.segundos ? mayuscula(duracionAprox(a.segundos)) : null;
}

/** La pestaña de cada estilo: "Claymation · unos 2 min" o "Claymation · duración: la decide la IA" (el musical, solo el nombre). */
function etiquetaPestana(estilo, ajuste) {
  if (!conDuracion(estilo.clave)) return estilo.nombre;
  const a = duracionDeAjuste(ajuste?.duracion);
  if (a.decide === 'ia') return `${estilo.nombre} · duración: la decide la IA`;
  return a.segundos ? `${estilo.nombre} · ${duracionAprox(a.segundos)}` : estilo.nombre;
}

const NOMBRE_PARTES = { podcast: ['línea', 'líneas'], entrevista: ['clip', 'clips'], ugc: ['bloque', 'bloques'], 'historias-musicales': ['línea', 'líneas'] };
const cuantas = (clave, n) => `${n} ${(NOMBRE_PARTES[clave] || ['parte', 'partes'])[n === 1 ? 0 : 1]}`;
const ENCABEZADO = { podcast: 'La conversación, en el orden en que se oye', entrevista: 'La entrevista, clip por clip', ugc: 'Lo que dice la persona a cámara', 'talking-object-pixar': 'Lo que dice cada personaje' };
const VISUAL = { crochet: 'Crochet', claymation: 'Claymation', 'zack-d-films': 'Zack D Films' };
const VOZ = { f: 'Voz femenina', m: 'Voz masculina' };

const textos = (lista) => (Array.isArray(lista) ? lista : []).map((d) => (typeof d === 'string' ? d : d?.texto || '')).filter(Boolean);

// ---------------------------------------------------------------- piezas de la hoja

function Parte({ p }) {
  const dialogo = Array.isArray(p.dialogo) ? p.dialogo.filter((d) => d && String(d.dice || '').trim()) : [];
  return (
    <li className="nv-linea">
      <div className="nv-linea__marca">
        <span className="nv-linea__n t-mono">{String(p.n ?? '').padStart(2, '0')}</span>
      </div>
      <div className="nv-linea__dice">
        {p.momento ? <span className="nv-linea__momento">{p.momento}</span> : null}
        {dialogo.length ? (
          <ul className="nv-dialogo">
            {dialogo.map((d, i) => (
              <li key={i} className={`nv-dialogo__linea${d.lado === 'B' ? ' nv-dialogo__linea--b' : ''}`}>
                <span className="nv-quien">{d.quien}</span>
                {d.dice}
              </li>
            ))}
          </ul>
        ) : (
          <p className="nv-linea__texto">
            {p.quien ? <span className={`nv-quien${p.lado === 'B' ? ' nv-quien--b' : ''}`}>{p.quien}</span> : null}
            {p.dice}
          </p>
        )}
        {p.se_ve || p.seVe ? <p className="nv-linea__se-ve">{p.se_ve || p.seVe}</p> : null}
      </div>
    </li>
  );
}

function Lista({ titulo, icono: Icono, items, clase = '' }) {
  if (!items.length) return null;
  return (
    <div className={`nv-decisiones ${clase}`}>
      <h4 className="nv-decisiones__titulo">
        <Icono size={14} strokeWidth={2.2} aria-hidden="true" /> {titulo}
      </h4>
      <ul>
        {items.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}

/** «Agregar»: lo que entendió la IA de tu video y tu pedido (el estilo, la duración y lo que se conserva). */
function PlanDelPedido({ plan }) {
  const datos = [
    plan.estiloNombre ? `Estilo: ${plan.estiloNombre}${plan.formato ? ` (${plan.formato.toLowerCase()})` : ''}` : null,
    `Duración: ${plan.duracion || 'la de tu video'}`,
    plan.idioma ? `Idioma: ${plan.idioma}` : null,
  ].filter(Boolean);
  return (
    <div className="nv-decisiones nv-decisiones--plan">
      <h4 className="nv-decisiones__titulo">
        <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> Lo que entendió de tu video y tu pedido
      </h4>
      {plan.pedido ? <p className="nv-decisiones__nota">Pediste: «{plan.pedido}»</p> : null}
      {plan.resumen ? <p className="nv-decisiones__nota">{plan.resumen}</p> : null}
      <ul>
        {datos.map((d) => (
          <li key={d}>{d}</li>
        ))}
        {(plan.conserva || []).map((d, i) => (
          <li key={`c${i}`}>Se mantiene: {d}</li>
        ))}
        {(plan.cambia || []).map((d, i) => (
          <li key={`x${i}`}>Cambia: {d}</li>
        ))}
      </ul>
    </div>
  );
}

/** Lo que va debajo de toda hoja: quién aparece, lo que cambió y lo que decidió la IA. */
function Pie({ guion, letras }) {
  const personajes = (Array.isArray(guion?.personajes) ? guion.personajes : [])
    .filter((x) => x?.nombre)
    .map((x) => (x.como_es ? `${x.nombre}: ${x.como_es}` : x.nombre));
  const cambios = textos(letras?.cambios_hechos?.length ? letras.cambios_hechos : guion?.cambiosHechos || guion?.cambios_hechos);
  const decisiones = textos(letras?.decisiones?.length ? letras.decisiones : guion?.decisiones);
  // «Agregar»: qué modelo hace cada escena y por qué (lo arma el servidor desde el manifiesto)
  const modelos = (Array.isArray(guion?.modelos) ? guion.modelos : [])
    .filter((x) => x?.modelo && x?.para)
    .map((x) => `${x.modelo} · ${x.para}${x.porque ? `: ${x.porque}` : ''}`);
  return (
    <>
      <Lista titulo="Quién aparece" icono={Users} items={personajes} clase="nv-decisiones--personajes" />
      <Lista titulo="El modelo de cada escena" icono={Sparkles} items={modelos} clase="nv-decisiones--modelos" />
      <Lista titulo="Lo que cambió" icono={PenLine} items={cambios} clase="nv-decisiones--cambios" />
      <Lista titulo="Lo que decidió la IA" icono={Lightbulb} items={decisiones} />
    </>
  );
}

function Cabecera({ estilo, datos }) {
  return (
    <div className="nv-guion__cabecera">
      <div className="nv-guion__meta">
        <span className="nv-guion__dato nv-guion__dato--estilo">
          <SelloEstilo clave={estilo.clave} familia={estilo.familia} tamano="chico" />
          {estilo.nombre}
        </span>
        {datos.filter(Boolean).map((d, i) => (
          <span key={i} className="nv-guion__dato">
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- la hoja de un guion hablado o con narrador

function HojaGuion({ estilo, ajuste, guion, encima, cambiando = false, continuidad = false }) {
  const [todas, setTodas] = useState(false);
  const partes = Array.isArray(guion?.partes) ? guion.partes.filter((p) => p && String(p.dice || '').trim()) : [];
  const mostradas = todas || partes.length <= LARGO_SIN_PLEGAR ? partes : partes.slice(0, VISIBLES);
  const faltan = partes.length - mostradas.length;
  const palabras = partes.reduce((s, p) => s + palabrasDe(p.dice), 0);
  const largo = largoDe(guion, ajuste, estilo.clave);
  const ganchos = Array.isArray(guion?.extras?.ganchos) ? guion.extras.ganchos.filter((g) => g?.dice) : [];
  const cta = guion?.extras?.cta || null;
  const variante = guion?.variante ? `Variante ${guion.variante === 'A' ? 'A · Gancho callejero' : 'B · Entrevista completa'}` : null;

  return (
    <div className={`nv-guion__hoja${cambiando ? ' nv-guion__hoja--cambiando' : ''}`}>
      <Cabecera
        estilo={estilo}
        datos={[
          continuidad ? 'Sin cortes' : null,
          guion ? (
            <>
              <FileText size={14} strokeWidth={2} aria-hidden="true" /> {palabras} palabras
            </>
          ) : null,
          largo ? <span className="t-num">{largo}</span> : null,
          guion ? cuantas(estilo.clave, partes.length) : null,
          variante,
        ]}
      />
      {encima}
      {guion ? (
        <>
          {guion.titulo ? <h3 className="nv-guion__titulo">{guion.titulo}</h3> : null}
          {guion.de_que_va ? <p className="nv-guion__de-que-va">{guion.de_que_va}</p> : null}
          <div className="nv-guion__columnas" aria-hidden="true">
            <span />
            <span>
              <Mic size={13} strokeWidth={2.2} /> {ENCABEZADO[estilo.clave] || 'Lo que se dice'}
            </span>
          </div>
          <ol className="nv-lineas">
            {mostradas.map((p, i) => (
              <Parte key={`${p.n}-${i}`} p={p} />
            ))}
          </ol>
          {faltan > 0 ? (
            <button type="button" className="nv-guion__mas" onClick={() => setTodas(true)}>
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" /> Ver {cuantas(estilo.clave, faltan)} más
            </button>
          ) : null}
          {cta ? (
            <p className="nv-guion__extra">
              <Eye size={14} strokeWidth={2.2} aria-hidden="true" /> Al final, en pantalla: <strong>«{cta}»</strong>
            </p>
          ) : null}
          {ganchos.length ? (
            <div className="nv-decisiones nv-decisiones--ganchos">
              <h4 className="nv-decisiones__titulo">
                <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" /> {ganchos.length === 1 ? 'Un arranque más para probar' : `${ganchos.length} arranques más para probar`}
              </h4>
              <p className="nv-decisiones__nota">El mismo anuncio con otro comienzo: sale como una versión aparte.</p>
              <ul>
                {ganchos.map((g, i) => (
                  <li key={g.id || i}>
                    {g.idea ? <strong>{g.idea}: </strong> : null}«{g.dice}»
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Pie guion={guion} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- la letra (musical): elegir una

function Letra({ letra }) {
  const bloques = [];
  for (const l of String(letra || '').split(/\r?\n/)) {
    const t = l.trim();
    if (!t) continue;
    if (MARCA.test(t)) bloques.push({ marca: t.replace(/^\[|\]$/g, '').trim(), lineas: [] });
    else {
      if (!bloques.length) bloques.push({ marca: null, lineas: [] });
      bloques[bloques.length - 1].lineas.push(t);
    }
  }
  return (
    <div className="nv-letra">
      {bloques.map((b, i) => (
        <div key={i} className="nv-letra__bloque">
          {b.marca ? <span className="nv-letra__marca">{b.marca}</span> : null}
          {b.lineas.map((l, j) => (
            <p key={j} className="nv-letra__linea">
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function HojaLetras({ estilo, letras, encima, cambiando = false, elegida, onElegir, puedeElegir }) {
  const opciones = Array.isArray(letras?.opciones) ? letras.opciones : [];
  const [activa, setActiva] = useState(elegida || 1);
  useEffect(() => {
    if (elegida) setActiva(elegida);
  }, [elegida]);
  const o = opciones.find((x) => x.n === activa) || opciones[0];
  return (
    <div className={`nv-guion__hoja${cambiando ? ' nv-guion__hoja--cambiando' : ''}`}>
      <Cabecera
        estilo={estilo}
        datos={[
          opciones.length ? `${opciones.length} letras para elegir` : null,
          letras?.visual ? `Se ve en ${VISUAL[letras.visual] || letras.visual}` : null,
          VOZ[letras?.vocalGender] || (letras ? 'La voz la elige la canción' : null),
        ]}
      />
      {encima}
      {letras && o ? (
        <>
          {letras.angulo ? <p className="nv-guion__de-que-va">{letras.angulo}</p> : null}
          {opciones.length > 1 ? (
            <div className="nv-letras__pestanas">
              <Pestanas
                etiqueta="Las letras"
                activa={o.n}
                onCambio={setActiva}
                items={opciones.map((x) => ({ id: x.n, icono: elegida === x.n ? Check : undefined, etiqueta: `Opción ${x.n}${x.titulo ? ` · ${x.titulo}` : ''}` }))}
              />
            </div>
          ) : null}
          <div className={`nv-opcion${elegida === o.n ? ' nv-opcion--elegida' : ''}`}>
            <div className="nv-opcion__cabecera">
              <div>
                <h3 className="nv-guion__titulo">{o.titulo || `Opción ${o.n}`}</h3>
                {o.concepto ? <p className="nv-opcion__concepto">{o.concepto}</p> : null}
              </div>
              {opciones.length > 1 ? (
                <Boton
                  variante={elegida === o.n ? 'secundario' : 'primario'}
                  tamano="chico"
                  icono={elegida === o.n ? Check : undefined}
                  disabled={!puedeElegir || elegida === o.n}
                  onClick={() => onElegir(o.n)}
                >
                  {elegida === o.n ? 'Elegida' : 'Elegir esta letra'}
                </Boton>
              ) : null}
            </div>
            <Letra letra={o.letra} />
            {o.ideaVisual ? (
              <p className="nv-opcion__visual">
                <Eye size={14} strokeWidth={2.2} aria-hidden="true" /> <span>{o.ideaVisual}</span>
              </p>
            ) : null}
          </div>
          <Pie letras={letras} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- la historia musical: acto por acto

function HojaHistoria({ estilo, ajuste, guion, encima, cambiando = false }) {
  const [todas, setTodas] = useState(false);
  const partes = Array.isArray(guion?.partes) ? guion.partes.filter((p) => p && String(p.dice || '').trim()) : [];
  const mostradas = todas || partes.length <= LARGO_SIN_PLEGAR ? partes : partes.slice(0, VISIBLES);
  const faltan = partes.length - mostradas.length;
  const largo = largoDe(guion, ajuste, estilo.clave);
  const estilos = textos(guion?.estilos_cancion || guion?.cancion?.estilos);
  // los actos: "Acto 1 · Dolor", "Acto 1 · gancho"… se agrupan por su número. Si todas las líneas del acto dicen
  // lo mismo después del acto, va en el título; si no, cada línea muestra su parte ("gancho", "declive"…)
  const grupos = [];
  for (const p of mostradas) {
    const m = String(p.momento || '').match(/^\s*(acto\s*\d+)\s*(?:[·:\-–—]\s*(.*))?$/i);
    const acto = m?.[1] || null;
    const resto = (m ? m[2] : p.momento) || null;
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || (acto && ultimo.acto?.toLowerCase() !== acto.toLowerCase())) grupos.push({ acto, partes: [{ ...p, resto }] });
    else ultimo.partes.push({ ...p, resto });
  }
  for (const g of grupos) {
    const distintos = new Set(g.partes.map((x) => x.resto || ''));
    g.unaSola = distintos.size === 1;
    g.titulo = g.acto ? (g.unaSola && g.partes[0].resto ? `${g.acto} · ${g.partes[0].resto}` : g.acto) : null;
  }
  return (
    <div className={`nv-guion__hoja${cambiando ? ' nv-guion__hoja--cambiando' : ''}`}>
      <Cabecera
        estilo={estilo}
        datos={[
          guion ? (
            <>
              <FileText size={14} strokeWidth={2} aria-hidden="true" /> {partes.reduce((s, p) => s + palabrasDe(p.dice), 0)} palabras
            </>
          ) : null,
          largo ? <span className="t-num">{largo}</span> : null,
          guion ? cuantas(estilo.clave, partes.length) : null,
        ]}
      />
      {encima}
      {guion ? (
        <>
          {guion.titulo ? <h3 className="nv-guion__titulo">{guion.titulo}</h3> : null}
          {guion.de_que_va ? <p className="nv-guion__de-que-va">{guion.de_que_va}</p> : null}
          {estilos.length ? (
            <div className="nv-guion__extra nv-guion__extra--bloque">
              <Music size={14} strokeWidth={2.2} aria-hidden="true" />
              <div>
                <strong>Cómo va a sonar.</strong> Se hacen las dos versiones y eliges de oído:
                <ul>
                  {estilos.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <div className="nv-guion__columnas" aria-hidden="true">
            <span />
            <span>
              <Music size={13} strokeWidth={2.2} /> Lo que se canta, línea por línea
            </span>
          </div>
          {grupos.map((g, i) => (
            <div key={i} className="nv-acto">
              {g.titulo ? <h4 className="nv-acto__titulo">{g.titulo}</h4> : null}
              <ol className="nv-lineas">
                {g.partes.map(({ resto, ...p }, j) => (
                  <Parte key={`${p.n}-${j}`} p={{ ...p, momento: g.acto ? (g.unaSola ? null : resto) : p.momento }} />
                ))}
              </ol>
            </div>
          ))}
          {faltan > 0 ? (
            <button type="button" className="nv-guion__mas" onClick={() => setTodas(true)}>
              <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" /> Ver {cuantas(estilo.clave, faltan)} más
            </button>
          ) : null}
          <Pie guion={guion} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- pedir cambios

function PedirCambios({ estilo, activo, enviando, onPedir, aprobado = false, terminado = false }) {
  const { nombre } = useMotor();
  const [texto, setTexto] = useState('');
  const tipo = tipoDeHoja(estilo.clave);
  const que = tipo === 'musical' ? 'tus letras estén escritas' : tipo === 'historia' ? 'tu historia esté escrita' : 'tu guion esté escrito';
  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    if (await onPedir(t)) setTexto('');
  };
  return (
    <div className={`nv-cambios${activo ? '' : ' nv-cambios--espera'}`}>
      <div className="nv-cambios__cabecera">
        <MessageSquareText size={16} strokeWidth={2} aria-hidden="true" />
        <h4>Pedir cambios</h4>
      </div>
      <AreaTexto
        filas={3}
        disabled={!activo || enviando}
        placeholder={
          activo
            ? EJEMPLO_CAMBIO[tipo]
            : terminado
              ? 'Este anuncio ya se produjo: los cambios se hacen en el editor.'
              : aprobado
                ? 'Este anuncio ya se está produciendo: cuando termine, los cambios se hacen en el editor.'
                : `Cuando ${que}, aquí le pides a ${nombre} los cambios con tus palabras.`
        }
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar();
        }}
        aria-label={`Cambios para el guion de ${estilo.nombre}`}
      />
      <div className="fila fila--envolver" style={{ '--hueco': '6px' }}>
        {CAMBIOS_RAPIDOS[tipo].map((c) => (
          <Chip key={c} tamano="chico" disabled={!activo || enviando} onClick={() => setTexto((t) => (t.trim() ? `${t.trim()} ${c}.` : `${c}.`))}>
            {c}
          </Chip>
        ))}
      </div>
      <Boton variante="secundario" icono={Send} bloque cargando={enviando} disabled={!activo || !texto.trim()} onClick={enviar}>
        Pedir el cambio
      </Boton>
    </div>
  );
}

// ---------------------------------------------------------------- el guion de un anuncio, en vivo

/**
 * El lateral (pedir cambios, «Me gusta, producir» con su costo estimado) queda pegado arriba mientras bajas por el
 * guion. Si es más alto que la ventana (por ejemplo con «Con otro modelo» abierto), se pega por abajo: así el botón
 * de producir siempre se puede ver sin llegar al final del guion. (En una columna, debajo de 1180 px, no se pega.)
 */
function useLateralPegado() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ajustar = () => {
      const raiz = getComputedStyle(document.documentElement);
      const arriba = (parseFloat(raiz.getPropertyValue('--alto-barra')) || 60) + (parseFloat(raiz.getPropertyValue('--e-5')) || 20);
      const top = Math.min(arriba, window.innerHeight - el.offsetHeight - 20);
      el.style.top = top < arriba ? `${Math.round(top)}px` : '';
    };
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    window.addEventListener('resize', ajustar);
    ajustar();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', ajustar);
    };
  }, []);
  return ref;
}

function GuionVivo({ estilo: estiloPestana, ajuste, slug, motor, onEscribirDeNuevo, onVolverAlProducto, onBrief }) {
  const { aviso } = useAvisos();
  const [sondear, setSondear] = useState(true);
  const g = useGuion(slug, { cadaMs: sondear ? 2000 : undefined });
  const leido = leerGuion(g.datos);
  // «Agregar» que tu pedido pasó a otro estilo (Pixar, musical…): la hoja es la de ese estilo
  const destino = leido.brief?.estilo;
  const estilo = destino && destino !== estiloPestana.clave ? { ...estiloPestana, clave: destino } : estiloPestana;
  const tipo = tipoDeHoja(estilo.clave);

  // después de pedir un cambio, el servidor tarda un instante en marcarlo: se sigue mirando unos segundos
  const [lanzadoEn, setLanzadoEn] = useState(0);
  const vio = useRef(false);
  const corre = leido.estado === 'escribiendo';
  if (corre && g.datos) vio.current = true;
  const enGracia = lanzadoEn > 0 && !vio.current && Date.now() - lanzadoEn < 15000;
  const sinRuta = g.error?.estado === 404 && !g.datos; // el anuncio no existe (o el servidor no tiene la ruta)
  const escribiendo = !sinRuta && (corre || enGracia);
  useEffect(() => setSondear(escribiendo), [escribiendo]);
  // al volver a abrir, los ajustes de la tarjeta son los del anuncio (duración, voz y lo que eligió)
  useEffect(() => {
    if (leido.brief) onBrief?.(leido.brief);
  }, [Boolean(leido.brief)]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ultimoPedido, setUltimoPedido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [produciendo, setProduciendo] = useState(false);
  const [sinSaldo, setSinSaldo] = useState(false);

  // la letra elegida (musical): la del servidor, o la que se acaba de tocar
  const [elegidaAqui, setElegidaAqui] = useState(null);
  const opciones = leido.letras?.opciones?.length || 0;
  const elegida = elegidaAqui ?? leido.letras?.elegida ?? (opciones === 1 ? 1 : null);
  const faltaElegir = tipo === 'musical' && opciones > 1 && !elegida;
  useEffect(() => {
    // otras letras (un cambio): se vuelve a elegir
    if (leido.cambiando) setElegidaAqui(null);
  }, [leido.cambiando]);

  // lo que pidió el usuario: el del servidor (sobrevive a cerrar la pantalla) o el que se acaba de mandar
  const pedido = leido.pedido || ultimoPedido;
  const hay = Boolean(leido.guion) || Boolean(leido.letras);
  const enCambio = hay && Boolean(leido.cambiando || pedido);
  const listo = !escribiendo && leido.estado === 'listo' && hay && !leido.aprobado;
  // el saldo de kie (gratis, sin números a la vista). Si no alcanza, se vuelve a mirar cada 10 s:
  // apenas recargas, el botón se enciende solo.
  const [vigilarSaldo, setVigilarSaldo] = useState(false);
  const saldo = useSaldoKie(listo ? slug : null, { cadaMs: vigilarSaldo ? 10000 : undefined });
  const alcanza = saldo.datos?.kie?.alcanza;
  const noAlcanza = alcanza === false || sinSaldo;
  useEffect(() => setVigilarSaldo(noAlcanza), [noAlcanza]);
  useEffect(() => {
    if (alcanza === true && vigilarSaldo) setSinSaldo(false); // una consulta nueva dice que ya alcanza
  }, [saldo.datos]); // eslint-disable-line react-hooks/exhaustive-deps

  const seguirMirando = () => {
    vio.current = false;
    setLanzadoEn(Date.now());
    setSondear(true);
    invalidar(`guion:${slug}`);
    g.recargar();
  };

  const pedirCambio = async (pedidoNuevo) => {
    setEnviando(true);
    try {
      await apiNuevo.pedirCambios(slug, pedidoNuevo);
      setUltimoPedido(pedidoNuevo);
      setElegidaAqui(null);
      seguirMirando();
      return true;
    } catch (e) {
      const t = tipoDeFalla(e.datos?.error || e.message, { limite: e.datos?.limite });
      const nombre = mayuscula(motor.nombre);
      aviso({
        tipo: 'error',
        titulo:
          t === 'limite'
            ? `Tu plan de ${nombre} llegó a su límite de uso`
            : t === 'plan-sin-codex'
              ? 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso'
              : t === 'sin-sesion'
                ? `Falta tu sesión de ${nombre}`
                : 'No pude pedir el cambio',
        texto: t === 'limite' ? 'Se libera solo en unas horas. Tu pedido no se perdió: vuelve a enviarlo después.' : e.message,
        accion: t === 'sin-sesion' && motor.elegido ? { etiqueta: 'Iniciar sesión', alHacer: () => motor.iniciarSesion() } : undefined,
        duracion: 9000,
      });
      return false;
    } finally {
      setEnviando(false);
    }
  };

  /** Musical: elegir una letra. Queda en el servidor (si todavía no tiene la ruta, se manda al producir). */
  const elegirLetra = async (n) => {
    setElegidaAqui(n);
    try {
      await apiNuevo.elegirLetra(slug, n);
      invalidar(`guion:${slug}`);
    } catch (e) {
      if (e.estado !== 404) aviso({ tipo: 'error', titulo: 'No pude guardar la letra que elegiste', texto: e.message });
    }
  };

  /**
   * Lo que falló vuelve a correr en el mismo anuncio (el servidor sabe si fue el guion o un cambio, y sigue
   * desde donde quedó). Si el servidor no tiene esa ruta: el cambio se vuelve a pedir, o el guion se
   * escribe en un anuncio nuevo con los mismos ajustes.
   */
  const reintentar = async () => {
    setReintentando(true);
    try {
      try {
        await apiNuevo.reintentarGuion(slug);
        seguirMirando();
      } catch (e) {
        if (e.estado !== 404) throw e;
        if (pedido && hay) {
          await apiNuevo.pedirCambios(slug, pedido);
          seguirMirando();
        } else await onEscribirDeNuevo();
      }
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude volver a intentarlo', texto: e.message });
    } finally {
      setReintentando(false);
    }
  };

  const producir = async () => {
    setProduciendo(true);
    try {
      await apiNuevo.producir(slug, tipo === 'musical' && elegida ? { letra: elegida } : undefined);
      invalidar('anuncios');
      invalidar(`guion:${slug}`); // al volver aquí, ya dice "Ya se está produciendo"
      ir(rutas.produccion(slug));
    } catch (e) {
      if (e.estado === 402 || e.datos?.saldo === false || e.datos?.alcanza === false || /saldo/i.test(e.message)) setSinSaldo(true);
      else aviso({ tipo: 'error', titulo: 'No pude arrancar la producción', texto: e.message, duracion: 9000 });
    } finally {
      setProduciendo(false);
    }
  };

  // ---- lo que va en la hoja: el avance, la falla o el guion
  let encima = null;
  const falla = sinRuta ? g.error : leido.estado === 'error' && !escribiendo ? leido.error : null;
  const queEs = tipo === 'musical' ? 'las letras' : tipo === 'historia' ? 'la historia' : 'el guion';
  const cargando = leido.estado === 'cargando' && !sinRuta;
  if (cargando) {
    encima = (
      <div className="nv-guion__vivo" aria-busy="true" aria-label="Cargando">
        <Esqueleto forma="texto" lineas={4} />
      </div>
    );
  } else if (escribiendo) {
    encima = (
      <div className="nv-guion__vivo">
        <Progreso
          titulo={`${mayuscula(motor.nombre)} ${enCambio ? 'está haciendo tu cambio' : tipo === 'musical' ? 'está escribiendo tus letras' : tipo === 'historia' ? 'está escribiendo tu historia' : 'está escribiendo tu guion'}`}
          frases={leido.progreso}
          inicio={leido.inicio}
          suele={enCambio ? 'un cambio tarda unos minutos' : sueleDe(motor.id, tipo)}
          nota={
            enCambio && pedido ? (
              <>
                Tu pedido: <q>{pedido}</q>
              </>
            ) : (
              `Puedes salir de esta pantalla: ${queEs === 'las letras' ? 'las letras se siguen escribiendo y las encuentras' : `${queEs} se sigue escribiendo y lo encuentras`} en Mis anuncios.`
            )
          }
        />
      </div>
    );
  } else if (falla) {
    encima = (
      <div className={`nv-guion__falla${hay ? '' : ' nv-guion__falla--sola'}`}>
        <TarjetaFalla
          error={falla}
          limite={leido.limite}
          reinicio={leido.reinicio}
          que={enCambio ? 'el cambio' : queEs}
          motor={motor}
          onReintentar={reintentar}
          reintentando={reintentando}
          onVolver={onVolverAlProducto}
        />
      </div>
    );
  }

  const mostrarHoja = !(escribiendo && !enCambio);
  const continuidad = Boolean(leido.brief?.continuidad ?? ajuste?.continuidad);
  const lateral = useLateralPegado();
  return (
    <div className="nv-guion nv-aparece">
      {leido.plan && mostrarHoja ? <PlanDelPedido plan={leido.plan} /> : null}
      {tipo === 'musical' ? (
        <HojaLetras
          estilo={estilo}
          letras={mostrarHoja ? leido.letras : null}
          encima={encima}
          cambiando={escribiendo && enCambio}
          elegida={elegida}
          onElegir={elegirLetra}
          puedeElegir={listo}
        />
      ) : tipo === 'historia' ? (
        <HojaHistoria estilo={estilo} ajuste={ajuste} guion={mostrarHoja ? leido.guion : null} encima={encima} cambiando={escribiendo && enCambio} />
      ) : (
        <HojaGuion estilo={estilo} ajuste={ajuste} guion={mostrarHoja ? leido.guion : null} encima={encima} cambiando={escribiendo && enCambio} continuidad={continuidad} />
      )}
      <aside className="nv-guion__lado" ref={lateral}>
        {leido.aprobado || cargando ? null : (
          <Tarjeta relleno="compacto">
            <PedirCambios estilo={estilo} activo={listo} enviando={enviando} onPedir={pedirCambio} aprobado={leido.aprobado} terminado={leido.terminado} />
          </Tarjeta>
        )}
        <Producir
          estilo={estilo}
          ajuste={ajuste}
          slug={slug}
          listo={listo && leido.puedeAprobar && !enviando}
          aprobado={leido.aprobado}
          terminado={leido.terminado}
          piezas={leido.piezas}
          produciendo={produciendo}
          sinSaldo={noAlcanza}
          bloqueado={alcanza === false}
          faltaElegir={faltaElegir}
          continuidad={continuidad}
          firmaCosto={tipo === 'musical' ? elegida || '' : ''}
          alCambiarModelo={saldo.recargar}
          onProducir={producir}
        />
        {!leido.aprobado && !escribiendo && !sinRuta && (listo || falla) ? (
          <div className="nv-guion__descartar">
            <BotonDescartar slug={slug} titulo={leido.guion?.titulo || leido.letras?.titulo || `tu anuncio ${estilo.nombre}`} texto="Descartar este anuncio" alDescartar={() => ir(rutas.tablero())} />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- antes de escribir

function Escribir({ estilos, ajustes, creando, sinProducto, motor, onEscribir, onVolverAlProducto }) {
  const n = estilos.length;
  const sinVoz = estilos.filter((e) => DETALLES[e.clave]?.voz === 'narrador' && !ajustes[e.clave]?.voz);
  const faltan = estilos.map((e) => ({ e, p: faltaDe(e.clave, ajustes[e.clave]?.preguntas) })).filter((x) => x.p);
  // "Yo digo cuánto" con el campo vacío o con algo que no se entiende ("45": ¿segundos o minutos?)
  const largos = estilos
    .filter((e) => conDuracion(e.clave))
    .map((e) => ({ e, d: duracionDeAjuste(ajustes[e.clave]?.duracion) }))
    .filter((x) => x.d.decide === 'usuario' && !x.d.segundos);
  const puede = !sinProducto && !sinVoz.length && !faltan.length && !largos.length && !motor.falta;

  if (motor.falta) {
    return (
      <Tarjeta variante="contorno" relleno="amplio">
        <AvisoMotor motor={motor} para="escribir tu guion" />
      </Tarjeta>
    );
  }

  const falta = faltan[0];
  const largo = largos[0];
  return (
    <Tarjeta variante="contorno" relleno="amplio" className="nv-escribir">
      <div className="nv-escribir__sellos" aria-hidden="true">
        {estilos.slice(0, 4).map((e, i) => (
          <SelloEstilo key={e.clave} clave={e.clave} familia={e.familia} tamano="grande" style={{ '--i': i }} />
        ))}
      </div>
      <div className="nv-escribir__textos">
        <h3 className="nv-escribir__titulo">{n === 1 ? `Listo para escribir el guion de ${estilos[0].nombre}` : `Listo para escribir ${n} guiones`}</h3>
        <p className="nv-escribir__texto">
          {sinProducto
            ? 'Primero cuéntame tu producto: sin su ficha no hay guion.'
            : sinVoz.length
              ? `Elige arriba la voz del narrador${n > 1 ? ` de ${sinVoz.map((e) => e.nombre).join(' y ')}` : ''} y lo escribo.`
              : falta
                ? `Falta un dato${n > 1 ? ` en ${falta.e.nombre}` : ''}: «${falta.p.texto}». ${falta.p.escribir ? 'Escríbelo arriba' : 'Complétalo arriba'} y lo escribo.`
                : largo
                  ? largo.d.texto.trim()
                    ? `Revisa la duración${n > 1 ? ` de ${largo.e.nombre}` : ''}. ${largo.d.motivo}`
                    : `Escribe arriba cuánto quieres que dure${n > 1 ? ` ${largo.e.nombre}` : ''} (por ejemplo, 45 s o 2 minutos) o deja que decida la IA.`
                  : `Con la ficha de tu producto y lo que elegiste arriba, con ${queDiceElGuion(estilos[0].clave)}. Después lo lees y pides cambios.`}
        </p>
      </div>
      {sinProducto ? (
        <Boton variante="primario" tamano="grande" onClick={onVolverAlProducto}>
          Ir a tu producto
        </Boton>
      ) : (
        <Boton variante="primario" tamano="grande" icono={Sparkles} cargando={creando} disabled={!puede} onClick={() => onEscribir()}>
          Escribir {n === 1 ? 'el guion' : 'los guiones'}
        </Boton>
      )}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------- el brief de las pestañas cerradas

/**
 * Lee una vez el brief de un anuncio ya creado cuya pestaña no está abierta (la abierta lo lee en GuionVivo): así su
 * pestaña y su tarjeta de ajustes dicen la duración y la voz que se eligieron, también en un navegador que no los guardó.
 */
function LeerBrief({ slug, onBrief }) {
  const { datos } = useGuion(slug);
  const brief = leerGuion(datos).brief;
  useEffect(() => {
    if (brief) onBrief?.(brief);
  }, [Boolean(brief)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ---------------------------------------------------------------- la sección

export function Guiones({ id, estilos, ajustes, anuncios, creando, sinProducto, motor, onEscribir, onVolverAlProducto, onBrief, enfoque = null }) {
  const [activa, setActiva] = useState(enfoque?.clave && estilos.some((e) => e.clave === enfoque.clave) ? enfoque.clave : estilos[0]?.clave);
  useEffect(() => {
    if (!estilos.some((e) => e.clave === activa)) setActiva(estilos[0]?.clave);
  }, [estilos, activa]);
  // un enlace al guion de un anuncio (la barra lateral, Te necesitan): su pestaña queda elegida
  useEffect(() => {
    if (enfoque?.clave && estilos.some((e) => e.clave === enfoque.clave)) setActiva(enfoque.clave);
  }, [enfoque]); // eslint-disable-line react-hooks/exhaustive-deps

  const conGuion = estilos.filter((e) => anuncios[e.clave]);
  const sinGuion = estilos.filter((e) => !anuncios[e.clave]);
  const n = estilos.length;
  const soloCantados = estilos.every((e) => tipoDeHoja(e.clave) !== 'guion');
  const suele = sueleDe(motor.id, n === 1 ? tipoDeHoja(estilos[0].clave) : 'guion');

  return (
    <Seccion
      id={id}
      titulo={conGuion.length ? (n === 1 ? 'Lee tu guion' : 'Lee tus guiones') : n === 1 ? 'Tu guion' : 'Tus guiones'}
      icono={FileText}
      contador={n > 1 ? n : undefined}
      descripcion={
        conGuion.length
          ? soloCantados
            ? 'Lees solo lo que se canta: lo demás lo arma la app por dentro. Pide los cambios que quieras y, cuando te guste, se produce solo hasta el video.'
            : 'Lees solo lo que se dice: lo demás lo arma la app por dentro. Pide los cambios que quieras y, cuando te guste, se produce solo hasta el video.'
          : `${mayuscula(motor.nombre)} ${n === 1 ? 'lo escribe' : 'los escribe'} con tu cuenta y la ficha de tu producto. ${suele.charAt(0).toUpperCase()}${suele.slice(1)}.`
      }
      className="nv-guiones"
    >
      {!conGuion.length ? (
        <Escribir
          estilos={estilos}
          ajustes={ajustes}
          creando={creando}
          sinProducto={sinProducto}
          motor={motor}
          onEscribir={onEscribir}
          onVolverAlProducto={onVolverAlProducto}
        />
      ) : (
        <div className="pila" style={{ '--hueco': '20px' }}>
          {n > 1 ? (
            <Pestanas
              etiqueta="Guiones"
              activa={activa}
              onCambio={setActiva}
              items={estilos.map((e) => ({ id: e.clave, etiqueta: etiquetaPestana(e, ajustes[e.clave]) }))}
            />
          ) : null}
          {n > 1
            ? estilos
                .filter((e) => anuncios[e.clave] && e.clave !== activa)
                .map((e) => <LeerBrief key={anuncios[e.clave]} slug={anuncios[e.clave]} onBrief={(b) => onBrief?.(e.clave, b)} />)
            : null}
          {estilos
            .filter((e) => n === 1 || e.clave === activa)
            .map((e) =>
              anuncios[e.clave] ? (
                <GuionVivo
                  key={anuncios[e.clave]}
                  estilo={e}
                  ajuste={ajustes[e.clave]}
                  slug={anuncios[e.clave]}
                  motor={motor}
                  onEscribirDeNuevo={() => onEscribir(e.clave)}
                  onVolverAlProducto={onVolverAlProducto}
                  onBrief={(b) => onBrief?.(e.clave, b)}
                />
              ) : (
                <Escribir
                  key={e.clave}
                  estilos={sinGuion.filter((x) => x.clave === e.clave)}
                  ajustes={ajustes}
                  creando={creando}
                  sinProducto={sinProducto}
                  motor={motor}
                  onEscribir={() => onEscribir(e.clave)}
                  onVolverAlProducto={onVolverAlProducto}
                />
              )
            )}
        </div>
      )}
    </Seccion>
  );
}
