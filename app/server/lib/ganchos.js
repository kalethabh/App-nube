// Más ganchos (la skill anuncios-replicador-ganchos, dentro de la app). A un anuncio de voz en off ya terminado le
// saca de 2 a 5 versiones que solo cambian el gancho (la toma 1). Cada versión es un anuncio nuevo,
// temp/<slug>-gancho-<n>/, copia del original: el motor no vuelve a pagar lo que ya existe, así que solo se generan la
// imagen y el clip del gancho y la voz (centavos). Después se produce sola, como cualquier anuncio.
//
//   pedirGanchos(slug, { cuantos })   lanza a Claude (escribe app/ganchos.json en el original) y arma las versiones
//   estadoGanchos(slug)               { estado: 'escribiendo'|'listo'|'error', versiones: [slug…], error? }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { RAIZ, TEMP } from './rutas.js';
import { leerJSON, escribirJSONSeguro } from './archivos.js';
import { lanzarSesion } from './colas.js';
import { prohibidasComunes } from './claude.js';
import { ESTILOS } from './anuncios-nuevos.js';
import * as conductor from './conductor.js';

const SCRIPT = path.join(RAIZ, '.claude', 'skills', 'anuncios-replicador-ganchos', 'scripts', 'crear-variante.mjs');
const ESTILOS_OK = ['claymation', 'crochet', 'zack-d-films', 'estilo-pixar', 'realista-narrado', 'skeleton', 'estilo-lego'];
const enMarcha = new Map();
const ahora = () => new Date().toISOString();
const dirApp = (slug) => path.join(TEMP, slug, 'app');
const rutaEstado = (slug) => path.join(dirApp(slug), 'ganchos-estado.json');
const rutaGanchos = (slug) => path.join(dirApp(slug), 'ganchos.json');

class ErrorGanchos extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

export function estadoGanchos(slug) {
  return leerJSON(rutaEstado(slug)) || { estado: 'sin' };
}
const guardarEstado = (slug, e) => escribirJSONSeguro(rutaEstado(slug), { ...estadoGanchos(slug), ...e, actualizado: ahora() });

/** ¿Se le pueden sacar ganchos? null si sí; si no, el motivo en palabras simples. */
export function porQueNo(slug) {
  const brief = leerJSON(path.join(dirApp(slug), 'brief.json'));
  const m = leerJSON(path.join(TEMP, slug, 'manifiesto.json'));
  if (!brief || !m) return 'No encuentro ese anuncio.';
  if (brief.continuidad || m.continuidad) return 'Con continuidad el gancho no se puede cambiar solo: cada escena pasa a la siguiente.';
  if (!ESTILOS_OK.includes(brief.estilo) || m.modo_audio !== 'voz_en_off') return 'Por ahora, más ganchos solo se sacan de los estilos con narrador (en UGC, pídelos en el formulario: "2 ganchos más").';
  if (conductor.leerConductor(slug)?.estado !== 'listo') return 'Primero tiene que terminar de producirse el anuncio.';
  if (/-gancho-\d+$/.test(slug)) return 'Esta ya es una versión con otro gancho: saca más desde el anuncio original.';
  return null;
}

