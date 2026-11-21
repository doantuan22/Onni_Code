## 8. Kế hoạch triển khai v2 — sửa chữa và nâng cấp

| Quyết định v1 | Xử lý trong v2 |
| --- | --- |
| D1, D2, D3 | **Giữ** Canvas2D indexed, lõi TS thuần, worker/OffscreenCanvas có main fallback và một canvas tại cột nội dung shell. 12 FPS mặc định, khung tĩnh khi giảm chuyển động. |
| D4 | **Giữ** quy tắc không blur. **Thay** trần tương phản toàn cảnh và scrim kép bằng nền bảo vệ chữ cục bộ, viền 1px và cổng AA. |
| D5 | **Giữ** mặc định `/new` Toàn khung và chat Đường chân trời. **Thay** mask toàn chiều cao và dải sát đáy bằng vùng trống thực ở `/new` và dải cảnh phía trên dock. |
| D6, D7 | **Giữ** mặc định tắt, các lối điều khiển, lưu `appearance.scene` toàn cục với khóa tùy chọn và id chuỗi. **Thay** palette, mặc định thời điểm và độ rõ theo P3. |
| D8 | **Giữ** 4 cảnh Việt Nam + 4 cảnh thế giới, ảnh duyệt render từ lõi. **Thay** art/cách dựng, trần hai chuyển động và slot Santorini theo mục 3. |

Căn cứ phân việc gồm [Tổng hợp V2-8](research/_SYNTHESIS.md), [R1 — đối chiếu upstream](research/R1-upstream.md), [R2 — kiến trúc và kỹ thuật](research/R2-craft.md), [R3 — bộ cảnh](research/R3-audit-scenes.md), [R4 — theme và UI](research/R4-audit-theme-ui.md).

### 8.1 Gói giao việc P0–P6

Đường dẫn trong bảng tính từ gốc repo. `W` là `packages/web`, `S` là `packages/web/src`, `SC` là `packages/web/src/lib/scenery`. File test cùng tên thuộc chủ file nguồn, trừ ngoại lệ ghi rõ. Ước lượng là công chủ động theo ngày công, chưa tính thời gian chờ duyệt.

