// El modelo de la pantalla de producción: convierte el detalle del anuncio (/api/anuncios/:slug) y lo
// que agrega /api/anuncios/:slug/produccion en una lista de PIEZAS (cada imagen o clip que kie hace),
// agrupadas toma por toma, con su estado real y de qué dependen (para la simulación). Sin precios:
// el costo del anuncio se ve solo en el informe de la entrega.
//
// Pieza:
//   id        'img:toma-4-inicial' · 'vid:toma-4' · 'img:broll-2' · 'vid:paso-3' · 'img:mujer' · 'vid:gancho-1b'
//   clase     'imagen' | 'clip'
//   tipo      'hoja' | 'icono' | 'inicial' | 'final' | 'clip' | 'paso' | 'broll-imagen' | 'broll-clip' | 'gancho'
//   estado    el real: 'listo' | 'arreglado' | 'te-necesita' | 'generando' | 'en-cola'
//   depende   ids de lo que tiene que estar antes
//   avisos    lo que notó la revisión en esa pieza ([{ texto, fuente, paso, fecha, sugerencia: bool, clave }]): la app ya
//             no rehace nada sola por calidad, solo avisa (el estado sigue siendo el real; el aviso va aparte)
//   url, imagen, video  con «?v=<fecha>»: una pieza regenerada se llama igual que la de antes
import { conVersion, miniatura } from '../../datos/api.js';
import { duracion as fmtDuracion } from '../../datos/formato.js';

// Estilos con revisión obligatoria de clips antes de montar.
export const esHablado = (a) => a?.familia === 'hablado';

const nombreBonito = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** «Paso 2», «Gancho B», «Icono «x»»: las piezas que se nombran en masculino (las demás: escena, imagen, hoja). */
export const esMasculina = (p) => ['paso', 'gancho', 'icono'].includes(p?.tipo);

/**
 * Por qué se rehizo una pieza, en una frase corta (para el registro y el panel). Con 'pedido' (lo hiciste tú):
 * `modo` ('subido' = pusiste tu video, 'original' = volviste al clip original; si no, la regeneraste) y `masculina`.
 */
export function fraseArreglo(motivo, clase, { modo = null, masculina = false } = {}) {
  switch (motivo) {
    case 'voz-colada':
      return 'traía una voz colada; se silenció sola';
    case 'manos':
      return 'las manos salieron raras; se repitió sola';
    case 'ojos':
      return 'los ojos no salieron como en la hoja; se repitió sola';
    case 'respaldo':
      return 'el modelo principal falló tres veces; salió con el de respaldo';
    case 'sin-dialogo':
      return 'salió con un modelo que no hace hablar al personaje';
    case 'reintento':
      return 'kie dio un error; la app lo pidió de nuevo';
    case 'version-anterior':
      return 'la primera versión no convenció; se repitió';
    case 'revision-ia':
      // (lo cuenta conductor.rehechos: hoy solo lo técnico, como un clip que salió sin su frase; antes, la revisión)
      return clase === 'clip' ? 'no salió bien a la primera; la app hizo el clip otra vez' : 'no salió bien a la primera; la app la hizo otra vez';
    case 'pedido':
      if (modo === 'subido') return 'pusiste tu video';
      if (modo === 'original') return 'volviste al clip original';
      if (modo === 'lugar') return 'sale de otro momento de su escena, por tu «Corregir esto»';
      return masculina ? 'lo regeneraste tú' : 'la regeneraste tú';
    default:
      return clase === 'clip' ? 'el clip salió con un defecto; se repitió solo' : 'salió con un defecto; se repitió sola';
  }
}

function etiquetaDePieza(tipo, extra = {}) {
  switch (tipo) {
    case 'hoja':
      return 'Hoja';
    case 'icono':
      return 'Icono';
    case 'inicial':
      return 'Inicio';
    case 'final':
      return 'Final';
    case 'clip':
      return 'Clip';
    case 'paso':
      return extra.hacia ? `Paso a ${extra.hacia}` : 'Paso';
    case 'broll-imagen':
      return 'Apoyo';
    case 'broll-clip':
      return 'Apoyo · clip';
    case 'gancho':
      return extra.nombre || 'Gancho';
    default:
      return tipo;
  }
}

