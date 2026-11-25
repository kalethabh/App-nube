# Kads Studio en internet, gratis (Oracle Cloud) y con cuentas para tu equipo

Lo mismo que `DESPLEGAR.md`, pero en el servidor **gratis para siempre** de Oracle Cloud (Always Free: 4 núcleos ARM y
24 GB de memoria, más que el de Hetzner) y con **ingreso por cuentas** en un Supabase **propio de Kads** (aparte de
cualquier otra app tuya: no se mezcla nada): cada persona entra con su correo y clave, el primero queda dueño y tú
apruebas a los demás en «Usuarios».

Costo: **$0** mientras uses solo lo marcado «Always Free». Oracle pide una tarjeta para verificar que eres una persona,
pero no cobra lo gratuito.

Son 6 pasos, unos 40 minutos.

---

## 1. Un Supabase solo para Kads (una vez, gratis)

1. Entra a **https://supabase.com/dashboard** y toca **New project** (el plan gratis permite 2 proyectos activos).
   - **Name:** `kads-studio`. **Region:** la más cercana (por ejemplo *East US* o *São Paulo*).
   - Inventa una **Database Password** y guárdala (Kads no la usa, pero Supabase la pide).
2. **Authentication › Sign In / Providers › Email:** apaga **Confirm email** (así quien crea su cuenta entra enseguida;
   igual queda «pendiente» hasta que tú la apruebes).
3. Menú **SQL Editor** › **New query**. Pega TODO el archivo `deploy/supabase-kads.sql` y toca **Run**.
4. En **Project Settings › API** copia la **Project URL** (`https://xxxx.supabase.co`) y la clave **anon public**.
   Las vas a pegar en el servidor en el paso 5 (es la clave pública; la `service_role` NO se usa nunca).

## 2. El token de GitHub

Igual que el paso 1 de `DESPLEGAR.md` (token con acceso a App-nube, biblioteca-anuncios y anuncios-ia-videos).

## 3. El servidor gratis en Oracle Cloud

1. Crea la cuenta en **https://www.oracle.com/cloud/free/**. Como **región principal** elige una cercana
   (por ejemplo *Colombia Central (Bogotá)*, *Brazil East (São Paulo)* o *US East (Ashburn)*): no se cambia después.
2. En la consola: **Compute › Instances › Create instance**.
   - **Image:** Canonical **Ubuntu 24.04**.
   - **Shape:** *Ampere* › **VM.Standard.A1.Flex**, con **4 OCPU y 24 GB** (dice «Always Free eligible»).
   - **SSH keys:** «Generate a key pair for me» y **descarga la llave privada** (guárdala bien).
   - **Boot volume:** sube el tamaño a **100 GB** (gratis hasta 200 GB en total).
   - **Create**. Si dice «Out of capacity», prueba otro *Availability domain* o vuelve a intentar más tarde.
3. Abre la web: en la instancia, **Subnet › Security List › Add Ingress Rules**: Source `0.0.0.0/0`, TCP, puerto
   `80`; y otra igual con el puerto `443`.
4. Anota la **IP pública** de la instancia.

## 4. Entrar al servidor desde tu Mac

```bash
chmod 600 ~/Downloads/ssh-key-*.key
```

```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@TU-IP
```

Ya adentro, hazte administrador:

```bash
sudo -i
```

## 5. Instalar la app (un solo comando)

El mismo del paso 4 de `DESPLEGAR.md`. Te pregunta:
- el **token de GitHub**;
- la **dirección de Supabase** y su **clave anónima** (las del paso 1): con eso la app pide correo y clave a cada uno,
  sin contraseña única;
- tu dominio: **Enter** para usar uno gratis del tipo `1-2-3-4.sslip.io`.

El instalador abre solo el firewall de Oracle (puertos 80 y 443).

## 6. Entrar primero tú, y conectar Claude

1. Abre la dirección que te mostró al final, toca **«No tengo cuenta: crear una»** y **créala tú primero**: el
   primero queda **dueño**.
2. En el servidor, inicia Claude con tu cuenta (igual que en `DESPLEGAR.md`):

   ```bash
   sudo -u kads -i claude
   ```

3. En la app: Ajustes › Conexiones, pega tus claves de kie.ai y ElevenLabs.

## Tu equipo

Cada persona entra a la misma dirección con su cuenta (o la crea ahí mismo) y queda **pendiente**. Tú la apruebas en
el menú **Tu cuenta › Usuarios**:
- **Socio** y **Empleado** usan la app (crear anuncios, imágenes, landings, subir a tus tiendas…);
- solo **tú** cambias Ajustes, claves, la IA conectada, el guardado y conectas o quitas tiendas de Shopify;
- **Rechazado** no entra.

Todos gastan **tu** plan de Claude y **tu** saldo de kie.ai y ElevenLabs.

## Para saber

- Oracle puede **apagar una instancia gratis que pase 7 días casi sin uso**. Si te pasa, en la consola tócala y
  **Start**: la app vuelve sola, con todo. (Pasar la cuenta a «Pay As You Go» lo evita y lo gratuito sigue sin costo.)
- Es un servidor ARM: la app, Claude Code, Codex, ffmpeg y el armador de videos funcionan en ARM.
- La app de tu Mac sigue igual, sin ingreso: las cuentas solo se piden en el servidor.
