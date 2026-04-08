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

REM Copy files WITHOUT deleting anything in destination
REM Exclude common save folders/files (edit these as needed)
echo Copying files...

robocopy "%REPO_DIR%" "%DEST_DIR%" /E /XO /XD .git saves save data userdata playerdata /XF *.sav *.save *.dat

echo === Done! Save data preserved ===
