// Ajustes · Tu PC: cuántos anuncios puede hacer a la vez esta computadora (memoria, núcleos y espacio
// libre REALES, leídos en el servidor) y el selector para cambiarlo. Las revisiones de los programas que
// usa la app (programa de video, armado del video, Python, Node y el programa de tu IA: Claude Code o Codex) solo
// aparecen si a alguna le falta algo: lo que falta lo instala el lanzador al abrir la app, y el programa de tu IA, la
// app (Ajustes › Conexiones, «Instalar»).
import { useState } from 'react';
import { Clapperboard, Code, Cpu, Film, Globe, HardDrive, Layers, MemoryStick, RefreshCw, Ruler, Server, TerminalSquare } from 'lucide-react';
import { Boton, Esqueleto, Seccion, Selector, Tarjeta } from '../../componentes/index.js';
import { apiAjustes, gb } from './datos.js';
import { FilaRevision } from './piezas.jsx';

/** "12th Gen Intel(R) Core(TM) i5-12450HX" -> "Intel Core i5-12450HX" */
export function nombreProcesador(modelo) {
  if (!modelo) return 'Procesador';
  return modelo
    .replace(/\((R|TM)\)/gi, '')
    .replace(/\bCPU\b/gi, '')
    .replace(/@.*$/, '')
    .replace(/^\d+(?:st|nd|rd|th) Gen\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lo que el lanzador instala solo. `corto` es para la bienvenida, donde el renglón es angosto.
export const TEXTO_REVISION = {
  ffmpeg: { titulo: 'Programa de video', bien: 'Listo para armar y revisar tus clips', mal: 'Lo instala el lanzador al abrir la app' },
  ffprobe: { titulo: 'Medidor de video', bien: 'Listo para medir tus clips', mal: 'Va con el programa de video: lo instala el lanzador al abrir la app' },
  vp9: {
    titulo: 'Video con fondo transparente',
    mal: 'Al programa de video le falta una parte que solo usa el podcast con el host en la esquina. El lanzador instala el completo al abrir la app',
  },
  remotion: { titulo: 'Armado del video', bien: 'Listo para armar tus videos', mal: 'Lo instala el lanzador al abrir la app' },
  navegador: { titulo: 'Navegador del render', bien: 'Ya está bajado: el primer video sale sin esperas', mal: 'Se baja solo la primera vez (unos 100 MB)' },
  python: {
    titulo: 'Python',
    mal: 'Solo hace falta para el podcast con el host en la esquina, la entrevista y los iconos. Lo instala el lanzador al abrir la app',
    corto: 'Solo para podcast en esquina, entrevista e iconos',
  },
  node: { titulo: 'Base de la app', bien: 'Node.js', mal: 'Hace falta una versión más nueva: la instala el lanzador al abrir la app' },
  // el programa de tu IA (solo el de la elegida): su nombre viene en la revisión (r.programa)
  motor: { titulo: 'El programa de tu IA', bien: 'Instalado', mal: 'Lo instala la app: Ajustes › Conexiones, «Instalar»' },
  // (un servidor de antes solo revisaba Claude Code, y lo instalaba el lanzador)
  claude: { titulo: 'Claude Code', bien: 'Instalado', mal: 'Lo instala el lanzador al abrir la app' },
};

export const ICONO_REVISION = { ffmpeg: Film, ffprobe: Ruler, vp9: Layers, remotion: Clapperboard, navegador: Globe, python: Code, node: Server, motor: TerminalSquare, claude: TerminalSquare };

/** Lo que se hace si falta algo, en una frase. */
const QUE_HACER = 'Para instalar lo que falta, cierra la ventana negra y vuelve a abrir Anuncios con IA: lo instala solo. Después toca «Volver a revisar».';

/** Las 6 casillas de "anuncios a la vez": se encienden las que tu PC aguanta. */
export function Casillas({ encendidas, total = 6 }) {
  return (
    <div className="casillas" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`casilla${i < encendidas ? ' casilla--si' : ''}`} style={{ '--i': i }}>
          <Film size={14} strokeWidth={2} />
        </span>
      ))}
    </div>
  );
}

