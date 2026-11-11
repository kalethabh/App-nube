import { Check, Clock, Hand, LoaderCircle, PencilLine, ScanEye, Sparkles, TriangleAlert, Wrench } from 'lucide-react';
import './Insignia.css';

/**
 * Los estados de la app. Un solo lugar: el tablero, la producción y el editor los muestran igual.
 * Color + icono + texto, siempre los tres (el color nunca va solo).
 */
export const ESTADOS = {
  generando: { texto: 'Generando', tono: 'generando', icono: LoaderCircle, gira: true },
  'en-produccion': { texto: 'En producción', tono: 'generando', icono: LoaderCircle, gira: true },
  listo: { texto: 'Listo', tono: 'ok', icono: Check },
  arreglado: { texto: 'Se arregló sola', tono: 'aviso', icono: Wrench },
  // la revisión notó algo y no se rehízo nada solo: tú decides (regenerarla o dejarla así)
  aviso: { texto: 'Con aviso', tono: 'aviso', icono: ScanEye },
  'te-necesita': { texto: 'Te necesita', tono: 'necesita', icono: Hand, late: true },
  error: { texto: 'Algo falló', tono: 'error', icono: TriangleAlert },
  'en-cola': { texto: 'En espera', tono: 'neutro', icono: Clock },
  borrador: { texto: 'Borrador', tono: 'neutro', icono: PencilLine },
  nuevo: { texto: 'Nuevo', tono: 'acento', icono: Sparkles },
};

/**
 * Insignia de estado.
 *   <Insignia estado="generando" />            -> "Generando" con el icono girando
 *   <Insignia estado="listo" texto="3 versiones" />
 *   <Insignia estado="te-necesita" variante="vidrio" />   (encima de una miniatura)
 *   <Insignia tono="acento" icono={Star}>Recomendado</Insignia>   (sin estado: tono libre)
 *
 * tamano: chico | normal · variante: suave | vidrio | solido
 */
export function Insignia({ estado, tono, icono, texto, children, tamano = 'normal', variante = 'suave', sinIcono = false, className = '' }) {
  const e = estado ? ESTADOS[estado] : null;
  const Icono = icono || e?.icono;
  const t = tono || e?.tono || 'neutro';
  const contenido = children ?? texto ?? e?.texto;
  return (
    <span className={`insignia insignia--${t} insignia--${tamano} insignia--${variante} ${className}`}>
      {variante === 'vidrio' && !sinIcono ? (
        <span className={`punto punto--${t}${e?.late || e?.gira ? ' punto--latido' : ''}`} aria-hidden="true" />
      ) : Icono && !sinIcono ? (
        <Icono size={tamano === 'chico' ? 12 : 13} strokeWidth={2.4} className={e?.gira ? 'girando' : undefined} aria-hidden="true" />
      ) : null}
      {contenido}
    </span>
  );
}

/** Solo el punto de color (cuadrícula de tomas, listas). `latido` = anillo que respira. */
export function PuntoEstado({ estado, tono, latido, etiqueta, className = '' }) {
  const e = estado ? ESTADOS[estado] : null;
  const t = tono || e?.tono || 'neutro';
  const late = latido ?? (e?.late || e?.gira);
  return (
    <span
      className={`punto punto--${t}${late ? ' punto--latido' : ''} ${className}`}
      role={etiqueta || e ? 'img' : undefined}
      aria-label={etiqueta || e?.texto}
      title={etiqueta || e?.texto}
    />
  );
}

/**
 * Chip: etiqueta o filtro.
 *   <Chip>Claymation</Chip>
 *   <Chip activo={x} onClick={…} icono={Mic} contador={3}>Hablados</Chip>   (botón de filtro)
 * tono: neutro | acento | cian | ok | aviso | error
 */
export function Chip({ activo, onClick, icono: Icono, contador, tono = 'neutro', tamano = 'normal', children, className = '', ...resto }) {
  const Etiqueta = onClick ? 'button' : 'span';
  return (
    <Etiqueta
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(activo) : undefined}
      className={`chip chip--${tono} chip--${tamano}${activo ? ' chip--activo' : ''}${onClick ? ' chip--boton' : ''} ${className}`}
      {...resto}
    >
      {Icono ? <Icono size={tamano === 'chico' ? 12 : 14} strokeWidth={2} aria-hidden="true" /> : null}
      {children}
      {contador !== undefined && contador !== null ? <span className="chip__contador">{contador}</span> : null}
    </Etiqueta>
  );
}
