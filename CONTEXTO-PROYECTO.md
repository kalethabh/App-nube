# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-08.

## Qué es

- **Repositorio:** https://github.com/kalethabh/App-nube (privado, rama `main`).
- **Qué hay dentro:** la app local **«Anuncios con IA»** (versión 2026-11-06, de un curso; autor original Diego Dávila), a la que se le sumaron funciones de mi otra herramienta, **IA-VID-AUTOMATIC** (https://github.com/kalethabh/IA-VID-AUTOMATIC, privada; su app web es Next.js en `app-web/`).
- **En mi Mac** está clonada en `~/Anuncios con IA` (`git clone https://github.com/kalethabh/App-nube.git "Anuncios con IA"`). Se abre con doble clic en «Abrir Anuncios con IA.command»; la app corre en http://127.0.0.1:4455.
- **Servicios:** Claude Code con mi cuenta escribe los guiones (no usa clave de API); kie.ai hace las imágenes, los videos y la música (Suno); ElevenLabs hace la voz y las transcripciones. Las claves van en `.env`, que nunca se sube.

## Cómo está armada la app

- `app/server/` (Express): `lib/anuncios-nuevos.js` (estilos, formulario, tarea del guion), `lib/conductor.js` (producción paso a paso), `lib/familias/*.js` (voz-en-off, continuidad, ugc, hablado, objeto-parlante, musical, historia-musical), `lib/claude.js` y `lib/colas.js` (sesiones de Claude Code en «modo app»), `rutas/*.js` (se cargan solas, en orden alfabético).
- `app/server/claude/`: los textos de cada tarea (`tarea-guion.md`, `modo-app.md`, `estilos/<clave>.md`).
- `app/src/` (React + Vite; `npm run build` deja `app/dist`): `pantallas/nuevo` (producto, estilos y guion), `estilos`, `entrega`, `editor`, `tablero` y `ajustes`.
- `produccion/`: el motor (generar-imagenes, generar-videos, producir, validar-manifiesto, ensamblar…). `remotion/` arma el video. `.claude/skills/`: una skill por estilo (17).
- **Modo prueba sin gastar:** `node app/herramientas/prueba-humo.mjs`. Con `HUMO_SIN_ANUNCIO=1` hace solo las revisiones rápidas; sin esa variable produce un anuncio claymation simulado completo. Última corrida: 61 de 64 OK; lo único que falla es Python con `rembg` en el servidor de prueba.

## Lo que se le agregó (todo probado en modo prueba)

1. **Estilo Realista con narrador** (`realista-narrado`, familia voz en off; sin continuidad). Tiene su muestra en `app/muestras/realista-narrado/`.
2. **Subestilos** (19, en 7 estilos: Pixar, Zack D, Realista, Skeleton, UGC, Objeto parlante y Musical). Viven en `.claude/skills/<skill>/subestilos/`. En el formulario se eligen con miniaturas que reproducen su referencia al pasar el mouse (`vista.jpg` y `vista.mp4`, servidos por `/subestilos/...`). El motor adjunta el `"fotograma"` de cada imagen (versión sin texto, en `limpio/`) al generador: `produccion/fotogramas.js`.
3. **Clonar un video**: un campo en los ajustes de cada estilo (menos los cantados) para subir un archivo (`POST /api/referencias`) o pegar un link (yt-dlp, `produccion/bajar-referencias.js`). Antes del guion, `lib/clonar.js` analiza el video con `.claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs` y Claude escribe el ADN y el guion clonado.
4. **Más ganchos**: en la entrega de un anuncio con narrador ya terminado, de 2 a 5 versiones (`lib/ganchos.js`, `rutas/ganchos.js`, `entrega/MasGanchos.jsx`). Crea `temp/<slug>-gancho-N` y solo genera el gancho nuevo.
5. **Clips sin cobro**: `"quieto"` (B-roll o toma A armados con ffmpeg desde su imagen) y la biblioteca de clips (`"guardar_en_biblioteca"` / `"desde_biblioteca"`, en `mis_archivos/biblioteca/clips/`). Código en `produccion/clips-sin-cobro.js`, más el validador, el estimador y generar-imágenes/videos.
6. **Aprendizajes**: `lib/aprendizajes.js` anota en `mis_archivos/biblioteca/aprendizajes/generaciones.md` lo que hubo que rehacer y los cambios que pedí, y lo pasa a Claude en cada guion junto con `general.md` y `<estilo>.md`.
7. **Agentes** `director-creativo` y `supervisor-generaciones` (`.claude/agents/`), para usar desde Claude Code.
8. **Especiales** en la pantalla Estilos: Clonar, Más ganchos y Sketch, con miniaturas.
9. **Inversión por producto** (Ajustes): suma lo que ya gasté de verdad (`rutas/inversion.js`).
10. **Guardado en la nube** (`lib/guardado.js`, `rutas/guardado.js`, `rutas/_nube.js`, Ajustes → Guardado):
    - Cada 2 minutos hace `git add -A` + commit + push de lo liviano: guiones, manifiestos, ajustes, aprendizajes y lo que se borró.
    - Los videos, audios e imágenes de cada anuncio se copian a Google Drive, en «Anuncios con IA/<anuncio>/». Cuando el anuncio termina y la copia está verificada, **se borran de la Mac** (queda `temp/<slug>/app/en-la-nube.json` y una `portada.jpg`).
    - Al editar, exportar, rehacer o pedir ganchos, se traen solos de vuelta; también hay un botón «Traer de vuelta» en la entrega.
    - Hace falta Google Drive para escritorio con «Transmitir archivos» activado.

11. **Clips y video final en 1080p** (`produccion/config.js`, `RESOLUCION_VIDEO`; Remotion con `--scale=1.5`). Omni cobra igual que en 720p.
12. **No pagar dos veces la misma imagen** (`produccion/imagenes-repetidas.js`).
13. **Biblioteca** (menú Biblioteca; `lib/biblioteca.js`, `rutas/biblioteca.js`, `pantallas/biblioteca/`):
    - `mis_archivos/biblioteca/` es una copia del repositorio privado `biblioteca-anuncios`, el MISMO de IA-VID-AUTOMATIC: avatares, audios, clips, imágenes y aprendizajes de las dos apps. Se sincroniza al abrir la app y cada 10 minutos; no la sube el guardado de la app.
    - Avatares: subiendo fotos, desde un anuncio terminado (botón en la entrega) o «como en un anuncio de referencia» (retratos y prompts de los subestilos).
    - En «Nuevo anuncio», «De tu biblioteca» elige las personas y la música; la música generada se guarda sola al terminar.
14. **Movimiento del original**: la tarea del guion pide escribir cada prompt de video desde `subestilos/<id>/movimiento/`.
15. **Preferencias** (`mis_archivos/preferencias.md`, traídas de IA-VID-AUTOMATIC) y los aprendizajes de las dos apps, con la bitácora del supervisor, van en cada guion.

## Decisiones que tomé

- **No quiero nada de costos estimados, presupuesto ni aprobación automática por costo** (de IA-VID-AUTOMATIC). Se agregó un «tope de gasto» y se quitó.
- **No quiero imágenes sueltas.** La generación tiene que seguir siendo tan fácil y rápida como en la app original.
- El repositorio es **privado** (la app viene de un curso).
- Las pruebas de GitHub Actions solo corren a mano (`workflow_dispatch`).

## Lo que falta o queda pendiente

- **Sketch de comedia dentro de la app.** Hoy solo se hace desde Claude Code (`.claude/skills/anuncios-sketch/`). Tiene su propio pipeline en Python (`produccion.py`, `montaje.py`, `revision.py`; necesita `faster_whisper`, unos 3 GB) y habría que crearle una familia nueva en el conductor y una tarea de guion propia.
- Confirmar en mi Mac que Ajustes → Guardado muestre GitHub «al día» y Google Drive «al día».
- **Opcional:** sacar las muestras de video del repositorio (unos 270 MB) para que clonar pese menos.
- No se agregaron de IA-VID-AUTOMATIC (no los pedí o los descarté): modo automático con presupuesto, lotes con tope, imágenes sueltas con lápiz, chat dentro de la app, catálogo de creativos para campañas y contraseña de entrada.
