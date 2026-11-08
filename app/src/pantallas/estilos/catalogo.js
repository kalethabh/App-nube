// Lo que la app cuenta de cada estilo, más allá de lo que trae /api/estilos (nombre, lema, familia, muestra).
// Lo usan dos pantallas: Estilos (#/estilos) y Nuevo anuncio (#/nuevo).
//
// Aquí no hay precios: el costo real de un anuncio solo se muestra en el informe de la Entrega,
// cuando el anuncio ya está hecho.
import {
  Atom,
  Bone,
  BookAudio,
  Infinity as Infinito,
  LampDesk,
  MessageCircle,
  MessagesSquare,
  Mic,
  MicVocal,
  Music,
  Podcast,
  Shapes,
  Smartphone,
  Spool,
  Sparkles,
  ToyBrick,
} from 'lucide-react';

export const ICONO_FAMILIA = {
  'voz-en-off': Mic,
  hablado: MessagesSquare,
  cantado: Music,
  efecto: Infinito,
};

/** Un icono propio por estilo: así se reconoce cada uno sin mostrar a nadie de otro anuncio. */
export const ICONO_ESTILO = {
  claymation: Shapes,
  crochet: Spool,
  'zack-d-films': Atom,
  'estilo-pixar': LampDesk,
  skeleton: Bone,
  'estilo-lego': ToyBrick,
  ugc: Smartphone,
  'talking-object-pixar': MessageCircle,
  podcast: Podcast,
  entrevista: MicVocal,
  musical: Music,
  'historias-musicales': BookAudio,
  continuidad: Infinito,
};

export const iconoDe = (clave, familia) => ICONO_ESTILO[clave] || ICONO_FAMILIA[familia] || Sparkles;

/** Los 6 estilos con narrador: son los únicos donde se puede pedir continuidad. */
export const CON_CONTINUIDAD = ['claymation', 'crochet', 'zack-d-films', 'estilo-pixar', 'estilo-lego', 'skeleton'];

/** Los estilos que la app produce de punta a punta (del producto a los MP4, sin terminal): los 12. */
export const DISPONIBLES = ['claymation', 'crochet', 'zack-d-films', 'estilo-pixar', 'skeleton', 'estilo-lego', 'ugc', 'talking-object-pixar', 'podcast', 'entrevista', 'musical', 'historias-musicales'];
export const disponible = (clave) => DISPONIBLES.includes(clave);

/** El efecto continuidad se pide en los 6 estilos con narrador. */
export const CONTINUIDAD_DISPONIBLE = true;

/** Los cantados: el guion es la letra (y en el musical se elige una de 2 o 3). */
export const esCantado = (clave) => clave === 'musical' || clave === 'historias-musicales';

// ---------------------------------------------------------------- las preguntas de cada estilo
//
// Las mismas ids que el servidor (server/lib/anuncios-nuevos.js, AJUSTES). Cada pregunta:
//   opciones     los chips. Con `escrita`, son solo ideas que llenan el cuadro de texto
//   escrita      la respuesta se escribe (persona, ciudad, el llamado a la acción…)
//   escribir     la opción que abre un cuadro de texto ("Lo describo yo"): va como "Lo describo yo: <lo que escribió>"
//   ia           false = sin "Que decida la IA" (la skill no deja decidirlo sola, o tiene uno de siempre)
//   obligatoria  sin respuesta no se escribe el guion (la skill prohíbe inventarlo)
//   porDefecto   la que viene marcada; 'idioma' = el idioma de la ficha
//   nota         { si: '<opción>', texto } un aviso cuando se elige esa opción
//   ayuda        una línea de ayuda debajo de la pregunta; ayudaIA, la que se ve solo con "Que decida la IA" marcado
// El valor en la pantalla es un texto, o null = que decida la IA.

const ANGULOS_MECANISMO = ['Problema oculto y su mecanismo', 'Mito y verdad', 'Una cifra que sorprende', 'Comparación numerada', 'Relato de un descubrimiento'];

