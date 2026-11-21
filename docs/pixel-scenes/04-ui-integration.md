## 4. Tích hợp vào giao diện

### 4.1 Kiến trúc mount (một chỗ cho mọi route)

```
AppearanceProvider  (đã có)  →  SceneProvider  →  Router → AppShell
AppShell (cột phải: relative isolate)
 ├─ <SceneBackdrop/>   canvas + scrim, absolute inset-0, -z-10, pointer-events-none, aria-hidden
 ├─ MobileTopBar / banner / <main> / composer dock   (nội dung, giữ nền trong suốt)
```

- Cột phải thêm `relative isolate`; canvas `-z-10` nằm trên nền `bg-background` của gốc nhưng dưới mọi nội dung (đúng mẫu `TwinkleBackdrop`).
- Gốc `<html>` được gắn `data-scene="on|off"` (như `data-density`) để CSS đổi các bề mặt chrome mà không cần React.
- `SceneBackdrop` đọc route bằng `matchPath` (cùng cách `routeOwnsScrollArrival`) → `surface ∈ {new, chat, other}` rồi chọn **hồ sơ hiển thị**.
- Khi một route tự có backdrop riêng (`TwinkleBackdrop`, `GhostCodeBackdrop`) và cảnh đang bật cho `new`, hai backdrop cũ **ẩn đi** (`[data-scene=on] [data-slot=twinkle-backdrop],[data-slot=ghost-code-backdrop]{display:none}`): hai nền trang trí chồng nhau là rối mắt.

### 4.2 `/new` — nơi trình diễn

- Hồ sơ `new`: chế độ `Toàn khung`, độ hiện = giá trị người dùng đặt (mặc định 70%), scrim nhẹ chỉ ngay dưới cột form 760px (mask ngang mềm) để ô nhập và tiêu đề đọc rõ.
- Form `/new` đã dùng thẻ/ô có nền; chỉ cần đảm bảo các bề mặt chính (composer, pill) giữ nền token (không đổi gì).
- Một nút phụ nhỏ (ghost icon) ở góc dưới phải trang `/new`: tên cảnh + mũi tên đổi cảnh, mở cùng popover với sidebar. Không đặt gì trong vùng composer.
- Hoạt ảnh được phép sống động nhất ở đây (đủ 12 fps, toàn bộ lớp động).

### 4.3 Chat — nơi phải ưu tiên đọc

Vấn đề thật: văn bản trợ lý nằm thẳng trên nền, transcript ảo hoá cuộn liên tục, dock composer đang đặc.

Giải pháp ghép ba lớp:
1. **Chế độ `Đường chân trời`** (mặc định cho chat): canvas chỉ phủ ~45% đáy cột (`h-[45%] bottom-0`), phần trên mờ dần (`mask-image: linear-gradient(to top, black 45%, transparent)`); cảnh được tác giả bố cục để phần trời trên cùng có thể bị cắt.
2. **Scrim theo cột đọc**: một lớp `background: color-mix(in oklab, var(--background) A%, transparent)` có mask ngang mềm quanh cột `--measure` (820px ở chế độ `narrow`). Alpha `A` ở giữa cột **không thấp hơn** ngưỡng tính từ trần tương phản (4.3.1); hai bên (gutter) để lộ cảnh nhiều hơn trên màn rộng.
3. **Chrome bán trong suốt chỉ khi bật cảnh**: dock composer và header dính `background: color-mix(var(--background) 88%, transparent)` qua selector `[data-scene="on"] [data-slot=thread-dock]`; **không** blur. Thẻ tool/bong bóng đã `/40` nên giữ nguyên.

Hiệu năng trong chat: cảnh chạy trong worker nên không tranh main thread với việc render stream; main thread chỉ có phần ghép lớp của trình duyệt. Hạ cấp tự động nếu cần (4.3.2). Cảnh KHÔNG cuộn theo transcript (cố định), tránh phải đo scroll ở main thread; hiệu ứng parallax theo cuộn để lại v2 và mặc định tắt.

#### 4.3.1 Trần độ hiện bảo đảm tương phản

Với mỗi cảnh/palette/theme tính offline: `Lmax` = độ sáng lớn nhất của pixel trong palette. Màu nền hiệu dụng khi độ hiện `s` và scrim `A`: `eff = A·bg + (1−A)·(s·pixel + (1−s)·bg)`. Test đơn vị khẳng định với `s` = giá trị tối đa của thanh trượt, `foreground` và `muted-foreground` còn ≥ 4.5:1 (AA, đúng chuẩn mà `theme-contrast.test.ts` đang ghim) trên pixel xấu nhất. `A_min` cho cột đọc rút ra từ phép tính này. Nghĩa là thanh trượt không thể đưa người dùng tới trạng thái không đọc được.

#### 4.3.2 Phanh hiệu năng và an toàn

- Tạm dừng khi `document.hidden`; dừng hoạt ảnh (chỉ 1 khung tĩnh) khi `prefers-reduced-motion: reduce` hoặc người dùng tắt "Chuyển động".
- Đo thời gian trung bình 30 khung: > 8 ms ⇒ hạ xuống 6 fps ⇒ vẫn quá ⇒ khung tĩnh và hiện một dòng nhỏ trong Settings ("đã tự giảm để tiết kiệm máy").
- Màn hình hẹp (< `md`): chỉ chế độ `Đường chân trời`, buffer ≤ 240 px chiều rộng; mặc định chat trên mobile = tắt trừ khi người dùng bật.
- Không gửi sự kiện nào ra ngoài; không mạng; worker terminate khi unmount/tắt; kiểm thử rò rỉ (rAF/timer/worker).
- Worker không khả dụng ⇒ chạy cùng lõi trên main thread với cùng phanh.

### 4.4 "Cảnh phản ứng theo agent" (v2, tuỳ chọn)

Truyền một số `activity∈[0,1]` (có run đang chạy) vào `frame`: cảnh chỉ đổi **tốc độ/độ dày** hạt và mây (không chớp). Lấy từ truy vấn run đang hoạt động đã có (không thêm `refetchInterval`, không `new WebSocket`). Chốt v2 vì cần đo đạc, không chặn v1.

---

---
[← Mục lục](README.md)
