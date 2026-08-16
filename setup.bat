@echo off
title VideoInsight Setup
echo ============================================
echo   VideoInsight - One-click dependency setup
echo ============================================
cd /d "%~dp0"
echo [1/2] Installing backend dependencies...
cd /d "%~dp0backend"
python -m venv .venv
call ".venv\Scripts\pip" install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
echo [2/2] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install --registry=https://registry.npmmirror.com
call npm run build
echo.
echo [OK] Setup complete! Run start.bat
pause
