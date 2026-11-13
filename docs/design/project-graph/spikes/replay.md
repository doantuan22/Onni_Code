# R1 — Replay lịch sử git (G-B bản thử)

Đo ngày 2026-11-13, HEAD `4d7052f` (nhánh `onni/dc3a742d`), Windows 11 + Git Bash, Node v24.21.0. Toàn bộ số dưới đây do
`scripts/replay/replay.mjs` in ra (không chép tay), trừ phần nấc 2 do `scripts/replay/rung2.mjs`.

## Cách tái lập

```bash
node docs/design/project-graph/scripts/replay/replay.mjs --limit 600 --md out.md --json out.json   # ~50 s, đọc git, không ghi vào repo
# nấc 2 (mẫu 20 commit validation, ~30 s/commit, cần worktree tạm + node_modules ngoài repo):
git worktree add --detach <tmp>/wt HEAD
node docs/design/project-graph/scripts/replay/rung2.mjs --results out.json --wt <tmp>/wt --nm <đường dẫn node_modules> --n 20
```

Cache blob → import ghi ở `os.tmpdir()/onni-graph-replay-cache.v1.json` (bỏ bằng `--no-cache`). Trần: `--budget-s 900`,
`--max-files 30`. Bootstrap: 1000 lần resample **theo commit**, seed cố định (CI 95%, phân vị 2,5/97,5).

## Phương pháp

- **Tập commit:** `git log --no-merges` trên nhánh này = **470** commit (PLAN §9.2 ghi 611 — đó là số đếm gồm merge/nhánh
  khác; brief ghi ~600, thực tế 470). Sắp theo thời gian: **train = 329 commit cũ (70%)**, **validation = 141 commit mới
  nhất (30%)**. Toàn bộ lịch sử chỉ trải ~15 ngày (2026-10-29 → 2026-11-13) — rất ngắn, xem hạn chế.
- **Đồ thị tại commit CHA:** `git ls-tree -r <cha>` + `git cat-file --batch` theo blob (cache theo hash blob), dựng bằng
  `extractImports`/`resolveSpecifier`/`computeImpact`/`hubThreshold`/`coChangeFor` của `proto/lib.mjs` (không sửa lib).
  Hub: p95 in-degree, tối thiểu 15 (như prototype).
- **Co-change không rò tương lai:** chỉ dùng các commit cũ hơn commit đang đo (kể cả khi commit đó ở validation).
- **Impact** — hạt giống = file code không-test đã tồn tại ở cha; sự thật = các file code không-test *sẵn có ở cha* khác đổi
  cùng commit (file mới thêm không thể có trong đồ thị cha nên không tính vào sự thật). Hai giao thức: **A** = 1 hạt giống
  (file đầu theo alphabet), sự thật = các file còn lại; **B** = bỏ 1 file (hạt giống = mọi file trừ file cuối), sự thật = file bị bỏ.
  Dự đoán lọc bỏ test (test ở làn riêng). Hub-nhóm: seed là hub thì chỉ trả về nhóm thư mục (mỗi nhóm = 1 mục). `recall`
  = tính theo file; `recall mức thư mục` = file sự thật nằm trong file liệt kê *hoặc* trong một nhóm hub; `precision` tính
  theo mục (file hoặc nhóm; nhóm trúng nếu chứa file sự thật). Trung bình theo commit (macro).
  *Không làm*: sự thật mở rộng sang k commit kế tiếp cùng tác giả (đã định là tùy chọn; dữ liệu không có ranh giới PR/nhánh
  đáng tin để gom).
- **Ứng viên test** — hạt giống = mọi file code không-test đổi trong commit (thứ agent biết lúc verify); sự thật = test
  *sẵn có ở cha* bị sửa cùng commit (**proxy yếu** cho "test liên quan/test sẽ fail": một test được sửa ≠ một test fail;
  test mới thêm — 47 file — không dự đoán được nên không tính). Chỉ commit có ít nhất một test sửa được tính recall; commit
  không sửa test chỉ để đo chi phí (số test được chọn). "Test file chính nó đổi" bị loại khỏi tập chọn (tránh rò sự thật).
  Cách chọn: nấc 3 *cao* (import trực tiếp từ test, test cùng tên), *cao+vừa* (thêm sibling test của dependent, test import
  hub), *mọi mức* (thêm 2 hop), co-change test (test cùng đổi với seed ở ≥2 commit trước, confidence ≥0,3), và các tập hợp.
  Tổng test ở cha dùng làm mẫu số cho "tỉ lệ chọn/toàn bộ".
