// El saldo de las APIs (GET /api/saldo): kie.ai (créditos y su valor) y lo que queda del plan de ElevenLabs.
// Lo usan el pie del menú y la pantalla Saldo y costos. Solo lee: no cobra nada.
import { invalidar, useDatos } from './api.js';

export async function leerSaldo({ fresco = false } = {}) {
  const r = await fetch(`/api/saldo${fresco ? '?fresco=1' : ''}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No pude leer el saldo.');
  const d = await r.json();
  if (fresco) invalidar('saldo');
  return d;
}

export const useSaldo = (opciones = { cadaMs: 60000 }) => useDatos(opciones?.habilitado===false?null:'saldo', () => leerSaldo(), opciones);

/** "US$12,40" o null. */
export const dolares = (kie) => (kie?.dolares != null ? `US$${Number(kie.dolares).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null);

/** "8,2 mil libres" (caracteres de voz) o null. */
export function vozLibre(voz) {
  if (!voz?.limite) return null;
  const libres = Math.max(0, voz.limite - (voz.usados || 0));
  const t = libres >= 1e6 ? `${(libres / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M` : libres >= 1000 ? `${(libres / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} mil` : String(libres);
  return `${t} libres`;
}
