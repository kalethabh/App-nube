// Prueba de los «Conceptos para Meta (Andromeda)» de la investigación de mercado (2026-11-18), sin la IA:
//   node app/herramientas/probar-investigacion-andromeda.mjs
// Arma un producto de prueba con una investigación mínima (formato documento) y revisa: que la sección se reconozca y
// se exija completa (facetas, momentos y matriz de 6+ conceptos), que pase a los lotes de anuncios (aMarkdown), que
// «Agregar conceptos» no corra sobre una investigación vieja ni sobre una que ya los tiene, y la tarea de la IA.
import fs from 'node:fs';
import path from 'node:path';

const { PRODUCTOS } = await import('../server/lib/productos.js');
const inv = await import('../server/lib/investigacion.js');
const { textoClaude } = await import('../server/lib/claude.js');

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push({ nombre, ok: Boolean(ok) });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 600)}`}`);
};

const ID = `prueba-andromeda-${process.pid}`;
const carpeta = path.join(PRODUCTOS, ID);
const escribir = (rel, d) => {
  fs.mkdirSync(path.dirname(path.join(carpeta, rel)), { recursive: true });
  fs.writeFileSync(path.join(carpeta, rel), typeof d === 'string' ? d : JSON.stringify(d, null, 2));
};
const sec = (titulo, extra = []) => ({ titulo, bloques: [{ tipo: 'parrafo', texto: `Texto de ${titulo}.` }, ...extra] });
const base = () => ({
  formato: 'documento',
  producto: 'Gotas de prueba',
  pais: 'Colombia',
  fecha: '18 de noviembre de 2026',
  color: '#1F4E3D',
  portada: { titulo: 'Gotas de prueba', subtitulo: 'gotas · 60 ml', avatar: 'Diana Marcela, la que se siente inflada', quien_compra: '', canal: 'Meta Ads + WhatsApp' },
  claves: { deseo_central: 'Sentirme liviana', beneficio_principal: 'Menos pesadez', puntos_dolor: ['Me siento inflada', 'No me cierra el jean', 'Ya probé de todo'] },
  secciones: [
    ...Array.from({ length: 13 }, (_, i) => sec(`Sección ${i + 1}`)),
    sec('Deseo central, propuestas de valor y copy para la landing', [{ tipo: 'guia-visual' }]),
  ],
  guia: { mensajes: Array.from({ length: 4 }, (_, i) => ({ seccion: `Mensaje ${i + 1}`, titulo: 'Título', objetivo: 'Objetivo', franja: { beneficio: 'a', tiempo: 'b', deseo: 'c' }, elementos: Array.from({ length: 4 }, () => ({ titulo: 't', texto: 'x' })), maqueta: {} })) },
  fuentes: Array.from({ length: 3 }, (_, i) => ({ titulo: `Fuente ${i}`, url: `https://ejemplo.com/${i}` })),
});
const andromeda = (filasMatriz = 8) => ({
  titulo: inv.TITULO_ANDROMEDA,
  bloques: [
    { tipo: 'subtitulo', texto: '15.1 Lo que cambió' },
    { tipo: 'caja', estilo: 'nota', titulo: 'El creativo es la segmentación', items: ['Diversidad real'] },
    { tipo: 'subtitulo', texto: '15.2 Facetas del cliente' },
    { tipo: 'tabla', columnas: ['Persona base', 'Faceta', 'Dolor en sus palabras', 'Escenario visual'], filas: [['Diana, 38', 'Mamá', 'No tengo tiempo ni para mí', 'Ruta del colegio, 6 a.m.']] },
    { tipo: 'subtitulo', texto: '15.3 Momentos y contexto' },
    { tipo: 'tabla', columnas: ['Momento', 'Cómo está la persona', 'Mensaje que conecta', 'Formato'], filas: [['Después del almuerzo', 'Pesada', 'Después del corrientazo', 'Demostración']] },
    { tipo: 'subtitulo', texto: '15.4 Matriz de conceptos' },
    { tipo: 'tabla', columnas: ['#', 'Faceta', 'Problema', 'Contexto', 'Formato', 'Hook'], filas: Array.from({ length: filasMatriz }, (_, i) => [String(i + 1), 'Mamá', 'Síntoma visible', 'Mañana', 'UGC selfie', `Hook ${i + 1}: si eres mamá y te levantas a las 5`]) },
  ],
});

