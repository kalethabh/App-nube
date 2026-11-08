#!/bin/bash
# Anuncios con IA para Mac: doble clic. La primera vez macOS lo bloquea por venir de internet: clic derecho sobre este
# archivo → Abrir → Abrir (o Ajustes del Sistema → Privacidad y seguridad → «Abrir igualmente»).
# Deja esta ventana abierta mientras uses la app; para cerrarla, cierra esta ventana. Si falta Node.js, ffmpeg, Python o
# Claude Code, los instala solo (de sus sitios oficiales y sin contraseña), deja lista la app y la abre en el navegador.

RAIZ="$(cd "$(dirname "$0")" && pwd)"
pausar() { echo; read -n 1 -s -r -p " Pulsa una tecla para cerrar esta ventana." < /dev/tty 2>/dev/null; echo; }
falta() { echo; echo " $1"; [ -n "$2" ] && [ -z "$AIA_NO_ABRIR" ] && open "$2"; pausar; exit 1; }

cd "$RAIZ/app" 2>/dev/null && [ -f "$RAIZ/app/inicio/programas-mac.sh" ] \
  || falta "No encuentro la carpeta \"app\" completa junto a este archivo. Descomprime el .zip completo y abre este archivo desde esa carpeta."
printf '\033]0;Anuncios con IA\007'
# Claude Code (instalador oficial) queda en ~/.local/bin; Homebrew en /opt/homebrew (Apple) o /usr/local (Intel)
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Siempre con tu cuenta de Claude, nunca con una clave de API
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CLAUDE_CODE_OAUTH_TOKEN

# 4455 siempre; PUERTO=<n> solo para las pruebas (el servidor lee la misma variable)
URL="http://127.0.0.1:${PUERTO:-4455}"

# Si la app ya está abierta en otra ventana, solo se abre el navegador. Si en ese puerto responde OTRO programa, se avisa.
if curl -sS -o /dev/null --max-time 3 "$URL/" 2>/dev/null; then
  if curl -fsS --max-time 20 "$URL/api/estado" 2>/dev/null | grep -qE '"app":"anuncios-con-ia"|"claudeCode"'; then
    [ -z "$AIA_NO_ABRIR" ] && open "$URL"
    exit 0
  fi
  falta "La dirección que usa Anuncios con IA ($URL) ya la está usando otro programa. Cierra ese programa (o reinicia la Mac) y vuelve a abrir este archivo."
fi

echo
echo " Anuncios con IA: revisando lo necesario..."

# La primera vez: quitar la "cuarentena" que macOS pone a lo bajado de internet (así no vuelve a preguntar por cada archivo)
[ -d node_modules ] || xattr -dr com.apple.quarantine "$RAIZ" 2>/dev/null

case "$RAIZ" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*|*"/Mobile Documents/"*|*"/CloudStorage/"*)
    echo " Consejo: mueve la carpeta \"$(basename "$RAIZ")\" a tu carpeta de inicio (Finder → Ir → Inicio)."
    echo "          En Escritorio, Documentos o Descargas macOS pide permisos a cada rato e iCloud puede subir tus videos enteros." ;;
esac

# Node.js, ffmpeg y Python: si faltan, se instalan solos (sin contraseña) con programas-mac.sh
. "$RAIZ/app/inicio/programas-mac.sh" || falta "Falta el archivo app/inicio/programas-mac.sh. Vuelve a descomprimir el .zip completo."
aia_revisar_macos || falta "Anuncios con IA necesita macOS 13 (Ventura) o más nuevo, y esta Mac tiene macOS $(sw_vers -productVersion). Si tu Mac lo permite, actualízala en Ajustes del Sistema → General → Actualización de software."

# ---------------------------------------------------------------- Node.js 20.19 o más nuevo
aia_preparar_node || falta "No se pudo dejar listo Node.js (arriba dice por qué). Si fue el internet, vuelve a abrir este archivo."

# ---------------------------------------------------------------- ffmpeg (con VP9) y Python con sus paquetes
# Si no se pueden instalar, la app abre igual y lo muestra en Ajustes → Tu PC
aia_preparar_ffmpeg || echo " Aviso: sin ffmpeg la app no puede armar los videos. Vuelve a abrir este archivo para intentarlo de nuevo."
if aia_preparar_python; then
  aia_preparar_paquetes_python || echo " Aviso: no se pudieron instalar los paquetes de Python. Sin ellos no salen el podcast en esquina, la entrevista ni los iconos. Vuelve a abrir este archivo para intentarlo de nuevo."
else
  echo " Aviso: no se pudo instalar Python. Sin Python no salen el podcast en esquina, la entrevista ni los iconos. Vuelve a abrir este archivo para intentarlo de nuevo."
fi

# ---------------------------------------------------------------- Claude Code
if ! command -v claude >/dev/null 2>&1; then
  echo
  echo " Instalando Claude Code con el instalador oficial de Anthropic (solo la primera vez)..."
  curl -fsSL https://claude.ai/install.sh | bash
  hash -r
  if command -v claude >/dev/null 2>&1; then
    # que la Terminal también lo encuentre cuando la abras tú
    if [ -x "$HOME/.local/bin/claude" ] && ! grep -qs '.local/bin' "$HOME/.zshrc"; then
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    fi
    echo " Claude Code listo."
  else
    echo " Aviso: no se pudo instalar Claude Code. La app te muestra cómo hacerlo en la Bienvenida."
  fi
fi

# ---------------------------------------------------------------- la app: lo que falte de instalar y la interfaz
node "$RAIZ/app/inicio/preparar-app.mjs" || { pausar; exit 1; }

# ---------------------------------------------------------------- abrir la app
echo
echo " Abriendo Anuncios con IA en tu navegador..."
echo " Deja esta ventana abierta mientras uses la app. Para cerrarla, cierra esta ventana."
echo
[ -z "$AIA_NO_ABRIR" ] && ( sleep 3; open "$URL" ) &
node server/index.js
codigo=$?
# si hubo un error, la ventana espera para poder leerlo
[ $codigo -ne 0 ] && pausar
exit $codigo
