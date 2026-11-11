# Proporciones: cuadrado 1:1 → vertical 9:16

La skill trabaja con dos proporciones: cuadrado 1:1 (feed) y vertical 9:16 (Stories, Reels y TikTok).

Cada anuncio se genera SIEMPRE primero en cuadrado 1:1 con su prompt JSON. El vertical solo se hace si el usuario lo pidió, y cada vertical es una generación más en la API.

## El vertical no se genera de cero

Si se mandara el mismo prompt en 9:16, el modelo dibujaría otro anuncio: otra persona, otra composición, otros detalles. Tampoco se rellenan franjas arriba y abajo del cuadrado, porque quedaría un parche visible y los textos seguirían apretados en el centro.

El vertical se obtiene **recreando el mismo anuncio a partir del cuadrado ya generado**: mismos textos, colores, tipografía, persona, fondo y producto. Lo único que cambia es la dimensión: los bloques se re-maquetan para que la pieza se vea diseñada para formato alto.

## Cómo lo hace `scripts/extender_vertical.py`

Envía al modelo **dos imágenes**:

1. El cuadrado ya generado (lo que hay que conservar).
2. La foto real del producto (para que el frasco o empaque no derive).

Y un prompt armado automáticamente desde el `V##.json` de la variación, con estas partes:

1. **Recrear sin cambiar el diseño:** conservar textos palabra por palabra, tipografía, colores (con los hex de la paleta), estilo, persona, fondo y producto, más los bloques visuales obligatorios.
2. **Fidelidad de color:** el fondo y cada texto mantienen exactamente su color. Nunca convertir un fondo de color en blanco ni invertir colores entre fondo y textos.
3. **Único cambio, la dimensión:** re-maquetar para 9:16: el titular respira arriba, la persona y el producto ganan espacio vertical y los demás bloques se reparten. Sin franjas vacías, bordes, bandas difuminadas ni barras de color. Sin recortar elementos.
4. **Zona segura:** el 15% de arriba y el 15% de abajo quedan libres de textos importantes y de la etiqueta del producto, porque ahí Instagram, Facebook y TikTok ponen su interfaz.
5. **Producto real:** la segunda imagen es el producto; se conserva idéntico.
6. **Textos exactos:** la lista de cada texto visible, tal cual debe aparecer, una sola vez.
7. **Cierre:** no añadir, quitar ni reescribir textos, precios, sellos, íconos ni bloques.

El vertical también pasa por la revisión del PASO 6 (con un solo reintento si falla), y además se comprueba que sea el mismo anuncio que su cuadrado.

## Uso suelto

Para convertir una imagen cuadrada concreta:

```bash
python <skill>/scripts/extender_vertical.py cuadrado.png --ad V01.json --producto producto.png
```

En un lote, lo hace `generar_lote.py ... --fase vertical` para todas las variaciones.

Antes de entregar una imagen convertida suelta, revísala igual que en el PASO 6: haz sus recortes y comprueba textos, producto y que sea el mismo anuncio que el cuadrado.
