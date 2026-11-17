// El catálogo de PLANTILLAS de los anuncios de imagen (formatos con diseño fijo y sus espacios de texto). La app dibuja
// los textos y los gráficos (remotion/src/plantillas-imagen/); el modelo de imagen solo hace la escena, sin texto, y
// solo en las plantillas que la necesitan (`escena: true`). Las demás salen de la foto del producto: al instante y gratis.
//
// Cada plantilla: { id, nombre, familia, escena, descripcion, campos }. `campos` es lo que se puede editar en la
// pantalla del lote (y lo que llena textos.js): { clave, etiqueta, tipo: 'texto' | 'parrafo' | 'lista' | 'pares' |
// 'datos' | 'numero', max, cuantos? }.

export const FAMILIAS = [
  { id: 'dolor', nombre: 'Dolor y resultado' },
  { id: 'beneficio', nombre: 'Beneficio explicado' },
  { id: 'nativo', nombre: 'Nativo de redes' },
  { id: 'oferta', nombre: 'Oferta' },
];

const titular = { clave: 'titular', etiqueta: 'Titular', tipo: 'texto', max: 70 };
const legal = { clave: 'legal', etiqueta: 'Línea legal (chiquita)', tipo: 'texto', max: 120 };

export const CATALOGO = [
  {
    id: 'antes-despues',
    nombre: 'Antes y después',
    familia: 'dolor',
    escena: true,
    descripcion: 'Una foto partida en dos: la misma persona antes y después, con los rótulos ANTES / DESPUÉS.',
    campos: [{ ...titular, etiqueta: 'Titular (solo en vertical)' }, { clave: 'antes', etiqueta: 'Rótulo izquierdo', tipo: 'texto', max: 16 }, { clave: 'despues', etiqueta: 'Rótulo derecho', tipo: 'texto', max: 16 }, legal],
  },
  {
    id: 'linea-tiempo',
    nombre: 'Línea de tiempo',
    familia: 'dolor',
    escena: true,
    descripcion: 'El cambio en 3 o 4 cuadros (Día 1, 7, 14… o Mes 1, 2, 3).',
    campos: [titular, { clave: 'etapas', etiqueta: 'Etapas (una por línea)', tipo: 'lista', max: 14, cuantos: 4 }, legal],
  },
  {
    id: 'pizarra',
    nombre: 'Pizarra: tu objeción vs. esto',
    familia: 'dolor',
    escena: false,
    descripcion: 'Una pizarra blanca con la comparación a mano, 4 puntos y el producto delante.',
    campos: [titular, { clave: 'antes', etiqueta: 'Lo de siempre (tachado)', tipo: 'texto', max: 40 }, { clave: 'despues', etiqueta: 'Lo tuyo (en círculo)', tipo: 'texto', max: 30 }, { clave: 'puntos', etiqueta: 'Puntos (uno por línea)', tipo: 'lista', max: 50, cuantos: 4 }, legal],
  },
  {
    id: 'mapa-cuerpo',
    nombre: 'Mapa del cuerpo',
    familia: 'dolor',
    escena: true,
    descripcion: 'Ilustración del cuerpo: a la izquierda el problema, a la derecha el resultado, con zonas rotuladas.',
    campos: [titular, { clave: 'sin', etiqueta: 'Rótulo izquierdo', tipo: 'texto', max: 18 }, { clave: 'con', etiqueta: 'Rótulo derecho', tipo: 'texto', max: 18 }, { clave: 'izquierda', etiqueta: 'Zonas con problema (una por línea)', tipo: 'lista', max: 28, cuantos: 3 }, { clave: 'derecha', etiqueta: 'Zonas con resultado (una por línea)', tipo: 'lista', max: 28, cuantos: 3 }, legal],
  },
  {
    id: 'producto-flechas',
    nombre: 'Producto con flechas',
    familia: 'beneficio',
    escena: false,
    descripcion: 'El producto al centro y 4 flechas a mano: ingrediente → beneficio.',
    campos: [titular, { clave: 'flechas', etiqueta: 'Flechas (ingrediente → beneficio)', tipo: 'pares', max: 40, cuantos: 4 }, legal],
  },
  {
    id: 'lista-iconos',
    nombre: 'Lista de beneficios con íconos',
    familia: 'beneficio',
    escena: false,
    descripcion: 'Hasta 6 beneficios con su ícono y el producto a la derecha.',
    campos: [titular, { clave: 'beneficios', etiqueta: 'Beneficios (uno por línea)', tipo: 'lista', max: 60, cuantos: 6 }, legal],
  },
  {
    id: 'barra-datos',
    nombre: 'Producto protagonista + datos',
    familia: 'beneficio',
    escena: false,
    descripcion: 'El producto enorme y una barra con 3 datos de la ficha (por ejemplo «200 mg aguaje»).',
    campos: [titular, { clave: 'datos', etiqueta: 'Datos (valor · etiqueta)', tipo: 'datos', max: 24, cuantos: 3 }, legal],
  },
  {
    id: 'mecanismo',
    nombre: 'Mecanismo con flecha',
    familia: 'beneficio',
    escena: false,
    descripcion: 'El problema → el producto → el resultado, unidos con flechas.',
    campos: [titular, { clave: 'problema', etiqueta: 'El problema', tipo: 'parrafo', max: 90 }, { clave: 'resultado', etiqueta: 'El resultado', tipo: 'parrafo', max: 90 }, { clave: 'nota', etiqueta: 'Nota a mano', tipo: 'texto', max: 30 }, legal],
  },
  {
    id: 'foto-titular',
    nombre: 'Foto con titular',
    familia: 'beneficio',
    escena: true,
    descripcion: 'Una foto real a sangre (una escena o un cuadro de tu video) con el titular grande arriba y el producto.',
    campos: [titular, { clave: 'nota', etiqueta: 'Nota a mano', tipo: 'texto', max: 40 }, legal],
  },
  {
    id: 'nota-texto',
    nombre: 'Nota de texto plano',
    familia: 'nativo',
    escena: false,
    descripcion: 'Como una nota del celular: título en negrita, un párrafo y el producto chiquito en la esquina.',
    campos: [{ clave: 'titulo', etiqueta: 'Título', tipo: 'texto', max: 90 }, { clave: 'texto', etiqueta: 'Párrafo', tipo: 'parrafo', max: 420 }, legal],
  },
  {
    id: 'burbujas',
    nombre: 'Burbujas de chat',
    familia: 'nativo',
    escena: false,
    descripcion: '«Tus problemas» en burbujas grises (con las palabras de tu cliente) y «nuestro consejo» en azul.',
    campos: [{ clave: 'contacto', etiqueta: 'Nombre del chat', tipo: 'texto', max: 30 }, { clave: 'problemas', etiqueta: 'Problemas (uno por línea)', tipo: 'lista', max: 90, cuantos: 3 }, { clave: 'consejo', etiqueta: 'Nuestro consejo', tipo: 'parrafo', max: 160 }, legal],
  },
  {
    id: 'foto-tiktok',
    nombre: 'Foto casera con subtítulos',
    familia: 'nativo',
    escena: true,
    descripcion: 'Una foto casera con el producto y los subtítulos blancos de TikTok.',
    campos: [{ clave: 'lineas', etiqueta: 'Subtítulos (uno por línea)', tipo: 'lista', max: 40, cuantos: 3 }, legal],
  },
  {
    id: 'resena-tuit',
    nombre: 'Reseña tipo tuit',
    familia: 'nativo',
    escena: false,
    descripcion: 'Una tarjeta como un tuit (nombre, verificado y estrellas) y 3 íconos abajo.',
    campos: [{ clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', max: 30 }, { clave: 'usuario', etiqueta: 'Usuario', tipo: 'texto', max: 30 }, { clave: 'texto', etiqueta: 'Texto', tipo: 'parrafo', max: 220 }, { clave: 'estrellas', etiqueta: 'Estrellas (0 = sin estrellas)', tipo: 'numero', max: 5 }, { clave: 'iconos', etiqueta: 'Íconos (uno por línea)', tipo: 'lista', max: 24, cuantos: 3 }, legal],
  },
  {
    id: 'comentario',
    nombre: 'Captura de un comentario',
    familia: 'nativo',
    escena: false,
    descripcion: 'La pregunta de una clienta y la respuesta de tu marca, como en Facebook.',
    campos: [{ clave: 'nombre', etiqueta: 'Quién comenta', tipo: 'texto', max: 30 }, { clave: 'comentario', etiqueta: 'Comentario', tipo: 'parrafo', max: 160 }, { clave: 'marca', etiqueta: 'Tu marca', tipo: 'texto', max: 30 }, { clave: 'respuesta', etiqueta: 'Respuesta', tipo: 'parrafo', max: 200 }, legal],
  },
  {
    id: 'sticker-oferta',
    nombre: 'Oferta con sticker',
    familia: 'oferta',
    escena: false,
    descripcion: 'El producto grande, un sticker girado con la oferta y la franja de abajo.',
    campos: [titular, { clave: 'sticker', etiqueta: 'Sticker', tipo: 'texto', max: 20 }, { clave: 'franja', etiqueta: 'Franja de abajo', tipo: 'texto', max: 60 }, legal],
  },
  {
    id: 'casi-agotado',
    nombre: 'Casi agotado',
    familia: 'oferta',
    escena: false,
    descripcion: '«Casi agotado» con una barra de existencias y la franja de compra.',
    campos: [titular, { clave: 'estado', etiqueta: 'Texto de la barra', tipo: 'texto', max: 40 }, { clave: 'franja', etiqueta: 'Franja de abajo', tipo: 'texto', max: 60 }, legal],
  },
  {
    id: 'buena-mala',
    nombre: 'Buena noticia / mala noticia',
    familia: 'oferta',
    escena: false,
    descripcion: 'Dos bloques: la buena noticia (el beneficio) y la mala (se acaba).',
    campos: [{ clave: 'buena', etiqueta: 'Buena noticia', tipo: 'texto', max: 70 }, { clave: 'mala', etiqueta: 'Mala noticia', tipo: 'texto', max: 70 }, { clave: 'franja', etiqueta: 'Franja de abajo', tipo: 'texto', max: 60 }, legal],
  },
];

export const POR_ID = new Map(CATALOGO.map((x) => [x.id, x]));

/**
 * «Que la app elija»: una mezcla entre las familias (de cada 4, una con escena), en este orden. Las de oferta van
 * aparte (nunca en una imagen de dolor) y al final de cada vuelta.
 */
export const ORDEN_AUTO = [
  'producto-flechas',
  'antes-despues',
  'burbujas',
  'lista-iconos',
  'linea-tiempo',
  'resena-tuit',
  'barra-datos',
  'nota-texto',
  'mapa-cuerpo',
  'sticker-oferta',
  'pizarra',
  'foto-tiktok',
  'comentario',
  'mecanismo',
  'buena-mala',
  'casi-agotado',
];

/** La plantilla de cada variación (en orden): las elegidas, una tras otra; sin elegidas, la mezcla de la app. */
export function asignar(cantidad, elegidas = []) {
  const lista = (Array.isArray(elegidas) ? elegidas : []).filter((x) => POR_ID.has(x));
  const orden = lista.length ? lista : ORDEN_AUTO;
  return Array.from({ length: Math.max(0, Number(cantidad) || 0) }, (_, i) => orden[i % orden.length]);
}

/** Cuántas variaciones necesitan una escena del modelo de imagen (lo único que cuesta). */
export const escenasDe = (cantidad, elegidas) => asignar(cantidad, elegidas).filter((id) => POR_ID.get(id)?.escena).length;

/** Lo que manda GET /api/imagen-ads/opciones (sin los campos internos). */
export const catalogoParaLaPantalla = () => ({
  familias: FAMILIAS,
  plantillas: CATALOGO.map(({ id, nombre, familia, escena, descripcion }) => ({ id, nombre, familia, escena, descripcion })),
  ordenAuto: ORDEN_AUTO,
});
