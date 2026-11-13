# G-B trên engine sản phẩm P1 (replay R1 lặp lại)

Đo ngày 2026-11-13, HEAD `d41361d` (nhánh `onni/e1f3d4a5`), Windows 11 + Git Bash, Node v24.21.0. Các bảng ở mục "Kết quả" là
nguyên văn đầu ra của `scripts/replay/replay-p1.mjs` (không chép tay). Phương pháp, định nghĩa sự thật, hạn chế: giữ nguyên
`spikes/replay.md` (R1) — không nhắc lại ở đây.

## Cách tái lập

```bash
node docs/design/project-graph/scripts/replay/replay-p1.mjs --limit 600 --md out.md --json out.json   # ~64 s cache lạnh; chỉ đọc git
```

- Script tự chạy lại chính nó với `node --experimental-transform-types`, import **thẳng mã TS sản phẩm**
  (`packages/work/src/project-graph/{extract,resolve,graph,impact,denylist}.ts`, `tests-select/graph-select.ts`) — không cần `npm ci`/build,
  không sửa `packages/**`. Đồ thị mỗi commit dựng từ `git ls-tree` + blob ở commit CHA bằng adapter mỏng mô phỏng `build.ts`
  (mọi file là node, file code có record, file > 512 000 B là `unparsed`, workspace map từ `package.json` ≤ 4 cấp, alias từ `tsconfig*.json`).
  Không gọi `buildGraph`/`store` (cần ghi cache lên đĩa) — **chưa kiểm** thời gian `buildGraph` thật trên checkout.
- Mỗi commit đo **cả hai engine** trên cùng sự thật: prototype R1 (`proto/lib.mjs`) và sản phẩm → so cặp, cùng tập commit. Tập commit
  hiện là 498 (R1 gốc 470, repo đã thêm commit): train 348 / validation 150. Nên cột "R1 prototype" ở đây là **đo lại** và lệch nhẹ
  số công bố trong `replay.md` (ví dụ validation cao+vừa 89,2% vs 88,8%).
- Chọn test sản phẩm = `impact().tests` qua `selectTestsAdapter` (đúng cách `registry.ts` nối dây). Đối chứng thêm: `defaultTests` của `impact.ts`.
- Co-change **không có trong P1** (quyết định G0): hàng "R1 ∪ co-change" chỉ để tham chiếu.
- Bootstrap 1000 lần theo commit, seed cố định, CI95 như R1.

## Kết quả (nguyên văn đầu ra của script)

#### Impact — TRAIN, giao thức A: 1 seed (n=117 commit)

| Engine · cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| R1 prototype · L1 thô | 28.5% | [21.6%, 36.3%] | 15.6% | [10.4%, 21.5%] | 28.5% | 2 | 15 |
| R1 prototype · L1 nhóm hub | 11.6% | [6.8%, 16.5%] | 17.4% | [11.9%, 23.4%] | 32.1% | 3 | 10 |
| P1 sản phẩm · L1 thô | 28.5% | [21.7%, 35.6%] | 15.6% | [10.2%, 21.7%] | 28.5% | 2 | 15 |
| P1 sản phẩm · L1 nhóm hub | 24.2% | [17.6%, 31.6%] | 16.5% | [11.2%, 22.2%] | 30.5% | 2 | 12 |

#### Impact — TRAIN, giao thức B: bỏ 1 file (n=117 commit)

| Engine · cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| R1 prototype · L1 thô | 47.0% | [38.5%, 55.6%] | 9.7% | [5.8%, 14.0%] | 47.0% | 9 | 99 |
| R1 prototype · L1 nhóm hub | 26.5% | [18.8%, 35.0%] | 10.7% | [6.9%, 14.8%] | 54.7% | 9 | 26 |
| P1 sản phẩm · L1 thô | 47.0% | [38.5%, 55.6%] | 9.7% | [6.0%, 14.1%] | 47.0% | 9 | 99 |
| P1 sản phẩm · L1 nhóm hub | 41.9% | [33.3%, 51.3%] | 10.0% | [6.3%, 14.7%] | 50.4% | 9 | 28 |

#### Impact — VALIDATION, giao thức A: 1 seed (n=43 commit)

