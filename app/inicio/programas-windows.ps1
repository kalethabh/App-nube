# Anuncios con IA (Windows): instala solo lo que le falte a la app, sin permisos de administrador: Node.js, ffmpeg
# (con ffprobe y el códec VP9) y Python con rembg, onnxruntime, Pillow y NumPy. Cada programa se baja de su sitio
# oficial, se comprueba con su huella sha256 antes de usarlo y queda en %LOCALAPPDATA%\AnunciosConIA\programas (no toca
# el sistema ni el PATH de Windows). El navegador no hace falta: el armado de los videos baja el suyo la primera vez.
# Lo usa «Abrir Anuncios con IA.bat»: escribe en -Rutas las carpetas que van primero en el PATH de esa ventana.
# Sale con 1 solo si falta Node.js y no se pudo instalar (sin ffmpeg o sin Python la app abre igual y avisa).
# Prueba: AIA_IGNORAR_SISTEMA=1 instala todo aunque el sistema ya lo tenga; AIA_PROGRAMAS_DIR cambia la carpeta.
param([string]$Rutas)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'  # la barra de progreso de PowerShell 5 hace las descargas 10 veces más lentas
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

# Node.js 24 (LTS): el modo prueba de la app necesita NODE_USE_ENV_PROXY, que trae Node 24.
# Siempre el de x64, también en una PC con procesador ARM (ahí corre emulado, como ffmpeg): el armado de los videos
# (Remotion) no tiene versión para Windows ARM, y con un Node.js ARM no se podría exportar ningún anuncio.
$NodeVersion = '24.22.1'
$NodeArq = 'x64'
$NodeSha = 'd2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5'
# Python portátil de python-build-standalone (el mismo que usa uv): sin instalador, sin registro y sin tocar el PATH.
# 3.12: rembg y onnxruntime tienen sus paquetes listos para esta versión en Windows x64 y ARM.
$PyVersion = '3.12.15'
$PyFecha = '20261009'
$PySha = @{ x64 = '194c8f0d9e0de6f1c4576e5dfa67819a48c764be87608b74b8ad43387a57b93b'; arm64 = '4da354e7366d4437fceea714eab1bbdca1eb17bba4491a3d20b9c6af94b44f68' }
# ffmpeg de gyan.dev (la compilación para Windows que enlaza ffmpeg.org), en su copia de GitHub. La "essentials"
# trae libvpx (VP9, para el podcast en esquina). En ARM corre emulado.
$FfmpegVersion = '9.0.2'
$FfmpegSha = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
# Lo que necesita Python para recortar a los anfitriones del podcast y la entrevista, y para los iconos
$PaquetesPython = @('rembg', 'onnxruntime', 'pillow', 'numpy')
$ModulosPython = "('rembg', 'onnxruntime', 'PIL', 'numpy')"

$ignorar = [bool]$env:AIA_IGNORAR_SISTEMA
$programas = if ($env:AIA_PROGRAMAS_DIR) { $env:AIA_PROGRAMAS_DIR } else { Join-Path $env:LOCALAPPDATA 'AnunciosConIA\programas' }
$arq = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
switch ($arq) {
  'AMD64' { $arq = 'x64' }
  'ARM64' { $arq = 'arm64' }
  default { Write-Host ' Anuncios con IA necesita Windows de 64 bits.'; exit 1 }
}
$sys32 = Join-Path $env:SystemRoot 'System32'
$extra = New-Object System.Collections.Generic.List[string]

# ---------------------------------------------------------------- ayudantes
# Hasta 3 intentos enteros: a veces una descarga llega cortada sin que curl lo note (se ve en la huella).
function Bajar([string]$url, [string]$destino, [string]$sha, [string]$nombre) {
  for ($intento = 1; $intento -le 3; $intento++) {
    $r = BajarUnaVez $url $destino $sha $nombre ($intento -lt 3)
    if ($r -eq 'ok') { return $true }
    if ($r -eq 'red' -or $intento -eq 3) { return $false }
    Write-Host " La descarga de $nombre llegó incompleta. Probando otra vez ($($intento + 1) de 3)..."
    Start-Sleep -Seconds 3
  }
  return $false
}

