# Cảnh nền pixel ("Scenery") — kế hoạch

Trạng thái: **đã triển khai v1** — 8 cảnh, engine canvas pixel, lưu tuỳ chọn, tích hợp giao diện và điều khiển. v2 (parallax khi cuộn và cảnh phản ứng theo hoạt động agent) để sau. Chỉ học kỹ thuật từ [Pixel Chat Themes](https://github.com/Aqua2409z/pixel-chat-themes) (MIT); bộ cảnh là của riêng OnniCode (phong cảnh Việt Nam và thế giới).

Hướng dẫn sử dụng và mặc định hiện hành: [Appearance](../../reference.md#appearance). Các mục dưới giữ lại quyết định và kế hoạch thiết kế; kiểm thử e2e có kịch bản bật/tắt qua sidebar trên `/new` và chat, cần chạy riêng để xác minh giao diện thực.

Đọc `00` là nắm hướng; các mục còn lại đi sâu từng phần.

- [0. Các quyết định đã chốt (đọc phần này là đủ nắm hướng)](00-decisions.md)
- [1. Hiện trạng cockpit (đã đọc mã)](01-current-state.md)
- [2. Kỹ thuật vẽ — vì sao chọn D1](02-rendering-technique.md)
- [3. Bộ cảnh v1 (tiêu chí: đẹp, nhận ra ngay, đa dạng kỹ thuật)](03-scene-set.md)
- [4. Tích hợp vào giao diện](04-ui-integration.md)
- [5. Điều khiển người dùng — đặt ở đâu](05-user-controls.md)
- [6. Dữ liệu và hợp đồng](06-data-contract.md)
- [7. Kiểm thử và cách duyệt "đẹp"](07-testing.md)
- [8. Kế hoạch triển khai (để giao worker sau)](08-implementation-plan.md)
- [9. Rủi ro và cách xử lý](09-risks.md)
- [10. Giả định cần bạn xác nhận khi bắt đầu (có mặc định, không chặn việc lập kế hoạch)](10-assumptions.md)
