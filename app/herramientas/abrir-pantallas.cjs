// Abre pantallas de la app en el navegador y avisa si alguna se rompe al abrir (errores de la página o «Esta pantalla
// tuvo un problema»). Compilar no basta: un error como usar una variable antes de calcularla solo sale al abrir.
//   ANUNCIOS_MODO_PRUEBA=1 PUERTO=4471 node app/server/index.js   (en otra terminal)
//   node app/herramientas/abrir-pantallas.cjs                     (las de siempre; o pasa rutas: /imagenes/nuevo …)
//   PUERTO_PANTALLAS=4471 cambia el puerto
const { chromium } = require('playwright');
const LAS_DE_SIEMPRE = ['/inicio', '/productos', '/embudo-whatsapp', '/landings', '/sep', '/tablero', '/nuevo', '/imagenes', '/imagenes/nuevo', '/investigacion', '/inspiracion', '/anuncios', '/editor', '/biblioteca', '/ajustes', '/aprendizajes'];
// y «Crear anuncios de imagen» con lo que dejaste la última vez (el borrador de ese navegador): con «De un video»
// se rompía antes de cargar las opciones (2026-11-19c)
const CON_BORRADOR = ['video', 'variantes', 'nuevos'].map((modo) => ({ ruta: '/imagenes/nuevo', borrador: { modo, plantillasRef: ['x'] } }));
const RUTAS = process.argv.length > 2 ? process.argv.slice(2) : [...LAS_DE_SIEMPRE, ...CON_BORRADOR];
const PUERTO = process.env.PUERTO_PANTALLAS || '4471';
(async () => {
  const b = await chromium.launch();
  let mal = 0;
  for (const x of RUTAS) {
    const r = typeof x === 'string' ? x : x.ruta;
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    if (x.borrador) await ctx.addInitScript((v) => window.localStorage.setItem('anuncios-ia:imagenes-borrador', v), JSON.stringify(x.borrador));
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
    await p.goto(`http://127.0.0.1:${PUERTO}/#${r}`, { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    const roto = await p.getByText('Esta pantalla tuvo un problema').count();
    if (roto || errores.length) mal++;
    console.log(`${roto || errores.length ? 'MAL' : 'OK '} ${r}${x.borrador ? ` (borrador: ${x.borrador.modo})` : ''} ${errores.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
