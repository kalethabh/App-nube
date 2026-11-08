<!-- Lo propio de Objeto parlante en la tarea "guion" (se agrega a tarea-guion.md como {{delEstilo}}). Sin {{marcas}}: va tal cual.
     Lo que la produccion necesita del manifiesto (familias/objeto-parlante.js): la frase de cada toma en `linea` y, letra por
     letra entre comillas, dentro de su `prompt_video` (la revision del habla la compara con lo que se oye, y un rechazo de
     contenido se arregla cambiando esa frase en los dos lugares). -->
## Lo propio de Objeto parlante

- **Esta skill no tiene nada que preguntar en la app.** Quién habla lo decides tú con la regla de la skill (Paso 2.1: por defecto confiesa la alternativa que el cliente probó antes y no le funcionó; la ficha la trae en `probo` si el usuario la contó), salvo que `ajustes_del_estilo` traiga `quien_habla`: ese manda. No preguntes los personajes del Paso 0: los decides tú y los cuentas en "decisiones".
- **Aquí no hay narrador ni voz que elegir.** Cada personaje dice su frase dentro de su clip, con la boca sincronizada: el manifiesto va con `"modo_audio": "dialogo_nativo"` y sin `voz_en_off`. La voz de cada personaje la pone el modelo de video con lo que dice su `prompt_video` (el tono y el tipo de voz van ahí, en inglés, como pide la skill).
- **La frase de cada toma va en `linea` y, letra por letra y entre comillas, dentro de su `prompt_video`**, con el idioma declarado ("Habla en español latino neutro."). Sin una coma de diferencia: la app escucha cada clip y lo compara con `linea`.
- **Si viene `guion_del_usuario` narrado en tercera persona**, pásalo a primera persona con el cambio mínimo (la excepción del Paso 0) y cuéntalo en "decisiones" con un ejemplo corto de antes y después ("Pasé el guion a primera persona: «Este rodillo te cobra cada semana» → «Te cobro cada semana»"): el usuario lo aprueba al leer el guion en la app. Si ya venía en primera persona, no toques nada.
- **Cada toma**: como mucho 8 segundos y 17 palabras (Paso 2.4). Una línea más larga se parte en dos tomas.
- El B-roll va `encima_de_toma`, nunca `despues_de_toma`.
- **La música y los efectos de sonido los pone la app** (la música, con el tono de tu guion): no crees `musica/` ni `efectos/`.
- **En `app/guion.json`:** `se_ve` cuenta la escena como lo que es, un objeto animado que habla ("el rodillo de madera levanta las cejas en un spa"); `decisiones` dice el ángulo, quién habla y por qué (en una frase cada personaje).
- **Si después te piden cambios:** no hay `voz_en_off` que actualizar. Si cambias una frase, cámbiala en su `linea` y en la misma frase dentro de su `prompt_video`, letra por letra.
