import { ArrowUpRight, Building2, Clapperboard, Images, Telescope } from 'lucide-react';
import { Boton } from '../../componentes/index.js';
import { enlace } from '../../datos/rutas.js';
import { Logo } from '../../componentes/Logo.jsx';
import { fechaDeHoy } from '../tablero/datos.js';

const MISIONES = [
  { n: '01', titulo: 'Luces. Cámara. Ventas.', tipo: 'CREA UN VIDEO', texto: 'De tu producto a un anuncio con historia.', icono: Clapperboard, href: enlace.nuevo(), clase: 'video' },
  { n: '02', titulo: 'Haz que se detengan.', tipo: 'CREA IMÁGENES', texto: 'Diseños y variaciones que llaman la atención.', icono: Images, href: enlace.imagenes(), clase: 'imagen' },
  { n: '03', titulo: 'Conoce el terreno.', tipo: 'INVESTIGA TU MERCADO', texto: 'Encuentra los mensajes que conectan.', icono: Telescope, href: enlace.investigacion(), clase: 'investiga' },
];

/** Portada del tema Juego. Todo enlace abre una función real; las cifras vienen del estado de producción. */
export function PortadaJuego({ enMarcha, necesitan }) {
  return (
    <>
      <section className="ciudad-portada" aria-labelledby="ciudad-titulo">
        <img className="ciudad-portada__arte" src="/arte/ciudad-creativa.jpg" alt="" fetchPriority="high" decoding="async" />
        <div className="ciudad-portada__marco" aria-hidden="true" />
        <div className="ciudad-portada__superior">
          <span><Logo tamano={25} /> KADS STUDIO / CIUDAD CREATIVA</span>
          <span>{fechaDeHoy()}</span>
        </div>
        <div className="ciudad-portada__contenido">
          <span className="ciudad-etiqueta">TU CENTRO DE OPERACIONES</span>
          <h1 id="ciudad-titulo">TU PRÓXIMA<br />GRAN <em>CAMPAÑA.</em></h1>
          <p>La ciudad no se detiene.<br />Tus ideas tampoco. Vamos a crear.</p>
          <div className="ciudad-portada__acciones">
            <Boton variante="primario" tamano="grande" icono={Clapperboard} href={enlace.nuevo()}>Crear un anuncio</Boton>
            <Boton variante="secundario" tamano="grande" icono={Building2} href={enlace.oficina()}>Ir a mi oficina</Boton>
          </div>
        </div>
        <div className="ciudad-portada__inferior">
          <span>CREATIVIDAD SIN LÍMITES</span>
          <a href={enlace.tablero()}><i aria-hidden="true" /> {enMarcha == null ? 'Consultando producción…' : `${enMarcha} en producción`}{necesitan ? ` · ${necesitan} esperan tu decisión` : ''} <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </section>
      <section className="ciudad-misiones" aria-label="Elige tu próxima misión">
        {MISIONES.map((m) => {
          const Icono = m.icono;
          return (
            <a key={m.n} href={m.href} className={`ciudad-mision ciudad-mision--${m.clase}`}>
              <div className="ciudad-mision__arriba"><span>{m.n} / {m.tipo}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
              <Icono className="ciudad-mision__icono" size={52} strokeWidth={1.5} aria-hidden="true" />
              <h2>{m.titulo}</h2><p>{m.texto}</p>
            </a>
          );
        })}
      </section>
      <div className="ciudad-separador"><span>TU ACTIVIDAD</span><span>DATOS REALES. EN TIEMPO REAL.</span></div>
    </>
  );
}
