@echo off
cd /d %~dp0
start /min "bridge" cmd /c "python scripts/terminal_bridge.py"
start /min "nextjs" cmd /c "npm run dev"
timeout /t 4 /nobreak >nul
start http://localhost:3000/stacks
