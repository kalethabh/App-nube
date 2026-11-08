# Subestilo Zack D Films — Diario de 14 días en estudio azul

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir la protagonista y las tomas.**

## Cuándo usarlo
Suplementos con efectos que se notan día a día (digestión, hinchazón, antojos). Es el "estudio limpio" de esta skill llevado a un **diario de transformación**: la misma persona, en el mismo estudio, cambia de un día a otro. Es simple, barato de producir y se entiende sin sonido.

## La protagonista
- **Una mujer adulta en 3D estilizado**, de 30 a 40 años, con pelo castaño ondulado a los hombros y expresiones claras: decepción, alivio, orgullo.
- **Su panza hinchada** es el marcador visual y se va desinflando día a día.
- **La ropa cambia por día**, como en un diario: una camiseta gris con leggings negros, la crema de manga larga, la blusa roja o la rosada. Va descalza en el estudio.

## ADN visual
- **El estudio**: un **degradado celeste a azul, sin horizonte**, con el piso que se funde con la pared y una sombra suave bajo los pies. Es el mismo en casi todas las tomas.
- **Los objetos de cada día** se ponen en el estudio, como en un escenario: un espejo de pie, un inodoro, un estante de snacks, una mesa con su plato vacío. Nada más.
- **El mecanismo**: un **primer plano del torso con el aparato digestivo brillando** a través de la ropa, en verde cuando está inflamado y en ámbar dorado cuando ya funciona bien, sobre el mismo azul. Y el **interior del intestino** como escenario rosado, con **bacterias cartoon** verdes y azules que comen restos de comida y luego son barridas por burbujas y gotas de aceite.
- **El cierre de producto**: los ingredientes reales (la hierba seca en un plato y el aceite en un frasco con corcho) sobre el mismo estudio azul. Una mano real muestra la cápsula frente al envase, y el último plano es la tarjeta de la oferta.
- **El render**: 3D limpio y suave, de iluminación uniforme de estudio, con un contraluz leve y un acabado de comercial amable.

## Estructura del guion (capítulos del proceso Zack D)
1. **El gancho**: "¿qué pasa realmente si tomas X cada mañana durante 14 días?".
2. **Día 1**: nada se ve ("sientes que tiraste el dinero").
3. **Día 3**: el primer síntoma físico, con humor, y el mecanismo del primer ingrediente.
4. **Día 5**: un antojo que desaparece, en una escena concreta.
5. **Día 7**: la hinchazón baja, con el mecanismo del segundo ingrediente.
6. **Día 10**: la cara en el espejo.
7. **Día 14**: después de una comida grande, todo sigue bien, y la gente lo nota.
8. **El producto**: qué trae, sin efectos molestos, la oferta y la escasez.

Dura entre 60 y 75 segundos.

## Prompt de la protagonista (en inglés)
```
Stylized 3D animated adult woman in her mid 30s, shoulder-length wavy brown hair, soft friendly features, clearly expressive face, [estado: visibly bloated round belly / slightly less bloated / flat relaxed stomach], wearing [ropa del día] and barefoot, standing in a seamless light-blue to deep-blue gradient studio with no horizon, soft shadow under her feet, even soft studio lighting with gentle rim light, clean commercial 3D render, 9:16 vertical.
```
La primera imagen de ella (el Día 1, de cuerpo entero) es la referencia de identidad para todas las demás.

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | de pie, toma la cápsula con agua, cansada, con la panza grande | el gancho y el Día 1 |
| 02 | de espaldas, frente al espejo de pie; se mira la panza | "mismo cuerpo, misma cara" |
| 03 | se toca la panza, preocupada | el Día 3 |
| 04 | sentada a la mesa, se niega a un snack con la mano | el Día 5, los antojos |
| 05 | sentada, relajada, con el plato vacío | el Día 7 |
| 06 | un primer plano del torso con el aparato digestivo en verde | "la inflamación" |
| 07 | en el sofá, con la cara apoyada en la mano y una sonrisa tranquila | el Día 10 |
| 08 | el torso con el aparato digestivo en ámbar dorado | "tu intestino lo maneja" |
| 09 | dos amigas la miran asombradas | "la gente empieza a notarlo" |
| 10 | los ingredientes: la hierba seca en un plato y el aceite con corcho | "85% de…" |
| 11 | toma la cápsula, ya delgada y con ropa clara | "sin mal sabor" |
| 12 | sentada, muestra el producto a cámara, sonriendo | la oferta |

## Movimientos y gestos
- **Casi todo con la cámara fija** o con un push-in suave. Los gestos son pequeños y claros: la mano en la panza, un suspiro de alivio con los ojos cerrados, rechazar con la palma, apoyar la cara en la mano.
- **El intestino por dentro**: las bacterias cartoon comen y después las gotas de aceite y las burbujas las arrastran (Start y End Frame).
- **Frases para el prompt de video**: "she exhales with relief, eyes closed, resting a hand on her flatter stomach", "golden oil droplets rain down and the cartoon bacteria tumble away, swept by bubbles".

## Tono e intención
- **Un narrador amable en segunda persona**, con frases cortas y pausas en cada "Día N". Al principio va con humor seco ("parece que tiraste la plata") y termina con orgullo tranquilo.
- **Por beat**: el gancho **da curiosidad**, el Día 1 **es honesto** (no pasa nada), los días del medio **son pequeñas victorias** y el final **convierte**.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La mujer del diario (`protagonista`)
Retrato de referencia: `avatar/protagonista.jpg` (sale de `ref-07.jpg`).
- Una mujer de 32 a 40 años, entre Pixar y realista (menos caricatura que el glow-up), de piel clara o trigueña.
- Melena castaña ondulada a la altura de los hombros, con raya al costado.
- Facciones suaves, cara amable y expresiones contenidas: incomodidad, alivio, una sonrisa tranquila.
- Ropa simple de casa: camiseta gris o rosada lisa, leggings negros o pantalón beige, y descalza.
- Cuerpo normal. En el 'antes', la panza muy hinchada.
- Siempre en el estudio infinito azul celeste en degradado, con luz suave y pareja, sin sombras duras.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-zack-d-films/subestilos/diario-estudio-azul/avatar/protagonista.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Stylized-realistic 3D animated {persona} in her mid 30s, light-olive skin, shoulder-length wavy brown hair with a side part, soft kind face, gentle relieved smile, plain light-grey t-shirt and black leggings, barefoot, standing in a seamless light-blue gradient infinity studio with soft even light and no hard shadows, full body front view, high-end animated film quality, subtle subsurface skin. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni el producto, ni las frases, ni los plazos: los días son los reales del producto del usuario.
