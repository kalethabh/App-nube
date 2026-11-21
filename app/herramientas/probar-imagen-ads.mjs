// Pruebas SIN RED del servidor de los anuncios de imagen (ESPECIFICACION-imagen-ads.md §14.4.2). No llama a kie, ni a
// Claude, ni a nadie: el motor es el falso (produccion/pruebas/motor-falso-imagen-ads.js, por ANUNCIOS_MOTOR_IMAGEN_ADS),
// Claude es uno de mentira dentro de este proceso, y ffmpeg es el de la PC (recortes y logo de verdad).
//
//   node app/herramientas/probar-imagen-ads.mjs        sale con 0 si todo paso y con 1 si algo fallo
//
// Que prueba:
//   1. el planificador: prioridades, nunca una tanda nueva con otra en curso, nunca un 9:16 antes de que su 1:1 este
//      terminado, ningun reintento automatico (todo al primer intento: lo que ve la revision queda «con detalles» con
//      su nota, y el vertical sale igual del cuadrado), un pedido en espera mientras su variacion esta en el motor, los
//      topes de las ordenes y cuando esta terminado;
//   2. el tope de 2 fallos del motor y los intentos de Claude que no cuentan;
//   3. el turno de Claude (una sola sesion para todos los lotes, con prioridad);
//   4. verificar: lo que frena y lo que solo avisa;
//   5. cargarYNormalizar sobre carpetas cortadas en cada fase (y un lote de antes con su reintento automatico pendiente);
//   6. el zip (leido de vuelta, con sus CRC);
//   7. el bucle completo con el motor falso: revision simulada (sin reintentos), logo, regenerar con y sin instruccion,
//      Detener a la mitad y seguir sin pagar dos veces, y dos fallos seguidos del motor;
//   8. dos lotes a la vez: nunca dos sesiones de Claude de lotes;
//   10. con ChatGPT (AIA_MOTOR=codex): tandas de 4 anuncios y revisiones de 8 cuadrados, una tanda ya repartida no se
//       vuelve a partir si cambia la IA, lo que lee cada sesion (`material`, pasado por las reglas de la tarea), la IA
//       del lote en estado.json y en la vista, y lo que no deja cambiar de IA (un lote revisando o ajustando).
// La IA la fija AIA_MOTOR (como en las demas pruebas): asi nunca se lee app/config.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import cp from 'node:child_process';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

process.env.ANUNCIOS_NO_RETOMAR = '1';
process.env.AIA_MOTOR = 'claude'; // lo de siempre; la seccion 10 la cambia a 'codex' y la vuelve a dejar
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '..');
const RAIZ = path.resolve(APP, '..');
const MOTOR_FALSO = 'pruebas/motor-falso-imagen-ads.js';

const plan = await import('../server/lib/imagen-ads/planificador.js');
const disco = await import('../server/lib/imagen-ads/disco.js');
const turno = await import('../server/lib/imagen-ads/turno-claude.js');
const verificar = await import('../server/lib/imagen-ads/verificar.js');
const estadoMod = await import('../server/lib/imagen-ads/estado.js');
const zipMod = await import('../server/lib/imagen-ads/zip.js');
const local = await import('../server/lib/imagen-ads/local.js');
const familia = await import('../server/lib/familias/imagen-ads.js');
const { R } = disco;

