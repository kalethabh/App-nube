# Las 6 etapas y sus secciones obligatorias

Si el usuario pega su propio texto de prompt, ese texto manda. Esto es lo mínimo que cada etapa debe tener.

## Contenido
1. Investigación maestra (MASTER PROMPT/RESEARCH)
2. Ganadores (LONGEST RUNNING ADS ONLY)
3. Base de hooks (HOOK DATABASE EXTRACTION)
4. Mapa de saturación de ángulos (ANGLE SATURATION MAP)
5. Avatares
6. Validación por país o región

---

## 1. Investigación maestra: 10 secciones

1. **Panorama competitivo.** Ficha de la marca (ingresos 30 d, unidades, precio por unidad, tráfico y crecimiento, anuncios activos e históricos, páginas que pautan, catálogo con precios). Tabla de competidores: `find_similar_shops` más los que dominan el mercado por palabra clave (ver `trendtrack.md`). Di quién es el competidor real, que muchas veces no es otra marca del mismo producto, sino otra solución al mismo problema.
2. **Familias de creativos ganadores** (A, B, C…): cada familia con su lógica y su pico de volumen.
3. **Desglose de 5 o 6 anuncios top:** gancho en inglés con traducción, ángulo, estructura, avatar, cifras, link e ID.
4. **Patrones:** la estructura del guion paso a paso y las frases que se repiten.
5. **Sofisticación del mercado** (escala de Schwartz 1–5), de la marca y del mercado por separado.
6. **Estáticos:** proporción imagen/total y los estáticos más fuertes con link.
7. **Embudo y landings:** tabla de destinos (URL, promesa traducida, ángulo).
8. **Oferta, precio y retención:** precio, packs, regalos, garantía, escasez, email. Contrasta lo que dicen los anuncios con la etiqueta o fuentes externas.
9. **Mapa de oportunidades:** 5 o 6, cada una con su evidencia.
10. **Plan de ejecución:** top 10 hooks (inglés y español) y una secuencia de prueba de 3 semanas.

## 2. Ganadores: solo evidencia de escala

Prioriza: más días al aire, más variantes duplicadas, más iteraciones de gancho, más versiones redimensionadas, conceptos en estático y video, relanzamientos. Ignora guiones de prueba.

Criterio de ganador (decláralo al inicio): al menos tres de impresiones o alcance alto, varios anuncios del mismo guion o creativo, varios ganchos sobre el mismo cuerpo, versión estática y en video (o landing propia), relanzamiento después de semanas. Descarta guiones de 3 anuncios con menos de 1.000 impresiones, y anuncios longevos con alcance mínimo.

Para cada ganador (6 a 8):
- Evidencia en cifras (impresiones, anuncios, días, fechas, estático y video sí o no, relanzado sí o no).
- Gancho en inglés con traducción.
- La estructura exacta como secuencia de pasos.
- La razón psicológica de su escala.
- Los ganchos probados sobre el mismo cuerpo.
- Links e IDs.

Después:
- Tabla de lo que nunca cambia frente a lo que prueban.
- La razón psicológica de fondo común a todos.
- Reporte de patrones.
- Sofisticación del mercado.
- Futuros ganadores probables: tabla con concepto, señal temprana con dato y fecha, y por qué podría ganar.

## 3. Base de hooks

Extrae los hooks de la marca **y de los competidores del mercado** (no solo de la marca). Usa las transcripciones del brandtracker y búsquedas por crecimiento de 7 días.

12 categorías: miedo, curiosidad, contrarian, autoridad, consciente del problema, consciente de la solución, consciente del producto, muy consciente, vanidad, identidad, aspiración, urgencia.

Para cada hook (apunta a 40–50):
- Texto original y traducción.
- Fuente y evidencia: marca, número de anuncios, impresiones o alcance, fechas, ID.
- Etapa de conciencia.
- Gatillo emocional.
- Avatar.
- Por qué funciona.
- Saturación (alta, media o baja).
- Versión mejorada y modernizada en español.

Entrégalo en un bloque con filtros: fuente (marca o competidores), categoría y saturación. Plantilla en `formato-visual.md`.

Después, en texto y tablas:
- Los más repetidos.
- Los más escalables.
- Los más probablemente fatigados.
- Los estilos emergentes, con dato y fecha.

## 4. Mapa de saturación de ángulos

Mide el mercado, no solo la marca: cuenta anuncios activos que combinan la palabra del producto con cada ángulo (ver `trendtrack.md`). Declara que la búsqueda lee el copy, no el video.

Identifica:
- Ángulos sobreusados.
- Ángulos frescos.
- Impulsores emocionales poco usados.
- Avatares sin explotar.
- Claims sobreusados.
- Posicionamiento débil que todos repiten.
- Estilos visuales que se están gastando.

