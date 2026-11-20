// EL CONECTOR PARA CLAUDE, desde Ajustes (lib/conector.js; el servidor MCP en sí está en index.js, /mcp/<clave>).
//   GET  /api/conector          -> { activo, url, enServidor, ultimoUso }
//   PUT  /api/conector          { activo } -> lo mismo
//   POST /api/conector/clave    -> una clave nueva (la dirección vieja deja de servir)
import express from 'express';
import { soloDesdeLaApp } from '../lib/productos.js';
import { vista, guardarConfig, nuevaClave } from '../lib/conector.js';

const json = express.json({ limit: '4kb' });

export default function rutasConector(app) {
  app.get('/api/conector', (req, res) => res.set('Cache-Control', 'no-store').json(vista()));
  app.put('/api/conector', soloDesdeLaApp, json, (req, res) => res.json(guardarConfig({ activo: req.body?.activo === true })));
  app.post('/api/conector/clave', soloDesdeLaApp, (req, res) => res.json(nuevaClave()));
}
