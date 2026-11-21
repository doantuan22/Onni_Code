## 0. Các quyết định v2 — sửa chữa và nâng cấp

**V1 xong kỹ thuật có điều kiện, chưa đạt thẩm mỹ; v2 là kế hoạch, chưa triển khai.** Chủ sản phẩm phản hồi: khối phẳng, thiếu chiều sâu, hiệu ứng khó thấy, kém cảm hứng upstream; mức 70% vẫn mờ, nhất là theme sáng ([brief](research/_BRIEF.md)). Hướng chuẩn: [_SYNTHESIS](research/_SYNTHESIS.md). Giữ mã D để truy vết; phần thay thế ghi trong bảng.

### 0.1 Quyết định nền D1–D8

| # | Trạng thái / quyết định v2 | Lý do, phần v1 bị thay và căn cứ |
| --- | --- | --- |
| D1 | **Giữ:** canvas thấp phân giải, indexed ≤32 màu, phóng nguyên số/pixelated | Sửa tranh trước đổi renderer. Đính chính lý do cũ: upstream không chỉ ASCII; có Canvas, SVG/SMIL, Noel là pixel art. LUT rẻ nhưng xuất RGBA vẫn O(W×H), không miễn phí ([R1 §1–2](research/R1-upstream.md), [R2 §1,5](research/R2-craft.md)). |
| D2 | **Giữ:** lõi TS không DOM trả RGBA, worker + OffscreenCanvas, fallback main | Bảo toàn snapshot Node, một bitmap in-flight + ACK/close và phanh 12→6→0. Worker chuyển tải khỏi main, không xoá tổng CPU ([R2 §4](research/R2-craft.md)). |
| D3 | **Giữ:** một canvas tại cột nội dung shell, dưới `/new` và chat; sidebar đặc | Mount đúng, không phải nguồn alpha dư; không thêm DOM canvas cho từng lớp ([R4 §3.4](research/R4-audit-theme-ui.md)). |
| D4 | **Sửa:** giữ cấm `backdrop-filter`; bảo vệ chữ cục bộ bằng tint + viền 1px, kiểm AA trên composite cuối | **Thay** trần visibility toàn cảnh + tone-map/scrim kép. Ngoài khối đọc giữ màu; thiếu tương phản thì tăng nền panel. Chữa cảnh mờ nhưng giữ độ đọc ([R4 §3–5](research/R4-audit-theme-ui.md)). Blur chỉ xét bằng quyết định và benchmark riêng. |
| D5 | **Sửa:** giữ Toàn khung cho `/new`, Horizon cho chat; làm lại hình học/chrome | **Thay** strip 45% đáy shell bị fade dài/dock che. Thử strip 32–40% transcript nhìn thấy, kết thúc trên dock, fade 20–30% strip. `/new` có khoảng trống ngoài panel ([R4 §5](research/R4-audit-theme-ui.md), [04](04-ui-integration.md)). |
| D6 | **Giữ:** mặc định TẮT; Settings → Appearance, popover cạnh ThemeToggle, ⌘K | Nâng mỹ thuật không tự bật cảnh, vẫn zero-config; thumbnail phải là tranh thật theo V2-7 ([R4 §5–6](research/R4-audit-theme-ui.md)). |
| D7 | **Giữ:** `appearance.scene` toàn cục tại `~/.onni/ui-state.json`, mọi khoá optional, id string; id lạ ⇒ tắt | Giữ ui-state/mirror/pre-paint; không cần file/env mới. Trường mới optional, có migration, không đổi âm thầm `auto` cũ ([R4 §6](research/R4-audit-theme-ui.md), [06](06-data-contract.md)). |
| D8 | **Sửa:** bộ cảnh nhỏ, procedural kết hợp layer/sprite tự vẽ chọn lọc, có snapshot Node | **Thay** giới hạn chỉ procedural + vài sprite và danh sách 4 VN + 4 thế giới bất biến. Mục tiêu 8 slot, chất lượng quyết định: bỏ Santorini; Phú Quốc/Matterhorn chỉnh lớn; còn lại vẽ lại ([R3](research/R3-audit-scenes.md)). Cảnh thay chốt tại [03](03-scene-set.md). |

