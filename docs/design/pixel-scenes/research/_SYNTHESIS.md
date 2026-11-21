# Tổng hợp quyết định cho bản v2 (nguồn chuẩn cho mọi người viết lại; ưu tiên hơn _BRIEF khi mâu thuẫn)

Đã đọc: R1-upstream.md, R2-craft.md, R3-audit-scenes.md, R4-audit-theme-ui.md (cùng thư mục). Mỗi người viết PHẢI đọc cả bốn, rồi viết theo các quyết định dưới đây; có thể tinh chỉnh chi tiết nhưng không đảo hướng — nếu thấy cần đảo, ghi rõ lý do trong tài liệu của mình mục "Lệch so với _SYNTHESIS".

Hướng: **sửa chữa + nâng cấp v1 thành v2**, không bắt đầu lại từ số 0. Giữ: D1 (canvas indexed), D2 (lõi TS thuần + worker), D3 (một canvas ở shell), D6, D7. Sửa: D4, D5, D8 và bộ cảnh.

V2-1 Kiến trúc: phương án A của R2 (Canvas2D indexed + layer có ngữ nghĩa: sky/far/mid/near/water/fog/fx; palette cycling cho nước/ánh; parallax nhẹ; hệ particle; sprite động nhỏ vẽ tay chọn lọc). WebGL chỉ là spike sau khi có profiling. Mặc định 12 fps cho chuyển động, khung lõi ≤ 2 ms @480×270, reduced-motion ⇒ khung tĩnh.
V2-2 Sáng/Tối: palette RIÊNG cho từng theme (không chỉ tone-map một palette); thời điểm mặc định theo theme (sáng⇒ngày/bình minh, tối⇒hoàng hôn/đêm) khi `time:auto`; người dùng vẫn ép được thời điểm. Mỗi cảnh phải duyệt đẹp ở cả 2 theme.
V2-3 Độ đọc: bỏ tone-map/scrim kép đang làm mờ (R4: ở 70% giữa cột chữ chỉ còn ~4–8%); chuyển từ "trần tương phản toàn cảnh" sang **bảo vệ chữ cục bộ**: vùng nội dung (composer, bong bóng chat, panel) có tint/viền 1px không blur, phần còn lại của cảnh hiện rõ. Giữ D4 (không backdrop-filter) trừ khi benchmark riêng chứng minh khác. Mặc định visibility nâng (đề xuất 0.9) CHỈ sau khi có bảo vệ chữ cục bộ + kiểm tra tương phản WCAG AA tại vùng chữ.
V2-4 Chế độ hiển thị: `/new` Toàn khung với vùng trống thật sự để cảnh thở; chat Horizon: dải cảnh rõ hơn, hình học theo R4; chrome/thanh bán trong suốt.
V2-5 Bộ cảnh: theo R3 — mỗi cảnh phải có ≥5 lớp độ sâu, ≥3 hiệu ứng chuyển động có thể thấy, ≥1 sprite động, rim light/ánh khí quyển. Bỏ Santorini v2 (thay bằng cảnh khác theo R3), giữ Phú Quốc và Matterhorn sau khi làm lại lớn, vẽ lại các cảnh còn lại; Tromsø phải có cực quang động. Bộ cảnh có thể là 8 (vẽ lại/thay) — chốt trong 03-scene-set.md theo R3.
V2-6 Cổng chất lượng thẩm mỹ: không chỉ test hash. Mỗi cảnh qua duyệt contact sheet + ảnh app thật 2 theme × (/new, chat) + so sánh cạnh upstream; người duyệt (chủ sản phẩm) ký; có checklist chấm điểm 1–5 (bố cục/chiều sâu/màu/chi tiết/chuyển động), cảnh dưới 4 điểm không qua.
V2-7 Thumbnail popover = khung tĩnh render thật từ engine (không icon giữ chỗ).
V2-8 Kế hoạch triển khai chia worker rời file, thứ tự: P0 engine primitive (layer, curve/polygon, sprite sheet, particle, palette cycling, bảo vệ chữ) → song song: cảnh (mỗi worker ≤2 cảnh) ‖ UI compositing/ngày-đêm → ảnh app thật + duyệt → e2e/tài liệu. Nêu rõ nhóm worker gợi ý, file sở hữu, tiêu chí xong.
