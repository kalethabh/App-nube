// NUEVO ANUNCIO (#/nuevo): los bloques 1 y 2 de la propuesta, en dos pasos visibles, ya conectados.
//   Paso 1 "Tu producto": qué vendes, link, fotos, "Cuéntame", guion propio -> la ficha real que arma
//          IA del usuario (Claude o ChatGPT, con su cuenta; sesión "ficha"), con lo deducido y lo que falta.
//   Paso 2 "Tu anuncio": los 12 estilos (uno o varios), y en cada uno su duración, su voz, la continuidad (en
//          los 6 con narrador) y sus preguntas -> "Escribir el guion" (sesión "guion") -> se lee el guion real
//          (en los cantados, la letra) -> "Me gusta, producir" o "Pedir cambios" -> la producción de ese anuncio.
//
// Todo vive en el servidor (temp/_productos/<id>/ y temp/<slug>/app/), así que la pantalla se puede
// cerrar y volver a abrir en cualquier momento. La URL lleva lo necesario para retomar:
//   #/nuevo?producto=<id>                      la ficha de ese producto
//   #/nuevo?producto=<id>&paso=2               los estilos de ese producto
//   #/nuevo?producto=<id>&paso=2&anuncios=<slug>[,<slug>]   sus guiones (escribiéndose o listos)
//   #/nuevo?paso=2&anuncios=<slug>             lo mismo: el producto sale del brief del anuncio
//   #/nuevo?estilo=crochet[&continuidad=1]     viene de Estilos con ese estilo marcado (y la continuidad)
//   #/nuevo?estilo=continuidad                 el efecto solo: entra como Estilo Pixar con continuidad
// El borrador del formulario (antes de crear el producto) y la última voz de cada estilo quedan en este navegador,
// solo por comodidad. Las respuestas de cada estilo (a quién paran, la ciudad, el personaje…) y la duración que
// haya escrito son de ese producto: con otro producto se empieza de cero (la duración, en "Que decida la IA").
//
// Sin precios (el costo real se ve en el informe de la Entrega) y sin opciones A/B/C: siempre se
// produce el anuncio completo. En un anuncio nuevo no se muestra nada de otros anuncios.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clapperboard, Package, Scissors, Sparkles } from 'lucide-react';
import { CabeceraPagina, Tooltip, PuntoEstado, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, urlFotoProducto, useProducto } from '../../datos/api.js';
import { ir, partirRuta, rutas } from '../../datos/rutas.js';
import { CON_CONTINUIDAD, DISPONIBLES, ICONO_ESTILO, disponible, preguntasDe, preguntasIniciales, respuestasDe } from '../estilos/catalogo.js';
import { conDuracion } from '../../datos/duracion.js';
import { BORRADOR_VACIO, PasoProducto, firmaDe } from './PasoProducto.jsx';
import { PasoAnuncio } from './PasoAnuncio.jsx';
import { Elegir } from './Elegir.jsx';
import { estiloDeSlug, leerProducto, recordado, recordar } from './datos.js';
import { useMotor } from '../ajustes/datos.js';
import { useCallarAlSalir } from './reproductor.js';
import './nuevo.css';

/** Los ajustes de un estilo recién elegido. `idioma`: el de la ficha (la entrevista lo pide). */
export function ajustesIniciales(clave, { idioma, ...extra } = {}) {
  return {
    // null = la decide la IA (lo recomendado); un texto = lo que dijo el usuario ("2 minutos"), aproximado. El musical
    // no lleva: lo pone la canción
    duracion: null,
    voz: '', // id de la voz de ElevenLabs (la lista sale de /api/voces)
    vozNombre: '',
    continuidad: false,
    avatar: '', // "<carpeta>/<id>" de un avatar de la biblioteca, o vacío (personas nuevas)
    musica: '', // "<carpeta>/<id>" de una música de la biblioteca, o vacío (la del estilo)
    material: [], // tus videos e imágenes (opcional): [{ id, nombre, tipo, nota, vista? }] (TusArchivos.jsx)
    preguntas: preguntasIniciales(clave, { idioma }),
    ...extra,
  };
}

