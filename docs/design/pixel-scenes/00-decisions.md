## 0. Các quyết định đã chốt (đọc phần này là đủ nắm hướng)

| # | Quyết định | Lý do ngắn |
| --- | --- | --- |
| D1 | Vẽ bằng **canvas độ phân giải thấp, buffer chỉ số màu (indexed), phóng to nguyên số, `image-rendering: pixelated`**; KHÔNG dùng lưới ký tự ASCII như upstream | Ra đúng chất pixel-art, đẹp hơn ASCII, cho phép đổi palette/ngày-đêm/theme gần như miễn phí |
| D2 | Lõi engine là **TS thuần, không DOM** (trả về `Uint32Array` RGBA); lớp mỏng bên ngoài chạy trong **Web Worker + OffscreenCanvas**, có đường lùi chạy ở main thread | Chat có danh sách ảo hoá nặng; worker không tranh main thread. Lõi không DOM ⇒ test được trong Node, xuất PNG để duyệt tranh |
| D3 | Canvas gắn ở **cột nội dung của app shell** (bên phải sidebar), dưới nội dung, một chỗ duy nhất cho cả `/new` lẫn chat | Một engine, một vị trí; sidebar giữ nền đặc nên luôn đọc được |
| D4 | **Không dùng `backdrop-filter`**. Độ đọc được đảm bảo bằng: màn che (scrim) từ token `--background` + tone-mapping trong palette + **trần độ hiện tính theo tương phản WCAG** | Rẻ GPU, và có bảo đảm đo được thay vì "xem bằng mắt" |
| D5 | Hai **chế độ hiển thị**: `Toàn khung` (mặc định cho `/new`) và `Đường chân trời` (mặc định cho chat: cảnh chỉ nổi ở ~45% phía dưới, phần trên hoà vào nền) | Chat là nơi đọc chữ; `/new` là nơi "trình diễn" |
| D6 | Mặc định **TẮT** (zero-config, không ai bị bất ngờ). Bật ở ba nơi: Settings → Appearance (đầy đủ), nút nhanh ở chân sidebar cạnh ThemeToggle (popover), ⌘K | Quen tay như theme; vẫn tìm được ở Settings |
| D7 | Lưu ở `appearance.scene` trong `~/.onni/ui-state.json` (toàn cục), tất cả khoá optional; id cảnh là `string` chứ không phải enum | Thêm cảnh không phải đổi contract; id lạ ⇒ rơi về "tắt" |
| D8 | Bộ cảnh v1: **4 Việt Nam + 4 thế giới = 8 cảnh**, mỗi cảnh là mã thủ tục (procedural) + vài sprite nhỏ viết tay; có công cụ render PNG trong Node để duyệt/regression | Thủ tục ⇒ nhẹ, đổi kích thước/thời điểm tuỳ ý, không phải kèm ảnh |

---

---
[← Mục lục](README.md)