const PREGUNTAS = {
  claymation: [{ id: 'angulo', texto: 'Ángulo del anuncio', opciones: ['Problema oculto y su mecanismo', 'Transformación a la vista', 'Un personaje "yo antes"', 'Comparación lado a lado', 'Absurdo con remate'] }],
  crochet: [
    { id: 'angulo', texto: 'Ángulo del anuncio', opciones: ['Problema oculto y su mecanismo', 'Lo que ya probé y no funcionó', 'Anécdota con humor', 'Transformación a la vista', 'Comparación lado a lado'] },
    {
      id: 'personaje',
      texto: 'Personaje principal',
      ayudaIA: 'Con «Que decida la IA», te sugiere uno pensado para tu producto.',
      opciones: ['Lo describo yo', 'Sin personaje fijo'],
      escribir: 'Lo describo yo',
      placeholder: 'Ej.: una abuela de 70 con lentes redondos y delantal',
    },
  ],
  'zack-d-films': [
    { id: 'fondo', texto: 'Fondo de las tomas que explican el mecanismo', opciones: ['Grilla técnica azul', 'Estudio limpio, sin grilla'], ia: false, obligatoria: true },
    { id: 'angulo', texto: 'Ángulo del anuncio', opciones: ANGULOS_MECANISMO },
  ],
  'estilo-pixar': [{ id: 'angulo', texto: 'Ángulo del anuncio', opciones: ANGULOS_MECANISMO }],
  skeleton: [{ id: 'formato', texto: 'Formato', ayudaIA: 'Con «Que decida la IA», va la escalada día a día.', opciones: ['Día a día (la escalada)', 'Reseña con humor'] }],
  'estilo-lego': [{ id: 'estructura', texto: 'Estructura del guion', ayudaIA: 'Con «Que decida la IA», la del estilo: abre con el resultado y cuenta cómo funciona.', opciones: ANGULOS_MECANISMO }],
  'talking-object-pixar': [
    { id: 'quien_habla', texto: 'Quién habla', ayudaIA: 'Con «Que decida la IA», confiesa lo que ya probó tu cliente y no le funcionó.', opciones: ['Lo que ya probó tu cliente', 'Los ingredientes de tu producto', 'Una parte del cuerpo', 'Tu producto'] },
  ],
  ugc: [
    { id: 'tipo', texto: 'Tipo de video', opciones: ['Testimonio', 'Reseña a cámara', 'Rutina', 'Demo', 'Get ready with me', 'Historia personal'] },
    { id: 'ganchos', texto: '¿Hago 2 ganchos más para probar?', ayuda: 'Dos arranques distintos del mismo anuncio, para ver cuál engancha más.', opciones: ['Sí, los 2 ganchos', 'No, solo uno'], ia: false, porDefecto: 'Sí, los 2 ganchos' },
  ],
  podcast: [
    { id: 'hosts', texto: 'Cómo son los anfitriones', opciones: ['Ella y él (ella a la izquierda)', 'Él y ella (él a la izquierda)', 'Dos mujeres', 'Dos hombres'] },
    { id: 'edades', texto: 'Qué edad tienen', opciones: ['De 25 a 35', 'De 35 a 45', 'De 45 a 60'] },
    {
      id: 'modo',
      texto: 'Cómo se ven las imágenes de apoyo',
      opciones: ['Pantalla dividida', 'Anfitrión en la esquina'],
      ia: false,
      porDefecto: 'Pantalla dividida',
      nota: { si: 'Anfitrión en la esquina', texto: 'La esquina tarda más en tu computadora (unos 7 min por cada segundo de anfitrión).' },
    },
  ],
  entrevista: [
    { id: 'persona', texto: 'A quién paran en la calle', escrita: true, ia: false, obligatoria: true, opciones: ['Mujer de 30 a 45', 'Hombre de 25 a 35', 'Mamá con sus hijos', 'Adulto mayor'], placeholder: 'Ej.: mujer de 35, mamá que corre con los niños' },
    { id: 'ciudad', texto: 'Ciudad', escrita: true, ia: false, obligatoria: true, opciones: ['Lima', 'Ciudad de México', 'Bogotá', 'Buenos Aires', 'Miami', 'Madrid'], placeholder: 'Ej.: Lima' },
    { id: 'idioma', texto: 'Idioma del anuncio', opciones: ['Español', 'Inglés', 'Portugués'], ia: false, obligatoria: true, porDefecto: 'idioma' },
    { id: 'cta', texto: 'Llamado a la acción en pantalla', ayuda: 'Va escrito sobre el cierre, con una flecha hacia abajo.', escrita: true, ia: false, obligatoria: true, opciones: ['Pídelo en el botón de abajo', 'Escríbenos por WhatsApp'], placeholder: 'Ej.: Pídelo en el botón de abajo' },
    { id: 'variante', texto: 'Variante', ayuda: 'A: tres preguntas rápidas y su historia sobre imágenes. B: toda la conversación en la calle.', opciones: ['A · Gancho callejero', 'B · Entrevista completa'] },
    { id: 'lado', texto: 'Lado del micrófono', opciones: ['Izquierda', 'Derecha'], ia: false, porDefecto: 'Izquierda' },
    { id: 'brazos', texto: 'Piel de los brazos del entrevistador', ayuda: 'Es lo único que se ve de él.', opciones: ['Clara', 'Trigueña', 'Morena', 'Oscura'] },
    { id: 'pronunciacion', texto: 'Cómo se pronuncia tu marca', ayuda: 'Solo si se puede leer de dos formas.', escrita: true, ia: false, placeholder: 'Ej.: bi-FEM, con acento en la e' },
  ],
  musical: [
    { id: 'visual', texto: 'Estilo visual del video', opciones: ['Crochet', 'Claymation', 'Zack D Films'], ia: false, obligatoria: true },
    { id: 'genero', texto: 'Género musical', ayudaIA: 'Con «Que decida la IA», lo elige según tu público.', opciones: ['Pop', 'Pop latino', 'Reggaetón', 'Bachata', 'Country', 'Hip-hop', 'R&B', 'Otro'], escribir: 'Otro', placeholder: 'Ej.: cumbia' },
    { id: 'canta', texto: 'Quién canta', ayudaIA: 'Con «Que decida la IA», la voz la elige la canción.', opciones: ['Voz femenina', 'Voz masculina'] },
  ],
  'historias-musicales': [
    { id: 'cuenta', texto: 'Quién cuenta la historia', escrita: true, placeholder: 'Ej.: mamá soltera de 32 que trabaja de noche' },
    { id: 'villano', texto: 'Quién la hizo dudar', ayuda: 'Una suegra, un ex, un jefe… Con «Que decida la IA», propone uno.', escrita: true, placeholder: 'Ej.: su suegra, frente a toda la familia' },
    { id: 'cierre', texto: 'Cómo cierra', opciones: ['Cantado dentro de la canción', 'Solo tarjeta final'] },
    { id: 'genero', texto: 'Género musical', opciones: ['Balada pop', 'Pop acústico', 'Balada latina', 'Country-pop', 'Folk', 'Otro'], escribir: 'Otro', placeholder: 'Ej.: bolero' },
    { id: 'canta', texto: 'Quién canta', ayudaIA: 'Con «Que decida la IA», la voz de quien cuenta la historia.', opciones: ['Voz femenina', 'Voz masculina'] },
  ],
};