- **Commit bị bỏ**: xem bảng cuối.

## Kết quả (nguyên văn đầu ra của script)

#### Impact — TRAIN, giao thức A: 1 seed (n=112 commit)

| Cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| L1 thô | 25.3% | [18.3%, 32.6%] | 16.0% | [10.4%, 22.1%] | 25.3% | 2 | 13 |
| L1 nhóm hub | 12.2% | [7.3%, 17.4%] | 17.8% | [11.9%, 23.9%] | 29.0% | 2 | 10 |
| LX (sup≥3, conf≥0.3) | 9.8% | [6.0%, 14.3%] | 37.8% | [26.6%, 50.4%] | 9.8% | 0 | 5 |
| LX lỏng (sup≥2, conf≥0.2) | 19.4% | [13.4%, 26.0%] | 28.8% | [20.3%, 38.0%] | 19.4% | 0 | 10 |
| L1 thô ∪ LX | 33.5% | [27.0%, 41.0%] | 19.8% | [14.5%, 26.0%] | 33.5% | 3 | 13 |
| L1 nhóm hub ∪ LX | 20.8% | [15.4%, 27.0%] | 21.6% | [15.9%, 27.6%] | 37.2% | 3 | 10 |

#### Impact — TRAIN, giao thức B: bỏ 1 file (n=112 commit)

| Cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| L1 thô | 44.6% | [35.7%, 53.6%] | 9.8% | [5.7%, 14.7%] | 44.6% | 7 | 99 |
| L1 nhóm hub | 27.7% | [19.6%, 35.7%] | 10.8% | [7.0%, 15.3%] | 52.7% | 8 | 26 |
| LX (sup≥3, conf≥0.3) | 17.0% | [10.7%, 24.1%] | 14.0% | [7.8%, 22.1%] | 17.0% | 0 | 5 |
| LX lỏng (sup≥2, conf≥0.2) | 30.4% | [22.3%, 39.3%] | 10.0% | [6.3%, 14.8%] | 30.4% | 2 | 10 |
| L1 thô ∪ LX | 54.5% | [45.5%, 63.4%] | 10.2% | [6.4%, 14.7%] | 54.5% | 9 | 100 |
| L1 nhóm hub ∪ LX | 38.4% | [30.4%, 47.3%] | 10.9% | [6.8%, 15.4%] | 58.9% | 10 | 28 |

#### Impact — VALIDATION, giao thức A: 1 seed (n=47 commit)

| Cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| L1 thô | 30.3% | [19.3%, 43.2%] | 17.3% | [8.7%, 27.6%] | 30.3% | 2 | 52 |
| L1 nhóm hub | 11.5% | [5.0%, 19.5%] | 18.7% | [10.3%, 28.7%] | 33.5% | 2 | 16 |
| LX (sup≥3, conf≥0.3) | 4.8% | [0.0%, 10.6%] | 10.2% | [1.9%, 22.2%] | 4.8% | 0 | 4 |
| LX lỏng (sup≥2, conf≥0.2) | 16.5% | [7.7%, 27.4%] | 11.9% | [6.2%, 17.8%] | 16.5% | 0 | 6 |
| L1 thô ∪ LX | 33.0% | [20.8%, 46.2%] | 16.2% | [7.5%, 25.6%] | 33.0% | 3 | 55 |
| L1 nhóm hub ∪ LX | 15.2% | [7.6%, 23.9%] | 17.5% | [9.3%, 26.5%] | 36.2% | 3 | 20 |

#### Impact — VALIDATION, giao thức B: bỏ 1 file (n=47 commit)