/** 'toma-7' · 'broll-3' · 'paso-2' · 'gancho-1b': la clave de conductor.rehechos a la que pertenece una pieza. */
export function claveDeToma(p) {
  if (p.broll) return `broll-${p.broll}`;
  if (p.tipo === 'paso') return `paso-${String(p.id).replace(/^vid:paso-/, '')}`;
  if (p.tipo === 'gancho') return `gancho-${p.gancho}`;
  return p.toma ? `toma-${p.toma}` : null;
}

/**
 * ¿Este clip de un anuncio hablado salió sin el diálogo? Con `mod.dialogo` (log-modelos.json, del catálogo):
 * los clips de las tomas (y los pasos) cuyo modelo no hace hablar. Sin ese dato, la regla de antes: todo clip
 * de respaldo en un hablado.
 */
function sinDialogo(mod, p, hablado) {
  if (!hablado || p.clase !== 'clip' || !mod) return false;
  if (typeof mod.dialogo === 'boolean') return p.tipo !== 'broll-clip' && mod.dialogo === false;
  return Boolean(mod.respaldo);
}

/**
 * Lo que se arregló solo, contado por parte del video (la imagen y el clip de una toma son UNA toma), igual que
 * el informe de la entrega. { n, soloTomas }
 */
export function partesArregladas(modelo, estados) {
  const partes = new Set();
  for (const p of modelo.piezas) if (estados?.get(p.id)?.estado === 'arreglado') partes.add(claveDeToma(p) || p.id);
  return { n: partes.size, soloTomas: [...partes].every((k) => String(k).startsWith('toma-')) };
}

/**
 * Arma todo lo que la pantalla necesita.
 * @param {object} a       detalle del anuncio (useAnuncio)
 * @param {object} extras  /api/anuncios/:slug/produccion (puede ser null mientras carga)
 * @param {object} opciones.rehechos  conductor.rehechos ({ 'toma-7': 1 }): lo que la app hizo otra vez sola (hoy solo lo
 *                                    técnico: un clip que no salió o salió sin su frase; en anuncios de antes, la revisión)
 * @param {Map}    opciones.regenerados las piezas que regeneraste tú, con cómo las pediste ('toma-3' -> 'tal-cual' |
 *                                    'pedido' | 'sugerencia' | 'subido' | 'original': conductor.rehacer). Un Set
 *                                    (sin el cómo) también sirve.
 */
