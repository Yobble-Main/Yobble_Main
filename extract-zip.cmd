@echo off
setlocal EnableExtensions

rem Usage:
rem   extract-zip.cmd "path\to\archive.zip" "path\to\extract\to" [clean]
rem
rem Example for IExpress:
rem   extract-zip.cmd "%~dp0payload.zip" "%ProgramFiles%\Yobble" clean

pushd "%~dp0" || exit /b 1
set "EXIT_CODE=0"

set "ZIP_FILE=%~1"
set "DEST_DIR=%~2"
set "CLEAN_DEST=%~3"

if "%ZIP_FILE%"=="" set "ZIP_FILE=%~dp0Release.zip"
if "%DEST_DIR%"=="" set "DEST_DIR=%~dp0"
if not exist "%ZIP_FILE%" set "ZIP_FILE=%~f1"
if not exist "%DEST_DIR%" set "DEST_DIR=%~f2"

if "%ZIP_FILE%"=="" goto :usage
if "%DEST_DIR%"=="" goto :usage

if not exist "%ZIP_FILE%" (
  echo [extract-zip] Zip file not found: "%ZIP_FILE%"
  set "EXIT_CODE=1"
  goto :cleanup
)

if /i "%CLEAN_DEST%"=="clean" (
  if exist "%DEST_DIR%" (
    rmdir /s /q "%DEST_DIR%"
    if errorlevel 1 (
      echo [extract-zip] Failed to clean destination: "%DEST_DIR%"
      set "EXIT_CODE=1"
      goto :cleanup
    )
  )
)

if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"
if errorlevel 1 (
  echo [extract-zip] Failed to create destination: "%DEST_DIR%"
  set "EXIT_CODE=1"
  goto :cleanup
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "Expand-Archive -LiteralPath '%ZIP_FILE%' -DestinationPath '%DEST_DIR%' -Force"

if errorlevel 1 (
  echo [extract-zip] Extraction failed.
  set "EXIT_CODE=1"
  goto :cleanup
)

echo [extract-zip] Extracted "%ZIP_FILE%" to "%DEST_DIR%"
goto :cleanup

:usage
echo Usage: %~nx0 "path\to\archive.zip" "path\to\extract\to" [clean]
set "EXIT_CODE=1"
goto :cleanup

:cleanup
popd
exit /b %EXIT_CODE%
