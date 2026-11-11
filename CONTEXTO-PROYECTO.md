# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-11.

**Para la conversación nueva:** lee este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Qué es

- **Repositorio:** https://github.com/kalethabh/App-nube (privado, rama `main`).
- **Qué hay dentro:** la app local **«Kads Studio by Kalethabh»** (antes «Anuncios con IA», versión 2026-11-06 de un
  curso; autor original Diego Dávila), a la que se le sumaron funciones de mi otra herramienta, **IA-VID-AUTOMATIC**
  (https://github.com/kalethabh/IA-VID-AUTOMATIC, privada).
- **En mi Mac** (M4) está clonada en `~/Anuncios con IA`. Se abre con doble clic en «Abrir Anuncios con IA.command»
  (que arranca `app/inicio/arrancar.mjs`); la app corre en http://127.0.0.1:4455.
- **Servicios:** Claude Code con mi cuenta escribe los guiones (sin clave de API); kie.ai hace imágenes, videos y
  música (Suno); ElevenLabs hace la voz y las transcripciones. Las claves van en `.env`, que nunca se sube ni se lee.
- **Otros repositorios míos que usa:** `biblioteca-anuncios` (en `mis_archivos/biblioteca/`, compartido con
  IA-VID-AUTOMATIC) y `anuncios-ia-videos` (los anuncios terminados, por producto; la app lo lee en
  `mis_archivos/.anuncios-github`).

## Cómo trabajar los cambios (lo que ya acordamos)

1. Trabajar en la rama `mejoras-de-ia-vid` (que siga a `main`).
2. Probar sin gastar: app en **modo prueba** (`PUERTO=4477 ANUNCIOS_MODO_PRUEBA=1 node app/inicio/arrancar.mjs`, con
   kie.ai y ElevenLabs simulados), capturas con Playwright y la **prueba de humo**
   (`HUMO_FORZAR=1 node app/herramientas/prueba-humo.mjs`; queda 61/64: lo único que falla es Python con `rembg` del
   servidor de prueba). Después borrar lo que dejaron las pruebas en `temp/` y `output/` (nunca mis anuncios).
3. **Autorizado: unir solo.** Abrir el PR y unirlo a `main` sin preguntarme (`gh api ... /merge` con
   `merge_method=merge`; GraphQL no funciona). Después `git pull origin main` en la rama. No forzar push.
4. En la Mac, para tener lo nuevo: botón **Actualizar** de la app (se reinicia sola; si hay algo produciéndose,
   espera a que termine).
5. La app guarda sola en GitHub cada 2 minutos (commits «Guardado automático»): por eso `temp/` en `main` trae mis
   anuncios. No los toques ni los subas desde las pruebas.

## Cómo está armada la app

- `app/server/` (Express): `lib/anuncios-nuevos.js` (estilos y guion), `lib/conductor.js` (producción paso a paso),
  `lib/familias/*.js`, `lib/claude.js` y `lib/colas.js` (sesiones de Claude Code), `rutas/*.js` (se cargan solas, en
  orden alfabético).
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

## En curso (lo siguiente que pedí)

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

Los siguientes dos pedidos siguen pendientes; esta integración no implementa una pantalla de estado de proveedores:

1. **Si un modelo falla seguido porque se cayó, ofrecerme modelos parecidos**, decir si es más caro y cuánto saldría
   (por ejemplo, para video: Omni Flash 1.1 → Kling 3.0 o Kling 4.0; precios en `produccion/config.js`,
   `MODELOS_VIDEO`), y dejarme cambiar y seguir con un clic.
2. **Un apartado «Estado de la IA»** en tiempo real: si kie.ai (y cada modelo), ElevenLabs y Claude están bien, con
   fallas o caídos, y desde cuándo. Idea: revisar cada minuto mientras la app está abierta y medir también con mis
   propias generaciones (los `log-modelos.json` de cada anuncio y los errores del conductor).

## Pendiente de confirmar en mi Mac

- Que el borrador de subtítulos en «Mejor calidad» no tarde horas (si tarda, usar «Rápido»).
- El primer sketch completo (montaje y revisión) y la sugerencia de IA al editar imágenes, con Claude de verdad.
- En kie.ai, la lista blanca de IP de mi clave tiene que estar desactivada (o con mi IP), si no, falla todo.
