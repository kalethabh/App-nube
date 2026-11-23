# Agentes de Kads Studio: diagnóstico y estructura de mejora

Fecha: 23 de noviembre de 2026. Estado: propuesta preparada para implementar por etapas; no modifica el motor de producción.

## 1. Decisión principal

Organizar el trabajo alrededor de un encargo verificable: qué se quiere lograr, qué se conserva, qué puede cambiar, qué evidencia se usa, cuánto puede costar y quién acepta cada entrega. Mantener los personajes de la oficina y conectar sus estados a ese trabajo real.

La mejora no requiere convertir cada personaje en otra conversación de IA. Un especialista debe existir como ejecución separada cuando aporta una decisión propia o una revisión independiente. Generar un archivo, exportar o calcular el precio suelen ser tareas de software. Separarlas evita más espera, contexto repetido y contradicciones.

El primer proyecto debe ser **variaciones fieles de anuncios de imagen**, de principio a fin. Es acotado, permite comprobar fidelidad, coordinación, costo y memoria; después se extiende a videos e investigación.

## 2. Alcance y límites del análisis

Auditoría de código en `main`, commit `da9d67ffb41aedf473600a82fb8e69e9b3295788`, y pruebas simuladas del chat y las cadenas de producción. No se revisaron credenciales ni campañas personales, ni se ejecutaron generaciones pagadas. No hay una medición de ventas, ROAS, latencia real de proveedores o calidad visual de una muestra de anuncios reales. Las metas posteriores son objetivos propuestos, no mejoras ya demostradas.

La estructura aquí descrita es una propuesta. Los personajes, los modos actuales y los mecanismos existentes se conservan hasta implementar y validar cada cambio. Este documento no convierte automáticamente una recomendación en funcionalidad publicada.

## 3. Qué hay hoy

| Capa | Situación comprobada | Implicación |
|---|---|---|
| Oficina | 35 roles: coordinación 1, video 6, investigación 5, imagen 6, landing 6, WhatsApp 6 y análisis 5. | Son roles visuales y operativos; no equivalen a 35 procesos autónomos. |
| Cadenas visibles | Video, imagen e investigación tienen cadenas; landing, WhatsApp y análisis figuran como «pronto» en la oficina. | No presentar esos 17 roles futuros como departamentos autónomos ya operativos. La app sí tiene una función de landings; su existencia no integra toda la cadena de la oficina. |
| Coordinadora | Interpreta el pedido, prepara acciones, crea encargos, presenta costos y sigue resultados. | Es la base adecuada para dirigir el flujo, pero necesita contratos más explícitos. |
| Producción | Hay conductor, estados persistidos, revisiones, costos y filas de recursos. | Evolucionar esta base; no construir otro orquestador paralelo. |
| Especialistas | Estrategia, prompts, revisión y ajustes ya tienen tareas, esquemas y comprobaciones. Los agentes `director-creativo` y `supervisor-generaciones` están documentados para Claude Code. | Un archivo de agente no demuestra su invocación automática en cada anuncio de la app. Unificar contratos donde realmente se ejecutan las tareas. |
| Memoria | Preferencias, reglas por estilo, motivos de corrección y votos sobre imágenes. | Hay material útil; falta distinguir gusto, corrección técnica e impacto comercial. |

## 4. Hallazgos y prioridad

### P0 — La fidelidad debe ser un contrato, no una interpretación

El modo del agente de variaciones reparte piezas entre A, B y C; en B y C pide cambiar al menos dos variables. Es razonable para explorar conceptos, pero entra en conflicto con pedidos como «solo cambia los títulos». Además, el chat tiene una ruta rápida propia que no pasa por toda la estrategia y revisión. La garantía de fidelidad debe aplicarse en todas las entradas, no depender del camino que elija la coordinadora.

**Propuesta:** representar tres intenciones: `solo_titulos`, `variacion_fiel` y `explorar_conceptos`. El pedido explícito domina el reparto A/B/C. Si solo cambian títulos, bloquear estructura, producto, promesa, escena, oferta y composición según la referencia. Si el generador no puede garantizar conservar los píxeles, informarlo y preferir editar una capa de texto cuando sea posible. No prometer identidad visual exacta a partir de una regeneración completa.

### P0 — Corregir la prioridad de la memoria por producto

