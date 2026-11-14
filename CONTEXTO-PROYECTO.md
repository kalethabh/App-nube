# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-11.

**Para la conversación nueva:** lee `AGENTS.md`, este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Regla permanente de continuidad

El usuario pidió el 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**
Al terminar cada cambio de desarrollo o decisión relevante, actualizar este archivo y subirlo a GitHub con los
cambios, siguiendo el flujo de PRs. Registrar lo terminado, los enlaces disponibles, las pruebas y sus límites,
los pendientes y el siguiente paso. Comprobar que el contexto actualizado esté en `main` antes de decir que está
publicado. La regla también está en `AGENTS.md` y `CLAUDE.md` para otros asistentes y conversaciones.

## Estado para retomar

- **Versión actual:** `2026-11-11b` (archivo `VERSION`). Las funciones descritas abajo están integradas en `main`.
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

## Últimas actualizaciones terminadas

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
