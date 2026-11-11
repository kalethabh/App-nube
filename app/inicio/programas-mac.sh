#!/bin/bash
# Anuncios con IA (Mac): instala solo lo que le falte a la app, sin contraseña ni permisos de administrador: Node.js,
# ffmpeg (con ffprobe y el códec VP9) y Python con rembg, onnxruntime, Pillow y NumPy. Cada programa se baja de su
# sitio oficial y se comprueba con su huella sha256 antes de usarlo. Todo queda en la carpeta de datos de la app
# (~/Library/Application Support/AnunciosConIA/programas): no toca el sistema. El navegador no hace falta: el armado de
# los videos baja el suyo la primera vez.
# Lo carga «Abrir Anuncios con IA.command» con `source`: cada aia_preparar_* deja el PATH listo en esa ventana.
# Prueba: bash programas-mac.sh --prueba   (AIA_IGNORAR_SISTEMA=1 instala todo aunque el sistema ya lo tenga;
# AIA_PROGRAMAS_DIR cambia dónde quedan los programas)

# Node.js 24 (LTS): el modo prueba de la app necesita NODE_USE_ENV_PROXY, que trae Node 24
AIA_NODE_VERSION="24.22.1"
AIA_NODE_SHA_arm64="89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7"
AIA_NODE_SHA_x64="d132557e7ee2b85af08b0c8c34338e65c6430f2238d01f727728ef42dc83b035"
# Python portátil de python-build-standalone (el mismo que usa uv): el de python.org pide contraseña para instalarse.
# 3.12: rembg y onnxruntime tienen sus paquetes listos para esta versión en Mac con chip Apple y con Intel.
AIA_PY_VERSION="3.12.15"
AIA_PY_FECHA="20261009"
AIA_PY_SHA_arm64="83dcb04777c798bd95f3687acf9ae84b09860272ee6bdfb05be8bcf9447f75b8"
AIA_PY_SHA_x64="4c84ef5abe4bc145646175fce9b881936d60126b9a3f9a24c6308e2d035ca5c6"
# ffmpeg y ffprobe para macOS, firmados y notarizados (ffmpeg.martin-riedl.de, la compilación que enlaza ffmpeg.org);
# traen libvpx (VP9, para el podcast en esquina)
AIA_FFMPEG_VERSION="9.0.2"
AIA_FFMPEG_URL_arm64="https://ffmpeg.martin-riedl.de/download/macos/arm64/1789931890_9.0.2"
AIA_FFMPEG_SHA_arm64="c8ed4c4e6978a03c485edbfe4e0a5dc2380f8a30bba5150531b31b094492d924"
AIA_FFPROBE_SHA_arm64="fcbe839537485eaee7a7a8bc5cbc0f90d53617e80943e8a5b2e31cb851197ea6"
AIA_FFMPEG_URL_x64="https://ffmpeg.martin-riedl.de/download/macos/amd64/1789931006_9.0.2"
AIA_FFMPEG_SHA_x64="7c6b4125b191cbf773832dc51f424cf2b6bb7da43007d1e066f95909e47cacd4"
AIA_FFPROBE_SHA_x64="2322438ed2f6319a691291b247d09c69dcaa3a982460d1f269a7e1af335cfdfd"
# Lo que necesita Python para recortar a los anfitriones del podcast y la entrevista, y para los iconos
AIA_PAQUETES_PYTHON="rembg onnxruntime pillow numpy"

AIA_PROGRAMAS="${AIA_PROGRAMAS_DIR:-$HOME/Library/Application Support/AnunciosConIA/programas}"
# Mac con chip Apple aunque la Terminal corra con Rosetta: los programas nativos van más rápido
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ]; then AIA_ARQ=arm64; else AIA_ARQ=x64; fi

# ---------------------------------------------------------------- ayudantes
# Carpeta de trabajo de esta ventana; borra las que dejó otra ventana que se cerró a la mitad de una descarga
_aia_temporal() {
  local t="$AIA_PROGRAMAS/.descarga-$$"
  mkdir -p "$AIA_PROGRAMAS" || return 1
  find "$AIA_PROGRAMAS" -maxdepth 1 -name '.descarga-*' -mmin +120 -exec rm -rf {} + 2>/dev/null
  rm -rf "$t"; mkdir -p "$t" && echo "$t"
}

