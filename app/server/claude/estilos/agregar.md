<!-- Lo propio de «Agregar» en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. La produccion la hace app/server/lib/familias/ugc.js o familias/voz-en-off.js, segun el formato que se elija aqui (lo lee la app del manifiesto). -->
## Lo propio de Agregar

- **El video del usuario manda.** Sigue `.claude/skills/anuncios-agregar/SKILL.md` en orden: mira el video entero (Paso 2), escribe el ADN visual (Paso 3), elige el formato (Paso 4), el guion (Paso 5) y el manifiesto con el look del video y el modelo de cada escena (Paso 6).
- **Sin pausas.** No preguntes nada: lo que el formulario dejó en "que decida la IA" lo decides tú con la skill y lo cuentas en "decisiones". La app muestra el costo antes de gastar: no lo menciones.
- **El formato decide qué skill sigues para lo técnico**: UGC → `anuncios-ugc` (léela entera; su Paso 1 y su Paso final no van: el briefing ya está contestado y la app produce sola); voz en off → `anuncios-realista-narrado` y `anuncios-estilo-pixar` (léelas enteras). En los dos, `"estilo": "agregar"`. La app sabe con cuál producirlo mirando tu manifiesto: bloques `R` = UGC; `"modo_audio": "voz_en_off"` = voz en off. No mezcles.
- **UGC**: `notas-paquete.md` va con el ADN resumido; los ganchos alternativos no hacen falta. **Voz en off**: la voz la elige el usuario en la app; quién narra y el tono salen del video.
- **La carpeta del anuncio la creó la app y es nueva**: usa siempre `temp/<slug>` tal como dice arriba.
- **La música y los sonidos de las transiciones los pone la app**: no crees `musica/` ni `efectos/`.
- **`modelo_video` y `modelo_porque` en cada toma y cada B-roll** (en UGC, en cada bloque), con la tabla de la skill. Valida: si el validador avisa que un modelo no puede hacer ese clip, cámbialo.
- **En `app/guion.json`:** `se_ve` cuenta en una frase qué pasa en la escena como en el original ("ella de espaldas frente al espejo del gimnasio, en leggings grises, se gira"); `decisiones` dice el formato y por qué, el ángulo y la zona del cuerpo, quién es la persona y cómo va el antes y después; `modelos` dice qué modelo hace qué escenas y por qué.

### Si después te piden cambios

- Cambia lo pedido con las reglas del formato que ya tiene el anuncio (UGC o voz en off): no cambies de formato salvo que el usuario lo pida.
- Si cambias una escena de tipo (por ejemplo, un B-roll que ahora es el antes y después), revisa su `modelo_video`.
