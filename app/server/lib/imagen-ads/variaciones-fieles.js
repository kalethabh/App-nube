// Reutiliza la dirección visual ya validada: cambiar un título no necesita otra sesión de IA.
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON } from '../archivos.js';
import { R, guardarJSON } from './disco.js';
import { verificarV } from './verificar.js';
const normalizar = (t) => String(t || '').replace(/\s+/g, ' ').trim();
export function variarTitulo(base, anterior, siguiente, id) {
  const copia = structuredClone(base);
  const capas = copia.text_layers || [];
  const elegidas = capas.filter((t) => normalizar(t.text) === normalizar(anterior));
  if (elegidas.length !== 1 || !copia.ad_info || !siguiente) return null;
  elegidas[0].text = siguiente;
  copia.ad_info.variation_id = id;
  // El titular puede estar también citado en la descripción de la escena.
  if (typeof copia.visual_prompt === 'string' && copia.visual_prompt.includes(anterior)) copia.visual_prompt = copia.visual_prompt.split(anterior).join(siguiente);
  return copia;
}
export function completarVariacionesFieles(carpeta, brief, { normalizarIniciales = false } = {}) {
  if (!brief?.fiel || !brief?.seleccionTitulos?.titulos?.length) return [];
  const plan = leerJSON(R.plan(carpeta));
  const bases = new Map();
  const creadas = [];
  for (const x of plan?.variaciones || []) {
    if (x.fuente !== 'referencia' || !x.referencia) continue;
    const clave = path.basename(x.referencia);
    const actual = verificarV(carpeta, x.id, { brief, plan });
    if (actual.datos && !actual.errores.length) {
      if (!bases.has(clave)) bases.set(clave, { ad: actual.datos, titular: x.titular });
      else if (normalizarIniciales) {
        const base = bases.get(clave);
        const ad = variarTitulo(base.ad, base.titular, x.titular, x.id);
        if (ad) {
          guardarJSON(R.v(carpeta, x.id), ad);
          if (verificarV(carpeta, x.id, { brief, plan }).errores.length) guardarJSON(R.v(carpeta, x.id), actual.datos);
        }
      }
      continue;
    }
    // Nunca reemplaza archivos existentes ni pedidos de regeneración.
    if (fs.existsSync(R.v(carpeta, x.id))) continue;
    const base = bases.get(clave);
    if (!base) continue;
    const ad = variarTitulo(base.ad, base.titular, x.titular, x.id);
    if (!ad) continue;
    guardarJSON(R.v(carpeta, x.id), ad);
    if (verificarV(carpeta, x.id, { brief, plan }).errores.length) { fs.rmSync(R.v(carpeta, x.id)); continue; }
    creadas.push(x.id);
  }
  return creadas;
}
