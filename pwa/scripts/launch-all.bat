@echo off
:: =============================================================================
:: Shenanigans Studio — launch-all.bat
:: Starts all automation servers and the SvelteKit dev server (with HMR).
:: Use this script during active development.
:: =============================================================================

setlocal

set ROOT=%~dp0..

echo.
echo  ==========================================
echo   Shenanigans Studio — DEV LAUNCH
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

echo  Starting REAPER Bridge        (port 9090) ...
start "REAPER Bridge" cmd /k "cd /d "%ROOT%\servers\reaper-bridge" && node index.js"

echo  Starting X32 Proxy            (port 9091) ...
start "X32 Proxy"     cmd /k "cd /d "%ROOT%\servers\x32-proxy"     && node index.js"

echo  Starting FADR Worker          (port 9092) ...
start "FADR Worker"   cmd /k "cd /d "%ROOT%\servers\fadr-worker"   && node index.js"

:: Brief pause to let servers initialise before the dev server starts
timeout /t 2 >nul

echo  Starting SvelteKit Dev Server (port 5173) ...
start "SvelteKit Dev" cmd /k "cd /d "%ROOT%" && npm run dev"

echo.
echo  All servers started.
echo  Open http://localhost:5173 in your browser.
echo.
echo  Close this window at any time — servers continue running in their
echo  own windows. Run stop-all.bat to shut everything down cleanly.
echo.
pause >nul
endlocal
