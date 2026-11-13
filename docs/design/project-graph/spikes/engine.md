# S1b — Spike engine (bản hoàn tất)

Ngày đo: 2026-11-13 · Windows 11 · Node v24.21.0 (chỉ Node 24 có sẵn) · HEAD `b126fb9` · corpus 897 file production (`packages/{work,contract,api-client,web}/src`, .ts/.tsx, không test/.d.ts) · bộ vàng `spikes/golden/edges.json`: 70 file, 1.071 cạnh (không sửa trong lượt này).
Thư viện cài NGOÀI repo (`.ai/onni/tmp/graph-spike`, chọn bằng `GRAPH_SPIKE_DIR`); không đụng `package.json`/lockfile của repo.

Phiên bản: `oxc-parser` 0.158.0 (MIT) · `es-module-lexer` 3.0.4 (MIT) + `esbuild` (strip type) · `typescript` 5.9.3 (Apache-2.0) · `web-tree-sitter` 0.27.2 (MIT) + `tree-sitter-typescript` 0.23.2 / `-javascript` 0.25.0 / `-python` 0.25.0 / `-go` 0.25.0 (đều MIT, có sẵn `.wasm` trong gói npm).

## 1. Cách chấm

- Mỗi ứng viên chỉ trả bản ghi THÔ `{spec, kind: import|type|reexport|dynamic, typePos?, nonLiteral?}`; MỘT bộ chuẩn hóa chung (`common.mjs: normalize`) + MỘT resolver (`.js→.ts/.tsx`, `index.*`, `@onni/*` → `package-dep`, bare → `ext`) tái tạo đúng luật của `build-golden.mjs`. Khác biệt giữa các cột vì thế đến từ engine, không phải từ resolver.
- So khớp theo tập `(from, to, kind)` (bỏ `evidence`/dòng). Precision = tp/(tp+fp), recall = tp/(tp+fn) theo kind.
- **Lưu ý về bộ vàng** (đọc kỹ trước khi so cột): bộ vàng do một regex theo dòng sinh ra rồi hiệu chỉnh tay, nên (a) cột `regex` được lợi vì cùng họ với nguồn sinh; (b) bộ vàng còn thiếu một số cạnh thật. Đã kiểm bằng `grep` trên `workflows/run.ts`: 5 `imports` + 3 `reexports` + 1 `type-imports` "fp" của Oxc/tree-sitter là import/re-export nhiều dòng có thật (`run/monitoring.ts`, `run/lifecycle.ts`, `run/settlement.ts`, `run/preparation.ts`, `../git-worktree.ts`…), `ext` `react-router` và `node:fs` cũng có thật ở `routes.tsx:11`, `store.ts:21`. Ngoài ra bộ vàng gán `@onni/*` nhiều dòng là kind `imports` (một dòng là `package-dep`) → 12 "fp" `package-dep` ở MỌI engine; cờ `--lenient-pkg` gộp kind này (bảng B). 4 cạnh `dynamic-import` mà AST bỏ lỡ là `import('./x.ts')` đứng trong kiểu (`Pick<import(...)>`): AST xếp đúng là `type-imports`, bộ vàng (heuristic `:`/`typeof`) xếp `dynamic-import`.
- Vì vậy các con số dưới là "khớp bộ vàng", KHÔNG phải độ chính xác tuyệt đối; chênh dưới ~1 điểm % giữa regex/Oxc/tree-sitter nằm trong nhiễu của bộ vàng.

## 2. Precision / recall theo kind — bảng A (nguyên bản bộ vàng)

Mỗi ô: precision / recall (tp, fp, fn).

