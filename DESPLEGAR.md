# Kads Studio en internet (para usarla desde el celular o cualquier computador)

> **Gratis y con cuentas para tu equipo:** mira `DESPLEGAR-GRATIS.md` (Oracle Cloud Always Free + un Supabase propio de Kads).

La app queda en un servidor tuyo, siempre prendido, con **HTTPS y contraseña**. Es solo para ti: usa tu cuenta de
Claude, tus claves y tus anuncios, igual que en tu Mac. Costo: el servidor, unos **US$15 al mes** (Hetzner CPX31).

Son 5 pasos. Tardas unos 30 minutos, la mayoría esperando a que se instale.

---

## 1. Un token de GitHub (para que el servidor baje la app y guarde en tus repositorios)

1. Entra a **https://github.com/settings/personal-access-tokens/new**
2. **Token name:** `Kads servidor`. **Expiration:** 1 año.
3. **Repository access:** «Only select repositories» y elige **App-nube**, **biblioteca-anuncios** y **anuncios-ia-videos**.
4. **Permissions → Repository permissions → Contents:** «Read and write».
5. Toca **Generate token** y **cópialo** (empieza con `github_pat_`). No se lo pases a nadie.

## 2. El servidor en Hetzner

1. Crea tu cuenta en **https://www.hetzner.com/cloud** (a veces piden verificar tu identidad: tarda unos minutos).
2. Entra a la consola, crea un **proyecto** y toca **Add Server**:
   - **Location:** Ashburn (Estados Unidos), la más cercana a Latinoamérica.
   - **Image:** Ubuntu **24.04**.
   - **Type:** Shared vCPU · x86 · **CPX31** (4 núcleos, 8 GB).
   - Sin SSH key: te llega la contraseña de `root` por correo.
3. **Create & Buy now**. Anota la **IP** del servidor (algo como `5.161.12.34`).

## 3. Entrar al servidor desde tu Mac

En la **Terminal** de tu Mac (cambia la IP por la tuya):

```bash
ssh root@5.161.12.34
```

Escribe `yes`, después la contraseña del correo. La primera vez te pide cambiarla: escribe la del correo y luego una
nueva dos veces.

## 4. Instalar la app (un solo comando)

Ya dentro del servidor, pega esto. Te pide el token del paso 1 (no se ve al pegarlo) y pulsa Enter:

```bash
read -rsp "Token de GitHub: " T; echo; curl -fsSL -H "Authorization: Bearer $T" -H "Accept: application/vnd.github.raw" https://api.github.com/repos/kalethabh/App-nube/contents/deploy/instalar.sh -o instalar.sh && KADS_TOKEN=$T bash instalar.sh
```

Te pregunta:
- **la contraseña para entrar a la app** (elige una fuerte: la app usa tus claves y tu saldo);
- **tu dominio:** pulsa Enter para usar uno gratis del tipo `5-161-12-34.sslip.io`.

Tarda entre 10 y 20 minutos. Al final te muestra la dirección de tu app.

## 5. Conectar Claude y tus claves

1. Todavía en el servidor:

   ```bash
   sudo -u kads -i claude
   ```

   Te muestra un link: ábrelo en tu navegador, entra con tu cuenta de Claude (Pro o Max) y pega el código que te
   da. Después escribe `/exit` y Enter.
2. Abre tu app en el navegador (la dirección del paso 4). Usuario **kads** y tu contraseña.
3. En **Ajustes → Conexiones**, pega tus claves de kie.ai y ElevenLabs.

Listo. Guárdala en favoritos en el celular: en Safari, Compartir → «Agregar a pantalla de inicio».

---

## Bueno saber

- **Actualizar:** el botón «Actualizar» de la app baja lo nuevo de GitHub y la app se reinicia sola (recarga la
  página en unos 20 segundos).
- **Tu Mac y el servidor guardan en el mismo GitHub.** Si produces en los dos a la vez, cada uno junta lo del otro al
  guardar. Lo más simple: usa uno a la vez.
- **Los anuncios del servidor** quedan en el servidor (y lo liviano en tu GitHub). Google Drive no se usa ahí.
- **Borrar subtítulos** (`subtitulos:borrar`) en el servidor es lento (no tiene tarjeta gráfica): hazlo en tu Mac.
- **Si algo falla:** en el servidor, `journalctl -u kads-studio -n 100` muestra lo último que hizo la app, y
  `systemctl restart kads-studio` la reinicia.
- **Cambiar la contraseña:** vuelve a correr el comando del paso 4 (no borra nada).
