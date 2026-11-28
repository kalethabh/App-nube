#!/usr/bin/env bash
# Kads Studio en un servidor (Ubuntu 24.04: Oracle Cloud gratis, Hetzner CPX31…). Se corre UNA vez, como root:
#
#   bash instalar.sh
#
# Pregunta tres cosas: tu token de GitHub (para bajar la app y guardar en tus repositorios), la contraseña para
# entrar a la app y, si tienes, tu dominio (si no, usa <tu-ip>.sslip.io, gratis). Después:
#   - instala Node 22, git, ffmpeg, Python, Caddy (HTTPS y contraseña) y lo que Remotion necesita para armar videos;
#   - crea el usuario "kads", baja la app en /home/kads/kads-studio y la deja armada;
#   - instala Claude Code para "kads" (el inicio de sesión con tu cuenta se hace al final, con un link);
#   - deja la app como servicio (se levanta sola al reiniciar el servidor) detrás de Caddy, con HTTPS.
# Se puede volver a correr: lo que ya está, lo deja.
set -euo pipefail

REPO="${KADS_REPO:-kalethabh/App-nube}"
USUARIO=kads
CASA=/home/$USUARIO
CARPETA=$CASA/kads-studio

decir() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
[ "$(id -u)" = 0 ] || { echo "Córrelo como root (en Hetzner entras como root)."; exit 1; }

