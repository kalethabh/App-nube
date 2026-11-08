// Aprendizajes: lo que salió de los anuncios anteriores, para que el siguiente salga mejor a la primera.
//
// Viven en mis_archivos/biblioteca/aprendizajes/ (se guardan en GitHub con el resto de la biblioteca, en el repositorio
// biblioteca-anuncios que comparte con IA-VID-AUTOMATIC: los aprendizajes de las dos apps son los mismos):
//   general.md        reglas para todos los estilos (las escribe el usuario, o Claude desde Claude Code)
//   <estilo>.md       reglas de un estilo (claymation.md, ugc.md…)
//   generaciones.md   la bitácora: cada toma o clip que hubo que rehacer y por qué, cada rechazo por contenido y
//                     cada cambio que pidió el usuario. La llena la app sola, barriendo lo que dejó cada revisión.
//
// La app no le da a Claude permiso de escribir fuera del anuncio: por eso la bitácora la escribe el servidor, leyendo
// los archivos de revisión de temp/<anuncio>/app/ (las listas con "motivo") y los cambios pedidos (sesion.json).
// Al escribir un guion, las reglas del estilo y lo último de su bitácora van dentro de la tarea.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './rutas.js';
import { pedirSincronizacion } from './biblioteca.js';

export const DIR_APRENDIZAJES = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'aprendizajes');
const BITACORA = path.join(DIR_APRENDIZAJES, 'generaciones.md');
const MARCAS = path.join(DIR_APRENDIZAJES, '.barrido.json');
const DIR_TEMP = path.join(RAIZ, 'temp');
const TOPE_TEXTO = 7000;

const leer = (f) => {
  try {
    return fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
  } catch {
    return '';
  }
};
const leerJSON = (f) => {
  try {
    return JSON.parse(leer(f));
  } catch {
    return null;
  }
};
const hoy = () => new Date().toISOString().slice(0, 10);
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 300);

function asegurar() {
  fs.mkdirSync(DIR_APRENDIZAJES, { recursive: true });
  if (!fs.existsSync(path.join(DIR_APRENDIZAJES, 'general.md'))) {
    fs.writeFileSync(
      path.join(DIR_APRENDIZAJES, 'general.md'),
      '# Aprendizajes generales\n\nReglas que valen para todos los estilos. Una por línea, sin el producto ni la marca.\nSe leen al escribir cada guion y van por encima del criterio de Claude.\n\n',
      'utf8'
    );
  }
  if (!fs.existsSync(BITACORA)) {
    fs.writeFileSync(BITACORA, '# Bitácora de generaciones\n\nLo que hubo que rehacer en cada anuncio y por qué (la escribe la app sola).\n\n', 'utf8');
  }
}

/** Los archivos de revisión de un anuncio: JSON de temp/<slug>/app/ con listas que traen "motivo". */
function archivosDeRevision(dirApp) {
  const out = [];
  const visitar = (dir, prof) => {
    let entradas = [];
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entradas) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory() && prof < 2 && !['registro', 'gasto', 'exportes', 'edicion', 'historial-guion'].includes(e.name)) visitar(ruta, prof + 1);
      else if (e.isFile() && /revision|rechazo|cadena|pares/i.test(e.name) && e.name.endsWith('.json')) out.push(ruta);
    }
  };
  visitar(dirApp, 0);
  return out;
}

/** Las entradas con motivo de un archivo de revisión, en cualquiera de sus formas. */
function motivosDe(valor) {
  const lista = Array.isArray(valor) ? valor : Array.isArray(valor?.rehacer) ? valor.rehacer : Array.isArray(valor?.clips) ? valor.clips : Array.isArray(valor?.tomas) ? valor.tomas : [];
  return lista
    .filter((x) => x && typeof x === 'object' && typeof x.motivo === 'string' && x.motivo.trim() && x.rehacer !== false)
    .map((x) => ({ donde: x.toma != null ? `toma ${x.toma}` : x.clip != null ? `clip ${x.clip}` : x.clave || 'una toma', motivo: limpio(x.motivo) }));
}

/**
 * Pasa a la bitácora lo nuevo de todos los anuncios: lo rehecho (con su motivo) y los cambios que pidió el usuario.
 * Cada archivo se barre una vez por versión (su fecha de cambio). Nunca lanza.
 */
