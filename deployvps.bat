@echo off
echo Avvio del deploy sul VPS...
powershell -ExecutionPolicy Bypass -File "%~dp0tools\deploy-vps.ps1"
if %errorlevel% neq 0 (
    echo.
    echo ❌ Errore durante il deploy.
    pause
    exit /b %errorlevel%
)
echo.
echo ✅ Deploy completato con successo!
