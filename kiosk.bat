@echo off
title PocketBike Kiosk & KDS Gateway
echo ========================================================
echo Iniciando Kiosk Autoservicio, KDS Cocina y Front Desk
echo ========================================================
cd /d "%~dp0"
node server/index.js
pause