| Cách chọn | recall TB | CI95 recall | precision TB | CI95 precision | recall mức thư mục | tập (median) | tập (p90) |
|---|---|---|---|---|---|---|---|
| L1 thô | 46.8% | [31.9%, 61.7%] | 5.1% | [2.6%, 7.9%] | 46.8% | 6 | 54 |
| L1 nhóm hub | 23.4% | [12.8%, 36.2%] | 6.5% | [4.1%, 9.7%] | 48.9% | 6 | 19 |
| LX (sup≥3, conf≥0.3) | 6.4% | [0.0%, 14.9%] | 5.6% | [0.0%, 10.9%] | 6.4% | 0 | 5 |
| LX lỏng (sup≥2, conf≥0.2) | 21.3% | [10.6%, 34.0%] | 7.0% | [3.6%, 10.6%] | 21.3% | 0 | 9 |
| L1 thô ∪ LX | 48.9% | [34.0%, 61.7%] | 4.8% | [2.4%, 7.7%] | 48.9% | 6 | 56 |
| L1 nhóm hub ∪ LX | 25.5% | [12.8%, 38.3%] | 6.2% | [3.6%, 9.3%] | 51.1% | 6 | 22 |

#### Hiệu ứng hub (commit có seed là hub)

| Tập | số (commit×giao thức) | L1 thô median | L1 thô p90 | L1 nhóm hub (mục) median | p90 |
|---|---|---|---|---|---|
| train | 77 | 13 | 116 | 10 | 28 |
| val | 32 | 16 | 109 | 10 | 21 |

#### Ứng viên test — TRAIN (n=105 commit có sửa test sẵn có; 83 commit không sửa test chỉ đo chi phí)

| Cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | tỉ lệ chọn/toàn bộ test (median) | tập ở commit không sửa test (median) |
|---|---|---|---|---|---|---|---|---|---|
| nấc 3 cao (import trực tiếp + cùng tên) | 60.6% | [52.6%, 68.5%] | 45.7% | [36.2%, 55.2%] | 24.8% | 42.8% | 3 / 9 | 0.4% | 1 |
| nấc 3 cao+vừa (+ sibling của dependent, qua hub) | 79.9% | [72.8%, 86.2%] | 65.7% | [56.2%, 74.3%] | 12.4% | 18.0% | 45 / 180 | 5.6% | 89 |
| nấc 3 mọi mức (+ 2 hop) | 80.3% | [73.7%, 86.8%] | 66.7% | [57.1%, 75.2%] | 12.4% | 16.2% | 47 / 180 | 5.8% | 89 |
| co-change test (sup≥2, conf≥0.3) | 22.4% | [15.3%, 29.3%] | 12.4% | [6.7%, 19.0%] | 68.6% | 29.7% | 0 / 8 | 0.0% | 0 |
| nấc 3 cao+vừa ∪ co-change test | 83.8% | [77.0%, 90.1%] | 74.3% | [65.7%, 81.9%] | 11.4% | 16.5% | 45 / 180 | 5.6% | 89 |
| nấc 3 mọi mức ∪ co-change test | 84.0% | [77.0%, 90.4%] | 75.2% | [66.7%, 82.9%] | 11.4% | 14.9% | 55 / 180 | 6.8% | 89 |

#### Ứng viên test — VALIDATION (n=52 commit có sửa test sẵn có; 21 commit không sửa test chỉ đo chi phí)

| Cách chọn | recall TB | CI95 | commit recall=100% | CI95 | commit recall=0 | precision TB | tập test (median/p90) | tỉ lệ chọn/toàn bộ test (median) | tập ở commit không sửa test (median) |
|---|---|---|---|---|---|---|---|---|---|
| nấc 3 cao (import trực tiếp + cùng tên) | 80.5% | [71.2%, 88.9%] | 71.2% | [59.6%, 82.7%] | 9.6% | 56.3% | 3 / 6 | 0.3% | 1 |
| nấc 3 cao+vừa (+ sibling của dependent, qua hub) | 88.8% | [81.8%, 95.1%] | 80.8% | [71.2%, 90.4%] | 3.8% | 27.5% | 6 / 153 | 0.7% | 94 |
| nấc 3 mọi mức (+ 2 hop) | 88.8% | [81.6%, 94.7%] | 80.8% | [69.2%, 92.3%] | 3.8% | 24.1% | 6 / 153 | 0.7% | 97 |
| co-change test (sup≥2, conf≥0.3) | 38.9% | [27.4%, 51.5%] | 28.8% | [17.3%, 42.3%] | 48.1% | 54.5% | 1 / 4 | 0.1% | 0 |
| nấc 3 cao+vừa ∪ co-change test | 89.6% | [82.2%, 95.7%] | 80.8% | [69.2%, 90.4%] | 3.8% | 25.2% | 6 / 153 | 0.7% | 94 |
| nấc 3 mọi mức ∪ co-change test | 89.6% | [82.1%, 95.9%] | 80.8% | [69.2%, 90.4%] | 3.8% | 22.4% | 7 / 153 | 0.8% | 102 |

