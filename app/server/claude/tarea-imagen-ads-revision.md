<!-- Tarea "imagen-ads-revision" (Anuncios de imagen): los 4 criterios copiados tal cual de la skill (PASO 6.2), mas lo
     del vertical y, solo con logo, la zona reservada (lo agrega la app). Marcas que llena lib/imagen-ads/sesiones.js:
     {{lote}} {{fotoProducto}} {{yCuadrado}} {{criterioVertical}} {{criterioLogo}} {{lista}} {{tanda}} -->
TAREA: imagen-ads-revision
Carpeta del lote: temp/{{lote}}
Revisa estas imágenes de anuncio. Solo miras y anotas: no corres nada y no cambias ningún otro archivo.
La foto real del producto: `temp/{{lote}}/entrada/{{fotoProducto}}`.

Por cada imagen abre, de una vez (varias lecturas en el mismo paso): su vista entera, sus cuatro recortes y su `V##.json`{{yCuadrado}}. Lee los textos en los recortes, palabra por palabra y letra por letra; nunca en la vista reducida.

Revisa solo errores objetivos:
1. El producto del anuncio es el mismo de la foto (forma, etiqueta, colores), sin deformaciones graves.
2. Cada texto de `text_layers` aparece escrito exactamente igual. Léelo en los recortes palabra por palabra y letra por letra: una tilde de más o de menos, una letra cambiada, sobrante o faltante, o un espacio que falta entre dos palabras, es un fallo. Ignora diferencias de mayúsculas.
3. No hay textos ilegibles, letras inventadas ni elementos rotos. El microtexto de la etiqueta del producto que no se puede leer a tamaño de celular no cuenta.
4. No aparece ningún texto ni bloque que no esté en `text_layers` o `detected_visual_blocks` (precios, CTA, sellos, estrellas, logos inventados), ningún texto sale repetido y no falta ninguno de `mandatory_visual_elements`.
{{criterioVertical}}
{{criterioLogo}}
No opines sobre gustos ni diseño.

Las imágenes:
{{lista}}

Escribe `temp/{{lote}}/revision/{{tanda}}.json`:
{ "revisadas": [ { "pieza": "V03_1x1", "ok": true, "problemas": [] }, { "pieza": "V04_1x1", "ok": false, "problemas": ["El titular dice «RÍTMO»: la I lleva una tilde de más."], "correccion_en": "Write the headline exactly as \"BAJA EL RITMO\", with no accent on the I." } ] }
Una entrada por imagen de la lista. Cada problema, una frase corta en español sencillo (la lee el usuario).
Si `ok` es false, agrega `correccion_en`: una instrucción corta en inglés para el modelo de imagen que diga cómo corregir SOLO esos problemas (qué texto exacto va, qué mover y hacia dónde), sin describir el anuncio entero. La app no la rehace sola: la usa si el usuario pide otra versión de esta imagen, para que no repita el error. Responde LISTO.