| Engine · cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| R1 prototype · L1 thô | 21.5% | [12.4%, 32.4%] | 18.1% | [9.1%, 28.8%] | 21.5% | 2 | 52 |
| R1 prototype · L1 nhóm hub | 12.6% | [5.4%, 21.3%] | 19.3% | [9.9%, 29.8%] | 25.0% | 2 | 16 |
| P1 sản phẩm · L1 thô | 21.5% | [11.8%, 32.2%] | 18.1% | [8.7%, 28.2%] | 21.5% | 2 | 52 |
| P1 sản phẩm · L1 nhóm hub | 16.1% | [8.8%, 25.4%] | 19.1% | [9.8%, 30.2%] | 23.8% | 2 | 14 |

#### Impact — VALIDATION, giao thức B: bỏ 1 file (n=43 commit)

| Engine · cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| R1 prototype · L1 thô | 41.9% | [27.9%, 58.1%] | 4.8% | [2.0%, 8.0%] | 41.9% | 5 | 54 |
| R1 prototype · L1 nhóm hub | 27.9% | [16.3%, 41.9%] | 6.0% | [3.3%, 9.5%] | 44.2% | 5 | 21 |
| P1 sản phẩm · L1 thô | 41.9% | [27.9%, 55.8%] | 4.8% | [1.9%, 8.0%] | 41.9% | 5 | 54 |
| P1 sản phẩm · L1 nhóm hub | 34.9% | [20.9%, 51.2%] | 5.4% | [2.7%, 9.0%] | 41.9% | 5 | 21 |

#### Hiệu ứng hub (commit có seed là hub của sản phẩm: bậc không tính test ≥ max(p95, 20))

| Tập | số (commit×giao thức) | P1 L1 thô median / p90 | P1 nhóm hub (mục) median / p90 | R1 L1 thô median / p90 | R1 nhóm hub median / p90 |
|---|---|---|---|---|---|
| train | 34 | 48 / 156 | 22 / 42 | 48 / 156 | 19 / 40 |
| val | 13 | 55 / 146 | 15 / 21 | 55 / 146 | 17 / 21 |

Ngưỡng hub sản phẩm trên các đồ thị đã dựng: median 20, min 20, max 20 (R1: p95 tối thiểu 15).

#### Ứng viên test — TRAIN (n=105 commit có sửa test sẵn có; 91 commit không sửa test chỉ đo chi phí)

| Engine · cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | chọn/toàn bộ test (median) | tập ở commit không sửa test (median) | số commit bỏ sót |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 prototype · cao | 60.6% | [52.5%, 67.4%] | 45.7% | [36.2%, 55.2%] | 24.8% | 42.8% | 3 / 9 | 0.4% | 1 | 57/105 |
| R1 prototype · cao+vừa | 79.9% | [73.1%, 86.5%] | 65.7% | [56.2%, 74.3%] | 12.4% | 18.0% | 45 / 180 | 5.6% | 89 | 36/105 |
| R1 prototype · cao+vừa ∪ co-change (tham chiếu, P1 không có) | 83.8% | [77.4%, 89.9%] | 74.3% | [64.8%, 81.9%] | 11.4% | 16.5% | 45 / 180 | 5.6% | 89 | 27/105 |
| P1 sản phẩm · cao (graph-select) | 75.8% | [68.7%, 82.4%] | 59.0% | [50.5%, 68.6%] | 13.3% | 27.8% | 19 / 156 | 2.3% | 89 | 43/105 |
| P1 sản phẩm · cao+vừa (graph-select) | 79.8% | [73.0%, 86.5%] | 64.8% | [56.2%, 74.3%] | 12.4% | 17.9% | 63 / 194 | 7.8% | 89 | 37/105 |
| P1 impact.ts defaultTests · cao+vừa (đối chứng) | 79.8% | [73.0%, 86.2%] | 64.8% | [56.2%, 73.3%] | 12.4% | 17.9% | 63 / 194 | 7.8% | 89 | 37/105 |

#### Ứng viên test — VALIDATION (n=54 commit có sửa test sẵn có; 16 commit không sửa test chỉ đo chi phí)