function tarea(slug, cuantos, desde) {
  const brief = leerJSON(path.join(dirApp(slug), 'brief.json'));
  const skill = ESTILOS[brief.estilo]?.skill;
  return [
    'TAREA: más ganchos',
    `Carpeta del anuncio: temp/${slug}`,
    `Lee y sigue \`.claude/skills/anuncios-replicador-ganchos/SKILL.md\` (Paso 2 y Paso 3B) y, para los prompts, \`.claude/skills/${skill}/SKILL.md\`.`,
    '',
    `Escribe ${cuantos} ganchos nuevos para este anuncio, cada uno con una mecánica distinta (la lista del Paso 2), que reemplazan SOLO la toma 1 y empalman con lo que sigue. Lee temp/${slug}/manifiesto.json (la toma 1 y la frase que viene después) y mira la imagen de la toma 1 en img/.`,
    '- Mismo largo que el gancho original (±1 s). Sin promesas que el producto no cumple.',
    '- Los prompts de la toma, con las reglas de la skill del estilo (su bloque de estilo palabra por palabra y su plantilla), como los de la toma 1 actual. Si es tipo B, también prompt_imagen_final.',
    `- \`voz_en_off\`: el texto completo de la voz con la frase del gancho viejo cambiada por la nueva; el resto, idéntico al del manifiesto.`,
    '',
    `Escribe temp/${slug}/app/ganchos.json (JSON válido), una lista:`,
    `[{"id": "${desde}", "mecanica": "pregunta que nombra el dolor", "linea": "…", "duracion": 3.2, "prompt_imagen_inicial": "…", "prompt_imagen_final": "… (solo si la toma 1 es B)", "prompt_video": "…", "voz_en_off": "…"}]`,
    `Los id van de ${desde} a ${desde + cuantos - 1}. No corras comandos ni toques nada más. Tu respuesta final: solo LISTO.`,
  ].join('\n');
}

function validar(slug, lista, cuantos) {
  const m = leerJSON(path.join(TEMP, slug, 'manifiesto.json'));
  const t1 = (m?.tomas || []).find((t) => t.n === 1);
  const errores = [];
  if (!Array.isArray(lista) || !lista.length) return ['ganchos.json tiene que ser una lista con los ganchos.'];
  if (lista.length > cuantos) errores.push(`Son ${cuantos} ganchos, no ${lista.length}.`);
  for (const [i, g] of lista.entries()) {
    for (const k of ['id', 'linea', 'prompt_imagen_inicial', 'prompt_video', 'voz_en_off']) {
      if (typeof g?.[k] !== 'string' || !g[k].trim()) errores.push(`gancho ${i + 1}: falta "${k}".`);
    }
    if (!/^[0-9]{1,2}$/.test(String(g?.id || ''))) errores.push(`gancho ${i + 1}: "id" es un número ("2", "3"…).`);
    if (t1?.tipo === 'B' && !g?.prompt_imagen_final) errores.push(`gancho ${i + 1}: la toma 1 es tipo B y lleva "prompt_imagen_final".`);
    if (!(Number(g?.duracion) > 0)) errores.push(`gancho ${i + 1}: falta "duracion" (en segundos).`);
  }
  return errores;
}

/** Arma la versión <slug>-gancho-<id> con el gancho nuevo y la pone a producir. Devuelve su slug. */
export function armarVersion(slug, g) {
  const r = spawnSync(process.execPath, [SCRIPT, path.join('temp', slug), String(g.id), '--reemplazar'], { cwd: RAIZ, encoding: 'utf8', windowsHide: true });
  const nuevo = `${slug}-gancho-${g.id}`;
  const dir = path.join(TEMP, nuevo);
  if (r.status !== 0 || !fs.existsSync(path.join(dir, 'manifiesto.json'))) throw new Error(`No pude preparar la versión ${g.id}: ${(r.stderr || r.stdout || '').slice(-300)}`);
  // el manifiesto con el gancho nuevo
  const m = leerJSON(path.join(dir, 'manifiesto.json'));
  const t1 = m.tomas.find((t) => t.n === 1);
  Object.assign(t1, {
    linea: g.linea.trim(),
    duracion: Math.round(Number(g.duracion) * 10) / 10,
    prompt_imagen_inicial: g.prompt_imagen_inicial,
    prompt_video: g.prompt_video,
    ...(t1.tipo === 'B' && g.prompt_imagen_final ? { prompt_imagen_final: g.prompt_imagen_final } : {}),
  });
  m.voz_en_off = g.voz_en_off;
  escribirJSONSeguro(path.join(dir, 'manifiesto.json'), m);
  // lo de la app: la ficha y el guion del original (con el gancho nuevo); la produccion, el gasto y las versiones, de cero
  const app = path.join(dir, 'app');
  for (const f of fs.readdirSync(app)) {
    if (!['brief.json', 'sesion.json', 'guion.json'].includes(f)) fs.rmSync(path.join(app, f), { recursive: true, force: true });
  }
  const brief = leerJSON(path.join(app, 'brief.json'));
  escribirJSONSeguro(path.join(app, 'brief.json'), { ...brief, slug: nuevo, gancho: { de: slug, id: g.id, mecanica: g.mecanica || null }, creado: ahora() });
  const guion = leerJSON(path.join(app, 'guion.json'));
  if (guion) {
    const partes = Array.isArray(guion.partes) ? guion.partes.map((p) => (p.n === 1 ? { ...p, dice: g.linea.trim() } : p)) : guion.partes;
    escribirJSONSeguro(path.join(app, 'guion.json'), { ...guion, titulo: `${guion.titulo || slug} · gancho ${g.id}`, partes });
  }
  const sesion = leerJSON(path.join(app, 'sesion.json')) || {};
  escribirJSONSeguro(path.join(app, 'sesion.json'), { ...sesion, uuid: crypto.randomUUID(), estado: 'aprobado', cambios: [] });
  // sin la salida del original: la version tiene la suya
  for (const f of ['output', 'qa']) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  conductor.iniciarProduccion(nuevo);
  return nuevo;
}