export function preguntasDe(clave) {
  return PREGUNTAS[clave] || [];
}

const IDIOMAS = { es: 'Español', en: 'Inglés', pt: 'Portugués' };

/** Lo que viene marcado en el formulario de un estilo (lo demás, "Que decida la IA"). `idioma`: el de la ficha. */
export function preguntasIniciales(clave, { idioma } = {}) {
  const v = {};
  for (const p of preguntasDe(clave)) {
    if (p.porDefecto === 'idioma') v[p.id] = IDIOMAS[String(idioma || '').slice(0, 2).toLowerCase()] || null;
    else if (p.porDefecto) v[p.id] = p.porDefecto;
  }
  return v;
}

/** "Lo describo yo: una abuela…" -> { opcion: 'Lo describo yo', escrito: 'una abuela…' } */
export function partirEscrito(p, valor) {
  const t = typeof valor === 'string' ? valor : '';
  if (!p.escribir || !(t === p.escribir || t.startsWith(`${p.escribir}:`))) return { opcion: t, escrito: '' };
  return { opcion: p.escribir, escrito: t.slice(p.escribir.length + 1).trim() };
}

/** Lo que se manda al servidor: { id: texto } solo con lo que eligió (lo que falta es "que decida la IA"). */
export function respuestasDe(clave, valores = {}) {
  const r = {};
  for (const p of preguntasDe(clave)) {
    const v = valores[p.id];
    if (typeof v !== 'string' || !v.trim()) continue;
    if (p.escribir && partirEscrito(p, v).opcion === p.escribir && !partirEscrito(p, v).escrito) continue;
    r[p.id] = v.trim();
  }
  return r;
}

