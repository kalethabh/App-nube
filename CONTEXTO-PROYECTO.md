# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-18 (La voz del narrador la elige la app si no la eliges, versión 2026-11-18c).

**Para la conversación nueva:** lee `AGENTS.md`, este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Regla permanente de continuidad

El usuario pidió el 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**
Al terminar cada cambio de desarrollo o decisión relevante, actualizar este archivo y subirlo a GitHub con los
cambios, siguiendo el flujo de PRs. Registrar lo terminado, los enlaces disponibles, las pruebas y sus límites,
los pendientes y el siguiente paso. Comprobar que el contexto actualizado esté en `main` antes de decir que está
publicado. La regla también está en `AGENTS.md` y `CLAUDE.md` para otros asistentes y conversaciones.

## Estado para retomar

- **Versión actual:** `2026-11-19g` (archivo `VERSION`): CAMBIAR DE CUENTA DE CLAUDE: `POST /api/ia/cambiar-cuenta` (409 si Claude escribe algo; `igual` lo corta) → `abrirLogin({ cambiar: true })` (lib/claude.js: `claude auth logout` y después `auth login` en la ventana); después de abrir un login, `estadoClaude()` se vuelve a mirar cada 4 s por 10 min; `alCambiarCuentaClaude(fn)` avisa cuando el correo cambia y el conductor saca la pausa de Claude y sigue con los anuncios que esperaban el límite. Pantalla: Conexiones «Cambiar de cuenta» (datos.js `cambiarCuenta`, `ia.cambiandoDe`). La app de escritorio de Claude NO cambia la cuenta de Claude Code. probar-cambiar-cuenta 9/9. Antes: `2026-11-19f`: CLONAR A LA VISTA: en Estilos la tarjeta «Clonar un video» va después de Agregar (familia «referencia») y lleva a `#/nuevo?clonar=1`; con `clonar=1` el paso 1 pide primero «El video que quieres clonar» (borrador.referencia, obligatorio) y los títulos cambian; `alternarEstilo` pone la referencia en la pregunta `clonar` de cada estilo elegido (antes solo en los ya elegidos al llegar al paso 2). El motor de la clonación no cambió (lib/clonar.js). Antes: `2026-11-19e`: SALUD MENOS PEGAJOSA (lib/salud.js): los modelos de kie solo se ponen en «degradado» con reintentos en las últimas 2 h (RECIENTE) y si la última pieza también los tuvo; `propia()` (exportada para la prueba) necesita dos comprobaciones malas seguidas (`seguidas`) para «lento»/«caido» (LENTO_MS 8 s); SaludPlataformas.jsx muestra el culpable y si se puede usar. probar-salud 17/17. Antes: `2026-11-19d`: SALUD EN VIVO: `GET /api/salud/en-vivo` (Server-Sent Events, rutas/salud.js) con `escuchar(fn)` de lib/salud.js: mientras alguien escucha, revisa todo cada 30 s y manda cada resultado nuevo (también el ↻ de una fila) a todas las pantallas; sin oyentes se detiene. SaludPlataformas.jsx usa EventSource (si falla, pregunta cada 30 s) y muestra «En vivo». probar-salud 15/15. Antes: `2026-11-19c`: ARREGLO: Crear anuncios de imagen se rompía con el borrador del navegador en modo «De un video» (`opciones.plantillasReferencia` antes de cargar las opciones, Formulario.jsx); abrir-pantallas.cjs ahora abre esa pantalla también con borradores (video, variantes, nuevos). OJO al probar: la app en el puerto 4455 hace «Guardado automático» (commits) en la rama actual; para pruebas usa ANUNCIOS_MODO_PRUEBA=1 y otro puerto, y abre las rutas con `/#/`. Antes: `2026-11-19b`: TUS VIDEOS E IMÁGENES: `POST /api/material` (rutas/material.js, crudo hasta 400 MB) → `temp/_material/<id>.<ext>` + json; `crearAnuncio` con `material: [{ id, nota }]` copia a `temp/<slug>/material/M01…` + `material.json` (+ `M0n-vista.jpg`, 4 cuadros de cada video) y `brief.material` (lib/material-propio.js); `textoMaterial(slug)` va en la tarea del guion (cómo usarlo). MOTOR (produccion/clips-sin-cobro.js): `desde_biblioteca` acepta `temp/<slug>/material/*` (`esDeMaterial`); nuevo `imagen_propia` (toma o B-roll: la imagen inicial es la del usuario, recortada a 1080x1920 con ffmpeg, sin generar ni pagar; en generar-imagenes.js después de las de biblioteca; el validador lo revisa); como referencia se usa una referencia aportada `{ archivo: 'material/M02.jpg' }`. Pantalla: `nuevo/TusArchivos.jsx` en AjustesEstilo (`ajuste.material`). claude-falso usa el material (imagen en la toma 1, video en el B-roll 1). Pruebas: probar-material 10/10, humo completo con material de punta a punta. Antes: `2026-11-19a`: DE UN VIDEO = ÁNGULO (pedido: «no es tomar fotogramas, sino analizar el ángulo y hacer las imágenes, títulos»). `video-imagenes.js`: `analizarAngulo(id, { productoId, cantidad, lanzarSesion })` de fondo en `t.angulo` (espera las tomas; `transcribirVideo` con ElevenLabs scribe_v1 por fetch y `leerClave`, texto de prueba en modo prueba; sesión de la IA con las tomas en hojas, la transcripción, la ficha y `contextoCreativo`; escribe `angulo-ia.json` { video: { angulo, gancho, dolor, deseo, promesa, publico, formato, por_que_funciona }, conceptos: [{ titular, angulo, faceta, momento, escena }] }); `limpiarAnalisis`. Rutas: `POST /api/imagen-ads/video/:id/angulo` y `POST /api/imagen-ads` con `video: { id, conceptos }` → `crearLote` con `plantillasReferencia` y `temasExtra` (temas del video) + `brief.desdeVideo`. `rapido.js`: con `brief.desdeVideo`, deseo/dolor/conceptos del video; la escena va en su línea «WHAT THE IMAGE SHOWS». Pantalla `DeUnVideo.jsx` reescrita (análisis, conceptos con titular y escena editables, 4/6/8/10, «Otras ideas»); el formulario muestra Plantillas y el costo normal. Escenas de 35–70 palabras, visuales (también `contextoVisual` del guion; topes 600). claude-falso responde el análisis. Probado de punta a punta en modo prueba (subir video → tomas → ángulo → lote con 3 conceptos y plantillas de glúteos → V01 con titular editado). Pruebas: probar-video-imagenes 22/22, probar-plantillas-referencia 30/30, imagen 168/168, pantallas 16/16, humo 86/86. Lo viejo (cuadros con plantillas de dibujo) sigue en el código para lotes viejos. Antes: `2026-11-19`: ✨ en las partes NUEVAS de «Editar a mano»: `regenerarLinea(slug, { nueva: true, despuesDe, actual })` (misma ruta `POST /guion/regenerar-linea`; 404 si `despuesDe` no existe; prompt «Escribe lo que se dice en una parte NUEVA que va justo después de la parte N…»); `apiNuevo.lineaNueva`; `ParteNueva` con el botón `nv-linea__regenerar` y, al llegar el texto, pide «lo que se ve». claude-falso: «Una parte nueva de prueba». Humo: 2 comprobaciones más. Antes: `2026-11-18z`: EDITAR EL GUION CON «LO QUE SE VE»: `contextoVisual(slug, { n | despuesDe, dice })` en `lib/anuncios-nuevos.js` (consulta corta como regenerarLinea, «TAREA: lo que se ve en una parte», escribe `app/se-ve-<id>.json` { se_ve } y lo borra) y `POST /api/anuncios/:slug/guion/se-ve`. `editarLineas` acepta `se_ve` por parte y partes nuevas `{ nueva: true, despuesDe, dice, se_ve? }` (máx. 10): si cambia lo que se ve o hay nuevas, va por la IA (`pedido` con «dice … ; se ve …» y «Partes NUEVAS … renumera»), aun con narrador; solo texto con narrador sigue directo. Pantalla `HojaGuion`: `SeVeEditable` (se escribe solo al salir del cuadro si el texto cambió; ✨ para otra), «Agregar parte aquí» y `ParteNueva`; `apiNuevo.contextoVisual`. claude-falso responde «Escena de prueba que muestra: …». Humo: 4 comprobaciones nuevas en el guion del anuncio de prueba (corrida completa en una copia sin anuncios). PORTADAS: `lib/portadas-estilos.js` (`PORTADAS` con el prompt de agregar, cambiar, clonacion, ganchos y sketch; `generarFaltantes` con `generarConChatGPT` 9:16 a `app/muestras/<clave>/imagen.png`, para en sin-sesión/límite y reintenta a las 24 h, `.cache/portadas-estilos.json`; `programarPortadas()` a los 90 s del arranque, nunca en modo prueba; `_paraPruebas`). `muestras.js` acepta las claves especiales; `/api/estilos` trae `especiales`; `GET/POST /api/estilos/portadas`. Estilos usa la portada en los especiales. Menú sin «Cambiar el producto» (las rutas `/cambiar` iluminan Estilos). probar-portadas 6/6. Antes: `2026-11-18y`: menú «Crear»: Embudo WhatsApp (`#/embudo-whatsapp`), Landings (`#/landings`) y S.E.P (`#/sep`), los tres «Pronto» (`pantallas/proximamente/index.jsx`, exports `EmbudoWhatsapp`, `Landings`, `Sep`; `.nav__item--pronto` con letra de 13 px). Inspiración oculta del menú (la ruta `#/inspiracion` sigue). Las copias instaladas con el comando público solo reciben lo que se publica en kads-studio (`npm run publicar` en la Mac del usuario, con `gh auth login`): la publicación automática sigue pendiente (llave de despliegue `APP_NUBE_LLAVE`); el Mac de Juanquín se reinstaló así el 2026-11-18. pantallas 16/16, humo 86/86. Antes: `2026-11-18x`: VER LO QUE ESTÁ EN LA NUBE: `lib/en-la-nube.js` (lee temp/<slug>/app/en-la-nube.json sin importar guardado.js: `archivoEnNube`, `finalEnNube` (slug por prefijo más largo), `finalesEnNube`, `enLaNube`). `rutas/archivos.js` y `rutas/miniaturas.js` sirven la copia de la nube si falta el archivo local (Range incluido). `lib/anuncios.js`: `versionesDe` suma los finales que solo están en la nube (`enLaNube: true`, antes el anuncio quedaba «en producción» al liberar el MP4), `leerCarpeta` suma img/ y video/ de la marca, `firmaDe` mira en-la-nube.json, el resumen trae `enLaNube`. Pantalla: marca «En la nube» en Anuncios y aviso más corto en la entrega. LANDINGS: `#/landings` (próximamente, `pantallas/landings/`), menú «Landings» con «Pronto» (`item.pronto`). Pruebas: probar-nube-ver 8/8 (anuncio y nube falsos, app real en 4482), humo 86/86, pantallas 14/14. Antes: `2026-11-18w`: PRODUCTOS RELACIONADOS en las plantillas: `indice.json` con `temas` por plantilla y el diccionario `temas`; `plantillas-referencia.js` `temasDeTexto`, `temasDeProducto(id)` (ficha + deseo central, 4 primeros; incluye respiratorio y sueño sin plantillas) y `relacionadas(id)`; `elegir(n, elegidas, { temas })` ordena familias y plantillas por coincidencia («hombres» solo no cuenta). `crearLote` le pasa los temas. `GET /api/imagen-ads/plantillas-relacionadas/:producto`. Selector: filtro «Para tu producto» por defecto y marca en «Todas». probar-plantillas-referencia 29/29. Antes: `2026-11-18v`: 24 plantillas nuevas (p31–p54) de TrendTrack (búsquedas `longest_running`/`reach`, imagen, español, LATAM/ES: glúteos, hinchazón, curvas/caderas, celulitis/abdomen/drenaje/colágeno, antes y después; ~150 créditos, quedan ~2.650). En `indice.json` cada una con `titular`, `ejemplo` y `fuente` { marca, dias, alcance }; `catalogo()` expone `dias`. Selector con filtros por familia y «N días activo». probar-plantillas-referencia 25/25, imagen 168/168, pantallas 13/13, humo 86/86. Antes: `2026-11-18u`: (1) TITULARES: `app/plantillas-referencia/indice.json` trae `titular` (la fórmula de cada plantilla, analizada de las 30) y `ejemplo`; `plantillas-referencia.fichaDe(id)`; `rapido.js` pasa la plantilla de cada imagen (R0k = k-ésima de `brief.plantillasReferencia`) a `variacionDePlantilla`, que pide el titular con esa estructura y el deseo principal, y «el resultado grande» (más volumen 60–70 % del cuadro si el deseo es volumen; reducido si es menos de algo). En `construirPrompt` el encabezado del titular en modo `plantilla` deja que el modelo lo escriba con la estructura (la idea de la investigación se usa tal cual si ya encaja). (2) PRODUCTOS: `lib/unir-productos.js` (`claveNombre`: sin tildes/mayúsculas y palabras ordenadas; `repetidos()` con `sugerido` = el que tiene investigación > competencia > ficha > más usos > más viejo; `unir(principal, otros)`: reemplaza `"productoId": "<otro>"` en temp/*/app/*.json y temp/_funcionan/lista.json, lleva ficha/investigacion/competencia/kit-marca si el principal no los tiene (con las rutas `/<otro>/` → `/<principal>/`), mueve el otro a temp/_productos/_unidos/<id> e indice.json). Rutas `GET /api/organizar-productos`, `POST /api/organizar-productos/unir`. Pantalla `#/productos` (`pantallas/productos/`): aviso de repetidos, lista por nombre con lo generado, modo «Unir productos» y modal para elegir con cuál quedarse. En los datos de prueba hay 2 grupos reales (3 «Aguaje Complex 3 en 1» y 5 «Aguaje Complex 10X»); no se unieron (lo decide el usuario). En modo prueba `repetidos()` solo ve productos de esa app. Pruebas: probar-unir-productos 9/9, probar-plantillas-referencia 25/25, imagen 168/168, pantallas 13/13, humo 86/86. Antes: `2026-11-18t`: plantillas con el ÁNGULO DEL PRODUCTO (pedido: «antes y después de piernas hinchadas → si el producto es de glúteos/caderas/piernas debe verse así; igual día 1/14/30; una persona debe mostrar el ángulo; buenos textos; Andromeda bien plasmado»). `lib/imagen-ads/angulo-producto.js` `contextoCreativo(productoId)`: deseo (cita de «Deseo central»), resultados («Los 5 resultados»), tiempos + nota («Tiempos de transformación»), avatar, conceptos de la matriz 15.4 unidos a las facetas 15.2 (escenario, dolor) y el titular de `anuncios_imagen` (concepto o faceta); sin matriz, los `anuncios_imagen`; `MOMENTOS` si no hay nada. `rapido.js variacionDePlantilla` → `app_rapido: 'plantilla'` (un concepto por imagen; el que se repite cambia de momento y de titular). `produccion/imagen-ads.js RAPIDO_PLANTILLA`: leer mecanismo/bloques/look de la plantilla y transponerlo al ángulo del producto (ejemplos de piernas → glúteos, Día 1/14/30, una persona, diagrama), Andromeda (quién, qué, cuándo), textos ≤ 6 palabras, rótulos solo con los tiempos permitidos. probar-plantillas-referencia 22/22, imagen 168/168, video-imágenes 19/19, humo 86/86. No probado con kie real. Antes: `2026-11-18s`: PLANTILLAS = REFERENCIAS (pedido: «no que hagas una literal; las imágenes de referencia pasan como referencia al modelo y se reemplaza el producto y los textos»). Las 30 imágenes validadas del usuario en `app/plantillas-referencia/` (p01–p30, 1350 px, `mini/` 360 px, `indice.json` con familia y grupo). `lib/imagen-ads/plantillas-referencia.js` (`catalogo`, `elegir(n, elegidas)`: hasta 10, sin elegir reparte entre familias sin repetir grupo y rota con el día, `copiarAlLote` → entrada/referencias/R##.jpg, `rutaDeArchivo`). `GET /api/imagen-ads/plantillas-referencia[/mini]/pNN.jpg`, `opciones().plantillasReferencia`. `crearLote` con `cuerpo.plantillasReferencia: { elegidas }` → `brief.desdePlantillas` (fiel, rápido, sin validados); `rapido.js` usa modo «copiar» (RAPIDO_COPIAR: misma estructura y tipografía; producto, textos y paleta del producto) + regla sin precios/ofertas. Pantalla: `ElegirPlantillasRef.jsx` (reemplaza ElegirPlantillas; el dibujo con Remotion queda para «De un video» y lotes viejos), campo `plantillasRef` del borrador; costo normal por imagen. Prueba nueva `probar-plantillas-referencia.mjs` 15/15; imagen 168/168; video-imágenes 19/19; andromeda 17/17; pantallas 12/12. No probado con kie real (depende de que el modelo respete la estructura). Antes: `2026-11-18r`: dashboard **Inicio** (`#/inicio`, `src/pantallas/inicio/`: Cifras, Grafico (barras HTML con tabla oculta), Ahora, Paneles (Saldo, Plataformas, Modelos), Listas (PorProducto, Recientes)); `/` redirige a `/inicio`; menú «Inicio» bajo «Nuevo anuncio». Servidor `lib/dashboard.js` + `GET /api/dashboard` (14 días en hora de Colombia: dólares por `gasto/*.json` `inicio`, anuncios por `conductor.terminado` de `slugsDeAnuncios()`, imágenes por `informe.archivos` de lotes `_img-*` de esta app; mes contra el anterior; `modelosDeKie()` ahora con `piezas`; 30 s de memoria). abrir-pantallas incluye `/inicio` (12) y humo `/api/dashboard` (86/86). Verificado en Playwright a 1440 y 390 sin desborde. Antes: `2026-11-18q`: Salud simplificada (sin «para» ni «fuente»), `modelosDeKie()` (gasto/*.json y _img-*/img/log-modelos.json de 7 días; reintento = intentos > 1 o respaldo), `REVISAR[id]` y `GET /api/salud?servicio=<id>`. probar-salud 12/12. Antes: `2026-11-18p`: Meta en Salud de plataformas: metastatus.com/data/orgs.json (lo que lee su página; estados «No known issues», «Low/Some/Medium disruptions», «High/Major disruptions»), grupos ads-manager+marketing-api, ads-transparency (Ad Library), whatsapp-business-api+ctx. probar-salud 11/11. Antes: `2026-11-18o`: «Salud de plataformas» (`lib/salud.js`, `GET /api/salud`, `marco/SaludPlataformas.jsx` en BarraArriba): Statuspage summary de status.claude.com (Claude Code, API), status.openai.com (Codex, Responses, Chat Completions, Login) y status.elevenlabs.io (todo), más comprobación propia con saldoKie y saldoElevenLabs (lento > 6 s, caído > 12 s); 60 s de memoria; la pantalla cada 2 min. Prueba `probar-salud.mjs` 7/7. ElevenLabs volvió a responder con la clave del usuario el 18-11 a las 18:07 UTC (21 s, aún con su incidente abierto). Antes: `2026-11-18n`: CAUSA FINAL de los timeouts de ElevenLabs: incidente de ElevenLabs «Increased latency and API errors» (US residency, desde 2026-11-18 15:34 UTC). Comprobado desde la nube con la clave del usuario (proxy, `request_credential`): `000` en 60 s; claves inválidas responden 400 enseguida. `lib/estado-servicios.js` (`fallaReportada('elevenlabs')`, status.elevenlabs.io/api/v2/summary.json, 3 min) se suma a Probar, /api/voces y voz-auto. El entorno App-nube ahora permite api.elevenlabs.io y status.elevenlabs.io y guarda la clave de ElevenLabs del usuario como secreto de red. Antes: `2026-11-18m`: espera tras un fallo (voces.js 2 min salvo `fresco`, `?fresco=1` desde Reintentar; estadoGuion no reelige sola por 10 min). DIAGNÓSTICO EN LA MAC DEL USUARIO (2026-11-18 12:40): `curl` CON su clave a /v1/user/subscription → `000` en 60 s (sin clave, 0,3 s); el diagnostico-elevenlabs.mjs también se cuelga en /v1/user. Es ElevenLabs con esa clave o cuenta (posible freno por los pedidos repetidos con conteo total de las versiones 18c–18k). Pendiente del usuario: status.elevenlabs.io, probar en la web, clave nueva con acceso completo, o soporte. Antes: `2026-11-18l`: `usuarioElevenLabs` (Probar) con `missing_permissions` en /v1/user caía a `/v2/voices?page_size=1` CON conteo total (lento) → timeout; ahora `include_total_count=false` (también en produccion/elevenlabs-client.js). `lib/ocupada.js` mide el atraso del event loop; `consultar` devuelve `ocupada`, `codigo`, `ms` y el mensaje lo dice (motivo `app-ocupada`). Herramienta `app/herramientas/diagnostico-elevenlabs.mjs` para la Terminal del usuario. Antes: `2026-11-18k`: CAUSA REAL de los «no respondió a tiempo» de ElevenLabs: `medirVoz` (spawnSync de ffmpeg + autocorrelación de todo el audio a 16 kHz) corría en el proceso de la app y bloqueaba el event loop con videos largos; los AbortSignal de todas las consultas vencían. Ahora `medir-voz.js` también es CLI, la app lo corre con `spawn` (voz-auto `medirAparte`, async), a 8 kHz y como mucho 800 cuadros (5 min en <1 s). curl y node en la Mac del usuario respondían en 0,3 s. probar-voz-auto 27/27 (con la prueba de no congelar). Antes: `2026-11-18j`: `dns.setDefaultResultOrder('ipv4first')` y `net.setDefaultAutoSelectFamily(true)` en app/server/index.js y produccion/config.js; claves.js espera 30 s. El usuario veía «ElevenLabs no respondió a tiempo» hasta en «Probar» la clave (y creó una clave nueva). No verificado en su Mac: si sigue, comparar `curl` contra `node -e fetch` a api.elevenlabs.io. Antes: `2026-11-18i`: `lib/voces.js` con `include_total_count=false`, 45 s por pedido, v1 de respaldo y la última lista buena en `.cache/voces-elevenlabs.json` (se devuelve al instante con `guardada: true` y se refresca por detrás; se usa si ElevenLabs falla salvo clave mala). El usuario veía «ElevenLabs tardó demasiado» con el saldo bien. probar-voz-auto 26/26. Antes: `2026-11-18h`: grilla de `.nv-guion` con `.nv-decisiones--plan` y la hoja en la columna 1 y `.nv-guion__lado` en la 2 (filas 1–2); el plan de Agregar (desde e7723fe) caía en la columna 1 y empujaba la hoja al lateral. Verificado en Playwright a 1920 y 1280. Pendiente menor: en el celular la pantalla «Nuevo anuncio» todavía se sale de ancho por filas de chips (ajenas al guion). Antes: `2026-11-18g`: ✨ regenerar una parte (`POST /api/anuncios/:slug/guion/regenerar-linea`, `regenerarLinea`: sesión corta con `lanzarSesion` de motor-ia, fuera de la cola, escribe `app/linea-<n>-<id>.json` { dice } y lo borra; no guarda: la pantalla lo pone en el cuadro). `claude-falso.js` responde «TAREA: regenerar una línea». Probado en Playwright. Antes: `2026-11-18f`: editar el guion a mano (`PUT /api/anuncios/:slug/guion/lineas`, `editarLineas`: con `modo_audio: voz_en_off` y sin audio/voz.mp3 se aplica directo a `tomas[].linea`, `voz_en_off` y los textos de la toma que la repiten, se valida y solo se deshace si aparece un ERROR nuevo; en los demás, `pedirCambios` interno con el texto exacto). Pantalla: «Editar a mano» en HojaGuion (no en letras ni diálogos de entrevista). Probado en Playwright con una copia de Claymation. Antes: `2026-11-18e`: tarjeta «Voz del narrador» en el guion (`nuevo/VozDelGuion.jsx`, `BotonEscuchar.jsx` aparte), `PUT /api/anuncios/:slug/voz` (`cambiarVoz`: `{ id, nombre }` o `{ auto: true }`, 409 si ya existe audio/voz.mp3), `estadoGuion` devuelve `voz` (`generada`, `eligiendo`, `error`) y elige de fondo si falta; `vozDelPlan` lee la voz del plan de Agregar. Pruebas: probar-voz-auto 22/22, humo 85/85, pantallas 11/11 y la tarjeta en Playwright. Antes: `2026-11-18d`: `lib/voces.js` pide las voces con fetch en el proceso de la app (clave con `leerClave` de claves.js, como el saldo), sin el proceso hijo; motivos `sin-clave`, `clave`, `sin-conexion`, `tarda`, `servicio`; `_paraPruebas({ servidor })`. El usuario veía «error de conexión» con el saldo bien. Prueba: probar-voz-auto 20/20 con un ElevenLabs simulado. Antes: `2026-11-18c`: voz del narrador automática (`lib/voz-auto.js`). Antes: `2026-11-18b`: arreglo de «Crear anuncios de imagen» (en 18a, `productoElegido` se usaba antes de declararse: error de zona muerta temporal que el build no detecta). Revisión nueva: `node app/herramientas/abrir-pantallas.cjs` con la app de prueba en el puerto 4471 (abre 11 pantallas en Chromium y falla si alguna se rompe); correrla después de tocar pantallas. Antes: `2026-11-18a`: 8 clones de anuncios validados y `anuncios_imagen` en la investigación (editables, con aprendizaje). Antes: `2026-11-18`: investigación de mercado con «Conceptos para Meta (Andromeda)». Antes: `2026-11-17q` (antes `2026-11-17p2`, mismo contenido): 8 plantillas de «Ángulos ganadores» y las de oferta fuera de
  la pantalla y de la mezcla. Antes: `2026-11-17p1` (referencia interna de ganadores) y `2026-11-17p`: anuncios de imagen con plantillas (la app dibuja los textos y
  los gráficos con Remotion en 0,3-1 s por imagen; el modelo solo hace escenas sin texto; 12 de 17 formatos gratis; kit de
  marca; «Editar textos» gratis) y «De un video, imágenes» (rama `plantillas-imagen`, sin PR). Antes: `2026-11-17o`: exportar del editor por tramos (solo se rehace lo que cambió;
  solo sonido sin rehacer imagen; VideoToolbox en la Mac). Antes: `2026-11-17n`: Inspiración con los anuncios de Meta mismo (fuentes «Meta
  (oficial)» con la API de la Biblioteca de anuncios, solo Europa, y «Desde Chrome» con el botón «Guardar en Kads»;
  TrendTrack sigue como tercera fuente). Antes: `2026-11-17m1` (Inspiración: solo validados y nunca tus marcas), `2026-11-17l1` (Agregar y Clonar no pierden la esencia),
  `2026-11-17l` (estilo «Agregar»: subir un video y decir lo que quieres), `2026-11-17k` (editor con el audio como en CapCut),
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