| Engine · cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | chọn/toàn bộ test (median) | tập ở commit không sửa test (median) | số commit bỏ sót |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 prototype · cao | 81.3% | [72.1%, 89.5%] | 72.2% | [59.3%, 83.3%] | 9.3% | 55.4% | 3 / 6 | 0.3% | 1 | 15/54 |
| R1 prototype · cao+vừa | 89.2% | [82.2%, 95.5%] | 81.5% | [70.4%, 90.7%] | 3.7% | 26.9% | 6 / 153 | 0.7% | 3 | 10/54 |
| R1 prototype · cao+vừa ∪ co-change (tham chiếu, P1 không có) | 89.9% | [83.5%, 96.1%] | 81.5% | [70.4%, 90.7%] | 3.7% | 24.7% | 6 / 153 | 0.7% | 6 | 10/54 |
| P1 sản phẩm · cao (graph-select) | 85.9% | [78.0%, 92.6%] | 77.8% | [68.5%, 88.9%] | 5.6% | 46.9% | 4 / 30 | 0.5% | 1 | 12/54 |
| P1 sản phẩm · cao+vừa (graph-select) | 89.2% | [82.7%, 95.3%] | 81.5% | [70.4%, 92.6%] | 3.7% | 25.3% | 6 / 153 | 0.7% | 3 | 10/54 |
| P1 impact.ts defaultTests · cao+vừa (đối chứng) | 89.2% | [82.1%, 95.9%] | 81.5% | [70.4%, 90.7%] | 3.7% | 25.3% | 6 / 153 | 0.7% | 3 | 10/54 |

Commit sửa test: 159; test mới thêm cùng commit (không dự đoán được bằng đồ thị tại cha): 51 file.

#### Tỉ lệ `complete=true` theo câu hỏi (chỉ engine sản phẩm; prototype không có cờ này = luôn false)

| Tập | Câu hỏi | n | complete=true | CI95 | lý do không đầy đủ (số câu hỏi, có thể chồng) |
|---|---|---|---|---|---|
| train | impact A: 1 seed | 117 | 94.9% | [90.6%, 98.3%] | unresolved: 1; unparsed: 5 |
| train | impact B: bỏ 1 file | 117 | 88.0% | [82.1%, 93.2%] | truncated: 7; unresolved: 2; unparsed: 5 |
| train | tests (impact+tests) | 196 | 84.7% | [79.6%, 89.8%] | truncated: 8; unresolved: 2; unparsed: 21 |
| val | impact A: 1 seed | 43 | 100.0% | [100.0%, 100.0%] | – |
| val | impact B: bỏ 1 file | 43 | 97.7% | [93.0%, 100.0%] | truncated: 1 |
| val | tests (impact+tests) | 70 | 98.6% | [95.7%, 100.0%] | truncated: 1 |
| all | impact A: 1 seed | 160 | 96.3% | [93.1%, 98.8%] | unresolved: 1; unparsed: 5 |
| all | impact B: bỏ 1 file | 160 | 90.6% | [86.3%, 95.0%] | truncated: 8; unresolved: 2; unparsed: 5 |
| all | tests (impact+tests) | 266 | 88.3% | [84.6%, 91.7%] | truncated: 9; unresolved: 2; unparsed: 21 |

#### Thời gian dựng

- Dựng đồ thị từ blob đã trích (adapter: buildWorkspaceMap + aliases + setRecord/resolve toàn bộ file), mỗi commit cha: sản phẩm median 24 ms / p90 31.7 ms; prototype median 19.6 ms / p90 25.7 ms (n=476 lần dựng, gồm cả commit bị bỏ sau đó).
- computeImpact sản phẩm (1 lần gọi): median 0.4 ms / p90 1.1 ms.
- Trích import (cả hai engine, chỉ blob mới, cache lạnh): tổng 3618 ms cho 4995 blob đọc mới.
- Kích thước đồ thị sản phẩm: files median 2234, edges median 6529, unparsed median 0.

#### Commit bị bỏ

| Lý do | số commit |
|---|---|
| no parent (root) | 1 |
| docs/config only (no code file) | 123 |
| too large (> 30 files) | 21 |
| no usable seed | 87 |
| time budget | 0 |
| (đo được ở ít nhất một phần) | 266 |

#### Đối chiếu ngưỡng D2 (chế độ tự chọn subset) — engine sản phẩm, validation

- Điều kiện mẫu: ≥150 commit sửa test ở validation và có proxy "test fail thật": có 54 commit sửa test ở validation; proxy fail: chưa có → **không đạt**.
- (a) tỉ lệ commit đủ 100%: 81.5%, cận dưới CI95 70.4% (cần ≥ 97%) → **không đạt**.
- (b) trung vị tập chọn / toàn bộ test: 0.7% (cần ≤ 20%) → đạt.
- (c) failure bị bỏ sót ở validation: 10/54 commit (cần 0) → **không đạt**.