export function construirModelo(a, extras, { rehechos = null, regenerados = null } = {}) {
  const ex = extras || { arreglos: {}, modelos: {}, revisiones: {}, oido: {}, avisos: {}, fechas: { imagenes: {}, clips: {}, audio: {} } };
  const piezas = [];
  const porId = new Map();
  const hablado = esHablado(a);
  const continuidad = Boolean(a.continuidad) || (a.pasos?.length || 0) > 0;
  const cantado = a.familia === 'cantado' || a.estilo === 'historias-musicales';
  const avisosDe = (clave) => (Array.isArray(ex.avisos?.[clave]) ? ex.avisos[clave].map((x) => ({ ...x, clave })) : []);

  const nueva = (p) => {
    const clave = p.id.split(':')[1];
    const lado = p.clase === 'imagen' ? 'img' : 'vid';
    const mod = ex.modelos?.[`${lado}:${clave}`] || null;
    const arreglos = ex.arreglos?.[`${lado}:${clave}`] || [];
    const revision = ex.revisiones?.[`vid:${clave}`] || null;
    const fecha = (p.clase === 'imagen' ? ex.fechas?.imagenes : ex.fechas?.clips)?.[clave] || null;
    // con continuidad no hay pieza del clip propio de una escena: su aviso va en su imagen de inicio
    const avisos = [...avisosDe(p.id), ...(continuidad && p.tipo === 'inicial' ? avisosDe(`vid:toma-${p.toma}`) : [])];
    // la versión del archivo: una pieza regenerada se llama igual que la de antes
    const url = conVersion(p.url, fecha);
    const conVer = { url, ...(p.imagen ? { imagen: conVersion(p.imagen, fecha) } : {}), ...(p.video ? { video: conVersion(p.video, fecha) } : {}) };
    const deLaToma = claveDeToma(p);

    // El estado real, con lo que dicen los archivos y los registros del motor.
    let estado = p.url ? 'listo' : 'en-cola';
    let motivo = null;
    const rehecha = rehechos ? Number(rehechos[deLaToma]) || 0 : 0;
    // lo que regeneraste tú queda «lista» (con su «Antes»), no «se arregló sola»
    // (con continuidad, regenerar la imagen de una escena hace de nuevo los dos pasos de al lado)
    // (el lugar que vuelve de UGC: desde 2026-11-09 su fotograma solo cambia con tu «Corregir esto» en un bloque)
    const lugarCambiado = p.tipo === 'hoja' && p.lugar && Boolean(regenerados?.size);
    const pedida = lugarCambiado || Boolean(regenerados?.has(deLaToma)) || (p.tipo === 'paso' && Boolean(regenerados?.has(`toma-${p.toma}`) || regenerados?.has(`toma-${p.hacia}`)));
    const regenerada = pedida && arreglos.length > 0 && !arreglos[arreglos.length - 1].motivo;
    // cómo la pediste (regenerar, tu video en el anuncio, volver al original): para la frase del registro
    const modoDe = (k) => (typeof regenerados?.get === 'function' ? regenerados.get(k) : null) || null;
    const modoPedido = !regenerada ? null : lugarCambiado ? 'lugar' : modoDe(deLaToma) || (p.tipo === 'paso' ? modoDe(`toma-${p.toma}`) || modoDe(`toma-${p.hacia}`) : null);
    if (p.url) {
      if (regenerada) {
        motivo = 'pedido';
      } else if (rehecha && !arreglos.length) {
        estado = 'arreglado';
        motivo = 'revision-ia';
      } else if (arreglos.length) {
        estado = 'arreglado';
        motivo = arreglos[arreglos.length - 1].motivo || null;
      } else if (mod?.respaldo || sinDialogo(mod, p, hablado)) {
        // En los hablados un clip de un modelo que no genera el diálogo es un defecto: te necesita. Si el registro
        // trae `dialogo` (del catálogo de modelos) manda eso: un respaldo que sí habla (p. ej. Omni después de Grok)
        // es solo "se arregló sola", y el B-roll no habla nunca. Sin ese dato, lo de antes: en los hablados, todo
        // clip de respaldo (Kling) te necesita.
        estado = sinDialogo(mod, p, hablado) ? 'te-necesita' : 'arreglado';
        motivo = mod?.respaldo ? 'respaldo' : 'sin-dialogo';
      } else if ((mod?.intentos || 1) > 1) {
        estado = 'arreglado';
        motivo = 'reintento';
      }
    }
    const pieza = {
      ...p,
      ...conVer,
      clave,
      etiqueta: etiquetaDePieza(p.tipo, p),
      modelo: mod?.modelo || null,
      respaldo: Boolean(mod?.respaldo),
      intentos: mod?.intentos || 1,
      arreglos,
      motivo,
      modoPedido,
      rehecha,
      revision,
      fecha,
      estado,
      avisos,
      depende: p.depende || [],
    };
    piezas.push(pieza);
    porId.set(pieza.id, pieza);
    return pieza;
  };

  // ---------------------------------------------------------------- hojas de referencia
  const hojas = (a.hojas || []).map((h) =>
    nueva({
      id: `img:${h.id}`,
      clase: 'imagen',
      tipo: 'hoja',
      toma: null,
      nombre: h.id === 'producto' ? 'Tu producto' : nombreBonito(h.nombre || h.id),
      lugar: h.tipo === 'lugar',
      titulo: h.id === 'producto' ? 'Tu producto' : `Hoja de ${nombreBonito(h.nombre || h.id)}`,
      url: h.imagen,
      imagen: h.imagen,
      prioridad: 0,
    })
  );
  const iconos = (a.iconos || []).map((ic) =>
    nueva({
      id: `img:${ic.id}`,
      clase: 'imagen',
      tipo: 'icono',
      toma: null,
      nombre: nombreBonito(ic.id.replace(/^icono-/, '')),
      titulo: `Icono «${ic.id.replace(/^icono-/, '')}»`,
      url: ic.imagen,
      imagen: ic.imagen,
      prioridad: 1,
    })
  );
  const idsHojas = hojas.map((h) => h.id);

  // ---------------------------------------------------------------- tomas
  const tomas = (a.tomas || []).map((t, i) => {
    const grupo = {
      n: t.n,
      indice: i,
      linea: t.linea || '',
      fase: t.fase || null,
      habla: t.habla || null,
      // (el nombre del que habla, si el guion lo trae: "Laura", no "el anfitrión A")
      quien: t.habla ? a.nombresHabla?.[t.habla] || null : null,
      reacciones: t.clase === 'reacciones',
      duracion: t.duracionClip || t.duracion || null,
      flujo: [], // inicio -> final -> clip (o paso)
      broll: [], // imagen -> clip
      oido: ex.oido?.[String(t.n)] || null,
    };
    const prio = 10 + i;
    let ini = null;
    // UGC no lleva imagen por toma: la persona es la hoja y cada bloque sale de ella.
    if (t.imagenInicial || a.estilo !== 'ugc') {
      ini = nueva({
        id: `img:toma-${t.n}-inicial`,
        clase: 'imagen',
        tipo: 'inicial',
        toma: t.n,
        titulo: `Escena ${t.n} · imagen de inicio`,
        url: t.imagenInicial,
        imagen: t.imagenInicial,
        linea: t.linea,
        depende: idsHojas,
        prioridad: prio,
      });
      grupo.flujo.push(ini);
    }
    let fin = null;
    if (t.llevaImagenFinal || t.imagenFinal) {
      fin = nueva({
        id: `img:toma-${t.n}-final`,
        clase: 'imagen',
        tipo: 'final',
        toma: t.n,
        titulo: `Escena ${t.n} · imagen final`,
        url: t.imagenFinal,
        imagen: t.imagenFinal,
        linea: t.linea,
        depende: ini ? [ini.id] : idsHojas,
        prioridad: prio,
      });
      grupo.flujo.push(fin);
    }
    if (!continuidad) {
      const previas = [ini?.id, fin?.id].filter(Boolean);
      nueva({
        id: `vid:toma-${t.n}`,
        clase: 'clip',
        tipo: 'clip',
        toma: t.n,
        titulo: `Escena ${t.n} · clip`,
        url: t.clip,
        video: t.clip,
        duracion: t.duracionClip,
        duracionPedida: t.duracion,
        linea: t.linea,
        fuente: ini?.url || null, // la imagen de la que sale el clip (se ve atenuada mientras se genera)
        depende: previas.length ? previas : idsHojas,
        prioridad: prio,
      });
      grupo.flujo.push(piezas[piezas.length - 1]);
    }
    return grupo;
  });
  const tomaPorN = new Map(tomas.map((g) => [g.n, g]));

  // ---------------------------------------------------------------- continuidad: los pasos entre tomas
  for (const p of a.pasos || []) {
    const g = tomaPorN.get(p.de);
    const de = g?.flujo.filter((x) => x.clase === 'imagen');
    const hacia = tomaPorN.get(p.a)?.flujo.find((x) => x.tipo === 'inicial');
    const salida = de?.length ? de[de.length - 1] : null;
    const paso = nueva({
      id: `vid:paso-${p.n}`,
      clase: 'clip',
      tipo: 'paso',
      toma: p.de,
      a: `toma ${p.a}`,
      hacia: p.a,
      titulo: `Paso de la escena ${p.de} a la ${p.a}`,
      url: p.clip,
      video: p.clip,
      duracion: p.duracionClip,
      duracionPedida: p.duracion,
      linea: g?.linea,
      fuente: salida?.url || null,
      depende: [salida?.id, hacia?.id].filter(Boolean),
      prioridad: 10 + (g?.indice ?? p.n),
    });
    if (g) g.flujo.push(paso);
  }

  // ---------------------------------------------------------------- b-roll
  // El que no entra en el video con la voz del anuncio no se genera (entra: false; el servidor ni lo manda si no hay
  // nada hecho): de ese se ve solo lo que ya estaba en la carpeta, nunca un lugar vacío esperando.
  const sueltos = [];
  for (const b of a.broll || []) {
    const n = b.despuesDeToma ?? b.encimaDeToma ?? null;
    const g = n !== null ? tomaPorN.get(n) : null;
    const prio = 200 + (g?.indice ?? b.n);
    const soloLoHecho = b.entra === false;
    const linea = b.sincronizaCon ? `Sale cuando dice «${b.sincronizaCon}»` : null;
    const imagen = soloLoHecho && !b.imagen ? null : nueva({
      id: `img:broll-${b.n}`,
      clase: 'imagen',
      tipo: 'broll-imagen',
      toma: g?.n ?? null,
      broll: b.n,
      titulo: `Imagen de apoyo ${b.n} · imagen`,
      url: b.imagen,
      imagen: b.imagen,
      linea,
      sincroniza: b.sincronizaCon,
      encima: b.encimaDeToma !== null && b.encimaDeToma !== undefined,
      depende: idsHojas,
      prioridad: prio,
    });
    const clip = soloLoHecho && !b.clip ? null : nueva({
      id: `vid:broll-${b.n}`,
      clase: 'clip',
      tipo: 'broll-clip',
      toma: g?.n ?? null,
      broll: b.n,
      titulo: `Imagen de apoyo ${b.n} · clip`,
      url: b.clip,
      video: b.clip,
      duracion: b.duracionClip,
      duracionPedida: b.duracion,
      linea,
      sincroniza: b.sincronizaCon,
      fuente: imagen?.url || b.imagen,
      depende: imagen ? [imagen.id] : idsHojas,
      prioridad: prio,
    });
    const hechas = [imagen, clip].filter(Boolean);
    if (g) g.broll.push(...hechas);
    else sueltos.push(...hechas);
  }

  // ---------------------------------------------------------------- ganchos (UGC): el mismo anuncio con otro comienzo
  // Cada uno es un clip de la persona que reemplaza al primer bloque (su versión se arma aparte, en la entrega). Salen
  // en el mismo paso que los bloques; se regeneran como cualquier clip.
  const ganchos = (a.ganchos || []).map((g, i) => {
    const nombre = g.nombre || `Gancho ${g.letra || g.id}`;
    return nueva({
      id: `vid:gancho-${g.id}`,
      clase: 'clip',
      tipo: 'gancho',
      toma: null,
      gancho: String(g.id),
      reemplaza: g.reemplaza ?? null,
      nombre,
      titulo: `${nombre} · clip`,
      url: g.clip,
      video: g.clip,
      duracion: g.duracionClip,
      duracionPedida: g.duracion,
      linea: g.linea || null,
      depende: idsHojas,
      prioridad: 150 + i,
    });
  });

  // Los que dependen de cada pieza (para frenar solo eso si algo te necesita)
  const dependientes = new Map(piezas.map((p) => [p.id, []]));
  for (const p of piezas) for (const d of p.depende) if (dependientes.has(d)) dependientes.get(d).push(p.id);

  const imagenes = piezas.filter((p) => p.clase === 'imagen');
  const clips = piezas.filter((p) => p.clase === 'clip');
  const conMusica = Boolean(a.audio?.musica);

  return {
    slug: a.slug,
    hablado,
    continuidad,
    cantado,
    piezas,
    porId,
    dependientes,
    hojas: [...hojas, ...iconos],
    tomas,
    sueltos,
    ganchos,
    imagenes,
    clips,
    conVoz: Boolean(a.audio?.voz) || a.modoAudio === 'voz_en_off',
    conMusica,
    fechasAudio: ex.fechas?.audio || {},
    // los avisos de piezas que el proceso no muestra (hoy, ninguna: con continuidad el del clip de una escena va en su
    // imagen de inicio)
    avisosSueltos: Object.keys(ex.avisos || {}).filter((k) => !porId.has(k) && !(continuidad && /^vid:toma-\d+$/.test(k))),
  };
}

