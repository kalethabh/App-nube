// PRODUCCIÓN DE UN ANUNCIO (#/anuncio/:slug/produccion)
//
// EN VIVO: si el anuncio lo produce la app, tiene conductor (temp/<slug>/app/conductor.json). Se lee
// GET /api/anuncios/:slug/conductor cada 2 s y el detalle del anuncio (las piezas) cada 3 a 5 s:
//   - la línea de etapas sale de los pasos del conductor (agrupados en etapas, ver src/datos/produccion.js)
//   - cada pieza se pone verde cuando existe su archivo; la que la IA mandó rehacer queda en ámbar
//   - el registro cuenta los pasos en frases simples (./vivo.js)
//   - si un paso falla: una tarjeta con lo que pasó y "Continuar" (reintenta; lo ya hecho no se paga)
//   - si el saldo de kie no alcanza: "Tu saldo de kie no alcanza: recarga para seguir", sin números
//   - si se fue internet: "Esperando la conexión" (sigue sola al volver, o con "Continuar")
//   - en modo prueba: la banda "Modo prueba: no se gasta nada"
//   - los cantados: su única pausa, "Elige la versión de tu canción" (useCancionEnVivo). Antes de que se escriban
//     las escenas todavía no hay manifiesto: se ve la línea de pasos y, cuando toca, la elección (SinEscenas)
//   - nada se decide a mano: la app rehace sola lo que sale mal (con su tope) y lo que quedó va al informe
//   - al terminar, lleva sola a la Entrega
//
// Las carpetas hechas desde la terminal (sin conductor) se ven con su estado real, según sus archivos.
//
// SIMULACIÓN (Vista previa del diseño), SOLO si se pide: ?simular=1 sobre un anuncio ya terminado recorre
// sus piezas reales como si llegaran desde kie. No pide nada a nadie.
//   ?simular=1&vista=revision   abre directo la revisión de clips (estilos hablados), con todos los clips ya llegados
//   ?simular=1&decision=<tipo>  revision · cancion · toma (ver src/datos/ejemplo.js)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eye, Film, ListChecks, Pause, PencilLine, Play, RotateCcw, SearchX, Settings, SkipForward, Unplug } from 'lucide-react';
import {
  BarraDeProgreso,
  Boton,
  CabeceraPagina,
  Esqueleto,
  EstadoVacio,
  Pestanas,
  VistaPrevia,
  useAvisos,
  useBarraSuperior,
} from '../../componentes/index.js';
import { invalidar, useAnuncio, useAnuncios } from '../../datos/api.js';
import { enlace, enlaceDelGuion, ir, rutas } from '../../datos/rutas.js';
import { enMinuscula, plural } from '../../datos/formato.js';
import { TEXTO_ALTO, TEXTO_GUION, altoDe, avanceDeConductor, continuarProduccion, etapasDeConductor, frenoPorElGuion, pasoActual, sinEscenasAun, textoDeFila, textoDePaso, tieneConductor, useConductor } from '../../datos/produccion.js';
import { decisionesProduccion } from '../../datos/ejemplo.js';
import { useProduccion } from './datos.js';
import { clipsParaRevisar, construirModelo, etapasDe, quien, registroReal } from './modelo.js';
import { POST, estadoEn, finDePiezas, planificar, registroSimulado, useReloj } from './simulacion.js';
import { frasesConductor, registroConductor, vistaConductor } from './vivo.js';
import { ElegirCancion, useCancionEnVivo } from './ElegirCancion.jsx';
import { Etapas, Mando } from './Mando.jsx';
import { Cuadricula } from './Cuadricula.jsx';
import { Audio, Registro, TeNecesita } from './Lateral.jsx';
import { PanelPieza } from './PanelPieza.jsx';
import { MiniaturasAlDia } from './Pieza.jsx';
import { Revision } from './Revision.jsx';
import { BandaModoPrueba } from './ModoPrueba.jsx';
import './produccion.css';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);
const conPunto = (s) => (/[.!?…]$/.test(String(s).trim()) ? String(s).trim() : `${String(s).trim()}.`);

// ---------------------------------------------------------------- el estado real sin conductor (carpetas de la terminal)

