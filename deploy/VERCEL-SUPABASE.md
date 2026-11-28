# Kads en Vercel + Supabase, con salida a Contabo

El motor conserva las rutas, los generadores, los prompts y los modelos existentes. No se convierte video,
Chrome o Claude/Codex en Edge Functions. Un Daemon Linux ejecuta el servidor completo y los procesos nativos;
una función de Vercel entrega la web y comunica las solicitudes al motor mediante Supabase.

## Antes del despliegue real

- Vercel Pro: el Daemon definido en `vercel.json` usa 8 GiB/4 vCPU. Memoria facturada también en espera,
  CPU activa, tráfico, funciones y almacenamiento se cobran según uso; Pro no es una tarifa plana del motor.
  Referencia consultada el 27-11-2026: Daemons publica memoria desde US$0,0212/GB-hora. Ocho GiB encendidos
  730 horas equivalen a unos US$123,81 de memoria antes de créditos, CPU, plan y otros consumos. Es un cálculo
  orientativo con la tarifa inicial, no una cotización para la región/cuenta. No activar sin aprobar el presupuesto.
- El Supabase **propio de Kads**, con las migraciones de acceso existentes y `supabase-motor.sql`.
  Las tablas del motor no tienen acceso para anon/authenticated; solo los servicios de backend.
- Para videos/paquetes mayores de 50 MB, el plan y el límite global de Storage deben permitir archivos de hasta
  2 GiB. El plan Free no permite superar 50 MB por objeto. Ajustar Storage Settings; no hay una degradación
  de resolución para sortear cuotas. Presupuestar almacenamiento/egress suficiente y mantener los buckets privados.
- Instalar/conectar Vercel y Supabase permite revisar el proyecto real. No hace falta comprar dominio;
  se usa la dirección `https://<proyecto>.vercel.app` asignada por Vercel.

## Configuración

Importar este repositorio en Vercel, directorio raíz del repositorio y Framework «Other». El build instala los
paquetes de la interfaz y Remotion; el Daemon construye `deploy/nube/Dockerfile`. Una sola instancia del motor.
No ejecutar a la vez un motor de Contabo conectado a la misma cola.

`vercel.json` fija `NODEJS_HELPERS=0` durante el build: la puerta necesita recibir el cuerpo HTTP original,
sin el preprocesado de helpers de Vercel. Conservarlo también si se sustituye la configuración del build.

Configurar SOLO como variables privadas de producción, sin prefijo VITE ni NEXT_PUBLIC:

| Variable | Uso |
|---|---|
| KADS_URL_PUBLICA | URL HTTPS exacta del proyecto de producción, sin ruta |
| KADS_SUPABASE_URL | Proyecto Supabase de Kads |
| KADS_SUPABASE_ANON | Clave pública del mismo proyecto |
| KADS_SUPABASE_SERVICE_ROLE | Clave de backend para cola y buckets; nunca navegador |
| KADS_CIFRADO | 32 bytes aleatorios en hexadecimal, guardados también fuera de Vercel |
| KADS_DEPLOY_HOOK | Deploy Hook de producción de Vercel para el botón Actualizar |

Generar la llave fuera del chat con `openssl rand -hex 32` y guardarla en un gestor seguro. No regenerarla al
reiniciar: se perdería acceso a los respaldos cifrados anteriores. Nunca poner claves en GitHub.
Los secretos de administración no se pasan al servidor de generación: en Linux ese servidor ejecuta como UID 10001,
separado del supervisor. Después de desplegar, seguir `GOOGLE-Y-PERMISOS.md` usando esta dirección exacta.

Migrar la investigación, referencias, productos, avatares, biblioteca, configuración y medios de la instalación
que realmente usa el usuario. Reautorizar sus conexiones de IA. El respaldo creado por Codex en esta entrega
corresponde a la copia de desarrollo del chat: no sustituye un respaldo de otra instalación de Kads en su Mac.

## Guardado, reinicios y actualizaciones

- Sobres de solicitudes, cookies y respuestas cifrados con AES-256-GCM. El acceso de la app sigue validando
  cuentas, permisos y CSRF; las subidas grandes validan además la sección antes de generar un enlace de subida.
- Datos persistentes cifrados por bloques de 8 MiB y manifiestos inmutables. El puntero del estado se confirma
  después de subir los bloques. Se conserva el historial; revisar su crecimiento y el espacio contratado.
