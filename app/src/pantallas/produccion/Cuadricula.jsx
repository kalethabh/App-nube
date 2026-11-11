// La cuadrícula escena por escena: cada fila es una escena con su frase y sus piezas en orden
// (inicio -> final -> clip, y sus imágenes de apoyo aparte). Arriba, las hojas de referencia; al final, los ganchos de
// UGC (el mismo anuncio con otro comienzo).
// Una pieza con un aviso de la revisión se marca aparte (la revisión ya no rehace nada sola: tú decides).
import { memo, useMemo, useState } from 'react';
import { ChevronRight, Clapperboard, Layers, Mic, Shuffle } from 'lucide-react';
import { Chip, Insignia, Seccion } from '../../componentes/index.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';
import { Pieza } from './Pieza.jsx';

const PESO = { 'te-necesita': 5, generando: 4, 'en-cola': 3, arreglado: 2, listo: 1 };

/** El estado de una escena: lo peor de sus piezas (para la insignia de la fila). */
function estadoDeToma(piezas, estados) {
  const es = piezas.map((p) => estados.get(p.id)?.estado || 'en-cola');
  if (es.includes('te-necesita')) return 'te-necesita';
  // cian solo si algo de esta escena se está haciendo ahora; si solo espera, gris ("En espera")
  if (es.includes('generando')) return 'generando';
  if (es.includes('en-cola')) return 'en-cola';
  if (piezas.some((p) => p.avisos?.length)) return 'aviso';
  if (es.includes('arreglado')) return 'arreglado';
  return 'listo';
}

// cada filtro dice qué piezas muestra (el de «Con aviso» mira lo que notó la revisión, no el estado)
const FILTROS = [
  { id: 'todas', texto: 'Todas', es: () => true },
  { id: 'generando', texto: 'Generándose', es: (p, e) => e === 'generando' },
  { id: 'aviso', texto: 'Con aviso', es: (p, e) => e !== 'generando' && e !== 'en-cola' && Boolean(p.avisos?.length) },
  { id: 'arreglado', texto: 'Se arreglaron solas', es: (p, e) => e === 'arreglado' },
  { id: 'te-necesita', texto: 'Te necesitan', es: (p, e) => e === 'te-necesita' },
];
const FILTRO = Object.fromEntries(FILTROS.map((f) => [f.id, f]));

const etiquetaHabla = (g) => {
  const quien = g.quien || (g.habla === 'A' ? 'el anfitrión A' : g.habla === 'B' ? 'el anfitrión B' : g.habla);
  if (!quien) return null;
  return g.reacciones ? `Escucha ${quien}` : `Habla ${quien}`;
};

/** Las tomas de un cantado sin letra: "[intro]" -> "Intro (sin letra)". */
function marcaSinLetra(linea) {
  const m = String(linea || '').trim().match(/^\[([^\]]*)\]$/);
  if (!m) return null;
  const k = m[1].toLowerCase();
  if (k.startsWith('intro')) return 'Intro (sin letra)';
  if (k.startsWith('instrumental')) return 'Parte instrumental';
  if (k.startsWith('cierre') || k.startsWith('outro') || k.startsWith('final')) return 'Cierre (sin letra)';
  return 'Sin letra';
}