function vistaReal(a, modelo) {
  const estados = new Map(modelo.piezas.map((p) => [p.id, { estado: p.estado, nota: null }]));
  const enProduccion = a.estado !== 'listo';
  if (enProduccion) {
    // lo próximo que puede salir (ya está lo que necesita) se muestra generándose: hasta 3 de cada clase
    const cupo = { imagen: 3, clip: 3 };
    for (const p of [...modelo.piezas].sort((x, y) => x.prioridad - y.prioridad)) {
      if (p.url || !cupo[p.clase]) continue;
      if (!p.depende.every((d) => modelo.porId.get(d)?.url)) continue;
      estados.set(p.id, { estado: 'generando', nota: null });
      cupo[p.clase]--;
    }
  }
  const conteo = { imagenes: 0, clips: 0, generandoImg: 0, generandoClip: 0, arreglados: 0, necesitan: 0 };
  let ultimo = null;
  for (const p of modelo.piezas) {
    const e = estados.get(p.id).estado;
    if (TERMINADA.has(e)) {
      conteo[p.clase === 'imagen' ? 'imagenes' : 'clips']++;
      if (e === 'arreglado') conteo.arreglados++;
      if (e === 'te-necesita') conteo.necesitan++;
      if (p.fecha && (!ultimo || p.fecha > ultimo.fecha)) ultimo = { id: p.id, fecha: p.fecha };
    } else if (e === 'generando') conteo[p.clase === 'imagen' ? 'generandoImg' : 'generandoClip']++;
  }
  const todasImg = modelo.imagenes.every((p) => p.url);
  const todosClips = modelo.clips.every((p) => p.url);
  const hayClips = modelo.clips.some((p) => p.url);
  const etapa = enProduccion
    ? {
        voz: a.audio?.voz || a.audio?.cancion || modelo.hojas.some((h) => h.url) || modelo.imagenes.some((p) => p.url) ? 'hecha' : 'en-marcha',
        imagenes: todasImg ? 'hecha' : modelo.imagenes.some((p) => p.url) || a.etapa === 'imagenes' ? 'en-marcha' : 'pendiente',
        videos: todosClips ? 'hecha' : hayClips || a.etapa === 'videos' ? 'en-marcha' : 'pendiente',
        revision: 'pendiente',
        montaje: a.tienePlan ? 'en-marcha' : 'pendiente',
        render: 'pendiente',
        control: 'pendiente',
      }
    : { voz: 'hecha', imagenes: 'hecha', videos: 'hecha', revision: 'hecha', montaje: 'hecha', render: 'hecha', control: 'hecha' };
  // lo que falta, estimado: 10 a la vez, ~1,5 min por imagen y ~1,3 por clip, y después montaje y render
  const faltanImg = modelo.imagenes.filter((p) => !p.url).length;
  const faltanClips = modelo.clips.filter((p) => !p.url).length;
  const falta = Math.ceil(faltanImg / 10) * 90 + Math.ceil(faltanClips / 10) * 80 + POST.revision + POST.montaje + POST.render + POST.control;
  return {
    estados,
    conteo,
    etapa,
    ultimo,
    terminado: !enProduccion,
    esperandoTu: false,
    necesita: conteo.necesitan > 0,
    falta,
    total: falta,
    vozLista: true,
    musicaLista: true,
  };
}

/** El avance en una frase y su detalle (simulación y carpetas sin conductor). */
function frases(a, modelo, v, simulando, esperaCancion) {
  const n = modelo.clips.length;
  if (esperaCancion)
    return {
      frase: 'Te toca elegir la canción',
      detalle: `Hice dos versiones con la misma letra. Las imágenes empiezan apenas elijas una; la voz y las hojas no la necesitan.`,
    };
  const ni = modelo.imagenes.length;
  const enCamino = v.conteo.generandoImg + v.conteo.generandoClip;
  const e = v.etapa;
  if (v.terminado)
    return {
      frase: simulando ? '¡Listo! Tu anuncio está terminado' : 'Tu anuncio está terminado',
      detalle: `${plural(ni, 'imagen', 'imágenes')} y ${plural(n, 'clip', 'clips')}${v.conteo.arreglados ? `; ${v.conteo.arreglados === 1 ? 'una se arregló sola' : `${v.conteo.arreglados} se arreglaron solas`}` : ''}. La versión completa ya está en Entrega.`,
    };
  if (v.esperandoTu) {
    if (modelo.hablado && e.videos === 'hecha')
      return { frase: 'Te toca revisar los clips', detalle: `Llegaron los ${clipsParaRevisar(modelo).length} clips hablados. Escúchalos antes del montaje: es lo único que espera.` };
    const p = v.defecto ? modelo.porId.get(v.defecto) : modelo.piezas.find((x) => v.estados.get(x.id)?.estado === 'te-necesita');
    return {
      frase: `${p ? quien(p).replace(/ \(.*\)$/, '') : 'Una pieza'} te necesita`,
      detalle: `Solo esa toma espera tu decisión; lo demás sigue. ${v.conteo.clips} de ${n} clips listos.`,
    };
  }
  const pendiente = v.necesita && v.defecto ? modelo.porId.get(v.defecto) : null;
  const aviso = pendiente ? ` · La ${quien(pendiente).replace(/ \(.*\)$/, '').toLowerCase()} espera tu decisión` : '';
  const resto = [`${v.conteo.clips} de ${n} clips listos`, enCamino ? `${enCamino} en camino` : null, ni ? `${v.conteo.imagenes} de ${ni} imágenes` : null].filter(Boolean).join(' · ');
  if (e.control === 'en-marcha') return { frase: 'Último control', detalle: 'Se busca cualquier cuadro negro, congelado o corte de sonido antes de entregártelo.' };
  if (e.render === 'en-marcha') return { frase: 'Renderizando la versión completa', detalle: 'Tu PC arma el video completo. Las otras versiones las sacas después desde el editor.' };
  if (e.montaje === 'en-marcha') return { frase: 'Armando el montaje', detalle: 'Transiciones, subtítulos y música sobre los tiempos reales de la voz.' };
  if (e.revision === 'en-marcha') return { frase: 'Revisando los clips', detalle: `La IA mira cada clip: duración, cuadros negros, congelados y voces coladas.` };
  if (e.videos === 'en-marcha') return { frase: 'Generando los clips', detalle: resto + aviso };
  if (e.imagenes === 'en-marcha')
    return {
      frase: 'Generando las imágenes',
      detalle: `${v.conteo.imagenes} de ${ni} imágenes listas${enCamino ? ` · ${enCamino} en camino` : ''}. Cada una se revisa al llegar y su clip sale en ese momento.${aviso}`,
    };
  if (modelo.cantado) return { frase: 'Preparando las hojas', detalle: 'Tu canción ya está: primero salen las hojas de los personajes.' };
  if (modelo.hablado) return { frase: 'Preparando los personajes', detalle: 'Primero sale la hoja de cada personaje; de ella salen todos los clips.' };
  return { frase: 'Grabando la voz y preparando las hojas', detalle: 'La voz, la música y las hojas de referencia van a la vez, antes que todo lo demás.' };
}

