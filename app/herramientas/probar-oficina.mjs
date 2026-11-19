// Prueba de la oficina virtual (lib/oficina.js): qué agente hace cada paso y lo que arma para la pantalla.
//   node app/herramientas/probar-oficina.mjs
import { agenteDelPaso, oficina, AGENTES } from '../server/lib/oficina.js';

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 300)}`}`);
};
const casos = { imagenes: 'arte', persona: 'arte', 'revision-imagenes': 'calidad', 'revision-bloques': 'calidad', 'control-final': 'calidad', videos: 'video', bloques: 'video', 'voces-hosts': 'video', musica: 'video', voz: 'video', montaje: 'edicion', render: 'edicion', informe: 'edicion', 'recorte-host': 'edicion', validar: 'coordinacion', saldo: 'coordinacion', null: 'coordinacion' };
const mal = Object.entries(casos).filter(([p, a]) => agenteDelPaso(p === 'null' ? null : p) !== a);
check('Cada paso de producción va a su agente', !mal.length, mal.map(([p, a]) => `${p}: ${agenteDelPaso(p)} (esperaba ${a})`));
const d = await oficina();
check('La oficina trae los 7 agentes con su nombre, personaje, color, estado y listas', d.agentes.length === AGENTES.length && d.agentes.every((a) => a.nombre && a.avatar && /^#/.test(a.color) && ['libre', 'trabajando', 'te-necesita'].includes(a.estado) && Array.isArray(a.ahora) && Array.isArray(a.necesita) && Array.isArray(a.hechos)), d.agentes.map((a) => [a.id, a.estado]));
check('El estado sale de su trabajo: «te necesita» manda sobre «trabajando»', d.agentes.every((a) => (a.necesita.length ? a.estado === 'te-necesita' : a.ahora.length ? a.estado === 'trabajando' : a.estado === 'libre')));
check('El resumen cuenta lo mismo que los agentes', d.resumen.trabajando === d.agentes.filter((a) => a.estado === 'trabajando').length && typeof d.resumen.aprendizajes === 'number', d.resumen);
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${resultados.length} OK`);
process.exit(ok === resultados.length ? 0 : 1);
