// Prueba de «Salud de plataformas» (lib/salud.js) con páginas de estado simuladas, sin internet:
//   node app/herramientas/probar-salud.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'salud-'));
const claves = await import('../server/lib/claves.js');
claves._paraPruebas({ archivo: path.join(TMP, '.env') }); // sin claves: no prueba kie ni ElevenLabs con la tuya
fs.writeFileSync(path.join(TMP, '.env'), '# sin claves\n');
const salud = await import('../server/lib/salud.js');

const resultados = [];
const check = (nombre, ok, detalle) => {
  resultados.push(Boolean(ok));
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${ok ? '' : `\n      ${JSON.stringify(detalle)?.slice(0, 500)}`}`);
};

const PAGINAS = {
  '/claude': {
    status: { indicator: 'minor' },
    components: [{ name: 'claude.ai', status: 'degraded_performance' }, { name: 'Claude Code', status: 'operational' }, { name: 'Claude API (api.anthropic.com)', status: 'operational' }],
    incidents: [{ name: 'Claude unable to join meetings', status: 'investigating', impact: 'minor', components: [{ name: 'claude.ai' }] }],
  },
  '/openai': { status: { indicator: 'major' }, components: [{ name: 'Codex', status: 'major_outage' }, { name: 'Responses', status: 'operational' }], incidents: [{ name: 'Codex is down', status: 'identified', impact: 'major', components: [{ name: 'Codex' }], created_at: '2026-11-18T15:00:00Z' }] },
  '/meta': [
    { id: 'ads-manager', name: 'Facebook Ads Manager', services: [{ name: 'Ads Delivery', status: 'Some disruptions', time: 1763478000 }, { name: 'Ads Reporting', status: 'No known issues' }] },
    { id: 'marketing-api', name: 'Marketing API', services: [{ name: 'Ads Insights API', status: 'No known issues' }] },
    { id: 'ads-transparency', name: 'Ads Transparency', services: [{ name: 'Ad Library', status: 'No known issues' }, { name: 'Branded Content', status: 'Major disruptions' }] },
    { id: 'whatsapp-business-api', name: 'WhatsApp Business Platform', services: [{ name: 'Cloud API', status: 'Major disruptions' }] },
    { id: 'ctx', name: 'Messaging Ads', services: [{ name: 'Click to WhatsApp', status: 'No known issues' }] },
    { id: 'audience-network', name: 'Meta Audience Network', services: [{ name: 'Revenue Reporting', status: 'High disruptions' }] },
  ],
  '/eleven': { status: { indicator: 'minor', description: 'Partial System Degradation' }, components: [], incidents: [{ name: 'Increased latency and API errors', status: 'investigating', impact: 'minor', components: [], created_at: '2026-11-18T15:34:42Z' }] },
};
const servidor = http.createServer((req, res) => {
  const d = PAGINAS[req.url];
  if (!d) return res.writeHead(500).end();
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(d));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${servidor.address().port}`;

try {
  salud._paraPruebas({ claude: `${base}/claude`, openai: `${base}/openai`, elevenlabs: `${base}/eleven`, meta: `${base}/meta` });
  const d = await salud.salud({ fresco: true });
  const s = Object.fromEntries(d.grupos.flatMap((g) => g.servicios).map((x) => [x.id, x]));
  check('Claude: una falla en una parte que la app no usa (reuniones) no la pone en amarillo', s.claude.estado === 'operativo' && /1 aviso/.test(s.claude.otros || ''), s.claude);
  check('ChatGPT: Codex caído -> «caido», con el nombre de la falla y desde cuándo', s.chatgpt.estado === 'caido' && /Codex is down/.test(s.chatgpt.detalle) && /desde las/.test(s.chatgpt.detalle), s.chatgpt);
  check('ElevenLabs: falla abierta sin partes -> «degradado» con su nombre', s.elevenlabs.estado === 'degradado' && /Increased latency/.test(s.elevenlabs.detalle), s.elevenlabs);
  check('kie.ai sin clave: «desconocido» (no alarma)', s.kie.estado === 'desconocido', s.kie);
  check('Meta Ads Manager: «Some disruptions» en la entrega -> amarillo, con la parte y la hora', s['meta-ads'].estado === 'degradado' && /Ads Delivery: Some disruptions \(desde las/.test(s['meta-ads'].detalle), s['meta-ads']);
  check('Biblioteca de anuncios: solo cuenta la Ad Library (Branded Content caído no la pone en rojo)', s['meta-biblioteca'].estado === 'operativo', s['meta-biblioteca']);
  check('WhatsApp Business: Cloud API con «Major disruptions» -> rojo', s['meta-whatsapp'].estado === 'caido' && /Cloud API/.test(s['meta-whatsapp'].detalle), s['meta-whatsapp']);
  check('Un producto de Meta que no usas (Audience Network) no aparece', !Object.values(s).some((x) => /Revenue/.test(x.detalle || '')));
  const uno = await salud.revisarServicio('meta-whatsapp');
  check('El ↻ de una fila revisa solo esa y devuelve todo armado', uno.grupos.flatMap((g) => g.servicios).find((x) => x.id === 'meta-whatsapp')?.estado === 'caido' && uno.grupos.length >= 4, uno);
  check('El general es el peor de los que se pudieron revisar (caído)', d.general === 'caido', d.general);
  salud._paraPruebas({ claude: `${base}/no-existe`, openai: `${base}/no-existe`, elevenlabs: `${base}/no-existe`, meta: `${base}/no-existe` });
  const d2 = await salud.salud({ fresco: true });
  check('Si una página de estado no carga: «desconocido», y el general no se pone rojo por eso', d2.grupos.flatMap((g) => g.servicios).every((x) => x.estado === 'desconocido') && d2.general === 'operativo', d2);
  const t0 = Date.now();
  await salud.salud();
  check('Se recuerda un minuto (no vuelve a preguntar cada vez)', Date.now() - t0 < 50);

  // EN VIVO: quien escucha recibe lo recordado al instante y, cuando una plataforma cambia, el cambio solo
  salud._paraPruebas({ claude: `${base}/claude`, openai: `${base}/openai`, elevenlabs: `${base}/eleven`, meta: `${base}/meta` }, { cadaVivo: 300 });
  await salud.salud({ fresco: true });
  const llegados = [];
  const dejar = salud.escuchar((v) => llegados.push(v));
  check('En vivo: al escuchar llega el estado de una vez', llegados.length >= 1 && llegados[0].general === 'caido', llegados.length);
  PAGINAS['/openai'] = { status: { indicator: 'none' }, components: [{ name: 'Codex', status: 'operational' }], incidents: [] };
  const vio = await new Promise((r) => {
    const t = setInterval(() => {
      const ult = llegados.at(-1);
      const chat = ult?.grupos.flatMap((g) => g.servicios).find((x) => x.id === 'chatgpt');
      if (chat?.estado === 'operativo') return clearInterval(t), r(true);
    }, 50);
    setTimeout(() => (clearInterval(t), r(false)), 5000);
  });
  check('En vivo: Codex se arregla y llega solo, sin pedirlo', vio, llegados.length);
  dejar();
  const n = llegados.length;
  await new Promise((r) => setTimeout(r, 900));
  check('Sin nadie escuchando, deja de revisar', llegados.length === n, { antes: n, despues: llegados.length });
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  servidor.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);
