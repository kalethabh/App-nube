# Subestilo Pixar — Glow-up con la señal dorada

Referencia: `ref-01.jpg` a `ref-12.jpg` en esta carpeta. **Míralos con Read antes de escribir la protagonista y las tomas.**

## Cuándo usarlo
Productos de figura, curvas, hormonas o autoestima femenina, con un público joven y urbano y un tono de "glow-up" de redes. El mecanismo es **invisible**, como una señal hormonal, y se muestra como **un trazo de luz dorada** que recorre el cuerpo dentro del mundo real, sin cortes anatómicos.

## La protagonista
- **Una mujer joven Pixar**, de 25 a 35 años, con un **pelo rizado voluminoso**, rasgos y expresiones muy vivas y una figura con curvas. La ropa casual va ajustada y cambia por día: jeans altos, leggings, crop tops de colores lisos.
- **Su actitud** es de confianza creciente: la sorpresa al principio y el orgullo al final.

## ADN visual
- **El mecanismo**: una **cinta de luz dorada con chispas y hojitas** que se enrolla alrededor de la cintura, la cadera o la panza. En el plano del "antes", es una flecha dorada que baja hacia la panza. **Nunca** es un corte de rayos X.
- **Los lugares reales de su vida**:
  - una tienda de ropa, con estantes de jeans;
  - el supermercado, con el carrito;
  - un café con terraza y amigas;
  - la calle de la ciudad;
  - un vestidor;
  - un evento con hombres de traje que la miran.

  Cada toma va en un lugar distinto, como una semana de su vida.
- **Los recursos de redes**:
  - el celular con la notificación del ex ("¿cómo has estado?");
  - la amiga que pregunta "¿te hiciste algo?";
  - el celular con la página del producto y el botón de compra.
- **El cierre de producto**: la caja y el frasco en un bodegón cálido de madera, con los ingredientes alrededor (raíces, semillas, frutos) y las líneas doradas que los conectan.
- **La luz**: un Pixar cálido y luminoso, con la hora dorada en exteriores y luz comercial en interiores, colores saturados pero limpios.
- **Los subtítulos de frase completa**: van en el montaje, nunca en el prompt.

## Estructura del guion (narrador en segunda persona, con capítulos del proceso Pixar)
1. **"La mayoría no sabe lo rápido que funciona <ingrediente>"**, y "esto pasa dentro de tu cuerpo en los primeros 14 días".
2. **El mecanismo en una frase**: la señal que decide dónde va.
3. **Semana 1**: la ropa ya no te queda.
4. **Semana 2**: el cambio se acumula, dónde sí y dónde no.
5. **Semana 3**: la amiga y el espejo, con un remate de humor.
6. **Mes 1**: es sostenible, no temporal.
7. **La prueba social de su vida**: cómo la miran, el ex escribe, las amigas preguntan.
8. **La oferta**: sin riesgo por N días, el porcentaje y que se agota.

Dura entre 80 y 90 segundos.

## Prompt de la protagonista (en inglés)
```
Pixar-style 3D animated young woman in her late 20s, big voluminous curly black hair, warm brown skin, very expressive face and eyes, curvy figure, fitted high-waisted jeans and a plain [color] crop top, confident playful energy, [lugar real de su vida], warm golden cinematic Pixar lighting, a glowing golden ribbon of light with sparkles and tiny leaves swirling around her waist and hips, saturated clean colors, 9:16 vertical.
```

