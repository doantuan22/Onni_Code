# S3 — Golden graph

Đo ngày **2026-11-13**, trên **Windows 11**, Node **v24.21.0**, tại HEAD trước khi tạo spike: `8aadefd` (`docs(graph): plan the stage 0 execution`). Đây là đếm trên bốn thư mục `src` của workspace, không phải số sau build.

## Quy mô repo

| Chỉ số | Số cũ (khảo sát 2026-11-06) | Đo lại 2026-11-13 |
| --- | ---: | ---: |
| File nguồn production | ~797 | 897 |
| Cạnh import nội bộ ước lượng | ~1.510 | 2.532 |

Đếm mới gồm `.ts`/`.tsx` dưới `packages/{work,contract,api-client,web}/src`, bỏ file test/spec, `dist`, `generated` và `node_modules`. Cạnh là import/export tương đối giải được bằng resolver đơn giản (`.js` → `.ts`, `index.ts`) cộng import `@onni/*`; đây là ước lượng regex theo dòng, không bao gồm import bên thứ ba. Khác biệt với số cũ là +100 file và +1.022 cạnh; phạm vi và cách đếm cũ chưa đủ chi tiết để giải thích phần tăng.

## Bộ vàng TS

`spikes/golden/files.json` có **70 file**, `edges.json` có **1.061 cạnh**: 621 `imports`, 201 `type-imports`, 45 `reexports`, 21 `dynamic-import`, 1 `unresolved`, 44 `package-dep`, 128 `ext`. Bộ chọn bao gồm `runs/store.ts` và **53 importer trực tiếp**, `packages/contract/src/index.ts` cùng consumer qua barrel, `export *`, `import type`, workspace package import, `packages/web/src/routes.tsx` (lazy routes), `packages/work/src/index.ts` (literal dynamic import) và `packages/work/src/server/terminal/pty-module.ts` (dynamic import không hằng). Chọn thêm các file production trong vùng runs/automation/dispatch/server/workflow, contract, api-client và web để có nhiều kiểu cạnh.

`packages/work/src/core/process-jobs.ts:99` gọi `spawn()` từ `node:child_process`. Cạnh module tới `node:child_process` được ghi là `ext`; hành vi sinh tiến trình là ghi chú riêng, không phải cạnh giữa hai file. Trong bốn source root không thấy file generated khớp bộ lọc tên; số generated trong corpus là **0**.

### Kiểm chéo và sai khác

Mỗi cạnh giữ `evidence` dạng `path:line`; `check-golden.mjs` xác nhận **1.061/1.061** vị trí bằng chứng trỏ tới câu lệnh import/export (kể cả câu lệnh nhiều dòng). Đối chứng độc lập esbuild `metafile` giữ 121 cặp file nội bộ sau bundle; 111 cặp trùng với 204 cặp source-level tương đối do regex phát hiện, regex bỏ sót 10 cặp esbuild giữ lại, và 93 cặp regex không còn trong metafile. Không diễn giải các cặp sau là false positive: esbuild loại import chỉ dùng ở type và import bị tree-shake, trong khi golden giữ quan hệ ở source. Vì vậy đây là số đối chiếu resolver, không phải độ chính xác extractor cuối cùng; S1 cần chấm riêng import runtime, type-only và re-export. Các sai khác cụ thể có thể tái lập bằng checker.

Các quyết định: cạnh dùng barrel được ghi từ file consumer tới module barrel mà consumer import; cạnh re-export vẫn được ghi riêng từ barrel tới module đích. Import động hằng đã resolve là `dynamic-import`; import động không hằng không bịa đích và được ghi `unresolved`. Bare workspace import là `package-dep`; module ngoài workspace là `ext` với tên package/module ở `to`.

## Fixture đa ngôn ngữ

`fixtures/python/` có 4 file nguồn; `fixtures/go/` có 3 file nguồn và `go.mod`. Mỗi thư mục có `expected-edges.json`. Expected edges minh họa import tương đối, package ngoài/package trong module và module không giải được. Chúng là fixture nhỏ để adapter breadth dùng lại; chưa chạy tree-sitter trên fixture trong S3.

## Tái lập

Từ root repo, sau `npm ci --ignore-scripts --no-audit --no-fund`:

```powershell
node docs/design/project-graph/scripts/golden/scale.mjs
node docs/design/project-graph/scripts/golden/build-golden.mjs
node docs/design/project-graph/scripts/golden/check-golden.mjs
```

`build-golden.mjs` chọn lại 70 file theo bộ quy tắc trong script và ghi đè `files.json`/`edges.json`. `check-golden.mjs` dùng esbuild `metafile` với `write:false`; không ghi bundle ra đĩa. Expected edges của Python/Go được viết tường minh để người đọc có thể đối chiếu với fixture.

## Hiệu chỉnh S1 (2026-11-13)

Kiểm tra esbuild ban đầu báo 10 cạnh thiếu; cả 10 là import tĩnh nhiều dòng của `packages/work/src/workflows/run.ts` tới module trong `workflows/run/`. Đã bổ sung cạnh `imports` tương ứng vào `golden/edges.json`, evidence trỏ tới dòng `from`. Kết quả sau sửa: 214 cặp regex, 121 cặp esbuild, giao 121, bỏ sót 0; 1.071/1.071 evidence hợp lệ. Các cặp regex-only không bị xóa vì bao gồm quan hệ source-level (đặc biệt type-only) mà esbuild bundle loại bỏ.

Chưa chạy `ts.preProcessFile`: worktree không có TypeScript cài đặt. Kiểm tra thủ công xác nhận 10 cạnh là import module thật. Cần bổ sung cross-check TypeScript trước khi chốt độ chính xác S1. Chi tiết chấm engine và giới hạn phép đo ở [`engine.md`](engine.md).

Cross-check b? sung S1: `typescript@5.9.3` `preProcessFile` ?? ch?y tr?n corpus 70 file (1.077 entries th?, g?m c? external/reference n?n ch?a ph?i metric edge). Workspace TypeScript 7.0.2 kh?ng export API n?y; xem `engine.md`.
