<!-- Lo propio de Estilo Lego en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. -->
## Lo propio de Estilo Lego

- **La voz ya está elegida.** La eligió el usuario en la app y la app la deja sola a su volumen: no la nombres, no la cambies y no listes voces.
- **La estructura (`ajustes_del_estilo.estructura`):** con "que decida la IA" va la plantilla del 2.1; si el usuario eligió un ángulo o escribió otro enfoque, es el 2.2.
- **Sin preguntas.** El look de cada toma, el color de las minifiguras, las metáforas con piezas y los plazos de la línea de tiempo los decides tú, como dice el Paso 1.
- **Los ingredientes** (tiempo 3 de la plantilla) salen de `producto.ingredientes`, de `ajustes_del_estilo` si los trae, de la etiqueta en la foto o de `pagina.txt`. Si no hay ninguno, el tiempo 3 cuenta lo que hace el trabajo sin inventar nombres ni dosis, y lo anotas en `decisiones`.
- **La duración** (`duracion`, 2.4): con "que decida la IA", la plantilla va completa. Si el usuario dijo un tiempo, escribe para más o menos ese tiempo, con la plantilla en su orden y sin sacar bloques.
- **La música es fija ("Open Up Emotions") y la pone la app**, con sus niveles: no la generes, no la copies, no crees `musica/` y no toques los niveles. Los efectos de sonido también los pone la app.
- **Las transiciones van en el orden en que aparecen las partes en este guion.** Con la plantilla, que abre con el resultado: la entrada de la prueba es la primera marca de tiempo (tiempo 2), la del problema el recuerdo (tiempo 11), la de la solución la primera toma del producto (tiempo 14) y la del CTA el tiempo 17. La toma 1 no lleva.
- **En `app/guion.json`:**
  - `momento` usa las partes de la plantilla: gancho (tiempo 1), prueba (2 y 6 a 10), cómo funciona (3 a 5), problema (11 a 13), solución (14 y 15), cierre (16 y 17) y oferta (18). Con otra estructura o con `guion_del_usuario`, la parte que cumpla cada toma.
  - `se_ve` cuenta la escena con lo que se ve: minifiguras y ladrillos, el interior del cuerpo o el producto real sobre piezas ("la pierna de la minifigura es una pieza transparente llena de agua turbia").
  - `decisiones` dice los plazos de la línea de tiempo (para que el usuario los corrija si no son los suyos), los ingredientes que nombra el guion y la metáfora con piezas principal.