/** Todas las piezas en el orden de la pantalla: hojas e iconos, escena por escena, imágenes de apoyo sueltas y ganchos. */
export function piezasEnOrden(modelo) {
  return modelo ? [...modelo.hojas, ...modelo.tomas.flatMap((g) => [...g.flujo, ...g.broll]), ...modelo.sueltos, ...(modelo.ganchos || [])] : [];
}

/** Clips que se revisan a mano en los hablados (los de las tomas, no el b-roll). */
export function clipsParaRevisar(modelo) {
  return modelo.tomas
    .map((g) => ({ grupo: g, clip: g.flujo.find((p) => p.tipo === 'clip') }))
    .filter((x) => x.clip);
}

/** La frase de las etapas, según la familia del anuncio. */
export function etapasDe(a, modelo) {
  const lista = [];
  if (modelo.cantado) lista.push({ id: 'voz', nombre: 'Canción', icono: 'Music' });
  else if (modelo.hablado) lista.push({ id: 'voz', nombre: modelo.hojas.length > 1 ? 'Personajes' : 'Personaje', icono: 'UserRound' });
  else lista.push({ id: 'voz', nombre: 'Voz', icono: 'Mic' });
  const hayFrames = modelo.imagenes.some((p) => p.tipo !== 'hoja');
  if (hayFrames || !modelo.hablado) lista.push({ id: 'imagenes', nombre: 'Imágenes', icono: 'Images' });
  lista.push({ id: 'videos', nombre: 'Videos', icono: 'Film' });
  lista.push({ id: 'revision', nombre: modelo.hablado ? 'Tu revisión' : 'Revisión', icono: 'ScanEye' });
  lista.push({ id: 'montaje', nombre: 'Montaje', icono: 'Scissors' });
  lista.push({ id: 'render', nombre: 'Render', icono: 'Clapperboard' });
  lista.push({ id: 'control', nombre: 'Control final', icono: 'ShieldCheck' });
  return lista;
}

