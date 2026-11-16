# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-16.

**Para la conversación nueva:** lee `AGENTS.md`, este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Regla permanente de continuidad

El usuario pidió el 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**
Al terminar cada cambio de desarrollo o decisión relevante, actualizar este archivo y subirlo a GitHub con los
cambios, siguiendo el flujo de PRs. Registrar lo terminado, los enlaces disponibles, las pruebas y sus límites,
los pendientes y el siguiente paso. Comprobar que el contexto actualizado esté en `main` antes de decir que está
publicado. La regla también está en `AGENTS.md` y `CLAUDE.md` para otros asistentes y conversaciones.

## Estado para retomar

- **Versión actual:** `2026-11-16k` (archivo `VERSION`): guiones con la investigación y catálogo de estructuras.
  Antes en `main`: `2026-11-16j` (PR #68 a #73).
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
