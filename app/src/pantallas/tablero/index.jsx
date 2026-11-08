// TABLERO ("Mis anuncios", #/tablero): la pantalla de inicio.
//   1. Portada: saludo, cifras del momento y el gran "Nuevo anuncio".
//   2. Te necesitan: los anuncios frenados (un paso falló o el saldo de kie no alcanza), con "Continuar".
//   3. En producción: fichas con avance en palabras, piezas y tiempo.
//   4. Listos: los anuncios reales, con filtros y buscador.
// "Te necesitan" y "En producción" salen de los conductor.json reales (useEnProduccion, src/datos/produccion.js):
// nada de ejemplo. Sin nada, cada uno muestra su estado vacío.
import { Clapperboard, Plus, RefreshCw } from 'lucide-react';
import { Boton, EstadoVacio, EsqueletoMiniaturas, Esqueleto } from '../../componentes/index.js';
import { useAnuncios } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { useEnProduccion } from '../../datos/produccion.js';
import { Portada } from './Portada.jsx';
import { TeNecesitan } from './TeNecesitan.jsx';
import { EnProduccion } from './EnProduccion.jsx';
import { Listos } from './Listos.jsx';
import { AvisoClaude, useSesionClaude } from '../nuevo/piezas.jsx';
import './tablero.css';

export default function Tablero() {
  const { datos, cargando, error, recargar } = useAnuncios();
  // lo mismo que leen el menú lateral y la barra de arriba: nunca dicen números distintos (aquí, cada 5 s)
  const produccion = useEnProduccion({ cadaMs: 5000 });
  // sin la sesion de Claude no se escribe ni se revisa nada: se avisa aca, no solo dentro del guion
  const claude = useSesionClaude();
  const anuncios = datos?.anuncios || [];

  if (error && !anuncios.length) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          tono="error"
          titulo="No pude leer tus anuncios"
          descripcion={error.message}
          acciones={
            <Boton variante="primario" icono={RefreshCw} onClick={recargar}>
              Reintentar
            </Boton>
          }
        />
      </div>
    );
  }

  if (!cargando && !anuncios.length) {
    return (
      <div className="pagina pagina--angosta">
        <EstadoVacio
          icono={Clapperboard}
          titulo="Todavía no tienes anuncios"
          descripcion="Cuéntale a la IA tu producto y en unos minutos tienes tu primer video listo para publicar."
          acciones={
            <Boton variante="primario" icono={Plus} href={enlace.nuevo()}>
              Hacer mi primer anuncio
            </Boton>
          }
        />
      </div>
    );
  }

  const cargandoProduccion = produccion.cargando;

  return (
    <div className="pagina tb">
      <Portada anuncios={anuncios} cargando={cargando} enProduccion={produccion.cantidad} aMedioCamino={produccion.pausados.length} teNecesitan={produccion.necesitan.length + produccion.guiones.length} />
      {claude.estado && !claude.listo ? <AvisoClaude claude={claude} para="escribir tus guiones y revisar tus anuncios" /> : null}

      {cargando || cargandoProduccion ? (
        <div className="pila" style={{ '--hueco': 'var(--e-5)' }}>
          <Esqueleto ancho={180} alto={22} />
          <EsqueletoMiniaturas cantidad={10} min={196} />
        </div>
      ) : (
        <>
          <div className={`tb-ahora${produccion.necesitan.length || produccion.guiones.length || produccion.activos.length || produccion.pausados.length ? '' : ' tb-ahora--tranquilo'}`}>
            <TeNecesitan p={produccion} alSeguir={recargar} />
            <EnProduccion p={produccion} />
          </div>
          <Listos anuncios={anuncios} />
        </>
      )}
    </div>
  );
}
