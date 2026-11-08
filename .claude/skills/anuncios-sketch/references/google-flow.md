# Producir en Google Flow (navegador del usuario)

Se usa cuando el usuario pide generar en **Google Flow** en vez de Kie, con su cuenta de Google. Las imágenes van con **Nano Banana** y los videos con **Gemini Omni Flash**. Todo lo demás (guion, mapa de ejes, prompts, montaje y QA) es igual.

Investigado el 2026-10-31 en support.google.com/flow. Flow cambia seguido: guíate por lo que ves en pantalla (lee la página antes de hacer clic) y no por posiciones fijas.

## Antes de empezar
- Usa el navegador del usuario (Claude in Chrome), donde ya inició sesión. **Nunca** escribas contraseñas, nunca cambies la configuración de la cuenta, nunca compres créditos ni planes, y nunca resuelvas un CAPTCHA: si aparece uno, para y pídele al usuario que lo resuelva.
- URL: **https://flow.google.com** (labs.google/fx/tools/flow redirige ahí). Necesita Chrome o Edge de escritorio, cuenta mayor de 18 años y un país habilitado (casi toda Latinoamérica lo está). Con VPN falla.
- **Créditos:** el video gasta créditos de Flow. Las imágenes no gastan créditos, pero tienen un tope diario por modelo. Antes de cada video, lee el costo que muestra "Settings" bajo la caja del prompt. Referencia: Omni Flash 720p cuesta 7 (4 s), 10 (6 s), 12 (8 s) o 15 (10 s) créditos por clip; en 360p, la mitad. Los planes traen de 50 por día (gratis) a 25.000 por mes (Ultra).
- Calcula el costo total (19 clips ≈ 200 créditos en 720p) y confírmalo con el usuario antes de generar.
- **Number of outputs = 1**: cada salida extra multiplica el costo.

## Subir y bajar archivos con el navegador
- **Subir** (referencias, fotogramas): con Claude in Chrome no se pueden arrastrar archivos locales. Haz clic en el botón de agregar o subir de Flow (o Ctrl+U) y, cuando aparezca el selector de archivos, usa la herramienta de subida de archivos de Claude in Chrome (`file_upload` o `upload_image`) con la ruta local del archivo. Carga esas herramientas con ToolSearch si están diferidas.
- **Bajar:** las descargas caen en la carpeta de Descargas del navegador (en Windows, `C:\Users\<usuario>\Downloads`). Después de cada descarga, busca el archivo más reciente ahí, muévelo a la carpeta del proyecto con un nombre claro (`frames/s05.png`, `clips/s05.mp4`) y regístralo con `produccion.py <carpeta> registrar <clave> <ruta>`. La ruta es relativa a la carpeta del proyecto.
- **Prompts:** `produccion.py <carpeta> prompts refs` (hojas de personaje y locación), `prompts frames sXX` y `prompts video sXX`.

## Pasos
1. **Proyecto:** en la página de inicio, "+ New project". Renómbralo con el nombre del anuncio.
2. **Imágenes (referencias y fotogramas):**
   1. Abre el chip del modelo (abajo, en la caja del prompt) → "Image".
   2. Elige el modelo: Nano Banana 2.1 (estándar), 2 Lite (sin costo) o Pro. Fija la relación 9:16 y 1 salida.
   3. Pega el prompt: `python produccion.py <carpeta> prompts refs` para las hojas de personaje y la locación (la hoja de personaje va en 16:9), y `prompts frames s05` para cada fotograma.
   4. Agrega las referencias en el orden que dice el prompt (hojas de personaje, locación y foto del producto): súbelas como se explica arriba, o usa "Add to Prompt" sobre una imagen que ya esté en el proyecto de Flow.
   5. Generate (el botón de flecha).
   6. Descarga: More → Download, o Ctrl+D. Si hace falta, sube la resolución a 2K.
   7. Guarda cada archivo en la carpeta del proyecto y regístralo: `python produccion.py <carpeta> registrar frame_s05 frames/s05.png` (o `char_caro`, `loc_principal`).
3. **Videos (un clip por toma):**
   1. Chip del modelo → "Video" → "Frames".
   2. Pon el fotograma aprobado en "Add start frame" (súbelo o elígelo entre las imágenes del proyecto). El packshot (`imagen_fija`) no se anima.
   3. Elige el modelo **Gemini Omni Flash** (en la interfaz puede aparecer como "Omni Flash"). Fija orientación vertical (9:16), 720p, la duración de la toma (4/6/8/10 s) y 1 salida.
   4. Pega el prompt de video, que trae el bloque de quién habla y quién calla: `python produccion.py <carpeta> prompts video s05`.
   5. Revisa el costo en Settings y dale a Generate. Omni tarda entre 1 y 3 minutos. Si una tarjeta queda en "Pending", mira las notificaciones o recarga la página.
   6. Descarga el MP4 en 720p ("Original size"), o en 1080p ("Upscaled") si el plan lo permite. Regístralo: `python produccion.py <carpeta> registrar clip_s05 clips/s05.mp4`.
4. Revisa con `hoja.py` y sigue con `montaje.py` y `revision.py`, igual que con Kie.

## Proyecto marcado como Flow
Pon `"modelos": {"proveedor": "flow", ...}` en `proyecto.json`. Así `produccion.py` no genera nada en Kie por error (refs, frames, video y rehacer se niegan salvo `--kie`), y `estimar` muestra el costo en créditos de Flow.

## Ajustes y regeneraciones
Para rehacer algo que se hizo en Flow:
1. Edita `proyecto.json` (encuadre, línea, mirada…).
2. Saca el prompt nuevo: `produccion.py <carpeta> prompts frames|video sXX`.
3. Genera en Flow y descarga.
4. Corre `registrar`, que archiva la versión anterior como `_vN`.

No uses `rehacer`: genera y cobra en Kie. Después sigue con `montaje.py` y `revision.py`.

## Problemas comunes
- "You're requesting generations too quickly": espera y genera de una en una, sin lanzar muchas en paralelo.
- "We noticed some unusual activity": espera unos minutos y reintenta. Sin VPN.
- **Bloqueo por filtros:** se reembolsa. Corrige el prompt o el fotograma según la tabla de filtros de `prompts.md`.
- **Cambio de modo:** si eliges un modo que el modelo no soporta, Flow cambia de modelo solo. Revisa el chip después de cambiar de modo.
- **Links firmados:** caducan en unas 6 horas, así que descarga enseguida.
- **Nada se borra:** "Move to trash" solo mueve a la papelera, y aun así no borres nada del usuario.
- **Agent de Flow:** no lo uses (gasta créditos por su cuenta). Usa la caja del prompt normal.
