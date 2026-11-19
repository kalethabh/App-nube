<!-- Lo propio de UGC por bloques en la tarea "guion" (se agrega a tarea-guion.md). Sin {{marcas}}: va tal cual. La produccion la hace app/server/lib/familias/ugc.js con la skill anuncios-ugc (seccion 11 de COMO-PRODUCIR). -->
## Lo propio de UGC

- **Sin pausas.** El briefing del Paso 1 ya está contestado (arriba dice con qué) y el Paso final no va: la app produce siempre el anuncio completo. Las dos paradas de la skill también las hace la app: mira el costo antes de gastar y revisa la imagen de la persona y cada bloque sola. No le muestres al usuario ningún costo, comando ni pregunta.
- **`tipo`** es el estilo de UGC (testimonio, rutina, review, demo, get ready with me, historia personal…). Con "que decida la IA", eliges tú la estructura de la Sección A según el producto y el público, y la cuentas en `decisiones`.
- **La persona** la decides tú con la Sección C: alguien que se parezca a quien compra (la edad y la situación salen de `publico` y `dolor`). Uno solo, salvo que la historia de verdad pida dos.
- **La duración** (`duracion`): con "que decida la IA", la que el anuncio necesite según la skill (desde cero, como mínimo unos 30 segundos); si el usuario dijo un tiempo, escribe para más o menos ese tiempo. Cada bloque dura lo que piden sus palabras (tabla de "Bloques, tramos y palabras").
- **La carpeta del anuncio la creó la app y es nueva**: usa siempre `temp/<slug>` tal como dice arriba (la regla de G.1 de usar otro slug si la carpeta ya existe no aplica aquí).
- **`notas-paquete.md` va siempre** (G.1), en la carpeta del anuncio: la Sección A entera y, por cada gancho, una línea `**Gancho B — [ángulo en pocas palabras]**` (y lo mismo con el C), con el formato de la Sección E. De ahí la app saca el ángulo de cada versión para el informe.
- **Los dos ganchos alternativos van siempre en el manifiesto** (Sección E y G.2), con `reemplaza: 1`, aunque el usuario no los vaya a producir.
- **Sin voz aparte y sin música tuya.** La voz la genera cada bloque; la música de fondo y los sonidos de las transiciones los pone la app: no crees `musica/` ni `efectos/`. `broll` y `overlays` van vacíos.
- **Las transiciones** van solo en el corte entre dos bloques (los cortes de dentro de un bloque ya vienen en el clip): una parte del guion que arranca en medio de un bloque no lleva, y si dos quedan en cortes seguidos, deja una. En un anuncio de pocos bloques salen menos de cuatro, y está bien.
- **Si viene `guion_del_usuario`** (Paso 0): si está narrado desde afuera, pásalo a la persona hablando a cámara con el cambio mínimo y cuenta en `decisiones` cuántas líneas cambiaste. Si traía textos en pantalla, anótalos en `notas-paquete.md` (no van en los prompts) y di en `decisiones` que no van en el video.
- **En `app/guion.json`:**
  - `se_ve` cuenta en una frase dónde está la persona y qué hace en ese bloque ("en la cocina, abre el frasco y le muestra una cápsula a la cámara"), nunca el prompt.
  - `momento` usa la fase del bloque en una o dos palabras (gancho, problema, descubrimiento, demo, prueba, cierre).
  - `decisiones` dice la estructura que elegiste y por qué, quién es la persona en una frase (edad y cómo se ve) y los lugares que recorre el anuncio.

### Si después te piden cambios

- En un bloque, `linea`, `tramos` y `prompt_video` cambian juntos, y la duración del bloque se vuelve a elegir por sus palabras (con sus timestamps, sin huecos ni solapes).
- Los ganchos comparten con el Bloque 1 todo menos el primer tramo: si cambias un tramo del Bloque 1 desde el segundo en adelante, cámbialo igual en los dos ganchos. Si cambias el arranque del Bloque 1, los ganchos siguen teniendo arranques distintos entre sí y distintos del original.
- Si cambias un lugar, revisa los lugares que vuelven (G.4): el bloque de origen, el `segundo` y los bloques que lo usan.
- Actualiza `notas-paquete.md` si el cambio toca algo que nombra, y `transiciones.json` si una parte del guion pasó a otro bloque.
- **La imagen de la escena de cada bloque** (2026-11-19n, pedido del usuario: verla y editarla antes del video): cada bloque (no los ganchos) lleva `prompt_imagen_inicial`, el prompt de la imagen de ESE momento del bloque —la persona de la hoja, en su lugar, con su ropa, el encuadre de UGC del bloque (selfie o trípode), su gesto y, si aparece, el producto tal como es—, sin texto en la imagen y con las mismas referencias del bloque. En `referencias` del bloque, al final, `"imagen"` (la imagen de esa escena: la app la genera antes del bloque y la manda como una referencia más), y en el prompt de video esa última imagen va declarada como `Imagen N: la escena de este bloque — empieza así: mismo encuadre, lugar, ropa y posición del producto`. Sigue sin frames (`prompt_imagen_final` en null y sin `frame_inicial`). Cuenta las 7 referencias como máximo con ella incluida.
