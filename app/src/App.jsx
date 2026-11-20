// La app: menú lateral + barra superior + la pantalla de la ruta actual.
//
// LAS RUTAS (hash): cada pantalla vive en src/pantallas/<carpeta>/index.jsx con `export default`,
// se carga recién cuando se abre (lazy) y recibe { params, consulta }:
//   params   -> lo que va en la ruta, p. ej. { slug: 'befen-regulador-apetito' }
//   consulta -> URLSearchParams de lo que va después de "?", p. ej. #/nuevo?estilo=crochet
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RefreshCw, SearchX, TriangleAlert } from 'lucide-react';
import { MenuLateral } from './marco/MenuLateral.jsx';
import { BarraArriba } from './marco/BarraArriba.jsx';
import { AvisoCoordinadora } from './marco/AvisoCoordinadora.jsx';
import { ContextoBarra } from './componentes/BarraSuperior.jsx';
import { Boton } from './componentes/Boton.jsx';
import { EstadoVacio } from './componentes/EstadoVacio.jsx';
import { Esqueleto, EsqueletoMiniaturas } from './componentes/Esqueleto.jsx';
import { useHash, partirRuta, emparejar, ir, enlace } from './datos/rutas.js';
import { BandaGlobalModoPrueba } from './pantallas/produccion/ModoPrueba.jsx';
import { BandaVersionNueva } from './marco/BandaVersionNueva.jsx';
import { BandaActualizacion } from './marco/BandaActualizacion.jsx';
import './marco/marco.css';

const Inicio = lazy(() => import('./pantallas/inicio/index.jsx'));
const Oficina = lazy(() => import('./pantallas/oficina/index.jsx'));
const Productos = lazy(() => import('./pantallas/productos/index.jsx'));
// (lo que viene: una pantalla de «Próximamente» cada uno)
const EmbudoWhatsapp = lazy(() => import('./pantallas/proximamente/index.jsx').then((m) => ({ default: m.EmbudoWhatsapp })));
const Landings = lazy(() => import('./pantallas/landings/index.jsx'));
const Sep = lazy(() => import('./pantallas/sep/index.jsx'));
const Shopify = lazy(() => import('./pantallas/shopify/index.jsx'));
const Tablero = lazy(() => import('./pantallas/tablero/index.jsx'));
const Nuevo = lazy(() => import('./pantallas/nuevo/index.jsx'));
const Entrega = lazy(() => import('./pantallas/entrega/index.jsx'));
const Produccion = lazy(() => import('./pantallas/produccion/index.jsx'));
const Editor = lazy(() => import('./pantallas/editor/index.jsx'));
const Estilos = lazy(() => import('./pantallas/estilos/index.jsx'));
const Ajustes = lazy(() => import('./pantallas/ajustes/index.jsx'));
const Biblioteca = lazy(() => import('./pantallas/biblioteca/index.jsx'));
const Anuncios = lazy(() => import('./pantallas/anuncios/index.jsx'));
const EditorVideos = lazy(() => import('./pantallas/editor-videos/index.jsx'));
const Saldo = lazy(() => import('./pantallas/saldo/index.jsx'));
const Cambiar = lazy(() => import('./pantallas/cambiar/index.jsx'));
const Sketch = lazy(() => import('./pantallas/sketch/index.jsx'));
const Aprendizajes = lazy(() => import('./pantallas/aprendizajes/index.jsx'));
const Imagenes = lazy(() => import('./pantallas/imagenes/index.jsx'));
const CrearImagenes = lazy(() => import('./pantallas/imagenes/Crear.jsx'));
const LoteImagenes = lazy(() => import('./pantallas/imagenes-lote/index.jsx'));
const Inspiracion = lazy(() => import('./pantallas/inspiracion/index.jsx'));
const Investigaciones = lazy(() => import('./pantallas/investigacion/index.jsx'));
const InformeInvestigacion = lazy(() => import('./pantallas/investigacion/Informe.jsx'));
const Componentes = lazy(() => import('./pantallas/componentes/index.jsx'));
// La bienvenida de 3 pasos: se abre sola la primera vez (hasta que se cierra o se termina).
const BienvenidaPrimeraVez = lazy(() => import('./pantallas/ajustes/Bienvenida.jsx'));

// Título provisorio a partir del slug (la pantalla lo cambia por el real con useBarraSuperior).
const nombreDeSlug = (slug) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const MIS_ANUNCIOS = { texto: 'Mis anuncios', href: enlace.tablero() };

