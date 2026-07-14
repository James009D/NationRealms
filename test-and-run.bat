@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "DATA_MODE=memory"
set "AUTH_MODE=demo"
set "NODE_ENV=development"
set "PRISMA_LOG=%TEMP%\statecraft-prisma-generate.log"

echo.
echo Statecraft Online - ephemeral test and run helper
echo =================================================
echo Data mode: memory ^(changes are lost when the API stops^)
echo Auth mode: demo user
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found on PATH. Install Node.js 22.12+ and try again.
  set "RESULT=1"
  goto finish
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found on PATH. Install npm 10+ and try again.
  set "RESULT=1"
  goto finish
)

if not exist ".env" (
  if exist ".env.example" (
    echo Creating .env from .env.example for Prisma tooling...
    copy ".env.example" ".env" >nul
  ) else (
    echo ERROR: .env and .env.example are both missing.
    set "RESULT=1"
    goto finish
  )
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 goto failed
) else (
  echo Dependencies already installed.
)

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if not errorlevel 1 (
  echo.
  echo Note: node.exe processes are already running.
  echo If Prisma generation fails with EPERM, close existing API/web server windows and run this file again.
)

echo.
echo Generating Prisma client...
call npm.cmd run prisma:generate > "%PRISMA_LOG%" 2>&1
if errorlevel 1 (
  type "%PRISMA_LOG%"
  goto prisma_failed
)
type "%PRISMA_LOG%"

:after_prisma
echo.
echo Validating Prisma schema...
call npx.cmd prisma validate
if errorlevel 1 goto failed

echo.
echo Running lint and formatting checks...
call npm.cmd run lint
if errorlevel 1 goto failed
call npm.cmd run format:check
if errorlevel 1 goto failed

echo.
echo Running TypeScript checks...
call npm.cmd run typecheck
if errorlevel 1 goto failed

echo.
echo Running unit and route tests...
call npm.cmd test
if errorlevel 1 goto failed

echo.
echo Building production bundles...
call npm.cmd run build
if errorlevel 1 goto failed

echo.
echo Validation passed in memory mode.
echo No PostgreSQL server is required for this launcher.
echo The deterministic 96x64 shared world is generated in memory at API startup.
echo.

if /I "%~1"=="--validate-only" goto done
choice /m "Start the ephemeral API and web dev servers now"
if errorlevel 2 goto done

echo.
echo Starting API on http://localhost:4000 ...
start "Statecraft API - Memory" /D "%CD%" cmd /k "set DATA_MODE=memory&& set AUTH_MODE=demo&& set NODE_ENV=development&& npm.cmd run dev:api"

echo Starting web app on http://localhost:5173 ...
start "Statecraft Web" /D "%CD%" cmd /k "npm.cmd run dev:web"

echo.
echo Open http://localhost:5173 in your browser.
echo Readiness check: http://localhost:4000/health/ready
echo Remember: all game changes disappear when the API window closes.
goto done

:prisma_failed
echo.
echo WARNING: Prisma client generation failed.
echo On Windows this is often caused by a running API server locking Prisma's query engine DLL.
echo Close existing Statecraft API/web terminal windows and run test-and-run.bat again if you need a fresh Prisma client.
if exist "node_modules\.prisma\client\index.js" (
  echo.
  echo Existing Prisma client found, so validation will continue.
  goto after_prisma
)
echo.
echo ERROR: No existing Prisma client was found, so validation cannot continue.
set "RESULT=1"
goto finish

:failed
echo.
echo ERROR: A validation command failed. Fix the message above, then run test-and-run.bat again.
set "RESULT=1"
goto finish

:done
echo.
echo Done.
set "RESULT=0"

:finish
echo.
if /I "%~1"=="--validate-only" goto exit_script
echo Press any key to close this window.
pause >nul
:exit_script
endlocal & exit /b %RESULT%
