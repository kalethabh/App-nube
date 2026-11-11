// «Lo que notó la revisión», al final de la entrega. Desde 2026-11-09 la app genera todo al primer intento: la
// revisión de la IA (y la transcripción) no rehace nada sola, deja un aviso por pieza y tú decides. Aquí va una línea
// por pieza (GET /api/entrega/:slug → avisos: [{ clave, pieza, texto, sugerencia, momento }]) con su texto, el
// segundo donde está (se toca para verla en el reproductor) y un enlace que abre esa pieza en el proceso, donde se
// regenera («Corregir esto» usa lo que la revisión ya sugirió). Los ganchos de UGC también son piezas del proceso; la
// hoja de la que salen los clips y los iconos no se regeneran: «Verla» (su panel dice qué hacer).
import { ArrowRight, CircleCheck, Play, ScanEye, WandSparkles } from 'lucide-react';
import { Boton, Seccion, Tarjeta, TarjetaCabecera } from '../../componentes/index.js';
import { noSeRegenera } from '../../datos/regenerar.js';
import { enlace } from '../../datos/rutas.js';
import { duracion } from '../../datos/formato.js';

/** El enlace a una pieza en el proceso (ahí se abre su panel). */
export const enlacePieza = (slug, clave) => `${enlace.produccion(slug)}?pieza=${encodeURIComponent(clave)}`;

export function AvisosRevision({ slug, avisos, onIr, deLaApp = true, editable = false }) {
  const lista = Array.isArray(avisos) ? avisos : [];
  // (sin avisos no se muestra nada: en un anuncio de antes la revisión rehacía sola y eso ya está en el informe)
  if (!deLaApp || !lista.length) return null;
  // (si todo lo que notó es en hojas o iconos, que no se regeneran desde aquí, no se promete regenerar)
  const ningunaSeRegenera = lista.every((x) => noSeRegenera(x.clave));
  const una = lista.length === 1;
  return (
    <Seccion
      titulo="Lo que notó la revisión"
      icono={ScanEye}
      contador={lista.length || undefined}
      className="ent-avisos"
      descripcion={
        ningunaSeRegenera
          ? 'La revisión no rehace nada sola: mira en el video si se nota.'
          : 'La revisión no rehace nada sola: si algo no te convence, regenera esa pieza.'
      }
    >
      <Tarjeta className="ent-informe__tarjeta">
        {lista.length ? (
          <>
            <TarjetaCabecera
              icono={ScanEye}
              tono="aviso"
              titulo={lista.length === 1 ? 'Una pieza para mirar' : `${lista.length} piezas para mirar`}
              subtitulo={
                ningunaSeRegenera
                  ? una
                    ? 'Mírala en el video: si no se nota, déjala así. En su panel del proceso está qué puedes hacer si se nota.'
                    : 'Míralas en el video: si no se nota, déjalas así. En el panel de cada una, en el proceso, está qué puedes hacer si se nota.'
                  : una
                    ? 'Mírala en el video y decide: déjala así o regenérala desde el proceso o el editor.'
                    : 'Míralas en el video y decide: déjalas así o regenéralas desde el proceso o el editor.'
              }
            />
            <ul className="ent-avisos__lista">
              {lista.map((x) => (
                <li key={x.clave} className="ent-aviso">
                  <div className="ent-aviso__textos">
                    <span className="ent-aviso__pieza">
                      {x.pieza}
                      {x.momento !== null && x.momento !== undefined ? (
                        <button type="button" className="ent-pieza ent-pieza--ir" onClick={() => onIr?.(x.momento)} aria-label={`Ver ${x.pieza} en el video: ir al ${duracion(x.momento)}`}>
                          <Play size={10} strokeWidth={2.6} fill="currentColor" aria-hidden="true" />
                          <span className="ent-pieza__tiempo t-mono">{duracion(x.momento)}</span>
                        </button>
                      ) : null}
                    </span>
                    <p className="ent-aviso__texto">{x.texto}</p>
                    {noSeRegenera(x.clave) ? (
                      // (la hoja de la que salen los clips, la foto de tu producto o un icono: no se promete regenerar)
                      <p className="t-mini t-3">{noSeRegenera(x.clave) === 'icono' ? 'Los iconos no se regeneran desde aquí.' : 'Es la base de los clips: no se regenera desde aquí. En su panel está qué puedes hacer.'}</p>
                    ) : null}
                  </div>
                  {noSeRegenera(x.clave) ? (
                    <Boton variante="secundario" tamano="chico" iconoDerecha={ArrowRight} href={enlacePieza(slug, x.clave)} className="ent-aviso__ir">
                      {noSeRegenera(x.clave) === 'icono' ? 'Verlo' : 'Verla'}
                    </Boton>
                  ) : (
                    <Boton variante="secundario" tamano="chico" icono={x.sugerencia ? WandSparkles : undefined} iconoDerecha={ArrowRight} href={enlacePieza(slug, x.clave)} className="ent-aviso__ir">
                      {x.sugerencia ? 'Corregir o regenerar' : 'Ver y regenerar'}
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
            {editable ? (
              <p className="ent-costo__nota">
                También puedes regenerar un clip, reemplazarlo con tu propio video o cambiarle la velocidad en el{' '}
                <a className="ent-enlace" href={enlace.editor(slug)}>
                  editor
                </a>
                .
              </p>
            ) : null}
          </>
        ) : (
          <div className="ent-limpio">
            <CircleCheck size={18} strokeWidth={2.2} aria-hidden="true" />
            <p>La revisión no notó nada en las piezas de este anuncio.</p>
          </div>
        )}
      </Tarjeta>
    </Seccion>
  );
}
