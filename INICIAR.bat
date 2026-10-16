@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title IDETH - Iniciar servidor

echo ================================================
echo     PORTAL DE EVENTOS IDETH - INICIO
echo ================================================
echo.

set "PYTHON_CMD="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
    python --version >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
    echo ERROR: Python no esta instalado o no esta en PATH.
    echo Instala Python desde https://www.python.org/downloads/
    echo Durante la instalacion marca "Add python.exe to PATH".
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    for /f %%I in ('powershell.exe -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "JWT_SECRET=%%I"
    (
        echo DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/eventos_ideth
        echo JWT_SECRET=!JWT_SECRET!
    ) > ".env"
    echo Se creo el archivo .env. Configura la clave de PostgreSQL.
    start /wait "" notepad.exe "%~dp0.env"
) else (
    findstr /C:"TU_PASSWORD" ".env" >nul
    if not errorlevel 1 (
        echo El archivo .env aun tiene la clave de ejemplo.
        start /wait "" notepad.exe "%~dp0.env"
    )
)

findstr /C:"TU_PASSWORD" ".env" >nul
if not errorlevel 1 (
    echo ERROR: Reemplaza TU_PASSWORD en .env por la clave de PostgreSQL.
    echo Guarda el archivo y vuelve a ejecutar INICIAR.bat.
    echo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Creando entorno virtual...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto :error
)

echo.
echo Instalando o verificando dependencias...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 goto :error
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto :error

echo.
echo Iniciando servidor en http://localhost:8000
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$deadline=(Get-Date).AddSeconds(90); while ((Get-Date) -lt $deadline) { try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:8000/'; if ($r.StatusCode -eq 200) { Start-Process 'http://localhost:8000'; exit 0 } } catch {}; Start-Sleep -Seconds 1 }"
".venv\Scripts\python.exe" -m backend.main

echo.
echo El servidor se detuvo.
pause
exit /b 0

:error
echo.
echo ERROR: No se pudo preparar el entorno o instalar dependencias.
echo Revisa tu conexion a Internet y que Python este instalado correctamente.
echo.
pause
exit /b 1
