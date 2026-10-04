@echo off
title Fadr Supabase Sync
cd /d D:\ShenanigansStudio
echo.
echo  ============================================
echo   Fadr to Supabase BPM/Key Sync
echo  ============================================
echo.
pip install supabase --quiet
echo  [1] Dry run - preview only
echo  [2] Sync - write to Supabase
echo  [3] Sync and overwrite existing values
echo.
set /p choice=Choose (1/2/3): 
if "%choice%"=="1" python src\fadr_sync.py --dry-run
if "%choice%"=="2" python src\fadr_sync.py
if "%choice%"=="3" python src\fadr_sync.py --overwrite
echo.
pause
