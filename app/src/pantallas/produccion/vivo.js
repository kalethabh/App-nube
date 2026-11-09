// La producción EN VIVO: lo que la pantalla muestra cuando el anuncio tiene conductor
// (temp/<slug>/app/conductor.json, GET /api/anuncios/:slug/conductor cada 2 s).
//
//   vistaConductor(a, modelo, c)   el estado de cada pieza, las etapas, el avance, el tiempo que falta
//                                  y por qué está frenado (si lo está)
//   frasesConductor(c, modelo, v)  el avance en una frase y su detalle
//   registroConductor(c, a, modelo) el registro en frases simples: un renglón por paso, más los arreglos
//
// Las piezas se ponen verdes cuando existen sus archivos (el detalle del anuncio se vuelve a pedir
// mientras corre). Sin precios: el costo real se ve solo en el informe de la entrega.
import {
  TEXTO_ALTO,
  altoDe,
  avanceDeConductor,
  esperaSola,
  etapasDeConductor,
  faltaDeConductor,
  pasoActual,
  textoDeFila,
  textoDePaso,
} from '../../datos/produccion.js';
import { arregladasSolas, enMinuscula, plural } from '../../datos/formato.js';
import { claveDeToma, partesArregladas, registroReal } from './modelo.js';

const TERMINADA = new Set(['listo', 'arreglado', 'te-necesita']);
const HECHO = new Set(['hecho', 'saltado']);
// Los pasos que piden piezas a kie (de cada familia) y que clase de pieza piden.
const PASOS_DE_PIEZAS = { 'imagenes-y-videos': ['imagen', 'clip'], imagenes: ['imagen'], persona: ['imagen'], videos: ['clip'], bloques: ['clip'] };
// La etapa de la linea que cuenta piezas: cuales cuenta.
const ETAPAS_DE_PIEZAS = { piezas: ['imagenes', 'clips'], imagenes: ['imagenes'], persona: ['imagenes'], videos: ['clips'], bloques: ['clips'] };
// "kie no respondió" -> "kie no respondió." (los mensajes del conductor pueden venir con o sin punto)
const conPunto = (s) => (/[.!?…]$/.test(String(s).trim()) ? String(s).trim() : `${String(s).trim()}.`);

/** Lo que se ve debajo del nombre de cada etapa en la línea. */
function detalleDeEtapa(e, conteo, modelo, alto) {
  if (e.estado === 'error') return alto?.tipo === 'saldo' ? 'Falta saldo' : 'Se trabó';
  const cuenta = ETAPAS_DE_PIEZAS[e.id];
  if (cuenta && e.estado !== 'pendiente') {
    const hechas = cuenta.reduce((s, k) => s + conteo[k], 0);
    const total = cuenta.reduce((s, k) => s + modelo[k].length, 0);
    if (total) return `${hechas} de ${total}`;
  }
  if (e.estado === 'hecha') return e.saltada ? 'No hizo falta' : e.id === 'control' ? 'Sin problemas' : 'Lista';
  if (e.estado === 'en-marcha') {
    if (alto?.tipo === 'saldo') return 'Falta saldo';
    if (alto) return 'En pausa';
    const corriendo = e.pasos.find((p) => p.estado === 'corriendo');
    return corriendo?.nombre || 'En marcha';
  }
  return 'Después';
}

/**
 * El estado de todo con el conductor. Devuelve lo mismo que la vista sin conductor (estados, conteo,
 * etapa, ultimo, terminado, falta...) y además: etapas (la línea), detalles, avance, alto y paso.
 */
