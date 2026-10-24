@echo off
title Day code len GitHub
chcp 65001 > nul
python "%~dp0push_to_github.py"
pause
