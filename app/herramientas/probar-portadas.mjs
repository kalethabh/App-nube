// Prueba de «las portadas que faltan en Estilos» (lib/portadas-estilos.js) con un ChatGPT falso, sin gastar nada:
//   node app/herramientas/probar-portadas.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as p from '../server/lib/portadas-estilos.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 300)}`}`);
};
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portadas-'));
fs.mkdirSync(path.join(DIR, 'claymation'));
fs.writeFileSync(path.join(DIR, 'claymation', 'imagen.jpg'), 'x');
const pedidos = [];
let modo = 'bien';
p._paraPruebas({
  dir: DIR,
  generar: async ({ prompt, aspecto, rutaDestino }) => {
    pedidos.push({ prompt, aspecto });
    if (modo === 'sin-sesion') throw Object.assign(new Error('ChatGPT no tiene la sesión iniciada'), { sinSesion: true });
    fs.writeFileSync(rutaDestino, 'png falso');
    return { ruta: rutaDestino };
  },
});
check('faltan las 5 (Agregar y los 4 especiales)', p.faltantes().join() === 'agregar,cambiar,clonacion,ganchos,sketch', p.faltantes());
modo = 'sin-sesion';
let r = await p.generarFaltantes();
check('sin sesión de ChatGPT: para en la primera y lo anota', r.fallo === 'sin-sesion' && pedidos.length === 1 && p.estado().ultimoFallo?.motivo === 'sin-sesion', r);
r = await p.generarFaltantes();
check('y no vuelve a insistir hasta el otro día', r.fallo === 'sin-sesion' && pedidos.length === 1, r);
modo = 'bien';
r = await p.generarFaltantes({ forzar: true });
check('con ChatGPT: hace las 5, verticales y sin texto', r.hechas.length === 5 && pedidos.slice(1).every((x) => x.aspecto === '9:16' && /NO text/.test(x.prompt)) && !p.faltantes().length, { r, pedidos: pedidos.length });
check('quedan en <clave>/imagen.png', ['agregar', 'cambiar', 'clonacion', 'ganchos', 'sketch'].every((c) => fs.existsSync(path.join(DIR, c, 'imagen.png'))));
r = await p.generarFaltantes();
check('ya hechas, no se vuelven a hacer', r.hechas.length === 0 && pedidos.length === 6, r);
fs.rmSync(DIR, { recursive: true, force: true });
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);