export function vistaConductor(a, modelo, c) {
  const paso = pasoActual(c);
  const alto = altoDe(c);
  const anda = c.estado === 'corriendo' && !alto;
  const estados = new Map(modelo.piezas.map((p) => [p.id, { estado: p.estado, nota: null }]));

  // Con conductor, lo que salió mal en una pieza lo resuelve la familia sola (la rehace con su tope y lo que no se
  // pudo va al informe): ninguna pieza espera una decisión tuya.
  for (const [id, x] of estados) if (x.estado === 'te-necesita') estados.set(id, { estado: 'arreglado', nota: null });

  // lo que se está haciendo ahora: las próximas que pueden salir (ya está lo que necesitan), hasta 3 de cada clase
  const clases = anda ? PASOS_DE_PIEZAS[paso?.id] : null;
  if (clases) {
    const cupo = { imagen: clases.includes('imagen') ? 3 : 0, clip: clases.includes('clip') ? 3 : 0 };
    for (const p of [...modelo.piezas].sort((x, y) => x.prioridad - y.prioridad)) {
      if (p.url || !cupo[p.clase]) continue;
      if (!p.depende.every((d) => modelo.porId.get(d)?.url)) continue;
      estados.set(p.id, { estado: 'generando', nota: null });
      cupo[p.clase]--;
    }
  }
  // lo que la revisión de la IA mandó rehacer y todavía no volvió
  if (anda && /^revision/.test(paso?.id || '')) {
    for (const p of modelo.piezas) {
      if (!p.url && c.rehechos?.[claveDeToma(p)]) estados.set(p.id, { estado: 'generando', nota: 'rehaciendo' });
    }
  }

  const conteo = { imagenes: 0, clips: 0, generandoImg: 0, generandoClip: 0, arreglados: 0, necesitan: 0 };
  let ultimo = null;
  for (const p of modelo.piezas) {
    const e = estados.get(p.id).estado;
    if (TERMINADA.has(e)) {
      conteo[p.clase === 'imagen' ? 'imagenes' : 'clips']++;
      if (e === 'arreglado') conteo.arreglados++;
      if (e === 'te-necesita') conteo.necesitan++;
      if (p.fecha && (!ultimo || p.fecha > ultimo.fecha)) ultimo = { id: p.id, fecha: p.fecha };
    } else if (e === 'generando') conteo[p.clase === 'imagen' ? 'generandoImg' : 'generandoClip']++;
  }

  const etapas = etapasDeConductor(c).map((e) => ({ ...e, detalle: detalleDeEtapa(e, conteo, modelo, alto) }));
  const etapa = Object.fromEntries(etapas.map((e) => [e.id, e.estado]));
  const detalles = Object.fromEntries(etapas.map((e) => [e.id, e.detalle]));
  const total = modelo.piezas.length || 1;
  const faltan = {
    imagenes: modelo.imagenes.filter((p) => !p.url).length,
    clips: modelo.clips.filter((p) => !p.url).length,
  };
  const terminado = c.estado === 'listo';
  const pasoVoz = c.pasos.find((p) => p.id === 'voz');
  const pasoMusica = c.pasos.find((p) => p.id === 'musica');

  return {
    estados,
    conteo,
    etapa,
    etapas,
    detalles,
    ultimo,
    terminado,
    paso,
    alto,
    enFila: c.estado === 'esperando' && !alto,
    // "Te necesita" (rojo) cuando hace falta algo tuyo; sin conexión solo espera
    esperandoTu: Boolean(alto && !esperaSola(alto)),
    necesita: conteo.necesitan > 0,
    avance: avanceDeConductor(c, (conteo.imagenes + conteo.clips) / total),
    falta: faltaDeConductor(c, faltan),
    total: faltaDeConductor(c, faltan),
    vozLista: Boolean(a.audio?.voz) || HECHO.has(pasoVoz?.estado),
    musicaLista: Boolean(a.audio?.musica) || HECHO.has(pasoMusica?.estado),
    vozHaciendo: pasoVoz?.estado === 'corriendo',
    musicaHaciendo: pasoMusica?.estado === 'corriendo',
    modoPrueba: Boolean(c.modoPrueba),
  };
}

/** El avance en una frase y su detalle. */
export function frasesConductor(c, modelo, v) {
  if (v.terminado) {
    const arr = partesArregladas(modelo, v.estados);
    return {
      frase: 'Tu anuncio está terminado',
      detalle: `${plural(modelo.imagenes.length, 'imagen', 'imágenes')} y ${plural(modelo.clips.length, 'clip', 'clips')}${
        arr.n ? `; ${arregladasSolas(arr.n, arr.soloTomas)}` : ''
      }. El video, el informe y lo que costó están en la entrega.`,
    };
  }
  if (v.alto) {
    // el porqué y el botón están en la tarjeta de arriba: aquí, lo que quedó hecho
    const t = TEXTO_ALTO[v.alto.tipo];
    const que = v.paso ? enMinuscula(textoDePaso(v.paso).haciendo) : null;
    const hechas = v.conteo.imagenes + v.conteo.clips;
    const guardado = `${hechas ? `${hechas} de ${modelo.piezas.length} piezas ya están listas. ` : ''}Lo que ya está hecho quedó guardado.`;
    if (v.alto.tipo === 'conexion') return { frase: t.titulo, detalle: `${guardado} Apenas vuelva internet, sigue sola.` };
    if (v.alto.tipo === 'reintento') return { frase: t.titulo, detalle: `${guardado} Sigue sola apenas el servicio responda.` };
    if (v.alto.tipo === 'saldo') return { frase: t.titulo, detalle: guardado };
    if (v.alto.tipo === 'cancion') return { frase: 'Te toca elegir la canción', detalle: 'Escucha las versiones y quédate con una: es lo único que espera. Con la que elijas se escriben las escenas y sigue sola.' };
    if (v.alto.tipo === 'pausa') return { frase: t.titulo, detalle: `${que ? `Quedó en: ${que}. ` : ''}${guardado}` };
    return { frase: que ? `Se trabó: ${que}` : t.titulo, detalle: guardado };
  }
  if (c.estado === 'esperando' || !v.paso) {
    const fila = textoDeFila(c);
    return { frase: 'Tu anuncio está en la fila', detalle: fila ? `${fila} No tienes que hacer nada.` : 'Arranca en un momento. No tienes que hacer nada: si algo te necesita, aparece aquí.' };
  }
  const t = textoDePaso(v.paso);
  const clases = PASOS_DE_PIEZAS[v.paso.id];
  if (clases && modelo.piezas.length) {
    const ni = modelo.imagenes.length;
    const n = modelo.clips.length;
    const enCamino = (clases.includes('imagen') ? v.conteo.generandoImg : 0) + (clases.includes('clip') ? v.conteo.generandoClip : 0);
    return {
      frase: t.haciendo,
      detalle:
        [clases.includes('imagen') && ni ? `${v.conteo.imagenes} de ${ni} imágenes` : null, clases.includes('clip') && n ? `${v.conteo.clips} de ${n} clips` : null, enCamino ? `${enCamino} en camino` : null]
          .filter(Boolean)
          .join(' · ') + `. ${t.detalle}`,
    };
  }
  const reintento = v.paso.intentos > 1 ? (v.paso.retomado ? ' Sigue desde donde quedó cuando se cerró la app.' : ' Va por otro intento: el anterior falló y la app lo pidió de nuevo.') : '';
  return { frase: t.haciendo, detalle: t.detalle + reintento };
}