### 0.2 Quyết định nâng cấp V2-1…V2-8

| # | Chốt v2 | Phản hồi được giải quyết / điều kiện hoàn thành |
| --- | --- | --- |
| V2-1 | Phương án A: Canvas2D indexed; layer sky/far/mid/near/water/fog/fx có mask; cycling nước/ánh, parallax nhẹ, particle pool, sprite tự vẽ | Chữa thiếu chiều sâu/đời sống ([R1 §4–5](research/R1-upstream.md), [R2 §5A](research/R2-craft.md)). 12 fps, mục tiêu lõi ≤2 ms @480×270; reduced-motion ⇒ tĩnh. WebGL chỉ spike sau profiling. |
| V2-2 | Palette riêng light/dark × 4 giờ; `auto` mới theo theme: sáng day/dawn, tối dusk/night theo cảnh; vẫn ép giờ được | Chữa thiếu hướng sáng/tối ([R2 §3.1](research/R2-craft.md), [R4 §4](research/R4-audit-theme-ui.md)). Record v1 `time:auto` giữ clock bằng migration, xem [10](10-assumptions.md). |
| V2-3 | Bỏ giảm màu kép; composer/bubble/panel và chữ phụ có bảo vệ tại chỗ; slider tăng đơn điệu ngoài chữ | R4 tính s=.7 chỉ còn khoảng 4–8% giữa cột. Default .9 **chỉ sau** bảo vệ chữ + kiểm AA; giữ visibility explicit, không tự bật cảnh ([R4 §3,5–7](research/R4-audit-theme-ui.md)). |
| V2-4 | `/new` Toàn khung có khoảng thở; chat Horizon rõ trên dock; chrome thoáng, controls có nền an toàn | Chữa cảnh biến mất trong app; mobile duyệt riêng, không ép horizon `/new` chỉ vì width ([R4 §5](research/R4-audit-theme-ui.md)). |
| V2-5 | Mỗi cảnh ≥5 lớp độ sâu, ≥3 hiệu ứng chuyển động thấy được, ≥1 sprite động, rim/ánh khí quyển; Tromsø phải có aurora động | **Thay** checklist v1 ≤2 chuyển động. Bộ cảnh sửa theo D8/[R3](research/R3-audit-scenes.md). Đếm hiệu ứng không thay đánh giá mỹ thuật. |
| V2-6 | Chủ sản phẩm ký gate: contact sheet + app thật 2 theme × (`/new`, chat) + so cạnh upstream; chấm 1–5 bố cục/chiều sâu/màu/chi tiết/chuyển động | Mỗi tiêu chí ≥4; dưới 4 sửa lại. Hash không đủ; có chuỗi thời gian/video cho motion, ảnh tĩnh cho reduced-motion ([R1 §5](research/R1-upstream.md), [R3](research/R3-audit-scenes.md), [R4 §7](research/R4-audit-theme-ui.md)). |
| V2-7 | Thumbnail popover = khung tĩnh từ engine, đúng theme; bỏ icon placeholder | Sửa tồn đọng v1, chọn theo tranh thật; lazy/cache, không tám loop preview ([11 §12](11-verification-status.md), [R2 §5A](research/R2-craft.md)). |
| V2-8 | P0 primitive + bảo vệ chữ → cảnh (mỗi worker ≤2) song song UI/ngày–đêm → ảnh app + duyệt → e2e/tài liệu | File sở hữu/phụ thuộc/gate tại [08](08-implementation-plan.md). Tranh tĩnh phải đứng vững trước motion; một chủ engine/CSS ([R2 §6](research/R2-craft.md), [R3 primitive](research/R3-audit-scenes.md), [R4 §6](research/R4-audit-theme-ui.md)). |

Không lệch hướng [_SYNTHESIS](research/_SYNTHESIS.md). Thông số v2 là mục tiêu/thử nghiệm, không phải kết quả đã đạt.

---
[← Mục lục](README.md)
