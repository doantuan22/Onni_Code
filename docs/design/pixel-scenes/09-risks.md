## 9. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
| --- | --- |
| Văn bản khó đọc trên cảnh sáng | Trần độ hiện theo tương phản + scrim tối thiểu quanh cột đọc + chế độ Horizon cho chat |
| Tranh "không đẹp" (rủi ro lớn nhất, mang tính chủ quan) | Quy trình checklist nghệ thuật, contact sheet duyệt trước khi nhận, mỗi cảnh một chủ, cho phép loại cảnh không đạt khỏi v1 thay vì kéo dài |
| Worker/OffscreenCanvas thiếu trong một WebView | Phát hiện khả năng, lùi về main thread cùng lõi; phanh hiệu năng |
| Pin/CPU trên laptop | 12 fps, dừng khi ẩn tab, tự hạ, tắt ở mobile mặc định |
| Hai nền trang trí chồng nhau | Ẩn `TwinkleBackdrop`/`GhostCodeBackdrop` khi cảnh bật |
| `design-guardian` | Palette số, màu UI chỉ qua token; kiểm lại sau khi viết |
| Đổi `app-shell.tsx` làm vỡ test layout (`app-shell.test.tsx`, `sidebar-frame.test.tsx`) | Canvas là phần tử `absolute` thêm vào, không đổi lưới; chạy riêng các test đó |
| Cảnh phản ứng theo agent (v2) gây phân tâm | Tách v2, chỉ đổi tốc độ/độ dày, mặc định tắt |
| Credit | Ghi "kỹ thuật lấy cảm hứng từ Pixel Chat Themes (MIT)" trong docs; không sao chép mã/nghệ thuật |

---
[← Mục lục](README.md)
