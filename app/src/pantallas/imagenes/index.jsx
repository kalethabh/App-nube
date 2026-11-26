// #/imagenes — la portada de "Anuncios de imagen", a todo el ancho: arriba el título y «Crear anuncios de imagen»
// (abre #/imagenes/nuevo, el formulario); abajo "Tus lotes" (una cuadrícula con el mosaico de cada lote, que se ve sin
// bajar) con la fila "Tus productos" encima (chips, como los filtros de «Mis anuncios»: tocar uno deja solo sus lotes y
// ofrece «Crear más con este producto», que abre el formulario con él). Sin lotes, una bienvenida en 3 pasos con el
// botón grande.
//   #/imagenes?producto=<id>   (enlace de antes) pasa a #/imagenes/nuevo?producto=<id>
//   #/imagenes?simular=1       la vista previa del diseño, con productos y lotes de ejemplo (no se guarda nada)
//   …&vacio=1                  la vista previa sin lotes (la bienvenida)
import { useEffect, useMemo, useState } from 'react';
import { ChartNoAxesCombined, Images, Package, PenLine, Plus, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { Boton, CabeceraPagina, Esqueleto, EsqueletoMiniaturas, EstadoVacio, VistaPrevia, useAvisos } from '../../componentes/index.js';
import { apiImagenes, useLotes, useProductosImagen } from '../../datos/imagenes.js';
import { lotesDeEjemplo, productosDeEjemplo } from '../../datos/imagenes-simulacion.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { mayuscula, useMotor } from '../ajustes/datos.js';
import { TusLotes, loteEnMarcha, ordenarLotes } from './TusLotes.jsx';
import { TusProductos, agruparPorProducto, nombreDelGrupo, resumenDelGrupo } from './TusProductos.jsx';
import './imagenes.css';

const PASOS = [
  { icono: Package, titulo: 'Elige tu producto', texto: 'Uno que ya tengas en la app o la foto de uno nuevo.' },
  { icono: PenLine, titulo: 'Cuenta cómo se vende', texto: 'Público, precio, país y cuántos anuncios quieres.' },
  { icono: Sparkles, titulo: 'La IA hace el resto', texto: 'Arma la estrategia, crea cada imagen en cuadrado y, si quieres, también en vertical, y las revisa.' },
];

/**
 * (2026-11-26a) «Aprender de mis ventas»: lee tus anuncios en Meta (SEP), reconoce en su nombre el formato y el ángulo
 * (el nombre de descarga: producto_V03-F17-ugc-selfie-transformacion.png) y guarda lo que más vendió de cada producto.
 * Los lotes nuevos de «Vecinas» y «Conceptos» lo priorizan y prueban siempre 3 combinaciones nuevas.
 */
function AprenderDeVentas() {
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState(false);
  const aprender = async () => {
    setOcupado(true);
    try {
      const r = await apiImagenes.aprenderDeVentas();
      const productos = Object.keys(r?.productos || {}).length;
      aviso(
        r?.reconocidos
          ? { tipo: 'exito', titulo: 'Listo: aprendí de tus ventas', texto: `Reconocí ${r.reconocidos} de tus ${r.anuncios} anuncios en Meta (${productos} producto${productos === 1 ? '' : 's'}). Tus próximos lotes priorizan lo que más vendió.` }
          : { tipo: 'info', titulo: 'Todavía no reconozco tus anuncios', texto: `Leí ${r?.anuncios || 0} anuncios en Meta, pero ninguno tiene el nombre con el que la app descarga las imágenes (por ejemplo producto_V03-F17-ugc-selfie-transformacion). Súbelas a Meta con ese nombre.` },
      );
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude leer tus ventas', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Boton variante="secundario" icono={ChartNoAxesCombined} cargando={ocupado} onClick={aprender}>
      Aprender de mis ventas
    </Boton>
  );
}

function Bienvenida({ hrefCrear }) {
  return (
    <EstadoVacio
      icono={Images}
      titulo="Crea tus primeros anuncios de imagen"
      descripcion="Con una foto de tu producto, la IA arma un lote de anuncios listos para publicar en Facebook, Instagram y TikTok."
      className="img-bienvenida"
      acciones={
        <Boton variante="primario" tamano="grande" icono={Plus} href={hrefCrear}>
          Crear anuncios de imagen
        </Boton>
      }
    >
      <ol className="img-pasos">
        {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
          <li key={titulo} className="img-paso">
            <span className="img-paso__icono" aria-hidden="true">
              <Icono size={18} strokeWidth={2} />
            </span>
            <span className="img-paso__n t-num" aria-hidden="true">
              {i + 1}
            </span>
            <strong className="img-paso__titulo">{titulo}</strong>
            <span className="img-paso__texto">{texto}</span>
          </li>
        ))}
      </ol>
    </EstadoVacio>
  );
}