| Phase / worker gợi ý | Việc giao và file sở hữu | Phụ thuộc | Tiêu chí xong | Ước lượng |
| --- | --- | --- | --- | --- |
| **P0 · Engine** — worker TS/worker runtime | `SC/engine/**`, **trừ** `registry.ts` và `core.test.ts`. Bổ sung lớp sky/far/mid/near/water/fog/fx và mask, polygon/curve lượng tử, sprite sheet, particle pool, palette cycling theo nhóm index, helper đo AA trên composite. Chốt API theme/time cho renderer, host và worker. | — | Fixture thử được mọi primitive, render xác định theo seed/time, palette ≤32 index. Test targeted ở file riêng cho primitive, host và worker. Giữ 480×270, 12→6→tĩnh và ACK/close một bitmap chờ. Đo fixture lõi ≤2 ms p95. Giao chữ ký API và ví dụ cho P1/P2/P3. | 2–3 ngày |
| **P1 · Công cụ duyệt** — worker TS/PNG | `SC/dev/**`, **trừ** `golden-hashes.json`. Mở rộng `scene-snap`/snapshots để xuất raw, sheet hai palette × bốn giờ × ba cỡ, khung tĩnh và metadata. Thêm lệnh xuất thumbnail tĩnh render từ engine. Lưu lệnh đo/chụp trong README của công cụ. | API P0 | Xuất được ảnh cả hai theme và chuỗi khung từ seed/giờ cố định. Sinh đủ thumbnail theo id/theme cho P4. Giữ test hash, công cụ báo diff khi đổi cảnh và chỉ ghi golden khi chạy chế độ cập nhật tường minh. | 0,5–1 ngày |
| **P2 · Bộ cảnh** — bốn worker xem được ảnh, chia theo bảng dưới | Chỉ module của hai cảnh và sprite/test riêng của nhóm. Vẽ lại theo mục 3. Chốt silhouette và ánh sáng ở khung tĩnh trước, sau đó thêm chuyển động, lớp che và phản quang có mask. | P0. Dùng công cụ P1 để nộp ảnh. Hạ Long và Sahara làm mẫu trước. | Mỗi cảnh có ≥5 lớp, ≥3 hiệu ứng nhìn thấy, ≥1 sprite động, rim light/ánh khí quyển, palette riêng cho cả hai theme và crop hẹp đọc được. Giao sheet/clip, id, focus, giờ mặc định theo theme và chi phí khung của từng cảnh. Tromsø trình diễn rèm cực quang động. | 1–2 ngày/nhóm |
| **P3a · State và điều khiển** — worker contract/UI | `packages/contract/src/workspace.ts`, `packages/work/src/server/{contract-parity.workspace,typed-bodies}.test.ts` khi cần, `W/index.html`, `S/lib/appearance.ts`, `SC/engine/{registry.ts,core.test.ts}`, `S/components/{appearance-provider,scene-provider,scene-popover,command-palette}.tsx`, `S/routes/settings/appearance.tsx`, `S/lib/i18n/**`. Đồng bộ schema, normalize, mirror/pre-paint, registry/id, UI thời điểm và thumbnail. Dùng nguồn giờ theme/clock/fixed theo mục 6. | API P0 và chốt id với P2. Có thể làm state song song P2/P3b. Tích hợp registry thay cảnh sau khi có module từ P2. | Record cũ có `time:auto` giữ đồng hồ, giờ cố định vẫn cố định. Record mới thiếu giờ theo theme (sáng → ngày/bình minh, tối → hoàng hôn/đêm). Giá trị độ rõ đã lưu giữ nguyên. Ghép P3a và P3b, kiểm AA ở 0,9 trước khi dùng giá trị này làm mặc định cho record thiếu độ rõ. Id bỏ đi/id lạ về tắt. Popover dùng thumbnail do P4 sinh từ engine, tải ảnh tĩnh để mở popover khi cảnh tắt. | 1–2 ngày |
| **P3b · Ghép lớp UI** — worker React/CSS | `S/components/{scene-backdrop,app-shell}.tsx`, `S/routes/new-task-surface.tsx`, `S/routes/task-thread/**`, `S/styles/index.css`, `S/lib/theme-contrast.test.ts`. Dùng `resolvedTheme` sẵn có và giao diện state đã chốt với P3a. | API P0 và giao diện preference P3a. Làm song song P2 bằng fixture trước. | Độ rõ ngoài vùng đọc trộn đúng một lần. Panel chữ qua AA, chrome có khoảng trống, `/new` có vùng thoáng và dải chat nằm trên dock. Mốc thử desktop theo R4 là ≥35% diện tích cột nội dung để trống ngoài panel và dải cao 32–40% vùng transcript với fade ở 20–30% phía trên. Màn hẹp có hero tĩnh và vùng đọc nền đặc. Một canvas, sidebar đặc. Đổi theme, cuộn, stream, mobile và fallback qua kiểm mục 7. | 1,5–2,5 ngày |
| **P4 · Ảnh, đo và duyệt** — worker QA có browser, chủ sản phẩm ký | `docs/design/pixel-scenes/evidence/v2/**`, `SC/dev/golden-hashes.json`, `W/public/scenery-thumbs/**`. Xuất thumbnail trước khi build bản QA. Chụp ảnh app và clip, nộp bảng AA/perf và phiếu so upstream. | P1, toàn bộ P2 và P3a/P3b. Có thể duyệt thử cặp Hạ Long/Sahara trước vòng chính. | Đủ 32 ảnh desktop và ảnh hẹp, metadata, clip, đối chiếu upstream. Mỗi cảnh đạt mọi mục ≥4 ở cả hai theme, AA/perf đạt và có chữ ký chủ sản phẩm. Chỉ cập nhật hash cảnh đã duyệt. Nếu rớt, trả dữ liệu và tiêu chí lỗi về chủ file rồi đo lại trên bản tích hợp. | 1,5–2,5 ngày + thời gian duyệt |
| **P5 · E2E** — worker QA/browser | `W/e2e/{scenery.e2e.ts,task-thread.e2e.ts,fixtures/**}` trong phạm vi fixture và kịch bản liên quan. Sửa fixture thread và mở rộng ma trận. | P4, đường dẫn/id đã chốt từ P2/P3 | Spec đối chứng xác nhận transcript là thật. Cả 8 cảnh × 2 theme × 2 mặt đạt trên app, có lượt nguội, giảm chuyển động và tắt. Báo kết quả riêng nếu browser không provision được. | 1–2 ngày |
| **P6 · Tài liệu, bàn giao** — worker tài liệu và manager tích hợp | `docs/reference.md`, `docs/design/pixel-scenes/*.md`, mục spec Scenery nếu cần. Liên kết ảnh, kết quả và phạm vi của commit nghiệm thu. | P4, P5 | Ghi mặc định/hành vi thực tế, giữ lịch sử v1, đối chiếu tồn đọng ở mục 11. Báo lệnh và kết quả của chuỗi kiểm tra repo trước PR. | 0,5–1 ngày + thời gian chạy cổng repo |

