// Prueba de «Inspiración» SIN GASTAR NADA (no abre la app, no llama a TrendTrack ni a la IA, no escribe archivos):
//
//   node app/herramientas/probar-inspiracion.mjs
//
// Revisa la primera pasada de formato y sonido (por texto), cómo se lee una respuesta de TrendTrack (anuncios con su
// total y costo; marcas de search_advertisers y del Brandtracker), los filtros nuevos (desde cuándo) y que nunca pase
// una URL que no sea de TrendTrack. Sale con 0 si todo pasó y con 1 si algo falló.
//
// Desde 2026-11-17n también las otras dos fuentes, SIN llamar nunca a Meta:
//   - «Meta (oficial)»: un Graph API falso en 127.0.0.1 (parámetros, cómo se lee, páginas con el cursor, errores 190,
//     4, 17 y 613, que el token nunca vuelva en lo que llega a la pantalla) y el snapshot falso de
//     app/herramientas/datos-prueba/snapshot-meta.html (sacar el video y la miniatura).
//   - el proxy de medios: solo https de .fbcdn.net / facebook.com, y ninguna redirección a otro sitio.
//   - «Desde Chrome»: una app en modo prueba (puerto 4493) y POST /api/inspiracion/importar sin código, con código
//     equivocado, desde otro origen, demasiado grande y bien (queda guardado y se lista; después se borra).
//   Escribe solo cachés en temp/_ganadores/meta/ y lo de la app de prueba, y lo borra al terminar.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { argumentosBusqueda, deFacebook, filtrosLimpios, leerRespuestaBusqueda, medioPermitido, normalizarAnuncio, traerMedio } from '../server/lib/ganadores.js';
import { FORMATOS, clasificarPorTexto, leerRespuestaMarcas, normalizarMarca, pareceCancion } from '../server/lib/inspiracion.js';
import { _paraPruebas as clavesParaPruebas, limpiarClave } from '../server/lib/claves.js';
import { _paraPruebas as metaParaPruebas, buscarEnMeta, errorDeMeta, extraerMediosSnapshot, filtrosMeta, leerRespuestaMeta, medioDeMeta, normalizarMeta, parametrosMeta } from '../server/lib/meta-biblioteca.js';
import { codigoCorrecto, fechaDeTexto, validarImportacion } from '../server/lib/desde-chrome.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');

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

// ================================================================ Meta (oficial)
console.log('Meta oficial: filtros y parámetros');
const fm = filtrosMeta({ paises: ['CO', 'ES', 'gb', 'XX'], texto: '  colágeno  ', formato: 'video', paginas: ['123456', 'malo'] });
check('solo países de Europa (CO y XX fuera)', JSON.stringify(fm.paises) === '["ES","GB"]', JSON.stringify(fm.paises));
check('sin países de Europa -> España', JSON.stringify(filtrosMeta({ paises: ['CO'] }).paises) === '["ES"]');
check('solo páginas con números', JSON.stringify(fm.paginas) === '["123456"]');
const pm = parametrosMeta(fm, { hoy: new Date('2026-11-17T12:00:00Z') });
check('activos, con search_terms y media_type', pm.ad_active_status === 'ACTIVE' && pm.search_terms === 'colágeno' && pm.media_type === 'VIDEO');
check('ad_reached_countries en JSON', pm.ad_reached_countries === '["ES","GB"]');
check('validado: ad_delivery_date_max = hoy - 30 días', pm.ad_delivery_date_max === '2026-10-18', pm.ad_delivery_date_max);
check('sin validados no hay ad_delivery_date_max', !('ad_delivery_date_max' in parametrosMeta(filtrosMeta({ texto: 'x', soloValidados: false }))));
check('pide eu_total_reach y ad_snapshot_url', pm.fields.includes('eu_total_reach') && pm.fields.includes('ad_snapshot_url') && pm.fields.includes('publisher_platforms'));
check('nunca el token en los parámetros', !JSON.stringify(pm).includes('access_token'));

