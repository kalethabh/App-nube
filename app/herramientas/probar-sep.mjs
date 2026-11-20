// Prueba de S.E.P (lib/sep.js), SIN llamar a Meta de verdad: un Meta simulado en este mismo proceso.
//   node app/herramientas/probar-sep.mjs
// Revisa: las reglas del sistema (escalar, variar, sostener, probando, pausar), que las compras no se cuenten dos veces,
// la lectura de tu cuenta (cuentas, insights por anuncio con paginación, la serie diaria, la imagen y el estado), los
// totales y la serie de la cuenta, la caché, la imagen para hacer variaciones y los errores (token vencido, sin
// ads_read). Al final deja todo como estaba.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = path.resolve(APP, '..');
let fallas = 0;
let pasan = 0;
const check = (que, ok, detalle) => {
  if (ok) pasan++;
  else fallas++;
  console.log(`${ok ? '  ok ' : '  MAL'}  ${que}${ok || detalle === undefined ? '' : `\n        ${JSON.stringify(detalle).slice(0, 700)}`}`);
};

// ------------------------------------------------------------ el Meta simulado
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pedidos = [];
const dias = Array.from({ length: 6 }, (_, i) => `2026-11-${String(10 + i).padStart(2, '0')}`);
const fila = (id, nombre, gasto, compras, ingresos, frec) => ({ ad_id: id, ad_name: nombre, adset_name: 'Conjunto', campaign_name: 'Campaña', spend: String(gasto), impressions: String(gasto * 80), frequency: String(frec), inline_link_clicks: String(Math.round(gasto * 1.2)), actions: [{ action_type: 'purchase', value: String(compras) }, { action_type: 'omni_purchase', value: String(compras) }, { action_type: 'offsite_conversion.fb_pixel_purchase', value: String(compras) }], action_values: [{ action_type: 'omni_purchase', value: String(ingresos) }, { action_type: 'purchase', value: String(ingresos) }] });
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  pedidos.push(u.pathname + u.search);
  const tok = u.searchParams.get('access_token');
  const json = (o, st = 200) => {
    res.writeHead(st, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  if (u.pathname === '/img.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end(PNG);
  }
  if (tok === 'vencido') return json({ error: { code: 190, message: 'Error validating access token' } }, 400);
  if (tok === 'sinpermiso') return json({ error: { code: 200, message: 'Requires ads_read permission' } }, 400);
  if (u.pathname === '/me/adaccounts') return json({ data: [{ id: 'act_123', name: 'Mi cuenta', account_status: 1, currency: 'COP', business: { id: '777', name: 'Mi BM' } }, { id: 'act_456', name: 'Cuenta USA', account_status: 1, currency: 'USD', business: { id: '777', name: 'Mi BM' } }, { id: 'act_789', name: 'Personal', account_status: 2, currency: 'COP' }] });
  if (u.pathname === '/act_456/insights') {
    if (u.searchParams.get('time_increment') === '1') return json({ data: [{ ad_id: '9100', date_start: dias[0], spend: '50', impressions: '1000', inline_link_clicks: '10', actions: [{ action_type: 'omni_purchase', value: '25' }], action_values: [{ action_type: 'omni_purchase', value: '500' }] }] });
    return json({ data: [{ ...fila('9100', 'Ganador USA', 50, 25, 500, 1.2), campaign_id: '55' }] });
  }
  if (u.pathname === '/act_123/insights' && u.searchParams.get('level') === 'campaign') return json({ data: [{ campaign_id: '11', campaign_name: 'Prospección', spend: '120', actions: [{ action_type: 'omni_purchase', value: '30' }] }, { campaign_id: '22', campaign_name: 'Pruebas', spend: '85', actions: [{ action_type: 'omni_purchase', value: '1' }] }] });
  if (u.pathname === '/act_123/insights') {
    if (u.searchParams.get('time_increment') === '1') {
      const ids = JSON.parse(u.searchParams.get('filtering'))[0].value;
      const data = ids.flatMap((id) => dias.map((d, i) => ({ ad_id: id, date_start: d, spend: '10', impressions: '1000', inline_link_clicks: id === '9002' ? String(30 - i * 5) : '20', actions: [{ action_type: 'omni_purchase', value: id === '9001' ? '3' : id === '9002' ? '2' : '0' }], action_values: [{ action_type: 'omni_purchase', value: id === '9001' ? '150' : id === '9002' ? '70' : '0' }] })));
      return json({ data });
    }
    const filtro = u.searchParams.get('filtering') ? JSON.parse(u.searchParams.get('filtering'))[0] : null;
    if (filtro?.field === 'campaign.id') return json({ data: filtro.value === '22' ? [{ ...fila('9003', 'Sin ventas', 80, 0, 0, 1.1), campaign_id: '22' }, { ...fila('9004', 'Nuevo', 5, 1, 30, 1.0), campaign_id: '22' }] : [] });
    if (!u.searchParams.get('after')) return json({ data: [fila('9001', 'Ganador', 60, 18, 900, 1.4), fila('9002', 'Cansado', 60, 12, 420, 3.2)], paging: { next: `http://127.0.0.1:${servidor.address().port}/act_123/insights?after=p2&access_token=${tok}` } });
    return json({ data: [fila('9003', 'Sin ventas', 80, 0, 0, 1.1), fila('9004', 'Nuevo', 5, 1, 30, 1.0), fila('9005', 'Sin gasto', 0, 0, 0, 0)] });
  }
  if (u.pathname === '/' && u.searchParams.get('ids')) {
    const o = {};
    for (const id of u.searchParams.get('ids').split(',')) o[id] = { id, effective_status: id === '9003' ? 'PAUSED' : 'ACTIVE', creative: { image_url: `http://127.0.0.1:${servidor.address().port}/img.png`, title: `Título ${id}`, body: 'Texto' } };
    return json(o);
  }
  json({ error: { code: 100, message: `no simulado: ${u.pathname}` } }, 400);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
process.env.SEP_GRAPH_BASE = `http://127.0.0.1:${servidor.address().port}`;
process.env.SEP_TOKEN_PRUEBA = 'bueno';
delete process.env.ANUNCIOS_MODO_PRUEBA;

const DIR_SEP = path.join(RAIZ, 'temp', '_sep');
const habia = fs.existsSync(DIR_SEP);
const respaldo = habia ? fs.mkdtempSync(path.join(RAIZ, 'temp', '_probar-sep-')) : null;
if (habia) fs.renameSync(DIR_SEP, path.join(respaldo, 'sep'));

try {
  const sep = await import(path.join(APP, 'server', 'lib', 'sep.js'));
  const { decidir, compras } = sep._paraPruebas;
  // ------------------------------------------------------------ las reglas
  check('Las compras no se cuentan dos veces (omni_purchase, purchase y píxel juntos)', compras([{ action_type: 'purchase', value: '5' }, { action_type: 'omni_purchase', value: '5' }, { action_type: 'offsite_conversion.fb_pixel_purchase', value: '5' }]) === 5);
  const obj = sep.reglas({ roas: 2 });
  const serieQuieta = dias.map((d) => ({ fecha: d, compras: 2, impresiones: 1000, clics: 20 }));
  const base = { gasto: 100, compras: 20, ingresos: 600, roas: 6, cpa: 5, ctr: 2, frecuencia: 1.4, serie: serieQuieta };
  check('Escalar: ROAS alto, ventas sostenidas, sin fatiga', decidir(base, obj).tipo === 'escalar');
  check('Variar: rinde pero la frecuencia pasa de 2,5', decidir({ ...base, frecuencia: 3 }, obj).tipo === 'variar');
  check('Variar: rinde pero el CTR cayó', decidir({ ...base, serie: dias.map((d, i) => ({ fecha: d, compras: 2, impresiones: 1000, clics: 40 - i * 7 })) }, obj).tipo === 'variar');
  check('Sostener: cerca del objetivo', decidir({ ...base, roas: 2.1, ingresos: 210 }, obj).tipo === 'sostener');
  check('Probando: pocas compras y poco gasto', decidir({ ...base, gasto: 12, compras: 1, roas: 2.5 }, obj).tipo === 'probando');
  check('Pausar: gastó sin vender', decidir({ ...base, gasto: 80, compras: 0, roas: 0, cpa: null }, obj).tipo === 'pausar');
  check('Pausar: CPA muy sobre tu máximo', decidir({ ...base, cpa: 30 }, sep.reglas({ roas: 2, cpa: 15 })).tipo === 'pausar');
  check('Cada decisión trae razones y qué hacer', ['escalar', 'variar', 'pausar'].every(() => { const d = decidir(base, obj); return d.razones.length && d.acciones.length; }));

  // ------------------------------------------------------------ tu cuenta (Meta simulado)
  const c = await sep.cuentas();
  check('Lee tus cuentas publicitarias', c.cuentas?.[0]?.id === 'act_123' && c.cuentas[0].moneda === 'COP' && !c.simulado, c);
  check('…agrupadas por Business Manager (y las que no tienen BM aparte, al final)', c.bms.length === 2 && c.bms[0].id === '777' && c.bms[0].cuentas.join(',') === 'act_123,act_456' && c.bms[1].id === 'sin-bm' && c.bms[1].cuentas[0] === 'act_789', c.bms);
  const inf = await sep.informe({ cuenta: 'act_123', rango: '7d', roas: 2 });
  const ids = inf.anuncios.map((a) => a.id);
  check('Trae los anuncios de las dos páginas, sin los de gasto 0, ordenados por compras', ids.join(',') === '9001,9002,9004,9003', ids);
  const g = inf.anuncios.find((a) => a.id === '9001');
  check('Las métricas del anuncio salen bien (compras sin duplicar, ROAS, CPA, CTR)', g.compras === 18 && g.ingresos === 900 && g.roas === 15 && g.cpa === 3.33 && g.ctr === 1.5, g);
  check('Trae su serie diaria, su imagen y su estado', g.serie.length === 6 && g.serie[0].compras === 3 && /img\.png/.test(g.miniatura) && g.estado === 'ACTIVE' && inf.anuncios.find((a) => a.id === '9003').estado === 'PAUSED');
  check('Las decisiones: el ganador a escalar, el cansado a variar, el sin ventas a pausar, el nuevo probando', g.decision.tipo === 'escalar' && inf.anuncios.find((a) => a.id === '9002').decision.tipo === 'variar' && inf.anuncios.find((a) => a.id === '9003').decision.tipo === 'pausar' && inf.anuncios.find((a) => a.id === '9004').decision.tipo === 'probando', inf.anuncios.map((a) => [a.id, a.decision.tipo]));
  check('Totales, moneda y conteo por sugerencia', inf.totales.compras === 31 && inf.totales.gasto === 205 && inf.moneda === 'COP' && Object.values(inf.cuantos).reduce((s, n) => s + n, 0) === 4, { totales: inf.totales, cuantos: inf.cuantos });
  check('La serie de la cuenta suma los anuncios día por día', inf.serie.length === 6 && inf.serie[0].compras === 5 && inf.serie[0].gasto === 40, inf.serie[0]);
  const antes = pedidos.length;
  await sep.informe({ cuenta: 'act_123', rango: '7d', roas: 3 });
  check('Con la caché no vuelve a llamar a Meta (y el objetivo nuevo se aplica igual)', pedidos.length <= antes + 1);
  const inf3 = await sep.informe({ cuenta: 'act_123', rango: '7d', roas: 20 });
  check('…el objetivo cambia las decisiones sin pedir de nuevo', inf3.anuncios.find((a) => a.id === '9001').decision.tipo !== 'escalar');
  await sep.informe({ cuenta: 'act_123', rango: '7d', roas: 2, forzar: true });
  check('«Traer de Meta» (forzar) sí vuelve a pedir', pedidos.length > antes + 1);
  // ------------------------------------------------------------ BM completo y una campaña
  const camps = await sep.campanas({ cuenta: 'act_123', rango: '7d' });
  check('Las campañas de una cuenta, las que más venden primero', camps.campanas.map((x) => x.id).join(',') === '11,22' && camps.campanas[0].compras === 30, camps);
  const deCamp = await sep.informe({ alcance: 'campana', cuenta: 'act_123', campana: '22', rango: '7d', roas: 2 });
  check('Una campaña: solo sus anuncios (filtrado en Meta por campaign.id)', deCamp.anuncios.map((a) => a.id).sort().join(',') === '9003,9004' && deCamp.alcance === 'campana', deCamp.anuncios.map((a) => a.id));
  const delBm = await sep.informe({ alcance: 'bm', bm: '777', rango: '7d', roas: 2 });
  check('El BM completo junta los anuncios de sus cuentas, ordenados por compras, con su cuenta', delBm.anuncios[0].id === '9100' && delBm.anuncios[0].cuentaNombre === 'Cuenta USA' && delBm.anuncios.some((a) => a.cuenta === 'act_123') && delBm.cuentas.length === 2, delBm.anuncios.map((a) => [a.id, a.cuenta]));
  check('…con monedas distintas no suma dinero (las compras sí) y lo avisa', delBm.moneda === null && delBm.mezclaDeMonedas?.length === 2 && delBm.totales.gasto === null && delBm.totales.roas === null && delBm.totales.compras === 56 && delBm.anuncios.find((a) => a.id === '9100').moneda === 'USD', { totales: delBm.totales, m: delBm.mezclaDeMonedas });
  let e0 = null;
  try {
    await sep.informe({ alcance: 'bm', bm: 'no-existe', rango: '7d' });
  } catch (x) {
    e0 = x;
  }
  check('Un BM que no es tuyo: 400', e0?.status === 400, e0?.message);
  e0 = null;
  try {
    await sep.informe({ alcance: 'cuenta', cuenta: 'act_999', rango: '7d' });
  } catch (x) {
    e0 = x;
  }
  check('Una cuenta que no es tuya: 400', e0?.status === 400, e0?.message);
  const img = await sep.imagenDe('9001');
  check('Guarda la imagen del anuncio para hacer variaciones', fs.existsSync(img) && fs.readFileSync(img).equals(PNG));
  let e = null;
  try {
    await sep.informe({ cuenta: 'mal', rango: '7d' });
  } catch (x) {
    e = x;
  }
  check('Una cuenta inválida: 400', e?.status === 400, e?.message);
  process.env.SEP_TOKEN_PRUEBA = 'vencido';
  e = null;
  try {
    await sep.cuentas({ forzar: true });
  } catch (x) {
    e = x;
  }
  check('Token vencido: lo dice claro (401)', e?.status === 401 && /venció/.test(e.message), e?.message);
  process.env.SEP_TOKEN_PRUEBA = 'sinpermiso';
  e = null;
  try {
    await sep.informe({ cuenta: 'act_123', rango: '14d', forzar: true });
  } catch (x) {
    e = x;
  }
  check('Sin ads_read: explica qué permiso falta (403)', e?.status === 403 && /ads_read/.test(e.message), e?.message);
} catch (x) {
  check('La prueba no se cae', false, String(x?.stack || x));
} finally {
  servidor.close();
  fs.rmSync(DIR_SEP, { recursive: true, force: true });
  if (respaldo) {
    fs.renameSync(path.join(respaldo, 'sep'), DIR_SEP);
    fs.rmSync(respaldo, { recursive: true, force: true });
  }
  console.log(`\n  ${pasan} bien, ${fallas} mal\n`);
  process.exit(fallas ? 1 : 0);
}
