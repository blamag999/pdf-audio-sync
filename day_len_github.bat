@echo off
chcp 65001 > nul
title Đẩy mã nguồn PDF Audio Sync lên GitHub
cls
echo ====================================================================
echo         HỖ TRỢ ĐẨY LÊN GITHUB & TỰ ĐỘNG BẬT GITHUB PAGES
echo ====================================================================
echo.
echo Bước 1: Mở trình duyệt và tạo 1 kho lưu trữ (Repository) mới tại:
echo         https://github.com/new
echo.
echo Bước 2: Đặt tên Repo (ví dụ: pdf-audio-sync) rồi bấm "Create repository".
echo.
echo Bước 3: Copy đường link của Repository vừa tạo
echo         (Ví dụ dạng: https://github.com/ten-cua-ban/pdf-audio-sync.git)
echo.
echo ====================================================================
set /p REPO_URL="👉 Dán link Repository của bạn vào đây rồi bấm Enter: "

if "%REPO_URL%"=="" (
    echo [LỖI] Bạn chưa nhập link. Vui lòng chạy lại file!
    pause
    exit /b
)

echo.
echo Đang cấu hình Git...
cd /d "%~dp0"
git add .
git commit -m "Deploy PDF Audio Sync to GitHub Pages" 2>nul
git branch -M main

git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo Đang đẩy mã nguồn lên GitHub...
echo (Nếu có cửa sổ trình duyệt hiện lên, bạn chỉ cần bấm Đăng nhập / Authorize GitHub)
echo.
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================================================
    echo [THÀNH CÔNG] Đã đẩy toàn bộ ứng dụng lên GitHub!
    echo.
    echo BƯỚC CUỐI CÙNG ĐỂ LẤY LINK THÀNH PHẨM:
    echo 1. Vào lại trang Repository của bạn trên GitHub.
    echo 2. Bấm vào tab "Settings" ^> Chọn mục "Pages" ở cột bên trái.
    echo 3. Ở mục "Build and deployment":
    echo    - Chọn Source: "GitHub Actions" (hoặc Deploy from a branch: main)
    echo 4. Chờ 1 phút, bạn sẽ có link web chạy online ở bất cứ đâu!
    echo ====================================================================
) else (
    echo.
    echo [LỖI] Đẩy code thất bại. Vui lòng kiểm tra lại đường link hoặc quyền truy cập GitHub!
)

echo.
pause
