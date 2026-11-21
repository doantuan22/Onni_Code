## 5. Điều khiển người dùng — đặt ở đâu

Nguyên tắc: bật/tắt phải **một chạm**, chỉnh sâu ở Settings, không thêm gì vào vùng composer.

| Nơi | Có gì | Ghi chú |
| --- | --- | --- |
| **Chân sidebar**, ngay cạnh `ThemeToggle` (`app-shell.tsx:~608`) | Nút icon (lucide `MountainSnowIcon`, trạng thái bật được tô) mở **Popover**: công tắc Bật/Tắt; lưới thumbnail 8 cảnh (tab VN / Thế giới); thanh trượt **Độ hiện**; liên kết "Cài đặt cảnh nền…" | Có ở cả sidebar thu gọn (rail) và `MobileNavDrawer` |
| **Settings → Appearance** (thẻ mới "Cảnh nền") | Công tắc chính; thư viện thumbnail sống (render 1 khung tĩnh mỗi cảnh); **Hiển thị ở**: `/new`, Chat, Trang khác (3 công tắc); **Chế độ** theo mặt: Toàn khung / Đường chân trời; **Thời điểm**: Theo giờ máy / Bình minh / Ngày / Hoàng hôn / Đêm; **Độ hiện**; **Tốc độ**; **Chuyển động** bật/tắt; ghi chú "tự giảm khi máy yếu / hệ điều hành bật giảm chuyển động" | Dùng `SettingsField`, `Segmented`, `Switch`, `Button` sẵn có |
| **⌘K** | "Bật/Tắt cảnh nền", "Cảnh nền kế tiếp", "Cảnh nền trước" (cạnh "Toggle theme") | Phím tắt riêng **không gán mặc định** (tránh đụng `Mod+Alt+*`/`Alt+n`); người dùng gán được ở Settings → Keyboard |
| **Góc dưới phải `/new`** | Chip tên cảnh + ‹ › | Cùng popover; chỉ hiện khi cảnh đang bật cho `/new` |

Không đặt nút trong header của chat (đã chật) và không tạo màn hình riêng.

Trạng thái thân thiện: khi tắt, popover vẫn mở được để xem trước ("xem thử" hiển thị cảnh tạm trong khung 16:9 trong popover, không phủ cả app). Đổi cảnh có chuyển mờ 400 ms (hai canvas hoặc fade LUT); `reduced-motion` ⇒ đổi tức thì.

---

---
[← Mục lục](README.md)