/** Lo que se recuerda de un estilo en este navegador: sus respuestas solo si son del mismo producto. */
function ajustesRecordados(clave, g, mismoProducto, idioma) {
  const base = ajustesIniciales(clave, { idioma });
  if (!g || typeof g !== 'object') return base;
  return {
    ...base,
    // lo que escribió para este producto (el número de antes, 30/45/60, ya no va: vuelve a "Que decida la IA")
    duracion: conDuracion(clave) && mismoProducto && typeof g.duracion === 'string' ? g.duracion : null,
    voz: typeof g.voz === 'string' ? g.voz : '',
    vozNombre: typeof g.vozNombre === 'string' ? g.vozNombre : '',
    continuidad: CON_CONTINUIDAD.includes(clave) && Boolean(g.continuidad),
    preguntas: mismoProducto && g.preguntas && typeof g.preguntas === 'object' ? { ...base.preguntas, ...g.preguntas } : base.preguntas,
  };
}

/**
 * Estilo que llega por la URL (?estilo=…&continuidad=1). "continuidad" sola es el efecto: entra como Estilo Pixar
 * con continuidad.
 */
function estiloDeConsulta(consulta) {
  const e = consulta?.get('estilo');
  if (!e) return null;
  const clave = e === 'continuidad' ? 'estilo-pixar' : e;
  const continuidad = (e === 'continuidad' || consulta.get('continuidad') === '1') && CON_CONTINUIDAD.includes(clave);
  return { clave, continuidad, pronto: !disponible(clave) };
}

