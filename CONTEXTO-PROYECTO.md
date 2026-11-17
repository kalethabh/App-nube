# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-17.

**Para la conversación nueva:** lee `AGENTS.md`, este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Regla permanente de continuidad

El usuario pidió el 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**
Al terminar cada cambio de desarrollo o decisión relevante, actualizar este archivo y subirlo a GitHub con los
cambios, siguiendo el flujo de PRs. Registrar lo terminado, los enlaces disponibles, las pruebas y sus límites,
los pendientes y el siguiente paso. Comprobar que el contexto actualizado esté en `main` antes de decir que está
publicado. La regla también está en `AGENTS.md` y `CLAUDE.md` para otros asistentes y conversaciones.

## Estado para retomar

- **Versión actual:** `2026-11-17l1` (archivo `VERSION`): estilo «Agregar» (subir un video y decir lo que quieres; la IA
  elige el estilo, la duración y el modelo de cada escena). Antes: `2026-11-17k` (editor con el audio como en CapCut),
  `2026-11-17j2` (lo último arriba y eliminar lotes de imágenes), `2026-11-17j1` (exportar más rápido), `2026-11-17i` (las imágenes respetan el ángulo y el gancho de la referencia), `2026-11-17b` (Editar con IA, PR #78), `2026-11-17a` (solo referencias ganadoras, PR #77) y `2026-11-16m` (imágenes rápidas).
- **Actualización funcional sin cambiar la apariencia:** [PR #33](https://github.com/kalethabh/App-nube/pull/33),
  integrado el 2026-11-11. Incluye Claude/ChatGPT, anuncios de imagen, modelos/costos y mejoras del editor.
- **Carpeta de guardado configurable:** [PR #34](https://github.com/kalethabh/App-nube/pull/34), integrado el mismo día.
- **Preferencia vigente:** conservar logo, colores, fuentes, menú y diseño de Kads; adaptar los controles nuevos.
- **Publicación:** los cambios de Kads se reciben desde `main` con el botón **Actualizar**. El ZIP de la Release
  «Actualización-App» es la fuente original del proveedor y reemplazaría archivos personalizados si se instala entero.
- **Siguiente trabajo funcional pendiente:** los dos pedidos de modelos alternativos ante fallas y «Estado de la IA»,
  detallados al final. Mantener el contexto al día no autoriza a iniciar esas funciones sin una petición de trabajo.

## Qué es

- **Repositorio:** https://github.com/kalethabh/App-nube (privado, rama `main`).
- **Qué hay dentro:** la app local **«Kads Studio by Kalethabh»** (antes «Anuncios con IA», versión 2026-11-06 de un
  curso; autor original Diego Dávila), a la que se le sumaron funciones de mi otra herramienta, **IA-VID-AUTOMATIC**
  (https://github.com/kalethabh/IA-VID-AUTOMATIC, privada).
- **En mi Mac** (M4) está clonada en `~/Anuncios con IA`. Se abre con doble clic en «Abrir Anuncios con IA.command»
  (que arranca `app/inicio/arrancar.mjs`); la app corre en http://127.0.0.1:4455.
- **Servicios:** Claude Code o ChatGPT/Codex, con mi cuenta y sin claves de API de Anthropic/OpenAI, escribe los
  guiones y hace las revisiones. Se elige en Ajustes → Conexiones. kie.ai hace imágenes, videos y música (Suno);
  ElevenLabs hace la voz y las transcripciones. Las claves van en `.env`, que nunca se sube ni se lee.
- **Otros repositorios míos que usa:** `biblioteca-anuncios` (en `mis_archivos/biblioteca/`, compartido con
  IA-VID-AUTOMATIC) y `anuncios-ia-videos` (los anuncios terminados, por producto; la app lo lee en
  `mis_archivos/.anuncios-github`).

## Cómo trabajar los cambios (lo que ya acordamos)

1. Partir del `main` más reciente, en una rama de trabajo. Antes se usaba `mejoras-de-ia-vid`; las últimas mejoras
   se hicieron en ramas por función y se incorporaron por PR. No asumir que una rama vieja ya contiene lo último.
2. Probar sin gastar: app en **modo prueba** (`PUERTO=4477 ANUNCIOS_MODO_PRUEBA=1 node app/inicio/arrancar.mjs`, con
   kie.ai y ElevenLabs simulados), capturas con Playwright y la **prueba de humo**
   (`HUMO_FORZAR=1 node app/herramientas/prueba-humo.mjs`). Para una revisión rápida:
   `HUMO_FORZAR=1 HUMO_SIN_ANUNCIO=1 node app/herramientas/prueba-humo.mjs`. Ver resultados recientes y límites abajo.
   Después borrar solo lo que dejaron las pruebas en `temp/` y `output/` (nunca mis anuncios).
3. **Autorizado: unir solo.** Abrir el PR y unirlo a `main` sin preguntarme (`gh api ... /merge` con
   `merge_method=merge`; GraphQL no funciona). Después `git pull origin main` en la rama. No forzar push.
4. En la Mac, para tener lo nuevo: botón **Actualizar** de la app (se reinicia sola; si hay algo produciéndose,
   espera a que termine).
5. La app guarda sola en GitHub cada 2 minutos (commits «Guardado automático»): por eso `temp/` en `main` trae mis
   anuncios. No los toques ni los subas desde las pruebas.

## Cómo está armada la app

- `app/server/` (Express): `lib/anuncios-nuevos.js` (estilos y guion), `lib/conductor.js` (producción paso a paso),
  `lib/familias/*.js`, `lib/motor-ia.js`, `lib/claude.js`, `lib/codex*.js` y `lib/colas.js` (sesiones de la IA elegida).
  Las `rutas/*.js` se cargan solas, en orden alfabético.
- `app/src/` (React + Vite; `npm run build` deja `app/dist`). Diseño: negro y verde lima, Inter, íconos lucide.
- `produccion/`: el motor. `remotion/` arma el video. `.claude/skills/`: una skill por estilo.

## Lo que tiene (además de lo del curso)

**De IA-VID-AUTOMATIC (hasta el 2026-11-08):** estilo Realista con narrador; subestilos con fotogramas; Clonar un
video; Más ganchos; clips sin cobro y biblioteca de clips; aprendizajes y preferencias en cada guion; agentes
director-creativo y supervisor-generaciones; Inversión por producto; Guardado en la nube (GitHub + Google Drive);
clips y video final en 1080p; no pagar dos veces la misma imagen; Biblioteca (avatares, música, imágenes, clips por
estilo).

**Agregado del 2026-11-08 al 11 (PRs #1 a #31):**
- **Marca y diseño:** nombre Kads Studio by Kalethabh, logo K2 y favicon; menú agrupado; pantalla Estilos renovada
  con videos de muestra.
- **Saldo y costos:** saldo de kie.ai y de ElevenLabs (`lib/claves.js`), y traer las claves de IA-VID-AUTOMATIC.
- **Anuncios:** los míos y los de GitHub por producto; video de referencia de las clonaciones; botón **Editar**, que
  trae un anuncio de GitHub a la Mac y lo abre en el editor (`lib/anuncios-github.js`).
- **Nuevo anuncio:** empieza con «Elige el tipo de anuncio» (estilos + Cambiar el producto + Sketch). El paso 1 pide
  solo foto, indicaciones, video de referencia (arrastrable) y quién escribe el guion; la ficha del producto se arma
  sola por detrás.
- **Cambiar el producto** (`lib/cambiar.js`, `produccion/cambiar-producto.js`, pantalla `#/cambiar`): sube un video
  y queda igual pero con mi producto en las escenas marcadas, sin los subtítulos del original (borrado en la Mac,
  gratis: `produccion/borrar-subtitulos.js` y `produccion/video-limpio/`, con modo «Mejor calidad» o «Rápido»), la
  voz traducida al español con la misma voz (ElevenLabs) y subtítulos nuevos. Muestra el costo antes, el avance con
  el tiempo que falta, Detener, y sigue aunque la app se reinicie.
- **Sketch de comedia** (`lib/sketch.js`, pantalla `#/sketch`, scripts de `.claude/skills/anuncios-sketch/` con su
  Python en `.venv-sketch`): brief → Claude escribe la propuesta → costo y aprobación → fotos para revisar → clips,
  montaje y revisión → dos videos (con y sin música). **Probado solo hasta los clips:** el montaje necesita bajar el
  transcriptor (~3 GB) y el entorno de prueba no lo deja.
- **Costos a la vista** (cambié de opinión: ahora SÍ los quiero): costo aproximado antes de «Me gusta, producir»,
  «Gastos de este anuncio» en la producción y en Progreso, y el saldo de kie con semáforo (verde de sobra, naranja
  justo, rojo no alcanza) — `lib/costo-anuncio.js`. Todo lo que cobra se confirma con su costo.
- **Editar una imagen ya generada** en la producción: un pedido puntual, botón de IA que propone el cambio, costo y
  rehacer su clip (`produccion/editar-imagen.js`, `rutas/editar-imagen.js`).
- **Errores en palabras:** cuando kie.ai u otro servicio falla, la producción dice el motivo, qué tomas fallaron, lo
  que respondió kie.ai y qué hacer (`procesos.causaDeFallo`, guardado en `paso.error.causa`).
- **Actualizar** desde GitHub con reinicio solo; aviso si corre una versión vieja de la app (`lib/version.js`).
- **Paquete para compartir** (`npm run paquete`) y **despliegue en servidor** (`DESPLEGAR.md`; decidí no desplegar).

## Variaciones fieles y aprobación de títulos (2026-11-16)

Implementación: [PR #61](https://github.com/kalethabh/App-nube/pull/61), integrado en `main`
(commit `5b34e17bf93bbb92c4195fa016074e1ee717f17b`). Versión pública
[2026-11-16a](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-16a) publicada y ZIP confirmado
como `uploaded`; disponible mediante «Actualizar». No se actualizó la instalación personal ni se produjo un anuncio real.

Pedido: conservar la esencia del anuncio y por qué vende; variar solo los titulares con la investigación,
mostrar propuestas antes para seleccionar y acelerar la preparación.

- `imagen-ads/titulos.js`: propuesta breve independiente de la estrategia completa. Lee la foto, referencias y
  la investigación copiada al lote (con resaltados primero), sin investigar de nuevo ni generar imágenes. Cada
  opción muestra `titulo`, `porQue` y `base`; se guarda en el borrador y se reutiliza por huella de entradas.
  Si no hay investigación, declara esa limitación en vez de inventar evidencia.
- Formulario: «Proponer títulos primero» → selección de exactamente la cantidad del lote → «Generar N anuncios»
  con el costo visible. El servidor exige selección válida y presupuesto confirmado para estos lotes nuevos.
  GET/POST `/:lote/titulos`; `/generar` recibe `titulos` (ids). Los lotes anteriores conservan compatibilidad.
- «Más de lo mismo» pasa a «Variar solo los títulos»: conserva diseño, escena, tipografía, textos secundarios,
  deseo, beneficio y mecanismo persuasivo. El formulario y las tareas ya no piden otros ángulos en este modo.
  Los títulos seleccionados se fijan en el plan y se validan también en las capas de texto del prompt.
- `variaciones-fieles.js`: antes de arrancar el motor, reutiliza la primera plantilla válida por referencia,
  uniforma las primeras variantes y completa las restantes cambiando el titular y el id. No sobreescribe
  regeneraciones del usuario ni lotes en curso. Si no encuentra una capa de titular inequívoca, mantiene el
  flujo normal de escritura. Menos sesiones repetidas; se mantiene la concurrencia existente del motor.
- Validación sin servicios de pago: 147/147 del servidor de anuncios de imagen; 4/4 pruebas nuevas (selección,
  huella, cambios de referencia, conservación de plantilla, títulos exactos y preparación para el motor);
  compilación Vite. Navegador en modo simulado: propuestas, selección de diez, cambio de selección y sin errores
  JavaScript. API en puerto aislado: propuestas sin conductor/producción, duplicados rechazados y costo obligatorio.
- Límites: no se llamó a una IA real para las propuestas ni se generaron imágenes de pago. Falta confirmar calidad
  comercial de títulos, fidelidad de píxeles y tiempos reales de kie.ai/ChatGPT; no se promete un porcentaje de mejora.
  Vite informa una clave `slug` duplicada ya existente en el editor, ajena a este cambio.
- Siguiente paso de uso: actualizar la app, elegir un producto con investigación y una referencia ganadora,
  pedir títulos y seleccionarlos; solo generar tras revisar el presupuesto.

## Últimas actualizaciones terminadas

### La esencia del video en «Agregar» y «Clonar» (2026-11-17, versión 2026-11-17l1)

- Pedido: «debe tomar muy bien el detalle de los avatares, texturas, iluminación, movimientos, gestos, tonos… para que no
  pierda la esencia». Antes el análisis daba UN fotograma por toma, a 480 px, del medio.
- `analizar-referencia.mjs` (clonación, lo usan Agregar, Clonar y Cambiar producto): fotograma a 720 px;
  `tomas/movimiento/tira-NN.jpg` (12 %, 50 % y 88 % de la toma, lado a lado con hstack del ffmpeg del sistema); por toma
  `imagen` = signalstats a 4 fps (brillo/luz, saturación/color, temperatura por V−U, movimiento por YDIF) y
  `palabras_por_segundo`. Campos nuevos: los de antes siguen igual.
- `anuncios-agregar/SKILL.md`: Paso 2 mira las tiras y lo medido; Paso 3 suma avatar al detalle (textura de piel y pelo,
  accesorios), iluminación al detalle, texturas, color y acabado (2b), movimientos y gestos (4b), tono de voz/música/
  sonidos (4c) y una fila de esencia por toma; Paso 6: esa fila va en inglés en cada prompt de imagen y video (y el tono
  en la voz), lo repetido palabra por palabra; Paso 7: chequeo de esencia toma por toma. `estilos/agregar.md` y
  `clonar.js` nombran las tiras.
- Pruebas: análisis de un video sintético (tiras y medidas correctas: naranja = cálida y quieta), humo 85/85,
  probar-agregar 49/49. Sin probar con la IA real ni un video real del usuario.

### Estilo «Agregar»: sube un video y di lo que quieres (2026-11-17, versión 2026-11-17l)

Pedido: «En Estilos uno nuevo, "Agregar": subo un video, analiza la estructura, cómo se ven las personas, entiende el
ángulo de venta (si es un producto para glúteos y piernas, que se note, sobre todo en un antes y después), piensa el
mejor modelo y, si unas escenas son mejores con otro (el B-roll), también». Y después: «subir un video y no elegir un
estilo, solo decirle lo que quiero: "este mismo video pero estilo Pixar narrado estilo musical, de 1:30 y no 5 minutos,
manteniendo el guion, ángulos…"». «Que no se limite por ninguna plataforma» se aplicó así: la app no suaviza el ángulo
ni el antes y después por su cuenta; **nunca** se escriben prompts para engañar los filtros de los proveedores (la
skill lo prohíbe); si un modelo rechaza una toma, la cascada de siempre pasa al siguiente. Rama `estilo-agregar`.

- **Registro del estilo:** `app/server/lib/estilos.js` (clave `agregar`, familia de pantalla nueva `referencia`,
  «Desde tu video»), `anuncios-nuevos.js` (`ESTILOS.agregar` con `segunReferencia`, `narrador` y `sinContinuidad`;
  `AJUSTES.agregar`: `clonar` obligatorio = el video, `pedido`, `formato`, `angulo`, `antes_despues`, `clonar_gancho`),
  `app/src/pantallas/estilos/catalogo.js` (sus preguntas, ícono, detalle; en `DISPONIBLES`), filtros de Estilos y de
  Nuevo anuncio. Skill nueva `.claude/skills/anuncios-agregar/SKILL.md` y la parte de la tarea
  `app/server/claude/estilos/agregar.md`. Reusa el análisis de Clonar (`lib/clonar.js` + `analizar-referencia.mjs`);
  sin video el guion no arranca (error claro, sin gastar la sesión de la IA). En modo prueba el análisis usa los
  simuladores (`entornoMotor`), como el motor.
- **El flujo:** la sesión del guion de «Agregar» mira el video y el pedido y escribe `referencia/adn.md`,
  `referencia/guion-clonado.md` (ya condensado a la duración pedida) y `app/plan.json` (estilo, formato, duración,
  idioma, respuestas del estilo, resumen, conserva, cambia, porque; lo revisa `revisarPlanDeAgregar`).
  · Plan `"agregar"` (el look del video): sigue en la misma sesión hasta el manifiesto con `"estilo": "agregar"`, en
    formato UGC (bloques R → `familias/ugc.js`) o con voz en off (`modo_audio: voz_en_off` → `familias/voz-en-off.js`,
    con `DEL_ESTILO.agregar`). `verificarGuion` deduce la familia del manifiesto (`familiaDelManifiesto`) y la deja en
    `brief.produccion`/`brief.familia`; `conductor.familiaDe` produce `agregar` con esa familia.
  · Plan con otro estilo (Pixar, musical…): `trabajar` llama a `pasarAlEstiloDelPlan`, que cambia `brief.estilo` a ese
    estilo (duración, respuestas y opciones del plan; el video sigue en `respuestas.clonar`; `brief.agregar` guarda el
    pedido y el plan) y lanza una sesión nueva con la skill de ese estilo (`textoClonar(..., { desdeAgregar })`: el
    guion clonado es el guion ganador, condensar sin cortar el final, `modelo_video` por escena). Desde ahí el anuncio
    es de ese estilo con su producción de siempre (los cantados: letra → Suno → tomas).
  · La revisión muestra «Lo que entendió de tu video y tu pedido» (`estadoGuion().plan`, `PlanDelPedido` en
    `Guiones.jsx`), «El modelo de cada escena» (`guion.json.modelos`, contado del manifiesto por `modelosPorEscena`) y
    el costo de siempre antes de «Me gusta, producir». En Mis anuncios: «Agregar · Estilo Pixar».
- **Modelo por escena (diseño):** campo opcional `"modelo_video"` (+ `"modelo_porque"`) en cada toma o B-roll. Los
  valores son `catalogo-modelos.json → porPieza` (`omni`, `kling`, `grok15`, `pixverse`, `grok`). `cascadaDelTrabajo`
  (motor, `modelos-elegidos.js`: `modeloPedido`, `piezaDelTrabajo`, `conModeloPedido`) y `cascadaDeLaPieza` (app,
  `lib/modelos.js`) ponen ese modelo **primero** y después la cascada de Ajustes › Modelos de su categoría: si falla o no
  puede hacer el clip (`motivoParaSaltar`: PixVerse sin imagen final, Kling en un bloque R…) sigue el siguiente. Lo
  usan generar-videos, estimar-video, estimar-costo (nota «Modelo elegido por escena: …»), gasto.js y el editor.
  `validar-manifiesto` da ERROR con un valor desconocido y AVISO si ese modelo no puede hacer el clip, no llega a su
  largo o no habla donde hay diálogo. Sin el campo, todo igual que antes.
- **Pruebas (sin gastar):** `node app/herramientas/probar-agregar.mjs` (nueva; app en modo prueba con el Claude falso):
  sin video da 400; voz en off de punta a punta hasta el MP4 (análisis, plan, familia, modelos en guion.json, costo con
  la nota, PixVerse/Grok 1.5/Omni en `log-modelos.json`, B-roll quieto sin cobro); pedido «estilo Pixar, 1:30» pasa a
  `estilo-pixar` con duración 90 s, segunda sesión con su skill, plan y costo a la vista; pedido «musical» pasa a
  `musical` con `visual: zack-d-films` y fase de letras; con `AGREGAR_UGC=1`, también UGC hasta el MP4.
  `produccion/pruebas/probar-modelos.js` suma la sección «8 bis» (modelo por escena). Resultados en el informe del PR.
- **Límites:** no se probó con una IA real ni con kie.ai/ElevenLabs reales: la calidad del análisis, del antes y
  después y de cada modelo por escena no está medida. En los cantados el `modelo_video` se pide en el texto, pero las
  tomas las escribe después la sesión visual del musical (no se verificó que lo ponga). En voz en off, el costo antes de
  aprobar puede quedar algo por debajo del cobrado cuando la voz real alarga una toma (ventanas, igual que en los demás
  estilos de narrador): en la prueba, 264 estimado contra 288 créditos simulados. Sin muestra de video propia en Estilos
  (aviso de la humo). En este entorno la interfaz no se sirve desde una carpeta oculta (`.claude/worktrees/…`): las
  pruebas con interfaz se corrieron desde una copia.

### Editor: el audio como en CapCut y lo básico que faltaba (2026-11-17, versión 2026-11-17k)

Pedido: «Implementa todo lo básico de CapCut, que me permita editar el audio así como censurar, por ejemplo: "Lo que diga
AMUA mutearlo"». Rama `editor-audio-capcut`.

- **Inventario antes de empezar.** Ya había: dividir/recortar/mover/borrar tomas y B-roll, velocidad y deslizar, tu
  video en lugar de un clip, textos e imágenes (también siguiendo un texto del video), música por tramos con fundidos,
  volumen y silencio globales de voz y música, subtítulos, difuminado y pincel de censura, mover/escalar, Editar con IA
  (con `ed.censuras`, pero solo se veían como «N censuras» y se borraban todas juntas), deshacer/rehacer. Faltaba:
  censurar sin la IA, ver y editar las censuras, silenciar un tramo, volumen por parte de la voz y fundidos de la voz,
  volumen por clip, audios propios, transcribir tus videos, duplicar, congelar, color por clip y fundido del video.
  Se dejó fuera (no pedido o riesgoso): reversa, keyframes de volumen, subir el volumen por encima del 100 %, mover la
  voz, varias pistas de audio separadas (los audios que se pisan se dibujan en filas dentro de una sola pista).
- **Modelo (`remotion/src/edicion/capas.mjs`, `completarEdicion` acepta todo `edicion.json` de antes):**
  - `ed.voz.tramos`: `null` (como venía) o `[{ id, desde, hasta, volumen 0–1, fadeIn, fadeOut }]` de 0 al final, sin
    huecos (`tramosVoz`). `datosNivelVoz(plan, ed)` → `{ tramos: [[a, b, vol, fi, fo]], censuras: [[a, b]] }` (datos,
    viajan en las props del render) y `nivelVoz(t, datos)` → 0–1. Voz aparte: `AnuncioEditado` multiplica el volumen
    de la voz por `nivelVoz`. Voz en los clips: `planAjustado` pone `plan.audio.nivelVoz` y lo aplican
    `Anuncio.jsx → Clip` y **también `Escena.jsx → ClipEscena`** (antes las censuras no callaban en podcast/entrevista).
  - `ed.censuras` (ya existía): también los tramos silenciados a mano (`palabra: ''`, modo `silencio`).
  - `ed.audios`: `[{ id, archivo: 'app/edicion/audios/aud-<id>.<ext>', nombre, duracion, desde, hasta, entrada, volumen,
    fadeIn, fadeOut }]` (`ARCHIVO_AUDIO`, `audiosDeEdicion`); `AnuncioEditado → AudiosPropios`.
  - `ed.clips[pieza].volumen` (0–1) y `.color = { brillo, contraste, saturacion }` (`colorLimpio`, `filtroDeColor`):
    `planAjustado → conAjustesDeClip` pone `volumenClip` y `filtro` (CSS) en tomas, B-roll, continuidad y piezas de
    escena; los usan `Clip`, `piezasDeContinuidad` y `ClipEscena`. `queSePuedeConElClip` suma `volumen` y `color`
    (siempre en clips; la pantalla oculta el volumen si el clip va mudo).
  - `ed.tomas[].congelado`: la parte se ve quieta en su cuadro de entrada (`Freeze` en `Clip`, sin sonido, tipo B).
  - `ed.fundido = { entrada, salida }` (s, máx. `FUNDIDO_MAX` = 5): `AnuncioEditado → FundidoNegro`.
  - El buscador de lo que se dice se movió de `rutas/editar-ia.js` a capas: `normalPalabra`, `buscarDichas` (sin
    tildes/mayúsculas, parecido, partida en dos, con sufijo, y ahora también «a mua» buscada contra «amua»),
    `palabrasDeLaVoz(plan, ed)` (montaje + correcciones), `censurasDe`. `editar-ia.js` los reexporta.
- **Operaciones puras (`pantallas/editor/cortes.js`)**, todas por `cambiar` (deshacer): pistas nuevas `voz` (dividir,
  correr el borde entre partes, «borrar» = volumen 0), `censuras` (recortar, mover, borrar) y `audios` (dividir,
  recortar con `entrada`, mover, borrar); `ajustarTramoVoz`, `fundidoVoz`, `agregarCensuras` (la que pisa otra la
  reemplaza con el modo nuevo), `quitarCensurasEn`, `modoCensura`, `silenciarTramo` (1,5 s desde el cursor),
  `agregarAudio`, `ajustarAudio`, `ajustarClip`, `duplicar` (textos, imágenes, audios), `congelar` (1,5 s, solo donde las
  tomas se cortan; lo congelado se descuenta del final de la escena). `huella()` cuenta las pistas nuevas.
- **Pantalla:** `PanelAudio.jsx` (pestaña Audio: buscar + «Silenciar todas»/«Pitido en todas», la transcripción
  clicable, silenciar un tramo, fundidos de la voz, tus audios, «Transcribir la voz (unos centavos)»);
  `pedido-voz.js` (`pedidoDeVoz`: «Lo que diga AMUA mutearlo» se resuelve en el navegador sin la IA; si habla de la
  pantalla, de escenas o textos va a la IA); `LineaDeTiempo.jsx` (la voz en partes con su envolvente, censuras
  tachadas encima, pistas Censuras y Audio con +, soltar audios); `PanelCambios.jsx` (paneles de la parte de la voz,
  la censura y el audio; volumen, brillo, contraste, saturación y «Congelar imagen aquí» del clip; «Duplicar»; sección
  «Fundido a negro»; «Censurar» en Sonido lleva a la pestaña Audio); `index.jsx` (acciones, Ctrl D, el pitido se pide
  al servidor antes de usarlo). Tokens nuevos `--pista-censuras` y `--pista-audios`.
- **Servidor:** `rutas/editor.js` `POST /api/anuncios/:slug/edicion/audio` (hasta 40 MB, `app/edicion/audios/`) y
  `POST …/edicion/pitido` (`ponerPitido`, también al guardar con censuras de pitido); `rutas/editar-ia.js` usa el
  buscador compartido y fuerza `silencio` si el pedido dice mutear/silenciar/callar (`pideSilencio`); el prompt lo
  dice explícito. `rutas/video-propio.js` `POST /api/videos-propios/:slug/transcribir` corre
  `node produccion/video-propio.js temp/<slug> --transcribir` (`transcribirVoz`: Scribe sobre `voz-original.mp3` una
  sola vez, caché en `app/video-propio/palabras.json`; `palabrasEnElVideo` lleva las palabras a cada versión cortada,
  así deshacer/rehacer cortes las conserva).
- **Exportación (`produccion/exportar-edicion.js`):** enlaza los audios propios (los que faltan se avisan y no van);
  el control final no marca como defecto el negro del fundido ni lo quieto de una toma congelada.
- **Pruebas:** build de Vite correcto; prueba de humo `HUMO_SIN_ANUNCIO=1` **85/85** (3 revisiones nuevas del audio;
  corrida desde una copia de la carpeta sin «.claude» en la ruta: en el worktree `send` no sirve `index.html` porque la
  ruta tiene un punto, y daba «La app arranca» en falso igual antes del cambio); `probar-imagen-ads` **147/147**;
  33 pruebas puras de cortes/capas/`pedidoDeVoz`; los 10 `edicion.json` guardados en `temp/` dan el mismo plan que
  antes. **Anuncio de prueba** UGC (6 clips testsrc2 con un tono por clip, 260–560 Hz, música 110 Hz) en la interfaz
  real con Playwright: buscar «TRES» (4 veces) → Silenciar todas, pitido en «frasco», «Lo que diga ATRÁS mutearlo» por
  Editar con IA (gratis), dividir la voz en 20 s y silenciar la segunda parte, deshacer/rehacer, subir un efecto (1500
  Hz), censura a pitido y vuelta a silencio, panel del clip con volumen y color; sin errores en la página. **Exportación
  real** (720) con además el clip 2 al 50 %, el clip 4 en blanco y negro y fundido a negro de 1 s: control final
  limpio, y medido con FFT: las 3 palabras silenciadas a −61/−95/−85 dB (voz normal −18 dB), la segunda parte de la voz
  a −133 dB, el pitido de «frasco» a −31 dB solo ahí, el efecto a −18 dB solo de 2 a 4 s, el clip 2 a −5,9 dB, la
  música sigue (−40 dB), saturación 0,4 en el clip 4 y luz 4 en el último cuadro. Video propio: «Lo que diga AMUA
  mutearlo» con palabras de prueba, y «Transcribir» sin clave responde «Falta tu clave de ElevenLabs» (sin cobrar).
- **No probado:** una transcripción real con ElevenLabs (cuesta; probado con palabras falsas en la caché), el
  arrastre fino de bordes de censuras y audios con el mouse (probado por las operaciones puras y los botones), un
  podcast/entrevista exportado con censuras, y en la Mac.

### Lo último arriba y eliminar lotes de imágenes (2026-11-17, versión 2026-11-17j2)

- Anuncios: `resumenAnuncio.fecha` = máx. de manifiesto, `plan-montaje.json`, `app/edicion.json` y los videos listos;
  `firmaDe` suma `app/edicion.json` (si no, la caché no veía el cambio). Las pantallas ya ordenaban por `fecha`.
- Lotes de imagen: `resumenDelLote.actualizado` (`ultimaModificacion`: creado, terminado y la fecha de la carpeta, `img/`,
  `final/`, `app/`, brief y estado). `ordenarLotes` (TusLotes) y `fechaDe` (TusProductos) lo usan; lo que se está creando
  y lo que te necesita sigue primero.
- `DELETE /api/imagen-ads/:lote`: borrador → se borra; con algo hecho → `aLaPapelera(carpeta)` (nuevo en
  `lib/papelera.js`, lo usa también `eliminarAnuncio`) a `temp/_descartados/`; creándose → 409 «detenlo primero».
  UI: «Eliminar» en cada lote que no está en marcha, con modal que lo explica.
- Pruebas: con una copia de un lote terminado (curl y Chromium: modal, eliminar, desaparece y queda en _descartados;
  segundo DELETE 404), humo 82/82, imagen 147/147.

### Exportar del editor más rápido (2026-11-17, versión 2026-11-17j1)

- Medido con un anuncio sintético de 38,6 s a 720 (4 núcleos): armar 2 s, dibujar 66 s, control 8 s. El dibujo manda.
- `produccion/exportar-edicion.js`: `concurrenciaSegunMemoria` usaba `os.freemem()`, que en macOS casi siempre da 1-2 GB
  (no cuenta la memoria que el sistema libera), así que en la Mac exportaba de a 1 cuadro. Ahora en darwin usa
  max(freemem, 60 % de la total) y el techo es 0,75 × núcleos (máx. 8); `renderConReintentos` sigue bajando a la mitad
  y a 1 si falta memoria. `x264Preset: 'veryfast'` (mismo CRF 21: −10 % de tiempo, archivo algo más liviano).
- Reutilizar: `huellaDe(props, {calidad, sinMusica, conSonido}, publico)` = sha1 de las props del render, VERSION y
  cada archivo de la carpeta pública (tamaño y fecha). Se guarda en `qa/control-editado-N.json` (`huella`, `bytes`). Si
  hay una exportación limpia con la misma huella y su MP4 sigue igual, se copia como la nueva N y se avisa `@@listo`
  con `reutilizado: true`, sin armar ni dibujar.
- Resultado: 76 → 57 s (3 a la vez en 4 núcleos); repetir con los mismos cambios: 0,1 s. El control final (8 s) se
  mantiene. `.claude/worktrees/` va al .gitignore (copias de los agentes; el guardado automático no las sube).

### Alargar un texto que sigue al video (2026-11-17, versión 2026-11-17i)

- Problema: un texto, imagen o censura con `sigue` alargado en la línea de tiempo no se veía en la parte alargada,
  porque `lugaresSeguidos` solo devuelve lugar donde el lector vio el texto (más los márgenes de 0,4/0,5 s).
- `capas.mjs`: `lugaresSeguidos(sigue, t, ventana)` con `ventana = { inicio, fin }` del elemento; sin lugar y sin
  `siempre`, `quietoEnLosBordes` lo deja quieto en el último punto (después de la última aparición, hasta `fin`) o en el
  primero (antes de la primera, desde `inicio`); entre dos apariciones no inventa nada. `AnuncioEditado.jsx`: lo pasan
  `TextoSeguido` e `ImagenEnPantalla` (vista previa y exportación iguales).
- Límite: si UN solo texto sigue dos apariciones lejanas (seg. 184 y 236), alargar solo cubre los bordes del conjunto
  (antes de la primera y después de la última). Pruebas: cuenta a mano, build, humo 82/82, imagen 147/147.

### Mover todo libremente en el editor (2026-11-17, versión 2026-11-17h)

- **Encuadre por pieza** (`remotion/src/edicion/capas.mjs`): `ed.encuadres['toma-3'|'broll-2'] = { x, y, zoom }`;
  `planAjustado → conEncuadres` lo pone en cada toma/B-roll (las tomas cortadas llevan `pieza` del plan original) y
  `Anuncio.jsx → Clip` lo aplica con `translate(%) scale()`. `piezaEnTiempo(plan, t)` dice qué se ve (el B-roll encima
  manda). No aplica a continuidad ni a podcast/entrevista (su video va fijo).
- **Mouse** (`pantallas/editor/arrastrar.js`): donde no hay capa, arrastrar mueve el encuadre; el clic lo maneja el
  editor (`stopPropagation` y `player.toggle()` si no se movió) porque el Player reproducía 200 ms después de soltar.
  Se ignoran el pincel, la barra de avance y los botones. Ctrl/⌘ + rueda = zoom. Textos sin topes (y 0–1), imágenes
  −0,1–1,1, subtítulos altura hasta 0,95 y lado ±0,45. Lo que sigue a algo (`sigue`, censuras) guarda `dx`, `dy` en su
  estilo y `AnuncioEditado.jsx` los suma a cada lugar. Íconos y textos de escena (`fijo`): `ed.ajustesEscena[e<n>]`,
  `planAjustado` pone `idEditor` y `mover`, `Escena.jsx` los envuelve con `data-capa` y el corrimiento.
- `HerramientasLienzo.jsx`: acercar, alejar y centrar el video de la escena. Tras «Censurar» con el pincel se vuelve a
  dibujar el cuadro actual.
- **Pruebas (modo prueba):** arrastrar movió el video (queda negro el borde libre), Ctrl+rueda lo acercó, centrar lo
  restableció, el clic sigue reproduciendo/pausando, la censura del pincel se arrastró (dx/dy guardados) y el plan de
  exportación lleva el encuadre. Compilación correcta. **No probado:** mover íconos de un podcast o entrevista real y
  un MP4 exportado con encuadre (es la misma composición que la vista previa).

### Editor: barra de herramientas junto al video (2026-11-17, versión 2026-11-17g)

- `pantallas/editor/HerramientasLienzo.jsx`: barra vertical a la derecha de la vista previa (vidrio, separadores,
  indicador lima del activo). Zona segura Meta/TikTok (menú; `GuiasLienzo`, que reemplaza a `ZonaMeta`), cuadrícula
  de tercios con centro, pincel para censurar (antes un chip abajo), guardar el cuadro actual
  (`GET /api/anuncios/:slug/cuadro?t=` en `rutas/seguimiento.js`, JPG del video sin las capas del editor) y velocidad de
  la vista previa (`playbackRate` del Player). Los atajos de teclado ya tenían su botón en la barra de arriba.
- Pruebas (modo prueba): capturas del editor con TikTok, cuadrícula y 1,5×; el cuadro se descarga como JPG.
  Compilación correcta.
- Pendiente si el usuario lo pide: pulir otras pantallas con el mismo criterio.

### Pincel para censurar en el editor (2026-11-17, versión 2026-11-17f)

- `pantallas/editor/PincelCensura.jsx`: chip «Pincel para censurar» en el Transporte; pausa, un `<canvas>` encima de la
  vista previa (grosor Fino/Medio/Grueso) y su barra (Borrar, Cancelar, Censurar) va debajo del video, en el lugar de
  «Edita con tus palabras». Con lo pintado (su rectángulo) llama a `POST /api/anuncios/:slug/censura/seguir`
  `{ t, x, y, w, h }` y agrega un texto `caja: true` con `sigue.pistas = [apariciones]` → se dibuja con el
  `Difuminado` (la censura difuminada de la versión 2026-11-17a).
- Servidor: `rutas/seguimiento.js` (exporta `videoDe`/`aLinea`, agrega `aOriginal` y `escenaDe`) y
  `lib/seguir-zona.js`: ffmpeg (el de Remotion: sin `fps` ni `rawvideo`, así que `scale` + `-r 10` + PNG gris por
  `image2pipe`, leídos con un decodificador PNG propio) y seguimiento por correlación (NCC) alrededor de la posición
  anterior, en las dos direcciones, dentro de la escena (corta en un cambio de plano o si lo pierde). Plantilla que se
  adapta de a poco; zona lisa → queda fija en la escena; posiciones suavizadas.
- Pruebas: video sintético con un «logo» que se mueve: lo siguió de 0 a 6 s con pocos píxeles de error en ~0,35 s;
  en el editor (modo prueba) se pintó, se censuró y el difuminado lo siguió a los 0,3, 2, 4 y 5,5 s. Compilación correcta.
- Límites: no sigue cambios grandes de tamaño (acercamientos fuertes) ni objetos que salen y vuelven a entrar; en
  esos casos se ajusta la capa en la línea de tiempo o se pinta de nuevo.

### Eliminar anuncios y marcarlos como ganadores (2026-11-17, versión 2026-11-17e)

- `componentes/AccionesAnuncio.jsx` (trofeo `BotonFunciona` tipo video + Eliminar con confirmación) debajo de cada
  miniatura en `pantallas/editor-videos` y en la rejilla local de `pantallas/anuncios`.
- `lib/papelera.js` + `rutas/papelera.js` (`POST /api/anuncios/:slug/eliminar`): mueve `temp/<slug>` a
  `temp/_descartados/<slug>` y sus archivos de `output/` a `temp/_descartados/<slug>/output/`. Se niega si el anuncio
  está produciéndose o en la fila. Para recuperarlo: mover la carpeta de vuelta.
- Prueba (modo prueba, copia de un video propio): trofeo marcado, Eliminar con confirmación, la tarjeta desaparece y
  la carpeta y el MP4 quedan en `_descartados`. Compilación correcta.

### Editor sin avisos de «Deshacer» al borrar (2026-11-17, versión 2026-11-17d)

- Pedido del usuario: al borrar no debe salir el aviso con el botón Deshacer; se deshace con Cmd/Ctrl+Z o la flecha
  de la barra. En `app/src/pantallas/editor/index.jsx` se quitaron los avisos de borrar texto/escena, quitar la
  música, quitar un tramo del video, volver al clip original y volver al anuncio entregado. El historial (deshacer y
  rehacer) no cambió. Compilación correcta.

### Censura difuminada en el editor (2026-11-17, versión 2026-11-17a)

- «Tapar» de Editar con IA (`rutas/editar-ia.js`, acción `tapar`) ya no es una caja sólida por defecto. En
  `remotion/src/edicion/capas.mjs` las tapas (`caja: true`) llevan `difuminar` salvo `solido: true`, y
  `AnuncioEditado.jsx → Difuminado` dibuja un `backdrop-filter: blur()` un poco más grande que el texto seguido, con
  una máscara de degradados (bordes que se desvanecen, sin tinte gris). Desenfoque ≈ 0,38 × alto del texto.
  `editor/index.jsx` pone `solido: true` solo si la IA devolvió un color (el usuario pidió una caja de color). Las tapas
  guardadas de antes pasan solas a difuminado.
- **Prueba:** cuadro de Remotion (`remotion still`, el mismo Chrome que exporta) con textos grandes y chicos sobre
  fondos con contraste: ilegibles y sin recuadro visible; compilación de la app correcta.
- **Falta confirmar en la Mac:** una censura real en un video exportado.

### Ángulo, gancho y antes/después en los anuncios de imagen (2026-11-17, versión 2026-11-17c)

- Pedido: «debe detectar el ángulo, el hook; el VitalDrops es para glúteos; si hay antes y después debe verse el cambio
  notorio». En `produccion/imagen-ads.js`: `LEER_REFERENCIA` (el modelo lee ángulo, gancho y formato de la referencia y
  los conserva) y `ANTES_DESPUES` (cambio dramático en la misma zona del cuerpo, misma persona/pose/ropa/cámara/luz,
  rótulos ANTES/DESPUÉS, con ropa). Van en `RAPIDO_COPIAR`, `RAPIDO_INSPIRAR` y al copiar una referencia
  (`COPIAR_REFERENCIA`). En rápido, el titular de la app se usa si dice lo mismo que el gancho; si no, el modelo escribe
  el gancho de la referencia adaptado. `rapido.js`: el ángulo de la biblioteca solo vale si la referencia no tiene uno.
- Es un cambio de prompt sin medir con imágenes reales (generar cobra): conviene un lote de prueba con una referencia de
  antes y después de VitalDrops para confirmar. Pruebas: imagen 147/147, ChatGPT 4/4, `probar-imagen-ads.js` 173.

### Editar con IA en el editor (2026-11-17, versión 2026-11-17b)

- Campo «Edita con tus palabras» debajo de la vista previa (`app/src/pantallas/editor/EditarConIA.jsx`), que llama a
  `POST /api/anuncios/:slug/editar/ia { pedido, estado }` (`app/server/rutas/editar-ia.js`). La IA elegida
  (`lanzarSesion` de `motor-ia.js`) solo escribe `acciones` (`censurar` · `texto` · `tapar` · `quitar`); el servidor
  calcula los tiempos: palabras de `plan.subtitulos[].palabras` (más las corregidas) con `buscarDichas` (sin tildes,
  distancia ≤ 1 en palabras de 5+ letras, palabra partida en dos, margen 0,04 s); textos de pantalla con `pistasDe`
  (exportada de `seguimiento.js`); escenas con `escenasDe` (tomas y B-roll de `tomasDeEdicion`/`brollsDeEdicion`, o
  los bloques de un video propio).
- Cuadros de escenas solo si `pideQuitarEscenas(pedido)`: el ffmpeg de Remotion viene recortado (sin pad, hstack ni
  video crudo), así que cada cuadro sale como PNG por la tubería (270×480), y con más de 24 escenas se juntan en hojas
  de 2×2 armadas en memoria (`leerPng`/`escribirPng` con zlib). Hasta 160 escenas.
- La pantalla aplica todo en un paso del historial (`acciones.aplicarIA(r, pistas, ed)`, calculado sobre el estado de
  ahora para contar lo que entró): censuras a `ed.censuras`, textos y cajas con `cambiosParaSeguir` (caja = texto nuevo con
  `caja: true` y fondo; se dibuja sin letra), tomas y B-roll con `operar(... 'borrar')` del último al primero. En videos
  propios: `quitarTramoApi` por tramo (los que se tocan, juntos), un paso por tramo. Con `necesitaLeer` lee los textos
  de la pantalla y vuelve a pedirlo solo.
- Modelo (`capas.mjs`): `censuras: [{ id, desde, hasta, modo: 'pitido'|'silencio', palabra }]`, `limpiarCensuras`,
  `enCensura`, `ARCHIVO_PITIDO = 'app/edicion/pitido.mp3'`. Voz aparte: `AnuncioEditado` le baja el volumen a 0 en esos
  tramos y suma `<Pitidos>`. Voz dentro de los clips: `planAjustado` pone `plan.audio.silencios` y `Clip` (Anuncio.jsx)
  calla ahí. `pitido.mp3` (1 kHz, 4 s) en `recursos/efectos-transiciones/`: el servidor lo copia al anuncio para la vista
  previa y `exportar-edicion.js` lo enlaza al exportar. Falta la familia `escena` (podcast/entrevista).
- Pruebas: `buscarDichas` y `pideQuitarEscenas` a mano; hoja 2×2 con clips sintéticos; en Chromium con un anuncio de
  prueba (clips sintéticos, la respuesta de la IA simulada con datos reales de las palabras): censura y 2 textos
  guardados, Ctrl+Z los quita juntos; exportación real a MP4: en 10,85 s solo suena 1 kHz (la voz calla) y antes y
  después vuelve la voz; «VITALABH» sigue a su texto y la caja negra tapa el otro. Imagen 147/147, humo rápido 82/82.
  Sin IA conectada en la nube no se probó una respuesta real de Claude o ChatGPT.

### Anuncios de imagen rápidos, sin títulos, y referencias de tendencia (2026-11-16, versión 2026-11-16m)

Pedido: «el generador de imágenes se demora mucho, debe ser así como en una conversación en GPT. Elimina lo de
seleccionar títulos, es como si yo le pidiera a ChatGPT que me las varíe. Baja los creativos de aguaje, Amua, drenaje
y marcas de salud muy buenas, agrégalas como referencia y que me permita seleccionarlas.»

- Medido en 3 lotes reales de 5 imágenes: 15-20 min (títulos 2-3 min + elección, estrategia 4-6 min con la skill de
  106 KB, prompts + generación + revisión de la IA por imagen 5-9 min).
- `lib/imagen-ads/rapido.js → prepararRapido()`: sin la IA de texto, escribe producto.json, estrategia.json,
  plan.json y TODOS los V##.json (validan con `verificarSesion`). Titulares: ganchos validados → beneficios de la
  ficha → dolor/nombre; uno por variación. Referencias: las del usuario o, en Nuevos sin ninguna, las validadas
  (`entrada/validados/` → `entrada/referencias/R##`). `app_rapido`: 'copiar' (Variantes) o 'inspirar' (Nuevos).
  Sin referencias ni titulares: vuelve al camino de siempre (la estrategia de la IA).
- `produccion/imagen-ads.js → construirPrompt`: con `app_rapido`, RAPIDO_COPIAR / RAPIDO_INSPIRAR (titular exacto,
  los demás textos los escribe el modelo en español con los beneficios). Primera imagen = referencia, segunda = producto.
- `familias/imagen-ads.js`: estrategia rápida (pone `lote.json fiel`), y sin revisión de la IA (`run.sinRevision =
  'rapido'`, `dejarSinRevisar(..., { resultado: 'listo' })`). `estado.js`: con rápido, todas las variaciones listas en E001.
- `lotes.js`: `rapido: cuerpo.rapido !== false` (por defecto), `elegirTitulos: false` siempre, `fiel` con rápido.
- Formulario: sin propuesta ni selección de títulos; interruptor «Más elaborado (más lento)» (rapido: false); el aviso
  «Elige tu IA» solo con «Más elaborado». Encabezado de «Crear» actualizado.
- Referencias de tendencia: `mis_archivos/referencias-tendencia/<categoria>/<id>.jpg` + `indice.json` (67 imágenes,
  ~10 MB, a 1080 px, con marca, alcance, crecimiento a 7 días). `biblioteca-referencias.js → listarTendencias()` y
  `rutaTendencia()`; `GET /api/imagen-ads/tendencias` y `/api/imagen-ads/tendencias/:categoria/:archivo`.
  `BibliotecaReferencias.jsx`: pestañas Tendencias / Tuyas, filtro por categoría, marca y alcance en cada una.
- 2026-11-17a, **solo ganadoras**: criterio alcance ≥ 100.000 o activa ≥ 30 días (`indice.json → criterio`). 53
  referencias (amua 7, aguaje 2, drenaje 12, mullein 18, salud 14). Para aguaje casi no hay ganadoras en TrendTrack
  (búsqueda «aguaje» activa ≥ 30 días: 0 en el texto; con palabras de curvas salieron Peguero Market y Le Monet, sin
  dato de alcance porque son de Latinoamérica). `agregarTendencia(abs, { categoria, marca })` (id «u» + sha1, categoría
  existente o nueva por su nombre, `propia: true`) y `borrarTendencia(id)`; `POST /api/imagen-ads/tendencias?categoria=&marca=`
  (binario, normalizado con `normalizarImagen`, JPG o PNG) y `DELETE /api/imagen-ads/tendencias/:id`, ambas con
  `soloDesdeLaApp`. UI: pestaña «Ganadoras», fila Agregar a / Marca / Subir, pegar con Ctrl/Cmd+V (escucha `paste` en
  `document` con captura y `stopPropagation`, para que no llegue a la zona de referencias del formulario detrás),
  borrar con dos toques. Probado con curl (subir, repetida, sin categoría, no imagen, borrar, origen ajeno 403) y en
  Chromium (pegar → 54 y no entra al lote; borrar → 53). Pruebas: imagen 147/147, humo rápido 82/82.
- TrendTrack: Amua = la marca de VitalDrops (shopamua.com, 555 anuncios activos). Búsquedas de imágenes: dominio
  shopamua.com, «aguaje», «drenaje linfático», «suplemento natural» (es) y «mullein». Créditos de TrendTrack al final:
  3.134 (algunos se gastaron fuera de esta sesión).
- 3 estructuras más en `mis_archivos/estructuras/trendtrack-2026-11.json` (26 en total).
- Pruebas: anuncios de imagen 147/147; humo completo 220/220; lote rápido real en modo prueba (Variantes con una
  referencia): listo en ~30 s, sin sesiones de la IA de texto, piezas «listo», prompt con RAPIDO_COPIAR; capturas del
  formulario y de las tendencias sin errores JS.
- **Falta en la Mac:** un lote rápido real con ChatGPT o kie para ver la calidad de los textos que escribe el modelo.

### Estructuras y diseños aprendidos de TrendTrack (2026-11-16, versión 2026-11-16l)

TrendTrack conectado a la sesión de desarrollo (no solo a la app). Búsquedas: «skeleton» (casi todo relojes: el
estilo esqueleto casi nunca dice «skeleton» en el texto), «what happens to your body» + día 1/huesos/hígado,
la marca Liver Health Forum y «next 72 hours». 90 créditos de 3.932. Para ver miniaturas y videos se creó el
entorno personal «App-nube» (hosts `medias.trendtrack.io` y `s3.eu-central-003.backblazeb2.com`, con script de
instalación de app y remotion; el script queda sin probar hasta una sesión nueva en ese entorno).

- `mis_archivos/estructuras/trendtrack-2026-11.json`: 6 estructuras con evidencia (alcance y crecimiento a 7 días).
- `mis_archivos/tendencias/skeleton.json`: 5 diseños + recursos (titular fijo en franja roja, el esqueleto solo en
  el gancho, síntomas marcados sobre el órgano). Solo descripciones y enlaces; no se guardan videos de otras marcas.
- `lib/estructuras.js → textoTendencias(estilo)`, agregado a la tarea del guion. 23 estructuras en total.
- Pruebas: humo completo 220/220 (en este entorno, el navegador de Remotion es un enlace al Chromium local).
- Pendiente: el botón en la app para buscar y alimentar esto solo (con el TrendTrack del Claude del usuario) y subir
  videos o capturas; tendencias de los demás estilos.

### Guiones con la investigación de mercado y estructuras entre estilos (2026-11-16, versión 2026-11-16k)

Pedido: reforzar los prompts («en esqueleto siempre genera el mismo diseño»), alimentar estructuras desde lo que
funciona, y que «un estilo pueda tener diferentes estructuras o usar las de otro». Elección de estructura (del
usuario): la más adecuada para el caso: la de la referencia si es una variante; desde cero, la recomendada por la
investigación (deseo, beneficio, dolores, objeciones) y el tipo de producto; sin investigación, con lo que haya.

- Hallazgo: la tarea del guion de VIDEO no recibía la investigación de mercado (solo los anuncios de imagen).
- `lib/estructuras.js`: `catalogo()` (`recursos/estructuras/catalogo.json`, 17 estructuras sacadas de las skills,
  con `familias`, `ideal_para`, `consciencia`, `de_la_investigacion`, `momentos`, `gancho_ejemplo`; más las
  aprendidas en `mis_archivos/estructuras/*.json`, que pueden reemplazar por id), `anterioresDelProducto()`,
  `textoEstructuras()` y `textoInvestigacion()` (copia `aMarkdown` + competencia a `temp/<slug>/app/investigacion.md`,
  que la IA no puede editar).
- `anuncios-nuevos.js → promptGuion`: agrega la investigación y la estructura (no en cantados; con guion propio no
  se elige; con referencia, «de-la-referencia»). `materialGuion` incluye `app/investigacion.md`.
- `esquemas/guion.json`: `estructura { id, nombre, porque }` opcional. `estilos/skeleton.md`: no repetir variante,
  escenario ni vestuario de los anteriores del producto.
- Pruebas: humo completo 220/220; tarea armada con VitalDrops (investigación de 55.000 caracteres, 15 estructuras
  para voz en off) y con un anuncio con guion propio (sin estructura, como corresponde).
- **Pendiente (siguiente paso):** alimentar `mis_archivos/estructuras/` y las referencias de diseño por estilo desde
  TrendTrack (botón en la app con la sesión de Claude del usuario, y subir videos/capturas), y desde esta sesión
  cuando TrendTrack esté conectado aquí.

### Imágenes de los videos con ChatGPT (2026-11-16, versión 2026-11-16j)

Pedido: «en Videos, música e imágenes de los videos, la opción de usar GPT para crear imágenes en vez de kie». Decisión
del usuario: si se acaba el uso de ChatGPT, seguir con kie (se cobra) para no frenar el anuncio.

- `lib/motor-imagenes.js`: `motorImagenesVideo()` / `elegirMotorImagenesVideo()` (config `motorImagenesVideo`, por
  defecto `kie`; en modo prueba siempre kie) y `entornoImagenesVideo()`; `procesos.entornoDelMotor` lo agrega al
  motor (`AIA_IMAGENES_VIDEO=chatgpt` + `AIA_CHATGPT_IMAGENES`). Ruta: `PUT /api/imagenes/motor { motorVideo }`.
- `produccion/generar-imagenes.js`: `intentarConChatGPT()` antes de la cascada de kie (2 intentos, 3 a la vez);
  `limite`/`sinSesion` → `ctx.chatgptCaido` y el resto con kie; contenido/fallo → esa imagen con kie. Iconos y fondo
  transparente, siempre kie. La URL para las referencias en kie se sube después (subir no cobra).
- `estimar-costo.js → costoImagenes`: con `AIA_IMAGENES_VIDEO=chatgpt` las imágenes cuentan 0 (`deChatGPT`); la app
  lo pasa al estimar y entra en la firma de la caché. Medido: claymation de Aguaje US$4,36 → US$3,36.
- UI: `ImagenesDeVideos` (ChatGPTImagenes.jsx) en el bloque de kie de Conexiones; «Mi ChatGPT» se habilita con
  ChatGPT conectado.
- Pruebas: `produccion/pruebas/probar-imagenes-chatgpt.js` 4/4 (ChatGPT simulado + kie simulado: sale con ChatGPT
  sin pedir a kie; límite → kie y sigue; icono → kie; sin elegir → kie). 175/175, 398, 147/147, humo rápido 82/82.
- **Falta en la Mac:** un anuncio real con «Mi ChatGPT» (calidad y tiempo: cada imagen es un `codex exec`).

### «Actualizar» ve al instante todo lo publicado (2026-11-16, versión 2026-11-16i)

Pedido: «todos los cambios publicados me permita actualizar al instante en la app, no me sale para actualizar».
Causa: `actualizar-github.js` comparaba y bajaba la rama ACTUAL de la carpeta (`origin/<rama>`); con la carpeta en
una rama que no es `main` (o que no existe en GitHub, y entonces el fetch fallaba) lo publicado no aparecía. Además
solo revisaba cada 10 minutos y el aviso era un punto en el botón.

- `lib/actualizar-github.js`: `PUBLICADA = 'main'` (o `KADS_RAMA_PUBLICADA`); `fetch` con refspec explícito,
  cuenta `HEAD...origin/main` y `pull origin main` en la rama que esté. `revisarConMemoria()` (1 min);
  `GET /api/github/actualizar?ahora=1` pregunta sí o sí.
- `marco/BotonActualizar.jsx`: cada 2 min; al abrir pregunta ahora; `actualizarDesdeGithub()` compartida.
  `marco/BandaActualizacion.jsx` (nueva, en `App.jsx`): franja «Hay N cambios nuevos publicados» con «Actualizar
  ahora» / «Después» (guarda la fecha del último cambio en `localStorage kads:actualizacion-despues`).
- Probado: una copia en una rama vieja (`a9396e0`) veía 11 cambios de `main`; «Actualizar» los bajó (quedó en
  `2026-11-16h`, `atrasados: 0`) y pidió el reinicio. Franja en claro y oscuro sin errores JS.
- **Una sola vez en la Mac** (si su copia no tiene todavía este cambio): `git pull --no-rebase --no-edit origin main`
  en `~/Anuncios con IA` y volver a abrir la app. Después, todo llega por la franja.

### Ajustes rediseñado (2026-11-16, versión 2026-11-16h)

Pedido: «rediseña el apartado de ajustes, un diseño mejorado, más compacto, limpio y profesional». Se conserva la marca
(colores, fuentes, logo, textos); cambia la disposición.

- `pantallas/ajustes/index.jsx`: una sección a la vez (estado `activa`, `#/ajustes?seccion=<id>`; sin el seguimiento
  por desplazamiento). «Cambiar modelos» de Conexiones cambia a la pestaña Modelos. En angosto, la pestaña activa se
  desplaza a la vista.
- `ajustes.css`: bloque «Rediseño compacto» al final (cabecera h3, menos rellenos, `conexion-claude__arte` oculto en
  Ajustes, filas de Modelos y Tu PC más bajas). La página pasó de ~5.400 px a entre 900 y 1.900 px por sección.
- Pruebas: capturas de las 7 secciones en claro y oscuro y en iPhone 13 (sin desborde horizontal), sin errores JS;
  humo rápido 82/82.

### Anuncios de imagen: Nuevos con lo validado, Variantes estricto y modo claro de avisos (2026-11-16, versión 2026-11-16g)

Pedido: «Variantes es en base a una imagen ya validada que esté funcionando; Nuevos, con lo que tenga de la
investigación y la imagen del producto con la biblioteca de anuncios ya validados» (biblioteca = «Me funciona» +
biblioteca de referencias). Sin investigación: generar igual con aviso (decisión recomendada y aceptada). Quitar
«Variar solo los títulos» de Nuevos. Además: «corrige el modo claro y oscuro de las notificaciones».

- `lotes.js → prepararValidados()`: en `modo: 'nuevos'` copia a `entrada/validados/A##` hasta 6 de «Me funciona»
  (los del mismo producto primero) y completa hasta 8 con la biblioteca de referencias, sin repetidos (sha1); queda
  en `brief.validados`. `fiel` solo en variantes. `faltaDelBorrador`: variantes sin referencias no arranca.
- `sesiones.js`: `textoModo` y `textoValidados` en la estrategia, con las imágenes adjuntas (`validadosDelLote`):
  estudiarlos para elegir formatos/estructuras/ganchos y crear diseños NUEVOS (no copiar marcas ni textos).
  `titulos.js`: prompt propio de Nuevos y de Variantes; los validados entran en la firma.
- `rutas/imagen-ads.js`: las referencias de un lote de Variantes ya no se guardan en la biblioteca de referencias.
- `Formulario.jsx`: sin el interruptor «Variar solo los títulos»; textos de Nuevos; aviso de «sin investigación».
- Modo claro: tokens `--vidrio-aviso`, `--vidrio-panel` y `--fondo-tooltip` en Avisos, Tooltip, el panel de una pieza
  y el índice de Ajustes en el celular. Capturas en claro y oscuro.
- Pruebas: servidor de anuncios de imagen 147/147; humo completo 220/220; prueba puntual de `prepararValidados` y de
  la estrategia (no se guardó en el repo: escribe en `temp/_funcionan`).
- **Falta en la Mac:** un lote real de Nuevos con «Me funciona» marcados, para ver la calidad.

### Correcciones de la revisión técnica (2026-11-16, versión 2026-11-16f, [PR #68](https://github.com/kalethabh/App-nube/pull/68))

Pedido: aplicar el informe «Kads Studio · Evaluación colaborativa y hoja de ruta» y corregir los problemas que
encontró un análisis completo del código. Se respetó el principio del informe: **no se tocaron prompts, skills,
aprendizajes ni la forma de crear los anuncios**; solo correcciones deterministas y de bajo riesgo creativo.

- **Origen único (bug del modo servidor):** 6 rutas tenían su propia lista de orígenes sin el dominio del servidor,
  así que con Caddy producir/editar/exportar/rehacer/canción/modelos/actualizar daban 403. Ahora todas usan
  `origenesPermitidos()` (`lib/servidor.js`) y hay un filtro global en `server/index.js` para todo pedido que no sea
  GET/HEAD/OPTIONS (también cubre rutas que no tenían chequeo). Sin `Origin` (pedidos de este equipo) se sigue aceptando.
- **C-02, creación incierta en kie** (`produccion/kie-client.js`): si el pedido de crear la tarea pudo llegar y la
  respuesta se perdió (conexión cortada después de mandar, o HTTP 504), sale `err.creacionIncierta` y las cascadas
  de `generar-imagenes.js` y `generar-videos.js` cortan esa pieza sin reintentar ni pasar al respaldo. Sin conexión
  (ENOTFOUND, ECONNREFUSED…) sigue siendo un error común. Los anuncios de imagen ya se detenían solos en ese caso.
- **Suno:** `npm run musica` y `npm run cancion` pasan por `suno-retomable.js` (antes solo la app); `esperarMusica`
  tolera hasta 3 min de errores pasajeros en vez de cortar (y que al volver a correr se pague otra).
- **C-04 (parcial), precio de Suno en un solo lugar:** `CREDITOS_SUNO` vive en `produccion/config.js`; lo leen
  `generar-musica.js`, `lib/gasto.js`, `lib/costo-anuncio.js` y las 5 familias (antes 7 copias del 12).
- **Guardado** (`lib/guardado.js`): `git status -z` sin recortar (las rutas con tildes/espacios ahora respetan el tope
  de 45 MB; además el recorte de la salida le comía la primera letra a la primera ruta); un archivo ya seguido que
  pasa de 45 MB se saca del commit (`git reset`), porque `.git/info/exclude` no lo frenaba; si el `pull` tiene
  conflicto, `estado().github.conflicto = true` con un mensaje claro.
- **Drive sin trabar la app:** `archivador.restaurarAsync()` (`lib/archivo-nube.js`) con huella y copia por partes;
  `traerDeVuelta()` devuelve una promesa y comparte la copia en curso del mismo anuncio. `restaurar()` síncrono queda
  igual para las pruebas.
- **Claves:** `.env` se escribe con permisos 0600; `.env.*.tmp` en `.gitignore`.
- **Pantalla:** `useDatos` (`src/datos/api.js`) no sondea con la pestaña oculta, pide al volver y reutiliza una
  respuesta de hace menos de medio intervalo (menú, barra y tablero repetían `/api/anuncios`).
- **Guía:** `COMO-PRODUCIR.md` ya no nombra `npm run arrancar`, `npm run revisar:imagenes` ni
  `movimiento-subestilos.py` (no existen) y aclara que la revisión de imágenes no la exige el motor;
  `CONCURRENCIA_IMAGENES`/`CONCURRENCIA_VIDEOS` del `.env` ahora se leen (1–20; por defecto 12 y 10).
- **Pruebas nuevas:** `produccion/pruebas/probar-creacion-incierta.js` (4/4: respuesta cortada, 504, sin conexión y
  caso normal, con un servidor local) y 4 casos de `restaurarAsync` en `app/herramientas/probar-archivo-nube.mjs`
  (30/30). Origen probado a mano con `ANUNCIOS_DOMINIO`: el dominio pasa, otra página y `cross-site` dan 403.
- **Humo completo (modo prueba, Claude falso, kie y ElevenLabs simulados), con render: 220/220** y el MP4.
  Las 2 fallas de costo que salían (estimado 212 contra «cobrado» 356; botones 130 contra 199, también en `main`)
  **no eran de la app**: el kie simulado (`produccion/pruebas/kie-simulado.js`) cobraba Omni 1.2 con los tramos del
  1.1 (63/84/105/126 por video) en vez de por segundo (4/9/10/22 cr/s según resolución). Corregido el simulado.
  `probar-estimar-costo.js` y `probar-modelos.js` fallaban porque sus números son de 720p y la app pasó a 1080p
  por defecto: ahora importan primero `pruebas/a-720p.js` (175/175 y 398/398). La estimación de la app estaba bien.
  Para el render en el entorno de prueba se usó el Chromium local en `remotion/node_modules/.remotion`.
  **Falta en la Mac:** un anuncio real, y la app en el servidor (si se usa) entrando por el dominio.
- **No hecho a propósito (decisiones del informe, sección 09):** tope de presupuesto por anuncio (C-03), firma de
  las actualizaciones (C-14), sacar `temp/` del repositorio y que el guardado no traiga código con `pull` (C-13), y los
  experimentos de contexto/skills/aprendizajes (C-05 a C-07), que el informe pide medir antes con anuncios aprobados.
- **Pruebas viejas que ya fallaban antes de este cambio** (iguales en `main`): `probar-estimar-costo.js` (13 casos)
  y `probar-modelos.js` (3) esperan precios anteriores; hay que decidir qué precio es el correcto (C-04).

### Anuncios de imagen: Nuevos / Variantes, ganchos validados y «Me funciona» (2026-11-16, versión 2026-11-16e)

- **Formulario** (`pantallas/imagenes/Formulario.jsx`): sin precio, moneda, CTA, idioma, ángulo ni logo (el servidor
  pone `idioma: 'es'` si no viene; los lotes viejos con logo siguen funcionando). Arriba, pestañas **Nuevos** /
  **Variantes** (`brief.modo`).
- **Ganchos validados:** `competencia.js → ganchosValidados(id)` saca los `hooks` (campo `mejorado`) de
  `competencia.json`, primero saturación baja/media. `crearLote` los deja en `entrada/ganchos.json` (`brief.ganchos`);
  `titulos.js` los pone en el prompt (jugar con ellos, citar G# y evidencia en `base`) y entran en la firma. En modo
  prueba los títulos simulados salen de esos ganchos.
- **«Me funciona»:** `lib/funcionan.js` + `rutas/funcionan.js` (`GET/POST /api/funcionan`, `DELETE /api/funcionan/:id`,
  `/archivos/funcionan/:nombre`). Guarda en `temp/_funcionan/lista.json` y copia la imagen a `temp/_funcionan/img/`
  (de un video: un cuadro a 1,2 s del MP4 con ffmpeg; sin MP4, la imagen de la primera toma). Botón
  `componentes/BotonFunciona.jsx` (trofeo) en cada imagen del lote (`imagenes-lote/Variacion.jsx`, el lote llega por
  el contexto `LoteFunciona`) y en la entrega de video (`entrega/index.jsx`).
- **Variantes:** `pantallas/imagenes/ElegirFunciona.jsx` (filtros Todos/Imágenes/Videos y Este producto/Todos) sube
  lo elegido como referencias (R01…), con `fiel: true` y `referenciasPropias` (las del mismo producto).
  `sesiones.js → textoFiel/textoPaleta`: mismas tipografía y `reference_position`; las propias copian también la
  paleta; las de otro producto adaptan la paleta al producto del usuario.
- **Pruebas (modo prueba, sin pagar):** producto de prueba con la competencia de VitalDrops: los títulos salieron de
  los ganchos reales con su evidencia; lote de 3 generado; trofeo marcado en V01; un video de prueba marcado (cuadro
  del MP4); en Variantes se filtró y eligió imagen + video, se generó el lote de 2 y su brief quedó con
  `modo: variantes`, `referenciasPropias: [1]` y el prompt con las reglas de paleta. Capturas en claro y oscuro.
  `claude-falso-imagen-ads.js` ahora usa los títulos elegidos (antes el lote simulado con títulos se detenía).
- **Falta confirmar en la Mac:** un lote real con Claude y kie.ai para ver que las variantes respetan la tipografía
  y los colores.

### Investigación con TrendTrack en modo claro (2026-11-16, versión 2026-11-16d)

- `app/src/pantallas/investigacion/competencia.css` (bloque `.tt`, la segunda parte del informe) tenía sus colores
  oscuros fijos. Ahora usa variables propias (`--tinte`, `--fondo`, `--barra-etapas`, `--th-fondo`, `--th-tinta`)
  y `[data-tema='claro'] .tt` redefine tintas, tarjetas y los cuatro colores de significado en tonos oscuros.
  El PDF de la primera parte (`documento.css`) conserva su diseño propio de documento.
- Prueba: capturas de Playwright del informe de un producto con las 6 etapas, en claro y oscuro (cabecera, etapas,
  tablas, escalas, barras, cajas de riesgo/oportunidad); compilación correcta y sin errores en la página.

### La pantalla nueva se arma sola (2026-11-16, versión 2026-11-16c)

- **El problema (visto en la Mac):** el guardado automático (`lib/guardado.js`, cada 2 min) hace `git pull` cuando
  GitHub tiene algo nuevo; eso trae `app/src` y `VERSION` pero no vuelve a armar `app/dist`. Ajustes mostraba
  2026-11-16b y la pantalla seguía siendo la vieja (sin el botón sol/luna), y «Actualizar» decía que no había nada.
- **Arreglo:** `app/server/lib/interfaz.js` compara la fecha de `app/src`, `index.html`, `public/` y `vite.config.js`
  con `dist/index.html`; cada 30 s (`vigilarInterfaz`, solo sin `--dev`) vuelve a armar si hace falta (uno a la vez,
  no reintenta si falló con los mismos archivos). `/api/estado` → `servidor.interfaz { armada, armando, error }`;
  `marco/BandaVersionNueva.jsx` muestra «Preparando la versión nueva…» y después «Hay una versión nueva de la app»
  con **Recargar**. `actualizar-github.js`: `revisar()` da `pantallaSinArmar` y «Actualizar ahora» la arma aunque
  no haya commits nuevos.
- **Prueba (modo prueba):** con la app abierta se tocó un archivo de `app/src`: a los 30 s se armó sola y apareció
  la franja con Recargar (captura de Playwright).
- **Al llegar esta versión a una app vieja:** el servidor viejo no tiene el vigilante; el aviso existente «Hay una
  versión nueva… Reiniciar la app» aparece porque cambió el servidor, y al reiniciar el vigilante arma la pantalla.

### Modo claro y modo oscuro (2026-11-16, versión 2026-11-16b)

- **Qué hace:** botón sol/luna en la barra de arriba (`app/src/marco/BotonTema.jsx`) y Ajustes → **Apariencia**
  (`app/src/pantallas/ajustes/Apariencia.jsx`) con Claro, Oscuro y Automático (sigue al sistema). Se guarda en el
  navegador (`localStorage` `kads:tema`); `app/index.html` lo aplica antes de pintar para que no parpadee.
- **Cómo está hecho:** `app/src/datos/tema.js` pone `<html data-tema="claro|oscuro">`. En `estilos/tokens.css`
  el oscuro es el de siempre (`:root, [data-tema='oscuro']`) y `[data-tema='claro']` redefine los colores.
  Tokens nuevos: `--tinte-rgb` (blanco u negro para velos sutiles: `rgba(var(--tinte-rgb), a)`), `--acento-fondo`
  (el lima para fondos con texto negro; `--acento` es el verde de textos/íconos, más oscuro en claro),
  `--menu-fondo-fin`, `--scroll-hover`, `--campo-foco`, `--texto-marca`, `--semaforo-sobra`, `--semaforo-justo`.
  **Regla para pantallas nuevas:** nada de blancos/negros fijos; usar los tokens. Sobre fotos o video se usa
  `--vidrio-oscuro` con texto claro y `--acento-fondo`, igual en los dos temas.
- **El editor de video** queda siempre oscuro (`forzarOscuro` en `pantallas/editor/index.jsx`) y vuelve al tema
  elegido al salir. `pantallas/competencia`, `documento.css` y el editor conservan sus colores propios.
- **Pruebas (simuladas, sin pagar):** compilación Vite; capturas de Playwright en claro de las 15 pantallas
  principales más ficha, producción y entrega de anuncios, y en oscuro para confirmar que no cambió; el editor
  se comprobó oscuro con la app en claro. Humo completo en modo prueba: **215/220**; 3 fallas son los paquetes
  Python del entorno y 2 son de costos de los simuladores (cobrado vs estimado), ajenas a este cambio (solo toca la
  interfaz) y por revisar aparte.
- **Falta confirmar en la Mac:** verlo con anuncios reales y en «Automático» cambiando el modo del sistema.

### «Kads Studio.app»: abrir la app sin Terminal (2026-11-14)

- `instalar/crear-app-mac.sh` arma con `osacompile` un applet que queda abierto (`-s`) con el ícono de Kads, en
  `~/Applications` y en el Escritorio. Al abrirlo, si la app no responde en 4455, corre el `.command` en segundo plano
  (`AIA_NO_ABRIR=1 nohup …`, registro en `~/Library/Logs/Kads Studio.log`), espera hasta 4 min y abre el navegador.
  Salir del ícono del Dock (Cmd+Q) cierra el servidor. Si no arranca, ofrece abrir la ventana del `.command`.
- El `.command` la crea solo la primera vez, y otra vez si la carpeta cambió de lugar (`Contents/Resources/raiz.txt`).

### Mejores anuncios: ganadores de TrendTrack (2026-11-14)

- Sección nueva `#/ganadores` (menú Crear → «Mejores anuncios»): anuncios de Meta que están funcionando, buscados en
  TrendTrack con filtros (países, palabra, nicho, formato, días activo, orden, cantidad, uno por marca). Desde cada
  uno: «Adaptar a mi producto» (baja el video a `temp/_referencias/` y abre Nuevo anuncio con `?referencia=subido:…`,
  que queda como video para clonar), «Guardar» (`mis_archivos/ganadores/guardados.json`) y copiar el texto.
- TrendTrack va por el **conector de claude.ai** del usuario, sin claves: `lib/ganadores.js` abre una sesión headless
  con `lanzarSesion({ conectores: true, permitidas: [ToolSearch, search_ads, check_credits] })` (sin
  `--strict-mcp-config`; con dontAsk todo lo demás se rechaza) y lee la respuesta cruda con el nuevo
  `o.alResultadoHerramienta` de `lib/claude.js` (Claude no copia nada). Unos 9 s por búsqueda.
- Créditos: 1,5 por anuncio devuelto. Cada búsqueda queda en caché 12 h (`temp/_ganadores/busquedas/`): repetirla o
  abrirla desde «Búsquedas recientes» no gasta. Tope 20 por búsqueda. En modo prueba los resultados son simulados.
- TrendTrack a veces ignora `max_ads_per_brand` (con «Más duplicados» devolvió 6 del mismo anunciante): la pantalla
  agrupa por página y muestra «+N variantes».

### Los personajes de cada anuncio se guardan solos como avatar (2026-11-13)

- Al terminar un anuncio (fuera del modo prueba), `guardarPersonajesDelAnuncio` (lib/biblioteca.js, llamado desde
  conductor.js junto a la música) crea un avatar con sus hojas de personajes. Los asigna a los roles de `ROLES_AVATAR`:
  primero por id y si no por orden, y el resto como extras hasta el límite del estilo. Queda `origen: <slug>` en avatar.json
  para no repetirlo. No guarda nada si el anuncio ya usaba un avatar de la biblioteca o si faltan los roles obligatorios.
- `personajesDelAnuncio` solo toma referencias de tipo personaje (no lugares u objetos). Si el anuncio ya se archivó en
  la nube (`app/en-la-nube.json`), copia la imagen de vuelta a temp/ desde esa carpeta. Antes el botón «Guardar sus
  personajes como avatar» decía «Ese anuncio no tiene hojas de personajes» en los anuncios archivados.

### Actualización funcional del paquete 2026-11-10

Se integró el paquete `anuncios-con-ia-app.zip` de la publicación «Actualización-App»
(SHA-256 `a14d3b8ddc1354b1e9a75eb8e5d4e899bd3da2d24a196c4bcd1209e29c8dea81`) sin sustituir la apariencia de Kads.
La identidad visual, los estilos existentes y las funciones propias se conservan. Las pantallas nuevas usan los mismos componentes y tokens.

- Elección Claude/ChatGPT, instalación y conexión: `lib/motor-ia.js`, `lib/codex*.js`, `rutas/ia.js`.
- Anuncios de imagen: `lib/imagen-ads/`, familia y rutas `imagen-ads`, pantallas `imagenes/` e `imagenes-lote/`.
  Generar y regenerar requieren confirmar el presupuesto mostrado (`costoMaximoConfirmado`).
- Modelos por categoría y estimación: `produccion/catalogo-modelos.json`, `modelos-elegidos.js`, `estimar-costo.js`,
  `lib/costo-estimado.js`. La ruta de costo conserva también gastos/saldo/semáforo de Kads.
- Revisiones informativas, regeneración explícita y videos propios en el editor: `lib/avisos.js`, `lib/subidos.js`,
  `rutas/reemplazo.js`. No se regeneran piezas automáticamente por calidad.
- Se mantiene 1080p por defecto. Los modelos que solo aceptan 720p usan esa resolución con su costo correspondiente;
  el render final sigue en 1080p. Los costos no cuentan dos veces imágenes iguales ni cobran clips reutilizados.

### Carpeta de guardado configurable (2026-11-11b)

**Ajustes → Guardado** permite guardar los medios en este computador, usar la detección de Drive o elegir una
carpeta sincronizada (Google Drive para escritorio, Dropbox, OneDrive). No es una conexión directa a la API de Drive:
el cliente de escritorio sincroniza las copias y la app sigue produciendo/editando con archivos temporales locales.
La selección vive solo en este equipo (`app/.guardado-config.json`, ignorado y protegido de actualizaciones).
`lib/almacenamiento.js` valida la carpeta y abre el selector nativo; `lib/archivo-nube.js` copia y recupera con
verificación de contenido y ubicaciones por archivo. Una carpeta nueva conserva copia local por defecto; liberar
espacio es opcional para videos con restauración integrada. Los lotes de imágenes, Cambiar producto y Sketch se
copian sin borrar sus originales. Cambiar de carpeta mantiene recuperables las ubicaciones archivadas anteriores.
Los modelos se eligen en **Ajustes → Modelos** o junto al costo antes de aprobar un anuncio.

### Avance de los videos en el reloj de «Falta» (2026-11-13, PR pendiente)

- En la producción, mientras se generan los videos, el reloj de «Falta» lleva un aro que se llena y la línea
  «Videos: X de N listos · Y % · Z generándose» (`app/src/pantallas/produccion/Mando.jsx`, `RelojAvance`). El avance
  es por clips terminados: kie.ai no da el porcentaje de cada clip.

### Con guion propio no se escribe otro guion (2026-11-13, PR pendiente)

- Si el usuario pega su guion, la tarea del guion dice que no se escribe otro, ni variantes, ni se hace análisis de
  ángulo o investigación: solo se parte en tomas (`app/server/lib/anuncios-nuevos.js`, `tieneGuionPropio`).
- Si además sube un video para clonar, ese video es solo guía visual: no se sigue la skill de clonación (sin
  `adn.md` ni `guion-clonado.md`, sin comparar la transcripción) (`app/server/lib/clonar.js`, `textoClonar`).
- El avance dice «está repartiendo tu guion en escenas». Probado: sintaxis (`node --check`) y el texto armado; sin un
  anuncio real todavía.

### Editor: imágenes propias y mover con el mouse (2026-11-13, PR pendiente)

- «Agregar imagen en el cursor» (pestaña Textos) o soltar un PNG/JPG/WEBP/GIF en la ventana: se sube a
  `temp/<slug>/app/edicion/imagenes/` (`POST /api/anuncios/:slug/edicion/imagen`) y va en `textosNuevos` con
  `archivo`, `ancho`, `x`, `y` (centro). Se mueve, recorta y borra en la pista de textos como un texto.
- En la vista previa, textos e imágenes se arrastran con el mouse (`app/src/pantallas/editor/arrastrar.js`; la
  composición marca cada uno con `data-capa`). El elegido lleva un marco; un toque no pausa ni reproduce.
- Se dibuja en `AnuncioEditado.jsx` (`ImagenEnPantalla`) y la exportación enlaza las imágenes a la carpeta pública
  (`produccion/exportar-edicion.js`). Probado en una copia con el anuncio de Aguaje: subir, arrastrar (imagen y
  texto), Deshacer y exportar a 720 (las imágenes salen en su lugar).
- Los subtítulos también se arrastran (`data-capa="sub:<bloque>"` en `subtitulos/estilos.jsx`, con su contenido como
  rectángulo). La casilla «Mover solo el subtítulo que arrastro» (se recuerda en el navegador) elige: apagada mueve
  todos (`subtitulos.altura` y el nuevo `subtitulos.lado`); prendida, solo ese (`lugaresSubtitulos[bloque]`, que manda
  sobre los de todos). Hay «Hacia los lados» y botones para volverlos a su lugar. Con «Una palabra gigante» el arrastre
  arranca desde el 30 %, su piso. Probado: arrastrar todos, uno solo y exportar (cada uno sale en su lugar).

### Omni Flash 1.2 por defecto (2026-11-13, PR pendiente)

- El modelo de video por defecto pasó de `google/gemini-omni-flash-1-1` a `google/gemini-omni-flash-1-2` (motor,
  catálogo de Ajustes › Modelos, UGC, podcast/entrevista, respaldos de Grok/PixVerse y el sketch). El 1.1 queda en
  `MODELOS_VIDEO` para los registros viejos.
- Lo que se aprovecha: cobra por segundo (720p 9 cr/s, 1080p 10; un clip de 10 s a 1080p = 100 cr, antes 126) y se
  pide el largo exacto redondeado al entero (antes los tramos 4/6/8/10); clips de 3 a 15 s (`duracionMaxConFinal: 10`
  con imagen inicial y final: tomas B y pasos de continuidad, que pasan de 4 a 3 s de mínimo); tomas habladas (H) y
  bloques UGC hasta 15 s (`DURACIONES_H` = 3..15); hasta 6 referencias (antes 7).
- `duracionPara`/`creditosClip` reciben `conFinal`; generar-videos, la estimación y continuidad lo pasan.
- No se tocó: el musical (sus tomas siguen hasta 10 s), la edición de video (`video_list`) ni el «Extend» de la 1.2
  (pendientes para «Rehacer»). Las skills dicen que hasta 10 s es lo probado y 15 s es posible.
- Pruebas: `RESOLUCION_VIDEO=720p node produccion/pruebas/probar-modelos.js` (220), `probar-estimar-costo.js`
  (175), `probar-integracion-kads.js` (7, también a 1080p) y `probar-imagen-ads.js` (173). Sin un anuncio real todavía.

### Editor: «Guardar» deja tu versión como la del anuncio (2026-11-13, PR pendiente)

- Botón «Guardar» junto a «Descargar video»: arma el video con los cambios (la misma exportación, completa a 1080p,
  `guardar: true`) y al terminar escribe `temp/<slug>/app/version-principal.json` ({ archivo, n, guardado }). No
  descarga nada. Si el último video armado ya tiene lo que se ve, solo lo marca (al instante).
- `lib/anuncios.js` (versionesDe): mientras ese archivo exista en output/, esa versión es la principal («Tu versión
  guardada»): la que muestran Anuncios, la entrega, el tablero y la producción. La entregada sigue como «Completa».
- `POST /api/anuncios/:slug/version-principal { archivo | null }` (null = vuelve la original; botón ↺ del editor).
- El indicador de autoguardado del editor dice «Cambios guardados». Probado en una copia: guardar (2 min a 1080p),
  volver al original, guardar de nuevo al instante y la entrega reproduciendo la guardada.

## Validación más reciente y sus límites

Todo se probó sin servicios de pago y sin modificar los anuncios personales.

- PR #33: compilación Vite; 580 casos de Codex; 147 del servidor y 173 del motor de imágenes; 232 de modelos,
  174 de costos y 7 de integración Kads. Precios contrastados a 720p/1080p. Navegador: pantallas, editor y cambio
  de modelo/letra actualizan costo y semáforo, con un solo panel y sin errores JavaScript.
- Humo completo con IA falsa del PR #33: Claude **216/220**, Codex **151/155**, con MP4 en 1080×1920, lotes,
  regeneraciones, exportación, clips propios/restauración y límites/cambio de IA. Tres fallos de cada corrida fueron
  paquetes Python faltantes (`rembg`, `onnxruntime`); el cuarto fue la consulta de actualización de npm bloqueada.
  Se desactivó esa consulta solo en modo prueba y se comprobó el CLI local con cero salidas bloqueadas. No se
  repitió el humo completo después de ese ajuste.
- PR #34: `node --test app/herramientas/probar-almacenamiento.mjs app/herramientas/probar-archivo-nube.mjs`
  → **41/41**; compilación y **16 comprobaciones de navegador** correctas. Se probó guardar la configuración
  realmente en una carpeta y un puerto aislados, sin copiar archivos del usuario.
- Último humo rápido: **79/82**; solo quedan las tres comprobaciones conocidas de los paquetes Python del entorno.
  La guardia de red pasa. Los diálogos nativos Mac/Windows tienen pruebas simuladas; no se ejecutaron en esos sistemas.
- Las pruebas con simuladores no confirman por sí solas el inicio de sesión real, una generación de pago o que el
  cliente de Drive haya terminado de subir una copia. Lo pendiente en la Mac está en la sección siguiente.

## Pedidos funcionales pendientes

Los selectores de modelos y sus cascadas ya existen; estos dos pedidos adicionales siguen pendientes:

1. **Ofrecer modelos parecidos cuando uno falle repetidamente**, mostrando la diferencia de precio y permitiendo
   cambiar y continuar con un clic. Los precios y capacidades viven en `produccion/config.js` y el catálogo de modelos.
2. **«Estado de la IA» en tiempo real:** kie.ai y sus modelos, ElevenLabs y Claude/ChatGPT, con fallas y desde cuándo.
   La idea es revisar cada minuto mientras la app esté abierta y aprovechar los registros de las propias generaciones.

## Pendiente de confirmar en mi Mac

- Que el borrador de subtítulos en «Mejor calidad» no tarde horas (si tarda, usar «Rápido»).
- El primer sketch completo (montaje y revisión) y la sugerencia de IA al editar imágenes, con Claude de verdad.
- En kie.ai, la lista blanca de IP de mi clave tiene que estar desactivada (o con mi IP), si no, falla todo.

## Cómo retomar desde otra conversación o equipo

Compartir el repositorio privado con el asistente o conectar GitHub y pegar:

> Continúa el proyecto Kads Studio de https://github.com/kalethabh/App-nube. Lee primero AGENTS.md,
> CONTEXTO-PROYECTO.md y CLAUDE.md en la rama main. Conserva el diseño actual y actualiza/sube el contexto
> al terminar. Mi siguiente tarea es: [escribir aquí lo que quiero hacer].

Para actualizar y abrir desde Terminal en la Mac (sin anuncios en producción):

```bash
cd "$HOME/Anuncios con IA" && git pull --ff-only origin main && bash "./Abrir Anuncios con IA.command"
```

Dejar la Terminal abierta mientras se usa la app. Si Git indica un conflicto o historias divergentes, revisar el
mensaje y preservar los cambios; no usar `reset --hard` ni forzar push para poder abrirla.
