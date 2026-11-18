// El DASHBOARD de inicio (2026-11-18): lo que no da ninguna otra consulta, sacado de lo que ya está en disco.
//
//   resumenDashboard({ dias }) -> {
//     dias: [{ fecha: 'AAAA-MM-DD', anuncios, imagenes, dolares }],   (los últimos `dias`, hoy incluido; hora de Colombia)
//     mes: { anuncios, imagenes, dolares }, mesAnterior: { anuncios, imagenes, dolares },
//     modelos: [{ nombre, piezas, estado }],                            (los más usados en 7 días)
//     recientes: [{ tipo: 'anuncio' | 'lote', slug, titulo, fecha, cantidad? }],   (lo último que terminó)
//   }
//
// Fuentes (las mismas que usa el resto de la app): el gasto de cada corrida (temp/<slug>/app/gasto/*.json: lo que
// costó, con su fecha), cuándo terminó cada anuncio o lote (app/conductor.json: estado «listo» y `terminado`) y, en los
// lotes de imágenes, cuántos anuncios trae (app/informe.json: `variaciones`). Lo de modo prueba no cuenta.
import fs from 'node:fs';
import path from 'node:path';
import { TEMP, esDeEstaApp } from './rutas.js';
import { leerJSON } from './archivos.js';
import { slugsDeAnuncios, tituloDeSlug } from './anuncios.js';
import { modelosDeKie } from './salud.js';

const ZONA = 'America/Bogota';
const diaDe = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const mesDe = (t) => diaDe(t).slice(0, 7);
const redondear = (n) => Math.round(n * 100) / 100;

let recordado = null; // { t, dias, valor }

function leerGasto(carpeta) {
  const dir = path.join(carpeta, 'app', 'gasto');
  let nombres = [];
  try {
    nombres = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  return nombres.map((n) => leerJSON(path.join(dir, n))).filter(Boolean);
}

export function resumenDashboard({ dias = 14 } = {}) {
  if (recordado && recordado.dias === dias && Date.now() - recordado.t < 30000) return recordado.valor;
  const hoy = Date.now();
  const serie = new Map();
  for (let i = dias - 1; i >= 0; i--) serie.set(diaDe(hoy - i * 86400000), { anuncios: 0, imagenes: 0, dolares: 0 });
  const mesActual = mesDe(hoy);
  const d = new Date(hoy);
  const mesPasado = mesDe(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15));
  const mes = { anuncios: 0, imagenes: 0, dolares: 0 };
  const mesAnterior = { anuncios: 0, imagenes: 0, dolares: 0 };
  const recientes = [];
  const sumar = (cuando, campo, n) => {
    if (!cuando || !n) return;
    const dia = serie.get(diaDe(cuando));
    if (dia) dia[campo] += n;
    const m = mesDe(cuando);
    if (m === mesActual) mes[campo] += n;
    else if (m === mesPasado) mesAnterior[campo] += n;
  };

  let carpetas = []; // (todas las carpetas de temp/)
  try {
    carpetas = fs.readdirSync(TEMP, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
  } catch {
    carpetas = [];
  }
  // los anuncios, los mismos que muestra la lista (lib/anuncios.js); los lotes, los de esta app (como /api/imagen-ads)
  const deAnuncios = new Set(slugsDeAnuncios());
  for (const nombre of carpetas) {
    const esLote = nombre.startsWith('_img-');
    if (!esLote && !deAnuncios.has(nombre)) continue;
    const carpeta = path.join(TEMP, nombre);
    const conductor = leerJSON(path.join(carpeta, 'app', 'conductor.json'));
    const brief = leerJSON(path.join(carpeta, 'app', 'brief.json'));
    if (conductor?.modoPrueba || (esLote && !esDeEstaApp(brief))) continue;
    // lo que costó cada corrida, el día en que corrió
    for (const g of leerGasto(carpeta)) sumar(Date.parse(g.inicio || g.fin), 'dolares', Number(g.dolares) || 0);
    // lo que terminó
    if (conductor?.estado === 'listo' && conductor.terminado) {
      const t = Date.parse(conductor.terminado);
      if (esLote) {
        const informe = leerJSON(path.join(carpeta, 'app', 'informe.json'));
        if (!informe?.modoPrueba) {
          // (las imágenes que sí salieron; si no hay informe, las pedidas)
          const cantidad = Number(informe?.archivos ?? informe?.variaciones) || Number(brief?.cantidad) || 0;
          sumar(t, 'imagenes', cantidad);
          recientes.push({ tipo: 'lote', slug: nombre, titulo: brief?.titulo || brief?.datos?.nombre || 'Anuncios de imagen', fecha: conductor.terminado, cantidad });
        }
      } else {
        sumar(t, 'anuncios', 1);
        recientes.push({ tipo: 'anuncio', slug: nombre, titulo: leerJSON(path.join(carpeta, 'app', 'guion.json'))?.titulo || brief?.titulo || tituloDeSlug(nombre), fecha: conductor.terminado });
      }
    }
  }
  for (const x of [mes, mesAnterior]) x.dolares = redondear(x.dolares);
  const valor = {
    dias: [...serie].map(([fecha, v]) => ({ fecha, ...v, dolares: redondear(v.dolares) })),
    mes,
    mesAnterior,
    modelos: modelosDeKie().map((m) => ({ nombre: m.nombre, piezas: m.piezas ?? 0, estado: m.estado })).slice(0, 6),
    recientes: recientes.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 8),
  };
  recordado = { t: Date.now(), dias, valor };
  return valor;
}
