// El formulario de "Anuncios de imagen" (#/imagenes/nuevo, Crear.jsx): a la izquierda 5 grupos y a la derecha el panel
// «Tu lote» (ResumenLote.jsx: lo que va a salir, el costo estimado y el único botón, "Generar N anuncios"), que arranca
// todo sin aprobar nada (la IA arma la estrategia, escribe cada anuncio, crea las imágenes, las revisa y las entrega).
//
// Al tocar Generar, en orden (ESPECIFICACION §11.1):
//   1. si la foto es nueva: crea el producto (POST /api/productos, tipo físico, sin analizar) y sube su foto
//   2. POST /api/imagen-ads (el lote queda en borrador)
//   3. PUT de cada referencia y del logo, de a una (la investigación de mercado del producto la pone el servidor)
//   4. POST /api/imagen-ads/:lote/generar
//   5. va a la pantalla del lote
// Si algo falla, avisa y se queda aquí recordando el lote ya creado: el reintento no crea otro (si cambiaste algo
// que va en el lote, el borrador viejo se borra y se crea uno nuevo). El formulario (sin las imágenes) se guarda en
// este navegador para la próxima vez.
// En el panel «Tu lote», arriba del botón, el COSTO ESTIMADO del lote (excepción a "sin precios" del 2026-11-09): el
// precio por imagen lo manda el servidor (GET /api/imagen-ads/opciones → costo; el modelo de los lotes es fijo) y se
// recalcula con la cantidad y el formato (costoDelLote). La pantalla del lote sigue sin precios hasta su informe.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, Film, Globe, Images, LayoutTemplate, Sparkles, Tag, Telescope, Trophy, Users } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Chip, Interruptor, Pestanas, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, useEstado } from '../../datos/api.js';
import { dinero } from '../../datos/formato.js';
import {
  CLAVE_LOTES,
  CLAVE_PRODUCTOS,
  apiImagenes,
  costoDelLote,
  textoDeCantidad,
  useOpcionesImagen,
  useProductosImagen,
} from '../../datos/imagenes.js';
import { LOTE_EJEMPLO, opcionesDeEjemplo, productosDeEjemplo } from '../../datos/imagenes-simulacion.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { rangoDinero } from '../nuevo/CostoEstimado.jsx';
import { useMotor } from '../ajustes/datos.js';
import { ElegirProducto } from './ElegirProducto.jsx';
import { ElegirFunciona, comoArchivos } from './ElegirFunciona.jsx';
import { ResumenLote } from './ResumenLote.jsx';
import { ZonaImagenes, liberarVistas } from './ZonaImagenes.jsx';
import { BibliotecaReferencias } from './BibliotecaReferencias.jsx';
import { ElegirPlantillasRef } from './ElegirPlantillasRef.jsx';
import { KitMarca, KIT_INICIAL } from './KitMarca.jsx';
import { DeUnVideo } from './DeUnVideo.jsx';

// «Nuevos»: de cero, con los ganchos validados de tu investigación. «Variantes»: de algo que ya te funciona.
const MODOS = [
  { id: 'nuevos', etiqueta: 'Nuevos' },
  { id: 'variantes', etiqueta: 'Variantes' },
  { id: 'video', etiqueta: 'De un video' },
];
const CANTIDADES = [5, 10, 20, 50];
const PROPORCIONES = [
  { id: 'cuadrado', etiqueta: 'Solo cuadrado 1:1' },
  { id: 'ambos', etiqueta: 'Cuadrado + vertical 9:16' },
];

const VACIO = {
  productoId: null,
  fotoProducto: null,
  nombre: '',
  publico: '',
  pais: '',
  adicional: '',
  cantidad: '10',
  conVertical: true,
  modo: 'nuevos',
  // false = rápido, como pedirle a ChatGPT que te las varíe (por defecto); true = con la estrategia de la IA (más lento)
  elaborado: false,
  // PLANTILLAS (2026-11-17p): la app dibuja los textos y el modelo solo hace las escenas, sin texto (por defecto en «Nuevos»)
  plantillas: true,
  // los formatos elegidos ([] = «Que la app elija»)
  elegidas: [],
  // las plantillas de referencia elegidas (2026-11-18s)
  plantillasRef: [],
};

// ---------------------------------------------------------------- el borrador en este navegador (sin imágenes)