Commit sửa test: 157; test mới thêm cùng commit (không thể dự đoán bằng đồ thị tại cha): 47 file.

#### Commit bị bỏ

| Lý do | số commit |
|---|---|
| no parent (root) | 1 |
| docs/config only (no code file) | 110 |
| too large (> 30 files) | 21 |
| no usable seed | 77 |
| no truth | 0 |
| time budget | 0 |
| (đo được ở ít nhất một phần) | 261 |

#### Ví dụ (test, chỉ path; tốt = recall 100% với tập nhỏ nhất; xấu = bỏ sót hết kể cả khi lấy mọi mức ∪ co-change)

- TỐT `c3592afa` [val] — seed: `packages/work/src/core/antigravity-ui-mapper.ts`; test thật: `packages/work/src/core/antigravity-runner.test.ts`, `packages/work/src/core/antigravity-ui-mapper.test.ts`; chọn (cao+vừa∪co-change): 2 file
- TỐT `a19d7848` [val] — seed: `packages/web/src/routes/task-workspace/task-workspace.tsx`; test thật: `packages/web/src/routes/task-workspace/task-workspace.test.tsx`; chọn (cao+vừa∪co-change): 2 file
- TỐT `765a0999` [val] — seed: `packages/web/src/routes/task-thread/review-panel.tsx`; test thật: `packages/web/src/routes/task-thread/review-panel.test.tsx`; chọn (cao+vừa∪co-change): 2 file
- XẤU `683d28e9` [val] — seed: `packages/desktop/scripts/icon.mjs`, `packages/web/src/components/brand-mark.tsx`; test thật: `packages/web/src/brand-asset.test.ts`; chọn (cao+vừa∪co-change): 1 file
- XẤU `e345adc9` [val] — seed: `packages/web/src/components/workspace/split-tab-strip.tsx`; test thật: `packages/web/src/components/workspace/context-sheet.test.tsx`, `packages/work/src/server/routes/workspace-threads.test.ts`; chọn (cao+vừa∪co-change): 2 file

Số commit validation có test bị bỏ sót (recall<100%) theo cách chọn (trên 52): nấc 3 cao (import trực tiếp + cùng tên): 15; nấc 3 cao+vừa (+ sibling của dependent, qua hub): 10; nấc 3 mọi mức (+ 2 hop): 10; co-change test (sup≥2, conf≥0.3): 37; nấc 3 cao+vừa ∪ co-change test: 10; nấc 3 mọi mức ∪ co-change test: 10

Thời gian chạy: 50s; blob đọc mới: 2932; HEAD 4d7052f; Node v24.21.0; commit tổng 470 (train 329, validation 141).

### Nấc 2 — `vitest list --filesOnly --changed <cha>` (mẫu 20 commit validation, cách ~đều)

Worktree tạm tại commit, test đã sửa được trả về trạng thái cha (để `--changed` chỉ thấy thay đổi nguồn), test mới thêm bị
loại. `node_modules` nối từ checkout chính (xấp xỉ, không phải môi trường cha chính xác).

| Chỉ số (n=20, 20/20 chạy được) | Nấc 2 vitest | Nấc 3 cao+vừa ∪ co-change (cùng 20 commit) | Nấc 3 cao |
|---|---|---|---|
| recall TB | 100% | 96,2% | 92,3% |
| commit recall 100% | 20/20 | 18/20 | 17/20 |
| tập test median | 46 (33–192) | 6 | 3 |
| thời gian | ~17–32 s/commit (cả khởi động vitest + 3 project) | ~ms | ~ms |

20/20 nghĩa là CI95 một phía của tỉ lệ "đủ" ≥ ~86% (quy tắc ba) — chưa đủ để khẳng định ≥95%. Mẫu nhỏ, chọn cách đều;
tập chọn rất lớn (median 46, tới 192 file) nên "recall 100%" một phần là do chọn gần như mọi thứ liên quan.

