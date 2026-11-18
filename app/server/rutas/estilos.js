// GET /api/estilos -> los 13 estilos (de .claude/skills/*/SKILL.md) con su muestra.
// La muestra de cada estilo sale de lib/muestras.js: el anuncio de temp/ que dice server/muestras-estilos.json (Diego
// la elige a mano) o, en la PC del alumno, la copia que trae el paquete en app/muestras/<clave>/.
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS } from '../lib/rutas.js';
import { ESTILOS, FAMILIAS } from '../lib/estilos.js';
import { muestraDeEstilo } from '../lib/muestras.js';
import { subestilosDe } from '../lib/subestilos.js';
import { ESPECIALES, estado as estadoPortadas, generarFaltantes } from '../lib/portadas-estilos.js';
import { muestraDelPaquete } from '../lib/muestras.js';

// Solo el "name" del encabezado de la skill, para confirmar que esta instalada.
function nombreDeSkill(skill) {
  try {
    const texto = fs.readFileSync(path.join(SKILLS, skill, 'SKILL.md'), 'utf8').slice(0, 4000);
    const cabecera = texto.match(/^---\s*\n([\s\S]*?)\n---/);
    const nombre = cabecera && cabecera[1].match(/^name:\s*(.+)$/m);
    return nombre ? nombre[1].trim() : skill;
  } catch {
    return null;
  }
}

// las portadas que faltan (con ChatGPT Imágenes): GET el estado, POST las hace ya (no espera)
export default function rutasEstilos(app) {
  app.get('/api/estilos/portadas', (req, res) => res.set('Cache-Control', 'no-store').json(estadoPortadas()));
  app.post('/api/estilos/portadas', (req, res) => {
    generarFaltantes({ forzar: true }).catch(() => {});
    res.json(estadoPortadas());
  });
  app.get('/api/estilos', (req, res) => {
    const estilos = ESTILOS.map((e) => {
      const instalado = nombreDeSkill(e.skill) !== null;
      const muestra = muestraDeEstilo(e.clave);
      return {
        id: e.skill,
        clave: e.clave,
        nombre: e.nombre,
        lema: e.lema,
        descripcion: e.descripcion,
        familia: e.familia,
        familiaNombre: FAMILIAS[e.familia]?.nombre || null,
        instalado,
        muestra,
        subestilos: subestilosDe(e.skill),
      };
    });
    res.json({
      estilos,
      // la portada de los especiales (Cambiar el producto, Clonar, Más ganchos, Sketch), si ya se hizo
      especiales: Object.fromEntries(ESPECIALES.map((c) => [c, muestraDelPaquete(c)])),
      familias: Object.entries(FAMILIAS).map(([id, f]) => ({ id, ...f, cantidad: estilos.filter((e) => e.familia === id).length })),
    });
  });
}