try {
  escribir('producto.json', { id: ID, nombre: 'Gotas de prueba', fotos: ['foto-1.png'], creado: new Date().toISOString(), app: 'App-nube' });
  escribir('foto-1.png', 'x');
  // 1. una investigación sin la sección: se ve, pero no la tiene (y una nueva sin ella no pasaría la revisión)
  escribir('investigacion/investigacion.json', base());
  const e1 = inv.estado(ID);
  check('Una investigación hecha antes se sigue viendo igual (sin la sección de Andromeda)', e1?.investigacion?.formato === 'documento' && !inv.tieneAndromeda(e1.investigacion), e1?.investigacion?.secciones?.length);
  check('Sin la sección, la revisión de una investigación nueva la pide', inv.erroresAndromeda(e1.investigacion).some((x) => /Falta la sección/.test(x)), inv.erroresAndromeda(e1.investigacion));

  // 2. incompleta (matriz de 3) y completa
  const conPoca = base();
  conPoca.secciones.push(andromeda(3));
  check('Una matriz con menos de 6 conceptos no pasa', inv.erroresAndromeda(conPoca).some((x) => /8 filas/.test(x)), inv.erroresAndromeda(conPoca));
  const completa = base();
  completa.secciones.push(andromeda(8));
  escribir('investigacion/investigacion.json', completa);
  const e2 = inv.estado(ID);
  check('Con facetas, momentos y 8 conceptos la sección está completa y la investigación se lee', e2?.investigacion && inv.tieneAndromeda(e2.investigacion) && inv.erroresAndromeda(e2.investigacion).length === 0, inv.erroresAndromeda(e2?.investigacion));
  const md = inv.aMarkdown(ID) || '';
  check('La sección llega a los lotes de anuncios (facetas y hooks de la matriz en el texto de la estrategia)', /## 15\. Conceptos para Meta \(Andromeda\)/.test(md) && /Faceta: Mamá/.test(md) && /Hook: Hook 8/.test(md), md.slice(-800));

  // 3. «Agregar conceptos» no corre si ya los tiene, ni sobre el formato viejo
  let msg = '';
  try {
    inv.investigar(ID, { soloAndromeda: true });
  } catch (e) {
    msg = e.message;
  }
  check('«Agregar conceptos» no corre sobre una investigación que ya los tiene', /ya tiene los conceptos/.test(msg), msg);
  escribir('investigacion/investigacion.json', { producto: 'Viejo', pais: 'Colombia' });
  msg = '';
  try {
    inv.investigar(ID, { soloAndromeda: true });
  } catch (e) {
    msg = e.message;
  }
  check('Ni sobre una investigación del formato anterior (pide volver a investigar)', /formato anterior/.test(msg), msg);

  // 4. las tareas de la IA
  const tarea = textoClaude('tarea-investigacion-andromeda', { carpeta: `temp/_productos/${ID}`, pais: 'Colombia', fecha: '18 de noviembre de 2026', archivo: `temp/_productos/${ID}/investigacion/investigacion.json` });
  check('La tarea corta dice qué agregar, dónde y que no toque lo demás', /TAREA: investigacion-andromeda/.test(tarea) && /15\.4 Matriz de conceptos/.test(tarea) && /No cambies nada más/.test(tarea) && !/\{\{/.test(tarea), tarea.slice(0, 300));
  const larga = textoClaude('tarea-investigacion-mercado', { carpeta: 'x', fotos: '', datos: '{}', pais: 'Colombia', fecha: 'hoy', archivo: 'x.json' });
  const skill = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', '.claude', 'skills', 'investigacion-mercado', 'SKILL.md'), 'utf8');
  check('La investigación nueva incluye la sección 15 y la skill la explica (sección 3b)', /Conceptos para Meta \(Andromeda\)/.test(larga) && /15\.2 Facetas del cliente/.test(larga) && /## 3b\. Conceptos para Meta \(Andromeda\)/.test(skill) && /el creativo es la nueva segmentación/i.test(skill));
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

const fallas = resultados.filter((x) => !x.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK`);
process.exit(fallas.length ? 1 : 0);
