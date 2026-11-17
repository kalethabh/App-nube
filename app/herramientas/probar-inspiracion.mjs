// Prueba de «Inspiración» SIN GASTAR NADA (no abre la app, no llama a TrendTrack ni a la IA, no escribe archivos):
//
//   node app/herramientas/probar-inspiracion.mjs
//
// Revisa la primera pasada de formato y sonido (por texto), cómo se lee una respuesta de TrendTrack (anuncios con su
// total y costo; marcas de search_advertisers y del Brandtracker), los filtros nuevos (desde cuándo) y que nunca pase
// una URL que no sea de TrendTrack. Sale con 0 si todo pasó y con 1 si algo falló.
import { argumentosBusqueda, filtrosLimpios, leerRespuestaBusqueda, normalizarAnuncio } from '../server/lib/ganadores.js';
import { FORMATOS, clasificarPorTexto, leerRespuestaMarcas, normalizarMarca, pareceCancion } from '../server/lib/inspiracion.js';

let pasan = 0;
let fallas = 0;
const check = (que, ok, detalle = '') => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'} ${que}${!ok && detalle ? ` -> ${detalle}` : ''}`);
};
const anuncio = (o) => ({ id: 'x', tipo: 'video', anunciante: { nombre: 'Marca' }, ...o });

console.log('Formato por texto');
const casos = [
  [{ copy: 'Muñequitos de crochet que cuentan tu historia' }, 'crochet'],
  [{ copy: 'Amigurumi hecho a mano' }, 'crochet'],
  [{ titulo: 'Animación en plastilina' }, 'claymation'],
  [{ copy: 'Stop motion de tu rutina' }, 'claymation'],
  [{ copy: 'Armado con piezas de LEGO' }, 'lego'],
  [{ copy: 'Tu esqueleto te habla' }, 'esqueleto'],
  [{ copy: 'Ilustrado en acuarela' }, 'acuarela'],
  [{ copy: 'Un juego en pixel art' }, 'pixel-art'],
  [{ copy: 'Hecho con recortes de papel' }, 'papel'],
  [{ copy: 'Animación 3D de tus venas' }, 'animacion-3d'],
  [{ copy: 'Como un dibujo animado' }, 'animacion-2d'],
  [{ copy: 'Como en una película de Pixar' }, 'pixar'],
  [{ transcripcion: 'Hola chicas, les cuento mi experiencia con este colágeno' }, 'ugc'],
  [{ copy: 'Yo probé de todo y nada' }, 'ugc'],
  [{ copy: 'Pago contra entrega, envío gratis' }, null],
  [{ copy: 'Papel higiénico en oferta' }, null], // «papel» suelto no es el formato Papel
  [{ copy: 'Calcio para tus huesos' }, null],
];
for (const [o, esperado] of casos) {
  const r = clasificarPorTexto(anuncio(o));
  check(`«${o.copy || o.titulo || o.transcripcion}» -> ${esperado}`, r.formato === esperado, r.formato);
}
check('la marca y la página también cuentan', clasificarPorTexto(anuncio({ anunciante: { nombre: 'Crochet Stories' } })).formato === 'crochet');
check('cada formato existe en FORMATOS', casos.every(([, e]) => e === null || FORMATOS.some((f) => f.id === e)));

console.log('Sonido por texto');
check('una imagen no tiene audio', clasificarPorTexto(anuncio({ tipo: 'imagen' })).sonido === 'sin-audio');
check('con transcripción = voz', clasificarPorTexto(anuncio({ transcripcion: 'Esto es lo que pasa dentro de tus venas cuando comes azúcar.' })).sonido === 'voz');
check('con notas musicales = canción', clasificarPorTexto(anuncio({ transcripcion: '♪ Desinflama, toma tu té por la mañana ♪' })).sonido === 'cancion');
check(
  'un coro que se repite = canción',
  pareceCancion('Toma tu té por la mañana. Y te sientes bien. Toma tu té por la mañana. Ya no hay hinchazón. Toma tu té por la mañana.')
);
check('hablar normal no es canción', !pareceCancion('Hola, hoy les quiero contar algo. Esto me cambió la vida. Lo tomo cada mañana.'));
check('video sin transcripción = sin dato (no se inventa)', clasificarPorTexto(anuncio({})).sonido === null);
check('transcripción muy corta = sin dato', clasificarPorTexto(anuncio({ transcripcion: 'ok' })).sonido === null);