const resultados = [];
function check(nombre, ok, detalle) {
  resultados.push({ nombre, ok: Boolean(ok) });
  const d = !ok && detalle !== undefined ? `\n        → ${String(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 1500)}` : '';
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${d}`);
  return Boolean(ok);
}
const seccion = (t) => console.log(`\n== ${t}`);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const leer = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const escribir = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v, null, 2) + '\n');
};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'probar-imagen-ads-'));

// ---------------------------------------------------------------- PNG sin dependencias
const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function png(ancho, alto, pixel, { alfa = false } = {}) {
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii');
    const l = Buffer.alloc(4);
    l.writeUInt32BE(datos.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([l, t, datos, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = alfa ? 6 : 2;
  const bpp = alfa ? 4 : 3;
  const crudo = Buffer.alloc((1 + ancho * bpp) * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const p = pixel(x, y);
      for (let k = 0; k < bpp; k++) crudo[y * (1 + ancho * bpp) + 1 + x * bpp + k] = p[k];
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}
const fotoProducto = () => png(320, 320, (x, y) => (Math.abs(x - 160) < 60 && y > 80 && y < 280 ? [230, 120, 60] : [246, 244, 240]));
// el logo: un cuadrado opaco en el medio de un lienzo transparente (asi se prueba el recorte al alfa)
const logoRGBA = () => png(200, 120, (x, y) => (x > 50 && x < 150 && y > 30 && y < 90 ? [20, 40, 160, 255] : [0, 0, 0, 0]), { alfa: true });

// ---------------------------------------------------------------- un lote de prueba en disco
const SKILL = path.join(RAIZ, '.claude', 'skills', 'anuncios-imagen-ads');
const indice = leer(path.join(SKILL, 'formatos', 'indice.json')).formatos;
const angulos = leer(path.join(SKILL, 'angulos.json')).angulos;

function anuncioDePrueba(v, entrada, { textoExtra = '' } = {}) {
  const f = entrada?.formato_id ? leer(path.join(SKILL, indice.find((x) => x.id === entrada.formato_id).archivo)) : null;
  return {
    prompt_type: 'ad_creative_generation',
    ad_info: { variation_id: v, structure_source: 'library format', reference_style: 'premium', angle_used: entrada?.angulo || 'x', ad_format: 'Product Hero Ad', platform_goal: 'High-CTR' },
    global_identity: { color_palette: 'Navy #1E3A8A and cream', visual_style: 'Premium', visual_atmosphere: 'Calm', graphic_language: 'Soft', text_typography: 'Poppins Bold' },
    reference_structure_analysis: {
      layout_summary: 'Headline on top, product in the center.',
      detected_visual_blocks: (f?.detected_visual_blocks || [{ block_id: 'block_01' }]).map((b) => ({ block_id: b.block_id, block_type: 'product', position: 'center', visual_function: 'x', adaptation_rule: 'x', present_in_reference: true })),
      forbidden_additions: ['Price badges'],
    },
    visual_prompt: `Square premium product advertisement for a test jar. The attached product photo is the only source of truth for the product: keep its exact shape, label, colors and proportions. Headline at the top center in bold sans-serif, the product large in the center on a deep navy backdrop with soft studio light. Variation ${v}.`,
    text_layers: (f?.text_layers || [{ block_id: 'text_block_01' }]).map((t, i) => ({ block_id: t.block_id, reference_function: 'main headline', reference_position: 'top', text_style: 'Bold', text: `Texto de prueba ${v}.${i + 1}${textoExtra}` })),
    mandatory_visual_elements: ['The product'],
    final_generation_exclusions: ['Do not add any visual module that is not described in this prompt.'],
    language_rule: 'All visible text inside the generated image must be written in Spanish.',
  };
}

function planDePrueba(lote, n, formatos) {
  return {
    producto: 'Producto de prueba',
    lote,
    cantidad: n,
    proporciones: formatos,
    variaciones: Array.from({ length: n }, (_, i) => {
      const f = indice[i % indice.length];
      const a = angulos[i % angulos.length];
      return { id: disco.idDeV(i + 1), fuente: 'biblioteca', formato_id: f.id, formato: f.nombre, angulo_id: a.id, angulo: a.nombre, concepto: 'c', titular: `Titular ${i + 1}`, escena: 'Estudio', camara: 'Frontal' };
    }),
  };
}

/** Un lote listo para el paso `anuncios` (como lo dejan preparar y la estrategia). */
async function crearLote(nombre, { n = 3, formatos = ['1:1', '9:16'], logo = 'arriba-centro', escritos = Math.min(n, 4), base = TMP } = {}) {
  const carpeta = path.join(base, nombre);
  fs.rmSync(carpeta, { recursive: true, force: true });
  const brief = { slug: nombre, estilo: 'imagen-ads', familia: 'imagen-ads', titulo: 'Crème Luna', productoId: 'prueba-0000', fotoProducto: 1, datos: { nombre: 'Crème Luna', publico: '', precio: '79.90', moneda: 'S/', cta: '', pais: 'Perú', idioma: 'es', adicional: '', angulo: null }, cantidad: n, formatos, referencias: [], logo: logo ? { posicion: logo, archivo: 'entrada/logo.png' } : null, creado: new Date().toISOString() };
  escribir(R.brief(carpeta), brief);
  escribir(path.join(carpeta, 'entrada', 'producto.png'), fotoProducto());
  escribir(R.lote(carpeta), { version: 1, modelo: 'gpt-image-2-5-sunburst', resolucion: '2K', fondo: 'opaco', producto: 'entrada/producto.png', formatos, logo: logo ? { posicion: logo } : null });
  if (logo) await local.prepararLogo(carpeta, logoRGBA(), 'png');
  const p = planDePrueba(nombre, n, formatos);
  escribir(R.plan(carpeta), p);
  for (let i = 1; i <= escritos; i++) escribir(R.v(carpeta, disco.idDeV(i)), anuncioDePrueba(disco.idDeV(i), p.variaciones[i - 1]));
  return { carpeta, brief };
}

// ---------------------------------------------------------------- un Claude de mentira (en este proceso)
function claudeDePrueba({ demora = 80, carpetas }) {
  const stats = { enCurso: 0, maximo: 0, sesiones: [] };
  return {
    stats,
    prohibidasComunes: () => ['Bash', 'PowerShell', 'WebFetch', 'WebSearch'],
    async lanzarSesion(o) {
      stats.enCurso++;
      stats.maximo = Math.max(stats.maximo, stats.enCurso);
      stats.sesiones.push(o.tipo);
      try {
        await dormir(demora);
        if (o.senal?.aborted) return { ok: false, cancelado: true };
        // (2026-11-21h) una imagen rechazada por contenido: el mismo anuncio sin lo que frena
        if (o.tipo === 'imagen-ads-rechazo') {
          const m = o.prompt.match(/Edita temp\/(\S+?)\/(V\d{2,3})\.json/);
          const cr = m && carpetas.get(m[1]);
          if (!cr) return { ok: false, error: 'no conozco ese lote' };
          const ad = leer(R.v(cr, m[2]));
          ad.visual_prompt = `${String(ad.visual_prompt).replace(/\s*SIM-PROHIBIDO/g, '')} A calm, friendly scene.`;
          escribir(R.v(cr, m[2]), ad);
          const v = await o.verificar();
          return v.ok ? { ok: true } : { ok: false, error: 'no pasó', detalle: (v.errores || []).join('\n') };
        }
        const lote = o.prompt.match(/Carpeta del lote: temp\/(\S+)/)?.[1];
        const carpeta = carpetas.get(lote);
        if (!carpeta) return { ok: false, error: `no conozco ${lote}` };
        if (o.tipo === 'imagen-ads-prompts') {
          const p = leer(R.plan(carpeta));
          const ids = [...new Set(((o.prompt.match(/Haz solo el PASO 5 de: ([^.\n]+)\./) || [])[1] || '').match(/V\d{2,3}/g) || [])];
          for (const v of ids) escribir(R.v(carpeta, v), anuncioDePrueba(v, p.variaciones.find((x) => x.id === v)));
        } else if (o.tipo === 'imagen-ads-revision') {
          const id = o.prompt.match(/revision\/(R\d{3})\.json/)[1];
          const piezas = [...o.prompt.matchAll(/^- (V\d{2,3}_(?:1x1|9x16)) \(/gm)].map((m) => m[1]);
          escribir(R.revision(carpeta, id), { revisadas: piezas.map((p) => ({ pieza: p, ok: true, problemas: [] })) });
        } else if (o.tipo === 'imagen-ads-ajuste') {
          const id = o.prompt.match(/ajustes\/(A\d{3})\.json/)[1];
          const pedidos = [];
          for (const m of o.prompt.matchAll(/^- (U\d{4}) · (V\d{2,3})_(?:1x1|9x16) \([^)]*\): «(.*)»/gm)) {
            const [, u, v, instr] = m;
            const textos = /texto|titular/i.test(instr);
            if (textos) {
              const ad = leer(R.v(carpeta, v));
              ad.text_layers[0].text += ' (cambiado)';
              escribir(R.v(carpeta, v), ad);
            }
            pedidos.push({ id: u, aplicado: true, cambia_textos: textos, instruccion_en: `Apply: ${instr}`, resumen: 'Hecho' });
          }
          escribir(R.ajuste(carpeta, id), { pedidos });
        }
        const v = await o.verificar();
        return v.ok ? { ok: true, verificacion: v } : { ok: false, error: 'no pasó', detalle: (v.errores || []).join('\n'), bloqueado: v.bloqueado };
      } finally {
        stats.enCurso--;
      }
    },
  };
}

/** Un ctx como el del conductor, con el motor falso de verdad (un proceso aparte) y sin filas ni gasto. */
function ctxDe(lote, carpeta, brief, claude, { envMotor = {}, conductor = null } = {}) {
  const control = new AbortController();
  const ctx = {
    slug: lote,
    carpeta,
    carpetaArg: carpeta,
    brief,
    conductor: conductor || { pasos: [{ id: 'estrategia', estado: 'hecho' }, { id: 'anuncios', estado: 'corriendo' }] },
    paso: { id: 'anuncios' },
    senal: control.signal,
    control,
    frases: [],
    hijos: new Set(),
    guardar() {},
    avance(f) {
      if (f && ctx.frases[ctx.frases.length - 1] !== f) ctx.frases.push(f);
    },
    claude: async () => claude,
    esperar: async () => true,
    esperarConexion: async () => true,
    correr(script, args) {
      return new Promise((resolve) => {
        const hijo = cp.spawn(process.execPath, [path.join(RAIZ, 'produccion', script), ...args, '--ociosa', '1'], { cwd: RAIZ, env: { ...process.env, MOTOR_FALSO_MS: '15', ...envMotor }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        ctx.hijos.add(hijo);
        let texto = '';
        hijo.stdout.on('data', (d) => (texto += d));
        hijo.stderr.on('data', (d) => (texto += d));
        let cancelado = false;
        const alAbortar = () => {
          cancelado = true;
          hijo.kill();
        };
        control.signal.addEventListener('abort', alAbortar, { once: true });
        hijo.on('close', (codigo) => {
          ctx.hijos.delete(hijo);
          control.signal.removeEventListener('abort', alAbortar);
          resolve({ codigo, texto, cancelado, clase: codigo === 0 ? null : 'otro' });
        });
      });
    },
  };
  return ctx;
}

// =====================================================================================================================
seccion('1. El planificador');
{
  const formatos = ['1:1', '9:16'];
  const est = plan.nuevoEstado({ cantidad: 10, formatos });
  for (const v of ['V01', 'V02', 'V03', 'V04']) est.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
  const img = {};
  const hechos = (extra = {}) => ({ ahora: Date.now(), imagenes: { ...img }, recortes: {}, vistas: {}, finales: {}, ordenesVivas: [], conLogo: false, ...extra });
  const libre = { claudeLibre: true, motorLibre: true, localLibre: true, simulada: false };
  let d = plan.decidir(est, hechos(), libre);
  check('La primera orden lleva los cuadrados ya escritos (V01 a V04) y ningún vertical', d.orden?.piezas.map((x) => x.pieza).join() === 'V01_1x1,V02_1x1,V03_1x1,V04_1x1' && d.orden.piezas.every((x) => x.orden === 'g' && x.version === 1), d.orden);
  check('Con poco trabajo en el motor, Claude escribe los anuncios que faltan (de a 8, prioridad 1)', d.claude?.tipo === 'prompts' && d.claude.ids.join() === 'V05,V06,V07,V08,V09,V10' && d.claude.prioridad === 1, d.claude);
  check('Ninguna variación sin escribir va al motor', !d.orden.piezas.some((x) => ['V05', 'V06'].includes(disco.vDe(x.pieza))));
  plan.marcarOrden(est, 'T001', d.orden);
  plan.iniciarTanda(est, d.claude, 'E002', 'uuid-e2');
  d = plan.decidir(est, hechos(), libre);
  check('Nunca una tanda nueva con otra en curso: se vuelve a proponer la misma (E002)', d.claude?.tanda === 'E002' && !d.orden, d);
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  check('Con Claude ocupado no se propone ninguna tanda', d.claude === null);
  // el motor termina el primer cuadrado
  const lista = (p, extra = {}) => {
    const x = est.piezas[p];
    img[p] = `f-${p}-${x.orden.version}`;
    return plan.aplicarResultado(est, p, { orden: x.orden.id, estado: 'lista', version: x.orden.version, intentosApi: 1, ...extra }, { firmaActual: img[p] });
  };
  check('Una imagen lista queda por revisar (con la firma de su imagen)', lista('V01_1x1') === 'lista' && est.piezas.V01_1x1.fase === 'por-revisar' && est.piezas.V01_1x1.firma === img.V01_1x1, est.piezas.V01_1x1);
  check('El vertical de V01 sigue esperando a su cuadrado', est.piezas.V01_9x16.fase === 'espera-prompt' || est.piezas.V01_9x16.fase === 'espera-cuadrado', est.piezas.V01_9x16.fase);
  plan.aplicarPrompts(est, 'E002');
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  check('Con sus anuncios escritos, V05 a V10 entran al motor (solo los cuadrados)', d.orden?.piezas.map((x) => x.pieza).join() === 'V05_1x1,V06_1x1,V07_1x1,V08_1x1,V09_1x1,V10_1x1', d.orden);
  plan.marcarOrden(est, 'T002', d.orden);
  // revision: una pieza con recortes y sin anuncios por escribir -> se revisa
  d = plan.decidir(est, hechos({ recortes: { V01_1x1: img.V01_1x1 } }), libre);
  check('Sin anuncios por escribir, una sola imagen lista ya se revisa (prioridad 2)', d.claude?.tipo === 'revision' && d.claude.piezas.map((x) => x.pieza).join() === 'V01_1x1' && d.claude.prioridad === 2, d.claude);
  d = plan.decidir(est, hechos({ recortes: { V01_1x1: 'otra-firma' } }), libre);
  check('Sin recortes de ESA imagen (otra firma), no se revisa: se piden sus recortes', !d.claude && d.local.some((x) => x.tipo === 'recortes' && x.pieza === 'V01_1x1'), d);
  plan.iniciarTanda(est, { tipo: 'revision', formato: '1:1', piezas: [{ pieza: 'V01_1x1', firma: img.V01_1x1, ronda: 1 }] }, 'R001', 'u');
  plan.aplicarRevision(est, 'R001', { revisadas: [{ pieza: 'V01_1x1', ok: false, problemas: ['Una letra cambiada'], correccion_en: '  Write the headline exactly as "HOLA",\n with no accent.  ' }] }, { V01_1x1: img.V01_1x1 });
  check(
    'Falla la revisión: queda con detalles, con su nota y la corrección guardada para «otra versión» (ningún reintento automático)',
    est.piezas.V01_1x1.fase === 'final' &&
      est.piezas.V01_1x1.resultado === 'con-detalles' &&
      est.piezas.V01_1x1.ronda === 1 &&
      !est.piezas.V01_1x1.orden &&
      est.piezas.V01_1x1.revision?.problemas?.join() === 'Una letra cambiada' &&
      est.piezas.V01_1x1.revision?.correccion_en === 'Write the headline exactly as "HOLA", with no accent.',
    est.piezas.V01_1x1
  );
  plan.progresar(est, hechos());
  check('Con su cuadrado terminado (aunque con detalles), el vertical entra por pedir', est.piezas.V01_9x16.fase === 'por-pedir' && est.piezas.V01_9x16.orden?.id === 'g', est.piezas.V01_9x16);
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  check('Sin reintento: la orden siguiente no vuelve a pedir el cuadrado, y su vertical sale igual de él', d.orden?.piezas.some((x) => x.pieza === 'V01_9x16' && x.orden === 'g') && !d.orden.piezas.some((x) => x.pieza === 'V01_1x1' || x.orden === 'rev'), d.orden);
  {
    // «Hacer otra versión» (sin instrucción) de una imagen que la revisión marcó: lleva lo que salió mal; de una que
    // salió bien, no lleva nada (en un estado aparte, para no tocar el de arriba)
    const e2 = plan.nuevoEstado({ cantidad: 2, formatos: ['1:1'] });
    for (const v of ['V01', 'V02']) e2.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
    Object.assign(e2.piezas.V01_1x1, { fase: 'final', resultado: 'con-detalles', version: 1, firma: 'f1', revision: { tanda: 'R001', ronda: 1, ok: false, problemas: ['Un texto en la zona del logo'], firma: 'f1', correccion_en: 'Move the title out of the logo area.' } });
    Object.assign(e2.piezas.V02_1x1, { fase: 'final', resultado: 'listo', version: 1, firma: 'f2', revision: { tanda: 'R001', ronda: 1, ok: true, problemas: [], firma: 'f2' } });
    plan.absorberPedidos(e2, [
      { id: 'U0001', pieza: 'V01_1x1', instruccion: '', fecha: '2026-11-08T10:00:00Z' },
      { id: 'U0002', pieza: 'V02_1x1', instruccion: '', fecha: '2026-11-08T10:00:01Z' },
    ]);
    plan.progresar(e2, hechos());
    check('«Otra versión» de una imagen con detalles lleva lo que salió mal', e2.piezas.V01_1x1.orden?.id === 'U0001' && e2.piezas.V01_1x1.orden?.modo === 'generar' && e2.piezas.V01_1x1.orden?.correccion_en === 'Move the title out of the logo area.', e2.piezas.V01_1x1);
    check('«Otra versión» de una imagen que salió bien no lleva corrección', e2.piezas.V02_1x1.orden?.id === 'U0002' && !('correccion_en' in (e2.piezas.V02_1x1.orden || {})), e2.piezas.V02_1x1);
  }
  // la firma: una revision de otra imagen no vale
  lista('V02_1x1');
  plan.iniciarTanda(est, { tipo: 'revision', formato: '1:1', piezas: [{ pieza: 'V02_1x1', firma: img.V02_1x1, ronda: 1 }] }, 'R003', 'u');
  plan.aplicarRevision(est, 'R003', { revisadas: [{ pieza: 'V02_1x1', ok: true, problemas: [] }] }, { V02_1x1: 'la-imagen-cambio' });
  check('La revisión vale solo para la firma que miró: si la imagen cambió, vuelve a esperar revisión', est.piezas.V02_1x1.fase === 'por-revisar' && est.piezas.V02_1x1.firma === 'la-imagen-cambio', est.piezas.V02_1x1);
  est.piezas.V02_1x1.firma = img.V02_1x1;
  plan.iniciarTanda(est, { tipo: 'revision', formato: '1:1', piezas: [{ pieza: 'V02_1x1', firma: img.V02_1x1, ronda: 1 }] }, 'R004', 'u');
  plan.aplicarRevision(est, 'R004', { revisadas: [{ pieza: 'V02_1x1', ok: true, problemas: [] }] }, { V02_1x1: img.V02_1x1 });
  check('Pasa a la primera: listo', est.piezas.V02_1x1.resultado === 'listo');
  plan.progresar(est, hechos());
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  plan.marcarOrden(est, 'T004', d.orden);
  check('El vertical de V02 entra en una orden', est.piezas.V02_9x16.fase === 'pedida', est.piezas.V02_9x16);
  // un pedido sobre el cuadrado mientras su vertical esta en el motor: en espera
  plan.absorberPedidos(est, [{ id: 'U0001', pieza: 'V02_1x1', instruccion: '', fecha: '2026-11-08T10:00:00Z' }]);
  plan.progresar(est, hechos());
  check('Un pedido sobre un cuadrado cuyo vertical está en el motor queda en espera', est.pedidos.U0001.estado === 'en-espera' && est.piezas.V02_1x1.fase === 'final', est.pedidos.U0001);
  lista('V02_9x16');
  plan.iniciarTanda(est, { tipo: 'revision', formato: '9:16', piezas: [{ pieza: 'V02_9x16', firma: img.V02_9x16, ronda: 1 }] }, 'R005', 'u');
  plan.aplicarRevision(est, 'R005', { revisadas: [{ pieza: 'V02_9x16', ok: true, problemas: [] }] }, { V02_9x16: img.V02_9x16 });
  plan.progresar(est, hechos());
  check('Con la variación libre, el pedido arranca: el cuadrado se pide con su orden (ronda u)', est.pedidos.U0001.estado === 'generando' && est.piezas.V02_1x1.fase === 'por-pedir' && est.piezas.V02_1x1.orden?.id === 'U0001' && est.piezas.V02_1x1.ronda === 'u', { ped: est.pedidos.U0001, p: est.piezas.V02_1x1 });
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  check('El pedido del usuario va primero en la orden', d.orden?.piezas[0]?.orden === 'U0001' && d.orden.piezas[0].version === 2, d.orden);
  plan.marcarOrden(est, 'T005', d.orden);
  lista('V02_1x1');
  plan.progresar(est, hechos());
  check('Con la imagen nueva, el pedido queda revisando', est.pedidos.U0001.estado === 'revisando', est.pedidos.U0001);
  plan.iniciarTanda(est, { tipo: 'revision', formato: '1:1', piezas: [{ pieza: 'V02_1x1', firma: img.V02_1x1, ronda: 'u' }] }, 'R006', 'u');
  plan.aplicarRevision(est, 'R006', { revisadas: [{ pieza: 'V02_1x1', ok: false, problemas: ['Un detalle'] }] }, { V02_1x1: img.V02_1x1 });
  check('Lo que pidió el usuario (ronda u) tampoco se rehace solo: queda con detalles', est.piezas.V02_1x1.fase === 'final' && est.piezas.V02_1x1.resultado === 'con-detalles', est.piezas.V02_1x1);
  plan.progresar(est, hechos());
  check('Después del cuadrado, el pedido rehace su vertical (U0001-v, desde el cuadrado nuevo)', est.piezas.V02_9x16.fase === 'por-pedir' && est.piezas.V02_9x16.orden?.id === 'U0001-v' && est.piezas.V02_9x16.orden.modo === 'generar', est.piezas.V02_9x16);
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  plan.marcarOrden(est, 'T006', d.orden);
  lista('V02_9x16');
  plan.iniciarTanda(est, { tipo: 'revision', formato: '9:16', piezas: [{ pieza: 'V02_9x16', firma: img.V02_9x16, ronda: 'u' }] }, 'R007', 'u');
  plan.aplicarRevision(est, 'R007', { revisadas: [{ pieza: 'V02_9x16', ok: true, problemas: [] }] }, { V02_9x16: img.V02_9x16 });
  plan.progresar(est, hechos());
  check('Con los dos pasos hechos, el pedido queda listo', est.pedidos.U0001.estado === 'listo' && est.piezas.V02_9x16.version === 2, est.pedidos.U0001);
  // (2026-11-21h) una pieza que kie rechaza por contenido: la IA la reescribe y se pide otra vez, hasta 3 veces
  const rechazo = { estado: 'sin-imagen', motivo: 'contenido', mensaje: 'kie no quiso hacer esta imagen por sus reglas de contenido', intentosApi: 3 };
  let r = plan.aplicarResultado(est, 'V03_1x1', { orden: 'g', ...rechazo });
  check('Rechazada por contenido: no queda sin imagen, espera que la IA la reescriba', r === 'reescribir' && est.piezas.V03_1x1.fase === 'reescribiendo' && plan.piezasPorReescribir(est).join() === 'V03_1x1' && !plan.decidir(est, hechos(), { ...libre, claudeLibre: false }).terminado, est.piezas.V03_1x1);
  for (let k = 1; k <= plan.RESCATES_POR_CONTENIDO; k++) {
    plan.terminarRescate(est, 'V03_1x1', { ok: true });
    const p = est.piezas.V03_1x1;
    if (k === 1) check('Reescrita: se pide otra vez, con su propia orden (el motor recuerda la «g» como sin imagen)', p.fase === 'por-pedir' && p.orden?.id === 'g-r1' && p.intentosApi === 0, p);
    plan.marcarOrden(est, `T09${k}`, { piezas: [{ pieza: 'V03_1x1', orden: p.orden.id, modo: 'generar', version: 1 }] });
    r = plan.aplicarResultado(est, 'V03_1x1', { orden: `g-r${k}`, ...rechazo });
  }
  plan.progresar(est, hechos());
  check(`Después de ${plan.RESCATES_POR_CONTENIDO} reescrituras rechazadas: queda sin imagen, y su vertical también (falta el cuadrado)`, r === 'sin-imagen' && est.piezas.V03_1x1.resultado === 'sin-imagen' && est.piezas.V03_9x16.resultado === 'sin-imagen' && est.piezas.V03_9x16.motivo === 'falta-cuadrado', [est.piezas.V03_1x1, est.piezas.V03_9x16]);
  {
    const e2 = plan.nuevoEstado({ cantidad: 1, formatos: ['1:1'] });
    e2.variaciones.V01 = { prompt: 'listo', tanda: 'E001' };
    plan.progresar(e2, {});
    plan.marcarOrden(e2, 'T001', { piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'generar', version: 1 }] });
    plan.aplicarResultado(e2, 'V01_1x1', { orden: 'g', ...rechazo });
    plan.terminarRescate(e2, 'V01_1x1', { ok: false });
    check('Si la IA no pudo reescribirla: queda sin imagen como antes', e2.piezas.V01_1x1.fase === 'final' && e2.piezas.V01_1x1.resultado === 'sin-imagen' && e2.piezas.V01_1x1.motivo === 'contenido', e2.piezas.V01_1x1);
    const e3 = plan.nuevoEstado({ cantidad: 1, formatos: ['1:1'] });
    e3.variaciones.V01 = { prompt: 'listo', tanda: 'E001' };
    plan.progresar(e3, {});
    plan.marcarOrden(e3, 'T001', { piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'generar', version: 1 }] });
    check('Un fallo que no es de contenido: queda sin imagen enseguida (no se reescribe)', plan.aplicarResultado(e3, 'V01_1x1', { orden: 'g', estado: 'sin-imagen', motivo: 'fallo-de-kie', mensaje: 'kie falló' }) === 'sin-imagen' && e3.piezas.V01_1x1.resultado === 'sin-imagen');
  }
  d = plan.decidir(est, hechos(), { ...libre, claudeLibre: false });
  check('Una pieza sin imagen no se vuelve a pedir', !(d.orden?.piezas || []).some((x) => x.pieza.startsWith('V03_')), d.orden);

  // prioridades de Claude
  const e2 = plan.nuevoEstado({ cantidad: 12, formatos: ['1:1'] });
  for (const v of ['V01', 'V02', 'V03', 'V04']) e2.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
  for (const v of ['V01', 'V02']) {
    Object.assign(e2.piezas[`${v}_1x1`], { fase: 'final', resultado: 'listo', version: 1 });
  }
  Object.assign(e2.piezas.V03_1x1, { fase: 'por-revisar', firma: 'f3', version: 2, ronda: 'u', desde: new Date().toISOString() });
  e2.pedidos.U0002 = { id: 'U0002', pieza: 'V01_1x1', instruccion: 'Otro fondo', estado: 'pendiente', fecha: '2026-11-08T10:00:00Z' };
  const h2 = { ahora: Date.now(), imagenes: { V01_1x1: 'a', V02_1x1: 'b', V03_1x1: 'f3' }, recortes: { V03_1x1: 'f3' }, vistas: { V01_1x1: true, V03_1x1: true }, finales: {}, ordenesVivas: [], conLogo: false };
  d = plan.decidir(e2, h2, libre);
  check('Prioridad: primero el ajuste que pidió el usuario (prioridad 3)', d.claude?.tipo === 'ajuste' && d.claude.pedidos.join() === 'U0002' && d.claude.prioridad === 3, d.claude);
  e2.pedidos.U0002.estado = 'listo';
  d = plan.decidir(e2, h2, libre);
  check('Después, la revisión de lo que pidió el usuario, sin esperar a juntar (prioridad 3)', d.claude?.tipo === 'revision' && d.claude.prioridad === 3 && d.claude.piezas[0].pieza === 'V03_1x1', d.claude);
  e2.piezas.V03_1x1.ronda = 1;
  d = plan.decidir(e2, h2, libre);
  check('Sin eso, y con el motor casi vacío, primero se escriben más anuncios', d.claude?.tipo === 'prompts' && d.claude.ids[0] === 'V05' && d.claude.ids.length === 8, d.claude);

  // los topes de las ordenes
  const e3 = plan.nuevoEstado({ cantidad: 100, formatos: ['1:1'] });
  for (const v of Object.keys(e3.variaciones)) e3.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
  const tamanos = [];
  for (let i = 1; i <= 4; i++) {
    const x = plan.decidir(e3, { ordenesVivas: [] }, { claudeLibre: false, motorLibre: true, localLibre: false });
    tamanos.push(x.orden?.piezas.length || 0);
    if (x.orden) plan.marcarOrden(e3, `T00${i}`, x.orden);
  }
  check('Órdenes de hasta 24 piezas y como mucho 60 en el motor a la vez (24, 24, 12, 0)', tamanos.join() === '24,24,12,0', tamanos);
  check('V100 va después de V99 (por número, no como texto)', plan.listaDePiezas(e3).slice(-2).join() === 'V99_1x1,V100_1x1', plan.listaDePiezas(e3).slice(-3));

  // cuando esta terminado
  const e4 = plan.nuevoEstado({ cantidad: 1, formatos: ['1:1'] });
  e4.variaciones.V01 = { prompt: 'listo', tanda: 'E001' };
  Object.assign(e4.piezas.V01_1x1, { fase: 'final', resultado: 'listo', version: 1 });
  check('Terminado: todo final, sin pedidos, sin tandas y sin órdenes vivas', plan.decidir(e4, { imagenes: { V01_1x1: 'x' }, ordenesVivas: [] }, libre).terminado === true);
  check('No terminado con una orden viva', plan.decidir(e4, { imagenes: { V01_1x1: 'x' }, ordenesVivas: ['T001'] }, libre).terminado === false);
  check('No terminado con logo y sin su versión con logo', plan.decidir(e4, { imagenes: { V01_1x1: 'x' }, ordenesVivas: [], conLogo: true, finales: {} }, libre).terminado === false);
  e4.variaciones.V02 = { prompt: 'sin-prompt', tanda: 'E002' };
  e4.piezas.V02_1x1 = { v: 'V02', formato: '1:1', fase: 'espera-prompt', version: 0 };
  check('Una variación sin escribir (tanda fallida) no frena el final', plan.decidir(e4, { imagenes: { V01_1x1: 'x' }, ordenesVivas: [] }, libre).terminado === true);
}

// =====================================================================================================================
seccion('2. Los fallos que cuentan y los que no');
{
  const { lanzarMotor, correrTanda } = familia._pruebas;
  const carpeta = path.join(TMP, '_img-fallos-20261108-1200');
  fs.mkdirSync(carpeta, { recursive: true });
  const nuevoRun = () => ({ fallosMotor: 0, fallosLocal: 0, intentos: new Map(), limite: null, duro: null, frase: null, tanda: null, cache: new Map() });
  const ctxCon = (r) => ({ slug: 'x', carpeta, carpetaArg: carpeta, senal: new AbortController().signal, correr: async () => r });
  let run = nuevoRun();
  await lanzarMotor(ctxCon({ codigo: 1, texto: 'algo raro', clase: 'otro' }), run);
  check('Un fallo del motor: todavía no es error', run.fallosMotor === 1 && !run.duro, run);
  await lanzarMotor(ctxCon({ codigo: 1, texto: 'algo raro', clase: 'otro' }), run);
  check('Dos fallos seguidos del motor: error con «Continuar»', run.duro?.ok === false && run.duro.error?.mensaje && run.fallosMotor === 2, run.duro);
  run = nuevoRun();
  await lanzarMotor(ctxCon({ codigo: 1, texto: 'code=402 insufficient credits', clase: 'saldo' }), run);
  check('Sin saldo: pausa por saldo (sin cifras)', run.duro?.pausa?.motivo === 'saldo' && !/\d/.test(run.duro.pausa.mensaje), run.duro);
  run = nuevoRun();
  await lanzarMotor(ctxCon({ codigo: 1, texto: 'kie rechazo la clave (401)', clase: 'clave' }), run);
  check('Clave mala: error de clave', run.duro?.error?.motivo === 'clave', run.duro);
  run = nuevoRun();
  await lanzarMotor(ctxCon({ codigo: null, texto: '', cancelado: true }), run);
  check('Detener al motor no cuenta como fallo', run.fallosMotor === 0 && !run.duro);
  escribir(R.orden(carpeta, 'T001'), { id: 'T001', piezas: [{ pieza: 'V01_1x1', orden: 'g', modo: 'generar', version: 1 }] });
  run = nuevoRun();
  await lanzarMotor(ctxCon({ codigo: 0, texto: '' }), run);
  check('Si el motor sale bien pero no avanzó nada, cuenta como fallo (nunca se relanza sin fin)', run.fallosMotor === 1, run);
  escribir(R.resultado(carpeta, 'T001'), { id: 'T001', terminado: true, piezas: { V01_1x1: { orden: 'g', estado: 'lista' } } });
  run = nuevoRun();
  run.fallosMotor = 1;
  await lanzarMotor(ctxCon({ codigo: 0, texto: '' }), run);
  check('Si avanzó, el contador vuelve a 0', run.fallosMotor === 0, run);

  // los intentos de Claude
  const { carpeta: c2, brief: b2 } = await crearLote('_img-intentos-20261108-1200', { n: 6, formatos: ['1:1'], logo: null });
  const tanda = () => {
    const est = plan.nuevoEstado({ cantidad: 6, formatos: ['1:1'] });
    return est;
  };
  const conRespuestas = (lista) => {
    let i = 0;
    const llamadas = [];
    return { llamadas, prohibidasComunes: () => [], lanzarSesion: async (o) => (llamadas.push(o), lista[Math.min(i++, lista.length - 1)]) };
  };
  const probar = async (respuestas, { abortar = false } = {}) => {
    const est = tanda();
    const control = new AbortController();
    if (abortar) control.abort();
    const claude = conRespuestas(respuestas);
    const ctx = { slug: '_img-intentos-20261108-1200', carpeta: c2, carpetaArg: c2, brief: b2, senal: control.signal, claude: async () => claude };
    const run = nuevoRun();
    await correrTanda(ctx, est, run, { tipo: 'prompts', ids: ['V05', 'V06'], prioridad: 1 }, b2);
    return { est, run, claude, t: est.tandas.E001 || Object.values(est.tandas)[0] };
  };
  let x = await probar([{ ok: false, limite: true, error: 'Se acabó por ahora el uso de tu plan de Claude.' }]);
  check('El límite del plan no cuenta como intento (la tanda sigue en curso)', x.run.limite && !x.run.intentos.size && x.t.estado === 'en-curso' && x.claude.llamadas.length === 1, { run: x.run, t: x.t });
  x = await probar([{ ok: false, cancelado: true }], { abortar: true });
  check('Detener no cuenta como intento', !x.run.intentos.size && x.t.estado === 'en-curso');
  x = await probar([{ ok: false, ocupada: true, error: 'Claude ya está trabajando en esto.' }]);
  check('«Ya está trabajando en esto» no cuenta como intento', !x.run.intentos.size && x.t.estado === 'en-curso' && x.claude.llamadas.length === 1);
  x = await probar([{ ok: false, sinSesion: true, error: 'Tu Claude Code no tiene la sesión iniciada.' }]);
  check('Sin sesión de Claude: error (no cuenta como intento)', x.run.duro?.error?.motivo === 'claude' && !x.run.intentos.size);
  x = await probar([{ ok: false, error: 'mal' }, { ok: false, error: 'mal otra vez' }]);
  check('Dos fallos de verdad: la tanda queda fallida y sus anuncios sin escribir', x.t.estado === 'fallida' && x.est.variaciones.V05.prompt === 'sin-prompt' && x.claude.llamadas.length === 2 && x.claude.llamadas[1].resume === true, { t: x.t, v: x.est.variaciones.V05 });
  check('El segundo intento sigue la misma conversación (mismo uuid, resume)', x.claude.llamadas[0].uuid === x.claude.llamadas[1].uuid && /intento anterior no terminó/.test(x.claude.llamadas[1].prompt));
  check('Permisos de la sesión: escribe solo sus V##.json (lista exacta, sin comodines) y no puede usar la terminal', x.claude.llamadas[0].permitidas.includes(`Write(./temp/_img-intentos-20261108-1200/V05.json)`) && !x.claude.llamadas[0].permitidas.some((p) => /\*\.json|V\*/.test(p)) && !x.claude.llamadas[0].herramientas.includes('Bash'), x.claude.llamadas[0].permitidas);
  {
    const o = x.claude.llamadas[0];
    const p = leer(R.plan(c2));
    const formatosDe = ['V05', 'V06'].map((v) => `.claude/skills/anuncios-imagen-ads/${indice.find((f) => f.id === p.variaciones.find((y) => y.id === v).formato_id).archivo}`);
    const textos = o.material?.textos || [];
    check('La tanda le pasa a la IA su material (lo usa ChatGPT): la skill, plan.json y el formato de cada variación, con esfuerzo alto', textos[0] === '.claude/skills/anuncios-imagen-ads/SKILL.md' && textos.includes('temp/_img-intentos-20261108-1200/plan.json') && formatosDe.every((f) => textos.includes(f)) && o.esfuerzo === 'alto', { material: o.material, esfuerzo: o.esfuerzo });
  }
  x = await probar([{ ok: false, planSinCodex: true, error: 'Tu plan de ChatGPT no incluye Codex o ya no le queda uso. Revisa tu plan en chatgpt.com y después toca "Reintentar": lo ya hecho no se repite.' }]);
  check('Un plan de ChatGPT sin Codex: error con «Continuar» (no cuenta como intento ni deja la tanda fallida)', x.run.duro?.error?.motivo === 'claude' && /no incluye Codex/.test(x.run.duro.error.mensaje) && !x.run.intentos.size && x.t.estado === 'en-curso' && x.claude.llamadas.length === 1, { run: x.run, t: x.t });

  // La revisión es solo un aviso (decisión de Diego): si el plan se acaba en una tanda de REVISIÓN, sus imágenes quedan
  // «sin revisar» con su nota y el lote sigue; lo que llega después a revisar en esa vuelta tampoco espera
  {
    const est = tanda();
    const revisar = ['V01_1x1', 'V02_1x1'];
    for (const p of revisar) {
      est.variaciones[disco.vDe(p)] = { prompt: 'listo', tanda: 'E001' };
      Object.assign(est.piezas[p], { fase: 'por-revisar', version: 1, firma: `f-${p}`, desde: new Date().toISOString() });
    }
    const claude = conRespuestas([{ ok: false, limite: true, motor: 'claude', error: 'Se acabó por ahora el uso de tu plan de Claude.' }]);
    const ctx = { slug: '_img-intentos-20261108-1200', carpeta: c2, carpetaArg: c2, brief: b2, senal: new AbortController().signal, claude: async () => claude };
    const run = nuevoRun();
    await correrTanda(ctx, est, run, { tipo: 'revision', formato: '1:1', piezas: revisar.map((p) => ({ pieza: p, firma: est.piezas[p].firma, ronda: 1 })), prioridad: 2 }, b2);
    const t = Object.values(est.tandas).find((y) => y.tipo === 'revision');
    check(
      'Sin plan en una revisión: sus imágenes quedan «sin revisar» con su nota y el lote sigue (no espera al plan)',
      !run.limite && Boolean(run.sinRevision) && revisar.every((p) => est.piezas[p].fase === 'final' && est.piezas[p].resultado === 'sin-revisar' && /plan de Claude.*revísala tú/.test(est.piezas[p].mensaje || '')) && t?.estado === 'sin-plan' && claude.llamadas.length === 1,
      { run: { limite: run.limite, sinRevision: run.sinRevision }, piezas: revisar.map((p) => est.piezas[p]), t }
    );
    est.variaciones.V03 = { prompt: 'listo', tanda: 'E001' };
    Object.assign(est.piezas.V03_1x1, { fase: 'por-revisar', version: 1, firma: 'f-V03' });
    const despues = plan.dejarSinRevisar(est, plan.piezasPorRevisar(est), { mensaje: 'sin plan' });
    check('Y la que llega después a revisar tampoco espera: «sin revisar» (el lote sigue)', despues.join() === 'V03_1x1' && est.piezas.V03_1x1.resultado === 'sin-revisar' && est.piezas.V03_1x1.mensaje === 'sin plan', est.piezas.V03_1x1);
    check('La pantalla la muestra «Sin revisar» con su nota', estadoMod.estadoEnPantalla(est.piezas.V01_1x1) === 'sin-revisar');
    x = await probar([{ ok: false, limite: true, error: 'Se acabó por ahora el uso de tu plan de Claude.' }]);
    check('Escribir los anuncios que faltan sí espera al plan (la tanda sigue en curso, como siempre)', x.run.limite && !x.run.sinRevision && x.t.estado === 'en-curso', { run: x.run, t: x.t });
  }
}

// =====================================================================================================================
seccion('3. El turno de Claude (una sola sesión para todos los lotes)');
{
  turno.reiniciarTurno();
  check('El primero que pide, lo toma', turno.tomar('a', 1) === true);
  check('Mientras lo tiene, nadie más (ni con más prioridad)', turno.tomar('b', 3) === false && turno.tomar('c', 1) === false);
  check('El mismo lote no toma dos', turno.tomar('a', 3) === false);
  turno.soltar('a');
  check('Al soltarlo, le toca al de mayor prioridad (no al primero que llegó)', turno.tomar('c', 1) === false && turno.tomar('b', 3) === true);
  turno.soltar('b');
  check('Y después al que esperaba', turno.tomar('c', 1) === true);
  turno.soltar('c');
  check('Nunca hubo dos a la vez', turno.estadoDelTurno().maximo === 1, turno.estadoDelTurno());
  turno.reiniciarTurno();
}

// =====================================================================================================================
seccion('4. verificar: lo que frena y lo que solo avisa');
{
  const { carpeta, brief } = await crearLote('_img-verificar-20261108-1200', { n: 2, formatos: ['1:1', '9:16'], logo: 'abajo-derecha', escritos: 2 });
  let v = verificar.verificarV(carpeta, 'V01', { brief, plan: leer(R.plan(carpeta)) });
  check('Un V##.json bien hecho pasa (sin avisos)', !v.errores.length && !v.avisos.length, v);
  const ad = leer(R.v(carpeta, 'V01'));
  escribir(R.v(carpeta, 'V01'), { ...ad, visual_prompt: 'corto' });
  v = verificar.verificarV(carpeta, 'V01', { brief });
  check('Un visual_prompt corto frena', v.errores.some((e) => /visual_prompt/.test(e)), v.errores);
  escribir(R.v(carpeta, 'V01'), { ...ad, visual_prompt: `${ad.visual_prompt} ${'Very long description. '.repeat(1000)}` });
  v = verificar.verificarV(carpeta, 'V01', { brief });
  check('Un prompt de más de 19000 caracteres frena («acorta el visual_prompt»)', v.errores.some((e) => /acorta el visual_prompt de V01/.test(e)), v.errores);
  escribir(R.v(carpeta, 'V01'), { ...ad, ad_info: { ...ad.ad_info, variation_id: 'V09' }, text_layers: [{ text: '' }] });
  v = verificar.verificarV(carpeta, 'V01', { brief });
  check('Otro variation_id y un texto vacío frenan', v.errores.some((e) => /variation_id/.test(e)) && v.errores.some((e) => /text_layers\[0\]\.text/.test(e)), v.errores);
  escribir(R.v(carpeta, 'V01'), { ...ad, text_layers: [...ad.text_layers, { block_id: 'text_block_99', text: 'S/ 79.90' }] });
  v = verificar.verificarV(carpeta, 'V01', { brief, plan: leer(R.plan(carpeta)), usados: [{ angulo_id: leer(R.plan(carpeta)).variaciones[0].angulo_id, formato_id: leer(R.plan(carpeta)).variaciones[0].formato_id }] });
  check('Un bloque que no es del formato, el precio sin lugar y un par repetido solo avisan (no frenan)', !v.errores.length && v.avisos.length >= 2, v);
  escribir(R.v(carpeta, 'V01'), ad);
  let s = verificar.verificarSesion({ carpeta, brief, tipo: 'prompts', ids: ['V01', 'V02'] });
  check('La sesión de anuncios pasa con sus V##.json', s.ok, s);
  escribir(R.bloqueo(carpeta), { motivo: 'Falta el país', faltan: ['país'] });
  s = verificar.verificarSesion({ carpeta, brief, tipo: 'prompts', ids: ['V01'] });
  check('Con bloqueo.json: final y bloqueado (no se pide corregir)', s.ok === false && s.final === true && s.bloqueado === true && /Falta el país/.test(s.error), s);
  fs.rmSync(R.bloqueo(carpeta));
  const p = leer(R.plan(carpeta));
  escribir(R.plan(carpeta), { ...p, cantidad: 3, variaciones: [p.variaciones[1], p.variaciones[0]] });
  const vp = verificar.verificarPlan(carpeta, brief);
  check('plan.json con otra cantidad o los ids desordenados frena', vp.errores.some((e) => /cantidad/.test(e)) && vp.errores.some((e) => /variaciones\[0\]\.id/.test(e)), vp.errores);
  escribir(R.plan(carpeta), p);
  escribir(R.revision(carpeta, 'R001'), { revisadas: [{ pieza: 'V01_1x1', ok: false, problemas: [] }, { pieza: 'V09_1x1', ok: true, problemas: [] }] });
  const vr = verificar.verificarRevision(carpeta, 'R001', ['V01_1x1', 'V02_1x1']);
  check('Revisión: falta una pieza, sobra otra y un «ok: false» sin problemas frenan', vr.errores.some((e) => /falta V02_1x1/.test(e)) && vr.errores.some((e) => /V09_1x1/.test(e)) && vr.errores.some((e) => /problemas/.test(e)), vr.errores);
  escribir(R.ajuste(carpeta, 'A001'), { pedidos: [{ id: 'U0001', aplicado: true }, { id: 'U0002', aplicado: false }] });
  const va = verificar.verificarAjuste(carpeta, 'A001', [{ id: 'U0001', pieza: 'V01_1x1' }, { id: 'U0002', pieza: 'V02_9x16' }], brief);
  check('Ajuste: aplicado sin instruccion_en y no aplicado sin motivo frenan', va.errores.some((e) => /instruccion_en/.test(e)) && va.errores.some((e) => /motivo/.test(e)), va.errores);
}

// =====================================================================================================================
seccion('5. Al volver a abrir la app (cargarYNormalizar)');
{
  const { carpeta, brief } = await crearLote('_img-normalizar-20261108-1200', { n: 6, formatos: ['1:1'], logo: null });
  let est = estadoMod.cargarYNormalizar(carpeta, brief, { uuidEstrategia: 'u-e' });
  check('La primera vez: la estrategia (E001) ya hizo V01 a V04', est.tandas.E001?.estado === 'hecha' && est.tandas.E001.uuid === 'u-e' && ['V01', 'V02', 'V03', 'V04'].every((v) => est.variaciones[v].prompt === 'listo') && est.variaciones.V05.prompt === 'falta', est.tandas);
  // una revision cortada con su R###.json completo y de la misma imagen: se aplica
  escribir(R.img(carpeta, 'V01_1x1'), fotoProducto());
  escribir(R.img(carpeta, 'V02_1x1'), fotoProducto());
  const f1 = disco.firma(R.img(carpeta, 'V01_1x1'));
  const f2 = disco.firma(R.img(carpeta, 'V02_1x1'));
  Object.assign(est.piezas.V01_1x1, { fase: 'revisando', firma: f1, version: 1, tandaRevision: 'R001' });
  Object.assign(est.piezas.V02_1x1, { fase: 'revisando', firma: 'una-firma-vieja', version: 1, tandaRevision: 'R001' });
  est.tandas.R001 = { tipo: 'revision', formato: '1:1', piezas: [{ pieza: 'V01_1x1', firma: f1, ronda: 1 }, { pieza: 'V02_1x1', firma: 'una-firma-vieja', ronda: 1 }], uuid: 'u-r', estado: 'en-curso' };
  escribir(R.revision(carpeta, 'R001'), { revisadas: [{ pieza: 'V01_1x1', ok: true, problemas: [] }] });
  // una tanda de anuncios cortada
  est.tandas.E002 = { tipo: 'prompts', ids: ['V05', 'V06'], uuid: 'u-e2', estado: 'en-curso', empezada: true };
  est.variaciones.V05 = { prompt: 'en-tanda', tanda: 'E002' };
  est.variaciones.V06 = { prompt: 'en-tanda', tanda: 'E002' };
  // una orden que quedo escrita sin anotarse, y una pieza anotada en una orden que nunca se escribio
  Object.assign(est.piezas.V03_1x1, { fase: 'por-pedir', orden: { id: 'g', modo: 'generar', version: 1 } });
  escribir(R.orden(carpeta, 'T004'), { id: 'T004', piezas: [{ pieza: 'V03_1x1', orden: 'g', modo: 'generar', version: 1 }] });
  Object.assign(est.piezas.V04_1x1, { fase: 'pedida', orden: { id: 'g', modo: 'generar', version: 1, trabajo: 'T009' } });
  estadoMod.guardar(carpeta, est);
  est = estadoMod.cargarYNormalizar(carpeta, brief, {});
  check('La pieza cuya imagen cambió vuelve a esperar revisión (con su firma nueva)', est.piezas.V02_1x1.fase === 'por-revisar' && est.piezas.V02_1x1.firma === f2, est.piezas.V02_1x1);
  check('La revisión que ya estaba escrita (misma firma) se aplica', est.piezas.V01_1x1.fase === 'final' && est.piezas.V01_1x1.resultado === 'listo' && est.tandas.R001.estado === 'hecha', { p: est.piezas.V01_1x1, t: est.tandas.R001 });
  check('La tanda de anuncios cortada queda en curso, con su uuid, para volver a correrla', est.tandas.E002.estado === 'en-curso' && est.tandas.E002.uuid === 'u-e2' && est.variaciones.V05.prompt === 'en-tanda');
  check('La orden escrita sin anotar se reconoce (no se pide dos veces)', est.piezas.V03_1x1.fase === 'pedida' && est.piezas.V03_1x1.orden.trabajo === 'T004', est.piezas.V03_1x1);
  check('La pieza de una orden que nunca se escribió vuelve a estar por pedir', est.piezas.V04_1x1.fase === 'por-pedir' && !est.piezas.V04_1x1.orden.trabajo, est.piezas.V04_1x1);
  check('Los números siguen después de lo que hay en disco (T005, R002)', est.siguiente.T === 5 && est.siguiente.R >= 2, est.siguiente);
  {
    // un lote de antes del 2026-11-09: la pieza que esperaba su reintento automatico (sin salir al motor) queda «con
    // detalles» con su nota; la que ya estaba en el motor se deja terminar
    const viejo = await crearLote('_img-normalizar-viejo-20261108-1200', { n: 2, formatos: ['1:1'], logo: null });
    let e = estadoMod.cargarYNormalizar(viejo.carpeta, viejo.brief, { uuidEstrategia: 'u-e' });
    const revision = { tanda: 'R001', ronda: 1, ok: false, problemas: ['Una letra cambiada'], firma: 'f' };
    Object.assign(e.piezas.V01_1x1, { fase: 'reintento', ronda: 2, reintentoAuto: 'pedido', version: 1, firma: 'f', revision, orden: { id: 'rev', modo: 'generar', version: 2, motivo: 'revision' } });
    Object.assign(e.piezas.V02_1x1, { fase: 'pedida', ronda: 2, reintentoAuto: 'pedido', version: 1, firma: 'g', revision: { ...revision, firma: 'g' }, orden: { id: 'rev', modo: 'generar', version: 2, motivo: 'revision', trabajo: 'T003' } });
    escribir(R.orden(viejo.carpeta, 'T003'), { id: 'T003', piezas: [{ pieza: 'V02_1x1', orden: 'rev', modo: 'generar', version: 2 }] });
    estadoMod.guardar(viejo.carpeta, e);
    e = estadoMod.cargarYNormalizar(viejo.carpeta, viejo.brief, {});
    check('Un lote de antes: la pieza que esperaba su reintento automático queda «con detalles», sin pedir nada', e.piezas.V01_1x1.fase === 'final' && e.piezas.V01_1x1.resultado === 'con-detalles' && !e.piezas.V01_1x1.orden && e.piezas.V01_1x1.ronda === 1 && e.piezas.V01_1x1.revision?.problemas?.length === 1, e.piezas.V01_1x1);
    check('…y la que ya estaba en el motor se deja terminar (kie puede haberla cobrado)', e.piezas.V02_1x1.fase === 'pedida' && e.piezas.V02_1x1.orden?.id === 'rev' && e.piezas.V02_1x1.orden.trabajo === 'T003', e.piezas.V02_1x1);
  }
}

// =====================================================================================================================
seccion('6. El zip');
{
  const dir = path.join(TMP, 'zip');
  const a = path.join(dir, 'a.png');
  const b = path.join(dir, 'b.txt');
  escribir(a, fotoProducto());
  escribir(b, 'Un prompt con tildes: «Hidratación»\n');
  const planZip = await zipMod.prepararZip([
    { nombre: 'Crème Luna/V01-cuadrado.png', origen: a },
    { nombre: 'Crème Luna/prompts/V01-cuadrado.txt', origen: b },
    { nombre: 'Crème Luna/no-esta.png', origen: path.join(dir, 'no-esta.png') },
  ]);
  const trozos = [];
  const destino = new Writable({
    write(chunk, enc, cb) {
      trozos.push(chunk);
      cb();
    },
  });
  await zipMod.enviarZip(destino, planZip);
  const zip = Buffer.concat(trozos);
  check('El zip mide lo que dijo antes de empezar (Content-Length)', zip.length === planZip.tamano, { zip: zip.length, dijo: planZip.tamano });
  const fin = zip.length - 22;
  const n = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  const entradas = [];
  for (let i = 0; i < n; i++) {
    const largo = zip.readUInt16LE(p + 28);
    const nombre = zip.subarray(p + 46, p + 46 + largo).toString('utf8');
    const crc = zip.readUInt32LE(p + 16);
    const tam = zip.readUInt32LE(p + 20);
    const desde = zip.readUInt32LE(p + 42);
    const ln = zip.readUInt16LE(desde + 26);
    const datos = zip.subarray(desde + 30 + ln, desde + 30 + ln + tam);
    entradas.push({ nombre, ok: zlib.crc32(datos) === crc && zip.readUInt32LE(desde) === 0x04034b50 && (zip.readUInt16LE(p + 8) & 0x0800) !== 0 });
    p += 46 + largo;
  }
  check('El zip empieza con PK y trae 2 entradas (lo que no existe se salta)', zip.subarray(0, 2).toString() === 'PK' && n === 2, entradas);
  check('Nombres en UTF-8 y cada CRC coincide con su contenido', entradas.every((e) => e.ok) && entradas[0].nombre === 'Crème Luna/V01-cuadrado.png', entradas);

  // un archivo que se mueve (o se reemplaza) entre las dos pasadas: la descarga se corta, nunca queda colgada ni dañada
  const c = path.join(dir, 'c.png');
  escribir(c, fotoProducto());
  const planMovido = await zipMod.prepararZip([
    { nombre: 'x/V01-cuadrado.png', origen: a },
    { nombre: 'x/V02-cuadrado.png', origen: c },
  ]);
  fs.renameSync(c, path.join(dir, 'c-movido.png'));
  const corte = { bytes: 0, end: false, destroy: false };
  const destinoMovido = new Writable({
    write(chunk, enc, cb) {
      corte.bytes += chunk.length;
      cb();
    },
  });
  destinoMovido.end = () => (corte.end = true);
  const destruir = destinoMovido.destroy.bind(destinoMovido);
  destinoMovido.destroy = (e) => ((corte.destroy = true), destruir(e));
  const okMovido = await zipMod.enviarZip(destinoMovido, planMovido);
  check('Si un archivo se movió entre las dos pasadas, el zip se corta (destroy, sin end)', okMovido === false && corte.destroy && !corte.end && corte.bytes < planMovido.tamano, { okMovido, ...corte, tamano: planMovido.tamano });
  // y uno reemplazado por otro (mismo nombre, otro contenido): tambien se corta, no sale con el CRC viejo
  escribir(c, fotoProducto());
  const planReemplazo = await zipMod.prepararZip([{ nombre: 'x/V02-cuadrado.png', origen: c }]);
  await new Promise((r) => setTimeout(r, 20));
  escribir(c, Buffer.concat([fotoProducto(), Buffer.from('otro')]));
  const corte2 = { destroy: false };
  const destinoReemplazo = new Writable({ write: (chunk, enc, cb) => cb() });
  const destruir2 = destinoReemplazo.destroy.bind(destinoReemplazo);
  destinoReemplazo.destroy = (e) => ((corte2.destroy = true), destruir2(e));
  check('Si un archivo se reemplazó entre las dos pasadas, el zip se corta', (await zipMod.enviarZip(destinoReemplazo, planReemplazo)) === false && corte2.destroy, corte2);
}

// =====================================================================================================================
seccion('7. El bucle completo con el motor falso (revisión simulada, logo y ffmpeg de verdad)');
const ff = await local.comprobarFfmpeg();
if (!check(`ffmpeg con scale, crop, split y overlay (${ff.bin || 'no está'})`, ff.ok, ff)) {
  console.log('   (sin ffmpeg no se puede probar el bucle)');
} else {
  process.env.ANUNCIOS_MOTOR_IMAGEN_ADS = MOTOR_FALSO;
  process.env.ANUNCIOS_MODO_PRUEBA = '1'; // la revision va simulada (revision-simulada.js)
  delete process.env.ANUNCIOS_REVISION_REAL;
  turno.reiniciarTurno();
  const lote = '_img-bucle-20261108-1200';
  const { carpeta, brief } = await crearLote(lote, { n: 3, formatos: ['1:1', '9:16'], logo: 'arriba-centro' });
  const claude = claudeDePrueba({ carpetas: new Map([[lote, carpeta]]) });
  const creadas = () => listarResultados(carpeta).filter((x) => x.estado === 'lista' && x.creditos > 0).length;
  // Detener a la mitad y seguir: no se paga dos veces
  let ctx = ctxDe(lote, carpeta, brief, claude);
  const t0 = Date.now();
  const promesa = familia._pruebas.anuncios(ctx);
  while (Date.now() - t0 < 20000 && !listarResultados(carpeta).some((x) => x.estado === 'lista')) await dormir(50);
  ctx.control.abort();
  let r = await promesa;
  check('Detener a la mitad: el paso vuelve «cancelado» y no deja el motor vivo', r?.cancelado === true && ctx.hijos.size === 0, { r, hijos: ctx.hijos.size });
  const antes = creadas();
  ctx = ctxDe(lote, carpeta, brief, claude);
  r = await promesa2(familia._pruebas.anuncios(ctx), 120000);
  const est = leer(R.estado(carpeta));
  check('Sigue desde donde quedó y termina bien', r?.ok === true, { r, frases: ctx.frases.slice(-4) });
  const res = Object.fromEntries(Object.entries(est?.piezas || {}).map(([p, x]) => [p, x.resultado]));
  check(
    'Todo al primer intento: V01 listo; V02 y V03 «Revísala» en el cuadrado y V02 también en el vertical (nada se rehízo solo)',
    res.V01_1x1 === 'listo' && res.V02_1x1 === 'con-detalles' && res.V03_1x1 === 'con-detalles' && res.V02_9x16 === 'con-detalles' && res.V01_9x16 === 'listo' && res.V03_9x16 === 'listo' && !Object.values(res).includes('arreglado'),
    res
  );
  const enImg = (fs.existsSync(R.dirImg(carpeta)) ? fs.readdirSync(R.dirImg(carpeta)) : []).filter((n) => n.endsWith('.png'));
  check('En img/ quedan solo las 6 finales', enImg.length === 6 && enImg.every((n) => disco.RE_PIEZA.test(n.replace('.png', ''))), enImg);
  const enFinal = (fs.existsSync(R.dirFinal(carpeta)) ? fs.readdirSync(R.dirFinal(carpeta)) : []).filter((n) => n.endsWith('.png'));
  check('En final/ las 6 con el logo, al día', enFinal.length === 6 && enImg.every((n) => local.finalAlDia(carpeta, n.replace('.png', ''), { posicion: 'arriba-centro' })), enFinal);
  // cada (pieza, orden) se hace una sola vez y ninguna se rehace sola: 6. Si Detener corto al motor justo despues de
  // bajar una imagen, al seguir la reconoce (0 creditos) en vez de pedirla otra vez: por eso las pagadas pueden ser 5 o 6.
  const hechas = listarResultados(carpeta).filter((x) => x.estado === 'lista').map((x) => `${x.pieza}:${x.orden}`);
  check(
    `Cada imagen se hizo una sola vez: 6 en total (ningún reintento), sin pagar dos veces lo de antes de Detener (${antes} antes, ${creadas()} pagadas)`,
    hechas.length === 6 && new Set(hechas).size === 6 && hechas.every((x) => x.endsWith(':g')) && creadas() <= 6 && creadas() >= 5,
    { hechas, pagadas: creadas(), antes }
  );
  check('Sin reintentos no hay versiones anteriores (versiones/ sin V02 ni V03)', ['V02_1x1', 'V03_1x1', 'V02_9x16'].every((p) => !fs.existsSync(R.versionPng(carpeta, p, 1))));
  check('Los recortes de lo ya revisado se borraron (la vista queda)', fs.existsSync(R.dirRevision(carpeta)) && !fs.readdirSync(R.dirRevision(carpeta)).some((n) => /_r[1-4]\.png$/.test(n)) && fs.existsSync(R.vista(carpeta, 'V01_1x1')));
  const geo = leer(R.finalJson(carpeta, 'V01_9x16'));
  check('El logo del vertical va dentro de la zona segura (del 15,5 % hacia abajo)', geo && geo.y >= Math.round(0.155 * 512) - 1 && geo.y + geo.alto <= 512 * 0.845, geo);
  check('Avance: la frase dice cuántas van («… de 6 listas»)', ctx.frases.some((f) => /de 6 listas/.test(f)), ctx.frases.slice(-3));
  const vista = estadoMod.vistaDelLote({ lote, carpeta, brief, conductor: { estado: 'listo', paso: 'informe', pasos: [] } });
  const v1 = vista.variaciones[0].piezas['1:1'];
  check('La vista: url con logo (final/), miniatura armada por el servidor y sin prompts', /\/final\/V01_1x1\.png\?v=/.test(v1.url) && /\/archivos\/miniatura\/imagen-ads\/.+\?ancho=480&v=/.test(v1.miniatura) && v1.hayPrompt === true && !JSON.stringify(vista).includes('EXACT VISIBLE TEXT'), v1);
  check('La vista: V03 cuadrado «te-necesita» con su problema', vista.variaciones[2].piezas['1:1'].estado === 'te-necesita' && vista.variaciones[2].piezas['1:1'].problemas.length === 1, vista.variaciones[2].piezas['1:1']);
  check('La vista: V02 vertical también «te-necesita» con su nota, y se puede regenerar', vista.variaciones[1].piezas['9:16'].estado === 'te-necesita' && vista.variaciones[1].piezas['9:16'].problemas.length === 1 && vista.variaciones[1].piezas['9:16'].puedeRegenerar === true, vista.variaciones[1].piezas['9:16']);

  // regenerar sin instruccion
  escribir(R.pedidos(carpeta), { pedidos: [{ id: 'U0001', pieza: 'V01_1x1', instruccion: '', fecha: new Date().toISOString() }] });
  ctx = ctxDe(lote, carpeta, brief, claude);
  r = await promesa2(familia._pruebas.anuncios(ctx), 90000);
  let e2 = leer(R.estado(carpeta));
  check('Regenerar sin instrucción: el cuadrado y su vertical pasan a la versión 2', r?.ok && e2.piezas.V01_1x1.version === 2 && e2.piezas.V01_9x16.version === 2 && e2.pedidos.U0001.estado === 'listo', { r, p1: e2.piezas.V01_1x1, p2: e2.piezas.V01_9x16, ped: e2.pedidos.U0001 });
  check('La versión 1 queda en versiones/ y final/ se rehízo con la nueva', fs.existsSync(R.versionPng(carpeta, 'V01_1x1', 1)) && local.finalAlDia(carpeta, 'V01_1x1', { posicion: 'arriba-centro' }));
  // regenerar con instruccion que cambia un texto, sobre el vertical: se edita el cuadrado y el vertical sale de el
  escribir(R.pedidos(carpeta), { pedidos: [...leer(R.pedidos(carpeta)).pedidos, { id: 'U0002', pieza: 'V03_9x16', instruccion: 'Cambia el texto del titular', fecha: new Date().toISOString() }] });
  ctx = ctxDe(lote, carpeta, brief, claude);
  r = await promesa2(familia._pruebas.anuncios(ctx), 90000);
  e2 = leer(R.estado(carpeta));
  const ordenes = listarResultados(carpeta).filter((x) => String(x.orden).startsWith('U0002'));
  check('Con instrucción: la IA ajusta (A001) y se edita el cuadrado; después el vertical sale del cuadrado', r?.ok && e2.tandas.A001?.estado === 'hecha' && e2.pedidos.U0002.estado === 'listo' && ordenes.map((x) => x.orden).sort().join() === 'U0002,U0002-v' && e2.piezas.V03_1x1.version === 2, { r, A: e2.tandas.A001, ped: e2.pedidos.U0002, ordenes });
  check('El ajuste puso al día el V##.json (texto cambiado)', /\(cambiado\)/.test(JSON.stringify(leer(R.v(carpeta, 'V03')).text_layers)));
  check('El prompt del cuadrado editado es el de edición (lo guardó el motor antes de llamar)', /^Edit this advertising image/.test(fs.readFileSync(R.prompt(carpeta, 'V03_1x1'), 'utf8')));

  // dos fallos seguidos del motor
  const lote3 = '_img-motor-roto-20261108-1200';
  const l3 = await crearLote(lote3, { n: 1, formatos: ['1:1'], logo: null });
  ctx = ctxDe(lote3, l3.carpeta, l3.brief, claude, { envMotor: { MOTOR_FALSO_CODIGO: '1' } });
  r = await promesa2(familia._pruebas.anuncios(ctx), 60000);
  check('Con el motor fallando: error con «Continuar» después de 2 fallos (no un bucle sin fin)', r?.ok === false && r.error?.mensaje && !r.cancelado, r);

  // el bucle se cae (el disco no deja guardar) con Claude y el motor andando: no vuelve con nada vivo escribiendo
  turno.reiniciarTurno();
  const lote4 = '_img-se-cae-20261108-1200';
  const l4 = await crearLote(lote4, { n: 6, formatos: ['1:1'], logo: null });
  const lento = claudeDePrueba({ demora: 2500, carpetas: new Map([[lote4, l4.carpeta]]) });
  // el motor despacio (cada imagen tarda), para que siga andando mientras la IA escribe: sin reintentos automaticos
  // (todo al primer intento) ya no hay otra orden que lo vuelva a lanzar con la IA trabajando
  ctx = ctxDe(lote4, l4.carpeta, l4.brief, lento, { envMotor: { MOTOR_FALSO_MS: '1200' } });
  const avanceDeVerdad = ctx.avance;
  ctx.avance = (f) => {
    if (ctx.hijos.size && lento.stats.enCurso) throw Object.assign(new Error('EPERM: operation not permitted, rename conductor.json'), { code: 'EPERM' });
    return avanceDeVerdad(f);
  };
  let cayo = null;
  try {
    r = await promesa2(familia._pruebas.anuncios(ctx), 90000);
  } catch (e) {
    cayo = e;
  }
  const vivos = { motor: ctx.hijos.size, claude: lento.stats.enCurso, turno: turno.estadoDelTurno().ocupado };
  check('Si el bucle se cae, el error sale (el conductor lo muestra con «Continuar»)', cayo?.code === 'EPERM', { cayo: String(cayo), r });
  check('… y no deja vivos ni el motor ni la sesión de Claude, ni el turno tomado', vivos.motor === 0 && vivos.claude === 0 && !vivos.turno, vivos);
  const marca = fs.statSync(R.estado(l4.carpeta)).mtimeMs;
  await dormir(1500);
  check('… y nadie vuelve a escribir estado.json después', fs.statSync(R.estado(l4.carpeta)).mtimeMs === marca);

  // dos lotes a la vez: una sola sesion de Claude
  seccion('7c. Una imagen que el filtro rechaza por contenido se reescribe sola y sale (2026-11-21h)');
  {
    turno.reiniciarTurno();
    const lp = '_img-politica-20261121-2200';
    const P = await crearLote(lp, { n: 2, formatos: ['1:1'], logo: null });
    const ad = leer(R.v(P.carpeta, 'V02'));
    ad.visual_prompt += ' SIM-PROHIBIDO';
    escribir(R.v(P.carpeta, 'V02'), ad);
    const cp2 = claudeDePrueba({ carpetas: new Map([[lp, P.carpeta]]) });
    const rp = await promesa2(familia._pruebas.anuncios(ctxDe(lp, P.carpeta, P.brief, cp2)), 120000);
    const ep = leer(R.estado(P.carpeta));
    const hechasP = listarResultados(P.carpeta).map((x) => `${x.pieza}:${x.orden}:${x.estado}`);
    check('El lote termina y V02 tiene su imagen (no quedó «sin imagen»)', rp?.ok === true && ep?.piezas?.V02_1x1?.resultado !== 'sin-imagen' && fs.existsSync(R.img(P.carpeta, 'V02_1x1')), { rp, V02: ep?.piezas?.V02_1x1, hechasP });
    check('Primero kie la rechazó (g) y después salió la reescrita (g-r1)', hechasP.includes('V02_1x1:g:sin-imagen') && hechasP.includes('V02_1x1:g-r1:lista'), hechasP);
    check('La IA reescribió solo lo que se ve: el anuncio rechazado queda al lado, los textos iguales', fs.existsSync(path.join(P.carpeta, 'V02.rechazado-1.json')) && !JSON.stringify(leer(R.v(P.carpeta, 'V02'))).includes('SIM-PROHIBIDO') && JSON.stringify(leer(R.v(P.carpeta, 'V02')).text_layers) === JSON.stringify(ad.text_layers) && cp2.stats.sesiones.includes('imagen-ads-rechazo'), cp2.stats.sesiones);
  }
  seccion('8. Dos lotes a la vez');
  turno.reiniciarTurno();
  const la = '_img-uno-20261108-1200';
  const lb = '_img-dos-20261108-1200';
  const A = await crearLote(la, { n: 7, formatos: ['1:1'], logo: null });
  const B = await crearLote(lb, { n: 7, formatos: ['1:1'], logo: null });
  const compartido = claudeDePrueba({ demora: 300, carpetas: new Map([[la, A.carpeta], [lb, B.carpeta]]) });
  process.env.ANUNCIOS_REVISION_REAL = '1'; // aca la revision la hace el Claude de mentira (para que haya mas sesiones)
  const [ra, rb] = await Promise.all([promesa2(familia._pruebas.anuncios(ctxDe(la, A.carpeta, A.brief, compartido)), 120000), promesa2(familia._pruebas.anuncios(ctxDe(lb, B.carpeta, B.brief, compartido)), 120000)]);
  delete process.env.ANUNCIOS_REVISION_REAL;
  check('Los dos lotes terminan', ra?.ok === true && rb?.ok === true, { ra, rb });
  check(`Nunca hubo dos sesiones de Claude de lotes a la vez (${compartido.stats.sesiones.length} sesiones)`, compartido.stats.maximo === 1 && compartido.stats.sesiones.length >= 4 && turno.estadoDelTurno().maximo <= 1, compartido.stats);

  // con ChatGPT, el bucle de verdad: tandas de 4 anuncios y revisiones de 8 cuadrados como mucho
  seccion('8b. Un lote con ChatGPT (AIA_MOTOR=codex)');
  turno.reiniciarTurno();
  process.env.AIA_MOTOR = 'codex';
  process.env.ANUNCIOS_REVISION_REAL = '1'; // la revision la hace la IA de mentira (asi se ven sus tandas)
  const lc = '_img-chatgpt-20261108-1200';
  const LC = await crearLote(lc, { n: 13, formatos: ['1:1'], logo: null });
  const iaChatGPT = claudeDePrueba({ demora: 60, carpetas: new Map([[lc, LC.carpeta]]) });
  const ctxC = ctxDe(lc, LC.carpeta, LC.brief, iaChatGPT);
  const rc = await promesa2(familia._pruebas.anuncios(ctxC), 120000);
  delete process.env.ANUNCIOS_REVISION_REAL;
  process.env.AIA_MOTOR = 'claude';
  const ec = leer(R.estado(LC.carpeta));
  const tandasC = Object.values(ec?.tandas || {});
  const deAnuncios = tandasC.filter((t) => t.tipo === 'prompts').map((t) => t.ids.length);
  const deRevision = tandasC.filter((t) => t.tipo === 'revision').map((t) => t.piezas.length);
  check(`Con ChatGPT el lote termina con tandas de 4 anuncios (${deAnuncios.join(', ')}) y revisiones de 8 cuadrados como mucho (${deRevision.join(', ')})`, rc?.ok === true && deAnuncios.join() === '4,4,1' && deRevision.length >= 2 && Math.max(...deRevision) <= 8, { rc, deAnuncios, deRevision });
  check('El avance nombra a ChatGPT («ChatGPT está escribiendo 4 anuncios»)', ctxC.frases.some((f) => /ChatGPT está escribiendo 4 anuncios/.test(f)) && !ctxC.frases.some((f) => /Claude está/.test(f)), ctxC.frases.filter((f) => /está/.test(f)).slice(0, 4));
}

// =====================================================================================================================
seccion('9. Para los videos todo da igual que antes');
{
  const colas = await import('../server/lib/colas.js');
  const { describirHerramienta } = await import('../server/lib/claude.js');
  const conCuota = (slug, n, o) => {
    const k = colas.cuotaKie(slug, n, o);
    k.soltar();
    return k.limite;
  };
  check('cuotaKie sin tope: la cuenta de siempre (18 solo, 9 con dos activos)', conCuota('video-a', 1) === 18 && conCuota('video-a', 2) === 9);
  check('cuotaKie con el tope de un lote: 6 como mucho', conCuota('_img-a', 1, { tope: 6 }) === 6 && conCuota('_img-b', 3, { tope: 6 }) === 6);
  check('cuotaKie con tope vacío o 0 se porta como sin tope', conCuota('video-b', 1, { tope: null }) === 18 && conCuota('video-b', 1, { tope: 0 }) === 18);
  check('El motor de los lotes va por la fila de kie (recursosDe)', colas.recursosDe('generar-imagen-ads.js', ['temp/_img-x'], { que: ['imagenes'] }).kie === true && colas.recursosDe('generar-imagen-ads.js', []).kie === true);
  {
    // el motor falso solo entra en modo prueba y pedido a proposito: en la app de verdad siempre corre el real
    const antes = { m: process.env.ANUNCIOS_MOTOR_IMAGEN_ADS, p: process.env.ANUNCIOS_MODO_PRUEBA };
    const con = (motor, prueba) => {
      if (motor === undefined) delete process.env.ANUNCIOS_MOTOR_IMAGEN_ADS;
      else process.env.ANUNCIOS_MOTOR_IMAGEN_ADS = motor;
      if (prueba) process.env.ANUNCIOS_MODO_PRUEBA = '1';
      else delete process.env.ANUNCIOS_MODO_PRUEBA;
      return familia.scriptDelMotor();
    };
    const casos = [con(undefined, false), con(MOTOR_FALSO, false), con('otro-script.js', true), con(undefined, true), con(MOTOR_FALSO, true)];
    con(antes.m, antes.p === '1');
    check('El motor real (generar-imagen-ads.js) en la app de verdad; el falso solo en modo prueba y pedido a propósito', casos.slice(0, 4).every((s) => s === 'generar-imagen-ads.js') && casos[4] === MOTOR_FALSO, casos);
  }
  const videos = [
    ['Read', { file_path: 'D:/x/temp/claymation-1/img/toma-1-inicial.png' }, 'Mirando las imágenes del anuncio'],
    ['Read', { file_path: 'D:/x/.claude/skills/anuncios-claymation/SKILL.md' }, 'Leyendo las instrucciones del estilo'],
    ['Write', { file_path: 'temp/claymation-1/app/revision.json' }, 'Anotando lo que vio en las imágenes'],
    ['Write', { file_path: 'temp/claymation-1/manifiesto.json' }, 'Escribiendo el guion y cada escena'],
    ['Read', { file_path: 'temp/claymation-1/producto.json' }, 'Leyendo lo que contaste de tu producto'],
  ];
  check('Las frases de Claude de los videos no cambian', videos.every(([n, e, f]) => describirHerramienta(n, e) === f), videos.map(([n, e]) => describirHerramienta(n, e)));
  const deLotes = [
    ['Read', { file_path: 'D:/x/temp/_img-crema-20261109-1502/revision/V03_1x1_r2.png' }, 'Leyendo los textos de cada imagen'],
    ['Write', { file_path: 'temp/_img-crema-20261109-1502/plan.json' }, 'Armando el plan del lote'],
    ['Write', { file_path: 'temp/_img-crema-20261109-1502/V07.json' }, 'Escribiendo cada anuncio'],
    ['Write', { file_path: 'temp/_img-crema-20261109-1502/revision/R004.json' }, 'Anotando lo que vio en las imágenes'],
    ['Read', { file_path: 'D:/x/.claude/skills/anuncios-imagen-ads/formatos/F03-antes-despues.json' }, 'Eligiendo el formato de cada anuncio'],
  ];
  check('Las frases nuevas de los anuncios de imagen', deLotes.every(([n, e, f]) => describirHerramienta(n, e) === f), deLotes.map(([n, e]) => describirHerramienta(n, e)));
}

// =====================================================================================================================
seccion('10. Con ChatGPT (AIA_MOTOR=codex): las tandas, el material, la IA del lote y el cambio de IA');
try {
  const libre = { claudeLibre: true, motorLibre: true, localLibre: true, simulada: false };
  const vacio = () => ({ ahora: Date.now(), imagenes: {}, recortes: {}, vistas: {}, finales: {}, ordenesVivas: [], conLogo: false });
  const conPrompts = (n, formatos = ['1:1']) => {
    const e = plan.nuevoEstado({ cantidad: n, formatos });
    for (const v of ['V01', 'V02', 'V03', 'V04']) e.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
    return e;
  };
  check(
    'Tamaños: con Claude 8 anuncios y 8 cuadrados por tanda; con ChatGPT 4 y 8; sin IA elegida, los de Claude; las verticales, 6 con las dos',
    plan.promptsPorTanda('claude') === 8 && plan.revisionCuadrados('claude') === 8 && plan.promptsPorTanda('codex') === 4 && plan.revisionCuadrados('codex') === 8 && plan.promptsPorTanda(null) === 8 && plan.revisionCuadrados(null) === 8 && plan.TOPES.revisionVerticales === 6
  );
  process.env.AIA_MOTOR = 'codex';
  check('Sin decirle la IA, el planificador usa la elegida (AIA_MOTOR=codex: 4 y 8)', plan.promptsPorTanda() === 4 && plan.revisionCuadrados() === 8);
  let d = plan.decidir(conPrompts(20), vacio(), libre);
  check('Con ChatGPT los anuncios que faltan se escriben de a 4 (V05 a V08)', d.claude?.tipo === 'prompts' && d.claude.ids.join() === 'V05,V06,V07,V08' && d.claude.prioridad === 1, d.claude);
  d = plan.decidir(conPrompts(20), vacio(), { ...libre, motor: 'claude' });
  check('opciones.motor manda sobre la elegida (con Claude, de a 8)', d.claude?.ids.length === 8, d.claude);

  // una tanda ya repartida no se vuelve a partir si cambia la IA
  process.env.AIA_MOTOR = 'claude';
  const e2 = conPrompts(20);
  d = plan.decidir(e2, vacio(), libre);
  plan.iniciarTanda(e2, d.claude, 'E002', 'u-e2');
  process.env.AIA_MOTOR = 'codex';
  d = plan.decidir(e2, vacio(), libre);
  check('Una tanda de 8 repartida con Claude sigue igual con ChatGPT (E002, V05 a V12): no se parte de nuevo', d.claude?.tanda === 'E002' && d.claude.ids.join() === 'V05,V06,V07,V08,V09,V10,V11,V12', d.claude);
  plan.aplicarPrompts(e2, 'E002');
  d = plan.decidir(e2, vacio(), libre);
  check('La tanda nueva que sigue ya es de 4 (V13 a V16)', d.claude?.tipo === 'prompts' && !d.claude.tanda && d.claude.ids.join() === 'V13,V14,V15,V16', d.claude);

  // la revision: 8 cuadrados con ChatGPT (41 imagenes), 6 verticales con las dos
  const listasParaRevisar = (n, formato) => {
    const e = plan.nuevoEstado({ cantidad: n, formatos: formato === '1:1' ? ['1:1'] : ['1:1', '9:16'] });
    const h = vacio();
    for (const v of Object.keys(e.variaciones)) {
      e.variaciones[v] = { prompt: 'listo', tanda: 'E001' };
      const c = disco.piezaId(v, '1:1');
      h.imagenes[c] = `f-${c}`;
      h.vistas[c] = true;
      if (formato === '1:1') Object.assign(e.piezas[c], { fase: 'por-revisar', firma: `f-${c}`, version: 1, desde: new Date().toISOString() });
      else Object.assign(e.piezas[c], { fase: 'final', resultado: 'listo', version: 1, firma: `f-${c}` });
      if (formato === '1:1') h.recortes[c] = `f-${c}`;
      else {
        const p = disco.piezaId(v, '9:16');
        Object.assign(e.piezas[p], { fase: 'por-revisar', firma: `f-${p}`, version: 1, desde: new Date().toISOString() });
        h.imagenes[p] = `f-${p}`;
        h.recortes[p] = `f-${p}`;
      }
    }
    return { e, h };
  };
  let { e: e3, h: h3 } = listasParaRevisar(10, '1:1');
  d = plan.decidir(e3, h3, { ...libre, motorLibre: false });
  check('Con ChatGPT una revisión de cuadrados lleva 8, como Claude (8 × 5 + la foto = 41 imágenes; el tope es 48)', d.claude?.tipo === 'revision' && d.claude.formato === '1:1' && d.claude.piezas.length === 8, d.claude);
  process.env.AIA_MOTOR = 'claude';
  d = plan.decidir(e3, h3, { ...libre, motorLibre: false });
  check('Con Claude, 8 (lo de siempre)', d.claude?.tipo === 'revision' && d.claude.piezas.length === 8, d.claude);
  plan.iniciarTanda(e3, d.claude, 'R001', 'u-r1');
  process.env.AIA_MOTOR = 'codex';
  d = plan.decidir(e3, h3, { ...libre, motorLibre: false });
  check('Una revisión de 8 repartida con Claude se vuelve a correr entera con ChatGPT (R001, las mismas 8)', d.claude?.tanda === 'R001' && d.claude.piezas.length === 8, d.claude);
  ({ e: e3, h: h3 } = listasParaRevisar(8, '9:16'));
  d = plan.decidir(e3, h3, { ...libre, motorLibre: false });
  check('Con ChatGPT una revisión de verticales sigue siendo de 6 (6 × 6 + la foto = 37 imágenes)', d.claude?.tipo === 'revision' && d.claude.formato === '9:16' && d.claude.piezas.length === 6, d.claude);

  // lo que lee cada sesion (material), pasado por las reglas de su tarea como lo arma la app para ChatGPT
  const ses = await import('../server/lib/imagen-ads/sesiones.js');
  const reglasMod = await import('../server/lib/ia/reglas.js');
  const materialMod = await import('../server/lib/ia/material.js');
  const RAIZ_F = path.join(TMP, 'raiz'); // una raiz de mentira, con la skill copiada y el lote en su temp/
  fs.cpSync(SKILL, path.join(RAIZ_F, '.claude', 'skills', 'anuncios-imagen-ads'), { recursive: true });
  const lm = '_img-material-20261108-1200';
  const { carpeta: cm, brief: bm } = await crearLote(lm, { n: 10, formatos: ['1:1', '9:16'], logo: null, escritos: 10, base: path.join(RAIZ_F, 'temp') });
  for (const r of ['R01', 'R02']) escribir(path.join(cm, 'entrada', 'referencias', `${r}.png`), fotoProducto());
  bm.referencias = ['entrada/referencias/R01.png', 'entrada/referencias/R02.png'];
  escribir(R.brief(cm), bm);
  escribir(R.ficha(cm), { nombre: 'Crème Luna' });
  escribir(R.anterior(cm), { identidad: 'azul' });
  escribir(R.usados(cm), [{ angulo_id: angulos[0].id, formato_id: indice[0].id }]);
  const planM = leer(R.plan(cm));
  planM.variaciones[4] = { ...planM.variaciones[4], fuente: 'referencia', referencia: 'entrada/referencias/R01.png', formato_id: null, formato: 'Tu referencia' };
  escribir(R.plan(cm), planM);
  const armar = async (s) => {
    const p = ses.permisos(lm, s.escribe, { conSkill: s.conSkill });
    const reglas = reglasMod.traducir(p.permitidas, p.prohibidas, { raiz: RAIZ_F });
    return materialMod.armarMaterial({ prompt: s.prompt, material: s.material }, reglas, { convertir: false });
  };
  const S = '.claude/skills/anuncios-imagen-ads';
  const L = `temp/${lm}`;
  const sinNegados = (m) => !m.denegados.length && !m.faltan.length && !m.error;
  const relesDe = (lista) => lista.map((x) => x.rel);

  const sE = ses.sesionEstrategia({ carpeta: cm, lote: lm, brief: bm });
  const mE = await armar(sE);
  check(
    'Estrategia: la skill fija, la ficha, el lote anterior y lo ya usado pegados; la foto y las 2 referencias adjuntas; esfuerzo alto',
    sE.material.textos.join() === [`${S}/SKILL.md`, `${S}/angulos.json`, `${S}/formatos/indice.json`, `${L}/entrada/ficha-producto.json`, `${L}/entrada/lote-anterior.json`, `${L}/entrada/usados.json`].join() &&
      sE.material.imagenes.join() === [`${L}/entrada/producto.png`, `${L}/entrada/referencias/R01.png`, `${L}/entrada/referencias/R02.png`].join() &&
      sE.esfuerzo === 'alto',
    sE.material
  );
  check('Estrategia: los 57 formatos/*.json a pedido y, con 9:16, proporciones.md', sE.material.aPedido.length === 58 && sE.material.aPedido.filter((r) => r.startsWith(`${S}/formatos/`)).length === 57 && sE.material.aPedido.includes(`${S}/proporciones.md`), sE.material.aPedido.length);
  check(
    'Estrategia: las reglas de la tarea dejan pasar todo (nada negado ni faltante); los formatos quedan a pedido, no pegados',
    sinNegados(mE) && [`${S}/SKILL.md`, `${S}/angulos.json`, `${S}/formatos/indice.json`, `${L}/entrada/usados.json`].every((r) => relesDe(mE.textos).includes(r)) && relesDe(mE.imagenes).length === 3 && mE.aPedido.length === 57 && !relesDe(mE.textos).some((r) => /formatos\/F\d/.test(r)),
    { denegados: mE.denegados, faltan: mE.faltan, textos: relesDe(mE.textos), imagenes: relesDe(mE.imagenes), aPedido: mE.aPedido.length }
  );

  escribir(R.productoJson(cm), { producto: 'Crème Luna', foto_producto: `${L}/entrada/producto.png` });
  const sP = ses.sesionPrompts({ carpeta: cm, lote: lm, brief: bm, ids: ['V05', 'V06', 'V07', 'V08'] });
  const formatosP = ['V06', 'V07', 'V08'].map((v) => `${S}/${indice.find((f) => f.id === planM.variaciones.find((x) => x.id === v).formato_id).archivo}`);
  const mP = await armar(sP);
  check(
    'Anuncios: la skill, producto.json, plan.json y el formato de cada variación de la biblioteca; la referencia de la que sale de una, adjunta',
    sP.material.textos.join() === [`${S}/SKILL.md`, `${L}/producto.json`, `${L}/plan.json`, ...new Set(formatosP)].join() && sP.material.imagenes.join() === `${L}/entrada/referencias/R01.png` && sP.esfuerzo === 'alto',
    sP.material
  );
  check('Anuncios: las reglas de la tarea dejan pasar todo', sinNegados(mP) && sP.material.textos.every((r) => relesDe(mP.textos).includes(r)) && relesDe(mP.imagenes).join() === `${L}/entrada/referencias/R01.png`, { denegados: mP.denegados, faltan: mP.faltan, textos: relesDe(mP.textos), imagenes: relesDe(mP.imagenes) });

  const archivosDeRevision = (pieza) => {
    escribir(R.vista(cm, pieza), fotoProducto());
    for (let i = 1; i <= 4; i++) escribir(R.recorte(cm, pieza, i), fotoProducto());
  };
  const cuadrados8 = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06', 'V07', 'V08'].map((v) => disco.piezaId(v, '1:1'));
  cuadrados8.forEach(archivosDeRevision);
  const sR = ses.sesionRevision({ carpeta: cm, lote: lm, brief: bm, tanda: 'R001', t: { formato: '1:1', piezas: cuadrados8.map((p) => ({ pieza: p, firma: 'x', ronda: 1 })) } });
  const mR = await armar(sR);
  check(
    'Revisión de 8 cuadrados: 41 imágenes (la foto primero; por pieza su vista y sus 4 recortes) y sus 8 V##.json; sin la skill',
    sR.material.imagenes.length === 41 && sR.material.imagenes[0] === `${L}/entrada/producto.png` && sR.material.imagenes[1] === `${L}/revision/V01_1x1_vista.jpg` && sR.material.imagenes[5] === `${L}/revision/V01_1x1_r4.png` && sR.material.textos.length === 8 && !sR.esfuerzo,
    sR.material
  );
  check('Revisión: las reglas de la tarea dejan pasar las 41 imágenes y los 8 V##.json', sinNegados(mR) && mR.imagenes.length === 41 && sR.material.textos.every((r) => relesDe(mR.textos).includes(r)) && !relesDe(mR.textos).some((r) => r.startsWith('.claude/')), { denegados: mR.denegados, faltan: mR.faltan, imagenes: mR.imagenes.length, textos: relesDe(mR.textos) });
  const verticales6 = ['V01', 'V02', 'V03', 'V04', 'V05', 'V06'].map((v) => disco.piezaId(v, '9:16'));
  verticales6.forEach(archivosDeRevision);
  const sV = ses.sesionRevision({ carpeta: cm, lote: lm, brief: bm, tanda: 'R002', t: { formato: '9:16', piezas: verticales6.map((p) => ({ pieza: p, firma: 'x', ronda: 1 })) } });
  const mV = await armar(sV);
  check('Revisión de 6 verticales: 37 imágenes (cada una con la vista de su cuadrado) y las reglas las dejan pasar', sV.material.imagenes.length === 37 && sV.material.imagenes.includes(`${L}/revision/V06_1x1_vista.jpg`) && sinNegados(mV) && mV.imagenes.length === 37, { n: sV.material.imagenes.length, denegados: mV.denegados, faltan: mV.faltan });

  const sA = ses.sesionAjuste({ carpeta: cm, lote: lm, brief: bm, tanda: 'A001', pedidos: [{ id: 'U0001', pieza: 'V02_1x1', instruccion: 'Cambia el titular' }, { id: 'U0002', pieza: 'V03_9x16', instruccion: 'Otro fondo' }] });
  const mA = await armar(sA);
  check(
    'Ajuste: la skill y cada V##.json pedido pegados; la vista de cada imagen y la foto adjuntas',
    sA.material.textos.join() === [`${S}/SKILL.md`, `${L}/V02.json`, `${L}/V03.json`].join() && sA.material.imagenes.join() === [`${L}/revision/V02_1x1_vista.jpg`, `${L}/revision/V03_9x16_vista.jpg`, `${L}/entrada/producto.png`].join() && sinNegados(mA) && mA.imagenes.length === 3,
    { material: sA.material, denegados: mA.denegados, faltan: mA.faltan }
  );

  // la IA del lote: estado.json (la sesion de la estrategia) y la vista
  const { carpeta: ci, brief: bi } = await crearLote('_img-ia-20261108-1200', { n: 2, formatos: ['1:1'], logo: null });
  let ei = estadoMod.cargarYNormalizar(ci, bi, { uuidEstrategia: 'u-e', motorEstrategia: 'codex' });
  estadoMod.guardar(ci, ei);
  const loteIA = '_img-ia-20261108-1200';
  let vi = estadoMod.vistaDelLote({ lote: loteIA, carpeta: ci, brief: bi, conductor: { estado: 'corriendo', paso: 'anuncios', pasos: [] } });
  let ri = estadoMod.resumenDelLote({ lote: loteIA, carpeta: ci, brief: bi, conductor: { estado: 'corriendo', paso: 'anuncios', pasos: [] } });
  check('El estado guarda la IA de la estrategia (E001.motor) y la vista y «Tus lotes» la mandan: codex', ei.tandas.E001.motor === 'codex' && vi.motor === 'codex' && ri.motor === 'codex', { E001: ei.tandas.E001, vista: vi.motor, resumen: ri.motor });
  ri = estadoMod.resumenDelLote({ lote: loteIA, carpeta: ci, brief: bi, conductor: { estado: 'esperando', motivo: 'limite-claude', paso: 'anuncios', pasos: [{ id: 'anuncios', error: { motivo: 'limite-claude', mensaje: 'x', motor: 'claude' } }] } });
  check('Un lote que espera que se renueve un plan dice de qué IA es ese plan', ri.motor === 'claude', ri);
  delete ei.tandas.E001.motor;
  estadoMod.guardar(ci, ei);
  vi = estadoMod.vistaDelLote({ lote: loteIA, carpeta: ci, brief: bi, conductor: null });
  check('Un lote de antes (sin la IA anotada) lo hizo Claude; sin estrategia todavía, ninguna', vi.motor === 'claude' && estadoMod.motorDelLote(null, null) === null && estadoMod.motorDelLote(null, { pasos: [{ id: 'estrategia', motor: 'codex' }] }) === 'codex', vi.motor);
  ei = estadoMod.cargarYNormalizar(ci, bi, { motorEstrategia: 'codex' });
  check('Al seguir un lote de antes, se completa con la IA del paso', ei.tandas.E001.motor === 'codex', ei.tandas.E001);
  {
    // el paso de la estrategia: anota la IA que la hizo (la manda motor-ia en r.motor) y le pasa su material
    const le = '_img-estrategia-20261108-1200';
    const { carpeta: cs, brief: bs } = await crearLote(le, { n: 2, formatos: ['1:1'], logo: null, escritos: 0 });
    const llamadas = [];
    const iaE = { prohibidasComunes: () => [], lanzarSesion: async (o) => (llamadas.push(o), { ok: true, motor: 'codex', verificacion: { ok: true, errores: [], avisos: [] } }) };
    const pasoE = { id: 'estrategia' };
    turno.reiniciarTurno();
    const rE = await familia._pruebas.estrategia({ slug: le, carpeta: cs, carpetaArg: cs, brief: bs, paso: pasoE, senal: new AbortController().signal, guardar() {}, avance() {}, claude: async () => iaE });
    const o = llamadas[0] || {};
    check(
      'La estrategia anota en su paso la IA que la hizo y le pasa su material (la skill pegada, los formatos a pedido) con esfuerzo alto',
      rE?.ok === true && pasoE.motor === 'codex' && o.material?.textos?.[0] === '.claude/skills/anuncios-imagen-ads/SKILL.md' && o.material.imagenes?.[0] === `temp/${le}/entrada/producto.png` && o.material.aPedido?.length === 57 && o.esfuerzo === 'alto' && !turno.estadoDelTurno().ocupado,
      { rE, motor: pasoE.motor, material: o.material && { textos: o.material.textos, imagenes: o.material.imagenes, aPedido: o.material.aPedido?.length }, esfuerzo: o.esfuerzo }
    );
  }

  // lo que no deja cambiar de IA (motor-ia.elegirMotor lo pregunta con alPreguntarLotesOcupados)
  const { lotesEnMarcha } = familia._pruebas;
  check('Sin lotes en marcha, se puede cambiar de IA', familia.hayLoteRevisandoOAjustando() === false);
  lotesEnMarcha.set('_img-x', { tandas: { E002: { tipo: 'prompts', estado: 'en-curso' }, R001: { tipo: 'revision', estado: 'hecha' } } });
  const escribiendo = familia.hayLoteRevisandoOAjustando();
  lotesEnMarcha.get('_img-x').tandas.R002 = { tipo: 'revision', estado: 'en-curso' };
  const revisando = familia.hayLoteRevisandoOAjustando();
  lotesEnMarcha.get('_img-x').tandas.R002.estado = 'hecha';
  lotesEnMarcha.get('_img-x').tandas.A001 = { tipo: 'ajuste', estado: 'en-curso' };
  const ajustando = familia.hayLoteRevisandoOAjustando();
  lotesEnMarcha.delete('_img-x');
  check('Un lote con una revisión o un ajuste repartido no deja cambiar de IA; escribiendo anuncios, sí', escribiendo === false && revisando === true && ajustando === true && familia.hayLoteRevisandoOAjustando() === false, { escribiendo, revisando, ajustando });

  // la frase del avance nombra a la IA elegida
  const ef = plan.nuevoEstado({ cantidad: 6, formatos: ['1:1'] });
  ef.tandas.E002 = { tipo: 'prompts', ids: ['V05', 'V06', 'V07', 'V08'], estado: 'en-curso' };
  const frase = (run, ia = true) => familia._pruebas.fraseDelLote(ef, run, { claude: ia });
  const conChatGPT = [frase({ tanda: 'E002', frase: 'ChatGPT empezó a trabajar' }), frase({ tanda: 'E002', frase: 'Escribiendo cada anuncio' }), frase({ limite: { motor: 'codex' } }, false)];
  process.env.AIA_MOTOR = 'claude';
  const conClaude = frase({ tanda: 'E002', frase: 'Claude empezó a trabajar' });
  check(
    'La frase del lote nombra a la IA: «ChatGPT está escribiendo 4 anuncios»; con Claude, la de siempre',
    conChatGPT[0] === 'ChatGPT está escribiendo 4 anuncios · 0 de 6 listas' && conChatGPT[1] === 'ChatGPT está escribiendo 4 anuncios: escribiendo cada anuncio · 0 de 6 listas' && conChatGPT[2] === 'ChatGPT está en pausa hasta que se renueve tu plan · 0 de 6 listas' && conClaude === 'Claude está escribiendo 4 anuncios · 0 de 6 listas',
    { conChatGPT, conClaude }
  );
} catch (e) {
  check('La sección 10 corre entera', false, String(e?.stack || e));
} finally {
  process.env.AIA_MOTOR = 'claude';
}

// =====================================================================================================================
seccion('11. Plantillas: la app dibuja los textos; el modelo solo hace la escena (sin texto)');
try {
  const plantillas = await import('../server/lib/imagen-ads/plantillas.js');
  const render = await import('../server/lib/plantillas/render.js');
  const costoMod = await import('../server/lib/imagen-ads/costo.js');
  const lotesMod = await import('../server/lib/imagen-ads/lotes.js');
  process.env.ANUNCIOS_MOTOR_IMAGEN_ADS = MOTOR_FALSO;
  process.env.ANUNCIOS_MODO_PRUEBA = '1';
  process.env.ANUNCIOS_SIN_RECORTE = '1';
  turno.reiniciarTurno();
  // (dentro de la carpeta de la app: el dibujante solo sirve imágenes de ahí)
  const BASE = path.join(RAIZ, 'temp', `_prueba-plantillas-${process.pid}`);
  const FICHA = {
    nombre: 'Crème Luna Colágeno',
    queEs: 'Suplemento en cápsulas a base de colágeno, biotina y vitamina C.',
    beneficios: ['Piel más firme', 'Uñas más fuertes', 'Cabello con brillo', 'Fácil de tomar', 'Sin azúcar añadida', 'Para todos los días'],
    dolor: 'Siente que la piel se le ve apagada, que se le quiebran las uñas y que el cabello no tiene brillo.',
    ingredientes: '500 mg de colágeno hidrolizado, 30 mcg de biotina y 80 mg de vitamina C.',
    comoSeUsa: 'Tomar 2 cápsulas al día durante 3 meses.',
    probo: 'Cremas caras y tratamientos',
  };
  const crearDePlantillas = (nombre, elegidas, n, formatos = ['1:1', '9:16']) => {
    const carpeta = path.join(BASE, nombre);
    fs.rmSync(carpeta, { recursive: true, force: true });
    const brief = { slug: nombre, estilo: 'imagen-ads', familia: 'imagen-ads', titulo: 'Crème Luna', productoId: 'prueba-0000', fotoProducto: 1, datos: { nombre: 'Crème Luna Colágeno', publico: 'Mujeres de 30 a 50', pais: 'Perú', idioma: 'es' }, cantidad: n, formatos, referencias: [], logo: null, rapido: true, plantillas: { elegidas }, creado: new Date().toISOString() };
    escribir(R.brief(carpeta), brief);
    fs.mkdirSync(path.join(carpeta, 'entrada'), { recursive: true });
    fs.copyFileSync(path.join(APP, 'muestras', 'plantillas', 'producto-muestra.png'), path.join(carpeta, 'entrada', 'producto.png'));
    escribir(path.join(carpeta, 'entrada', 'ficha-producto.json'), FICHA);
    escribir(R.lote(carpeta), { version: 1, modelo: 'gpt-image-2-5-sunburst', resolucion: '2K', fondo: 'opaco', producto: 'entrada/producto.png', formatos, logo: null, fiel: false });
    return { carpeta, brief };
  };
  const claude = claudeDePrueba({ carpetas: new Map() });

  // el dibujante: frío (arma o lee el armado guardado y abre el navegador) y caliente
  let t = Date.now();
  const cal = await render.calentar();
  const msFrio = Date.now() - t;
  check(`El dibujante arranca (${cal.armado === 'nuevo' ? 'armado nuevo' : 'armado guardado'}: ${msFrio} ms, ${cal.aLaVez} a la vez)`, cal.ok !== false && msFrio < 120000, cal);

  // ---- 11a. un lote solo de plantillas sin escena: costo 0, sin el modelo de imagen
  const soloApp = ['producto-flechas', 'lista-iconos', 'burbujas', 'sticker-oferta'];
  const a = crearDePlantillas('_img-plantillas-gratis-20261117-1200', soloApp, 4);
  check('Plantillas sin escena: 0 imágenes por pagar y costo 0 (aunque haya precio por imagen)', lotesMod.piezasPorHacer(a.carpeta, a.brief) === 0 && costoMod.costoMaximoDeLaAccion({ dolaresPorImagen: 0.05 }, a.brief) === 0, { n: lotesMod.piezasPorHacer(a.carpeta, a.brief) });
  let ctx = ctxDe(a.brief.slug, a.carpeta, a.brief, claude);
  t = Date.now();
  let r = await familia._pruebas.estrategia(ctx);
  const msEstrategia = Date.now() - t;
  ctx.brief = leer(R.brief(a.carpeta));
  r = r?.ok ? await promesa2(familia._pruebas.anuncios(ctx), 90000) : r;
  const msLoteGratis = Date.now() - t;
  const ordenesA = fs.existsSync(R.motor(a.carpeta)) ? fs.readdirSync(R.motor(a.carpeta)).filter((n) => /^T\d+\.json$/.test(n)) : [];
  const finalesA = ['V01', 'V02', 'V03', 'V04'].flatMap((v) => ['1x1', '9x16'].map((f) => `${v}_${f}`)).filter((p) => plantillas.estadoComposicion(a.carpeta, p).completa);
  check(`Lote de 4 anuncios × 2 tamaños solo con la app: listo en ${msLoteGratis} ms (textos en ${msEstrategia} ms), sin llamar al proveedor`, r?.ok === true && ordenesA.length === 0 && finalesA.length === 8, { r, ordenesA, finalesA });
  const vA = leer(R.v(a.carpeta, 'V01'));
  check('Los textos salen de la ficha sin la IA (flechas: ingrediente → beneficio, con los mg solo si están en la ficha)', vA?.app_plantilla?.id === 'producto-flechas' && vA.app_plantilla.textos.flechas[0].ingrediente === 'Colágeno hidrolizado' && vA.app_plantilla.textos.flechas[0].beneficio === 'Piel más firme', vA?.app_plantilla?.textos);
  const vistaA = estadoMod.vistaDelLote({ lote: a.brief.slug, carpeta: a.carpeta, brief: leer(R.brief(a.carpeta)), conductor: { estado: 'listo', paso: 'informe', pasos: [] } });
  const pA = vistaA.variaciones[0].piezas['1:1'];
  check('La vista: lista, la imagen es la dibujada (final/), con sus campos para editar y regenerar gratis', pA.estado === 'listo' && /\/final\/V01_1x1\.png\?v=/.test(pA.url) && pA.imagenesRegenerar === 0 && pA.puedeRegenerar && vistaA.variaciones[0].plantilla?.campos?.length > 1, { pA, plantilla: vistaA.variaciones[0].plantilla });

  // ---- 11b. editar un texto: se vuelve a dibujar solo esa variación, en 1-2 s
  const antes = Object.fromEntries(['V01_1x1', 'V02_1x1', 'V02_9x16'].map((p) => [p, fs.statSync(R.final(a.carpeta, p)).mtimeMs]));
  t = Date.now();
  const ed = await plantillas.editarTextos(a.carpeta, 'V02', { titular: 'Así de fácil: piel más firme', beneficios: ['Piel más firme', 'Uñas más fuertes', 'Cabello con brillo'], sticker: 'no va' });
  const msEditar = Date.now() - t;
  const despues = Object.fromEntries(['V01_1x1', 'V02_1x1', 'V02_9x16'].map((p) => [p, fs.statSync(R.final(a.carpeta, p)).mtimeMs]));
  check(`Editar un texto vuelve a dibujar solo esa variación (2 imágenes en ${msEditar} ms), sin IA y sin costo`, msEditar < 6000 && despues.V01_1x1 === antes.V01_1x1 && despues.V02_1x1 > antes.V02_1x1 && despues.V02_9x16 > antes.V02_9x16 && leer(R.v(a.carpeta, 'V02')).app_plantilla.textos.titular === 'Así de fácil: piel más firme', { ed, antes, despues });
  check('Lo que llega de la pantalla se limpia (un campo de otra plantilla no entra)', !('sticker' in leer(R.v(a.carpeta, 'V02')).app_plantilla.textos), leer(R.v(a.carpeta, 'V02')).app_plantilla.textos);
  t = Date.now();
  await plantillas.otraVersion(a.carpeta, 'V01');
  check(`«Otra versión» de una plantilla sin escena: gratis y al instante (${Date.now() - t} ms)`, costoMod.costoMaximoDeLaAccion({ dolaresPorImagen: 0.05 }, a.brief, { pieza: 'V01_1x1', carpeta: a.carpeta }) === 0);

  // ---- 11c. un lote con escenas: sin texto, una sola escena por variación (el vertical la reutiliza), en paralelo
  const conEscena = ['antes-despues', 'linea-tiempo', 'foto-tiktok', 'lista-iconos'];
  const b = crearDePlantillas('_img-plantillas-escenas-20261117-1200', conEscena, 4);
  check('Con escenas: se cobran solo 3 escenas (una por variación con escena, sin el vertical)', lotesMod.piezasPorHacer(b.carpeta, b.brief) === 3 && costoMod.costoMaximoDeLaAccion({ dolaresPorImagen: 0.05 }, b.brief) === 0.15, { n: lotesMod.piezasPorHacer(b.carpeta, b.brief) });
  ctx = ctxDe(b.brief.slug, b.carpeta, b.brief, claude);
  t = Date.now();
  r = await familia._pruebas.estrategia(ctx);
  ctx.brief = leer(R.brief(b.carpeta));
  await plantillas.componerPendientes(b.carpeta, ctx.brief);
  const msVistaPrevia = Date.now() - t;
  const previas = ['V01_1x1', 'V01_9x16', 'V04_1x1'].map((p) => plantillas.estadoComposicion(b.carpeta, p));
  check(`La vista previa con los textos sale antes de la escena (${msVistaPrevia} ms): V01 dibujado e incompleto, V04 completo`, previas[0].existe && !previas[0].completa && previas[1].existe && previas[2].completa, previas);
  r = await promesa2(familia._pruebas.anuncios(ctx), 90000);
  const msLoteEscenas = Date.now() - t;
  const pedidas = listarResultados(b.carpeta).map((x) => x.pieza).sort();
  check(`Las escenas van al modelo todas en una orden, solo los cuadrados (${pedidas.join(', ')}); lote listo en ${msLoteEscenas} ms`, r?.ok === true && pedidas.join() === 'V01_1x1,V02_1x1,V03_1x1' && fs.readdirSync(R.motor(b.carpeta)).filter((n) => /^T\d+\.json$/.test(n)).length === 1, { r, pedidas });
  const prompt1 = fs.readFileSync(R.prompt(b.carpeta, 'V01_1x1'), 'utf8');
  check('El prompt de la escena pide CERO texto y deja libres las zonas de la plantilla (sin titulares ni textos exactos)', /ABSOLUTELY NO TEXT/.test(prompt1) && /no letters/.test(prompt1) && /no logos/.test(prompt1) && !/EXACT VISIBLE TEXT|MAIN HEADLINE/.test(prompt1) && /split vertically into two equal halves/.test(prompt1) && /Same person/.test(prompt1) && !prompt1.includes(leer(R.v(b.carpeta, 'V01')).app_plantilla.textos.titular), prompt1.slice(0, 600));
  const finalesB = ['V01', 'V02', 'V03', 'V04'].flatMap((v) => ['1x1', '9x16'].map((f) => `${v}_${f}`)).map((p) => [p, plantillas.estadoComposicion(b.carpeta, p).completa]);
  check('Al llegar cada escena se vuelve a dibujar (cuadrado y vertical con la misma escena): las 8 completas', finalesB.every(([, c]) => c), finalesB);
  const vistaB = estadoMod.vistaDelLote({ lote: b.brief.slug, carpeta: b.carpeta, brief: leer(R.brief(b.carpeta)), conductor: { estado: 'listo', paso: 'informe', pasos: [] } });
  check('La vista: todas listas; regenerar una con escena pide 1 imagen y una sin escena, 0', vistaB.variaciones.every((x) => Object.values(x.piezas).every((p) => p.estado === 'listo' && p.url)) && vistaB.variaciones[0].piezas['9:16'].imagenesRegenerar === 1 && vistaB.variaciones[3].piezas['1:1'].imagenesRegenerar === 0, vistaB.variaciones.map((x) => Object.values(x.piezas).map((p) => p.estado)));

  // ---- 11d. regenerar una escena: solo el cuadrado va al modelo, el vertical se vuelve a dibujar con la nueva
  const marcaV = fs.statSync(R.final(b.carpeta, 'V01_9x16')).mtimeMs;
  plantillas.notaParaEscena(b.carpeta, 'V01', 'Otra persona, más luz');
  escribir(R.pedidos(b.carpeta), { pedidos: [{ id: 'U0001', pieza: 'V01_1x1', instruccion: '', fecha: new Date().toISOString() }] });
  ctx = ctxDe(b.brief.slug, b.carpeta, leer(R.brief(b.carpeta)), claude);
  r = await promesa2(familia._pruebas.anuncios(ctx), 90000);
  const u = listarResultados(b.carpeta).filter((x) => String(x.orden).startsWith('U0001')).map((x) => `${x.pieza}:${x.orden}`);
  check('Regenerar la escena: una sola orden (el cuadrado), con la nota del usuario en el prompt; el vertical se redibuja', r?.ok === true && u.join() === 'V01_1x1:U0001' && /Otra persona, más luz/.test(fs.readFileSync(R.prompt(b.carpeta, 'V01_1x1'), 'utf8')) && fs.statSync(R.final(b.carpeta, 'V01_9x16')).mtimeMs > marcaV, { r, u });

  // ---- 11f. los ángulos ganadores (sin oferta): en la pantalla y en la mezcla de la app, y se dibujan en los 2 tamaños
  const cat = await import('../server/lib/imagen-ads/catalogo-plantillas.js');
  const textosMod = await import('../server/lib/imagen-ads/textos-plantillas.js');
  const pantalla = cat.catalogoParaLaPantalla();
  const ANGULOS = ['silueta-zonas', 'solo-vs-con', 'nosotros-vs-ellos', 'no-compres', 'pregunta-revelacion', 'historia', 'zonas-semanas', 'foto-iconos', 'etapas-neon', 'antes-despues-plazo', 'dos-mitades', 'rotulos-anatomia', 'estado-vs-estado', 'cuadricula-tiempo', 'beneficios-lados', 'dias-producto'];
  check(
    'Sin plantillas de oferta en la pantalla ni en «Que la app elija»; los 16 ángulos ganadores sí (y abren la mezcla)',
    !pantalla.familias.some((x) => x.id === 'oferta') && !pantalla.plantillas.some((x) => x.familia === 'oferta') && !cat.ORDEN_AUTO.some((x) => cat.POR_ID.get(x)?.familia === 'oferta') && ANGULOS.every((x) => pantalla.plantillas.some((y) => y.id === x)) && cat.ORDEN_AUTO[0] === 'silueta-zonas' && cat.POR_ID.has('sticker-oferta'),
    { familias: pantalla.familias.map((x) => x.id), orden: cat.ORDEN_AUTO }
  );
  const ctxA = textosMod.contextoDelLote(a.carpeta, a.brief);
  const sinOferta = ANGULOS.every((id) => !/\$|%|descuento|oferta|2x1|gratis/i.test(JSON.stringify(textosMod.textosPara(id, ctxA, 0))));
  check('Los textos de los ángulos salen de la ficha y nunca traen oferta ni precio', sinOferta, ANGULOS.map((id) => textosMod.textosPara(id, ctxA, 0)));
  check('La pregunta sale del dolor de la ficha, dicha a la clienta («¿Sientes que…?»)', textosMod.textosPara('pregunta-revelacion', ctxA, 0).pregunta === '¿Sientes que la piel se te ve apagada?', textosMod.textosPara('pregunta-revelacion', ctxA, 0));
  const promptsSinTexto = ANGULOS.every((id) => {
    const d = plantillas.descripcionEscena(id, ctxA, textosMod.textosPara(id, ctxA, 0), { primario: '#1F6F4A', secundario: '#F2C14E' });
    return d.length > 200 && !/MAIN HEADLINE|EXACT VISIBLE TEXT/.test(d);
  });
  check('Cada ángulo pide su propia escena al modelo (sin texto)', promptsSinTexto);
  t = Date.now();
  const dibujos = [];
  for (const id of ANGULOS) {
    for (const f of ['1:1', '9:16']) {
      const salida = path.join(BASE, 'angulos', `${id}_${f.replace(':', 'x')}.png`);
      await render.renderizar({ composicion: render.composicionDe(f), props: { plantilla: id, formato: f, textos: textosMod.textosPara(id, ctxA, 0), kit: plantillas.limpiarKit({}), producto: { archivo: path.join(APP, 'muestras', 'plantillas', 'producto-muestra.png'), recortado: true }, escena: { espera: 'Escena' }, logo: null }, salida });
      dibujos.push(fs.existsSync(salida) && fs.statSync(salida).size > 20000);
    }
  }
  check(`Los 16 ángulos se dibujan en cuadrado y vertical (${dibujos.length} imágenes en ${Date.now() - t} ms)`, dibujos.length === 32 && dibujos.every(Boolean), dibujos);

  // ---- 11e. el kit de marca y los tiempos del dibujante
  const kit = await plantillas.kitAutomatico(path.join(APP, 'muestras', 'plantillas', 'producto-muestra.png'));
  check(`El kit de marca sale de la foto (colores dominantes no neutros: ${kit.primario} y ${kit.secundario})`, /^#[0-9A-F]{6}$/.test(kit.primario) && /^#[0-9A-F]{6}$/.test(kit.secundario) && kit.primario !== kit.secundario, kit);
  const med = render.medidas();
  console.log(`   Tiempos: dibujante frío ${msFrio} ms; por imagen ${med.msPromedio} ms en promedio (${med.renders} imágenes, con ${cal.aLaVez} a la vez); lote gratis de 8 imágenes ${msLoteGratis} ms; vista previa ${msVistaPrevia} ms; lote con 3 escenas simuladas ${msLoteEscenas} ms; editar un texto ${msEditar} ms.`);
  fs.rmSync(BASE, { recursive: true, force: true });
  render.cerrar();
} catch (e) {
  check('La sección 11 corre entera', false, String(e?.stack || e));
}

function listarResultados(carpeta) {
  const dir = R.motor(carpeta);
  const salida = [];
  for (const n of fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.resultado.json')) : []) {
    const r = leer(path.join(dir, n));
    for (const [pieza, x] of Object.entries(r?.piezas || {})) salida.push({ trabajo: n, pieza, ...x });
  }
  return salida;
}

function promesa2(p, ms) {
  return Promise.race([p, new Promise((r) => setTimeout(() => r({ seAcaboElTiempo: ms }), ms))]);
}

// =====================================================================================================================
const fallas = resultados.filter((x) => !x.ok);
console.log(`\n${resultados.length - fallas.length}/${resultados.length} OK${fallas.length ? ` · FALLAS: ${fallas.map((x) => x.nombre).join(' | ')}` : ''}`);
try {
  fs.rmSync(TMP, { recursive: true, force: true });
} catch {
  /* queda en la carpeta temporal del sistema */
}
process.exitCode = fallas.length ? 1 : 0;
setTimeout(() => process.exit(process.exitCode), 200).unref();