Después:
- Oportunidades contrarias, con un ejemplo de frase.
- Posicionamiento de océano azul.
- Mecanismos nuevos, marcados como hipótesis que hay que sustentar.
- Estructuras narrativas nuevas.
- Direcciones visuales nuevas.
- Arquetipos de creador nuevos.

Cierra con tu lectura crítica: las 2 o 3 apuestas con mejor relación entre oportunidad y riesgo, y lo que no harías.

## 5. Avatares

Para cada avatar del mercado (6 a 9):
- Nombre descriptivo.
- Frase en su voz.
- Perfil (edad, situación, dolor, deseo).
- Producto o ángulo que le habla.
- Ganchos que lo atrapan.
- Evidencia (anuncios, impresiones, fechas).
- Volumen.
- Momento (creciendo, estable, desacelerando, emergente).
- Saturación.

Ordénalos en un ranking: saturados en rojo, en crecimiento en ámbar, vírgenes o emergentes en verde. Termina con una tabla resumen por señal y con cuáles elegirías para entrar y por qué, si el usuario lo pide o si el prompt lo incluye.

Aclara que TrendTrack no da demografía de la audiencia: los avatares se deducen del copy, los ganchos y las landings.

## 6. Validación por país o región

El usuario indica [PAÍS o REGIÓN]. Solo se quiere saber si ya existen ofertas con ángulos similares. Sin análisis operativo (contra entrega, logística, márgenes), salvo que lo pida.

**Búsqueda.** Usa `search_ads` con `ad_countries={"include":[códigos ISO del país o la región]}`, en el idioma local, con los términos del problema, la solución, el mecanismo y los hooks principales, traducidos como los diría la gente. Para el estado del mercado combina tres órdenes: `mostDuplicates`, `newest` y `min_days_running=30`.

**1. Cruce completo.** Clasifica cada elemento de las etapas 1 a 5 como ya existe, parecido, no existe o sin verificar:
- Cada ganador de la etapa 2, uno por uno.
- Los hooks y estilos de hook de la etapa 3, incluidos los emergentes.
- Los ángulos, oportunidades y contrarians de la etapa 4.
- Cada avatar de la etapa 5.
- Ángulos o avatares locales que no estaban en la investigación original.

**2. Competencia directa frente a alternativas.** Separa siempre:
- **Directa:** el mismo tipo de producto (por ejemplo aceites, cremas o geles frente a un aceite).
- **Alternativas:** otras soluciones al mismo problema (fajas, leggings, clínicas, aparatos, suplementos).
Solo la competencia directa cuenta para decir que un ángulo "ya existe". Las alternativas se reportan aparte: sirven para entender en qué se gasta el público y para ángulos contrarios.

**3. Evidencia de cada caso que existe:**
- Marca y producto.
- Texto del anuncio (con traducción si no está en español).
- Fecha de inicio y días al aire.
- Número de versiones.
- Link al anuncio (Media URL) con su ID.
- Link a la página de aterrizaje. Si el anuncio va a WhatsApp o no tiene landing, dilo.

**4. Permanencia (columna principal).**
- **Prueba:** menos de 2 semanas.
- **Sostenido:** de 1 a 3 meses.
- **Consolidado:** más de 3 meses o con relanzamientos.
Responde la pregunta que importa: ¿este competidor se queda? Un hueco ocupado solo por pruebas sigue siendo un hueco.

**5. Tipo de vendedor (columna secundaria, opcional).** Dropshipping probable, marca probable o no se puede saber. Llénala solo cuando las señales sean claras: subdominio myshopify o tienda genérica, el mismo producto en varias tiendas, páginas con nombres de persona que rotan, copy copiado, catálogo sin relación entre sí. En los casos dudosos escribe "no se puede saber". Las fichas de tienda (`search_shops` con `match_mode=exact`, unos 4 créditos cada una) solo para los casos dudosos que pesen en la conclusión.

**Conclusión de oportunidad:**
- Veredicto (viable, viable con condiciones o no viable) y por qué, en una frase.
- Tabla de lo que sigue libre frente a lo que ya está ocupado por competidores consolidados.
- Etapa de sofisticación del mercado local por subcategoría (escala de Schwartz), frente al mercado original.
- Hipótesis de hueco a ocupar (H1, H2…), cada una con su evidencia y su riesgo, más una hipótesis de dónde no entrar.
- La combinación recomendada para llegar primero: ángulo, mecanismo, avatar y gancho, entrando un paso por delante del mercado, no dos.
- Ventana de tiempo según los imitadores que ya están probando.
- Limitaciones: fuera de la UE no hay alcance ni gasto; la búsqueda lee el copy, no el video; la clasificación de vendedores es probable.

Costo de referencia: 150 a 200 créditos si se hace una sola vez.
