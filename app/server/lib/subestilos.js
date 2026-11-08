// Los subestilos de cada estilo: formas probadas del mismo estilo, sacadas de anuncios reales que venden.
// Viven en .claude/skills/<skill>/subestilos/<id>.md (la ficha) y subestilos/<id>/ (sus fotogramas). La app solo los
// lista para que el usuario elija uno en el formulario del estilo; la skill dice cómo se usan ("Subestilo: <id>").
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS } from './rutas.js';

const cache = new Map(); // skill -> { marca, valor }

/** [{ id, nombre }] de una skill, leídos de los títulos de sus fichas ("# Subestilo Pixar — Glow-up con…"). */
export function subestilosDe(skill) {
  const dir = path.join(SKILLS, skill || '', 'subestilos');
  let archivos;
  try {
    archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
  const marca = archivos.join('|');
  const previo = cache.get(skill);
  if (previo?.marca === marca) return previo.valor;
  const valor = [];
  for (const f of archivos) {
    const id = f.replace(/\.md$/, '');
    let nombre = id.replace(/-/g, ' ');
    try {
      const titulo = fs.readFileSync(path.join(dir, f), 'utf8').match(/^#\s+(.+)$/m)?.[1] || '';
      const corto = titulo.split(/\s+[—-]\s+/).slice(1).join(' — ').trim();
      if (corto) nombre = corto.replace(/["«»“”]/g, '').trim();
    } catch {
      /* sin título: queda el id */
    }
    valor.push({ id, nombre });
  }
  cache.set(skill, { marca, valor });
  return valor;
}

/** El id del subestilo que eligió el usuario (por su nombre o por su id), o undefined. */
export function idDeSubestilo(skill, texto) {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return undefined;
  const lista = subestilosDe(skill);
  const igual = lista.find((s) => s.id === t || s.nombre.toLowerCase() === t);
  if (igual) return igual.id;
  const parecido = lista.find((s) => t.includes(s.id) || t.startsWith(s.nombre.toLowerCase().slice(0, 18)));
  return parecido?.id;
}
