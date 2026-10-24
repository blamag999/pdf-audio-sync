import subprocess
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 65)
print("      ĐẨY MÃ NGUỒN LÊN GITHUB: blamag999/pdf-audio-sync")
print("=" * 65)
print("\nĐang thực hiện lệnh: git push -u origin main ...\n")
print("💡 LƯU Ý: Nếu có cửa sổ của GitHub/Git Credential Manager hiện lên,")
print("hãy bấm 'Sign in with your browser' để xác thực tài khoản nhé.\n")

try:
    # Chạy lệnh git push
    result = subprocess.run(["git", "push", "-u", "origin", "main"], check=True)
    print("\n" + "=" * 65)
    print("🎉 [THÀNH CÔNG] Toàn bộ mã nguồn đã được tải lên GitHub!")
    print("=" * 65)
    print("\n👉 BƯỚC TIẾP THEO ĐỂ LẤY LINK THÀNH PHẨM TRÊN ĐIỆN THOẠI:")
    print("1. Mở trang: https://github.com/blamag999/pdf-audio-sync/settings/pages")
    print("2. Tại mục 'Build and deployment' -> 'Source':")
    print("   Chọn 'GitHub Actions'")
    print("3. Chờ khoảng 1 phút, link web của bạn sẽ xuất hiện tại:")
    print("   👉 https://blamag999.github.io/pdf-audio-sync/")
    print("=" * 65)
except subprocess.CalledProcessError as e:
    print("\n❌ LỖI: Không thể đẩy lên GitHub (mã lỗi:", e.returncode, ")")
    print("Vui lòng kiểm tra lại quyền truy cập hoặc tài khoản GitHub.")
except Exception as e:
    print("\n❌ LỖI:", str(e))

input("\nBấm Enter để đóng cửa sổ...")
