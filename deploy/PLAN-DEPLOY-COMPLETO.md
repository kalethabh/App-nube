# Desplegar Kads completo conservando el motor

Recomendación técnica para el pedido del 2026-11-27. No se ha contratado ni desplegado un servidor.

| Parte | Propuesta | Función |
|---|---|---|
| App y motor | VPS x86-64, Ubuntu 24.04, 8 vCPU y 16 GB RAM | Node, agentes Claude/Codex, Chrome, Python, FFmpeg y Remotion, con procesos largos |
| Cuentas | Supabase propio de Kads | Google, cuentas pendientes, administrador y secciones permitidas |
| Proyectos y medios | Disco persistente, con respaldo automático y copia fuera del servidor | temp, output, biblioteca, avatares, ajustes y restauración |
| Dirección | Subdominio propio con HTTPS y Caddy | Acceso directo a Kads, sesiones y callback de Google |

Para empezar con costo bajo se puede evaluar Hetzner CX43 (8 vCPU, 16 GB, 160 GB). Su página pública lo marca
sin disponibilidad al revisar; no asumir stock. La tarifa publicada para Europa es €15,99/mes sin IPv4 ni IVA.
Para trabajo diario, evaluar CPX42 (8 vCPU, 16 GB, 320 GB), con una tarifa publicada de €69,49/mes en Europa,
o un Droplet equivalente de DigitalOcean (8 vCPU, 16 GiB, 320 GiB) de US$96/mes. El CPX usa hardware más nuevo
que CX; no se ha medido Kads en ninguno. Confirmar precio y disponibilidad en el panel antes de contratar.

Supabase Free permite arrancar; para producción continua considerar Pro, desde US$25/mes. IP, impuestos,
dominio, respaldos, almacenamiento adicional y consumo de IA van aparte. Son precios consultados, no una cotización.

## Qué se mantiene y qué se traslada

- La app y el motor se ejecutan juntos en un servicio siempre encendido, con su disco. Supabase no sustituye el motor.
- Google identifica a las personas que entran a Kads. ChatGPT, Claude y los proveedores de generación siguen siendo
  conexiones del motor, que el administrador debe autorizar de nuevo en el servidor.
- Hay que migrar proyectos, productos, investigación, avatares, biblioteca, medios y ajustes reales; copiar solo el código
  de GitHub no lleva todos los archivos pesados. Revisar las rutas absolutas que apuntaban al Mac y las carpetas de nube.
- Las landings ya publicadas en Shopify siguen allí. Las tiendas se conectan de nuevo de forma segura si sus credenciales
  no se migran. No se trasladan secretos a GitHub ni al chat.
- Guardado en una carpeta de Google Drive de escritorio necesita una ruta o mecanismo de respaldo adecuado para Linux.
  No asumir que la carpeta del Mac existe en el VPS.
- La app en el Mac se conserva como respaldo durante la transición. Antes de copiar el estado, terminar los trabajos activos.

## Comprobación antes de cambiar el acceso del equipo

1. Instalar con `deploy/instalar.sh` y comprobar todos los programas y entornos que pide Ajustes → Tu PC, incluidos
   Python del motor, el entorno de Sketch, FFmpeg, Chrome y la cuenta de Codex para imágenes.
2. Configurar el Supabase de Kads y aplicar las dos migraciones; habilitar Google como indica `GOOGLE-Y-PERMISOS.md`.
3. Entrar primero como administrador, conceder una sola sección a una cuenta de prueba y comprobar también una URL
   y una solicitud prohibidas. Cerrar y abrir sesión con Google.
4. Con la aprobación del costo cuando corresponda, generar una imagen, un video completo, un Embudo y una landing;
   probar edición, audio, descarga, clonación de una tienda real y publicación en una tienda de prueba.
5. Reiniciar el servicio y verificar recuperación del estado, biblioteca, medios y respaldos. Restaurar una copia de prueba.
6. Medir la concurrencia y el disco antes de sumar personas. Las pruebas de esta entrega se hicieron en la Mac con motores
   simulados, no certifican el rendimiento ni la disponibilidad de proveedores en un VPS real.

Esta arquitectura se elige porque Kads ejecuta procesos largos, archivos y programas nativos. Los límites de las funciones
serverless de Vercel no encajan con alojar todo ese motor como funciones; el repositorio conserva la puerta opcional en Vercel.

Fuentes consultadas el 2026-11-27:
- https://www.hetzner.com/cloud/cost-optimized/
- https://www.hetzner.com/cloud/regular-performance/
- https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- https://www.digitalocean.com/pricing/droplets
- https://supabase.com/pricing
- https://vercel.com/docs/functions/limitations
