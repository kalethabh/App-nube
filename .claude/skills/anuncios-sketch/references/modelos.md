# Modelos y proveedores

**Por defecto:** imágenes con **GPT Image 2** y video con **Gemini Omni Flash 1.1**, todo vía la API de **Kie**. Es la combinación aprobada en producción: buena consistencia de personajes, etiqueta del producto legible y diálogo con labios sincronizados que respeta el guion palabra por palabra.

El usuario puede pedir otro modelo o proveedor. Se cambia en `proyecto.json` → `"modelos": {"imagen": "<alias>", "video": "<alias>"}`; los adaptadores están en `scripts/modelos.py`.

Parámetros verificados en docs.kie.ai el 2026-10-31. Kie cambia sus modelos seguido: si un payload falla con 422, relee la página del modelo (`https://docs.kie.ai/llms.txt` lista todas) y corrige `modelos.py`.

## Imagen (Kie)
| Alias | Modelo en Kie | Referencias | Créditos (2K) | Notas |
|---|---|---|---|---|
| `gpt-image-2` ⭐ | `gpt-image-2-image-to-image` / `-text-to-image` | `input_urls` ≤ 16 | 10 | Por defecto. Reproduce bien etiquetas y ropa |
| `nano-banana-2` | `nano-banana-2` | `image_input` ≤ 10 | 12 | Buena alternativa si el usuario la pide |
| `nano-banana-2-1` | `nano-banana-2-1` | `image_input` ≤ 10 | 6 | Más barata, mismo esquema |
| `nano-banana-pro` | `nano-banana-pro` | `image_input` ≤ 8 | 18 | Más cara; úsala solo si el usuario la pide |
| `seedream-4.5` | `seedream/4.5-edit` | `image_urls` ≤ 14 | 6,5 | Necesita al menos 1 referencia; prompt ≤ 3000 caracteres |
| `seedream-5-lite` | `seedream/5-lite-image-to-image` | `image_urls` ≤ 14 | 5,5 | Prompt ≤ 2995 caracteres |
Todas aceptan `aspect_ratio` "9:16". Una imagen fallida no se cobra.

## Video con diálogo (Kie)
| Alias | Modelo en Kie | Fotograma inicial | Duraciones | Audio | Créditos (720p) |
|---|---|---|---|---|---|
| `omni-flash` ⭐ | `google/gemini-omni-flash-1-1` | `first_frame_url` | "4","6","8","10" | Diálogo nativo con labios sincronizados (sin interruptor) | 63 / 84 / 105 / 126 |
| `seedance-2` | `bytedance/seedance-2` | `first_frame_url` | 4–15 (entero) | `generate_audio: true` | ≈ 41 por segundo |
| `seedance-2-fast` | `bytedance/seedance-2-fast` | `first_frame_url` | 4–15 | `generate_audio: true` | ≈ 25 por segundo (solo 480p/720p) |
| `kling-3` / `kling-3-pro` | `kling-3.0/video` | `image_urls: [frame]` | "3"–"15" | `sound: true` | 20 / 27 por segundo |
| `veo-3.1-fast` | `veo-3-1` + `input.model: veo3_fast` | `image_urls: [frame]` | 4, 6, 8 | Siempre con audio | ≈ 60 por clip |
Veo quedó por detrás de Omni Flash en las pruebas (más caro por clip y peor con el diálogo): úsalo solo si el usuario lo pide.

**Omni Flash, detalles:**
- `aspect_ratio` no tiene valor por defecto: siempre "9:16".
- `first_frame_url` excluye `image_urls`, `character_ids` y `audio_ids`.
- **Modo personaje + voz** (para fijar la misma voz en todas las tomas): crea voces con `POST /api/v1/omni/audio/create` (`audio_id` de una lista de 30 voces de Gemini, `name`, `voice_description`) y personajes con `POST /api/v1/omni/character/create` (`descriptions`, `image_urls` con retrato y cuerpo, `audio_ids`). Los dos endpoints son gratis. Después se generan los clips con `character_ids` + `image_urls` (hasta 7 cupos), **sin** `first_frame_url`: se pierde el encuadre exacto del fotograma. Úsalo solo si las voces cambian demasiado entre tomas. Con descripciones de voz fijas en el prompt, la consistencia ya fue aceptable.

## Costo típico de un anuncio de 19 tomas (GPT Image 2 + Omni Flash)
- 6 referencias + 19 fotogramas ≈ 250 créditos.
- 18 clips (el packshot no se anima) de 4–8 s ≈ 1.450 créditos.
- 15 % de margen para repeticiones.
- **Total ≈ 1.950 créditos** (1 crédito ≈ USD 0,005, es decir ≈ USD 10).
Antes de producir, calcula el costo exacto del proyecto con `produccion.py <carpeta> estimar` y ponlo en la propuesta. Saldo: `python kie.py credito`.

## Fuera de Kie
- **Google Flow** (navegador, con la cuenta de Google del usuario): imágenes con Nano Banana (2.1, 2 Lite o Pro) y video con Gemini Omni Flash. Procedimiento en `google-flow.md`. Lo generado se registra con `produccion.py <carpeta> registrar <clave> <archivo>` y el montaje y la QA funcionan igual.
- **Cualquier otra herramienta** (Higgsfield, Freepik, Runway, la app de Kling…): mismo principio. Se descarga cada imagen o clip, se registra con `registrar` y se sigue con el montaje.
