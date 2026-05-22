@echo off
REM ====================================================
REM InstaAutomate - Complete Setup Script
REM ====================================================
REM This script starts everything needed for development

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║          InstaAutomate - Development Setup                     ║
echo ║                                                                ║
echo ║  This script will start BOTH ngrok tunnel and dev server       ║
echo ║  Requirements: Node.js must be installed                       ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies (first time only)...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
    echo.
)

REM Delete old .env.local to force fresh ngrok tunnel
if exist ".env.local" (
    del ".env.local"
    echo 🗑️  Cleared old ngrok config
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  STEP 1: Starting ngrok tunnel (Terminal 1)                    ║
echo ║                                                                ║
echo ║  ngrok will create a public HTTPS URL for your local server    ║
echo ║  It will also update the .env.local file with the URL         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Start ngrok in a new terminal
echo 🔄 Launching ngrok in a new window...
start "InstaAutomate - ngrok" cmd /k npm run tunnel

REM Give ngrok time to start and create .env.local
echo ⏳ Waiting for ngrok to initialize (10 seconds)...
timeout /t 10 /nobreak

REM Check if .env.local was created
if not exist ".env.local" (
    echo.
    echo ❌ WARNING: ngrok did not create .env.local
    echo    This might mean ngrok hasn't started yet
    echo    Please wait a moment and try again
    echo.
    pause
    exit /b 1
)

REM Read the ngrok URL from .env.local
setlocal enabledelayedexpansion
for /f "tokens=2 delims==" %%i in (.env.local) do (
    set "NGROK_URL=%%i"
    goto :got_url
)
:got_url

echo.
echo ✅ ngrok is running with URL:
echo    %NGROK_URL%
echo.

REM Display next steps
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  STEP 2: Configure Supabase (Do this now!)                     ║
echo ║                                                                ║
echo ║  1. Open: https://app.supabase.com                             ║
echo ║  2. Go to: Your Project → Authentication → Settings            ║
echo ║  3. Find: "Authorized redirect URLs"                           ║
echo ║  4. Add this URL:                                              ║
echo ║                                                                ║
echo ║     %NGROK_URL%/oauth-callback.html                          ║
echo ║                                                                ║
echo ║  5. Save the changes                                           ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Ask user if they updated Supabase
set /p READY="Did you add the ngrok URL to Supabase? (y/n): "
if /i not "%READY%"=="y" (
    echo.
    echo 📌 Important: The app won't work without updating Supabase first!
    echo    Please do that before continuing.
    pause
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  STEP 3: Starting dev server (Terminal 2)                      ║
echo ║                                                                ║
echo ║  The app will be accessible at:                                ║
echo ║     %NGROK_URL%/auth.html (Login)                            ║
echo ║     %NGROK_URL%/dashboard.html (Dashboard)                   ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo 🚀 Launching dev server in a new window...
start "InstaAutomate - Dev Server" cmd /k npm run dev

echo.
echo ✅ All systems ready!
echo.
echo 📋 What to do next:
echo    1. Open the ngrok URL in your browser (see below)
echo    2. Try signing up with a test account
echo    3. Check the browser console (F12) for any errors
echo.
echo 🔗 Your app URLs:
echo    Login:     %NGROK_URL%/auth.html
echo    Dashboard: %NGROK_URL%/dashboard.html
echo.
echo ⚠️  Important Notes:
echo    - Both terminal windows must stay open
echo    - Each time you restart, you'll get a NEW ngrok URL
echo    - You must add the NEW URL to Supabase settings
echo.
echo 🛑 To stop everything:
echo    - Close both terminal windows (ngrok and dev server)
echo    - Press Ctrl+C in each window
echo.

pause
