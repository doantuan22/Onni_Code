## 3. Bộ cảnh v1 (tiêu chí: đẹp, nhận ra ngay, đa dạng kỹ thuật)

| # | Cảnh | Nhóm | Điểm nhấn / kỹ thuật chính | Thời điểm mặc định |
| --- | --- | --- | --- | --- |
| V1 | Vịnh Hạ Long | VN | Tháp karst nhiều lớp + sương, nước phản chiếu, thuyền buồm nâu nhấp nhô | bình minh |
| V2 | Mù Cang Chải mùa lúa chín | VN | Ruộng bậc thang lượng tử hoá, viền sáng, ánh nắng chéo, chim | hoàng hôn |
| V3 | Fansipan biển mây | VN | Đỉnh núi + biển mây fbm nhiều lớp trôi, mặt trời lên | bình minh |
| V4 | Phú Quốc hoàng hôn | VN | Mặt trời lặn + đường nước lấp lánh (palette cycling), dừa silhouette, thuyền | hoàng hôn |
| W1 | Cực quang Tromsø (Na Uy) | Thế giới | Rèm cực quang + sao + fjord phản chiếu | đêm |
| W2 | Santorini hoàng hôn | Thế giới | Nhà trắng mái vòm xanh (sprite), vách đá, biển Aegean | hoàng hôn |
| W3 | Alps – Matterhorn bình minh | Thế giới | Đỉnh tuyết rim-light, hồ phản chiếu, thông | bình minh |
| W4 | Sa mạc Sahara chiều tà | Thế giới | Cồn cát đổ bóng bằng độ dốc, gió cuốn cát (hạt), lạc đà silhouette | hoàng hôn |

Dự phòng cho v1.1: Serengeti (cây keo), Monument Valley, Maldives, Đà Lạt sương. Khung hợp đồng cho phép thêm cảnh mà **không đụng contract hay UI** (chỉ đăng ký vào registry).

Quy trình làm một cảnh (checklist nghệ thuật, áp cho từng cảnh):
1. Chọn 1 ảnh tham chiếu mô tả bằng lời (bố cục, 3 màu chủ đạo, nguồn sáng) ghi vào đầu file cảnh.
2. Dựng palette 4 thời điểm trước khi viết mã; kiểm tra tương phản bằng test "trần độ hiện".
3. Viết `build` theo thứ tự xa→gần; xem PNG ở 3 cỡ (`320×180`, `480×270`, `240×300` cho cột hẹp) và 4 thời điểm.
4. Thêm đúng ≤ 2 chuyển động + palette cycling; kiểm tra khung hình đầu tiên khi `reduced-motion` vẫn đẹp.
5. Ghi hash golden của khung `t=0`; duyệt chéo bằng contact sheet.

---

---
[← Mục lục](README.md)
