// El único "Sí" de cada anuncio: "Me gusta, producir", con el costo aproximado y tu saldo de kie (con su color), al lado de su guion.
// La app siempre produce el anuncio completo (voz, música, subtítulos) y después todo es automático
// hasta los MP4 (en los cantados, con una sola pausa: elegir la versión de la canción, de oído). El costo real se ve recién en el informe de la Entrega. Si el saldo de kie no
// alcanza (GET /api/saldo o la respuesta de "producir"), un aviso discreto en vez del botón activo,
// sin números.
import { ArrowRight, Clapperboard, Clock, TriangleAlert } from 'lucide-react';
import { Boton, CostoAnuncio, Tarjeta } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { esCantado, minutosDe, queSaleDe } from '../estilos/catalogo.js';
import { estimadoAntesDeProducir, familiaDeEstilo } from '../../datos/produccion.js';
import { conDuracion, duracionAprox, duracionDeAjuste } from '../../datos/duracion.js';

/**
 * sinSaldo: muestra el aviso · bloqueado: el saldo dice que no alcanza (el botón se apaga hasta que recargues)
 * aprobado: ya se está produciendo (se abrió la pantalla de nuevo): solo lleva a la producción
 * terminado: ya se produjo: lleva a la entrega · piezas: { imagenes, clips } del manifiesto (para el estimado)
 * faltaElegir: el musical tiene varias letras y todavía no eligió una · continuidad: el anuncio va sin cortes
 */
export function Producir({ estilo, ajuste, slug, listo, aprobado = false, terminado = false, piezas = null, produciendo, sinSaldo = false, bloqueado = false, faltaElegir = false, continuidad = false, onProducir }) {
  const cantado = esCantado(estilo.clave);
  // el mismo estimado que muestra la producción al arrancar; sin el manifiesto todavía, el del estilo con la duración
  // que dijo el usuario (o la de siempre, si la decide la IA), y se dice cuál
  const largo = conDuracion(estilo.clave) ? duracionDeAjuste(ajuste?.duracion) : null;
  const minutos = piezas ? Math.max(1, Math.round(estimadoAntesDeProducir(piezas, familiaDeEstilo(estilo.clave, continuidad)) / 60)) : minutosDe(estilo.clave, largo?.segundos);
  const segunLargo = piezas || !largo ? '' : largo.segundos ? ` (${cantado ? 'una historia' : 'un anuncio'} de ${duracionAprox(largo.segundos)})` : ' (la duración la decide la IA)';

  if (aprobado && terminado) {
    return (
      <Tarjeta variante="destacada" relleno="ninguno" className="nv-producir nv-producir--lado">
        <div className="nv-producir__accion">
          <div className="nv-producir__cabecera">
            <span className="nv-producir__icono" aria-hidden="true">
              <Clapperboard size={19} strokeWidth={2} />
            </span>
            <div>
              <h2 className="nv-producir__titulo nv-producir__titulo--chico">Tu anuncio ya está listo</h2>
              <p className="nv-producir__sub">Se produjo con este guion. Sus versiones, el informe y lo que costó están en la entrega.</p>
            </div>
          </div>
          <Boton variante="primario" tamano="grande" bloque iconoDerecha={ArrowRight} href={enlace.anuncio(slug)}>
            Ver el anuncio
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  if (aprobado) {
    return (
      <Tarjeta variante="destacada" relleno="ninguno" className="nv-producir nv-producir--lado">
        <div className="nv-producir__accion">
          <div className="nv-producir__cabecera">
            <span className="nv-producir__icono" aria-hidden="true">
              <Clapperboard size={19} strokeWidth={2} />
            </span>
            <div>
              <h2 className="nv-producir__titulo nv-producir__titulo--chico">Ya se está produciendo</h2>
              <p className="nv-producir__sub">
                {cantado ? 'Aprobaste la letra: la app hace la canción y te avisa para que elijas la versión; después sigue sola hasta el video.' : 'Aprobaste este guion: la app lo está haciendo sola, hasta el video.'}
              </p>
            </div>
          </div>
          <Boton variante="primario" tamano="grande" bloque iconoDerecha={ArrowRight} href={enlace.produccion(slug)}>
            Ver la producción
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta variante="destacada" relleno="ninguno" className="nv-producir nv-producir--lado">
      <div className="nv-producir__accion">
        <div className="nv-producir__cabecera">
          <span className="nv-producir__icono" aria-hidden="true">
            <Clapperboard size={19} strokeWidth={2} />
          </span>
          <div>
            <h2 className="nv-producir__titulo nv-producir__titulo--chico">{listo ? '¿Te gusta así?' : 'Después, se hace solo'}</h2>
            <p className="nv-producir__sub">{queSaleDe(estilo.clave, { continuidad })}</p>
          </div>
        </div>

        <p className="nv-producir__tiempo">
          <Clock size={15} strokeWidth={2} aria-hidden="true" />
          <span>
            <strong className="t-num">Unos {minutos} min</strong> desde que lo apruebas{segunLargo}{cantado ? ', más lo que tardes en elegir la canción' : ', sin que hagas nada'}. Si tu PC está armando otros anuncios, espera su turno y tarda más.
          </span>
        </p>

        {sinSaldo ? (
          <p className="nv-producir__saldo" role="status">
            <TriangleAlert size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>
              Tu saldo de kie no alcanza: recarga para seguir. <a href={enlace.ajustes()}>Ver en Ajustes</a>
            </span>
          </p>
        ) : null}

        {listo && slug ? <CostoAnuncio slug={slug} /> : null}

        <Boton variante="marca" tamano="grande" bloque disabled={!listo || bloqueado || faltaElegir} cargando={produciendo} onClick={onProducir} className="nv-producir__boton">
          {estilo.clave === 'musical' ? 'Producir esta letra' : 'Me gusta, producir'}
        </Boton>
        <p className="nv-producir__letra-chica">
          {listo && faltaElegir
            ? 'Elige una de las letras para producirla.'
            : listo
              ? cantado
                ? 'Después de este «Sí» la app hace la canción y te avisa para que elijas la versión; desde ahí sigue sola hasta el video.'
                : 'Después de este «Sí», la app sigue sola hasta el video y te avisa si algo te necesita.'
              : estilo.clave === 'musical'
                ? 'Cuando las letras estén escritas, eliges una y la apruebas aquí.'
                : 'Cuando el guion esté escrito, lo lees y lo apruebas aquí.'}
        </p>
      </div>
    </Tarjeta>
  );
}