// ---------------------------------------------------------------- registro real (anuncio terminado)

const listaNatural = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const maxFecha = (xs) => xs.filter(Boolean).sort().slice(-1)[0] || null;
const minFecha = (xs) => xs.filter(Boolean).sort()[0] || null;

/** El registro con lo que de verdad pasó, en frases simples, del más nuevo al más viejo. */
export function registroReal(a, modelo) {
  const r = [];
  const fa = modelo.fechasAudio || {};
  if (fa.voz && modelo.conVoz) r.push({ estado: 'listo', texto: `Voz lista${a.duracion ? ` (${fmtDuracion(a.duracion)})` : ''}.`, fecha: fa.voz });
  if (fa.cancion) r.push({ estado: 'listo', texto: 'Canción elegida y lista.', fecha: fa.cancion });
  if (fa.musica && modelo.conMusica) r.push({ estado: 'listo', texto: 'Música de fondo lista.', fecha: fa.musica });
  const hojas = modelo.hojas.filter((h) => h.tipo === 'hoja' && h.url);
  if (hojas.length) {
    const nombres = hojas.map((h) => (h.clave === 'producto' ? 'tu producto' : String(h.nombre)));
    r.push({
      estado: 'listo',
      texto: `${hojas.length === 1 ? 'Hoja de referencia lista' : 'Hojas de referencia listas'}: ${listaNatural(nombres)}.`,
      fecha: minFecha(hojas.map((h) => h.fecha)),
    });
  }
  const imgs = modelo.imagenes.filter((p) => p.url && p.tipo !== 'hoja');
  if (imgs.length) r.push({ estado: 'listo', texto: `Todas las imágenes listas (${imgs.length}).`, fecha: maxFecha(imgs.map((p) => p.fecha)) });
  const clips = modelo.clips.filter((p) => p.url);
  if (clips.length) r.push({ estado: 'listo', texto: `Todos los clips listos (${clips.length}).`, fecha: maxFecha(clips.map((p) => p.fecha)) });
  // Los arreglos. Si en una misma toma se rehicieron varias piezas por la misma razón, va una sola línea.
  const grupos = new Map();
  for (const p of modelo.piezas) {
    if (p.estado !== 'arreglado' && p.estado !== 'te-necesita') continue;
    const clave = p.toma && !p.broll && p.tipo !== 'paso' ? `toma-${p.toma}|${p.motivo || ''}|${p.estado}` : p.id;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(p);
  }
  const NOMBRES = { inicial: 'la imagen de inicio', final: 'la imagen final', clip: 'el clip' };
  for (const lista of grupos.values()) {
    const p = lista[0];
    const fecha = maxFecha(lista.map((x) => x.arreglos[x.arreglos.length - 1]?.fecha || x.fecha));
    let texto;
    if (lista.length > 1) {
      const que = listaNatural(lista.map((x) => NOMBRES[x.tipo] || x.etiqueta.toLowerCase()));
      texto = p.motivo ? `Escena ${p.toma}: ${fraseArreglo(p.motivo, 'imagen')} (${que}).` : `Escena ${p.toma}: ${que} salieron con un defecto; se repitieron solos.`;
    } else {
      const veces = p.arreglos.length > 1 ? ` (${p.arreglos.length} veces)` : '';
      texto = `${quien(p)}: ${fraseArreglo(p.motivo, p.clase)}${veces}.`;
    }
    r.push({ estado: p.estado, texto, fecha, pieza: p.id });
  }
  // lo que regeneraste tú (o donde pusiste tu video, o volviste al clip original). Las piezas de una misma escena
  // que se hicieron juntas (p. ej. las dos imágenes de una escena de inicio y final, y su clip) van en una línea que
  // las nombra a todas: regenerar una imagen también rehace la otra.
  const pedidas = new Map();
  for (const p of modelo.piezas) {
    if (p.motivo !== 'pedido') continue;
    const clave = p.toma && !p.broll && NOMBRES[p.tipo] ? `toma-${p.toma}|${p.modoPedido || ''}` : p.id;
    if (!pedidas.has(clave)) pedidas.set(clave, []);
    pedidas.get(clave).push(p);
  }
  for (const lista of pedidas.values()) {
    const p = lista[0];
    const fecha = maxFecha(lista.map((x) => x.fecha || x.arreglos[x.arreglos.length - 1]?.fecha));
    const texto =
      lista.length > 1
        ? `Escena ${p.toma}: ${fraseArreglo('pedido', 'imagen', { modo: p.modoPedido, masculina: false })} (${listaNatural(lista.map((x) => NOMBRES[x.tipo]))}).`
        : `${quien(p)}: ${fraseArreglo('pedido', p.clase, { modo: p.modoPedido, masculina: esMasculina(p) })}.`;
    r.push({ estado: 'listo', texto, fecha, pieza: p.id });
  }
  // lo que notó la revisión (la app no lo rehizo: tú decides)
  for (const p of piezasConAviso(modelo)) {
    const fecha = maxFecha(p.avisos.map((x) => x.fecha)) || p.fecha;
    r.push({ estado: 'aviso', texto: `${quien(p)}: la revisión notó algo. ${textoDeAvisos(p)}`, fecha, pieza: p.id });
  }
  for (const v of a.versiones || []) {
    if (v.clase !== 'video') continue;
    r.push({ estado: 'listo', texto: `Versión «${v.nombre}» lista.`, fecha: v.fecha, destacado: v.principal });
  }
  const vistas = new Set();
  return r
    .filter((x) => x.fecha && !vistas.has(`${x.pieza || ''}|${x.texto}|${x.fecha}`) && vistas.add(`${x.pieza || ''}|${x.texto}|${x.fecha}`))
    .sort((x, y) => Date.parse(y.fecha) - Date.parse(x.fecha));
}

