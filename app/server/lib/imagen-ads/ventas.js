// APRENDER DE LAS VENTAS REALES (2026-11-26a). Pedido: «con sep.js, cruzar el nombre de los anuncios con el formato y
// el ángulo, y guardar por producto la mejor combinación formato + ángulo (compras, costo por compra) en
// mis_archivos/biblioteca/aprendizajes/; la estrategia prioriza lo que ganó y siempre prueba ≥3 combinaciones nuevas».
// El nombre de descarga de cada imagen (variedad.js: 'aguaje_V03-F17-ugc-selfie-transformacion.png') es lo que se
// reconoce en el nombre del anuncio en Meta (al subir la imagen, Meta suele usar el nombre del archivo).
//
//   leerNombre(nombre)                    { producto, v, formato_id, angulo_id } o null
//   anunciosAVentas(anuncios)             { <producto>: [{ formato_id, angulo_id, compras, gasto, cpa, anuncios }] }
//   aprenderDeVentas({ rango })           lee Meta (todas tus cuentas), guarda imagen-ads-ventas.json y su resumen .md
//   historialDe(nombreProducto)           las combinaciones de ese producto, las que más vendieron primero
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON } from '../archivos.js';
import { DIR_APRENDIZAJES } from '../aprendizajes.js';
import { leerSkill } from './verificar.js';
import { guardarJSON } from './disco.js';
import { normal } from './variedad.js';

export const ARCHIVO_VENTAS = path.join(DIR_APRENDIZAJES, 'imagen-ads-ventas.json');
const ARCHIVO_RESUMEN = path.join(DIR_APRENDIZAJES, 'imagen-ads-ventas.md');
// (igual que el nombre de descarga: hasta 30 letras)
const clave = (t) => normal(t).replace(/ñ/g, 'n').replace(/\s+/g, '-').slice(0, 30).replace(/-+$/, '');
const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;

/** Lo que dice el nombre de un anuncio hecho con la app: producto, variación, formato y ángulo (o null). */
export function leerNombre(nombre) {
  const t = String(nombre || '').trim().replace(/\.(png|jpe?g|webp)$/i, '').replace(/-9x16$/i, '');
  const m = /^(.+?)_(V\d{2,3})-([FG]\d{2})(?:-(.+))?$/i.exec(t);
  if (!m) return null;
  const formato_id = m[3].toUpperCase();
  const resto = String(m[4] || '').toLowerCase();
  const { angulos, formatos } = leerSkill();
  if (!formatos.has(formato_id)) return null;
  // el ángulo es el final del nombre: el id más largo de angulos.json con el que termina
  const angulo_id = [...angulos.keys()].sort((a, b) => b.length - a.length).find((a) => resto === a || resto.endsWith(`-${a}`)) || null;
  return { producto: clave(m[1]), v: m[2].toUpperCase(), formato_id, angulo_id };
}

/** Junta los anuncios del informe del SEP por producto y por formato + ángulo. */
export function anunciosAVentas(anuncios = []) {
  const por = {};
  for (const a of anuncios) {
    const n = leerNombre(a?.nombre) || leerNombre(a?.titulo);
    if (!n?.angulo_id) continue;
    const lista = (por[n.producto] ||= []);
    let c = lista.find((x) => x.formato_id === n.formato_id && x.angulo_id === n.angulo_id);
    if (!c) lista.push((c = { formato_id: n.formato_id, angulo_id: n.angulo_id, compras: 0, gasto: 0, anuncios: 0 }));
    c.compras += Number(a.compras) || 0;
    c.gasto = r2(c.gasto + (Number(a.gasto) || 0));
    c.anuncios += 1;
  }
  for (const lista of Object.values(por)) {
    for (const c of lista) c.cpa = c.compras ? r2(c.gasto / c.compras) : null;
    lista.sort((a, b) => b.compras - a.compras || (a.cpa ?? Infinity) - (b.cpa ?? Infinity) || a.gasto - b.gasto);
  }
  return por;
}

/** Lee tus anuncios en Meta (todas tus cuentas) y guarda lo aprendido. -> { productos, anuncios, reconocidos } */
export async function aprenderDeVentas({ rango = '90d' } = {}) {
  const sep = await import('../sep.js');
  if (!sep.hayToken()) return { ok: false, motivo: 'sin-meta' };
  const { cuentas } = await sep.cuentas();
  const anuncios = [];
  for (const c of cuentas) {
    try {
      anuncios.push(...(await sep.informe({ alcance: 'cuenta', cuenta: c.id, rango })).anuncios);
    } catch {
      /* una cuenta sin permiso: se sigue con las demás */
    }
  }
  const productos = anunciosAVentas(anuncios);
  const reconocidos = Object.values(productos).reduce((t, l) => t + l.reduce((s, c) => s + c.anuncios, 0), 0);
  guardarJSON(ARCHIVO_VENTAS, { fecha: new Date().toISOString(), rango, productos });
  fs.mkdirSync(DIR_APRENDIZAJES, { recursive: true });
  fs.writeFileSync(ARCHIVO_RESUMEN, resumen(productos, rango));
  return { ok: true, productos, anuncios: anuncios.length, reconocidos };
}

function resumen(productos, rango) {
  const { angulos, formatos } = leerSkill();
  const lineas = [`# Anuncios de imagen: lo que vendió (últimos ${rango.replace('d', ' días')})`, '', 'Lo escribe la app (Anuncios de imagen → «Aprender de mis ventas»). Cada producto, sus combinaciones de formato + ángulo, las que más vendieron primero.', ''];
  for (const [p, lista] of Object.entries(productos)) {
    lineas.push(`## ${p}`);
    for (const c of lista.slice(0, 8)) lineas.push(`- ${c.formato_id} ${formatos.get(c.formato_id)?.nombre || ''} + ${angulos.get(c.angulo_id)?.nombre || c.angulo_id}: ${c.compras} compras, gasto ${c.gasto}${c.cpa !== null ? `, costo por compra ${c.cpa}` : ''} (${c.anuncios} anuncio${c.anuncios === 1 ? '' : 's'})`);
    lineas.push('');
  }
  return lineas.join('\n');
}

/** Las combinaciones de formato + ángulo de un producto (por su nombre), las que más vendieron primero. */
export function historialDe(nombreProducto) {
  const d = leerJSON(ARCHIVO_VENTAS);
  const l = d?.productos?.[clave(nombreProducto)];
  return Array.isArray(l) ? l.slice(0, 20) : [];
}