#### Commit validation bị bỏ sót test (P1 cao+vừa; path)

- `a97df2c9` seed: `packages/web/src/components/appearance-provider.tsx`, `packages/web/src/components/ui/button.tsx`, `packages/web/src/lib/appearance.ts` (+1); thiếu: `packages/web/src/lib/theme-contrast.test.ts`
- `4a84337a` seed: `packages/web/src/components/sidebar-frame.tsx`, `packages/web/src/components/workspace/workspace-host.tsx`, `packages/web/src/routes/new-task-surface.tsx`; thiếu: `packages/web/src/lib/navigator-groups.test.ts`
- `785c76ca` seed: `packages/contract/src/workspace-layouts.ts`, `packages/web/src/routes/task-workspace/layout-state.ts`; thiếu: `packages/work/src/server/contract-parity.workspace.test.ts`
- `3462ed4b` seed: `packages/web/src/lib/workspace-state.ts`; thiếu: `packages/web/src/routes/task-workspace/layout-bounds.test.ts`, `packages/work/src/server/contract-workspace-threads.test.ts`, `packages/work/src/server/routes/workspace-search.test.ts` (+1)
- `3fe89af3` seed: `packages/web/src/components/sidebar-frame.tsx`, `packages/web/src/components/splitter/use-splitter.ts`, `packages/web/src/components/vertical-split.tsx` (+3); thiếu: `packages/web/src/routes/settings/settings.test.tsx`
- `23045f60` seed: `packages/work/src/runs/store.ts`, `packages/work/src/runs/transcript-search.ts`, `packages/work/src/server/routes/workspace-threads.ts`; thiếu: `packages/work/src/server/contract-parity.runs.test.ts`, `packages/work/src/server/contract-parity.workspace.test.ts`, `packages/work/src/server/typed-bodies.test.ts`
- `e345adc9` seed: `packages/web/src/components/workspace/split-tab-strip.tsx`; thiếu: `packages/web/src/components/workspace/context-sheet.test.tsx`, `packages/work/src/server/routes/workspace-threads.test.ts`
- `cecb41bd` seed: `packages/contract/src/roster.ts`, `packages/contract/src/runs.ts`, `packages/work/src/runs/store.ts` (+6); thiếu: `packages/work/src/server/contract-parity.dispatch.test.ts`, `packages/work/src/server/typed-bodies.test.ts`
- `75cfc0cd` seed: `packages/work/src/dispatch/commands.ts`, `packages/work/src/dispatch/prompt-budget.ts`, `packages/work/src/dispatch/task-cli.ts` (+2); thiếu: `packages/work/src/server/contract-parity.dispatch.test.ts`, `packages/work/src/server/dispatch-api.test.ts`, `packages/work/src/server/route-parity.test.ts`
- `683d28e9` seed: `packages/desktop/scripts/icon.mjs`, `packages/web/src/components/brand-mark.tsx`; thiếu: `packages/web/src/brand-asset.test.ts`

Thời gian chạy: 64s; blob đọc mới: 4995; HEAD d41361d; Node v24.21.0; commit tổng 498 (train 348, validation 150).

## Kết luận G-B (P1)

**(a) Recall test ở validation (n=54 commit sửa test sẵn có).** Sản phẩm cao+vừa (graph-select): recall TB **89,2%** (CI95 [82,7%, 95,3%]),
commit đủ 100% = **81,5%** (CI95 [70,4%, 92,6%]), **10/54 commit bỏ sót** ≥1 test (18,5%); 2/54 recall = 0 (`brand-asset.test.ts` kiểu
phụ thuộc không qua import; v.v. — danh sách path ở cuối bảng, nguyên nhân từng ca chưa kiểm). Chỉ nấc *cao*: recall 85,9%, 12/54 bỏ sót, tập rất nhỏ (median 4).
Train: cao+vừa recall 79,8%, 37/105 bỏ sót.