/** El registro en frases simples, del más nuevo al más viejo: los pasos y lo que se arregló solo. */
export function registroConductor(c, a, modelo) {
  const r = [];
  const ahora = c.actualizado || new Date().toISOString();
  for (const p of c.pasos) {
    const t = textoDePaso(p);
    if (p.estado === 'hecho') {
      const otraVez = p.intentos > 1 && !p.retomado;
      // el saldo, con cuánto había y su color (verde de sobra, naranja justo, rojo no alcanza)
      if (p.id === 'saldo' && c.saldoInicial?.creditos != null) {
        const saldo = Number(c.saldoInicial.creditos);
        const costo = c.costoPlan?.creditos != null ? Number(c.costoPlan.creditos) : null;
        const sem = costo === null ? null : saldo < costo ? 'corto' : saldo - costo >= Math.max(costo * 0.5, 200) ? 'sobra' : 'justo';
        const usd = (cr) => `US$${(cr * 0.005).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const como = sem === 'sobra' ? 'Alcanza de sobra' : sem === 'justo' ? 'Alcanza justo' : sem === 'corto' ? 'No alcanza' : 'Alcanza';
        r.push({ estado: 'listo', semaforo: sem, texto: `Tu saldo de kie: ${usd(saldo)}. ${como} para este anuncio${costo !== null ? ` (cuesta ~${usd(costo)})` : ''}.`, fecha: p.fin || p.inicio || ahora });
        continue;
      }
      r.push({ estado: otraVez ? 'arreglado' : 'listo', texto: otraVez ? `${t.hecho.replace(/\.$/, '')} (falló una vez y la app lo pidió de nuevo).` : t.hecho, fecha: p.fin || p.inicio || ahora });
    } else if (p.estado === 'saltado') {
      r.push({ estado: 'en-cola', texto: `${p.nombre || t.haciendo}: no hizo falta.`, fecha: p.fin || p.inicio || ahora });
    } else if (p.estado === 'corriendo') {
      r.push({ estado: 'generando', texto: `${t.haciendo}…`, fecha: p.inicio || ahora });
    } else if (p.estado === 'error') {
      const saldo = altoDe(c)?.tipo === 'saldo' && p.id === c.paso;
      r.push({ estado: 'error', texto: saldo ? `${TEXTO_ALTO.saldo.titulo}.` : `${t.haciendo}: ${conPunto(p.error?.mensaje || 'se trabó')}`, fecha: p.fin || ahora });
    }
  }
  // las piezas mientras llegan
  const pasoPiezas = c.pasos.find((p) => PASOS_DE_PIEZAS[p.id] && p.estado === 'corriendo');
  if (pasoPiezas?.estado === 'corriendo') {
    const llegadas = modelo.piezas.filter((p) => p.url);
    const ultima = llegadas.map((p) => p.fecha).filter(Boolean).sort().pop();
    if (llegadas.length && ultima) r.push({ estado: 'listo', texto: `Llegaron ${llegadas.length} de ${modelo.piezas.length} piezas.`, fecha: ultima });
  }
  // lo que se arregló solo (respaldo, reintentos, lo que la IA mandó rehacer) y las versiones listas
  for (const x of registroReal(a, modelo)) {
    if (x.estado === 'arreglado' || x.estado === 'te-necesita' || /^Versión/.test(x.texto)) r.push(x);
  }
  const vistas = new Set();
  // a la misma hora (un paso termina cuando empieza el siguiente) va arriba el que vino después
  r.forEach((x, i) => (x.orden = i));
  return r
    .filter((x) => x.fecha && !vistas.has(`${x.pieza || ''}|${x.texto}`) && vistas.add(`${x.pieza || ''}|${x.texto}`))
    .sort((x, y) => Date.parse(y.fecha) - Date.parse(x.fecha) || y.orden - x.orden);
}