/**
 * menu     -> qué item del menú se ilumina
 * completa -> la pantalla usa toda la ventana (sin menú ni barra): el editor
 */
export const RUTAS = [
  { patron: '/inicio', Pantalla: Inicio, menu: 'inicio', titulo: 'Inicio', migas: () => [{ texto: 'Inicio' }] },
  { patron: '/oficina', Pantalla: Oficina, menu: 'oficina', titulo: 'Oficina virtual', migas: () => [{ texto: 'Oficina virtual' }] },
  { patron: '/embudo-whatsapp', Pantalla: EmbudoWhatsapp, menu: 'whatsapp', titulo: 'Embudo WhatsApp', migas: () => [{ texto: 'Embudo WhatsApp' }] },
  { patron: '/landings', Pantalla: Landings, menu: 'landings', titulo: 'Generador de Landings', migas: () => [{ texto: 'Generador de Landings' }] },
  { patron: '/sep', Pantalla: Sep, menu: 'sep', titulo: 'S.E.P', migas: () => [{ texto: 'S.E.P' }] },
  { patron: '/shopify', Pantalla: Shopify, menu: 'shopify', titulo: 'Shopify', migas: () => [{ texto: 'Shopify' }] },
  { patron: '/productos', Pantalla: Productos, menu: 'productos', titulo: 'Productos', migas: () => [{ texto: 'Productos' }] },
  { patron: '/tablero', Pantalla: Tablero, menu: 'tablero', titulo: 'Mis anuncios', migas: () => [{ texto: 'Mis anuncios' }] },
  { patron: '/nuevo', Pantalla: Nuevo, menu: 'nuevo', titulo: 'Nuevo anuncio', migas: () => [MIS_ANUNCIOS, { texto: 'Nuevo anuncio' }] },
  {
    patron: '/anuncio/:slug',
    Pantalla: Entrega,
    menu: 'tablero',
    titulo: 'Tu anuncio',
    migas: ({ slug }) => [MIS_ANUNCIOS, { texto: nombreDeSlug(slug) }],
  },
  {
    patron: '/anuncio/:slug/produccion',
    Pantalla: Produccion,
    menu: 'tablero',
    titulo: 'Producción',
    migas: ({ slug }) => [MIS_ANUNCIOS, { texto: nombreDeSlug(slug), href: enlace.anuncio(slug) }, { texto: 'Producción' }],
  },
  { patron: '/anuncio/:slug/editor', Pantalla: Editor, menu: 'tablero', titulo: 'Editor', completa: true },
  { patron: '/estilos', Pantalla: Estilos, menu: 'estilos', titulo: 'Estilos', migas: () => [{ texto: 'Estilos' }] },
  { patron: '/anuncios', Pantalla: Anuncios, menu: 'anuncios', titulo: 'Anuncios', migas: () => [{ texto: 'Anuncios' }] },
  { patron: '/editor', Pantalla: EditorVideos, menu: 'editor', titulo: 'Editor', migas: () => [{ texto: 'Editor' }] },
  { patron: '/aprendizajes', Pantalla: Aprendizajes, menu: 'aprendizajes', titulo: 'Aprendizajes', migas: () => [{ texto: 'Aprendizajes' }] },
  { patron: '/sketch', Pantalla: Sketch, menu: 'nuevo', titulo: 'Sketch de comedia', migas: () => [{ texto: 'Sketch de comedia' }] },
  { patron: '/sketch/:slug', Pantalla: Sketch, menu: 'nuevo', titulo: 'Sketch de comedia', migas: () => [{ texto: 'Sketch de comedia', href: enlace.sketch() }, { texto: 'Tu sketch' }] },
  // (Cambiar el producto vive en el Editor desde el 2026-11-19p: se ilumina «Editor» y las migas empiezan ahí)
  { patron: '/cambiar', Pantalla: Cambiar, menu: 'editor', titulo: 'Cambiar el producto', migas: () => [{ texto: 'Editor', href: enlace.editorVideos() }, { texto: 'Cambiar el producto' }] },
  { patron: '/cambiar/:slug', Pantalla: Cambiar, menu: 'editor', titulo: 'Cambiar el producto', migas: () => [{ texto: 'Editor', href: enlace.editorVideos() }, { texto: 'Cambiar el producto', href: enlace.cambiar() }, { texto: 'Revisar' }] },
  { patron: '/saldo', Pantalla: Saldo, menu: 'saldo', titulo: 'Saldo y costos', migas: () => [{ texto: 'Saldo y costos' }] },
  { patron: '/biblioteca', Pantalla: Biblioteca, menu: 'biblioteca', titulo: 'Biblioteca', migas: () => [{ texto: 'Biblioteca' }] },
  { patron: '/ajustes', Pantalla: Ajustes, menu: 'ajustes', titulo: 'Ajustes', migas: () => [{ texto: 'Ajustes' }] },
  // Investigación de mercado: tus productos y el informe de cada uno
  { patron: '/investigacion', Pantalla: Investigaciones, menu: 'investigacion', titulo: 'Investigación de mercado', migas: () => [{ texto: 'Investigación de mercado' }] },
  {
    patron: '/investigacion/:id',
    Pantalla: InformeInvestigacion,
    menu: 'investigacion',
    titulo: 'Investigación de mercado',
    migas: () => [{ texto: 'Investigación de mercado', href: enlace.investigacion() }, { texto: 'Informe' }],
  },
  // Anuncios de imagen: la portada (tus productos y tus lotes), el formulario para crear un lote y la pantalla de un
  // lote (avance y galería). "/imagenes/nuevo" va antes que "/imagenes/:lote" (un lote nunca se llama "nuevo")
  { patron: '/imagenes', Pantalla: Imagenes, menu: 'imagenes', titulo: 'Anuncios de imagen', migas: () => [{ texto: 'Anuncios de imagen' }] },
  {
    patron: '/imagenes/nuevo',
    Pantalla: CrearImagenes,
    menu: 'imagenes',
    titulo: 'Crear anuncios de imagen',
    migas: () => [{ texto: 'Anuncios de imagen', href: enlace.imagenes() }, { texto: 'Crear anuncios de imagen' }],
  },
  {
    patron: '/imagenes/:lote',
    Pantalla: LoteImagenes,
    menu: 'imagenes',
    titulo: 'Tu lote de imágenes',
    migas: () => [{ texto: 'Anuncios de imagen', href: enlace.imagenes() }, { texto: 'Tu lote' }],
  },
  // Inspiración: los anuncios que están funcionando en Meta, de TrendTrack (con el conector de la cuenta de Claude).
  // #/ganadores (la antigua «Mejores anuncios») abre la misma pantalla, para que los enlaces viejos sigan andando
  { patron: '/inspiracion', Pantalla: Inspiracion, menu: 'inspiracion', titulo: 'Inspiración', migas: () => [{ texto: 'Inspiración' }] },
  { patron: '/ganadores', Pantalla: Inspiracion, menu: 'inspiracion', titulo: 'Inspiración', migas: () => [{ texto: 'Inspiración' }] },
  { patron: '/componentes', Pantalla: Componentes, menu: null, titulo: 'Guía de diseño', migas: () => [{ texto: 'Guía de diseño' }] },
];