## Fotogramas
| Foto | Qué muestra | Úsalo para |
|---|---|---|
| 01 | de espaldas y mirando por encima del hombro, con la cinta dorada en la cadera, en un gimnasio luminoso | el gancho |
| 02 | el bodegón del frasco con los ingredientes flotando y el gotero | "después de tu primera gota" |
| 03 | en la tienda, prueba un jean y le sobran prendas | "vas a tener que ir de compras" |
| 04 | camina por la calle con la cinta dorada que le recorre la cadera | "empieza a irse a otro lado" |
| 05 | en el supermercado, con el carrito, la panza plana y un aro dorado en la cintura | "la panza se queda plana" |
| 06 | una amiga la mira desde la mesa del café | "tu amiga ya lo notó" |
| 07 | la amiga en el sofá le pregunta | "¿te hiciste algo?" |
| 08 | de espaldas en el vestidor, posando | "no es temporal" |
| 09 | el celular con el mensaje del ex | "tu ex encuentra una excusa" |
| 10 | camina en tacones, de espaldas, al contraluz | "te sientes otra persona" |
| 11 | el producto en un bodegón con los ingredientes conectados por luz | la oferta |
| 12 | sonríe y señala el frasco con el dedo | "se agota, no esperes" |

## Movimientos y gestos
- **Caminar con actitud** es el movimiento principal: de tres cuartos o de espaldas, con un vaivén de cadera y la cámara que la sigue.
- **Las miradas sobre el hombro**, la sonrisa cómplice, la mano en la cintura y una vuelta frente al espejo.
- **La cinta dorada se enrolla** y viaja de la panza a la cadera con chispas.
- **Frases para el prompt de video**: "tracking shot following her as she walks confidently with a hip sway, glancing back over her shoulder with a playful smile", "a golden ribbon of light spirals from her belly to her hips leaving sparkles".

## Tono e intención
- **Una amiga que te cuenta un secreto**, juguetona, segura y con jerga de redes. Hay humor ("¿te hiciste un BBL? No") y un ritmo constante que sube en la prueba social.
- **Por beat**: el gancho **sorprende** (es rápido), las semanas **hacen fantasear**, las reacciones de otros **dan validación** y la oferta **quita el riesgo**.

## Cómo usar los fotogramas para que salga lo más parecido posible
- **Antes de escribir cada prompt de imagen**, abre con Read el fotograma de la tabla que corresponde a esa toma. Describe en el prompt lo que se ve: el plano y la altura de la cámara, dónde está la persona en el cuadro, de dónde viene la luz y de qué color es, el fondo, la ropa, la expresión y el gesto. Esa descripción es lo que acerca el resultado.
- **Además, cada imagen lleva su fotograma ADJUNTO al generador**, junto con el prompt. En el manifiesto, la toma lleva `"fotograma": ".claude/skills/<skill>/subestilos/<id>/ref-NN.jpg"` (la ruta del fotograma de la tabla); una toma B, además, `"fotograma_final"` para su frame final; el B-roll y la hoja del personaje, también `"fotograma"`. El motor manda la versión sin subtítulos (`limpio/`) como última referencia, y le avisa al modelo que de ahí copie solo el encuadre, la pose, la luz y la calidad, nunca el texto, la marca, el producto ni la cara. No cuesta más ni tarda más. El prompt igual describe el plano: los dos juntos son lo que más acerca el resultado.
- **Cada prompt de video sale del movimiento del plano original**, no solo de la imagen. Antes de escribir el `prompt_video` de una toma, abre con Read `movimiento/<nombre de su fotograma>.jpg`: seis cuadros de ese plano del anuncio original, de izquierda a derecha, con el segundo en cada uno. Mira también su `duracion` en `movimiento/planos.json`. Escribe lo que cambia del primer cuadro al último: cómo se mueve la cámara (se acerca, se aleja, sigue al personaje, panea o queda quieta) y a qué velocidad; qué hace el personaje y en qué momento del clip; cómo cambia su expresión; y qué se mueve en el fondo (luz, partículas, gente). Va un solo movimiento de cámara y una sola acción, como en el original, y las frases de "Movimientos y gestos" sirven de base. El ritmo del anuncio también se copia: `ritmo-ref` en `planos.json` dice cuánto dura en promedio cada plano del original, y las tomas se escriben con ese largo (si el original corta cada 2 segundos, nada de tomas de 6).
- **El texto del guion sale de "Tono e intención"**: cada beat tiene una intención y una energía. Se escribe desde cero para el producto del usuario, con esa intención.