console.log('Meta oficial: cómo se lee');
const hace40 = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
const crudoMeta = {
  data: [
    {
      id: '1234567890123',
      page_id: '98765',
      page_name: 'Marca Europa',
      ad_creative_bodies: ['El copy del anuncio'],
      ad_creative_link_titles: ['El título'],
      ad_creative_link_descriptions: ['La descripción'],
      ad_creative_link_captions: ['WWW.MARCAEUROPA.ES'],
      ad_delivery_start_time: hace40,
      ad_snapshot_url: 'https://www.facebook.com/ads/archive/render_ad/?id=1234567890123&access_token=SECRETO',
      publisher_platforms: ['facebook', 'instagram'],
      eu_total_reach: 250000,
    },
    { id: 'no-numero', page_name: 'mal' },
  ],
  paging: { cursors: { before: 'AAA', after: 'QVFIUjEyMw' }, next: 'https://graph.facebook.com/v21.0/ads_archive?after=QVFIUjEyMw&access_token=SECRETO' },
};
const lm = leerRespuestaMeta(crudoMeta, { formato: '', paises: ['ES'] });
const am = lm?.anuncios?.[0];
check('lee los anuncios (y salta el que no tiene id)', lm?.anuncios?.length === 1);
check('id meta_ y metaId', am?.id === 'meta_1234567890123' && am?.metaId === '1234567890123' && am?.fuente === 'meta');
check('días desde ad_delivery_start_time', am?.dias === 40, am?.dias);
check('alcance de eu_total_reach', am?.alcance === 250000);
check('marca, copy, título, descripción', am?.anunciante?.nombre === 'Marca Europa' && am?.anunciante?.pagina === '98765' && am?.copy === 'El copy del anuncio' && am?.titulo === 'El título' && am?.descripcion === 'La descripción');
check('dominio del caption', am?.dominio === 'marcaeuropa.es', am?.dominio);
check('plataformas', JSON.stringify(am?.plataformas) === '["facebook","instagram"]');
check('el medio queda pendiente (sale del snapshot)', am?.medioPendiente === true && am?.media === null);
check('el cursor de la página siguiente, sin token', lm?.siguiente === 'QVFIUjEyMw');
check('nada del token ni del snapshot llega a la pantalla', !JSON.stringify(lm).includes('SECRETO') && !JSON.stringify(lm).includes('render_ad'));
check('sin paging.next no hay siguiente', leerRespuestaMeta({ data: [], paging: { cursors: { after: 'x' } } })?.siguiente === null);
check('un anuncio de Meta vuelve de la pantalla igual', normalizarAnuncio({ ...am, fuente: 'meta' }) && normalizarMeta({ id: '55555' })?.id === 'meta_55555');

console.log('Meta oficial: errores');
const e190 = errorDeMeta({ error: { code: 190, message: 'Error validating access token' } });
check('190 -> token vencido (401)', e190.status === 401 && /venci/.test(e190.message) && e190.motivo === 'token-vencido');
for (const codigo of [4, 17, 613]) {
  const e = errorDeMeta({ error: { code: codigo } });
  check(`${codigo} -> Meta pidió esperar (429)`, e.status === 429 && /esperar/.test(e.message));
}
const e10 = errorDeMeta({ error: { code: 10, message: 'Application does not have permission for this action' } });
check('10 / sin permiso -> verificar identidad (403)', e10.status === 403 && /identidad/.test(e10.message));
check('500 -> problema de Meta', errorDeMeta({}, 503).status === 502);

console.log('Meta oficial: el token');
const tokenFalso = `EAA${'x'.repeat(60)}`;
check('limpia «Bearer» y una dirección con access_token', limpiarClave('meta', `Bearer ${tokenFalso}`) === tokenFalso && limpiarClave('meta', `https://graph.facebook.com/me?access_token=${tokenFalso}&x=1`) === tokenFalso);
check('algo corto no es un token', limpiarClave('meta', 'EAA123') === null);

