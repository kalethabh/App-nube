# Subestilo Skeleton — Cristal en laboratorio, con voz de experto

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir el Character Bible.**

## Cuándo usarlo
Salud cardiovascular, circulación, presión, colesterol o hinchazón de pies y manos, con un público de más de 50 años. La narración es de **un experto en primera persona** ("en más de 20 años con mis clientes"), seria y protectora, sobre un esqueleto de cristal en un laboratorio médico futurista.

## El personaje
- **Un cuerpo de hombre adulto de cristal transparente** con el **esqueleto marfil completo** dentro. La cara es una calavera con los ojos grandes castaños, cansados y expresivos, y tiene el **pelo castaño peinado hacia atrás**.
- **Una banda roja de toalla** en la frente: es su seña de identidad.
- **Los órganos aparecen solo cuando importan** (el corazón, las arterias, el sistema nervioso), iluminados.
- **Los extras**: dos esqueletos iguales con bandas de otros colores (verde y azul), los "clientes".

## ADN visual
- **El laboratorio médico futurista**: azul y blanco, con pantallas holográficas, mesas de metal y una luz fría y limpia. A veces es un **fondo azul liso** de estudio.
- **Los primeros planos del cuerpo**: la mano hinchada contra el esqueleto de la mano, los pies, el torso, las rodillas que brillan en rojo (el dolor) o en ámbar (la mejora).
- **El macro de la arteria**:
  - por dentro, con los glóbulos rojos que pasan entre **placas de calcio blancas y filosas**;
  - en corte, con la placa amarilla;
  - después, las partículas doradas que la limpian.
- **La molécula** del compuesto como esferas doradas de vidrio unidas.
- **Las cápsulas**: las ámbar (las buenas) brillan y las amarillas (las malas) se tachan. Están junto al hombro.
- **El ingrediente en su proceso**: los ajos en una cámara de fermentación de vidrio con luz cálida.
- **El cierre**: el personaje con el producto y el celular con el carrito, en una cocina luminosa.
- **El render**: 3D médico de alta gama, con un cristal de reflejos limpios y un contraste frío y cálido (el azul del lab contra el oro del compuesto).

## Estructura del guion (experto en primera persona)
1. **El gancho de diagnóstico visual**: "si tu panza se ve así, tus pies así y tus manos así, no estás gordo: tienes <causa>".
2. **Lo que no funciona**: tres cosas, "y definitivamente no pastillas de quienes ganan cuando sigues enfermo".
3. **La promesa**: "déjame mostrarte lo que funciona".
4. **La ampliación del dolor**: los síntomas del día a día, "no es la edad", y el riesgo de fondo, dicho con cuidado.
5. **La autoridad**: "en más de N años con mis clientes encontré una cosa".
6. **El ingrediente y su proceso**, la molécula y lo que hace, con verbos visuales.
7. **Los clientes que vuelven** con resultados emocionales.
8. **Los dos errores**: lo barato falso (cómo reconocerlo) y la versión casera.
9. **"La única en la que confío"**, las pruebas, el color real del producto, la escasez con su motivo (el proceso no se apura) y una bendición o despedida cálida.

Dura entre 2:30 y 2:45 minutos.

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | el torso de cristal con la panza inflamada de tejido rosado | "si tu panza se ve así" |
| 02 | la caja torácica con las arterias rojas y la mano | "no estás gordo" |
| 03 | los pies de esqueleto de cristal, de cerca | "tus pies así" |
| 04 | un primer plano de la cara cansada, con el sistema nervioso | "envejecer 20 años" |
| 05 | la arteria en corte con la placa, en el laboratorio | "encontré una cosa" |
| 06 | la molécula dorada de vidrio | "un compuesto llamado…" |
| 07 | de cuerpo entero con energía que estalla en el pecho | "tu energía vuelve" |
| 08 | tres esqueletos con bandas de colores sobre una plataforma | "semanas después me dicen" |
| 09 | se toca la panza, con destellos rojos de dolor | "el ajo crudo no" |
| 10 | con el producto y el corazón iluminado | "más CoQ10" |
| 11 | en la cocina, con el celular de la tienda | "una oferta limitada" |
| 12 | junto a la cámara de fermentación de ajos | "toma tiempo hacer más" |

## Movimientos y gestos
- **El personaje es contenido**: cierra los ojos con alivio, se lleva la mano al pecho, se toca la panza con dolor y gira la cabeza hacia las cápsulas que flotan.
- **La cámara es lenta**: un dolly in, una subida por el cuerpo, de los pies a la cara.
- **El macro**: un viaje por dentro de la arteria, de la placa a la limpieza dorada.
- **Frases para el prompt de video**: "slow camera travel through the inside of the artery as red blood cells squeeze past white calcium plaque", "golden particles sweep along the artery walls and the plaque dissolves", "he closes his eyes in relief as warm light blooms in his chest".

## Tono e intención
- **Un experto mayor, grave, pausado y protector.** Hay una crítica velada al sistema ("instituciones que ganan cuando sigues enfermo"), dicha con calma, no con rabia. Se despide con una bendición ("cuida tu corazón, por ti y por tu familia").
- **Por beat**: el diagnóstico visual **asusta e identifica**, lo que no funciona **genera desconfianza en lo de siempre**, la autoridad **da seguridad**, el proceso del ingrediente **da asombro** y los errores **protegen**. La despedida **crea vínculo**.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### El esqueleto de cristal (`esqueleto`)
Retrato de referencia: `avatar/esqueleto.jpg` (sale de `ref-04.jpg`).
- Un esqueleto hombre marfil dentro de un cuerpo de cristal transparente de silueta masculina, con reflejos limpios.
- Cabeza de calavera con pelo castaño real despeinado, una banda roja de toalla en la frente y ojos de caricatura cansados (párpados caídos, iris gris, ojeras).
- Venas rojas y azules y el corazón visibles cuando el guion lo pide.
- En un laboratorio médico futurista blanco y azul, o sobre un fondo azul rey liso. Luz limpia de estudio.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-skeleton-ads/subestilos/cristal-laboratorio-experto/avatar/esqueleto.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Hyper-detailed 3D render of an adult male ivory skeleton inside a fully transparent clear glass body shell with a male silhouette and clean refractions, the skull head topped with real messy brown hair and a red terry-cloth headband, big tired cartoon eyes with droopy lids, grey irises and under-eye bags, standing in a futuristic white-and-blue medical laboratory with holographic screens, clean bright studio light, medium-full shot. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni los años de experiencia (si el usuario no tiene un experto real, la voz habla como divulgador, sin cifras de experiencia), ni las afirmaciones médicas: se dicen solo las que el producto del usuario puede sostener.
