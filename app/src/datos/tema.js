// El tema de la app: 'juego' (el de siempre desde 2026-11-23: neón de atardecer, como un videojuego), 'oscuro', 'claro'
// o 'auto' (claro u oscuro según el computador). Se guarda en este navegador y se aplica en
// <html data-tema="claro|oscuro"> (los colores salen de estilos/tokens.css). index.html lo aplica antes de pintar
// para que no parpadee. El editor de video pide quedarse oscuro (forzarOscuro) mientras está abierto.
import { useSyncExternalStore } from 'react';

const CLAVE = 'kads:tema';
const consultaClaro = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const oyentes = new Set();
let forzado = 0;

const VALIDOS = new Set(['juego', 'claro', 'oscuro', 'auto']);
// (2026-11-23) el tema «Juego» llega una vez a quien tenía el oscuro de siempre; después manda lo que elija
const MIGRADO = 'kads:tema-juego';
function migrar() {
  try {
    if (window.localStorage.getItem(MIGRADO)) return;
    window.localStorage.setItem(MIGRADO, '1');
    if (window.localStorage.getItem(CLAVE) === 'oscuro') window.localStorage.setItem(CLAVE, 'juego');
  } catch {
    /* sin almacenamiento */
  }
}
if (typeof window !== 'undefined') migrar();

export function temaElegido() {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return VALIDOS.has(v) ? v : 'juego';
  } catch {
    return 'juego';
  }
}

/** El que se ve ahora: 'juego', 'claro' u 'oscuro'. */
export function temaActual() {
  const e = temaElegido();
  return e === 'auto' ? (consultaClaro?.matches ? 'claro' : 'juego') : e;
}

function aplicar() {
  const actual = temaActual();
  const t = forzado > 0 && actual !== 'juego' ? 'oscuro' : actual;
  const html = document.documentElement;
  if (html.dataset.tema !== t) html.dataset.tema = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'claro' ? '#f5eff8' : t === 'juego' ? '#0b0616' : '#050505');
  const esquema = document.querySelector('meta[name="color-scheme"]');
  if (esquema) esquema.setAttribute('content', t === 'claro' ? 'light' : 'dark');
  oyentes.forEach((f) => f());
}

export function elegirTema(t) {
  try {
    window.localStorage.setItem(CLAVE, t);
  } catch {
    /* sin almacenamiento: solo en esta visita */
  }
  aplicar();
}

/** El editor de video: oscuro mientras está abierto, aunque la app esté en claro. */
export function forzarOscuro(si) {
  forzado = Math.max(0, forzado + (si ? 1 : -1));
  aplicar();
}

consultaClaro?.addEventListener?.('change', aplicar);
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => e.key === CLAVE && aplicar()); // otra pestaña lo cambió
  aplicar();
}

function suscribir(f) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
/** { elegido: 'juego'|'claro'|'oscuro'|'auto', actual: 'juego'|'claro'|'oscuro' } y se actualiza solo. */
export function useTema() {
  const elegido = useSyncExternalStore(suscribir, temaElegido, () => 'juego');
  const actual = useSyncExternalStore(suscribir, temaActual, () => 'juego');
  return { elegido, actual };
}