En `oficina-votos.js`, `deEste(productoId)` concatena primero los votos propios y después los ajenos, pero aplica `reverse()` a todo el resultado. Así los ajenos quedan primero. Una reproducción con dos votos sintéticos devuelve `[otro, propio]`. Como las lecciones toman solo los primeros 5 u 8 de cada tipo, pueden desplazar el contexto del producto actual.

**Propuesta:** ordenar por fecha dentro de cada grupo y concatenar primero el producto actual; permitir aprendizajes ajenos solo como principios generales identificados. Añadir una prueba donde los ajenos superen el límite de selección. No modificar los votos guardados.

### P0 — Vincular el estado a una entrega aceptada

La oficina infiere estados desde los pasos y archivos. En investigación, marca público y oportunidades como hechos mediante búsquedas de «avatar» o «andromeda|conceptos» en el texto de una investigación lista. En imagen, la existencia de piezas puede marcar prompts hechos; una revisión presente puede marcar revisión hecha. Estos atajos no prueban la aceptación de todas las entregas esperadas.

**Propuesta:** estado por tarea y versión; cantidades `aceptadas / esperadas`, con acceso a la evidencia. «Hecho» exige todos los elementos obligatorios aceptados. Los estados históricos inferidos deben decir «estimado» hasta poder validarlos; no inventar eventos retroactivos.

### P0 — Validar la acción completa antes de ejecutarla

El verificador de respuesta del chat comprueba que `respuesta` tenga texto. El ejecutor sí aplica varias validaciones locales: producto, estilo, cantidades, encargo y estado previo a producir. También existe revisión de aumento de precio para imágenes. No son garantías ausentes; están repartidas entre funciones.

**Propuesta:** esquema estricto por tipo de acción y una comprobación central de autorización antes de efectos secundarios. Asociar la aprobación con la versión exacta del encargo, piezas, modelo y costo máximo. Un «dale» puede continuar un único pedido inequívoco; si hay varios esperando, pedir elegir. Duplicar una respuesta o recuperar una tarea tras reinicio no debe duplicar producción ni cobros.

### P1 — La memoria actual mezcla señales distintas

Una opinión positiva con texto puede convertirse en «Funciona, repetirlo» y una negativa en regla de evitar, por estilo o general. Eso registra preferencia del usuario, pero no demuestra una mejora comercial. Los aprendizajes también se recortan por longitud y últimas entradas.

**Propuesta:** guardar cada lección con tipo, producto/estilo, origen, fecha, confianza y estado. Una preferencia explícita del usuario se aplica en su ámbito; una hipótesis creativa no se transforma en regla universal. Para decir «vende mejor» exigir datos de campaña comparables.

### P1 — Medir dónde se va el tiempo antes de aumentar agentes

Ya existe una fila compartida de IA con máximo de dos sesiones y control de recursos para generación y tareas pesadas. Añadir llamadas por cada personaje puede aumentar la cola. Hoy los límites y mecanismos están repartidos entre chat, sesiones, conductor y filas.

**Propuesta:** medir espera en cola, preparación, IA, proveedor, revisión y exportación por separado. Reutilizar investigación y análisis aceptados, ejecutar en paralelo solo piezas independientes y respetar los límites existentes. Optimizar el tramo dominante medido.

## 5. Estructura de trabajo propuesta

### Dirección y responsabilidades

| Responsable funcional | Recibe | Entrega obligatoria | Se acepta cuando |
|---|---|---|---|
| Coordinación — Valentina | Pedido, archivos y preferencias aplicables | Encargo estructurado, plan y decisiones pendientes | Intención, alcance, restricciones y costo están claros; no contradice el pedido. |
| Investigación — Sofía y equipo | Producto, país, público y preguntas | Evidencias con fuente y fecha; dolores, deseos y objeciones | Cada afirmación importante tiene respaldo o figura como hipótesis/no disponible. |
| Estrategia — Mariana | Encargo y evidencia aceptada | Razón de compra propuesta, invariables, variables e hipótesis por pieza | Se distingue observación de inferencia; respeta el modo solicitado. |
| Copy y guion — Mateo / especialidad de imagen | Estrategia, idioma y restricciones | Titulares o guion con IDs estables y soporte de promesas | Texto claro, sin afirmaciones inventadas; selección del usuario conservada si la pidió. |
| Dirección de arte — Lucía / prompts — Samuel | Copy y referencias aprobados | Plan visual y prompts versionados | Producto, estilo, texto y cambios permitidos coinciden con el encargo. |
| Producción — Isabella / Andrés | Plan validado y autorización vigente | Archivos, estado y costo por intento | Archivo utilizable y correspondencia con la pieza; no confundir generar con aprobar. |
| Calidad — Martín / Tomás | Encargo, evidencia, referencia y resultado | Aprobación o rechazo con criterio, evidencia y destino de corrección | Cumple requisitos obligatorios; el autor no sustituye la revisión cuando esta sea necesaria. |
| Entrega — Paula / Camila | Piezas aceptadas | Archivos finales, versiones, costo y pendientes | Solo presenta como finales las piezas aceptadas; una entrega parcial se identifica. |
| Aprendizaje y resultados — función compartida inicial | Opinión del usuario, fallos y métricas disponibles | Lección acotada o resultado de experimento | Se conoce la procedencia; no llama venta a un gusto ni éxito a una generación. |

