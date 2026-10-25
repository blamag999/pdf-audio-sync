# PDF Audio Sync — Trình đọc PDF đồng bộ âm thanh

PDF Audio Sync là ứng dụng đọc tài liệu PDF và nghe MP3 tương ứng, hỗ trợ đồng bộ thời điểm phát âm thanh với từng trang PDF. Ứng dụng chạy trên trình duyệt máy tính và thiết bị di động.

## Bắt đầu nhanh

1. Mở [PDF Audio Sync trên GitHub Pages](https://blamag999.github.io/pdf-audio-sync/).
2. Nhấn **Bắt đầu**.
3. Chọn một trong hai cách:
   - **Chọn thư mục:** chọn thư mục có các tệp PDF/MP3. Ứng dụng quét và hiển thị danh sách tập để bạn chọn nghe.
   - **Chọn PDF:** chọn tài liệu PDF, sau đó nhấn **Chọn MP3** để nạp tệp âm thanh tương ứng.
4. Nhấn **Play** để bắt đầu nghe. Việc nạp tệp không tự động phát âm thanh.
5. Dùng các nút chuyển trang, tua lùi/tới và đọc lại trang để điều khiển quá trình đọc.

## Hướng dẫn sử dụng

### Chọn và mở nội dung
- **Bắt đầu → Chọn thư mục:** phù hợp khi có nhiều tập truyện. Chọn thư mục chứa các tệp PDF và MP3; sau khi quét, mở **Danh sách tập** để chọn tập.
- **Bắt đầu → Chọn PDF:** phù hợp khi chỉ đọc một tài liệu. Sau khi chọn PDF, cần chọn thêm file MP3 tương ứng bằng nút **Chọn MP3**.
- Bạn cũng có thể kéo thả tệp PDF và MP3 vào vùng đọc nếu trình duyệt và thiết bị hỗ trợ thao tác này.

### Điều khiển đọc
- **Play/Dừng:** phát hoặc tạm dừng âm thanh.
- **Trang trước/Trang sau:** chuyển trang PDF.
- **Tua lùi/Tua tới:** di chuyển âm thanh 5 giây.
- **Đọc lại trang:** phát lại từ mốc thời gian của trang hiện tại (khi có mốc phù hợp).
- **Tốc độ phát:** chọn tốc độ phù hợp.
- **Vừa dọc / 2 Trang:** thay đổi cách hiển thị PDF; dùng nút phóng to/thu nhỏ để điều chỉnh kích thước.

### Chế độ đọc và đồng bộ mốc
- **Tự động lật trang (theo mốc thời gian):** tự chuyển PDF sang trang kế tiếp khi âm thanh tới mốc đã đặt.
- **Tự lật trang (dừng chờ lật trang):** dừng âm thanh tại mốc trang kế tiếp để bạn tự lật trang; nếu không có mốc hợp lệ cho trang kế tiếp, âm thanh tiếp tục chạy.
- **Đọc liên tục:** phát âm thanh mà không tự dừng hoặc tự chuyển trang theo mốc.
- **Lật trang tự tua:** khi bật, thao tác lật trang sẽ tua âm thanh đến mốc của trang đó nếu có.
- **Ghim mốc giây này cho trang:** gán thời điểm âm thanh hiện tại cho trang đang mở. Hãy thiết lập mốc cho các trang cần đồng bộ.

### Lưu và đồng bộ dữ liệu
- Mốc thời gian được lưu cục bộ trong trình duyệt theo từng cuốn truyện.
- Dùng **Lưu mốc** để lưu/xuất tệp mốc JSON về máy.
- Trong **Mốc thời gian**, bạn có thể nhập hoặc xuất JSON, xóa mốc, hoặc đồng bộ mốc lên GitHub.
- Đồng bộ GitHub chỉ tải lên dữ liệu JSON mốc; PDF và MP3 không được tải lên.
- Để ghi dữ liệu vào repository, cần GitHub Personal Access Token có quyền **Contents: Read and write**. Token chỉ được giữ trong phiên trình duyệt hiện tại; không đưa token vào mã nguồn hoặc chia sẻ token.

### Menu
Nút **Menu** ở góc trên phải dùng để ẩn/hiện khu vực chọn tệp, tên tệp, số mốc, chế độ đọc, tùy chọn tự tua và thanh mốc trang phía dưới.

## Lưu ý
- Trình duyệt cần hỗ trợ chọn thư mục để sử dụng chức năng quét thư mục. Nếu không có, hãy chọn từng PDF và MP3.
- PDF và MP3 vẫn nằm trên thiết bị của bạn khi sử dụng chức năng mở tệp cục bộ.
- Nếu giao diện chưa cập nhật sau khi triển khai, hãy tải lại trang bằng **Ctrl + F5** hoặc đóng/mở lại ứng dụng.

## Công nghệ
- PDF.js để hiển thị tài liệu PDF.
- IndexedDB/LocalStorage của trình duyệt để lưu dữ liệu cục bộ.
- GitHub Contents API để đồng bộ tệp JSON mốc thời gian khi người dùng chủ động yêu cầu.

## Repository
https://github.com/blamag999/pdf-audio-sync
