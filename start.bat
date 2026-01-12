@echo off
REM filepath: c:\Users\Eier\OneDrive\Personal code projects\BooksWithMusic\START.bat
echo Starting BooksWithMusic...
echo.

REM Check if this is first run
if not exist "node_modules" (
    echo First time setup - Installing dependencies...
    call npm install
    echo.
    echo Building application...
    call npm run build
    echo.
)

REM Open in default browser
echo Opening in your browser...
start "" "http://localhost:5173/"

echo.
echo [92m✓ BooksWithMusic is now running![0m
echo   You can close this window.
echo.
pause