// el Graph API y el snapshot falsos (nunca se llama a Meta)
const SNAPSHOT = fs.readFileSync(path.join(AQUI, 'datos-prueba', 'snapshot-meta.html'), 'utf8');
const vistos = [];
const falso = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  vistos.push(u);
  if (u.pathname === '/render_ad/') {
    if (u.searchParams.get('id') === '7777777') return res.writeHead(302, { location: 'https://evil.example.com/' }).end();
    return res.writeHead(200, { 'content-type': 'text/html' }).end(SNAPSHOT);
  }
  const q = u.searchParams.get('search_terms');
  const codigo = { e190: 190, e4: 4, e17: 17, e613: 613 }[q];
  if (codigo) return res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: codigo, message: 'falla de prueba' } }));
  const despues = u.searchParams.get('after');
  const data = despues ? [{ ...crudoMeta.data[0], id: '2222222222' }] : crudoMeta.data;
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data, paging: despues ? { cursors: { after: 'fin' } } : crudoMeta.paging }));
});
await new Promise((r) => falso.listen(0, '127.0.0.1', r));
const puertoFalso = falso.address().port;
const envFalso = path.join(os.tmpdir(), `kads-env-falso-${process.pid}`); // (que no se use el .env de verdad)
clavesParaPruebas({ archivo: envFalso });
process.env.META_ADS_TOKEN = tokenFalso;
metaParaPruebas({ graph: `http://127.0.0.1:${puertoFalso}/v21.0`, snapshot: `http://127.0.0.1:${puertoFalso}/render_ad/` });
const DIR_META = path.join(RAIZ, 'temp', '_ganadores', 'meta');
const creados = [];
try {
  const texto = `prueba-${process.pid}`;
  const p1 = await buscarEnMeta({ texto, paises: ['ES'] }, { forzar: true });
  creados.push(path.join(DIR_META, 'busquedas', `${p1.clave}.json`));
  const pedido = vistos.at(-1);
  check('va a ads_archive con el token (solo al servidor)', pedido.pathname === '/v21.0/ads_archive' && pedido.searchParams.get('access_token') === tokenFalso);
  check('primera página: 1 anuncio y el cursor', p1.anuncios.length === 1 && p1.siguiente === 'QVFIUjEyMw');
  const p2 = await buscarEnMeta({ texto, paises: ['ES'] }, { despues: p1.siguiente, forzar: true });
  creados.push(path.join(DIR_META, 'busquedas', `${p2.clave}.json`));
  check('«Cargar más» manda after=<cursor>', vistos.at(-1).searchParams.get('after') === 'QVFIUjEyMw');
  check('segunda página: otro anuncio y sin siguiente', p2.anuncios[0]?.metaId === '2222222222' && p2.siguiente === null);
  check('la caché no guarda el token', !fs.readFileSync(creados[0], 'utf8').includes(tokenFalso));
  const p1b = await buscarEnMeta({ texto, paises: ['ES'] });
  check('la misma búsqueda sale de la caché', p1b.desdeCache === true);
  for (const [q, status] of [['e190', 401], ['e4', 429], ['e17', 429], ['e613', 429]]) {
    let st = null;
    let msg = '';
    try {
      await buscarEnMeta({ texto: q, paises: ['ES'] }, { forzar: true });
    } catch (e) {
      st = e.status;
      msg = e.message;
    }
    check(`la Graph API responde ${q.slice(1)} -> ${status}`, st === status && !msg.includes(tokenFalso), `${st} ${msg}`);
  }
  let sinTexto = null;
  try {
    await buscarEnMeta({ paises: ['ES'] });
  } catch (e) {
    sinTexto = e.status;
  }
  check('sin palabra ni marca no se llama a Meta (400)', sinTexto === 400);

  console.log('Meta oficial: el video desde el snapshot');
  const ex = extraerMediosSnapshot(SNAPSHOT);
  check('saca el video HD (sin las barras escapadas)', ex?.tipo === 'video' && ex.media === 'https://video-mad1-1.xx.fbcdn.net/v/t42.1790-2/12345_n.mp4?_nc_cat=103&oh=00_AbC%3D&oe=67A1B2C3', ex?.media);
  check('y la miniatura', ex?.miniatura === 'https://scontent-mad1-1.xx.fbcdn.net/v/t15.5256-10/preview.jpg?oe=2');
  check('nunca una dirección de otro sitio', extraerMediosSnapshot('{"video_hd_url":"https:\\/\\/evil.example.com\\/x.mp4"}') === null);
  check('una imagen sola', extraerMediosSnapshot('{"original_image_url":"https:\\/\\/scontent.xx.fbcdn.net\\/v\\/img.jpg"}')?.tipo === 'imagen');
  check('el logo chico (60x60) no es la imagen del anuncio', extraerMediosSnapshot('<img src="https://scontent.xx.fbcdn.net/v/p60x60/logo.jpg" width="60" height="60">') === null);
  const mm = await medioDeMeta('1234567890123');
  creados.push(path.join(DIR_META, '1234567890123.json'));
  check('medioDeMeta abre el snapshot con el token y saca el video', mm?.tipo === 'video' && mm.media.startsWith('https://video-mad1-1.xx.fbcdn.net/'));
  check('el snapshot se pidió con el token (solo al servidor)', vistos.some((u) => u.pathname === '/render_ad/' && u.searchParams.get('access_token') === tokenFalso));
  check('lo guardado no tiene el token', !fs.readFileSync(creados.at(-1), 'utf8').includes(tokenFalso));
  const mal = await medioDeMeta('7777777');
  creados.push(path.join(DIR_META, '7777777.json'));
  check('una redirección a otro sitio -> sin medio («Ver en Meta»)', Boolean(mal?.error));
} finally {
  falso.close();
  for (const f of creados) fs.rmSync(f, { force: true });
  fs.rmSync(envFalso, { force: true });
}