# _aia_bajar URL DESTINO SHA256 NOMBRE  (hasta 3 intentos enteros: a veces una descarga llega cortada sin que curl
# lo note, y eso se ve en la huella)
_aia_bajar() {
  local intento=1
  while :; do
    echo " Descargando $4..."
    rm -f "$2"
    # si la descarga se queda quieta un minuto, se corta y se reintenta (si no, la ventana esperaría para siempre)
    if ! curl -fL --retry 3 --retry-delay 3 --connect-timeout 30 --speed-limit 1024 --speed-time 60 --progress-bar -o "$2" "$1"; then
      rm -f "$2"; echo " No se pudo descargar $4. Revisa tu internet y vuelve a abrir el archivo."; return 1
    fi
    [ "$(shasum -a 256 "$2" | awk '{print $1}')" = "$3" ] && return 0
    rm -f "$2"
    if [ "$intento" -ge 3 ]; then
      echo " La descarga de $4 llegó incompleta o cambiada: no se usa. Vuelve a abrir el archivo para bajarla otra vez."; return 1
    fi
    intento=$((intento + 1))
    echo " La descarga de $4 llegó incompleta. Probando otra vez ($intento de 3)..."
    sleep 3
  done
}

# _aia_desempacar URL SHA256 NOMBRE CARPETA  → deja en CARPETA lo que trae la carpeta de arriba del .tar.gz
_aia_desempacar() {
  local tmp arriba
  tmp="$(_aia_temporal)" || { echo " No se pudo crear la carpeta $AIA_PROGRAMAS."; return 1; }
  mkdir -p "$tmp/x"
  _aia_bajar "$1" "$tmp/archivo.tar.gz" "$2" "$3" || { rm -rf "$tmp"; return 1; }
  if ! tar -xzf "$tmp/archivo.tar.gz" -C "$tmp/x"; then
    rm -rf "$tmp"; echo " No se pudo descomprimir $3 (¿queda espacio en el disco?)."; return 1
  fi
  arriba="$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$arriba" ] || ! { rm -rf "$4" && mv "$arriba" "$4"; }; then
    rm -rf "$tmp"; echo " No se pudo dejar listo $3 en $AIA_PROGRAMAS."; return 1
  fi
  rm -rf "$tmp"
}

# Versión de macOS como número comparable: 13.4.1 → 1304
_aia_macos() { sw_vers -productVersion 2>/dev/null | awk -F. '{ printf "%d", $1 * 100 + $2 }'; }

# Node.js 24 pide macOS 13 (Ventura) o más nuevo: en una Mac más vieja la app no puede funcionar
aia_revisar_macos() {
  local v
  v="$(_aia_macos)" || true
  [ -z "$v" ] || [ "$v" -ge 1300 ]
}

# Node.js 20.19 o más nuevo (lo pide el armado de la interfaz)
_aia_node_ok() { [ -x "$1" ] && "$1" -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 20 || (a === 20 && b >= 19) ? 0 : 1)' >/dev/null 2>&1; }
# De 3.10 a 3.13: en un Python más nuevo rembg y onnxruntime todavía pueden no estar listos para instalar
_aia_python_ok() { [ -x "$1" ] && "$1" -c 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)' >/dev/null 2>&1; }
_aia_paquetes_ok() { "$1" -c 'import importlib.util as u, sys; sys.exit(0 if all(u.find_spec(m) for m in ("rembg", "onnxruntime", "PIL", "numpy")) else 1)' >/dev/null 2>&1; }
# ffmpeg y ffprobe que arrancan, y un ffmpeg que sabe hacer VP9 (libvpx-vp9)
_aia_ffmpeg_ok() {
  [ -x "$1/ffmpeg" ] && [ -x "$1/ffprobe" ] && "$1/ffprobe" -hide_banner -version >/dev/null 2>&1 \
    && "$1/ffmpeg" -hide_banner -encoders 2>/dev/null | grep -q 'libvpx-vp9'
}

