# V1a — prototype CLI `impact` / `tests` / `context` (Giai đoạn 0)

Prototype NGOÀI `src/`, Node ESM thuần, không dependency mới, không đụng `packages/**`. Mục đích: (a) cho A/B
nhỏ graph-off vs graph-on (mục cuối), (b) `lib.mjs` để R1/S5 import lại. Không phải engine sản phẩm: lexer regex,
không AST, không cache bắt buộc (mỗi lần chạy dựng lại từ đầu, ~2,5 s).

Đo ngày 2026-11-13, HEAD `8aadefd`, Windows 11 + Git Bash, Node v24.21.0, Vitest 4.1.10 (`npm ci` đã chạy trong worktree).

## Cách dùng

```bash
P=docs/design/project-graph/scripts/proto/graph-proto.mjs
node $P impact packages/work/src/runs/store.ts                 # text; nhiều file: liệt kê cách nhau dấu cách
node $P impact --diff main --format json --max-tokens 2000     # file đổi so với ref (git diff -M, gồm cả working tree)
node $P impact packages/work/src/runs/store.ts --expand packages/work/src/dispatch   # mở một nhóm của hub
node $P tests  packages/work/src/server/git-changes.ts         # chỉ L3
node $P tests  --diff HEAD~30 --runner                         # + `vitest list --filesOnly --changed HEAD~30` (KHÔNG chạy test)
node $P tests  <file…> --runner-exec                           # + `vitest related --run` (CHẠY test thật; chỉ khi cần)
node $P context --scope packages/work/src/dispatch --max-tokens 3000
node --test docs/design/project-graph/scripts/proto/lib.test.mjs   # 9 test, xanh
```

Tham số: `--hub-percent 95 --hub-min 15` (hub = in-degree ≥ max(p95 trên mọi file có dependent, 15); ở repo này = 19),
`--git-window 500 --min-support 3 --min-confidence 0.3 --max-commit-files 30 --no-cochange`, `--root <dir>`.

Hành vi chính (khớp PLAN §3.1, §3.2, §4.4, §4.5, §4.7):

