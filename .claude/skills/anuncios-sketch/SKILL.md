---
name: anuncios-sketch
description: 'Produce de punta a punta anuncios "sketch de comedia" con IA, estilo telenovela cinematográfica (se burlan del problema visible del protagonista; un mensajero le pasa el producto como un secreto; remate y link), para cualquier producto, en español, inglés o portugués. Pide el brief, escribe guion con mapa de cámara y actuación, lo presenta para aprobación y luego genera imágenes y clips (Kie: GPT Image 2 + Gemini Omni Flash por defecto, otros modelos o Google Flow en el navegador), monta, revisa y entrega dos versiones (con y sin música). Adapta videos de referencia, produce desde guiones del usuario y ajusta anuncios ya hechos. Usar con "anuncio sketch", "sketch de comedia", "anuncio tipo novela/telenovela", "hazme uno así" con un video de este estilo, "comedy sketch ad", "skit ad", "telenovela-style ad", "anúncio de esquete/novelinha", o /anuncios-sketch; ofrecerlo cuando pidan anuncios con IA sin estilo.'
---

# /anuncios-sketch: sketch de comedia con IA, de la idea al video final

Un mini-sketch de 50 a 70 s con estética de telenovela premium que no parece anuncio. Unos personajes se burlan de un problema **visible y social** del protagonista. En el último tercio aparece alguien que ya lo resolvió y le pasa el producto **como un secreto**. Cierra con un remate y el link.

**Fórmula:** humillación social → mensajero transformado → producto como secreto → remate → link.

La skill nace de la ingeniería inversa de 4 anuncios que convierten en Meta y de dos producciones reales. La segunda ("El baby shower", Nature's Sunshine Lymphatic Drainage) quedó aprobada y es el ejemplo completo de la skill (`assets/ejemplo/`). Todo lo de esta skill está probado; no improvises fuera de ella sin motivo.

## En este sistema (manda sobre lo que digan los demás archivos de la skill)
Esta skill vive dentro del sistema de anuncios (`CLAUDE.md` en la raíz). Donde las referencias digan otra cosa, vale esto:
- **Carpeta del proyecto:** `temp/<slug>/` (minúsculas y guiones, p. ej. `temp/drenaje-baby-shower/`), **nunca** `produccion/` (esa es la carpeta del motor). La foto del producto va como `temp/<slug>/producto.png`, y en `temp/<slug>/producto.txt` escribe en la primera línea el nombre del producto (la app agrupa los anuncios por él).
- **Comandos, siempre desde la raíz del sistema** y con la ruta de la skill: `python3 .claude/skills/anuncios-sketch/scripts/produccion.py temp/<slug> <etapa>` (en Windows, `python` en vez de `python3`). Igual `montaje.py`, `revision.py` y `hoja.py`.
- **La clave de Kie ya está** en el `.env` de la raíz (`kie.py` la encuentra solo). No crees otro `.env` ni le hables de claves al usuario.
- **Requisitos:** antes de producir, comprueba `python3 -c "import faster_whisper, PIL, numpy"`. Si falla, instálalos con su permiso: `pip install -r .claude/skills/anuncios-sketch/scripts/requirements.txt`. Si no hay Python, sigue el Paso 7 de `INSTALAR.md` de la raíz. Avísale que la primera revisión descarga unos 3 GB de modelos de transcripción (una sola vez).
- **Solo Kie.** Google Flow y el navegador no se usan en este sistema.
- **El costo (regla 1 de `CLAUDE.md`):** `produccion.py temp/<slug> estimar` da el total del anuncio. Ese total en US$ (1 crédito = US$0,005) va en el resumen, y no se genera nada sin el sí. Las etapas que cobran son `refs`, `frames`, `video` y `rehacer`; `pendientes` retoma lo ya pagado y no cobra. Regenerar algo después de aprobado se pregunta antes, con su costo.
- **El cierre de la parte creativa (regla 10 de `CLAUDE.md`):** la propuesta completa se escribe en `temp/<slug>/GUION.md`, pero **en el chat va solo un resumen corto**: la idea en una línea, los personajes, el escenario, la duración, las dos o tres líneas más fuertes del guion y el costo. Después, tres opciones: A) producirlo todo, B) generar solo las imágenes y los clips (sin montaje), C) ver la propuesta completa (el contenido de `GUION.md`) para revisarla, y después ofrecer A o B. `proyecto.json` y `manifest.json` son internos: no se muestran en el chat.
- **Cómo correr las etapas largas:** en la app de escritorio, cada etapa que cobra va **sola** en su comando, sin `&&`, sin `>` ni `2>&1`, y sin segundo plano: la app la corre aparte, muestra el costo y el progreso, y la retoma si se cierra. En la terminal de Claude Code, como dice `produccion.md` (en segundo plano).
- **Música, transiciones y voz:** este estilo trae su propia música (`assets/musica/musica_sketch.mp3`) y su propio montaje (`montaje.py`). No usa las transiciones del sistema, ni ElevenLabs, ni Suno, ni Remotion del motor: las voces salen de los clips.
- **Revisión de los clips:** las tres puertas de calidad (`qa.md`) son la revisión obligatoria de los clips hablados (regla 4 de `CLAUDE.md`). Después de la Puerta 2 (fotogramas) y antes de montar, muéstrale al usuario lo que encontraste en cada toma y espera su visto bueno.
- **Entrega:** copia los dos finales a `output/<slug>_con-musica.mp4` y `output/<slug>_sin-musica.mp4` y entrégale esos. El informe de entrega (`INFORME.md` de la skill) va dentro de `temp/<slug>/informe-revision.md`, junto con el barrido que pide el sistema al terminar cada video. No escribas dos informes.
- **Aprendizajes:** al empezar, lee `mis_archivos/biblioteca/aprendizajes/general.md` (reglas generales para todos los productos y estilos) y `mis_archivos/biblioteca/aprendizajes/sketch.md` (si existe). Al terminar, anota lo aprendido como reglas generales (sin el producto ni la marca): casi todo en `general.md` bajo su tema, y en `sketch.md` solo lo propio del sketch; además de `references/lecciones.md`.

