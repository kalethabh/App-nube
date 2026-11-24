// Carpetas persistentes y migración de conexiones: solo archivo sintético, sin Shopify ni credenciales reales.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listarCarpetas, guardarCarpeta, quitarCarpeta, listarTiendas, editarTienda, conectarConCuenta } from '../server/lib/shopify/tiendas.js';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kads-carpetas-'));
const archivo = path.join(dir, 'tiendas.json');
const antes = process.env.SHOPIFY_TIENDAS_ARCHIVO;
process.env.SHOPIFY_TIENDAS_ARCHIVO = archivo;
let pasan = 0;
function comprobar(nombre, fn) { fn(); pasan++; console.log(`OK ${nombre}`); }
try {
  const fixture = { tiendas: [{ id: 'co', nombre: 'District Colombia', dominio: 'district-co.myshopify.com', cuenta: 'District Shop', pais: 'CO', tipo: 'temas', token: null }, { id: 'ec', nombre: 'District Ecuador', dominio: 'district-ec.myshopify.com', cuenta: 'District Shop', pais: 'EC', tipo: 'completo', token: 'CLAVE_SINTETICA', clientSecret: 'SECRETO_SINTETICO', clientId: 'ID_SINTETICO' }, { id: 'otro', nombre: 'Otra', dominio: 'otra.myshopify.com', cuenta: 'Otro negocio', pais: 'PE', tipo: 'temas', token: null }], propiedadPrevia: true };
  fs.writeFileSync(archivo, JSON.stringify(fixture));
  const cs = listarCarpetas();
  const district = cs.find((c) => c.nombre === 'District Shop');
  comprobar('Agrupa conexiones antiguas por negocio y conserva sus IDs', () => { assert.equal(cs.length, 2); assert.deepEqual(listarTiendas().map((t) => t.id), ['co', 'ec', 'otro']); assert.equal(listarTiendas().find((t) => t.id === 'ec').carpetaId, district.id); });
  comprobar('La migración de lectura es estable y no escribe credenciales', () => { assert.deepEqual(listarCarpetas(), cs); assert.deepEqual(JSON.parse(fs.readFileSync(archivo)), fixture); });
  comprobar('Las respuestas públicas no contienen claves', () => { assert.doesNotMatch(JSON.stringify(listarTiendas()), /CLAVE_SINTETICA|SECRETO_SINTETICO|ID_SINTETICO/); });
  const vacia = guardarCarpeta({ nombre: '  Nueva   marca  ' });
  comprobar('Una carpeta vacía persiste al volver a leer', () => { assert.equal(listarCarpetas().find((c) => c.id === vacia.id).nombre, 'Nueva marca'); assert.equal(JSON.parse(fs.readFileSync(archivo)).propiedadPrevia, true); });
  comprobar('Rechaza nombres vacíos, demasiado largos y duplicados', () => { assert.throws(() => guardarCarpeta({ nombre: ' ' }), { status: 400 }); assert.throws(() => guardarCarpeta({ nombre: 'x'.repeat(61) }), { status: 400 }); assert.throws(() => guardarCarpeta({ nombre: 'district SHOP' }), { status: 409 }); });
  guardarCarpeta({ id: district.id, nombre: 'District Internacional' });
  comprobar('Renombrar conserva la relación de las tiendas', () => { assert.equal(listarCarpetas().find((c) => c.id === district.id).nombre, 'District Internacional'); assert.equal(listarTiendas().find((t) => t.id === 'co').carpetaId, district.id); });
  comprobar('No elimina carpetas que aún tienen tiendas', () => { assert.throws(() => quitarCarpeta(district.id), { status: 409 }); });
  editarTienda('ec', { carpetaId: vacia.id, pais: 'GT' });
  comprobar('Mover una tienda conserva dominio y credenciales', () => { const t = JSON.parse(fs.readFileSync(archivo)).tiendas.find((t) => t.id === 'ec'); assert.equal(t.carpetaId, vacia.id); assert.equal(t.pais, 'GT'); assert.equal(t.token, 'CLAVE_SINTETICA'); assert.equal(t.clientSecret, 'SECRETO_SINTETICO'); assert.equal(t.dominio, 'district-ec.myshopify.com'); });
  comprobar('No mueve ni conecta una tienda a una carpeta inexistente', () => { assert.throws(() => editarTienda('ec', { carpetaId: 'inexistente' }), { status: 404 }); assert.throws(() => conectarConCuenta({ dominio: 'prueba', carpetaId: 'inexistente' }), { status: 404 }); assert.equal(listarTiendas().find((t) => t.id === 'ec').carpetaId, vacia.id); });
  editarTienda('co', { carpetaId: vacia.id });
  quitarCarpeta(district.id);
  comprobar('Eliminar una carpeta vacía no desconecta tiendas ni reaparece por su cuenta anterior', () => { assert.ok(!listarCarpetas().some((c) => c.id === district.id)); assert.equal(listarTiendas().length, 3); assert.equal(listarTiendas().find((t) => t.id === 'co').cuenta, 'District Shop'); });
  comprobar('Archivo privado en sistemas con permisos POSIX', () => { if (process.platform !== 'win32') assert.equal(fs.statSync(archivo).mode & 0o777, 0o600); });
  console.log(`\n${pasan}/${pasan} OK, sin gasto`);
} finally { fs.rmSync(dir, { recursive: true, force: true }); if (antes === undefined) delete process.env.SHOPIFY_TIENDAS_ARCHIVO; else process.env.SHOPIFY_TIENDAS_ARCHIVO = antes; }