console.log('Proxy de medios (solo Meta y TrendTrack)');
check('https y .fbcdn.net pasa', deFacebook('https://video-mad1-1.xx.fbcdn.net/v/x.mp4') !== null);
check('www.facebook.com pasa', deFacebook('https://www.facebook.com/ads/library/?id=1') !== null);
check('http (sin s) no pasa', deFacebook('http://video.xx.fbcdn.net/x.mp4') === null);
check('un host que termina parecido no pasa', deFacebook('https://evilfbcdn.net/x.mp4') === null && deFacebook('https://fbcdn.net.evil.com/x.mp4') === null);
check('otro subdominio de facebook.com no pasa', deFacebook('https://l.facebook.com/l.php?u=evil') === null);
check('un medio de Meta pasa por medioPermitido (y uno de otro sitio no)', medioPermitido('https://scontent.xx.fbcdn.net/a.jpg') !== null && medioPermitido('https://evil.com/a.jpg') === null);
check('lo bajado por Chrome (ruta exacta) pasa; otra ruta no', medioPermitido('/api/inspiracion/chrome/media/123456789.mp4') !== null && medioPermitido('/api/inspiracion/chrome/media/../../.env') === null);
{
  const fetchReal = globalThis.fetch;
  const saltos = [];
  globalThis.fetch = async (url) => {
    saltos.push(String(url));
    return new Response(null, { status: 302, headers: { location: 'https://evil.example.com/robado.mp4' } });
  };
  let corta = false;
  try {
    await traerMedio('https://video.xx.fbcdn.net/v/x.mp4');
  } catch {
    corta = true;
  }
  globalThis.fetch = async (url) => {
    saltos.push(String(url));
    return String(url).includes('segundo') ? new Response('ok', { status: 200 }) : new Response(null, { status: 302, headers: { location: 'https://scontent.xx.fbcdn.net/segundo.mp4' } });
  };
  const bien = await traerMedio('https://video.xx.fbcdn.net/v/x.mp4').catch(() => null);
  globalThis.fetch = fetchReal;
  check('una redirección a otro sitio se corta (sin pedirlo)', corta && !saltos.some((u) => u.includes('evil')));
  check('una redirección dentro de .fbcdn.net se sigue', bien?.status === 200);
}

// ================================================================ Desde Chrome
console.log('Desde Chrome: validar lo que llega');
check('fecha en español', fechaDeTexto('Circulando desde el 3 mar 2026')?.startsWith('2026-03-03'));
check('fecha en inglés', fechaDeTexto('Started running on Mar 3, 2026')?.startsWith('2026-03-03'));
check('fecha larga', fechaDeTexto('3 de marzo de 2026')?.startsWith('2026-03-03'));
check('sin año no hay fecha', fechaDeTexto('3 mar') === null);
const valido = validarImportacion({ libraryId: '1234567890', pagina: 'Marca\u0000 X', video: 'https://video.xx.fbcdn.net/v/a.mp4', copy: 'c'.repeat(9000) });
check('valida y recorta', valido.libraryId === '1234567890' && valido.pagina === 'Marca X' && valido.copy.length === 4000);
const lanza = (o) => {
  try {
    validarImportacion(o);
    return null;
  } catch (e) {
    return e.status;
  }
};
check('sin identificador -> 400', lanza({ pagina: 'x' }) === 400);
check('video de otro sitio -> 400', lanza({ libraryId: '1234567890', video: 'https://evil.com/v.mp4' }) === 400);
check('imagen por http -> 400', lanza({ libraryId: '1234567890', imagen: 'http://scontent.xx.fbcdn.net/a.jpg' }) === 400);
check('un código vacío o corto nunca sirve', codigoCorrecto('') === false && codigoCorrecto('ABC') === false);