## Archivos (léelos cuando el paso lo indique)
| Archivo | Para qué |
|---|---|
| `references/formato.md` | Qué es el formato, beats, variantes A/B, por qué funciona, gramática visual, reglas de guion, cierres, escenarios, plantillas, arquetipos |
| `references/actuacion.md` | Cómo se dice cada línea (patrones medidos) y vocabulario de entrega para los prompts |
| `references/referencias-analizadas.md` | Las 4 referencias, toma por toma |
| `references/camara-y-ejes.md` | Mapa de ejes, quién mira a quién, coberturas. **Obligatorio antes de escribir tomas** |
| `references/prompts.md` | Cómo escribir cada campo; bloque de quién habla y quién calla; filtros de los modelos; marca en el diálogo |
| `references/produccion.md` | Paso a paso con los scripts, corridas largas, puertas de calidad, ajustes, otro idioma |
| `references/montaje.md` | Cortes, parpadeos, ambiente, efectos, packshot, cierres, música, sincronía |
| `references/remotion.md` + `remotion/` | Motion graphics opcionales: plantilla de Remotion incluida y sus reglas |
| `references/qa.md` | Las 3 puertas de calidad y diagnóstico de fallas |
| `references/modelos.md` | Modelos de Kie, parámetros, costos, modo personaje + voz de Omni |
| `references/google-flow.md` | Producir en Google Flow desde el navegador del usuario |
| `references/analisis-de-referencias.md` | Desarmar y adaptar un video de referencia; trabajar con un guion del usuario |
| `references/lecciones.md` | Errores reales que ya pasaron y cómo se evitan |
| `assets/ejemplo/` · `assets/plantilla_proyecto.json` | Proyecto aprobado completo (19 tomas, con la foto del producto) · plantilla comentada |
| `assets/plantilla_propuesta.md` | Formato de la propuesta que el usuario aprueba |
| `assets/musica/musica_sketch.mp3` | Música de fondo oficial del formato |
| `scripts/` | `produccion.py` · `montaje.py` · `revision.py` · `hoja.py` · `analizar_referencia.py` · `kie.py` · `modelos.py` · `comun.py` |

## Flujo

### 1. Entender el pedido
Identifica el modo y sigue el camino que corresponde:
- **Desde cero:** el usuario trae un producto.
- **Desde una referencia:** trae un video que le gusta → `analisis-de-referencias.md`.
- **Desde su guion:** respétalo y ponle dirección (`analisis-de-referencias.md` §4).
- **Ajuste o nueva versión** de un anuncio ya producido → `produccion.md` §7–8. Solo se rehace lo necesario.