function FilaTomaBase({ grupo, estados, seleccion, onAbrir, filtro, hablado }) {
  const todas = [...grupo.flujo, ...grupo.broll];
  const estado = estadoDeToma(todas, estados);
  const atenuar = (p) => filtro !== 'todas' && !FILTRO[filtro].es(p, estados.get(p.id)?.estado || 'en-cola');
  const unaSola = todas.length === 1;
  return (
    <article className={`prod-toma prod-toma--${estado === 'aviso' ? 'con-aviso' : estado}${unaSola ? ' prod-toma--una' : ''}${todas.length > 5 ? ' prod-toma--muchas' : ''}`} aria-label={`Escena ${grupo.n}`}>
      <header className="prod-toma__cabecera">
        <span className="prod-toma__numero t-mono" aria-hidden="true">
          {String(grupo.n).padStart(2, '0')}
        </span>
        <div className="prod-toma__textos">
          <p className={`prod-toma__linea${unaSola ? '' : ' t-dos-lineas'}`} title={grupo.linea}>
            {grupo.linea && !/^\[[^\]]*\]$/.test(grupo.linea.trim()) ? (
              `«${grupo.linea}»`
            ) : (
              <span className="t-3">{grupo.reacciones ? 'Reacciones, sin palabras' : marcaSinLetra(grupo.linea) || 'Escena sin texto'}</span>
            )}
          </p>
          <div className="prod-toma__meta">
            <Insignia estado={estado} tamano="chico" texto={estado === 'listo' ? 'Lista' : estado === 'arreglado' ? 'Se arregló sola' : undefined} />
            {grupo.duracion ? <span className="t-mono prod-toma__dur">{fmtDuracion(grupo.duracion)}</span> : null}
            {grupo.fase ? <span className="prod-toma__fase">{grupo.fase}</span> : null}
            {hablado && grupo.habla ? (
              <span className="prod-toma__fase">
                <Mic size={11} strokeWidth={2.2} aria-hidden="true" /> {etiquetaHabla(grupo)}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      <div className="prod-toma__piezas">
        {grupo.flujo.length ? (
          <div className="prod-toma__flujo">
            {grupo.flujo.map((p, i) => (
              <div key={p.id} className={`prod-toma__paso${atenuar(p) ? ' prod-toma__paso--atenuado' : ''}`}>
                {i > 0 ? <ChevronRight className="prod-toma__flecha" size={12} strokeWidth={2.2} aria-hidden="true" /> : null}
                <Pieza pieza={p} estado={estados.get(p.id)?.estado} nota={estados.get(p.id)?.nota} seleccionada={seleccion === p.id} onAbrir={onAbrir} />
              </div>
            ))}
          </div>
        ) : null}
        {grupo.broll.length ? (
          <div className="prod-toma__broll">
            {grupo.broll.map((p, i) => (
              <div key={p.id} className={`prod-toma__paso${atenuar(p) ? ' prod-toma__paso--atenuado' : ''}`}>
                {i > 0 ? <ChevronRight className="prod-toma__flecha" size={12} strokeWidth={2.2} aria-hidden="true" /> : null}
                <Pieza pieza={p} estado={estados.get(p.id)?.estado} nota={estados.get(p.id)?.nota} seleccionada={seleccion === p.id} onAbrir={onAbrir} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
// La fila solo se vuelve a dibujar si cambió algo suyo (la simulación avanza varias veces por segundo).
const FilaToma = memo(
  FilaTomaBase,
  (a, b) => a.firma === b.firma && a.grupo === b.grupo && a.onAbrir === b.onAbrir && a.hablado === b.hablado
);

export function Cuadricula({ modelo, estados, seleccion, onAbrir }) {
  const [filtro, setFiltro] = useState('todas');

  const cuentas = useMemo(() => {
    const c = Object.fromEntries(FILTROS.map((f) => [f.id, 0]));
    for (const p of modelo.piezas) {
      const e = estados.get(p.id)?.estado || 'en-cola';
      for (const f of FILTROS) if (f.es(p, e)) c[f.id]++;
    }
    return c;
  }, [modelo, estados]);

  // si el filtro se queda sin nada (p. ej. terminó de generarse todo), vuelve a "Todas"
  const filtroEfectivo = filtro !== 'todas' && !cuentas[filtro] ? 'todas' : filtro;
  const pasa = (p) => FILTRO[filtroEfectivo].es(p, estados.get(p.id)?.estado || 'en-cola');
  const visibles = modelo.tomas.filter((g) => filtroEfectivo === 'todas' || [...g.flujo, ...g.broll].some(pasa));
  const hojasVisibles = modelo.hojas.filter((p) => filtroEfectivo === 'todas' || pasa(p));
  const sueltosVisibles = modelo.sueltos.filter((p) => filtroEfectivo === 'todas' || pasa(p));
  const ganchosVisibles = (modelo.ganchos || []).filter((p) => filtroEfectivo === 'todas' || pasa(p));
  // firma por fila: la fila solo se vuelve a dibujar si cambió algo suyo
  const firmaDe = (g) => {
    const piezas = [...g.flujo, ...g.broll];
    const sel = piezas.some((p) => p.id === seleccion) ? seleccion : '';
    return piezas.map((p) => `${estados.get(p.id)?.estado}${estados.get(p.id)?.nota || ''}${p.avisos?.length || ''}${p.fecha || ''}`).join('|') + sel;
  };

  return (
    <div className="prod-cuadricula">
      <div className="prod-filtros" role="toolbar" aria-label="Filtrar piezas">
        {FILTROS.map((f) =>
          f.id === 'todas' || cuentas[f.id] ? (
            <Chip
              key={f.id}
              activo={filtroEfectivo === f.id}
              onClick={() => setFiltro(f.id)}
              contador={cuentas[f.id]}
              tono={f.id === 'te-necesita' ? 'error' : f.id === 'arreglado' || f.id === 'aviso' ? 'aviso' : f.id === 'generando' ? 'cian' : 'neutro'}
            >
              {f.texto}
            </Chip>
          ) : null
        )}
        <span className="prod-filtros__leyenda" aria-hidden="true">
          <span>
            <i className="punto punto--ok" /> Lista
          </span>
          <span>
            <i className="punto punto--aviso" /> Con aviso
          </span>
          <span>
            <i className="punto punto--error" /> Te necesita
          </span>
          <span>
            <i className="punto punto--generando" /> Generándose
          </span>
        </span>
      </div>

      {hojasVisibles.length ? (
        <Seccion
          titulo={modelo.hablado ? 'Personajes y referencias' : 'Hojas de referencia'}
          contador={hojasVisibles.length}
          icono={Layers}
          descripcion="Salen primero: de ellas se arma cada escena para que el personaje y tu producto se vean siempre iguales."
        >
          <div className="prod-hojas escalonado">
            {hojasVisibles.map((p) => (
              <div key={p.id} className="prod-hoja">
                <Pieza pieza={p} estado={estados.get(p.id)?.estado} nota={estados.get(p.id)?.nota} seleccionada={seleccion === p.id} onAbrir={onAbrir} tamano="grande" mostrarEtiqueta={false} />
                <span className="prod-hoja__nombre t-recortar">{p.nombre}</span>
              </div>
            ))}
          </div>
        </Seccion>
      ) : null}

      {/* (con un filtro, solo si le queda alguna escena, y con cuántas quedan) */}
      {visibles.length ? (
        <Seccion
          titulo="Escena por escena"
          contador={visibles.length}
          icono={Clapperboard}
          descripcion={
            modelo.continuidad
              ? 'Cada escena con su imagen de inicio y final, y el paso que la une con la siguiente. Toca una pieza para verla, descargarla o regenerarla.'
              : modelo.hablado
                ? 'Cada escena con su frase del guion. Al pasar el mouse, el clip se reproduce; tócalo para verlo, descargarlo o regenerarlo.'
                : 'Cada escena con su imagen, su clip y sus imágenes de apoyo. Al pasar el mouse, el clip se reproduce; tócalo para verlo, descargarlo o regenerarlo.'
          }
        >
          <div className="prod-tomas">
            {visibles.map((g) => (
              <FilaToma
                key={g.n}
                grupo={g}
                estados={estados}
                seleccion={seleccion}
                onAbrir={onAbrir}
                filtro={filtroEfectivo}
                hablado={modelo.hablado}
                firma={firmaDe(g) + filtroEfectivo}
              />
            ))}
          </div>
        </Seccion>
      ) : null}

      {sueltosVisibles.length ? (
        <Seccion titulo="Imágenes de apoyo" contador={new Set(sueltosVisibles.map((p) => p.broll)).size} icono={Layers}>
          <div className="prod-hojas">
            {sueltosVisibles.map((p) => (
              <Pieza key={p.id} pieza={p} estado={estados.get(p.id)?.estado} nota={estados.get(p.id)?.nota} seleccionada={seleccion === p.id} onAbrir={onAbrir} />
            ))}
          </div>
        </Seccion>
      ) : null}

      {ganchosVisibles.length ? (
        <Seccion
          titulo="Otros comienzos (ganchos)"
          contador={ganchosVisibles.length}
          icono={Shuffle}
          descripcion="El mismo anuncio con otro arranque, para probar cuál vende más: cada uno reemplaza el comienzo y su versión está en la entrega. Toca uno para verlo, descargarlo o regenerarlo."
        >
          <div className="prod-hojas">
            {ganchosVisibles.map((p) => (
              <div key={p.id} className="prod-hoja">
                <Pieza pieza={p} estado={estados.get(p.id)?.estado} nota={estados.get(p.id)?.nota} seleccionada={seleccion === p.id} onAbrir={onAbrir} mostrarEtiqueta={false} />
                <span className="prod-hoja__nombre t-recortar" title={p.linea ? `«${p.linea}»` : undefined}>
                  {p.nombre}
                </span>
              </div>
            ))}
          </div>
        </Seccion>
      ) : null}
    </div>
  );
}

export { PESO };
