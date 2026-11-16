// El tema de la app: 'claro', 'oscuro' o 'auto' (el del computador). Se guarda en este navegador y se aplica en
// <html data-tema="claro|oscuro"> (los colores salen de estilos/tokens.css). index.html lo aplica antes de pintar
// para que no parpadee. El editor de video pide quedarse oscuro (forzarOscuro) mientras está abierto.
import { useSyncExternalStore } from 'react';

const CLAVE = 'kads:tema';
const consultaClaro = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
const oyentes = new Set();
let forzado = 0;

export function temaElegido() {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return v === 'claro' || v === 'oscuro' || v === 'auto' ? v : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

/** El que se ve ahora: 'claro' u 'oscuro'. */
export function temaActual() {
  const e = temaElegido();
  return e === 'auto' ? (consultaClaro?.matches ? 'claro' : 'oscuro') : e;
}

function aplicar() {
  const t = forzado > 0 ? 'oscuro' : temaActual();
  const html = document.documentElement;
  if (html.dataset.tema !== t) html.dataset.tema = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'claro' ? '#f4f5f1' : '#050505');
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
/** { elegido: 'claro'|'oscuro'|'auto', actual: 'claro'|'oscuro' } y se actualiza solo. */
export function useTema() {
  const elegido = useSyncExternalStore(suscribir, temaElegido, () => 'oscuro');
  const actual = useSyncExternalStore(suscribir, temaActual, () => 'oscuro');
  return { elegido, actual };
}
