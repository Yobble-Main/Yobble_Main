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
    echo Repo exists, fetching latest changes...
    cd /d "%REPO_DIR%"
    git fetch --all
    if errorlevel 1 (
        echo git fetch failed. Check network/credentials.
        exit /b 1
    )
    git reset --hard origin/HEAD
    if errorlevel 1 (
        echo git reset failed.
        exit /b 1
    )
) else (
    echo Cloning repo...
    git clone "%REPO_URL%" "%REPO_DIR%"
    if errorlevel 1 (
        echo git clone failed. Check network/credentials.
        exit /b 1
    )
)

REM Ensure destination exists
if not exist "%DEST_DIR%" (
    echo Creating destination folder...
    mkdir "%DEST_DIR%"
)

REM Copy files and mirror the repo while preserving save data folders/files
echo Copying files...

robocopy "%REPO_DIR%" "%DEST_DIR%" /MIR /R:2 /W:2 /XD .git .github node_modules saves save data userdata playerdata /XF *.sav *.save *.dat
set ROBOCODE=%ERRORLEVEL%

if %ROBOCODE% GEQ 8 (
    echo Update failed. Robocopy exit code: %ROBOCODE%
    exit /b %ROBOCODE%
)

echo === Installing server dependencies ===
cd /d "%DEST_DIR%\server"
npm install

echo === Done! Save data preserved ===