export function TuPC({ ajustes, recargar, alCambiarALaVez }) {
  const [revisando, setRevisando] = useState(false);
  const revisar = async () => {
    setRevisando(true);
    const inicio = Date.now();
    try {
      // que el servidor vuelva a medir todo (no la revisión guardada de hace un rato)
      await apiAjustes.revisarPC().catch(() => {});
      await recargar();
    } finally {
      // que se note que revisó, aunque la respuesta llegue al instante
      setTimeout(() => setRevisando(false), Math.max(0, 700 - (Date.now() - inicio)));
    }
  };
  const eq = ajustes?.equipo;
  const pref = ajustes?.preferencias;
  const rec = eq?.recomendacion;
  const aLaVez = pref?.aLaVez ?? 'auto';
  // lo que la app hace de verdad: lo elegido, o en automático lo que aguanta tu PC (el servidor cuenta igual)
  const tope = Math.max(1, ajustes?.produccion?.aLaVez ?? 6);
  const elegidos = Math.min(tope, aLaVez === 'auto' ? rec?.aLaVez || 1 : aLaVez);
  const automatico = aLaVez === 'auto';
  // el armado final (render, recorte del host) va de a uno; con 32 GB de memoria o más, de a dos
  const armadosALaVez = (eq?.memoria?.nominalGB ?? 0) >= 32 ? 2 : 1;
  const motivo = !rec
    ? null
    : automatico || elegidos === rec.aLaVez
      ? rec.motivo
      : elegidos > rec.aLaVez
        ? `Lo cómodo para tu PC ${rec.aLaVez === 1 ? 'es uno' : `son ${rec.aLaVez}`}. Con ${elegidos}, el armado final de los videos hace fila y cada anuncio tarda un poco más.`
        : `Tu PC aguantaría ${rec.aLaVez}. Si apruebas más guiones, cada uno empieza apenas se libera un lugar.`;
  // el navegador del render se baja solo con el primer video: no es una falta. Lo obligatorio va primero.
  // (sin IA elegida no hay programa que instalar: se elige en Conexiones)
  const faltan = (eq?.revisiones || []).filter((r) => !r.ok && r.id !== 'navegador' && !(r.id === 'motor' && !r.motor)).sort((a, b) => Number(Boolean(b.obligatorio)) - Number(Boolean(a.obligatorio)));
  // el programa de tu IA lo instala la app (su fila ya lo dice): "cierra la ventana negra…" es para lo demás
  const queHacer = faltan.some((r) => r.id !== 'motor');

  // en qué se basa la recomendación, dicho corto
  const base = eq
    ? [
        { id: 'memoria', icono: MemoryStick, texto: `${eq.memoria.nominalGB} GB de memoria` },
        { id: 'nucleos', icono: Cpu, texto: `${eq.procesador.nucleos} núcleos`, titulo: nombreProcesador(eq.procesador.modelo) },
        eq.disco ? { id: 'disco', icono: HardDrive, texto: `${gb(eq.disco.libre)} libres` } : null,
      ].filter(Boolean)
    : [];

  return (
    <Seccion
      id="tu-pc"
      className="ajustes__seccion"
      titulo="Tu PC"
      descripcion={eq ? `Revisado recién en esta computadora · ${eq.sistema}` : 'Revisando esta computadora…'}
      acciones={
        <Boton variante="fantasma" tamano="chico" icono={RefreshCw} cargando={revisando} onClick={revisar}>
          Volver a revisar
        </Boton>
      }
    >
      {!eq ? (
        <Esqueleto alto={230} />
      ) : (
        <>
          <Tarjeta variante="elevada" relleno="ninguno" className="pc-recomendacion">
            <div className="pc-recomendacion__numero">
              <span className="t-etiqueta">{automatico ? 'Tu PC puede hacer' : 'La app hace'}</span>
              <span className="pc-recomendacion__cifra t-num">{elegidos}</span>
              <span className="pc-recomendacion__unidad">{elegidos === 1 ? 'anuncio a la vez' : 'anuncios a la vez'}</span>
            </div>
            <div className="pc-recomendacion__cuerpo">
              <Casillas encendidas={elegidos} />
              <p className="pc-recomendacion__motivo">{motivo}</p>
              <p className="pc-recomendacion__nota">
                Las imágenes y los videos se hacen en internet y no cargan tu PC. Lo que sí la usa es el armado final de cada video:{' '}
                {armadosALaVez === 2 ? 'con tu memoria se arman dos a la vez.' : 'se arma uno a la vez y los demás esperan su turno.'}
              </p>
              <div className="pc-recomendacion__pie">
                <Selector
                  etiqueta="Anuncios a la vez"
                  className="pc-recomendacion__selector"
                  value={String(aLaVez)}
                  onChange={(ev) => alCambiarALaVez(ev.target.value === 'auto' ? 'auto' : Number(ev.target.value))}
                  opciones={[
                    { valor: 'auto', etiqueta: `Automático (${rec.aLaVez}, lo recomendado)` },
                    ...Array.from({ length: tope }, (_, i) => i + 1).map((n) => ({
                      valor: String(n),
                      etiqueta: `${n} ${n === 1 ? 'anuncio' : 'anuncios'}${n > rec.aLaVez ? ' · más lento' : ''}`,
                    })),
                  ]}
                />
                <ul className="pc-base" aria-label="En qué se basa">
                  {base.map((b) => {
                    const Icono = b.icono;
                    return (
                      <li key={b.id} className="pc-base__dato t-num" title={b.titulo}>
                        <Icono size={14} strokeWidth={2} aria-hidden="true" />
                        {b.texto}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Tarjeta>

          {faltan.length ? (
            <Tarjeta relleno="compacto" className="pc-revisiones">
              {faltan.map((r) => {
                const t = TEXTO_REVISION[r.id] || { titulo: r.id, mal: 'Falta algo' };
                const titulo = r.id === 'motor' && r.programa ? r.programa : t.titulo;
                return <FilaRevision key={r.id} icono={ICONO_REVISION[r.id] || Server} ok={false} titulo={titulo} detalle={r.aviso ? `${r.aviso}.` : `${t.mal}.`} />;
              })}
              {queHacer ? <p className="pc-revisiones__que-hacer">{QUE_HACER}</p> : null}
            </Tarjeta>
          ) : null}
        </>
      )}
    </Seccion>
  );
}
