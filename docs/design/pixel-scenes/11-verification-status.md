## 11. Trạng thái kiểm tra sản phẩm (UI + e2e)

Cập nhật 2026-11-22. **V1 đạt kỹ thuật có điều kiện, chưa đạt kỳ vọng thẩm mỹ.** V2 là kế hoạch sửa chữa và nâng cấp. Bằng chứng v2 sẽ được ghi theo cổng ở mục 7. [Kiểm thử và nghiệm thu](07-testing.md).

### 11.1 Kết quả nghiệm thu v1 (2026-11-22)

| Hạng mục | Kết quả đã ghi nhận |
| --- | --- |
| Build và typecheck | `npm run build` (gồm `check:pack`) đạt. Typecheck `@onni/web` sạch. |
| Kiểm thử theo file | Vòng triển khai ghi nhận 46 test trong `lib/scenery/**` và các kiểm tra SceneProvider, SceneBackdrop, ScenePopover, AppShell, command palette, appearance, Settings và i18n đều đạt. Vòng nghiệm thu chạy `lib/scenery/**`, provider, backdrop, popover: **9 file, 58 test đạt**. |
| Engine và ảnh | `scene-snap` xuất 8 contact sheet ở 3 cỡ × 4 giờ × 2 theme, worker đã xem. Golden khớp. Bản v1 quét AA trên trần palette cho foreground/muted và đã sửa lỗi làm tròn byte ở `contrastCeiling`. Số đo lõi v1 ghi khoảng **1,2 ms @480×270**. [Contact sheets v1](evidence/contact-sheets/). |
| App thật | Build chạy `ONNI_DRY_RUN=1`, Chrome qua agent-browser. Chọn và thấy đủ tám cảnh tại `/new` trong cả hai theme. Chat chụp Sahara ở chế độ Đường chân trời trong cả hai theme. Popover có hai tab Việt Nam/Thế giới, mỗi tab bốn cảnh. Tắt trong chat sáng cho `data-scene=off`, 0 backdrop và 0 canvas. [Ảnh app v1](evidence/ui/) · [Ảnh khi tắt](evidence/ui/off-chat-light.png). |
| E2E | **Chưa xanh.** Lượt nguội hết giờ chờ canvas. Lượt sau qua canvas, hỏng ở `[data-slot="user-bubble"]`. Spec đối chứng `task-thread.e2e.ts` hỏng giống vậy trên máy nghiệm thu, dấu hiệu lỗi fixture thread dùng chung. `scenery.e2e.ts` chỉ phủ Hạ Long. |
| Giới hạn đợt nghiệm thu | Chưa có kết quả `npm test` đầy đủ, `test:unit`, `test:package`. `test-env-up.sh` không chạy được ở máy đó do chỉ có Python shim Microsoft Store. `design-guardian.test.ts` đã có hai lỗi ở `run-header.tsx:341` (`text-amber-*`, `dark:`). |
| Truy vết các lượt trước | Run `27001845` bị hủy khi Onni khởi động lại, chưa có commit. Run `95d252c3` bị hủy theo yêu cầu người dùng, chưa tạo kết quả. |

### 11.2 Phản hồi 2026-11-22 và lý do làm v2

Chủ sản phẩm nhận xét tranh còn phẳng, thiếu chiều sâu, hiệu ứng ít thấy và thua ví dụ upstream. Chế độ sáng/tối chưa có cách thể hiện riêng. Ở mức 70%, cảnh khó nhận ra, rõ nhất ở theme sáng. Ảnh Hạ Long sáng và Sahara trong chat ghi lại hai biểu hiện: landmark mờ và dải cảnh bị dock che. [Brief nghiên cứu](research/_BRIEF.md) · [Hạ Long sáng](evidence/ui/new-light-vn-halong.png) · [Sahara chat tối](evidence/ui/chat-dark-sahara.png).