| kind (số vàng) | regex | es-module-lexer (raw) | lexer + esbuild strip | Oxc | TS 5.9 `preProcessFile` | tree-sitter |
|---|---|---|---|---|---|---|
| imports (620) | 99,2 / 98,7 (612,5,8) | 99,2 / 94,8 (588,5,32) | 99,2 / 98,7 (612,5,8) | 99,2 / 98,7 (612,5,8) | 99,2 / 95,6 (593,5,27) | 99,2 / 98,7 (612,5,8) |
| type-imports (175) | 100 / 96,6 (169,0,6) | 100 / 97,1 (170,0,5) | **— / 0** (type bị esbuild xóa) | 99,4 / 100 (175,1,0) | 90,2 / 100 (175,19,0) | 99,4 / 100 (175,1,0) |
| reexports (44) | 100 / 100 | 100 / 100 | 100 / 95,5 (42,0,2) | 93,6 / 100 (44,3,0) | 100 / 100 | 100 / 100 |
| dynamic-import (21) | 70,0 / 100 (21,9,0) | 100 / 33,3 (7,0,14) | 100 / 81,0 (17,0,4) | 100 / 81,0 (17,0,4) | 100 / 100 (21,0,0) | 100 / 81,0 (17,0,4) |
| ext (127) | 98,4 / 100 | 99,2 / 99,2 | 98,4 / 97,6 | 98,4 / 100 | 98,4 / 100 | 98,4 / 100 |
| package-dep (32) | 72,7 / 100 | 72,7 / 100 | 68,6 / 75,0 | 72,7 / 100 | 72,7 / 100 | 72,7 / 100 |
| unresolved (1) | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | **— / 0** (không thấy `import(expr)`) | 100 / 100 |
| **ALL (1.020 khóa from/to/kind khác nhau; 1.071 dòng sau khi tính trùng evidence)** | 97,3 / 98,6 | 98,2 / 94,9 | 97,9 / 80,4 | 97,8 / 98,8 | 96,3 / 97,3 | 98,1 / 98,8 |
| file lỗi parse (70 file vàng) | 0 | 1 (`routes.tsx`) | 0 | 0 | 0 | 0 |

Bảng B — `--lenient-pkg` (mọi cạnh tới `@onni/*` gộp thành `package-dep`): ALL = regex 98,0 / 99,3 · lexer-raw 98,9 / 95,6 · lexer+strip 98,7 / 81,1 · **Oxc 98,4 / 99,5** · TS 97,0 / 97,9 · **tree-sitter 98,7 / 99,5**.

Ghi chú theo ứng viên:
- **regex** (`scripts/proto/lib.mjs`): `dynamic-import` precision 70% vì nhận cả `import('x')` nằm trong kiểu; heuristic comment/template tự viết, 0 file lỗi.
- **es-module-lexer 3.0.4**: không phân tích TSX (JSX) và một số cú pháp TS → trên 897 file **264 file lỗi cú pháp** (đúng 264/287 file `.tsx` — JSX; 0/610 file `.ts`; trong 70 file vàng chỉ `routes.tsx`, nhưng file đó chứa 40+ cạnh → recall dynamic-import 33%). API 3.x đã báo `typeOnly` cho `import type`. Tiền xử lý esbuild (`transformSync`, loader ts/tsx, `jsx:'transform'`, `verbatimModuleSyntax`) đưa lỗi về 0 nhưng: **mọi `type-imports` biến mất** (esbuild xóa), mất thêm `ext`/`package-dep` chỉ-dùng-làm-kiểu (recall 75% ở package-dep), và tốn ~1,8–2,7 s/897 file.
- **Oxc**: `module.staticImports/staticExports/dynamicImports` đủ cho import/re-export; **`import('x')` đứng ở vị trí kiểu (`TSImportType`) KHÔNG nằm trong `module.dynamicImports`** — cần đi AST (`Visitor`) mới ra, nên bản "module only" có type-imports recall 96,6% (chưa walk) → 100% khi walk. Chỉ walk khi `src.includes('import(')` để rẻ. `import x = require()` không được báo (bộ vàng cũng không có).
- **TS `preProcessFile` 5.9.3**: chỉ trả `{fileName,pos,end}`, không có kind → loại cạnh phải suy từ văn bản trước `pos` (heuristic; nguồn của 19 fp type-imports). Không thấy import động không-literal. **Không dùng được với TypeScript 7.0.2 của repo** (không export `preProcessFile`) — chỉ là đối chứng, loại khỏi lựa chọn.
- **tree-sitter**: chạy được với grammar CHÍNH THỨC (xem §4), AST đầy đủ, 0 file lỗi.

## 3. Thời gian / RSS / cập nhật 1 file (897 file, đọc file ~0,56–0,70 s KHÔNG tính)

Mỗi ứng viên chạy trong tiến trình con riêng, 4 lượt liên tiếp; `RSS base` = sau khi nạp thư viện + toàn bộ source vào RAM; `RSS peak` = `process.memoryUsage().rss` lấy mẫu mỗi 5 ms / `process.resourceUsage().maxRSS`. "Incr." = trích xuất lại `workflows/run.ts` (173 KB), trung vị/max của 30 lần.