/** La primera pregunta que falta contestar (obligatoria, o una opción "escríbelo" sin escribir), o null. */
export function faltaDe(clave, valores = {}) {
  for (const p of preguntasDe(clave)) {
    const v = valores[p.id];
    const vacio = typeof v !== 'string' || !v.trim();
    if (p.obligatoria && vacio) return p;
    if (!vacio && p.escribir && partirEscrito(p, v).opcion === p.escribir && !partirEscrito(p, v).escrito) return p;
  }
  return null;
}

// ---------------------------------------------------------------- lo que se cuenta de cada estilo

/**
 * Detalle de cada estilo, en palabras de la app.
 * voz: narrador (ElevenLabs) | video (la voz sale del clip) | canto (Suno)
 */
const SOLO = 'Se hace solo, sin preguntarte nada';
const HABLADO = 'Se hace solo: la IA escucha cada clip y rehace el que salga mal';
export const DETALLES = {
  claymation: { quienHabla: 'Un narrador en voz en off', idealPara: 'Suplementos, salud y todo lo que se explica con una metáfora', tono: 'Cálido, artesanal y con humor', paradas: SOLO, voz: 'narrador' },
  crochet: { quienHabla: 'Un narrador en voz en off', idealPara: 'Belleza, cuidado personal, bebés y productos que se sienten cálidos', tono: 'Tierno, artesanal y muy llamativo', paradas: SOLO, voz: 'narrador' },
  'zack-d-films': { quienHabla: 'Un narrador en voz en off', idealPara: 'Productos con un mecanismo que se puede mostrar por dentro', tono: 'Curioso, de documental, con giro final', paradas: SOLO, voz: 'narrador' },
  'estilo-pixar': { quienHabla: 'Un narrador en voz en off', idealPara: 'Historias de clientes, cursos y productos con un antes y un después', tono: 'Emotivo, de película familiar', paradas: SOLO, voz: 'narrador' },
  skeleton: { quienHabla: 'Un narrador en voz en off', idealPara: 'Salud, sueño y hábitos: "¿qué le pasa a tu cuerpo si…?"', tono: 'Directo, viral, de TikTok', paradas: SOLO, voz: 'narrador' },
  'estilo-lego': { quienHabla: 'Un narrador en voz en off', idealPara: 'Productos con un mecanismo y un resultado que se puede contar con piezas', tono: 'Divertido, ordenado y muy visual', paradas: SOLO, voz: 'narrador' },
  ugc: { quienHabla: 'Una persona a cámara, con su propia voz', idealPara: 'Cualquier producto: testimonio, reseña, rutina o demo', tono: 'Cercano y creíble, como un video de celular', paradas: HABLADO, voz: 'video' },
  'talking-object-pixar': { quienHabla: 'El producto (u otro objeto) en primera persona', idealPara: 'Productos que pueden "defenderse" frente a lo que ya probó tu cliente', tono: 'Gracioso, con personalidad', paradas: HABLADO, voz: 'video' },
  podcast: { quienHabla: 'Dos anfitriones conversando', idealPara: 'Productos que se recomiendan entre amigos', tono: 'Natural, como un clip de podcast real', paradas: HABLADO, voz: 'video' },
  entrevista: { quienHabla: 'Un entrevistador y una persona en la calle', idealPara: 'Dolores que la gente confiesa con una sonrisa', tono: 'Espontáneo, con preguntas incómodas', paradas: HABLADO, voz: 'video' },
  musical: {
    quienHabla: 'Una canción original, con coro',
    idealPara: 'Marcas que quieren que su anuncio se pegue',
    tono: 'Pegadizo y alegre',
    paradas: 'Eliges la letra y, antes de las imágenes, la versión de la canción, de oído; después se hace solo',
    voz: 'canto',
  },
  'historias-musicales': {
    quienHabla: 'Una historia cantada en primera persona',
    idealPara: 'Ofertas que necesitan una historia larga, como una carta de ventas',
    tono: 'Emotivo, de 4 a 10 minutos',
    paradas: 'Apruebas la historia y, antes de las imágenes, eliges la versión de la canción, de oído; después se hace solo',
    voz: 'canto',
  },
  continuidad: { quienHabla: 'Se suma a un estilo con narrador', idealPara: 'Anuncios que se ven de corrido, sin un solo corte', tono: 'Fluido, hipnótico', paradas: SOLO, voz: 'narrador' },
};

