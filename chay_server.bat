@echo off
title PDF Audio Sync Server
chcp 65001 > nul
echo Dang khoi dong may chu chia se cho Android...
python "%~dp0server.py"
pause
