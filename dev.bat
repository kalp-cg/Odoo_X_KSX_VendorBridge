@echo off
REM Double-click to start both backend and frontend in their own terminals.
powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0run-all.ps1"
