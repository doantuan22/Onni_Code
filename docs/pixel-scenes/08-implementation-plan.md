## 8. Kế hoạch triển khai (để giao worker sau)

Giai đoạn và quyền sở hữu file rời nhau:

| Phần | Nội dung | File sở hữu | Phụ thuộc |
| --- | --- | --- | --- |
| P1 Contract + lưu trữ | Schema, `Appearance`, normalize, mirror, pre-paint, provider mới (`SceneProvider`) | `packages/contract/src/workspace.ts`, `lib/appearance.ts`, `index.html`, `components/scene-provider.tsx` + tests | — |
| P2 Engine lõi | rng, noise atlas, dither, ridge, sprite, LUT/tone-map, trần tương phản, frame loop, worker + fallback, phanh hiệu năng | `packages/web/src/lib/scenery/engine/**` | kiểu từ P1 |
| P3 Công cụ duyệt | `scene-snap` PNG + contact sheet + golden hash | `packages/web/scripts/scene-snap.*` (hoặc `packages/web/src/lib/scenery/dev/`) | P2 |
| P4a Cảnh VN (V1–V4) | 4 file cảnh + palette + sprite | `lib/scenery/scenes/vn/**` | P2, P3 |
| P4b Cảnh thế giới (W1–W4) | 4 file cảnh | `lib/scenery/scenes/world/**` | P2, P3 |
| P5 Mount + CSS | `SceneBackdrop`, hồ sơ theo route, scrim, chrome bán trong suốt, ẩn backdrop cũ | `components/scene-backdrop.tsx`, `app-shell.tsx`, `styles/index.css` | P1, P2 |
| P6 Điều khiển | Popover sidebar, thẻ Settings, ⌘K, chip `/new`, i18n vi | `components/scene-popover.tsx`, `routes/settings/appearance.tsx`, `command-palette.tsx`, `routes/settings/registry*`, `i18n/vi-*` | P1 |
| P7 Tài liệu + E2E | `docs/reference.md`, spec cập nhật, e2e | `docs/`, `.ai/specs/`, e2e | tất cả |

Thứ tự gợi ý: P1 → (P2 ‖ P6 giao diện với cảnh giả) → P3 → (P4a ‖ P4b) → P5 → P7. P5 là chỗ chạm `app-shell.tsx` nên chỉ một chủ.
Gợi ý worker: P2 và P5 cần suy luận (nặng); P4 là việc sáng tạo lặp-xem-ảnh nên giao cho worker xem được ảnh, mỗi worker không quá 2 cảnh; P1, P6, P7 mức vừa. Quy tắc dự án: worker chạy test chỉ từng file liên quan, không chạy full suite.

Ước lượng thô: P1 nhỏ, P2 lớn nhất (lõi), P3 nhỏ-vừa, mỗi cảnh vừa (phần lớn thời gian là chỉnh thẩm mỹ), P5/P6 vừa.

### Tiêu chí hoàn thành v1
- Tắt: không tải mã engine, bundle chính không đổi, không worker, không canvas.
- Bật ở `/new` và chat: đọc rõ ở cả hai theme tại độ hiện tối đa (test tương phản xanh), CPU nhàn rỗi thấp (khung lõi ≤ 2 ms), `reduced-motion` ⇒ khung tĩnh.
- 8 cảnh qua duyệt contact sheet (ở 3 cỡ × 4 thời điểm).
- Gỡ file cấu hình ⇒ về mặc định tắt; ui-state cũ vẫn mở được.

---

---
[← Mục lục](README.md)