console.log('Respuesta de search_ads');
const crudo = JSON.stringify({
  data: [
    {
      id: 'facebook_1',
      collationId: '9',
      status: 'active',
      daysRunning: 15,
      firstSeenAt: '2026-10-30T07:00:00.000Z',
      media: { type: 'video', thumbnailUrl: 'https://medias.trendtrack.io/t.jpg', mediaUrl: 'https://otro-sitio.com/v.mp4' },
      advertiser: { name: 'AMUA', logoUrl: 'https://medias.trendtrack.io/l.jpg', facebookPageId: '123', liveAdsCount: 58 },
      content: { title: 'Título', body: 'Copy', transcript: 'Hola' },
      metrics: { reach: 299034, duplicates: 4, reachDelta7d: 187683 },
      rank: { currentRank: 1, rankDelta: 0 },
    },
  ],
  pagination: { total: 40394, totalPages: 833 },
  credits: { costUnits: 18, creditsRemaining: 5936 },
});
const r = leerRespuestaBusqueda(`Resultado: ${crudo}`);
check('lee los anuncios aunque venga texto alrededor', r?.anuncios?.length === 1);
check('total de TrendTrack', r?.total === 40394);
check('costo de la página', r?.costo === 18 && r?.restantes === 5936);
check('puesto y alcance de 7 días', r?.anuncios[0].puesto === 1 && r?.anuncios[0].alcance7d === 187683);
check('una URL de otro sitio no pasa', r?.anuncios[0].media === null && r?.anuncios[0].miniatura === 'https://medias.trendtrack.io/t.jpg');
check('fuera de modo prueba, una muestra local tampoco', normalizarAnuncio({ id: 'a', media: { type: 'video', mediaUrl: '/archivos/muestra/ugc/video.mp4' } }).media === null);

console.log('Filtros');
const f = filtrosLimpios({ rango: 30, cantidad: 99, orden: 'nada' });
check('rango 30 días', f.rango === 30);
check('cantidad con tope 20', f.cantidad === 20);
check('orden desconocido -> escalando', f.orden === 'escalando');
const desde = argumentosBusqueda(f).created_after;
check('created_after = hace 30 días', desde === new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), desde);
check('sin rango no hay created_after', !('created_after' in argumentosBusqueda(filtrosLimpios({}))));
check('un rango raro se ignora', filtrosLimpios({ rango: 12 }).rango === 0);

console.log('Marcas');
const marcas = leerRespuestaMarcas(
  JSON.stringify({ data: [{ name: 'AMUA', facebookPageId: '110959224500732', liveAdsCount: 142, logoUrl: 'https://medias.trendtrack.io/a.jpg', domain: 'www.amua.co' }, { pageName: 'Otra', activeAds: 3, logoUrl: 'https://malo.com/x.jpg' }, { nada: 1 }] })
);
check('lee search_advertisers', marcas?.length === 2, JSON.stringify(marcas));
check('id por página', marcas?.[0].id === 'p110959224500732' && marcas[0].activos === 142 && marcas[0].dominio === 'amua.co');
check('sin página: id por nombre, y el logo de otro sitio no pasa', marcas?.[1].id === 'n-otra' && marcas[1].logo === null && marcas[1].activos === 3);
const tracked = leerRespuestaMarcas(JSON.stringify({ trackedBrands: [{ id: 7, brand: { name: 'Seguida', facebookPageId: '555555' } }] }));
check('lee list_tracked_brands (con brand adentro)', tracked?.[0]?.nombre === 'Seguida' && tracked[0].pagina === '555555');
check('lo que no se entiende -> null', leerRespuestaMarcas('# Markdown sin JSON') === null);
check('una marca sin nombre no se sigue', normalizarMarca({ facebookPageId: '1' }) === null);

console.log(`\n${pasan} bien, ${fallas} mal`);
process.exit(fallas ? 1 : 0);