Los demás personajes conservan sus identidades. No se activa una llamada a IA por cada fila: por ejemplo, generar, calcular, guardar y validar formatos deben usar software. Investigación y estrategia pueden compartir una ejecución cuando el alcance sea pequeño y los entregables permanezcan separados y verificables.

### Flujo común

`Pedido → encargo → evidencia → estrategia/copy → plan validado → aprobación de gasto → producción → calidad → entrega → aprendizaje`

- Si ya existe investigación vigente para el mismo producto, país y objetivo, reutilizarla y comprobar su pertinencia.
- Si el usuario pide elegir títulos, insertar la selección antes del plan final y conservar exactamente los IDs elegidos. Si no la pide y el modo actual es automático, no imponer una nueva espera.
- Si la revisión falla, volver al responsable del defecto: copy, arte, generación o edición. No reiniciar el flujo entero.
- Los cambios de alcance invalidan solo los resultados dependientes. Si cambian modelo, piezas o presupuesto, comprobar de nuevo la aprobación de gasto.
- Un pedido de explicación o estrategia no autoriza producción pagada.

### Ejemplo: «mismo anuncio, solo otros títulos»

1. Identificar producto y referencia. Separar lo visible de la hipótesis sobre por qué funciona.
2. Fijar diseño, producto, deseo principal, beneficio, mecanismo, oferta y elementos que el usuario pidió conservar.
3. Proponer títulos desde la investigación, sin añadir promesas nuevas. Cada opción incluye ángulo, respaldo y qué intenta probar.
4. Si el usuario pidió selección, esperar su elección. No convertir las opciones en generaciones.
5. Ejecutar únicamente los títulos elegidos; validar texto exacto y conservación de elementos protegidos.
6. Entregar una imagen independiente por pieza, con fallos o limitaciones explícitos y costo real disponible.
7. Guardar la preferencia y dejar el efecto sobre ventas como desconocido hasta medirlo.

## 6. Contratos mínimos

### Encargo único, versionado

Campos mínimos: `id`, `version`, `productoId`, `productoVersion`, objetivo, país/público/canal, modo de trabajo, referencias con identificador de contenido, investigación y fecha, invariables, cambios permitidos, piezas esperadas, textos elegidos, criterios obligatorios, responsable y presupuesto máximo con moneda.

La aprobación debe incluir `encargoId`, versión aprobada, plan aprobado, cantidad/formatos/modelo, importe máximo, fecha y mensaje/acción que la otorgó. El historial se conserva; la estimación y el gasto real son campos diferentes. Si no se conoce el gasto real, se informa como pendiente.

### Tarea y entrega

Cada tarea necesita ID, encargo/versión, tipo, responsable, dependencias, entrada validada, versión del prompt/esquema, estado, intentos, tiempos, salida y decisión de revisión. Cada artefacto registra origen, versión y tareas que dependen de él.

Estados propuestos: `pendiente`, `lista`, `ejecutando`, `espera_usuario`, `bloqueada`, `revisando`, `aceptada`, `rechazada`, `fallida`, `cancelada`. `lista` significa que puede empezar; `aceptada` que pasó los criterios. Estado del proveedor y estado del anuncio no se confunden.

Una tarea se ejecuta solo con dependencias aceptadas y versión vigente. La misma clave de operación no crea dos trabajos; los intentos de reparación tienen identidad propia y consumen el presupuesto restante. Cancelar un seguimiento y detener un trabajo activo deben ser acciones diferentes y visibles.

### Contexto por especialista

