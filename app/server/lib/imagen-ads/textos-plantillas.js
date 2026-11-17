// Los TEXTOS de cada plantilla, sin esperar a la IA de texto: salen de lo que la app ya tiene (los ganchos validados
// de la investigación con TrendTrack, la ficha del producto y la investigación de mercado), con reglas fijas por formato.
// Nunca inventa afirmaciones médicas ni números: un número solo aparece si está en la ficha (los mg de la etiqueta, los
// meses de uso). Todo se puede corregir después en la pantalla del lote (se vuelve a dibujar en 1-2 s, sin costo).
//
//   contextoDelLote(carpeta, brief)          lo que se sabe del producto, ya limpio
//   textosPara(id, ctx, k)                   los textos de la plantilla `id` (k: la cuántas de esa plantilla en el lote,
//                                            para no repetir el mismo titular)
//   limpiarTextos(id, textos)                lo que llega de la pantalla, validado contra los campos de la plantilla
import path from 'node:path';
import { leerJSON } from '../archivos.js';
import { leerFicha } from '../productos.js';
import { estado as estadoInvestigacion } from '../investigacion.js';
import { titularesDelLote } from './rapido.js';
import { POR_ID } from './catalogo-plantillas.js';
import { ganchosValidados } from '../competencia.js';

const limpio = (t, max = 400) =>
  String(t ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^["«“'\s]+|["»”'\s]+$/g, '')
    .trim()
    .slice(0, max);
const palabras = (t) => limpio(t).split(' ').filter(Boolean).length;
const sinPunto = (t) => limpio(t).replace(/[.;:,]+$/, '');
const mayusInicial = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const unicos = (lista) => {
  const vistos = new Set();
  return lista.filter((x) => {
    const k = String(x || '').toLowerCase();
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
};

/** «200 mg de aguaje (fruto, en polvo), 400 mg de fenogreco…» -> [{ nombre: 'Aguaje', valor: '200 mg' }, …]. */
export function ingredientesDe(texto) {
  const t = String(texto || '').replace(/\([^)]*\)/g, ' ');
  const salida = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|ml|ui|iu|%)\s+de\s+([a-záéíóúñü][a-záéíóúñü\s-]{2,30}?)(?=\s*(?:,|;|\.|\by\b|\be\b|\+|$))/gi;
  for (const m of t.matchAll(re)) if (!/\b(cada|una|total|neto|porci[oó]n|contenido)\b/i.test(m[3])) salida.push({ nombre: mayusInicial(limpio(m[3]).replace(/\s+(en|de)$/i, '')), valor: `${m[1].replace('.', ',')} ${m[2].toLowerCase()}` });
  if (salida.length) return unicos(salida.map((x) => JSON.stringify(x))).map((x) => JSON.parse(x));
  // sin cantidades: «a base de aguaje, fenogreco y maca negra»
  const base = /a base de ([^.]+)/i.exec(String(texto || ''));
  const lista = (base ? base[1] : String(texto || ''))
    .split(/,|;|\sy\s|\se\s|\+/)
    .map((x) => limpio(x).replace(/^(de|con|el|la|los|las)\s+/i, ''))
    .filter((x) => x && x.length <= 28 && palabras(x) <= 3 && !/\d|según|etiqueta|cápsula|frasco|contenido/i.test(x));
  return unicos(lista).slice(0, 6).map((n) => ({ nombre: mayusInicial(n), valor: null }));
}

/** La línea de tiempo prometida: «3 meses» -> Mes 1/2/3; «4 semanas» -> Semana 1/2/4; sin nada, la neutra Día 1/7/14. */
export function etapasDe(...textos) {
  const t = textos.map((x) => String(x || '')).join(' ').toLowerCase();
  const meses = /(\d+)\s*mes(es)?/.exec(t);
  if (meses) {
    const n = Math.min(4, Math.max(2, Number(meses[1])));
    return Array.from({ length: n }, (_, i) => `Mes ${i + 1}`);
  }
  const semanas = /(\d+)\s*semanas?/.exec(t);
  if (semanas) {
    const n = Number(semanas[1]);
    if (n >= 6) return ['Semana 1', 'Semana 3', `Semana ${n}`];
    if (n >= 3) return ['Semana 1', 'Semana 2', `Semana ${n}`];
  }
  return ['Día 1', 'Día 7', 'Día 14'];
}

/** Lo de la investigación de mercado que sirve para los textos (los dos formatos de investigación). */
function deLaInvestigacion(productoId) {
  const vacio = { dolores: [], objeciones: [], citas: [], deseo: '', titulos: [] };
  if (!productoId) return vacio;
  let inv = null;
  try {
    inv = estadoInvestigacion(productoId)?.investigacion || null;
  } catch {
    inv = null;
  }
  if (!inv) return vacio;
  if (inv.formato === 'documento') {
    const bloques = (inv.secciones || []).flatMap((s) => s.bloques || []);
    const objeciones = [];
    let enObjeciones = false;
    for (const b of bloques) {
      if (b?.tipo === 'subtitulo') enObjeciones = /objeci|dudas|puntos débiles/i.test(b.texto || '');
      else if (enObjeciones && b?.tipo === 'vinetas') objeciones.push(...(b.items || []).map((x) => limpio(String(x).split(/[»"]/)[0], 160)));
    }
    return {
      dolores: (inv.claves?.puntos_dolor || []).map((x) => limpio(x, 140)).filter(Boolean),
      objeciones: objeciones.filter((x) => x.includes('?')),
      citas: bloques.filter((b) => b?.tipo === 'cita' && b.texto).map((b) => ({ texto: limpio(b.texto, 240), estilo: b.estilo || '' })),
      deseo: limpio(inv.claves?.deseo_central, 200),
      titulos: [],
    };
  }
  return {
    dolores: (inv.puntos_dolor || []).map((d) => limpio(d?.dolor, 140)).filter(Boolean),
    objeciones: (inv.estrategia?.objeciones || []).map((o) => limpio(o?.objecion, 160)).filter((x) => x.includes('?')),
    citas: [],
    deseo: limpio(inv.deseo_central?.frase, 200),
    titulos: (inv.titulos || []).map((x) => limpio(x?.titulo, 90)).filter(Boolean),
  };
}

/** El dolor de la ficha («Siente que el glúteo se le ve plano…») dicho por la clienta («Siento que el glúteo se me ve plano»). */
export function enPrimeraPersona(t) {
  return limpio(t)
    .replace(/^siente\b/i, 'Siento')
    .replace(/^tiene\b/i, 'Tengo')
    .replace(/^no tiene\b/i, 'No tengo')
    .replace(/^quiere\b/i, 'Quiero')
    .replace(/^le\b/i, 'Me')
    .replace(/^no (llena|queda|sirve|funciona|gusta|alcanza|luce)\b/i, 'No me $1')
    .replace(/^(las|los) /i, 'Mis ')
    .replace(/^(el|la) (?=[a-záéíóúñ]+ no\b)/i, 'Mi ')
    .replace(/\bse le\b/gi, 'se me')
    .replace(/\bque no llena\b/gi, 'no me llena')
    .replace(/\bno tiene\b/gi, 'no tengo')
    .replace(/\bno le\b/gi, 'no me')
    .replace(/\bsus\b/gi, 'mis')
    .replace(/\bsu\b/gi, 'mi');
}

/** El dolor de la ficha partido en frases cortas, en primera persona. */
function doloresDeLaFicha(dolor) {
  return String(dolor || '')
    .split(/\.\s+|;\s+|,\s+que\s+|\s+y\s+que\s+/i)
    .map((x) => sinPunto(enPrimeraPersona(x)))
    .filter((x) => x && palabras(x) >= 3)
    .map(mayusInicial);
}

/** Lo que se sabe del producto para escribir los textos (una vez por lote). */
export function contextoDelLote(carpeta, brief) {
  const ficha = (brief?.productoId ? leerFicha(brief.productoId) : null) || leerJSON(path.join(carpeta, 'entrada', 'ficha-producto.json')) || {};
  const nombre = limpio(brief?.datos?.nombre || ficha.nombre || 'Tu producto', 60);
  const inv = deLaInvestigacion(brief?.productoId);
  const ingredientes = ingredientesDe(ficha.ingredientes || ficha.queEs);
  let hooks = [];
  try {
    hooks = titularesDelLote(carpeta, brief, 30).map((x) => x.titulo);
  } catch {
    hooks = [];
  }
  let validados = [];
  if (brief?.ganchos) validados = (leerJSON(path.join(carpeta, brief.ganchos))?.ganchos || []).map((g) => limpio(g.gancho, 120));
  else if (brief?.productoId) {
    try {
      validados = ganchosValidados(brief.productoId).map((g) => limpio(g.gancho, 120));
    } catch {
      validados = [];
    }
  }
  const ganchos = unicos([...validados, ...inv.titulos]).filter(Boolean);
  const beneficios = unicos((Array.isArray(ficha.beneficios) ? ficha.beneficios : []).map((b) => sinPunto(limpio(b, 90)))).filter(Boolean);
  const dolores = unicos([...inv.dolores, ...doloresDeLaFicha(ficha.dolor)].map((x) => sinPunto(x))).filter(Boolean);
  const suplemento = /suplement|cápsul|capsul|gotas|vitamin/i.test(`${ficha.queEs || ''} ${ficha.tipo || ''} ${nombre}`);
  return {
    nombre,
    // la marca: la primera palabra en mayúsculas del nombre («VITALABH Aguaje Complex» -> VITALABH), o el nombre
    marca: (/^([A-ZÁÉÍÓÚÑ0-9]{3,})\b/.exec(nombre) || [])[1] || nombre.split(' ').slice(0, 2).join(' '),
    queEs: limpio(ficha.queEs, 220),
    publico: limpio(brief?.datos?.publico || ficha.publico, 220),
    beneficios,
    ingredientes,
    dolores,
    dolor: limpio(ficha.dolor, 300),
    probo: sinPunto(limpio(ficha.probo, 80)),
    comoSeUsa: limpio(ficha.comoSeUsa, 220),
    oferta: limpio(ficha.oferta, 200),
    precio: limpio([brief?.datos?.precio, brief?.datos?.moneda].filter(Boolean).join(' '), 40),
    cta: limpio(brief?.datos?.cta, 60),
    ganchos,
    hooks,
    objeciones: inv.objeciones,
    citas: inv.citas,
    deseo: inv.deseo,
    etapas: etapasDe(ficha.comoSeUsa, ficha.oferta, brief?.datos?.adicional),
    legal: suplemento ? 'Suplemento alimenticio. No es un medicamento. Resultados individuales.' : '',
  };
}

/** «VITALABH Aguaje Complex 3 en 1» -> «Aguaje Complex» (sin la marca en mayúsculas ni el «3 en 1»). */
export function nombreCorto(nombre) {
  let p = limpio(nombre).split(' ');
  if (p.length > 1 && /^[A-ZÁÉÍÓÚÑ0-9]{3,}$/.test(p[0])) p = p.slice(1);
  const i = p.findIndex((x) => /\d/.test(x));
  if (i > 0) p = p.slice(0, i);
  return p.slice(0, 3).join(' ') || limpio(nombre);
}
const enLista = (lista) => lista.map((x, i) => (i ? x.replace(/^[A-ZÁÉÍÓÚ](?![A-ZÁÉÍÓÚ])/, (c) => c.toLowerCase()) : x)).join(', ');

const elegir = (lista, k, filtro = () => true) => {
  const l = lista.filter(filtro);
  return l.length ? l[k % l.length] : '';
};
const corto = (t) => palabras(t) <= 9;

/** Un titular corto para las plantillas de titular grande (de 2 a 9 palabras), sin oferta en las de dolor. */
function titularDe(ctx, k, { dolor = false } = {}) {
  const sinOferta = (t) => !/\$|%|descuento|gratis|oferta|precio|2x1|envío/i.test(t);
  const candidatos = [...ctx.ganchos, ...ctx.hooks, ...ctx.beneficios].filter((t) => corto(t) && palabras(t) >= 2 && (!dolor || sinOferta(t)));
  return elegir(candidatos, k) || elegir([...ctx.ganchos, ...ctx.hooks, ...ctx.beneficios], k) || ctx.nombre;
}

// ---------------------------------------------------------------- las fórmulas de los ganadores
// (referencia interna: .claude/skills/anuncios-imagen-ads/referencias-ganadoras.md; nunca se muestra ni se copia)

/** «Día 1 · Día 7 · Día 14» -> «en 14 días»; «Semana 1/3/6» -> «en 6 semanas»; o '' si no hay plazo. */
export function plazoDe(etapas = []) {
  const u = String(etapas[etapas.length - 1] || '');
  const n = (/(\d+)/.exec(u) || [])[1];
  if (!n || n === '1') return '';
  return /semana/i.test(u) ? `en ${n} semanas` : /mes/i.test(u) ? `en ${n} meses` : `en ${n} días`;
}

/** Línea de tiempo: «resultado + plazo» («Piernas más ligeras en 20 días»), con un beneficio corto de la ficha. */
function resultadoConPlazo(ctx, k) {
  const plazo = plazoDe(ctx.etapas);
  const res = elegir(ctx.beneficios.filter((x) => palabras(x) >= 2 && palabras(x) <= 5 && !/\d/.test(x)), k);
  return plazo && res ? `${res.replace(/[.!]+$/, '')} ${plazo}` : '';
}

/** Pizarra: «¿Tomas diuréticos? Prueba esto.» con lo que ya probó la clienta. */
const objecionVsEsto = (probo) => (probo ? `¿${probo.replace(/[¿?.]+/g, '').trim()}? Prueba esto.` : '');

/** El dolor de la ficha («Siente que la piel se le ve apagada») como pregunta a la clienta («¿Sientes que la piel se te ve apagada?»). */
export function comoPregunta(t) {
  const x = sinPunto(limpio(t))
    .replace(/^siente\b/i, 'Sientes')
    .replace(/^tiene\b/i, 'Tienes')
    .replace(/^no tiene\b/i, 'No tienes')
    .replace(/^quiere\b/i, 'Quieres')
    .replace(/^le\b/i, 'Te')
    .replace(/\bse le\b/gi, 'se te')
    .replace(/\bno le\b/gi, 'no te')
    .replace(/\bsus\b/gi, 'tus')
    .replace(/\bsu\b/gi, 'tu');
  return x ? `¿${x.replace(/^[¿]+|[?]+$/g, '')}?` : '';
}

/** La primera frase del dolor de la ficha (antes de la coma o del «y que»). */
const primerDolor = (dolor) => String(dolor || '').split(/\.\s+|;\s+|,\s+(?:que\s+)?|\s+y\s+que\s+/i)[0] || '';
const minus = (t) => String(t || '').replace(/^[A-ZÁÉÍÓÚ](?![A-ZÁÉÍÓÚ])/, (c) => c.toLowerCase());
const mayus = (t) => String(t || '').replace(/^./, (c) => c.toUpperCase());
/** Los beneficios cortos (para rótulos e íconos). */
const cortos = (b, n, max = 4) => {
  const l = b.filter((x) => palabras(x) <= max);
  return (l.length >= n ? l : b).slice(0, n);
};
/** ¿Es temporada de regalos? (noviembre y diciembre): el titular de temporada de los ganadores. */
const enNavidad = (fecha = new Date()) => fecha.getMonth() >= 10;
/** «a, b y c». */
const conY = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0] || '');

/** El primer beneficio que no dice lo mismo que el titular. */
const beneficio = (ctx, k = 0) => elegir(ctx.beneficios, k) || ctx.queEs || ctx.nombre;

/** Los textos de la plantilla `id` para la k-ésima vez que aparece en el lote. */
export function textosPara(id, ctx, k = 0) {
  const legal = ctx.legal;
  const b = ctx.beneficios;
  switch (id) {
    case 'antes-despues':
      return { titular: titularDe(ctx, k, { dolor: true }), antes: 'Antes', despues: 'Después', legal: legal || 'Resultados individuales.' };
    case 'linea-tiempo':
      // como los ganadores: el resultado con su plazo («Curvas más definidas en 21 días»)
      return { titular: (k % 2 === 0 && resultadoConPlazo(ctx, k)) || titularDe(ctx, k + 1, { dolor: true }), etapas: ctx.etapas, legal: legal || 'Resultados individuales.' };
    case 'pizarra':
      return {
        titular: objecionVsEsto(ctx.probo) || titularDe(ctx, k, { dolor: true }),
        antes: ctx.probo || 'Lo de siempre',
        despues: nombreCorto(ctx.nombre),
        puntos: b.slice(0, 4).length ? b.slice(0, 4) : ctx.dolores.slice(0, 4),
        legal,
      };
    case 'mapa-cuerpo':
      return {
        titular: k % 2 === 0 ? 'La diferencia se nota' : titularDe(ctx, k + 2, { dolor: true }),
        sin: 'Antes',
        con: 'Después',
        izquierda: ctx.dolores.filter((x) => palabras(x) <= 6).slice(0, 3).length ? ctx.dolores.filter((x) => palabras(x) <= 6).slice(0, 3) : ctx.dolores.slice(0, 3),
        derecha: b.filter((x) => palabras(x) <= 5).slice(0, 3).length ? b.filter((x) => palabras(x) <= 5).slice(0, 3) : b.slice(0, 3),
        legal: legal || 'Ilustración.',
      };
    case 'producto-flechas': {
      const ing = ctx.ingredientes.slice(0, 4);
      const flechas = ing.map((x, i) => ({ ingrediente: x.nombre, beneficio: b[i] || '' }));
      // con menos de 4 ingredientes, las flechas que faltan llevan solo un beneficio
      for (const x of b.slice(flechas.length, 4)) if (flechas.length < 4) flechas.push({ ingrediente: '', beneficio: x });
      return { titular: titularDe(ctx, k), flechas, legal };
    }
    case 'lista-iconos':
      return { titular: k % 2 ? `Por qué eligen ${nombreCorto(ctx.nombre)}` : titularDe(ctx, k), beneficios: b.slice(0, 6), legal };
    case 'barra-datos': {
      const conValor = ctx.ingredientes.filter((x) => x.valor).slice(0, 3);
      const datos = conValor.length >= 2 ? conValor.map((x) => ({ valor: x.valor, etiqueta: x.nombre.toLowerCase() })) : b.slice(0, 3).map((x) => ({ valor: x.split(' ').slice(0, 2).join(' '), etiqueta: x.split(' ').slice(2).join(' ') || ' ' }));
      return { titular: titularDe(ctx, k + 1), datos, legal: conValor.length >= 2 ? `${legal ? `${legal} ` : ''}Según la etiqueta.`.trim() : legal };
    }
    case 'mecanismo':
      return { titular: 'Así funciona', problema: elegir(ctx.dolores, k) || ctx.dolor, resultado: beneficio(ctx, k), nota: ctx.ingredientes.length >= 2 ? `${ctx.ingredientes.length} ingredientes` : '', legal };
    case 'nota-texto':
      return {
        titulo: elegir(ctx.ganchos.filter((x) => palabras(x) >= 4), k) || titularDe(ctx, k),
        texto: [elegir(ctx.dolores, k) ? `${elegir(ctx.dolores, k)}.` : '', ctx.queEs ? `${ctx.nombre}: ${ctx.queEs.replace(/^[A-ZÁÉÍÓÚ](?![A-ZÁÉÍÓÚ])/, (c) => c.toLowerCase())}` : '', b.length ? `${enLista(b.slice(0, 3))}.` : ''].filter(Boolean).join('\n\n'),
        legal,
      };
    case 'burbujas':
      return {
        contacto: nombreCorto(ctx.nombre),
        problemas: ctx.dolores.slice((k * 3) % Math.max(1, ctx.dolores.length), ((k * 3) % Math.max(1, ctx.dolores.length)) + 3).concat(ctx.dolores).slice(0, 3),
        consejo: `Prueba ${nombreCorto(ctx.nombre)}: ${enLista(b.slice(0, 2)).replace(/^[A-ZÁÉÍÓÚ](?![A-ZÁÉÍÓÚ])/, (c) => c.toLowerCase()) || ctx.queEs}.`,
        legal,
      };
    case 'foto-tiktok': {
      const t = elegir(ctx.ganchos.length ? ctx.ganchos : ctx.hooks, k) || titularDe(ctx, k);
      // en 2 o 3 renglones cortos, como los subtítulos de TikTok
      const p = t.split(' ');
      const n = p.length <= 5 ? 1 : p.length <= 10 ? 2 : 3;
      const tam = Math.ceil(p.length / n);
      return { lineas: Array.from({ length: n }, (_, i) => p.slice(i * tam, (i + 1) * tam).join(' ')).filter(Boolean), legal: '' };
    }
    case 'resena-tuit': {
      // sin una reseña real en la investigación, la escribe la marca (nunca una clienta inventada)
      const tit = titularDe(ctx, k);
      return { nombre: ctx.marca, usuario: `@${ctx.marca.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '')}`, texto: [tit, enLista(b.filter((x) => x !== tit).slice(0, 3))].filter(Boolean).join('.\n\n') + '.', estrellas: 0, iconos: b.filter((x) => palabras(x) <= 4).slice(0, 3).length >= 3 ? b.filter((x) => palabras(x) <= 4).slice(0, 3) : b.slice(0, 3).map((x) => x.split(' ').slice(0, 3).join(' ')), legal };
    }
    case 'comentario':
      return {
        nombre: 'Clienta',
        comentario: elegir(ctx.objeciones, k) || (ctx.probo ? `¿Sirve si ya probé ${ctx.probo.toLowerCase()}?` : `¿Cómo se usa ${ctx.nombre}?`),
        marca: ctx.marca,
        respuesta: [ctx.queEs, ctx.comoSeUsa.split('.')[0]].filter(Boolean).join(' ').slice(0, 200) || b.slice(0, 2).join('. '),
        legal,
      };
    case 'silueta-zonas': {
      // «Bye bye / GLÚTEOS PLANOS» de los ganadores: la frase a mano arriba y el resultado enorme; las zonas, a los lados
      const titular = elegir(b.filter((x) => palabras(x) >= 2 && palabras(x) <= 4), k) || titularDe(ctx, k, { dolor: true });
      const zonas = cortos(b.filter((x) => x !== titular), 4, 3);
      return { arriba: 'Por fin', titular, izquierda: zonas.slice(0, 3).map((x) => `+ ${x}`), derecha: zonas.slice(3, 4), legal: legal || 'Ilustración.' };
    }
    case 'solo-vs-con': {
      const nc = nombreCorto(ctx.nombre);
      const probo = ctx.probo && palabras(ctx.probo) <= 4 ? ctx.probo : '';
      const ing = ctx.ingredientes.map((x) => x.nombre.toLowerCase()).slice(0, 3);
      return {
        sin: probo ? `Solo ${minus(probo)}` : 'Sin ayuda',
        con: probo && `${probo} + ${nc}`.length <= 40 ? `${mayus(probo)} + ${nc}` : `Con ${nc}`,
        titular: probo ? `Tu cuerpo necesita más que ${minus(probo)}.` : titularDe(ctx, k, { dolor: true }),
        subtitulo: ing.length >= 2 ? `${beneficio(ctx, k)} con ${conY(ing)}.` : `${beneficio(ctx, k)}.`,
        boton: `Prueba ${nc}`,
        legal: legal || 'Ilustración.',
      };
    }
    case 'nosotros-vs-ellos': {
      const conValor = ctx.ingredientes.filter((x) => x.valor).slice(0, 3).map((x) => `${x.valor} de ${x.nombre.toLowerCase()}`);
      const titular = titularDe(ctx, k + 1, { dolor: true });
      return {
        titular,
        subtitulo: elegir(b.filter((x) => x !== titular), k) || ctx.queEs,
        nuestro: nombreCorto(ctx.nombre),
        ellos: ctx.probo && palabras(ctx.probo) <= 4 ? mayus(ctx.probo) : 'Lo de siempre',
        nuestros: conValor.length >= 2 ? conValor : cortos(b, 3, 5),
        suyos: ['No ataca la causa', 'Difícil de mantener', 'Resultados que no se ven'],
        legal,
      };
    }
    case 'no-compres':
      // psicología inversa (los ganadores): «No compres esto si… a menos que quieras…»
      return {
        titular: ctx.probo ? `No compres esto si ya probaste ${minus(ctx.probo)}…` : 'No compres esto si ya te rendiste…',
        texto: `…a menos que quieras ${conY(cortos(b, 3, 5).map(minus))}.`,
        legal: legal || 'Resultados individuales.',
      };
    case 'pregunta-revelacion':
      return {
        pregunta: comoPregunta(primerDolor(ctx.dolor)) || elegir(ctx.objeciones, k) || titularDe(ctx, k, { dolor: true }),
        revelacion: '¡No es tu *culpa*!',
        cierre: `${nombreCorto(ctx.nombre)}: ${minus(beneficio(ctx, k))}`,
        legal,
      };
    case 'historia': {
      const dolor = sinPunto(enPrimeraPersona(primerDolor(ctx.dolor))) || elegir(ctx.dolores, k);
      return { antes: 'Antes', despues: 'Después', frase: dolor ? `Siempre decía: «${dolor}»` : titularDe(ctx, k, { dolor: true }), remate: `Hasta que descubrí *${ctx.marca}*`, iconos: cortos(b, 3, 4), legal: legal || 'Resultados individuales.' };
    }
    case 'zonas-semanas': {
      const etapas = (ctx.etapas || []).slice(0, 3);
      // la primera etapa es el comienzo; los resultados de la ficha, en las siguientes (nunca un número inventado)
      const res = [`Empiezas a tomar ${nombreCorto(ctx.nombre)}`, ...cortos(b, 2, 6)];
      return { titular: (k % 2 === 0 && resultadoConPlazo(ctx, k)) || titularDe(ctx, k, { dolor: true }), pasos: etapas.map((e, i) => ({ ingrediente: e, beneficio: res[i] || '' })).filter((x) => x.beneficio), legal: legal || 'Ilustración. Resultados individuales.' };
    }
    case 'foto-iconos':
      return {
        titular: k % 2 === 1 && enNavidad() ? `Esta Navidad regálate *${minus(beneficio(ctx, k))}*` : titularDe(ctx, k + 3, { dolor: true }),
        iconos: cortos(b, 3, 4),
        nota: 'Tu mejor versión',
        legal,
      };
    case 'foto-titular':
      return { titular: titularDe(ctx, k + 1, { dolor: true }), nota: '', legal };
    case 'sticker-oferta':
      return { titular: titularDe(ctx, k + 2), sticker: ctx.precio || (/\b\d+\s*frascos?\b/i.exec(ctx.oferta)?.[0] ?? 'Nuevo'), franja: ctx.cta || 'Pídelo hoy', legal };
    case 'casi-agotado':
      return { titular: '*Casi* agotado', estado: 'Quedan pocas unidades', franja: ctx.cta || 'Pide el tuyo hoy', legal };
    case 'buena-mala':
      return { buena: beneficio(ctx, k), mala: 'Se está agotando', franja: ctx.cta || 'Pídelo hoy', legal };
    default:
      return { titular: titularDe(ctx, k), legal };
  }
}

/** Renglones cortos de subtítulo (2 o 3) a partir de una frase. */
function renglones(t) {
  const p = limpio(t).split(' ').filter(Boolean);
  const n = p.length <= 5 ? 1 : p.length <= 10 ? 2 : 3;
  const tam = Math.ceil(p.length / n);
  return Array.from({ length: n }, (_, i) => p.slice(i * tam, (i + 1) * tam).join(' ')).filter(Boolean);
}

/**
 * «De un video, imágenes»: los textos de un cuadro según su ÁNGULO (sin la IA): dolor y objeción con las palabras del
 * cliente, prueba social con los ganchos validados, mecanismo e ingrediente con la ficha, estatus con el deseo.
 */
export function textosPorAngulo(angulo, plantilla, ctx, k = 0) {
  const base = textosPara(plantilla, ctx, k);
  const ing = ctx.ingredientes.map((x) => x.nombre.toLowerCase());
  const conIng = ing.length ? `Con ${ing.length > 1 ? `${ing.slice(0, -1).join(', ')} y ${ing[ing.length - 1]}` : ing[0]}` : '';
  const frase = {
    dolor: elegir(ctx.dolores, k),
    objecion: elegir(ctx.objeciones, k) || (ctx.probo ? `¿Ya probaste ${ctx.probo.toLowerCase()}?` : ''),
    'prueba-social': elegir(ctx.ganchos, k) || elegir(ctx.hooks, k),
    mecanismo: 'Así funciona',
    ingrediente: conIng && palabras(conIng) <= 8 ? conIng : beneficio(ctx, k),
    estatus: ctx.deseo && palabras(ctx.deseo) <= 9 ? ctx.deseo : beneficio(ctx, k + 1),
    producto: `${nombreCorto(ctx.nombre)}: ${beneficio(ctx, k).replace(/^[A-ZÁÉÍÓÚ](?![A-ZÁÉÍÓÚ])/, (c) => c.toLowerCase())}`,
  }[angulo];
  if (!frase) return base;
  if (plantilla === 'foto-tiktok') return { ...base, lineas: renglones(frase) };
  if (plantilla === 'foto-titular') return { ...base, titular: frase, nota: angulo === 'mecanismo' ? beneficio(ctx, k) : '' };
  return base;
}

const recortar = (t, max) => limpio(t, 2000).slice(0, max);

/** Lo que llega de la pantalla, solo con los campos de la plantilla y sus topes. */
export function limpiarTextos(id, textos) {
  const p = POR_ID.get(id);
  if (!p || !textos || typeof textos !== 'object') return null;
  const salida = {};
  for (const c of p.campos) {
    const v = textos[c.clave];
    if (v === undefined) continue;
    if (c.tipo === 'lista') salida[c.clave] = (Array.isArray(v) ? v : String(v).split('\n')).map((x) => recortar(x, c.max)).filter(Boolean).slice(0, c.cuantos || 6);
    else if (c.tipo === 'pares') salida[c.clave] = (Array.isArray(v) ? v : []).slice(0, c.cuantos || 4).map((x) => ({ ingrediente: recortar(x?.ingrediente, 30), beneficio: recortar(x?.beneficio, c.max) })).filter((x) => x.ingrediente || x.beneficio);
    else if (c.tipo === 'datos') salida[c.clave] = (Array.isArray(v) ? v : []).slice(0, c.cuantos || 3).map((x) => ({ valor: recortar(x?.valor, 14), etiqueta: recortar(x?.etiqueta, c.max) })).filter((x) => x.valor || x.etiqueta);
    else if (c.tipo === 'numero') salida[c.clave] = Math.max(0, Math.min(c.max || 5, Math.round(Number(v) || 0)));
    else if (c.tipo === 'parrafo') salida[c.clave] = String(v ?? '').replace(/\r/g, '').slice(0, c.max).trim();
    else salida[c.clave] = recortar(v, c.max);
  }
  return salida;
}
