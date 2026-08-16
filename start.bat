@echo off
title VideoInsight
echo ============================================
echo   VideoInsight - AI Video Analyzer
echo   http://0.0.0.0:8892
echo ============================================
cd /d "%~dp0"
set HF_ENDPOINT=https://hf-mirror.com
if not defined FFMPEG_PATH if exist "E:\FormatFactory\ffmpeg.exe" set "FFMPEG_PATH=E:\FormatFactory\ffmpeg.exe"
cd /d "%~dp0backend"
echo Starting server... press Ctrl+C to stop
.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8892
echo.
echo [STOPPED] Server exited.
pause