| Căn cứ | Hệ quả cho v2 |
| --- | --- |
| **R1** đối chiếu chủ thể, che khuất, ánh sáng phản lên vật liệu và chuyển động nhiều nhịp của Pixel Chat Themes. | Dùng để duyệt cạnh ảnh v2. Giữ phong cảnh và tài sản do OnniCode tự tạo. [R1](research/R1-upstream.md). |
| **R2** đề xuất phân lớp, shading theo vật liệu, cycle và sprite chọn lọc trên engine indexed hiện có. | Giữ Canvas2D/worker, đo lõi và đường trình bày riêng. Chỉ cân nhắc spike WebGL khi có số liệu profiling. [R2](research/R2-craft.md). |
| **R3** chấm lại tám cảnh. Nhiều lớp có hình/giá trị màu gần nhau, sprite quá nhỏ. Tromsø v1 chỉ động ở mặt nước, rèm cực quang dựng một lần. | Giữ Phú Quốc và Matterhorn sau chỉnh lớn, vẽ lại các cảnh còn lại và thay Santorini. Đo chất lượng qua ≥5 lớp, ≥3 hiệu ứng thấy được, ≥1 sprite động và rim light/ánh khí quyển. [R3](research/R3-audit-scenes.md). |
| **R4** tái lập phép tính ở `time:auto`, slider 0,7. Giữa vùng đọc chỉ còn khoảng **4,18–4,69%** hệ số màu cảnh ở theme sáng và **5,99–7,79%** ở theme tối, trước horizon/chrome. Đây là kết quả tính từ mã, chưa phải lấy mẫu pixel trình duyệt. | **Thay** trần toàn cảnh + scrim kép bằng palette riêng và bảo vệ chữ cục bộ. Chỉ nâng mặc định lên 0,9 sau khi bỏ giảm kép và qua cổng AA. Giữ chế độ hiển thị mặc định theo mặt và sửa vùng trống/dải chân trời. [R4](research/R4-audit-theme-ui.md). |

Giữ bằng chứng kỹ thuật v1 để đối chiếu hồi quy. Golden và contact sheet xác nhận đầu ra lõi, còn độ rõ và tương phản khi dùng app cần ảnh và mẫu sau ghép lớp. Phiếu v2 cần chữ ký của chủ sản phẩm theo từng cảnh. [Cổng V2-6](07-testing.md).

### 11.3 Tồn đọng và người xử lý

| Tồn đọng | Điều kiện đóng |
| --- | --- |
| Art, hai palette và độ rõ trong app | **P2/P3/P4.** Đủ tám cảnh theo danh mục v2, mặc định theo theme và bảo toàn thiết lập đã lưu. Có contact sheet, 32 ảnh desktop, ảnh hẹp, clip, so upstream và mọi điểm ≥4 ở cả hai theme. |
| AA trên UI thật và hiệu năng | **P3/P4.** Nộp bảng AA thấp nhất của từng vùng chữ, ảnh đối chứng và trace off/v1/v2. Xác nhận 12 FPS, phanh, chế độ tĩnh và đường lùi main. Đo lõi v2 theo mục 7. |
| Thumbnail vẫn là icon giữ chỗ | **P1/P3a/P4.** Thay bằng ảnh khung tĩnh đúng cảnh/theme từ engine. Kiểm popover khi cảnh tắt. |
| Fixture thread và e2e còn đỏ | **P5.** Xác nhận lỗi fixture bằng spec đối chứng, sửa và chạy riêng ma trận tám cảnh. Có kết quả lượt nguội, đổi theme, giảm chuyển động, tắt. Nếu thiếu browser hoặc Python, ghi môi trường và lỗi cụ thể để chạy lại trên máy đã provision hoặc CI. |
| Kiểm tra repo còn thiếu, hai lỗi guardian cũ | **P6/manager.** Chạy đủ chuỗi trước PR. Đối chứng lỗi guardian với baseline, sửa lỗi do v2 trong scope và chuyển lỗi có sẵn về chủ file nếu nằm ngoài scope. Ghi từng kết quả và phần còn thiếu. |

[Phân phase và quyền sở hữu](08-implementation-plan.md)

---
[← Mục lục](README.md)
