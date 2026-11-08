<!-- La tarea "ficha": la app la manda como primer mensaje de la sesion. Las {{marcas}} las llena app/server/lib/productos.js. -->
TAREA: ficha del producto
Carpeta del producto: {{carpeta}}

El usuario cargó su producto en la app y quiere hacer anuncios. Arma la ficha del producto: la app se la muestra para que la corrija y después la usan todos los estilos de anuncio. Aquí no se escribe ningún anuncio.

## Lo que tienes

Lo que el usuario escribió en la app (`{{carpeta}}/producto.json`):

```json
{{datos}}
```

Fotos del producto (míralas todas con Read; la primera es la principal):
{{fotos}}

Texto de su página: {{pagina}}

## Qué hacer

1. Lee el texto de la página (si hay) y mira cada foto. De las fotos sale lo que dice la etiqueta: nombre, qué es, cantidad, ingredientes, cómo se usa.
2. Escribe `{{carpeta}}/ficha.json` con este formato (todos los campos van, aunque sea vacíos):

```json
{
  "nombre": "el nombre del producto, como lo escribe la marca",
  "queEs": "qué es, en una frase corta",
  "tipo": "fisico | digital | servicio",
  "beneficios": ["de 2 a 6 beneficios, cortos, con las palabras de la marca o del cliente"],
  "publico": "para quién es: edad, género, situación",
  "dolor": "el problema principal que resuelve, como lo vive el cliente",
  "oferta": "precio, descuento, envío, garantía (vacío si no se sabe)",
  "comoCompra": "cómo compra el cliente: web, contra entrega, WhatsApp, cita…",
  "idioma": "es | en | pt (el idioma del anuncio)",
  "mercado": "LatAm | EEUU | Brasil",
  "pais": "el país, si se sabe (vacío si no)",
  "probo": "lo que el cliente ya probó y no le funcionó (vacío si no se sabe)",
  "prueba": "reseñas o datos reales que aparecen en la página, tal cual (vacío si no hay)",
  "ingredientes": "ingredientes o componentes y dosis, si se leen en la etiqueta o la página (vacío si no)",
  "comoSeUsa": "cómo se usa o se toma (vacío si no se sabe)",
  "fotos": [{ "archivo": "fotos/1.png", "sirve": true, "nota": "qué se ve en la foto, en pocas palabras" }],
  "deducido": ["los campos que dedujiste tú, sin que lo diga el usuario, la página ni la etiqueta"],
  "falta": [{ "campo": "oferta", "pregunta": "¿Cuánto cuesta y tienes alguna oferta?" }]
}
```

## Reglas de la ficha

- **No inventes datos.** Precios, descuentos, reseñas, cifras, ingredientes, dosis, garantías y plazos salen solo de lo que escribió el usuario, de su página o de la etiqueta. Si no están, el campo queda vacío.
- **Lo que se puede deducir con sentido común se deduce** (el público, el dolor, el mercado y el idioma por el idioma y la moneda de la página o de la etiqueta) y su nombre de campo va en `deducido`. Lo que dijo el usuario, la página o la etiqueta no va en `deducido`.
- **Lo que el usuario escribió manda** sobre lo que dice la página.
- **`falta` es lo que vas a preguntarle**: solo lo que de verdad cambia el anuncio y no se puede deducir, como mucho 3, de lo más importante a lo menos. Cada pregunta es corta, con tuteo, y se contesta en una línea. Si algo no hace falta para el anuncio, no lo preguntes: déjalo vacío. Si preguntas por un campo que ya tiene algo (por ejemplo la garantía, cuando `oferta` ya trae el precio), la respuesta se suma a lo que ya dice: pregunta solo lo que le falta a ese campo, nunca lo que ya está.
- En `fotos`, `sirve` es false si la foto no muestra el producto (un banner, un logo suelto, una foto borrosa); la nota dice por qué en pocas palabras.
- Todo en español sencillo, aunque la página esté en otro idioma (salvo `nombre`, que va como lo escribe la marca).

Cuando `ficha.json` esté escrito, responde solo LISTO.
