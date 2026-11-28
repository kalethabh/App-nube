# Desplegar Kads completo conservando el motor

Recomendación técnica para el pedido del 2026-11-27. No se ha contratado ni desplegado un servidor.

## Prioridad vigente: lo mismo, ya desplegado, sin comprar dominio

El usuario aclaró que solo necesita las herramientas necesarias para conservar los mismos o mejores resultados.
La propuesta anterior de US$121/mes no es un mínimo necesario ni un gasto aprobado.

| Necesario | Cómo se resuelve |
|---|---|
| Un servidor Ubuntu x86-64 con disco persistente | Ejecuta la app y el motor juntos: agentes, Chrome, Python, FFmpeg y Remotion |
| Las cuentas que ya tiene Kads | Reutilizar el proyecto Supabase de Kads para Google y permisos; Pro no es obligatorio para empezar |
| Una dirección pública HTTPS sin comprar dominio | El instalador ya usa `<IP-con-guiones>.sslip.io` cuando se deja el dominio vacío; Caddy obtiene el certificado |
| Las conexiones actuales de generación | Volver a autorizar ChatGPT/Claude y los proveedores que ya usa; no cambiar modelos por el despliegue |
| Proyectos, biblioteca y medios | Migrar al disco persistente y conservar una copia de respaldo |

No hace falta añadir Vercel ni contratar otro frontend, otro almacenamiento de medios o un dominio propio.
El tamaño del servidor se ajustará al uso real: 8 vCPU/16 GB era una propuesta inicial, no un requisito comprobado.
No se puede prometer más velocidad sin medir. Los resultados dependen de conservar modelos, prompts, investigación,
referencias y configuraciones. Menos recursos pueden requerir reducir la concurrencia.

Supabase Free tiene límites y pausa por inactividad: sirve para arrancar si encaja en su uso; Pro es una mejora opcional.
La dirección sslip.io depende de un DNS de terceros y de que la IP pública se mantenga. Los puertos 80/443 deben estar
abiertos para obtener HTTPS. Antes de habilitar Google hay que registrar la dirección exacta de Kads en Supabase
según `GOOGLE-Y-PERMISOS.md`; el callback del proveedor Google es el de Supabase. Verificar el acceso real al desplegar.

Pendiente: disponer de un servidor y acceso seguro para instalar. No hay servidor contratado ni despliegue real;
no se han pedido claves por el chat. La compra requiere precio concreto aceptado por el usuario.

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
- https://sslip.io/
- https://supabase.com/pricing
- https://vercel.com/docs/functions/limitations