### La voz del narrador la elige la app (2026-11-18, versión 2026-11-18c)

- Pedido: «si no selecciono la voz del narrador, que tome la más indicada o la más parecida a la del video de referencia».
- `produccion/medir-voz.js`: tono medio (F0) por autocorrelación en cuadros de 40 ms con voz (solo donde hay palabras;
  el primer pico ≥ 90 % del mejor evita el error de octava), género (≤165 Hz masculina, ≥185 femenina), variación en
  semitonos (expresiva ≥ 3) y ritmo. Lo usa `analizar-referencia.mjs` (`adn-base.json` → `voz`).
- `app/server/lib/voces.js`: la lista de voces de ElevenLabs (antes dentro de `rutas/voces.js`), compartida.
- `app/server/lib/voz-auto.js`: `vozBuscada` (referencia medida > `temp/<slug>/voz-buscada.json` de la IA > ficha:
  público y país), `elegirVoz` (puntos por género, español, acento, edad, tono, narración, propia, última usada) y
  `asegurarVoz` (la guarda una vez en `app/brief.json` como `{ id, nombre, auto: true, motivo }`).
- `crearAnuncio`: sin voz o `id: 'auto'` → `voz: { auto: true }` (ya no da 400; solo recuerda la voz si la eligió el
  usuario). Tarea del guion: bloque «La voz del narrador (la elige la app)» que pide `voz-buscada.json`. Al terminar el
  guion se elige ya (se ve en el avance); si falla, se elige en el paso de la voz (voz-en-off.js y continuidad.js).
  Informe: «La eligió la app porque no elegiste una: …».
