## 7. Kiểm thử và cách duyệt "đẹp" — v2

| Lớp | Giữ từ v1 | Cổng v2 |
| --- | --- | --- |
| Lõi TS/Node | Test primitive thuần và golden FNV-1a RGBA ở `t=0`, seed 42, 320×180, từng cảnh × bốn giờ | Thêm hai palette theme, kiểm thứ tự lớp/che khuất, giới hạn index, pose sprite, cycle và particle theo seed/time. Duyệt diff ảnh trước khi cập nhật hash. |
| Thẩm mỹ | `scene-snap` xuất PNG/contact sheet, duyệt chéo | **V2-6** yêu cầu cả contact sheet, ảnh app thật, clip và bảng so với upstream. Chủ sản phẩm ký theo từng cảnh. |
| Độ đọc | Dùng tỷ lệ WCAG và màu UI qua token | **Thay** trần palette toàn cảnh + scrim bằng kiểm AA trên nền đã ghép ở từng vùng chữ. Giữ quy tắc palette TS viết dạng số và kiểm `design-guardian`. |
| UI và hợp đồng | Vitest/Testing Library cho provider, backdrop, popover, Settings, ⌘K, shell, route/contract parity và i18n `coverage.test.ts` | Thêm record cũ/mặc định mới, đổi theme/giờ, thumbnail khung thật, khởi động nguội, worker lỗi có đường lùi, tắt/unmount giải phóng timer/worker. |
| Hiệu năng | Khung lõi ≤ 2 ms @480×270, cảnh tắt không tải engine, lõi khoảng ≤20 KB gzip và mỗi chunk cảnh khoảng ≤15 KB gzip | Đo p95 khung lõi cho từng cảnh, tách render và trình bày. So trace app off/v1/v2 khi idle, stream và cuộn. |
| E2E | App thật qua agent-browser, bật ở sidebar, kiểm `/new`/chat, tắt cảnh | **Thay** kịch bản chỉ Hạ Long bằng ma trận 8 cảnh × 2 theme × 2 mặt. |

### 7.1 Ma trận ảnh và phiếu duyệt V2-6

- Mỗi cảnh xuất contact sheet 3 cỡ (320×180, 480×270, 240×300) × 4 giờ (bình minh, ngày, hoàng hôn, đêm) × 2 theme. Đính kèm bản raw để so màu và ảnh ở trạng thái giảm chuyển động để duyệt bố cục tĩnh.
- Chụp **32 ảnh desktop từ app thật** ở 1440×900, với đủ 8 cảnh × sáng/tối × `/new` Toàn khung/chat Đường chân trời, ở mặc định v2. Chụp thêm Hạ Long, Sahara, Tromsø ở 390×844, cả hai mặt và theme. Kiểm landmark, vùng trống và dải cảnh phía trên dock. Ghi commit/build, scene id, seed, thời điểm đã resolve, nguồn giờ, theme, độ rõ, mode, scroll, viewport/DPR, backend, motion và alpha panel vào tệp kèm ảnh. Dùng cùng điều kiện khi so v1/v2, gồm một lượt ở mức 0,7 cho cảnh đối chiếu.
- Mỗi cảnh/theme có clip 5–10 giây từ app, có khung tĩnh đối chiếu. Nếu hiệu ứng theo chu kỳ dài, ghi thêm đoạn bao trọn sự kiện. Ghi tên và mốc thời gian của ≥3 chuyển động nhìn thấy, gồm ≥1 sprite động. Chỉ ra ≥5 lớp tạo chiều sâu và nơi hướng sáng tạo viền sáng hoặc ánh khí quyển. Tromsø phải thấy **rèm cực quang** đổi theo thời gian, kiểm riêng vùng trời độc lập với gợn nước. [R2](research/R2-craft.md), [R3](research/R3-audit-scenes.md).
- Đặt ảnh app v2 cạnh ảnh app v1 (nếu có) và một ví dụ của Pixel Chat Themes ghim theo R1. Đối chiếu bố cục, che khuất, quan hệ nguồn sáng–vật liệu và nhịp hoạt ảnh. Có thể so Hạ Long với cảnh Việt Nam về chủ thể và tỷ lệ, Tromsø với Noel về cực quang và lớp tiền cảnh. Ghi nguồn và phiên bản của mỗi mẫu. Upstream là mốc thị giác, mã và tài sản của v2 do OnniCode tự tạo. [R1](research/R1-upstream.md).

| Điểm chấm (1–5) | Dấu hiệu đạt mức 4 |
| --- | --- |
| Bố cục | Nhận ra địa danh và chủ thể ở thumbnail, khung tĩnh, `/new` và phần hữu dụng của chat. Chủ thể còn thấy ở crop hẹp. |
| Chiều sâu | Chỉ được ≥5 lớp có vai trò riêng, phân biệt gần–giữa–xa bằng hình, độ sáng và che khuất. |
| Màu | Hai palette sáng/tối giữ được vật liệu và sắc độ xa/gần. Nguồn sáng, rim light, bóng và phản quang nhất quán. |
| Chi tiết | Cụm pixel mô tả vật liệu hoặc vật thể nhận diện. Dither, vân và hạt giữ chỗ cho điểm nhìn chính. |
| Chuyển động | ≥3 hiệu ứng thấy được ở tốc độ mặc định, có ≥1 sprite động. Nhịp vừa, vòng lặp kín, không nháy mảng lớn hoặc để bóng ma. |

