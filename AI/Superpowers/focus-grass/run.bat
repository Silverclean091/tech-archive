@echo off
rem Focus & Grass launcher for Windows (double-click or run from cmd)
rem   run.bat [port] [--no-open]
rem The real server is serve.js; this file only checks Node.js and starts it.
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required, version 18 or newer. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0])>=18?0:1)"
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  node --version
  pause
  exit /b 1
)

node serve.js %*
if errorlevel 1 pause
