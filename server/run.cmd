@echo off
cd /d "%~dp0"

if not exist package.json (
  echo package.json was not found in %cd%
  exit /b 1
)

npm install
node src/index.js
