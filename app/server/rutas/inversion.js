// GET /api/inversion -> cuánto se invirtió en cada producto: la suma del gasto real de sus anuncios (gasto.js), en
// dólares, con el detalle por anuncio. Los gastos se suman: lo que se rehizo se agrega, no reemplaza.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP } from '../lib/rutas.js';
import { leerJSON } from '../lib/archivos.js';
import { resumenDeGasto } from '../lib/gasto.js';
import { listarProductos } from '../lib/productos.js';
import { estiloDeManifiesto } from '../lib/estilos.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function inversionPorProducto() {
  const productos = new Map(listarProductos().map((p) => [p.id, { id: p.id, nombre: p.nombre, foto: p.foto, dolares: 0, anuncios: [] }]));
  let slugs = [];
  try {
    slugs = fs.readdirSync(TEMP, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    slugs = [];
  }
  for (const slug of slugs) {
    const carpeta = path.join(TEMP, slug);
    const brief = leerJSON(path.join(carpeta, 'app', 'brief.json'));
    if (!brief?.productoId) continue;
    let dolares = 0;
    try {
      dolares = Number(resumenDeGasto(carpeta, leerJSON(path.join(carpeta, 'app', 'conductor.json')))?.dolares) || 0;
    } catch {
      dolares = 0;
    }
    if (!productos.has(brief.productoId)) productos.set(brief.productoId, { id: brief.productoId, nombre: brief.productoId, foto: null, dolares: 0, anuncios: [] });
    const p = productos.get(brief.productoId);
    p.dolares = r2(p.dolares + dolares);
    const titulo = leerJSON(path.join(carpeta, 'app', 'guion.json'))?.titulo || slug;
    p.anuncios.push({ slug, titulo, estilo: estiloDeManifiesto({ estilo: brief.estilo }).nombre, dolares: r2(dolares), creado: brief.creado || null });
  }
  const lista = [...productos.values()].filter((p) => p.anuncios.length).sort((a, b) => b.dolares - a.dolares);
  for (const p of lista) p.anuncios.sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
  return { productos: lista, total: r2(lista.reduce((s, p) => s + p.dolares, 0)) };
}

export default function rutasInversion(app) {
  app.get('/api/inversion', (req, res) => {
    try {
      res.json(inversionPorProducto());
    } catch (e) {
      res.status(500).json({ error: 'No pude sumar lo invertido.', detalle: String(e?.message || e) });
    }
  });
}