## Phân tích

**Hiệu ứng hub.** Ở commit có seed là hub (77 phiên bản train, 32 validation), L1 thô median 13–16, p90 109–116 file; gom nhóm hub
còn median 10 mục, p90 21–28 — tập nhỏ đi ~4–5 lần ở đuôi, nhưng **recall theo file rơi từ ~25–30% xuống ~11–12%** (giao thức A);
recall mức thư mục (29–34%) cho thấy phần lớn file đổi thực sự nằm trong thư mục của nhóm hub. Nói cách khác nhóm hub đổi recall file lấy kích thước tập.

**Impact.** L1 (import) có precision thấp-vừa (16–18% giao thức A, 5–10% giao thức B) và recall 25–47%: phần lớn file đổi cùng
nhau *không* nối bằng import (config, route + contract, file mới, i18n…). Co-change ngưỡng mặc định (support≥3, conf≥0,3) có
precision cao hơn ở train (38%) nhưng recall chỉ 5–17%, và **tụt mạnh ở validation (precision 10%, recall 5%)** — lịch sử 15 ngày
quá ngắn để có support≥3. Ngưỡng lỏng (support≥2, conf≥0,2) cân bằng hơn (recall 16–30%) nhưng precision 7–29% (29% ở train giao thức A, 7–12% còn lại). Hợp L1 ∪ LX
lên recall ~33% (A) / ~49–55% (B) mà precision gần như không đổi so với L1 thô. CI rộng (±10–15 điểm): đừng so hai cách khác nhau vài điểm.

**Ứng viên test (H2).**
- Nấc 3 *cao* rất rẻ (median 3 test, ~0,3% toàn bộ) nhưng recall chỉ 60,6% train / 80,5% validation; 15/52 commit validation bỏ sót ≥1 test.
- Thêm *vừa* (sibling của dependent, import hub) kéo recall lên 79,9% / 88,8% (commit đủ 100%: 65,7% / 80,8%) nhưng tập phình
  (median 45 train / 6 validation, p90 180 / 153; ở commit không sửa test median ~90 file; tỉ lệ chọn/toàn bộ median 5,6% train, 0,7% validation) — chủ yếu do hub. 2 hop gần như không thêm gì (+0,4 / +0 điểm).
- Co-change test một mình yếu (22% / 39%) nhưng hợp với nấc 3 cho +4 / +0,8 điểm.
- **Số commit validation còn bỏ sót test (recall<100%): cao 15/52; cao+vừa 10/52; mọi mức 10/52; hợp co-change 10/52.** Theo luật G-B
  ("bất kỳ failure bị bỏ sót trong validation → chế độ gợi ý"), mọi cách của nấc 3 hiện **không đạt** để tự chọn subset.
- Train tệ hơn validation đáng kể (recall cao 60,6% vs 80,5%): ngoài nhiễu, validation là thời kỳ repo ổn định/tổ chức test cùng
  tên hơn. Con số validation lạc quan nếu xem là đại diện cho tương lai; CI [81,8%, 95,1%] cho recall cao+vừa là thực tế hơn.

**H2 (sơ bộ):** "graph + runner có recall ≥ ngưỡng" — **chưa chứng minh**. Nấc 3 một mình: recall TB 89–90% nhưng ~19% commit validation vẫn
bỏ sót. Nấc 2 trên mẫu nhỏ đạt 20/20 nhưng tập lớn (median 46) và chậm (~30 s) — hợp lý làm *lưới an toàn*, không phải chọn nhanh.
Nấc 3 hữu ích như **thứ tự ưu tiên chạy trước** (3–6 test chạy trước, toàn bộ chạy sau), không phải bộ lọc.
**H3:** không đo ở R1 (cần dữ liệu run→file/overlap, thuộc G-C); số duy nhất liên quan: co-change dùng làm tín hiệu cảnh báo
có precision 10% (validation) – 38% (train) ở ngưỡng mặc định → không đủ để chặn bất cứ thứ gì.

### Ví dụ lỗi (suy đoán nguyên nhân, chưa kiểm chứng)