- Pantalla: «Que la elija la app» como primera opción (sin precargar la última voz; la marca «la última que usaste»),
  y Guiones ya no frena sin voz.
- Pruebas: `probar-voz-auto.mjs` 15/15 (nuevo; tonos sintéticos, elección, prioridades, idempotencia), probar-agregar
  35/35, humo 85/85, abrir-pantallas 11/11, build. No probado con voces ni audio reales (sin clave de ElevenLabs ni
  grabaciones de voz en esta copia): la medición se probó con tonos sintéticos.

### Plantillas clonadas y textos de anuncios en la investigación (2026-11-18, versión 2026-11-18a)

- Pedido: usar las ~30 imágenes validadas (Muna, Grüns, Sonvital, Vitaly, Lymphoria, Aurelys, Maya Verra, Natures
  Sunshine, Aguaje) como plantillas (misma estructura y tipografía, otra paleta y producto), con lo de Andromeda y la
  matriz creativa (diversidad real); que la investigación dé los textos y se puedan editar para que aprenda; verificar
  el diseño de todas las secciones.
- `remotion/src/plantillas-imagen/clones.jsx`: etapas-neon, antes-despues-plazo, dos-mitades (titular recortado con
  clip-path en 2 colores), rotulos-anatomia, estado-vs-estado, cuadricula-tiempo (una escena 2×2 recortada en 4
  celdas), beneficios-lados, dias-producto. Fuentes nuevas en `publico/fuentes/`: Poppins 400–900 y DM Serif Display
  (woff2 de @fontsource, OFL). Historia usa la serif. 33 plantillas en total (25 visibles).
