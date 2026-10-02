@echo off
title ShenanigansStudio Show API
cd /d D:\ShenanigansStudio
echo.
echo  ============================================
echo   ShenanigansStudio Show API
echo   Controls REAPER + X32 from any LAN device
echo  ============================================
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do echo   Open Live Mode, enter: http://%%b:5000
)
echo.
pip install flask flask-cors python-osc reapy-boost --quiet
python src\show_api.py
pause
