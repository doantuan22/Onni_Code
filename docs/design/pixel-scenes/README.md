# Cảnh nền pixel (Scenery) — kế hoạch v2

Trạng thái: **v1 xong kỹ thuật có điều kiện; v2 = sửa chữa & nâng cấp thẩm mỹ**. V1 có 8 cảnh, engine indexed/worker, lưu tuỳ chọn và điều khiển, nhưng chủ sản phẩm chưa chấp nhận chất lượng tranh: khối phẳng, thiếu chiều sâu, motion khó thấy, nền sáng/tối mờ ở mức 70%. E2E v1 vẫn chưa xanh; không coi nghiệm thu kỹ thuật là nghiệm thu đẹp. V2 dưới đây là kế hoạch, chưa phải sản phẩm đã sửa.

**Thay định nghĩa v2 cũ** “parallax cuộn + phản ứng agent”: ưu tiên nay là layer/ánh sáng/sprite có chủ đích, palette riêng light/dark, bảo vệ chữ cục bộ thay giảm màu kép, và gate duyệt app thật. Giữ nền Canvas2D indexed + TS/worker, một canvas ở shell, mặc định TẮT. Default visibility .9 chỉ sau panel an toàn + kiểm AA; không ghi đè sở thích cũ. Chốt hướng tại [00](00-decisions.md) và [tổng hợp nghiên cứu](research/_SYNTHESIS.md).

Hướng dẫn sử dụng hiện hành: [Appearance](../../reference.md#appearance). Chỉ học kỹ thuật từ [Pixel Chat Themes](https://github.com/Aqua2409z/pixel-chat-themes) (MIT), tự viết mã/tài sản OnniCode; không sao chép. Upstream có Canvas, SVG/SMIL và pixel art Noel, không chỉ ASCII ([R1](research/R1-upstream.md)).

Đọc `00` để nắm quyết định, `01` để thấy baseline và giới hạn chứng cứ, `08` để giao việc.

| Mục | Nội dung |
| --- | --- |
| [0. Quyết định v2](00-decisions.md) | D1–D8 giữ/sửa/thay và V2-1…V2-8, lý do từ phản hồi |
| [1. Hiện trạng v1 thật](01-current-state.md) | Điểm mạnh/yếu, bảng số R4, điểm R3, ảnh evidence; phân biệt tính toán và đo app |
| [2. Kỹ thuật vẽ](02-rendering-technique.md) | Canvas indexed, layer/mask, cycling, sprite, phanh và chi phí |
| [3. Bộ cảnh](03-scene-set.md) | Vẽ lại/thay cảnh, cảnh giữ nhưng chỉnh lớn, tiêu chí từng cảnh |
| [4. Tích hợp UI](04-ui-integration.md) | Palette sáng/tối, panel chữ, `/new` Full, chat Horizon, chrome/mobile |
| [5. Điều khiển](05-user-controls.md) | Thumbnail render thật, visibility, thời điểm, Settings/popover/⌘K |
| [6. Dữ liệu và hợp đồng](06-data-contract.md) | Optional state, migration auto/theme/clock, mirror/pre-paint |
| [7. Kiểm thử và duyệt đẹp](07-testing.md) | Test kỹ thuật, AA, ảnh app/clip, điểm và chữ ký chủ sản phẩm |
| [8. Kế hoạch triển khai](08-implementation-plan.md) | P0 primitive/bảo vệ chữ → cảnh song song UI → ảnh/duyệt → e2e/tài liệu; file rời |
| [9. Rủi ro](09-risks.md) | Hiệu năng, thẩm mỹ chủ quan, độ đọc, công vẽ, giấy phép |
| [10. Giả định/mặc định](10-assumptions.md) | Giữ/thay giả định v1, điều kiện nâng default, việc cần duyệt |
| [11–12. Biên bản kiểm tra v1](11-verification-status.md) | Hồ sơ lịch sử, kết quả có điều kiện và tồn đọng; không phải chứng nhận v2 |

### Nghiên cứu và ảnh minh chứng

| Tài liệu | Vai trò |
| --- | --- |
| [research/](research/), [brief](research/_BRIEF.md), [synthesis](research/_SYNTHESIS.md) | Phản hồi chủ sản phẩm và nguồn chuẩn chốt hướng v2 |
| [R1 — Upstream](research/R1-upstream.md) | Kỹ thuật, nhịp/ánh sáng có nhân–quả, so sánh và giấy phép |
| [R2 — Craft](research/R2-craft.md) | Palette/hình khối, phương án A + sprite chọn lọc, ngân sách và profiling |
| [R3 — Audit cảnh](research/R3-audit-scenes.md) | Điểm tám cảnh, primitive thiếu, bỏ Santorini/giữ hai cảnh sau chỉnh lớn |
| [R4 — Audit sáng/tối/UI](research/R4-audit-theme-ui.md) | Tính toán giảm màu kép ~4–8% giữa cột, panel cục bộ và migration |
| [evidence/](evidence/), [UI thật](evidence/ui/), [contact sheet](evidence/contact-sheets/) | Baseline v1. Sheet không có ceiling/scrim/chrome; PNG thiếu sidecar, ảnh tĩnh không chứng minh motion |

V2 chỉ hoàn tất khi mỗi cảnh có ≥5 lớp, ≥3 hiệu ứng thấy được, ≥1 sprite động, ánh sáng khí quyển; contact sheet + app thật 2 theme × `/new`/chat + so cạnh upstream được chủ sản phẩm chấm từng tiêu chí ≥4/5 và ký, đồng thời đạt kiểm độ đọc/hiệu năng. Những con số thiết kế trong kế hoạch là mục tiêu thử, không phải số đo v2.
