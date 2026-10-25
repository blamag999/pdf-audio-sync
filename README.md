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
   - **Google Drive Online**: Quét thư mục hoặc mở file trực tiếp từ Google Drive.
   - **Cloudflare R2 Storage**: Đọc kho sách và nghe audio trực tiếp từ bucket Cloudflare R2 với tốc độ cao, hỗ trợ ảnh bìa và mốc khớp sẵn.
7. **Lưu trữ & Xuất file mốc**:
   - Tự động lưu mốc vào IndexedDB/LocalStorage của trình duyệt cho từng cuốn riêng biệt.
   - Xuất file `.json` để sao lưu vào thư mục truyện hoặc đưa vào kho dữ liệu.

---

## ☁️ Hướng Dẫn Cấu Hình Thư Viện Cloudflare R2

Nếu bạn muốn lưu trữ kho sách gồm hàng trăm cuốn PDF & MP3 trên Cloudflare R2 để đọc trực tuyến từ bất kỳ đâu:

### 1. Chuẩn bị file danh mục `books.json`
Trên bucket R2, đặt một file danh mục tên là `books.json` ở thư mục gốc (hoặc thư mục tùy chỉnh). Cấu trúc mẫu:

```json
[
  {
    "id": "book-01",
    "title": "Tên Sách 01",
    "coverUrl": "https://<your-bucket-url>/books/sach-1/cover.jpg",
    "pdfUrl": "https://<your-bucket-url>/books/sach-1/book.pdf",
    "audioUrl": "https://<your-bucket-url>/books/sach-1/audio.mp3",
    "audios": [
      {
        "name": "Part 1.mp3",
        "url": "https://<your-bucket-url>/books/sach-1/part1.mp3",
        "partLabel": "Part 1"
      },
      {
        "name": "Part 2.mp3",
        "url": "https://<your-bucket-url>/books/sach-1/part2.mp3",
        "partLabel": "Part 2"
      }
    ],
    "syncUrl": "https://<your-bucket-url>/books/sach-1/sync.json"
  }
]
```

> **Mẹo tự động:** Bạn có thể dùng script `python gen_r2_catalog.py` trong dự án để tự động quét thư mục sách và tạo file `books.json` nhanh chóng.

### 2. Cấu hình CORS trên Cloudflare R2
Để trình duyệt web có thể phát audio và đọc file PDF từ R2, trên Cloudflare Dashboard:
1. Vào **R2** -> Chọn **Bucket của bạn** -> Tab **Settings**.
2. Tìm mục **CORS Policy** và thêm cấu hình:
   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"]
     }
   ]
   ```

### 3. Đọc trên ứng dụng Web
- Bấm vào nút **⚡ Thư viện R2 Cloud** trên thanh điều khiển.
- Nhập đường dẫn đến file `books.json` của bạn (hoặc sử dụng link mặc định đã cài sẵn).
- Chọn cuốn sách bạn muốn đọc từ danh sách để bắt đầu thưởng thức.

---

## 🚀 Cách Cài Đặt & Sử Dụng

### Cách 1: Chạy cục bộ qua mạng Wi-Fi gia đình
1. Trên máy tính, chạy tệp **`chay_server.bat`** (hoặc chạy lệnh `python server.py`).
2. Trên điện thoại (kết nối cùng Wi-Fi với máy tính), mở trình duyệt Chrome và truy cập địa chỉ IP LAN hiển thị trên màn hình máy tính.
3. Bấm vào biểu tượng **3 chấm [⋮]** trên trình duyệt Chrome -> chọn **"Cài đặt ứng dụng"** (Install App) hoặc **"Thêm vào màn hình chính"** (Add to Home screen) để sử dụng toàn màn hình.

### Cách 2: Triển khai lên Hosting cá nhân (GitHub Pages / Vercel / Cloudflare Pages)
1. Tải toàn bộ mã nguồn lên kho lưu trữ GitHub của bạn.
2. Bật **GitHub Pages** (hoặc liên kết tới Vercel/Cloudflare Pages).
3. Mở đường link web của bạn trên bất kỳ thiết bị nào để đọc sách mọi lúc mọi nơi.