| ứng viên | lượt 1 (lạnh) ms | lượt 2..4 ms | RSS base MiB | RSS peak MiB | incr. run.ts ms |
|---|---|---|---|---|---|
| regex | 240 | 176 / 161 / 164 | 80,8 | 246 / 257 | 3,5 / 7,9 |
| es-module-lexer raw (264 file lỗi) | 59 | 44 / 52 / 44 | 80,5 | 107 / 108 | 0,7 / 1,6 |
| lexer + esbuild strip | 1.805 | 2.112 / 2.663 / 2.733 | 80,9 | 275 / 328 | 20,6 / 23,4 |
| Oxc (module only, không walk) | 302 | 277 / 319 / 306 | 83,0 | **684 / 737** | 4,1 / 5,5 |
| Oxc + walk `TSImportType` | 430 | 382 / 352 / 332 | 82,9 | **714 / 835** | 16,2 / 38,0 |
| **Oxc + walk + `experimentalRawTransfer`** | 472 | 252 / 247 / 248 | 83,2 | **420 / 477** | 2,9 / 28,7 |
| TS 5.9 `preProcessFile` | 309 | 172 / 161 / 137 | 102,1 | 164 / 165 | 3,2 / 4,3 |
| tree-sitter (TS/TSX) | 2.072 | 3.742 / 3.918 / 3.973 | 97,8 | 123 / 139 | 63,9 / 73,6 |

Phát hiện quan trọng — **Oxc giữ bộ nhớ native ngoài heap JS**: parse lặp lại một file 170 KB, RSS tăng ~1,9 MiB mỗi lượt (40 → 794 MiB sau 400 lượt) dù heap JS chỉ ~10 MiB và `global.gc()` không giải phóng; chạy 1.829 file của repo (cả test) lên 368 MiB. `experimentalRawTransfer: true` làm RSS đi ngang (≈270 MiB sau 100 lượt, 280 MiB sau 300) và nhanh hơn (≈250 ms vs ≈350 ms/897 file), đúng kết quả y hệt (đã chấm lại: 97,8/98,8). `experimentalLazy` lỗi `Array buffer allocation failed` ở lần thử. Raw transfer là cờ "experimental" của thư viện → cần ghim phiên bản + test. tree-sitter chạy chậm dần từ lượt 2 (2,1 s → ~3,9 s; chưa tìm nguyên nhân, nghi tăng bộ nhớ WASM) nhưng RSS thấp nhất.
Chưa kiểm: Node 20/22 (chỉ có Node 24; `npx node@20` treo, đã dừng), macOS/Linux, chạy lặp lâu hơn 4 lượt.

## 4. tree-sitter — grammar chính thức

`web-tree-sitter` 0.27.2 nạp thành công cả 5 `.wasm` chính thức đi kèm gói npm, không lỗi ABI: `tree-sitter-typescript` 0.23.2 (typescript + tsx, **ABI 14**), `tree-sitter-javascript` 0.25.0, `-python` 0.25.0, `-go` 0.25.0 (**ABI 15**) — runtime 0.27.2 đọc được cả hai. (Lượt S1 trước lỗi vì dùng gói `tree-sitter-wasms` 0.1.13, nay bỏ.) Giấy phép runtime + 4 grammar: MIT.
- TS: bảng trên (98,1/98,8). Grammar TS 0.23.2 phân tích `import('x')` trong kiểu thành `call_expression` thường; phân biệt vị trí kiểu bằng tổ tiên (`type_annotation`, `type_alias_declaration`, `type_arguments`…).
- Fixture `spikes/golden/fixtures/python`: 5 cạnh kỳ vọng, **5/5 (P 100%, R 100%)**; `fixtures/go`: 4 cạnh kỳ vọng, **4/4 (P 100%, R 100%)**. Resolver Python/Go là bản tối giản của spike (`treesitter.mjs`): Python `from .x`/`from x`, Go theo `go.mod`; chỉ 2 fixture rất nhỏ → chưa chứng minh được độ phủ cú pháp thật (alias, `__init__`, vendor, build tags… chưa kiểm).
- Nhược điểm: chậm (≈2–4 s/897 file TS, incr. 64 ms), và **đóng gói**: cài `web-tree-sitter` + 4 grammar = **66 MB** `node_modules` (277 file prebuilds/node-gyp cho mọi nền tảng, `node-gyp-build` có install script; npm hiện cảnh báo "install-scripts") trong khi thứ dùng thật chỉ là ~3,5 MB `.wasm`. Muốn dùng phải vendor riêng các `.wasm` (≈ 0,2+0,4+0,5+1,4+1,4 MB + runtime 0,2 MB).

