// «Cuentas que sigues» (la columna de la izquierda de Inspiración): las marcas que sigues con sus anuncios activos,
// un buscador (filtra las tuyas al instante; «Buscar en TrendTrack» busca marcas nuevas, una consulta guardada 7 días)
// y «Traer de mi Brandtracker». Tocar una marca muestra sus anuncios en el feed.
import { useState } from 'react';
import { Download, LayoutGrid, Search, UserMinus, UserPlus, X } from 'lucide-react';
import { Boton, useAvisos } from '../../componentes/index.js';
import { invalidar } from '../../datos/api.js';
import { Avatar } from './Tarjeta.jsx';
import { inspiracion, miles, urlMedia } from './datos.js';

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Marcas({ marcas = [], activa, onElegir, onCambio }) {
  const { aviso } = useAvisos();
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(null); // 'texto' | 'brandtracker'
  const [encontradas, setEncontradas] = useState(null); // { marcas, nota }
  const seguidas = new Set(marcas.map((m) => m.id));
  const filtradas = texto.trim() ? marcas.filter((m) => sinTildes(`${m.nombre} ${m.dominio || ''}`).includes(sinTildes(texto.trim()))) : marcas;

  const buscar = async (brandtracker = false) => {
    setBuscando(brandtracker ? 'brandtracker' : 'texto');
    try {
      const r = brandtracker ? await inspiracion.brandtracker() : await inspiracion.buscarMarcas(texto);
      const nota = r.desdeCache ? 'Ya la habías hecho: salió gratis.' : r.simulado ? 'Marcas simuladas (modo prueba).' : r.gastados != null ? `Gastó ${miles(r.gastados)} créditos de TrendTrack.` : '';
      setEncontradas({ marcas: r.marcas || [], nota, brandtracker });
      if (r.creditos) invalidar('ganadores');
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No pude buscar marcas', texto: e.message });
    } finally {
      setBuscando(null);
    }
  };

  const alternar = async (m) => {
    try {
      if (seguidas.has(m.id)) {
        await inspiracion.dejar(m.id);
        if (activa?.id === m.id) onElegir(null);
      } else await inspiracion.seguir(m);
      onCambio();
    } catch (e) {
      aviso({ tipo: 'error', titulo: 'No se pudo', texto: e.message });
    }
  };

  return (
    <aside className="insp-marcas" aria-label="Cuentas que sigues">
      <div className="insp-marcas__titulo">
        <span>Cuentas que sigues</span>
        <span className="insp-marcas__cuenta">{marcas.length}</span>
      </div>
      <label className="insp-marcas__buscar">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={texto}
          placeholder="Buscar marca…"
          maxLength={120}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && texto.trim().length >= 2 && !filtradas.length) buscar();
          }}
          aria-label="Buscar marca"
        />
      </label>

      <button type="button" className={`insp-marca${!activa ? ' insp-marca--activa' : ''}`} onClick={() => onElegir(null)}>
        <span className="insp-avatar insp-avatar--letra" aria-hidden="true">
          <LayoutGrid size={14} />
        </span>
        <span className="insp-marca__texto">
          <strong>Todas las marcas</strong>
          <span>Con tus filtros</span>
        </span>
      </button>
      <ul className="insp-marcas__lista">
        {filtradas.map((m) => (
          <li key={m.id}>
            <button type="button" className={`insp-marca${activa?.id === m.id ? ' insp-marca--activa' : ''}`} onClick={() => onElegir(m)} title={`Ver los anuncios de ${m.nombre}`}>
              <Avatar nombre={m.nombre} logo={urlMedia(m.logo)} tamano={28} />
              <span className="insp-marca__texto">
                <strong>{m.nombre}</strong>
                <span>{m.activos != null ? `${miles(m.activos)} anuncios activos` : m.dominio || 'Sin datos todavía'}</span>
              </span>
            </button>
            <button type="button" className="insp-marca__quitar" onClick={() => alternar(m)} aria-label={`Dejar de seguir ${m.nombre}`} title="Dejar de seguir">
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      {!marcas.length ? <p className="insp-marcas__vacio">Sigue una marca desde «Detalles» de un anuncio o búscala aquí.</p> : null}

      <div className="insp-marcas__acciones">
        {texto.trim().length >= 2 ? (
          <Boton variante="secundario" tamano="chico" bloque icono={Search} onClick={() => buscar(false)} cargando={buscando === 'texto'} disabled={Boolean(buscando)}>
            Buscar «{texto.trim().slice(0, 18)}» en TrendTrack
          </Boton>
        ) : null}
        <Boton variante="fantasma" tamano="chico" bloque icono={Download} onClick={() => buscar(true)} cargando={buscando === 'brandtracker'} disabled={Boolean(buscando)}>
          Traer de mi Brandtracker
        </Boton>
        <p className="insp-marcas__nota">Buscar marcas gasta pocos créditos de TrendTrack; la misma búsqueda sale gratis por 7 días.</p>
      </div>

      {encontradas ? (
        <div className="insp-marcas__encontradas">
          <div className="insp-marcas__titulo">
            <span>{encontradas.brandtracker ? 'Tu Brandtracker' : 'En TrendTrack'}</span>
            <button type="button" className="insp-marca__quitar" onClick={() => setEncontradas(null)} aria-label="Cerrar resultados">
              <X size={13} />
            </button>
          </div>
          {encontradas.nota ? <p className="insp-marcas__nota">{encontradas.nota}</p> : null}
          {encontradas.marcas.length ? (
            <ul className="insp-marcas__lista">
              {encontradas.marcas.map((m) => (
                <li key={m.id}>
                  <div className="insp-marca insp-marca--fija">
                    <Avatar nombre={m.nombre} logo={urlMedia(m.logo)} tamano={28} />
                    <span className="insp-marca__texto">
                      <strong>{m.nombre}</strong>
                      <span>{m.activos != null ? `${miles(m.activos)} anuncios activos` : m.dominio || ''}</span>
                    </span>
                  </div>
                  <Boton variante={seguidas.has(m.id) ? 'secundario' : 'fantasma'} tamano="chico" soloIcono icono={seguidas.has(m.id) ? UserMinus : UserPlus} etiqueta={seguidas.has(m.id) ? `Dejar de seguir ${m.nombre}` : `Seguir ${m.nombre}`} onClick={() => alternar(m)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="insp-marcas__vacio">No encontré marcas con ese nombre.</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