function BajarUnaVez([string]$url, [string]$destino, [string]$sha, [string]$nombre, [bool]$quedan) {
  Write-Host " Descargando $nombre..."
  Remove-Item -LiteralPath $destino -Force -ErrorAction SilentlyContinue
  $curl = Join-Path $sys32 'curl.exe'
  $ok = $false
  if (Test-Path -LiteralPath $curl) {
    # si la descarga se queda quieta un minuto, se corta y se reintenta (si no, la ventana esperaría para siempre)
    & $curl -fL --retry 3 --retry-delay 3 --connect-timeout 30 --speed-limit 1024 --speed-time 60 --progress-bar -o $destino $url
    $ok = ($LASTEXITCODE -eq 0)
  } else {
    try { Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing -ErrorAction Stop; $ok = $true } catch { $ok = $false }
  }
  if (-not $ok -or -not (Test-Path -LiteralPath $destino)) {
    Remove-Item -LiteralPath $destino -Force -ErrorAction SilentlyContinue
    Write-Host " No se pudo descargar $nombre. Revisa tu internet y vuelve a abrir el archivo."
    return 'red'
  }
  # la huella con .NET y no con Get-FileHash: si el lanzador se abre desde PowerShell 7, este PowerShell hereda sus
  # módulos y Get-FileHash no carga (y toda descarga parecería cambiada)
  $h = ''
  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $flujo = [System.IO.File]::OpenRead($destino)
    try { $h = ([System.BitConverter]::ToString($sha256.ComputeHash($flujo)) -replace '-', '').ToLower() } finally { $flujo.Dispose(); $sha256.Dispose() }
  } catch { $h = '' }
  if ($h -ne $sha) {
    Remove-Item -LiteralPath $destino -Force -ErrorAction SilentlyContinue
    if (-not $quedan) { Write-Host " La descarga de $nombre llegó incompleta o cambiada: no se usa. Vuelve a abrir el archivo para bajarla otra vez." }
    return 'huella'
  }
  return 'ok'
}

# Baja y descomprime (.zip o .tar.gz) y deja en $carpeta lo que trae la carpeta de arriba del archivo
function Desempacar([string]$url, [string]$sha, [string]$nombre, [string]$carpeta, [string]$tipo) {
  $tmp = Join-Path $programas ".descarga-$PID"
  # también las que dejó otra ventana que se cerró a la mitad de una descarga
  Get-ChildItem -LiteralPath $programas -Directory -Filter '.descarga-*' -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-2) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  try { New-Item -ItemType Directory -Force -Path (Join-Path $tmp 'x') -ErrorAction Stop | Out-Null }
  catch { Write-Host " No se pudo crear la carpeta $programas."; return $false }
  $archivo = Join-Path $tmp "archivo.$tipo"
  if (-not (Bajar $url $archivo $sha $nombre)) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue; return $false }
  Write-Host " Descomprimiendo $nombre..."
  # el tar de Windows (desde Windows 10 de 2018) abre .zip y .tar.gz y es mucho más rápido que Expand-Archive
  $tar = Join-Path $sys32 'tar.exe'
  $ok = $false
  if (Test-Path -LiteralPath $tar) {
    & $tar -xf $archivo -C (Join-Path $tmp 'x')
    $ok = ($LASTEXITCODE -eq 0)
  }
  if (-not $ok -and $tipo -eq 'zip') {
    try { Expand-Archive -LiteralPath $archivo -DestinationPath (Join-Path $tmp 'x') -Force -ErrorAction Stop; $ok = $true } catch { $ok = $false }
  }
  $arriba = if ($ok) { Get-ChildItem -LiteralPath (Join-Path $tmp 'x') -Directory | Select-Object -First 1 } else { $null }
  if (-not $arriba) {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host " No se pudo descomprimir $nombre (¿queda espacio en el disco?)."
    return $false
  }
  Remove-Item -LiteralPath $carpeta -Recurse -Force -ErrorAction SilentlyContinue
  # el antivirus a veces revisa los archivos recién descomprimidos y no deja moverlos por unos segundos
  $movido = $false
  for ($i = 0; $i -lt 10 -and -not $movido; $i++) {
    try { Move-Item -LiteralPath $arriba.FullName -Destination $carpeta -ErrorAction Stop; $movido = $true } catch { Start-Sleep -Seconds 2 }
  }
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  if (-not $movido) { Write-Host " No se pudo dejar listo $nombre en $programas."; return $false }
  return $true
}