## 5. Đóng gói (`npm pack` gói nháp phụ thuộc ứng viên → cài thư mục sạch → chạy)

| | tarball gói nháp | cài sạch `node_modules` | native theo nền tảng | chạy |
|---|---|---|---|---|
| Oxc (`oxc-parser` 0.158.0) | vài KB (chỉ khai báo dependency) | **4,6 MB** (`oxc-parser` 2,9 MB + binding win32-x64 1,7 MB) | **Có**: `@oxc-parser/binding-<platform>` là `optionalDependencies` (win32/darwin/linux gnu+musl/freebsd/android… ), `engines.node` = `^20.19.0 \|\| >=22.12.0` | `parseSync(..., {experimentalRawTransfer:true})` chạy, trả 1 import |
| es-module-lexer 3.0.4 | — | 0,27 MB | không (JS + WASM nhúng) | chạy |
| tree-sitter (5 gói) | vài KB | 66 MB (xem §4) | prebuilds + install script | đã chạy `.wasm` ở thư mục spike |
| TypeScript 5.9.3 | — | 23 MB | không | — (không dùng với TS 7) |
| regex (`proto/lib.mjs`) | 0 | 0 | không | chạy |

Rủi ro cho tarball `@onni/work` (engine `node >=20`): (1) Oxc cần Node ≥ 20.19 — máy Node 20.0–20.18 sẽ không nạp được; (2) binding native phụ thuộc nền tảng, cài qua optionalDependencies của npm (cài bằng `--no-optional`/nền tảng lạ → thiếu binding); (3) `onni link`/desktop không đóng gói sẵn binding → phải kiểm tra lúc chạy. Cả ba phải dẫn tới "rơi xuống regex", không được làm hỏng khởi động (AGENTS.md: thiếu dependency → cockpit nhỏ hơn, không fail boot). Chưa kiểm: cài trên macOS/Linux, `npm install` ở máy offline.

## 6. Trễ event loop (stream giả `setInterval` 10 ms ghi NDJSON, dựng 897 file một lượt)

Chỉ số đáng tin là **khoảng cách tick tệ nhất của stream** (stream bị trễ bao lâu). Histogram `monitorEventLoopDelay` bị 0 khi không chia lô (không có mẫu nào trong lúc chặn) nên bỏ cột đó cho dòng "none"; resolution 10 ms nên p50 ≈ 10 ms gồm cả chu kỳ timer.

| ứng viên | chia lô | build ms | loop delay p50/p99/max ms | tick stream tệ nhất ms |
|---|---|---|---|---|
| regex | không | 164 | — | **164** |
| regex | 10 | 185 | 10,8 / 14,2 / 14,2 | 14,1 |
| regex | 50 | 194 | 12,5 / 26,7 / 26,7 | 26,6 |
| es-module-lexer raw | không / 10 / 50 | 45 / 48 / 50 | — / 10,5 / 13,9 | 45 / 10,5 / 13,9 |
| Oxc raw | không | 356 | — | **356** |
| Oxc raw | 10 | 279 | 11,2 / 35,0 / 35,0 | 34,9 |
| Oxc raw | 50 | 425 | 20,9 / 44,6 / 44,6 | 44,6 |
| TS `preProcessFile` | không / 10 / 50 | 368 / 321 / 299 | — / 20,7 / 43,4 | 368 / 20,7 / 43,3 |
| tree-sitter | không | 3.678 | — | **3.678** |
| tree-sitter | 10 | 3.811 | 38,5 / 125 / 157,8 | 157,7 |
| tree-sitter | 50 | 3.860 | 206,6 / 449,3 / 449,3 | 449,3 |

Một lượt đo mỗi ô (sau 1 lượt khởi động), một máy; số này là gợi ý, không phải phân phối. Kết luận: không chia lô thì stream đứng đúng bằng thời gian build; chia lô 10 giữ tick tệ nhất ≤ 35 ms với regex/lexer/Oxc/TS; tree-sitter không đạt ngay cả khi lô 10 (158 ms) → nếu dùng phải lô 1–2 file hoặc đẩy sang worker.

## 7. Khuyến nghị

