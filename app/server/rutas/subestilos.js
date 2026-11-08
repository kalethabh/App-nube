// GET /subestilos/:clave/:id/vista.(jpg|mp4) -> la miniatura y el video de referencia de un subestilo (los 12
// fotogramas del anuncio real, en secuencia), para elegirlo en el formulario del estilo. Solo lectura, sin salir de
// .claude/skills/<skill>/subestilos/<id>/. (Va fuera de /archivos/ para que la pantalla no pida una miniatura achicada.)
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS } from '../lib/rutas.js';
import { ESTILOS } from '../lib/estilos.js';

const SKILL_DE = new Map(ESTILOS.map((e) => [e.clave, e.skill]));
const ID = /^[a-z0-9][a-z0-9-]{1,80}$/;
const ARCHIVO = /^vista\.(jpg|mp4)$/;

export default function rutasSubestilos(app) {
  app.get('/subestilos/:clave/:id/:archivo', (req, res) => {
    const { clave, id, archivo } = req.params;
    const skill = SKILL_DE.get(clave);
    if (!skill || !ID.test(id) || !ARCHIVO.test(archivo)) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    const abs = path.join(SKILLS, skill, 'subestilos', id, archivo);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'No encuentro ese archivo.' });
    res.sendFile(abs, { dotfiles: 'allow', maxAge: '1h', headers: { 'Content-Type': archivo.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' } });
  });
}
