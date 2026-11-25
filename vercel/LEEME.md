# La puerta de Kads Studio en Vercel

Esta carpeta es lo único que se publica en Vercel: una dirección (`<tu-app>.vercel.app`) que reenvía todo a tu
servidor (Oracle), donde corre Kads. Vercel no guarda nada ni corre nada: el ingreso, las claves y el trabajo están
en el servidor, y las cuentas en tu Supabase propio de Kads.

1. En `vercel.json` cambia `__SERVIDOR__` por la dirección de tu servidor (la que te mostró el instalador, p. ej.
   `1-2-3-4.sslip.io`, sin `https://`).
2. En **vercel.com** › **Add New › Project** › importa el repositorio **App-nube** y en **Root Directory** elige
   `vercel`. Framework: **Other**. **Deploy**.
3. En el servidor, la app tiene que conocer esa dirección: el instalador la pregunta («Tu dirección de Vercel»), o
   agrega `Environment=KADS_PUERTA=<tu-app>.vercel.app` en `/etc/systemd/system/kads-studio.service` y corre
   `systemctl daemon-reload && systemctl restart kads-studio`.

La guía completa está en `DESPLEGAR-GRATIS.md`.
