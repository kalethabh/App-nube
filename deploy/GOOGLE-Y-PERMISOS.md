# Google y permisos por sección en Kads

Esta función usa el Supabase **propio de Kads**, que ya gestiona sus cuentas. No usa el proyecto del Centro de Control.
La app local sigue sin pedir cuenta si no tiene `KADS_SUPABASE_URL` y `KADS_SUPABASE_ANON` configurados. No se incluyen
credenciales de Google ni nuevas dependencias en el código de la app.

## Activar los permisos

1. Actualiza Kads y entra con tu cuenta de administrador (rol `owner`). Tu rol se conserva.
2. En **Usuarios → Preparar Google y permisos**, descarga la actualización SQL. También puedes ejecutar primero
   `deploy/supabase-kads.sql` y después `deploy/supabase-permisos-google.sql` en el SQL Editor del proyecto de Kads.
   Son repetibles y no borran cuentas, productos ni generaciones.
3. Las cuentas nuevas quedan pendientes. En **Usuarios**, elige su rol, abre **Elegir secciones**, marca lo que puede usar
   y pulsa **Guardar acceso**. A partir de la migración, las cuentas no administradoras empiezan sin secciones.
4. El administrador mantiene acceso completo. No puede rebajarse a sí mismo ni crear otro administrador desde ese panel.
   Claves, conexiones, actualizaciones y usuarios siguen reservados al administrador. Oficina virtual es de consulta.

Antes de aplicar el SQL se conserva el acceso anterior de las cuentas aprobadas, con un aviso al administrador.
El panel no afirma haber guardado permisos si falta la migración. Después de guardarlos, el servidor invalida su caché
para esa persona: sus solicitudes nuevas respetan el cambio. El menú se actualiza al recargar o en unos 15 segundos.
Con varios procesos del servidor, los otros revisan el acceso cada 30 segundos.

Los permisos son por sección. No separan los proyectos por dueño ni las tiendas por usuario. Las secciones de generación
pueden leer productos, investigación y recursos necesarios como entradas; eso no habilita editar esos apartados.
Los conectores externos con su propia llave mantienen su mecanismo de acceso separado.

## Activar Google

1. Usa una dirección pública HTTPS estable de Kads. Si hay Vercel, debe ser la dirección que abre el usuario.
   Puedes fijarla con `KADS_URL_PUBLICA=https://tu-kads.example`. Sin ella, se usa `KADS_PUERTA` o `ANUNCIOS_DOMINIO`.
   Para desarrollo también se admite `http://localhost:PUERTO` o `http://127.0.0.1:PUERTO`.
2. En Google Cloud, configura la pantalla de consentimiento y crea un cliente OAuth de tipo **Aplicación web**.
   Como URI de redirección de Google usa la dirección de callback que muestra el proveedor Google de Supabase
   (`https://TU-PROYECTO.supabase.co/auth/v1/callback`); no la confundas con la dirección de retorno de Kads.
3. En Supabase → Authentication → Sign In / Providers → Google, activa el proveedor y guarda allí el ID y el secreto
   del cliente de Google. Nunca los pegues en el chat ni en el repositorio.
4. En Authentication → URL Configuration, configura la Site URL de Kads y autoriza su retorno:
   `https://tu-kads.example/api/acceso/google/callback**` (el sufijo permite el identificador aleatorio del flujo).
   No uses un comodín para todo un dominio ajeno.
5. En `/entrar`, pulsa **Continuar con Google**. Se usa PKCE S256: el verificador se queda en el servidor y el callback
   necesita la cookie del mismo navegador. Los códigos no se reutilizan; la sesión usa cookies HttpOnly.
6. Entra primero con la cuenta que será administradora en una instalación nueva. Como antes, si aún no existe un
   administrador, el primero que entra lo es. No publiques el enlace de una instalación sin inicializar.
   En una instalación con administrador, las cuentas Google nuevas quedan pendientes de su aprobación.

Si el proveedor aún no está activado o el flujo vence, Kads muestra cómo volver a entrar. Las pruebas locales usan un
proveedor y un Supabase simulados; no sustituyen la comprobación final con tu proyecto y tu cuenta Google reales.

Fuentes oficiales: [Google en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google),
[flujo PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
