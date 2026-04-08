@echo off
setlocal

echo === Starting update ===
call update.cmd

echo === Starting server ===
cd /d "%~dp0server"
call INSTALL.cmd
call run.cmd

echo === Returning to main folder ===
cd /d "%~dp0"

echo === Running additional script ===
call runadrun.bat

echo === All tasks completed ===
pause