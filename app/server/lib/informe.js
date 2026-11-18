// El informe de la entrega (temp/<slug>/app/informe.json), en palabras simples y SIN Claude.
//
// Dos apartados separados, como pide ESTADO-ACTUAL 5.10 ("Mezclarlos hace que un anuncio bueno parezca roto"):
//
//   decisiones   lo que el montaje (y la app) resolvio solo: duracion real dicha como dato (y la que pidio el usuario,
//                solo como dato: con la que decide la IA no se compara con nada), tomas aceleradas,
//                B-roll que no entraron, la musica, las transiciones, las tomas que se pidieron mas largas
//                para cubrir su frase. Los avisos del motor ("va a 2.4x", "B-roll N no entra") van aca: son
//                el montaje funcionando, no defectos. Un B-roll que no entra con la voz final no se genera (el
//                motor no lo pide): no es una pieza que falte.
//   problemas    solo defectos medidos o vistos: clips que salieron del modelo de respaldo, voces coladas que
//                se silenciaron, «Lo que notó la revisión» (los avisos de cada pieza, lib/avisos.js: desde
//                2026-11-09 la app genera todo al primer intento y la revision NO rehace nada, solo avisa), negros
//                o congelados del control final (y si el re-render los arreglo), clips mas cortos que su momento, y
//                lo que no se pudo revisar. tipo "arreglado" = se resolvio solo (solo lo tecnico); "revisar" =
//                conviene mirarlo. (Las imagenes que la revision mandaba rehacer son de anuncios de antes.)
//
// Mas el costo real (gasto.js): lo unico con precio en toda la app.
//
// Las piezas van con la misma forma que GET /api/entrega/:slug (tablero.js): { id, icono, titulo, detalle } en
// decisiones y { id, tipo, titulo, detalle, piezas: [{ n, unidad, momento, valor }] } en problemas, para que la
// pantalla de la entrega los muestre con los mismos componentes.
import fs from 'node:fs';
import path from 'node:path';
import { leerJSON, listar, escribirJSONSeguro } from './archivos.js';
import { corridas, resumenDeGasto } from './gasto.js';
import { tituloDeSlug } from './anuncios.js';
import { notaPedida, segundosPedidos } from './duracion.js';
import { listaDeAvisos } from './avisos.js';

const numeroES = (n, d = 1) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const tiempo = (s) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const masRapido = (v) => `${numeroES(v, 1)} veces más rápid`;

const VERSIONES = {
  'con-subtitulos': 'Completa',
  'solo-subtitulos': 'Solo subtítulos',
  'sin-subtitulos': 'Sin subtítulos',
  'sin-subtitulos-sin-musica': 'Sin subtítulos ni música',
};

/** toma n -> segundo donde empieza en el video, y lo mismo con cada B-roll. */
function momentos(plan) {
  const tomas = new Map();
  const broll = new Map();
  for (const b of plan?.bloques || []) {
    const n = Number((String(b.toma?.archivo || '').match(/toma-(\d+)/) || [])[1]) || Number(b.linea) || null;
    if (n && !tomas.has(n)) tomas.set(n, Number(b.inicio) || 0);
    if (b.broll?.n) broll.set(Number(b.broll.n), Number(b.broll.desde) || Number(b.inicio) || 0);
  }
  return { tomas, broll };
}

/** Cuantos de esos B-roll tienen algo en la carpeta (su clip o su imagen): los demas no se generaron. */
function brollEnLaCarpeta(carpeta, lista) {
  const img = new Set(listar(path.join(carpeta, 'img')));
  const vid = new Set(listar(path.join(carpeta, 'video')));
  return lista.filter((n) => vid.has(`broll-${n}.mp4`) || ['png', 'jpg', 'jpeg', 'webp'].some((e) => img.has(`broll-${n}.${e}`))).length;
}

/** El segundo del video donde esta la pieza de un aviso ('vid:toma-5', 'img:broll-2', 'vid:paso-3'), o null. */
function momentoDeClave(clave, m) {
  const r = String(clave || '').match(/^(?:img|vid):(toma|broll|paso)-(\d+)/);
  if (!r) return null;
  return (r[1] === 'broll' ? m.broll : m.tomas).get(Number(r[2])) ?? null;
}