Pasar un paquete breve: misión, parte relevante del encargo, evidencia citada, entrada anterior aceptada, restricciones, salida esperada y criterio de rechazo. Adjuntar archivos grandes por referencia para lectura cuando haga falta. No repetir todo el historial a todos los especialistas ni depender solo de los últimos mensajes para recordar una aprobación.

El contenido de páginas, referencias y adjuntos es material de análisis; no puede alterar herramientas permitidas, autorización de gasto ni instrucciones del encargo.

### Plantilla común de instrucciones

1. **Responsabilidad:** decisión concreta y límites del especialista.
2. **Entradas:** versiones y documentos que puede usar.
3. **Prioridades:** pedido vigente → restricciones aprobadas → hechos del producto → evidencia → preferencias aplicables → recursos creativos.
4. **Trabajo:** pasos mínimos, manejo de información insuficiente y prohibición de inventar soporte.
5. **Salida:** esquema, archivos y campos obligatorios.
6. **Autocomprobación:** requisitos verificables antes de entregar.
7. **Escalamiento:** qué devuelve, a quién y cuándo necesita una decisión del usuario.

Versionar el núcleo común y mantener instrucciones específicas pequeñas. Cambiar el prompt sin comprobar sus salidas no cuenta como mejora validada.

## 7. Calidad y correcciones

Tres niveles separados:

| Nivel | Qué comprueba | Resultado |
|---|---|---|
| Técnico | Archivo, formato, dimensiones, texto requerido, duración y correspondencia de IDs. | Pasa/falla con comprobaciones automáticas donde sean fiables. |
| Creativo y de fidelidad | Producto reconocible, jerarquía, claridad, invariables, promesas sustentadas y cambios permitidos. | Criterios por pieza y evidencia; una puntuación global no oculta un incumplimiento obligatorio. |
| Comercial | Respuesta real del público bajo condiciones conocidas. | Hipótesis o resultado medido; nunca se deduce de estética o antigüedad de un anuncio. |

Los modos rápidos también deben cumplir requisitos obligatorios. La profundidad de revisión puede ser proporcional al riesgo: cambio de título con edición de texto requiere menos análisis que una escena nueva con afirmaciones de salud. OCR o un revisor visual pueden equivocarse; los casos dudosos deben mostrarse como pendientes, no afirmarse como verificados.

Clasificar fallos antes de reintentar: transporte/límite temporal, archivo defectuoso, fidelidad/copy, contenido rechazado o fallo de edición. Reintentos automáticos solo dentro del alcance, política y presupuesto aprobados. No cambiar la promesa o el prompt sustantivamente por iniciativa del reintento. Tope propuesto inicial: una reparación creativa dentro del gasto autorizado; si falla otra vez, escalar. Ajustarlo con el piloto y las reglas actuales antes de habilitarlo.

## 8. Rapidez y costos

Orden de optimización:

1. Registrar tiempos y costo por fase y separar tiempo activo de espera.
2. Reusar producto, investigación y análisis de referencia aceptados mediante versiones/identificadores. Invalidarlos al cambiar sus entradas; no reciclar hechos de otro producto.
3. Agrupar preparación compartida del lote y mantener piezas independientes durante producción/revisión.
4. Preservar las filas existentes. Priorizar respuestas interactivas cortas sin dejar bloqueados indefinidamente los trabajos largos.
5. Reparar únicamente piezas o etapas afectadas. Reusar medios no modificados y la deduplicación ya existente.
6. Ajustar revisión según tipo de cambio y evidencia; no quitar criterios obligatorios para aparentar velocidad.

No fijar más sesiones simultáneas ni prometer un porcentaje de aceleración sin medición. El costo de IA, generación, revisión y reparación debe poder desglosarse aun cuando un proveedor no reporte todos los componentes.

## 9. Memoria útil y resultados

Separar cuatro registros: hechos del producto, preferencias del usuario, lecciones técnicas y experimentos comerciales. Cada entrada tiene alcance, fuente, fecha, versión, confianza y estado (`propuesta`, `aceptada`, `retirada`). Una corrección factual sustentada se aplica; una preferencia explícita se conserva en su ámbito. Una sugerencia aislada no se propaga a todas las marcas.

Prioridad: instrucciones vigentes del usuario y hechos verificados; después lecciones relevantes del mismo producto, del estilo y por último principios generales. Ante conflicto, registrar qué regla sustituyó a cuál. El usuario debe poder ver y retirar aprendizajes sin borrar el historial de producción.

