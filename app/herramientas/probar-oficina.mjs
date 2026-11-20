// Prueba de la oficina virtual (lib/oficina.js): qué agente hace cada paso y lo que arma para la pantalla.
//   node app/herramientas/probar-oficina.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { agenteDelPaso, oficina, AGENTES, LUGARES, _ultimoMedio } from '../server/lib/oficina.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 300)}`}`);
};
const casos = { imagenes: 'arte', persona: 'arte', 'revision-imagenes': 'calidad', 'revision-bloques': 'calidad', 'control-final': 'calidad', videos: 'video', bloques: 'video', 'voces-hosts': 'video', musica: 'video', voz: 'video', montaje: 'edicion', render: 'edicion', informe: 'edicion', 'recorte-host': 'edicion', validar: 'coordinacion', saldo: 'coordinacion', null: 'coordinacion' };
const mal = Object.entries(casos).filter(([p, a]) => agenteDelPaso(p === 'null' ? null : p) !== a);
check('Cada paso de producción va a su agente', !mal.length, mal.map(([p, a]) => `${p}: ${agenteDelPaso(p)} (esperaba ${a})`));
const d = await oficina();
check('La oficina trae todos sus agentes con su nombre, personaje, color, estado y listas', d.agentes.length === AGENTES.length && d.agentes.every((a) => a.nombre && a.avatar && /^#/.test(a.color) && ['libre', 'trabajando', 'te-necesita'].includes(a.estado) && Array.isArray(a.ahora) && Array.isArray(a.necesita) && Array.isArray(a.hechos)), d.agentes.map((a) => [a.id, a.estado]));
check('El estado sale de su trabajo: «te necesita» manda sobre «trabajando»', d.agentes.every((a) => (a.necesita.length ? a.estado === 'te-necesita' : a.ahora.length ? a.estado === 'trabajando' : a.estado === 'libre')));
check('El resumen cuenta lo mismo que los agentes', d.resumen.trabajando === d.agentes.filter((a) => a.estado === 'trabajando').length && typeof d.resumen.aprendizajes === 'number', d.resumen);
check('Cada agente trae si se ve como mujer u hombre (por defecto: Valentina, Lucía, Camila y Sofía mujer)', d.agentes.every((a) => ['mujer', 'hombre'].includes(a.genero)) && d.agentes.find((a) => a.id === 'guion').genero === 'hombre' || Boolean(d.configurada), d.agentes.map((a) => [a.id, a.genero]));
const lugares = d.zonas.map((z) => z.lugar);
check('Las salas traen su lugar (sin repetir), las 3 de «Próximamente» y los tipos para crear', d.zonas.length >= 8 && new Set(lugares).size === lugares.length && lugares.every((n) => n >= 0 && n < LUGARES) && d.zonas.filter((z) => z.pronto).length === 3 && d.tipos?.creativos && Array.isArray(d.ias), d.zonas);
check('Cada agente está en un departamento de la planta, con su estación y su aviso de IA caída (o null)', d.agentes.every((a) => d.zonas.some((z) => z.id === a.dep) && (a.dep === 'coordinacion' || a.estacion) && 'caida' in a && a.enEstacion), d.agentes.filter((a) => !d.zonas.some((z) => z.id === a.dep)).map((a) => a.id));
check('Las cadenas de producción: seis departamentos y cada estación con su agente', d.produccion.departamentos.length === 6 && d.produccion.departamentos.every((dep) => dep.estaciones.every((e) => d.agentes.some((a) => a.id === e.agente))));
check('Los departamentos en construcción tienen a sus agentes quietos («pronto»)', d.agentes.filter((a) => ['landing', 'whatsapp', 'analisis'].includes(a.dep)).every((a) => a.enEstacion === 'pronto'));
// la pantalla grande: el último clip o imagen (el más nuevo, sin los vacíos)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oficina-'));
fs.mkdirSync(path.join(dir, 'img'));
fs.mkdirSync(path.join(dir, 'video'));
fs.writeFileSync(path.join(dir, 'img', 'toma-1.png'), Buffer.alloc(5000));
fs.writeFileSync(path.join(dir, 'video', 'vacio.mp4'), Buffer.alloc(10));
const ahora = Date.now() / 1000;
fs.utimesSync(path.join(dir, 'img', 'toma-1.png'), ahora - 60, ahora - 60);
let v = _ultimoMedio(dir, ['video', 'img'], '/archivos/anuncio/x');
check('La pantalla muestra la última imagen (un archivo vacío no cuenta)', v?.tipo === 'imagen' && /\/img\/toma-1\.png\?v=/.test(v.url), v);
fs.writeFileSync(path.join(dir, 'video', 'clip-2.mp4'), Buffer.alloc(5000));
v = _ultimoMedio(dir, ['video', 'img'], '/archivos/anuncio/x');
check('…y el clip cuando hay uno más nuevo', v?.tipo === 'video' && /clip-2\.mp4/.test(v.url), v);
fs.rmSync(dir, { recursive: true, force: true });
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);