# ---------------------------------------------------------------- lo que hay que preguntar
IP=$(curl -fsS4 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if [ -z "${KADS_TOKEN:-}" ]; then
  read -rsp "Pega tu token de GitHub (no se ve al escribir) y pulsa Enter: " KADS_TOKEN < /dev/tty; echo
fi
# (2026-11-25a) INGRESO CON CUENTAS (el proyecto de Supabase PROPIO de Kads, aparte de otras apps): con la dirección y
# la clave anónima de Supabase, cada persona entra con su correo y clave y tú apruebas a los demás. Sin ellas, una sola contraseña (Caddy).
if [ -z "${KADS_SUPABASE_URL+x}" ]; then
  read -rp "Dirección de tu Supabase para entrar con cuentas (https://xxxx.supabase.co; Enter para usar una contraseña): " KADS_SUPABASE_URL < /dev/tty || true
fi
if [ -n "${KADS_SUPABASE_URL:-}" ] && [ -z "${KADS_SUPABASE_ANON:-}" ]; then
  read -rp "Su clave anónima (anon public, la de Project Settings › API): " KADS_SUPABASE_ANON < /dev/tty
fi
if [ -z "${KADS_SUPABASE_URL:-}" ] && [ -z "${KADS_CONTRASENA:-}" ]; then
  read -rsp "Escribe la contraseña para entrar a la app y pulsa Enter: " KADS_CONTRASENA < /dev/tty; echo
fi
# (2026-11-25d) la puerta en Vercel (opcional): su dirección reenvía todo a este servidor (vercel/vercel.json)
if [ -z "${KADS_PUERTA+x}" ]; then
  read -rp "Tu dirección de Vercel, p. ej. kads-studio.vercel.app (Enter si no usas Vercel): " KADS_PUERTA < /dev/tty || true
fi
KADS_PUERTA="${KADS_PUERTA#https://}"; KADS_PUERTA="${KADS_PUERTA%/}"
if [ -z "${KADS_DOMINIO:-}" ]; then
  SUGERIDO="${IP//./-}.sslip.io"
  read -rp "Tu dominio (Enter para usar $SUGERIDO): " KADS_DOMINIO < /dev/tty || true
  KADS_DOMINIO="${KADS_DOMINIO:-$SUGERIDO}"
fi
[ -n "$KADS_TOKEN" ] || { echo "Falta el token de GitHub."; exit 1; }
if [ -n "${KADS_SUPABASE_URL:-}" ]; then
  [ -n "${KADS_SUPABASE_ANON:-}" ] || { echo "Falta la clave anónima de Supabase."; exit 1; }
else
  [ -n "${KADS_CONTRASENA:-}" ] || { echo "Falta la contraseña."; exit 1; }
fi

# ---------------------------------------------------------------- programas
decir "Instalando los programas (unos minutos)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ffmpeg python3 python3-venv python3-pip unzip \
  debian-keyring debian-archive-keyring apt-transport-https \
  libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2t64 libxrandr2 libxkbcommon0 \
  libxfixes3 libxcomposite1 libxdamage1 libcups2 libpango-1.0-0 libcairo2 fonts-liberation >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

# (2026-11-25a) Oracle Cloud (gratis): su Ubuntu trae el firewall cerrado salvo SSH. Se abren 80 y 443 (HTTPS).
if command -v netfilter-persistent >/dev/null && iptables -S INPUT 2>/dev/null | grep -q -- '-j REJECT'; then
  for P in 80 443; do
    iptables -C INPUT -p tcp --dport $P -m state --state NEW -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport $P -m state --state NEW -j ACCEPT
  done
  netfilter-persistent save >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------- usuario, acceso a GitHub y la app
decir "Bajando la app de GitHub..."
id -u $USUARIO >/dev/null 2>&1 || useradd -m -s /bin/bash $USUARIO
sudo -u $USUARIO git config --global credential.helper store
printf 'https://x-access-token:%s@github.com\n' "$KADS_TOKEN" > $CASA/.git-credentials
chown $USUARIO:$USUARIO $CASA/.git-credentials && chmod 600 $CASA/.git-credentials
sudo -u $USUARIO git config --global user.name "Kads Studio (servidor)"
sudo -u $USUARIO git config --global user.email "kads-studio@servidor"
if [ ! -d "$CARPETA/.git" ]; then
  sudo -u $USUARIO git clone -q "https://github.com/$REPO.git" "$CARPETA"
else
  sudo -u $USUARIO git -C "$CARPETA" pull -q --no-rebase --no-edit || true
fi

decir "Armando la app (npm install, el armador de videos y la interfaz)..."
sudo -u $USUARIO bash -lc "cd '$CARPETA/app' && npm install --no-audit --no-fund --silent && npm run build --silent"
sudo -u $USUARIO bash -lc "cd '$CARPETA/remotion' && npm install --no-audit --no-fund --silent && npx --yes remotion browser ensure >/dev/null"
[ -f "$CARPETA/.env" ] || sudo -u $USUARIO bash -c "cp '$CARPETA/.env.example' '$CARPETA/.env' 2>/dev/null || touch '$CARPETA/.env'"

decir "Instalando Claude Code..."
sudo -u $USUARIO bash -lc 'command -v claude >/dev/null || [ -x ~/.local/bin/claude ] || curl -fsSL https://claude.ai/install.sh | bash' >/dev/null

# ---------------------------------------------------------------- el servicio y Caddy
decir "Dejando la app como servicio, con HTTPS y tu contraseña..."
cat > /etc/systemd/system/kads-studio.service <<EOF
[Unit]
Description=Kads Studio by Kalethabh
After=network-online.target
Wants=network-online.target

[Service]
User=$USUARIO
WorkingDirectory=$CARPETA
Environment=NODE_ENV=production
Environment=ANUNCIOS_DOMINIO=$KADS_DOMINIO
${KADS_SUPABASE_URL:+Environment=KADS_SUPABASE_URL=$KADS_SUPABASE_URL}
${KADS_SUPABASE_ANON:+Environment=KADS_SUPABASE_ANON=$KADS_SUPABASE_ANON}
${KADS_PUERTA:+Environment=KADS_PUERTA=$KADS_PUERTA}
${KADS_URL_PUBLICA:+Environment=KADS_URL_PUBLICA=$KADS_URL_PUBLICA}
Environment=PATH=$CASA/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node app/server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
if [ -n "${KADS_SUPABASE_URL:-}" ]; then
# con cuentas: la app pide el ingreso (lib/acceso.js); Caddy solo pone el HTTPS
cat > /etc/caddy/Caddyfile <<EOF
$KADS_DOMINIO {
	encode gzip
	reverse_proxy 127.0.0.1:4455 {
		flush_interval -1
	}
}
EOF
else
HASH=$(caddy hash-password --plaintext "$KADS_CONTRASENA")
cat > /etc/caddy/Caddyfile <<EOF
$KADS_DOMINIO {
	encode gzip
	# el conector para Claude (/mcp/<clave>) entra con su propia clave secreta, sin la contraseña del sitio
	@privado {
		not path /mcp/*
	}
	basic_auth @privado {
		kads $HASH
	}
	reverse_proxy 127.0.0.1:4455 {
		flush_interval -1
	}
}
EOF
fi
systemctl daemon-reload
systemctl enable --now kads-studio >/dev/null
systemctl restart caddy

decir "¡Listo!"
cat <<EOF

  Tu app:        https://$KADS_DOMINIO
$(if [ -n "${KADS_PUERTA:-}" ]; then echo "  En Vercel:     https://$KADS_PUERTA   (en vercel/vercel.json, __SERVIDOR__ = $KADS_DOMINIO)"; fi)
$(if [ -n "${KADS_SUPABASE_URL:-}" ]; then echo "  Entrada:       crea tu cuenta ahí mismo. ENTRA TÚ PRIMERO: el primero queda dueño."; else printf '  Usuario:       kads\n  Contraseña:    la que escribiste'; fi)

  Falta UN paso: iniciar sesión en Claude con tu cuenta (para que escriba los guiones). Corre:

      sudo -u kads -i claude

  Te muestra un link: ábrelo en tu navegador, entra con tu cuenta de Claude y pega el código que te da.
  Después escribe /exit. Luego, en la app: Ajustes → Conexiones, pega tus claves de kie.ai y ElevenLabs.

EOF
