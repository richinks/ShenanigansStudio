@echo off
setlocal

REM ───────────────────────────────────────────────
REM Dirty Diaperz — Direct FADR Song Processor
REM Usage:
REM   run_dirty_diaperz.cmd "source.wav" "Song Title" "output-folder"
REM ───────────────────────────────────────────────

if "%~1"=="" goto usage
if "%~2"=="" goto usage
if "%~3"=="" goto usage

REM Ensure Python exists
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+.
    exit /b 1
)

REM Run the automation script
python scripts\dirty_diaperz_fadr.py --source "%~1" --title "%~2" --out "%~3"
if errorlevel 1 (
    echo.
    echo ERROR: Automation failed with exit code %errorlevel%.
    exit /b %errorlevel%
)

echo Automation complete.
exit /b 0

:usage
echo Usage: %~nx0 "source audio" "song title" "output folder"
exit /b 64