Hai ca xấu ở validation: `683d28e9` (test `packages/web/src/brand-asset.test.ts` — rất có thể kiểm tra file tài nguyên
qua fs/đường dẫn chuỗi chứ không import file sửa) và `e345adc9` (test sửa kèm, không cùng module — thay đổi giao diện kèm sửa
hai test ở khu vực khác). Cả hai kiểu "phụ thuộc không qua import" là điểm mù cố hữu của đồ thị import.

## Hạn chế (đọc trước khi tin các con số)

1. Lịch sử chỉ ~15 ngày/470 commit; train/validation không độc lập thật về thời kỳ (cùng nhóm tác giả, cùng giai đoạn tái cấu trúc). 110
   commit chỉ-docs/config, 77 commit không có hạt giống code, 21 commit >30 file bị bỏ → mẫu thiên về thay đổi nhỏ có code.
2. "Test sửa cùng commit" ≠ "test sẽ fail": thiên về test đứng cạnh file nguồn (cùng tên) nên **lạc quan** cho nấc 3 cùng tên và **bi quan**
   cho các test fail do thay đổi xa (không ai sửa test đó). Chưa tìm proxy thứ hai ("fix test fail") — subject commit không gắn nhãn tin cậy; ghi "chưa kiểm".
3. Tập sự thật impact chỉ trong *cùng một commit*; thay đổi liên quan nằm ở commit kế bên bị tính là "sai" → precision thấp là cận dưới.
4. Giao thức impact A/B là nhân tạo (hạt giống = file alphabet đầu / bỏ file cuối), không phải hành vi agent thật.
5. Nấc 2 chỉ 20 commit, môi trường xấp xỉ. Không có CI nào giữa các commit (không biết test nào thực sự fail).
6. Đồ thị là lexer regex (không AST) — thiếu cạnh `import` kiểu lạ làm recall của L1/nấc 3 thấp hơn mức tối đa của đồ thị.

## Ngưỡng đề xuất cho G-B (quyết định D2 của chủ dự án)

Số liệu đề xuất dựa trên validation, kèm CI95; **chủ dự án duyệt**.

1. **Không tự thu hẹp tập test của `verify` dựa trên graph ở bản P1** — ngay cả cách tốt nhất (nấc 3 cao+vừa ∪ co-change) bỏ sót
   test ở 10/52 commit validation (19%; CI95 recall TB [82,2%, 95,7%]). Giữ **chế độ gợi ý** (`graph tests` → chạy trước, toàn bộ chạy sau).
2. **Điều kiện lên chế độ "tự chọn subset"** (đề xuất, chưa đạt): trên tập validation tối thiểu ~150 commit sửa test *và* một proxy "test fail thật"
   (CI/log, không chỉ test được sửa): (a) **tỉ lệ commit đủ 100% test cần chạy có cận dưới CI95 ≥ 97%**; (b) trung vị tập chọn ≤ 20% toàn bộ test;
   (c) 0 failure bị bỏ sót trong tập validation giữ lại (luật PLAN §9.2). Hiện: cận dưới CI95 của "commit đủ" ở nấc 3 cao+vừa = 71,2%, nấc 2 (mẫu 20) ≥ ~86%.
3. **Lộ trình khả thi:** subset = nấc 3 (thứ tự ưu tiên chạy trước) ∪ nấc 2 `vitest related` (lưới an toàn), toàn bộ chạy sau. Chi phí nấc 2 (~30 s,
   median 46 test) cần đo lại trong sản phẩm với cache.
4. **Impact/co-change chỉ là hiển thị, không là cổng:** nếu muốn cảnh báo dựa co-change, yêu cầu precision ≥ 50% (hiện 10–38%) trước khi hiện mặc định;
   mặc định support≥3 để giảm nhiễu nhưng cần lịch sử dài hơn (≥ vài tháng) mới có tín hiệu.
5. **Hub:** giữ gom nhóm hub (tập p90 giảm 4–5 lần) nhưng ghi rõ cho người dùng "hub được gom → recall file thấp"; mở rộng nhóm theo yêu cầu.
6. **Đo lại** khi lịch sử dài ≥ 3 tháng hoặc sau khi có run→file trong sản phẩm (có sự thật sạch hơn); bổ sung proxy test fail từ lịch sử CI nếu có.
