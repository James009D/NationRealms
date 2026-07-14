@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "DATA_MODE=postgres"
set "AUTH_MODE=session"
set "NODE_ENV=development"
set "PRISMA_LOG=%TEMP%\statecraft-prisma-generate.log"

echo.
echo Statecraft Online - persistent PostgreSQL helper
echo ================================================
echo Data mode: PostgreSQL
echo Auth mode: session accounts
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
    echo Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    echo.
    echo Review DATABASE_URL in .env if your PostgreSQL credentials differ from the defaults.
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
  echo Close old Statecraft API/web windows if ports 4000 or 5173 are already in use.
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
echo Connecting to PostgreSQL and applying checked-in migrations...
call npx.cmd prisma migrate deploy
if errorlevel 1 goto database_failed

echo.
echo Seeding/updating demo data, authored events, and the shared world...
call npm.cmd run prisma:seed
if errorlevel 1 goto database_failed

echo Shared world initialized at 96x64; existing nations have viable homelands.

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
echo Running unit and memory-route tests...
call npm.cmd test
if errorlevel 1 goto failed

echo.
echo Building production bundles...
call npm.cmd run build
if errorlevel 1 goto failed

echo.
echo Validation, migration, and seed completed successfully.
echo Data created in this mode persists in PostgreSQL.
echo.

if /I "%~1"=="--validate-only" goto done
choice /m "Start the persistent API and web dev servers now"
if errorlevel 2 goto done

echo.
echo Starting API on http://localhost:4000 ...
start "Statecraft API - PostgreSQL" /D "%CD%" cmd /k "set DATA_MODE=postgres&& set AUTH_MODE=session&& set NODE_ENV=development&& npm.cmd run dev:api"

echo Starting web app on http://localhost:5173 ...
start "Statecraft Web" /D "%CD%" cmd /k "npm.cmd run dev:web"

echo.
echo Open http://localhost:5173 in your browser.
echo Register an account at http://localhost:5173/register
echo Readiness check: http://localhost:4000/health/ready
goto done

:database_failed
echo.
echo ERROR: PostgreSQL migration or seed failed.
echo.
echo Confirm that:
echo   1. PostgreSQL 14+ is running.
echo   2. DATABASE_URL in .env has the correct user, password, host, port, and database.
echo   3. The target database exists and the configured user can create tables.
echo.
echo With Docker installed, the bundled database can be started with:
echo   docker compose up -d postgres
echo.
echo Then run persistent-and-run.bat again.
set "RESULT=1"
goto finish

:prisma_failed
echo.
echo WARNING: Prisma client generation failed.
echo On Windows this is often caused by a running API server locking Prisma's query engine DLL.
echo Close existing Statecraft API/web terminal windows and run persistent-and-run.bat again.
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
echo ERROR: A validation command failed. Fix the message above, then run persistent-and-run.bat again.
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
