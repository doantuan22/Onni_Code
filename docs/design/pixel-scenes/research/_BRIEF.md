# Bối cảnh chung cho mọi worker (tiếng Việt, viết tài liệu bằng tiếng Việt)

Dự án OnniCode có tính năng "cảnh nền pixel" (docs/design/pixel-scenes/, đọc 00-decisions.md và README.md trước; code ở packages/web/src/lib/scenery/ gồm engine/ và scenes/vn, scenes/world; UI ở packages/web/src/components/scene-*.tsx; CSS ở packages/web/src/styles/index.css).
Cảm hứng ban đầu: repo https://github.com/Aqua2409z/pixel-chat-themes (MIT; chỉ học kỹ thuật, không chép mã/tài sản).

## Phản hồi của chủ sản phẩm (lý do làm lại kế hoạch)
Bản v1 đã nghiệm thu kỹ thuật nhưng KHÔNG đạt kỳ vọng thẩm mỹ:
- Cảnh chưa đủ đẹp, khối phẳng, thiếu chiều sâu, hiệu ứng nghèo/không đáng kể, kém xa repo gốc cảm hứng.
- Chưa có hướng xử lý rõ ràng cho 2 chế độ nền SÁNG và TỐI (hiện ở 70% độ hiện cảnh vẫn rất mờ, nhất là sáng).
Ảnh minh chứng hiện trạng: docs/design/pixel-scenes/evidence/ui/*.png (app thật) và evidence/contact-sheets/*.png. Hãy xem ảnh bằng công cụ đọc ảnh nếu có.

## Quy tắc
- Chỉ sửa/ghi file được giao trong --scope. KHÔNG sửa mã nguồn packages/. KHÔNG chạy npm test/build/full suite, không npm install. Không git push. Không commit nếu không cần (onni tự lưu).
- Nghiên cứu web: dẫn URL nguồn cụ thể, ghi rõ điều nào là sự thật đã đọc, điều nào là suy luận. Không bịa số liệu.
- Kết quả phải CỤ THỂ, hành động được: nêu tên kỹ thuật, tham số, ví dụ, ưu/nhược, chi phí hiệu năng. Tránh chung chung.
- Cuối cùng báo cáo bằng `onni task report` (status, result 3-6 dòng, evidence = đường dẫn file đã viết).
