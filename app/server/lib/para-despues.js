// «TERMINAR DESPUÉS» (2026-11-21g): un anuncio que te necesita (frenado, en pausa, sin saldo o con el guion listo para
// aprobar) lo puedes dejar para después. Ya no sale en «Te necesitan» ni suma al contador rojo: queda en «Para
// después» con «Continuar». Se guarda en temp/<slug>/app/despues.json ({ fecha }) y se borra solo apenas vuelves a
// tocarlo (Continuar, aprobar, pedir cambios o reintentar el guion), así que si se vuelve a frenar te avisa de nuevo.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP } from './rutas.js';
import { leerJSON, segmentoValido } from './archivos.js';

const dirApp = (slug) => path.join(TEMP, slug, 'app');
const archivo = (slug) => path.join(dirApp(slug), 'despues.json');
const valido = (slug) => typeof slug === 'string' && segmentoValido(slug) && !slug.startsWith('.') && fs.existsSync(dirApp(slug));

/** La fecha en que lo dejaste para después, o null. */
export function paraDespues(slug) {
  if (!valido(slug)) return null;
  return leerJSON(archivo(slug))?.fecha || null;
}

export function posponer(slug) {
  if (!valido(slug)) throw Object.assign(new Error('No encuentro ese anuncio.'), { status: 404 });
  const fecha = new Date().toISOString();
  fs.writeFileSync(archivo(slug), JSON.stringify({ fecha }, null, 2));
  return { ok: true, paraDespues: fecha };
}

/** Lo vuelve a poner donde estaba (no falla si no estaba para después). */
export function retomar(slug) {
  try {
    if (valido(slug)) fs.rmSync(archivo(slug), { force: true });
  } catch {
    /* nada que hacer */
  }
  return { ok: true, paraDespues: null };
}
