// El formulario de "Anuncios de imagen" (#/imagenes/nuevo, Crear.jsx): a la izquierda 5 grupos y a la derecha el panel
// «Tu lote» (ResumenLote.jsx: lo que va a salir, el costo estimado y el único botón, "Generar N anuncios"), que arranca
// todo sin aprobar nada (la IA arma la estrategia, escribe cada anuncio, crea las imágenes, las revisa y las entrega).
//
// Al tocar Generar, en orden (ESPECIFICACION §11.1):
//   1. si la foto es nueva: crea el producto (POST /api/productos, tipo físico, sin analizar) y sube su foto
//   2. POST /api/imagen-ads (el lote queda en borrador)
//   3. PUT de cada referencia, de la investigación de mercado y del logo, de a una
//   4. POST /api/imagen-ads/:lote/generar
//   5. va a la pantalla del lote
// Si algo falla, avisa y se queda aquí recordando el lote ya creado: el reintento no crea otro (si cambiaste algo
// que va en el lote, el borrador viejo se borra y se crea uno nuevo). El formulario (sin las imágenes) se guarda en
// este navegador para la próxima vez.
// En el panel «Tu lote», arriba del botón, el COSTO ESTIMADO del lote (excepción a "sin precios" del 2026-11-09): el
// precio por imagen lo manda el servidor (GET /api/imagen-ads/opciones → costo; el modelo de los lotes es fijo) y se
// recalcula con la cantidad y el formato (costoDelLote). La pantalla del lote sigue sin precios hasta su informe.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, FileText, FileUp, Globe, Images, Megaphone, Sparkles, Tag, TriangleAlert, Users, X } from 'lucide-react';
import { AreaTexto, Boton, CampoTexto, Chip, Interruptor, Pestanas, Selector, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar, useEstado } from '../../datos/api.js';
import { dinero } from '../../datos/formato.js';
import {
  CLAVE_LOTES,
  CLAVE_PRODUCTOS,
  POSICIONES_LOGO,
  POSICION_POR_DEFECTO,
  apiImagenes,
  costoDelLote,
  textoDeCantidad,
  tieneTransparencia,
  useOpcionesImagen,
  useProductosImagen,
} from '../../datos/imagenes.js';
import { LOTE_EJEMPLO, opcionesDeEjemplo, productosDeEjemplo } from '../../datos/imagenes-simulacion.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { rangoDinero } from '../nuevo/CostoEstimado.jsx';
import { useMotor } from '../ajustes/datos.js';
import { ElegirProducto } from './ElegirProducto.jsx';
import { PosicionLogo } from './PosicionLogo.jsx';
import { ResumenLote } from './ResumenLote.jsx';
import { ZonaImagenes, liberarVistas } from './ZonaImagenes.jsx';
import { BibliotecaReferencias } from './BibliotecaReferencias.jsx';

const MONEDAS = ['S/', 'US$', 'MXN $', 'COP $', 'CLP $', 'ARS $', 'R$', '€', 'Q', 'Bs'];
const OPCIONES_MONEDA = [...MONEDAS.map((m) => ({ valor: m, etiqueta: m })), { valor: 'otra', etiqueta: 'Otra' }];
const IDIOMAS = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'en', etiqueta: 'Inglés' },
  { valor: 'pt', etiqueta: 'Portugués' },
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
  precio: '',
  moneda: 'US$',
  monedaOtra: '',
  cta: '',
  pais: '',
  idioma: null,
  adicional: '',
  angulo: '',
  cantidad: '10',
  conVertical: true,
  posicionLogo: POSICION_POR_DEFECTO,
  // la investigación de mercado pegada (un archivo subido no se guarda en el navegador)
  investigacion: '',
  // «Más de lo mismo»: todas las variaciones copian el diseño de tus referencias
  fiel: true,
};