# Node.js 20.19 o más nuevo (lo pide el armado de la interfaz) y de x64 (lo pide el armado de los videos)
function NodeOk([string]$exe) {
  if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
  & $exe -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit((a > 20 || (a === 20 && b >= 19)) && process.arch === 'x64' ? 0 : 1)" 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}
# De 3.10 a 3.13: en un Python más nuevo rembg y onnxruntime todavía pueden no estar listos para instalar.
# (El "python" de la Microsoft Store que viene con Windows es solo un atajo a la tienda: aquí da error y no cuenta.)
function PythonOk([string]$exe) {
  if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
  & $exe -c "import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)" 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}
function PaquetesOk([string]$exe) {
  & $exe -c "import importlib.util as u, sys; sys.exit(0 if all(u.find_spec(m) for m in $ModulosPython) else 1)" 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}
# ffmpeg y ffprobe que arrancan, y un ffmpeg que sabe hacer VP9 (libvpx-vp9)
function FfmpegOk([string]$dir) {
  foreach ($p in 'ffmpeg.exe', 'ffprobe.exe') {
    $exe = Join-Path $dir $p
    if (-not (Test-Path -LiteralPath $exe)) { return $false }
    & $exe -hide_banner -version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return $false }
  }
  $codificadores = & (Join-Path $dir 'ffmpeg.exe') -hide_banner -encoders 2>$null | Out-String
  return ($codificadores -match 'libvpx-vp9')
}
function DelSistema([string]$nombre) {
  if ($ignorar) { return $null }
  $c = Get-Command $nombre -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source } else { return $null }
}

# ---------------------------------------------------------------- Node.js
$fatal = $false
if (-not (NodeOk (DelSistema 'node.exe'))) {
  $dir = Join-Path $programas "node-v$NodeVersion-win-$NodeArq"
  if (-not (NodeOk (Join-Path $dir 'node.exe'))) {
    Write-Host ''
    Write-Host " Instalando Node.js $NodeVersion (solo la primera vez, unos 35 MB)..."
    $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-$NodeArq.zip"
    if ((Desempacar $url $NodeSha 'Node.js' $dir 'zip') -and (NodeOk (Join-Path $dir 'node.exe'))) { Write-Host ' Node.js listo.' }
    else { Write-Host ' No se pudo instalar Node.js.'; $fatal = $true }
  }
  if (-not $fatal) { $extra.Add($dir) }
}

# ---------------------------------------------------------------- ffmpeg y ffprobe (con VP9)
$f = DelSistema 'ffmpeg.exe'
if (-not ($f -and (FfmpegOk (Split-Path -Parent $f)))) {
  $dir = Join-Path $programas "ffmpeg-$FfmpegVersion"
  $bin = Join-Path $dir 'bin'
  if (-not (FfmpegOk $bin)) {
    Write-Host ''
    Write-Host ' Instalando ffmpeg (para armar los videos; solo la primera vez, unos 110 MB)...'
    $url = "https://github.com/GyanD/codexffmpeg/releases/download/$FfmpegVersion/ffmpeg-$FfmpegVersion-essentials_build.zip"
    if ((Desempacar $url $FfmpegSha 'ffmpeg' $dir 'zip') -and (FfmpegOk $bin)) { Write-Host ' ffmpeg listo.' }
    else { Write-Host ' Aviso: sin ffmpeg la app no puede armar los videos. Vuelve a abrir el archivo para intentarlo de nuevo.'; $bin = $null }
  }
  if ($bin) { $extra.Add($bin) }
}