## Segunda referencia, en español (`es/es-01.jpg` a `es/es-12.jpg`)
Es el mismo formato hecho en español latino para unas gotas de curvas. Sirve como vara de **cómo suena y se corta en español**: dura unos 95 segundos y tiene más planos (unos 33, de 2 a 3 segundos cada uno). Míralo junto a la primera referencia.
- **La protagonista**: la misma familia de personaje. Es morena, con un pelo rizado enorme castaño con reflejos, y en la primera toma lleva lentes y tatuajes en el brazo. Su ropa cambia en cada lugar: un top negro con short gris, una camiseta blanca con leggings, un top bordó con jeans, un crop negro, una camiseta azul con pantalón crema.
- **Lo que suma esta referencia**:
  - **el "antes" en otra escena**: ella embarazada o con la panza abultada, en un muelle de playa, con la flecha dorada que baja a la panza;
  - **el pantalón que le sobra**: ella lo estira con las dos manos;
  - **la prima** que "ya está encima de ti", en el café;
  - **el celular con la página del producto** y el botón "ORDER NOW", en la mano;
  - **el cierre**: la caja y el frasco con los ingredientes dentro de **burbujas de luz** conectadas, y un bodegón de raíces de maca sobre madera.
- **El guion en español**, en este orden:
  - "La mayoría no sabe lo rápido que trabajan los fitoestrógenos de tu cuerpo en los primeros 14 días."
  - "Después de tu primera gota, los fitoestrógenos se ponen a trabajar: le dicen a tu cuerpo dónde guardar la grasa." Y "el pantalón te va a quedar apretado y vas a tener que ir a comprarte otro".
  - "La grasa que antes iba directo a la barriga ahora empieza a buscar el camino hacia tu cola."
  - "Después de 2 semanas, los cambios ya se acumularon: tus muslos, tu cola, justo donde tú lo querías. La barriga se queda plana." Y "no es una señal de 'guarda grasa en el estómago'".
  - "Después de 3 semanas, tu prima ya está encima de ti. Te ves en el espejo y es real de verdad."
  - "Y después de un mes, tus curvas ya se quedan. Esto no es temporal: cuando tu estrógeno se mantiene…"
  - "Los hombres se dan cuenta cuando entras a un cuarto, tu ex de repente encuentra una excusa, tus primas preguntan qué hiciste diferente. Te sientes como otra persona."
  - "Ahora mismo lo puedes probar, y está hasta 75% de descuento. Se agota seguido: no esperes."
- **Fotogramas**:

  | Foto | Qué muestra | Úsalo para |
  |---|---|---|
  | es-01 | en la cocina, con lentes, se pone gotas | el gancho |
  | es-02 | de espaldas en el gimnasio, con la cinta dorada en la cadera | "lo rápido que funciona" |
  | es-03 | el frasco en la mesa de madera, con los ingredientes flotando en un remolino dorado | "se ponen a trabajar" |
  | es-04 | de espaldas, en una tienda de jeans | "vas a tener que ir a comprarte otro" |
  | es-05 | cruza la calle en la ciudad, con jeans | "empieza a buscar el camino hacia tu cola" |
  | es-06 | de espaldas en el supermercado, con un aro dorado en la cintura | "tus muslos, tu cola" |
  | es-07 | camina hacia el café donde está la prima | "tu prima ya está encima de ti" |
  | es-08 | camina en la terraza del café, con la estela dorada por las piernas | "tus curvas ya se quedan" |
  | es-09 | de noche, sonríe y muestra el celular | "tu ex de repente encuentra una excusa" |
  | es-10 | camina por la vereda, con pantalón crema y tacones | "te sientes como otra persona" |
  | es-11 | la caja y el frasco con los ingredientes en burbujas de luz | "hasta 75% de descuento" |
  | es-12 | sonríe y señala el frasco que tiene en la mano | "no esperes" |

