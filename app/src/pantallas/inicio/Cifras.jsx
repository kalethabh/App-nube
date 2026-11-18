// Las cuatro cifras del mes, arriba del inicio.
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Esqueleto } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { dinero, numero } from '../../datos/formato.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "+3 vs. octubre" con su flecha (sube = bien, en lo que se produce). */
function Cambio({ ahora, antes, mesAnterior }) {
  if (!antes && !ahora) return <span className="ini-cifra__detalle">nada todavía este mes</span>;
  if (!antes) return <span className="ini-cifra__detalle">primer mes con actividad</span>;
  const dif = ahora - antes;
  const Flecha = dif >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`ini-cifra__detalle ini-cifra__cambio${dif >= 0 ? ' ini-cifra__cambio--sube' : ''}`}>
      <Flecha size={13} aria-hidden="true" />
      {dif >= 0 ? '+' : ''}
      {numero(dif)} vs. {mesAnterior}
    </span>
  );
}

function Cifra({ etiqueta, valor, detalle, tono, href }) {
  const Caja = href ? 'a' : 'div';
  return (
    <Caja className={`ini-cifra ini-cifra--${tono}`} {...(href ? { href } : {})}>
      <span className="ini-cifra__etiqueta">{etiqueta}</span>
      <span className="ini-cifra__valor t-num">{valor ?? <Esqueleto ancho={56} alto={28} />}</span>
      {detalle}
    </Caja>
  );
}

export function Cifras({ d, necesitan, enMarcha }) {
  const hoy = new Date();
  const mes = MESES[hoy.getMonth()];
  const anterior = MESES[(hoy.getMonth() + 11) % 12];
  return (
    <section className="ini-cifras" aria-label={`Resumen de ${mes}`}>
      <Cifra
        etiqueta="Anuncios"
        valor={d ? numero(d.mes.anuncios) : null}
        detalle={d ? <Cambio ahora={d.mes.anuncios} antes={d.mesAnterior.anuncios} mesAnterior={anterior} /> : null}
        tono="acento"
        href={enlace.anuncios()}
      />
      <Cifra
        etiqueta="Imágenes"
        valor={d ? numero(d.mes.imagenes) : null}
        detalle={d ? <Cambio ahora={d.mes.imagenes} antes={d.mesAnterior.imagenes} mesAnterior={anterior} /> : null}
        tono="cian"
        href={enlace.imagenes()}
      />
      <Cifra
        etiqueta={necesitan ? 'Te necesitan' : 'En producción'}
        valor={necesitan == null ? null : numero(necesitan || enMarcha)}
        detalle={
          necesitan == null ? null : (
            <span className="ini-cifra__detalle">{necesitan ? `${enMarcha ? `y ${enMarcha} en producción` : 'para seguir'}` : enMarcha ? 'ahora mismo' : 'nada en marcha'}</span>
          )
        }
        tono={necesitan ? 'error' : 'ok'}
        href={enlace.tablero()}
      />
      <Cifra
        etiqueta="Invertido"
        valor={d ? dinero(d.mes.dolares) : null}
        detalle={d ? <span className="ini-cifra__detalle">{d.mesAnterior.dolares ? `${dinero(d.mesAnterior.dolares)} en ${anterior}` : 'en kie.ai y ElevenLabs'}</span> : null}
        tono="aviso"
        href={enlace.saldo()}
      />
    </section>
  );
}