### 2. Brief (pide solo lo que falte, en un solo mensaje)
1. **Producto:** link de la página o un brief. Si hay link, léelo tú (web fetch): qué es, mecanismo o ingredientes, beneficios, precio y garantía.
2. **Foto real del producto:** PNG o JPG nítido, ideal con fondo limpio. Es obligatoria: es la referencia de la etiqueta.
3. **El problema visible y social que resuelve:** lo que otros notan y comentan (o el resultado visible, en la variante B). Propónlo tú desde la página y que el usuario lo confirme.
4. **País, idioma y acento:** español de Colombia (paisa, rolo, costeño), México, Perú…; inglés de EE. UU.; portugués de Brasil. Define la jerga, la voz y `idioma_dialogo`/`idioma_whisper`.
5. **Oferta:** contraentrega, envío gratis, 2×1, garantía. Va dicha en el diálogo.
6. **Restricciones de claims:** salud o belleza con "ayuda a", y lo que la marca no permite decir.
7. **Público:** género y edad del cliente, para el casting de la víctima.
8. **Preferencias** (con valores por defecto si no dice nada):
   - Duración: 55–65 s.
   - Cierre: packshot con textos.
   - Modelos: GPT Image 2 + Omni Flash vía Kie.
   - Música: la oficial.
   - Formato: 9:16.
9. **Referencias** (opcional): video que le gusta, guion propio, logo o nombre de marca para el cierre.
Si el usuario ya dio algo en la conversación, no lo vuelvas a preguntar. Para elecciones cerradas (variante, cierre, proveedor) usa AskUserQuestion si está disponible.

### 3. Preparar (mientras el usuario responde o justo después)
Crea la carpeta del proyecto (`produccion/<marca>_<idea>/`) con la foto del producto. Prepara el `.env` para la clave de Kie (el usuario la pega él mismo; ver `produccion.md` §0) y revisa el saldo. Si va por Google Flow, confirma que tenga sesión iniciada en Chrome.

### 4. Concepto y guion
Lee `formato.md`, `actuacion.md`, `camara-y-ejes.md` y `prompts.md`. Luego:
- **Variante:** A (humillación → rescate) si resuelve un problema vergonzoso; B (chisme → secreto) si es aspiracional.
- **Escenario:** el lugar donde ese problema duele más en público.
- **Arquetipos:** víctima querible, verdugo sincero, abuela que remata con ternura, mensajero transformado, tercero del remate.
- **Guion:** de 15 a 22 tomas con el mapa de beats. Una línea por toma, de 4 a 12 palabras. La línea del producto (de 15 a 20 palabras) lleva qué es + "ayuda a" + mecanismo de calle + oferta, y baja la voz en la oferta.
- **Mapa de ejes por escena:** quién está a la izquierda y quién a la derecha. Cada toma lleva su plano y su mirada.
- **Entrega dirigida** en cada línea (`actuacion.md`).
- **Cierre:** packshot en el set con 1–2 textos, u otro de los modelos de `montaje.md`.
- Escribe `proyecto.json` (desde `assets/ejemplo/proyecto.json` o la plantilla) y pasa la **Puerta 1** de `qa.md`.
- Calcula el costo con `produccion.py <carpeta> estimar`.

### 5. Propuesta y aprobación (obligatorio)
Llena `assets/plantilla_propuesta.md`: la idea, por qué funciona para su producto, personajes, locación, mapa de cámara, guion toma por toma con entrega y duración, modelos, costo y entrega. Muéstrala completa en el chat y guárdala también como `GUION.md` en la carpeta del proyecto.
**No generes nada hasta que el usuario la apruebe.** Si pide cambios, ajusta `proyecto.json` y vuelve a mostrar lo que cambió.

