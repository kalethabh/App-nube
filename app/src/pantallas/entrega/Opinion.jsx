// «¿Cómo quedó?» (2026-11-19r): el 👍/👎 de un anuncio terminado. Lo que escribes se vuelve una regla de los
// aprendizajes (de este estilo o de todos) y la usa el agente de esa parte la próxima vez: lo ves en su panel de la
// oficina («Lo que aprendió esta semana»). Servidor: GET/POST /api/anuncios/:slug/opinion (lib/oficina-chat.js).
import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { AreaTexto, Boton, useAvisos } from '../../componentes/index.js';
import { pedirNuevo, useDatos } from '../../datos/api.js';

const PARTES = [
  ['guion', 'Guion'],
  ['imagenes', 'Imágenes y personas'],
  ['clips', 'Clips'],
  ['voz', 'Voces y música'],
  ['edicion', 'Montaje'],
];

export function Opinion({ slug }) {
  const { aviso } = useAvisos();
  const { datos, recargar } = useDatos(`opinion:${slug}`, () => pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/opinion`));
  const [voto, setVoto] = useState(null);
  const [partes, setPartes] = useState([]);
  const [texto, setTexto] = useState('');
  const [paraTodos, setParaTodos] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [otra, setOtra] = useState(false);
  const ya = datos?.opinion;
  if (ya && !otra) {
    return (
      <div className="ent-opinion ent-opinion--hecha">
        <span>{ya.voto === 'bien' ? <ThumbsUp size={15} /> : <ThumbsDown size={15} />} Tu opinión ya enseñó a tu equipo.</span>
        <button type="button" onClick={() => setOtra(true)}>Dar otra</button>
      </div>
    );
  }
  const enviar = async () => {
    setOcupado(true);
    try {
      const r = await pedirNuevo(`/api/anuncios/${encodeURIComponent(slug)}/opinion`, { metodo: 'POST', cuerpo: { voto, partes, texto, paraTodos } });
      aviso({ tipo: 'ok', titulo: r.reglas?.length ? 'Tu equipo lo aprendió' : '¡Gracias!', texto: r.reglas?.length ? `Nueva regla: ${r.reglas[0]}` : 'Lo tendremos en cuenta.' });
      setVoto(null);
      setPartes([]);
      setTexto('');
      setOtra(false);
      await recargar?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude guardarlo', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="ent-opinion">
      <p className="ent-opinion__titulo">¿Cómo quedó?</p>
      <div className="ent-opinion__votos" role="group" aria-label="Tu opinión">
        <button type="button" className={voto === 'bien' ? 'ent-opinion__voto ent-opinion__voto--bien' : 'ent-opinion__voto'} onClick={() => setVoto('bien')} aria-pressed={voto === 'bien'}>
          <ThumbsUp size={16} /> Me gustó
        </button>
        <button type="button" className={voto === 'mal' ? 'ent-opinion__voto ent-opinion__voto--mal' : 'ent-opinion__voto'} onClick={() => setVoto('mal')} aria-pressed={voto === 'mal'}>
          <ThumbsDown size={16} /> Hay que mejorar
        </button>
      </div>
      {voto ? (
        <>
          <div className="ent-opinion__partes" role="group" aria-label="¿Qué parte?">
            {PARTES.map(([id, nombre]) => (
              <button key={id} type="button" className={partes.includes(id) ? 'ent-opinion__parte ent-opinion__parte--activa' : 'ent-opinion__parte'} aria-pressed={partes.includes(id)} onClick={() => setPartes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}>
                {nombre}
              </button>
            ))}
          </div>
          <AreaTexto
            aria-label={voto === 'mal' ? 'Qué no te gustó' : 'Qué te gustó'}
            filas={2}
            maxLength={400}
            placeholder={voto === 'mal' ? 'Qué no te gustó (ej.: el gancho tarda mucho en llegar)' : 'Qué te gustó, para repetirlo (opcional)'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <label className="ent-opinion__todos">
            <input type="checkbox" checked={paraTodos} onChange={(e) => setParaTodos(e.target.checked)} /> Para todos los estilos
          </label>
          <Boton variante="primario" tamano="chico" onClick={enviar} cargando={ocupado} disabled={voto === 'mal' && !texto.trim()}>
            Enseñarle a mi equipo
          </Boton>
        </>
      ) : null}
    </div>
  );
}
