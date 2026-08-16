@echo off
title VideoInsight
echo ============================================
echo   VideoInsight - AI Video Analyzer
echo   http://127.0.0.1:8892
echo ============================================
cd /d "%~dp0"
set HF_ENDPOINT=https://hf-mirror.com
cd /d "%~dp0backend"
start "VideoInsight-Backend" cmd /k ".venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8892"
timeout /t 2 >nul
start "" "http://127.0.0.1:8892"
echo.
echo [OK] Server started. Browser will open http://127.0.0.1:8892
echo [TIP] To stop, close the VideoInsight-Backend window
