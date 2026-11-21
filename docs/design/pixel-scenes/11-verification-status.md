## 11. Trạng thái kiểm tra sản phẩm (UI + e2e)

Cập nhật: 2026-11-22. Việc kiểm tra bằng giao diện thật **đang tạm dừng**, chưa hoàn tất.

### Đã kiểm tra
- Typecheck `@onni/web`: sạch.
- Vitest theo từng file liên quan: `lib/scenery/**` (46 test), `scene-provider`, `scene-backdrop`, `scene-popover`, `app-shell`, `command-palette`, `lib/appearance`, `routes/settings/appearance`, i18n coverage — đều đạt.
- Mỗi cảnh: worker đã xem contact sheet ở 3 cỡ × 4 thời điểm × 2 theme; golden hash đã ghim; quét tương phản AA đạt. Khung lõi ≈ 1,2 ms ở 480×270.
- Đã sửa lỗi làm tròn byte ở `contrastCeiling` (engine/contrast.ts).

### Chưa kiểm tra
- Chưa chạy `npm run test:e2e` hay kịch bản `packages/web/e2e/scenery.e2e.ts` (mới kiểm tra cú pháp). Kịch bản hiện chỉ phủ Hạ Long; cần mở rộng cho cả 8 cảnh.
- Chưa mở app thật để xem: popover sidebar, `/new` và chat ở hai theme, chế độ Đường chân trời, `reduced-motion`, tắt cảnh ⇒ không canvas/không tải engine.
- Chưa chạy `npm test` đầy đủ, `npm run build`, `npm run test:package`, `npm run test:unit`.
- Thumbnail trong popover vẫn là placeholder theo `SCENE_IDS`.

### Lỗi đã biết, không thuộc tính năng
- `design-guardian.test.ts` lỗi 2 test do `routes/task-thread/run-header.tsx:341` (`text-amber-*`, `dark:`); có từ trước.

### Lần chạy kiểm tra bị gián đoạn
- Lần 1 (27001845) bị huỷ khi onni khởi động lại, không có commit.
- Lần 2 (95d252c3) bị huỷ theo yêu cầu người dùng, chưa tạo kết quả.

### Việc tiếp theo khi tiếp tục
1. `ONNI_DRY_RUN=1`, `.ai/scripts/test-env-up.sh`; chạy riêng kịch bản scenery; mở rộng cho 8 cảnh.
2. Xem ảnh chụp 8 cảnh × 2 theme ở `/new` và chat; sửa lỗi nếu có.
3. Chạy chuỗi kiểm tra đầy đủ trước khi PR.
