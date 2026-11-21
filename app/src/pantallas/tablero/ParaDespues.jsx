// «Para después» (2026-11-21g): lo que te necesitaba y dejaste con «Terminar después». No suma al aviso rojo ni al
// contador: espera aquí, tranquilo, hasta que toques «Continuar» (sigue desde donde quedó, lo hecho no se paga) o abras
// su guion. Apenas lo tocas, sale de aquí y, si se vuelve a frenar, te avisa como siempre.
import { useState } from 'react';
import { ArrowRight, BellRing, Clock, RotateCcw } from 'lucide-react';
import { Boton, Seccion, Tooltip, useAvisos } from '../../componentes/index.js';
import { miniatura, refrescar } from '../../datos/api.js';
import { enlace } from '../../datos/rutas.js';
import { fechaRelativa } from '../../datos/formato.js';
import { continuarProduccion, frenoPorElGuion, volverAAvisar } from '../../datos/produccion.js';

const QUE = { error: 'Se trabó un paso', saldo: 'Faltaba saldo de kie', pausa: 'Estaba en pausa', cancion: 'Faltaba elegir la canción' };

function Item({ n, alSeguir }) {
  const { anuncio: a, alto } = n;
  const { aviso } = useAvisos();
  const [ocupado, setOcupado] = useState(false);
  const hrefGuion = enlace.nuevo({ paso: '2', anuncios: a.slug, ...(a.productoId ? { producto: a.productoId } : {}) });
  const aLaPantalla = n.guion || frenoPorElGuion(alto) ? hrefGuion : alto?.tipo === 'cancion' ? enlace.produccion(a.slug) : null;
  const que = n.guion ? (a.estado === 'error' ? 'El guion no salió' : 'Su guion espera que lo apruebes') : QUE[alto?.tipo] || 'Esperaba por ti';
  const seguir = async () => {
    setOcupado(true);
    try {
      await continuarProduccion(a.slug);
      aviso({ tipo: 'info', titulo: 'Sigue desde donde quedó', texto: `${a.titulo}: lo que ya estaba hecho no se vuelve a pagar.` });
      refrescar('anuncios');
      alSeguir?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude continuar', texto: e.message });
    } finally {
      setOcupado(false);
    }
  };
  const avisar = async () => {
    try {
      await volverAAvisar(a.slug);
      alSeguir?.();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude moverlo', texto: e.message });
    }
  };
  return (
    <li className="tb-despues__item">
      <a className="tb-despues__foto" href={aLaPantalla || enlace.produccion(a.slug)} tabIndex={-1} aria-hidden="true">
        {a.miniatura ? <img src={miniatura(a.miniatura, 120)} alt="" loading="lazy" decoding="async" draggable="false" /> : <Clock size={16} />}
      </a>
      <div className="tb-despues__textos">
        <strong className="t-recortar" title={a.titulo}>
          {a.titulo}
          {a.estiloNombre ? <span> · {a.estiloNombre}</span> : null}
        </strong>
        <span className="tb-despues__que">
          {que} · lo dejaste {fechaRelativa(a.paraDespues)}
        </span>
      </div>
      <div className="tb-despues__botones">
        <Tooltip texto="Volver a «Te necesitan»">
          <Boton variante="fantasma" tamano="chico" soloIcono icono={BellRing} etiqueta="Volver a avisarme" onClick={avisar} />
        </Tooltip>
        {aLaPantalla ? (
          <Boton variante="secundario" tamano="chico" iconoDerecha={ArrowRight} href={aLaPantalla}>
            {n.guion || frenoPorElGuion(alto) ? 'Ver el guion' : 'Continuar'}
          </Boton>
        ) : (
          <Boton variante="secundario" tamano="chico" icono={RotateCcw} onClick={seguir} cargando={ocupado}>
            Continuar
          </Boton>
        )}
      </div>
    </li>
  );
}

/** p = useEnProduccion() (src/datos/produccion.js). Sin nada para después, no se muestra. */
export function ParaDespues({ p, alSeguir }) {
  const lista = p.paraDespues || [];
  if (!lista.length) return null;
  return (
    <Seccion titulo="Para después" contador={lista.length} icono={Clock} descripcion="Lo que dejaste para terminar después: no te avisa hasta que toques «Continuar».">
      <ul className="tb-despues">
        {lista.map((n) => (
          <Item key={n.anuncio.slug} n={n} alSeguir={alSeguir} />
        ))}
      </ul>
    </Seccion>
  );
}
