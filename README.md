# 📖 Hướng Dẫn Sử Dụng: App Đọc PDF & Khớp Audio (PDF Audio Sync)

Ứng dụng **PDF Audio Sync** được thiết kế chuyên biệt cho thiết bị di động (Android / iOS) và máy tính, giải quyết trọn vẹn nhu cầu vừa đọc sách/truyện PDF vừa nghe MP3 với khả năng **đồng bộ khớp mốc từng trang**.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Khớp mốc thời gian từng trang (Audio-Page Sync)**:
   - Khi nghe audio đến đâu, bạn chỉ cần bấm **📍 Ghim mốc giây này cho trang**.
   - Ứng dụng tự động lưu mốc tương ứng: Trang 1 (00:00), Trang 2 (01:45), Trang 3 (03:20)...
2. **Tự động chuyển trang thông minh**:
   - Khi MP3 chạy đến đúng thời điểm của trang kế tiếp, màn hình sẽ **tự động lật sang trang đó** mà không cần chạm tay.
3. **Lật trang tự tua Audio**:
   - Bấm nút lật trang hoặc vuốt tay sang trang khác, audio sẽ **tự động tua đến đúng đoạn đọc** của trang đó.
4. **Hỗ trợ sách nhiều phần âm thanh (Multi-Part Audio)**:
   - Tự động nhận diện và gộp các file `Part 1`, `Part 2`, `Side A`, `Side B` vào chung một đầu sách.
   - Tự động chuyển tiếp mượt mà khi nghe hết một phần.
5. **Chế độ hiển thị linh hoạt**:
   - Chế độ **Vừa dọc**: Phù hợp đọc trên màn hình điện thoại.
   - Chế độ **2 Trang song song**: Trải nghiệm như lật cuốn sách thật trên máy tính hoặc máy tính bảng.
   - Phóng to / Thu nhỏ tùy chỉnh.
6. **Thư viện sách đa nguồn**:
   - **Thư mục thiết bị**: Mở thư mục cục bộ trên máy tính hoặc điện thoại.
   - **Chỉ đọc tệp cục bộ**: Mở PDF và MP3 từ thư mục trên thiết bị; không tải nội dung sách từ nguồn trực tuyến.
7. **Lưu trữ & Xuất file mốc**:
   - Tự động lưu mốc vào IndexedDB/LocalStorage của trình duyệt cho từng cuốn riêng biệt.
   - Xuất file `.json` để sao lưu vào thư mục truyện hoặc đưa vào kho dữ liệu.

---

## ☁️ Đồng bộ mốc đọc qua GitHub

- Ứng dụng chỉ tải lên tệp JSON mốc thời gian; PDF và MP3 luôn nằm trên thiết bị.
- Mốc được lưu trong `sync_data/<TênPDF>.json` để có thể tải lại trên thiết bị khác.
- Khi mở PDF, ứng dụng ưu tiên JSON trong thư mục, sau đó tải mốc công khai trên GitHub trước dữ liệu cục bộ.
- Để ghi mốc lên GitHub, bấm **Mốc khớp → Đồng bộ GitHub** và nhập Personal Access Token có quyền **Contents: Read and write** đối với repository `blamag999/pdf-audio-sync`.
- Token chỉ được giữ trong phiên trình duyệt hiện tại; không chia sẻ token và không lưu token vào mã nguồn.

## 🚀 Cách Cài Đặt & Sử Dụng

### Cách 1: Chạy cục bộ qua mạng Wi-Fi gia đình
1. Trên máy tính, chạy tệp **`chay_server.bat`** (hoặc chạy lệnh `python server.py`).
2. Trên điện thoại (kết nối cùng Wi-Fi với máy tính), mở trình duyệt Chrome và truy cập địa chỉ IP LAN hiển thị trên màn hình máy tính.
3. Bấm vào biểu tượng **3 chấm [⋮]** trên trình duyệt Chrome -> chọn **"Cài đặt ứng dụng"** (Install App) hoặc **"Thêm vào màn hình chính"** (Add to Home screen) để sử dụng toàn màn hình.

### Cách 2: Triển khai lên Hosting cá nhân (GitHub Pages / Vercel / Cloudflare Pages)
1. Tải toàn bộ mã nguồn lên kho lưu trữ GitHub của bạn.
2. Bật **GitHub Pages** (hoặc liên kết tới Vercel/Cloudflare Pages).
3. Mở đường link web của bạn trên bất kỳ thiết bị nào để đọc sách mọi lúc mọi nơi.
