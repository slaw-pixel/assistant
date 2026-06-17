@echo off
color 4F
title  ASSISTANT — ЗАПУСК
cls
echo.
echo  ==========================================
echo   TRADING ASSISTANT — ЗАПУСК
echo  ==========================================
echo.
echo  [1/2] Запускаем WebSocket бридж...
start "BRIDGE (терминал)" cmd /k "color 2F & title  BRIDGE — TradingApp & cd /d %~dp0 & python scripts/terminal_bridge.py"
timeout /t 1 /nobreak >nul

echo  [2/2] Запускаем Next.js...
start "NEXT.JS" cmd /k "color 1F & title  NEXT.JS — localhost:3000 & cd /d %~dp0 & npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo  Открываем браузер...
start http://localhost:3000/convergence

echo.
echo  ==========================================
echo   Готово! localhost:3000/convergence
echo  ==========================================
echo.
pause
