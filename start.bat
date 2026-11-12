@echo off
title JobSphere - Job Tracking Platform
echo Starting JobSphere Application...
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Virtual environment not found. Setting up...
    py -3.12 -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
)

echo Starting server on http://127.0.0.1:8000 ...
.\.venv\Scripts\python.exe run.py
pause