/** Cambia la consulta de #/nuevo sin perder lo demás (lee la URL de verdad, no la del último render). */
function actualizarUrl(cambios) {
  const { consulta } = partirRuta(window.location.hash.replace(/^#/, '') || '/');
  const q = {};
  for (const k of ['producto', 'paso', 'anuncios', 'estilo']) {
    const v = Object.hasOwn(cambios, k) ? cambios[k] : consulta.get(k);
    if (v) q[k] = String(v);
  }
  ir(rutas.nuevo(Object.keys(q).length ? q : undefined), { reemplazar: true });
}

const PASOS = [
  { n: 1, icono: Package, titulo: 'Tu producto', texto: 'Foto, indicaciones y referencia' },
  { n: 2, icono: Sparkles, titulo: 'Tu anuncio', texto: 'Estilo, voz y guion' },
];

function IndicadorPasos({ paso, fichaLista, onIr }) {
  return (
    <nav className="nv-pasos" aria-label="Pasos del nuevo anuncio">
      <ol className="nv-pasos__lista">
        {PASOS.map((p, i) => {
          const hecho = p.n < paso;
          const activo = p.n === paso;
          const puede = p.n === 1 || fichaLista;
          return (
            <li key={p.n} className="nv-pasos__item">
              {i > 0 ? (
                <span className="nv-pasos__linea" aria-hidden="true">
                  <span className="nv-pasos__relleno" style={{ transform: `scaleX(${paso > 1 ? 1 : fichaLista ? 0.5 : 0.08})` }} />
                </span>
              ) : null}
              <button
                type="button"
                className={`nv-paso${activo ? ' nv-paso--activo' : ''}${hecho ? ' nv-paso--hecho' : ''}`}
                aria-current={activo ? 'step' : undefined}
                disabled={!puede}
                onClick={() => onIr(p.n)}
              >
                <span className="nv-paso__numero" aria-hidden="true">
                  {hecho ? <Check size={16} strokeWidth={2.6} /> : p.n}
                </span>
                <span className="nv-paso__textos">
                  <span className="nv-paso__sobre">Paso {p.n}</span>
                  <span className="nv-paso__titulo">{p.titulo}</span>
                  <span className="nv-paso__texto">{p.texto}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="nv-pasos__despues">
        <span className="t-etiqueta">Después, sola</span>
        <span className="nv-pasos__mini">
          <Clapperboard size={14} strokeWidth={2} aria-hidden="true" /> Producción
        </span>
        <span className="nv-pasos__mini">
          <Scissors size={14} strokeWidth={2} aria-hidden="true" /> Entrega
        </span>
      </div>
    </nav>
  );
}

/** Quién escribe: tu IA (Claude o ChatGPT) con tu cuenta (GET /api/ia/estado). */
function EstadoIA({ motor }) {
  if (motor.revisando) return null;
  const ok = motor.listo;
  if (!motor.elegido) {
    return (
      <Tooltip texto="Para escribir tus guiones, la app usa tu cuenta de Claude o de ChatGPT." lado="abajo">
        <a href="#/ajustes" className="nv-claude nv-claude--falta" tabIndex={0}>
          <PuntoEstado tono="error" />
          <span>
            Elige tu IA<span className="nv-claude__detalle"> · ir a Ajustes</span>
          </span>
        </a>
      </Tooltip>
    );
  }
  const sinSesion = motor.instalado && !motor.otraVersion && !motor.instalandoAhora && !ok;
  const conPlanes = `${motor.cuenta}${motor.planes ? ` (${motor.planes})` : ''}`;
  return (
    <Tooltip
      texto={
        ok
          ? `La ficha y los guiones los escribe ${motor.nombre} con tu propia cuenta.`
          : sinSesion
            ? `${motor.programa} está instalado, pero falta iniciar sesión con ${conPlanes}.`
            : `Para que ${motor.nombre} escriba tus guiones, instala ${motor.programa} e inicia sesión con ${motor.cuenta}.`
      }
      lado="abajo"
    >
      {sinSesion ? (
        <button type="button" className="nv-claude nv-claude--falta" onClick={() => motor.iniciarSesion()}>
          <PuntoEstado tono="aviso" />
          <span>
            {motor.programa} sin sesión<span className="nv-claude__detalle"> · iniciar sesión</span>
          </span>
        </button>
      ) : (
        <a href={ok ? undefined : '#/ajustes'} className={`nv-claude${ok ? '' : ' nv-claude--falta'}`} tabIndex={0}>
          <PuntoEstado tono={ok ? 'ok' : 'error'} />
          <span>
            {ok ? `Escribe ${motor.nombre}` : `Falta ${motor.programa}`}
            <span className="nv-claude__detalle">{ok ? ' · con tu cuenta' : ' · ir a Ajustes'}</span>
          </span>
        </a>
      )}
    </Tooltip>
  );
}

/** El formulario de un producto que ya está en el servidor (al volver a abrir la pantalla). */
function borradorDeProducto(id, p) {
  // el servidor manda `imagenes` ({ n, url }); si no, se arman desde `fotos` ("fotos/1.png", …)
  const lista = Array.isArray(p?.imagenes) && p.imagenes.length ? p.imagenes : Array.isArray(p?.fotos) ? p.fotos : [];
  const fotos = lista.map((f, i) => {
    const n = (typeof f === 'object' && Number(f?.n)) || Number(String(f).match(/(\d+)\./)?.[1]) || i + 1;
    const url = typeof f === 'object' && f?.url ? f.url : urlFotoProducto(id, n);
    return { id: `srv-${id}-${n}`, nombre: `Foto ${n}`, url, heic: false, archivo: null, subidaEn: id };
  });
  return {
    ...BORRADOR_VACIO,
    tipo: p?.tipo || 'fisico',
    nombre: p?.nombre || '',
    link: p?.url || '',
    cuentame: p?.descripcion || '',
    tieneGuion: Boolean(p?.guionPropio),
    guion: p?.guionPropio || '',
    referencia: p?.referencia || null,
    fotos,
  };
}

/** El anuncio de cada estilo, leído de ?anuncios=slug1,slug2 */
function anunciosDeConsulta(consulta) {
  const lista = (consulta?.get('anuncios') || consulta?.get('anuncio') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const claves = Object.keys(ICONO_ESTILO);
  const mapa = {};
  for (const slug of lista) mapa[estiloDeSlug(slug, claves) || DISPONIBLES[0]] = slug;
  return mapa;
}

/**
 * #/nuevo sin nada más: primero «¿Qué quieres hacer?» (Elegir.jsx). Con un estilo elegido (?estilo=), con ?inicio=1
 * («Elegir el estilo después») o retomando algo (?producto=, ?anuncios=), el flujo de dos pasos.
 */
export default function Nuevo({ consulta }) {
  const vacia = !consulta || ![...consulta.keys()].length;
  if (vacia) return <Elegir />;
  return <Flujo key={consulta.get('estilo') || ''} consulta={consulta} />;
}

function Flujo({ consulta }) {
  useCallarAlSalir();
  const { aviso } = useAvisos();
  const motor = useMotor();
  const desdeUrl = useMemo(() => estiloDeConsulta(consulta), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- bloque 1: el producto
  const productoUrl = consulta?.get('producto') || null;
  // «Clonar un video» (desde Estilos: #/nuevo?clonar=1): el video a clonar va primero y se pide antes de seguir
  const clonando = consulta?.get('clonar') === '1';
  // «Replicar» desde Inspiración (#/inspiracion): llega el video del anuncio ya bajado, como uno subido, y a veces lo que
  // se le pide a «Agregar» (?pedido=: el estilo de la app que se parece al del anuncio)
  const referenciaUrl = useMemo(() => {
    const r = consulta?.get('referencia') || '';
    return !productoUrl && /^subido:[a-z0-9]{6,30}\|/.test(r) ? r.slice(0, 700) : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pedidoUrl = useRef(referenciaUrl ? String(consulta?.get('pedido') || '').slice(0, 400) : '');
  const [productoId, setProductoId] = useState(productoUrl);
  const [borrador, setBorradorCrudo] = useState(() =>
    productoUrl ? BORRADOR_VACIO : { ...BORRADOR_VACIO, ...recordado('borrador', {}), fotos: [], ...(referenciaUrl ? { referencia: referenciaUrl } : {}) }
  );
  const [firmaCreada, setFirmaCreada] = useState(null);
  const porRestaurar = useRef(Boolean(productoUrl)); // el producto vino por la URL: su formulario sale del servidor
  const [cambios, setCambios] = useState({ correcciones: {}, respuestas: {} });
  const cambiosDe = useRef(null); // de qué producto son los cambios cargados

  const idActual = useRef(productoId); // el de verdad, también dentro de las tareas que siguen corriendo
  idActual.current = productoId;
  const setBorrador = (f) =>
    setBorradorCrudo((b) => {
      const nuevo = typeof f === 'function' ? f(b) : f;
      if (!idActual.current) {
        const { fotos, ...resto } = nuevo; // las fotos (archivos) no se guardan en el navegador
        recordar('borrador', resto);
      }
      return nuevo;
    });

  // el video que llegó por la URL queda recordado (la URL pierde ?referencia= en cuanto la pantalla la actualiza)
  useEffect(() => {
    if (referenciaUrl) setBorrador((b) => ({ ...b, referencia: referenciaUrl }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // la sesión "ficha": se mira cada 2 s mientras corre (y unos segundos después de lanzarla)
  const [lanzadaEn, setLanzadaEn] = useState(0);
  const vioCorrer = useRef(false);
  const [sondear, setSondear] = useState(false);
  const prod = useProducto(productoId, { cadaMs: sondear ? 2000 : undefined });
  // sin producto (empezar de cero), nada del anterior: useDatos deja sus últimos datos cuando la clave queda vacía
  const leido = useMemo(() => leerProducto(productoId ? prod.datos : null), [prod.datos, productoId]);
  const corre = leido.tarea.estado === 'analizando';
  if (corre) vioCorrer.current = true;
  const enGracia = lanzadaEn > 0 && !vioCorrer.current && Date.now() - lanzadaEn < 15000;
  const analizando = corre || enGracia;
  useEffect(() => setSondear(analizando), [analizando]);

  // al volver a abrir: el formulario y las correcciones salen del producto guardado
  useEffect(() => {
    if (!porRestaurar.current || !prod.datos || !productoId) return;
    porRestaurar.current = false;
    const b = borradorDeProducto(productoId, leido.producto);
    setBorradorCrudo(b);
    setFirmaCreada(firmaDe(b));
  }, [prod.datos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!leido.ficha || cambiosDe.current === productoId) return;
    cambiosDe.current = productoId;
    const f = leido.ficha;
    const r = prod.datos || {};
    setCambios({ correcciones: f.correcciones || r.correcciones || {}, respuestas: f.respuestas || r.respuestas || {} });
  }, [leido.ficha, productoId]); // eslint-disable-line react-hooks/exhaustive-deps
  // si el producto de la URL no existe (carpeta borrada o enlace viejo), se empieza de cero
  useEffect(() => {
    if (prod.error?.estado === 404 && productoId) {
      aviso({ tipo: 'aviso', titulo: 'No encuentro ese producto', texto: 'Empieza de nuevo: cuéntame qué vendes.' });
      otroProducto();
    }
  }, [prod.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const alCrear = (id, firma) => {
    idActual.current = id;
    setProductoId(id);
    setFirmaCreada(firma);
    cambiosDe.current = null;
    setCambios({ correcciones: {}, respuestas: {} });
    recordar('borrador', null);
    actualizarUrl({ producto: id, anuncios: null });
    setAnuncios({});
    respuestasDeCero();
  };
  const alAnalizar = (id) => {
    vioCorrer.current = false;
    setLanzadaEn(Date.now());
    setSondear(true);
    invalidar(`producto:${id}`);
    prod.recargar();
  };
  const otroProducto = () => {
    setProductoId(null);
    setFirmaCreada(null);
    setBorradorCrudo(BORRADOR_VACIO);
    recordar('borrador', null);
    setCambios({ correcciones: {}, respuestas: {} });
    cambiosDe.current = null;
    setAnuncios({});
    actualizarUrl({ producto: null, paso: null, anuncios: null });
    respuestasDeCero();
  };
  const guardarFicha = async (parcial) => {
    const nuevos = { ...cambios, ...parcial };
    setCambios(nuevos);
    try {
      await apiNuevo.guardarFicha(productoId, nuevos);
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardar ese cambio', texto: e.message });
    }
  };

  // abierto solo con ?anuncios=<slug> (p. ej. desde Mis anuncios): el producto sale del brief del anuncio
  const adoptarProducto = (id) => {
    if (idActual.current || !id) return;
    idActual.current = id;
    porRestaurar.current = true;
    setProductoId(id);
    actualizarUrl({ producto: id });
  };

  const fichaLista = Boolean(productoId && leido.ficha && !analizando);

  // ---------------------------------------------------------------- bloque 2: estilos, guion y producir
  const [anuncios, setAnuncios] = useState(() => anunciosDeConsulta(consulta)); // { clave: slug }
  const [elegidos, setElegidos] = useState(() => {
    const ya = Object.keys(anunciosDeConsulta(consulta));
    if (ya.length) return ya;
    if (desdeUrl && !desdeUrl.pronto) return [desdeUrl.clave];
    return []; // con 12 estilos no se marca ninguno de entrada: el usuario elige
  });
  const [ajustes, setAjustesCrudo] = useState(() => {
    const guardados = recordado('ajustes', {}) || {};
    // { producto, estilos: { clave: ajuste } } (antes era { clave: ajuste } a secas)
    const porEstilo = guardados.estilos && typeof guardados.estilos === 'object' ? guardados.estilos : guardados;
    const mismo = Boolean(productoUrl) && guardados.producto === productoUrl;
    const inicial = {};
    for (const c of DISPONIBLES) inicial[c] = ajustesRecordados(c, porEstilo[c], mismo);
    if (desdeUrl?.continuidad && inicial[desdeUrl.clave]) inicial[desdeUrl.clave].continuidad = true;
    return inicial;
  });
  const setAjustes = (f) =>
    setAjustesCrudo((a) => {
      const nuevo = typeof f === 'function' ? f(a) : f;
      recordar('ajustes', { producto: idActual.current || null, estilos: nuevo });
      return nuevo;
    });
  // las respuestas de los estilos son de un producto: con otro producto, de cero (y la duración, en "Que decida la
  // IA"); la voz y la continuidad se quedan
  const respuestasDeCero = (idioma) =>
    setAjustes((a) => Object.fromEntries(Object.entries(a).map(([c, x]) => [c, { ...x, duracion: null, preguntas: preguntasIniciales(c, { idioma }) }])));
  const [creando, setCreando] = useState(false);

  // el paso vive también en la URL (#/nuevo?paso=2) para poder volver o compartirlo
  const hayAnuncios = Object.keys(anuncios).length > 0;
  const pasoUrl = consulta?.get('paso') === '2' && (productoId || hayAnuncios) ? 2 : 1;
  const [paso, setPaso] = useState(pasoUrl);
  useEffect(() => {
    if (pasoUrl !== paso) setPaso(pasoUrl);
  }, [pasoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const irAPaso = (n) => {
    setPaso(n);
    actualizarUrl({ paso: n === 2 ? '2' : null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const idiomaFicha = cambios.correcciones.idioma || cambios.respuestas.idioma || leido.ficha?.idioma || '';
  const alternarEstilo = (clave) => {
    if (!disponible(clave) || anuncios[clave]) return;
    setElegidos((l) => (l.includes(clave) ? l.filter((x) => x !== clave) : [...l, clave]));
    setAjustes((a) => {
      if (a[clave]) return a;
      const base = ajustesIniciales(clave, { idioma: idiomaFicha });
      // (el video de referencia del paso 1 ya va puesto en «Clonar un video», también en un estilo elegido después)
      const ref = borrador.referencia;
      const conRef = ref && preguntasDe(clave).some((p) => p.id === 'clonar') && !base.preguntas?.clonar ? { ...base, preguntas: { ...base.preguntas, clonar: ref } } : base;
      return { ...a, [clave]: conRef };
    });
  };
  // el video de referencia del paso 1 se ve ya puesto en «Clonar un video» de cada estilo que lo tiene
  useEffect(() => {
    const ref = borrador.referencia;
    if (paso !== 2 || !ref) return;
    const pedido = pedidoUrl.current; // una sola vez: si después lo borras, no vuelve
    pedidoUrl.current = '';
    setAjustes((a) => {
      let cambio = false;
      const nuevo = { ...a };
      for (const [c, x] of Object.entries(a)) {
        if (c === 'agregar' && pedido && !x?.preguntas?.pedido) {
          cambio = true;
          nuevo[c] = { ...x, preguntas: { ...x.preguntas, pedido } };
        }
        if (x?.preguntas?.clonar || !preguntasDe(c).some((p) => p.id === 'clonar')) continue;
        cambio = true;
        nuevo[c] = { ...nuevo[c], preguntas: { ...nuevo[c].preguntas, clonar: ref } };
      }
      return cambio ? nuevo : a;
    });
  }, [paso, borrador.referencia]); // eslint-disable-line react-hooks/exhaustive-deps
  // las preguntas que vienen marcadas con lo de la ficha (el idioma de la entrevista) se llenan cuando llega la ficha
  useEffect(() => {
    if (!idiomaFicha) return;
    setAjustes((a) => {
      let cambio = false;
      const nuevo = { ...a };
      for (const [c, x] of Object.entries(a)) {
        const base = preguntasIniciales(c, { idioma: idiomaFicha });
        const faltan = Object.keys(base).filter((k) => x?.preguntas?.[k] === null || x?.preguntas?.[k] === undefined);
        if (!faltan.length) continue;
        cambio = true;
        nuevo[c] = { ...x, preguntas: { ...x.preguntas, ...Object.fromEntries(faltan.map((k) => [k, base[k]])) } };
      }
      return cambio ? nuevo : a;
    });
  }, [idiomaFicha]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiarAjuste = (clave, c) => setAjustes((a) => ({ ...a, [clave]: { ...(a[clave] || ajustesIniciales(clave)), ...c } }));

  // Abierto con ?anuncios= (desde Mis anuncios, "Ver el guion"): la vista baja sola hasta el guion, que queda
  // debajo de la galería de estilos (si no, parece que hay que volver a elegir el estilo).
  useEffect(() => {
    if (!Object.keys(anunciosDeConsulta(consulta)).length) return undefined;
    let intentos = 0;
    const id = window.setInterval(() => {
      const el = document.getElementById('nv-guiones');
      if (!el && ++intentos < 40) return;
      window.clearInterval(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Nuevo anuncio" del menú estando ya aquí (#/nuevo, sin nada en la URL): se empieza de cero, igual que
  // viniendo de otra pantalla.
  const consultaVacia = !consulta || ![...consulta.keys()].length;
  useEffect(() => {
    if (consultaVacia && (idActual.current || Object.keys(anuncios).length)) {
      otroProducto();
      window.scrollTo({ top: 0 });
    }
  }, [consultaVacia]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un enlace a otro producto o al guion de otro anuncio con esta pantalla ya abierta (la barra lateral, Te
  // necesitan, atrás y adelante): la URL cambia sin que la pantalla se monte de nuevo. Lo que se ve pasa a ser lo
  // del enlace (si no, se vería, y se aprobaría, el anuncio de antes). Los cambios que hace la pantalla misma en
  // la URL no entran acá: llegan cuando el estado ya es igual.
  const anunciosUrl = consulta?.get('anuncios') || consulta?.get('anuncio') || '';
  const [enfoque, setEnfoque] = useState(null); // { clave, n }: la pestaña del guion del enlace
  useEffect(() => {
    const deUrl = anunciosDeConsulta(consulta);
    const slugsUrl = Object.values(deUrl).sort().join(',');
    const productoNuevo = Boolean(productoUrl) && productoUrl !== idActual.current;
    if (productoNuevo) {
      idActual.current = productoUrl;
      porRestaurar.current = true;
      cambiosDe.current = null;
      setCambios({ correcciones: {}, respuestas: {} });
      setFirmaCreada(null);
      setProductoId(productoUrl);
    }
    if (productoNuevo || (slugsUrl && slugsUrl !== Object.values(anuncios).sort().join(','))) {
      setAnuncios(deUrl);
      if (Object.keys(deUrl).length) setElegidos(Object.keys(deUrl));
      const primera = Object.keys(deUrl)[0];
      if (primera) setEnfoque((e) => ({ clave: primera, n: (e?.n || 0) + 1 }));
    }
  }, [productoUrl, anunciosUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarAnuncios = (mapa) => {
    setAnuncios(mapa);
    actualizarUrl({ anuncios: Object.values(mapa).join(',') || null, paso: '2' });
    invalidar('anuncios');
  };

  /** "Escribir el guion": crea un anuncio por estilo elegido (POST /api/anuncios) y lanza su sesión "guion". */
  const esperarFicha = async () => {
    let relanzada = false;
    for (let i = 0; i < 240; i++) {
      const l = leerProducto(await apiNuevo.producto(productoId));
      if (l.ficha && l.tarea.estado !== 'analizando') return;
      if (l.tarea.estado === 'error') {
        const e = l.tarea.error;
        const texto = typeof e === 'string' ? e : e?.mensaje || 'Claude no pudo preparar tu producto. Vuelve a intentarlo.';
        // un fallo pasajero: se vuelve a intentar una vez sola, sin preguntar
        if (relanzada || /sesi[oó]n|l[ií]mite/i.test(texto)) throw new Error(texto);
        relanzada = true;
        await apiNuevo.analizarProducto(productoId);
      }
      if (i === 0) aviso({ tipo: 'info', titulo: 'Un momento', texto: 'Claude está terminando de mirar tu producto. El guion empieza solo.' });
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Tu producto tardó demasiado en prepararse. Vuelve a intentarlo.');
  };
  const escribir = async (soloClave) => {
    if (!productoId) return;
    setCreando(true);
    const mapa = { ...anuncios };
    try {
      await esperarFicha();
      prod.recargar();
      for (const clave of soloClave ? [soloClave] : elegidos) {
        if (mapa[clave] && !soloClave) continue;
        const a = ajustes[clave] || ajustesIniciales(clave, { idioma: idiomaFicha });
        const r = await apiNuevo.crearAnuncio({
          productoId,
          estilo: clave,
          // null = la decide la IA; un texto = lo que escribió (el servidor lo entiende igual que la pantalla)
          ...(conDuracion(clave) ? { duracion: a.duracion ?? null } : {}),
          voz: a.voz ? { id: a.voz, nombre: a.vozNombre || '' } : { auto: true },
          continuidad: CON_CONTINUIDAD.includes(clave) && Boolean(a.continuidad),
          respuestas: respuestasDe(clave, a.preguntas),
          // de la biblioteca: "<carpeta>/<id>" (vacío = nuevas)
          ...(a.avatar ? { avatar: { estilo: a.avatar.split('/')[0], id: a.avatar.split('/')[1] } } : {}),
          ...(a.musica ? { musica: { estilo: a.musica.split('/')[0], id: a.musica.split('/')[1] } } : {}),
          // tus videos e imágenes (opcional): la IA los usa en el guion
          ...(a.material?.length ? { material: a.material.map((m) => ({ id: m.id, nota: m.nota || '' })) } : {}),
        });
        if (!r?.slug) throw new Error('La app no devolvió el anuncio. Vuelve a intentarlo.');
        mapa[clave] = r.slug;
        if (a.voz) recordar(`voz:${clave}`, a.voz);
      }
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar el guion', texto: e.message, duracion: 9000 });
    } finally {
      guardarAnuncios(mapa);
      setCreando(false);
      // lo que pasa ahora (tu IA escribiendo) se ve entero: el guion sube a la vista
      if (Object.keys(mapa).length) window.setTimeout(() => document.getElementById('nv-guiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    }
  };

  // lo que se ve del producto en el paso 2
  const nombreProducto = cambios.correcciones.nombre || cambios.respuestas.nombre || leido.ficha?.nombre || leido.producto?.nombre || borrador.nombre || '';
  const resumenProducto = productoId
    ? { nombre: nombreProducto || 'Tu producto', sub: cambios.correcciones.queEs || leido.ficha?.queEs || '', foto: borrador.fotos[0] || null, idioma: idiomaFicha || null }
    : null;

  return (
    <div className="pagina nv">
      <CabeceraPagina
        sobretitulo="Nuevo anuncio"
        titulo={clonando ? (paso === 1 ? 'Clonar un video' : 'Elige en qué estilo se rehace') : paso === 1 ? 'Tu producto' : 'Elige cómo contarlo'}
        descripcion={
          clonando && paso === 1
            ? 'Sube el video que quieres clonar y tu producto: la app copia cómo está armado, toma por toma, y lo rehace para tu producto.'
            : clonando
              ? 'Elige el estilo (o varios, para tener variaciones). «Agregar» lo rehace con el mismo look del original. Tu video ya va puesto en «Clonar un video» de cada uno.'
              : paso === 1
            ? 'La foto, lo que quieras que la IA tenga en cuenta y, si tienes, un video de referencia.'
            : `Elige el estilo, lee el guion que escribe ${motor.elegido ? motor.nombre : 'tu IA'} y das un solo «Sí»: lo demás lo hace la app sola, hasta el video.`
        }
        acciones={<EstadoIA motor={motor} />}
      />

      <IndicadorPasos paso={paso} fichaLista={Boolean(productoId) || hayAnuncios} onIr={irAPaso} />

      {paso === 1 ? (
        <PasoProducto
          borrador={borrador}
          setBorrador={setBorrador}
          productoId={productoId}
          firmaCreada={firmaCreada}
          leido={leido}
          analizando={analizando}
          cambios={cambios}
          onGuardarFicha={guardarFicha}
          onCreado={alCrear}
          onAnalizado={alAnalizar}
          onOtroProducto={otroProducto}
          estiloElegido={desdeUrl?.clave}
          clonando={clonando}
          estiloPronto={desdeUrl?.pronto}
          estiloConContinuidad={desdeUrl?.continuidad}
          motor={motor}
          onSeguir={() => irAPaso(2)}
        />
      ) : (
        <PasoAnuncio
          producto={resumenProducto}
          elegidos={elegidos}
          ajustes={ajustes}
          alternarEstilo={alternarEstilo}
          cambiarAjuste={cambiarAjuste}
          anuncios={anuncios}
          creando={creando}
          onEscribir={escribir}
          motor={motor}
          onVolver={() => irAPaso(1)}
          onProductoDelAnuncio={adoptarProducto}
          enfoque={enfoque}
        />
      )}
    </div>
  );
}
