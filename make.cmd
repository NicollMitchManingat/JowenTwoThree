@echo off
REM Windows wrapper for Makefile targets
REM Usage: make [target]

setlocal enabledelayedexpansion

set TARGET=%1

if "%TARGET%"=="" (
    echo Usage: make [target]
    echo Available targets from Makefile:
    findstr /R "^[a-zA-Z_][a-zA-Z0-9_]*:" Makefile | findstr /V "^	" | for /F "delims=:" %%A in ('findstr /R "^[a-zA-Z_]" Makefile') do echo   %%A
    exit /b 1
)

if "%TARGET%"=="init" (
    echo Initializing project...
    git pull origin main
    cd backend && npm ci && cd ..
    cd frontend && npm ci && cd ..
    npm audit fix
    echo Project initialized successfully.
    exit /b 0
)

if "%TARGET%"=="push" (
    echo Pushing changes to repository...
    git add .
    set /p msg="Enter commit message: "
    git commit -m "!msg!"
    git push origin main
    echo Changes pushed successfully.
    exit /b 0
)

echo Unknown target: %TARGET%
exit /b 1
