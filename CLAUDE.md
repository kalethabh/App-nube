# Anuncios con IA (App-nube)

**Si te ejecuta la app ("MODO APP" en tus instrucciones), ignora este archivo entero: mandan las reglas del modo app.**

Lo de abajo es para cuando el usuario te habla en Claude Code dentro de esta carpeta.

## Qué es esta carpeta

La app "Anuncios con IA" (se abre con «Abrir Anuncios con IA.command» en Mac o «.bat» en Windows, en http://127.0.0.1:4455) más el motor que produce los anuncios (`produccion/`, `remotion/`) y las skills de cada estilo (`.claude/skills/`). Las imágenes, los videos y la música salen de kie.ai; la voz y las transcripciones, de ElevenLabs. Las claves viven en `.env` (nunca se leen ni se muestran).

- **Si el usuario pide abrir o instalar la app**: que haga doble clic en el lanzador de su sistema (instala lo que falte solo). Si quiere que lo hagas tú: `node app/inicio/preparar-app.mjs` y después `npm start --prefix app` en segundo plano.
- **Casi todo se hace desde la app**: los 13 estilos, la continuidad, los subestilos, **Clonar un video** (en los ajustes de cada estilo) y **Más ganchos** (en la entrega de un anuncio con narrador ya hecho).
- **Desde Claude Code**: el **Sketch de comedia** (`.claude/skills/anuncios-sketch/`), y cualquier estilo si el usuario lo prefiere por chat. Usa SIEMPRE las skills de `.claude/skills/` de esta carpeta (no las de la cuenta con prefijo `anthropic-skills:`). El proceso completo de producción por comandos está en `COMO-PRODUCIR.md`.

## Reglas que no se rompen

1. **Nunca generes nada que cobre** (imágenes, videos, música, canciones) sin mostrar antes el costo (`--solo-plan`) y esperar un sí.
2. **Nunca inventes un prompt nuevo** si una toma sale mal: pregunta, muéstralo y rehaz con `npm run rehacer`.
3. Cada anuncio vive en `temp/<slug>/`; los MP4 terminados salen a `output/`.
4. **El guardado es automático**: la app sube a GitHub cada 2 minutos lo liviano; los videos, audios e imágenes van a Google Drive y, de los anuncios terminados, se borran de la Mac (`temp/<slug>/app/en-la-nube.json` dice qué). Antes de tocar uno de esos anuncios desde Claude Code, tráelo de vuelta (en la app, «Traer de vuelta»). No hagas commits ni push por tu cuenta salvo que el usuario lo pida.
5. Lo propio del usuario (notas, fotos, scripts) va en `mis_archivos/`; las reglas aprendidas en `mis_archivos/biblioteca/aprendizajes/` (`general.md` y una por estilo): léelas antes de empezar un anuncio.

## Lo que se sumó desde IA-VID-AUTOMATIC (2026-11-08)

- Estilo **Realista con narrador** y **subestilos** con fotogramas de referencia (el motor adjunta el `"fotograma"` de cada imagen al generador, versión sin texto de `limpio/`).
- **Clips sin cobro**: `"quieto"` (B-roll o toma A armado desde su imagen) y la **biblioteca de clips** (`"guardar_en_biblioteca"` / `"desde_biblioteca"`, en `mis_archivos/biblioteca/clips/`).
- **Aprendizajes** automáticos: la app anota en `generaciones.md` lo que hubo que rehacer y por qué, y se los pasa a Claude al escribir cada guion.
- **Clonar un video**, **Más ganchos**, **Inversión por producto** (Ajustes) y **Guardado en la nube** (Ajustes).
- Agentes `director-creativo` y `supervisor-generaciones` (`.claude/agents/`), para usar desde Claude Code.