export function pedirGanchos(slug, { cuantos = 3 } = {}) {
  const motivo = porQueNo(slug);
  if (motivo) throw new ErrorGanchos(409, motivo);
  if (enMarcha.has(slug)) return estadoGanchos(slug);
  const n = Math.max(2, Math.min(5, Number(cuantos) || 3));
  const previos = estadoGanchos(slug).versiones || [];
  const desde = 2 + previos.length;
  guardarEstado(slug, { estado: 'escribiendo', cuantos: n, inicio: ahora(), error: null });
  const trabajo = (async () => {
    fs.rmSync(rutaGanchos(slug), { force: true });
    const brief = leerJSON(path.join(dirApp(slug), 'brief.json'));
    const c = `./temp/${slug}`;
    const r = await lanzarSesion({
      tipo: 'ganchos',
      cwd: RAIZ,
      uuid: crypto.randomUUID(),
      prompt: tarea(slug, n, desde),
      herramientas: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
      permitidas: [`Read(${c}/**)`, 'Read(./.claude/skills/anuncios-replicador-ganchos/**)', `Read(./.claude/skills/${ESTILOS[brief.estilo].skill}/**)`, 'Glob', 'Grep', `Write(${c}/app/ganchos.json)`, `Edit(${c}/app/ganchos.json)`],
      prohibidas: prohibidasComunes({ terminal: false }),
      timeoutMs: 30 * 60000,
      registro: path.join(dirApp(slug), 'registro', 'ganchos.jsonl'),
      verificar: () => {
        const e = validar(slug, leerJSON(rutaGanchos(slug)), n);
        return e.length ? { ok: false, errores: e } : { ok: true };
      },
    });
    if (!r?.ok) throw new Error(r?.limite ? 'Se acabó el uso de tu plan de Claude por ahora. Vuelve a intentarlo más tarde.' : 'Claude no pudo escribir los ganchos. Vuelve a intentarlo.');
    const versiones = [...previos];
    for (const g of leerJSON(rutaGanchos(slug)).slice(0, n)) versiones.push(armarVersion(slug, g));
    guardarEstado(slug, { estado: 'listo', versiones, fin: ahora() });
  })()
    .catch((e) => guardarEstado(slug, { estado: 'error', error: String(e.message || e).slice(0, 400), fin: ahora() }))
    .finally(() => enMarcha.delete(slug));
  enMarcha.set(slug, trabajo);
  return estadoGanchos(slug);
}

export { ErrorGanchos };
