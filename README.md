# 📖 Hướng Dẫn Sử Dụng: App Đọc PDF & Khớp Audio Cho Android

Ứng dụng **PDF Audio Sync** được thiết kế chuyên biệt cho điện thoại Android và máy tính, giải quyết trọn vẹn nhu cầu vừa đọc PDF vừa nghe MP3 với khả năng **đồng bộ khớp từng trang**.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Khớp mốc thời gian từng trang (Audio-Page Sync)**:
   - Khi nghe audio đến đâu, bạn chỉ cần bấm **📍 Ghim mốc giây này cho trang hiện tại**.
   - Ứng dụng sẽ ghi nhớ: ví dụ Trang 1 (00:00), Trang 2 (01:45), Trang 3 (03:20)...
2. **Tự động chuyển trang**:
   - Khi MP3 chạy đến đúng thời điểm của trang kế tiếp, màn hình sẽ **tự động lật sang trang đó** mà bạn không cần chạm vào màn hình.
3. **Lật trang tự tua Audio**:
   - Khi bạn bấm nút lật trang hoặc vuốt tay sang trang khác, audio sẽ **tự động tua đến đúng đoạn đọc** của trang đó.
4. **Trình điều khiển đọc chuyên dụng**:
   - Nút tua nhanh / lùi 5 giây.
   - Chỉnh tốc độ đọc: `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`.
   - Hỗ trợ vuốt ngón tay trái / phải trên màn hình để chuyển trang.
5. **Tự động lưu & Xuất file mốc**:
   - Tự động ghi nhớ mốc khớp trang vào bộ nhớ máy theo từng file PDF.
   - Có thể **Xuất file `.json`** để sao lưu hoặc chia sẻ cho người khác.

---

## 🚀 Cách Cài Đặt & Sử Dụng Lên Điện Thoại Android

### Cách 1: Cài đặt trực tiếp qua Wi-Fi (Nhanh nhất - Không cần cáp nối)

1. Trên máy tính, nhấp đúp chuột vào file **`chay_server.bat`** (hoặc mở Terminal chạy `python server.py`).
2. Màn hình sẽ hiện ra địa chỉ kết nối Wi-Fi, ví dụ:
   ```text
   http://192.168.xx.35:8080
   ```
3. Đảm bảo điện thoại Android kết nối **chung mạng Wi-Fi** với máy tính:
   - Mở trình duyệt **Google Chrome** trên điện thoại.
   - Gõ địa chỉ `http://192.168.xx.35:8080`.
4. **Cài đặt thành App ngoài màn hình chính**:
   - Trên Chrome điện thoại, bấm vào biểu tượng dấu **3 chấm [⋮]** ở góc trên bên phải.
   - Chọn **"Cài đặt ứng dụng"** (Install app) hoặc **"Thêm vào màn hình chính"** (Add to Home screen).
   - Ngay lập tức, một biểu tượng App **PDF Audio** sẽ xuất hiện ngoài màn hình chính điện thoại của bạn, mở ra toàn màn hình như ứng dụng native tải từ CH Play!

---

### Cách 2: Tải lên hosting miễn phí (Vercel / GitHub Pages / Netlify)

Nếu muốn mở app ở bất kỳ đâu kể cả khi ra ngoài đường không có máy tính:
1. Tải toàn bộ thư mục này lên một kho lưu trữ GitHub hoặc kéo thả thư mục vào [Netlify Drop](https://app.netlify.com/drop) hoặc [Vercel](https://vercel.com).
2. Bạn sẽ có một đường link cố định (ví dụ `https://pdf-audio-sync.vercel.app`).
3. Mở link trên điện thoại Android và bấm **Cài đặt ứng dụng** là dùng vĩnh viễn.

---

### Cách 3: Đóng gói thành file cài đặt `.apk` độc lập

Nếu bạn muốn tạo file `.apk` để cài trực tiếp bằng tệp:
1. Bạn có thể sử dụng công cụ online miễn phí như **Web2Apk** hoặc **PWA2APK** (nhập URL hoặc nén thư mục này thành file zip để tạo APK).
2. Hoặc sử dụng **Capacitor** / **Cordova**:
   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "PDF Audio" "com.pdfaudio.app" --web-dir "."
   npx cap add android
   npx cap open android
   ```
   Sau đó bấm *Build APK* trong Android Studio.
