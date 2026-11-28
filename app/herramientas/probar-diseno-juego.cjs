// Revisión visual/funcional sin producir anuncios. Usa el servidor aislado en modo prueba.
// NODE_PATH=<paquetes con playwright> PUERTO_PANTALLAS=4491 PLAYWRIGHT_CHROME=<opcional> node app/herramientas/probar-diseno-juego.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = `http://127.0.0.1:${process.env.PUERTO_PANTALLAS || 4491}`;
const rutas = ['/inicio', '/oficina', '/nuevo', '/estilos', '/imagenes', '/imagenes/nuevo', '/investigacion', '/productos', '/tablero', '/anuncios', '/editor', '/biblioteca', '/carpetas', '/landings', '/sep', '/shopify', '/saldo', '/aprendizajes', '/ajustes'];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME ? { executablePath: process.env.PLAYWRIGHT_CHROME } : {}) });
  const errores = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => { if (!localStorage.getItem('kads:tema')) localStorage.setItem('kads:tema', 'juego'); localStorage.setItem('kads:tema-juego', '1'); });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(String(e)));
    for (const ruta of rutas) {
      await p.goto(`${base}/#${ruta}`);
      await p.waitForTimeout(ruta === '/oficina' ? 3000 : 700);
      const luego = p.getByRole('button', { name: 'Ahora no', exact: true });
      if (await luego.isVisible()) await luego.click();
      assert.equal(await p.getByText('Esta pantalla tuvo un problema', { exact: true }).count(), 0, ruta);
      assert.equal(errores.length, 0, `${ruta}: ${errores.join(' | ')}`);
      console.log(`OK abre ${ruta}`);
    }
    await p.goto(`${base}/#/inicio`);
    await p.locator('.ciudad-portada__arte').waitFor();
    await p.evaluate(() => document.fonts.ready);
    assert.equal(await p.locator('.ciudad-portada__arte').evaluate((el) => el.complete && el.naturalWidth > 0), true);
    for (const [texto, hash] of [['Crear un anuncio', '#/nuevo'], ['Ir a mi oficina', '#/oficina']]) {
      await p.getByRole('link', { name: texto, exact: true }).click();
      await p.waitForURL(`**/${hash}`);
      assert.equal(new URL(p.url()).hash, hash);
      await p.goto(`${base}/#/inicio`);
    }
    assert.equal(await p.locator('.ciudad-mision').count(), 3);
    assert.deepEqual(await p.locator('.ciudad-mision').evaluateAll((els) => els.map((e) => e.getAttribute('href'))), ['#/nuevo', '#/imagenes', '#/investigacion']);
    // La portada y las nuevas tipografías no fuerzan los temas alternativos.
    for (const tema of ['claro', 'oscuro', 'juego']) {
      await p.evaluate((t) => localStorage.setItem('kads:tema', t), tema);
      await p.reload();
      await p.waitForTimeout(400);
      assert.equal(await p.locator('html').getAttribute('data-tema'), tema);
      // (2026-11-24l) la portada de la ciudad también va en el tema claro; el oscuro conserva su cabecera
      assert.equal(await p.locator('.ciudad-portada').count(), tema === 'oscuro' ? 0 : 1);
      console.log(`OK cambio de tema ${tema}`);
    }
    await p.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 1024, 390]) {
      await p.setViewportSize({ width, height: 900 });
      await p.waitForTimeout(400);
      const medidas = await p.locator('.ciudad-portada').boundingBox();
      const contenido = await p.locator('.principal__contenido').boundingBox();
      assert.ok(medidas.width <= contenido.width + 1, `Portada a ${width}`);
      assert.ok(await p.locator('.ciudad-portada').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `Texto de portada a ${width}`);
      if (process.env.CAPTURAS_JUEGO) {
        fs.mkdirSync(process.env.CAPTURAS_JUEGO, { recursive: true });
        await p.screenshot({ path: path.join(process.env.CAPTURAS_JUEGO, `inicio-${width}.png`) });
      }
      console.log(`OK portada y acciones a ${width}px`);
    }
    console.log('OK enlaces, arte local, temas y movimiento reducido; sin errores JavaScript.');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
