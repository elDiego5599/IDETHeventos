@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title IDETH - Preparar base de datos

echo ================================================
echo     PORTAL DE EVENTOS IDETH - BASE DE DATOS
echo ================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restaurar_bd.ps1"
if errorlevel 1 (
    echo.
    echo No se pudo preparar la base de datos.
    echo Revisa que PostgreSQL este instalado y el servicio este iniciado.
    echo.
    pause
    exit /b 1
)

echo.
pause