/** Qué trae el guion de cada estilo, en palabras de la app (para el lugar donde Claude lo escribe). */
export function queDiceElGuion(clave) {
  if (clave === 'podcast') return 'lo que dice cada anfitrión';
  if (clave === 'entrevista') return 'las preguntas y lo que contesta la persona';
  if (clave === 'ugc') return 'lo que dice la persona a cámara';
  if (clave === 'talking-object-pixar') return 'lo que dice cada personaje';
  if (clave === 'musical') return '2 o 3 letras para que elijas una';
  if (clave === 'historias-musicales') return 'la historia que se canta, línea por línea';
  return 'lo que dice el narrador';
}

/** Cómo sale el anuncio después del «Sí» (al lado del botón de producir). */
export function queSaleDe(clave, { continuidad = false } = {}) {
  if (esCantado(clave)) return 'Primero se hace la canción: la escuchas, eliges la versión que más te gusta y desde ahí se hace solo hasta el video, con subtítulos.';
  if (clave === 'podcast' || clave === 'entrevista') return 'Sale completo, con las voces del video y subtítulos, y lo retocas en el editor de la app.';
  if (clave === 'ugc' || clave === 'talking-object-pixar') return 'Sale completo, con las voces del video, música y subtítulos, y lo retocas en el editor de la app.';
  return `Sale completo${continuidad ? ' y sin cortes' : ''}, con voz, música y subtítulos, y lo retocas en el editor de la app.`;
}

/**
 * Cuánto tarda más o menos en producirse un anuncio (minutos), según el estilo y el largo. `segundos`: los que dijo el
 * usuario (aproximados); sin ellos (la duración la decide la IA), lo que suele durar ese estilo.
 * Orienta: el tiempo real lo va a dar el motor.
 */
export function minutosDe(clave, segundos) {
  const d = DETALLES[clave] || DETALLES.claymation;
  const s = Number(segundos) || (clave === 'musical' ? 100 : clave === 'historias-musicales' ? 300 : 45);
  return Math.round(d.voz === 'canto' ? 16 + s / 30 : 8 + s / 9);
}
