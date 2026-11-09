@echo off
chcp 65001 >nul
title Anuncios con IA
setlocal
rem Anuncios con IA para Windows: doble clic. Deja esta ventana abierta mientras uses la app; para cerrarla, cierra
rem esta ventana. Si falta Node.js, ffmpeg, Python o Claude Code, los instala solo (de sus sitios oficiales y sin
rem permisos de administrador), deja lista la app y la abre en el navegador.
cd /d "%~dp0app" 2>nul || goto :sin_carpeta
if not exist "%~dp0app\inicio\programas-windows.ps1" goto :sin_carpeta

rem Claude Code (instalador oficial) queda en %USERPROFILE%\.local\bin: así se encuentra aunque esta ventana sea vieja
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
rem Siempre con tu cuenta de Claude, nunca con una clave de API
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
set "CLAUDE_CODE_OAUTH_TOKEN="

rem 4455 siempre; PUERTO=<n> solo para las pruebas (el servidor lee la misma variable)
set "AIA_PUERTO=4455"
if defined PUERTO set "AIA_PUERTO=%PUERTO%"
set "URL=http://127.0.0.1:%AIA_PUERTO%"

rem Si la app ya está abierta en otra ventana, solo se abre el navegador. Si en ese puerto responde OTRO programa, se avisa.
rem (0: es la app; 2: es otro programa; 1: el puerto está libre)
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', %AIA_PUERTO%); $c.Close() } catch { exit 1 }; try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:%AIA_PUERTO%/api/estado' -TimeoutSec 20 -UseBasicParsing; if ($r.app -eq 'anuncios-con-ia' -or $null -ne $r.claudeCode) { exit 0 } } catch {}; exit 2" >nul 2>nul
rem (si PowerShell no está o no se puede usar, da otro número y se sigue como siempre)
set "AIA_ESTADO=%errorlevel%"
if "%AIA_ESTADO%"=="0" goto :ya_abierta
if "%AIA_ESTADO%"=="2" goto :puerto_ocupado

echo.
echo  Anuncios con IA: revisando lo necesario...

rem ---------------------------------------------------------------- Node.js, ffmpeg y Python: si faltan, se instalan solos
rem programas-windows.ps1 los baja de sus sitios oficiales (sin permisos de administrador) a %LOCALAPPDATA%\AnunciosConIA
rem y deja en un archivo las carpetas que van primero en el PATH de esta ventana
set "AIA_RUTAS=%TEMP%\anuncios-con-ia-rutas-%RANDOM%%RANDOM%.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\inicio\programas-windows.ps1" -Rutas "%AIA_RUTAS%"
rem si no pudo (sin internet, o la PC no deja usar PowerShell) se sigue: lo que ya esté instalado puede bastar
set "AIA_SIN_PROGRAMAS="
if errorlevel 1 set "AIA_SIN_PROGRAMAS=1"
set "AIA_EXTRA="
if exist "%AIA_RUTAS%" set /p AIA_EXTRA=<"%AIA_RUTAS%"
del "%AIA_RUTAS%" >nul 2>nul
if defined AIA_EXTRA set "PATH=%AIA_EXTRA%;%PATH%"

rem ---------------------------------------------------------------- Node.js 20.19 o más nuevo
where node >nul 2>nul || goto :sin_node
rem (de 64 bits para Intel/AMD: el armado de los videos no tiene versión para ARM; en una PC con ARM corre emulado)
node -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit((a > 20 || (a === 20 && b >= 19)) && process.arch === 'x64' ? 0 : 1)" >nul 2>nul || goto :sin_node

rem ---------------------------------------------------------------- Claude Code (claude.exe, el instalador oficial)
where claude.exe >nul 2>nul && goto :claude_ok
echo.
echo  Instalando Claude Code con el instalador oficial de Anthropic (solo la primera vez)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
where claude.exe >nul 2>nul && (echo  Claude Code listo.) || (echo  Aviso: no se pudo instalar Claude Code. La app te muestra cómo hacerlo en la Bienvenida.)
:claude_ok

rem ---------------------------------------------------------------- la app: lo que falte de instalar y la interfaz
node "%~dp0app\inicio\preparar-app.mjs"
if errorlevel 1 goto :error_preparar

rem ---------------------------------------------------------------- abrir la app
echo.
echo  Abriendo Anuncios con IA en tu navegador...
echo  Deja esta ventana abierta mientras uses la app. Para cerrarla, cierra esta ventana.
echo.
if not defined AIA_NO_ABRIR start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process '%URL%'"
rem Todo en un bloque: cmd.exe lo lee entero antes de arrancar la app. Así, si «Actualizar la app» cambia este archivo
rem mientras la app corre, al cerrarse no se sigue leyendo el archivo nuevo a la mitad. Si hubo un error, la ventana
rem se queda para poder leerlo.
(
  node inicio\arrancar.mjs
  if errorlevel 1 pause
  exit /b
)

rem ================================================================ avisos
:ya_abierta
if not defined AIA_NO_ABRIR start "" "%URL%"
exit /b

:puerto_ocupado
echo.
echo  La dirección que usa Anuncios con IA (%URL%) ya la está usando otro programa.
echo  Cierra ese programa (o reinicia la computadora) y vuelve a abrir este archivo.
echo.
pause
exit /b 1

:sin_carpeta
echo.
echo  No encuentro la carpeta "app" completa junto a este archivo.
echo  Primero descomprime el .zip (clic derecho, Extraer todo) y abre este archivo desde la carpeta descomprimida.
echo.
pause
exit /b 1

:sin_node
echo.
if defined AIA_SIN_PROGRAMAS echo  No se pudo instalar Node.js solo (arriba dice por qué). Si fue el internet, cierra esta ventana y vuelve a abrir este archivo.
echo  Para instalarlo a mano te abro nodejs.org: descarga la versión LTS para Windows (.msi), instálala y vuelve a abrir este archivo.
if not defined AIA_NO_ABRIR start "" "https://nodejs.org/es/download"
echo.
pause
exit /b 1

:error_preparar
echo.
pause
exit /b 1
