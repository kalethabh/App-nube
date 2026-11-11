<!-- Tarea "imagen-ads-prompts" (Anuncios de imagen): los V##.json que faltan, de a 8. Marcas que llena
     lib/imagen-ads/sesiones.js: {{lote}} {{ids}} {{variaciones}} {{logo}} -->
TAREA: imagen-ads-prompts
Carpeta del lote: temp/{{lote}}
Lee y sigue `.claude/skills/anuncios-imagen-ads/SKILL.md` (léelo entero antes de escribir nada).
- Haz solo el PASO 5 de: {{ids}}. `producto.json` y `plan.json` ya están: léelos, pero no los cambies.
- Lo que dice el plan de cada una (no hace falta que abras `plan.json` entero):
```json
{{variaciones}}
```
- Las que salen de una referencia la traen en `referencia`: mírala con Read (Protocolo de Traducción Estructural). Las de la biblioteca: abre su archivo de `formatos/` (campo `archivo` del índice).
- Sin scripts, sin `.env`, sin PASO 3, 6 ni 7, sin subagentes y sin internet. Donde la skill dice `anuncios/<slug>/lote-NN/`, es `temp/{{lote}}/`.
{{logo}}
Escribe `temp/{{lote}}/<id>.json` de cada id. Responde LISTO (o BLOQUEADO con `temp/{{lote}}/app/imagen-ads/bloqueo.json`).
