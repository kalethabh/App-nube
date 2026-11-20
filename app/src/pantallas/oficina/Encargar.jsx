// ENCARGAR TRABAJO DESDE LA OFICINA (2026-11-20, «que todo lo pueda hacer, literal como una oficina»): tocas un
// departamento, «Encargar», y en un solo cuadro le pasas el trabajo a su equipo. Lo encargado se ve enseguida
// avanzando por su cadena de producción.
//
//   imagen          «Variaciones de un anuncio ganador» con el AGENTE DE VARIACIONES (el prompt maestro del usuario:
//                   .claude/skills/anuncios-imagen-ads/agente-variaciones.md): el ganador (de «Lo que me funciona» o
//                   subido/pegado), el producto, cuántas y el formato. Muestra el costo antes y arranca solo con tu sí.
//   investigacion   el producto y el país (la de mercado y la de la competencia, de una).
//   video           se lo pides a la coordinadora (chat) o lo armas en «Nuevo anuncio».
// Servidor: los mismos de siempre (POST /api/imagen-ads, referencias, generar; POST /api/investigacion/:id).
import { useEffect, useState } from 'react';
import { Briefcase, ImagePlus, MessageCircle } from 'lucide-react';
import { Boton, CampoTexto, Modal, useAvisos } from '../../componentes/index.js';
import { invalidar, pedirNuevo, useDatos } from '../../datos/api.js';
import { FormularioAgente } from '../imagenes/FormularioAgente.jsx';
import { enlace } from '../../datos/rutas.js';

function EncargoInvestigacion({ onListo }) {
  const { aviso } = useAvisos();
  const { datos } = useDatos('investigacion:lista', () => pedirNuevo('/api/investigacion'));
  const productos = datos?.productos || [];
  const [id, setId] = useState('');
  const [pais, setPais] = useState('Colombia');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!id && productos.length) setId(productos[0].id);
  }, [productos, id]);
  const encargar = async () => {
    setOcupado(true);
    try {
      await pedirNuevo(`/api/investigacion/${encodeURIComponent(id)}`, { metodo: 'POST', cuerpo: { pais: pais.trim() } });
      invalidar('oficina');
      aviso({ tipo: 'exito', titulo: 'Encargado al equipo de investigación', texto: 'Mercado y competencia, de una.' });
      onListo();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude encargarlo', texto: e?.message || 'Vuelve a intentarlo.' });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="enc">
      <p className="enc-intro">Investigan tu mercado (internet, Reddit, reseñas) y tu competencia en TrendTrack, arman el avatar y los conceptos para Meta y te entregan el informe.</p>
      <ul className="enc-productos">
        {productos.map((x) => (
          <li key={x.id}>
            <button type="button" className={x.id === id ? 'activo' : ''} aria-pressed={x.id === id} onClick={() => setId(x.id)}>
              {x.foto ? <img src={x.foto} alt="" /> : null}
              <span>
                {x.nombre}
                {x.estado === 'lista' ? ' · ya tiene' : x.estado === 'investigando' ? ' · en curso' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CampoTexto etiqueta="País" maxLength={60} value={pais} onChange={(e) => setPais(e.target.value)} />
      <div className="enc-pie">
        <span className="enc-costo">Usa tu cuenta de Claude: sin costo por imagen.</span>
        <Boton variante="primario" icono={Briefcase} onClick={encargar} cargando={ocupado} disabled={!id || !pais.trim()}>
          Encargar
        </Boton>
      </div>
    </div>
  );
}

export function Encargar({ dep, onCerrar, onListo, onPedirAValentina }) {
  if (!dep) return null;
  const titulo = dep.id === 'imagen' ? 'Encargar anuncios de imagen' : dep.id === 'investigacion' ? 'Encargar una investigación' : `Encargar a ${dep.nombre}`;
  return (
    <Modal abierto onCerrar={onCerrar} titulo={titulo} descripcion={`Se lo pasas al equipo de ${dep.nombre}: lo verás avanzar por su cadena en la oficina.`} icono={ImagePlus} tamano="grande">
      {dep.id === 'imagen' ? (
        <FormularioAgente onListo={onListo} />
      ) : dep.id === 'investigacion' ? (
        <EncargoInvestigacion onListo={onListo} />
      ) : (
        <div className="enc">
          <p className="enc-intro">Un anuncio de video necesita elegir el estilo y sus ajustes. Pídeselo a tu coordinadora con tus palabras, o ármalo paso a paso.</p>
          <div className="enc-pie">
            <Boton variante="secundario" href={enlace.nuevo({})}>
              Abrir «Nuevo anuncio»
            </Boton>
            <Boton variante="primario" icono={MessageCircle} onClick={onPedirAValentina}>
              Pedírselo a la coordinadora
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