# ---------------------------------------------------------------- Python 3.10 a 3.13
$py = DelSistema 'python.exe'
$propio = $false
if (-not (PythonOk $py)) {
  $dir = Join-Path $programas "python-$PyVersion-$arq"
  $py = Join-Path $dir 'python.exe'
  $propio = $true
  if (-not (PythonOk $py)) {
    Write-Host ''
    Write-Host " Instalando Python $PyVersion (solo la primera vez, unos 45 MB)..."
    $pyarq = if ($arq -eq 'arm64') { 'aarch64' } else { 'x86_64' }
    $url = "https://github.com/astral-sh/python-build-standalone/releases/download/$PyFecha/cpython-$PyVersion%2B$PyFecha-$pyarq-pc-windows-msvc-install_only.tar.gz"
    if ((Desempacar $url $PySha[$arq] 'Python' $dir 'tar.gz') -and (PythonOk $py)) { Write-Host ' Python listo.' }
    else { Write-Host ' Aviso: no se pudo instalar Python. Sin Python no salen el podcast en esquina, la entrevista ni los iconos. Vuelve a abrir el archivo para intentarlo de nuevo.'; $py = $null }
  }
  if ($py) { $extra.Add($dir); $extra.Add((Join-Path $dir 'Scripts')) }
}

# ---------------------------------------------------------------- rembg, onnxruntime, Pillow y NumPy
if ($py -and -not (PaquetesOk $py)) {
  Write-Host ''
  Write-Host ' Instalando lo que usa Python para recortar personas y armar iconos (solo la primera vez, unos 300 MB)...'
  # --prefer-binary: si la versión más nueva de un paquete no viene lista para este equipo, pip usa la anterior que sí
  # (en vez de intentar compilarla, que sin herramientas de programador falla)
  $pip = @('-m', 'pip', 'install', '--prefer-binary', '--disable-pip-version-check', '--no-input', '--no-warn-script-location')
  & $py -m pip --version 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { & $py -m ensurepip --upgrade 2>$null | Out-Null }
  if ($propio) {
    # el Python de la app es solo de la app: los paquetes van adentro de su carpeta
    & $py @pip @PaquetesPython
  } else {
    & $py @pip --user @PaquetesPython
    if ($LASTEXITCODE -ne 0) { & $py @pip @PaquetesPython }  # un entorno virtual no acepta --user
  }
  & $py -c "import rembg, onnxruntime, PIL, numpy" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host ' Paquetes de Python listos.' }
  else { Write-Host ' Aviso: no se pudieron instalar los paquetes de Python. Sin ellos no salen el podcast en esquina, la entrevista ni los iconos. Vuelve a abrir el archivo para intentarlo de nuevo.' }
}

# ---------------------------------------------------------------- onnxruntime necesita el runtime de Visual C++
# Están instalados pero onnxruntime no carga ("DLL load failed"): a Windows le falta el runtime de Visual C++, que
# casi todas las PC ya traen, pero una recién instalada no. El paquete msvc-runtime deja esos archivos dentro de la
# carpeta de Python (sin administrador y sin tocar Windows). Si ni así carga, se dice qué instalar.
if ($py -and (PaquetesOk $py)) {
  $err = & $py -c "import onnxruntime" 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -and $err -match 'DLL load failed') {
    $pip = @('-m', 'pip', 'install', '--prefer-binary', '--disable-pip-version-check', '--no-input', '--no-warn-script-location')
    Write-Host ''
    Write-Host ' Instalando lo que necesita Python de Windows para recortar personas (solo la primera vez)...'
    if ($propio) { & $py @pip 'msvc-runtime' } else { & $py @pip --user 'msvc-runtime'; if ($LASTEXITCODE -ne 0) { & $py @pip 'msvc-runtime' } }
    & $py -c "import onnxruntime" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host ' Listo.' }
    else {
      Write-Host ' Aviso: a Windows le falta un componente (Microsoft Visual C++ Redistributable). Sin él no salen el podcast en esquina, la entrevista ni los iconos.'
      Write-Host '        Bájalo de https://aka.ms/vs/17/release/vc_redist.x64.exe, instálalo y vuelve a abrir el archivo.'
    }
  }
}

# ---------------------------------------------------------------- resultado
if ($Rutas) {
  try { [IO.File]::WriteAllText($Rutas, ($extra -join ';'), (New-Object System.Text.UTF8Encoding $false)) }
  catch { Write-Host " No se pudo escribir $Rutas."; exit 1 }
}
if ($fatal) { exit 1 }
exit 0
