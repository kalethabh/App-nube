---
name: "investigacion-trendtrack"
description: Investigación competitiva de marcas y productos con TrendTrack en 6 etapas (investigación maestra, ganadores, base de hooks, mapa de saturación de ángulos, avatares y validación por país o Latinoamérica), entregada como bloques visuales HTML dentro del chat, paso a paso. Úsala SIEMPRE que el usuario pegue un link de TrendTrack (app.trendtrack.io/...shop=...), pida analizar una marca, tienda o competidor con TrendTrack, pegue cualquiera de los prompts "MASTER PROMPT/RESEARCH", "LONGEST RUNNING ADS ONLY", "HOOK DATABASE EXTRACTION", "ANGLE SATURATION MAP" o de avatares, o pida validar la investigación en Latinoamérica o en un país (ej. Colombia), o diga "sigue", "siguiente prompt" o "etapa 2/3/4/5/6" dentro de una investigación de anuncios, aunque no mencione esta skill.
---

# Investigación competitiva con TrendTrack

Flujo de 6 etapas para desarmar una marca (o un producto de una marca) y su mercado con los datos de TrendTrack. El usuario es director creativo de una operación de e-commerce grande: quiere profundidad de experto, resultados completos y sin filtrar, y evidencia verificable detrás de cada afirmación.

## Reglas que no se negocian

1. **Un prompt por turno.** Haz una etapa completa, entrégala y pregunta si sigues. No adelantes etapas.
2. **Cobertura completa.** Cada etapa tiene todas sus secciones (ver `references/prompts.md`). Nunca entregues una versión resumida o parcial: fue la queja principal del usuario. Si falta un dato, investígalo; si no existe, dilo.
3. **Formato: bloques visuales HTML dentro del chat**, con la herramienta de visualización inline (`show_widget`, después de cargar `read_me` en silencio). No crees archivos, artefactos publicados ni links, salvo que el usuario lo pida. Si la herramienta no está disponible, avísalo en una línea y usa el formato más cercano (markdown bien estructurado).
4. **Evidencia en todo.** Cada anuncio citado lleva: ID (facebook_…), fechas, número de anuncios del guion o del creativo, días al aire, alcance o impresiones, y link al video o la imagen (Media URL).
5. **Inglés con traducción.** Todo texto en inglés de un anuncio (gancho, guion, copy, titular de landing) va con su traducción al español justo al lado.
6. **Dato vs. inferencia.** Marca cada punto relevante como **Dato** (sale de TrendTrack o de una fuente pública) o **Inferencia** (tu lectura).
7. **Sin filtro por encaje.** No descartes hallazgos porque no encajan con la operación del usuario (ticket, país, categoría, modelo). El juicio de encaje va aparte y solo si lo pide.
8. **Crítico, no complaciente.** Señala debilidades de los datos, contradicciones y riesgos. Corrige tus propios errores de etapas anteriores apenas los detectes.
9. **No uses el conector de iComfly** en estos análisis.
10. Escribe en español. La jerga técnica está bien. Si el producto es difícil de entender (vende una causa invisible, sirve "para todo"), explícalo en una frase al inicio.

## Flujo de investigación

### 0. Arranque (solo en la etapa 1)

- Extrae el `shop` del link de TrendTrack.
- `brief_competitor` con el shop ID: tráfico, ingresos, unidades, anuncios activos, catálogo, emails, creativos top.
- Revisa si la marca está en el brandtracker (`list_tracked_brands`). Si no está, **pide permiso** para agregarla (`add_to_brandtracker`, gasta créditos) y explica que sin eso no hay transcripciones de los guiones.
- Si el usuario indica un producto puntual de la marca, enfoca todo en ese producto.

Detalles de herramientas, costos y trampas de datos en `references/trendtrack.md`. Léelo antes de la primera búsqueda de cada investigación.

### Etapas

Las 6 etapas, con sus secciones obligatorias y el orden de entrega, están en `references/prompts.md`. Léelo al empezar cada etapa. Si el usuario pega su propio prompt, ese prompt manda: cubre todo lo que pide, en su orden.

## Cómo entregar cada etapa

Patrones visuales, CSS base y la plantilla del bloque de hooks con filtros: `references/formato-visual.md`.