const CLAVE_BORRADOR = 'anuncios-ia:imagenes-borrador';
function leerBorrador() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CLAVE_BORRADOR) || 'null');
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(Object.entries(v).filter(([k]) => k in VACIO));
  } catch {
    return {};
  }
}
function guardarBorrador(f) {
  try {
    window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(f));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Los datos de un lote anterior (o de la simulación) llevados al formulario. */
function desdeDatos(d) {
  if (!d || typeof d !== 'object') return {};
  const s = (x) => (typeof x === 'string' ? x : x === null || x === undefined ? '' : String(x));
  return {
    nombre: s(d.nombre),
    publico: s(d.publico),
    pais: s(d.pais),
    adicional: s(d.adicional),
  };
}

// ---------------------------------------------------------------- un grupo numerado

function Grupo({ n, id, titulo, opcional, children }) {
  return (
    <section className="img-grupo" aria-labelledby={`${id}-titulo`}>
      <div className="img-grupo__cabecera">
        <span className="img-grupo__n t-num" aria-hidden="true">
          {n}
        </span>
        <h2 className="img-grupo__titulo" id={`${id}-titulo`}>
          {titulo}
          {opcional ? <span className="img-grupo__opcional">opcional</span> : null}
        </h2>
      </div>
      <div className="img-grupo__cuerpo">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- el formulario

export function Formulario({ simulando = false, productoPedido = null, referenciaPedida = null, videoPedido = null, modoPedido = null }) {
  const { aviso } = useAvisos();
  const motor = useMotor();
  const modoPrueba = Boolean(useEstado().datos?.modoPrueba?.activo);
  const op = useOpcionesImagen();
  const pr = useProductosImagen();
  const ejemplo = useMemo(() => (simulando ? { opciones: opcionesDeEjemplo(), productos: productosDeEjemplo().productos } : null), [simulando]);
  const opciones = ejemplo ? ejemplo.opciones : op.datos;
  const productos = ejemplo ? ejemplo.productos : pr.datos?.productos;
  const cargandoProductos = !simulando && pr.cargando && !pr.datos;
  const maximo = Number(opciones?.maximo) || 100;
  const maxRefs = Number(opciones?.maxReferencias) || 10;

  const [f, setF] = useState(() => ({ ...VACIO, ...(simulando ? {} : leerBorrador()) }));
  const [fotoNueva, setFotoNueva] = useState([]);
  const [referencias, setReferencias] = useState([]);
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  // «Variantes»: los creativos de «Lo que me funciona» elegidos (en orden)
  const [elegidos, setElegidos] = useState([]);
  const [itemsElegidos, setItemsElegidos] = useState([]);
  const variantes = f.modo === 'variantes';
  // «De un video, imágenes»: los cuadros de un video, armados con las plantillas (gratis)
  const deVideo = f.modo === 'video';
  const [video, setVideo] = useState(null); // { id, seleccion } cuando ya hay cuadros elegidos
  // con plantillas (2026-11-18s: anuncios validados que van al modelo como referencia, con tu producto y tus textos):
  // en «Nuevos» (en «Variantes» se copia el diseño de lo que ya te funciona)
  const conPlantillas = !variantes && !deVideo && f.plantillas !== false && Boolean(opciones?.plantillasReferencia?.plantillas?.length);
  const refElegidas = (Array.isArray(f.plantillasRef) ? f.plantillasRef : []).filter((id) => opciones?.plantillasReferencia?.plantillas?.some((p) => p.id === id));
  // el kit de marca del producto (colores sacados solos de la foto, letras y sticker)
  const [kit, setKit] = useState(KIT_INICIAL);
  const [kitAuto, setKitAuto] = useState(false);
  const [kitTocado, setKitTocado] = useState(false);
  const [errores, setErrores] = useState({});
  const [fase, setFase] = useState(null);
  const [nota, setNota] = useState(null);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const creado = useRef(null); // { firma, lote, refs: { n: id }, logo: id }
  const productoCreado = useRef(null); // { fotoId, id }
  const ocupado = Boolean(fase);

  const poner = (cambios) => {
    setF((x) => ({ ...x, ...cambios }));
    const tocados = Object.keys(cambios);
    setErrores((e) => (tocados.some((k) => e[k]) ? Object.fromEntries(Object.entries(e).filter(([k]) => !tocados.includes(k))) : e));
  };

  // el borrador se guarda en este navegador (sin las imágenes) para la próxima vez
  useEffect(() => {
    if (!simulando) guardarBorrador(f);
  }, [f, simulando]);

  // «Replicar» desde Inspiración: la imagen del anuncio llega ya bajada y entra como referencia (en «Nuevos»)
  const referenciaAplicada = useRef(null);
  useEffect(() => {
    if (!referenciaPedida || referenciaAplicada.current === referenciaPedida || !/^\/api\/inspiracion\/imagenes\/[0-9a-f]{16}\.jpg$/.test(referenciaPedida)) return;
    referenciaAplicada.current = referenciaPedida;
    fetch(referenciaPedida)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sin imagen'))))
      .then((blob) => {
        if (!montado.current) return;
        const archivo = new File([blob], `inspiracion-${referenciaPedida.slice(-20)}`, { type: blob.type || 'image/jpeg' });
        setReferencias((r) => [...r, { id: `insp-${referenciaPedida.slice(-20)}`, archivo, nombre: 'Anuncio de Inspiración', heic: false, url: URL.createObjectURL(archivo) }].slice(0, maxRefs));
        setF((x) => ({ ...x, modo: 'nuevos' }));
      })
      .catch(() => aviso({ tipo: 'error', titulo: 'No pude traer la imagen', texto: 'Vuelve a tocar «Replicar» en Inspiración.' }));
  }, [referenciaPedida]); // eslint-disable-line react-hooks/exhaustive-deps

  // un video de Inspiración («Imágenes de este video»): abre en «De un video»
  useEffect(() => {
    if (videoPedido) setF((x) => ({ ...x, modo: 'video' }));
  }, [videoPedido]);
  // «Hacer variantes» desde Biblioteca → Lo que me funciona: abre en «Variantes»
  useEffect(() => {
    if (modoPedido === 'variantes') setF((x) => ({ ...x, modo: 'variantes' }));
  }, [modoPedido]);

  // las vistas previas locales se liberan al salir de la pantalla
  const vistas = useRef([]);
  vistas.current = [...fotoNueva, ...referencias];
  useEffect(() => () => liberarVistas(vistas.current), []);

  // el producto guardado ya no está (o no tiene fotos): se suelta. Con ?producto=<id> ("Hacer otro lote", «Crear más»),
  // se elige (una vez por cada producto pedido: también si el enlace cambia sin salir de la pantalla)
  const pedidoAplicado = useRef(null);
  useEffect(() => {
    if (!productos) return;
    if (productoPedido && pedidoAplicado.current !== productoPedido) {
      pedidoAplicado.current = productoPedido;
      const p = productos.find((x) => x.id === productoPedido);
      if (p) {
        elegir(p);
        return;
      }
    }
    if (f.productoId && !productos.some((x) => x.id === f.productoId)) poner({ productoId: null, fotoProducto: null });
  }, [productos, productoPedido]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegir(p) {
    if (!p) {
      poner({ productoId: null, fotoProducto: null });
      setNota(null);
      return;
    }
    liberarVistas(fotoNueva);
    setFotoNueva([]);
    const datos = p.ultimoLote?.datos;
    poner({ productoId: p.id, fotoProducto: p.fotoSugerida || p.fotos?.[0]?.n || 1, ...(datos ? desdeDatos(datos) : { nombre: p.nombre || f.nombre }) });
    setErrores((e) => ({ ...e, producto: undefined, nombre: undefined, pais: datos?.pais ? undefined : e.pais }));
    setNota(datos ? `Completé el formulario con tu último lote de «${p.nombre}». Cambia lo que quieras.` : null);
  }

  const n = deVideo ? video?.conceptos?.length || 0 : Number(f.cantidad);
  const cantidadValida = Number.isInteger(n) && n >= 1 && n <= maximo;

  function validar() {
    const e = {};
    if (!f.productoId && !fotoNueva.length) e.producto = 'Elige tu producto o sube su foto.';
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre de tu producto.';
    if (!f.pais.trim()) e.pais = 'Escribe el país donde vendes.';
    if (!cantidadValida) e.cantidad = `Elige de 1 a ${maximo} anuncios.`;
    if (variantes && !elegidos.length) e.funciona = 'Elige al menos un creativo que te funcione.';
    if (deVideo && !video?.conceptos?.length) e.video = 'Sube o elige un video y espera a que tu IA proponga los anuncios.';
    return e;
  }

  const bajarAlPrimero = (e) => {
    const orden = [
      ['producto', 'campo-producto'],
      ['nombre', 'campo-nombre'],
      ['pais', 'campo-pais'],
      ['cantidad', 'campo-cantidad'],
      ['funciona', 'grupo-referencias-titulo'],
      ['video', 'grupo-video-titulo'],
    ];
    const primero = orden.find(([k]) => e[k]);
    const el = primero ? document.getElementById(primero[1]) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.tagName === 'INPUT') setTimeout(() => el.focus({ preventScroll: true }), 300);
  };

  const lugarRefs = Math.max(0, maxRefs - referencias.length);
  const agregarDeBiblioteca = (archivos) => {
    const nuevos = archivos.slice(0, lugarRefs).map((a) => ({ id: `${a.name}-${a.size}-${Math.random().toString(36).slice(2, 7)}`, archivo: a, nombre: a.name, heic: false, url: URL.createObjectURL(a) }));
    if (nuevos.length) setReferencias((r) => [...r, ...nuevos]);
  };

  // el kit del producto elegido (el servidor lo saca de la foto la primera vez y lo guarda)
  useEffect(() => {
    if (simulando || !f.productoId) {
      setKit(KIT_INICIAL);
      setKitAuto(false);
      setKitTocado(false);
      return;
    }
    let vivo = true;
    apiImagenes
      .kit(f.productoId)
      .then((r) => {
        if (!vivo || !r?.kit) return;
        const { automatico, ...k } = r.kit;
        setKit({ ...KIT_INICIAL, ...k });
        setKitAuto(Boolean(automatico));
        setKitTocado(false);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [f.productoId, simulando]);

  const formatos = f.conVertical ? ['1:1', '9:16'] : ['1:1'];
  // plantillas: solo las escenas cuestan (una por anuncio con escena: el vertical usa la misma)
  // sin formatos elegidos, los que propuso la investigación de mercado del producto (con sus textos), si los tiene
  const productoElegido = !fotoNueva.length && f.productoId ? (productos || []).find((x) => x.id === f.productoId) || null : null;
  const propuestas = productoElegido?.investigacion?.propuestas || [];
  // (las plantillas de dibujo de la app quedan para «De un video»; con las de referencia cada imagen cuesta como siempre)
  const planPlantillas = null;
  // el costo estimado: cada imagen (cuadrada o vertical) al precio que manda el servidor (un solo número: la revisión
  // ya no rehace nada sola)
  const precio = opciones?.costo || null;
  const costoLote = !cantidadValida
    ? null
    : planPlantillas
      ? planPlantillas.escenas
        ? costoDelLote(precio, planPlantillas.escenas)
        : { min: 0, max: 0, gratis: true }
      : costoDelLote(precio, n * formatos.length);
  const datosDelLote = () => ({
    nombre: f.nombre.trim(),
    publico: f.publico.trim(),
    pais: f.pais.trim(),
    idioma: 'es', // siempre en español
    adicional: f.adicional.trim(),
  });

  async function generar() {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      bajarAlPrimero(e);
      return;
    }
    if (!costoLote) {
      aviso({ tipo: 'aviso', titulo: 'Falta calcular el costo', texto: 'Espera a que aparezca el costo estimado antes de generar. Si no aparece, recarga la pantalla.' });
      return;
    }
    // (el modo rápido no necesita la IA de texto para arrancar: solo el modo «Más elaborado»)
    if (f.elaborado && !conPlantillas && motor.falta) {
      aviso(
        !motor.elegido
          ? { tipo: 'aviso', titulo: 'Elige tu IA', texto: 'Para armar la estrategia y revisar tus imágenes, la app usa tu cuenta de Claude o de ChatGPT. Elige una y vuelve a tocar Generar.' }
          : !motor.instalado || motor.otraVersion
            ? { tipo: 'aviso', titulo: `Falta ${motor.programa} en tu PC`, texto: `La IA que arma la estrategia y revisa tus imágenes es ${motor.nombre}, con tu cuenta. Instálalo y vuelve a tocar Generar.` }
            : { tipo: 'aviso', titulo: `Falta tu sesión de ${motor.nombre}`, texto: `La IA que arma la estrategia y revisa tus imágenes es ${motor.nombre}, con tu cuenta. Inicia sesión y vuelve a tocar Generar.` }
      );
      return;
    }
    if (simulando) {
      for (const t of ['Creando tu lote', referencias.length || elegidos.length ? 'Subiendo tus referencias' : null, 'Arrancando tu lote'].filter(Boolean)) {
        setFase(t);
        await esperar(450);
      }
      setFase(null);
      ir(`${rutas.loteImagenes(LOTE_EJEMPLO)}?simular=1`);
      return;
    }
    try {
      // 1. el producto (si la foto es nueva, queda guardado como producto físico, sin analizar)
      let productoId = f.productoId;
      let fotoProducto = Number(f.fotoProducto) || 1;
      if (!productoId) {
        const foto = fotoNueva[0];
        if (productoCreado.current?.fotoId === foto.id) productoId = productoCreado.current.id;
        else {
          setFase('Guardando tu producto');
          const r = await apiNuevo.crearProducto({ nombre: f.nombre.trim(), tipo: 'fisico' });
          if (!r?.id) throw new Error('La app no devolvió tu producto. Vuelve a intentarlo.');
          setFase('Subiendo la foto de tu producto');
          await apiNuevo.subirFoto(r.id, 1, foto.archivo);
          productoCreado.current = { fotoId: foto.id, id: r.id };
          productoId = r.id;
          invalidar(CLAVE_PRODUCTOS);
        }
        fotoProducto = 1;
      }

      // las referencias: en «Variantes», los creativos que te funcionan (los del mismo producto conservan hasta sus colores)
      const refs = variantes
        ? (await comoArchivos(itemsElegidos)).map((archivo, i) => ({ id: `funciona-${itemsElegidos[i].id}`, archivo }))
        : referencias;
      const propias = variantes ? itemsElegidos.map((x, i) => (x.productoId && x.productoId === productoId ? i + 1 : null)).filter(Boolean) : [];

      // 2. el lote (borrador). Si cambiaste algo que va en él desde el intento anterior, se arma otro.
      // el kit que cambiaste queda guardado con el producto (si el producto es nuevo, va con el lote)
      if (deVideo && kitTocado && f.productoId) await apiImagenes.guardarKit(f.productoId, kit).catch(() => {});
      const cuerpo = {
        productoId,
        fotoProducto,
        datos: datosDelLote(),
        cantidad: n,
        formatos,
        logo: null,
        modo: variantes ? 'variantes' : 'nuevos',
        referenciasPropias: propias,
        // (2026-11-19h) el concepto de cada creativo que funciona, en el mismo orden: la variante lo conserva
        ...(variantes ? { conceptosReferencias: itemsElegidos.map((x) => x.concepto || '') } : {}),
        fiel: variantes,
        rapido: conPlantillas ? true : !f.elaborado,
        refs: conPlantillas ? [] : refs.map((x) => x.id),
        ...(conPlantillas ? { plantillasReferencia: { elegidas: refElegidas } } : {}),
        // (de un video: los anuncios que propuso tu IA con su ángulo, con las plantillas ganadoras)
        ...(deVideo ? { video: { id: video?.id, conceptos: video?.conceptos || [] }, modo: 'nuevos', rapido: true, refs: [], plantillasReferencia: { elegidas: refElegidas } } : {}),
      };
      const firma = JSON.stringify(cuerpo);
      if (creado.current && creado.current.firma !== firma) {
        apiImagenes.borrar(creado.current.lote).catch(() => {});
        creado.current = null;
      }
      if (!creado.current) {
        setFase('Creando tu lote');
        const r = await apiImagenes.crear(cuerpo);
        if (!r?.lote) throw new Error('La app no devolvió tu lote. Vuelve a intentarlo.');
        creado.current = { firma, lote: r.lote, refs: {}, logo: null };
        invalidar(CLAVE_LOTES);
      }
      const c = creado.current;

      // 3. las referencias y el logo, de a una
      const refsDelLote = conPlantillas || deVideo ? [] : refs;
      for (let i = 0; i < refsDelLote.length; i++) {
        const ref = refsDelLote[i];
        if (c.refs[i + 1] === ref.id) continue;
        setFase(refsDelLote.length === 1 ? 'Subiendo tu referencia' : `Subiendo tus referencias (${i + 1} de ${refsDelLote.length})`);
        await apiImagenes.subirReferencia(c.lote, i + 1, ref.archivo);
        c.refs[i + 1] = ref.id;
      }
      for (const sobra of Object.keys(c.refs)
        .map(Number)
        .filter((k) => k > refsDelLote.length)) {
        await apiImagenes.quitarReferencia(c.lote, sobra);
        delete c.refs[sobra];
      }

      // 4. arranca con el costo visible confirmado (los títulos los pone la app; ya no se eligen antes)
      setFase('Arrancando tu lote');
      try {
        await apiImagenes.generar(c.lote, costoLote.max, []);
      } catch (err) {
        if (err?.estado !== 409) throw err;
      }
      invalidar(CLAVE_LOTES);
      creado.current = null;
      ir(rutas.loteImagenes(c.lote));
    } catch (err) {
      aviso({ tipo: 'error', titulo: 'No pude arrancar tu lote', texto: `${err?.message || 'Algo salió mal.'} Vuelve a tocar Generar: lo que ya se guardó no se repite.`, duracion: 10000 });
    } finally {
      setFase(null);
    }
  }

  const textoBoton = cantidadValida ? `Generar ${n} ${n === 1 ? 'anuncio' : 'anuncios'}` : 'Generar anuncios';

  // lo que muestra el panel «Tu lote»: la foto elegida (o la nueva), el logo con su posición y el costo
  const fotoElegida = productoElegido ? (productoElegido.fotos || []).find((x) => Number(x.n) === Number(f.fotoProducto)) || productoElegido.fotos?.[0] : null;

  return (
    <div className="img-crear">
      <Tarjeta variante="elevada" relleno="ninguno" className="img-form">
        <div className="img-modo">
          <Pestanas variante="segmentado" etiqueta="Qué quieres crear" items={MODOS} activa={f.modo} onCambio={(id) => poner({ modo: id })} />
          <p className="img-modo__texto">
            {variantes ? (
              <>
                <Copy size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  Variantes de algo que <strong>ya te funciona</strong>: el mismo concepto creativo, diseño, tipografía y enfoque; cambia el título por ganchos ya validados. Sube aquí tus anuncios ganadores (quedan en tu biblioteca).
                </span>
              </>
            ) : (
              <>
                <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  Anuncios <strong>nuevos</strong>: salen de tu investigación de mercado, la foto de tu producto y tus anuncios ya validados («Me funciona» y tu biblioteca de referencias). Los títulos juegan con los ganchos validados de TrendTrack.
                </span>
              </>
            )}
          </p>
          {deVideo ? (
            <p className="img-modo__texto">
              <Film size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                De <strong>un video</strong>, anuncios de imagen con su mismo ángulo: tu IA lo mira y lo escucha, saca el gancho, el dolor y el deseo, y propone anuncios para tu producto con sus titulares. Salen con las plantillas ganadoras.
              </span>
            </p>
          ) : null}
          {!variantes && !deVideo && opciones?.plantillas?.plantillas?.length ? (
            <Interruptor
              activado={conPlantillas}
              onCambio={(v) => poner({ plantillas: v })}
              etiqueta="Con plantillas de anuncios validados"
              descripcion={
                conPlantillas
                  ? 'Cada plantilla va al modelo de imagen como referencia: mantiene su estructura, composición y letras, y cambia el producto, los textos y los colores por los tuyos.'
                  : 'Diseño libre: el modelo de imagen hace todo el anuncio a partir de tus referencias (textos incluidos). Más lento.'
              }
              deshabilitado={ocupado}
              className="img-fiel"
            />
          ) : null}
          {conPlantillas || deVideo ? null : (
          <Interruptor
            activado={Boolean(f.elaborado)}
            onCambio={(v) => poner({ elaborado: v })}
            etiqueta="Más elaborado (más lento)"
            descripcion={
              f.elaborado
                ? 'La IA estudia tu producto y tu investigación, arma una estrategia, escribe cada anuncio y revisa cada imagen. Tarda unos 15 minutos.'
                : 'Rápido, como pedirle a ChatGPT que te las varíe: cada imagen sale de tu referencia y la foto de tu producto, con un título distinto. En pocos minutos.'
            }
            deshabilitado={ocupado}
            className="img-fiel"
          />
          )}
        </div>
        <Grupo n={1} id="grupo-producto" titulo="Tu producto">
          <ElegirProducto
            productos={productos}
            cargando={cargandoProductos}
            elegido={f.productoId}
            foto={f.fotoProducto}
            onElegir={elegir}
            onFoto={(k) => poner({ fotoProducto: k })}
            fotoNueva={fotoNueva}
            onFotoNueva={(lista) => {
              setFotoNueva(lista);
              if (lista.length) {
                poner({ productoId: null, fotoProducto: null });
                setErrores((e) => ({ ...e, producto: undefined }));
                setNota(null);
              }
            }}
            bloqueada={ocupado}
            error={errores.producto}
          />
          {nota ? (
            <p className="img-nota">
              <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
              {nota}
            </p>
          ) : null}
        </Grupo>

        <Grupo n={2} id="grupo-venta" titulo="Cómo se vende">
          <div className="img-campos">
            <CampoTexto
              id="campo-nombre"
              etiqueta="Nombre"
              icono={Tag}
              placeholder="Crema Luna"
              maxLength={120}
              value={f.nombre}
              onChange={(e) => poner({ nombre: e.target.value })}
              error={errores.nombre}
              disabled={ocupado}
            />
            <CampoTexto
              etiqueta="Público"
              opcional
              icono={Users}
              placeholder="Mujeres de 25 a 45"
              maxLength={300}
              value={f.publico}
              onChange={(e) => poner({ publico: e.target.value })}
              disabled={ocupado}
            />
            <CampoTexto
              id="campo-pais"
              etiqueta="País"
              icono={Globe}
              placeholder="Perú"
              maxLength={60}
              value={f.pais}
              onChange={(e) => poner({ pais: e.target.value })}
              error={errores.pais}
              disabled={ocupado}
            />
            <AreaTexto
              etiqueta="Información adicional"
              opcional
              className="img-campos__ancho"
              filas={3}
              maxLength={4000}
              placeholder="Lo que la IA debería saber de tu producto."
              value={f.adicional}
              onChange={(e) => poner({ adicional: e.target.value })}
              ayuda="Dosis, cuánto dura, una tipografía que te guste… Si pegas un enlace, la IA no lo abre: copia aquí lo importante."
              disabled={ocupado}
            />
          </div>
        </Grupo>

        <Grupo n={3} id="grupo-investigacion" titulo="Investigación de mercado">
          {productoElegido?.investigacion ? (
            <p className="img-nota img-nota--ok" role="status">
              <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                Tus anuncios usan la investigación de mercado de este producto{productoElegido.investigacion.pais ? ` (${productoElegido.investigacion.pais})` : ''}: su deseo central, su beneficio principal y sus puntos de dolor, con lo que resaltaste primero. Los títulos juegan con los ganchos ya validados de la segunda parte (TrendTrack), si la hiciste.{' '}
                <a href={enlace.investigacion(productoElegido.id)}>Verla</a>
              </span>
            </p>
          ) : (
            <>
              <p className="img-nota">
                <Telescope size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  {productoElegido
                    ? 'Este producto todavía no tiene investigación de mercado. Se hace una vez, solo con su foto, y la usan todos sus anuncios.'
                    : 'La investigación de mercado se hace una vez por producto, solo con su foto, en «Investigación de mercado». Tus anuncios la usan sola.'}
                </span>
              </p>
              <div className="img-zona__acciones">
                <Boton variante="secundario" tamano="chico" icono={Telescope} href={enlace.investigacion(productoElegido?.id)} disabled={ocupado}>
                  {productoElegido ? 'Investigar este producto' : 'Ir a Investigación de mercado'}
                </Boton>
              </div>
              {variantes ? (
                <p className="img-ayuda">Sin investigación, los títulos nuevos salen de lo que ya te funciona y de lo que escribas arriba.</p>
              ) : (
                <p className="img-nota img-nota--aviso" role="status">
                  <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
                  <span>
                    Puedes generar igual: la IA usa la foto, lo que escribas arriba y tus anuncios ya validados. Pero sin investigación los títulos y los ángulos salen menos precisos (no sabe qué le duele a tu cliente ni qué ganchos funcionan en tu mercado). Te conviene investigar primero: se hace una sola vez por producto.
                  </span>
                </p>
              )}
            </>
          )}
        </Grupo>

        <Grupo n={4} id="grupo-cantidad" titulo={deVideo ? 'En qué tamaño' : 'Cuántos y en qué tamaño'}>
          {deVideo ? null : (
          <div className="img-cantidad">
            <CampoTexto
              id="campo-cantidad"
              etiqueta="Cuántos anuncios"
              type="number"
              inputMode="numeric"
              min={1}
              max={maximo}
              step={1}
              value={f.cantidad}
              onChange={(e) => poner({ cantidad: e.target.value })}
              onBlur={() => {
                const k = Math.round(Number(f.cantidad));
                if (Number.isFinite(k) && f.cantidad !== '') poner({ cantidad: String(Math.min(maximo, Math.max(1, k))) });
              }}
              error={errores.cantidad}
              disabled={ocupado}
              className="img-cantidad__campo"
            />
            <div className="img-cantidad__chips" role="group" aria-label="Cantidades rápidas">
              {CANTIDADES.filter((k) => k <= maximo).map((k) => (
                <Chip key={k} activo={n === k} onClick={() => poner({ cantidad: String(k) })} disabled={ocupado}>
                  {k}
                </Chip>
              ))}
            </div>
          </div>
          )}
          <Pestanas
            variante="segmentado"
            etiqueta="Proporción de las imágenes"
            items={PROPORCIONES}
            activa={f.conVertical ? 'ambos' : 'cuadrado'}
            onCambio={(id) => poner({ conVertical: id === 'ambos' })}
            className="img-proporcion"
          />
          <p className="t-chico t-3">{cantidadValida ? textoDeCantidad(n, f.conVertical) : `Elige de 1 a ${maximo} anuncios.`}</p>
        </Grupo>

        {deVideo ? (
          <>
            <Grupo n={5} id="grupo-video" titulo="Tu video">
              <DeUnVideo videoPedido={videoPedido} productoId={f.productoId} bloqueado={ocupado} onCambiar={setVideo} />
              {errores.video ? (
                <p className="img-nota img-nota--aviso" role="alert">
                  <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
                  {errores.video}
                </p>
              ) : null}
            </Grupo>
            <Grupo n={6} id="grupo-formato" titulo="Plantillas">
              <ElegirPlantillasRef catalogo={opciones?.plantillasReferencia} elegidas={refElegidas} onCambiar={(ids) => poner({ plantillasRef: ids })} bloqueado={ocupado} productoId={productoElegido?.id || null} />
            </Grupo>
          </>
        ) : conPlantillas ? (
          <Grupo n={5} id="grupo-formato" titulo="Plantillas">
            <ElegirPlantillasRef catalogo={opciones?.plantillasReferencia} elegidas={refElegidas} onCambiar={(ids) => poner({ plantillasRef: ids })} bloqueado={ocupado} productoId={productoElegido?.id || null} />
            <p className="img-nota" role="status">
              <LayoutTemplate size={14} strokeWidth={2} aria-hidden="true" />
              <span>Misma estructura de la plantilla; tu producto, tus textos (sin precios) y tus colores.</span>
            </p>
          </Grupo>
        ) : variantes ? (
          <Grupo n={5} id="grupo-referencias" titulo="Lo que te funciona">
            <ElegirFunciona
              elegidos={elegidos}
              onCambiar={(ids, items) => {
                setElegidos(ids);
                setItemsElegidos(items);
                setErrores((e) => ({ ...e, funciona: undefined }));
              }}
              max={maxRefs}
              productoId={f.productoId}
              bloqueado={ocupado}
            />
            {errores.funciona ? (
              <p className="img-nota img-nota--aviso" role="alert">
                <Trophy size={14} strokeWidth={2} aria-hidden="true" />
                {errores.funciona}
              </p>
            ) : null}
          </Grupo>
        ) : (
        <Grupo n={5} id="grupo-referencias" titulo="Referencias" opcional>
          <ZonaImagenes
            archivos={referencias}
            onCambiar={setReferencias}
            max={maxRefs}
            numeradas
            etiqueta="Tus referencias"
            titulo="Arrastra anuncios que te gusten"
            bloqueada={ocupado}
            pegarSiempre
            extra={
              <Boton variante="secundario" tamano="chico" icono={Images} onClick={() => setBibliotecaAbierta(true)} disabled={ocupado}>
                Elegir de tu biblioteca
              </Boton>
            }
            ayuda="Sube, arrastra o pega (Ctrl/Cmd+V) anuncios que te gusten. Cada uno queda guardado en tu biblioteca para usarlo con otros productos."
          />
          <p className="img-ayuda">
            Además, la IA mira sola tus anuncios ya validados («Me funciona», los de este producto primero, y tu biblioteca de referencias) para saber qué te funciona, y crea diseños nuevos con eso. Para copiar el diseño de algo que ya te funciona, usa «Variantes».
          </p>
          <BibliotecaReferencias abierta={bibliotecaAbierta} onCerrar={() => setBibliotecaAbierta(false)} lugar={lugarRefs} onElegir={agregarDeBiblioteca} />
          {cantidadValida && referencias.length > n ? (
            <p className="img-nota img-nota--aviso">
              <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
              Subiste {referencias.length} y pediste {n}: se usan las {n === 1 ? 'primera' : `${n} primeras`}.
            </p>
          ) : null}
        </Grupo>

        )}
      </Tarjeta>

      <ResumenLote
        producto={{ nombre: f.nombre.trim() || productoElegido?.nombre || '', foto: fotoNueva[0]?.url || fotoElegida?.url || null, nueva: Boolean(fotoNueva.length) }}
        cantidad={{ valida: cantidadValida, n, maximo }}
        conVertical={f.conVertical}
        logo={null}
        referencias={conPlantillas || deVideo ? [] : variantes ? itemsElegidos.map((x) => ({ id: x.id, url: x.url })) : referencias}
        plantillas={conPlantillas || deVideo ? { elegidas: refElegidas.length, escenas: null, referencia: true } : null}
        costo={
          costoLote?.gratis && deVideo
            ? {
                rango: 'Sin costo',
                etiqueta: 'Todo en tu computadora',
                chica: 'Los cuadros salen de tu video y la app arma cada imagen: no se llama al modelo de imagen. «Pulir con IA» una imagen, después, es opcional y te muestra su costo antes.',
              }
            : costoLote?.gratis
            ? {
                rango: 'Sin costo',
                etiqueta: 'Todo en tu computadora',
                chica: 'Estos formatos los arma la app con la foto de tu producto: no se llama al modelo de imagen. Cambiar un texto después también es gratis.',
              }
            : costoLote && planPlantillas
            ? {
                rango: costoLote.conChatGPT ? 'Sin costo por imagen' : rangoDinero(costoLote),
                etiqueta: costoLote.conChatGPT ? 'Con tu ChatGPT' : modoPrueba ? 'Lo que costaría' : 'Costo estimado',
                chica: `Solo ${planPlantillas.escenas === 1 ? 'la escena de 1 anuncio usa' : `las escenas de ${planPlantillas.escenas} anuncios usan`} el modelo de imagen (sin texto${f.conVertical ? '; el vertical usa la misma escena' : ''})${costoLote.conChatGPT ? ', con tu suscripción de ChatGPT' : `, a ${dinero(precio.dolaresPorImagen)} cada una`}. Lo demás lo arma la app gratis.`,
              }
            : costoLote?.conChatGPT
            ? {
                rango: 'Sin costo por imagen',
                etiqueta: 'Con tu ChatGPT',
                chica: 'Las imágenes las hace tu suscripción de ChatGPT: no se cobra por imagen, solo usa tu cupo (cada imagen gasta más o menos 1 % del cupo de 5 horas). Puedes cambiarlo en Ajustes › Conexiones.',
              }
            : costoLote
            ? {
                rango: rangoDinero(costoLote),
                etiqueta: modoPrueba ? 'Lo que costaría' : 'Costo estimado',
                chica: `Con ${precio.modelo || 'GPT Image 2.5'}, ${dinero(precio.dolaresPorImagen)} cada imagen. Si después regeneras alguna, se cobra aparte.`,
              }
            : null
        }
        motor={f.elaborado && !conPlantillas && !deVideo ? motor : { ...motor, falta: false }} // el modo rápido y las plantillas no necesitan la IA de texto
        ocupado={ocupado}
        fase={fase}
        textoBoton={textoBoton}
        onGenerar={generar}
      />
    </div>
  );
}
