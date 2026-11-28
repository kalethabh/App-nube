// Ejecuta las migraciones reales en PostgreSQL aislado (PGlite); no se conecta a Supabase.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {PGlite}=await import(pathToFileURL(path.join(process.env.PGLITE_PACKAGE_PATH,'dist/index.js')).href);
const db=new PGlite();
const owner='11111111-1111-1111-1111-111111111111',empleado='22222222-2222-2222-2222-222222222222';
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await db.query('insert into auth.users values($1,$2,$3),($4,$5,$3)',[owner,'owner@example.test','{}',empleado,'staff@example.test']);
 for(let n=0;n<2;n++){await db.exec(fs.readFileSync(path.join(raiz,'deploy/supabase-kads.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(raiz,'deploy/supabase-permisos-google.sql'),'utf8'));}
 await db.exec('set role authenticated');
 const como=async id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 await como(owner);assert.equal((await db.query('select * from kads_mi_acceso()')).rows[0].rol,'owner');
 await como(empleado);let acceso=(await db.query('select * from kads_mi_acceso()')).rows[0];assert.equal(acceso.rol,'pendiente');assert.deepEqual(acceso.secciones,[]);
 await assert.rejects(()=>db.query('select * from kads_lista_accesos()'),/Solo el administrador/);
 await assert.rejects(()=>db.query('select kads_cambiar_acceso($1,$2,$3)',[empleado,'empleado',['landings']]),/Solo el administrador/);
 await assert.rejects(()=>db.query("update kads_usuarios set secciones='{landings}'"),/permission denied/);
 await como(owner);await db.query('select kads_cambiar_acceso($1,$2,$3)',[empleado,'empleado',['landings','embudo','landings']]);
 await como(empleado);acceso=(await db.query('select * from kads_mi_acceso()')).rows[0];assert.equal(acceso.rol,'empleado');assert.deepEqual(acceso.secciones,['embudo','landings']);
 await como(owner);await assert.rejects(()=>db.query('select kads_cambiar_acceso($1,$2,$3)',[owner,'empleado',[]]),/administrador/);
 await assert.rejects(()=>db.query('select kads_cambiar_acceso($1,$2,$3)',[empleado,'owner',[]]),/rol no existe/);
 await assert.rejects(()=>db.query('select kads_cambiar_acceso($1,$2,$3)',[empleado,'empleado',['inexistente']]),/Secciones inválidas/);
 await db.query('select kads_cambiar_acceso($1,$2,$3)',[empleado,'empleado',[]]);await como(empleado);assert.deepEqual((await db.query('select * from kads_mi_acceso()')).rows[0].secciones,[]);
 console.log('OK SQL real en PostgreSQL aislado: migración repetible, cuentas pendientes sin permisos, concesión y revocación');
 console.log('OK RLS y funciones: empleado no lee la tabla ni asigna permisos; no se modifica al administrador ni se aceptan secciones falsas');
} finally {await db.close();}
