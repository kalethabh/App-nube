# Subestilo UGC — Oferta en mano (cierre de urgencia)

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir los bloques.**

## Cuándo usarlo
Un anuncio **corto, de 15 a 20 segundos**, solo para empujar una oferta que se acaba: retargeting, el último día de una promo o una variante barata de probar. No explica el producto: parte de que el público ya lo conoce.

## ADN visual
- **No sale ninguna cara.** Es un POV: una mano real que sostiene el producto delante del celular, lo gira, lo deja en la mesa y lo vuelve a levantar. La mano tiene piel real, sin uñas pintadas llamativas (o a juego con el público).
- **El lugar**: una sala de estar con luz de sol de la tarde que entra por la ventana y deja sombras largas sobre una mesa de madera. Al fondo, desenfocado, un sofá gris.
- **La cámara**: en mano, con un leve temblor, muy cerca del producto. El enfoque va y viene entre la etiqueta y el fondo, y la etiqueta se lee en la mayoría de los planos.
- **La voz**: un **diálogo corto entre dos personas fuera de cámara**: una pregunta incrédula ("¿cómo que la oferta se acaba hoy?") y la otra confirma y empuja a comprar. Lo genera el mismo clip de video, como en UGC (no es una voz en off aparte): en el prompt va "two off-camera voices talking" con sus líneas.
- **Los textos en pantalla** (van en el montaje, nunca en el prompt):
  - arriba, el beneficio en mayúsculas blancas sobre fondo blanco o negro;
  - debajo, la oferta en una caja roja ("3 POR SOLO $X");
  - a partir de la mitad, una flecha roja que apunta hacia abajo, al botón.

  Anótalos en la Sección A para quien edita.

## Estructura (se copia el orden, nunca las frases)
1. **La sorpresa**: "¿cómo que se acaba hoy?".
2. **La confirmación**: "sí, hoy es el último día de la mejor oferta que han tenido".
3. **La orden**: cuántas unidades llevar y por qué ahora.
4. **El cierre**: "no vas a ver una oferta así en mucho tiempo".

Uno o dos bloques de 10 segundos.

## Plantilla de bloque (en inglés, se adapta)
```
Photorealistic vertical 9:16 handheld smartphone POV. A real hand holds the product bottle close to the lens over a wooden coffee table in a sunlit living room, long late-afternoon sun shadows, grey sofa softly out of focus behind. The hand turns the bottle slowly to show the label, sets it on the table, picks it up again. Slight natural hand shake, focus breathing between label and background. Two off-camera voices talking casually (no one on screen): [línea A] / [línea B]. No text on screen.
```

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01–06 | la mano sostiene y gira el frasco a contraluz; la etiqueta pasa de nítida a desenfocada | la primera mitad (la sorpresa y la confirmación) |
| 07–09 | el frasco solo sobre la mesa con la sombra larga; en el montaje entra la flecha roja | "esta es tu última oportunidad" |
| 10–12 | la mano lo vuelve a tomar de abajo y lo acerca | "no vas a encontrar una oferta así" |

## Movimientos y gestos
- **El POV en mano, con temblor natural.** La mano gira el frasco un cuarto de vuelta, lo deja, entra al cuadro y lo levanta. El enfoque "respira" entre la etiqueta y el fondo.
- **El sol de la tarde** hace destellos sobre el vidrio ámbar al girarlo.
- **Frase para el prompt de video**: "handheld POV, the hand slowly rotates the bottle a quarter turn catching the low sun, sets it down on the table, then reaches back in and lifts it toward the lens".

## Tono e intención
- **Un diálogo real entre dos personas de la casa**: la una incrédula ("¿cómo que hoy?") y la otra firme y con prisa. No suena a anuncio: suena a una conversación grabada sin querer.
- **La intención es una sola, la urgencia**. Cada frase sube la presión: es hoy, es la mejor que hubo y no vuelve.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La mano con la oferta (`creadora`)
Retrato de referencia: `avatar/creadora.jpg` (sale de `ref-02.jpg`).
- No se ve la cara: todo el anuncio es una mano real que sostiene el producto en primer plano, en la vista de quien graba.
- Mano de piel morena, sin esmalte o con las uñas cortas y naturales, sin anillos.
- Al fondo, desenfocada, una mesa de madera con sol de tarde que entra por la ventana, rayas de luz y sombra y un sofá gris.
- La mano gira el frasco despacio para mostrar la etiqueta y después lo deja sobre la mesa.
- **Es una persona real filmada: su foto NUNCA va al generador**, porque sería copiar la cara de alguien real. Se genera una persona nueva y original del mismo tipo (edad, rasgos, pelo, ropa, lugar, luz y encuadre), con el prompt de abajo. El retrato solo se mira, para calibrar.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Point-of-view smartphone photo of a real hand with medium-dark brown skin and short natural unpolished nails, no rings, holding the product bottle close to the camera with the label facing the lens, warm late-afternoon sunlight with stripes of light and shadow across a wooden coffee table, a grey sofa softly blurred behind, shallow depth of field, photorealistic, shot on a smartphone, natural skin texture with visible pores, fine lines and slight under-eye shadows, real flyaway hair strands, no beauty filter, no retouching. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni el precio, ni la oferta: son los del usuario. Si no tiene una oferta real con fecha de fin, este subestilo no aplica.
