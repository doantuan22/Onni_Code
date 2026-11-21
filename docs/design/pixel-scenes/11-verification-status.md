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

## 12. Nghiệm thu (2026-11-22)

Kết luận: **đạt có điều kiện** — tính năng chạy đúng trên app thật; còn 3 việc tồn đọng bên dưới. Ảnh minh chứng: [`evidence/`](evidence/).

### Đã chạy và đạt
- `npm run build` (+ `check:pack`) đạt; typecheck `@onni/web` sạch.
- Vitest: `lib/scenery/**`, `scene-provider`, `scene-backdrop`, `scene-popover` — 9 file, 58 test đạt.
- `scene-snap`: 8 cảnh xuất contact sheet 3 cỡ × 4 thời điểm × 2 theme ([`evidence/contact-sheets/`](evidence/contact-sheets/)); hash khớp golden (test đạt).
- App thật (build, `ONNI_DRY_RUN=1`, Chrome qua agent-browser): chọn và hiển thị đủ 8 cảnh ở `/new`, 2 theme ([`evidence/ui/new-*.png`](evidence/ui/)); trang chat ở chế độ Đường chân trời, 2 theme (`chat-*.png`); tắt cảnh ⇒ `data-scene=off`, 0 backdrop, 0 canvas (`off-chat-light.png`). Popover có tab Vietnam/World, mỗi vùng 4 cảnh.

### Tồn đọng
1. `scenery.e2e.ts` **chưa xanh**: lần đầu hết giờ chờ canvas (cảnh nguội, lần sau qua bước này), rồi hỏng ở `[data-slot="user-bubble"]` của trang chat. Spec đối chứng `task-thread.e2e.ts` cũng hỏng cùng kiểu trên máy này ⇒ lỗi nền của fixture thread, không riêng scenery. Kịch bản vẫn chỉ phủ Hạ Long.
2. Độ hiện: ở mức mặc định 70% các cảnh khá mờ trên `/new` (nhất là theme sáng); chỉ nhận ra rõ khi nhìn kỹ. Cần chủ sản phẩm quyết định có nâng mặc định không.
3. Thumbnail popover vẫn là icon giữ chỗ. `npm test` đầy đủ, `test:unit`, `test:package` chưa chạy; `test-env-up.sh` không chạy được ở máy này vì thiếu Python thật (shim Microsoft Store).
