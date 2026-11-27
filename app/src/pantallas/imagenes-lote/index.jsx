// #/imagenes/:lote — un lote de "Anuncios de imagen" en una sola pantalla: arriba el avance (frase, barra, etapas,
// Detener/Continuar y lo que lo frena), abajo la galería que se va llenando con cada imagen apenas existe, y al
// terminar el informe (el único lugar con el costo). Pasa de avance a galería sin redirigir.
//
// Mira GET /api/imagen-ads/:lote cada 2 s mientras el lote está en la fila, creándose o con un cambio en camino
// (y unos segundos después de tocar algo); si no, no pide nada.
//   ?simular=1  el lote de ejemplo (src/datos/imagenes-simulacion.js): avanza solo y no se le pide nada al servidor
import { AgenteLote } from './AgenteLote.jsx';
import { AnalisisGanador } from './AnalisisGanador.jsx';
import { ComparacionLote } from './ComparacionLote.jsx';
import { SupervisorLote } from './SupervisorLote.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ImageOff, ImagePlus, MessagesSquare, Play, RotateCcw, SearchX, Sparkles, Trash2, Unplug } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto, EsqueletoMiniaturas, EstadoVacio, Modal, VistaPrevia, useAvisos, useBarraSuperior } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { CLAVE_LOTES, apiImagenes, claveLote, copiarDesde, loteActivo, partesDePieza, porNumero, useLote, useOpcionesImagen, costoDelLote } from '../../datos/imagenes.js';
import { useLoteSimulado, opcionesDeEjemplo } from '../../datos/imagenes-simulacion.js';
import { plural, dinero } from '../../datos/formato.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { MarcaModoPrueba } from '../produccion/ModoPrueba.jsx';
import { Avance } from './Avance.jsx';
import { Galeria } from './Galeria.jsx';
import { InformeLote } from './InformeLote.jsx';
import { ModalRegenerar } from './ModalRegenerar.jsx';
import { ModalMas } from './ModalMas.jsx';
import { ModalTextos } from './ModalTextos.jsx';
import { PanelEstrategia } from './PanelEstrategia.jsx';
import { Visor } from './Visor.jsx';
import { LoteFunciona } from '../../datos/funcionan.js';
import '../produccion/produccion.css';
import './lote.css';

const TEXTO_COPIADO = 'Si lo usas en otra herramienta, adjunta la foto de tu producto (y en el vertical, también el cuadrado).';

/** Unos segundos mirando más seguido después de tocar algo (el servidor tarda un instante en anotarlo). */
function useGracia(ms = 15000) {
  const [activa, setActiva] = useState(false);
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  const despertar = useCallback(() => {
    setActiva(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setActiva(false), ms);
  }, [ms]);
  return [activa, despertar];
}

