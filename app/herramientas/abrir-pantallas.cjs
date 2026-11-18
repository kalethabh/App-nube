// Abre pantallas de la app en el navegador y avisa si alguna se rompe al abrir (errores de la página o «Esta pantalla
// tuvo un problema»). Compilar no basta: un error como usar una variable antes de calcularla solo sale al abrir.
//   ANUNCIOS_MODO_PRUEBA=1 PUERTO=4471 node app/server/index.js   (en otra terminal)
//   node app/herramientas/abrir-pantallas.cjs                     (las de siempre; o pasa rutas: /imagenes/nuevo …)
//   PUERTO_PANTALLAS=4471 cambia el puerto
const { chromium } = require('playwright');
const LAS_DE_SIEMPRE = ['/inicio', '/tablero', '/nuevo', '/imagenes', '/imagenes/nuevo', '/investigacion', '/inspiracion', '/anuncios', '/editor', '/biblioteca', '/ajustes', '/aprendizajes'];
const RUTAS = process.argv.length > 2 ? process.argv.slice(2) : LAS_DE_SIEMPRE;
const PUERTO = process.env.PUERTO_PANTALLAS || '4471';
(async () => {
  const b = await chromium.launch();
  let mal = 0;
  for (const r of RUTAS) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)));
    await p.goto(`http://127.0.0.1:${PUERTO}/#${r}`, { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    const roto = await p.getByText('Esta pantalla tuvo un problema').count();
    if (roto || errores.length) mal++;
    console.log(`${roto || errores.length ? 'MAL' : 'OK '} ${r} ${errores.join(' | ')}`);
    await p.close();
  }
  await b.close();
  process.exit(mal ? 1 : 0);
})();
