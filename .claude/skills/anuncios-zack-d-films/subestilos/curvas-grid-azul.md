# Subestilo Zack D Films — Curvas en grid azul

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir la protagonista y las tomas.**

## Cuándo usarlo
El mismo ángulo de "glow-up" del subestilo Pixar `glow-up-senal-dorada` (figura, curvas, hormonas, autoestima), pero con **el grid técnico azul de Zack D Films** como escenario casi todo el anuncio. Se ve más "explicador" y menos de vida real, y es más barato: un solo escenario.

## La protagonista
- **Una mujer joven en 3D estilo Pixar**, de 25 a 30 años, con el **pelo rizado corto y voluminoso**, ojos grandes y la expresión pícara. Tiene una figura con curvas exagerada y caricaturesca.
- **Ropa de casa con estampado**: un top blanco de tiras con moño rosado y un short de pijama de cerezas, o un short deportivo rojo de ribete blanco, o una camiseta gris con short a rayas. Lleva zapatillas negras de caña.
- **Las amigas**: Pixar, con la expresión de sorpresa, en primeros planos de dos (secretos al oído, "¿te hiciste un BBL?").

## ADN visual
- **El grid**: un **grid azul eléctrico** de líneas finas en piso y pared, con luz cenital y un brillo azulado. Ahí pasan casi todas las tomas de ella.
- **Los macros del mecanismo**:
  - un vaso sanguíneo por dentro (rojo y azul) con hojitas verdes que entran;
  - las **células de grasa como esferas doradas brillantes** que viajan con estelas de luz hacia la cadera;
  - el útero y los ovarios como **personajes tiernos y sonrientes** con burbujas.
- **La cadera translúcida**: la pelvis se ve a través de la piel, con las esferas doradas acumulándose y flechas de luz que suben.
- **Los anillos de luz** azul o dorada giran alrededor de la cintura.
- **El cierre**: tres frascos sobre un pedestal con un aro de luz, y el celular con la tienda en la mano.
- **El render**: Pixar saturado y brillante, con una piel de subsurface muy cálida contra el azul frío del grid.

## Estructura del guion
La misma del subestilo Pixar `glow-up-senal-dorada`: el gancho "lo rápido que funciona", el mecanismo en una frase, las semanas 1, 2 y 3 y el mes 1, la prueba social y la oferta sin riesgo. **Es el mismo guion contado con otra imagen**: sirve para probar dos versiones del mismo anuncio.

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | se pone gotas con el gotero, sorprendida, con el frasco en la otra mano | el gancho |
| 02 | posa con un top negro roto, de cuerpo entero | "en los primeros 14 días" |
| 03 | macro del vaso sanguíneo con hojitas | "se pone a trabajar" |
| 04 | revisa jeans apilados en una tienda | "vas a necesitar ropa nueva" |
| 05 | un primer plano extremo de los ojos, asombrada | "que antes iba directo a…" |
| 06 | una amiga la mira asombrada | "no está en tu panza" |
| 07 | un anillo de luz en la cintura, las manos en la cadera | "tu confianza cambia" |
| 08 | un detalle de la cadera con un short rojo y una estela | "toda la grasa" |
| 09 | las amigas en primer plano, con el celular | "tus amigas" |
| 10 | sentada, señala el frasco con el dedo | "ahora mismo" |
| 11 | tres frascos en un pedestal de luz | la oferta |
| 12 | el celular con la tienda en la mano | "no te lo pierdas" |

## Movimientos y gestos
- **Poses de "ver cómo me queda"**: las manos en la cadera, un giro de tres cuartos, se mira por encima del hombro y se acomoda el pelo.
- **El anillo de luz gira** y la cámara orbita alrededor de ella.
- **En los macros**, las esferas doradas viajan por el vaso y se acomodan en la cadera.
- **Frases para el prompt de video**: "slow orbit around her as a glowing ring of light spins around her waist", "golden fat spheres stream through the vessel and settle into the hips, light arrows rising".

## Tono e intención
- **Igual que en `glow-up-senal-dorada`**: una amiga juguetona que cuenta un secreto, con jerga y humor, segura.
- **El grid** le da a la promesa un aire de "ciencia": refuerza que hay un mecanismo y no es magia.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La de las curvas en el grid (`protagonista`)
Retrato de referencia: `avatar/protagonista.jpg` (sale de `ref-01.jpg`).
- Una mujer joven de 24 a 30 años en Pixar, latina o mestiza, de piel canela media con un rubor marcado en las mejillas.
- Pelo negro rizado corto y voluminoso, a la altura del mentón, con rizos sueltos que caen sobre la frente.
- Ojos enormes café con pestañas, cejas expresivas y labios llenos. Expresiones pícaras o de sorpresa con la boca abierta.
- Collar fino dorado con dije y argollas pequeñas.
- Curvas muy exageradas y caricaturescas. Ropa de casa: top de tiras con moño, short de pijama de cerezas, short deportivo rojo con ribete blanco o camiseta gris con short a rayas.
- Siempre sobre el grid azul eléctrico, con luz cenital fría que contrasta con su piel cálida.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-zack-d-films/subestilos/curvas-grid-azul/avatar/protagonista.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Pixar-style 3D animated {persona} in her late 20s, warm caramel skin with rosy cheeks, short voluminous black curly hair at chin length with loose curls on the forehead, huge brown eyes with long lashes, expressive brows, full lips, playful surprised expression, thin gold necklace and small hoops, exaggerated curvy figure, grey ribbed cami top with a small bow and grey drawstring shorts with white trim, standing on a glowing electric-blue technical grid floor with a grid wall behind, cool overhead light contrasting with her warm skin, full body, high-end 3D animated feature film render (Pixar / Disney 2020s look), soft subsurface skin, glossy expressive eyes with catchlights, detailed hair strands, warm cinematic light. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni el producto, ni las promesas tal cual: son las que el producto del usuario puede sostener.
