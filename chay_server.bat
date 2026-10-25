@echo off
setlocal
title PDF Audio Sync - Local Test Server
chcp 65001 > nul
cd /d "%~dp0"

echo ============================================================
echo   PDF Audio Sync - May chu thu nghiem tren may ca nhan
echo ============================================================
echo.
echo Dang kiem tra Python...

where python >nul 2>&1
if %errorlevel%==0 (
    set "PYTHON_CMD=python"
    goto start_server
)

where py >nul 2>&1
if %errorlevel%==0 (
    set "PYTHON_CMD=py -3"
    goto start_server
)

echo [LOI] Khong tim thay Python.
echo Hay cai Python 3 tu https://www.python.org/downloads/
echo Khi cai dat, danh dau "Add Python to PATH", sau do chay lai file nay.
echo.
pause
exit /b 1

:start_server
echo.
echo May tinh: http://localhost:8080
echo Dien thoai cung Wi-Fi: xem dia chi IP hien ben duoi neu server.py in ra.
echo.
echo Trinh duyet co the tu mo sau khi may chu bat dau.
start "" http://localhost:8080
%PYTHON_CMD% "%~dp0server.py"

echo.
echo May chu da dung.
pause
endlocal