# ---------------------------------------------------------------- Node.js
aia_preparar_node() {
  local n dir sha
  n="$(command -v node 2>/dev/null)" || true   # (|| true: así también sirve en una shell con set -e)
  if [ -z "$AIA_IGNORAR_SISTEMA" ] && _aia_node_ok "$n"; then return 0; fi
  dir="$AIA_PROGRAMAS/node-v$AIA_NODE_VERSION-$AIA_ARQ"
  if ! _aia_node_ok "$dir/bin/node"; then
    echo
    echo " Instalando Node.js $AIA_NODE_VERSION (solo la primera vez, unos 50 MB)..."
    eval "sha=\$AIA_NODE_SHA_$AIA_ARQ"
    _aia_desempacar "https://nodejs.org/dist/v$AIA_NODE_VERSION/node-v$AIA_NODE_VERSION-darwin-$AIA_ARQ.tar.gz" "$sha" "Node.js" "$dir" || return 1
    if ! _aia_node_ok "$dir/bin/node"; then
      # Node.js 24 pide macOS 13.5 o más nuevo
      if [ "$(_aia_macos)" -lt 1305 ] 2>/dev/null; then
        echo " Node.js necesita macOS 13.5 o más nuevo: actualiza tu Mac en Ajustes del Sistema → General → Actualización de software."
      else
        echo " Node.js se bajó pero no arranca en esta Mac."
      fi
      return 1
    fi
    echo " Node.js listo."
  fi
  export PATH="$dir/bin:$PATH"
  hash -r
}

# ---------------------------------------------------------------- ffmpeg y ffprobe (con VP9)
aia_preparar_ffmpeg() {
  local f dir tmp prog sha url
  f="$(command -v ffmpeg 2>/dev/null)" || true
  if [ -z "$AIA_IGNORAR_SISTEMA" ] && [ -n "$f" ] && _aia_ffmpeg_ok "$(dirname "$f")"; then return 0; fi
  dir="$AIA_PROGRAMAS/ffmpeg-$AIA_FFMPEG_VERSION-$AIA_ARQ"
  if ! _aia_ffmpeg_ok "$dir"; then
    echo
    echo " Instalando ffmpeg (para armar los videos; solo la primera vez, unos 60 MB)..."
    tmp="$(_aia_temporal)" || { echo " No se pudo crear la carpeta $AIA_PROGRAMAS."; return 1; }
    eval "url=\$AIA_FFMPEG_URL_$AIA_ARQ"
    mkdir -p "$tmp/x"
    for prog in ffmpeg ffprobe; do
      if [ $prog = ffmpeg ]; then eval "sha=\$AIA_FFMPEG_SHA_$AIA_ARQ"; else eval "sha=\$AIA_FFPROBE_SHA_$AIA_ARQ"; fi
      _aia_bajar "$url/$prog.zip" "$tmp/$prog.zip" "$sha" "$prog" || { rm -rf "$tmp"; return 1; }
      unzip -o -q "$tmp/$prog.zip" -d "$tmp/x" || { rm -rf "$tmp"; echo " No se pudo descomprimir $prog."; return 1; }
    done
    chmod +x "$tmp/x/ffmpeg" "$tmp/x/ffprobe" 2>/dev/null
    if ! _aia_ffmpeg_ok "$tmp/x" || ! { rm -rf "$dir" && mv "$tmp/x" "$dir"; }; then
      rm -rf "$tmp"; echo " ffmpeg se bajó pero no arranca en esta Mac (o no trae VP9)."; return 1
    fi
    rm -rf "$tmp"
    echo " ffmpeg listo."
  fi
  export PATH="$dir:$PATH"
  hash -r
}

