@echo off
rem -------------------------------------------------
rem Run InstaAutomate local dev server on port 8000
rem -------------------------------------------------
rem Ensure npm is on PATH (Windows default)
rem Use npx to run serve without global install
rem -------------------------------------------------

rem Start the server in the project folder
npx -y serve -s . -l 8000

pause