const MAXIMO_INVESTIGACION = 120000;
const PESO_INVESTIGACION = 20 * 1024 * 1024;

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
  const moneda = s(d.moneda);
  return {
    nombre: s(d.nombre),
    publico: s(d.publico),
    precio: s(d.precio),
    ...(moneda ? (MONEDAS.includes(moneda) ? { moneda, monedaOtra: '' } : { moneda: 'otra', monedaOtra: moneda }) : {}),
    cta: s(d.cta),
    pais: s(d.pais),
    ...(['es', 'en', 'pt'].includes(d.idioma) ? { idioma: d.idioma } : {}),
    adicional: s(d.adicional),
    angulo: s(d.angulo),
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

export function Formulario({ simulando = false, productoPedido = null }) {
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
  const [logo, setLogo] = useState([]);
  const [archivoInv, setArchivoInv] = useState(null); // la investigación subida como archivo (.pdf, .docx, .txt, .md)
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  const entradaInv = useRef(null);
  const [transparente, setTransparente] = useState(null);
  const [errores, setErrores] = useState({});
  const [fase, setFase] = useState(null);
  const [nota, setNota] = useState(null);
  const creado = useRef(null); // { firma, lote, refs: { n: id }, logo: id, inv: clave }
  const productoCreado = useRef(null); // { fotoId, id }
  const ocupado = Boolean(fase);

  const poner = (cambios) => {
    setF((x) => ({ ...x, ...cambios }));
    const tocados = Object.keys(cambios);
    setErrores((e) => (tocados.some((k) => e[k]) ? Object.fromEntries(Object.entries(e).filter(([k]) => !tocados.includes(k))) : e));
  };

  // el borrador se guarda en este navegador (sin las imágenes) para la próxima vez
  useEffect(() => {
    // (la investigación pegada no se recuerda: en el próximo lote se usa la del producto, no una vieja)
    if (!simulando) guardarBorrador({ ...f, investigacion: '' });
  }, [f, simulando]);

  // las vistas previas locales se liberan al salir de la pantalla
  const vistas = useRef([]);
  vistas.current = [...fotoNueva, ...referencias, ...logo];
  useEffect(() => () => liberarVistas(vistas.current), []);

  // el idioma por defecto es el de Ajustes (hasta que elijas otro)
  useEffect(() => {
    if (f.idioma === null && opciones) setF((x) => (x.idioma === null ? { ...x, idioma: ['es', 'en', 'pt'].includes(opciones.idiomaPorDefecto) ? opciones.idiomaPorDefecto : 'es' } : x));
  }, [opciones, f.idioma]);

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

  // ¿el logo tiene transparencia? (se mira aquí para avisar enseguida)
  useEffect(() => {
    let vigente = true;
    setTransparente(null);
    if (logo[0]?.archivo) tieneTransparencia(logo[0].archivo).then((t) => vigente && setTransparente(t));
    return () => {
      vigente = false;
    };
  }, [logo]);

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

  const n = Number(f.cantidad);
  const cantidadValida = Number.isInteger(n) && n >= 1 && n <= maximo;
  const angulos = opciones?.angulos || [];
  const anguloElegido = angulos.find((a) => a.id === f.angulo);
  const opcionesAngulo = useMemo(() => [{ valor: '', etiqueta: 'Que lo elija la IA' }, ...angulos.map((a) => ({ valor: a.id, etiqueta: a.nombre }))], [angulos]);

  function validar() {
    const e = {};
    if (!f.productoId && !fotoNueva.length) e.producto = 'Elige tu producto o sube su foto.';
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre de tu producto.';
    if (!f.pais.trim()) e.pais = 'Escribe el país donde vendes.';
    if (!cantidadValida) e.cantidad = `Elige de 1 a ${maximo} anuncios.`;
    if (f.precio.trim() && f.moneda === 'otra' && !f.monedaOtra.trim()) e.monedaOtra = 'Escribe tu moneda.';
    return e;
  }

  const bajarAlPrimero = (e) => {
    const orden = [
      ['producto', 'campo-producto'],
      ['nombre', 'campo-nombre'],
      ['pais', 'campo-pais'],
      ['monedaOtra', 'campo-moneda-otra'],
      ['cantidad', 'campo-cantidad'],
    ];
    const primero = orden.find(([k]) => e[k]);
    const el = primero ? document.getElementById(primero[1]) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el.tagName === 'INPUT') setTimeout(() => el.focus({ preventScroll: true }), 300);
  };

  // la investigación de mercado: un archivo o el texto pegado
  const elegirInvestigacion = (lista) => {
    const a = [...(lista || [])][0];
    if (!a) return;
    if (!/\.(pdf|docx|txt|md)$/i.test(a.name) && !/^text\//.test(a.type)) {
      aviso({ tipo: 'aviso', titulo: 'No puedo leer ese archivo', texto: 'Sube tu investigación en PDF, Word (.docx), .txt o .md, o pega el texto.' });
      return;
    }
    if (a.size > PESO_INVESTIGACION) {
      aviso({ tipo: 'aviso', titulo: 'Ese archivo pesa demasiado', texto: 'El máximo son 20 MB. Pega solo el texto importante.' });
      return;
    }
    setArchivoInv(a);
  };
  const textoInv = f.investigacion.trim();
  const hayInvestigacion = Boolean(archivoInv || textoInv);
  const claveInv = archivoInv ? `a:${archivoInv.name}:${archivoInv.size}:${archivoInv.lastModified}` : textoInv ? `t:${textoInv.length}:${textoInv.slice(0, 40)}:${textoInv.slice(-40)}` : null;
  const lugarRefs = Math.max(0, maxRefs - referencias.length);
  const agregarDeBiblioteca = (archivos) => {
    const nuevos = archivos.slice(0, lugarRefs).map((a) => ({ id: `${a.name}-${a.size}-${Math.random().toString(36).slice(2, 7)}`, archivo: a, nombre: a.name, heic: false, url: URL.createObjectURL(a) }));
    if (nuevos.length) setReferencias((r) => [...r, ...nuevos]);
  };

  const formatos = f.conVertical ? ['1:1', '9:16'] : ['1:1'];
  // el costo estimado: cada imagen (cuadrada o vertical) al precio que manda el servidor (un solo número: la revisión
  // ya no rehace nada sola)
  const precio = opciones?.costo || null;
  const costoLote = cantidadValida ? costoDelLote(precio, n * formatos.length) : null;
  const datosDelLote = () => ({
    nombre: f.nombre.trim(),
    publico: f.publico.trim(),
    precio: f.precio.trim(),
    moneda: f.precio.trim() ? (f.moneda === 'otra' ? f.monedaOtra.trim() : f.moneda) : '',
    cta: f.cta.trim(),
    pais: f.pais.trim(),
    idioma: f.idioma || 'es',
    adicional: f.adicional.trim(),
    angulo: f.angulo || null,
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
    if (motor.falta) {
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
      for (const t of ['Creando tu lote', referencias.length ? 'Subiendo tus referencias' : null, logo.length ? 'Subiendo tu logo' : null, 'Arrancando tu lote'].filter(Boolean)) {
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

      // 2. el lote (borrador). Si cambiaste algo que va en él desde el intento anterior, se arma otro.
      const cuerpo = { productoId, fotoProducto, datos: datosDelLote(), cantidad: n, formatos, logo: logo.length ? { posicion: f.posicionLogo } : null, fiel: Boolean(f.fiel && referencias.length) };
      const firma = JSON.stringify(cuerpo);
      if (creado.current && creado.current.firma !== firma) {
        apiImagenes.borrar(creado.current.lote).catch(() => {});
        creado.current = null;
      }
      if (!creado.current) {
        setFase('Creando tu lote');
        const r = await apiImagenes.crear(cuerpo);
        if (!r?.lote) throw new Error('La app no devolvió tu lote. Vuelve a intentarlo.');
        creado.current = { firma, lote: r.lote, refs: {}, logo: null, inv: null };
        invalidar(CLAVE_LOTES);
      }
      const c = creado.current;

      // 3. las referencias y el logo, de a una
      for (let i = 0; i < referencias.length; i++) {
        const ref = referencias[i];
        if (c.refs[i + 1] === ref.id) continue;
        setFase(referencias.length === 1 ? 'Subiendo tu referencia' : `Subiendo tus referencias (${i + 1} de ${referencias.length})`);
        await apiImagenes.subirReferencia(c.lote, i + 1, ref.archivo);
        c.refs[i + 1] = ref.id;
      }
      for (const sobra of Object.keys(c.refs)
        .map(Number)
        .filter((k) => k > referencias.length)) {
        await apiImagenes.quitarReferencia(c.lote, sobra);
        delete c.refs[sobra];
      }
      if (claveInv && c.inv !== claveInv) {
        setFase('Subiendo tu investigación de mercado');
        await apiImagenes.subirInvestigacion(c.lote, archivoInv || new Blob([textoInv], { type: 'text/plain' }));
        c.inv = claveInv;
      } else if (!claveInv && c.inv) {
        await apiImagenes.quitarInvestigacion(c.lote);
        c.inv = null;
      }
      if (logo.length && c.logo !== logo[0].id) {
        setFase('Subiendo tu logo');
        await apiImagenes.subirLogo(c.lote, logo[0].archivo);
        c.logo = logo[0].id;
      }

      // 4. arranca (409 = ya había arrancado: también está bien)
      setFase('Arrancando tu lote');
      try {
        await apiImagenes.generar(c.lote, costoLote.max);
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
  const productoElegido = !fotoNueva.length && f.productoId ? (productos || []).find((x) => x.id === f.productoId) || null : null;
  const fotoElegida = productoElegido ? (productoElegido.fotos || []).find((x) => Number(x.n) === Number(f.fotoProducto)) || productoElegido.fotos?.[0] : null;
  const posicionLogo = ((opciones?.posiciones || []).find((x) => x.id === f.posicionLogo) || POSICIONES_LOGO.find((x) => x.id === f.posicionLogo) || POSICIONES_LOGO[1]).nombre;

  return (
    <div className="img-crear">
      <Tarjeta variante="elevada" relleno="ninguno" className="img-form">
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
            <div className="img-precio">
              <CampoTexto
                etiqueta="Precio"
                opcional
                inputMode="decimal"
                placeholder="79.90"
                maxLength={40}
                value={f.precio}
                onChange={(e) => poner({ precio: e.target.value })}
                ayuda="Solo aparece en los formatos que muestran precio."
                disabled={ocupado}
              />
              <Selector etiqueta="Moneda" opciones={OPCIONES_MONEDA} value={f.moneda} onChange={(e) => poner({ moneda: e.target.value })} disabled={ocupado} />
              {f.moneda === 'otra' ? (
                <CampoTexto
                  id="campo-moneda-otra"
                  etiqueta="Tu moneda"
                  placeholder="Gs."
                  maxLength={12}
                  value={f.monedaOtra}
                  onChange={(e) => poner({ monedaOtra: e.target.value })}
                  error={errores.monedaOtra}
                  disabled={ocupado}
                  className="img-precio__otra"
                />
              ) : null}
            </div>
            <CampoTexto
              etiqueta="Llamado a la acción"
              opcional
              icono={Megaphone}
              placeholder="Pago contra entrega"
              maxLength={160}
              value={f.cta}
              onChange={(e) => poner({ cta: e.target.value })}
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
            <Selector etiqueta="Idioma de los textos" opciones={IDIOMAS} value={f.idioma || 'es'} onChange={(e) => poner({ idioma: e.target.value })} disabled={ocupado} />
            <Selector
              etiqueta="Ángulo principal"
              opcional
              className="img-campos__ancho"
              opciones={opcionesAngulo}
              value={anguloElegido ? f.angulo : ''}
              onChange={(e) => poner({ angulo: e.target.value })}
              ayuda={anguloElegido?.queAtaca || 'La IA reparte distintos ángulos entre tus anuncios. Si eliges uno, la mayoría va por ahí.'}
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

        <Grupo n={3} id="grupo-investigacion" titulo="Investigación de mercado" opcional>
          {productoElegido?.investigacion && !hayInvestigacion ? (
            <p className="img-nota img-nota--ok" role="status">
              <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                Este producto ya tiene su investigación de mercado{productoElegido.investigacion.pais ? ` (${productoElegido.investigacion.pais})` : ''}: tus anuncios la usan sola, con lo que resaltaste primero.{' '}
                <a href={enlace.investigacion(productoElegido.id)}>Verla</a>. Si pegas o subes otra aquí, se usa esa.
              </span>
            </p>
          ) : productoElegido && !productoElegido.investigacion && !hayInvestigacion ? (
            <p className="img-nota">
              <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                ¿No tienes una? <a href={enlace.investigacion(productoElegido.id)}>Haz la investigación de este producto</a> con solo su foto: queda guardada y la usan todos sus lotes.
              </span>
            </p>
          ) : null}
          {archivoInv ? (
            <div className="img-inv__archivo">
              <FileText size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="img-inv__nombre t-recortar" title={archivoInv.name}>
                {archivoInv.name}
              </span>
              <Boton variante="fantasma" tamano="chico" icono={X} onClick={() => setArchivoInv(null)} disabled={ocupado}>
                Quitar
              </Boton>
            </div>
          ) : (
            <AreaTexto
              etiqueta="Pega aquí tu investigación"
              filas={5}
              maxLength={MAXIMO_INVESTIGACION}
              placeholder="Lo que sabes de tu cliente: qué quiere lograr, qué le duele, qué ha probado, cómo lo dice con sus palabras, reseñas, comentarios…"
              value={f.investigacion}
              onChange={(e) => poner({ investigacion: e.target.value })}
              disabled={ocupado}
            />
          )}
          <div className="img-zona__acciones">
            <Boton variante="secundario" tamano="chico" icono={FileUp} onClick={() => entradaInv.current?.click()} disabled={ocupado}>
              {archivoInv ? 'Cambiar el archivo' : 'Subir un archivo'}
            </Boton>
            <input
              ref={entradaInv}
              type="file"
              accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
              hidden
              onChange={(e) => {
                elegirInvestigacion(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          <p className="img-ayuda">
            PDF, Word (.docx), .txt o .md, o pega el texto. De ahí la IA saca el <strong>deseo central</strong>, el <strong>beneficio principal</strong> y los <strong>puntos de dolor</strong>, y
            escribe los textos de tus anuncios con eso. Los ves en «Ver estrategia».
          </p>
        </Grupo>

        <Grupo n={4} id="grupo-cantidad" titulo="Cuántos y en qué tamaño">
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
          <Interruptor
            activado={Boolean(f.fiel)}
            onCambio={(v) => poner({ fiel: v })}
            etiqueta="Más de lo mismo"
            descripcion={
              f.fiel
                ? 'Todos tus anuncios copian el diseño de tus referencias: la misma estructura y la misma tipografía, con tu producto y textos nuevos.'
                : 'Cada referencia da un anuncio con su estructura; los demás salen de otros formatos de la biblioteca de la IA.'
            }
            deshabilitado={ocupado || !referencias.length}
            className="img-fiel"
          />
          <BibliotecaReferencias abierta={bibliotecaAbierta} onCerrar={() => setBibliotecaAbierta(false)} lugar={lugarRefs} onElegir={agregarDeBiblioteca} />
          {cantidadValida && referencias.length > n && !f.fiel ? (
            <p className="img-nota img-nota--aviso">
              <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
              Subiste {referencias.length} y pediste {n}: se usan las {n === 1 ? 'primera' : `${n} primeras`}.
            </p>
          ) : null}
        </Grupo>

        <Grupo n={6} id="grupo-logo" titulo="Logo" opcional>
          <ZonaImagenes archivos={logo} onCambiar={setLogo} max={1} titulo="Sube tu logo" bloqueada={ocupado} ayuda="De preferencia PNG sin fondo." masculino />
          {logo.length && transparente === false ? (
            <p className="img-nota img-nota--aviso" role="status">
              <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
              Tu logo tiene fondo: se verá como un recuadro. Si puedes, súbelo en PNG sin fondo.
            </p>
          ) : null}
          <PosicionLogo
            valor={f.posicionLogo}
            onCambiar={(p) => poner({ posicionLogo: p })}
            posiciones={opciones?.posiciones}
            deshabilitada={!logo.length || ocupado}
            logoUrl={logo[0]?.url}
            conVertical={f.conVertical}
          />
          <p className="img-ayuda">La posición queda fija para este lote. En el vertical, el logo va un poco más adentro para que Instagram y TikTok no lo tapen.</p>
        </Grupo>
      </Tarjeta>

      <ResumenLote
        producto={{ nombre: f.nombre.trim() || productoElegido?.nombre || '', foto: fotoNueva[0]?.url || fotoElegida?.url || null, nueva: Boolean(fotoNueva.length) }}
        cantidad={{ valida: cantidadValida, n, maximo }}
        conVertical={f.conVertical}
        logo={logo.length ? { url: logo[0].url, posicion: posicionLogo } : null}
        referencias={referencias}
        costo={
          costoLote?.conChatGPT
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
        motor={motor}
        ocupado={ocupado}
        fase={fase}
        textoBoton={textoBoton}
        onGenerar={generar}
      />
    </div>
  );
}