Thang điểm dùng 1 = lỗi rõ · 2 = yếu · 3 = nhận ra nhưng cần sửa · 4 = đạt · 5 = nổi bật. Ghi điểm từng mục theo từng theme, lấy mức thấp hơn giữa hai mặt khi mục đó phụ thuộc bố cục UI. **Mọi mục phải ≥4 ở cả hai theme.** Ghi kèm scene id, chủ thể/lớp/hiệu ứng, liên kết ảnh/clip và nhận xét so upstream. Chủ sản phẩm ký duyệt hoặc ghi mục cần sửa, ngày và commit đã xem. Cảnh thiếu dữ liệu hoặc có điểm dưới ngưỡng quay lại chủ file. [R1](research/R1-upstream.md), [R2](research/R2-craft.md), [R3](research/R3-audit-scenes.md), [R4](research/R4-audit-theme-ui.md).

### 7.2 Cổng tương phản cục bộ và hiệu năng

| Phép đo | Điều kiện đạt |
| --- | --- |
| Chữ sau khi ghép lớp | Kiểm màu chữ tính được và nền tổng hợp cuối (gồm canvas, tint/mask, panel lồng và alpha của chữ). Lập bảng tỷ lệ thấp nhất theo mặt/theme/token cho chữ chính, muted, soft, placeholder, metadata, trạng thái, màu cú pháp trong code/diff/tool, cả ô nhập và popover. **≥4,5:1** cho chữ thường, kiểm riêng ngưỡng AA cho chữ lớn và thành phần phi văn bản áp dụng (**≥3:1**, gồm ranh giới điều khiển/chỉ báo focus cần thiết). Dùng token và màu nền thực, bỏ pixel rìa glyph khi lấy mẫu, không làm tròn một tỷ lệ thiếu thành đạt. |
| Trường hợp xấu nhất | Quét các palette/mốc và cực trị cycle hoặc nền biên bảo thủ, ở độ rõ 0,7/0,9/1, với panel lồng và lúc đổi theme giữa stream. Đối chiếu pixel app trên cảnh sáng nhất/tối nhất ở từng theme. Lưu token, RGB nền/chữ, tọa độ hoặc selector và tỷ lệ. Khi tỷ lệ thiếu, sửa tint/nền tại vùng chữ (mốc thử sáng 96%, tối 94%, viền 1px). Dùng nền đặc khi cần. |
| Độ rõ ngoài vùng đọc | Cố định seed, giờ, khung tĩnh và tọa độ có `P ≠ B` ngoài panel/mask. Thử slider 0/0,3/0,7/0,9/1. Sai lệch màu phải tăng đơn điệu và khớp `B + s(P − B)` trong sai số 1 byte/kênh. Ở mặc định, ảnh phải giữ landmark và chi tiết ở vùng trống. |
| Khung và phản hồi UI | Cùng máy/build profile, seed/crop và tải, warm-up 10 giây, đo 60 giây mỗi kịch bản off/v1/v2 (idle, stream, cuộn), cả worker lẫn main fallback. Ghi môi trường, p50/p95, tỷ lệ frame thật, dropped frames, CPU/RAM và trace. Ở 480×270, **p95 core ≤2 ms** gồm copy, vẽ và đổi RGBA. Đo present/transfer riêng. Nhịp mặc định 12 FPS, không thêm long task main >50 ms do scenery khi idle/stream/cuộn. |
| Phanh, tải và vòng đời | Test 30 mẫu trung bình >8 ms ⇒ 12→6→tĩnh khi tiếp tục vượt ngưỡng. Tab ẩn, giảm chuyển động và motion-off không vẽ định kỳ, chỉ cập nhật khung khi dữ liệu đổi. Worker giữ tối đa một bitmap chờ, đóng bitmap và terminate khi tắt. Ở lần tải nguội với cảnh tắt, ghi Network/bundle chứng minh 0 engine, 0 chunk cảnh, 0 canvas nền và 0 worker cảnh. So kích thước gzip với ngân sách v1 ở bảng trên. |

Cơ sở đo khung/tách tải theo R2, phép ghép màu và mức AA theo R4. Số trong bảng là ngưỡng nghiệm thu v2. [R2](research/R2-craft.md), [R4](research/R4-audit-theme-ui.md).

### 7.3 E2E mở rộng tám cảnh

1. Chạy riêng `packages/web/e2e/scenery.e2e.ts` với app thật và fixture thread cục bộ, không chạy agent thật. Chẩn đoán chỗ chờ `[data-slot="user-bubble"]` bằng spec đối chứng `task-thread.e2e.ts`, sửa fixture/điều kiện sẵn sàng trước khi mở rộng ma trận. Chờ trạng thái đã lưu và `data-ready` với timeout hữu hạn, kiểm cả lượt nguội. Không dùng sleep cố định để vượt lỗi.
2. Duyệt tám id theo [bộ cảnh v2](03-scene-set.md), chọn qua popover, kiểm thumbnail đúng cảnh, id đang chọn và persistence sau reload. Với mỗi id, kiểm cả hai theme tại `/new` và chat, đúng surface/mode và đúng một canvas nền đã ready. Lưu ảnh theo ma trận desktop ở §7.1.
3. Với các cảnh mẫu ở viewport hẹp và rộng, kiểm nhập/chọn chữ, cuộn transcript, đổi theme hệ thống, ép giờ khác mặc định, giảm chuyển động và tắt cảnh. Kiểm id lạ, worker fallback, mất chunk và tắt lúc đang tải bằng test phù hợp với từng tầng. Tắt phải về `data-scene=off`, không backdrop/canvas nền, và không ảnh hưởng thao tác chat.

Không bỏ test. Dùng cổng khả năng bên trong test OffscreenCanvas và kiểm đường lùi. Browser không provision được hoặc fixture đỏ là cổng e2e còn mở. [Hiện trạng v1](11-verification-status.md).

---
[← Mục lục](README.md)