/**
 * "Escena 9" · "Imagen de apoyo 3" · "Hoja de mujer" · "Paso 2 (a la escena 3)": los mismos nombres que la entrega
 * (lib/avisos.js nombreDeLaPieza). Lo que va entre paréntesis al final se puede sacar (`.replace(/ \(.*\)$/, '')`).
 */
export function quien(p) {
  if (p.tipo === 'hoja') return p.clave === 'producto' ? 'Foto de tu producto' : `Hoja de ${String(p.nombre)}`;
  if (p.tipo === 'icono') return p.titulo;
  if (p.tipo === 'gancho') return String(p.nombre);
  if (p.tipo === 'paso') return `Paso ${p.toma} (a la escena ${p.hacia})`;
  if (p.broll) return `Imagen de apoyo ${p.broll}${p.clase === 'imagen' ? ' (imagen)' : ''}`;
  const que = { inicial: ' (imagen de inicio)', final: ' (imagen final)', clip: '' }[p.tipo] || '';
  return `Escena ${p.toma}${que}`;
}

/** Las piezas del modelo con algo que notó la revisión, en el orden de la pantalla. */
export function piezasConAviso(modelo) {
  return piezasEnOrden(modelo).filter((p) => p.avisos?.length);
}

/** Lo que notó la revisión en una pieza, en un solo texto (cada aviso con su punto). */
export function textoDeAvisos(p) {
  const textos = [...new Set((p?.avisos || []).map((x) => String(x.texto || '').trim()).filter(Boolean))];
  return textos.map((t) => (/[.!?…][»")]*$/.test(t) ? t : `${t}.`)).join(' ');
}

/** Imagen para la miniatura de una pieza (achicada). Los clips usan un cuadro del medio. */
export function miniaturaDe(p, ancho = 240) {
  if (p.clase === 'imagen') return p.imagen ? miniatura(p.imagen, ancho) : null;
  if (!p.video) return null;
  const t = Math.max(0.4, Math.min(3, (p.duracion || 4) * 0.4));
  return miniatura(p.video, ancho, { segundo: Math.round(t * 10) / 10 });
}

/** Comparar lo que dice el guion con lo que se oyó, palabra por palabra. */
const normal = (w) =>
  w
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]/g, '');

export function compararTextos(guion, oido) {
  const a = String(guion || '').split(/\s+/).filter(Boolean);
  const b = String(oido || '').split(/\s+/).filter(Boolean);
  const na = a.map(normal);
  const nb = b.map(normal);
  // LCS clásico (las frases son cortas)
  const dp = Array.from({ length: na.length + 1 }, () => new Array(nb.length + 1).fill(0));
  for (let i = na.length - 1; i >= 0; i--)
    for (let j = nb.length - 1; j >= 0; j--) dp[i][j] = na[i] && na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const marcas = new Array(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < na.length && j < nb.length) {
    if (na[i] && na[i] === nb[j]) {
      marcas[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const iguales = marcas.filter(Boolean).length;
  const parecido = Math.max(na.filter(Boolean).length, nb.filter(Boolean).length) ? iguales / Math.max(na.filter(Boolean).length, nb.filter(Boolean).length) : 1;
  return { palabras: b.map((w, k) => ({ w, igual: marcas[k] || !nb[k] })), parecido };
}