function avanceDe(modelo, v) {
  if (typeof v.avance === 'number') return v.avance; // con conductor: sale de sus pasos
  const total = modelo.piezas.length || 1;
  const hechas = v.conteo.imagenes + v.conteo.clips;
  const post = ['revision', 'montaje', 'render', 'control'].filter((k) => v.etapa[k] === 'hecha').length;
  return v.terminado ? 1 : Math.min(0.99, (hechas / total) * 0.82 + post * 0.045);
}

// ---------------------------------------------------------------- la pantalla

export default function Produccion({ params, consulta }) {
  const { slug } = params;
  const { aviso } = useAvisos();
  const pideSimulacion = consulta?.get('simular') === '1';

  // ---------------------------------------------------------------- el conductor (null si no tiene)
  // La lista dice si el anuncio es de la app (estado produciendo / error): solo esos tienen conductor,
  // así las carpetas de la terminal no piden nada que no existe. Mientras el guion espera su "Sí", la
  // lista se mira cada 3 s para ver arrancar la producción.
  const [mirarLista, setMirarLista] = useState(false);
  const { datos: lista, error: errorLista, alDia: listaAlDia } = useAnuncios(mirarLista ? { cadaMs: 3000 } : undefined);
  const enLista = lista?.anuncios?.find((x) => x.slug === slug) || null;
  useEffect(() => setMirarLista(enLista?.estado === 'guion'), [enLista?.estado]);
  // (uno de la app ya terminado también: su conductor dice qué rehizo la revisión; se pide una vez, sin mirar cada 2 s)
  const pedirConductor = !pideSimulacion && (tieneConductor(enLista) || Boolean(enLista?.nuevo && !enLista?.enGuion));
  const [conductorCerrado, setConductorCerrado] = useState(false);
  const {
    datos: conductor,
    cargando: cargandoConductor,
    recargar: recargarConductor,
    leido: conductorLeido,
  } = useConductor(pedirConductor ? slug : null, { cadaMs: pedirConductor && !conductorCerrado ? 2000 : undefined });
  const enVivo = pedirConductor && Boolean(conductor);
  const corriendo = enVivo && conductor.estado !== 'listo';
  // los cantados: la canción lista espera que elijas la versión (la única pausa de su producción)
  const cancionEnVivo = useCancionEnVivo(enVivo ? slug : null, enVivo ? conductor : null, { aviso, alCambiar: () => recargarConductor() });
  // deja de mirar cuando terminó ("Continuar" lo vuelve a abrir)
  useEffect(() => {
    if (conductor) setConductorCerrado(conductor.estado === 'listo');
  }, [conductor]);

  // ---------------------------------------------------------------- el anuncio y sus piezas
  const [vieja, setVieja] = useState(false); // carpeta de la terminal todavía sin terminar
  const msDetalle = corriendo ? (['imagenes-y-videos', 'revision-imagenes'].includes(conductor.paso) ? 3000 : 5000) : vieja ? 8000 : undefined;
  // El detalle se pide recién cuando se sabe qué es: la lista dice si es de la app y, si lo es, se espera a su conductor.
  // Un cantado antes de sus escenas todavía no tiene manifiesto: su detalle no existe (pedirlo da 404 en la consola).
  // (si la lista guardada no lo trae, puede ser de antes de crearlo: se espera la que se está leyendo)
  const listaSirve = Boolean(errorLista) || (Boolean(lista) && (Boolean(enLista) || listaAlDia));
  const seSabeQueEs = pideSimulacion || (listaSirve && (!pedirConductor || conductorLeido));
  const sinEscenas = !pideSimulacion && sinEscenasAun(enLista, enVivo ? conductor : null);
  const { datos: a, error, recargar, alDia } = useAnuncio(seSabeQueEs && !sinEscenas ? slug : null, { cadaMs: msDetalle });
  // lo extra de la producción se pide recién cuando se sabe que el anuncio existe
  const { datos: extras, error: errorExtras, recargar: recargarExtras } = useProduccion(a ? slug : null, { cadaMs: corriendo ? 10000 : vieja ? 15000 : undefined });
  useEffect(() => {
    if (a) setVieja(!conductor && a.estado !== 'listo' && a.estado !== 'guion');
  }, [a, conductor]);

  // cada vez que el conductor cambia de paso, las piezas se miran enseguida
  const firmaPasos = conductor ? `${conductor.paso}|${conductor.estado}|${conductor.pasos.map((p) => p.estado).join(',')}` : '';
  useEffect(() => {
    if (!firmaPasos) return;
    recargar();
    recargarExtras();
  }, [firmaPasos]); // eslint-disable-line react-hooks/exhaustive-deps

  // al terminar mientras miras, te lleva a la entrega
  const estadoPrevio = useRef(null);
  useEffect(() => {
    const e = conductor?.estado || null;
    const antes = estadoPrevio.current;
    estadoPrevio.current = e;
    if (pideSimulacion || !e || !antes || antes === 'listo' || e !== 'listo') return undefined;
    invalidar('anuncios');
    invalidar(`anuncio:${slug}`);
    invalidar(`entrega:${slug}`);
    aviso({ tipo: 'ok', titulo: '¡Tu anuncio está listo!', texto: 'Te llevo a la entrega: ahí están las versiones y el informe.' });
    const id = setTimeout(() => ir(rutas.anuncio(slug)), 2200);
    return () => clearTimeout(id);
  }, [conductor?.estado]); // eslint-disable-line react-hooks/exhaustive-deps

  useBarraSuperior({
    migas: [{ texto: 'Mis anuncios', href: enlace.tablero() }, { texto: a?.titulo || enLista?.titulo || '…', href: enlace.anuncio(slug) }, { texto: 'Producción' }],
  });

  // ---------------------------------------------------------------- continuar (reintentar el paso que falló)
  const [continuando, setContinuando] = useState(false);
  const continuar = async () => {
    setContinuando(true);
    try {
      await continuarProduccion(slug);
      aviso({ tipo: 'info', titulo: 'Sigue desde donde quedó', texto: 'Lo que ya estaba hecho no se vuelve a pagar.' });
      setConductorCerrado(false);
      await recargarConductor();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude continuar', texto: e.message });
    } finally {
      setContinuando(false);
    }
  };

  // ---------------------------------------------------------------- el modelo (las piezas toma por toma)
  const listos = Boolean(a && (extras || errorExtras));
  // lo que la revisión de la IA mandó rehacer: la clave evita rearmar todo en cada lectura del conductor
  const claveRehechos = JSON.stringify(enVivo ? conductor.rehechos || {} : {});
  const rehechos = useMemo(() => JSON.parse(claveRehechos), [claveRehechos]);
  // Ningún precio en esta pantalla: el costo del anuncio se ve solo en el informe de la entrega.
  const modelo = useMemo(() => (listos ? construirModelo(a, extras, { rehechos }) : null), [listos, a, extras, rehechos]);
  const etapasViejas = useMemo(() => (modelo ? etapasDe(a, modelo) : []), [a, modelo]);

  // ---------------------------------------------------------------- simulación (solo con ?simular=1)
  const decision = pideSimulacion ? consulta?.get('decision') || (consulta?.get('vista') === 'revision' ? 'revision' : null) : null;
  const ejemploToma = decision === 'toma' ? decisionesProduccion.toma : null;
  const ejemploCancion = decision === 'cancion' && modelo?.cantado ? decisionesProduccion.cancion : null;
  const plan = useMemo(
    () => (pideSimulacion && modelo && a.estado === 'listo' ? planificar(modelo, ejemploToma ? { defecto: ejemploToma.pieza, problema: ejemploToma.problema } : undefined) : null),
    [pideSimulacion, modelo, a?.estado, ejemploToma]
  );
  const [modo, setModo] = useState(null);
  const [vistaActiva, setVistaActiva] = useState(() => (decision === 'revision' ? 'revision' : 'piezas'));
  useEffect(() => {
    if (!a || modo) return;
    setModo(pideSimulacion && a.estado === 'listo' ? 'simulacion' : 'real');
  }, [a, modo, pideSimulacion]);
  // si cambia el enlace sin salir de la pantalla (se pone o se quita ?simular=1), también se aplica
  const pidioAntes = useRef(pideSimulacion);
  useEffect(() => {
    if (pidioAntes.current === pideSimulacion) return;
    pidioAntes.current = pideSimulacion;
    setModo(pideSimulacion && a?.estado === 'listo' ? 'simulacion' : 'real');
  }, [pideSimulacion, a?.estado]);
  const simulando = modo === 'simulacion' && Boolean(plan);

  const [rapido, setRapido] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [decisiones, setDecisiones] = useState({ defecto: null, aprobada: null });
  const factorBase = plan ? Math.max(6, Math.min(30, Math.max(plan.finClips, plan.finImagenes) / 42)) : 10;
  const [tope, setTope] = useState(Infinity);
  // la canción (cantados): mientras no eliges, la simulación espera al principio
  const [cancion, setCancion] = useState({ elegida: null, abierta: false });
  const esperaCancion = Boolean(simulando && ejemploCancion && cancion.elegida === null);
  const [t, reloj] = useReloj({ activo: simulando, factor: factorBase * (rapido ? 3 : 1), pausado, hasta: esperaCancion ? 0 : tope });

  const v = useMemo(() => {
    if (!modelo) return null;
    if (simulando) return estadoEn(modelo, plan, t, decisiones);
    if (enVivo) return vistaConductor(a, modelo, conductor);
    return vistaReal(a, modelo);
  }, [modelo, simulando, plan, t, decisiones, a, enVivo, conductor]);

  // la simulación se detiene sola al terminar
  useEffect(() => {
    if (simulando && v?.terminado && tope === Infinity) setTope(t);
  }, [simulando, v?.terminado, t, tope]);

  const repetir = () => {
    setDecisiones({ defecto: null, aprobada: null });
    setTope(Infinity);
    setPausado(false);
    setSeleccion(null);
    reloj.reiniciar();
    setModo('simulacion');
    setVistaActiva('piezas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------------------------------------------------------------- panel de una pieza
  const [seleccion, setSeleccion] = useState(null);
  const orden = useMemo(
    () => (modelo ? [...modelo.hojas, ...modelo.tomas.flatMap((g) => [...g.flujo, ...g.broll]), ...modelo.sueltos].map((p) => p.id) : []),
    [modelo]
  );
  const abrir = useCallback((id) => setSeleccion((s) => (s === id ? null : id)), []);
  const irA = useCallback(
    (paso) =>
      setSeleccion((s) => {
        const i = orden.indexOf(s);
        return i === -1 ? s : orden[Math.max(0, Math.min(orden.length - 1, i + paso))];
      }),
    [orden]
  );
  // al llegar con ?decision=..., la simulación salta al momento de esa decisión (una vez por decisión)
  const saltoHecho = useRef(null);
  const fijarReloj = reloj.fijar;
  useEffect(() => {
    if (!simulando || !plan || !decision || saltoHecho.current === decision) return;
    saltoHecho.current = decision;
    if (decision === 'revision' && modelo.hablado) {
      fijarReloj(finDePiezas(modelo, plan) + 0.5);
      setVistaActiva('revision');
    } else if (decision === 'toma' && plan.defecto) {
      fijarReloj((plan.tiempos.get(plan.defecto)?.fin || 0) + 0.5);
      setSeleccion(plan.defecto);
    } else if (decision === 'cancion' && ejemploCancion) {
      fijarReloj(0);
      setCancion({ elegida: null, abierta: true });
    }
  }, [simulando, plan, decision, modelo, fijarReloj, ejemploCancion]);

  useEffect(() => {
    if (!seleccion) return;
    document.querySelector(`[data-pieza="${CSS.escape(seleccion)}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [seleccion]);

  // al abrir la revisión, el reproductor queda a la vista
  const hayDatos = Boolean(modelo && modo);
  const vistaPrevia = useRef(vistaActiva);
  useEffect(() => {
    const antes = vistaPrevia.current;
    vistaPrevia.current = vistaActiva;
    // al volver de la revisión, arriba (ahí se ve el montaje que arrancó)
    if (vistaActiva === 'piezas' && antes === 'revision') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (vistaActiva !== 'revision' || !hayDatos) return undefined;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('.prod-pestanas');
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [vistaActiva, hayDatos]);

  const decidirPieza = (id, decision) => {
    const p = modelo.porId.get(id);
    if (simulando && id === v.defecto) {
      setDecisiones((d) => ({ ...d, defecto: { decision, en: t } }));
      aviso(
        decision === 'bien'
          ? { tipo: 'ok', titulo: 'La dejaste así', texto: `${quien(p)} sigue y su clip sale ahora.` }
          : { tipo: 'info', titulo: 'Se rehace con el mismo guion', texto: 'Lo demás no espera. Vista previa: todavía no se pide nada a kie.' }
      );
      return;
    }
    aviso(
      decision === 'bien'
        ? { tipo: 'ok', titulo: 'Anotado', texto: `${quien(p)} queda como está.` }
        : { tipo: 'info', titulo: 'Vista previa del diseño', texto: `Aquí se pediría ${quien(p).toLowerCase()} de nuevo a kie con el mismo guion.` }
    );
  };

  // ---------------------------------------------------------------- render
  // el guion todavía se está escribiendo o espera tu aprobación: la producción no empezó
  const enGuion = !conductor && ((a && a.estado === 'guion') || (!a && enLista?.estado === 'guion'));
  if (enGuion) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          icono={PencilLine}
          tono="acento"
          titulo="Primero va el guion"
          descripcion="La producción empieza apenas apruebes el guion de este anuncio. Desde ahí todo es automático hasta los videos."
          acciones={
            <>
              <Boton variante="primario" iconoDerecha={ArrowRight} href={enlaceDelGuion(slug, a?.productoId || enLista?.productoId)}>
                Ver el guion
              </Boton>
              <Boton variante="secundario" href={enlace.tablero()}>
                Ir a Mis anuncios
              </Boton>
            </>
          }
        />
      </div>
    );
  }
  // un cantado antes de sus escenas: hay conductor pero todavía no hay manifiesto (la letra, la canción, elegirla)
  if (enVivo && !a && (sinEscenas || (error && error.estado !== 0))) {
    return <SinEscenas slug={slug} titulo={enLista?.titulo || 'Tu anuncio'} estilo={enLista?.estiloNombre} productoId={enLista?.productoId} conductor={conductor} cancion={cancionEnVivo} continuar={continuar} continuando={continuando} />;
  }
  // sin respuesta (no un 404): la ventana de la app se cerró. El anuncio no se perdió: sigue al volver a abrirla.
  const appCerrada = error?.estado === 0;
  if (error && !(appCerrada && a)) {
    return (
      <div className="pagina pagina--angosta">
        {appCerrada ? (
          <EstadoVacio
            icono={Unplug}
            tono="aviso"
            titulo="La app está cerrada"
            descripcion="Ábrela de nuevo: tu anuncio sigue donde quedó y no se paga dos veces."
            acciones={
              <Boton variante="secundario" icono={RotateCcw} onClick={recargar}>
                Volver a mirar
              </Boton>
            }
          />
        ) : (
          <EstadoVacio icono={SearchX} titulo="No encuentro este anuncio" descripcion={error.message} acciones={<Boton href={enlace.tablero()}>Ir a Mis anuncios</Boton>} />
        )}
      </div>
    );
  }
  if (!a || !modelo || !v || !modo || (pedirConductor && cargandoConductor && !conductor)) return <CargandoProduccion />;

  if (!modelo.piezas.length && !enVivo) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          icono={Film}
          titulo="Este anuncio todavía no tiene piezas"
          descripcion="Cuando el guion esté aprobado y des el “Sí”, aquí vas a ver llegar cada imagen y cada clip."
          acciones={
            <Boton variante="secundario" onClick={recargar}>
              Volver a mirar
            </Boton>
          }
        />
      </div>
    );
  }

  const { frase, detalle } = enVivo ? frasesConductor(conductor, modelo, v) : frases(a, modelo, v, simulando, esperaCancion);
  const avance = avanceDe(modelo, v);
  const etapas = v.etapas || etapasViejas;
  // (revisar los clips a mano es solo de la simulación: en un anuncio de verdad los revisan la transcripción y la IA)
  const hayRevision = simulando && modelo.hablado && clipsParaRevisar(modelo).length > 0;
  const registro = simulando ? registroSimulado(a, modelo, plan, v, decisiones) : enVivo ? registroConductor(conductor, a, modelo) : registroReal(a, modelo);
  const pieza = seleccion ? modelo.porId.get(seleccion) : null;
  const estadoSel = pieza ? v.estados.get(pieza.id) : null;
  const terminado = v.terminado && !simulando;
  const revisada = !enVivo || !conductor.pasos.some((p) => p.id === 'revision-imagenes' && !['hecho', 'saltado'].includes(p.estado));

  // las tarjetas de "Te necesita"
  const tarjetas = [];
  if (enVivo && v.alto?.tipo === 'cancion') {
    if (cancionEnVivo.tarjeta) tarjetas.push(cancionEnVivo.tarjeta);
  } else if (enVivo && v.alto) {
    const tipo = v.alto.tipo;
    const t0 = TEXTO_ALTO[tipo];
    const que = v.paso ? enMinuscula(textoDePaso(v.paso).haciendo) : null;
    const delGuion = frenoPorElGuion(v.alto);
    tarjetas.push({
      id: 'alto',
      icono: tipo,
      tono: tipo === 'conexion' || tipo === 'reintento' ? 'aviso' : undefined,
      sobre: tipo === 'conexion' || tipo === 'reintento' ? 'Esperando' : undefined,
      titulo: tipo === 'error' && que ? `Se trabó: ${que}` : t0.titulo,
      texto: tipo === 'saldo' ? t0.texto : `${v.alto.mensaje ? `${conPunto(v.alto.mensaje)} ` : ''}${delGuion ? TEXTO_GUION : t0.texto}`,
      accion: delGuion ? 'Ver el guion' : 'Continuar',
      iconoBoton: delGuion ? ArrowRight : RotateCcw,
      alHacer: delGuion ? () => ir(rutas.nuevo({ paso: '2', anuncios: slug, ...(a?.productoId ? { producto: a.productoId } : {}) })) : continuar,
      cargando: continuando,
      secundaria: tipo === 'saldo' ? { texto: 'Ver en Ajustes', href: enlace.ajustes(), icono: Settings } : undefined,
    });
  }
  if (esperaCancion) {
    tarjetas.push({
      id: 'cancion',
      icono: 'cancion',
      titulo: 'Elige la versión de tu canción',
      texto: `Hice dos versiones de «${ejemploCancion.titulo}». Escúchalas y quédate con una: solo esperan las imágenes.`,
      accion: 'Escuchar y elegir',
      iconoBoton: ArrowRight,
      alHacer: () => setCancion((c) => ({ ...c, abierta: true })),
    });
  }
  if (simulando && v.defecto && v.estados.get(v.defecto)?.estado === 'te-necesita') {
    const p = modelo.porId.get(v.defecto);
    const problema = plan.problema.charAt(0).toUpperCase() + plan.problema.slice(1);
    tarjetas.push({
      id: 'defecto',
      icono: 'imagen',
      titulo: `${quien(p).replace(/ \(.*\)$/, '')}: revisa la imagen`,
      texto: `${problema} y ya se repitió una vez. Solo esta toma espera.`,
      accion: 'Ver y decidir',
      iconoBoton: ArrowRight,
      alHacer: () => setSeleccion(p.id),
    });
  }
  if (hayRevision && (simulando ? v.esperandoTu && v.etapa.videos === 'hecha' : false) && vistaActiva !== 'revision') {
    tarjetas.push({
      id: 'revision',
      icono: 'revision',
      titulo: `Revisa los ${clipsParaRevisar(modelo).length} clips antes de montar`,
      texto: 'En los anuncios hablados escuchas cada clip con su frase del guion antes del primer render.',
      accion: 'Revisar clips',
      iconoBoton: ArrowRight,
      alHacer: () => setVistaActiva('revision'),
    });
  }
  for (const p of modelo.piezas) {
    if (simulando && p.id !== v.defecto && v.estados.get(p.id)?.estado === 'te-necesita')
      tarjetas.push({ id: p.id, titulo: `${quien(p)}: revisa este clip`, texto: 'Salió con el modelo de respaldo, que no genera el diálogo.', accion: 'Ver y decidir', iconoBoton: ArrowRight, alHacer: () => setSeleccion(p.id) });
  }

  const textoEstilo = [a.estiloNombre, a.continuidad ? 'con continuidad' : null].filter(Boolean).join(' ');
  const verEntrega = terminado || a.estado === 'listo';

  const pagina = (
    <div className={`pagina prod${pieza ? ' prod--con-panel' : ''}${appCerrada ? ' prod--cerrada' : ''}`}>
      {appCerrada ? (
        <div className="prod-cerrada" role="alert">
          <Unplug size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>
            <strong>La app está cerrada.</strong> Ábrela de nuevo: tu anuncio sigue donde quedó y no se paga dos veces. Lo de abajo es lo último que se vio.
          </span>
        </div>
      ) : null}
      <CabeceraPagina
        sobretitulo="Producción"
        titulo={a.titulo}
        descripcion={`${textoEstilo ? `${textoEstilo} · ` : ''}${plural(modelo.tomas.length, 'toma', 'tomas')} · ${plural(modelo.piezas.length, 'pieza', 'piezas')}. ${
          !simulando && terminado ? 'Así quedó cada pieza: toca una para verla en grande.' : 'No tienes que hacer nada: si algo te necesita, aparece aquí.'
        }`}
        acciones={
          verEntrega ? (
            <Boton variante="secundario" href={enlace.anuncio(slug)} icono={Eye}>
              Ver la entrega
            </Boton>
          ) : null
        }
      />

      {enVivo && conductor.modoPrueba ? <BandaModoPrueba /> : null}

      {simulando ? (
        <div className="prod-sim">
          <VistaPrevia variante="banda" texto="Simulación">
            Así se ve mientras se produce. Las piezas son las reales de este anuncio; el orden y los tiempos imitan cómo llegarían desde kie, acelerados. No se pide nada a kie.
          </VistaPrevia>
          <div className="prod-sim__controles">
            <Boton variante="fantasma" tamano="chico" soloIcono icono={pausado ? Play : Pause} etiqueta={pausado ? 'Seguir' : 'Pausar'} onClick={() => setPausado((x) => !x)} disabled={v.terminado} />
            <Boton variante="fantasma" tamano="chico" icono={RotateCcw} onClick={repetir}>
              Repetir
            </Boton>
            <Pestanas
              variante="segmentado"
              tamano="chico"
              etiqueta="Ritmo de la simulación"
              items={[
                { id: 'normal', etiqueta: 'Normal' },
                { id: 'rapido', etiqueta: 'Rápido' },
              ]}
              activa={rapido ? 'rapido' : 'normal'}
              onCambio={(id) => setRapido(id === 'rapido')}
            />
            <Boton variante="secundario" tamano="chico" icono={SkipForward} onClick={() => setModo('real')}>
              Ver cómo quedó
            </Boton>
          </div>
        </div>
      ) : null}

      <TeNecesita tarjetas={tarjetas} />

      <Mando
        a={a}
        modelo={modelo}
        v={v}
        etapas={etapas}
        simulando={simulando}
        frase={frase}
        detalle={detalle}
        avance={avance}
        enlaceEntrega={enlace.anuncio(slug)}
        compacto={vistaActiva === 'revision' && hayRevision}
      />

      {hayRevision ? (
        <Pestanas
          className="prod-pestanas"
          items={[
            { id: 'piezas', etiqueta: 'Piezas', contador: modelo.piezas.length },
            { id: 'revision', etiqueta: 'Revisión de clips', icono: ListChecks, contador: clipsParaRevisar(modelo).length },
          ]}
          activa={vistaActiva}
          onCambio={setVistaActiva}
          etiqueta="Vistas de la producción"
        />
      ) : null}

      {vistaActiva === 'revision' && hayRevision ? (
        <Revision
          a={a}
          modelo={modelo}
          estados={v.estados}
          simulando={simulando}
          aprobada={simulando ? decisiones.aprobada !== null : false}
          onAprobar={() => {
            if (simulando) setDecisiones((d) => ({ ...d, aprobada: Math.max(t, v.marcas?.videos?.fin || t) }));
            else aviso({ tipo: 'ok', titulo: 'Aprobado', texto: 'Vista previa del diseño: aquí empezaría el montaje.' });
            setVistaActiva('piezas');
          }}
          onVolver={() => setVistaActiva('piezas')}
        />
      ) : (
        <div className="prod-cuerpo">
          <div className="prod-cuerpo__principal">
            <Cuadricula modelo={modelo} estados={v.estados} seleccion={seleccion} onAbrir={abrir} />
          </div>
          <aside className="prod-cuerpo__lateral" aria-label="Lo que pasa en la producción">
            <Audio a={a} vozLista={v.vozLista} musicaLista={v.musicaLista} cantado={modelo.cantado} hablado={modelo.hablado} enVivo={enVivo && !terminado ? v : null} />
            <Registro entradas={registro} simulando={simulando} enVivo={enVivo && !terminado} tAhora={t} onAbrir={abrir} />
          </aside>
        </div>
      )}

      {pieza ? (
        <PanelPieza
          pieza={pieza}
          estado={estadoSel?.estado}
          nota={estadoSel?.nota}
          modelo={modelo}
          orden={orden}
          simulando={simulando}
          enVivo={enVivo}
          revisada={revisada}
          onCerrar={() => setSeleccion(null)}
          onIr={irA}
          onDecidir={decidirPieza}
          problema={simulando && pieza.id === plan?.defecto ? plan.problema : undefined}
        />
      ) : null}

      {cancionEnVivo.modal}

      {ejemploCancion ? (
        <ElegirCancion
          abierto={cancion.abierta}
          onCerrar={() => setCancion((c) => ({ ...c, abierta: false }))}
          titulo={ejemploCancion.titulo}
          versiones={ejemploCancion.versiones.map((x) => ({ ...x, url: `${a.base}/${x.archivo}` }))}
          elegida={cancion.elegida}
          onElegir={(i) => {
            setCancion({ elegida: i, abierta: false });
            aviso({ tipo: 'ok', titulo: `Elegiste la versión ${i + 1}`, texto: 'Arrancan las imágenes al ritmo de esa canción. Vista previa: no se cambió nada en tus archivos.' });
          }}
        />
      ) : null}
    </div>
  );
  // las miniaturas, recién con el detalle de ahora (ver MiniaturasAlDia en Pieza.jsx)
  return <MiniaturasAlDia.Provider value={alDia}>{pagina}</MiniaturasAlDia.Provider>;
}

/**
 * Un cantado antes de sus escenas: la letra, la canción y elegirla (el manifiesto se escribe recién con la versión
 * elegida). La línea de pasos, lo que se está haciendo y, cuando toca, "Elige la versión de tu canción".
 */
function SinEscenas({ slug, titulo, estilo, productoId, conductor: c, cancion, continuar, continuando }) {
  const alto = altoDe(c);
  const paso = pasoActual(c);
  const etapas = etapasDeConductor(c);
  const estados = Object.fromEntries(etapas.map((e) => [e.id, e.estado]));
  const detalles = Object.fromEntries(
    etapas.map((e) => [e.id, e.estado === 'error' ? (alto?.tipo === 'saldo' ? 'Falta saldo' : 'Se trabó') : e.estado === 'en-marcha' ? (alto?.tipo === 'cancion' ? 'Te toca elegir' : e.pasos.find((p) => p.estado === 'corriendo')?.nombre || 'En marcha') : null])
  );
  const t = textoDePaso(paso);
  const fila = c.estado === 'esperando' && !alto ? textoDeFila(c) : null;
  const frase = alto?.tipo === 'cancion' ? 'Te toca elegir la canción' : alto ? (TEXTO_ALTO[alto.tipo] || TEXTO_ALTO.error).titulo : fila || c.estado === 'esperando' ? 'Tu anuncio está en la fila' : t.haciendo;
  // (el porqué y el botón van en la tarjeta de arriba: aquí, dónde quedó)
  const detalle = alto?.tipo === 'cancion' ? t.detalle : alto ? `${paso ? `Quedó en: ${enMinuscula(t.haciendo)}. ` : ''}Lo que ya está hecho quedó guardado.` : fila || t.detalle;
  const t0 = TEXTO_ALTO[alto?.tipo] || TEXTO_ALTO.error;
  const delGuion = frenoPorElGuion(alto);
  const textoTarjeta = alto && alto.tipo !== 'saldo' && alto.mensaje ? `${conPunto(alto.mensaje)} ${delGuion ? TEXTO_GUION : t0.texto}` : t0.texto;
  const tarjetas = [];
  if (alto?.tipo === 'cancion') {
    if (cancion.tarjeta) tarjetas.push(cancion.tarjeta);
  } else if (alto && alto.tipo !== 'conexion' && alto.tipo !== 'reintento') {
    tarjetas.push({
      id: 'alto',
      icono: alto.tipo,
      titulo: (TEXTO_ALTO[alto.tipo] || TEXTO_ALTO.error).titulo,
      texto: textoTarjeta,
      accion: delGuion ? 'Ver el guion' : 'Continuar',
      iconoBoton: delGuion ? ArrowRight : RotateCcw,
      alHacer: delGuion ? () => ir(rutas.nuevo({ paso: '2', anuncios: slug, ...(productoId ? { producto: productoId } : {}) })) : continuar,
      cargando: continuando,
      secundaria: alto.tipo === 'saldo' ? { texto: 'Ver en Ajustes', href: enlace.ajustes(), icono: Settings } : undefined,
    });
  }
  return (
    <div className="pagina prod">
      <CabeceraPagina
        sobretitulo="Producción"
        titulo={titulo}
        descripcion={`${estilo ? `${estilo} · ` : ''}Primero va la canción: las escenas se escriben sobre la versión que elijas. No tienes que hacer nada más: si algo te necesita, aparece aquí.`}
      />
      {c.modoPrueba ? <BandaModoPrueba /> : null}
      <TeNecesita tarjetas={tarjetas} />
      <div className="prod-mando prod-mando--sin-escenas">
        <div className="pila" style={{ '--hueco': '14px' }}>
          <div>
            <h2 className="prod-mando__frase">{frase}</h2>
            <p className="prod-mando__detalle">{detalle}</p>
          </div>
          <BarraDeProgreso valor={Math.round(avanceDeConductor(c) * 100)} animada={c.estado === 'corriendo'} etiqueta="Avance de la producción" />
          <Etapas etapas={etapas} estados={estados} detalles={detalles} />
        </div>
      </div>
      {cancion.modal}
    </div>
  );
}

function CargandoProduccion() {
  return (
    <div className="pagina prod" aria-busy="true">
      <div className="pila" style={{ '--hueco': '12px', maxWidth: 560 }}>
        <Esqueleto forma="texto" ancho={90} alto={10} />
        <Esqueleto ancho="62%" alto={36} />
        <Esqueleto forma="texto" ancho="88%" />
      </div>
      <div className="prod-mando prod-mando--cargando">
        <Esqueleto forma="miniatura" />
        <div className="pila" style={{ '--hueco': '14px' }}>
          <Esqueleto ancho="40%" alto={28} />
          <Esqueleto forma="texto" ancho="70%" />
          <Esqueleto alto={10} />
          <div className="prod-datos">
            <Esqueleto alto={84} />
            <Esqueleto alto={84} />
          </div>
        </div>
      </div>
      <div className="pila" style={{ '--hueco': '14px' }}>
        {[0, 1, 2].map((i) => (
          <Esqueleto key={i} alto={170} />
        ))}
      </div>
    </div>
  );
}