Estructura de cada respuesta:

1. Una o dos líneas de contexto: qué investigaste y cualquier advertencia sobre los datos que cambie la lectura (por ejemplo, la marca tiene solo 4 meses de anuncios).
2. De 2 a 4 bloques visuales, **siempre con texto entre ellos** (nunca dos bloques seguidos).
3. Las tablas comparativas van en markdown, fuera de los bloques.
4. Cierre: limitaciones de los datos, riesgos de política o de promesas, y la pregunta "¿Sigo con la etapa N?".

No repitas en texto lo que ya mostró un bloque visual.

## Resumen de traspaso

Al terminar la etapa 5 o la 6, ofrece el **resumen de traspaso**: un archivo .md con toda la investigación condensada (marca, mecanismo, ganadores con IDs y links a anuncios y landings, hooks, saturación, avatares, validación por país, hipótesis y decisión preliminar, riesgos y límites), separando datos de inferencias. Es la entrada de la skill `landings-respuesta-directa` y de cualquier chat nuevo. Recomienda seguir en un chat nuevo adjuntando ese archivo.

Si el usuario adjunta un resumen de traspaso al empezar, úsalo como base y no repitas búsquedas que ya están ahí.

## Costos de referencia

Una investigación completa desde cero cuesta entre 450 y 650 créditos de TrendTrack. La etapa 1 es la más cara (~220) y la 6 cuesta 150 a 200. Para ahorrar: pide 10 resultados en vez de 20 cuando alcance, mide ángulos con conteos de `limit=1` (~2 créditos) y no repitas búsquedas. Recomienda una marca por chat: los chats largos consumen mucho más uso de Claude por mensaje.

## Limitaciones que siempre hay que declarar cuando apliquen

- El alcance y el gasto de TrendTrack salen del registro de transparencia de Meta en la UE. Son confiables para marcas europeas y muy subestimados para marcas de EE. UU. En ese caso, ordena por número de anuncios por guion e impresiones de transcripciones, no por alcance.
- La búsqueda por `ad_copy` lee el texto escrito, no lo que se dice en el video. Un ángulo puede estar en cientos de videos y aparecer en pocos copys.
- TrendTrack no separa ingresos por producto.
- Si la marca es nueva, "el anuncio más longevo" tiene techo: dilo.
- Anuncios con muchos días al aire pero alcance mínimo no son ganadores: siguen encendidos sin gastar.
- Las landings muchas veces no se pueden abrir: entrega el título y la URL, y aclara que no se vio el contenido.

## Riesgos que hay que señalar

Promesas de salud (curar, eliminar parásitos, bajar X kilos, presión arterial), promesas cosméticas absolutas ("elimina la celulitis", "80 % menos en 5 semanas"), expertos con nombres no verificables, segmentación por atributos personales (raza, salud) y productos dirigidos a niños. Preséntalos como dato del mercado y sugiere la versión defendible ("reduce la apariencia de…"), nunca como plantilla para copiar.


## Dentro de la app Kads Studio
Cuando la tarea viene de la app (dice en qué archivo escribir), estas reglas cambian y mandan sobre las de arriba:
- **Las 6 etapas de una vez, sin preguntar.** No hay chat: nadie contesta. No entregues una etapa y esperes; haz la 1, la 2, la 3, la 4, la 5 y la 6 seguidas, cada una completa, con todas sus secciones de `references/prompts.md`.
- **Formato:** no uses show_widget ni HTML, y no leas `references/formato-visual.md`. Escribes el CONTENIDO en el archivo JSON que indica la tarea, con los bloques que ella define (métricas, barras, tarjetas de anuncio, hooks, avatares, tablas, cajas). La app los dibuja.
- **Brandtracker:** la tarea dice si puedes agregar la marca (`add_to_brandtracker`). Si no puedes y la marca no está, sigue sin transcripciones y dilo en las advertencias.
- **Créditos:** consulta `check_credits` al empezar y al terminar y anótalo. Respeta los ahorros de «Costos de referencia». Si los créditos no alcanzan para seguir, termina con lo que tengas y dilo en las advertencias; nunca inventes datos para rellenar.
- **País de la etapa 6:** el que dice la tarea.
- No hay resumen de traspaso ni chat nuevo: todo queda en el archivo.
