## 10. Giả định và mặc định v2 (không chặn lập kế hoạch)

Nguồn chốt: [_SYNTHESIS](research/_SYNTHESIS.md). Đây là các mặc định để triển khai/duyệt; không yêu cầu người dùng tạo cấu hình. Quyết định cũ được giữ hoặc thay rõ dưới đây; chưa có kết quả nghiệm thu v2.

| Nội dung | Truy vết v1 → mặc định v2 | Cách xác minh / điểm còn mở |
| --- | --- | --- |
| Mục tiêu | **Thay:** v2 không còn chỉ là parallax khi cuộn/cảnh phản ứng agent. V2 sửa chất lượng tranh, chiều sâu, sáng/tối và cách bảo vệ chữ | [Brief phản hồi](research/_BRIEF.md), [R1 §4](research/R1-upstream.md), [R2 §6](research/R2-craft.md); activity/pointer không chặn v2. Parallax nhẹ có giới hạn, không buộc scroll trong chat. |
| Bộ cảnh | **Sửa:** mục tiêu 8 slot; chốt ở [03](03-scene-set.md): 4 Việt Nam + 4 thế giới, Kyoto thay Santorini. Bỏ Santorini; Phú Quốc/Matterhorn chỉnh lớn; phần còn lại vẽ lại | Cảnh thay thế chốt duy nhất ở [03](03-scene-set.md), theo [R3](research/R3-audit-scenes.md). Không coi tám cảnh v1 đã qua gate v2. |
| Bật/tắt và lưu | **Giữ:** on:false, chat Horizon, `/new` Full, state optional/global, id lạ ⇒ tắt; giữ lựa chọn explicit | Không tự bật khi nâng cấp, không yêu cầu env/dependency mới. Khả năng thiếu ⇒ fallback; [R2 §4](research/R2-craft.md), [R4 §6](research/R4-audit-theme-ui.md). |
| Sáng/tối | **Thay:** mỗi theme có palette riêng × 4 giờ; auto mặc định mới theo resolvedTheme: sáng dawn/day, tối dusk/night theo mood cảnh | Người dùng ép giờ được; không dùng palette đêm phủ trắng để giả sáng. Không API thời tiết/vị trí; [R2 §3.1,3.9](research/R2-craft.md), [R4 §4](research/R4-audit-theme-ui.md). |
| Tương thích thời điểm | **Sửa có migration:** đề xuất optional `timeSource` nhận theme, clock hoặc fixed. Thiếu timeSource/time ⇒ theme; record v1 có `time:'auto'` ⇒ clock; giờ cũ cố định ⇒ fixed; timeSource explicit thắng suy diễn | `time` tiếp tục chứa mốc fixed, không lưu resolvedTheme vào state. Kiểm normalizer/schema/mirror/pre-paint trong cùng thay đổi; [R4 §6](research/R4-audit-theme-ui.md), [06](06-data-contract.md). Đây là đề xuất hợp đồng, chưa phải field đã có. |
| Visibility | **Sửa có điều kiện:** .7 v1 → đề xuất .9 chỉ cho record mới/thiếu giá trị sau panel + kiểm AA; giữ giá trị explicit cũ | Slider ngoài chữ phải tăng đơn điệu tại 0/.3/.7/.9/1; không còn C²/s. Chưa đạt gate thì không nâng default ([R4 §3,5,7](research/R4-audit-theme-ui.md)). |
| Panel/diện tích | **Thay:** scrim cột cao toàn màn hình → tint/viền 1px theo khối đọc, không blur. Thử light 96%, dark 94%; `/new` 35–45% cột nội dung không panel ở 1440×900 | Đây là điểm khởi đầu, không kết quả đo. Horizon thử 32–40% transcript nhìn thấy, trên dock; fade 20–30% strip. Mobile duyệt riêng, ưu tiên độ đọc; [R4 §5](research/R4-audit-theme-ui.md), [04](04-ui-integration.md). |
| Ngân sách | **Giữ:** indexed/TS/worker/fallback, 12 fps, ≤480×270, reduced-motion tĩnh; **thêm** layer/cycling/sprite/pool có giới hạn | Mục tiêu lõi ≤2 ms phải đo lại. Không giả định 60 fps, WebGL, blur là điều kiện đẹp; spike chỉ sau trace ([R1 §5](research/R1-upstream.md), [R2 §4–5](research/R2-craft.md)). |
| Công vẽ/quyền dùng | **Sửa:** cho phép thêm layer/sprite vẽ tay chọn lọc, tự tạo và có nguồn gốc | Công art chưa ước lượng chắc; duyệt mẫu trước nhân rộng. Không chép upstream/tutorial asset; [R1 giấy phép](research/R1-upstream.md), [R2 §5C](research/R2-craft.md). |
| Ai chốt đẹp | **Thay:** worker xem sheet/hash không đủ. Chủ sản phẩm ký điểm 1–5, mỗi tiêu chí ≥4 | Mỗi cảnh ≥5 lớp/≥3 effect thấy được/≥1 sprite động/rim; ảnh app cả 2 theme × `/new`/chat + so upstream, motion có clip/chuỗi ảnh. Tham số thử được chỉnh sau duyệt, không hạ cổng chất lượng ([R3](research/R3-audit-scenes.md), [R4 §7](research/R4-audit-theme-ui.md)). |

Không lệch hướng synthesis. Tên cảnh thay và thông số crop/panel cuối là kết quả của [03](03-scene-set.md)/[04](04-ui-integration.md) và vòng duyệt; chưa cần hỏi lại các quyết định đã được chốt ở [00](00-decisions.md).

---
[← Mục lục](README.md)
