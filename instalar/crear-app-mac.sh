#!/bin/bash
# Crea «Kads Studio.app»: un doble clic y la app arranca sola, sin ventana de Terminal, y se abre en el navegador.
#   - Queda en ~/Applications (Launchpad y Spotlight la encuentran) y una copia en el Escritorio.
#   - Mientras la app corre, su ícono queda en el Dock. Para cerrar la app: clic derecho en el ícono → Salir (o Cmd+Q).
#   - Si algo falta la primera vez (Node.js, ffmpeg, Python), se instala igual que con «Abrir Anuncios con IA.command»;
#     si no puede arrancar, ofrece abrir esa ventana para ver qué pasó.
# La corre sola «Abrir Anuncios con IA.command» la primera vez; también se puede correr a mano: bash instalar/crear-app-mac.sh
set -e
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
NOMBRE="Kads Studio"
DESTINO="$HOME/Applications/$NOMBRE.app"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > "$TMP/app.applescript" <<APPLESCRIPT
property raiz : "$(esc "$RAIZ")"
property direccion : "http://127.0.0.1:4455"

on run
	arrancar()
end run

on reopen
	arrancar()
end reopen

on activa()
	try
		do shell script "curl -fsS -o /dev/null --max-time 2 " & direccion & "/"
		return true
	on error
		return false
	end try
end activa

on arrancar()
	if not activa() then
		do shell script "mkdir -p \"\$HOME/Library/Logs\"; cd " & quoted form of raiz & " && AIA_NO_ABRIR=1 nohup /bin/bash 'Abrir Anuncios con IA.command' > \"\$HOME/Library/Logs/Kads Studio.log\" 2>&1 < /dev/null &"
		repeat 240 times
			if activa() then exit repeat
			delay 1
		end repeat
	end if
	if activa() then
		open location direccion
	else
		set r to display dialog "Kads Studio no pudo arrancar sola. ¿Abro la ventana de arranque para ver qué pasa?" buttons {"Cancelar", "Abrir"} default button "Abrir" with icon caution
		if button returned of r is "Abrir" then do shell script "open " & quoted form of (raiz & "/Abrir Anuncios con IA.command")
	end if
end arrancar

on quit
	try
		do shell script "lsof -ti tcp:4455 -sTCP:LISTEN | xargs kill 2>/dev/null; true"
	end try
	continue quit
end quit
APPLESCRIPT

osacompile -s -o "$TMP/$NOMBRE.app" "$TMP/app.applescript"

# El ícono de Kads (app/public/kads-icono-512.png) como .icns
PNG="$RAIZ/app/public/kads-icono-512.png"
if [ -f "$PNG" ]; then
  SET="$TMP/icono.iconset"; mkdir -p "$SET"
  for t in 16 32 128 256 512; do
    sips -z $t $t "$PNG" --out "$SET/icon_${t}x${t}.png" >/dev/null
    d=$((t * 2)); [ $d -le 512 ] && sips -z $d $d "$PNG" --out "$SET/icon_${t}x${t}@2x.png" >/dev/null
  done
  cp "$PNG" "$SET/icon_512x512@2x.png"
  iconutil -c icns "$SET" -o "$TMP/$NOMBRE.app/Contents/Resources/applet.icns" 2>/dev/null || true
fi
# el ícono propio: sin el AppIcon de Assets.car que pone osacompile (ese ganaría sobre applet.icns)
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$TMP/$NOMBRE.app/Contents/Info.plist" 2>/dev/null || true
rm -f "$TMP/$NOMBRE.app/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $NOMBRE" "$TMP/$NOMBRE.app/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.kalethabh.kadsstudio" "$TMP/$NOMBRE.app/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.kalethabh.kadsstudio" "$TMP/$NOMBRE.app/Contents/Info.plist" 2>/dev/null || true

mkdir -p "$HOME/Applications"
rm -rf "$DESTINO"
cp -R "$TMP/$NOMBRE.app" "$DESTINO"
xattr -dr com.apple.quarantine "$DESTINO" 2>/dev/null || true
printf '%s' "$RAIZ" > "$DESTINO/Contents/Resources/raiz.txt"
codesign --force --deep -s - "$DESTINO" 2>/dev/null || true
touch "$DESTINO"
# la copia del Escritorio (si macOS no deja escribir ahí, queda solo en Aplicaciones)
if [ -d "$HOME/Desktop" ]; then
  rm -rf "$HOME/Desktop/$NOMBRE.app" 2>/dev/null || true
  cp -R "$DESTINO" "$HOME/Desktop/" 2>/dev/null && echo " Listo: «${NOMBRE}» quedó en tu Escritorio y en Aplicaciones." || echo " Listo: «${NOMBRE}» quedó en Aplicaciones (macOS no dejó copiarla al Escritorio)."
else
  echo " Listo: «${NOMBRE}» quedó en Aplicaciones."
fi
