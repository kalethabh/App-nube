# Kads Studio by Kalethabh (App-nube)

**Si te ejecuta la app ("MODO APP" en tus instrucciones), ignora este archivo entero: mandan las reglas del modo app.**

Lo de abajo es para cuando el usuario te habla en Claude Code dentro de esta carpeta.

Antes de desarrollar, lee `AGENTS.md` y `CONTEXTO-PROYECTO.md`: también se aplican al trabajar con Codex u otro asistente.
El usuario pidió mantener y subir siempre el contexto para poder continuar desde otra conversación o equipo.

## Qué es esta carpeta

La app «Kads Studio» (los lanzadores conservan el nombre «Abrir Anuncios con IA.command» en Mac o «.bat» en Windows, en http://127.0.0.1:4455) más el motor que produce los anuncios (`produccion/`, `remotion/`) y las skills de cada estilo (`.claude/skills/`). Claude Code o ChatGPT/Codex, con la cuenta del usuario, escribe los guiones y revisa. Las imágenes, los videos y la música salen de kie.ai; la voz y las transcripciones, de ElevenLabs. Las claves viven en `.env` (nunca se leen ni se muestran).

- **Si el usuario pide abrir o instalar la app**: que haga doble clic en el lanzador de su sistema (instala lo que falte solo). Desde Terminal en la Mac: `cd "$HOME/Anuncios con IA" && bash "./Abrir Anuncios con IA.command"`. Para desarrollo ya instalado, usa `node app/inicio/arrancar.mjs`, que permite el reinicio desde Actualizar.
- **Casi todo se hace desde la app**: los 13 estilos y «Agregar» (subir un video y decir lo que quieres), la continuidad, los subestilos, **Clonar un video** (en los ajustes de cada estilo) y **Más ganchos** (en la entrega de un anuncio con narrador ya hecho).
- **Sketch de comedia**: desde la app (Nuevo anuncio → «Sketch de comedia», `app/server/lib/sketch.js`, que corre los scripts de `.claude/skills/anuncios-sketch/` con su propio Python en `.venv-sketch`) o desde Claude Code. Cualquier estilo también se puede hacer por chat si el usuario lo prefiere. Usa SIEMPRE las skills de `.claude/skills/` de esta carpeta (no las de la cuenta con prefijo `anthropic-skills:`). El proceso completo de producción por comandos está en `COMO-PRODUCIR.md`.

## Reglas que no se rompen

1. **Nunca generes nada que cobre** (imágenes, videos, música, canciones) sin mostrar antes el costo (`--solo-plan`) y esperar un sí.
2. **Nunca inventes un prompt nuevo** si una toma sale mal: pregunta, muéstralo y rehaz con `npm run rehacer`.
3. Cada anuncio vive en `temp/<slug>/`; los MP4 terminados salen a `output/`.
4. **El guardado**: la app sube a GitHub cada 2 minutos lo liviano. Los medios siguen lo elegido en Ajustes → Guardado: local, Drive automático o carpeta sincronizada personalizada. Una carpeta de nube nueva conserva copia local por defecto; liberar espacio es opcional para videos con restauración integrada. `temp/<slug>/app/en-la-nube.json` registra lo archivado. Antes de tocar un anuncio archivado, tráelo de vuelta con la app. Los lotes de imágenes, Cambiar producto y Sketch conservan sus archivos locales aunque se respalden. No hagas commits ni push fuera del trabajo autorizado; el usuario sí autorizó mantener y subir siempre el contexto de desarrollo y seguir el flujo de PRs acordado.
5. Lo propio del usuario (notas, fotos, scripts) va en `mis_archivos/`. Antes de empezar un anuncio lee `mis_archivos/preferencias.md` (sus preferencias para todos los anuncios) y las reglas aprendidas en `mis_archivos/biblioteca/aprendizajes/` (`general.md`, una por estilo con el nombre de la skill sin "anuncios-", y la bitácora `generaciones.md`).
6. **`mis_archivos/biblioteca/` es su propio repositorio** (`biblioteca-anuncios`, privado, el mismo de IA-VID-AUTOMATIC): avatares, audios, clips, imágenes y aprendizajes de las dos apps. La app lo sincroniza sola; no corras git ahí.
7. **Contexto al día y en GitHub**: después de cada cambio, actualiza y publica `CONTEXTO-PROYECTO.md` con lo terminado, las pruebas, sus límites y los pendientes. La instrucción permanente está en `AGENTS.md`; no dependas de la memoria de una conversación.

## Lo que se sumó desde IA-VID-AUTOMATIC (2026-11-08)

- Estilo **Realista con narrador** y **subestilos** con fotogramas de referencia (el motor adjunta el `"fotograma"` de cada imagen al generador, versión sin texto de `limpio/`).
- **Clips sin cobro**: `"quieto"` (B-roll o toma A armado desde su imagen) y la **biblioteca de clips** (`"guardar_en_biblioteca"` / `"desde_biblioteca"`, en `mis_archivos/biblioteca/clips/`).
- **Aprendizajes** automáticos: la app anota en `generaciones.md` lo que hubo que rehacer y por qué, y se los pasa a Claude al escribir cada guion.
- **Clonar un video**, **Más ganchos**, **Inversión por producto** (Ajustes) y **Guardado en la nube** (Ajustes).
- Agentes `director-creativo` y `supervisor-generaciones` (`.claude/agents/`), para usar desde Claude Code.
- **Clips en 1080p** (`RESOLUCION_VIDEO` en `produccion/config.js`; `RESOLUCION_VIDEO=720p` en el `.env` vuelve a 720p) y el MP4 final en 1080x1920 (`ESCALA_RENDER`).
- **No pagar dos veces la misma imagen** (`produccion/imagenes-repetidas.js`): el mismo prompt, referencias y fotograma se generan una vez.
- **Biblioteca** (menú Biblioteca, `app/server/lib/biblioteca.js`): avatares y música para reutilizar, compartidos con IA-VID-AUTOMATIC. Al crear un anuncio se eligen en «De tu biblioteca»; un avatar se hace subiendo fotos, desde un anuncio terminado o como en un anuncio de referencia (los retratos y prompts de `subestilos/<id>/avatar/`). La música generada se guarda sola al terminar cada anuncio.
- **Preferencias** (`mis_archivos/preferencias.md`) y los aprendizajes de las dos apps (incluida la bitácora del supervisor) van en la tarea de cada guion (`app/server/lib/aprendizajes.js`).
- **Paquete para compartir** (`npm run paquete`, `app/herramientas/paquete-compartir.mjs`): un zip limpio (`anuncios-con-ia-app.zip`, en el Escritorio) sin `.env`, `temp/`, `output/` ni `mis_archivos/`, con preferencias en blanco y la guía `EMPIEZA-AQUI.md`. Cada persona usa sus claves y su cuenta de Claude o ChatGPT; sin repositorio, todo queda en su computador.
- **Instalar con un comando** (`npm run publicar`, `app/herramientas/publicar-version.mjs`): sube el paquete limpio como versión `v<VERSION>` al repositorio **público** `kalethabh/kads-studio` (solo instaladores y zips; el código de trabajo sigue en App-nube, privado) junto con `instalar/` (README, `instalar-mac.sh`, `instalar-windows.ps1` y su prueba en Mac y Windows). Cualquiera instala o actualiza con `curl -fsSL https://raw.githubusercontent.com/kalethabh/kads-studio/main/instalar-mac.sh | bash` (Mac: crea «Kads Studio» en ~/Applications) o `irm https://raw.githubusercontent.com/kalethabh/kads-studio/main/instalar-windows.ps1 | iex` (Windows: accesos en Escritorio y menú Inicio). Al actualizar no toca `temp/`, `output/`, `.env`, `mis_archivos/` ni los ajustes (las mismas reglas que `delAlumno` de `actualizar.js`). Después de cambiar VERSION, `npm run publicar`.
- **En un servidor** (`DESPLEGAR.md`, `deploy/instalar.sh`): la app como servicio en Ubuntu, detrás de Caddy (HTTPS y contraseña), con `ANUNCIOS_DOMINIO` (`app/server/lib/servidor.js` acepta ese nombre de host y origen). Ahí «Actualizar» reinicia la app sola.