### 6. Producción
Sigue `produccion.md` al pie de la letra. Las etapas largas (refs, frames, video, montaje, revisión) se corren **en segundo plano** y **no se relanzan** mientras sigan vivas. Si algo se corta, `pendientes` retoma sin volver a pagar.
Si el proveedor es Google Flow (`"proveedor": "flow"`), refs, frames y video se hacen en el navegador (`google-flow.md`) y cada archivo se guarda con `registrar`. Montaje y revisión son iguales.
1. `refs` → revisa la hoja.
2. `frames` → **Puerta 2** (miradas, producto y lados, con `hoja.py`). Regenera lo que falle **antes** de animar.
3. `video` → revisa las hojas de clips (miradas durante la línea, terceros que hablan, producto).
4. `montaje.py` → `revision.py` → **Puerta 3** (incluida la sincronía). Mira tú mismo `hoja.py final`.

Avísale al usuario en qué paso vas. Las imágenes tardan unos minutos; los clips, de 5 a 15.

### 7. Entrega
- `FINAL_con_musica.mp4` + `FINAL_sin_musica.mp4`, siempre las dos.
- `INFORME.md`: qué se corrigió, créditos y aprendizajes.
- En el mensaje: qué revisaste, qué corregiste en el camino y lo que no pudiste verificar. Si algo de la propuesta cambió (por ejemplo, una línea que el filtro obligó a reescribir), dilo.

### 8. Ajustes y nuevas versiones
El usuario puede pedir cualquier cambio: una toma, una línea, una mirada, un personaje, la música, el cierre, la duración, el idioma, el modelo. Ubica la toma (por el segundo que menciona, con `montaje/qa.json` → `inicio_en_video`), diagnostica con fotogramas de ese instante y rehaz solo lo necesario (`produccion.md` §7). Para otro idioma o país, sigue `produccion.md` §8. Vuelve a pasar `revision.py` y entrega las dos versiones otra vez.

## Proveedores y modelos
- **Por defecto: Kie** con `gpt-image-2` + `omni-flash`.
- **Otros modelos de Kie:** se cambian en `proyecto.json` → `modelos` (`nano-banana-2`, `nano-banana-2-1`, `seedream-4.5`, `seedance-2`, `kling-3`, `veo-3.1-fast`…; ver `modelos.md`). Si nombra uno que no está en `modelos.py`, busca su página en docs.kie.ai y agrega el adaptador.
- **Google Flow:** si el usuario pide generar en su cuenta, usa su navegador (Claude in Chrome), con Nano Banana para las imágenes y Gemini Omni Flash para los videos. Sigue `google-flow.md`, registra cada archivo con `produccion.py registrar` y confirma el costo en créditos de Flow antes de generar.
- **Cualquier otra herramienta:** descarga los resultados, regístralos y sigue con el montaje.
- **Motion graphics más elaborados:** la plantilla de Remotion incluida (`remotion.md`).

## Reglas que no se rompen
1. **La aprobación del guion va antes de gastar un crédito.**
2. **Mapa de ejes y miradas:** nadie mira al lente sin motivo (`a_camara` solo en la foto o en el CTA), y el mensajero le habla a la víctima, no a la cámara.
3. **Cada prompt de video dice quién habla** (por su ropa y su posición), **cuándo, y que los demás callan.** Las tomas mudas dicen que nadie habla.
4. **Producto real:** foto de referencia en cada toma donde aparece y descripción física exacta. El packshot sale de la imagen fija, nunca del modelo de video.
5. **Un solo plano por clip:** el montaje esquiva los cortes internos.
6. **El audio de las tomas mudas se reemplaza por ambiente verificado.** Los efectos que el modelo no hace bien se agregan en edición.
7. **Dos versiones, con y sin música,** a −14 LUFS, con la voz siempre por encima y sincronizada con los labios.
8. **QA completa** (diálogo, idioma, voces fantasma, parpadeos, miradas, producto, sincronía, volumen) antes de entregar. Lo que no se pudo verificar, se dice.
9. **Claims seguros:** "ayuda a", nada de curas ni promesas absolutas.
10. **Seguridad:**
    - La clave de Kie la pega el usuario en `.env`; nunca se pide por el chat, nunca se lee ni se imprime.
    - En el navegador: no escribir contraseñas, no comprar créditos, no resolver CAPTCHAs, no borrar nada.
    - Gastos por encima de lo estimado en la propuesta se confirman antes.

## Requisitos técnicos
Python 3.10+, ffmpeg y ffprobe, y `pip install -r <skill>/scripts/requirements.txt`. Node.js solo si se usa Remotion. Si falta algo, instálalo (o pídele al usuario que lo instale) antes de producir. En este sistema, ver "En este sistema" arriba.
