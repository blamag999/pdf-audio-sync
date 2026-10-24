import subprocess
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 65)
print("   ĐẨY MÃ NGUỒN LÊN GITHUB (EP FORCE): blamag999/pdf-audio-sync")
print("=" * 65)

def run_cmd(args):
    return subprocess.run(args, capture_output=True, text=True)

try:
    # 1. Tự động commit nếu có thay đổi chưa lưu dưới local
    status = run_cmd(["git", "status", "--porcelain"])
    if status.stdout.strip():
        print("\n📌 Phát hiện thay đổi chưa lưu, đang tự động commit...")
        run_cmd(["git", "add", "."])
        run_cmd(["git", "commit", "-m", "Auto commit before forced push"])

    # 2. Thực hiện push force (Không cần pull)
    print("\n🚀 Đang ép tải code lên GitHub (git push -u origin main --force) ...\n")
    result = subprocess.run(["git", "push", "-u", "origin", "main", "--force"], check=True)
    
    print("\n" + "=" * 65)
    print("🎉 [THÀNH CÔNG] Đã ghi đè mã nguồn lên GitHub thành công!")
    print("=" * 65)

except subprocess.CalledProcessError as e:
    print("\n❌ LỖI: Không thể push lên GitHub (Mã lỗi:", e.returncode, ")")
    print("Vui lòng kiểm tra lại kết nối mạng hoặc quyền truy cập tài khoản.")
except Exception as e:
    print("\n❌ LỖI KHÔNG XÁC ĐỊNH:", str(e))

input("\nBấm Enter để đóng cửa sổ...")