- `catalogo-plantillas.js`: `limpiarTextos` vive aquí ahora (lo re-exporta textos-plantillas; evita el ciclo con
  investigacion.js), `PLANTILLAS_ANGULO`, `plantillasParaLaIA()` (la lista con campos para la tarea).
- `lib/investigacion.js`: `anuncios_imagen` [{ plantilla, concepto, faceta, angulo, contexto, textos }];
  `erroresAnuncios` (10–16, 6+ plantillas, faceta y contexto, cada par distinto en 2+ de faceta/ángulo/contexto/
  plantilla) en `verificar` de la investigación nueva y de «Agregar conceptos y textos»; `anunciosDe`, `editarAnuncio`
  (guarda `original` y `editado`, anota en `mis_archivos/biblioteca/aprendizajes/investigacion-textos.md`; las pruebas
  usan `ANUNCIOS_APRENDIZAJE_TEXTOS`), `aprendizajesDeTextos` (van a las 2 tareas con `{{plantillas}}` y
  `{{aprendizajes}}`); `resumenDe().propuestas`; `estado().plantillas` (campos para editar).
- Lotes: `textosPara` usa primero los textos de la investigación (k-ésimo por plantilla); `lotes.js` pone las
  propuestas como `elegidas` si no hay (costo coherente); el formulario lo muestra. Muestra de plantilla con `?anuncio=i`.
- Pantalla: `TextosAnuncios.jsx` (rejilla con muestra, Editar con `ModalTextos` reutilizado). Diseño: tablas del
  documento en `.doc-tabla-caja` (deslizan en el celular), portada y padding para <600 px, botón de competencia.
- Pruebas: probar-investigacion-andromeda 17/17, probar-imagen-ads 168/168 (32 imágenes de 16 ángulos), humo 85/85,
  video-imágenes 19/19, build; revisión visual con Playwright (escritorio y 390 px) con una copia de la investigación
  real de VitalDrops y 12 textos de prueba. No probado con una sesión real de la IA ni con escenas reales de kie.

### Investigación de mercado: Conceptos para Meta (Andromeda) (2026-11-18, versión 2026-11-18)

- Pedido: agregar a la investigación de mercado lo de la clase «Meta Andromeda aplicado a Colombia» (el creativo es la
  segmentación, facetas del cliente, contexto y momento, matriz creativa de 4 variables, IA con contexto, estructura y
  señal contraentrega).
- Skill `investigacion-mercado`: sección 3b nueva y parte 16 de la estructura (fuentes pasa a 17). En la app es la
  sección 15 del JSON «documento», después de la de copy/guía visual: 15.1 caja, 15.2 tabla de facetas, 15.3 tabla de
  momentos, 15.4 matriz # / Faceta / Problema / Contexto / Formato / Hook (8 filas), 15.5 ficha estructura y señal,
  15.6 prompt con contexto, caja de cuidado. `tarea-investigacion-mercado.md` la pide.
- `lib/investigacion.js`: `erroresAndromeda` (facetas, momentos y matriz de 6+ filas) se exige en `verificar` de las
  investigaciones nuevas, no al leer (las viejas se siguen viendo). `investigar(id, { soloAndromeda })` lanza
  `tarea-investigacion-andromeda.md`: solo Read/Edit del JSON, sin internet, 25 min máx., también con ChatGPT; copia de
  respaldo y vuelta atrás si falla. `tarea.modo = 'andromeda'`.
- Pantalla: botón «Agregar conceptos para Meta (Andromeda)» en la cabecera de una investigación «documento» que no la
  tiene, y su pantalla de espera. `Documento.jsx` numera bien las hojas de las secciones que van después de la guía.
- Pruebas: `probar-investigacion-andromeda.mjs` 9/9 (nuevo), humo 85/85, build. No probado con una sesión real de la IA.

### «Actualizar» no traía nada a las copias instaladas (2026-11-17, versión 2026-11-17q)

- Síntoma: alguien instaló con el comando, tocó «Actualizar» y no cambió nada.
- Causa 1: la última versión publicada en `kalethabh/kads-studio` es `v2026-11-16a` (`git ls-remote --tags`). El flujo
  «Publicar sola la versión nueva» de kads-studio falla desde entonces (le falta la llave `APP_NUBE_LLAVE`) y no se
  corrió `npm run publicar`.
- Causa 2: las versiones `2026-11-17p1`, `p2`, `j2`, `m1`, `l1` no cumplen `RE_VERSION` / `RE_ETIQUETA`
  (fecha + una letra): una copia instalada no las reconocería aunque se publicaran.
- Arreglo: `RE_VERSION` y `RE_ETIQUETA` aceptan un número final, `esMasNueva` compara con números (q10 > q9);
  `publicar-version.mjs` se niega a publicar una VERSION que no sea fecha + una letra (las copias viejas solo leen
  esa). **Regla desde ahora: VERSION siempre fecha + una letra** (siguiente: `2026-11-17r`).
- Falta del usuario: publicar (`npm run publicar` en su Mac, con `gh auth login`) o arreglar el flujo automático de
  kads-studio (llave de despliegue de solo lectura en App-nube + secreto `APP_NUBE_LLAVE` en kads-studio). Esta
  sesión no tiene acceso a kads-studio.

### Plantillas de «Ángulos ganadores», sin oferta (2026-11-17, versión 2026-11-17p2)

- Pedido: «que las plantillas no sean de oferta, sean de ángulos de venta», con 30 anuncios validados de ejemplo
  (Muna/VitalDrops, Grüns, Sonvital, Vitaly, Lymphoria, Aurelys, Maya Verra, Natures Sunshine, Aguaje Complex).
