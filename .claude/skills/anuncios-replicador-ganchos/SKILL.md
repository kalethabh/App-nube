---
name: anuncios-replicador-ganchos
description: Hace varias versiones de un anuncio ya hecho cambiándole solo el gancho (los primeros segundos), para probar en Meta o TikTok cuál vende más. Reutiliza todo lo demás del anuncio (imágenes, clips, música), así que solo se paga el gancho nuevo. Los ganchos pueden salir de fórmulas ganadoras, de los ganchos de un video de referencia que sube el usuario (se analizan y se replican para su producto) o de textos que pega el usuario. Funciona con UGC y con los estilos animados con narrador (crochet, claymation, Zack D Films, Pixar, Lego, skeleton). Usar SIEMPRE que el usuario pida "replicar ganchos", "más ganchos", "variantes de gancho", "otros hooks", "probar ganchos", "versiones con otro inicio" o "copia los ganchos de este video" sobre un anuncio que ya existe. No es la clonación (esa hace un anuncio entero nuevo a partir de un video).
---

# Replicador de ganchos — el mismo anuncio con otros inicios

El gancho decide si alguien sigue mirando. Esta skill toma un anuncio que ya está
hecho y saca **varias versiones que solo cambian el gancho**. Todo lo demás se
reutiliza tal cual: no se vuelve a pagar. Interactúa siempre en español con el
usuario, sin importar el idioma del anuncio.

Las reglas de `CLAUDE.md` siguen igual: costo antes de generar y esperar un sí,
nunca un prompt nuevo sin mostrarlo, y lo de `PERSONALIZACION.md` (revisar las
imágenes antes de los videos, voces distintas por personaje).

## Paso 1 — El anuncio y de dónde salen los ganchos

1. **El anuncio**: uno de `temp/` con su manifiesto y sus clips. Si el usuario no
   dice cuál, lista los de `temp/` que tienen clips en `video/` y pregúntale. Si
   está guardado en la nube (no está en `temp/`), pídele que lo traiga de vuelta
   desde la app (Anuncios → el anuncio → "Traer y seguir") antes de seguir.
2. **El estilo** decide cómo se hace (`estilo` y `modo_audio` del manifiesto):
   - **UGC** (`modo_audio: dialogo_nativo`, bloques `R`) → Paso 3A.
   - **Animados con narrador** (`modo_audio: voz_en_off`: crochet, claymation,
     zack-d-films, estilo-pixar, estilo-lego, skeleton) → Paso 3B.
   - **Otros** (podcast, entrevista, objeto parlante, musical, historia musical,
     continuidad): todavía no. Díselo en una frase y ofrécele hacer un anuncio nuevo
     con otro gancho, o clonarlo con `anuncios-clonacion`.
3. **Cuántos ganchos**: de 2 a 5 (si no dice, 3).
4. **De dónde salen**, con `AskUserQuestion` si no lo dijo:
   - **Fórmulas ganadoras** (por defecto): los escribes tú (Paso 2).
   - **De un video de referencia**: el usuario sube uno o varios videos con ganchos que
     le gustan. Analízalos con el analizador de la clonación:
     ```
     node .claude/skills/anuncios-clonacion/scripts/analizar-referencia.mjs <video> temp/[slug]/ganchos-referencia/<n>
     ```
     y quédate con los primeros 2 a 5 segundos de cada uno: qué se ve, qué se dice y
     por qué engancha (la mecánica). Esa mecánica es lo que se replica, no las
     palabras ni las caras.
   - **Textos del usuario**: los que pegue, adaptados a la duración.

## Paso 2 — Escribir los ganchos

Cada gancho **reemplaza el inicio y empalma con lo que sigue**: la frase que viene
después del gancho original tiene que seguir teniendo sentido. Léela antes de
escribir.

- **Mismo largo** que el gancho original (±1 s), o el UGC no calza en su bloque.
- **Cada gancho con una mecánica distinta**, para que la prueba enseñe algo. Las que
  más funcionan:
  1. pregunta que nombra el dolor ("¿Por qué tu piel se ve apagada aunque…?")
  2. dato o cifra que sorprende
  3. "Si [síntoma], [síntoma] y [síntoma]…" (síntomas acumulados)
  4. el error que todos cometen ("Deja de…")
  5. resultado primero, y después cómo
  6. confesión o historia en primera persona
  7. llamado a quién es ("Esto es para las mamás que…")
  8. contradicción ("No es tu crema: es tu agua")
- **Lo visual del gancho también cambia** si la mecánica lo pide (un primer plano del
  problema, un antes y después, el producto en la mano).
- Sin promesas que el producto no cumple.

Muéstraselos al usuario en una lista corta: **el texto de cada gancho, su mecánica y
lo que se verá**, con el costo de cada uno (abajo). Espera su elección: puede quitar,
cambiar o agregar.