/** "toma-7.mp4", "broll-3", "img/toma-2-inicial.png" -> { n, unidad, momento }. "img/mujer.png" -> "Hoja de referencia: Mujer" */
function pieza(nombre, m) {
  const r = String(nombre || '').match(/(toma|broll|paso)-(\d+)/i);
  if (!r) {
    // una hoja de referencia (personaje, objeto, lugar): con su nombre, como en la producción, nunca el archivo
    const id = String(nombre || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
    return { n: null, unidad: id ? `Hoja de referencia: ${tituloDeSlug(id)}` : 'Pieza', momento: null };
  }
  const unidad = r[1].toLowerCase() === 'broll' ? 'B-roll' : r[1].toLowerCase();
  const n = Number(r[2]);
  return { n, unidad, momento: (unidad === 'B-roll' ? m.broll : m.tomas).get(n) ?? null };
}

// ---------------------------------------------------------------- decisiones

function decisionesDe({ carpeta, plan, manifiesto, brief, ventanas, conductor }) {
  const d = [];
  const dur = Number(plan?.duracion) || 0;
  if (dur) {
    d.push({
      id: 'manda',
      icono: 'voz',
      titulo: 'Manda la voz',
      detalle:
        `El video se adaptó a los ${tiempo(dur)} de la voz en off: ninguna frase se recortó para cuadrar.${notaPedida(brief)}`,
    });
  }
  if (brief?.voz?.nombre) d.push({ id: 'voz', icono: 'voz', titulo: `La voz: ${brief.voz.nombre}`, detalle: brief.voz.auto ? `La eligió la app porque no elegiste una: ${brief.voz.motivo || 'la más indicada de tu cuenta'}.` : 'Es la que elegiste para este estilo.' });

  const cambios = Array.isArray(ventanas?.cambios) ? ventanas.cambios : [];
  if (cambios.length) {
    d.push({
      id: 'ventanas',
      icono: 'ritmo',
      titulo: cambios.length === 1 ? 'Una escena se pidió un poco más larga' : `${cambios.length} escenas se pidieron un poco más largas`,
      detalle: 'La voz real dura más de lo calculado en esas frases: se pidió cada clip con el largo justo para que no falte imagen. Nunca se acortó ninguna.',
    });
  }

  const bloques = Array.isArray(plan?.bloques) ? plan.bloques : [];
  const conToma = bloques.filter((b) => b.toma);
  const aceleradas = conToma.filter((b) => Number(b.toma.velocidad) > 1.02);
  if (conToma.length) {
    if (aceleradas.length) {
      const max = Math.max(...aceleradas.map((b) => Number(b.toma.velocidad)));
      d.push({
        id: 'ritmo',
        icono: 'ritmo',
        titulo: aceleradas.length === conToma.length ? 'Todas las escenas, un poco más rápidas' : `${aceleradas.length} de ${conToma.length} escenas, un poco más rápidas`,
        detalle: `Los clips eran más largos que sus frases: en vez de cortarlos se aceleraron para seguir a la voz (la que más, ${masRapido(max)}a).`,
      });
    } else d.push({ id: 'ritmo', icono: 'ritmo', titulo: 'Todas las escenas a su velocidad', detalle: conToma.length === 1 ? 'La escena entró en su momento sin acelerarla.' : `Las ${conToma.length} escenas entraron en su momento sin acelerarlas.` });
  }

  const usados = bloques.filter((b) => b.broll).length;
  const listaFuera = Array.isArray(plan?.brollFuera) ? plan.brollFuera : [];
  const fuera = listaFuera.length;
  if (usados || fuera) {
    // Con la voz ya hecha, el que no entra no se genera (no se paga); los que ya estaban hechos siguen en la carpeta.
    const hechos = brollEnLaCarpeta(carpeta, listaFuera);
    const sinHacer = fuera - hechos;
    const queQuedo = `${fuera === 1 ? 'Quedó uno fuera' : `Quedaron ${fuera} fuera`} porque su frase era corta y la escena aguantaba sola.`;
    const queSeHizo = !hechos
      ? fuera === 1
        ? ' No se generó, así que no costó nada.'
        : ' No se generaron, así que no costaron nada.'
      : !sinHacer
        ? ` ${fuera === 1 ? 'Ya estaba hecho y sigue' : 'Ya estaban hechos y siguen'} en la carpeta por si ${fuera === 1 ? 'lo' : 'los'} quieres usar.`
        : ` ${sinHacer === 1 ? 'Uno no se generó' : `${sinHacer} no se generaron`}; ${hechos === 1 ? 'el otro ya estaba hecho y sigue' : `los otros ${hechos} ya estaban hechos y siguen`} en la carpeta.`;
    d.push({
      id: 'broll',
      icono: 'broll',
      titulo: usados === 1 ? 'Una imagen de apoyo en el video' : usados ? `${usados} imágenes de apoyo en el video` : 'Ninguna imagen de apoyo en el video',
      detalle: fuera ? queQuedo + queSeHizo : 'Se usaron todos, cada uno junto a la frase que acompaña.',
    });
  }

  const mu = plan?.musica;
  if (mu?.archivo) {
    const sube = Number(mu.subeEnPayoffDb) > 0 && mu.payoffDesdeSeg ? ` y sube en el remate, desde el ${tiempo(mu.payoffDesdeSeg)}` : '';
    d.push({ id: 'musica', icono: 'musica', titulo: 'Música de fondo', detalle: `Va suave debajo de la voz${sube}${mu.loop ? '; se repite para cubrir todo el video' : ''}.` });
  }
  const trans = Array.isArray(plan?.transiciones) ? plan.transiciones : [];
  if (trans.length) d.push({ id: 'transiciones', icono: 'transicion', titulo: trans.length === 1 ? 'Una transición con sonido' : `${trans.length} transiciones con sonido`, detalle: 'Van solo donde la historia cambia de parte; el resto son cortes limpios.' });
  const subs = Array.isArray(plan?.subtitulos) ? plan.subtitulos.length : 0;
  if (subs) d.push({ id: 'subtitulos', icono: 'subtitulos', titulo: 'Subtítulos palabra por palabra', detalle: `${subs} frases sincronizadas con la voz; la palabra que se dice se resalta.` });
  if (conductor?.modoPrueba) d.push({ id: 'modo-prueba', icono: 'aviso', titulo: 'Hecho en modo prueba', detalle: 'Las imágenes y los videos son de prueba: no se gastó nada.' });
  return d;
}

// ---------------------------------------------------------------- problemas

function problemasDe({ carpeta, plan, manifiesto, conductor, ventanas, revision, voces, m }) {
  const p = [];
  const notas = Object.fromEntries((conductor?.pasos || []).map((x) => [x.id, x.nota || null]));

  // 1. del modelo de respaldo (de todas las corridas: el log del motor se pisa en cada una)
  const delRespaldo = new Map();
  for (const c of corridas(carpeta)) for (const x of [...(c.videos || []), ...(c.imagenes || [])]) if (x.respaldo) delRespaldo.set(x.archivo, x);
  const lv = leerJSON(path.join(carpeta, 'video', 'log-modelos.json'));
  for (const x of Array.isArray(lv?.clips) ? lv.clips : []) if (x?.respaldo && x.archivo) delRespaldo.set(x.archivo, x);
  const conRespaldo = [...delRespaldo.keys()].filter((a) => fs.existsSync(path.join(carpeta, /\.mp4$/i.test(a) ? 'video' : 'img', a)));
  if (conRespaldo.length) {
    const clips = conRespaldo.filter((a) => /\.mp4$/i.test(a)).length;
    const imagenes = conRespaldo.length - clips;
    const que = [clips ? plural(clips, 'clip', 'clips') : null, imagenes ? plural(imagenes, 'imagen', 'imágenes') : null].filter(Boolean).join(' y ');
    p.push({
      id: 'respaldo',
      tipo: 'arreglado',
      titulo: conRespaldo.length === 1 ? `${clips ? 'Un clip salió' : 'Una imagen salió'} con el modelo de respaldo` : `${que} salieron con el modelo de respaldo`,
      detalle: 'El modelo principal no lo pudo hacer y la app usó el de respaldo para no frenar el anuncio. Puede verse un poco distinto: míralo.',
      piezas: conRespaldo.map((a) => ({ ...pieza(a, m), valor: /\.mp4$/i.test(a) ? 'clip' : 'imagen' })),
    });
  }

  // 2. voces coladas (silenciar.json lo lee el plan: esos clips van mudos)
  const sil = leerJSON(path.join(carpeta, 'silenciar.json'));
  const silenciados = Array.isArray(sil?.clips) ? sil.clips : [];
  if (silenciados.length) {
    p.push({
      id: 'voces-coladas',
      tipo: 'arreglado',
      titulo: silenciados.length === 1 ? 'Un clip traía una voz que no iba' : `${silenciados.length} clips traían una voz que no iba`,
      detalle: 'El modelo de video metió una frase que nadie escribió. Se le quitó el sonido a ese clip (la imagen queda igual); se pierde su sonido de ambiente.',
      piezas: silenciados.map((a) => ({ ...pieza(a, m), valor: 'sin sonido' })),
    });
  }
  const sinRevisar = Array.isArray(voces?.sinRevisar) ? voces.sinRevisar : [];
  if (sinRevisar.length) {
    p.push({
      id: 'voces-sin-revisar',
      tipo: 'revisar',
      titulo: sinRevisar.length === 1 ? 'Un clip no se pudo revisar' : `${sinRevisar.length} clips no se pudieron revisar`,
      detalle: 'No pude escuchar si traen alguna voz que no va (el servicio que transcribe no respondió). Escúchalos.',
      piezas: sinRevisar.map((a) => ({ ...pieza(a, m), valor: null })),
    });
  }

  // 3. lo que noto la revision (los avisos de cada pieza, de todos los pasos: lib/avisos.js). No se rehizo nada: el
  //    usuario decide (Regenerar, «¿Qué salió mal?», «Corregir esto» con lo que la revision ya sugirio).
  const avisos = listaDeAvisos(carpeta);
  if (avisos.length) {
    const uno = avisos.length === 1;
    // (una hoja de la que salen los clips, la foto del producto o un icono no se regeneran: no se promete regenerar)
    const ningunaSeRegenera = avisos.every((a) => /^img:/.test(a.clave) && !/^img:(toma-\d+-(inicial|final)|broll-\d+)$/.test(a.clave));
    p.push({
      id: 'revision-avisos',
      tipo: 'revisar',
      titulo: 'Lo que notó la revisión',
      detalle: ningunaSeRegenera
        ? `La revisión notó algo en ${uno ? 'esta imagen' : `${avisos.length} imágenes`} y no se rehízo nada solo. ${uno ? 'Es la base de los clips donde aparece: no se regenera desde aquí. Mírala' : 'Son la base de los clips donde aparecen: no se regeneran desde aquí. Míralas'} en el video; en el proceso está qué puedes hacer si se nota.`
        : uno
          ? 'La revisión notó algo en esta pieza y no se rehízo nada solo: mírala y, si quieres, regenérala desde el proceso o el editor (con «Corregir esto» se usa lo que la revisión ya sugirió).'
          : `La revisión notó algo en ${avisos.length} piezas y no se rehízo nada solo: míralas y, si quieres, regenéralas desde el proceso o el editor (con «Corregir esto» se usa lo que la revisión ya sugirió).`,
      piezas: avisos.map((a) => ({ n: null, unidad: a.pieza, momento: momentoDeClave(a.clave, m), valor: a.texto, clave: a.clave, sugerencia: a.sugerencia })),
    });
  }

  // (la revision de las imagenes de antes del 2026-11-09, cuando rehacia sola: rehecha, tope o no-se-pudo; desde
  // entonces sus pedidos quedan como 'aviso' y van arriba)
  const pedidos = Array.isArray(revision?.pedidos) ? revision.pedidos : [];
  const hechos = pedidos.filter((x) => x.resultado === 'rehecha');
  const noSe = pedidos.filter((x) => x.resultado && !['rehecha', 'aviso'].includes(x.resultado));
  if (hechos.length) {
    p.push({
      id: 'rehechas',
      tipo: 'arreglado',
      titulo: hechos.length === 1 ? 'Una toma se rehízo' : `${hechos.length} tomas se rehicieron`,
      detalle:
        hechos.length === 1
          ? 'La IA miró las imágenes y esta no pasó la revisión: se escribió de nuevo y se generó otra vez, con su clip (una sola vez).'
          : 'La IA miró las imágenes y estas no pasaron la revisión: se escribieron de nuevo y se generaron otra vez, con sus clips (una sola vez cada una).',
      piezas: hechos.map((x) => ({ ...pieza(`toma-${x.toma}`, m), valor: x.motivo || null })),
    });
  }
  if (noSe.length) {
    p.push({
      id: 'rehechas-no',
      tipo: 'revisar',
      titulo: noSe.length === 1 ? 'Una toma no se pudo rehacer' : `${noSe.length} tomas no se pudieron rehacer`,
      detalle:
        noSe.length === 1
          ? 'La IA vio algo que corregir, pero no se pudo rehacer (o ya se había rehecho una vez, que es el tope). Quedó la versión que estaba: mírala.'
          : 'La IA vio algo que corregir, pero no se pudieron rehacer (o ya se habían rehecho una vez, que es el tope). Quedaron las versiones que estaban: míralas.',
      piezas: noSe.map((x) => ({ ...pieza(`toma-${x.toma}`, m), valor: x.motivo || null })),
    });
  }
  if (notas['revision-imagenes'] && !pedidos.length && revision?.sinRevision) {
    p.push({ id: 'revision-no', tipo: 'revisar', titulo: 'Las imágenes no se revisaron con la IA', detalle: notas['revision-imagenes'], piezas: [] });
  }

  // 4. clips mas cortos que su momento (el plan sostuvo el ultimo cuadro)
  const cortos = [];
  for (const a of Array.isArray(plan?.avisos) ? plan.avisos : []) {
    const r = String(a).match(/^(B-roll|toma) (\d+): el clip dura ([\d.]+)s y la ventana pide ([\d.]+)s/i);
    if (!r || Number(r[4]) - Number(r[3]) < 0.05) continue;
    cortos.push({ ...pieza(`${r[1].toLowerCase() === 'toma' ? 'toma' : 'broll'}-${r[2]}`, m), valor: `faltan ${numeroES(Number(r[4]) - Number(r[3]), 1)} s` });
  }
  for (const x of Array.isArray(ventanas?.sinArreglo) ? ventanas.sinArreglo : []) {
    if (!cortos.some((c) => c.n === x.n && c.unidad === (x.que === 'broll' ? 'B-roll' : 'toma'))) cortos.push({ ...pieza(`${x.que === 'broll' ? 'broll' : 'toma'}-${x.n}`, m), valor: x.motivo });
  }
  // los que midio el control final (el largo real del clip contra su momento en el plan)
  const cfCortos = leerJSON(path.join(carpeta, 'qa', 'control-final.json'));
  for (const x of Array.isArray(cfCortos?.defectos) ? cfCortos.defectos.filter((d) => d.tipo === 'corto') : []) {
    const pz = pieza(String(x.pieza || '').replace('B-roll ', 'broll-').replace(' ', '-'), m);
    if (!cortos.some((c) => c.n === pz.n && c.unidad === pz.unidad)) cortos.push({ ...pz, momento: Number(x.desde) || pz.momento, valor: `faltan ${numeroES(Number(x.hasta) - Number(x.desde), 1)} s` });
  }
  // B-roll que con la voz final entran y no tienen clip (plan.brollSinClip): su toma cubrio toda la frase. Los que
  // no entran no estan aca: no se generan y no faltan.
  const sinClip = Array.isArray(plan?.brollSinClip) ? plan.brollSinClip.map(Number).filter(Number.isFinite) : [];
  if (sinClip.length) {
    const tomaDe = new Map((manifiesto?.broll || []).map((b) => [Number(b?.n), b?.encima_de_toma ?? b?.despues_de_toma ?? null]));
    p.push({
      id: 'broll-sin-clip',
      tipo: 'revisar',
      titulo: sinClip.length === 1 ? 'Un B-roll no está en el video' : `${sinClip.length} B-roll no están en el video`,
      detalle:
        sinClip.length === 1
          ? 'Con la voz final tenía lugar, pero su clip no está: su toma cubre toda la frase, sin huecos. Se puede dejar así.'
          : 'Con la voz final tenían lugar, pero sus clips no están: cada toma cubre toda su frase, sin huecos. Se puede dejar así.',
      piezas: sinClip.map((n) => ({ n, unidad: 'B-roll', momento: m.tomas.get(Number(tomaDe.get(n))) ?? null, valor: null })),
    });
  }

  if (cortos.length) {
    p.push({
      id: 'cortos',
      tipo: 'revisar',
      titulo: cortos.length === 1 ? 'Un clip quedó un poco corto' : `${cortos.length} clips quedaron un poco cortos`,
      detalle: 'El clip dura menos que el momento que tenía que cubrir; el montaje sostuvo el último cuadro para no dejar un hueco.',
      piezas: cortos,
    });
  }

  // 5. control final (y si el re-render lo arreglo)
  const cf = leerJSON(path.join(carpeta, 'qa', 'control-final.json'));
  const cf1 = leerJSON(path.join(carpeta, 'app', 'control-final-1.json'));
  const defectos = Array.isArray(cf?.defectos) ? cf.defectos : [];
  const antes = Array.isArray(cf1?.defectos) ? cf1.defectos : [];
  const resumir = (lista) => {
    const negros = lista.filter((x) => x.tipo === 'negro');
    const quietos = lista.filter((x) => x.tipo === 'congelado');
    const partes = [];
    if (negros.length) partes.push(plural(negros.length, 'tramo negro', 'tramos negros'));
    if (quietos.length) partes.push(plural(quietos.length, 'tramo congelado', 'tramos congelados'));
    return partes.join(' y ');
  };
  if (cf1 && antes.length && cf?.codigo === 0) {
    p.push({
      id: 'control-arreglado',
      tipo: 'arreglado',
      titulo: 'El video se exportó otra vez',
      detalle: `El control final encontró ${resumir(antes) || 'un problema'} en la primera exportación. Se volvió a exportar (no cuesta nada) y quedó limpio.`,
      piezas: [],
    });
  }
  const conTiempo = defectos.filter((x) => x.tipo === 'negro' || x.tipo === 'congelado');
  if (conTiempo.length) {
    // uno por momento (las tres versiones suelen tener el mismo)
    const vistos = new Map();
    for (const x of conTiempo) {
      const k = `${x.tipo}:${Math.round(Number(x.desde) * 2) / 2}`;
      if (!vistos.has(k)) vistos.set(k, x);
    }
    p.push({
      id: 'control-final',
      tipo: 'revisar',
      titulo: cf1 ? 'Quedaron tramos con problemas después de exportar otra vez' : 'El control final encontró tramos con problemas',
      detalle: 'Hay momentos en negro o con la imagen quieta. Pasa cuando un clip no alcanza a cubrir su momento; se arregla rehaciendo ese clip desde el editor.',
      piezas: [...vistos.values()].map((x) => ({ ...pieza(x.pieza ? String(x.pieza).replace(' ', '-').replace('B-roll-', 'broll-') : '', m), momento: Number(x.desde) || 0, valor: x.tipo === 'negro' ? 'negro' : 'imagen quieta' })),
    });
  }
  const otros = defectos.filter((x) => x.tipo !== 'negro' && x.tipo !== 'congelado');
  if (otros.some((x) => x.tipo === 'musica')) {
    p.push({ id: 'control-musica', tipo: 'revisar', titulo: 'Una versión sin música todavía suena con música', detalle: 'La versión para poner tu propia música no quedó bien: escúchala antes de usarla.', piezas: [] });
  }
  if (otros.some((x) => x.tipo === 'falta-version' || x.tipo === 'ilegible' || x.tipo === 'version-vieja' || x.tipo === 'sin-audio')) {
    if (!cf?.soloCompleta) {
      p.push({ id: 'control-versiones', tipo: 'revisar', titulo: 'Falta alguna versión del video', detalle: 'No salieron todas las versiones, o alguna quedó de antes. Toca “Exportar” en el editor para rehacerlas.', piezas: [] });
    } else if (otros.every((x) => x.tipo === 'falta-version') && !plan?.subtitulos?.length) {
      // la app entrega solo la completa (ensamblar --solo-completa): sin subtitulos, salio la misma sin ellos
      p.push({ id: 'control-versiones', tipo: 'revisar', titulo: 'El video salió sin subtítulos', detalle: 'No se pudieron hacer los subtítulos: se entregó sin ellos.', piezas: [] });
    } else {
      p.push({ id: 'control-versiones', tipo: 'revisar', titulo: 'Falta el video completo', detalle: 'No salió, o quedó de antes del último montaje. Toca “Exportar” en el editor para hacerlo de nuevo.', piezas: [] });
    }
  }
  if (cf && cf.codigo === 2) {
    const que = cf.soloCompleta ? 'negros e imagen quieta' : 'negros, imagen quieta y la versión sin música';
    p.push({ id: 'control-no', tipo: 'revisar', titulo: 'No pude revisar el video terminado', detalle: `El control final (${que}) no se pudo hacer. Míralo antes de publicarlo.`, piezas: [] });
  } else if (!cf && notas['control-final']) {
    p.push({ id: 'control-no', tipo: 'revisar', titulo: 'No pude revisar el video terminado', detalle: notas['control-final'], piezas: [] });
  }
  return p;
}

function transicionesDe(plan) {
  return (Array.isArray(plan?.transiciones) ? plan.transiciones : []).map((t) => ({ toma: t.toma ?? null, momento: Number(t.desde) || 0, animacion: t.animacion || null, efecto: t.efecto || null }));
}

function versionesDe(slug, dirOutput) {
  const re = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(?:\\d+x\\d+_)?(con-subtitulos|solo-subtitulos|sin-subtitulos|sin-subtitulos-sin-musica)\\.mp4$`);
  return listar(dirOutput)
    .map((n) => ({ n, r: n.match(re) }))
    .filter((x) => x.r)
    .map((x) => ({ tipo: x.r[1], archivo: x.n, nombre: VERSIONES[x.r[1]] }));
}

/** Arma el informe y lo guarda en temp/<slug>/app/informe.json. Devuelve el informe. */
export function armarInforme({ carpeta, dirOutput, conductor }) {
  const slug = path.basename(carpeta);
  const app = path.join(carpeta, 'app');
  const plan = leerJSON(path.join(carpeta, 'plan-montaje.json'));
  const manifiesto = leerJSON(path.join(carpeta, 'manifiesto.json'));
  const brief = leerJSON(path.join(app, 'brief.json'));
  const ventanas = leerJSON(path.join(app, 'ventanas.json'));
  const revision = leerJSON(path.join(app, 'revision-estado.json'));
  const voces = leerJSON(path.join(app, 'voces.json'));
  const m = momentos(plan);

  const problemas = problemasDe({ carpeta, plan, manifiesto, conductor, ventanas, revision, voces, m });
  const costo = resumenDeGasto(carpeta, conductor);
  // lo que la app rehizo sola (lo tecnico de la revision: un clip sin su dialogo, y en anuncios de antes del 2026-11-09
  // tambien lo que la revision mandaba rehacer; la segunda exportacion) ya esta sumado en el costo. Se dice solo si un
  // paso de revision pago algo: una pieza que volvio a como estaba, sin version nueva, no cuenta.
  const pagoAlRehacer = corridas(carpeta).some((c) => /^revision-/.test(String(c?.paso || '')) && (Number(c.creditos) > 0 || (c.sinRegistro || []).length > 0));
  costo.rehecho = pagoAlRehacer && Object.keys(conductor?.rehechos || {}).some((k) => k.startsWith('toma-') || k.startsWith('broll-'));
  const informe = {
    slug,
    generado: new Date().toISOString(),
    modoPrueba: Boolean(conductor?.modoPrueba),
    duracion: {
      real: plan?.duracion ? Math.round(plan.duracion * 100) / 100 : null,
      estimada: Array.isArray(manifiesto?.tomas) ? Math.round(manifiesto.tomas.reduce((s, t) => s + (Number(t.duracion) || 0), 0) * 10) / 10 : null,
      pedida: segundosPedidos(brief), // aproximada; null si la decide la IA
    },
    versiones: versionesDe(slug, dirOutput),
    decisiones: decisionesDe({ carpeta, plan, manifiesto, brief, ventanas, conductor }),
    transiciones: transicionesDe(plan),
    problemas,
    sinProblemas: problemas.length === 0,
    costo,
  };
  fs.mkdirSync(app, { recursive: true });
  const ruta = path.join(app, 'informe.json');
  escribirJSONSeguro(ruta, informe);
  return informe;
}