- `remotion/src/plantillas-imagen/angulos.jsx`: 8 plantillas nuevas, todas con escena: `silueta-zonas` (neón sobre negro,
  la escena se funde con `mix-blend-mode: screen`), `solo-vs-con`, `nosotros-vs-ellos`, `no-compres` (recuadros negros
  tipo TikTok y sirena en SVG, sin emojis), `pregunta-revelacion`, `historia`, `zonas-semanas`, `foto-iconos`.
- `catalogo-plantillas.js`: familia nueva `angulo` («Ángulos ganadores», la primera). La familia `oferta` queda
  `oculta`: sigue en el catálogo para dibujar lotes viejos, pero `catalogoParaLaPantalla` y `ORDEN_AUTO` ya no la usan.
  Campo `etiquetas` opcional para los `pares` (ModalTextos: «Etapa / Lo que pasa»).
- `textos-plantillas.js`: textos de cada uno desde la ficha, sin precio ni oferta (`comoPregunta` pasa el dolor de la
  ficha a «¿Sientes que…?»; `foto-iconos` usa «Esta Navidad regálate…» en noviembre y diciembre, k impar). Lo de
  «lo de siempre» en `nosotros-vs-ellos` es genérico y editable («No ataca la causa»…).
- `plantillas.js descripcionEscena(id, ctx, textos, kit)`: la escena de cada ángulo (el neón usa el acento del kit; la
  pregunta usa el color primario de fondo).
- Pruebas: probar-imagen-ads 168/168 (sección 11f nueva: sin oferta en pantalla ni mezcla, textos sin precio, 16
  imágenes de los 8 ángulos en 6,6 s), humo 85/85, video-imágenes 19/19, build de Vite. No probado con escenas reales
  de kie (la silueta de neón y la persona sobre fondo de color dependen del modelo).
- Pendiente posible: usar `historia` y `no-compres` también en «De un video, imágenes» (hoy solo antes-despues).

### Referencia interna de anuncios de imagen ganadores (2026-11-17, versión 2026-11-17p1)

- Pedido: tomar como referencia interna, sin mostrarla, los análisis de VitalDrops (Amua, Muna, Dorphix), drenaje
  linfático (Sonvital y su red, BlockFusion/Erlona) y Grüns, para replicar cómo comunican el ángulo.
- `.claude/skills/anuncios-imagen-ads/referencias-ganadoras.md`: reglas comunes, fórmula por formato (con su plantilla),
  ángulos que se repiten y lo que no se hace. La skill la lee en el Paso 4 (modo elaborado).
- `textos-plantillas.js`: `plazoDe(etapas)`, línea de tiempo «resultado + plazo» (k par), pizarra «¿{probó}? Prueba
  esto.», mapa del cuerpo «La diferencia se nota» (k par). El antes/después cuadrado ya iba sin título sobre la foto.
- `plantillas.js descripcionEscena`: regla `ganador` (zona del cuerpo 60–70 % del cuadro, ropa ajustada, lugar real
  sin distracciones) en antes/después (foto de celular en casa) y línea de tiempo (fondo claro, perfil o espalda 3/4).
- `video-imagenes.js` (elección con IA) y `produccion/imagen-ads.js` (`COMO_GANADORES` en RAPIDO_COPIAR/INSPIRAR):
  una idea por imagen, el ángulo antes de leerse, título con el dolor o resultado, oferta nunca en el título.
- Pruebas: imagen 163/163, video-imágenes 19/19, humo 85/85, probar-imagen-ads 173, ChatGPT 0 fallas.

### Plantillas de imagen y «De un video, imágenes» (2026-11-17, versión 2026-11-17p)

Pedido (tras analizar los anuncios ganadores de Grüns, Sonvital, Amua y BlockFusion): «que las imágenes se vean limpias y
llamativas como Grüns, y que no se tarde en generar». Después: «de un video, varias imágenes listas con ángulos distintos».
Rama `plantillas-imagen` (sin PR).

- **Plantillas en Remotion** (`remotion/src/plantillas-imagen/`, entrada propia `entrada.jsx`: 3 composiciones de un
  cuadro, `Plantilla-1x1` 1080×1080, `-4x5` 1080×1350, `-9x16` 1080×1920). `base.jsx`: `Ajustado` (búsqueda binaria del
  tamaño de letra hasta que entra; nunca parte palabras; `text-wrap: balance`; aire arriba para las tildes), `Titular`,
  `Mano`, `Producto` (recortado con sombra o sobre tarjeta), `Escena` (la del modelo o un fondo de espera), `Flecha`
  a mano, `Sticker`, `FranjaOferta`, `Legal`, `Estrellas`, `Verificado`, paleta del kit. 17 plantillas en `dolor.jsx`,
  `beneficio.jsx`, `nativo.jsx`, `oferta.jsx`. Fuentes OFL/Apache con sus licencias en `publico/fuentes/` (Anton, Bebas
  Neue, Archivo Black, Caveat, Permanent Marker, Inter), cargadas con `FontFace` + `delayRender`.
- **Dibujante rápido** (`app/server/lib/plantillas/render.js` + `trabajador.mjs`): proceso hijo de larga vida con
  `cwd=remotion/` (ahí busca su navegador). `bundle()` una vez, guardado en `.cache/plantillas-imagen/<huella del código
  + versión de Remotion>/`; un `openBrowser` reutilizado (`puppeteerInstance`), `getCompositions` una vez, `renderStill`
  a PNG (temporal + renombre), hasta `os.cpus()` a la vez (máx. 8, `PLANTILLAS_A_LA_VEZ`), servidor local con ficha
  para las imágenes (solo dentro de la carpeta de la app), navegador cerrado tras 15 min sin trabajo. Se calienta 4 s
  después de arrancar la app (`ANUNCIOS_SIN_CALENTAR_PLANTILLAS=1` lo apaga) y en `preparar` de cada lote.
- **Catálogo y textos** (`imagen-ads/catalogo-plantillas.js`, `textos-plantillas.js`): `CATALOGO` (id, familia,
  `escena`, `campos` editables), `ORDEN_AUTO`, `asignar(cantidad, elegidas)` y `escenasDe` (el formulario repite la
  cuenta con `planDePlantillas`). `contextoDelLote` junta ficha (beneficios, `ingredientesDe` con los mg de la etiqueta,
  dolor en primera persona, probo, comoSeUsa → `etapasDe`), investigación (los dos formatos: puntos de dolor, objeciones
  con «?», citas, deseo) y ganchos validados (`ganchosValidados` o `entrada/ganchos.json`). `textosPara(id, ctx, k)`:
  reglas fijas por formato, sin inventar números ni testimonios (el tuit lo firma la marca, 0 estrellas por defecto).
  `limpiarTextos` valida lo que llega de la pantalla contra los campos.
- **El lote** (`imagen-ads/plantillas.js`): `brief.plantillas = { elegidas, kit, asignadas }`, `rapido: true`,
  `fiel: false`. `prepararPlantillas` (en `estrategia`, sin la IA) escribe producto/estrategia/plan y cada V##.json con
  `app_plantilla: { id, escena, textos, k, escenaFija?, angulo? }`. En `cargarYNormalizar` lo que dibuja solo la app
  (plantillas sin escena y TODOS los verticales) queda `fase: final, local: true`: al motor van solo los cuadrados con
  escena (todos en una orden, `topeKie` 12 o 4 a la vez con ChatGPT). `construirPrompt` con `app_plantilla.escena` →
  `construirPromptEscena` (`ESCENA_SIN_TEXTO`: sin letras/logos/UI, zonas libres para los textos, misma persona/pose/
  ropa/cámara/luz). Lo dibujado: `final/<pieza>.png` + `final/<pieza>.json { huella, completa }` (huella = código de las
  plantillas + textos + kit + firmas de producto/escena/logo). El bucle `anuncios` lanza `componerPendientes` en cada
  vuelta (nunca dentro de `Promise.race`: una pasada vacía se resuelve con microtareas y dejaba sin turno al resto) y
  termina cuando una pasada empezada con todo quieto no dibujó nada. `pasosDelPedido` no rehace el vertical local.
  Costo: `imagenesDeLaAccion` cuenta solo escenas (0 si todo es local o de video).
- **Kit de marca**: `temp/_productos/<id>/kit-marca.json` (`kitAutomatico`: tonos dominantes no neutros con peso s²,
  la piel/madera pesa 0,15; primario oscurecido para texto blanco; sin segundo color, amarillo cálido). `GET/PUT
  /api/imagen-ads/kit/:producto`. Recorte gratis del producto solo si ya hay rembg con un modelo bajado
  (`recorte-producto.js`, `ANUNCIOS_SIN_RECORTE=1` lo apaga); si no, tarjeta.