Para experimentos: pieza/versión, hipótesis, variable cambiada, canal, periodo, inversión, audiencia, atribución y métricas disponibles. Registrar factores que impiden comparar. Sin datos suficientes, estado `sin_resultados`; «me gusta» sigue siendo preferencia. Analizar rendimiento no implica modificar campañas ni enviar mensajes externos.

## 10. Plan de implementación

Las duraciones son rangos de trabajo orientativos; dependen del piloto y no constituyen una fecha comprometida. Un bloque termina por criterios cumplidos, no por días transcurridos.

| Bloque | Prioridad y orden | Entregables | Criterio para avanzar |
|---|---|---|---|
| 1. Contrato del piloto | P0 · primero · 2–4 jornadas | Encargo versionado para imagen; tres intenciones; selección opcional explícita; corregir prioridad de votos. | El caso «solo títulos» conserva restricciones en chat y formulario; lecciones propias no quedan desplazadas. |
| 2. Ejecución confiable | P0 · 3–5 jornadas | Validación completa de acciones, aprobación ligada al plan, claves de operación, recuperación/cancelación y estados por evidencia. | Duplicados/reinicios no duplican producción; cambios de alcance no reutilizan aprobaciones incompatibles; no hay falsos terminados. |
| 3. Calidad y eficiencia | P1 · 3–5 jornadas | Contexto por especialista, prompts versionados, revisión común en todas las rutas, medición por fase y reuso seguro. | Comparación controlada contra línea base; fidelidad y costo no empeoran por acelerar. |
| 4. Extensión y aprendizaje | P1/P2 · después del piloto | Memoria estructurada; contratos para investigación/video; experimentos con métricas reales cuando existan. | El piloto pasa criterios y conserva compatibilidad; se distinguen resultados medidos de preferencias. |
| 5. Nuevos departamentos | P2 · condicionado a demanda | Integrar landing; luego evaluar WhatsApp y análisis con herramientas, permisos y criterios propios. | Cada cadena tiene tareas reales y pruebas; nunca marcar «disponible» solo por tener personajes. |

### Primer paquete listo para desarrollar

Cambios acotados: `oficina-votos.js`, contratos de encargo/acciones, rutas de imagen y pruebas de fidelidad. Añadir campos compatibles con lotes antiguos, sin reescribir su historial. El directorio y nombre final de los nuevos módulos se decide con los patrones del código durante implementación.

Historias y criterios:

- **Como usuario quiero cambiar solo títulos:** ninguna pieza puede añadir otra promesa, producto, oferta o cambio visual no autorizado; se rechaza el plan antes de generar si lo intenta.
- **Quiero elegir antes de producir cuando lo solicite:** las opciones son propuestas; solo los IDs seleccionados pasan al plan y al costo. Una respuesta ambigua con varios encargos no produce.
- **Quiero que recuerde mi producto:** los votos propios recientes preceden a ajenos; la mezcla de productos se identifica y limita.
- **Quiero continuar después de reiniciar:** se conserva encargo y versión, sin repetir tareas aceptadas ni iniciar otro pago por la misma operación.
- **Quiero saber qué está pasando:** «3 de 5 aceptadas» es diferente de «generando» y de «entregado»; cada fallo señala la pieza y su responsable.

### Integración técnica gradual

Usar `conductor.js` como ejecutor existente, `colas.js`/`ia/fila.js` para recursos y los esquemas de `imagen-ads` para salidas. Añadir una capa común de encargo, transición validada y registro de eventos; la oficina consume una proyección de esos eventos. No montar un segundo sistema distribuido o una dependencia nueva sin necesidad demostrada.

Los trabajos antiguos siguen leyéndose mediante adaptadores; su estado inferido se identifica. Activar primero en encargos nuevos del piloto con opción de volver a la ruta anterior. Revertir una activación no borra medios, memoria ni aprobaciones registradas. No retomar automáticamente trabajos pagados antiguos durante la migración.

## 11. Medición y evaluación

Primero crear línea base con los mismos casos, entradas, versiones de modelo y criterios. Un conjunto propuesto de 20 escenarios: 8 de fidelidad/copy, 4 de evidencia/memoria, 5 de aprobación/recuperación y 3 de formatos/entrega. Las simulaciones verifican coordinación; una muestra real autorizada evalúa calidad visual y latencia. No confundir ambas.

