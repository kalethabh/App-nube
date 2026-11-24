#!/usr/bin/env node
// Shopify CLI SIMULADO para las pruebas (probar-shopify.mjs): SHOPIFY_CLI_BIN apunta aquí. Guarda los temas de una
// tienda falsa en SHOPIFY_FALSO_DIR/<tienda>/ (temas.json + temas/<id>/…) y anota cada llamada en llamadas.log (con la clave
// solo como «env» o «argv», para revisar que nunca va en la línea de comandos).
//   theme list --json · theme pull --theme <id> --path <p> · theme push --path <p> --json (--unpublished --theme <nombre>
//   | --theme <id> --nodelete --only <f>…) · theme publish --theme <id> --force · theme delete --theme <id> --force
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const val = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const todos = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const token = process.env.SHOPIFY_CLI_THEME_TOKEN || '';
const DIR = path.join(process.env.SHOPIFY_FALSO_DIR, String(val('--store') || 'sin-tienda')); // una tienda por carpeta
fs.mkdirSync(DIR, { recursive: true });
fs.appendFileSync(path.join(DIR, 'llamadas.log'), `${JSON.stringify({ args: args.filter((a) => a !== token), claveEnArgv: args.some((a) => a.includes(token) && token), claveEnEnv: Boolean(token), store: val('--store') })}\n`);
if (/malo/.test(token)) {
  process.stderr.write('Error: Unauthorized (401). Invalid password for the store.\n');
  process.exit(1);
}
// (2026-11-24) sin clave: «con mi cuenta de Shopify». La primera vez pide iniciar sesión (enlace y código) y, al rato
// (como si la aprobaras en el navegador), guarda la sesión de esa tienda y sigue.
if (!token && !fs.existsSync(path.join(DIR, 'sesion'))) {
  process.stdout.write('To run this command, log in to Shopify.\nUser verification code: ABCD-1234\nOpen this link to start the auth process: https://accounts.shopify.com/activate-with-code?device_code%5Buser_code%5D=ABCD-1234\n');
  await new Promise((ok) => setTimeout(ok, 1500));
  fs.writeFileSync(path.join(DIR, 'sesion'), 'ok');
}
const archivoTemas = path.join(DIR, 'temas.json');
if (!fs.existsSync(archivoTemas)) {
  const base = path.join(DIR, 'temas', '1001');
  const poner = (f, t) => {
    fs.mkdirSync(path.dirname(path.join(base, f)), { recursive: true });
    fs.writeFileSync(path.join(base, f), t);
  };
  poner('layout/theme.liquid', '<!doctype html><html><head>{{ content_for_header }}</head><body>{{ content_for_layout }}</body></html>\n');
  poner('sections/boton.liquid', '<button class="boton" style="background:#000">Comprar</button>\n{% schema %}{"name":"Botón"}{% endschema %}\n');
  poner('templates/index.json', '{"sections":{"b":{"type":"boton"}},"order":["b"]}\n');
  poner('config/settings_data.json', '{"current":"Default"}\n');
  poner('assets/base.css', 'body{margin:0}\n');
  fs.writeFileSync(archivoTemas, JSON.stringify([{ id: 1001, name: 'Dawn', role: 'live' }, { id: 1002, name: 'Dawn copia', role: 'unpublished' }]));
}
const temas = JSON.parse(fs.readFileSync(archivoTemas, 'utf8'));
const guardar = () => fs.writeFileSync(archivoTemas, JSON.stringify(temas));
const copiar = (de, a, solo) => {
  const recorrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else {
        const rel = path.relative(de, p).replace(/\\/g, '/');
        if (solo?.length && !solo.includes(rel)) continue;
        fs.mkdirSync(path.dirname(path.join(a, rel)), { recursive: true });
        fs.copyFileSync(p, path.join(a, rel));
      }
    }
  };
  recorrer(de);
};
const [g, c] = args;
if (g !== 'theme') process.exit(2);
if (c === 'list') {
  console.log(JSON.stringify(temas));
} else if (c === 'pull') {
  const t = temas.find((x) => String(x.id) === val('--theme'));
  if (!t) {
    process.stderr.write('Theme not found (404)\n');
    process.exit(1);
  }
  copiar(path.join(DIR, 'temas', String(t.id)), val('--path'));
  console.log('Theme pulled successfully');
} else if (c === 'push') {
  let t;
  if (args.includes('--unpublished')) {
    t = { id: Math.max(...temas.map((x) => x.id)) + 1, name: val('--theme'), role: 'unpublished' };
    temas.push(t);
    guardar();
  } else {
    t = temas.find((x) => String(x.id) === val('--theme'));
    if (!t) process.exit(1);
    if (t.role === 'live' && !args.includes('--allow-live')) {
      process.stderr.write('Cannot push to the live theme without --allow-live\n');
      process.exit(1);
    }
  }
  copiar(val('--path'), path.join(DIR, 'temas', String(t.id)), todos('--only'));
  console.log(JSON.stringify({ theme: { id: t.id, name: t.name, role: t.role, shop: val('--store'), editor_url: `https://${val('--store')}/admin/themes/${t.id}/editor`, preview_url: `https://${val('--store')}/?preview_theme_id=${t.id}` } }));
} else if (c === 'publish') {
  for (const x of temas) x.role = String(x.id) === val('--theme') ? 'live' : x.role === 'live' ? 'unpublished' : x.role;
  guardar();
  console.log('published');
} else if (c === 'delete') {
  const i = temas.findIndex((x) => String(x.id) === val('--theme'));
  if (i < 0 || temas[i].role === 'live') process.exit(1);
  temas.splice(i, 1);
  guardar();
  fs.rmSync(path.join(DIR, 'temas', val('--theme')), { recursive: true, force: true });
  console.log('deleted');
} else process.exit(2);