- **Rutas**: `POST /:lote/textos { v, textos }` (redibuja la variación), regenerar de una sin escena = `otraVersion`
  (gratis, 200 `{ gratis: true }`), de una con escena = otra escena del cuadrado (la nota va a `visual_prompt`, sin la
  IA), `GET /plantillas/muestra/:id?producto&foto&p&s&ft&fs&st` (PNG en `.cache/plantillas-muestras/`, `sendFile` con
  `dotfiles: 'allow'`), ZIP con `final/` solo si `completa`. La vista manda `plantilla` por variación y
  `imagenesRegenerar`, `local`, `pulible` por pieza; `armarInforme` con `plantillas: true`.
- **Pantallas**: formulario (interruptor «Con plantillas», `ElegirPlantillas.jsx` con muestras, `KitMarca.jsx`, costo
  «Sin costo» o solo escenas), lote («Editar textos» → `ModalTextos.jsx`; `ModalRegenerar` gratis para las locales;
  textos del avance y del informe), Inspiración (botón de imagen en videos → `ganadores.adaptar` →
  `#/imagenes/nuevo?video=subido:…`).
- **De un video, imágenes** (`imagen-ads/video-imagenes.js`, `DeUnVideo.jsx`, modo «De un video»): trabajo en
  `temp/_video-imagenes/<id>/`. Cortes con `select='gt(scene,0.3)',showinfo`; barrido gris a 4 cps y 256 px: varianza
  del laplaciano ÷ (1 + movimiento/6); por toma el mejor cuadro lejos de los cortes (12 %), sacado a 1080 (lanczos si
  es chico). Subtítulos: `franjaDeTexto` (filas con bordes letra clara/contorno oscuro > 3 %); con `cv2` inpainting
  Telea, sin él recorte de la franja. Elección sin IA (`eleccionSinIA`: más nítidos repartidos + antes y después con el
  primero y el último) o con la IA (`lanzarSesion` con los cuadros en `material`, hojas 2×2 si son más de 8;
  validada). `POST /api/imagen-ads/video { subido | anuncio }`, `GET /video/:id`, `POST /video/:id/elegir`,
  `GET /archivos/video-imagenes/:id/cuadros/T##.png`; `POST /api/imagen-ads` con `video` copia los cuadros al lote
  (`entrada/cuadros/V##.png`, el antes y después lado a lado) → `app_plantilla.escenaFija`. «Pulir con IA»
  (`POST /:lote/pulir`, 1 imagen con costo confirmado): `prepararPulido` pasa el cuadro a `entrada/referencias/R##` y
  `fiel: true`, y un pedido normal pide la escena con la referencia.
- **Pruebas (sin gastar)**: `probar-imagen-ads.mjs` 163/163 (16 nuevas: lote sin escenas en 2,4 s sin llamar al
  proveedor y costo 0; editar un texto redibuja solo esa variación en 0,5 s; escenas en una sola orden y solo
  cuadrados; prompt sin texto; vista previa antes de la escena; regenerar una escena con nota; kit). Nueva
  `probar-video-imagenes.mjs` 19/19 (video sintético de 72 s con 8 tomas y subtítulos: tomas, cuadro nítido aunque la
  toma empiece borrosa, subtítulos recortados, elección sin IA y con una IA de mentira, lote en 3 s con costo 0,
  pulir). Humo rápido (`HUMO_SIN_ANUNCIO=1`, desde una copia fuera de `.claude`) 85/85 y compilación Vite sin errores. Navegador (copia fuera de `.claude`, modo prueba):
  formulario con las 16 muestras en 1,6 s, lote de 4 anuncios × 2 tamaños en pantalla 5,4 s después de «Generar»,
  «Editar textos» 0,9 s; «De un video» con un video de 60 s: cuadros elegidos 3,9 s, lote en pantalla 5,1 s; sin
  errores JS. Capturas revisadas de las 17 plantillas en 1:1, 4:5 y 9:16 (tildes, nada encimado).
- **Límites / sin verificar sin gastar**: la calidad real de las escenas sin texto de kie o ChatGPT (que respeten
  «sin texto», las zonas libres y la misma persona en las dos mitades o los paneles), la elección con una IA real, el
  pulido real y los tiempos de kie. En este contenedor no hay OpenCV (se probó el recorte de la franja, no el borrado) ni
  el modelo de rembg (se probó la tarjeta). La transcripción de ElevenLabs no se usa: solo los subtítulos de tus anuncios
  (gratis). «Mejorar textos con mi IA» no se hizo (los textos se editan a mano). Un tuit/comentario es contenido de
  ejemplo editable: revisa que lo que diga sea cierto antes de publicar.
- **Siguiente paso**: en la Mac, «Actualizar», un lote «Que la app elija» de 10 con un producto con investigación (3
  escenas pagadas) y un «De un video» con un anuncio propio; mirar las escenas y ajustar las descripciones si hace falta.

### Exportar del editor por tramos: solo se rehace lo que cambió (2026-11-17, versión 2026-11-17o)

Pedido: «necesito descargar más rápido los creativos del editor a los que les hago pequeños ajustes». Rama
`exportar-por-tramos` (sin PR). Antes cada exportación volvía a dibujar todos los cuadros con Remotion.

- **Cómo funciona** (`produccion/exportar-edicion.js`, `produccion/exportar-tramos.js`): el video se divide en tramos
  fijos de 120 cuadros (0, 120, 240…; un resto de menos de 1 s va pegado al último). Cada tramo se guarda en
  `temp/<slug>/app/exportes/.tramos/<calidad>/<huella>.mp4` (carpeta con punto: el respaldo a Drive la salta; en
  `.gitignore`). Los que faltan se dibujan TODOS en un solo `renderMedia` con `frameRange` de varios rangos, mudo, con
  `-force_key_frames` cada 120 cuadros (`ffmpegOverride`, `-forced-idr 1` en x264, `-bf 0` en VideoToolbox) y se cortan
  con `ffmpeg -ss … -c copy -frames:v`. Se juntan con el concat de ffmpeg por copia directa (antes se comprueba que
  todos tengan el mismo formato y extradata, y después que el total de cuadros sea el del montaje). ffmpeg/ffprobe:
  los de Remotion (`RenderInternals.getExecutablePath`, tienen concat/mp4/aac) o los del sistema. Si algo falla:
  export entero como antes (`EXPORTAR_SIN_TRAMOS=1` o `--sin-tramos` lo fuerzan; `EXPORTAR_TRAMOS_DETALLE=1` muestra
  la huella de cada tramo).
- **Huella de cada tramo** (`huellasDeTramos`): lo general (código de `remotion/src` + `exportar-edicion.js` +
  `exportar-tramos.js`, VERSION, versión de Remotion, calidad, codificador y ajustes, color, estilo de subtítulos, la
  parte del plan que no va por tiempos, y cualquier campo de la edición o de las capas que la cuenta no conoce) más lo
  que se ve dentro del tramo: tomas/B-roll/pasos con su ventana en cuadros (la misma cuenta de `Anuncio.jsx`) y su
  transición, cada texto/imagen/tapa y cada bloque de subtítulos en sus cuadros exactos (`cuadrosEntre`, la misma
  comparación `t = cuadro / fps` de las capas), los fundidos, y tamaño+fecha de cada archivo que leen. Lo que solo
  suena (`volumenClip`, `volumenDb`, `mudo`, `audioDeformado`, `plan.audio`, `plan.musica`, voz, música, pitidos, tus
  audios) no entra. Podcast/entrevista (`plan.escena`): todo el plan es general.
- **Sonido aparte** (`huellaDeSonido`, `sonido-<huella>.aac`): la primera vez sale en el mismo render
  (`separateAudioTo`); después, si solo cambió el sonido, una pasada «solo sonido» (`contexto.soloSonido`:
  `remotion/src/edicion/soloSonido.jsx` cambia cada `OffthreadVideo` de `Anuncio.jsx`/`Escena.jsx` por un `<Audio>`
  con las mismas opciones; sin eso la pasada tardaba lo mismo que el video). OJO: `renderMedia` usa las props de
  `composition.props`, por eso la pasada lleva `{ ...composicion, props: propsSonido }`. El AAC se copia tal cual al MP4.
- **Control final por tramos** (`medirPorTramos`): mide solo los tramos nuevos (guardado en `<huella>.json`) y las
  uniones que los tocan (±1,3 s, `union-<a>-<b>.json`); si casi todo es nuevo mide el video entero y lo reparte. Los
  congelados se juntan entre tramos y uniones. Si la revisión pide exportar otra vez, se borran solo los tramos con el
  defecto.
- **Mac:** `hardwareAcceleration: 'if-possible'` + `videoBitrate` 12M (1080) / 6M (720) solo en darwin (en Linux y
  Windows Remotion pediría NVENC). Si VideoToolbox falla, se rehace todo con x264 (los tramos no se mezclan: el
  codificador va en la huella).
- **Limpieza:** `podarCache` deja lo de este video y lo más reciente (máx. 2× los tramos + 4, mínimo 24 archivos, y
  500 MB); se va con el anuncio al eliminarlo (la papelera mueve la carpeta).
