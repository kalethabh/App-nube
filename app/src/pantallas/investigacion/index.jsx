// #/investigacion — «Investigación de mercado»: se hace UNA vez por producto, solo con su foto. Aquí están tus productos
// (con su investigación lista, en marcha o sin hacer) y la zona para subir la foto de uno nuevo. Tocar un producto abre
// su informe (#/investigacion/:id, Informe.jsx).
import { useState } from 'react';
import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle, Search, Telescope } from 'lucide-react';
import { Boton, CabeceraPagina, CampoTexto, Esqueleto, EstadoVacio, Tarjeta, useAvisos } from '../../componentes/index.js';
import { apiNuevo, invalidar } from '../../datos/api.js';
import { CLAVE_INVESTIGACIONES, apiInvestigacion, useInvestigaciones } from '../../datos/investigacion.js';
import { fechaRelativa } from '../../datos/formato.js';
import { enlace, ir, rutas } from '../../datos/rutas.js';
import { ZonaImagenes, liberarVistas } from '../imagenes/ZonaImagenes.jsx';
import '../imagenes/imagenes.css';
import './investigacion.css';

const ESTADOS = {
  lista: { texto: 'Lista', icono: CircleCheck, clase: 'inv-chip--ok' },
  investigando: { texto: 'Investigando…', icono: LoaderCircle, clase: 'inv-chip--cian' },
  error: { texto: 'No terminó', icono: CircleAlert, clase: 'inv-chip--error' },
  sin: { texto: 'Sin investigar', icono: Search, clase: '' },
};

export default function Investigaciones() {
  const { aviso } = useAvisos();
  const { datos, cargando } = useInvestigaciones({ cadaMs: 8000 });
  const [foto, setFoto] = useState([]);
  const [nombre, setNombre] = useState('');
  const [pais, setPais] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const productos = datos?.productos || [];
  const sinClaude = datos && datos.motor !== 'claude';

  const empezar = async () => {
    if (!foto.length) return;
    setOcupado(true);
    try {
      const r = await apiNuevo.crearProducto({ nombre: nombre.trim(), tipo: 'fisico' });
      if (!r?.id) throw new Error('La app no devolvió tu producto.');
      await apiNuevo.subirFoto(r.id, 1, foto[0].archivo);
      await apiInvestigacion.investigar(r.id, pais.trim(), competencia.trim());
      liberarVistas(foto);
      invalidar(CLAVE_INVESTIGACIONES);
      ir(rutas.investigacion(r.id));
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude empezar la investigación', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="pagina inv pila" style={{ '--hueco': 'var(--e-6)' }}>
      <CabeceraPagina
        sobretitulo="Crear"
        titulo="Investigación de mercado"
        descripcion="Sube la foto de tu producto y la IA investiga su mercado: qué quiere tu cliente, qué le duele, tu competencia y con qué mensajes venderlo. Se hace una vez por producto y tus anuncios la usan."
      />

      <Tarjeta variante="elevada" className="inv-nueva">
        <h2 className="inv-h2">Investigar un producto nuevo</h2>
        <div className="inv-nueva__cuerpo">
          <ZonaImagenes archivos={foto} onCambiar={setFoto} max={1} heic titulo="Arrastra la foto de tu producto" pegarSiempre bloqueada={ocupado} ayuda="El empaque o la etiqueta, que se lea. También puedes pegarla (Ctrl/Cmd+V)." />
          <div className="inv-nueva__campos">
            <CampoTexto etiqueta="Nombre" opcional placeholder="Si no lo pones, lo lee de la foto" maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={ocupado} />
            <CampoTexto etiqueta="País" opcional placeholder="Colombia" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} disabled={ocupado} ayuda="Sin país, la investigación es general. Con país, suma precios, entidad sanitaria y lenguaje de ese país." />
            <CampoTexto etiqueta="Competencia a investigar" opcional placeholder="Link de TrendTrack o dominio de la tienda" maxLength={400} value={competencia} onChange={(e) => setCompetencia(e.target.value)} disabled={ocupado} ayuda="Va a la vez, en TrendTrack. Vacío: la IA busca la tienda que más vende algo como tu producto." />
            <Boton variante="primario" icono={Telescope} onClick={empezar} cargando={ocupado} disabled={!foto.length || sinClaude}>
              Investigar
            </Boton>
            <p className="img-ayuda">Hace todo de una: el mercado y tu competencia en TrendTrack, a la vez. Usa tu cuenta de Claude (busca en internet). Puedes seguir usando la app mientras tanto.</p>
            {sinClaude ? (
              <p className="img-nota img-nota--aviso">
                <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
                La investigación busca en internet y por ahora solo funciona con Claude. Elígelo en <a href={enlace.ajustes()}>Ajustes › Conexiones</a>.
              </p>
            ) : null}
          </div>
        </div>
      </Tarjeta>

      <section className="pila" style={{ '--hueco': 'var(--e-4)' }}>
        <h2 className="inv-h2">Tus productos</h2>
        {cargando && !datos ? (
          <Esqueleto alto={120} />
        ) : !productos.length ? (
          <EstadoVacio variante="compacto" icono={Telescope} titulo="Todavía no tienes productos" descripcion="Sube la foto de uno arriba para hacer su investigación." />
        ) : (
          <ul className="inv-lista">
            {productos.map((p) => {
              const e = ESTADOS[p.estado] || ESTADOS.sin;
              const Icono = e.icono;
              return (
                <li key={p.id}>
                  <a className="inv-prod" href={enlace.investigacion(p.id)}>
                    <span className="inv-prod__foto">{p.foto ? <img src={p.foto} alt="" loading="lazy" /> : null}</span>
                    <span className="inv-prod__textos">
                      <strong className="t-recortar">{p.nombre}</strong>
                      <span className={`inv-chip ${e.clase}`}>
                        <Icono size={12} strokeWidth={2.4} className={p.estado === 'investigando' ? 'girando' : ''} aria-hidden="true" /> {e.texto}
                      </span>
                      <span className="t-mini t-3">
                        {p.estado === 'lista' ? `${p.pais ? `${p.pais} · ` : ''}${p.fecha ? fechaRelativa(p.fecha) : ''}${p.resaltados ? ` · ${p.resaltados} resaltados` : ''}` : p.estado === 'sin' ? 'Toca para investigarlo' : ''}
                      </span>
                    </span>
                    <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="inv-prod__flecha" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
