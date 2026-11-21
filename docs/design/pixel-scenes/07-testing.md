## 7. Kiểm thử và cách duyệt "đẹp"

| Lớp | Cách |
| --- | --- |
| Lõi engine (Node) | `rng`/noise/dither/ridge là hàm thuần ⇒ test đơn vị; **golden hash** FNV của khung `t=0`, `320×180`, từng cảnh × từng thời điểm; đổi mã làm đổi hash ⇒ phải cố ý cập nhật |
| Duyệt tranh | Script dev `scripts/scene-snap` (Node, tự ghi PNG bằng `zlib`) → contact sheet: cảnh × {320×180, 480×270, 240×300} × {dawn, day, dusk, night} × {theme sáng, tối}; người/worker xem ảnh trước khi nhận cảnh |
| Tương phản | Test "trần độ hiện" (4.3.1) cho mọi cảnh × theme; palette không chứa hex chuỗi (qua `design-guardian`) |
| UI | Vitest + Testing Library: popover, Settings, ⌘K, route `/new` và chat gắn đúng hồ sơ, `data-scene`, cờ `reduced-motion` ⇒ không có timer chạy, unmount ⇒ worker terminate; `route-parity`, contract parity |
| i18n | Thêm bản vi cho mọi chuỗi (`coverage.test.ts`) |
| Hiệu năng | Khung lõi ≤ 2 ms ở 480×270 (benchmark trong test, ngưỡng rộng để không flaky); kích thước chunk: lõi ≤ ~20 KB gz, mỗi cảnh ≤ ~15 KB gz; bundle chính không đổi khi tính năng tắt |
| E2E | `npm run test:e2e` (agent-browser): bật cảnh ở popover → `data-scene=on`, canvas có mặt ở `/new` và chat, tắt → canvas biến mất; ảnh chụp 2 theme |

Không bỏ/skip test nào; các kiểm tra phụ thuộc OffscreenCanvas dùng cổng khả năng trong test.

---

---
[← Mục lục](README.md)
