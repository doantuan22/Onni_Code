# G-A (thu hẹp) — agent có `onni graph` P1 so với không có (PLAN.md §9.1; quyết định G0)

Đo ngày 2026-11-13, Windows 11, Node v24.21.0, worker `codex` `gpt-6-luna` cho mọi lượt. Cùng 3 tác vụ, cùng commit gốc
và cùng order với V1 (`spikes/value.md`); cánh graph dùng **CLI sản phẩm P1** (`onni graph impact|tests`, bản dựng ở nhánh
quản lý, `ONNI_PROJECT_GRAPH=1`) thay cho prototype. Cánh `off` **tái dùng** số V1 (cùng gốc/order/model, chạy cùng ngày);
cánh `grep` có chủ đích chưa chạy. n = 3 × 1 seed: tín hiệu, không phải kết luận thống kê.

## Số đo

Token/lượt/thời gian từ `scripts/value/ab-metrics.mjs` (log sự kiện onni; đếm cả lệnh `onni graph` và các lần sửa bằng
shell). "Test lời giải" = file test của chính commit lời giải chạy trên code của cánh.

| Tác vụ | Cánh | Lượt công cụ | Lần gọi graph | Token (triệu) | Thời gian (s) | Test lời giải |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| T1 | off (V1) | 10 | 0 | 0,58 | 102 | 35/35 |
| T1 | prototype (V1) | 19 | 4 | 1,13 | 250 | 35/35 |
| T1 | **P1** | 15 | 2 | 0,89 | 188 | 35/35 |
| T2 | off (V1) | 30 | 0 | 3,08 | 520 | 2/2 |
| T2 | prototype (V1) | 20 | 3 | 1,29 | 369 | 1/2 |
| T2 | **P1** | 31 | 3 | 4,01 | 630 | 2/2 |
| T3 | off (V1) | 17 | 0 | 1,49 | 253 | 147/147 |
| T3 | prototype (V1) | 25 | 7 | 2,16 | 527 | 147/147 |
| T3 | **P1** | 20 | 2 | 2,06 | 370 | 147/147 |

Run id: P1 `855b9f08` (T1), `b2bf4be5` (T2), `9ec01db4` (T3); V1 xem `spikes/value.md`.

## Đọc kết quả

- **Pass:** P1 3/3, bằng cánh off; prototype 2/3.
- **Chi phí:** P1 tốn hơn cánh off ở **3/3** tác vụ (token ×1,55 / ×1,30 / ×1,39; thời gian ×1,8 / ×1,2 / ×1,5). P1 rẻ hơn
  prototype ở T1/T3 (ít lời gọi hơn — cờ `complete=true` theo câu hỏi nên agent không còn bị đẩy về grep mỗi lần).
- **Định vị:** như V1, mọi cánh sửa đúng file; graph không làm định vị nhanh hơn trên các tác vụ có triệu chứng rõ.
- **Dùng `graph tests`:** cả 3 worker P1 gọi `tests` sau khi sửa và chạy đúng các test mức high (T3: `new-task.test.tsx`
  + `workspace-host.test.tsx`). Mặt trái: T2 chạy thêm một ứng viên (`auto-resume.test.ts`) treo > 60 s — chọn test
  nhiều hơn cũng tốn thời gian.

## Kết luận G-A

**No-go cho phần "graph giúp agent" (H1).** Theo tiêu chí §9.1 ("định vị tăng, pass không tụt, chi phí không tăng quá
ngưỡng"): định vị không tăng, pass không tụt, chi phí **tăng** ở mọi tác vụ. Theo §9.1 và §0 quyết định 7: dừng ở CLI nhỏ
(`impact`/`tests`) và **không** tiêm graph vào prompt; P2 ("chỉ khi G-A không no-go") **không bắt đầu**.

Hạn chế: n nhỏ, một seed, một model, cánh off tái dùng, không có tác vụ manager–worker nhiều worker (nơi P2 được kỳ vọng
giúp nhiều nhất) và không có cánh grep có chủ đích. Mở lại P2 cần một G-A mới trên tác vụ nhiều worker.
