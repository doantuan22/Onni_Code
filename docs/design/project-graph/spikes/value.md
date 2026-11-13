# V1 — Giá trị: A/B nhỏ graph-off vs graph-on (Giai đoạn 0, PLAN.md §9.1, §10 hàng V1)

Đo ngày 2026-11-13, Windows 11, Node v24.21.0. Prototype: `scripts/proto/graph-proto.mjs` (V1a, bản đóng băng lúc dispatch).
Đây là **tín hiệu, không phải kết luận**: n = 3 tác vụ × 2 cánh × 1 seed, một model. Cánh `grep` đối chứng (G-A đầy đủ)
chưa chạy.

## Thiết kế

- 3 tác vụ thật từ lịch sử repo (đề xuất trong `scripts/proto/README.md`): T1 `57b05bb` (ngân sách USD vừa khít,
  `dispatch/engine.ts`), T2 `6909d3d` (timeout check của landing, `workflows/landing.ts`), T3 `8228219` (route workspace
  sau khi đặt lịch, `routes/new-task-surface.tsx`). Mỗi cánh `git reset --hard <commit cha>` + `npm ci`, cùng order viết lại
  không lộ lời giải, cấm tra lịch sử khác.
- Worker: `codex` `gpt-6-luna` cho cả 6 lượt. Cánh graph-on thêm đoạn hướng dẫn ≤ 6 dòng (`context`/`impact`/`tests`,
  đường lui grep). Thứ tự off/on đảo giữa tác vụ (T1 off trước, T2 on trước, T3 off trước).
- Đo: `scripts/value/ab-metrics.mjs` đọc log sự kiện onni của run (`.ai/onni/runs/<id>.ndjson`) — lượt công cụ sau bước
  setup, lượt trước lần sửa đầu tiên, token cộng dồn, thời gian tường sau setup. **Chấm pass khách quan**: chạy file test
  của chính commit lời giải trên code của từng cánh (`npm test -- <bản sao test lời giải>`).

## Kết quả

| Tác vụ | Cánh | Lượt công cụ | Lượt trước sửa đầu | Lần gọi graph | Token (triệu) | Thời gian (s) | Test lời giải | File sửa |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| T1 | off | 10 | 3 | 0 | 0,58 | 102 | 35/35 pass | engine.ts + test |
| T1 | on | 19 | 4 | 7 | 1,13 | 250 | 35/35 pass | engine.ts + test |
| T2 | off | 30 | 6 | 0 | 3,08 | 520 | 2/2 pass | landing.ts + test |
| T2 | on | 20 | 4 | 3 | 1,29 | 369 | **1/2 — fail** (kết quả timeout không mang chữ "timed out") | landing.ts + test |
| T3 | off | 17 | 5 | 0 | 1,49 | 253 | 147/147 pass | surface + workspace-host + test |
| T3 | on | 25 | 8 | 15 | 2,16 | 527 | 147/147 pass | surface + workspace-host + 2 test |

(Lần gọi graph: theo báo cáo của worker; script đếm theo lệnh shell nên có thể thấp hơn khi một lệnh gộp nhiều lần gọi.)

## Đọc kết quả

- **Định vị:** cả 6 lượt đều sửa đúng file đáp án; lượt trước lần sửa đầu tương đương (off 3/6/5, on 4/4/8). Với tác vụ có
  triệu chứng rõ, grep đã đủ để định vị — graph không thêm gì đo được ở đây.
- **Chi phí:** graph-on tốn **hơn** ở 2/3 tác vụ (T1 ×1,9 token, ×2,5 thời gian; T3 ×1,45 token, ×2,1 thời gian), rẻ hơn ở T2
  (×0,42 token) — nhưng T2-on là cánh **fail** test lời giải. Khớp với RepoGraph: graph làm tăng token, không tiết kiệm.
- **Pass:** off 3/3, on 2/3. Một fail không đủ để quy cho graph (n nhỏ, nhiễu seed), nhưng tiêu chí tối thiểu do V1a đề xuất
  ("on không tệ hơn ở pass và giảm lượt/token ở ≥ 2/3 tác vụ") **không đạt**.
- **Ma sát của prototype:** mọi kết quả trả `complete=false` vì 3 import không giải được ở toàn repo, nên worker luôn quay về
  grep (T1-on, T2-on ghi rõ). Cờ `complete` phải tính theo **phạm vi câu hỏi**, không theo toàn repo — sửa bắt buộc nếu làm P1.
- **Phần graph có ích theo lời worker:** `tests <file>` chọn đúng test liền kề (T3-on), `impact` cho bản đồ caller của file
  web. Đây cũng là phần R1 đo được giá trị (`spikes/replay.md`: ứng viên test recall 89,6% với ~5,6% số test).

## Kết luận V1 (đề xuất cho G0)

1. **H1 (agent định vị nhanh/rẻ hơn) không có tín hiệu ủng hộ** trên 3 tác vụ một-file: graph-on tốn hơn, không định vị tốt hơn.
   Theo PLAN §0 quyết định 7, phần "tiêm graph vào luồng agent" (D7, M2) **không nên làm** trừ khi G-A đầy đủ cho kết quả khác.
2. **Giá trị còn lại là hành động số 2 (ứng viên test)**: R1 cho thấy chọn test có recall cao với tập nhỏ, nhưng bỏ sót ở 19%
   commit → chỉ dùng ở chế độ gợi ý "chạy trước". Nếu làm P1, nên **thu hẹp P1** về `graph tests` + `graph impact` (CLI, chỉ đọc)
   và đo lại trên tác vụ nhiều file / manager–worker (chưa có trong mẫu này — đó là chỗ graph được kỳ vọng giúp nhiều nhất).
3. Hạn chế: n=3, 1 seed, 1 model, không cánh `grep` có chủ đích, không tác vụ manager–worker nhiều worker, prototype regex
   chưa sửa cờ `complete`.

## Tái lập

```bash
node docs/design/project-graph/scripts/value/ab-metrics.mjs "<repo>/.ai/onni/runs" dda83fbd 619a78de b4277938 dd3abeb8 950e417f ff5bef01
# chấm: trong worktree của cánh, `git show <commit lời giải>:<file test>` ra một file tạm cạnh đó rồi `npm test -- <file tạm>`
```
Run id: T1 off `dda83fbd` / on `619a78de`; T2 off `b4277938` / on `dd3abeb8`; T3 off `950e417f` / on `ff5bef01`.
Nhánh của các cánh **không merge** (chỉ để đo).
