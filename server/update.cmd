@echo off
setlocal

REM Repo URL
set REPO_URL=https://github.com/Benno111/Yobble_Main.git

REM Temp clone location
set REPO_DIR=%TEMP%\Yobble_Main

REM Destination
set DEST_DIR=C:\Users\H\Desktop\Yobble

echo === Updating Yobble (preserving save data) ===

REM Clone or pull
if exist "%REPO_DIR%\.git" (
    echo Repo exists, pulling latest changes...
    cd /d "%REPO_DIR%"
    git pull
) else (
    echo Cloning repo...
    git clone "%REPO_URL%" "%REPO_DIR%"
)

REM Ensure destination exists
if not exist "%DEST_DIR%" (
    echo Creating destination folder...
    mkdir "%DEST_DIR%"
)

REM Copy files and mirror the repo while preserving save data folders/files
echo Copying files...

robocopy "%REPO_DIR%" "%DEST_DIR%" /MIR /R:2 /W:2 /XD .git saves save data userdata playerdata /XF *.sav *.save *.dat
set ROBOCODE=%ERRORLEVEL%

if %ROBOCODE% GEQ 8 (
    echo Update failed. Robocopy exit code: %ROBOCODE%
    exit /b %ROBOCODE%
)

echo === Done! Save data preserved ===
npm install