Casos indispensables: solo títulos; exploración explícita; título elegido exacto; referencia con afirmaciones no respaldadas; producto sin evidencia; votos ajenos más numerosos; dos costos pendientes y «dale»; duplicado de acción; reinicio a mitad de lote; cancelar producción activa; cambio de precio/modelo; entrega parcial; fallo del proveedor; texto ilegible; cambio de producto; referencia con instrucciones incrustadas.

| Indicador | Definición | Criterio inicial propuesto |
|---|---|---|
| Gasto sin aprobación / operación duplicada | Incidentes en escenarios de autorización y recuperación. | Cero; bloquea activación. |
| Cumplimiento de restricciones obligatorias | Piezas aceptadas que realmente conservan producto, texto elegido y cambios permitidos. | 100% en el conjunto controlado; cualquier incumplimiento invalida el caso. No promete infalibilidad en producción. |
| Estado correcto | Coincidencia entre estados mostrados y entregas aceptadas. | Cero falsos «terminado» en los escenarios. |
| Aceptación al primer intento | Piezas aceptadas sin reparación / piezas revisadas. | Medir base; buscar +15 puntos porcentuales en piloto real comparable, sin bajar exigencia. |
| Tiempo total y de cola | Mediana y percentil 95, por formato y volumen de lote. | Buscar −20% en mediana respecto a base comparable; no activar si empeora calidad o costo. |
| Costo por pieza aceptada | Costo total conocido, incluidos fallos/reparaciones, dividido por aceptadas. | No aumentar frente a base comparable; reportar componentes desconocidos. |
| Conversión y rentabilidad | Métricas reales con periodo, audiencia y atribución definidos. | Sin meta numérica hasta disponer de datos comparables; no condiciona la prueba técnica. |

Los porcentajes son hipótesis de mejora. No se han medido ni prometido. El conjunto de 20 escenarios no permite generalizar estadísticamente el rendimiento comercial.

## 12. Decisiones pendientes y riesgos

Decisiones que se pueden tomar al implementar: esquema definitivo compatible, ubicación de registro, elección de edición de texto frente a regeneración y límites del piloto. No bloquean este diseño. Presupuesto de cualquier prueba real pagada requiere el sí correspondiente, con costo presentado previamente.

Riesgos: cambios en un prompt perjudican otros estilos; criterios visuales tienen incertidumbre; evidencia de mercado puede estar vieja; caché desactualizado puede contaminar piezas; una migración de estados puede aparentar progreso perdido. Mitigaciones: piloto acotado, versiones, invalidación por dependencias, criterios obligatorios, evidencia visible y adaptadores sin inventar historia.

Fuera del alcance: cambiar el diseño de Ciudad creativa, activar 35 sesiones, migrar anuncios personales, modificar campañas, crear nuevas integraciones o afirmar mejoras comerciales sin datos.

## 13. Fuentes de código y validación

Rutas relativas al repositorio, verificadas en el commit indicado; son evidencia del diagnóstico, no especificaciones externas:

- `app/server/lib/oficina.js`: catálogo `AGENTES` y asignación de etapas.
- `app/server/lib/oficina-produccion.js`: `DEPARTAMENTOS`, `trabajoDeLote`, `trabajoDeInvestigacion` y estados inferidos.
- `app/server/lib/oficina-chat.js`: `loteDeImagenes`, `producir`, `ejecutar`, `responder`, `opinar` y contexto de últimos mensajes.
- `app/server/lib/oficina-votos.js`: `deEste`, límites y selección de lecciones.
- `app/server/lib/aprendizajes.js`: reglas, barrido y límites de texto.
- `app/server/lib/imagen-ads/sesiones.js`: `nivelesDelAgente`, instrucciones A/B/C, archivos y verificadores.
- `app/server/lib/colas.js`, `app/server/lib/ia/fila.js`: límites y coordinación de recursos existentes.
- `.claude/agents/director-creativo.md`, `.claude/agents/supervisor-generaciones.md`, `CLAUDE.md`: especialistas para uso desde Claude Code.

Pruebas de diagnóstico sin gasto: `probar-oficina-produccion.mjs` 10/10; `probar-oficina-chat.mjs` 51/51 (286 s, puerto 4497, modo prueba y proveedores simulados); reproducción sintética del orden de votos confirmada. Las pruebas existentes comprueban el comportamiento esperado actual; que pasen no descarta los huecos identificados ni valida todavía la arquitectura propuesta.