function Cargando() {
  return (
    <div className="pila" style={{ '--hueco': 'var(--e-5)' }} aria-busy="true">
      <Esqueleto ancho={140} alto={22} />
      <div className="img-filtro">
        {[90, 150, 130, 160].map((ancho, i) => (
          <Esqueleto key={i} ancho={ancho} alto={40} />
        ))}
      </div>
      <EsqueletoMiniaturas cantidad={8} min={220} />
    </div>
  );
}

export default function PantallaImagenes({ consulta }) {
  const simulando = consulta?.get('simular') === '1';
  const vacio = simulando && consulta?.get('vacio') === '1';
  const pedido = consulta?.get('producto') || null;
  const ia = mayuscula(useMotor().nombre);

  // un enlace de antes (#/imagenes?producto=<id>, "Hacer otro lote") abre el formulario nuevo con ese producto
  useEffect(() => {
    if (pedido) ir(rutas.crearImagenes({ producto: pedido, ...(simulando ? { simular: '1' } : {}) }), { reemplazar: true });
  }, [pedido, simulando]);

  const ejemplo = useMemo(() => (simulando ? { lotes: vacio ? [] : lotesDeEjemplo().lotes, productos: productosDeEjemplo().productos } : null), [simulando, vacio]);
  const [rapido, setRapido] = useState(false);
  const real = useLotes({ cadaMs: rapido ? 4000 : 10000 });
  const pr = useProductosImagen();
  const lotes = useMemo(() => ordenarLotes(ejemplo ? ejemplo.lotes : real.datos?.lotes), [ejemplo, real.datos]);
  const productos = ejemplo ? ejemplo.productos : pr.datos?.productos;
  // mientras un lote se crea, su avance se mira más seguido
  useEffect(() => setRapido(!simulando && lotes.some(loteEnMarcha)), [lotes, simulando]);

  const grupos = useMemo(() => agruparPorProducto(lotes, productos), [lotes, productos]);
  const [elegido, setElegido] = useState(null);
  // (con un solo producto no hay nada que filtrar: la fila no se muestra)
  const grupoElegido = grupos.length > 1 ? grupos.find((g) => g.clave === elegido) || null : null;
  const lotesVisibles = grupoElegido ? lotes.filter((l) => grupoElegido.lotes.some((x) => x.lote === l.lote)) : lotes;

  const consultaSim = simulando ? { simular: '1' } : undefined;
  const hrefCrear = enlace.crearImagenes(consultaSim);
  const crearCon = (g) => (g?.existe ? enlace.crearImagenes({ producto: g.productoId, ...(consultaSim || {}) }) : null);
  const filtro = grupoElegido ? { nombre: nombreDelGrupo(grupoElegido), resumen: resumenDelGrupo(grupoElegido) } : null;
  // «Crear más» con el producto elegido; con un solo producto (sin fila para elegir), con ese
  const unico = grupos.length === 1 ? grupos[0] : null;
  const crearMas = grupoElegido ? { href: crearCon(grupoElegido), texto: 'Crear más con este producto' } : unico ? { href: crearCon(unico), texto: `Crear más con «${unico.nombre}»` } : null;
  const cargando = !ejemplo && real.cargando && !real.datos;
  const fallo = !ejemplo && real.error && !real.datos;
  const sinLotes = !cargando && !fallo && !lotes.length;

  if (pedido) return null;

  return (
    <div className="pagina img img-portada">
      <CabeceraPagina
        titulo="Anuncios de imagen"
        descripcion="Sube la foto de tu producto y la IA arma un lote de anuncios listos para publicar, en cuadrado y, si quieres, también en vertical."
        extra={
          simulando ? (
            <VistaPrevia
              texto="Simulación"
              className="img-simulacion"
              explicacion="Vista previa del diseño: los productos y los lotes son de ejemplo y no se guarda nada. Sin ?simular=1 ves los tuyos."
            />
          ) : null
        }
        acciones={
          sinLotes ? null : (
            <>
              {simulando ? null : <AprenderDeVentas />}
              <Boton variante="primario" tamano="grande" icono={Plus} href={hrefCrear}>
                Crear anuncios de imagen
              </Boton>
            </>
          )
        }
      />

      {cargando ? (
        <Cargando />
      ) : fallo ? (
        <EstadoVacio
          tono="error"
          icono={TriangleAlert}
          titulo="No pude leer tus lotes"
          descripcion={real.error.message}
          acciones={
            <Boton variante="secundario" icono={RotateCcw} onClick={real.recargar}>
              Volver a intentarlo
            </Boton>
          }
        />
      ) : sinLotes ? (
        <Bienvenida hrefCrear={hrefCrear} />
      ) : (
        <TusLotes
          lotes={lotesVisibles}
          ia={ia}
          simulando={simulando}
          filtro={filtro}
          crearMas={crearMas?.href ? crearMas : null}
          productos={grupos.length > 1 ? <TusProductos grupos={grupos} elegido={grupoElegido ? elegido : null} onElegir={setElegido} total={lotes.length} /> : null}
          recargar={real.recargar}
        />
      )}
    </div>
  );
}
