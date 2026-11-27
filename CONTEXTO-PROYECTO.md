# Contexto del proyecto App-nube (para continuar en otra conversación)

Última actualización: 2026-11-27 (2026-11-26k)

**Para la conversación nueva:** lee `AGENTS.md`, este archivo y `CLAUDE.md` antes de tocar nada. Responde siempre en español
sencillo: no soy programador.

## Regla permanente de continuidad

El usuario pidió el 2026-11-11: **«Sube siempre el contexto para continuar en cualquier lado».**
Al terminar cada cambio de desarrollo o decisión relevante, actualizar este archivo y subirlo a GitHub con los
cambios, siguiendo el flujo de PRs. Registrar lo terminado, los enlaces disponibles, las pruebas y sus límites,
los pendientes y el siguiente paso. Comprobar que el contexto actualizado esté en `main` antes de decir que está
publicado. La regla también está en `AGENTS.md` y `CLAUDE.md` para otros asistentes y conversaciones.

## Borrar carpetas y generaciones (2026-11-24s)

Implementación: [PR #206](https://github.com/kalethabh/App-nube/pull/206).
Distribución: [v2026-11-24s](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24s).

La release pública r ya existía desde antes del merge de PR #206, con el paquete anterior.
Se reserva **s** con [PR #207](https://github.com/kalethabh/App-nube/pull/207) para que las copias con r detecten también el cambio; no se reemplaza silenciosamente r.

Pedido: permitir borrar carpetas o generaciones. La entrada compartida de las seis secciones de generación
ahora tiene «Borrar generación» en cada tarjeta y «Borrar carpeta» tanto fuera como dentro de la carpeta.
La carpeta agrupa referencias por producto/proyecto; borrar carpeta quita sus generaciones de la sección
(y del estilo visible, si está filtrado), no el producto ni generaciones de otras secciones.

- Modal con nombre, número y lista exacta. Cancelar no muta; cerrar está bloqueado durante la solicitud.
  Diseño comprobado en claro/oscuro y móvil, incluidos botones sin desborde.
- `POST /api/generaciones/:tipo/borrar` protegido por origen de la app. Recibe IDs explícitos + grupo;
  valida tipo, pertenencia y existencia de todos antes de mover ninguno. No descubre proyectos nuevos para
  añadirlos a una confirmación anterior. Máximo 500 proyectos por solicitud.
- Revisa cola/conductor, sesiones de guion/voz, imágenes y títulos del Embudo, Sketch, Cambiar producto,
  actividad de landing y subida a tienda. Si uno está activo se rechaza todo el alcance antes de mover.
- Usa la papelera existente `temp/_descartados/`; videos, Sketch y Cambiar producto mueven además sus
  salidas propias de `output/`. No cambia biblioteca, productos, investigación, copias guardadas o tiendas.
  No elimina páginas publicadas ni copias remotas. Recuperación manual con el mecanismo existente de papelera;
  esta entrega no incorpora una pantalla para restaurar.
- Movimientos sin esperas entre prevalidación y ejecución. Si falla el sistema de archivos a mitad, devuelve
  IDs eliminados y errores por proyecto; el modal deja solo los pendientes para reintentar. Actualiza listas.
- Validación sin gasto: fixtures reales para las seis familias, archivos en papelera, salidas propias,
  borrado conjunto y conservación de proyectos fuera del alcance; rechazo de carpetas ajenas, tipos/IDs
  inválidos y proyectos activos/desaparecidos antes de mover. Chrome en seis secciones: cancelar, error 409,
  borrado individual y de carpeta; ruta rechaza origen externo. Embudo **59/59**, incluido rechazo de borrado
  con varias secciones generándose. Compilación correcta. Humo rápido **85/86**: único fallo por Python del sistema 3.9.6, inferior al 3.10–3.13 requerido (mismo límite del equipo, sin cambios de instalación). Fallo parcial de archivo abierto probado con fixture. No se borraron proyectos reales del usuario.

## Embudo independiente, avisos y análisis visual (2026-11-24q)

Implementación: [PR #205](https://github.com/kalethabh/App-nube/pull/205).
Distribución de esta versión: [v2026-11-24q](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24q).

Pedidos de esta entrega: permitir seleccionar títulos y empezar otras secciones mientras una genera;
mejorar fondos conservando Hero 9:16 y resto 4:5; avisar landing lista y publicación confirmada; sustituir
los dos avisos de actualización por un popup central mediano con resumen; análisis de landing por sección
con captura, título y explicación. Esta sección prevalece sobre el bloqueo global anterior del Embudo.

### Generación independiente del Embudo

- El proyecto conserva `trabajos` por ID y `trabajo` como puntero compatible al más reciente. Cada trabajo
  mantiene estados, alcance, mensaje, costo y confirmación independientes. `confirmaciones` conserva la
  idempotencia de tokens anteriores; `duenos` evita que un resultado antiguo sustituya una imagen posterior.
- `activas` usa proyecto+trabajo, no solo proyecto. Hasta dos motores globales; el resto queda en cola.
  Reconciliación y retoma por trabajo. Trabajos de revisión visual anterior conservan prompt/referencias/base;
  la comprobación de retoma usa su revisión original, o versión de proyecto para encargos antiguos sin ella.
- Selecciones, textos manuales, recursos por sección y correcciones se pueden editar durante la generación.
  La entrada confirmada vive inmutable en `trabajo.json`; elegir otro título solo afecta al siguiente encargo
  y la imagen anterior se marca desactualizada. Fondo/estilo/fuente/avatar comunes esperan a que terminen las
  imágenes. Regenerar títulos no bloquea imágenes; sus opciones se añaden preservando la selección actual.
- Presupuestos por token con firma del encargo de sus secciones: cambios ajenos no los invalidan; cambiar su
  propio título, corrección, imagen de referencia, fuente, estilo o avatar sí. Cada confirmación sigue revisando
  motor/modelo/precio. No permite dos trabajos simultáneos sobre la misma sección. Se reserva avatar solo para
  Hero; las otras cotizaciones no se invalidan cuando termina de guardarse ese retrato.
- UI: selección conjunta con casillas, botones por sección, selección de textos habilitada, aviso del texto
  confirmado mientras genera, varios progresos y retoma independientes. No cambia silenciosamente un encargo
  que el usuario aprobó. Embudo registra su actividad para no reiniciar la app a mitad de un trabajo.
- Fondos: acabado editorial, capas tonales discretas, luz local y sombras interiores suaves; bordes siguen
  volviendo al mismo color base. Revisión visual **4** invalida presupuestos anteriores y marca imágenes
  anteriores para regenerar. Formatos conservados y comprobados: 1080×1920 y 1080×1350.

### Landings y notificaciones

- `lib/notificaciones.js` y `/api/notificaciones`: avisos persistentes por hito; GET no marca leído,
  POST `/:id/leer` usa la protección de origen de la app. En pruebas se guarda bajo el puerto aislado;
  en producción bajo `temp/_notificaciones/`. No envía correos, mensajes ni avisos a terceros.
- Landing lista se emite al terminar clonado/adaptación y medición. Publicada se emite después del flujo
  existente `publicarLanding`, solo con página https real y fecha de publicación; no con vista previa o
  instrucciones manuales de una tienda «solo temas». El mismo hito no se duplica al reintentar.
- `NotificacionesLanding` muestra avisos desde otras pantallas, enlace al proyecto o a página publicada y
  cierre que persiste lectura. Son avisos dentro de la app, también pendientes al volver a abrirla.
- La API Admin existente sigue fijada a 2026-07; no se cambia la mutación. Se verificó la documentación de
  [pageCreate](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/pageCreate) y la prueba con CLI/API
  simulados comprueba publicación confirmada, ausencia de aviso en vista previa y acceso solo a temas.

### Una ventana para actualizaciones

- `Actualizaciones.jsx` reemplaza las dos bandas; el botón Actualizar abre el mismo diálogo. Tamaño normal
  de 560 px, centrado y adaptable a móvil. Resumen desde CAMBIOS de la versión remota (GitHub) o notas de
  release pública; resumen local para activar/reiniciar. Nuevo `/api/actualizar/resumen` de solo lectura.
- Un solo controlador maneja instalar, esperar reinicio y recargar; se puede posponer por cambio/version.
  El reinicio pendiente permite cerrar la ventana y continuar viendo la app. No instala por abrir el popup.
  Se conservan las rutas de actualización existentes; la copia de desarrollo y la instalada eligen su vía.

### Análisis visual de landings

- `lib/landings/capturas.js` usa Chrome ya disponible con el motor del editor: capturas WebP de la copia local,
  a 412 px de ancho. Identifica títulos visibles (o imágenes si no hay encabezados), hasta 30 bloques. Captura
  antes de analizar; el modelo recibe IDs, títulos y material visual. Primeras 10 imágenes directas y resto
  disponible a pedido. Se preserva análisis de texto si el navegador o las capturas no están disponibles.
- Captura con scripts deshabilitados y solicitudes restringidas a GET de la propia copia; no accede a la API
  de la app ni ejecuta código de la tienda. No modifica el HTML clonado ni su funcionamiento interactivo.
- IDs de captura válidos y títulos reales vinculan imagen con sección; no se asigna una imagen por índice
  supuesto. Títulos repetidos sin ID inequívoco quedan sin captura. Nunca se usa una imagen de otra sección
  como relleno. Alto limitado a 3200 px por bloque; los recortes parciales se marcan explícitamente.
- El análisis conserva campos antiguos y añade explicación, hipótesis de conversión, mejora y captura.
  La UI muestra captura ampliable + título + objetivo + análisis + mejora. Análisis antiguos sin capturas
  pueden actualizarse con «Analizar otra vez». La captura corresponde a la copia al momento del análisis,
  no a cambios posteriores en la tienda externa. No se usó IA para inventar capturas.

Validación completada: Embudo **58/58** y Chrome con selección/inicio de una segunda sección mientras Hero
está activo; capturas reales de tres secciones de una página de prueba, bloqueo de scripts/API y vinculación;
notificaciones persistentes y resumen; popup GitHub/público, posponer/reabrir, reinicio, avisos y análisis visual
con temas y móvil. Shopify simulado **58/58**. Humo rápido **85/86**: único fallo por Python del sistema 3.9.6 (requiere 3.10–3.13), sin modificar instalaciones del usuario. Landings **43/44**: único fallo del entorno, FFmpeg del sistema
carece del encoder libwebp; el clon conserva PNG en ese caso. Las capturas WebP de Chrome sí funcionan.
No se hicieron generaciones de pago ni se publicó en tiendas reales. Regresión final del Embudo **58/58**
tras el acabado de fondos; capturas de interfaz revisadas (popup central y análisis por sección). La estética final del proveedor de imágenes sigue
requiriendo una generación real aprobada por el usuario dentro de la app.

## Dirección visual, fondos y caja del copy en Embudo (2026-11-24p)

Implementación: [PR #204](https://github.com/kalethabh/App-nube/pull/204).
Distribución: [v2026-11-24p](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24p).

Corrección expresa: «fondo liso» significa acorde al producto, con material gráfico sin saturar; no blanco
literal. Las imágenes deben comunicar su título y subtítulo, con fondos que se unan. Títulos siempre en
MAYÚSCULAS y subtítulos en minúsculas. Estas reglas prevalecen sobre las instrucciones anteriores de blanco
predeterminado y de fondo completamente vacío.

- `lib/embudo/direccion.js`: identidad común con base cromática suave y acento. Usa `investigacion.color`
  cuando es hexadecimal válido; sin ese dato usa categoría documentada de la ficha (no extrae colores de
  la foto ni inventa una investigación). El modelo sigue viendo el empaque real para adaptar su composición.
  No hay una llamada adicional de IA: se conserva la generación paralela con dos motores.
- Fondo automático o personalizado en el editor. La misma base se guarda inmutable en cada trabajo y se
  usa en el prompt y en los bordes normalizados. Los gráficos interiores pueden incluir curvas, trazos,
  formas suaves o diagramas que expliquen el mensaje, con pocos acentos y margen de aire. Se exige que
  terminen o se desvanezcan antes del borde, dejando la base común para unir las cinco piezas.
- Cada prompt recibe la identidad y mapa de títulos/subtítulos de las cinco secciones como contexto de
  continuidad, sin imprimir mensajes de otras secciones. Regla «MEANING BEFORE DECORATION»: visual dominante
  que comunique el mensaje específico, no frasco/modelo genérico. Antojos representa su situación; vasos
  sanguíneos/glucosa solo cuando expliquen el mensaje elegido. Beneficios usa interpretación del mensaje
  por defecto; se conserva la elección visual explícita del usuario.
- `app/compartido/texto-embudo.js` aplica la misma caja en selección y generación, preservando acentos.
  Las opciones fuente, IDs y procedencia de investigación no se alteran. Los manuales se muestran con
  caja normalizada al escribir. Se mantienen palabras, formato 9:16/4:5 y correcciones debajo de imagen.
- Revisión visual **3** en la firma de sección. Al actualizar, blanco heredado pasa a automático y un color
  no blanco heredado se considera personalizado. Se invalidan presupuestos de reglas anteriores y las
  imágenes previas se marcan pendientes de actualizar; no se generan ni cobran imágenes automáticamente.
  La migración se guarda una vez sin cambiar la fecha del proyecto para no releer la investigación en cada
  sondeo. Retomar un trabajo anterior conserva su prompt, referencias, base y formato inmutables.

Validación: integración del Embudo **47/47**, incluida migración de blanco/color personalizado e invalidación
de presupuesto anterior. Interfaz en Chrome local: selección y manuales con caja correcta, paleta automática,
corrección, confirmación/cancelación de costo, oscuro/claro y móvil sin desborde. Extracción literal, caja con
acentos, paleta por marca/categoría y prompt semántico pasan; build pasa. Se verifican dimensiones y píxel
de borde común cromático en las cinco piezas. Las imágenes son de un proveedor simulado, no una validación
estética real del modelo.
No se han pedido generaciones de pago. La coherencia gráfica y exactitud tipográfica del proveedor real se
revisan cuando el usuario decida generar desde la app. No se tocaron la instalación personal ni su Biblioteca.

## Carpetas por producto o proyecto en generación (2026-11-24o)

Implementación: [PR #203](https://github.com/kalethabh/App-nube/pull/203).
Distribución: [v2026-11-24o](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24o).

Pedido confirmado: «Sí, carpetas por producto o proyecto». Se abre primero el índice de carpetas, no el
formulario. Alcance: `/imagenes`, `/nuevo` (también un estilo concreto), `/embudo-whatsapp`, `/landings`,
`/sketch` y `/cambiar`. Investigación ya tenía su índice por producto; Biblioteca y Shopify mantienen sus
funciones propias. No se crean carpetas con nombres libres ni se mueven archivos: el usuario eligió agrupación
por producto/proyecto, no un administrador de carpetas manuales.

- `pantallas/generacion/` contiene entrada compartida, normalización de resúmenes y cuadrícula de carpetas.
  Lee las APIs existentes y agrupa por **productoId**, nunca solo por nombre. Proyectos antiguos sin vínculo
  de producto tienen su propia carpeta por identificador. Los productos homónimos no se mezclan.
- Enlaces persistentes: `?carpeta=producto:<id>` o `?carpeta=proyecto:<id>`. Dentro se listan sus generaciones
  con estado, fecha y enlace al detalle existente. Búsqueda independiente de carpetas/proyectos; al navegar
  se limpia la búsqueda anterior. Los nombres se actualizan con el catálogo de productos.
- App envuelve las seis entradas: `?crear=1` abre su formulario; detalles y enlaces antiguos con producto,
  pasos, anuncios o simulación conservan acceso directo. Un estilo en `/nuevo?estilo=...` filtra sus videos;
  continuidad también se filtra. Crear desde carpeta de imágenes/videos pasa producto; video conserva estilo.
- Sketch y Cambiar producto exponen su productoId ya guardado en la lista; Embudo añade estado de trabajo.
  Sus formularios de creación ya no repiten las listas planas de otros proyectos.
- Landings separa creación y detalle con `/landings?proyecto=<id>`, abre su vista previa y conserva medir,
  analizar, descargar, Shopify y borrar dentro del proyecto. Al crear navega a su detalle. Shopify sigue
  dedicado a conectar tiendas; los cambios en tiendas siguen en `/landings/tiendas`.
- Validación: prueba de interfaz con fixtures de las **seis secciones**, agrupación de dos proyectos del
  mismo producto, homónimos con IDs distintos, proyectos antiguos sin producto, filtro por estilo,
  búsqueda, recarga de carpeta, enlaces de creación, detalle de landing, seis formularios, temas oscuro/claro
  y móvil 390 px sin desborde, sin errores de página ni solicitudes de generación. Chrome local real con
  datos sintéticos; no se probaron generaciones de pago. Build y extracción/prompt del Embudo pasan.
  Regresión del Embudo **39/39** y su interfaz pasan entrando por las nuevas carpetas.

## Embudo continuo, generación paralela y mensajes propios (2026-11-24n)

Implementación: [PR #202](https://github.com/kalethabh/App-nube/pull/202).
Distribución prevista al cerrar esta entrega: [v2026-11-24n](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24n).

Refina el Embudo de la versión m. Estas decisiones prevalecen sobre sus detalles anteriores:
- Formato fijo por sección: Hero 9:16, resto 4:5. El motor normaliza sin recortar a 1080×1920 y
  1080×1350 con ffmpeg; banda superior/inferior de 8 px en el mismo fondo sólido configurable.
  El prompt exige márgenes seguros, fondo completamente liso, pocas piezas, tipografía sans consistente
  y continuidad entre imágenes. Vista unida sin espacios entre piezas; descargas independientes.
- Generación realmente paralela con máximo global de dos motores del Embudo. Solo Hero espera su
  retrato; el resto puede empezar de inmediato. Cada proceso usa una clave propia dentro del proyecto,
  evitando el bloqueo por anuncio del ejecutor común. ChatGPT respeta la fila compartida y pasa señal.
  Estados por pieza: en-cola/generando/lista/error; overlay en cada imagen, con imagen anterior atenuada.
  Se mantienen presupuesto exacto, versiones, idempotencia, exclusión de solicitudes inciertas y retoma.
- **No se repite el avatar en todas las imágenes.** El retrato aprobado se usa solo en Hero si su recurso
  es «Avatar del Hero»; las otras secciones usan metáfora del enfoque, anatomía educativa, producto,
  contexto u objetos, o demostración con manos. Dolor usa por defecto «Interpretar visualmente el mensaje»;
  en azúcar/circulación se pide vasos sanguíneos y glucosa, sin añadir promesas clínicas ni diagnósticos.
  Nuevo selector de recurso por sección. Hero también puede usar producto u otros recursos sin persona.
  Biblioteca sigue guardando un retrato independiente reutilizable, no la imagen publicitaria completa.
- Títulos originales se extraen literalmente como antes. Se añaden pares manuales persistentes (`extras`,
  tipo manual, origen «Escrito por ti») y `POST /api/embudos/:id/titulos` asíncrono para proponer 3 pares
  nuevos usando la IA elegida y una copia inmutable de investigación/ficha/opciones. No investiga de nuevo,
  no genera imágenes, no cambia la selección. Cada propuesta incluye base de investigación. Estado de
  preparación/error visible; bloquea cambios concurrentes, verifica versión/fuente al aceptar el resultado.
  Actualizar textos conserva manuales; propuestas de IA se conservan si la fuente no cambió, y se retiran
  de las opciones si cambió para evitar seguir usando su evidencia anterior.
- Correcciones y botón Aplicar corrección ahora van **debajo de la imagen**. Se mantienen selección de
  opciones, regeneración de una sección y confirmación de costo. Los trabajos antiguos conservan sus
  referencias/prompts de persona y aspecto originales al retomarlos, para no alterar la huella del proveedor.

Validación de esta entrega: integración del Embudo **39/39**, más interfaz en Chrome local (crear/abrir,
selección persistente, manuales y regeneración de títulos, correcciones bajo imagen, overlay de progreso,
vista unida, cancelar/confirmar costos, temas oscuro/claro y móvil 390 px sin desborde). Extracción/prompt
literal pasa; regresión de investigación Andromeda **17/17**; compilación de interfaz pasa. Se verifican
PNG 1080×1920/1080×1350, píxel de borde común y solapamiento real de dos procesos en simulación. No se han pedido generaciones reales
ni de pago. La coherencia estética y la escritura exacta del modelo requieren revisar una generación real
cuando el usuario decida hacerla desde la app. Las imágenes de las capturas son deliberadamente simuladas.
La comprobación general conserva el fallo ya conocido del equipo: Python 3.9.6 frente a 3.10–3.13; las otras
85 de 86 verificaciones pasan. No se cambiaron Python ni la instalación personal en puerto 4455.

## Embudo visual y avatares en Biblioteca (2026-11-24m)

Implementación: [PR #201](https://github.com/kalethabh/App-nube/pull/201).
Distribución: [v2026-11-24m](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24m).

Pedido: usar las cinco referencias del usuario SOLO como estructura interna, sin mostrarlas ni copiar
sus colores, posición, personas, tipografía o iconos. Secciones: Hero, Punto de dolor, Beneficios,
Ingredientes y Modo de uso. Traer títulos y subtítulos de investigación con selección de alternativas;
cada imagen con un campo de correcciones. Pedido añadido: guardar avatares en Biblioteca para reutilizarlos.

Implementado:
- `#/embudo-whatsapp` ahora abre **Embudo**, sin «Pronto»; `#/embudo-whatsapp/:id` abre un proyecto persistente.
  Es la creación de imágenes del embudo, no una automatización ni envío de mensajes a WhatsApp. Los roles
  futuros de automatización WhatsApp en la oficina siguen sin activarse.
- Estado en `temp/_embudo-e-<id>/embudo.json`, con producto, firma de fuente/foto, versión, opciones,
  elecciones, formato, dirección visual, avatar, correcciones, presupuestos e imágenes por sección.
  Los trabajos guardan entradas inmutables y resultados independientes en `trabajos/j-<id>/`.
- `lib/embudo/textos.js`: extracción determinista de pares literales desde `embudo`, bloques `opcion` de
  los apartados 14.4–14.7, guía visual y formato antiguo. Conserva TODAS las opciones distintas y su origen;
  no mezcla un título con subtítulo de otro concepto ni reescribe con una IA adicional. Si falta un par
  completo, lo marca y bloquea solo esa sección; las demás se pueden generar por separado. Ingredientes
  y uso solo usan datos de la investigación/ficha. La guía antigua suele tener cuatro mensajes: no se
  convierte su hero en una propuesta de ingredientes inventada.
- La tarea y los dos esquemas de investigación aceptan `embudo` con arrays `hero`, `dolor`, `beneficios`,
  `ingredientes`, `uso` (pares de título/subtítulo, elementos y etiqueta), sin invalidar investigaciones
  anteriores. Para futuras investigaciones es la salida explícita de copy de las cinco secciones.
- `lib/embudo/index.js` + rutas `/api/embudos`: crear/listar/editar, actualizar textos, cotizar, confirmar
  generación y descargar. Versiones y presupuesto ligado a entradas, avatar y motor; confirmación
  idempotente por token. No hay generación pagada sin presupuesto confirmado. Detecta cambios en
  investigación/ficha/foto y conserva imágenes anteriores como pendientes de actualizar.
- `produccion/generar-embudo.js`: ChatGPT o el mismo modelo/precio fijo de Anuncios de imagen en kie.ai;
  sin respaldo pagado automático. Una sección por archivo PNG, retrato separado cuando hace falta.
  Correcciones reciben producto, imagen anterior y avatar aprobado; ingredientes no lleva personas.
  El hero generado puede servir de identidad visual a las otras secciones, sin repetir su layout o texto.
- Dos motores del Embudo simultáneos como máximo y fila compartida para ChatGPT. Solicitud marcada con
  creación exclusiva en disco antes de pedir; no repite solicitudes inciertas. Resultados descargados y
  metadatos se reconcilian tras reinicio; las tareas de kie pendientes se retoman con la misma huella.
- **Avatares** (`lib/embudo/avatares.js`): por defecto prepara un retrato adulto ficticio independiente,
  sin texto ni producto, y lo guarda automáticamente como avatar `realista-narrado/protagonista` en la
  Biblioteca existente. Reutilizable en otros embudos y anuncios. Selector para un personaje existente
  (de cualquier estilo) o «Sin personas». El avatar nuevo se cotiza como una imagen adicional, antes de
  generar sus secciones; el guardado local no cuesta, y reutilizar no genera otro retrato. Se puede
  preparar otro avatar explícitamente. Deduplicación del guardado por origen de trabajo, incluso tras
  reinicio. Si falla el guardado en Biblioteca, conserva el retrato y ofrece reintentar el guardado sin
  volver a generar/pagar; mantiene la incidencia visible y bloquea nuevas cotizaciones hasta guardarlo.
- Los ejemplos adjuntos NO se copiaron al repositorio/paquete ni se muestran en la UI; solo se codificó
  su función de contenido. No se generaron imágenes reales ni se tocó la Biblioteca personal en pruebas.

Validación:
- `probar-embudo.mjs`: **30/30**, con proveedor local simulado, puerto 4495, guardia de red y Biblioteca
  aislada. Incluye costo/aprobación, duplicados, selección, cinco PNG, corrección de una sola pieza,
  conservación de versiones, cambios de investigación, recuperación de resultados y del avatar tras
  cierre, guardado en Biblioteca, URL del retrato y reutilización en otro proyecto sin retrato duplicado.
- `probar-embudo-textos.mjs`: extracción literal, deduplicación/IDs, separación de apartados, faltantes y
  construcción del prompt comprobados. `probar-investigacion-andromeda.mjs`: **17/17**.
- Chrome/Playwright: cinco secciones, diez opciones del fixture, cinco campos de corrección; persistencia
  tras recarga; cancelar costo no genera; confirmación/corrección; avatar guardado visible; claro/oscuro
  y móvil 390 px sin desborde ni errores de página. Capturas usan datos e imágenes de simulación.
- Build Vite OK; mantiene el aviso previo de clave `slug` duplicada en el editor.
- Humo rápido: **85/86** con Python de la Mac; única falla previa: Python 3.9.6, fuera del rango 3.10–3.13
  del recortador de host. Con Python 3.12 bundled: 83/86 porque ese entorno no tiene rembg/onnxruntime.
  No se instalaron ni cambiaron dependencias de Python; el Embudo usa Node y no ese recortador.

Para repetir UI: `EMBUDO_UI=1 PLAYWRIGHT_PACKAGE_PATH=<paquete playwright> PLAYWRIGHT_CHROME=<Chrome>
EMBUDO_CAPTURAS=<dir> node app/herramientas/probar-embudo.mjs`. El script pone
`ANUNCIOS_BIBLIOTECA_PRUEBA=1` SOLO en modo prueba: Biblioteca y subidas bajo el directorio de ese puerto,
sin sincronización ni acceso a la Biblioteca del usuario. La ruta de archivos respeta ese directorio;
en producción conserva las rutas habituales. Los fixtures se limpian al terminar.

Límites: no se comprobó calidad visual, fidelidad de caras ni legibilidad de una generación real con
ChatGPT/kie.ai, ni la sincronización remota real de Biblioteca. El usuario los prueba al confirmar el
costo desde su app. No es un envío/automatización WhatsApp ni publica landings/tiendas por sí solo.

## Logo, Ciudad clara y Shopify por negocios (2026-11-24l)

Implementación: [PR #200](https://github.com/kalethabh/App-nube/pull/200).
Distribución de esta versión: [v2026-11-24l](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-24l).

Pedido del usuario: mejorar el logo según la identidad de la portada oscura, conservar ese estilo como
predeterminado y hacer su versión clara; Shopify debe abrir conexiones organizadas por carpetas como
District Shop, con sus tiendas por país, sin llevar directamente a landings.

Implementado:
- `Logo.jsx` usa una única fuente SVG propia (`public/kads-icono.svg`): monograma K geométrico con degradado
  de atardecer, relieve, borde y detalle turquesa. PNG de 32/180/512 actualizados para navegador e instaladores.
- `juego` sigue siendo Ciudad oscura y predeterminada; `claro` ahora comparte composición, portada ilustrada,
  tipografía y formas, con superficies claras. Automático resuelve a `claro` o `juego`; oscuro clásico se
  conserva como opción. No se modifica el color del lienzo ni los anuncios exportados. La oficina en claro
  sigue usando su modo día. Se conserva la elección del navegador y se aplica antes de pintar.
- Shopify es centro de conexiones: carpetas persistentes, crear/renombrar/eliminar vacías, abrir negocio,
  conectar tiendas dentro de él, filtrar por país, editar/mover/desconectar. Selector con los 249 códigos de
  país, nombres en español. La carpeta es el negocio; la cuenta Shopify sigue siendo un dato independiente.
- Datos en el MISMO archivo privado de conexiones (no se leyó ni modificó el del usuario). `carpetas[]` y
  `tienda.carpetaId`; los registros antiguos sin carpeta se agrupan de forma estable por `cuenta`, sin
  alterar IDs, claves ni sesiones. La normalización se persiste con el siguiente guardado. Se valida la
  carpeta al iniciar y al completar la conexión. Borrar una carpeta con tiendas se rechaza (409).
- Nuevas rutas locales `/api/shopify/carpetas` y `/api/shopify/carpetas/:id`; operaciones de escritura con
  `soloDesdeLaApp`. `#/shopify/:carpetaId` permite abrir cada negocio directamente. Entrar a Shopify no
  carga temas/trabajos ni abre una tienda externa.
- Para conservar los trabajos, vistas previas, publicación y copias existentes, se trasladó esa interfaz a
  `#/landings/tiendas` (`TrabajosTiendas.jsx`). Acceso desde Landings → Cambios en tiendas; las entregas de
  la coordinadora enlazan allí. Los endpoints y aprobaciones de Shopify existentes se conservan.

Validación: build Vite OK (aviso preexistente de clave `slug` duplicada en el editor); prueba nueva
`probar-shopify-carpetas.mjs` **11/11**, con archivo sintético temporal, sin Shopify; regresión
`probar-shopify.mjs` **54/54** (proveedores y Shopify simulados, puerto 4496, sin gasto). Navegador Chrome:
crear y renombrar carpetas, persistencia tras recarga, mover tienda, filtrar países, eliminar carpeta vacía,
rutas separadas de Landings/Shopify, 249 países, oscuro predeterminado y claro persistido. Cinco escenarios
del script de tema previo al render correctos. Recorrido de 18 vistas (9 pantallas en ambos temas)
sin errores de página ni desborde. Capturas de escritorio y móvil (390 px) revisadas.
No se conectó ni se publicó nada en una tienda real; no se cambió la instalación personal de la Mac.


## Estado para retomar

- **SISTEMA S.E.P (2026-11-24, hecho desde Cowork):** la pantalla S.E.P ahora tiene tres pestañas: «Anuncios de Meta»
  (lo de siempre), «Objetivos y avance» y «Copiloto». Objetivos por producto (meta de pedidos/día y CPA máximo en pesos),
  corte del día en 10 segundos (pedidos reales de Lucid/iComfly + gasto de Meta) con KPIs (progreso contra la meta, CPA
  del día contra el tope, proyección de cierre con ventana 6 AM–12 AM, racha), guía horaria, barras de 14 días contra la
  meta y bitácora de decisiones. El Copiloto es un chat con la IA de Ajustes (motor-ia) que SOLO aconseja con el método
  del usuario (barrer anuncio → conjunto → campaña en 3/5/14 días, escalar duplicando y nunca +20 %, 1.2.5 y 1.5.5,
  mínimo 3 días, sin cambios después de 8 PM) y lee objetivos, avance, bitácora y el último informe de Meta en caché.
  Archivos: `app/server/lib/sep-plan.js` (nuevo), `app/server/rutas/sep.js` (rutas /api/sep/plan|objetivos|avance|
  bitacora|copiloto), `app/src/pantallas/sep/plan.jsx` y `copiloto.jsx` (nuevos), `index.jsx` (pestañas) y `sep.css`.
  Datos en `mis_archivos/sep/` (plan.json y copiloto.json), local. Probado: build de Vite OK y los endpoints en modo
  prueba (objetivos, corte con KPIs y guía, bitácora). Sin probar en vivo: el copiloto con Claude Code real.
  Pendiente posible (fase 2): llenar el corte del día solo, leyendo pedidos de iComfly (webhooks/API).

- **PUBLICAR PARA LAS COPIAS INSTALADAS (Juanquín):** el repositorio público kalethabh/kads-studio publica solo con `publicar-solo.yml` (horario cada 10 min, que GitHub a veces deja de correr por horas). Desde 2026-11-19 también arranca al subir un cambio a `PUBLICAR.txt` (o al propio workflow) en ese repositorio: una sesión de Claude con el repositorio adjunto (add_repo con push) cambia PUBLICAR.txt y hace push a main (crear releases por la API está bloqueado en las sesiones). Usa la VERSION de la app si es más nueva que la última publicada (así la etiqueta coincide); `instalar/.github` no cuenta como cambio. v2026-11-19s se publicó así. La copia del workflow vive en `instalar/.github/workflows/` (npm run publicar la sube).
- **Versión actual:** `2026-11-26k`: LOS TAMAÑOS «AL LADO» DE 26i, COMO VERSIÓN. Pedido: «NO QUIERO QUE LA ANTERIOR QUEDE AHÍ» (V01 1:1 y su 4:5 de 26i lado a lado). `server/lib/imagen-ads/tamanos-viejos.js` `fusionarTamanosViejos(carpeta)`: por cada `brief.extras[v]` (piezas aparte terminadas, de la más vieja a la más nueva) pasa la imagen de ahora de `V##_1x1` a `versiones/` (indice con `motivo/reemplazadaPor:"tamano"` y su `aspecto`), mueve la imagen y el prompt de la pieza aparte a `V##_1x1`, suma sus versiones viejas, borra finales/recortes/vista, actualiza `estado.json` (version+1, `aspecto`, firma, resultado, revisión; borra la pieza aparte) y quita `brief.extras` (lo que no terminó queda). Corre al abrir el lote (`GET /api/imagen-ads/:lote`, si no está trabajando) y al empezar `anuncios()`. Pruebas: probar-mas-y-tamanos 55/55 (caso nuevo: lote «como en 26i» → una sola imagen 4:5, la cuadrada en versiones, sin extras, abrirlo otra vez no cambia nada), imagen-ads 175/175, variaciones 110/110, editor 36/36, estructuras-propias 17/17, humo 86/86, build OK; captura en Chromium. Antes: `2026-11-26j`: TAMAÑO COMO EDICIÓN Y «COMO LAS QUE ME FUNCIONAN». Pedidos: «cuando cambie la dimensión no me la coloque al lado de la nueva, simplemente así como cuando edito algo que queda para pasar con la flechita a la anterior generación» y «debe generar no las mismas y permitirme en base a otras imágenes que están funcionando, ya sea del mismo producto u otro». TAMAÑO: `POST /api/imagen-ads/:lote/tamano {pieza, formato}` → `lotes.agregarTamano` agrega un pedido `{tipo:"tamano", pieza, formato}` a pedidos.json (ya no `brief.extras`, que se sigue leyendo en lotes viejos); `pasosDelPedido` da un paso `modo:"tamano"`; `iniciarPaso` arma la orden con `aspecto` y `aspectoAntes`; toda orden de una pieza con `est.piezas[p].aspecto` lleva `aspecto`; `aplicarResultado` lo guarda. Motor: `leerOrden` acepta `tamano`/`aspecto`/`aspectoAntes`; el aspecto efectivo (`item.aspecto || formatoDePieza`) va a kie/ChatGPT, huella y resultado; `modo:"tamano"` usa `[img actual, producto]` y `construirPromptCambioTamano` (produccion/imagen-ads.js); regenerar un cuadrado que cambió de tamaño suma `notaDeLienzo`; `anotarVersion` guarda `aspecto` de la versión reemplazada. Vista: cada pieza manda `formato` (tamaño de hoy) y cada versión el suyo; descarga con el tamaño real; TarjetaPieza y Visor usan ese tamaño; ModalRegenerar «Cambiar el tamaño de esta imagen» (chips, el actual «(ahora)»); la revisión nombra el tamaño real; el logo usa `aspectoDe`. GANADORAS: `mas.js` modo `ganadoras` (`funcionan:[ids]` de «Me funciona», 1-5, cualquier producto) copia cada imagen a `entrada/mas/M##-N.jpg`; la sesión `imagen-ads-mas` las mira y escribe las entradas sin formato_id; `unirMas` les pone `ganadora` (en orden); el generador la usa como referencia de composición (`ganadoraDe`, COPIAR_REFERENCIA); `sesionPrompts` la adjunta con «Como las que le funcionan»; `verificarMas` rechaza titulares repetidos (con el lote o entre las nuevas) en nuevos y ganadoras; ModalMas tercera pestaña con la lista de «Me funciona» (este producto primero); la vista marca «Como una que te funciona». Pruebas: probar-mas-y-tamanos 48/48 (tamaño como versión de la misma pieza, regenerar sigue en su tamaño, 4:5, ganadoras con «Me funciona», titulares sin repetir; deja «Me funciona» como estaba), imagen-ads 175/175, variaciones 110/110, estructuras-propias 17/17, editor 36/36, replicar 18/18, desde0 17/17, plantillas-referencia 34/34, agente 19/19, costo y títulos OK, carpetas OK, humo 86/86, build OK; capturas en Chromium (Visor de V02 en 9:16 con su v1 cuadrada en Versiones anteriores, ModalMas «Como las que funcionan»). Límite: con kie y la IA reales no se probó. Antes: `2026-11-26i`: OTRO TAMAÑO Y MÁS IMÁGENES EN EL LOTE. Pedido: «cuando regenere una imagen tenga la opción de regenerar a una dimensión» (respuesta: crear ese tamaño sin tocar el que existe) y «que me permita generar más imágenes en ese lote y seleccionar la cantidad» (respuesta: las dos formas, nuevos y variantes). TAMAÑOS: `brief.extras = {V03:["9:16","4:5"]}` por variación; `disco.js formatosDe(brief,v)` (FORMATOS 1:1/9:16/4:5, sufijo `4x5`); `asegurarPiezas` con extras (también en cada vuelta del bucle de anuncios); el 4:5 sale del cuadrado como el 9:16 (`construirPromptVertical(ad,{formato})`, sin zona segura), revisión en su tanda (también la simulada), `pasosDelPedido` rehace el retrato tras un cuadrado nuevo; `POST /api/imagen-ads/:lote/tamano` (costo 1, 428 sin confirmar, 409 si ya existe o el cuadrado no está) + `lotes.agregarTamano`; descarga `-4x5`; ModalRegenerar «Otro tamaño de este anuncio» (chips, ✓ los que ya tiene); Variacion/Visor muestran todos los tamaños; en lote cuadrado la tarjeta con otro tamaño ocupa 2 columnas. MÁS IMÁGENES: `server/lib/imagen-ads/mas.js` (`pedirMas` sube `brief.cantidad` y anota `brief.mas=[{id:M01,desde,hasta,modo,base?,estructuras?}]`; «nuevos» en lotes con estructuras sortea con `estructurasAlAzar(n,{excluir})`; «variantes» copia `img/<base>_1x1.png` a `entrada/variantes/<base>.png`); `POST /api/imagen-ads/:lote/mas {cantidad 1-10, modo, base?}` (costo cantidad×formatos, 409 si corre o ya hay un pedido, no en plantillas/rápido/Desde 0) y `reabrir(lote,"anuncios",{tambienPausado:true})`; al empezar `anuncios()` `prepararMas`: variantes = clon determinista con `variante_de`; nuevos = sesión `imagen-ads-mas` que escribe solo `app/imagen-ads/mas/M##.json`, verificada (`verificarMas`: esquema, formatos/ángulos, estructuras sorteadas o formatos no usados, estilo que rota, propuesta con tiempo, cuerpo) y unida a plan.json (`unirMas`); `verificarPlan` con `brief.mas` mira solo las primeras; las V nuevas quedan `prompt:"falta"` y siguen el camino de siempre. Variantes: `sesionPrompts` adjunta la base y su V.json con «Variantes de una imagen»; el generador usa la base como referencia `variante` (`VARIANTE_REFERENCIA`: mismo diseño, otra modelo/pose/escena/luz). Pantalla: «Más imágenes» junto a «Hacer otro lote», «Más como esta» en cada anuncio y en Regenerar, `ModalMas.jsx` (Anuncios nuevos / Variantes de una imagen, 1-10, costo antes); la vista marca «Variante de V02». Claude falso con la tarea `imagen-ads-mas`. Pruebas: probar-mas-y-tamanos 38/38 (nueva), imagen-ads 175/175, variaciones 110/110, estructuras-propias 17/17, editor 36/36, replicar 18/18, desde0 17/17, plantillas-referencia 34/34, agente-variaciones 19/19, costo y títulos OK, carpetas-generacion OK, humo 86/86 (HUMO_SIN_ANUNCIO=1), build OK; capturas en Chromium (Regenerar con «Otro tamaño» y «Más como esta», ModalMas nuevos/variantes, lote con V02 en 2 tamaños). Límite: con kie real el 4:5 no se probó (el simulador acepta cualquier aspecto); la sesión real `imagen-ads-mas` no se corrió con Claude/ChatGPT de verdad. Antes: `2026-11-26h`: ADJUNTOS AL REGENERAR. Pedido: «necesito poder adjuntar imágenes» (en la ventana de regenerar con instrucción). Hecho: `PUT /api/imagen-ads/:lote/adjuntos` (imagen o `?pieza=` de Mis piezas; `lotes.js` `guardarAdjunto` → `entrada/adjuntos/A####.png|jpg`, servido por PERMITIDOS); `agregarPedido` acepta `adjuntos` (≤3, `RE_ADJUNTO` de planificador.js, existentes, con instrucción obligatoria); `absorberPedidos` → `pasosDelPedido` (paso editar) → `iniciarPaso` (`p.orden.adjuntos`) → orden del generador; `produccion/generar-imagen-ads.js` los acepta en `leerOrden`, los suma a `archivos` (3.ª+) y agrega al prompt de edición «The THIRD attached image is a reference the user attached…»; `sesionAjuste` nombra los adjuntos y los pasa como imágenes; Claude falso los menciona. UI: `ModalRegenerar.jsx` (adjuntar, arrastrar, pegar, Mis piezas, quitar; botón desactivado sin instrucción). Prueba: probar-editor-imagen 36/36 (adjuntar, Mis piezas, 400 sin instrucción y con ruta inventada, versión nueva y el adjunto en el prompt). Antes: `2026-11-26g`: CADA MOMENTO, OTRO DÍA + EL ANUNCIO EN «REGENERAR». Pedidos: «todo lo que haya antes y después, progreso por día, meses, semanas… diferente en pose, ropa, peinado, escenario, iluminación, que se note que pasó el tiempo» y «cuando abra la edición por prompt, que en esa ventana flotante también aparezca el anuncio». Hecho: `cuerpo.js` `textoMomentos()` (estrategia, prompts y ajustes de lotes con estructuras y Vecinas/Conceptos) y `erroresMomentos(ad, x)` en verificarV (con persona y antes/después o progreso: ≥4 de pose/ropa/peinado/escenario/luz con 2 menciones cada una y nada de «same outfit/pose/lighting…»); se quitó «el mismo encuadre y la misma luz» de textoCuerpo y de la traducción de mv-31/mv-34; REGLAS_CONVERSION actualizada; `ModalRegenerar.jsx` muestra la imagen (`p.url`) a la izquierda (modal grande; arriba en el celular). Antes: `2026-11-26f`: TÍTULOS COMO MAYAVERRA. Pedido: «los títulos están flojos, mira cómo los coloca el drenaje: con propuesta de valor, tiempo de transformación» + «quiero que sea AGRESIVA la promesa». Hecho: `imagen-ads/titulares.js` (`textoTitulosMayaverra`: 3 niveles gancho + propuesta de valor con tiempo + línea de tiempo, fórmulas con ejemplo para glúteos/piernas; `erroresTitularesPlan`: plan.tiempo, plan.deseo_principal y plan.deseo_central, y cada variación no exenta (nativas, cartas) con `propuesta_valor` con tiempo; fórmula del usuario: PROPUESTA DE VALOR = deseo principal + tiempo de transformación + deseo central; `erroresPropuestaAnuncio`: capa «value proposition» de 8-22 palabras con tiempo salvo nativas/cartas y «garantizado»/«100 %» solo con garantía real), en estrategia/prompts/ajustes de lotes con estructuras y Vecinas/Conceptos; `REGLAS_CONVERSION` (gancho ≤7, promesa directa con tiempo, ya no «claims suaves» ni «sin garantías de resultados»); se quitaron las prohibiciones de «plazos» (sesiones, agente-variaciones.md, manual); manual §3 reescrito con la tabla de sus ganchos y propuestas; `venta.tiempo` en ajustes-producto y campo «Tiempo de transformación» en el formulario; `recordarCuerpo` también guarda `plan.tiempo`; titulos.js pide `propuesta` y textoTitulosElegidos la pasa. Antes: `2026-11-26e`: EL CUERPO DEL PRODUCTO. Pedido (con montajes reales Aguaje vs Mayaverra): «el avatar debe salir con glúteos mostrando el resultado… la del drenaje muestra pierna hinchada y la otra normal; en la del aguaje debe adaptarse para glúteos y piernas»; además el campo de sellos imprimió «AGREGAR LOGO Y SELLO DE REGISTRO INVIMA». Decisiones: no quiere logo; nativas con titular + franja; cuerpo con jean o leggins. Hecho: (1) `ajustes-producto.js`: `ZONAS_CUERPO` (con su regex en inglés y si va con ropa), `zonaDe`, `limpiarCuerpo`, `selloLimpio` (quita «agregar/poner…», «logo», «sello de»; mayúsculas) y `venta.cuerpo`; formulario con chips «Zona del cuerpo que mejora» y «Cómo se ve el resultado». (2) `imagen-ads/cuerpo.js`: `tieneCuerpo` (zona_del_cuerpo ≠ ninguna), `textoCuerpo` (estrategia y prompts), `erroresCuerpoPlan` (plan.cuerpo y zona de cada variación con cuerpo ⊂ zonas del producto), `erroresCuerpoAnuncio` (visual_prompt con la zona, el resultado y jeans/leggings si es cuerpo real); `recordarCuerpo` en familias/imagen-ads.js guarda lo que dedujo la IA; `reglasDelPlan({rotarZona})` no rota la zona si el producto tiene una sola. (3) Las 55 fichas revisadas contra su imagen (`fichas4.py`): mv-31 es antes/después en la misma foto, mv-04/08/44 sin zona, mv-52 selfie del resultado; campo `traduccion` genérico en todas; `cuidado` sin «Para Aguaje». (4) Nativas: verificarV exige titular (capa que no es oferta/sello/cta) y los sellos (ya no están exentas), sin la oferta. (5) `estructurasAlAzar`: ningún estilo en más de la mitad del lote. Pruebas: probar-variaciones-imagen (cuerpo, sellos, nativas, fichas), probar-imagen-ads 175/175. Antes: `2026-11-26d`: SOLO MAYAVERRA + SU MANUAL + TUS ESTRUCTURAS. Pedido: «mejor que sean del Mayaverra y yo también pueda agregar, mira cómo varía Mayaverra y cómo hace las cosas (su estructura, títulos, cómo venden, ganchos)». Hecho: (1) fuera las 18 fichas de otras marcas (vg/np/rv/na/xt) y sus imágenes; 35 nuevas de la tienda principal mayaverra.com (TrendTrack `search_ads` url_contains «mayaverra», página «Miniconsola», hasta 356 mil de alcance) como mv-23…mv-57 = F53…F87 (`oculta`, `marca: 'mayaverra'`, `cuidado`); total 55, script `fichas3.py` del scratchpad; se descartaron las que inventan avales (revistas, enfermera, Amazon, «disculpa oficial») y las casi iguales. (2) `estructuras/mayaverra-manual.md` (lo fijo, mezcla, titulares, cómo venden, lo que no se copia) y `mayaverra-mezcla.json`; `estructurasAlAzar` solo sortea marca mayaverra/propia con `cuposDeGanchos` (restos mayores) y orden sin estilo seguido; `textoManualMayaverra()` en estrategia y prompts (sesiones.js) y el manual a pedido. (3) `verificar.js`: en lotes con estructuras también corre `reglasDelAnuncio` estricto y la oferta tiene que ir IGUAL en todas las imágenes (si el formulario no trae oferta). (4) Tus estructuras: `propias-disco.js` (`mis_archivos/biblioteca/estructuras/{indice.json,P01.json,img/P01.jpg}`; en pruebas `temp/_modo-prueba-<p>/estructuras`), `leerSkill()` las une (se relee si cambia el índice), `rutaFicha` en estructuras.js, `comparacion.js` copia imagen y ficha al lote y escribe `entrada/estructuras/mapa.json` que usa `produccion/generar-imagen-ads.js` `estructuraDe`; `propias.js` (POST `/api/imagen-ads/estructuras` con la imagen o `?funciona=`, trabajo en memoria, sesión «TAREA: ficha de estructura», `errorDeFicha` + angulos/nativo/protagonista, DELETE solo P##); UI `MisEstructuras.jsx` en el modo «Estructuras ganadoras». Pruebas: nueva probar-estructuras-propias 17/17, probar-variaciones-imagen 83/83, probar-imagen-ads 175/175 (aPedido 114/113). Antes: `2026-11-26c`: SUPERVISOR, EDITOR Y CARPETAS EN BLOQUES. Pedido: «deja activo algo que analice la solicitud y vea los resultados… darle más detalles a las generaciones… editar las imágenes tipo Canva o con IA sin dañar la imagen… subirle sellos, logos, precios… muchísimas más imágenes ganadoras pero que no se vean, al azar… dentro de la carpeta de un producto, bloques con su imagen y un nombre (Ángulo 1), no otra carpeta… la generación de imágenes más limpia». Hecho: (1) `app/server/lib/imagen-ads/supervisor.js`: al final de cada lote (`informe()`) arma hallazgos (CRITERIOS bajo 8, problemas, sin imagen, rechazos) en `temp/<lote>/supervisor.json` y una sesión «TAREA: supervisor de anuncios de imagen» escribe 1–3 reglas en `mis_archivos/biblioteca/aprendizajes/imagen-ads.md` (líneas «- [xN] regla», dedup y contador); `textoReglasImagen()` las pega en estrategia, prompts y ajustes (`sesiones.js`); la pantalla del lote muestra `SupervisorLote.jsx`. (2) `DETALLE_VISUAL` en las tareas y `MINIMO_VISUAL = 700` en `verificar.js` (Variantes y estructuras). (3) Editor `app/src/pantallas/imagenes-editor/` (ruta `#/imagenes/<lote>/editar/<pieza>`, botón Editar en `Variacion.jsx`) + `server/lib/imagen-ads/editor.js` (guardar composición como versión; IA por zona con recorte, máscara con degradé y overlay `format=rgb`: afuera idéntico por md5; integrar pieza = pegar exacta → IA → pegar exacta; ChatGPT costo 0, kie nano-banana-2 US$0.04) y `piezas.js` (por producto `temp/_productos/<id>/piezas/`, generales `mis_archivos/biblioteca/piezas/`). Rutas en `rutas/imagen-ads.js` ANTES de `/:lote`. (4) 30 fichas nuevas F41–F70 (`oculta: true`, `cuidado`), imágenes en `mis_archivos/biblioteca/referencias/<marca>/`; `estructurasAlAzar(n,{semilla})`; `estructuras: 'azar'` en `lotes.js`; Vecinas/Conceptos con `brief.sugeridas`; formulario «Al azar (recomendado) / Elegir yo». (5) Carpetas: `generacion/Bloque.jsx` (imagen: portada/mosaico/miniatura, landing en iframe a escala, o foto del producto) con nombre editable; `server/lib/nombres-generaciones.js` (`temp/_generaciones/nombres.json`, GET `/api/generaciones/nombres`, PUT `/api/generaciones/:tipo/nombre`; al borrar se olvida). (6) `FormularioAgente.jsx` limpio (`.enc--limpio` en `oficina.css`): pestañas, producto en select con foto, segmentos, `<details>` para «Lo que me funciona» y para sellos/país del precio/prohibido. Pruebas: probar-editor-imagen 28/28, probar-variaciones-imagen (38 fichas, al azar), probar-imagen-ads (aPedido 96/95), probar-carpetas-generacion (bloques + renombrar). Pendiente: la prueba real del usuario en su app con ChatGPT (lote «Estructuras ganadoras» al azar con foto limpia del frasco) y conectar su Mac por Remote Control (no había carpeta disponible). Antes: `2026-11-26b`: ESTRUCTURAS GANADORAS EN EL GENERADOR DE IMÁGENES. Pedido: variaciones que cambien de estructura de verdad, como las de Mayaverra (drenaje linfático), probadas de verdad y comparadas con su referencia. Decisiones del usuario: las referencias van a la biblioteca privada; nada se rehace solo (se quitó el auto-rehacer de 26a); la prueba real la hace él en su app con su ChatGPT conectado. (1) Las 8 imágenes (`mis_archivos/biblioteca/referencias/mayaverra/mv-01…08.jpg`, todas bajaron) y sus fichas en `.claude/skills/anuncios-imagen-ads/estructuras/mv-XX.json`. Cada ficha lleva: zonas con %, titular, dolor_visual, zona_del_cuerpo, segmento, beneficios, prueba, oferta, cta, franja_confianza, estilo, diferencias con lo que vio el usuario, `url_origen` y un bloque `aguaje` con la traducción. Las valida `variedad.js` `errorDeFicha`. (2) Formatos F33–F40 en `formatos/indice.json` (F31/F32 ya existían), con `estructura`, `referencia`, `slug`, `estilo`, `familia`, `nativo` y `protagonista`. `imagen-ads/estructuras.js`: lista, `asegurarReferencia`, que la baja de TrendTrack si falta (en el Mac del usuario; aquí Node necesita `NODE_USE_ENV_PROXY=1`), y las rutas `GET /api/imagen-ads/estructuras` y `/estructuras/:id/imagen`. Estas rutas, como `/ventas`, van ANTES de `/api/imagen-ads/:lote`: en 26a `/ventas` quedaba tapada. (3) Generación: `ESTRUCTURA_REFERENCIA` (produccion/imagen-ads.js) y `estructuraDe`/`modoReferencia` 'estructura' (generar-imagen-ads.js). Adjunta [referencia, frasco], igual con kie que con ChatGPT. (4) Reglas (`reglasDelPlan`): una estructura distinta por imagen (`maxFormato` 1, con lotes de más de 40 ceil(n/40); `maxGanador` 1); `estilo`, `zona_del_cuerpo` y `segmento` en el plan, sin repetirse seguidos y con ≥3 estilos; la mitad de Vecinas topada por `estructurasPara(ángulo)`. Lote con `brief.estructuras` fijas (crearLote valida ids y cantidad; verificarPlan exige usarlas todas). (5) Revisión: `puntajes` (7 criterios, esquema y planificador; con alguno <8 la pieza queda «te necesita» con «No llega a 8 en: …» y su `correccion_en`) y `textoRevisionEstructuras` con la referencia copiada al lote (`copiarEstructuras`/`copiarReferenciasDe`). El paso informe arma `comparacion/V0X.jpg` (ffmpeg hstack) y `comparacion/informe.md` (`comparacion.js`); `.gitignore` deja subir esos montajes. Pantalla: `ComparacionLote.jsx` (montaje, puntajes, Pasa/Para rehacer, «Rehacer con esta corrección» = el modal de siempre). FormularioAgente: tercer modo «Estructuras ganadoras» (miniaturas, F33/F35/F36/F38 marcadas). (6) `npm run rehacer temp/_img-… --pieza V02_1x1 [--contexto | --aplicar nuevo.json] [--solo-plan | --si]` (`produccion/rehacer-imagen.js`): pide la pieza a la app abierta con su costo confirmado. Pruebas: probar-variaciones-imagen 76/76 (fichas, una estructura por imagen, estilo/zona/segmento seguidos FALLAN, prompt de estructura sin marca ni texto, lote de 4 estructuras de punta a punta con montajes, informe, PASA/REHACER, rehacer --contexto/--solo-plan/--si, rutas de la lista y la imagen), probar-imagen-ads 175/175, probar-replicar 18/18, probar-desde0 17/17, probar-plantillas-referencia 34/34, costo OK, motor 173, humo 86/86, build; capturas con Chromium de las dos pantallas. PENDIENTE (lo hace el usuario): la prueba real en su app con ChatGPT y una foto limpia del frasco de Aguaje (las del producto son una captura de video y la etiqueta plana). Lote «Estructuras ganadoras» con mv-01/03/04/06, oferta «TRATAMIENTO COMPLETO X3 $139.900», sellos «Registro INVIMA RSA-0030271-2024», «Pago contra entrega», «Envío gratis». Después, desde Claude Code: bajar main, mirar `temp/<lote>/comparacion/*.jpg` e `informe.md`, revisar cada una con los ojos, proponer los prompts corregidos (rehacer solo con su sí) y anotar lo aprendido en `mis_archivos/biblioteca/aprendizajes/imagen-ads.md`. Ojo: la etiqueta impresa parece decir otro registro («NSA-0019349-2026») que el pedido para la franja. Antes: `2026-11-26a`: ANUNCIOS DE IMAGEN QUE VENDEN: VARIACIONES DISTINTAS DE VERDAD. Pedido: en «Variantes», 10 de un ganador salían casi iguales y Meta (Andromeda) castiga lo parecido. Causa: Variantes iba por defecto por «Replicar validado» (rapido.js `variacionReplicar`, sin estrategia de IA). Decisiones del usuario: en Vecinas la mitad usa el ángulo del ganador; nombre de descarga `producto_V03-F17-ugc-selfie-transformacion.png`. (1) `brief.variacion` = fieles | vecinas | conceptos (`lotes.js`; un pedido viejo con `replicar` es fieles; sin el campo, como antes). Fieles = el camino de replicar; vecinas y conceptos = `rapido:false, fiel:false`, y `lote.json.ganador` hace que el generador pase el ganador como referencia de ESTILO (`ESTILO_REFERENCIA` en produccion/imagen-ads.js, «use the reference only for style, product and offer; do not copy its layout»). Las de `mismo_formato_que_ganador` lo usan como composición (`modoReferencia` en generar-imagen-ads.js). (2) Análisis del ganador: `imagen-ads/analisis.js` (sesión «TAREA: análisis del anuncio ganador», `analisis.json` validado por `errorDeAnalisis`). Corre en el paso estrategia antes de todo en cada lote con `variacion` (también Fieles). La pantalla lo muestra con `AnalisisGanador.jsx` (`vista.ganador`). (3) Reglas duras: `imagen-ads/variedad.js` `reglasDelPlan`, llamada desde `verificarPlan`; con 10, escaladas con `cupos(n)`. Son: máx. 2 por formato contado por `familia`, y del ganador máx. 2; conceptos, uno por familia; ≥4 ángulos con V01 = el del ganador; vecinas, el del ganador en la mitad ±1; escena/modelo/vestuario/cámara/paleta_secundaria sin repetir; ≥3 `nativo` y ≥3 `protagonista` (marcas nuevas en formatos/indice.json, más `familia`); `variables_cambiadas` ≥2; formato compatible con el ángulo. Con historial de ventas: ≥3 combinaciones nuevas y ≥1 con el formato o el ángulo ganador. `reglasDelAnuncio` en `verificarV`: oferta y sellos letra por letra (los formatos nativos pueden ir sin ellos), titular sin «¿?» y ≤8 palabras (+1 de tolerancia), ≤4 beneficios, nada de «Prohibido decir». (4) Venta por producto: `precios.js` (15 países, `normalizarOferta`, `separadoresMal`) y `ajustes-producto.js` (`temp/_productos/<id>/anuncios-imagen.json`, GET/PUT `/api/imagen-ads/ajustes/:producto`, en unir-productos). `brief.venta` va a la estrategia, los prompts y la revisión (`textoVenta`). (5) Revisión: `nota` 1-10 en el esquema y el planificador. Con `est.autoRehacer` (solo vecinas/conceptos) lo que no pasa se pide otra vez con órdenes `rev1`/`rev2` y su `correccion_en`. `costo.js` y `costo-lote.js` cuentan esas 2 por cuadrado en el máximo. Las tarjetas traen `formatoId`, `porQueVende` y `nota`, y el lote se ordena por nota (estado.js). (6) Descargas con `nombreDeDescarga` (pantalla y zip). `imagen-ads/ventas.js`: `leerNombre`, `anunciosAVentas` y `aprenderDeVentas` (sep.informe de todas las cuentas). Guarda `mis_archivos/biblioteca/aprendizajes/imagen-ads-ventas.json` y `.md`, y `historialDe` → `brief.historial`. Rutas `/api/imagen-ads/ventas` y `/ventas/aprender`; botón «Aprender de mis ventas» en la portada de Anuncios de imagen. (7) Pantallas: FormularioAgente.jsx (#/imagenes/nuevo, la que se usa): Fieles · Vecinas · Conceptos nuevos, más Oferta, País del precio, Sellos y Prohibido decir (precargados del producto). Formulario.jsx: lo mismo. Skill: SKILL.md (niveles y reglas de conversión; la oferta y los sellos del formulario SÍ van) y agente-variaciones.md. Pruebas: probar-variaciones-imagen.mjs 57/57 (reglas que fallan con formatos o ángulos repetidos, precio por país, sellos exactos, nombres, ventas; de punta a punta un lote Vecinas de 10 con el primer plan repetido que la app frena, oferta y sellos, ganador como estilo en lo enviado, rev1/rev2, nota y orden; Conceptos de 5; Fieles), probar-imagen-ads 175/175, probar-replicar 18/18, probar-plantillas-referencia 34/34, probar-desde0 17/17, probar-costo-imagen y probar-titulos-imagen OK, motor 173, humo rápido 86/86, build OK. Límites: sin generar imágenes reales (no se cobra en desarrollo) no se vio la calidad final; «Aprender de mis ventas» solo reconoce anuncios cuyo nombre en Meta sea el de descarga; la nota es la opinión de la IA, no una predicción; los formatos nativos pueden ir sin oferta ni sellos. Antes: `2026-11-25k`: AUDITORÍA REAL DE «CREAR CON EL EQUIPO» (pedido: «analiza realmente lo que hace y si hace tal cual las secciones de la landing de referencia»). Prueba de punta a punta con CAYENNE PEPPER y su investigación real: las 6 respuestas del equipo escritas a mano (`KADS_EQUIPO_DIR` en el claude falso), `crearConEquipo` en modo prueba y capturas de cada `data-seccion` de la base y la creada con Chromium. Resultado: la estructura es idéntica a la base (mismo HTML/CSS/JS, 15 secciones); quedaban: calificación 4,8/1.200 opiniones inventadas, la barra fija con el precio de CEN hasta correr el script, las negritas (`const KW`) con palabras de CEN, las promesas de la sección de profesionales («recibieron el producto», «no pagamos») sin respaldo, cantidades fijas que obligan a inventar (8 filas de costo, 5 profesionales…), el riesgo de índices corridos (pregunta en lugar de respuesta) y nadie mirando la página final. Arreglos en `plantilla.js`: paso 7 `visual`/Renata (capturas de la página con `capturas.js` + `plantillas/cen/capturas/<sección>.webp` de la base, con Read; devuelve cambios, secciones a quitar y problemas); `quitarRepetidos` (textos vacíos de Valeria quitan filas/cifras/profesionales con su chip y contador/reseñas/preguntas/puntos, mínimo 2) y `no_aplica` de Simón (secciones fuera salvo `SECCIONES_FIJAS`); Renata recibe los textos iguales a la plantilla (salvo `GENERICO`) y los desfases de pregunta/respuesta; `+XX.XXX`, `X,X` y `XX opiniones`; pendientes automáticos sobre profesionales y calificación; `#stPrice`/`#stName` estáticos; `KW` desde `negritas` de Valeria. Pruebas: probar-landings 71/71 (incluye la revisión visual con capturas reales de la app de prueba), humo rápido 86/86. Antes: `2026-11-25j`: LANDINGS CREADAS CON LA BASE COMPLETA (pedido: capturas de secciones que no salían —registro INVIMA, encuesta, médico, profesionales con filtros, reseñas con foto—, «que no se corten las imágenes», «en los testimonios, foto de perfil según el avatar del producto»; el usuario: registro y encuesta se piden al crear; los profesionales «que ChatGPT lo haga»). La base (artifact 200c3819) había cambiado: plantilla nueva desde la versión 1795616293-8d37 (`plantillas/cen/index.html` + `img/` + `docs/`), armada con un script: `#kads-fuentes`, `body{margin:0}`, galería y foto del médico sin recorte, borde a borde en celular, fuentes literales «Inter» → `--f-display`/`--f-body`, `data-seccion` en 15 secciones. `plantilla.js`: `prepararPlantilla` (sello solo con `registro`, dejando solo el número y el enlace de consulta; fuera los pies de foto y `data-ratio` de la galería); `tipoDe` (creativo, persona, profesional, registro, producto): creativos con foto + guía; personas (avatar de Emilio) y profesionales como retratos sin referencias ni textos; `RE_PROFESIONAL`/`sinNombreProfesional` (Dr./Dra./Nut. → «Nombre Apellido») y cifras de la encuesta → «XX %»; total de la comparación con el precio del trío; `recolorear` (los morados literales de CSS, `style=`, SVG y scripts pasan al tono del accent con la misma luz; texto de style/script por su nodo de texto, no `set_content`); sin comentarios de la plantilla en la página final. Pantalla: campo «Registro sanitario». Límite elegido: los nombres y opiniones de profesionales no se inventan (publicidad engañosa en salud). Pruebas: probar-landings 65/65, humo rápido 86/86; captura con Chromium de la plantilla pintada de rojo. Antes: `2026-11-25i`: LANDINGS CREADAS DE BORDE A BORDE (pedido: «las imágenes del carrusel salen con esos espacios arriba; toda la landing debe ocupar el ancho de la pantalla»; eligió solo en celular). `plantillas/cen/index.html`: `.g-main img` sin `aspect-ratio:941/1672`/`object-fit:contain`/fondo blanco (la caja fija de CEN rellenaba de blanco las imágenes cuadradas); `body{margin:0}` (se había perdido al quitar el esqueleto del artifact: toda la landing tenía 8 px del navegador); `@media (max-width:600px)`: `.g-main` y `.stack` con márgenes negativos iguales al gutter (de borde a borde) y sin redondeo. Verificado con Chromium sobre la landing del zip del usuario: a 412 px la imagen principal mide 412 de ancho desde x=0, sin franjas, sin scroll lateral; a 1280 px la columna centrada. Pruebas: probar-landings 58/58, humo rápido 86/86. Antes: `2026-11-25h`: LANDINGS CREADAS: IMÁGENES Y PRECIOS (pedido: comparar la creada para CAYENNE PEPPER —zip `landing-cayenne-pepper-1e4543`— con la base; lado a lado en Chromium: textos, paleta y tipografía bien; la imagen principal era una foto suelta cuadrada con franjas blancas en vez del creativo-infografía 9:16 de la base, y los combos decían «Precio por definir» con los tachados de la plantilla). `plantilla.js`: cada imagen de la plantilla con `ruta`, `w`×`h` y `aspecto` (`medidas` de clonar.js, `aspectoDe`); Simón y Mateo con `Read` sobre esas imágenes (`leer` de `agente`) y Mateo hace una TRADUCCIÓN ESTRUCTURAL (mismos bloques y lugar; nunca sellos/registros que el producto no tenga); al generar, el aspecto es el de la plantilla y ChatGPT recibe [foto del producto, la imagen de la plantilla en PNG (`referenciaPng`, ffmpeg) como guía de composición] con una instrucción fija de no copiar marca/producto/textos. Precios: `crearDesdePlantilla({ precios: { uno, dos, tres, antes } })` (`limpiarPrecios`, `cop`): van a Valeria/Renata como fijos y el código los pone en cada combo (`strong`, tachado = antes×n, «Ahorras») y en `OFFERS`; sin precios, «Precio por definir» y fuera los tachados y ahorros. Pantalla: los 4 campos en «Crear con el equipo». En prueba, `prueba-imagenes.json` anota aspecto y guía. Pruebas: probar-landings 58/58, humo rápido 86/86. Antes: `2026-11-25g`: LANDINGS CREADAS CON LA IDENTIDAD DEL PRODUCTO (pedido: «así la generó: debe ser para el producto, paleta de colores, tipografía y demás, con la info del producto y su investigación»; la de CAYENNE PEPPER salió con la cara de CEN). Plantilla `plantillas/cen/index.html`: todos los colores a tokens en `:root` (`--accent-hover`, `--accent-sombra`, `--tinte`, `--topbar-ink`, `--texto-2` nuevos), `h1` con `--f-display`, `<link id="kads-fuentes">`, aria-labels sin la marca. `plantilla.js`: equipo de 6 (`Q(id)`): nuevo `diseno`/Antonia (después de Simón; `kitDe` del producto y `Read` sobre su foto; `diseno.json`: paleta, fuentes de `FUENTES_DISPLAY`/`FUENTES_CUERPO`, `estilo_imagenes`), `disenoFinal` (valida hex y contraste WCAG: blanco sobre accent ≥ 4.5, fg/bg ≥ 7; lo que falte, del kit) y `aplicarDiseno` (reescribe el `:root` y el link de Google Fonts); imágenes ahora `imagenes`/Mateo con la identidad; `RE_PLANTILLA`/`sinPlantilla`: Renata recibe los textos que aún nombran Be Well/CEN/colbewell.com y el código cambia lo que quede (también los alt); las imágenes de la plantilla que no se rehicieron: la principal pasa a la foto del producto y el resto se quita (con su miniatura). Pruebas: probar-landings 55/55 (paleta del producto, contraste corregido, fuentes, sin imágenes ni marca de la plantilla), humo rápido 86/86; captura con Chromium de la plantilla pintada con rojo #A62737 + Anton. Antes: `2026-11-25f`: CREAR LANDINGS CON UN EQUIPO DE AGENTES (pedido: «toma como base esta landing para crear las landings desde 0: clonar tal cual o crear con esa landing como plantilla, usando la investigación de mercado, con más agentes que entiendan de verdad la intención de los títulos, las secciones y las imágenes»). Plantilla: `app/server/lib/landings/plantillas/cen/` (la landing Be Well CEN del artifact 200c3819, con `data-seccion` en cada bloque, e `img/`). `lib/landings/plantilla.js` `crearConEquipo`: `piezasDe` (textos por sección e imágenes por archivo con sus secciones) y 5 sesiones (`lanzarSesion`, tarea «landing equipo · <id>», cada una escribe su JSON con «resumen»): estratega/Emilio (ficha + `investigacion.aMarkdown` → estrategia.json), conversion/Simón (función de cada sección, título e imagen → intencion.json), copy/Valeria y imagenes/Antonia EN PARALELO (textos-nuevos.json con textos por índice, combos y título; imagenes-nuevas.json con prompts, `usar_foto` para el tarro), revision/Renata (revision.json: cambios, combos, prompts corregidos, pendientes). Aplica textos y combos (reescribe `const OFFERS` del script), el tarro = foto del producto (`assets/producto.*`), imágenes con ChatGPT (`generarConChatGPT`, referencia la foto). `index.js` `crearDesdePlantilla` (POST `/api/landings/crear` { productoId, prompt?, motor? }; modo `crear`, sin URL; `medir` sin original). Pantalla: «Clonar una landing / Crear con el equipo» y el panel «Cómo la armó el equipo» (`l.agentes`: estado, resumen, pendientes). Claude falso: tareas «landing equipo». La Oficina sigue mostrando a ese equipo como «Próximamente» (sin conectar). Pruebas: probar-landings 52/52 (crear sin producto 400; crear: 5 agentes con resumen, textos del producto, combos, tarro y hero), humo rápido 86/86. Antes: `2026-11-25e`: KADS SIN VENTANA DE TERMINAL EN TODOS LOS MAC (pedido: «en el Mac de Joaquín le pido actualizar pero todavía le abre la terminal»). Causa: la app sin Terminal (applet de `crear-app-mac.sh`) vivía en `instalar/`, que el paquete NO lleva (`paquete-compartir.mjs` `FUERA`), y el instalador público creaba «Kads Studio.app» con `open -a Terminal`. Ahora `app/inicio/crear-app-mac.sh` (viaja en el paquete; `instalar/crear-app-mac.sh` queda como envoltorio): espera hasta 15 min (antes 240 s) y avisa con una notificación. `Abrir Anuncios con IA.command` la rehace si la de Aplicaciones no tiene `raiz.txt` (la vieja del instalador) o la carpeta cambió. `instalar/instalar-mac.sh` paso 4: crea la app sin Terminal (respaldo: la de antes) y, al ACTUALIZAR, la abre sin Terminal; en una instalación nueva sigue abriendo la Terminal para ver el avance. Sin probar en un Mac real desde aquí (la prueba del instalador en Mac corre en kads-studio al publicar). Antes: `2026-11-25d`: KADS CON PUERTA EN VERCEL (pedido: «¿cómo hacemos para Vercel y Supabase?»; eligió el motor en el servidor gratis de Oracle). Vercel no puede correr el motor (procesos largos, archivos): queda como la PUERTA. `vercel/vercel.json` (Root Directory `vercel` en un proyecto de Vercel solo de Kads): rewrite de `/(.*)` a `https://__SERVIDOR__/$1` (el usuario pone la dirección del servidor); `vercel/LEEME.md`. `lib/servidor.js`: `KADS_PUERTA=<app>.vercel.app` suma `https://<puerta>` a `origenesPermitidos` (todos los filtros de origen lo usan). El ingreso sigue en el motor (`porteroAcceso`; cookies Secure por `x-forwarded-proto`, sin Domain, quedan en el dominio de Vercel). `deploy/instalar.sh` pregunta la dirección de Vercel (opcional) y la pone en el servicio. `DESPLEGAR-GRATIS.md` paso 7 (y los límites: Hobby es no comercial; archivos muy grandes o pedidos largos pueden fallar por Vercel: usar la dirección directa del servidor). SIN PROBAR con Vercel ni Oracle reales. Pruebas: probar-acceso 34/34 (una puerta simulada que reenvía como el rewrite), humo rápido 86/86. Antes: `2026-11-25c`: LA FLECHA DEL MENÚ (pedido: «arregla la flecha para sacar el panel de secciones»). `marco.css`: `.menu > * { flex-shrink: 0 }` (con el menú lleno, la cabecera plegada se encogía y el «+» tapaba `.menu__plegar`); en `max-width: 1000px` el menú abierto va `position: fixed` encima de la pantalla. `App.jsx`: en ventana angosta `plegado = !abiertoAngosta` (la flecha lo abre; se cierra al cambiar de pantalla); antes se forzaba plegado y la flecha no hacía nada. Probado con Chromium a 1300 y 900 px. Antes: `2026-11-25b`: KADS CON SU PROPIO SUPABASE (pedido: «Centro de Control es una cosa y la app Kads es otra, no se debe mezclar nada»). El ingreso de 2026-11-25a no cambia de código (`KADS_SUPABASE_URL`/`KADS_SUPABASE_ANON`), pero ahora apunta a un proyecto de Supabase PROPIO de Kads (`kads-studio`, plan gratis): textos de `/entrar` («tu cuenta de Kads Studio»), `deploy/supabase-kads.sql` (correrlo solo en ese proyecto), `deploy/instalar.sh` y `DESPLEGAR-GRATIS.md` (paso 1: crear el proyecto, apagar «Confirm email», correr el SQL; el dueño crea su cuenta primero en /entrar). Nunca usar el Supabase del Centro de Control para Kads. Pruebas: probar-acceso 30/30. Antes: `2026-11-25a`: INGRESO CON CUENTAS Y SERVIDOR GRATIS (pedido: analizar el documento del Centro de Control Klickshoppe —Vercel + Supabase, owner/pendiente/socio/empleado— y «usa el mismo Supabase, el servidor no lo tengo, quiero hacerlo sin pagar»). Kads no va a Vercel (procesos largos: Claude/Codex, Remotion, ffmpeg, Chrome, Shopify CLI, medios en `temp/`): va a un servidor siempre prendido (Oracle Cloud Always Free ARM, `DESPLEGAR-GRATIS.md`) con el ingreso del mismo Supabase. `lib/acceso.js` + `rutas/acceso.js`: solo con `KADS_SUPABASE_URL` y `KADS_SUPABASE_ANON` (sin ellas, la Mac, nada cambia). El servidor entra contra Supabase (`/auth/v1/token`, `/signup`, refresco) y guarda la sesión en cookies httpOnly (`kads_sesion`, `kads_refresco`); `porteroAcceso` (en `index.js`, después de `/mcp` y del portero de Chrome, antes del filtro CSRF) revisa cada pedido: `/auth/v1/user` (caché 60 s) y el rol con `kads_mi_rol()` (caché 30 s); sin sesión `/entrar` (o 401 en la API); `pendiente`/`rechazado` 403; los no dueños no CAMBIAN ajustes, claves, claude/ia, actualizar, guardado, github, conector, telegram, _nube ni tiendas/conexiones de Shopify (leer sí) ni ven `/usuarios`. Páginas del servidor `/entrar` (entrar o crear cuenta) y `/usuarios` (el dueño cambia roles); menú «Tu cuenta» (Usuarios, Salir). Supabase: `deploy/supabase-kads.sql` (una vez en el SQL Editor; NO toca las tablas del Centro de Control, cuyo repositorio no pude leer): `kads_usuarios` con RLS sin políticas y funciones security definer `kads_mi_rol` (el primero queda owner), `kads_lista_usuarios` y `kads_cambiar_rol` (solo owner; nunca el propio ni a owner); probado en Postgres 16 con un `auth` simulado. `deploy/instalar.sh`: pregunta la URL y la clave anónima de Supabase (sin ellas, contraseña de Caddy como antes), las pone en el servicio, Caddy sin basic_auth con cuentas, y abre 80/443 en el firewall de Oracle. `navegador.js` busca también `headless_shell` (Linux ARM). SIN PROBAR en Oracle ni contra el Supabase real. Pendientes: permisos por módulo y por tienda, anuncios por usuario, topes de gasto. Pruebas: probar-acceso 30/30 (Supabase falso), probar-landings 44/44, humo rápido 86/86. Antes: `2026-11-24m`: Embudo visual de cinco secciones, copy literal de investigación, selección, generación/corrección por imagen y avatares reutilizables guardados en Biblioteca. Ver sección nueva arriba.
- **Versión anterior:** `2026-11-24l`: logo vectorial nuevo; Ciudad creativa oscura predeterminada y versión clara del mismo diseño; Shopify solo conexiones, con carpetas de negocio y tiendas por país. Ver la sección nueva abajo.
- **Versión anterior:** `2026-11-24k`: LANDINGS BIEN LEÍDAS (pedido: «lo cloné de nuevo y sigue sin funcionar el selector, se queda cargando»; aurivita.co/products/cayenne-pepper-softgels-av1). Causa: node-html-parser desarma el HTML crudo cuando la tienda deja etiquetas sin cerrar (`<path ...>` sin `</path>` en sus íconos SVG): perdía `<details>`, `<summary>`, el `#menu-drawer`, el carrito…, la página quedaba sin estructura (menú y carrito sueltos, la rueda de carga gigante) y su JavaScript fallaba. `clonar.js` `comoLoLeeElNavegador(html, carpeta)`: el HTML de la tienda con sus `<script>` DORMIDOS (`type="text/kc-dormido"` + `data-kc-tipo`, y `onload/onerror` como `data-kc-on*`) se abre en el Chrome de la app desde `file://` y se toma su `--dump-dom` (bien cerrado); después cada script recupera su tipo. (`--blink-settings=scriptEnabled=false` no sirve: `--dump-dom` devuelve vacío.) El reto anti-bots se detecta de verdad (título «Just a moment…», `cf_chl_opt`), no por la palabra «captcha». `RE_RASTREO` suma bloqueadores por país (boostymark/regionblock, bm-preload-mask), Lucky Orange, Triple Pixel, TrueProfit y AppLovin. `navegador.js`: `LANDINGS_CHROME_ARGS` (opciones extra de Chrome, para probar detrás de un proxy). Probado contra la tienda real en la nube: la copia se ve igual que la original y las pestañas «Inflammation / High Blood Pressure…» cambian igual (Swiper servido desde npm porque jsdelivr está bloqueado en la nube). Pendiente menor: algunas fuentes ya copiadas se vuelven a pedir como `/products/assets/<hash>.woff2` (404 sin efecto visible). Pruebas: probar-landings 43/43 (un SVG sin cerrar no desarma la página). Antes: `2026-11-24j`: LANDINGS FIELES (QUE FUNCIONAN) Y CON PROMPT (pedido: «las cosas desplegables, la sección de dolor cuando selecciono el dolor no cambia; debe funcionar tal cual con cualquier producto. Necesito simplemente pegar la URL y un campo de texto para el prompt»). `clonar.js` `fiel` (por defecto): parte del HTML que manda la tienda (pre-JavaScript; si hay anti-bots, cae a la liviana con aviso) y DEJA sus scripts y los del page builder con su dirección absoluta (sin bajarlos: así cargan sus módulos y chunks), quita solo `RE_RASTREO` (analítica, píxeles, Shopify trekkie/web-pixels/monorail, chats, popups, cookies), no poda el CSS (`podarCss` con `{todo:true}`: solo font-display), no arma carruseles propios, no quita modales del tema (solo popups de apps, `RE_POPUP_APPS`) y el ocultador de capas solo mira lo visible dentro de la pantalla. `liviana: true` (API) es lo de antes. `trabajos.js` `subirLanding`: si la plantilla pasa de 200 KB, los scripts en línea grandes van como `assets/<sufijo>-js-N.js.liquid` en su lugar. `landings/index.js` `crear({ url, prompt, analizar, liviana })`: sin prompt, tal cual; con prompt, `adaptar` con «LO QUE PIDE EL USUARIO» (el producto se reconoce por su nombre en el prompt, `productoDelPrompt`; sin producto, sin imágenes de ChatGPT); el motor por defecto es `motorElegido()`. Coordinadora: acción `landing` con `prompt`. Pantalla: URL + «Qué quieres (opcional)» + chips de tus productos + Analizarla. Los textos dentro del JavaScript (p. ej. el contenido de cada dolor si vive en un script) no los cambia la IA. SIN PROBAR con una tienda real (la red de la sesión no llega a tiendas): probado con un navegador real sobre la tienda falsa. Pruebas: probar-landings 42/42 (fiel: scripts quedan, sin gtag/fbq, en Chromium elegir otro dolor cambia el texto; liviana; prompt con producto y sin producto), probar-shopify 54/54, probar-oficina-chat 51/51. Antes: `2026-11-24i`: LANDINGS SIN POPUPS QUE TAPAN (pedido: «que se vea bien la vista a celular y me deje usar; al abrirla tampoco puedo hacer nada»: la copia traía abierto el popup «Try your luck» de una app y, sin su JavaScript, no se cerraba). `clonar.js`: quita los popups de las apps (Klaviyo, Privy, ruletas, boletín, exit-intent…, por id/clase con `RE_POPUP`, y `[role=dialog]`, `[aria-modal]`, `dialog[open]`), saca el bloqueo del scroll de `html`/`body` (clases y estilos), agrega `html,body{overflow-y:auto;height:auto} body{position:static}` y, al cargar, el JavaScript propio oculta lo `position:fixed` que tape más del 45 % de la pantalla; lo anota en los avisos. Las landings ya clonadas se arreglan clonándolas otra vez. Pruebas: probar-landings 34/34. Antes: `2026-11-24h`: LA VISTA PREVIA ABRE LA PÁGINA QUE CAMBIÓ (pedido: «al darle a la vista previa me manda a donde se ven todos los productos, no veo la vista previa del producto»). `trabajos.js` `conPaginaQueCambio`: el enlace de vista previa de un tema (pedido a la IA y copias de partes) va a `/products/<un producto>` si cambió la plantilla o una sección del producto (`unProducto`: por la API con acceso completo o el `/products.json` público), `/collections/all`, `/cart`, `/search` o `/blogs/news` según lo que cambió (si no, la portada; queda `vistaInicio`). Landings: la vista previa ahora es `/collections/all?view=<sufijo>` con `templates/collection.<sufijo>.liquid` (en la portada, `?view=` puede no aplicarse y se veía el catálogo). Pruebas: probar-shopify 54/54. Antes: `2026-11-24g`: SHOPIFY «CON MI CUENTA» PARA TIENDAS DE CUENTAS DISTINTAS (pedido: «conectar varias tiendas aunque no sean de la misma cuenta; que el botón copie el link y yo lo pegue en el perfil de Chrome donde tengo la sesión»). La pantalla ya no abre el navegador: copia el enlace (y muestra «Copiar enlace» y el código) para pegarlo en el perfil de Chrome correcto. `api.cli` sin clave corre Shopify CLI con una carpeta de configuración PROPIA por tienda (`dirSesion(dominio)` = `app/.cache/shopify-sesiones/<dominio>`: HOME, USERPROFILE, APPDATA, LOCALAPPDATA y XDG_*), así cada tienda tiene su sesión y una cuenta no cierra la otra; `quitarTienda` borra esa sesión. `app/.cache` no se toca al actualizar. Sin probar contra Shopify real. Pruebas: probar-shopify 53/53. Antes: `2026-11-24f`: SHOPIFY «CON MI CUENTA» (un botón, sin claves). `tiendas.js` `conectarConCuenta` (POST `/api/shopify/conexiones`) corre Shopify CLI `theme list` SIN clave ni CI=1: CLI muestra el enlace de accounts.shopify.com y el código, la app los lee (`alLeer` en `api.cli`) y la pantalla abre el enlace; al aprobar en el navegador, CLI guarda su sesión, la tienda queda con `token: null` (forma «cuenta», solo temas) y `estadoConexion` (GET `/conexiones/:id`) dice «lista». `api.cli` sin clave no manda SHOPIFY_CLI_THEME_TOKEN ni CI. Pantalla: «Con mi cuenta de Shopify» es la forma por defecto (y «Acceso completo (Client ID)» para páginas y productos). SIN PROBAR contra Shopify real: el formato del enlace y del código sale de cómo lo imprime Shopify CLI; si cambia, ajustar las expresiones de `conectarConCuenta`. Pruebas: probar-shopify 53/53 (el CLI falso pide iniciar sesión y guarda la sesión). Antes: `2026-11-24e`: LANDINGS MUESTRA TUS TIENDAS (pedido: «no veo para agregar las tiendas» en Landings). La franja «Tus tiendas de Shopify» arriba de la lista (las conectadas, con bandera y cuenta) y el botón «Conectar mis tiendas / Conectar otra tienda» al menú Shopify, donde se conectan. Antes: `2026-11-24d`: LA COORDINADORA COPIA ENTRE TIENDAS POR CHAT (pedido: «que la coordinadora también pueda copiar entre tiendas por chat»). `oficina-chat.js`: acción `copiar-tienda` { origen, destinos: [ids] | "todas", que: partes | tema | producto, archivos, producto, tema } → `crearCopia` (todo queda para revisar en el menú Shopify); la acción `shopify` acepta `tiendas: [ids]` (el mismo pedido en varias, `crearTrabajos`); la coordinadora ve la cuenta y el país de cada tienda para elegirlas. Pruebas: probar-shopify 51/51 (la coordinadora copia una sección a las demás tiendas), probar-oficina-chat 51/51. Antes: `2026-11-24c`: SHOPIFY: VARIAS CUENTAS, TIENDAS POR PAÍS, VARIAS A LA VEZ Y COPIAR ENTRE TIENDAS (pedido: «conectar varias cuentas de Shopify con GPT, seleccionar la cuenta y la tienda según el país, y más de una tienda para clonar de una a otra o de una a las demás»). `tiendas.js`: cada tienda con `cuenta` (por defecto «Mi cuenta»), `pais` (ISO, leído solo con acceso completo de `shop.billingAddress.countryCodeV2`) y `moneda`; `editarTienda` (PUT `/api/shopify/tiendas/:id`). `trabajos.js`: `crearTrabajos` (POST `/trabajos` con `tiendaIds`: un trabajo por tienda, Claude Code o ChatGPT/Codex), `partesDelTema` (GET `/tiendas/:id/partes`, el tema bajado a `temp/_shopify/cache/` por 10 min), `dependencias` (de plantillas JSON: sus secciones y bloques; de Liquid: render/include/section y los assets con asset_url), `crearCopia` (POST `/api/shopify/copias` { origenId, destinos, que: tema | partes | producto, temaId, archivos, producto }, tipo `copia`, con `destinos[]` y su estado): el TEMA va como tema nuevo SIN publicar en cada destino; las PARTES se ponen sobre el tema publicado de cada destino (lo elegido siempre, lo que necesita solo si esa tienda no lo tiene: `sinPisar`) y van como tema nuevo sin publicar; el PRODUCTO (acceso completo en las dos) se lee con `products(query:"handle:…")` y se crea con `productSet` en BORRADOR (opciones, variantes, precios, imágenes; aviso si la moneda es otra). `publicarCopia`/`descartarCopia` por tienda (POST `/trabajos/:id/destinos/:tienda/publicar|descartar`: publica el tema, o el producto ACTIVE + `publishablePublish` en la tienda online; o borra). La coordinadora ve cuenta y país de cada tienda. Pantalla Shopify: filtros Cuenta y País (banderas, `datos/paises.js`), editar cuenta y país de cada tienda, al conectar la cuenta y el país, «También en» (el pedido en varias tiendas), la sección «Copiar de … a otras tiendas» y cada copia con lo de cada tienda (vista previa, editor, verlo en Shopify, publicar, descartar). Landings › Subir a Shopify: a varias tiendas a la vez. Pruebas: probar-shopify 50/50 (cuenta y país, otra cuenta en México, varias tiendas con Codex, partes con sus dependencias sin tocar el tema publicado del destino, tema completo, producto en borrador con aviso de moneda y publicarlo; un producto a una tienda solo temas se rechaza), probar-landings 33/33, humo rápido 86/86. Antes: `2026-11-24b`: LANDINGS: ANALIZAR Y SUBIR AL TEMA CON VISTA PREVIA PRIMERO (pedido: «darle al generador de landing: clonar tal cual y analizar una; que lo haga por CLI con código directamente al tema y me muestre la previsualización primero»). (1) Analizar: `lib/landings/index.js` `analizar` (la IA elegida, Claude Code o Codex, lee los textos de la página en orden y sus imágenes y escribe `analisis.json`: resumen, producto, público, ángulo, gancho, oferta, secciones en orden con su objetivo, prueba social, garantía, urgencia, CTA, objeciones, fortalezas, debilidades e ideas; `limpiarAnalisis` lo deja limpio), corre al clonar (en los dos modos, sobre la original, sin frenar la copia si falla: `analisisError`) con `analizar` (por defecto sí) y otra vez con POST `/api/landings/:id/analizar` (`analizarDeNuevo`, estado «analizando»). Pantalla: «Analizarla» (y con qué IA) al clonar, el panel «Análisis de la landing» y «Analizar / Analizar otra vez». (2) Subir a Shopify con VISTA PREVIA: `subirLanding` escribe con Shopify CLI en el tema publicado (solo archivos nuevos) `templates/page.<sufijo>.liquid` y la misma como `templates/index.<sufijo>.liquid`, y queda en estado `vista-previa` con `vistaPrevia` = `https://<tienda>/?view=<sufijo>` (se ve en su dominio y nadie la ve sin el enlace); la página se crea recién con «Publicar la página» (`publicarLanding`, por la misma ruta `/trabajos/:id/publicar`): con acceso completo queda publicada; con «solo temas», la indicación. Menú Shopify: «Ver la vista previa en tu tienda» y «Publicar la página». La coordinadora lo cuenta así. Pruebas: probar-landings 33/33 (análisis al clonar y otra vez), probar-shopify 38/38 (vista previa sin página, index.<sufijo>, publicar crea la página; solo temas), probar-oficina-chat 51/51, pantallas OK. Antes: `2026-11-24a`: TRENDTRACK SE NEGABA EN LA INVESTIGACIÓN («no pudo con TrendTrack»: cada consulta rechazada antes de salir). Claude Code nombra las herramientas de un conector de claude.ai `mcp__claude_ai_<nombre>__<herramienta>` y el permiso tiene que coincidir letra por letra: la app lo tenía fijo como «TrendTrack» y el conector del usuario se llama «Trendtrack». `lib/trendtrack-conector.js` (`SERVIDORES` con todas las formas del nombre, `TT` el de hoy, `ttTodas` para los permisos, `esTT` para reconocerla): `competencia.js` (investigación) y `ganadores.js` (Mejores anuncios / Inspiración) permiten y reconocen cualquiera; la tarea y el prompt piden el nombre nuevo y, si no aparece, buscan «trendtrack». Pruebas: probar-inspiracion 133/133, probar-investigacion-andromeda 17/17, humo rápido 86/86. Antes: `2026-11-23b`: rediseño Ciudad creativa; ver sección siguiente.
- **Versión anterior:** `2026-11-23a` (archivo `VERSION`): TEMA «JUEGO» Y OFICINA COMPACTA CON VIDRIOS (pedido: «adapta el diseño a GTA VI sin poner GTA VI, que parezca un juego; cambia la oficina, que no se vea con tanto espacio pero que se entienda, vidrios y demás»). Estilo PROPIO inspirado en ese ambiente (noche de ciudad costera, neón de atardecer), sin nombres, logos, letras ni arte de ningún juego. (1) Tema `juego` (`[data-tema='juego']` en `tokens.css`: fondos violeta noche, acento rosa #ff4fa3 con texto oscuro encima, botón con degradado de atardecer naranja→rosa→violeta, turquesa #29f0dc para lo que se mueve, estados propios) y `estilos/tema-juego.css` (importado en main.jsx): cielo de atardecer con horizonte de palmeras y edificios en silueta y la rejilla de neón del piso detrás del contenido, títulos tipo HUD (mayúsculas, cursiva, degradado), tarjetas y barra de vidrio, botón principal con esquinas cortadas, menú tipo pausa, y la oficina en rosa (sus clases `of-*`/`o3-*` con lima de marca). `datos/tema.js`: temas juego | claro | oscuro | auto; por defecto `juego`; quien tenía `oscuro` pasa UNA vez a `juego` (`kads:tema-juego`), igual en el script de `index.html`. Ajustes › Apariencia: opción «Juego» (con su muestra); el botón de arriba alterna claro ↔ juego. (2) Oficina 3D: `LUGAR` más compacto (departamentos en x ±11,6 y z 0/±9,4, 12,4×8; coordinación y sala en el centro de 8,6×6,6; la fila nueva en z 18,6), `ANCHO` 37,6, `zMin/zMax` ±14,2 (23 con la fila nueva), cámara más cerca, estanterías y plantas del centro reubicadas; cada departamento cerrado con VIDRIO de piso a techo (afuera, hacia el centro con filo de luz, y hacia el pasillo con puerta al medio). Modo `neon` (tema Juego; index.jsx le pone `key` para rearmar): `usarPaleta` pasa los neones (`MARCA.lima`, `LIMA`) a rosa y «pasa al siguiente» a turquesa (también la leyenda), cielo y ciudad violeta, piso oscuro y más brillo. Pruebas: humo rápido 86/86, probar-oficina 11/11, abrir-pantallas sin errores en todas, capturas de Inicio, Ajustes y la oficina. Antes: `2026-11-21i`: EDITAR SOLO EL AUDIO: UN ANUNCIO NARRADO PASA A CANTADO CON SUS MISMOS CLIPS (pedido: «que me deje editar cosas específicas y no todo el video; por ejemplo solo el audio: si está con voz narrada y el video de referencia es cantado, que sea cantado y que solo cambie eso»). `lib/cambiar-audio.js`: `motivoParaNoCantar` (solo voz en off terminado, con sus medios: no UGC/hablado ni continuidad), `costoDeCantar` (la canción de Suno) y `cantarAnuncio(origen, { como, voz })`: una COPIA del anuncio (`<producto>-cantado-<estilo>-<fecha>`; los medios con enlace duro, los JSON copiados porque se cambian en su lugar; sin audio/, musica/, qa/, plan de montaje ni lo de app/ salvo guion.json) con `brief.cambioDeAudio` y `familia: cambiar-audio`, y arranca su producción. `familias/cambiar-audio.js` (cargada en `ARCHIVOS_DE_FAMILIAS`; `conductor.familiaDe` y `anuncios-nuevos.familiaDe` la eligen por `brief.cambioDeAudio`): letra (las frases del manifiesto, en orden, son la letra; estilo de Suno con lo que pidió + «clear lead vocals sung in Spanish… short intro»; la voz f/m) · saldo-cancion · cancion · elegir-cancion (la pausa de siempre: `rutas/cancion.js` acepta la familia) · ajustar (recorta la intro y el final largos con ffmpeg —el de Remotion no trae `afade`: fundido con `volume`— y corre las palabras de `audio/cancion.json`; el manifiesto pasa a `modo_audio: musica`) · tiempos · montaje · render · control-final · informe, todos de `musical.js` (`PASOS_REUSABLES`). Manda el audio: cada escena dura lo que su frase cantada. GET/POST `/api/anuncios/:slug/cantar` (rutas/guion.js). Pantalla: «Editar este anuncio» ahora tiene pestañas «Solo el audio: cantado» (cómo quieres que suene, la voz, el costo) y «Otro cambio» (lo de 21h), y los atajos a lo demás puntual (una escena: «Regenerar»; textos, música, cortes: el Editor). Coordinadora: acción `cantar`. Pruebas: prueba de humo completa 248/250 con la sección nueva «Cambiar solo el audio» (13 checks: la letra son las frases, pausa para elegir, termina, modo musica con tiempos por frase, los clips son los mismos inodos, no se pagó ni imagen ni video, sale su video, el original intacto); las 2 fallas son las viejas de Anuncios de imagen. probar-oficina-chat 51/51, probar-editar 9/9, pantalla revisada con Playwright. Pendiente: otra voz hablada (mismo texto) y otra música por la misma vía; las 2 fallas viejas de la prueba de humo de imagen. Antes: `2026-11-21h`: EDITAR UN ANUNCIO MIENTRAS SE HACE O YA TERMINADO + IMÁGENES RECHAZADAS POR POLÍTICA SE REESCRIBEN SOLAS. (1) Pedido: «que me permita editar un video mientras se esté haciendo, o después de que termine (le pedí que ya no fuera cantado y me dijo que ya no)». `editarAnuncio(origen, { pedido, estilo, detener })` en `anuncios-nuevos.js` + POST `/api/anuncios/:slug/editar` (rutas/guion.js): una VERSIÓN NUEVA del mismo producto (`brief.editadoDe`, `brief.pedidoEdicion`), con las hojas de personas y lugares copiadas (`copiarHojasDe`), los mismos ajustes y voz; la tarea del guion lleva `textoEditar` (lee el manifiesto, guion.json, letras.json y la petición de la canción del original, que puede leer aunque no tenga manifiesto: `esAnuncioNuevo`) y hace SOLO ese cambio. `estiloParaEditar`: «que ya no sea cantado / narrado / voz en off» en un musical pasa a su visual (crochet, claymation o zack-d-films; la historia musical a estilo-pixar) y de cantado a narrado la letra se vuelve guion de voz en off hablado; «que se cante / jingle» en uno narrado pasa a musical; si no, el mismo (o el que elijas). Si el original se está haciendo, se detiene (`conductor.detener`; lo hecho queda). Pantalla: `EditarAnuncio.jsx` (botón «Editar este anuncio» en la cabecera de la producción, también la de los cantados sin escenas, y en la entrega; ventana con «¿Qué quieres cambiar?», el estilo y «Detener el que se está haciendo») que lleva al guion nuevo; la lista y el detalle traen `estiloApp` (el estilo de la app; en un cantado `estilo` es el visual). La coordinadora tiene la acción `editar` (nunca dice que ya no se puede). Arreglado de paso: `Recrear` (y Editar) navegaban con `ir(enlace…)` y daban «No encuentro esta pantalla»; ahora `ir(rutas…)`. (2) Pedido: «si una imagen falla por política, que la vuelva a regenerar hasta que dé: que no se quede sin generar». VIDEOS: `lib/rechazo-imagen.js` (lo de `rutas/rechazo-imagen.js` pasó ahí: `rechazadasEnLaUltimaCorrida(slug, paso)` lee el registro del paso que corrió, `sugerirDescripcion`, `guardar`) y `rescatarRechazadas`: en `conductor.correr`, si `generar-imagenes.js` o `producir.js` termina con clase `contenido`, la IA reescribe cada imagen rechazada (la misma escena sin lo que frena; desde el 3.er intento, más neutra), se guarda en el manifiesto y se vuelve a correr, hasta 4 vueltas (`app/rescates-contenido.json`); solo si ni así sale queda la tarjeta de antes. `ANUNCIOS_SIN_RESCATE_CONTENIDO=1` lo apaga. ANUNCIOS DE IMAGEN: `planificador.aplicarResultado` pone el cuadrado rechazado por contenido (primera imagen) en fase `reescribiendo` (en pantalla «ajustando»); `familias/imagen-ads.js` `reescribirRechazada` (sesión `imagen-ads-rechazo`: edita SOLO lo que se ve del `<V>.json`, los textos iguales; el rechazado queda en `<V>.rechazado-<n>.json`) y `terminarRescate` lo pide otra vez con orden propia `g-r<n>` (el motor recuerda pieza|orden), hasta `RESCATES_POR_CONTENIDO` = 3; sirve en todos los modos (rápido, replicar, variaciones). Pruebas: el kie simulado y el motor falso rechazan los prompts con la marca `SIM-PROHIBIDO`, y las IA falsas la quitan. Pruebas: prueba de humo completa 235/237 con `HUMO_POLITICA=1` (la toma 2 rechazada se reescribió sola y el video terminó; las 2 fallas de Anuncios de imagen —«nada se rehace solo…» y «Copiar prompt…»— salen igual SIN estos cambios: ya estaban), probar-imagen-ads 175/175 (nuevo: 7c y el rescate en el planificador), produccion/pruebas/probar-imagen-ads 173, `probar-editar.mjs` 9/9 (nuevo) + Playwright (la ventana y el paso al guion nuevo), probar-despues 8/8, probar-oficina-chat 51/51, humo rápido 86/86. Pendiente: mirar esas 2 fallas viejas de la prueba de humo de Anuncios de imagen. Antes: `2026-11-21g`: «TERMINAR DESPUÉS» (pedido: «si quiero terminar después un video en progreso, que me salga continuar o terminar después, y no se mantenga la alerta de que me necesita»). `lib/para-despues.js` + `rutas/para-despues.js` (POST/DELETE `/api/anuncios/:slug/despues`, solo desde la app): guarda `temp/<slug>/app/despues.json` ({ fecha }); `despues.json` entra en `ARCHIVOS_DEL_RESUMEN` y el resumen trae `paraDespues` (fecha o null; también en GET /api/anuncios). Se borra solo apenas lo vuelves a tocar: `conductor.continuar` e `iniciarProduccion`, y `reintentarGuion`, `aprobarGuion` y `pedirCambios` llaman `retomar(slug)`, así que si se vuelve a frenar te avisa de nuevo. `useEnProduccion` saca lo pospuesto de `necesitan` y `guiones` y lo pone en `paraDespues` (la píldora roja, el menú, Inicio y el tablero ya no lo cuentan); la oficina (`oficina.js`, `oficina-produccion.js`: estado «pausado», `paraDespues`) tampoco. Tablero: botón «Terminar después» en cada tarjeta de «Te necesitan» (`BotonDespues` en `TeNecesitan.jsx`, también en los guiones por aprobar y en «elegir la canción») y la sección nueva «Para después» (`ParaDespues.jsx`: «Continuar», o «Ver el guion», y la campana «Volver a avisarme»). En la producción, la tarjeta del alto trae «Terminar después» (`despues` en `Lateral.jsx`) y, ya pospuesto, sale en ámbar «Lo dejaste para después» con «Continuar». `refrescar(prefijo)` en `datos/api.js`: invalida y avisa (evento `kads:refrescar`) para que cada pantalla abierta con esa clave la pida ya. Pruebas: `probar-despues.mjs` 8/8 (nuevo: posponer, la oficina deja de contarlos, seguridad, volver a avisar y continuar lo saca), Playwright (la píldora baja al instante, «Continuar» desde «Para después», celular), probar-oficina 11/11, probar-oficina-produccion 10/10, humo rápido 86/86. Antes: `2026-11-21f`: CALIDAD AL DETALLE + CARPETAS DE PRODUCTO. (1) Calidad (pedido: «imágenes de escena muy bien hechas, el diseño del producto tal cual, coherencia entre escenas, minucioso en lo visual y el audio»; el usuario eligió «Corregir sola»): en voz en off, con `brief.correccionImagenes` (los anuncios nuevos; `ANUNCIOS_SIN_CORRECCION_IMAGENES=1` lo apaga, y la prueba de humo lo apaga salvo con `HUMO_CORRECCION=1`), el paso `imagenes-y-videos` genera PRIMERO solo las imágenes, corre la revisión de la IA (`sesionDeRevision`, la misma de antes, ahora extraída) y `revisionPrevia` aplica sus prompts (rehacer-toma --aplicar) y rehace UNA vez esas imágenes antes de pagar los videos; lo que no salió queda como aviso en «Revisar las imágenes», cuya nota dice cuántas se corrigieron. La revisión mira además `DEFECTOS_DE_CALIDAD` (el producto letra por letra contra la foto, la coherencia entre escenas: misma persona, ropa, set, luz y hora, y los detalles: ojos, piel, manos, producto mal apoyado); UGC suma eso a sus defectos de clips (y con varias personas: quién habla, la voz). `estimar-costo.js`: parte `correcciones` = hasta 30 % de las imágenes de las tomas al precio medio (solo con `correccionImagenes` y en voz-en-off). `tarea-guion.md`: bloque «Calidad al detalle en los prompts» (descripción fija del producto con el texto de la etiqueta letra por letra en cada prompt donde se ve, personas y lugares con descripción fija palabra por palabra, un instante bien descrito por imagen, el tono de cada línea y voces fijas). (2) Carpetas (pedido: «carpetas de producto con imágenes y videos; guardar desde Anuncios de imagen; descargar la carpeta»): `lib/carpetas.js` + `rutas/carpetas.js` (temp/_carpetas/<id>/{carpeta.json, imagenes/, videos/}; los medios en .gitignore), crear/renombrar/borrar, subir archivos (van solos a imágenes o videos, sin pisar nombres), `guardarDesde` (imagen de un lote: final/ o img/; video de output/, con enlace duro si se puede), quitar, y el zip «<Nombre>/imagenes/…» y «<Nombre>/videos/…». Pantalla `#/carpetas` (menú Tu contenido › Carpetas) y `#/carpetas/<id>` (pestañas, arrastrar y soltar, descargar uno o todo). Componente `GuardarEnCarpeta` (menú con las carpetas y «Nueva carpeta») en cada imagen de un lote y en la entrega de un video. Pruebas: prueba de humo completa 207/207 (camino de siempre) y 135/135 con `HUMO_CORRECCION=1` (la toma 2 marcada se rehízo ANTES de su video), costos 175/175 y modelos 509/509, probar-agregar 35/35, `probar-carpetas.mjs` 16/16 (nuevo), pantallas OK; unidad-reglas-material 235/236 y unidad-falso 112/113 (las dos fallas ya estaban). Antes: `2026-11-21e`: NUEVO ANUNCIO, UN PASO POR PÁGINA. Pedido: «mejora el diseño del proceso de generar videos: que no todo esté en una sola página con scroll, sino una página por proceso, sencillo». `pantallas/nuevo/index.jsx`: 4 pasos (`PASOS`: 1 Tu producto · 2 Estilo · 3 Ajustes · 4 Guion; la producción sigue en su pantalla). La URL: `paso=estilo|ajustes|guion` (`PASO_URL`); el `paso=2` de antes (todos los enlaces de la app, la barra lateral, Te necesitan, la oficina y el chat) va al guion si trae `anuncios`, si no al estilo. `IndicadorPasos` sin el bloque «Después, sola» y con `puede` (Ajustes con un estilo elegido, Guion con un guion); en celular solo los números y el nombre del paso actual. `guardarAnuncios` pasa solo al paso 4 al escribir. `PasoAnuncio.jsx` con `etapa`: 2 = solo la galería; 3 = las tarjetas de ajustes + la tarjeta «Escribir el guion» (`Escribir`, ahora exportada de Guiones.jsx); 4 = `Guiones` (leer, pedir cambios, «Me gusta, producir»). Cada página con `BarraDelPaso` (abajo, fija: volver / siguiente). Se quitó la píldora de desplazamiento. Probado en Playwright: producto → estilo → ajustes → escribir → pasa solo al guion; el enlace viejo abre el guion; escritorio y celular; pantallas 21/21, humo 86/86. Antes: `2026-11-21d`: VARIACIONES EN EL CHAT CON SEMÁFORO. Pedido: «si le subo una imagen (mi anuncio ganador) y le pido variaciones, que las haga ella, como un chat, sin pasar por la sesión de imágenes (que se guarden ahí, pero sin usar ese proceso); cada imagen con 🟢/🔴 para que entienda cuáles hizo bien y cuáles no quiero otra vez; las buenas las tiene en cuenta (estructura, titulares enganchadores, la modelo, detalles) sin copiarlas; los titulares juegan con el ganador sin perder su esencia; el antes y después que se note; sin demorarse». `oficina-chat.js loteDeImagenes`: con referencia y `variaciones: [{ titular, cambio }]` (las escribe ella en la acción `imagenes`, más `indicaciones`) el lote va en modo RÁPIDO (sin estrategia, sin el agente, sin «Replicar»), `brief.origen = "chat"`, `variacionesChat`, `indicacionesChat`, `leccionesChat`; la acción lleva `enChat: true`. `rapido.js`: cada V##.json con el titular de su variación, «WHAT CHANGES IN THIS VARIATION», la regla del titular que juega con el ganador y del antes y después que se nota, lo que pidió y las lecciones; `app_chat.cambio`. `lib/oficina-votos.js`: `votar({ lote, pieza, voto: bien|mal|nada, motivo })` guarda en `temp/_oficina/votos-imagenes.json` (copia la imagen en `temp/_oficina/votos/<id>.png`, con titular y cambio); `votosDelLote`; `leccionesParaLaCoordinadora` (las 8 buenas y 8 malas, este producto primero, con la ruta para que las mire con Read: permiso `Read(./temp/_oficina/votos/**)`) va en su contexto; `leccionesParaElModelo` (titulares aprobados y lo rechazado) va al prompt de la imagen. Rutas: `GET /api/oficina/imagenes/:lote/votos`, `POST /api/oficina/imagenes/voto`. `Chat.jsx ImagenesDelChat`: bajo el mensaje, las imágenes del lote (se van mostrando a medida que salen, sondeo cada 4 s) con 👍/👎; el 👎 pide el motivo (opcional); borde verde/rojo. El costo sigue igual (si cuesta, «¿Le doy?» y «Dale»; con ChatGPT gratis, arranca solo). Pruebas: oficina-chat 51/51 (5 nuevas), imagen-ads 168/168, replicar 18/18, telegram 13/13, humo 86/86, pantallas 21/21 y Playwright del chat con las imágenes y el semáforo. Antes: `2026-11-21c`: «AGREGAR» TAL CUAL CON VARIAS PERSONAS QUE HABLAN. Problema (video de ejemplo: programa de citas con presentadora, la protagonista y 5 hombres con globos; todos hablan en cámara): «Agregar» solo conocía UGC = UNA persona a cámara o voz en off, así que un video con varias personas que hablan se hacía con narrador y B-roll inventado. Arreglo: skill `anuncios-agregar` Paso 4 con la «regla de oro» (si en el original hablan personas en cámara, en el tuyo también; nunca voz en off ni B-roll o escenas que el original no tiene) y la sección «Escenas habladas, tal cual» (una referencia `personaje` por persona que vuelve, un bloque R por toma, cada línea la dice quien la dice con `"habla"`, tramos mudos con `"linea": null` para las acciones como explotar el globo, máx. 7 referencias por bloque y la imagen de su escena (`prompt_imagen_inicial` + `"imagen"`) en los planos abiertos con muchas personas, la voz de cada persona fija en LANGUAGE / VOICE, duración condensada si la piden). El formato del plan sigue siendo `"ugc"` (la producción por bloques ya soporta varias personas: `habla` en el validador y la imagen de cada escena de 19n). Textos de la app: la tarea del plan (regla de oro), la opción del formulario «Las personas hablan en cámara» (acepta el texto viejo), el resumen del plan, los personajes del guion; la coordinadora agrega «sin voz en off, mismas escenas» al pedido. Probado con el validador real: un manifiesto de 2 bloques con 3 personas, tramo mudo del globo y la imagen del set → válido. Pruebas: probar-agregar 35/35, oficina-chat 46/46, humo 86/86, pantallas 21/21. No probado produciendo el video real (sin kie aquí). Antes: `2026-11-21b`: LA COORDINADORA CLONA UN VIDEO TAL CUAL. Pedido: «cuando le diga que replique tal cual un video o lo clone, que no lo haga en base a los estilos que ya tenemos, sino de ese video, misma estructura». `oficina-chat.js`: la acción `crear-anuncio` ahora acepta `estilo: "agregar"` (solo con `video`): `respuestas.clonar = subido:<id>|<nombre>` (como la pantalla), `respuestas.pedido` = lo que pidió (o «el mismo video, tal cual…»); título «Igual a tu video de …». Su tarea dice: si pide replicarlo tal cual, clonarlo o «igual a este» SIN nombrar un estilo → «agregar» (mismo look y estructura del video, sin más preguntas); si nombra un estilo, ese estilo con el video. Claude falso: sin «zack» en el pedido, «agregar». Pruebas: oficina-chat 46/46 (1 nueva), probar-agregar 35/35, humo 86/86. Antes: `2026-11-21a`: MODO NUEVO DESDE 0 + REGLAS GLOBALES + LA COORDINADORA COORDINA TODO. Especificación del usuario: 6 zonas (Z1 gancho 15-20 % arriba, mayúsculas, máx. 8 palabras; Z2 visual 45-55 %; Z3 2-3 bullets con check, máx. 5 palabras; Z4 frasco fiel, ≥15 %, con sello «3 EN 1 · TRIPLE ACCIÓN»; Z5 oferta «TRATAMIENTO COMPLETO X3 $[precio]» + «Pagas al recibir», siempre; Z6 un CTA corto), fórmula de titulares (afirmativos, BENEFICIO + TIEMPO + DESEO, 6 plantillas, máx. 1 pregunta por lote), 8 formatos (hero, antes/después, nosotros vs. ellos, testimonio UGC, pregunta y respuesta, bodegón de ingredientes, nota/recomendado, regalo/temporada; máx. 3 iguales, PyR máx. 1) y reglas globales (español colombiano sencillo, poco texto, ninguna modelo ni escenario repetido, claims suaves, marca y etiqueta exactas letra por letra, margen del 5 %). `imagen-ads/desde0.js`: `repartoDeFormatos(n, { conIngredientes, semilla })` (bodegón solo con ≥2 ingredientes en la ficha; temporada al final fuera de nov-ene y mayo); `escribirPlan` (sesión de la IA «TAREA: anuncios nuevos desde cero» → `entrada/plan-desde0.json` { anuncios: [{ formato, titular, plantilla_titular, beneficios, sello, cta, emocion, cita, respuesta, comparacion, ingredientes, ocasion }] }); `errorDePlan` (8 palabras, 2-3 beneficios de ≤5, CTA de la lista `CTAS`, una sola pregunta, claims prohibidos `PROHIBIDO`: curar, garantía, 100 %, milagro, eliminar, sin efectos secundarios, probado médicamente, INVIMA/FDA, kilos; cifras que no están en la ficha, la investigación o la oferta); `ofertaDe` (el precio de la oferta del usuario o de la ficha; nunca se inventa); `prepararDesde0` → producto/estrategia/plan (fuente «biblioteca» con `formato_id` de la skill más parecido y `angulo_id`) y cada V##.json (`variacionDesde0`: estructura del formato, modelo/escenario/pose de `replicar.variedad`, `text_layers` Z1…Z6 y los del formato, `app_desde0`). `lotes.js`: `desde0: true` (no con el agente ni plantillas) → `brief.desde0 = { formatos }`, `rapido: false` (SÍ pasa la revisión de la IA). `estado.js`: con `desde0` todos los V empiezan listos (no hay paso de prompts). `familias/imagen-ads.js estrategia`: plan → preparar → verificar. `produccion/imagen-ads.js`: bloque `DESDE0` con las 6 zonas y las reglas globales; `RAPIDO_REPLICAR` suma las reglas globales (marca exacta, 5 %). `sesiones.js sesionRevision`: con desde0 o replicar, la revisión rechaza marca/etiqueta no exactas (letra por letra), texto a menos del 5 % del borde, claims o cifras nuevas, y lo propio de cada modo. Mapa de Replicar: titulares en español colombiano y claims suaves. Pantalla «Crear anuncios de imagen › Desde la investigación»: chips «Desde 0 (6 zonas)» (por defecto) / «Variaciones del agente». Coordinadora: la acción `imagenes` lleva `modo` (con referencia «replicar» por defecto, sin referencia «desde0», «agente» solo si lo pide); acciones nuevas `landing` (clonar, tal cual o adaptada) y `subir-landing` (a una tienda de Shopify); ve sus landings y sus tiendas. Pruebas: `probar-desde0.mjs` 17/17 (nuevo), probar-replicar 18/18, imagen-ads 168/168, plantillas-referencia 34/34, agente-variaciones 19/19, oficina-chat 45/45 (actualizada: con referencia va «Replicar validado»), telegram 13/13, landings 31/31, shopify 35/35, humo 86/86, pantallas 21/21. No probado con el modelo de imagen real. Antes: `2026-11-21`: MODO REPLICAR VALIDADO (pedido del usuario con su especificación: mapa de zonas, jerarquía, tipografía y paleta, ángulo; lo único que varía es modelo, escenario, pose/encuadre y la redacción del titular, sin repetir modelo ni escenario en el lote; prohibido mover bloques, cambiar fuentes, paleta o ángulo, o inventar claims). `imagen-ads/replicar.js`: `analizarReferencias` (una sesión de la IA elegida por referencia, «TAREA: mapa de la referencia validada», Read de la imagen o `materialKads({ imagenes })` para Codex) → `entrada/mapa-R0k.json` { zonas { titular, modelo, producto, beneficios, oferta_cta, otros }, jerarquia, tipografia_paleta { fuentes, colores, fondos_de_bloques }, angulo { deseo, beneficio, dolor }, titular_original, textos [{ zona, texto }] (tal cual si es del mismo producto; si es de otro, el mismo significado sin agregar nada), titulares [N] }; `errorDeMapa` exige todo, titulares distintos, no iguales al original y del mismo largo ±2 palabras (en `verificar`). `variedad(n, semilla)`: modelo (edad, contextura, tono de piel, pelo), escenario (12: cuarto, espejo, calle, gym en casa, probador, piscina…) y pose/encuadre, sin repetir modelo ni escenario (ni el par con más de 12). `titularesPorReferencia`. `rapido.js`: con `brief.replicar` (solo «Variantes»), modo `replicar` y `variacionReplicar` (V##.json con el mapa, la combinación en `app_replicar` y los textos como `text_layers`, `app_rapido: 'replicar'`). `produccion/imagen-ads.js RAPIDO_REPLICAR`: clon exacto de la composición, solo cambia lo dicho, prohibiciones explícitas, frasco del producto en la misma zona. `familias/imagen-ads.js estrategia`: si faltan mapas, los pide antes de `prepararRapido` (límite → `errorDeLimite`; sin IA → mensaje para conectarla). `lotes.js`: `replicar: true` y `rapido: true` con `modo: variantes` y `replicar: true` (no con el agente). Pantallas: «Crear anuncios de imagen» (FormularioAgente, «Con referencia»): chips «Replicar validado (exacto)» (por defecto) / «Variaciones del agente»; el formulario clásico de Variantes tiene el interruptor «Replicar validado (exacto)» (por defecto activo, pide la IA). Claude falso: caso «mapa de la referencia validada». Pruebas: `probar-replicar.mjs` 18/18 (nuevo), probar-imagen-ads 168/168, plantillas-referencia 34/34, agente-variaciones 19/19, funciona-subir 9/9, humo 86/86, pantallas 21/21. No probado con el modelo de imagen real (cuánto respeta el mapa depende de él). Antes: `2026-11-20v`: ARREGLO DE «ACTUALIZAR». En 20u (#171) se publicaron por error `temp/_oficina/aprendido.json`, `chat.json` y `registro/chat.log` (restos de la prueba en el navegador de «pegar», que corrió la app de prueba sobre la carpeta de trabajo). La Mac guarda su propio `temp/_oficina` en su rama (`correcciones-revision`, guardado automático), así que `git pull origin main` daba conflicto add/add y «Actualizar» decía «Lo nuevo choca…» (con `merge --abort`: nada se tocó). Arreglo: se quitan esos 3 archivos de main (`git rm --cached`); como la base común con la Mac no los tenía, el merge queda limpio y la Mac conserva los suyos (simulado con un worktree de `origin/correcciones-revision`). Lección: al publicar, no agregar `temp/` (usar `git add -A -- . ':!temp'`) y no correr la app de prueba sobre la carpeta de trabajo sin PRUEBA_LIMPIO/carpeta aparte. Antes: `2026-11-20u`: PEGAR EN EL CHAT DE LA COORDINADORA. Pedido: «que en el chat con la coordinadora me permita pegar». El chat ya aceptaba archivos pegados, pero el texto se cortaba en 2000 caracteres (un prompt o documento largo llegaba recortado) y las imágenes que el navegador da solo como `clipboardData.items` (una captura, una imagen copiada de una página) no entraban. `pantallas/oficina/Chat.jsx pegar()`: archivos de `files` o de `items` (kind file; las sin nombre se llaman `pegado-<n>.png`); un texto de más de `LARGO_PEGADO` = 1500 caracteres, o que ya no cabe en `LARGO_MENSAJE` = 2000, va como documento adjunto `.md` (nombre con su primera línea), entero, con un aviso; también se puede pegar con el foco en cualquier parte del panel. Sirve igual en la burbuja flotante (AvisoCoordinadora usa el mismo Chat). `telegram.js`: un texto de más de 2000 caracteres llega como documento `texto-de-telegram.md`. Pruebas: Playwright (pegar un prompt de 10.000 caracteres → documento; pegar una imagen como item → adjunto; enviar → la coordinadora recibe documento e imagen; sin errores), probar-telegram 13/13 (1 nueva), oficina-chat 45/45, humo 86/86. Antes: `2026-11-20t`: CATÁLOGO DE REFERENCIAS COMO GUÍA INTERNA. Pedido: «el catálogo de imágenes de referencia para anuncios, aplícalo para lo que ya está sin mostrar las imágenes». `imagen-ads/lotes.js prepararValidados`: además de «Me funciona» y la biblioteca, suma hasta `MAX_CATALOGO` = 4 plantillas de `app/plantillas-referencia/` (`plantillasRef.elegir` con `temasDeProducto`: las de productos relacionados primero y de familias distintas) como `origen: 'catalogo'` { plantilla, nombre, familia, titular, relacionada }; lo del usuario va primero pero siempre quedan esos lugares (total MAX_VALIDADOS 8). Aplica a todo «Nuevos» sin plantillas elegidas: desde la investigación, el agente de variaciones sin referencia y las imágenes que encarga la coordinadora (no a «Variantes», que copia tus referencias). `sesiones.js textoValidados`: la IA las ve como «anuncio GANADOR de la categoría, del catálogo interno… la fórmula de su titular…; el usuario no la ve», para aprender cómo comunican el ángulo sin copiar la composición; en el modo rápido van al modelo como inspiración (`rapido.js referenciasDelLote`). No se muestran en ninguna pantalla del lote (el selector «Con plantillas de anuncios validados» del formulario sigue igual). Pruebas: probar-plantillas-referencia 34/34 (4 nuevas), probar-imagen-ads 168/168, agente-variaciones 19/19, oficina-chat 45/45, humo 86/86. Antes: `2026-11-20s`: CHATGPT BUSINESS. El usuario compró ChatGPT Business (tiene su espacio de trabajo) y la app seguía diciendo que no le quedaba uso. Causas: (1) `sinUsoOrdinario` frenaba con `ordinaryUsageAllowed: false`, y en los planes de espacio de trabajo el uso de Codex sale de los créditos del espacio; (2) el plan viaja en el token guardado y la app nunca pedía uno nuevo, así que seguía viendo el plan de antes. Arreglo en `codex-app-server.js`: `esPlanDeEspacio(plan)` (team, business, self_serve_business*, enterprise, ent*, edu, sci): en esos planes solo frena `rateLimitReachedType` (incluye `workspace_*_credits_depleted` y `workspace_*_usage_limit_reached`) o sin créditos del espacio y con la ventana al 100 %; los planes personales siguen igual (no gastan créditos comprados). `normalizarLimites` guarda `creditos { hay, ilimitados, saldo }`. `refrescarCuenta({ fuerza })` = `account/read { refreshToken: true }` + rateLimits (máx. cada 2 min; `olvidarRefresco()` al iniciar o cerrar sesión). La cuenta trae `espacio` (`workspaceName`). `codex.js`: antes de decir «sin uso» pide un token nuevo y vuelve a mirar; si ChatGPT responde «tu plan no incluye Codex» (planSinCodex), una vez: token nuevo y el mismo mensaje otra vez; `estadoCodex` refresca si el plan es free/go o está sin uso; mensajes nuevos `espacioSinCreditos` y `espacioLimite`. Ajustes › Conexiones muestra «plan Business en el espacio «…»» y explica que, si no aparece, se cierra sesión y se entra eligiendo el espacio. Codex falso: `FALSO_CODEX_PLAN_VIEJO` (el token dice el plan viejo hasta un refreshToken) y `FALSO_CODEX_CREDITOS=espacio`. Pruebas: unidad-codex 134/134 (4 nuevas), unidad-falso 112/113 (la que falla, «cada tarea-*.md tiene su entrada», ya fallaba antes; con AWS_* en el entorno de esta máquina fallan 10 más que no son del cambio), humo 86/86, pantallas 21/21. Confirmado con el esquema de Codex 0.167.0 (`app-server generate-json-schema`): `account/read` acepta refreshToken y devuelve workspaceName; rateLimits trae credits. No probado con la cuenta Business real del usuario. Antes: `2026-11-20r`: SHOPIFY CON VARIAS TIENDAS (menú Tu contenido › Shopify, `pantallas/shopify/`, `rutas/shopify.js`, `lib/shopify/`). `tiendas.js`: tiendas en `<raíz>/.env.shopify.json` (permisos 600; en .gitignore; `actualizar.js` lo respeta por el patrón `.env.*`; nunca sale por la API: `publica()` quita token, clientId, clientSecret y vence). Tres formas: Client ID + secreto de una app del Dev Dashboard (lo recomendado: desde el 1-ene-2026 Shopify no deja crear apps propias con token fijo; client credentials grant en `/admin/oauth/access_token`, el token dura ~24 h y `renovar()` lo pide de nuevo si vence en <10 min; solo sirve si la app y la tienda son de la misma organización), token `shpat_` (apps viejas) o `shptka_` (Theme Access, solo temas). `api.js`: Shopify CLI `@shopify/cli@5.0.1` instalado solo la primera vez en `app/.cache/shopify-cli` y corrido con el Node de la app (sin shell); la clave va en `SHOPIFY_CLI_THEME_TOKEN`, nunca en argv; `temas`, `bajarTema`, `subirTema` (nuevo sin publicar o encima de uno con `--only --nodelete`), `publicarTema`, `borrarTema`; GraphQL de administración versión 2026-07 (`admin`), `subirArchivo` (videos a Files con stagedUploads). `trabajos.js` (temp/_shopify/trabajos/<id>/): «Pídele a la IA» baja el tema, la IA elegida (Claude Code con Read/Edit/Write en esa carpeta; Codex con los archivos más relacionados pegados y el resto a pedido) edita el código y escribe resumen.json {resumen, admin[]}; verificar() revisa los JSON; la app sube el tema como NUEVO SIN PUBLICAR (vista previa y editor) y el usuario lo publica o lo descarta; las operaciones de la API que proponga quedan pendientes hasta «Aplicar». «Subir a Shopify» (botón en cada landing): plantilla `templates/page.kads-<id>.liquid` ({% layout none %}, `{{`/`{%` escapados, imágenes a assets con asset_url, CSS aparte si pasa 200 KB) en el tema publicado solo con archivos nuevos; enlaces a la tienda original pasan a relativos, con producto elegido van a ese producto y su variante; videos a Files (o el GIF original sin acceso completo, por `data-kc-origen` que ahora pone clonar.js); con acceso completo crea la página publicada. Coordinadora: ve las tiendas y tiene la acción `shopify` {tienda, pedido, motor}. Pruebas: `probar-shopify.mjs` 35/35 (Shopify CLI simulado `server/claude/pruebas/shopify-cli-falso.js`, una carpeta por tienda, y la API simulada: conectar 3 tiendas, renovar el token, editar el tema, aplicar, publicar, descartar, subir landing, coordinadora), probar-landings 31/31, oficina-chat 45/45, telegram 12/12, humo 86/86, pantallas 21/21. La CLI real se instaló y corrió aquí (sin tienda real: no hay red a Shopify ni cuenta). No probado contra una tienda de verdad. Antes: `2026-11-20q`: LANDINGS (menú Crear › Landings, `pantallas/landings/`, `rutas/landings.js`, `lib/landings/`). Pegas una URL; modo «Tal cual» (lo hace el CÓDIGO, sin IA, así no hay rechazos por copiar) o «Para mi producto» (la IA elegida en el selector, Claude Code o Codex vía `lanzarSesion({ motor })` —`motor-ia.js` acepta ahora `o.motor`— reescribe los textos con la ficha y la investigación: `nuevos-textos.json` {índice: texto} y `nuevas-imagenes.json` [{id, prompt, aspecto}] máx. 8; las imágenes las hace ChatGPT con `generarConChatGPT` y la foto 1 del producto). `navegador.js`: Chrome sin ventana (el de Remotion, CHROME_PATH o el instalado) con `--dump-dom --virtual-time-budget` para el HTML ya armado por su JavaScript. `clonar.js`: quita scripts (menos JSON-LD), preloads, iframes ocultos y banners de Shopify; junta el CSS (link/style/@import), fuentes locales con font-display:swap; imágenes locales (Shopify CDN en WebP a 240/480/800/1200 con srcset; otras >30 KB a WebP; GIF >60 KB a mp4 en <video>), width/height, la primera grande con fetchpriority=high + preload y el resto lazy; carruseles (Swiper/Slick/Flickity/Splide/Glide/Owl) sin clones, con clase kc-carrusel y ~1 KB de JS de flechas y puntos; enlaces y formularios absolutos a la tienda original; mide en el navegador a 412 y 1366 px qué selectores se usan y el ancho real de cada imagen (`sizes`) y poda el CSS con eso (esbuild lo minifica, va en línea). `medir.js`: Lighthouse móvil con `npx -y lighthouse@12.6.0` (en modo prueba simula 95/62 salvo LANDINGS_LIGHTHOUSE). Guardado en `temp/_landings/<id>/` (landing.json, index.html, assets/; original.html y assets/ en .gitignore). Vista en `/landing/<id>/…` con gzip (bloquea landing.json, original, registro y archivos de la IA), zip en `/api/landings/<id>/descargar`. Medido con la landing de referencia (Amua Vitaldrops, Shopify): original 68 → copia 97 en Lighthouse móvil (FCP 0,9 s, LCP 2,4 s, 624 KB), casi idéntica a la vista; lo que se pierde: el aviso de ventas por JS («Carolina compró») y la barra fija que aparece con el scroll. Pruebas: `probar-landings.mjs` 31/31 (tienda falsa local: tal cual, adaptar con el Claude falso, vista, zip, medir, borrar), humo 86/86, abrir-pantallas 20/20, build. No probado: Codex real ni ChatGPT real para las imágenes (sin cuentas aquí). Pendiente pedido: conectar Shopify CLI con varias tiendas (editar el tema, subir la landing). Antes: `2026-11-20p`: TELEGRAM + AUTOEVALUACIÓN. `lib/telegram.js`: bot propio (clave `telegram` = `TELEGRAM_BOT_TOKEN` en claves.js, formato `\d+:…`, prueba con getMe), long polling `getUpdates` (timeout 8 s, bucle `arrancar()` mientras `activo`; arranca solo 3 s después del inicio si estaba prendido, no en `ANUNCIOS_PRUEBA_LIMPIO`), estado en `temp/_telegram/config.json` { activo, codigo, chatId, chatNombre, offset, ultimoVisto, botones }. Vincular: `/start <código>` (o el código solo); otros chats → «privado». Texto → `oficina-chat.enviar`; voz/audio → getFile + `transcribirVoz`; foto/documento/video (≤ 20 MB) → `subirAdjunto` + enviar con adjuntos; 409 → «dame un segundo». `reenviarLoNuevo`: cada mensaje nuevo de la coordinadora (con acciones y entrega) va a Telegram y cada `pendiente` una vez con botón inline `dale:<id>` → callback → enviar «Dale, apruébalo y produce…». Rutas `rutas/telegram.js` (GET/PUT /api/telegram, POST /codigo, /desvincular); Ajustes › Telegram (`ajustes/Telegram.jsx`). Pruebas: TELEGRAM_API_BASE + TELEGRAM_TOKEN_PRUEBA. Autoevaluación: prompt de la coordinadora pide `entrega.criterios` (interés, claridad, credibilidad, valor, conversación, narrativa) y reescribir si el promedio < 8.5; `notaDe()` → `entrega.nota`/`criterios` (Chat.jsx muestra la nota); guiones: `TEXTO_AUTOEVALUACION` al final de la tarea del guion (sin archivo nuevo, solo mejora antes de terminar). .gitignore `temp/_telegram/`. Pruebas: probar-telegram 12/12 (Telegram simulado), probar-oficina-chat 45/45, probar-agregar 35/35, humo 86/86, pantallas 20/20. Límite: no probado con Telegram real ni con la IA real calificándose. Antes: `2026-11-20o`: OFICINA CON PERSONAJES REALES, CIUDAD Y «PRESENTAR». Personajes: `app/public/oficina/personajes/*.glb` (10 del Ultimate Animated Character Pack de Quaternius, CC0; CREDITOS.txt; copia de github.com/Yametech12/ghostname-3d-assets), cargados con GLTFLoader + SkeletonUtils.clone por agente (`MODELOS` por género, `numeroDe(id)`), escala 0,78, pose `SitDown` fijada al final y guardada en `p.q.base` (cada cuadro: `quaternion = base * offset`; NO acumular: Torso no tiene pista y se doblaba), piel recoloreada (material `Skin` viene casi negro) con `PIELES`; la cadera se lleva al asiento (x silla, y 0,6, z silla − 0,12, más cerca del teclado); mientras carga queda el muñeco de piezas (se esconde al cargar). Posturas: `POSES` (giros de UpperArm/LowerArm calculados con el modelo para teclado, mouse, barbilla, celular, taza, estirarse, nuca, gesto, cabeza, victoria, reloj), `gestoDe(enEst, t, fase, id)` (trabajo/revisión/error/espera/rutinas de libre) y `posturaDeHuesos` (+ tecleo, Head, Torso inclinado al trabajar); celular y taza en `FistR`/`FistL`. Ciudad: `ciudad(ANCHO, zMin, zMax)` (cajas fusionadas con textura de ventanas y `emissiveMap` de luces; de noche emisivo 0,9), persianas en los muros, `lamparaColgante` cada dos estaciones. «Presentar»: vista `presentar` (Hud: botón; index: cierra paneles, `of--presentando` esconde HUD/minimapa/actividad/lateral, `TarjetaEscena`), `armarPresentacion()` (general, coordinadora, por departamento: toma del departamento + primer plano de su 2.º agente, cierre), `avanzarPresentacion(dt)` (cámara interpolada; en primer plano la cámara se calcula delante de la cara con el giro final `GIRO_SALUDO` = 2,4 y el agente pasa a `saludo`: gira la silla, levanta la cabeza y saluda), `minDistance` 0,5 y `maxPolarAngle` 1,55 solo mientras presenta; `onEscena`/`onFinPresentacion`; `raiz.__o3.irAToma(k)` congela una toma (solo pruebas). .gitignore: `temp/_sep/`, `temp/_oficina/adjuntos/`, `temp/_oficina/investigaciones/`. Pruebas: oficina 11/11, producción 10/10, humo 86/86, pantallas 20/20, capturas (personajes sentados, posturas, ciudad de día y de noche, tomas de Presentar con el saludo de frente). Límite: el modelo es estilo «low poly» (no hiperreal); el dibujado en el Mac no se midió (35 personajes con esqueleto). Antes: `2026-11-20n`: el intervalo de `seguimiento()` (oficina-chat.js) no corre en las apps de prueba de las herramientas (`ANUNCIOS_PRUEBA_LIMPIO=1`) salvo con `OFICINA_SEGUIMIENTO_MS` (probar-oficina-chat lo pone): probar-agregar dejaba un encargo adoptado en `temp/_oficina/chat.json`. probar-oficina-chat 44/44. Antes: `2026-11-20m`: CANTADOS CON VIDEO DE REFERENCIA. oficina-chat.js `letraDelVideo(meta)`: ffmpeg (comprobarFfmpeg) → mp3 16 kHz → ElevenLabs Scribe `scribe_v1`; guarda `temp/_oficina/adjuntos/<id>/transcripcion.txt` (no se paga dos veces); modo prueba: texto fijo. En `crear-anuncio` con `video`: los de `faseGuion: 'letras'` (musical, historias-musicales) NO llevan `respuestas.clonar` (clonar no aplica a cantados) y exigen la letra (si no hay, error claro); los demás clonan como antes; todos mandan `letraOriginal`. anuncios-nuevos.js: `crearAnuncio` guarda `brief.letraOriginal` (≤ 8000) y `textoPedido` agrega «La letra / Lo que se dice del video original» con la regla: si pidió copiar tal cual, OPCIÓN 1 = letra palabra por palabra cambiando solo producto/marca (letras.json exige ≥ 2 opciones); si no, base de estructura. Prompt de la coordinadora: los cantados también funcionan con video y son animados. Pruebas: probar-oficina-chat 44/44 (musical con video: letraOriginal sin clonar, transcripción guardada, la tarea del guion con la letra y OPCIÓN 1), probar-agregar 35/35, humo 86/86. Límite: la transcripción real de un video cantado no se probó aquí (sin ElevenLabs). Antes: `2026-11-20l`: S.E.P POR BM, CUENTA O CAMPAÑA. lib/sep.js: `cuentas()` pide `business{id,name}` de cada cuenta y devuelve `bms` (agrupadas; las sin BM en `sin-bm`, al final) con memo de 10 min por token; `campanas({ cuenta, rango })` (insights `level=campaign`, con gasto, por compras); `informe({ alcance: 'bm'|'cuenta'|'campana', bm, cuenta, campana, … })`: BM = `deMeta` de cada cuenta del BM de a 3 a la vez, juntas, ordenadas por compras (top 80), cada anuncio con `cuenta`, `cuentaNombre` y `moneda`; campaña = insights filtrados por `campaign.id` EQUAL; valida que el BM/cuenta sea del token (400 si no); con monedas distintas `moneda: null`, `mezclaDeMonedas`, totales de dinero y serie de dinero en null. Rutas: `GET /api/sep/campanas`, `GET /api/sep/informe?alcance=&bm=&cuenta=&campana=`. Pantalla: segmento «Ver» (BM completo · Cuenta publicitaria · Campaña), selects de BM, cuenta (filtrada por BM) y campaña; aviso de monedas; tarjetas/tabla con la cuenta en modo BM y el dinero en la moneda de cada anuncio; preferencias en `sep:preferencias`. Simulado: 2 cuentas en «BM Kads» y una sin BM. Pruebas: probar-sep 30/30 (BM agrupado, campañas, filtro por campaña, BM junto con 2 monedas, BM/cuenta ajenos 400), pantallas 20/20, humo 86/86, capturas 1440 y 390 px. Antes: `2026-11-20k`: S.E.P CON META. `lib/sep.js` (API de Marketing v21.0, solo lectura; token `META_MARKETING_TOKEN` o, si falta, `META_ADS_TOKEN`; clave nueva `metaAds` en claves.js con su prueba `/me/adaccounts`, y `ClaveMetaAds` + ayuda de 3 pasos en Ajustes › Conexiones): `cuentas()` (/me/adaccounts), `informe({ cuenta, rango 7d|14d|30d|90d, roas, cpa, forzar })` = insights `level=ad` paginados (gasto>0, top 40 por compras) + serie diaria (`time_increment=1`, filtering ad.id IN) + creativo/estado (`?ids=`), compras sin duplicar (primera de omni_purchase › purchase › píxel › onsite), métricas (ROAS, CPA, CTR de enlace, CPM, frecuencia), totales, serie de la cuenta, `cuantos`; caché 30 min en `temp/_sep/` (las reglas se recalculan sin pedir). `decidir()` = el sistema S.E.P (escalar / variar / sostener / probando / pausar, con razones y acciones; umbrales en la nota de la pantalla). `imagenDe(adId)` guarda la imagen para `#/imagenes/nuevo?referencia=/api/sep/imagen/<id>`. Rutas `rutas/sep.js`. Pantalla `pantallas/sep/` (sin «Pronto» en el menú): controles (cuenta, rango, ROAS objetivo, CPA máximo, «Traer de Meta» forzado una vez; preferencias en localStorage `sep:preferencias`), 5 KPIs, 2 gráficas SVG (barras de compras; líneas ingresos/gasto en la misma escala, nunca doble eje; colores validados con validate_palette: #65a30d y #2563eb/#3b82f6), filtros por sugerencia, tarjetas con chispa diaria, «Ver por qué y qué hacer», «Hacer variaciones», «Abrir en Meta», y vista de tabla. Modo prueba: datos simulados (7 anuncios con las 5 sugerencias). Pruebas: `probar-sep.mjs` 23/23 con un Meta simulado (reglas, compras sin duplicar, paginación, serie, imagen, caché, objetivo, forzar, token vencido 401, sin ads_read 403), pantallas 20/20 (con /sep), humo 86/86, capturas oscuro/claro y 390 px. Límite: no probado contra Meta real (no hay token aquí); la sección de oficina «Análisis y optimización» sigue «pronto». Antes: `2026-11-20j`: LA COORDINADORA FLOTANTE + APROBAR DESDE EL CHAT. `marco/AvisoCoordinadora.jsx` (+ `aviso-coordinadora.css`), montado en App.jsx en todas las rutas menos `/oficina`: lee `/api/oficina/chat` cada 8 s (misma clave `oficina:chat`), número = mensajes de la coordinadora después del último visto (`localStorage` `coordinadora:visto`; la primera vez lo viejo cuenta como leído) + `pendientes`; tarjeta con el mensaje nuevo (12 s, o fija si hay algo esperando el sí) con «Dale · US$» (manda «Dale, apruébalo y produce …» al chat) y «Ver primero»/«Responder»; la burbuja abre `Chat.jsx` dentro de `.avc__panel.of--pro`. Servidor: `chat()` devuelve `coordinadora` (`oficina.js` `coordinadora()`: nombre/avatar elegidos); `seguimiento()` adopta como encargo (`adoptado: true`) cualquier anuncio de video con `estado: 'guion'`, `etapa: 'aprobar'`, sin conductor y de las últimas 24 h, así avisa el costo y produce con el sí; el prompt cuenta como sí «está bien / apruébalo / me gusta…» y pide preguntar cuál si hay varias. Pruebas: Playwright con el chat simulado (sin aviso → llega un aviso con costo → número 2 + tarjeta con «Dale» → abrir deja 0; en /oficina no sale), probar-oficina-chat 41/41, oficina 11/11, humo 86/86, pantallas 20/20. Límite: la adopción de un guion hecho fuera del chat hasta «¿le doy?» no se pudo probar entera (el Claude falso no termina guiones sin la muestra local). Antes: `2026-11-20i`: PROGRESO CON LOS AGENTES: `tablero/EquipoTrabajando.jsx` («Tu equipo trabajando ahora», en Progreso debajo de «En producción» y también con la lista de anuncios vacía) lee `/api/oficina` → `produccion.departamentos[].trabajos` (cada 6 s, la misma clave `oficina` que la oficina) y muestra los que están activo/te-necesita/pausado/error, menos los videos con conductor (href `/produccion`, ya en «En producción») y los guiones por aprobar (ya en «Te necesitan»). Tarjeta: departamento (color), estado, título, agente + estación actual + estado del paso + detalle, cadena de estaciones (hecho/trabajando animado/error/esperando, «hechas/total»), error y cuándo. Estilos `.tb-eq*` en tablero.css. Pruebas: Playwright con /api/oficina simulado (3 tarjetas, el video en producción no se repite; claro y oscuro), pantallas 20/20, humo 86/86, producción 10/10. Antes: `2026-11-20h`: COORDINADORA CLONA VIDEOS + DICTAR POR VOZ. oficina-chat.js: `crear-anuncio` acepta `video` (id de un adjunto tipo video) y `conservar_gancho`: el archivo se enlaza/copia a `temp/_referencias/<id>.<ext>` y va como `respuestas.clonar = 'subido:<id>|<nombre>'` + `clonar_gancho` (lib/clonar.js lo analiza antes del guion, como «Clonar un video»); el prompt le dice que lo use cuando pide «uno igual / replica la estructura» y que proponga en una frase lo obligatorio que falte (o lo elija si dice «decide tú»). `transcribirVoz` + `POST /api/oficina/chat/voz` (audio crudo ≤ 25 MB → ElevenLabs Scribe `scribe_v1`, `spa`; en modo prueba un texto fijo). Adjuntos del chat hasta 400 MB. Chat.jsx: `useDictado` (Web Speech `SpeechRecognition`/`webkitSpeechRecognition`, continuo con resultados parciales, idioma del navegador o es-CO; sin él o con error `network`, MediaRecorder → /voz), botón micrófono (`.of-chat__mic`, rojo latiendo mientras escucha). Pruebas: probar-oficina-chat 41/41 (video adjunto → anuncio Zack 1:50 que clona, archivo en _referencias, /voz y audio vacío 400), Playwright con micrófono simulado (grabar → transcribir → texto en la caja), humo 86/86, pantallas 20/20. Límite: el dictado del navegador real (Web Speech) no se puede probar aquí (Chromium sin servicio de voz); se probó el respaldo grabado. Antes: `2026-11-20g`: CHAT LEGIBLE EN MODO CLARO: en oficina.css los paneles de vidrio oscuro (`.of--pro .of-equipo/.of-panel/.of-chat`) redefinen por dentro `--superficie-*`, `--borde-*` y `--texto-*` con valores oscuros (antes heredaban los del tema claro: burbujas `--superficie-2` blancas con letra blanca). lib/oficina.js: el lote de imágenes frenado lleva `detalle` = mensaje del paso con error del conductor (`motivoDelLote`), y Hud.jsx lo muestra en «En vivo» («…se frenó: <motivo>»). Pruebas: oficina 11/11, producción 10/10, humo 86/86, pantallas 20/20, capturas del chat en claro y oscuro. Antes: `2026-11-20f`: CONECTOR PARA CLAUDE (MCP) + INVESTIGACIÓN CON SUS DOS PARTES + ÍNDICE NUEVO. `lib/conector.js`: servidor MCP por HTTP (JSON-RPC 2.0 POST: initialize con protocolos 2025-06-18/2025-03-26/2024-11-05, notificaciones → 202, ping, tools/list, tools/call; sin OAuth, clave secreta en la URL `/mcp/<clave>`, `temp/_conector/conector.json` { activo, clave, ultimoUso }). Se atiende en `index.js` ANTES del filtro CSRF (Claude llama desde sus servidores), solo con la clave válida y prendido (si no, 404; GET 405; JSON hasta 25 MB). Herramientas: listar_productos, leer_investigacion (mercado con `aMarkdown` + competencia completa con `bloquesATexto`, `parte` ambas|mercado|competencia), investigar (`investigarTodo` de oficina-chat: mercado + competencia a la vez), listar_estilos, crear_anuncio_video, ver_anuncio (guion + `costoDelAnuncio`), producir_anuncio (exige `costo_confirmado` ≥ costo actual), crear_imagenes (`loteDeImagenes` exportado de oficina-chat, referencia por `referencia_url` https o `referencia_base64`; devuelve el costo sin generar), generar_imagenes (`producir` exportado: recalcula el costo y se niega si subió), ver_imagenes, estado_oficina. Ajustes › «Conector para Claude» (`ajustes/Conector.jsx`, `rutas/conector.js`: GET/PUT /api/conector, POST /api/conector/clave). `deploy/instalar.sh`: Caddy con `@privado { not path /mcp/* }` + `basic_auth @privado` (servidores viejos: comando en `CONECTOR-CLAUDE.md`, la guía para el usuario). Coordinadora: la acción `investigar` usa `investigarTodo` (antes solo la de mercado) y lee las investigaciones (`investigacionesParaLeer` → `temp/_oficina/investigaciones/<id>.md`, Read permitido). Investigación: `investigacion/Indice.jsx` (flechas, contador, bordes que se desvanecen según el lado, activa completa; en celular solo números + la activa) reemplaza `.tt-etapas` en MercadoApp y Competencia; Informe.jsx: barra `.inv-partes` (1 · mercado, 2 · competencia, «En la app | Como PDF» para ver `Documento` en pantalla). Pruebas: probar-conector 28/28 (+ cliente oficial `@modelcontextprotocol/sdk` 1.17 contra el servidor: conecta, lista las 11 y llama), probar-oficina-chat 36/36, humo 86/86, pantallas 20/20; capturas del índice en 1400 y 390 px y de la vista PDF. Límites: no probado con claude.ai de verdad (requiere el servidor desplegado); la sintaxis de Caddy no se validó con el binario (no se pudo bajar aquí). Antes: `2026-11-20e`: LA COORDINADORA COMO ASISTENTE + OFICINA ANIMADA. `lib/oficina-chat.js`: adjuntos (`subirAdjunto`, `POST /api/oficina/chat/adjuntos` binario con `x-nombre`, `GET /archivos/oficina/adjuntos/:id/:archivo`; viven en `temp/_oficina/adjuntos/<id>/` con meta.json; imágenes normalizadas, PDF tal cual, Word/texto con `texto.md`; video guardado pero la IA no lo ve); `enviar(texto, adjuntos)`; la IA corre con `Read` limitado a esa carpeta (maxTurnos 12) y el prompt pide tono humano corto. `chat.json` suma `encargos` ({ id, tipo video|imagenes, slug|lote, estado escribiendo|espera-si|produciendo|pausado|error|listo|cancelado, costo }). Acciones nuevas: `imagenes` (lote con `agente: 'variaciones'`, referencia = imagen adjunta o desde la investigación; con costo > 0 queda `espera-si` y se agrega «¿Le doy?»; con costo 0 arranca), `producir` (solo un encargo `espera-si`: video → `aprobarYProducir`, imágenes → recalcula el costo y `iniciarProduccion`), `seguir`, `cancelar`, y `entrega` { titulo, texto } (contenido que escribe ella). `seguimiento()` cada 15 s (`OFICINA_SEGUIMIENTO_MS`, `OFICINA_SIN_SEGUIMIENTO`): guion listo → `costoDelAnuncio` y mensaje con costo («¿le doy?»), guion con error, producción lista/frenada/pausada → mensajes marcados `aviso: true`. `chat()` devuelve `pendientes`. Chat.jsx: clip, pegar, arrastrar, miniaturas, tarjeta de entrega (copiar/descargar) y barra «Dale». Oficina3D: posturas nuevas (inclinarse, girar la silla, revisar con la mano en la barbilla, tamborilear), rutinas de los libres (`i0(id)`: celular y taza en las manos, estirarse, charlar, manos en la nuca, mirar), tarjetas de luz que suben del monitor de quien trabaja (efecto `tarjeta`), puntos que corren por la línea solo si un trabajo real pasa por ese paso, polvo y robot aspiradora. index.jsx: `modo` sale de `useTema()` (claro = día) y el botón llama `elegirTema`; ya no usa `oficina:modo`. `pedirNuevo` acepta `encabezados`. Pruebas: probar-oficina-chat 36/36 (adjuntos, imágenes con su sí, «dale», seguimiento hasta «Ya están tus…», 10 variaciones, «dale» sin nada esperando, aviso de guion trabado), probar-oficina 11/11, producción 10/10, humo 86/86, pantallas 20/20. Límite: el camino del video hasta «¿le doy?» con costo no se pudo probar entero aquí (el Claude falso no termina el guion sin la muestra local `befen-regulador-apetito`); la IA real con archivos tampoco se probó aquí. Antes: `2026-11-20d`: ANUNCIOS DE IMAGEN SOLO CON EL AGENTE: `#/imagenes/nuevo` (Crear.jsx) usa `imagenes/FormularioAgente.jsx` (modos `referencia` → `modo: 'variantes'` y `investigacion` → `modo: 'nuevos'`, los dos con `agente: 'variaciones'`, `rapido: false`; `?producto=`, `?referencia=<url>`, `?modo=investigacion`); la oficina (Encargar.jsx) usa el mismo componente. Formulario.jsx (plantillas, De un video, modo rápido) queda en el código pero ya no se abre. Servidor: crearLote acepta el agente también en «Nuevos» y nunca arma plantillas con él; `motivoParaNoGenerar` exige la investigación si el agente va sin referencia; sesiones.js `textoAgenteInvestigacion` (el ángulo central de la investigación en `analisis-ganador.json` → `angulo_central`, invariables, facetas, objeciones; niveles A directo, B otra faceta o contexto, C objeción/demostración/beneficio secundario; formatos de la biblioteca de la skill, nunca plantillas); verificar acepta `angulo_central`; estado.js muestra el ángulo central como «Investigación». claude-falso-imagen-ads cubre los dos modos. Enlaces: TextosAnuncios/Informe → `modo: 'investigacion'`; LoQueFunciona → `referencia: x.url`. probar-agente-variaciones 19/19 (los dos modos y sin investigación). Antes: `2026-11-20c`: ÍNDICE COMPACTO de la investigación: `.tt .tt-etapas` (competencia.css, al final) es una fila flex con scroll horizontal (máscara en los bordes, sin barra) en vez de la grilla de 6 columnas; MercadoApp.jsx y Competencia.jsx centran la pestaña activa (`indice` ref + `scrollTo`). En ≤760 px: cabecera en columna, anuncios/hooks/avatares a una columna y escala más chica (sin desborde a 390 px). Antes: `2026-11-20b`: AGENTE DE VARIACIONES (prompt maestro del usuario en `.claude/skills/anuncios-imagen-ads/agente-variaciones.md`): `brief.agente = 'variaciones'` (crearLote con `agente: 'variaciones'` y `modo: 'variantes'`; fuerza `rapido: false`). sesiones.js: `esDelAgente`, `GUIA_AGENTE`, `nivelesDelAgente(n)` (≈50 % A, 30 % B, 20 % C; con 1–2, A), `textoAgenteEstrategia` (escribe `analisis-ganador.json` y en plan.json `nivel`, `variables`, `faceta`, `contexto`, `formato_creativo`, `cambio`, `hipotesis`; el verificar de la estrategia los exige), y la guía pegada a prompts, revisión (pruebas 1/3/5 s y 10 puntos) y ajuste. estado.js: la vista trae `agente`, `analisis` (resumenAnalisis) y por variación `nivel`, `cambio`, `hipotesis`, `faceta`. Pantalla del lote: `imagenes-lote/AgenteLote.jsx`. Oficina: `Encargar.jsx` (imagen: ganador subido/pegado o de «Lo que me funciona», producto, cantidad, formato, país/público/oferta, costo antes; investigación: producto y país; video: chat o Nuevo anuncio) desde `PanelDepartamento` («Encargar…»). claude-falso-imagen-ads escribe el análisis y los niveles. INVESTIGACIÓN LEGIBLE: competencia.css (al final) paleta oscura carbón (--fondo #16181c, --tinta-2 #ddd7ce, acentos suavizados), Inter 11pt, interlineado 1,65, ancho de línea 82ch, tablas más legibles; claro solo tipografía y tonos. Pruebas: probar-agente-variaciones 15/15 (nueva, de punta a punta con kie simulado), probar-imagen-ads 168/168, oficina 11/11, producción 10/10, chat 24/24, pantallas 20/20, humo 86/86. Antes: `2026-11-20a`: EMPRESA DIGITAL (prompt maestro + imagen de referencia del usuario). Servidor: lib/oficina-produccion.js (`DEPARTAMENTOS` con sus estaciones; `produccion()` arma por departamento los trabajos con `estaciones` {id: hecho|trabajando|revisando|corrigiendo|error|pendiente|esperando}, `actual`, `correcciones` y `error` SOLO desde lo registrado: conductor.json de los anuncios (`estacionDelPaso`, `rehechos`), conductor + imagen-ads/estado.json de los lotes (tandas prompts/ajuste/revision, piezas con ronda o revision.ok false), tarea de investigación y competencia; landing/whatsapp/analisis `pronto`; `_paraPruebas`). lib/oficina.js: AGENTES con `dep`/`estacion` (los 7 de siempre + 28 de estación, nombres y género configurables), `enEstacion` por agente, `produccion` en /api/oficina, planta nueva `FIJAS` (6 departamentos, coordinación, sala; LUGARES 12; `planta: 2` en la config: los lugares de la planta anterior se ignoran). Pantalla: Oficina3D reescrita (`LUGAR` nuevo; `armarDepartamento` con estaciones en fila, `lineaDeProduccion`, panel con pantalla real en video e imagen; `armarCoordinacion`, `armarCentroK`, `armarSalaK`; `fusionar`/`fusionarHijos` juntan mallas por material para dibujar rápido; agentes sentados con posturas por estado y mezcla suave; íconos CSS2D `.o3-icono`; `revisarProduccion` compara cada sondeo con el anterior y llama `lanzar(de, a, 'pasa'|'devuelve'|'error')` y `terminar`; efectos: `onda`, `chispas`, `destello`, brillo del logo; props `produccion`, `onDepartamento`, `onLinea`, `onEvento`, `resaltar`; modo día por defecto). Departamento.jsx: `PanelDepartamento`, `PanelLinea`, `EstacionDeAgente`. index.jsx: «Tu empresa» por departamento, aviso `.of-toast`, eventos en «En vivo». Se quitaron la caminata sin motivo y las charlas decorativas (el prompt pide no simular actividad). Pruebas: probar-oficina-produccion 10/10 (nueva), probar-oficina 11/11, probar-oficina-chat 24/24, pantallas 20/20, humo 86/86; Playwright con una secuencia pasa → devuelve → termina. Pendiente honesto: landing/whatsapp/análisis sin motor (no hay herramientas); no hay un motor de tareas nuevo: las cadenas muestran los conductores que ya existen. Antes: `2026-11-20`: OFICINA VIVA Y A PANTALLA COMPLETA: index.jsx con `.of--pro` / `.of-escenario` (alto medido con `--alto-escenario`), HUD de vidrio (`.of-hud-arriba`, `.of-lateral` ocultable, `.of-actividad`, `.of-abajo-derecha`) y pantallas chicas en columna (≤900 px). Hud.jsx: `Recorrido` + `pasosDelRecorrido` (12 pasos; localStorage `oficina:recorrido-visto`), `Minimapa` (LUGAR exportado de Oficina3D, posiciones por `onPosiciones` cada 0,5 s), `Actividad` (necesita/ahora/hechos + charlas por `onCharla`), `Vistas`. Oficina3D: props `foco` ({ zona, n }), `vista` ('general'|'arriba'|'cine' con autoRotate), `modo` ('noche'|'dia', localStorage `oficina:modo`), `desplazar` (setViewOffset para centrar con el panel), `onPosiciones`, `onCharla`; caminar por puertas (`rutaHacia`, `puerta`, `zonaDe`, `p.ruta`); conversaciones (`charlaEntre` exportada, `empezarCharla` cada 7 s, máx. 2, `.o3-dice` en la etiqueta, gestos al hablar); bloom (EffectComposer + UnrealBloomPass + OutputPass) que se apaga solo si hay menos de 24 fps en los primeros 5 s; cámara más lejos si la pantalla es angosta. Chat acepta `inicial` («Pedirle algo a X»). DEPLOY SIN CLAUDE DE ESCRITORIO: los agentes usan Claude Code (la terminal, `claude`), no la app de escritorio; en un servidor (DESPLEGAR.md) se entra con `sudo -u kads -i claude` (cuenta Pro/Max) o se usa ChatGPT/Codex. Antes: `2026-11-19t`: PERSONAJES Y VISTAS DE LA OFICINA: Oficina3D.jsx `agente()` reescrito (torso con LatheGeometry por género, `rodillaI/D` y `codoI/D` en `partes`, ojos que parpadean `partes.ojos`, pelo por género y `i % 3`, audífonos en video y lentes en calidad/investigación); `genero` ('mujer'|'hombre') en AGENTES de lib/oficina.js (por defecto por agente), guardado con `guardarAgentes` y elegido en «Nombres y personajes». Detalles: `detallesDe(tipo, …)` al final de `armarZona`, escritorio con mouse/cuaderno/cajonera, helpers papelera, lamparaPie, cuadro, impresora, dispensador, archivador, pizarraBlanca, estantePared, softbox, audifonos. Paredes: `pared`/`vidrio`/listones marcados `userData.muro`; `desvanecerMuros(dt)` baja su opacidad a 0,12 cuando están del lado de la cámara respecto de su sala (`userData.zona`) o de la planta (materiales clonados; `needsUpdate` al cambiar `transparent`). `raiz.__o3` = { camara, controles, personajes } solo para capturas de prueba. probar-oficina 9/9, probar-oficina-chat 24/24. Antes: `2026-11-19s`: EDITAR Y REGENERAR LAS IMÁGENES DE APOYO (B-roll) del guion: `escenaBroll(slug, { n, actual, idea })` en anuncios-nuevos.js (consulta corta «TAREA: escena de apoyo», escribe app/broll-<n>-<id>.json { se_ve, camara } y lo borra; 404 si el B-roll no existe; 409 ya en producción) → `POST /api/anuncios/:slug/guion/broll-escena`; `editarLineas(slug, lineas, broll)` acepta `broll: [{ n, se_ve }]` (solo los del manifiesto y distintos al de guion.json) y siempre va por la IA con el pedido «IMÁGENES DE APOYO … rehaz el prompt de imagen y de video de ese B-roll, no cambies dónde entra ni su duración, pon el texto en broll[].se_ve». Pantalla: Guiones.jsx `BrollDelGuion` con «Editar» / «Otra escena» (abren «Editar a mano») y, editando, su cuadro con ✨ (no en `tuyo`); `apiNuevo.escenaBroll`, `editarLineas(slug, lineas, broll)`. claude-falso: «escena de apoyo» (y la coordinadora) fuera del reparto a los especialistas. Humo: 3 comprobaciones nuevas. Antes: `2026-11-19r`: OFICINA CON EL DISEÑO DEL USUARIO (Oficina3D.jsx reescrita: `LUGAR` = 13 lugares de la planta, 0-3 fondo, 4/5 lados, 6-8 adelante, 9-12 la fila nueva que agranda el piso; `armarZona(id, tipo…)` por tipo, `ARMADO` para los tipos de las salas propias, `armarCafe`, `armarSala`, `armarCentro` con el logo K; tipo `pronto` en construcción; `reales`: pantallas que cargan `vista` (TextureLoader / VideoTexture) de `ahora[].vista` o `hechos[0].vista`). lib/oficina.js: `FIJAS` (agentes, café, sala, landings, embudo-whatsapp, sep con `pronto`), `TIPOS`, `zonasDe`, `guardarZonas` (config `oficina.zonas` y `oficina.propias`; 400 si dos en el mismo lugar), `ultimoMedio` (`_ultimoMedio` para pruebas; vista de anuncios en video/ e img/, de lotes en img/ por /archivos/imagen-ads, finales en output/), `iasConProblemas` (salud() con tope de 1,5 s; `USAN` servicio → agentes) → `ias` y `agentes[].caida`. `PUT /api/oficina/zonas`. Pantalla `oficina/Disenar.jsx` (plano, mover/intercambiar, nombre, color, tipo, nueva/borrar; carga solo al abrir porque la oficina se refresca cada 5 s). probar-oficina 8/8, probar-oficina-chat 23/23. CHAT CON LA COORDINADORA Y 👍/👎 QUE ENSEÑA: lib/oficina-chat.js (`enviar` guarda el mensaje en temp/_oficina/chat.json y contesta en segundo plano con `lanzarSesion` de motor-ia, «TAREA: coordinadora de la oficina», escribe temp/_oficina/respuesta-<id>.json { respuesta, acciones }; acciones validadas y ejecutadas por el servidor: `crear-anuncio` (hasta 5, `crearAnuncio` con `pedido` → `brief.pedido` → `textoPedido` en la tarea del guion; solo el guion, nada se produce), `investigar`, `recrear`, `regla`; `chat()` trae el estado en vivo de cada anuncio creado; `AJUSTES_OBLIGATORIOS(estilo)` exportada de anuncios-nuevos.js para que pregunte lo obligatorio). `opinar({ slug, voto, partes, texto, paraTodos })` → `agregarRegla` (lib/aprendizajes.js: línea en <carpeta del estilo>.md o general.md, sin repetir) + temp/_oficina/aprendido.json por agente (PARTES: guion→guion, imagenes→arte, clips/voz→video, edicion→edicion) + temp/<slug>/app/opinion.json. Rutas en rutas/oficina.js: GET/POST/DELETE /api/oficina/chat, GET/POST /api/anuncios/:slug/opinion. `oficina()` suma `opiniones` y `semana` por agente. Pantallas: oficina/Chat.jsx (botón «Hablar con <coordinadora>», reemplaza la columna derecha), Panel con «Lo que aprendió esta semana» y 👍/👎; entrega/Opinion.jsx («¿Cómo quedó?» con partes). claude-falso responde la coordinadora («anuncio» crea UGC, «regla:» anota). probar-oficina-chat (app de prueba en 4492, restaura aprendizajes y chat). Antes: `2026-11-19q`: OFICINA VIRTUAL: `#/oficina` (pantallas/oficina: index.jsx con la bienvenida de nombres, lista y panel; Oficina3D.jsx en Three.js 0.180 —dependencia nueva de app/, la instala npm ci al actualizar—: escena hecha a mano, OrbitControls, CSS2DRenderer para las etiquetas). Servidor: lib/oficina.js (`AGENTES`, `agenteDelPaso` reparte cada paso de producción por su id, `oficina()` arma ahora/necesita/hechos de anuncios, lotes de imagen e investigaciones; nombres en app/config.json `oficina.agentes`) y rutas/oficina.js (GET /api/oficina, PUT /api/oficina/agentes). probar-oficina 4/4; abrir-pantallas incluye /oficina. Antes: `2026-11-19p`: RECREAR: `POST /api/anuncios/:slug/recrear { productoId }` → `recrearAnuncio` (anuncios-nuevos.js): brief copiado (estilo, voz, ajustes, avatar, música) con `recrearDe`, copia las hojas de personas/lugares (`copiarHojasDe`), lanza el guion con `textoRecrear` (partir del manifiesto del original, guion tal cual salvo lo del producto y lo que no encaje) y permiso de lectura del original. Pantalla: entrega/Recrear.jsx. «Cambiar el producto» en el Editor (botón; rutas /cambiar con menu 'editor'; ya no en Estilos). Antes: `2026-11-19o`: INVESTIGACIÓN: la parte 1 se dibuja con `MercadoApp.jsx` (estilo tt- de Competencia.jsx: cabecera, pestañas por sección, bloques; `Maqueta` exportada de Documento.jsx para la guía) y el PDF de siempre (Documento.jsx) queda solo para imprimir (`.inv-solo-impresion` / `.inv-solo-pantalla`). `POST /api/investigacion/:id` lanza también `competencia.investigar(..., { enlace: competencia, buscar: true })` (sin marca, la IA busca en TrendTrack la tienda que más vende algo así; `_armarSesion` exportada para pruebas); formularios con «Competencia a investigar». Las dos tareas piden búsquedas en paralelo («Rápido y completo»). Antes: `2026-11-19n`: IMAGEN POR ESCENA EN BLOQUES R: un bloque R puede llevar `prompt_imagen_inicial` (la imagen de su escena) y pedirla en `referencias` como `"imagen"` (INGREDIENTE_IMAGEN, como la entrevista; nunca como frame: Omni no acepta frame y referencias juntos). validar-manifiesto (`permitirEscena` solo en tomas, no ganchos), referencias.js, generar-imagenes (la genera con las referencias del bloque), generar-videos (`rutasDeIngredientes`; espera la imagen), familias/ugc.js `bloques` (hace la que falte antes), rehacer-toma (con su imagen la saca), editor `imagen`. estilos/ugc.md y agregar.md lo piden. probar-agregar con AGREGAR_UGC=1: 51/51. Antes: `2026-11-19m`: VOCES DEL PODCAST: paso `voces-hosts` (familias/hablado.js, solo podcast, después de `videos`; en modo prueba se salta salvo ANUNCIOS_PRUEBA_VOCES_HOSTS=1) con lib/voces-hosts.js: `elegirVocesHosts` (dos voces distintas de la cuenta según `generoDelHost`; `brief.opciones.vocesHosts` si el usuario eligió; quedan en app/hablado/voces-hosts.json) y `ponerVoces` (ElevenLabs speech-to-speech `eleven_multilingual_sts_v2`, el original en app/hablado/voz-original/, salta reacciones, tu video y lo ya hecho por hash; mux con `-t` del largo). estilos/podcast.md pide caras y voces distintas. tarea-guion.md: CTA de recomendación en videos de prueba social (todos los estilos). probar-voces-hosts 9/9 (ElevenLabs simulado). Antes: `2026-11-19l`: B-ROLL DETALLADO: guion.json `broll: [{ n, se_ve, camara }]` (regla en REGLAS_GUION_COMUNES; esquema); `normalizarGuion` arma `limpio.broll` desde el manifiesto (encima/despues, con, segundos, tuyo) con la escena de la IA. Guiones.jsx `BrollDelGuion`: debajo de su parte (podcast: al final). Humo completo 204/204 (comprueba el B-roll del guion). Antes: `2026-11-19k`: ARREGLO PRODUCCIÓN: `detalleAnuncio` manda `tomas[].llevaImagenInicial` (prompt_imagen_inicial, frame_inicial o imagen_propia) y produccion/modelo.js solo crea la pieza «imagen de inicio» si la lleva (los bloques R de Agregar no: antes quedaban «En espera» y «faltan N»). OJO: el Mac del usuario guarda sus anuncios en la rama `correcciones-revision` (ahí se pueden mirar sus archivos livianos). Antes: `2026-11-19j`: GUION POR PERSONA (podcast y entrevista): esquema guion.json con `partes[].actuacion`, `partes[].dialogo[].como` y `personajes[].habla_asi`; estilos/podcast.md y entrevista.md piden a cada persona distinta y la actuación igual al Delivery del prompt; `normalizarGuion` los conserva (`actuacionDe`; en entrevista, el `como` por orden del diálogo). Guiones.jsx: `lineasDeLaConversacion`, `personasDelGuion`, pestañas «La conversación» / «Guion de X» (`GuionDePersona`, «Copiar su guion»), 🎭 `.nv-actuacion`. Antes: `2026-11-19i`: PEGAR LO QUE FUNCIONA: SubirFunciona.jsx tiene «Pegar» (navigator.clipboard.read) y escucha Cmd+V en captura (con `zona`: solo con el mouse encima, y frena el evento para que no llegue a la foto del producto; con `pegarSiempre`, en Biblioteca, en toda la pantalla salvo en cuadros de texto) y soltar archivos en la zona. Antes: `2026-11-19h`: SUBIR LO QUE FUNCIONA: `POST /api/funcionan/subir` (crudo hasta 300 MB, cabeceras X-Nombre/X-Producto/X-Concepto) → lib/funcionan.js `subir()` (imagen: jpg/png tal cual, otras a jpg con ffmpeg del sistema o sips; video: `temp/_funcionan/videos/<id>`, cuadro del gancho como imagen; `origen: { subido }`); `PATCH /api/funcionan/:id` (`editar`: concepto, título, producto). Variantes: `conceptosReferencias` en el lote (lotes.js) y rapido.js agrega «WINNING CREATIVE CONCEPT … KEEP this concept» a cada variación. Pantallas: `imagenes/SubirFunciona.jsx` (botón y concepto), ElegirFunciona (subir, lo subido queda elegido, concepto de cada elegido), Biblioteca → pestaña «Lo que me funciona» (`biblioteca/LoQueFunciona.jsx`), `#/imagenes/nuevo?modo=variantes`. probar-funciona-subir 9/9. Antes: `2026-11-19g`: CAMBIAR DE CUENTA DE CLAUDE: `POST /api/ia/cambiar-cuenta` (409 si Claude escribe algo; `igual` lo corta) → `abrirLogin({ cambiar: true })` (lib/claude.js: `claude auth logout` y después `auth login` en la ventana); después de abrir un login, `estadoClaude()` se vuelve a mirar cada 4 s por 10 min; `alCambiarCuentaClaude(fn)` avisa cuando el correo cambia y el conductor saca la pausa de Claude y sigue con los anuncios que esperaban el límite. Pantalla: Conexiones «Cambiar de cuenta» (datos.js `cambiarCuenta`, `ia.cambiandoDe`). La app de escritorio de Claude NO cambia la cuenta de Claude Code. probar-cambiar-cuenta 9/9. Antes: `2026-11-19f`: CLONAR A LA VISTA: en Estilos la tarjeta «Clonar un video» va después de Agregar (familia «referencia») y lleva a `#/nuevo?clonar=1`; con `clonar=1` el paso 1 pide primero «El video que quieres clonar» (borrador.referencia, obligatorio) y los títulos cambian; `alternarEstilo` pone la referencia en la pregunta `clonar` de cada estilo elegido (antes solo en los ya elegidos al llegar al paso 2). El motor de la clonación no cambió (lib/clonar.js). Antes: `2026-11-19e`: SALUD MENOS PEGAJOSA (lib/salud.js): los modelos de kie solo se ponen en «degradado» con reintentos en las últimas 2 h (RECIENTE) y si la última pieza también los tuvo; `propia()` (exportada para la prueba) necesita dos comprobaciones malas seguidas (`seguidas`) para «lento»/«caido» (LENTO_MS 8 s); SaludPlataformas.jsx muestra el culpable y si se puede usar. probar-salud 17/17. Antes: `2026-11-19d`: SALUD EN VIVO: `GET /api/salud/en-vivo` (Server-Sent Events, rutas/salud.js) con `escuchar(fn)` de lib/salud.js: mientras alguien escucha, revisa todo cada 30 s y manda cada resultado nuevo (también el ↻ de una fila) a todas las pantallas; sin oyentes se detiene. SaludPlataformas.jsx usa EventSource (si falla, pregunta cada 30 s) y muestra «En vivo». probar-salud 15/15. Antes: `2026-11-19c`: ARREGLO: Crear anuncios de imagen se rompía con el borrador del navegador en modo «De un video» (`opciones.plantillasReferencia` antes de cargar las opciones, Formulario.jsx); abrir-pantallas.cjs ahora abre esa pantalla también con borradores (video, variantes, nuevos). OJO al probar: la app en el puerto 4455 hace «Guardado automático» (commits) en la rama actual; para pruebas usa ANUNCIOS_MODO_PRUEBA=1 y otro puerto, y abre las rutas con `/#/`. Antes: `2026-11-19b`: TUS VIDEOS E IMÁGENES: `POST /api/material` (rutas/material.js, crudo hasta 400 MB) → `temp/_material/<id>.<ext>` + json; `crearAnuncio` con `material: [{ id, nota }]` copia a `temp/<slug>/material/M01…` + `material.json` (+ `M0n-vista.jpg`, 4 cuadros de cada video) y `brief.material` (lib/material-propio.js); `textoMaterial(slug)` va en la tarea del guion (cómo usarlo). MOTOR (produccion/clips-sin-cobro.js): `desde_biblioteca` acepta `temp/<slug>/material/*` (`esDeMaterial`); nuevo `imagen_propia` (toma o B-roll: la imagen inicial es la del usuario, recortada a 1080x1920 con ffmpeg, sin generar ni pagar; en generar-imagenes.js después de las de biblioteca; el validador lo revisa); como referencia se usa una referencia aportada `{ archivo: 'material/M02.jpg' }`. Pantalla: `nuevo/TusArchivos.jsx` en AjustesEstilo (`ajuste.material`). claude-falso usa el material (imagen en la toma 1, video en el B-roll 1). Pruebas: probar-material 10/10, humo completo con material de punta a punta. Antes: `2026-11-19a`: DE UN VIDEO = ÁNGULO (pedido: «no es tomar fotogramas, sino analizar el ángulo y hacer las imágenes, títulos»). `video-imagenes.js`: `analizarAngulo(id, { productoId, cantidad, lanzarSesion })` de fondo en `t.angulo` (espera las tomas; `transcribirVideo` con ElevenLabs scribe_v1 por fetch y `leerClave`, texto de prueba en modo prueba; sesión de la IA con las tomas en hojas, la transcripción, la ficha y `contextoCreativo`; escribe `angulo-ia.json` { video: { angulo, gancho, dolor, deseo, promesa, publico, formato, por_que_funciona }, conceptos: [{ titular, angulo, faceta, momento, escena }] }); `limpiarAnalisis`. Rutas: `POST /api/imagen-ads/video/:id/angulo` y `POST /api/imagen-ads` con `video: { id, conceptos }` → `crearLote` con `plantillasReferencia` y `temasExtra` (temas del video) + `brief.desdeVideo`. `rapido.js`: con `brief.desdeVideo`, deseo/dolor/conceptos del video; la escena va en su línea «WHAT THE IMAGE SHOWS». Pantalla `DeUnVideo.jsx` reescrita (análisis, conceptos con titular y escena editables, 4/6/8/10, «Otras ideas»); el formulario muestra Plantillas y el costo normal. Escenas de 35–70 palabras, visuales (también `contextoVisual` del guion; topes 600). claude-falso responde el análisis. Probado de punta a punta en modo prueba (subir video → tomas → ángulo → lote con 3 conceptos y plantillas de glúteos → V01 con titular editado). Pruebas: probar-video-imagenes 22/22, probar-plantillas-referencia 30/30, imagen 168/168, pantallas 16/16, humo 86/86. Lo viejo (cuadros con plantillas de dibujo) sigue en el código para lotes viejos. Antes: `2026-11-19`: ✨ en las partes NUEVAS de «Editar a mano»: `regenerarLinea(slug, { nueva: true, despuesDe, actual })` (misma ruta `POST /guion/regenerar-linea`; 404 si `despuesDe` no existe; prompt «Escribe lo que se dice en una parte NUEVA que va justo después de la parte N…»); `apiNuevo.lineaNueva`; `ParteNueva` con el botón `nv-linea__regenerar` y, al llegar el texto, pide «lo que se ve». claude-falso: «Una parte nueva de prueba». Humo: 2 comprobaciones más. Antes: `2026-11-18z`: EDITAR EL GUION CON «LO QUE SE VE»: `contextoVisual(slug, { n | despuesDe, dice })` en `lib/anuncios-nuevos.js` (consulta corta como regenerarLinea, «TAREA: lo que se ve en una parte», escribe `app/se-ve-<id>.json` { se_ve } y lo borra) y `POST /api/anuncios/:slug/guion/se-ve`. `editarLineas` acepta `se_ve` por parte y partes nuevas `{ nueva: true, despuesDe, dice, se_ve? }` (máx. 10): si cambia lo que se ve o hay nuevas, va por la IA (`pedido` con «dice … ; se ve …» y «Partes NUEVAS … renumera»), aun con narrador; solo texto con narrador sigue directo. Pantalla `HojaGuion`: `SeVeEditable` (se escribe solo al salir del cuadro si el texto cambió; ✨ para otra), «Agregar parte aquí» y `ParteNueva`; `apiNuevo.contextoVisual`. claude-falso responde «Escena de prueba que muestra: …». Humo: 4 comprobaciones nuevas en el guion del anuncio de prueba (corrida completa en una copia sin anuncios). PORTADAS: `lib/portadas-estilos.js` (`PORTADAS` con el prompt de agregar, cambiar, clonacion, ganchos y sketch; `generarFaltantes` con `generarConChatGPT` 9:16 a `app/muestras/<clave>/imagen.png`, para en sin-sesión/límite y reintenta a las 24 h, `.cache/portadas-estilos.json`; `programarPortadas()` a los 90 s del arranque, nunca en modo prueba; `_paraPruebas`). `muestras.js` acepta las claves especiales; `/api/estilos` trae `especiales`; `GET/POST /api/estilos/portadas`. Estilos usa la portada en los especiales. Menú sin «Cambiar el producto» (las rutas `/cambiar` iluminan Estilos). probar-portadas 6/6. Antes: `2026-11-18y`: menú «Crear»: Embudo WhatsApp (`#/embudo-whatsapp`), Landings (`#/landings`) y S.E.P (`#/sep`), los tres «Pronto» (`pantallas/proximamente/index.jsx`, exports `EmbudoWhatsapp`, `Landings`, `Sep`; `.nav__item--pronto` con letra de 13 px). Inspiración oculta del menú (la ruta `#/inspiracion` sigue). Las copias instaladas con el comando público solo reciben lo que se publica en kads-studio (`npm run publicar` en la Mac del usuario, con `gh auth login`): la publicación automática sigue pendiente (llave de despliegue `APP_NUBE_LLAVE`); el Mac de Juanquín se reinstaló así el 2026-11-18. pantallas 16/16, humo 86/86. Antes: `2026-11-18x`: VER LO QUE ESTÁ EN LA NUBE: `lib/en-la-nube.js` (lee temp/<slug>/app/en-la-nube.json sin importar guardado.js: `archivoEnNube`, `finalEnNube` (slug por prefijo más largo), `finalesEnNube`, `enLaNube`). `rutas/archivos.js` y `rutas/miniaturas.js` sirven la copia de la nube si falta el archivo local (Range incluido). `lib/anuncios.js`: `versionesDe` suma los finales que solo están en la nube (`enLaNube: true`, antes el anuncio quedaba «en producción» al liberar el MP4), `leerCarpeta` suma img/ y video/ de la marca, `firmaDe` mira en-la-nube.json, el resumen trae `enLaNube`. Pantalla: marca «En la nube» en Anuncios y aviso más corto en la entrega. LANDINGS: `#/landings` (próximamente, `pantallas/landings/`), menú «Landings» con «Pronto» (`item.pronto`). Pruebas: probar-nube-ver 8/8 (anuncio y nube falsos, app real en 4482), humo 86/86, pantallas 14/14. Antes: `2026-11-18w`: PRODUCTOS RELACIONADOS en las plantillas: `indice.json` con `temas` por plantilla y el diccionario `temas`; `plantillas-referencia.js` `temasDeTexto`, `temasDeProducto(id)` (ficha + deseo central, 4 primeros; incluye respiratorio y sueño sin plantillas) y `relacionadas(id)`; `elegir(n, elegidas, { temas })` ordena familias y plantillas por coincidencia («hombres» solo no cuenta). `crearLote` le pasa los temas. `GET /api/imagen-ads/plantillas-relacionadas/:producto`. Selector: filtro «Para tu producto» por defecto y marca en «Todas». probar-plantillas-referencia 29/29. Antes: `2026-11-18v`: 24 plantillas nuevas (p31–p54) de TrendTrack (búsquedas `longest_running`/`reach`, imagen, español, LATAM/ES: glúteos, hinchazón, curvas/caderas, celulitis/abdomen/drenaje/colágeno, antes y después; ~150 créditos, quedan ~2.650). En `indice.json` cada una con `titular`, `ejemplo` y `fuente` { marca, dias, alcance }; `catalogo()` expone `dias`. Selector con filtros por familia y «N días activo». probar-plantillas-referencia 25/25, imagen 168/168, pantallas 13/13, humo 86/86. Antes: `2026-11-18u`: (1) TITULARES: `app/plantillas-referencia/indice.json` trae `titular` (la fórmula de cada plantilla, analizada de las 30) y `ejemplo`; `plantillas-referencia.fichaDe(id)`; `rapido.js` pasa la plantilla de cada imagen (R0k = k-ésima de `brief.plantillasReferencia`) a `variacionDePlantilla`, que pide el titular con esa estructura y el deseo principal, y «el resultado grande» (más volumen 60–70 % del cuadro si el deseo es volumen; reducido si es menos de algo). En `construirPrompt` el encabezado del titular en modo `plantilla` deja que el modelo lo escriba con la estructura (la idea de la investigación se usa tal cual si ya encaja). (2) PRODUCTOS: `lib/unir-productos.js` (`claveNombre`: sin tildes/mayúsculas y palabras ordenadas; `repetidos()` con `sugerido` = el que tiene investigación > competencia > ficha > más usos > más viejo; `unir(principal, otros)`: reemplaza `"productoId": "<otro>"` en temp/*/app/*.json y temp/_funcionan/lista.json, lleva ficha/investigacion/competencia/kit-marca si el principal no los tiene (con las rutas `/<otro>/` → `/<principal>/`), mueve el otro a temp/_productos/_unidos/<id> e indice.json). Rutas `GET /api/organizar-productos`, `POST /api/organizar-productos/unir`. Pantalla `#/productos` (`pantallas/productos/`): aviso de repetidos, lista por nombre con lo generado, modo «Unir productos» y modal para elegir con cuál quedarse. En los datos de prueba hay 2 grupos reales (3 «Aguaje Complex 3 en 1» y 5 «Aguaje Complex 10X»); no se unieron (lo decide el usuario). En modo prueba `repetidos()` solo ve productos de esa app. Pruebas: probar-unir-productos 9/9, probar-plantillas-referencia 25/25, imagen 168/168, pantallas 13/13, humo 86/86. Antes: `2026-11-18t`: plantillas con el ÁNGULO DEL PRODUCTO (pedido: «antes y después de piernas hinchadas → si el producto es de glúteos/caderas/piernas debe verse así; igual día 1/14/30; una persona debe mostrar el ángulo; buenos textos; Andromeda bien plasmado»). `lib/imagen-ads/angulo-producto.js` `contextoCreativo(productoId)`: deseo (cita de «Deseo central»), resultados («Los 5 resultados»), tiempos + nota («Tiempos de transformación»), avatar, conceptos de la matriz 15.4 unidos a las facetas 15.2 (escenario, dolor) y el titular de `anuncios_imagen` (concepto o faceta); sin matriz, los `anuncios_imagen`; `MOMENTOS` si no hay nada. `rapido.js variacionDePlantilla` → `app_rapido: 'plantilla'` (un concepto por imagen; el que se repite cambia de momento y de titular). `produccion/imagen-ads.js RAPIDO_PLANTILLA`: leer mecanismo/bloques/look de la plantilla y transponerlo al ángulo del producto (ejemplos de piernas → glúteos, Día 1/14/30, una persona, diagrama), Andromeda (quién, qué, cuándo), textos ≤ 6 palabras, rótulos solo con los tiempos permitidos. probar-plantillas-referencia 22/22, imagen 168/168, video-imágenes 19/19, humo 86/86. No probado con kie real. Antes: `2026-11-18s`: PLANTILLAS = REFERENCIAS (pedido: «no que hagas una literal; las imágenes de referencia pasan como referencia al modelo y se reemplaza el producto y los textos»). Las 30 imágenes validadas del usuario en `app/plantillas-referencia/` (p01–p30, 1350 px, `mini/` 360 px, `indice.json` con familia y grupo). `lib/imagen-ads/plantillas-referencia.js` (`catalogo`, `elegir(n, elegidas)`: hasta 10, sin elegir reparte entre familias sin repetir grupo y rota con el día, `copiarAlLote` → entrada/referencias/R##.jpg, `rutaDeArchivo`). `GET /api/imagen-ads/plantillas-referencia[/mini]/pNN.jpg`, `opciones().plantillasReferencia`. `crearLote` con `cuerpo.plantillasReferencia: { elegidas }` → `brief.desdePlantillas` (fiel, rápido, sin validados); `rapido.js` usa modo «copiar» (RAPIDO_COPIAR: misma estructura y tipografía; producto, textos y paleta del producto) + regla sin precios/ofertas. Pantalla: `ElegirPlantillasRef.jsx` (reemplaza ElegirPlantillas; el dibujo con Remotion queda para «De un video» y lotes viejos), campo `plantillasRef` del borrador; costo normal por imagen. Prueba nueva `probar-plantillas-referencia.mjs` 15/15; imagen 168/168; video-imágenes 19/19; andromeda 17/17; pantallas 12/12. No probado con kie real (depende de que el modelo respete la estructura). Antes: `2026-11-18r`: dashboard **Inicio** (`#/inicio`, `src/pantallas/inicio/`: Cifras, Grafico (barras HTML con tabla oculta), Ahora, Paneles (Saldo, Plataformas, Modelos), Listas (PorProducto, Recientes)); `/` redirige a `/inicio`; menú «Inicio» bajo «Nuevo anuncio». Servidor `lib/dashboard.js` + `GET /api/dashboard` (14 días en hora de Colombia: dólares por `gasto/*.json` `inicio`, anuncios por `conductor.terminado` de `slugsDeAnuncios()`, imágenes por `informe.archivos` de lotes `_img-*` de esta app; mes contra el anterior; `modelosDeKie()` ahora con `piezas`; 30 s de memoria). abrir-pantallas incluye `/inicio` (12) y humo `/api/dashboard` (86/86). Verificado en Playwright a 1440 y 390 sin desborde. Antes: `2026-11-18q`: Salud simplificada (sin «para» ni «fuente»), `modelosDeKie()` (gasto/*.json y _img-*/img/log-modelos.json de 7 días; reintento = intentos > 1 o respaldo), `REVISAR[id]` y `GET /api/salud?servicio=<id>`. probar-salud 12/12. Antes: `2026-11-18p`: Meta en Salud de plataformas: metastatus.com/data/orgs.json (lo que lee su página; estados «No known issues», «Low/Some/Medium disruptions», «High/Major disruptions»), grupos ads-manager+marketing-api, ads-transparency (Ad Library), whatsapp-business-api+ctx. probar-salud 11/11. Antes: `2026-11-18o`: «Salud de plataformas» (`lib/salud.js`, `GET /api/salud`, `marco/SaludPlataformas.jsx` en BarraArriba): Statuspage summary de status.claude.com (Claude Code, API), status.openai.com (Codex, Responses, Chat Completions, Login) y status.elevenlabs.io (todo), más comprobación propia con saldoKie y saldoElevenLabs (lento > 6 s, caído > 12 s); 60 s de memoria; la pantalla cada 2 min. Prueba `probar-salud.mjs` 7/7. ElevenLabs volvió a responder con la clave del usuario el 18-11 a las 18:07 UTC (21 s, aún con su incidente abierto). Antes: `2026-11-18n`: CAUSA FINAL de los timeouts de ElevenLabs: incidente de ElevenLabs «Increased latency and API errors» (US residency, desde 2026-11-18 15:34 UTC). Comprobado desde la nube con la clave del usuario (proxy, `request_credential`): `000` en 60 s; claves inválidas responden 400 enseguida. `lib/estado-servicios.js` (`fallaReportada('elevenlabs')`, status.elevenlabs.io/api/v2/summary.json, 3 min) se suma a Probar, /api/voces y voz-auto. El entorno App-nube ahora permite api.elevenlabs.io y status.elevenlabs.io y guarda la clave de ElevenLabs del usuario como secreto de red. Antes: `2026-11-18m`: espera tras un fallo (voces.js 2 min salvo `fresco`, `?fresco=1` desde Reintentar; estadoGuion no reelige sola por 10 min). DIAGNÓSTICO EN LA MAC DEL USUARIO (2026-11-18 12:40): `curl` CON su clave a /v1/user/subscription → `000` en 60 s (sin clave, 0,3 s); el diagnostico-elevenlabs.mjs también se cuelga en /v1/user. Es ElevenLabs con esa clave o cuenta (posible freno por los pedidos repetidos con conteo total de las versiones 18c–18k). Pendiente del usuario: status.elevenlabs.io, probar en la web, clave nueva con acceso completo, o soporte. Antes: `2026-11-18l`: `usuarioElevenLabs` (Probar) con `missing_permissions` en /v1/user caía a `/v2/voices?page_size=1` CON conteo total (lento) → timeout; ahora `include_total_count=false` (también en produccion/elevenlabs-client.js). `lib/ocupada.js` mide el atraso del event loop; `consultar` devuelve `ocupada`, `codigo`, `ms` y el mensaje lo dice (motivo `app-ocupada`). Herramienta `app/herramientas/diagnostico-elevenlabs.mjs` para la Terminal del usuario. Antes: `2026-11-18k`: CAUSA REAL de los «no respondió a tiempo» de ElevenLabs: `medirVoz` (spawnSync de ffmpeg + autocorrelación de todo el audio a 16 kHz) corría en el proceso de la app y bloqueaba el event loop con videos largos; los AbortSignal de todas las consultas vencían. Ahora `medir-voz.js` también es CLI, la app lo corre con `spawn` (voz-auto `medirAparte`, async), a 8 kHz y como mucho 800 cuadros (5 min en <1 s). curl y node en la Mac del usuario respondían en 0,3 s. probar-voz-auto 27/27 (con la prueba de no congelar). Antes: `2026-11-18j`: `dns.setDefaultResultOrder('ipv4first')` y `net.setDefaultAutoSelectFamily(true)` en app/server/index.js y produccion/config.js; claves.js espera 30 s. El usuario veía «ElevenLabs no respondió a tiempo» hasta en «Probar» la clave (y creó una clave nueva). No verificado en su Mac: si sigue, comparar `curl` contra `node -e fetch` a api.elevenlabs.io. Antes: `2026-11-18i`: `lib/voces.js` con `include_total_count=false`, 45 s por pedido, v1 de respaldo y la última lista buena en `.cache/voces-elevenlabs.json` (se devuelve al instante con `guardada: true` y se refresca por detrás; se usa si ElevenLabs falla salvo clave mala). El usuario veía «ElevenLabs tardó demasiado» con el saldo bien. probar-voz-auto 26/26. Antes: `2026-11-18h`: grilla de `.nv-guion` con `.nv-decisiones--plan` y la hoja en la columna 1 y `.nv-guion__lado` en la 2 (filas 1–2); el plan de Agregar (desde e7723fe) caía en la columna 1 y empujaba la hoja al lateral. Verificado en Playwright a 1920 y 1280. Pendiente menor: en el celular la pantalla «Nuevo anuncio» todavía se sale de ancho por filas de chips (ajenas al guion). Antes: `2026-11-18g`: ✨ regenerar una parte (`POST /api/anuncios/:slug/guion/regenerar-linea`, `regenerarLinea`: sesión corta con `lanzarSesion` de motor-ia, fuera de la cola, escribe `app/linea-<n>-<id>.json` { dice } y lo borra; no guarda: la pantalla lo pone en el cuadro). `claude-falso.js` responde «TAREA: regenerar una línea». Probado en Playwright. Antes: `2026-11-18f`: editar el guion a mano (`PUT /api/anuncios/:slug/guion/lineas`, `editarLineas`: con `modo_audio: voz_en_off` y sin audio/voz.mp3 se aplica directo a `tomas[].linea`, `voz_en_off` y los textos de la toma que la repiten, se valida y solo se deshace si aparece un ERROR nuevo; en los demás, `pedirCambios` interno con el texto exacto). Pantalla: «Editar a mano» en HojaGuion (no en letras ni diálogos de entrevista). Probado en Playwright con una copia de Claymation. Antes: `2026-11-18e`: tarjeta «Voz del narrador» en el guion (`nuevo/VozDelGuion.jsx`, `BotonEscuchar.jsx` aparte), `PUT /api/anuncios/:slug/voz` (`cambiarVoz`: `{ id, nombre }` o `{ auto: true }`, 409 si ya existe audio/voz.mp3), `estadoGuion` devuelve `voz` (`generada`, `eligiendo`, `error`) y elige de fondo si falta; `vozDelPlan` lee la voz del plan de Agregar. Pruebas: probar-voz-auto 22/22, humo 85/85, pantallas 11/11 y la tarjeta en Playwright. Antes: `2026-11-18d`: `lib/voces.js` pide las voces con fetch en el proceso de la app (clave con `leerClave` de claves.js, como el saldo), sin el proceso hijo; motivos `sin-clave`, `clave`, `sin-conexion`, `tarda`, `servicio`; `_paraPruebas({ servidor })`. El usuario veía «error de conexión» con el saldo bien. Prueba: probar-voz-auto 20/20 con un ElevenLabs simulado. Antes: `2026-11-18c`: voz del narrador automática (`lib/voz-auto.js`). Antes: `2026-11-18b`: arreglo de «Crear anuncios de imagen» (en 18a, `productoElegido` se usaba antes de declararse: error de zona muerta temporal que el build no detecta). Revisión nueva: `node app/herramientas/abrir-pantallas.cjs` con la app de prueba en el puerto 4471 (abre 11 pantallas en Chromium y falla si alguna se rompe); correrla después de tocar pantallas. Antes: `2026-11-18a`: 8 clones de anuncios validados y `anuncios_imagen` en la investigación (editables, con aprendizaje). Antes: `2026-11-18`: investigación de mercado con «Conceptos para Meta (Andromeda)». Antes: `2026-11-17q` (antes `2026-11-17p2`, mismo contenido): 8 plantillas de «Ángulos ganadores» y las de oferta fuera de
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
- **Preferencia vigente (2026-11-23):** el usuario pidió cambiar todo el diseño para que parezca un videojuego, con una portada de referencia de ciudad costera y estética GTA VI. Se autoriza sustituir la apariencia anterior. Mantener la identidad Kads, las funciones, los datos reales y las decisiones de producción.
- **Publicación:** los cambios de Kads se reciben desde `main` con el botón **Actualizar**. El ZIP de la Release
  «Actualización-App» es la fuente original del proveedor y reemplazaría archivos personalizados si se instala entero.
- **Estrategia de agentes preparada:** ver `ESTRATEGIA-AGENTES.md` y el diagnóstico abajo. El piloto de variaciones fieles es la prioridad recomendada; todavía no está implementado.
- **Otros trabajos funcionales pendientes:** los dos pedidos de modelos alternativos ante fallas y «Estado de la IA»,
  detallados al final. Mantener el contexto al día no autoriza a iniciar esas funciones sin una petición de trabajo.

## Diagnóstico y estrategia de agentes (2026-11-23)

Documentación y validación: [PR #186](https://github.com/kalethabh/App-nube/pull/186).

Pedido: analizar los agentes y preparar una estructura para mejorar coordinación y resultados. Entregado
`ESTRATEGIA-AGENTES.md`: auditoría del código en `da9d67f`, responsabilidades, contratos de encargo/tarea,
flujo de aprobación y revisión, memoria, eficiencia, fases y criterios de aceptación. Es una **propuesta de
implementación**, no un cambio funcional ya instalado. No cambia VERSION, diseño, motor ni campañas.

Hallazgos: 35 roles visuales (coordinación 1, video 6, investigación 5, imagen 6, landing 6, WhatsApp 6,
análisis 5), no 35 ejecuciones autónomas. Las cadenas de landing/WhatsApp/análisis figuran «pronto» en la
oficina; la función de landings sí existe por separado. Parte del estado se infiere por archivos/palabras.
`oficina-votos.js:deEste` concatena propios/ajenos y luego invierte todo: los ajenos quedan primero
(reproducción sintética confirmada). El agente A/B/C pide cambios amplios para B/C; separar esto de «solo
títulos» y de variación fiel. La validación del chat y las garantías de ejecución existen, pero están
repartidas; se propone un contrato central versionado y validación completa antes de acciones.

Validación sin gasto en checkout de desarrollo: `probar-oficina-produccion.mjs` **10/10** y
`probar-oficina-chat.mjs` **51/51** (286 s, puerto 4497, modo prueba, motor/proveedores simulados,
`ANUNCIOS_NO_RETOMAR=1`). Las pruebas limpiaron sus fixtures; git solo muestra documentación nueva/modificada.
No se revisaron anuncios personales ni métricas de venta y no se midieron proveedores reales. Pasar estas
pruebas confirma la base actual, no valida todavía las mejoras propuestas.

Siguiente paso recomendado: implementar el piloto de variaciones fieles de imagen: modos explícitos,
restricciones conservadas en chat/formulario, selección de títulos cuando se pida, orden de votos y
encargo versionado; después aprobación ligada al plan, recuperación/idempotencia y estados por entregas
aceptadas. No activar los 17 roles futuros ni crear 35 sesiones. Metas de rapidez/calidad del documento
son hipótesis que exigen línea base y piloto; cualquier prueba pagada necesita su costo y aprobación.

## Ciudad creativa · rediseño ilustrado (2026-11-23b)

Implementación y validación: [PR #184](https://github.com/kalethabh/App-nube/pull/184), integrado en `main`
(commit `9c2c002a0a759bf5b8bfd81ccf06f84e958543c3`). Publicada y verificada la versión
[2026-11-23b](https://github.com/kalethabh/kads-studio/releases/tag/v2026-11-23b), con el ZIP en estado `uploaded`.
La instalación personal se actualiza con el botón «Actualizar»; no fue modificada durante este trabajo.

Pedido: «Actualizate, quiero cambiar todo el diseño para que parezca videojuego, estilo gta vi», con imagen
adjunta de una portada ilustrada de ciudad costera, viñetas negras, atardecer rosa/violeta y personajes.
Se partió de `main` 101d7f7 (PR #183), conservando todas las funciones añadidas esta semana.

- Tema Juego ampliado con ilustración ORIGINAL para Kads: ciudad costera, creadores con cámara/auriculares,
  coche rosa, contornos de tinta. Arte integrado localmente en `app/public/arte/ciudad-creativa.jpg` (492 KB),
  generado con la herramienta integrada de imágenes. No usa el logo, los personajes ni el arte de un juego existente.
- Inicio: `PortadaJuego.jsx`, cartel con títulos HTML accesibles, acciones reales para crear un anuncio o entrar
  a la oficina, y tres viñetas que abren Video, Imágenes e Investigación. Conserva el dashboard completo y todos
  sus datos reales, con la actividad de producción real en el pie de la portada. Sin puntos/XP o resultados ficticios.
- Tema global: títulos Bricolage Grotesque local, superficies de tinta, marcos y sombras gráficas, botones rosa,
  neón turquesa, campos, modales, galerías, navegación, cifras, coordinadora flotante y paneles de la oficina.
  El símbolo K conserva su forma y toma los colores del tema. No se modificó el modelo 3D ni el motor de producción.
- El editor permite Juego (también oscuro) y mantiene el escenario del video en negro neutro. Claro/oscuro/auto
  siguen disponibles; no se aplican filtros al video, a la imagen del producto ni al PDF de investigación.
- Compilación Vite correcta. `probar-diseno-juego.cjs`: 19 pantallas sin errores de página, navegación de CTA,
  tres accesos a funciones, carga del arte, cambio entre claro/oscuro/juego, portada sin desbordes a 1440/1024/390,
  y movimiento reducido. Capturas de Inicio, Oficina, Estilos, Crear imágenes y Apariencia revisadas.
- Humo rápido: 85/86. Única falla: el `python3` del PATH del entorno es 3.9.6 y se requiere 3.10–3.13; no causada
  por el diseño. No se generaron anuncios ni se usaron proveedores de pago. No se actualizó la instalación personal.
- Siguiente paso: recibir la versión con «Actualizar» y usar Juego en Ajustes → Apariencia. La velocidad de
  producción y las generaciones no se alteran con este rediseño.

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
