# S1 — Spike engine

Ngày đo: 2026-11-13 · Windows 11 · Node v24.21.0 · HEAD gốc `8aadefd`. Chỉ Node 24 có sẵn. Corpus source production ở bốn workspace: 897 file; bộ vàng TS: 70 file, 1.071 cạnh.

## Bước 0: hiệu chỉnh bộ vàng

Checker esbuild ban đầu tìm 10 cặp thiếu. Đọc `packages/work/src/workflows/run.ts`: đó là 10 import nhiều dòng tới `run/{start,check-steps,messages,scheduling,manager-controls,dispatch,manager-state,agent-step,graph,queue}.ts`. Đã thêm cạnh `imports` và evidence cho từng cạnh. Kiểm lại: regex 214 cặp, esbuild 121, giao 121, bỏ sót 0; evidence hợp lệ 1.071/1.071. Giữ 93 cặp regex-only vì metafile loại nhiều import type-only/tree-shaken; esbuild không phải ground truth source-level.

Cross-check `typescript@5.9.3` `preProcessFile` trên 70 file: 1.077 imported/referenced entries thô, 90,99 ms, heap delta +4,63 MiB, không lỗi. Entries gồm external/reference nên chưa thể so như edges. Workspace TypeScript 7.0.2 không export `preProcessFile` (TypeError); do đó bản 5.9 là đối chứng riêng, không phải adapter khả dụng với dependency hiện tại.

## Bảng chấm theo §4.2

| Ứng viên | Windows / đóng gói | Khớp golden | Thời gian / RAM | Trễ event loop | Giấy phép | Kết luận |
|---|---|---|---|---|---|---|
| web-tree-sitter 0.27.2 + tree-sitter-wasms 0.1.13 | Package cài trên Windows Node 24; WASM Python không load do ABI mismatch | Chưa đo (parser không khởi tạo) | Chưa đo | Chưa đo | Runtime MIT; grammar bundle Unlicense, không đạt chính sách MIT/Apache/ISC | Không dùng bundle này; tìm grammar tương thích và có license phù hợp |
| oxc-parser 0.158.0 | Node 24 chạy; chưa pack @onni/work | Trên 70 file: 1.585 AST import/export nodes; chưa normalize thành precision/recall | 70 file: 262,05 ms, heap delta +36,88 MiB. 897 file: 1.103,9 ms, +90,5 MiB | 70 file, 1 lượt: no-yield build 37,82 ms, p50/p99/max 15,91/38,37/38,37 ms; yield/10 file build 36,54 ms, p50/p99/max 6,05/15,75/15,75 ms | MIT | Parse được corpus TS/TSX; tốc độ/heap cao hơn lexer, cần đo RSS và normalized edges |
| es-module-lexer 3.0.4 | `npm pack` + cài thư mục sạch và smoke runtime thành công; Node 24 | 70 file: 1.021 entries, 1 file lỗi cú pháp; 897 file: 3.140 entries, 264 file lỗi cú pháp TS/TSX | 70 file: 12,50 ms, +0,52 MiB; 897 file: 43,3 ms, +3,8 MiB | Chưa đo riêng | MIT | Nhanh, nhưng lỗi cú pháp trên corpus và không có Python/Go/outline |
| TypeScript `preProcessFile` 5.9.3 | Node 24 chạy; chưa pack @onni/work. TypeScript 7.0.2 workspace không có API này | 70 file: 1.077 entries thô; chưa precision/recall | 70 file: 90,99 ms, +4,63 MiB; 897 file: 5.936 entries, 334,2 ms, +20,9 MiB | Chưa đo riêng | Apache-2.0 (5.9.3) | Bắt import/type reference; API không tương thích TS7 hiện dùng, entries cần resolve/normalize |
| Regex (golden scripts) | Chạy Windows 11/Node 24; không có parser/toolchain phụ | 214 cặp source-level; esbuild giữ 121/121 sau hiệu chỉnh; 93 regex-only giữ lại | Thời gian/RAM full corpus chưa đo | Chưa đo riêng | Nội bộ, không thêm dependency | Baseline nhỏ nhất; import nhiều dòng đã cần hiệu chỉnh tay |

Thời gian parser là một lượt nóng; heap delta không phải RSS đỉnh. `es-module-lexer` không phù hợp nguyên corpus TS vì nhiều file lỗi cú pháp. Đo event-loop là smoke test Oxc trên 70 file, stream giả 10 ms; chỉ gợi ý yield theo lô giúp giảm block, chưa phải benchmark tải chạy thật.

## Đóng gói và môi trường

Đã `npm pack` es-module-lexer, cài tarball vào thư mục sạch và chạy smoke import thành công (`parse` nhận 1 import). Kích thước tarball/install chưa ghi. Chưa pack Oxc, TypeScript hay @onni/work. `web-tree-sitter` load grammar thử nghiệm thất bại do ABI; grammar có license Unlicense. `npx node@20/22 --version` không trả output trong 15 giây, đã dừng; chỉ Node 24.21.0 được xác nhận. Không sửa package.json/lockfile repo; candidate packages nằm ngoài repo dưới `%TEMP%\onni-graph-spike`.

## Khuyến nghị

Chưa chọn engine production. Không đưa grammar WASM đang thử vào vì ABI mismatch và Unlicense. Oxc là ứng viên phù hợp TS/TSX cần parse AST chính xác, nhưng cần đo normalized precision/recall và RSS/pack. `es-module-lexer` nhanh nhất nhưng không parse được một phần đáng kể corpus TS/TSX. Giữ tree-sitter là hướng breadth chỉ khi tìm được grammar có license hợp lệ và kiểm chứng được packaging Windows.

Đề xuất P1: build chia lô tối đa 10 file hoặc yield mỗi 25 ms (mốc tạm suy ra từ smoke test, phải xác nhận trên full build); đặt gate p99 ≤50 ms, max ≤100 ms dưới stream giả 10 ms. Trước khi chọn adapter, đo lặp/cold-warm Node 20/22/24, precision/recall từng kind trên golden, Python/Go fixtures, full repo + incremental, RSS đỉnh và isolated pack/install package cuối cùng.

## Tái lập

```powershell
node docs/design/project-graph/scripts/golden/check-golden.mjs
```

Checker không ghi bundle ra đĩa. Parser timings được đo bằng Node v24.21.0 trên `golden/files.json` và 897 source files; chưa phải benchmark cold/warm lặp. Candidate dependencies được cài ngoài repo.
