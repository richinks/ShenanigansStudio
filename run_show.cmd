@echo off
title ShenanigansStudio Show API
cd /d D:\ShenanigansStudio
echo.
echo  ============================================
echo   ShenanigansStudio Show API
echo   X32 Rack: 192.168.1.5:10023
echo   Controls REAPER + X32 from any LAN device
echo  ============================================
echo.
echo  Your LAN IP addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do echo    http://%%b:5000
)
echo.
echo  Open Live Mode, tap the gear, enter the URL above.
echo.
pip install flask flask-cors python-osc reapy-boost --quiet
python src\show_api.py
pause