- File liệt kê bằng `git ls-files`; denylist (`.env*` trừ `.env.example`, `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `.npmrc`,
  `node_modules`, `dist`) bị loại ngay ở `listFiles` nên không bao giờ được đọc (có test). Trần 512.000 byte/file → đếm vào
  `coverage.unparsedFiles`.
- Import: static, `import type`, `export … from`, `import 'x'`, `import('x')` hằng, `require('x')`, `vi.mock('x')`; dynamic
  không hằng → `unresolvedDynamicImports`. Resolve `.js→.ts/.tsx`, `index.*`, workspace `@onni/*` (qua `exports`, `dist/x.js`
  ánh xạ về `src/x.ts`), alias `@/` của web, hậu tố `?raw`. Bare package → `ext` (không thành node file).
- Lớp: L0 đổi; L1 dependents trực tiếp (hub → "N file ở M thư mục" + 3 đại diện/nhóm, `--expand <thư mục>`); L2 package; L3 test
  (import trực tiếp, test cùng tên `foo.test.ts`, sibling test của dependent, 2 hop không qua hub, + runner); LX co-change.
  Mỗi dòng có `provenance`, `confidence`, lý do, `via`. Test import một **hub** chỉ được `medium` (importer của hub phần lớn
  là dùng ngẫu nhiên).
- Đầu ra luôn có `head`, `builtAt`, `build{ms,listMs,readMs,parseMs,files,edges}`, `complete`, `truncated`, `omitted`, `coverage`.
  `--max-tokens N` (4 ký tự/token) cắt theo ưu tiên L0 > L2 > L1 > L3 > LX và ghi `omitted` + dòng "CẮT: …"; tóm tắt hub luôn
  được giữ. Text rút gọn L3 còn 30 dòng đầu và nói rõ "+N test nữa"; JSON luôn đủ.
- `complete=false` khi còn import không giải được / file không parse / file đổi không có trong đồ thị. Trên repo này luôn
  `false` vì 3 import không giải được (xem dưới) — đúng ý "đừng im lặng": agent được nhắc dùng grep/đọc source.

## Số đo (repo này, HEAD `8aadefd`)

| Mục | Số đo |
| --- | --- |
| File tracked / file code (node) | 2.388 / 1.874 (+3 file mới của prototype) |
| Cạnh file→file | 7.619 (nội bộ), 70 gói `ext`, 914 file có ≥1 dependent |
| Import không giải được | 3 (`./boot` trong `unified-diff.test.ts`, 2 script `../dist/*.js` chưa build); dynamic import không hằng: 3 |
| Dựng nguội (4 lần chạy) | 2,44 / 2,53 / 2,63 / 3,04 s; tách: list 0,13 s, đọc 1,35 s, parse+resolve 0,95 s |
| Bản đọc tuần tự (`readFileSync`) trước đó | 22–32 s trên cùng máy lúc có worker khác chạy → chuyển sang đọc song song 64 file/lô (đọc tuần tự là cổ chai trên Windows có AV, không phải parse) |
| RAM đỉnh, tăng dần theo 1 file | chưa đo (prototype dựng lại toàn bộ mỗi lần) |

Ví dụ `impact packages/work/src/runs/store.ts` (hub, 249 dependents):

| Cách | Kích thước tập kết quả | Kích thước đầu ra |
| --- | --- | --- |
| Không nhóm (`--hub-min 100000`, không co-change) | 249 file dependents | text 43.444 ký tự (~10,9k token); JSON 112.775 ký tự |
| Nhóm hub (mặc định) | 17 nhóm thư mục (lớn nhất `server` 96, `workflows` 66) | text 5.864 ký tự (~1,5k token), kèm 30 test đầu + 3 gợi ý co-change |
| `--max-tokens 800` | như trên | 2.345 ký tự, `truncated=true`, "CẮT: L3 -194, LX -3" |

Lưu ý: PLAN §2.1 ghi `store.ts` ~62 dependents; prototype đếm 249 (gồm 194 test import trực tiếp/`vi.mock`) và **55 file không
phải test**. Con số 62 trong PLAN không tái lập được bằng định nghĩa nào ở đây — cần S5 chốt định nghĩa "dependent".
Với file lá (`server/git-changes.ts`): 9 dependents, không hub, L3 = 2 high + 3 medium. Với `dispatch/engine.ts`: 19 dependents (hub nhẹ),
LX gợi ý `workflows/run.ts` conf 0,86, `contract/src/dispatch.ts` 0,57.

Co-change trên `store.ts` (cửa sổ 465 commit không-merge, 303 dùng được sau lọc): `server/server.ts` 8/14 (0,57),
`contract/src/runs.ts` 6/14 (0,43), `workflows/run.ts` 6/14 (0,43), kèm commit mẫu. Chưa có time-decay (ghi sẵn `lastCommit`).

**Runner (`--runner`)**: Vitest 4.1.10 có `vitest list --filesOnly --changed <ref>` — liệt kê test bị ảnh hưởng mà **không chạy**
(~17–80 s tùy tải, khởi tạo toàn bộ projects), nhưng nó chỉ nhận `--changed <ref>`, không nhận danh sách file; cho danh sách
file phải dùng `vitest related --run` (chạy test thật, nên chỉ qua `--runner-exec`). So với `--diff HEAD~30` (136 file đổi):
graph 656 ứng viên, runner 631; **runner ⊂ graph** (631 chung, runner-only 0, graph-only 25 do sibling/2-hop), và cả 53
ứng viên `high` của graph đều nằm trong runner. Chỉ 1 phép đo, chưa nói gì về recall so với failure thật (đó là việc của R1).

## Giới hạn đã biết

Lexer regex: regex literal chứa `//`/quote có thể làm mất cạnh (không bao giờ thêm cạnh sai); template literal bị bỏ qua (import
trong chuỗi code mẫu không tính). Barrel `index.ts` có `reexports` nhưng chưa thu gọn đường qua barrel (§4.4.5); chưa có cạnh
`exports-used` (§4.4.3), PageRank cá nhân hóa (§4.4.4), alias `tsconfig.paths` tổng quát (chỉ `@/` của web). `context` chỉ liệt kê
export bằng regex dòng đầu (`export function|class|const|interface|type|enum`), không có chữ ký đầy đủ. Không có cache ở đĩa.

## Đề xuất A/B V1 (3 tác vụ từ lịch sử git repo này)

Cách chạy: mỗi tác vụ chạy 2 lần từ worktree tại **commit cha** (graph-off: không có script; graph-on: order thêm đoạn hướng dẫn
bên dưới và `graph-proto.mjs` có sẵn trong worktree). Cùng backend/model/limits, cùng order, thứ tự off/on đảo luân phiên
giữa các tác vụ. Lời giải (commit) ẩn khỏi cả hai cánh: worktree dựng từ commit cha nên không thấy.

| # | Commit lời giải | Commit cha (gốc) | Tập file đáp án (chấm định vị) | Test chấm |
| --- | --- | --- | --- | --- |
| T1 | `57b05bb` | `a45a1a833ac89cc0c68eed5fcb08e5bcf1fd5fdf` | `packages/work/src/dispatch/engine.ts` (+ `engine.test.ts`) | `packages/work/src/dispatch/engine.test.ts` (bản của commit) |
| T2 | `6909d3d` | `5ee3cd91d2779d9df9d45e7666701f64c4824d66` | `packages/work/src/workflows/landing.ts` (+ test mới `workflows/landing-check-timeout.test.ts`) | `landing-check-timeout.test.ts` (bản của commit) |
| T3 | `8228219` | `dcca1330d7e8c64a06b9bacbf9292ff22de01818` | `packages/web/src/routes/new-task-surface.tsx` (+ `new-task.test.tsx`) | `packages/web/src/routes/new-task.test.tsx` (bản của commit) |

Vì sao 3 tác vụ này: T1 file `dispatch/` ở hub nhẹ (19 dependents, co-change mạnh với `workflows/run.ts` — kiểm tra graph có kéo
agent sang file thừa không); T2 file lõi nhiều test (L3 6 ứng viên sau khi chặn 2 hop qua hub), triệu chứng nằm ở "hành vi" chứ không
ở tên file; T3 phía web, ít dependents (4), nơi graph khó thắng grep — đối chứng trung thực.

Order (viết lại, không lộ lời giải/đường dẫn):

- **T1**: "Khi một manager giao cho worker một ngân sách USD, và ngân sách còn lại đúng bằng số worker xin (ví dụ còn $0,80 sau khi
  trừ 1,10 khỏi 3), hệ thống vẫn từ chối với thông báo 'requested $0.80 but only $0.80 is left'. Sửa để yêu cầu vừa khít được chấp
  nhận, các chi phí dưới một xu vẫn đúng. Thêm test hồi quy."
- **T2**: "Một check shell trong bước landing có timeout 10 phút, nhưng khi lệnh con bị treo, landing vẫn bị giữ lâu hơn nhiều so với
  timeout (cho đến khi lệnh treo tự kết thúc). Làm cho timeout thực sự nhả landing đúng hạn và không để tiến trình con mồ côi. Thêm
  test hồi quy dùng lệnh treo giả."
- **T3**: "Trong layout workspace, đặt lịch 'sau khi limit usage reset' từ màn hình New task: sau khi đặt lịch xong, URL chuyển khỏi
  `/p/<project>/new` trong khi pane nháp vẫn do host quản lý. Giữ nguyên route workspace sau khi đặt lịch; bản standalone cũ vẫn
  điều hướng như hiện tại. Thêm test."

Metric (ghi cho mỗi cặp): (1) **định vị đúng**: tỉ lệ file đáp án nằm trong tập file agent *mở/đọc* trước lần sửa đầu tiên, và số
file ngoài đáp án mà agent sửa; (2) số lượt công cụ và số lượt đến lần sửa đầu tiên; (3) token (input+output) và USD; (4) thời gian
tường; (5) pass của test chấm ở trên + pass của `tests` ứng viên graph đưa ra (đối chiếu với tập test thật sự cần chạy); (6) ở
cánh graph-on: số lần gọi `impact`/`context`/`tests` và có lần nào output sai/gây hiểu lầm (ghi tay). Tiêu chí tối thiểu để coi
là "có tín hiệu": graph-on không tệ hơn ở (5) và giảm được (1)/(2)/(3) ở ít nhất 2/3 tác vụ; với n=3 chỉ là tín hiệu, không phải kết luận.

Đoạn chèn vào order cánh graph-on (≤ 6 dòng):

```
Có sẵn công cụ chỉ-đọc: node docs/design/project-graph/scripts/proto/graph-proto.mjs
- Trước khi sửa một file: `context --scope <thư mục|file>` (outline + test cạnh file) rồi `impact <file>` (ai bị ảnh hưởng).
- Sau khi sửa: `tests --diff <commit gốc>` (hoặc `tests <file đã sửa>`) để chọn test chạy trước; chạy thêm bộ rộng hơn nếu không chắc.
- Kết quả gom hub theo thư mục (`--expand <thư mục>` để mở). `inferred`/co-change chỉ là gợi ý. Nếu `complete=false`, `truncated=true`
  hoặc nghi thiếu file: dùng grep/đọc source, đừng tin riêng đồ thị.
```
