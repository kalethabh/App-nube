// INICIO (#/inicio, 2026-11-18): el dashboard principal. Lo primero que se ve al abrir la app.
//   1. Saludo y las acciones de siempre (nuevo anuncio, anuncios de imagen, investigar).
//   2. Cuatro cifras del mes: anuncios listos (contra el mes anterior), imágenes, lo que está en marcha y lo invertido.
//   3. Los últimos 14 días en un gráfico (gasto, anuncios o imágenes) y «Ahora»: lo que te necesita y lo que se produce.
//   4. Saldo, salud de las plataformas y los modelos más usados de la semana.
//   5. Por producto (anuncios, lotes, investigación e inversión) y lo último que terminó.
// Todo sale de datos reales: /api/dashboard (lib/dashboard.js) y las mismas consultas del resto de la app.
import { Clapperboard, Images, Plus, Telescope } from 'lucide-react';
import { Boton, CabeceraPagina } from '../../componentes/index.js';
import { pedirNuevo, useAnuncios, useDatos } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { useEnProduccion } from '../../datos/produccion.js';
import { useSaldo } from '../../datos/saldo.js';
import { useLotes } from '../../datos/imagenes.js';
import { useInvestigaciones } from '../../datos/investigacion.js';
import { fechaDeHoy, saludo } from '../tablero/datos.js';
import { Cifras } from './Cifras.jsx';
import { Grafico } from './Grafico.jsx';
import { Ahora } from './Ahora.jsx';
import { Saldo, Plataformas, Modelos } from './Paneles.jsx';
import { PorProducto, Recientes } from './Listas.jsx';
import './inicio.css';

const useDashboard = () => useDatos('dashboard', () => pedirNuevo('/api/dashboard'), { cadaMs: 60000 });
const useInversion = () => useDatos('inversion', () => pedirNuevo('/api/inversion'), { cadaMs: 120000 });
const useSalud = () => useDatos('salud:inicio', () => pedirNuevo('/api/salud'), { cadaMs: 120000 });

export default function Inicio() {
  const dash = useDashboard();
  const anuncios = useAnuncios({ cadaMs: 15000 });
  const produccion = useEnProduccion({ cadaMs: 10000 });
  const saldo = useSaldo();
  const lotes = useLotes({ cadaMs: 30000 });
  const investigaciones = useInvestigaciones();
  const inversion = useInversion();
  const salud = useSalud();

  const d = dash.datos;
  const listaAnuncios = (anuncios.datos?.anuncios || []).filter((a) => !a.modoPrueba);
  const listaLotes = lotes.datos?.lotes || [];
  const necesitan = produccion.cargando ? null : produccion.necesitan.length + produccion.guiones.length;
  const enMarcha = produccion.cargando ? null : produccion.cantidad;

  return (
    <div className="pagina ini">
      <CabeceraPagina
        sobretitulo={`${saludo()} · ${fechaDeHoy()}`}
        titulo="Inicio"
        descripcion={`Cómo va ${new Date().toLocaleDateString('es-ES', { month: 'long' })}, de un vistazo.`}
        acciones={
          <div className="ini-acciones">
            <Boton variante="secundario" icono={Telescope} href={enlace.investigacion()}>
              Investigar
            </Boton>
            <Boton variante="secundario" icono={Images} href={enlace.imagenes()}>
              Anuncios de imagen
            </Boton>
            <Boton variante="primario" icono={Plus} href={enlace.nuevo()}>
              Nuevo anuncio
            </Boton>
          </div>
        }
      />

      <Cifras d={d} necesitan={necesitan} enMarcha={enMarcha} />

      <div className="ini-fila ini-fila--grafico">
        <Grafico dias={d?.dias} />
        <Ahora p={produccion} />
      </div>

      <div className="ini-fila ini-fila--tres">
        <Saldo s={saldo.datos} cargando={saldo.cargando && !saldo.datos} />
        <Plataformas s={salud.datos} />
        <Modelos modelos={d?.modelos} />
      </div>

      <div className="ini-fila ini-fila--listas">
        <PorProducto anuncios={listaAnuncios} lotes={listaLotes} investigaciones={investigaciones.datos?.productos} inversion={inversion.datos} cargando={!anuncios.datos || !inversion.datos} />
        <Recientes recientes={d?.recientes} anuncios={listaAnuncios} lotes={listaLotes} />
      </div>

      {!anuncios.cargando && !listaAnuncios.length && !listaLotes.length ? (
        <p className="ini-pie">
          <Clapperboard size={14} aria-hidden="true" /> Todavía no hay nada hecho: empieza con «Nuevo anuncio» y aquí verás cómo avanza.
        </p>
      ) : null}
    </div>
  );
}