// ---------------------------------------------------------------- preferencias de este equipo
function leerPreferencia(clave, porDefecto) {
  try {
    const v = window.localStorage.getItem(`anuncios-ia:${clave}`);
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}
function guardarPreferencia(clave, valor) {
  try {
    window.localStorage.setItem(`anuncios-ia:${clave}`, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const consultaAngosta = '(max-width: 1000px)';
function usePantallaAngosta() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consultaAngosta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(consultaAngosta).matches,
    () => false
  );
}

// ---------------------------------------------------------------- si una pantalla falla, no se cae la app
class AtajaErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[pantalla]', error, info?.componentStack);
    // La app se actualizo con la pestaña abierta: sus archivos viejos ya no existen. Se recarga sola una vez.
    const viejos = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(String(error?.message || error));
    if (!viejos) return;
    try {
      // a lo sumo una vez cada 30 s: si la recarga no lo arregla, queda esta pantalla (nunca un bucle)
      const ultima = Number(sessionStorage.getItem('recargo-por-version') || 0);
      if (Date.now() - ultima < 30000) return;
      sessionStorage.setItem('recargo-por-version', String(Date.now()));
    } catch {
      return; // sin sessionStorage no se arriesga a recargar en bucle
    }
    window.location.reload();
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          icono={TriangleAlert}
          tono="error"
          titulo="Esta pantalla tuvo un problema"
          descripcion="No se perdió nada de tus anuncios. Vuelve a cargarla; si sigue pasando, vuelve a Mis anuncios."
          acciones={
            <>
              <Boton variante="primario" icono={RefreshCw} onClick={() => window.location.reload()}>
                Volver a cargar
              </Boton>
              <Boton variante="secundario" href={enlace.tablero()} onClick={() => this.setState({ error: null })}>
                Ir a Mis anuncios
              </Boton>
            </>
          }
        />
      </div>
    );
  }
}