- **Pantalla:** el avance lleva `nota` y `tramos` (`app/server/rutas/editor.js` los guarda en el trabajo) y
  `ModalExportar.jsx` muestra la nota («Rehaciendo 2 de 10 tramos (lo demás ya estaba)», «Solo cambió el sonido:
  armando en segundos»).
- **Medido** en un anuncio sintético de 38,6 s (copia del UGC de VITALABH con clips testsrc2 + un seno por toma), 720p,
  4 núcleos, Linux: (a) primera vez 69 s (antes 83 s; otra corrida entera en las mismas condiciones, 66 s); (b) cambiar un
  texto de 18–21 s 19 s (antes 65 s: rehízo 2 de 10 tramos); (c) silenciar una palabra 11 s (antes 68 s: 0 tramos, solo
  el sonido); (d) igual otra vez: instantáneo (como antes). Contra el render entero: mismos 1158 cuadros y 38,6 s, SSIM
  0,9968 de promedio (mínimo 0,991, en una transición; en las uniones 0,991–0,994; un cuadro corrido da 0,94), PSNR 46,8
  dB, y el sonido idéntico muestra a muestra (voz por tomas 260–560 Hz, música 110 Hz, pitido de 1000 Hz y la voz callada
  en la censura). En 1080p (mismo anuncio): primera vez 91 s, cambiar un texto 26 s (2 de 10 tramos), 1080x1920 y 1158 cuadros.
- **Pruebas:** `node app/herramientas/probar-exportar-tramos.mjs` (67 comprobaciones: qué tramos cambian con cada
  ajuste, la medición por tramos con un congelado que cruza una unión, la poda); `vite build`; prueba de humo sin
  anuncio 85/85; `probar-imagen-ads.mjs` 147/147; una exportación pedida por la app (modo prueba) mostró la nota.
- **No probado:** VideoToolbox en una Mac real (bitrate, `-bf 0`, cuadros clave forzados); Windows; anuncios de
  podcast/entrevista y de continuidad exportados por tramos (la cuenta está, sin prueba de punta a punta).

### Inspiración desde Meta: API oficial + botón de Chrome (2026-11-17, versión 2026-11-17n)

Pedido: que los anuncios salgan de Meta mismo, como starpop.ai/inspiration. El usuario eligió «API oficial + botón de
Chrome». Rama `inspiracion-meta` (sin PR todavía). TrendTrack sigue como tercera fuente.

- **Selector de fuente** arriba del feed: «Meta (oficial)», «Desde Chrome», «TrendTrack» (recordado en localStorage
  `inspiracion-fuente`). Las tres usan la misma forma de anuncio (`normalizarAnuncio` de `lib/ganadores.js`, ahora con
  `fuente`, `metaId`, `plataformas`, `descripcion`, `creativos`, `medioPendiente`, `guardadoEn`), las mismas tarjetas,
  formato/sonido, guardados, Detalles, Replicar y `paraInspiracion` (nunca tus marcas). UI: `fuentes.js` (hooks
  `useFuenteMeta`, `useFuenteChrome`, `useMediosMeta`), `BotonChrome.jsx`, cambios en `index.jsx`, `Tarjeta.jsx`,
  `Detalles.jsx`, `datos.js`.
- **Meta (oficial)** (`app/server/lib/meta-biblioteca.js`, `VERSION_GRAPH = 'v21.0'` en un solo lugar): `GET
  graph.facebook.com/v21.0/ads_archive` con search_terms / search_page_ids, ad_reached_countries (solo UE + GB,
  `PAISES_META`), ad_active_status=ACTIVE, ad_delivery_date_max = hoy − 30 (validado), media_type, languages y los
  campos id, page_id, page_name, ad_creative_*, ad_delivery_start_time, ad_snapshot_url, publisher_platforms, languages,
  eu_total_reach. «Cargar más» con `paging.cursors.after` (el `paging.next` trae el token: nunca va al navegador).
  Caché 12 h en `temp/_ganadores/meta/busquedas/`. Errores: 190 → «Tu token de Meta venció»; 4/17/32/613/80004 → «Meta
  pidió esperar»; 10/200-299/2332002 → explica la verificación de identidad. **Límite**: para anuncios no políticos la
  API solo devuelve lo que se mostró en la UE (y Reino Unido): la pantalla lo dice y manda a «Desde Chrome».
  **Medios**: la API no da video; el servidor abre el snapshot (`/ads/archive/render_ad/?id=…&access_token=…`, solo
  redirecciones dentro de facebook.com), saca video/imagen/miniatura .fbcdn.net (`extraerMediosSnapshot`) y lo guarda
  12 h en `temp/_ganadores/meta/<id>.json`; se pide solo para las tarjetas visibles (IntersectionObserver), de a 2
  (servidor y pantalla). Si falla: «Ver en Meta» (facebook.com/ads/library/?id=…). Al guardar un anuncio de Meta se
  guarda sin la dirección del video (vence) y se vuelve a sacar.
- **Token**: `META_ADS_TOKEN` en el `.env` (`lib/claves.js` CLAVES.meta, acepta 40-1000 caracteres, limpia «Bearer» y
  `?access_token=`), Ajustes › Conexiones › «Inspiración: Biblioteca de anuncios de Meta» con «Probar» y 5 pasos
  (facebook.com/ID, ads/library/api, crear app, Graph API Explorer, extender a ~60 días en el depurador de tokens).
  Opcional: no cuenta en «Faltan».
