@echo off
chcp 65001 >nul
title Tao File books.json Cho Cloudflare R2
echo Đang khoi dong trinh tao danh muc sach...
python gen_r2_catalog.py
pause