export default function PantallaLote({ params, consulta }) {
  const lote = params.lote;
  const simulando = consulta?.get('simular') === '1';
  const { aviso } = useAvisos();
  const [gracia, despertar] = useGracia();
  const [activo, setActivo] = useState(false);
  const real = useLote(simulando ? null : lote, { cadaMs: activo || gracia ? 2000 : undefined });
  const sim = useLoteSimulado(simulando ? lote : null, consulta);
  const fuente = simulando ? sim : real;
  const vista = fuente.datos;
  const opciones = useOpcionesImagen();
  const precio = simulando ? opcionesDeEjemplo().costo : opciones.datos?.costo;
  useEffect(() => setActivo(Boolean(vista) && loteActivo(vista)), [vista]);

  const volver = enlace.imagenes(simulando ? { simular: '1' } : undefined);
  useBarraSuperior({ migas: [{ texto: 'Anuncios de imagen', href: volver }, { texto: vista?.titulo || 'Tu lote' }] });

  const [filtro, setFiltro] = useState('juntos');
  const [visor, setVisor] = useState(null); // { v, formato }
  const [aRegenerar, setARegenerar] = useState(null); // la pieza
  // (2026-11-26i) la ventana «Más imágenes»: null cerrada, { base } abierta (base null = sin elegir)
  const [mas, setMas] = useState(null);
  const [aEditar, setAEditar] = useState(null); // la variación de una plantilla (Editar textos)
  const [verEstrategia, setVerEstrategia] = useState(false);
  const [ocupado, setOcupado] = useState(null); // 'continuar' | 'detener' | 'generar' | 'borrar'
  const [borrar, setBorrar] = useState(false);
  const [aConfirmar, setAConfirmar] = useState(null);
  const entradaLogo = useRef(null); // el selector de archivo de "Cambiar el logo"

  // lo que se hace con el lote: contra el servidor, o contra la simulación
  const acciones = useMemo(
    () =>
      simulando
        ? { ...sim.acciones, tamano: async () => { throw new Error('En la vista de ejemplo no se crean imágenes.'); }, mas: async () => { throw new Error('En la vista de ejemplo no se crean imágenes.'); } }
        : {
            tamano: (cuerpo) => apiImagenes.tamano(lote, cuerpo),
            mas: (cuerpo) => apiImagenes.mas(lote, cuerpo),
            regenerar: (cuerpo) => apiImagenes.regenerar(lote, cuerpo),
            textos: (v, textos) => apiImagenes.textos(lote, v, textos),
            pulir: (v, costo) => apiImagenes.pulir(lote, v, costo),
            continuar: () => apiImagenes.continuar(lote),
            detener: () => apiImagenes.detener(lote),
            prompt: (pieza, op) => apiImagenes.prompt(lote, pieza, op),
          },
    [simulando, sim.acciones, lote]
  );
  const alCambiar = useCallback(() => {
    invalidar(claveLote(lote));
    invalidar(CLAVE_LOTES);
    despertar();
    return fuente.recargar();
  }, [lote, despertar, fuente]);

  const hacer = async (que, accion, { ok, error } = {}) => {
    setOcupado(que);
    try {
      await accion();
      if (ok) aviso({ tipo: 'ok', ...ok });
      await alCambiar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: error || 'No pude hacerlo', texto: e.message });
    } finally {
      setOcupado(null);
    }
  };
  const continuar = () => hacer('continuar', acciones.continuar, { ok: { titulo: 'Sigo con tu lote', texto: 'Lo que ya estaba hecho no se repite ni se vuelve a pagar.' }, error: 'No pude continuar' });
  const detener = () =>
    hacer('detener', acciones.detener, { ok: { titulo: 'Lo detuve', texto: 'Toca «Continuar» cuando quieras: sigue desde donde quedó.' }, error: 'No pude detenerlo' });

  /** Copia el prompt (o el anuncio en JSON) sin mostrarlo. Se llama directo en el clic: no pierde el gesto. */
  const copiar = (p, { version, como } = {}) => {
    const promesa = acciones.prompt(p.pieza, { version, como }).then((r) => r?.texto ?? '');
    copiarDesde(promesa).then(
      () => aviso({ tipo: 'ok', titulo: como === 'json' ? 'Anuncio copiado' : 'Prompt copiado', texto: como === 'json' ? 'Es la ficha completa de este anuncio, para guardarla o usarla en otra herramienta.' : TEXTO_COPIADO, duracion: 6500 }),
      (e) => aviso({ tipo: 'error', titulo: 'No pude copiarlo', texto: e?.message || 'Vuelve a intentarlo.' })
    );
  };

  const confirmarCosto = (titulo, cantidad, accion) => {
    const costo = costoDelLote(precio, cantidad);
    if (!costo) {
      aviso({ tipo: 'aviso', titulo: 'Falta calcular el costo', texto: 'Recarga la pantalla para consultar el precio antes de generar.' });
      return;
    }
    setAConfirmar({ titulo, costo: costo.max, accion });
  };
  const escribirDeNuevo = (v) => confirmarCosto(`Escribir y generar ${v}`, (vista?.brief?.formatos || ['1:1']).length, (costoMaximoConfirmado) =>
    hacer('escribir', () => acciones.regenerar({ v, tipo: 'prompt', costoMaximoConfirmado }), { ok: { titulo: `Escribo de nuevo ${v}`, texto: 'Cuando esté, se crean sus imágenes solas.' }, error: 'No pude pedirlo' }));

  // (2026-11-26j) «Cambiar el tamaño» de una imagen: 1 imagen; queda como versión nueva de la misma (la de antes, en
  // «Versiones anteriores», como después de una edición)
  const NOMBRE_TAMANO = { '1:1': 'cuadrado 1:1', '9:16': 'vertical 9:16', '4:5': 'retrato 4:5' };
  const pedirTamano = (pieza, formato) => {
    const { v } = partesDePieza(pieza);
    setARegenerar(null);
    confirmarCosto(`Pasar ${v} a ${NOMBRE_TAMANO[formato]}`, 1, (costoMaximoConfirmado) =>
      hacer('tamano', () => acciones.tamano({ pieza, formato, costoMaximoConfirmado }), { ok: { titulo: `Paso ${v} a ${NOMBRE_TAMANO[formato]}`, texto: 'Con los mismos textos. La de ahora queda en «Versiones anteriores» (ábrela en grande).' }, error: 'No pude pedirlo' }));
  };

  // (2026-11-26i) «Más imágenes en este lote»: nuevos o variantes de una imagen (1-10), con su costo antes
  const pedirMas = ({ modo, cantidad, base, funcionan, imagenes }) => {
    setMas(null);
    confirmarCosto(modo === 'variantes' ? `${cantidad} ${cantidad === 1 ? 'variante' : 'variantes'} de ${base}` : `${cantidad} ${cantidad === 1 ? 'anuncio nuevo' : 'anuncios nuevos'} en este lote`, imagenes, (costoMaximoConfirmado) =>
      hacer('mas', () => acciones.mas({ modo, cantidad, base, funcionan, costoMaximoConfirmado }), {
        ok: { titulo: modo === 'variantes' ? `Creo ${cantidad} ${cantidad === 1 ? 'variante' : 'variantes'} de ${base}` : `Creo ${cantidad} ${cantidad === 1 ? 'anuncio nuevo' : 'anuncios nuevos'}`, texto: 'Aparecen abajo, al final del lote. Las que ya tienes no cambian.' },
        error: 'No pude pedirlas',
      }));
  };

  const confirmacionCosto = (
    <Modal abierto={Boolean(aConfirmar)} titulo={aConfirmar?.titulo || 'Confirmar generación'} onCerrar={() => setAConfirmar(null)} pie={<>
      <Boton variante="fantasma" onClick={() => setAConfirmar(null)}>Cancelar</Boton>
      <Boton variante="primario" onClick={() => { const a = aConfirmar; setAConfirmar(null); a?.accion(a.costo); }}>Confirmar y generar</Boton>
    </>}>
      <p>Costo estimado: {dinero(aConfirmar?.costo || 0)}. Solo se cobra esta generación.</p>
    </Modal>
  );

  /** El pedido de "Regenerar": lo tira de vuelta si falla (el modal muestra por qué, p. ej. el 409). */
  const pedirRegenerar = async (p, instruccion, costoMaximoConfirmado, adjuntos = []) => {
    const r = await acciones.regenerar({ pieza: p.pieza, ...(instruccion ? { instruccion } : {}), ...(adjuntos.length ? { adjuntos } : {}), costoMaximoConfirmado });
    if (r?.gratis) {
      aviso({ tipo: 'ok', titulo: 'Otra versión lista', texto: `La app la dibujó con otros textos${r.ms ? ` en ${(r.ms / 1000).toFixed(1)} s` : ''}, sin costo.`, duracion: 5000 });
    } else if (r?.pedido?.estado === 'en-espera') {
      aviso({ tipo: 'info', titulo: 'Pedido guardado', texto: 'El lote está detenido: se hace cuando toques «Continuar».', duracion: 6500 });
    } else {
      aviso({ tipo: 'ok', titulo: 'Pedido enviado', texto: 'La IA lo prepara y aquí te aviso cómo quedó. Si la imagen cambia, la anterior queda en Versiones anteriores.', duracion: 6500 });
    }
    setARegenerar(null);
    alCambiar();
  };

  /** «Editar textos» de una plantilla: la app la vuelve a dibujar (1-2 s, sin IA y sin costo). */
  const guardarTextos = async (v, textos) => {
    if (!acciones.textos) throw new Error('En la vista de ejemplo no se guarda nada.');
    const r = await acciones.textos(v, textos);
    setAEditar(null);
    aviso({ tipo: 'ok', titulo: `Listo: ${v}`, texto: `Dibujada de nuevo${r?.ms ? ` en ${(r.ms / 1000).toFixed(1)} s` : ''}, sin costo.`, duracion: 5000 });
    await alCambiar();
  };

  // Cuando un pedido que viste en camino termina, te aviso cómo quedó (sobre todo si no se pudo hacer, y por qué).
  const pedidosVistos = useRef(null); // id -> estado de la lectura anterior
  useEffect(() => {
    const lista = vista?.pedidos;
    if (!Array.isArray(lista)) return;
    const antes = pedidosVistos.current;
    pedidosVistos.current = new Map(lista.map((x) => [x.id, x.estado]));
    if (!antes) return; // la primera lectura: lo que ya había terminado no se avisa
    for (const x of lista) {
      const previo = antes.get(x.id);
      if (!previo || previo === x.estado || ['listo', 'no-aplicado'].includes(previo)) continue;
      const que = x.pieza ? partesDePieza(x.pieza).nombre : x.v || 'tu anuncio';
      if (x.estado === 'no-aplicado') aviso({ tipo: 'error', titulo: `No se hizo el cambio en ${que}`, texto: x.motivo || 'No se pudo hacer este cambio.', duracion: 9000 });
      // (lo pedido con «Corregir esto»: se dice así, no con lo que escribió la caja)
      else if (x.estado === 'listo') aviso({ tipo: 'ok', titulo: `Listo: ${que}`, texto: x.corrige ? 'Corregí lo que notó la revisión. La versión anterior queda en Versiones anteriores.' : x.resumen || 'Ya está la versión nueva.', duracion: 6500 });
    }
  }, [vista?.pedidos, aviso]);

  /** Cambiar el archivo del logo (misma posición) o quitarlo: el servidor rehace las imágenes con logo, gratis (§8). */
  const cambiarLogo = async (archivo) => {
    if (!archivo) return;
    setOcupado('logo');
    try {
      const r = await apiImagenes.subirLogo(lote, archivo);
      aviso(
        r?.transparente === false
          ? { tipo: 'info', titulo: 'Cambié tu logo', texto: 'Tiene fondo: se verá como un recuadro. Si puedes, súbelo en PNG sin fondo.', duracion: 8000 }
          : { tipo: 'ok', titulo: 'Cambié tu logo', texto: 'En un momento queda en todas tus imágenes, en el mismo lugar. No se paga nada.' }
      );
      await alCambiar();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude cambiar tu logo', texto: e.message });
    } finally {
      setOcupado(null);
      if (entradaLogo.current) entradaLogo.current.value = '';
    }
  };
  const quitarLogo = () =>
    hacer('quitar-logo', () => apiImagenes.quitarLogo(lote), {
      ok: { titulo: 'Quité tu logo', texto: 'Tus imágenes quedan limpias. Puedes volver a ponerlo cuando quieras, en el mismo lugar.' },
      error: 'No pude quitar tu logo',
    });

  const descargarSimulado = () => aviso({ tipo: 'info', titulo: 'En la simulación no hay archivos', texto: 'En un lote de verdad baja un zip con todas las imágenes.' });

  // ---------------------------------------------------------------- cargando, sin lote, borrador

  if (!vista && (fuente.cargando || !fuente.leido)) {
    return (
      <div className="pagina lote" aria-busy="true">
        <div className="pila" style={{ '--hueco': '12px', maxWidth: 520 }}>
          <Esqueleto forma="texto" ancho={120} alto={10} />
          <Esqueleto ancho="60%" alto={34} />
          <Esqueleto forma="texto" ancho="80%" />
        </div>
        <Esqueleto alto={220} />
        <EsqueletoMiniaturas cantidad={4} min={240} />
      </div>
    );
  }
  if (!vista) {
    const noEsta = real.error?.estado === 404;
    return (
      <div className="pagina lote">
        <EstadoVacio
          icono={noEsta ? SearchX : Unplug}
          tono={noEsta ? 'acento' : 'error'}
          titulo={noEsta ? 'No encuentro este lote' : 'No pude abrir este lote'}
          descripcion={noEsta ? 'Puede que el enlace esté incompleto o que lo hayas borrado. Tus lotes están en Anuncios de imagen.' : real.error?.message || 'Vuelve a intentarlo.'}
          acciones={
            <>
              {!noEsta ? (
                <Boton variante="primario" icono={RotateCcw} onClick={() => real.recargar()}>
                  Volver a intentarlo
                </Boton>
              ) : null}
              <Boton variante={noEsta ? 'primario' : 'secundario'} href={enlace.imagenes()}>
                Ir a Anuncios de imagen
              </Boton>
            </>
          }
        />
      </div>
    );
  }

  const c = vista.conductor;
  const brief = vista.brief || {};
  const conVertical = (brief.formatos || []).includes('9:16');
  // «Hacer otro lote»: el formulario con el mismo producto (#/imagenes/nuevo?producto=<id>)
  const enlaceOtro = enlace.crearImagenes(vista.producto?.id ? { producto: vista.producto.id, ...(simulando ? { simular: '1' } : {}) } : simulando ? { simular: '1' } : undefined);
  const descripcion = `${plural(Number(brief.cantidad) || vista.variaciones?.length || 0, 'anuncio', 'anuncios')} · ${conVertical ? 'cuadrado y vertical' : 'cuadrado'} · ${brief.logo?.url ? 'con tu logo' : 'sin logo'}`;

  const conLogoEditable = Boolean(brief.logo) && !simulando && Boolean(c) && c.estado !== 'borrador';
  // arriba «← Anuncios de imagen», como en «Crear anuncios de imagen» (en el celular las migas no muestran la sección)
  const cabecera = (
    <div className="lote__arriba">
      <Boton variante="fantasma" tamano="chico" icono={ArrowLeft} href={volver} className="lote__volver">
        Anuncios de imagen
      </Boton>
      <CabeceraPagina
        titulo={vista.titulo || 'Tu lote'}
        descripcion={descripcion}
        extra={
          simulando || vista.modoPrueba ? (
            <div className="fila fila--envolver lote__marcas" style={{ '--hueco': '8px' }}>
              {simulando ? (
                <VistaPrevia texto="Simulación" explicacion="Vista previa del diseño: un lote de ejemplo que avanza solo y acelerado. Las imágenes son dibujos de ejemplo; no se le pide nada a kie ni a tu IA." />
              ) : null}
              {vista.modoPrueba ? <MarcaModoPrueba /> : null}
            </div>
          ) : null
        }
        acciones={
          conLogoEditable || vista.estrategia || brief.chat ? (
            <div className="fila fila--envolver" style={{ '--hueco': '8px' }}>
              {/* el logo de un lote ya empezado: cambiar el archivo o quitarlo (la posición quedó fija al crear las imágenes) */}
              {conLogoEditable ? (
                <>
                  <Boton variante="fantasma" icono={ImagePlus} cargando={ocupado === 'logo'} disabled={Boolean(ocupado)} onClick={() => entradaLogo.current?.click()}>
                    {brief.logo.url ? 'Cambiar el logo' : 'Volver a poner el logo'}
                  </Boton>
                  {brief.logo.url ? (
                    <Boton variante="fantasma" icono={ImageOff} cargando={ocupado === 'quitar-logo'} disabled={Boolean(ocupado)} onClick={quitarLogo}>
                      Quitar el logo
                    </Boton>
                  ) : null}
                  <input ref={entradaLogo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => cambiarLogo(e.target.files?.[0])} />
                </>
              ) : null}
              {brief.chat ? (
                <Boton variante="fantasma" icono={MessagesSquare} href={enlace.chatImagenes(brief.chat)}>
                  Abrir el chat
                </Boton>
              ) : null}
              {vista.estrategia ? (
                <Boton variante="fantasma" icono={Sparkles} onClick={() => setVerEstrategia(true)}>
                  Ver estrategia
                </Boton>
              ) : null}
            </div>
          ) : null
        }
      />
    </div>
  );

  // un borrador: se creó pero no arrancó (algo falló al subir las imágenes). Nada se pagó. (El servidor lo manda
  // como conductor { estado: 'borrador' }; sin conductor, también.)
  // (2026-11-27a) el lote de un chat de imágenes que todavía no tiene imágenes: se pide desde el chat
  if (brief.chat && (!c || c.estado === 'borrador')) {
    return (
      <div className="pagina lote">
        {cabecera}
        <EstadoVacio icono={MessagesSquare} titulo="Las imágenes de este chat aparecen aquí" descripcion="Pídelas en el chat: se crean solas y quedan en esta carpeta." acciones={<Boton variante="primario" icono={MessagesSquare} href={enlace.chatImagenes(brief.chat)}>Abrir el chat</Boton>} />
      </div>
    );
  }
  if (!c || c.estado === 'borrador') {
    return (
      <div className="pagina lote">
        {cabecera}
        {confirmacionCosto}
        <EstadoVacio
          icono={ImageOff}
          titulo="Este lote todavía no empezó"
          descripcion="Se guardó, pero no llegó a arrancar: no se hizo ni se pagó nada. Puedes arrancarlo ahora o borrarlo y armar otro."
          acciones={
            <>
              <Boton
                variante="primario"
                icono={Play}
                cargando={ocupado === 'generar'}
                onClick={() => confirmarCosto('Generar este lote', brief.cantidad * brief.formatos.length, (costo) => hacer('generar', () => apiImagenes.generar(lote, costo).catch((e) => (e?.estado === 409 ? null : Promise.reject(e))), { ok: { titulo: 'Arrancó tu lote' }, error: 'No pude arrancarlo' }))}
              >
                Arrancar ahora
              </Boton>
              <Boton variante="secundario" icono={Trash2} onClick={() => setBorrar(true)}>
                Borrar
              </Boton>
            </>
          }
        />
        <Modal
          abierto={borrar}
          onCerrar={() => (ocupado ? null : setBorrar(false))}
          tamano="chico"
          icono={Trash2}
          tono="error"
          titulo="¿Borrar este borrador?"
          descripcion="No se hizo ni se pagó nada. Se borra su carpeta y no se puede deshacer."
          pie={
            <>
              <Boton variante="fantasma" onClick={() => setBorrar(false)} disabled={Boolean(ocupado)}>
                Cancelar
              </Boton>
              <Boton
                variante="peligro"
                icono={Trash2}
                cargando={ocupado === 'borrar'}
                onClick={async () => {
                  setOcupado('borrar');
                  try {
                    await apiImagenes.borrar(lote);
                    invalidar(CLAVE_LOTES);
                    ir(rutas.imagenes());
                  } catch (e) {
                    aviso({ tipo: 'error', titulo: 'No pude borrarlo', texto: e.message });
                    setOcupado(null);
                  }
                }}
              >
                Sí, borrarlo
              </Boton>
            </>
          }
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- el lote

  const variaciones = [...(vista.variaciones || [])].sort(porNumero);
  // (2026-11-26i) «Más imágenes»: en los lotes que arma la IA, ya empezados (no en plantillas, rápidos ni Desde 0)
  const puedeMas = !simulando && !brief.plantillas && !brief.rapido && !brief.desde0 && Boolean(c) && c.estado !== 'borrador';
  const abrir = (pieza) => {
    const { v, formato } = partesDePieza(pieza);
    setVisor({ v, formato });
  };
  const moverVisor = (paso) =>
    setVisor((s) => {
      if (!s) return s;
      const i = variaciones.findIndex((x) => x.v === s.v);
      const siguiente = variaciones[Math.min(variaciones.length - 1, Math.max(0, i + paso))];
      return siguiente ? { ...s, v: siguiente.v } : s;
    });

  return (
    <LoteFunciona.Provider value={simulando ? null : lote}>
    <div className="pagina lote">
      {real.error && real.datos && !simulando ? (
        <div className="lote-cerrada" role="alert">
          <Unplug size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>
            <strong>No me puedo conectar con la app.</strong> Si la cerraste, ábrela de nuevo: tu lote sigue donde quedó y no se paga dos veces. Lo de abajo es lo último que se vio.
          </span>
        </div>
      ) : null}
      {cabecera}
      <Avance vista={vista} simulando={simulando} onContinuar={continuar} onDetener={detener} ocupado={ocupado} enlaceOtro={enlaceOtro} />
      <AnalisisGanador vista={vista} />
      <ComparacionLote vista={vista} onRehacer={(p) => setARegenerar(p)} />
      <SupervisorLote vista={vista} />
      <AgenteLote vista={vista} />
      <Galeria
        vista={vista}
        variaciones={variaciones}
        filtro={filtro}
        onFiltro={setFiltro}
        onAbrir={abrir}
        onRegenerar={(p, op) => setARegenerar(op?.corregir ? { ...p, corregirAlAbrir: true } : p)}
        onCopiar={copiar}
        onEscribir={escribirDeNuevo}
        escribiendo={ocupado === 'escribir'}
        enlaceOtro={enlaceOtro}
        urlDescarga={simulando ? null : (op) => apiImagenes.urlDescarga(lote, op)}
        onDescargarSimulado={descargarSimulado}
        onEditarTextos={(x) => setAEditar(x)}
        onMas={puedeMas ? () => setMas({ base: null }) : null}
        onMasComoEsta={puedeMas ? (v) => setMas({ base: v }) : null}
        onPulir={(x) =>
          confirmarCosto(`Pulir ${x.v} con IA`, 1, (costoMaximoConfirmado) =>
            hacer('pulir', () => acciones.pulir(x.v, costoMaximoConfirmado), { ok: { titulo: `Puliendo ${x.v}`, texto: 'El modelo rehace el cuadro limpio y nítido (sin texto); la app le vuelve a poner tus textos.' }, error: 'No pude pedirlo' })
          )
        }
      />
      {vista.informe ? <InformeLote vista={vista} onRegenerar={(p) => setARegenerar(p)} onAbrir={abrir} onEscribir={escribirDeNuevo} escribiendo={ocupado === 'escribir'} /> : null}

      <Visor
        vista={vista}
        variaciones={variaciones}
        abierto={visor}
        onCerrar={() => setVisor(null)}
        onIr={moverVisor}
        onFormato={(formato) => setVisor((s) => (s ? { ...s, formato } : s))}
        onRegenerar={(p) => {
          // (un modal a la vez: el visor se cierra y se abre el de regenerar)
          setVisor(null);
          setARegenerar(p);
        }}
        onCopiar={copiar}
        simulando={simulando}
      />
      {confirmacionCosto}
      <ModalTextos variacion={aEditar} onGuardar={guardarTextos} onCerrar={() => setAEditar(null)} />
      <ModalMas abierto={Boolean(mas)} baseInicial={mas?.base || null} variaciones={variaciones} formatos={(brief.formatos || ['1:1']).length} precio={precio} productoId={vista?.producto?.id || null} ocupado={ocupado === 'mas'} onCerrar={() => setMas(null)} onConfirmar={pedirMas} />
      <ModalRegenerar onMasComoEsta={puedeMas ? (v) => { setARegenerar(null); setMas({ base: v }); } : null} pieza={aRegenerar} conVertical={conVertical} precio={precio} onTamano={brief.plantillas ? null : pedirTamano} lote={simulando ? null : lote} productoId={vista?.producto?.id || null} onCerrar={() => setARegenerar(null)} onConfirmar={pedirRegenerar} />
      <PanelEstrategia estrategia={vista.estrategia} abierto={verEstrategia && Boolean(vista.estrategia)} onCerrar={() => setVerEstrategia(false)} />
    </div>
    </LoteFunciona.Provider>
  );
}