**(b) Đối chiếu ngưỡng D2 (`replay.md` §Ngưỡng đề xuất).** Mọi điều kiện lên "tự chọn subset" đều **không đạt**: (a) cận dưới CI95 của
"commit đủ" 70,4% < 97%; (c) 10 commit bỏ sót ≠ 0; điều kiện mẫu (≥150 commit sửa test + proxy "test fail thật") chưa có (54 commit, không có proxy).
Chỉ (b) đạt (median chọn/toàn bộ 0,7% ≤ 20%) — nhưng vô nghĩa khi recall chưa đủ. **Xác nhận: `verify` của P1 giữ chế độ gợi ý**
(graph tests → chạy trước, toàn bộ chạy sau); không dùng graph để thu hẹp tập test.

**(c) Khác biệt so với R1 và nguyên nhân.**
- Impact L1 thô **giống hệt** R1 (recall/precision/kích thước trùng ở mọi bảng) → trích import + resolve của sản phẩm tương đương prototype trên repo này.
- **Hub**: ngưỡng sản phẩm là `max(p95 bậc không tính test, 20)` và trên mọi đồ thị đo được p95 < 20 nên ngưỡng luôn = **20** (R1: bậc có tính test, tối thiểu 15).
  Hệ quả (giải thích suy ra từ code, không tách riêng bằng thí nghiệm): ít file bị coi là hub hơn → nhóm hub gom ít hơn. Impact "nhóm hub" của sản phẩm
  giữ recall cao hơn R1 (validation A 16,1% vs 12,6%; B 34,9% vs 27,9%; train A 24,2% vs 11,6%) với tập cùng cỡ (median) nhưng đuôi to hơn ở train
  (hub-commit: nhóm 22 mục median / p90 42 vs R1 19 / 40). Với seed hub, danh sách hub bị thay bằng nhóm thư mục: recall theo file vẫn thấp hơn L1 thô.
- **Test nấc cao**: sản phẩm recall cao hơn R1 (train 75,8% vs 60,6%; validation 85,9% vs 81,3%) nhưng tập lớn hơn (train p90 156 vs 9; chọn/toàn bộ train 2,3% vs 0,4%):
  do ít hub hơn nên test import trực tiếp một file "gần hub" được xếp *cao* thay vì *vừa*. Nấc cao+vừa gần như trùng R1 (train 79,8% vs 79,9%; validation 89,2% vs 89,2%).
  `graph-select` và `defaultTests` cho tập bằng nhau về recall (đối chứng) — không có khác biệt thực tế trên mẫu này.
- Chi phí: tập test cao+vừa trên train median 63 (R1 45), p90 194 (R1 180); ở commit không sửa test median 89 (giống R1) ở train, 3 ở validation.

**Tỉ lệ `complete=true`** (R1 prototype luôn false): validation 100% (impact A), 97,7% (impact B), 98,6% (tests); train thấp hơn
(94,9% / 88,0% / 84,7%), toàn bộ 96,3% / 90,6% / 88,3%. Lý do không đầy đủ: `truncated` (danh sách > 200 mục, chủ yếu seed hub nhiều file),
`unparsed` (file code > 512 000 B ở commit cũ — không truy từng file), `unresolved` hiếm (1–2 câu hỏi). Chỉ 2 commit validation không đầy đủ (truncated).
Lưu ý: `complete` đo phạm vi *câu hỏi* (seed + dependents liệt kê), không phải tính đúng đắn — bảng recall cho thấy 18,5% commit vẫn bỏ sót test dù `complete=true` ở hầu hết.

**Thời gian**: dựng đồ thị từ blob đã trích median 24 ms (p90 32 ms; ~2 234 file, ~6 529 cạnh) — prototype 19,6 ms; `computeImpact` median 0,4 ms (p90 1,1 ms).
Không gồm đọc blob/trích import (3,6 s cho ~5 000 blob mới, cả hai engine) và `git ls-files` thật.

## Hạn chế bổ sung (ngoài R1)
- Adapter mô phỏng `build.ts`, không chạy nó; số "thời gian dựng" là cận dưới.
- Mẫu validation 54 commit sửa test; mọi CI rộng ±7–10 điểm. Proxy "test sửa cùng commit" như R1 (lạc quan cho test cùng tên, bi quan cho test fail xa).
- Hai engine dùng cùng seed/sự thật và cùng quy ước test (`isTest` giống `isTestFile`), nên khác biệt là của engine, nhưng cùng lịch sử ~15 ngày → train/validation không độc lập thật.
