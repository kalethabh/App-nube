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
  salud._paraPruebas({ claude: `${base}/claude`, openai: `${base}/openai`, elevenlabs: `${base}/eleven` });
  const d = await salud.salud({ fresco: true });
  const s = Object.fromEntries(d.grupos.flatMap((g) => g.servicios).map((x) => [x.id, x]));
  check('Claude: una falla en una parte que la app no usa (reuniones) no la pone en amarillo', s.claude.estado === 'operativo' && /1 aviso/.test(s.claude.otros || ''), s.claude);
  check('ChatGPT: Codex caído -> «caido», con el nombre de la falla y desde cuándo', s.chatgpt.estado === 'caido' && /Codex is down/.test(s.chatgpt.detalle) && /desde las/.test(s.chatgpt.detalle), s.chatgpt);
  check('ElevenLabs: falla abierta sin partes -> «degradado» con su nombre', s.elevenlabs.estado === 'degradado' && /Increased latency/.test(s.elevenlabs.detalle), s.elevenlabs);
  check('kie.ai sin clave: «desconocido» (no alarma)', s.kie.estado === 'desconocido', s.kie);
  check('El general es el peor de los que se pudieron revisar (caído)', d.general === 'caido', d.general);
  salud._paraPruebas({ claude: `${base}/no-existe`, openai: `${base}/no-existe`, elevenlabs: `${base}/no-existe` });
  const d2 = await salud.salud({ fresco: true });
  check('Si una página de estado no carga: «desconocido», y el general no se pone rojo por eso', d2.grupos.flatMap((g) => g.servicios).every((x) => x.estado === 'desconocido') && d2.general === 'operativo', d2);
  const t0 = Date.now();
  await salud.salud();
  check('Se recuerda un minuto (no vuelve a preguntar cada vez)', Date.now() - t0 < 50);
} catch (e) {
  check('La prueba corre entera', false, String(e?.stack || e));
} finally {
  servidor.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
const malas = resultados.filter((x) => !x).length;
console.log(`\n${resultados.length - malas}/${resultados.length} OK`);
process.exit(malas ? 1 : 0);