console.log('Desde Chrome: la app de prueba (puerto 4493)');
const PUERTO = 4493;
const BASE = `http://127.0.0.1:${PUERTO}`;
const app = spawn(process.execPath, [path.join(RAIZ, 'app', 'server', 'index.js')], { cwd: RAIZ, env: { ...process.env, ANUNCIOS_MODO_PRUEBA: '1', PUERTO: String(PUERTO), AIA_MOTOR: 'claude' }, stdio: ['ignore', 'pipe', 'pipe'] });
let salidaApp = '';
app.stdout.on('data', (d) => (salidaApp += d));
app.stderr.on('data', (d) => (salidaApp += d));
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const DE_APP = { Origin: BASE };
let idImportado = null;
const ARCHIVO_CHROME = path.join(RAIZ, 'mis_archivos', 'ganadores', 'desde-chrome.json');
const existiaChrome = fs.existsSync(ARCHIVO_CHROME);
try {
  let lista = false;
  for (let i = 0; i < 80 && !lista; i++) {
    await new Promise((r) => setTimeout(r, 250));
    lista = await fetch(`${BASE}/api/inspiracion`).then((r) => r.ok).catch(() => false);
  }
  check('la app de prueba arrancó', lista, salidaApp.slice(-400));
  const { codigo } = await fetch(`${BASE}/api/inspiracion/chrome/codigo`, { headers: DE_APP }).then((r) => r.json());
  check('la app da un código de emparejamiento', /^[A-Z2-9]{6}(-[A-Z2-9]{6}){3}$/.test(codigo || ''), codigo);
  const importar = (cuerpo, cab = {}) => fetch(`${BASE}/api/inspiracion/importar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cab }, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
  const pre = await fetch(`${BASE}/api/inspiracion/importar`, { method: 'OPTIONS', headers: { Origin: EXT, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-kads-codigo' } });
  check('preflight de la extensión: 204 con su origen', pre.status === 204 && pre.headers.get('access-control-allow-origin') === EXT && /x-kads-codigo/i.test(pre.headers.get('access-control-allow-headers') || ''));
  const preMalo = await fetch(`${BASE}/api/inspiracion/importar`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'POST' } });
  check('preflight de otro sitio: 403 sin CORS', preMalo.status === 403 && !preMalo.headers.get('access-control-allow-origin'));
  const preOtraRuta = await fetch(`${BASE}/api/inspiracion/chrome`, { method: 'OPTIONS', headers: { Origin: EXT, 'Access-Control-Request-Method': 'GET' } });
  check('las otras rutas no abren CORS a la extensión', !preOtraRuta.headers.get('access-control-allow-origin'));
  const anuncioOk = { libraryId: '987654321012345', pagina: 'Marca Chrome', desde: 'Circulando desde el 1 sept 2026', activo: true, copy: 'Copy desde Chrome', titulo: 'Título', cta: 'Comprar', caption: 'MARCACHROME.COM', video: 'https://video.xx.fbcdn.net/v/t42/abc.mp4?oe=1', poster: 'https://scontent.xx.fbcdn.net/v/p.jpg', creativos: '3' };
  const sin = await importar({ anuncio: anuncioOk }, { Origin: EXT });
  check('sin código -> 401', sin.status === 401);
  const malo = await importar({ anuncio: anuncioOk }, { Origin: EXT, 'X-Kads-Codigo': 'AAAAAA-BBBBBB-CCCCCC-DDDDDD' });
  check('código equivocado -> 401', malo.status === 401);
  const otroOrigen = await importar({ anuncio: anuncioOk }, { Origin: 'https://evil.example.com', 'X-Kads-Codigo': codigo });
  check('otro origen (aunque tenga el código) -> 403', otroOrigen.status === 403);
  const grande = await importar({ anuncio: { ...anuncioOk, copy: 'x'.repeat(80 * 1024) } }, { Origin: EXT, 'X-Kads-Codigo': codigo });
  check('demasiado grande -> 413', grande.status === 413);
  const hostMalo = await importar({ anuncio: { ...anuncioOk, video: 'https://evil.example.com/v.mp4' } }, { Origin: EXT, 'X-Kads-Codigo': codigo });
  check('video de otro sitio -> 400', hostMalo.status === 400);
  const probar = await importar({ probar: true }, { Origin: EXT, 'X-Kads-Codigo': codigo.toLowerCase().replace(/-/g, ' ') });
  check('«Probar conexión» (el código sin guiones ni mayúsculas también sirve)', probar.status === 200);
  const bien = await importar({ anuncio: anuncioOk }, { Origin: EXT, 'X-Kads-Codigo': codigo });
  const jb = await bien.json();
  idImportado = jb.id;
  check('bien -> 201 y queda guardado', bien.status === 201 && jb.id === 'chrome_987654321012345' && jb.tipo === 'video', JSON.stringify(jb));
  const listado = await fetch(`${BASE}/api/inspiracion/chrome`).then((r) => r.json());
  const a = listado.anuncios.find((x) => x.id === idImportado);
  check('se lista en «Desde Chrome»', Boolean(a) && a.fuente === 'chrome' && a.anunciante.nombre === 'Marca Chrome' && a.creativos === 3 && a.dominio === 'marcachrome.com');
  check('con su video ya bajado a la app', a?.media === '/api/inspiracion/chrome/media/987654321012345.mp4' && a?.miniatura === '/api/inspiracion/chrome/media/987654321012345-p.jpg');
  check('validado por días (desde el 1 de septiembre)', a?.validado === true && a?.dias >= 30, `${a?.dias}`);
  const media = await fetch(`${BASE}${a?.media}`);
  check('el video se sirve desde la app', media.status === 200 && /video\/mp4/.test(media.headers.get('content-type') || ''));
  const proxyMalo = await fetch(`${BASE}/api/ganadores/media?u=${encodeURIComponent('https://evil.example.com/x.mp4')}`);
  check('el proxy rechaza otro sitio (400)', proxyMalo.status === 400);
  const proxyHttp = await fetch(`${BASE}/api/ganadores/media?u=${encodeURIComponent('http://video.xx.fbcdn.net/x.mp4')}`);
  check('el proxy rechaza http (400)', proxyHttp.status === 400);
  const metaSim = await fetch(`${BASE}/api/inspiracion/meta/buscar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...DE_APP }, body: JSON.stringify({ filtros: { texto: 'colágeno', paises: ['ES'], soloValidados: false } }) }).then((r) => r.json());
  check('Meta simulada en modo prueba (sin llamar a Meta), con página siguiente', metaSim.simulado === true && metaSim.anuncios.length > 0 && metaSim.siguiente === 'sim2', JSON.stringify(metaSim).slice(0, 200));
  const medioSim = await fetch(`${BASE}/api/inspiracion/meta/media/${metaSim.anuncios[0].metaId}`, { headers: DE_APP }).then((r) => r.json());
  check('el medio simulado de Meta', Boolean(medioSim.media || medioSim.error));
  const borrar = await fetch(`${BASE}/api/inspiracion/chrome/${idImportado}`, { method: 'DELETE', headers: DE_APP });
  const despues = await fetch(`${BASE}/api/inspiracion/chrome`).then((r) => r.json());
  check('se puede borrar (y sus archivos)', borrar.status === 200 && !despues.anuncios.some((x) => x.id === idImportado) && !fs.existsSync(path.join(RAIZ, 'temp', '_ganadores', 'chrome', '987654321012345.mp4')));
  idImportado = null;
} finally {
  if (idImportado) await fetch(`${BASE}/api/inspiracion/chrome/${idImportado}`, { method: 'DELETE', headers: DE_APP }).catch(() => {});
  app.kill();
  if (!existiaChrome) fs.rmSync(ARCHIVO_CHROME, { force: true });
}

console.log(`\n${pasan} bien, ${fallas} mal`);
process.exit(fallas ? 1 : 0);