# ---------------------------------------------------------------- Python 3.10 a 3.13
# Deja en AIA_PY el python3 que usa la app (y en AIA_PY_PROPIO=1 si es el de la app).
aia_preparar_python() {
  local p dir sha pyarq
  AIA_PY_PROPIO=
  p="$(command -v python3 2>/dev/null)" || true
  # el python3 que trae macOS sin las herramientas de desarrollador es un aviso, no un Python: ni se ejecuta
  if [ -z "$AIA_IGNORAR_SISTEMA" ] && [ -n "$p" ] && ! { [ "$p" = /usr/bin/python3 ] && ! xcode-select -p >/dev/null 2>&1; } \
    && _aia_python_ok "$p"; then
    AIA_PY="$p"; return 0
  fi
  dir="$AIA_PROGRAMAS/python-$AIA_PY_VERSION-$AIA_ARQ"
  if ! _aia_python_ok "$dir/bin/python3"; then
    echo
    echo " Instalando Python $AIA_PY_VERSION (solo la primera vez, unos 25 MB)..."
    eval "sha=\$AIA_PY_SHA_$AIA_ARQ"
    if [ "$AIA_ARQ" = arm64 ]; then pyarq=aarch64; else pyarq=x86_64; fi
    _aia_desempacar "https://github.com/astral-sh/python-build-standalone/releases/download/$AIA_PY_FECHA/cpython-$AIA_PY_VERSION%2B$AIA_PY_FECHA-$pyarq-apple-darwin-install_only.tar.gz" \
      "$sha" "Python" "$dir" || return 1
    _aia_python_ok "$dir/bin/python3" || { echo " Python se bajó pero no arranca en esta Mac."; return 1; }
    echo " Python listo."
  fi
  export PATH="$dir/bin:$PATH"
  hash -r
  AIA_PY="$dir/bin/python3"
  AIA_PY_PROPIO=1
  # este Python no trae los certificados para conectarse por https: usa los de macOS
  [ -z "$SSL_CERT_FILE" ] && [ -f /etc/ssl/cert.pem ] && export SSL_CERT_FILE=/etc/ssl/cert.pem
  return 0
}

# ---------------------------------------------------------------- rembg, onnxruntime, Pillow y NumPy
aia_preparar_paquetes_python() {
  local salida
  [ -n "$AIA_PY" ] || return 1
  _aia_paquetes_ok "$AIA_PY" && return 0
  echo
  echo " Instalando lo que usa Python para recortar personas y armar iconos (solo la primera vez, unos 300 MB)..."
  "$AIA_PY" -m pip --version >/dev/null 2>&1 || "$AIA_PY" -m ensurepip --upgrade >/dev/null 2>&1
  # --prefer-binary: si la versión más nueva de un paquete no viene lista para esta Mac (pasa en las Mac con Intel con
  # numba, llvmlite y onnxruntime), pip usa la anterior que sí, en vez de intentar compilarla (sin herramientas de
  # programador falla, y además macOS ofrecería instalarlas).
  # (sin las comillas: son varios paquetes)
  # shellcheck disable=SC2086
  if [ -n "$AIA_PY_PROPIO" ]; then
    # el Python de la app es solo de la app: los paquetes van adentro de su carpeta
    "$AIA_PY" -m pip install --prefer-binary --disable-pip-version-check --no-input --no-warn-script-location $AIA_PAQUETES_PYTHON
  elif ! salida="$("$AIA_PY" -m pip install --prefer-binary --user --disable-pip-version-check --no-input --no-warn-script-location $AIA_PAQUETES_PYTHON 2>&1)"; then
    echo "$salida" | tail -n 5
    if echo "$salida" | grep -q externally-managed; then
      "$AIA_PY" -m pip install --prefer-binary --user --break-system-packages --disable-pip-version-check --no-input --no-warn-script-location $AIA_PAQUETES_PYTHON  # Python de Homebrew
    else
      "$AIA_PY" -m pip install --prefer-binary --disable-pip-version-check --no-input --no-warn-script-location $AIA_PAQUETES_PYTHON  # entorno virtual
    fi
  fi
  if "$AIA_PY" -c 'import rembg, onnxruntime, PIL, numpy' >/dev/null 2>&1; then
    echo " Paquetes de Python listos."
  else
    return 1
  fi
}

# ---------------------------------------------------------------- prueba: bash programas-mac.sh --prueba
if [ "${BASH_SOURCE[0]}" = "$0" ] && [ "$1" = "--prueba" ]; then
  r=0
  aia_preparar_node || r=1
  aia_preparar_ffmpeg || r=1
  aia_preparar_python || r=1
  aia_preparar_paquetes_python || r=1
  echo "node=$(command -v node) $(node --version 2>/dev/null)"
  echo "python=$AIA_PY $("$AIA_PY" --version 2>&1)"
  echo "ffmpeg=$(command -v ffmpeg) ffprobe=$(command -v ffprobe)"
  echo "PATH=$PATH"
  exit $r
fi
