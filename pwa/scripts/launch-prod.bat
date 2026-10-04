@echo off
:: =============================================================================
:: Shenanigans Studio — launch-prod.bat
:: Builds the SvelteKit app for production and serves it alongside all
:: automation servers. Use this for stable daily studio operation.
:: =============================================================================

setlocal

set ROOT=%~dp0..

echo.
echo  ==========================================
echo   Shenanigans Studio — PRODUCTION LAUNCH
echo  ==========================================
echo.

:: Check that Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js not found on PATH.
    echo  Install Node.js 22 LTS from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: Check that npm is available
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: npm not found on PATH.
    echo  npm ships with Node.js — reinstall from https://nodejs.org
    pause
    exit /b 1
)

echo  Building SvelteKit app...
cd /d "%ROOT%"
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Build failed. Fix the errors above and try again.
    pause
    exit /b 1
)

echo.
echo  Build complete. Starting servers...
echo.

echo  Starting REAPER Bridge        (port 9090) ...
start "REAPER Bridge" cmd /k "cd /d "%ROOT%\servers\reaper-bridge" && node index.js"

echo  Starting X32 Proxy            (port 9091) ...
start "X32 Proxy"     cmd /k "cd /d "%ROOT%\servers\x32-proxy"     && node index.js"

echo  Starting FADR Worker          (port 9092) ...
start "FADR Worker"   cmd /k "cd /d "%ROOT%\servers\fadr-worker"   && node index.js"

timeout /t 2 >nul

echo  Starting SvelteKit Preview    (port 4173) ...
start "SvelteKit" cmd /k "cd /d "%ROOT%" && npm run preview -- --host"

echo.
echo  Studio is running.
echo  Local:    http://localhost:4173
echo  Network:  http://%COMPUTERNAME%:4173   (accessible from LAN devices)
echo.
echo  Ensure Windows Firewall allows inbound TCP on ports 4173, 9090, 9091, 9092
echo  if you want to reach this machine from tablets or phones on the LAN.
echo.
pause >nul
endlocal