function PantallaCargando({ completa }) {
  if (completa) return <div className="pantalla-cargando" />;
  return (
    <div className="pagina" aria-busy="true">
      <div className="pila" style={{ '--hueco': '12px', maxWidth: 520 }}>
        <Esqueleto forma="texto" ancho={90} alto={10} />
        <Esqueleto ancho="70%" alto={34} />
        <Esqueleto forma="texto" ancho="90%" />
      </div>
      <EsqueletoMiniaturas cantidad={6} />
    </div>
  );
}

function NoEncontrada() {
  return (
    <div className="pagina pagina--angosta">
      <EstadoVacio
        icono={SearchX}
        titulo="No encuentro esta pantalla"
        descripcion="Puede que el enlace esté incompleto. Tus anuncios están todos en Mis anuncios."
        acciones={
          <Boton variante="primario" href={enlace.tablero()}>
            Ir a Mis anuncios
          </Boton>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- la app
export default function App() {
  const hash = useHash();
  const { camino, consulta } = partirRuta(hash);
  const [migasPagina, setMigasPagina] = useState(null);
  const [plegadoElegido, setPlegadoElegido] = useState(() => leerPreferencia('menu-plegado', false));
  const angosta = usePantallaAngosta();
  const plegado = plegadoElegido || angosta;

  // "#/" o sin hash -> el inicio (el dashboard)
  useEffect(() => {
    if (camino === '/' || camino === '') ir('/inicio', { reemplazar: true });
  }, [camino]);

  const actual = useMemo(() => {
    for (const ruta of RUTAS) {
      const params = emparejar(ruta.patron, camino);
      if (params) return { ruta, params };
    }
    return null;
  }, [camino]);

  // cada pantalla nueva arranca arriba y con sus migas por defecto
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [camino]);
  useEffect(() => {
    document.title = actual ? `${actual.ruta.titulo} · Kads Studio` : 'Kads Studio by Kalethabh';
  }, [actual]);

  const fijarMigas = useCallback((m) => setMigasPagina(m), []);
  const plegar = () => {
    const nuevo = !plegadoElegido;
    setPlegadoElegido(nuevo);
    guardarPreferencia('menu-plegado', nuevo);
  };

  const Pantalla = actual?.ruta.Pantalla;
  const pantalla = Pantalla ? (
    <AtajaErrores key={camino}>
      <Suspense fallback={<PantallaCargando completa={actual.ruta.completa} />}>
        <Pantalla key={camino} params={actual.params} consulta={consulta} />
      </Suspense>
    </AtajaErrores>
  ) : camino === '/' ? null : (
    <NoEncontrada />
  );

  if (actual?.ruta.completa) {
    return (
      <ContextoBarra.Provider value={fijarMigas}>
        <div className="app app--completa">{pantalla}</div>
      </ContextoBarra.Provider>
    );
  }

  const migas = migasPagina || actual?.ruta.migas?.(actual.params) || [{ texto: 'Kads Studio' }];

  return (
    <ContextoBarra.Provider value={fijarMigas}>
      <div className={`app${plegado ? ' app--plegada' : ''}`}>
        <MenuLateral activo={actual?.ruta.menu} plegado={plegado} onPlegar={plegar} />
        <div className="principal">
          {/* en el tablero el gran "Nuevo anuncio" ya está en la portada: no se repite arriba */}
          <BarraArriba migas={migas} ocultarNuevo={actual?.ruta.menu === 'nuevo' || actual?.ruta.patron === '/tablero' || actual?.ruta.patron === '/inicio' || actual?.ruta.patron === '/imagenes' || actual?.ruta.patron === '/imagenes/nuevo'} />
          <main className="principal__contenido" id="contenido">
            <BandaVersionNueva />
            <BandaActualizacion />
            <BandaGlobalModoPrueba />
            {pantalla}
          </main>
          {/* la coordinadora flotante en todas las pantallas (en la oficina ya está su chat) */}
          <AvisoCoordinadora oculto={actual?.ruta.patron === '/oficina'} />
          {/* en Ajustes la bienvenida se abre con su botón; en las demás pantallas, sola la primera vez */}
          {actual?.ruta.menu !== 'ajustes' ? (
            <Suspense fallback={null}>
              <BienvenidaPrimeraVez />
            </Suspense>
          ) : null}
        </div>
      </div>
    </ContextoBarra.Provider>
  );
}
