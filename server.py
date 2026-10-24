import http.server
import socketserver
import socket
import webbrowser
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    local_ip = get_local_ip()
    local_url = f"http://{local_ip}:{PORT}"
    pc_url = f"http://localhost:{PORT}"

    print("=" * 60)
    print("   📖 MÁY CHỦ PDF AUDIO SYNC ĐANG CHẠY")
    print("=" * 60)
    print(f"\n👉 Trên MÁY TÍNH: Mở trình duyệt vào link:")
    print(f"   {pc_url}")
    print(f"\n👉 Trên ĐIỆN THOẠI ANDROID (cùng mạng Wi-Fi):")
    print(f"   Mở Chrome trên điện thoại và gõ:")
    print(f"   {local_url}")
    print("\n💡 MẸO TRÊN ANDROID:")
    print("   Khi mở link trên Chrome điện thoại, bấm dấu 3 chấm [⋮] ở góc trên")
    print("   chọn 'Cài đặt ứng dụng' hoặc 'Thêm vào màn hình chính'.")
    print("   Ứng dụng sẽ xuất hiện như 1 App Android độc lập ngoài màn hình!")
    print("=" * 60)
    print("\nBấm Ctrl+C trong cửa sổ này nếu muốn dừng máy chủ.\n")

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã tắt máy chủ.")