**Engine mặc định P1: Oxc (`oxc-parser`, `experimentalRawTransfer`, `module` + walk `TSImportType` có điều kiện) làm adapter trích xuất cạnh TS/JS, với regex hiện có (`proto/lib.mjs`) làm adapter dự phòng bắt buộc**, cùng một interface `extract(file, src) → raw[]` và cùng bộ chuẩn hóa/resolver như trong `common.mjs`.
Lý do: Oxc đúng cấu trúc (không bị comment/chuỗi/template đánh lừa, phân biệt `import type`/vị trí kiểu, 0 file lỗi trên 897 file), khớp bộ vàng 98,8% recall / 97,8% precision (99,5 / 98,4 sau khi gộp kind `@onni/*`; phần "fp" còn lại là cạnh thật bộ vàng thiếu), nhanh (~250 ms/897 file, incr. ~3 ms trung vị), bộ nhớ có trần khi bật raw transfer, MIT. Regex gần như ngang độ chính xác trên bộ vàng (nhưng bộ vàng sinh từ regex) và rẻ nhất về phụ thuộc; giữ làm đường lui cho: Node < 20.19, thiếu binding nền tảng, lỗi nạp native, hoặc file Oxc báo lỗi cú pháp.
- **Không chọn**: es-module-lexer (264/897 file lỗi vì TSX; strip bằng esbuild mất toàn bộ `type-imports` và chậm 2 s); TS `preProcessFile` (không chạy với TS 7, kind phải đoán); tree-sitter làm engine TS (chậm 8–15×, trễ loop, 66 MB cài đặt).
- **tree-sitter = adapter breadth cho P2+** (Python/Go đạt 100% trên 2 fixture); vendor `.wasm` thay vì cài nguyên gói; chạy theo lô nhỏ/worker. Cần thêm fixture thật trước khi cam kết.

Tiêu chí chấp nhận đề xuất cho P1 (đo lại bằng chính `bench.mjs`/`eventloop.mjs` trên repo này, Node 20 + 22 + 24, Windows + Linux/macOS):
1. Chia lô **10 file** + `await setImmediate`; khoảng trễ stream tệ nhất ≤ **50 ms** (đo: Oxc 35 ms, regex 14 ms), p99 loop delay ≤ 50 ms.
2. Dựng đầy đủ 897 file ≤ **1 s** (Oxc ≈ 0,3–0,5 s); cập nhật một file ≤ **50 ms** (đo: Oxc 3–29 ms).
3. RSS tăng thêm do engine ≤ **400 MiB** ở đỉnh (đo: Oxc raw ≈ 340 MiB trên nền 83 MiB; không có raw transfer ≈ 630 MiB — KHÔNG đạt) và RSS không tăng tuyến tính khi parse lặp (test 300 lượt như §3).
4. Độ chính xác: ≥ 98% recall và ≥ 97% precision trên `edges.json` (đã tính theo kind), và bộ cạnh "fp" được duyệt tay hoặc bổ sung vào bộ vàng ở lượt riêng.
5. Mất Oxc (Node cũ, thiếu binding, lỗi nạp) → tự rơi về regex, ghi một dòng cảnh báo, không fail boot; có test cho đường lui.
Cần xem lại: nếu bộ nhớ của Oxc ở máy người dùng là vấn đề, chạy trích xuất trong `worker_threads`/tiến trình con (chưa đo).

## 8. Tái lập

Cần `npm i es-module-lexer esbuild oxc-parser typescript@5.9.3 web-tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python tree-sitter-go` trong một thư mục ngoài repo, rồi:

```bash
export GRAPH_SPIKE_DIR=<thư mục đó>          # mặc định: %TEMP%/onni-graph-spike
E=docs/design/project-graph/scripts/engine
node $E/score.mjs                            # bảng A; thêm --lenient-pkg cho bảng B, --only oxc,regex, --diff <id>
node $E/fixtures.mjs                         # tree-sitter Python/Go + phiên bản/ABI
node $E/bench.mjs --runs 4                   # thời gian, RSS đỉnh, cập nhật 1 file (mỗi ứng viên một tiến trình)
node $E/eventloop.mjs                        # trễ event loop, lô none/10/50
```

`common.mjs` chứa corpus, resolver, bộ chuẩn hóa, các extractor và hàm chấm; `treesitter.mjs` chứa adapter tree-sitter + extractor Python/Go. Số đóng gói (§5): `npm pack` gói nháp có `dependencies` đúng phiên bản trên → `npm i <tgz>` trong thư mục sạch → `du -sk node_modules`.