- **Botón de Chrome** (`extension-chrome/`, Manifest V3): content script solo en facebook.com/ads/library/*
  (`leer-tarjeta.js` busca el texto «Library ID / Identificador de la biblioteca», sube al contenedor con un solo ID y
  lee página, id de página, fecha «Circulando desde / Started running on», activo, copy, título, dominio, CTA, video +
  poster o imagen, «N anuncios usan este contenido»; `contenido.js` pone el botón y un aviso; solo lee al tocar, sin
  clics ni desplazamientos), `fondo.js` (service worker) hace el POST con el código, `opciones.html` (código + dirección,
  solo 127.0.0.1/localhost; «Probar conexión»). Íconos desde `app/public/kads-icono-512.png`.
- **Importar** (`lib/desde-chrome.js`, `porteroImportar` montado en `index.js` ANTES del filtro CSRF general y solo
  para `/api/inspiracion/importar`): Origin `chrome-extension://<32 a-p>` (o sin Origin), preflight CORS solo ahí
  (también Private Network), 30 pedidos/min por IP y freno con 20 códigos malos en 10 min, cuerpo ≤ 64 KB (413), código
  en `X-Kads-Codigo` comparado con `timingSafeEqual` sobre sha256 (401). Cada campo validado y recortado; medios solo
  https .fbcdn.net / facebook.com (400). Se baja enseguida (video ≤ 300 MB, imagen ≤ 25 MB, en streaming) a
  `temp/_ganadores/chrome/<id>.<ext>` (+ `<id>-p.jpg` miniatura) y se guarda en `mis_archivos/ganadores/desde-chrome.json`
  (máx. 500). El código vive en `app/.extension-chrome.json` (0600, fuera de git, y `delAlumno` lo conserva al actualizar;
  la app de prueba usa `temp/_modo-prueba-<puerto>/`). En «Desde Chrome» lo validado es una insignia (no esconde nada);
  tus marcas sí se quitan. Se puede borrar (también sus archivos). `GET /api/inspiracion/chrome/extension.zip` arma el
  zip al momento con `app/herramientas/zip.mjs`.
- **Proxy de medios** `/api/ganadores/media`: ahora también `deFacebook` (https, host que termina en `.fbcdn.net` o
  `facebook.com`/`www.facebook.com`), con `traerMedio` (redirecciones manuales, cada salto revisado; TrendTrack sigue como
  antes). Toda respuesta del proxy sale como video/imagen o `application/octet-stream`, con `nosniff` y CSP sandbox.
- `.gitignore`: `app/.extension-chrome.json`, `temp/_ganadores/chrome/`, `temp/_ganadores/meta/`. `actualizar.js`:
  `extension-chrome/` es zona del sistema. El paquete para compartir la incluye solo (va por `git ls-files`).
- **Modo prueba**: nunca se llama a Meta (respuestas simuladas con 3 páginas y medios de las muestras; uno de cada 9
  «falla» para ver «Ver en Meta»); el importar copia una muestra en lugar de bajar de Facebook.
- **Pruebas** (todas sin gastar): `vite build` OK; `probar-inspiracion.mjs` 133/133 (Graph API falso: parámetros,
  lectura, páginas con cursor, 190/4/17/613, el token nunca en la caché ni en la respuesta; snapshot falso
  `app/herramientas/datos-prueba/snapshot-meta.html`; proxy y redirecciones; importar 401 sin código y con código malo,
  403 otro origen, 413 grande, 400 host malo, 201 bien → listado → video servido → borrado; zip de la extensión);
  `probar-extension-chrome.mjs` 12/12 (Chromium de Playwright con la extensión, manifiesto de prueba que también entra
  en 127.0.0.1, `datos-prueba/biblioteca-falsa.html` con una tarjeta en español y otra en inglés: el botón aparece,
  Opciones rechaza un código malo y conecta con el bueno, los dos anuncios llegan con página, fecha, copy, dominio,
  título, CTA, creativos y medio); prueba de humo `HUMO_SIN_ANUNCIO=1` 85/85; `probar-imagen-ads.mjs` 147/147;
  capturas a 1440 y 390 px (sin errores de consola ni scroll horizontal).
- **Sin verificar (falta lo real):** un token de Meta de verdad (forma exacta de los errores de permiso, si
  `eu_total_reach` llega en anuncios comerciales y si el snapshot con `access_token` sigue entregando el JSON con
  `video_hd_url`/`original_image_url`; si no, todas las tarjetas mostrarán «Ver en Meta»), y la Biblioteca de anuncios
  real en Chrome (Facebook cambia su HTML: los selectores se apoyan en el texto visible; si algo no se lee, el aviso lo
  dice; el `<video>` podría venir como `blob:` y entonces solo se guarda la imagen/miniatura).
- **Siguiente paso:** el usuario carga la extensión en su Chrome (Inspiración › Botón de Chrome), pega su token en
  Conexiones y prueba con anuncios reales; ajustar `leer-tarjeta.js` / `extraerMediosSnapshot` con lo que se vea.

### Inspiración: solo validados y nunca tus marcas (2026-11-17, versión 2026-11-17m1)

- Pedido: «la inspiración debe ser de tiendas con creativos ya validados, no los míos». Antes el feed buscaba sin días
  mínimos y mostraba marcas propias (Vitalabh).
- `lib/ganadores.js filtrosLimpios`: `soloValidados` (por defecto true) sube `diasMin` a 30 (min_days_running en
  TrendTrack: no se pagan créditos por anuncios sin probar). La pantalla arranca con `diasMin: 30`, orden «Más alcance».
- `lib/inspiracion.js`: `esValidado` (≥ 30 días o ≥ 100.000 de alcance), `claveMarca`, `listarMisMarcas`/`agregarMiMarca`/
  `quitarMiMarca` (`mis_archivos/ganadores/mis-marcas.json`, del usuario: la marca no va en el código que se publica),
  `esDeMisMarcas` (nombre del anunciante o dominio de la landing) y `paraInspiracion` → `{ anuncios, quitados }`.
  `rutas/ganadores.js` lo aplica a buscar y a una búsqueda guardada (`recibidos` = lo que devolvió TrendTrack, para
  «Cargar más»). `POST/DELETE /api/inspiracion/mis-marcas`. Simulador: «Vitalabh» pasa a «Curvas Naturales».
- UI: «Tus marcas (no salen aquí)» en la columna izquierda, interruptor «Solo creativos validados» en Más filtros,
  días < 30 deshabilitados con él, y el resumen dice lo que dejó afuera.
- Pruebas: cuenta a mano (Vitalabh y vita-labh.co fuera, 3 días fuera, 5 días con 200.000 de alcance adentro),
  probar-inspiracion 44/44, Chromium en modo prueba (15 de 20, «no muestro 4 de tus marcas ni 1 sin validar»).

### Inspiración: los anuncios que funcionan, como en Starpop (2026-11-17, versión 2026-11-17m)

Pedido: «Necesito agregar una extensión de Inspiración así como en esta app: https://starpop.ai/inspiration» (con la
captura de Starpop › Inspiration › Meta ads). Rama `inspiracion`.

- **Decisión:** «Mejores anuncios» (#/ganadores) evolucionó a **Inspiración** (#/inspiracion, menú Crear, ícono
  bombilla). `#/ganadores` abre la misma pantalla (enlaces viejos) y `rutas.ganadores()` lleva a `/inspiracion`. Se borró
  `app/src/pantallas/ganadores/`; la pantalla nueva es `app/src/pantallas/inspiracion/` (`index.jsx`, `Tarjeta.jsx`,
  `Detalles.jsx`, `Marcas.jsx`, `datos.js`, `inspiracion.css`).
- **Servidor:** `lib/ganadores.js` sigue con la búsqueda (caché 12 h, guardados, video, «adaptar»); ahora la sesión con el
  conector es genérica (`consultarConector`: una herramienta de lectura de TrendTrack más `check_credits`, solo
  `search_ads`, `search_advertisers` y `list_tracked_brands`), lee el **total** y el **costo** que devuelve `search_ads`
  (`pagination.total`, `credits.costUnits`), el puesto (`rank`) y el alcance de 7 días, y el filtro `rango` (7/30/90 días
  → `created_after`). Nuevo `lib/inspiracion.js` + `rutas/inspiracion.js` (`/api/inspiracion/*`): formatos y sonidos,
  marcas que sigues (`mis_archivos/ganadores/marcas.json`; búsqueda de marcas en caché 7 días en `temp/_ganadores/marcas/`),
  Replicar imagen (`temp/_ganadores/imagenes/<sha1>.jpg`, servida por `/api/inspiracion/imagenes/`).
- **Formato y sonido:** (a) `clasificarPorTexto` (palabras clave en título, copy, transcripción, página y marca; UGC por
  frases de testimonio; sonido: imagen = sin audio, transcripción = voz, ♪ o una frase de 3+ palabras repetida 3+ veces =
  canción; lo demás null). (b) `clasificarConIA`: la IA elegida (`motor-ia.js` `lanzarSesion`, sin terminal, lee solo
  `temp/_ganadores/miniaturas/`, escribe un JSON en `temp/_ganadores/clasificar/`) mira las miniaturas de a 12 por sesión;
  el resultado queda para siempre en `temp/_ganadores/clasificacion.json` por id de anuncio. El formato de la IA manda; el
  sonido de la transcripción manda (la IA no escucha: solo dice voz/canción con evidencia visual). Se prende/apaga en
  «Más filtros» (por defecto prendido, recordado en el navegador). Cuesta cuota del plan de la IA, no créditos.
  Formatos → estilos de la app: Realista→realista-narrado, UGC→ugc, Animación 3D→zack-d-films, Pixar→estilo-pixar,
  Crochet, Esqueleto→skeleton, Claymation, Lego→estilo-lego; 2D, Acuarela, Pixel art y Papel no tienen estilo.
- **Replicar:** video → `bajarParaReferencia` (como «Adaptar») → `#/nuevo?inicio=1&estilo=agregar&referencia=subido:…`
  y, si el formato tiene estilo de la app (no Realista/UGC), `&pedido=` («El mismo video… en el estilo «Claymation» de la
  app…»): `pantallas/nuevo/index.jsx` lo pone una sola vez en la pregunta «pedido» de Agregar al llegar al paso 2.
  Imagen → `#/imagenes/nuevo?referencia=/api/inspiracion/imagenes/<id>.jpg` y `Formulario.jsx` la suma como referencia
  (modo Nuevos). «Analizar estructura» en Detalles **no** se hizo: el análisis que existe (clonar.js) cuesta ElevenLabs y
  IA; Replicar con Agregar ya lo hace.
- **Créditos:** costo antes de buscar (`/api/inspiracion/costo`: ~30 por 20); si la búsqueda está en caché se abre sola y
  gratis; «Cargar 20 más» solo al tocarlo (cada página es su propia entrada de caché; la caché guarda ahora 120); créditos
  restantes arriba. Buscar marcas: TrendTrack no publica su costo, la app muestra cuánto bajó el saldo.
- **Modo prueba:** nada de TrendTrack ni IA: 12 anuncios simulados con las muestras de `app/muestras/` (video e imagen
  servidos por `/archivos/muestra/…`, solo aceptados en modo prueba), 3 páginas; marcas simuladas; una «IA» simulada que
  reconoce la muestra; Replicar copia la muestra.
- **Pruebas (sin gastar):** `node app/herramientas/probar-inspiracion.mjs` (nuevo, 44/44: pasada de texto, lectura de
  search_ads y de marcas, filtros, URLs ajenas); Playwright en modo prueba 34/34 (pantalla, #/ganadores, costo, 20
  tarjetas, total, IA simulada, chips de formato/grupo/sonido, pestañas, guardar y que siga al recargar, caché gratis,
  Detalles, seguir y buscar marcas, filtrar por marca, otro orden pide buscar, Cargar más hasta 36, teléfono sin scroll
  horizontal, Replicar imagen → Anuncios de imagen con la referencia, Replicar video → Nuevo anuncio con Agregar, el pedido
  y el video, el video se reproduce en la tarjeta, sin errores); `vite build`; humo rápido 85/85; `probar-imagen-ads`
  147/147. Capturas a 1440 y 390.
- **Sin verificar (falta probar en la Mac con TrendTrack de verdad):** la forma exacta de lo que devuelven
  `search_advertisers` y `list_tracked_brands` (el lector acepta varias formas; si responde en Markdown sin JSON, la
  búsqueda de marcas da error claro); la pasada visual con Claude/ChatGPT de verdad (prompt, permisos y verificación
  hechos como en `titulos.js`, pero no corridos); que `ad_countries` vacío + dominio encuentre los anuncios de una marca.

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