**Costo por gancho** (precios de `COMO-PRODUCIR.md`, sección 5): en UGC, un bloque
del largo del Bloque 1 (6 s US$0,42; 8 s US$0,53; 10 s US$0,63). En los animados con
narrador, la imagen de la toma del gancho (US$0,04–0,05) y su clip (US$0,32–0,53),
más la voz entera de nuevo en ElevenLabs (centavos). El montaje no cuesta. El costo
exacto lo da el motor con `--solo-plan` antes de cobrar.

## Paso 3A — UGC

El motor ya sabe hacer esto (ver la skill `anuncios-ugc`, Sección E, y
`COMO-PRODUCIR.md`, sección 11):

1. Escribe los ganchos en `ganchos_alternativos` del manifiesto, con el formato de la
   skill de UGC (`id` `"1b"`, `"1c"`, `"1d"`…, `reemplaza: 1`, y los mismos campos que
   un bloque: `duracion`, `linea`, `tramos`, `prompt_video`, `referencias`). Si ya
   había ganchos, agrega los nuevos con ids que no choquen.
2. `npm run validar -- temp/[slug]/manifiesto.json`
3. `npm run videos -- temp/[slug] --ganchos --solo-plan` → el costo → con el sí,
   `--ganchos --si`.
4. **La revisión de cada gancho** (regla 4 de `CLAUDE.md`): fotogramas y
   transcripción, como cualquier bloque de UGC. Se muestra y se espera el visto bueno.
5. Por cada gancho aprobado, su versión del anuncio:
   ```
   npm run ugc:gancho -- temp/[slug] 1b
   npm run ugc:cola   -- temp/[slug]-gancho-1b --tomas 1
   npm run plan       -- temp/[slug]-gancho-1b
   node produccion/subtitulos-dialogo.js temp/[slug]-gancho-1b
   npm run plan       -- temp/[slug]-gancho-1b
   npm run ensamblar  -- temp/[slug]-gancho-1b
   ```

## Paso 3B — Animados con narrador

Cada gancho es una copia del anuncio en la que solo se rehace la toma del gancho y
la voz. La prepara este comando (no cobra nada):

```
node .claude/skills/anuncios-replicador-ganchos/scripts/crear-variante.mjs temp/[slug] 2
```

Crea `temp/[slug]-gancho-2/` y pasa a `historial/` de la copia la imagen y el clip de
la toma 1, la voz y el plan de montaje (nada se borra, y el original no se toca). Si
el gancho ocupa dos tomas, `--tomas 1,2`. Si el B-roll que acompaña al gancho ya no
le calza, `--con-broll`. Los ids de las variantes: `2`, `3`, `4`… (el original es el
gancho 1).

Después, en el `manifiesto.json` **de la copia**:

1. En la toma del gancho: la `linea` nueva, su `duracion` y sus prompts de imagen y de
   video, escritos con las reglas de la skill del estilo (su bloque universal de
   estilo palabra por palabra y su plantilla de toma). Si el gancho tiene B-roll y lo
   rehaces, también el suyo.
2. En `voz_en_off`: cambia la frase del gancho viejo por la nueva, al principio. El
   resto del texto queda idéntico.
3. Si el estilo usa textos en pantalla (`overlays`) en el gancho, ajústalos.

Y produce solo lo que falta (el motor no vuelve a pagar lo que ya existe):

```
npm run validar   -- temp/[slug]-gancho-2/manifiesto.json
npm run imagenes  -- temp/[slug]-gancho-2 --solo-plan     → costo → --si
   (revisión de la imagen del gancho con el usuario, como dice PERSONALIZACION.md)
npm run audio     -- temp/[slug]-gancho-2                 la voz, con la misma voz del original
npm run videos    -- temp/[slug]-gancho-2 --solo-plan     → costo → --si
npm run revisar   -- temp/[slug]-gancho-2
npm run plan      -- temp/[slug]-gancho-2
npm run subtitulos -- temp/[slug]-gancho-2
npm run plan      -- temp/[slug]-gancho-2
npm run ensamblar -- temp/[slug]-gancho-2
```

- **La voz**: la del anuncio original (mira el informe de entrega o pregúntale). No
  se elige otra: el anuncio tiene que sonar igual salvo el gancho.
- **La música y las transiciones** vienen en la copia: no se generan de nuevo.
- Con varios ganchos, prepara todas las copias y junta los costos en **una sola
  parada** (imágenes de todos los ganchos, y después videos de todos).

## Paso 4 — Entrega

Una tabla corta: cada versión con su gancho (texto y mecánica), la ruta de su MP4
con subtítulos y lo que costó. Recuérdale que para saber cuál gana hay que probarlas
con el mismo presupuesto y el mismo público, y mirar sobre todo cuánta gente se
queda los primeros 3 segundos.
