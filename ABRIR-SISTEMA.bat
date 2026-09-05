@echo off
title ALLIANCE GYM - Sistema de gestion
cd /d "%~dp0"
echo.
echo   ALLIANCE GYM - iniciando sistema...
echo.
start "" http://localhost:5173
node server.js
pause
