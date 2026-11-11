// Material local para las herramientas propias de Kads cuando trabaja ChatGPT.
// Solo enumera textos e imágenes existentes dentro de la app; no lee claves ni sigue enlaces simbólicos.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../rutas.js';

export function materialKads({ textos = [], imagenes = [], carpetas = [] } = {}) {
  const encontrados = [];
  const dentro = (abs) => {
    const rel = path.relative(RAIZ, abs);
    return rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
  };
  const visitar = (rel, recursivo = false) => {
    const abs = path.resolve(RAIZ, rel);
    if (!dentro(abs) || rel.split(/[\\/]/).some((p) => /^\.env(?:\.|$)/i.test(p))) return;
    let st;
    try { st = fs.lstatSync(abs); } catch { return; }
    if (st.isSymbolicLink()) return;
    if (recursivo && st.isDirectory()) {
      for (const n of fs.readdirSync(abs).sort()) visitar(path.join(rel, n), true);
    } else if (st.isFile() && /\.(md|json|txt|png|jpe?g|webp|gif)$/i.test(abs)) {
      encontrados.push(path.relative(RAIZ, abs).split(path.sep).join('/'));
    }
  };
  for (const rel of [...textos, ...imagenes]) visitar(rel);
  for (const rel of carpetas) visitar(rel, true);
  const unicos = [...new Set(encontrados)];
  return {
    textos: unicos.filter((f) => /\.(md|json|txt)$/i.test(f)),
    imagenes: unicos.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)),
  };
}
