// El ingreso con cuenta (lib/acceso.js): solo con KADS_SUPABASE_URL y KADS_SUPABASE_ANON en el servidor.
//   GET  /entrar                           la página para entrar o crear la cuenta
//   POST /api/acceso/entrar { correo, clave }
//   POST /api/acceso/registro { nombre, correo, clave }
//   POST /api/acceso/salir
//   GET  /api/acceso/yo                    -> { activo, correo, nombre, rol }
//   GET  /usuarios · GET /api/acceso/usuarios · PUT /api/acceso/usuarios/:id { rol }   (solo el dueño)
import express from 'express';
import { rutasAcceso } from '../lib/acceso.js';

export default function (app) {
  rutasAcceso(app, express.json({ limit: '20kb' }));
}