- Copia periódica cada 5 segundos y confirmación del estado antes de entregar respuestas de escritura.
  Los archivos que cambian durante la lectura quedan pendientes o conservan su última versión estable, para no
  bloquear otras secciones mientras se renderiza. Un archivo pendiente se vuelve a copiar en la siguiente pasada.
  Un cierre forzoso puede perder cambios todavía no confirmados. No sustituye una copia independiente.
- Un arrendamiento con número de fencing evita que dos motores procesen o publiquen estado simultáneamente.
  Un pedido reclamado que pierde el motor queda «incierto»: se revisa antes de repetir acciones que puedan cobrar.
- Al redeploy se frenan nuevas escrituras y se consultan los trabajos activos; hay hasta una hora de gracia
  para terminar y respaldar. Evitar redeploy durante tareas que puedan superar esa ventana.
- En Vercel, Actualizar solicita un redeploy por Deploy Hook después de comprobar que no hay generaciones.
  La actualización por ZIP local permanece en Mac/Contabo; en Vercel se actualiza desde GitHub.
- Eventos en vivo conservados mediante tramos cifrados; archivos grandes se entregan en streaming, con Range.
  Los archivos temporales y solicitudes vencidos se limpian; el estado y su historial se conservan.
- Las carpetas de Drive de un Mac requieren configurar una ruta/mecanismo de respaldo válido en Linux.
  Abrir Finder/Terminal local desde una web remota no abre aplicaciones en el equipo del visitante.

## Verificación necesaria antes de darlo por terminado

La suite local cubre cifrado/manipulación, restauración, cola, fencing, permisos, cookies, Range y subida de video
directa con progreso en navegador. PostgreSQL aislado ejecuta la migración real. El CI construye el contenedor
Linux y verifica FFmpeg, Python, Codex, Claude, Chrome y el inicio de la app sin servicios de pago.

Estas pruebas NO certifican un despliegue real. En las cuentas del usuario falta comprobar: Google real y permisos,
una generación de imagen, los estilos de video, música/voz, Sketch, Embudo simultáneo, edición/exportación,
clonación/creación/publicación de landing en Shopify, biblioteca/avatares, descargas, restauración tras reinicio
y costos/espacio. Las pruebas que consuman IA requieren costo concreto aprobado. Comparar configuración y
resolución con la instalación original; no se promete identidad píxel a píxel ni más velocidad.

## Contabo como alternativa y restauración

Se conserva `deploy/instalar.sh` para Ubuntu y se añade `deploy/contabo/compose.yaml` con disco `/srv` persistente.
El mismo Dockerfile funciona con `KADS_MODO=contabo`, sin la cola ni Vercel. Usar Caddy delante de
`127.0.0.1:4455`, con la dirección gratuita `<IP-con-guiones>.sslip.io`, y conservar el Supabase actual para cuentas.

Respaldo portátil, llave fuera de la carpeta del respaldo:

```sh
node deploy/nube/respaldo.mjs crear /ruta/kads /ruta/respaldo /ruta/segura/llave-nueva.txt
node deploy/nube/respaldo.mjs restaurar /ruta/respaldo /ruta/vacia /ruta/segura/llave-nueva.txt
```

Para exportar el último estado de Supabase, usar las variables privadas del motor en una consola segura:

```sh
KADS_HOME=/ruta/vacia-hogar node deploy/nube/respaldo.mjs exportar-nube /ruta/vacia-kads
```

Restaurar primero en carpetas vacías, verificar y copiar a los directorios `/srv/kads` y `/srv/home` del volumen.
El código viene del repositorio/imagen o del archivo de código respaldado; los datos, del respaldo cifrado.
Detener el motor anterior antes del cambio, iniciar solo Contabo, cambiar la dirección pública y el retorno de Google
y repetir las pruebas. Mantener el respaldo original intacto hasta verificar la restauración.

Fuentes: [Daemons](https://vercel.com/docs/daemons), [límites](https://vercel.com/docs/daemons/limits),
[configuración](https://vercel.com/docs/daemons/config-reference), [tarifas](https://vercel.com/pricing),
[límites de Storage](https://supabase.com/docs/guides/storage/uploads/file-limits).