| Worker P2 | File sở hữu cụ thể dưới `SC/scenes/` | Điểm duyệt đầu |
| --- | --- | --- |
| VN-A | `vn/halong.ts`, `vn/phu-quoc.ts` | Hạ Long là mẫu cảnh nước. Thuyền có tỷ lệ rõ, bóng nước đứt theo sóng. Phú Quốc giữ bố cục chính và sửa bờ, dừa, glint. |
| VN-B | `vn/mu-cang-chai.ts`, `vn/fansipan.ts` | Ruộng có nhóm bậc, vật thể cho thấy tỷ lệ. Fansipan có silhouette nhận diện và mây có khối. |
| World-A | `world/sahara.ts`, `world/matterhorn.ts`, `world/alps-desert.test.ts` | Sahara là mẫu cảnh đất với caravan động, cồn có hai mặt. Matterhorn giữ đỉnh chính, làm lại hồ, rừng và tuyết. |
| World-B | `world/tromso.ts`, `world/santorini.ts` (gỡ), `world/kyoto.ts` (Kyoto/Fushimi Inari, id `world-kyoto`, thay Santorini theo [03](03-scene-set.md)) | Rèm cực quang có motion riêng và phản quang ăn khớp. Cảnh thay có silhouette và phối cảnh riêng, do OnniCode tự vẽ. |

Sprite/test mới của P2 đặt cạnh module, mang tiền tố tên cảnh để tránh giao nhau. P3a giữ một chủ cho registry, danh sách id và assert giữa registry/preference. Nếu nhóm cảnh cần primitive, báo P0 bổ sung. Nếu tên/id cảnh thay đổi, chủ P3a cập nhật mọi nơi nhận id và báo P4/P5.

### 8.2 Trình tự và giới hạn chạy kiểm tra

1. P0 chốt primitive và API. Từ mốc đó P1, P2 và P3 đi song song. Chốt Hạ Long/Sahara trên fixture và ghép UI mẫu để các nhóm dùng chung tiêu chuẩn art. Sau đó hoàn thiện sáu cảnh còn lại.
2. Ghép P2 với registry của P3a và compositor của P3b trước vòng duyệt P4. P4 chạy trên bản đã tích hợp, P5 khóa hồi quy trên bản đã duyệt, P6 ghi kết quả và manager chạy cổng repo. Khi cần sửa, chủ file sửa trong scope của mình. Tổng công ước tính **12–22 ngày công**, chưa tính thời gian chờ chữ ký và vòng sửa mỹ thuật.
3. **Codex worker chỉ chạy test theo file được giao, không chạy full suite.** Manager cấp tối đa **hai suất chạy test đồng thời** trong toàn lượt triển khai, tính cả Vitest, đo khung và e2e. Worker còn lại so ảnh/đọc diff khi hết suất. P4 và P5 dùng lần lượt một môi trường QA có thời hạn, dừng tiến trình theo PID khi xong. Manager hoặc CI chạy các cổng trước PR theo thứ tự repo (`typecheck` → `test` → `test:unit` → `build` → `test:package`).
4. Kế hoạch hoàn thành khi đủ bằng chứng mục 7 và các tồn đọng chặn phát hành trong mục 11 có kết quả. Profiling quyết định có cần spike WebGL ở lượt sau. Cảnh phản ứng theo agent, pointer và parallax theo cuộn dời khỏi v2 này.

[Kiểm thử và nghiệm thu](07-testing.md) · [Trạng thái xác minh](11-verification-status.md)

---
[← Mục lục](README.md)