export function barrer() {
  try {
    asegurar();
    const marcas = leerJSON(MARCAS) || {};
    const nuevas = [];
    let slugs = [];
    try {
      slugs = fs.readdirSync(DIR_TEMP, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return;
    }
    for (const slug of slugs) {
      const dirApp = path.join(DIR_TEMP, slug, 'app');
      if (!fs.existsSync(dirApp)) continue;
      const brief = leerJSON(path.join(dirApp, 'brief.json')) || {};
      const estilo = brief.estilo || leerJSON(path.join(DIR_TEMP, slug, 'manifiesto.json'))?.estilo || 'general';
      for (const f of archivosDeRevision(dirApp)) {
        const st = fs.statSync(f);
        const clave = path.relative(DIR_TEMP, f);
        if (marcas[clave] === st.mtimeMs) continue;
        marcas[clave] = st.mtimeMs;
        const tipo = /rechazo/i.test(f) ? 'rechazado por contenido' : /clip|cadena|pares/i.test(f) ? 'clip rehecho' : 'imagen rehecha';
        for (const m of motivosDe(leerJSON(f))) nuevas.push(`- ${hoy()} · ${estilo} · ${tipo} (${m.donde}): ${m.motivo}`);
      }
      const sesion = leerJSON(path.join(dirApp, 'sesion.json'));
      for (const [i, c] of (Array.isArray(sesion?.cambios) ? sesion.cambios : []).entries()) {
        const clave = `${slug}/cambio-${i}`;
        if (marcas[clave] || typeof c?.pedido !== 'string' || !c.pedido.trim()) continue;
        marcas[clave] = 1;
        nuevas.push(`- ${hoy()} · ${estilo} · el usuario pidió cambiar el guion: ${limpio(c.pedido)}`);
      }
    }
    if (nuevas.length) {
      fs.appendFileSync(BITACORA, `${nuevas.join('\n')}\n`, 'utf8');
      pedirSincronizacion();
    }
    fs.writeFileSync(MARCAS, JSON.stringify(marcas), 'utf8');
  } catch (e) {
    console.warn(`[aprendizajes] no pude barrer las revisiones (${e.message})`);
  }
}

/** Lo que va dentro de la tarea del guion: las reglas generales, las del estilo y lo último de su bitácora. */
export function textoParaClaude(estilo) {
  barrer();
  const partes = [];
  const general = leer(path.join(DIR_APRENDIZAJES, 'general.md')).replace(/^#.*\n+/, '').trim();
  const delEstilo = estilo ? leer(path.join(DIR_APRENDIZAJES, `${estilo}.md`)).replace(/^#.*\n+/, '').trim() : '';
  const bitacora = leer(BITACORA)
    .split('\n')
    .filter((l) => l.startsWith('- ') && (!estilo || l.includes(` · ${estilo} · `)))
    .slice(-15);
  const reglas = (t) => t.split('\n').filter((l) => l.trim() && !/^Reglas que valen|^Se leen al/i.test(l)).join('\n');
  if (reglas(general)) partes.push(`### Reglas generales\n${reglas(general)}`);
  if (reglas(delEstilo)) partes.push(`### Reglas de este estilo\n${reglas(delEstilo)}`);
  if (bitacora.length) partes.push(`### Lo que hubo que rehacer en los últimos anuncios de este estilo (evítalo desde el prompt)\n${bitacora.join('\n')}`);
  if (!partes.length) return '';
  let texto = `## Aprendizajes de los anuncios anteriores\n\nSalieron de anuncios ya hechos. Van por encima de tu criterio (no de las reglas del modo app ni de la skill). Son generales: nunca copies de ahí un producto, una marca ni una frase.\n\n${partes.join('\n\n')}`;
  if (texto.length > TOPE_TEXTO) texto = `${texto.slice(0, TOPE_TEXTO)}\n…`;
  return texto;
}

// ---------------------------------------------------------------- ahorro: B-roll quieto y biblioteca de clips

const DIR_CLIPS = path.join(RAIZ, 'mis_archivos', 'biblioteca', 'clips');

/** Los clips guardados de un estilo (los json de mis_archivos/biblioteca/clips/<estilo>/). */
export function clipsDeLaBiblioteca(estilo) {
  const dir = path.join(DIR_CLIPS, estilo || '');
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return archivos
    .map((f) => ({ ...(leerJSON(path.join(dir, f)) || {}), ruta: `mis_archivos/biblioteca/clips/${estilo}/${f.replace(/\.json$/, '.mp4')}` }))
    .filter((c) => fs.existsSync(path.join(RAIZ, c.ruta)));
}

/** Lo que la tarea del guion dice del ahorro (solo los estilos con clips que se pagan uno por uno). */
export function textoAhorro(estilo, { continuidad = false, hablado = false } = {}) {
  if (continuidad) return '';
  const clips = clipsDeLaBiblioteca(estilo).slice(0, 40);
  const lineas = [
    '## Ahorro: clips que no se pagan',
    '',
    hablado
      ? '- En las tomas habladas (R, H) no va nada de esto. Solo el **B-roll** puede ir `"quieto"`.'
      : '- **`"quieto"`**: un plano que no necesita acción (el producto sobre la mesa, los ingredientes, el bodegón final, un lugar vacío) se arma desde su imagen con un movimiento suave, sin pagar el clip. En la entrada del B-roll o de una toma **A**: `"quieto": true` (acercamiento) o `"alejar"`, `"paneo-izquierda"`, `"paneo-derecha"`. Nunca en tomas B, ni en el gancho, ni donde alguien hace algo. Como guía, entre un tercio y la mitad del B-roll puede ir quieto. Deja el `prompt_video` escrito igual. Cuéntalo en "decisiones" ("5 de los 9 B-roll van quietos").',
    '- **`"guardar_en_biblioteca"`**: en los clips que otro anuncio del mismo producto podría usar tal cual (el producto en mano, cada ingrediente, el mecanismo en 3D), `"guardar_en_biblioteca": { "tipo": "producto|ingrediente|mecanismo|escena|broll", "nombre": "…", "producto": "…" }`. No en el gancho ni en los que llevan al personaje de esta historia.',
  ];
  if (clips.length) {
    lineas.push(
      '- **`"desde_biblioteca"`**: estos clips de este estilo ya están pagados. Si uno sirve para una toma A o un B-roll de **este** anuncio (mismo producto, la misma idea), en esa entrada va `"desde_biblioteca": "<ruta>"` y no se genera ni su imagen ni su clip. La duración de la toma, igual o menor que la del clip. Si ninguno calza, no uses ninguno.',
      '',
      ...clips.map((c) => `  - \`${c.ruta}\` — ${limpio(c.nombre)}${c.producto ? ` (${limpio(c.producto)})` : ''}, ${c.tipo || 'clip'}, ${c.duracion ? `${Number(c.duracion).toFixed(1)} s` : 'duración sin medir'}${c.prompt_imagen ? `. Se ve: ${limpio(c.prompt_imagen).slice(0, 160)}` : ''}`)
    );
  }
  return lineas.join('\n');
}