## Los avatares (así tienen que verse los personajes)
Así son los personajes del anuncio de referencia, al detalle. Cada avatar de un anuncio con este subestilo se hace así: la hoja del personaje sigue este retrato y este prompt. Lo único que cambia es lo que el usuario pida (su producto, la edad, el origen o un detalle de su público). Su ficha para la app está en `avatar/avatar.json`.

### La del glow-up (`protagonista`)
Retrato de referencia: `avatar/protagonista.jpg` (sale de `ref-12.jpg`).
- Una mujer joven de 25 a 30 años, afrodescendiente, en Pixar, de piel morena oscura cálida y brillante.
- Pelo negro larguísimo en rizos espirales definidos, con un volumen enorme que le pasa los hombros.
- Cara redonda y dulce: ojos grandes café con pestañas largas y brillo, cejas suaves, nariz pequeña, labios llenos y una sonrisa amplia.
- Cuerpo de reloj de arena exagerado y caricaturesco: cintura muy fina, cadera y glúteos grandes.
- Ropa ajustada y lisa: camiseta blanca, bordó o negra corta, con jeans altos claros o leggings, y zapatillas blancas.
- Render Pixar cálido y luminoso, con luz de hora dorada o de tienda. La expresión va de la sorpresa al orgullo.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-estilo-pixar/subestilos/glow-up-senal-dorada/avatar/protagonista.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Pixar-style 3D animated {persona} in her late 20s, warm glowing deep-brown skin, very long voluminous black spiral curls past the shoulders, round sweet face with big brown eyes and long lashes, small nose, full lips, wide confident smile, exaggerated cartoon hourglass figure with a tiny waist and full hips, fitted plain white crop t-shirt, high-waisted light-wash jeans and white sneakers, standing in a bright modern apartment with a window, full body front view, high-end 3D animated feature film render (Pixar / Disney 2020s look), soft subsurface skin, glossy expressive eyes with catchlights, detailed hair strands, warm cinematic light. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

### La del glow-up (versión en español) (`protagonista-es`)
Retrato de referencia: `avatar/protagonista-es.jpg` (sale de `es/es-12.jpg`).
- La misma familia de personaje que la primera referencia: mujer joven afrodescendiente en Pixar, de piel morena oscura.
- Pelo enorme en rizos espirales castaño oscuro con reflejos, y en la cocina lentes y tatuajes finos en el brazo.
- La ropa cambia en cada lugar: top negro con short gris, camiseta blanca con jeans, top bordó, camiseta azul con pantalón crema y tacones.
- **Va adjunto a su hoja**: en el manifiesto, la referencia de este personaje lleva `"fotograma": ".claude/skills/anuncios-estilo-pixar/subestilos/glow-up-senal-dorada/avatar/protagonista-es.jpg"`. El motor manda la versión limpia, sin texto, y el prompt de la hoja sale del de abajo.

Prompt de la hoja (en inglés; `{persona}` es el origen y el género: por ejemplo, "Colombian woman"):
```
Pixar-style 3D animated {persona} in her late 20s, deep-brown skin, huge voluminous dark-brown spiral curls with lighter highlights, big expressive eyes, friendly confident smile, curvy hourglass figure, fitted white t-shirt and light-wash high-waisted jeans, holding a small dropper bottle and pointing at it, bright apartment with a window, full body, high-end 3D animated feature film render (Pixar / Disney 2020s look), soft subsurface skin, glossy expressive eyes with catchlights, detailed hair strands, warm cinematic light. Vertical 9:16, one single character, full face clearly visible, plain background or the location described, no text, no logos, no watermark.
```

## Lo que no se copia
Ni la marca, ni el producto, ni las promesas tal cual: lo que se promete es lo que el producto del usuario puede sostener. Si el producto no es de figura o autoestima, usa la señal dorada como recurso para cualquier mecanismo invisible.
