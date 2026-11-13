# Spike S4 — đo Git trên Windows

Ngày đo: 2026-11-13.
Commit: `8aadefdf8fc08f25b2a0758cc49e784aabb52c0b`.
Máy: Microsoft Windows 11 Pro 10.0.26200; Node `v24.21.0`; Git `2.56.0.windows.2`.

Mỗi phép đo có năm mẫu liên tiếp; thời gian là mili giây. Repo có thay đổi chưa theo dõi duy nhất là thư mục script
của spike này, nên `git status --porcelain=v2 -z` có 37 byte và phép `--others` có một path. Các lệnh Git của lần
đo này bị giới hạn 5.000 ms mỗi subprocess; không có timeout nào xảy ra.

## Cách tái lập

Từ gốc repo, chạy chính xác:

```powershell
node docs/design/project-graph/scripts/git-bench/git-bench.mjs --runs 5 --timeout-ms 5000 --hash-concurrency 16 --json
```

Script chỉ gọi `git` qua `node:child_process` với `shell: false`, có timeout theo subprocess, chỉ đọc repo, và in
JSON để có thể so sánh các lượt sau. `--repo`, `--runs`, `--timeout-ms` và `--hash-concurrency` cho phép thay đổi
đầu vào khi cần; mặc định là gốc repo, năm mẫu, 30.000 ms và 16 worker đọc hash.

## Danh sách path

| Lệnh | Path | Byte output (min / median / max) | Thời gian ms (min / median / max) |
| --- | ---: | ---: | ---: |
| `git ls-files -z` | 2.386 | 114.573 / 114.573 / 114.573 | 217,649 / 326,611 / 355,688 |
| `git ls-files -z --others --exclude-standard` | 1 | 58 / 58 / 58 | 182,725 / 216,435 / 348,178 |

Phân loại 2.386 path theo phần mở rộng: `.ts` 1.314, `.tsx` 519, `.md` 263, `.json` 76, `.ndjson` 56, `.png` 42,
`.mjs` 38, các phần mở rộng khác 78. Có 880 file test (`*.test.ts(x)` hoặc trong `test/`). Theo package: `work`
1.066, `web` 923, `contract` 42, `desktop` 41, `api-client` 14; các path còn lại nằm ngoài `packages/<x>`.

## Lịch sử và co-change

Lệnh cho từng hàng là `git log --name-status -M -z --no-merges --format=%x00%H%x00`, thêm `-n N` cho N=100 và
N=300. “Cặp” là một bản ghi thay đổi `(commit, file)`; rename/copy vẫn là một thay đổi, dù có hai path trong bản ghi.

| N | Commit | Cặp | Byte output (min / median / max) | Thời gian ms (min / median / max) |
| --- | ---: | ---: | ---: | ---: |
| 100 | 100 | 412 | 24.314 / 24.314 / 24.314 | 345,606 / 364,398 / 495,672 |
| 300 | 300 | 1.436 | 83.156 / 83.156 / 83.156 | 426,128 / 435,771 / 490,941 |
| toàn bộ | 465 | 9.544 | 554.439 / 554.439 / 554.439 | 556,244 / 657,028 / 802,947 |

| N | File/commit median | p90 | p95 | p99 | max |
| --- | ---: | ---: | ---: | ---: |
| 100 | 3 | 8 | 10 | 26 | 34 |
| 300 | 3 | 10 | 17 | 33 | 45 |
| toàn bộ | 3 | 16 | 27 | 452 | 2.822 |

### Gộp lô so với từng commit

Hai cách cùng xét 50 commit không-merge gần nhất. Cách thứ hai gọi
`git diff-tree -M --no-commit-id --name-status -r -z <commit>` 50 lần nối tiếp.

| Cách | Byte output (min / median / max) | Thời gian ms (min / median / max) |
| --- | ---: | ---: |
| một `git log` gộp | 14.346 / 14.346 / 14.346 | 275,020 / 388,751 / 427,688 |
| 50 `git diff-tree` nối tiếp | 12.146 / 12.146 / 12.146 | 11.099,308 / 12.663,664 / 13.366,439 |

## Băm và freshness

“File code” là 1.872 path tracked có phần mở rộng `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` hoặc `.cjs`, tổng
20.421.670 byte. Hai phép Node đọc cùng tập file bằng pool 16 worker; không so sánh giá trị digest với Git vì
`git hash-object` băm theo object format Git còn `node:crypto` băm raw content.

| Phép đo | Byte đọc/output (min / median / max) | Thời gian ms (min / median / max) |
| --- | ---: | ---: |
| `git hash-object --stdin-paths` | 76.752 / 76.752 / 76.752 output | 755,287 / 801,278 / 899,811 |
| `node:crypto` SHA-1 | 20.421.670 / 20.421.670 / 20.421.670 đọc | 2.845,988 / 3.501,079 / 4.948,325 |
| `node:crypto` SHA-256 | 20.421.670 / 20.421.670 / 20.421.670 đọc | 2.319,943 / 3.428,085 / 6.863,333 |
| `git rev-parse HEAD` | 41 / 41 / 41 output | 166,251 / 172,167 / 222,729 |
| `git status --porcelain=v2 -z` | 37 / 37 / 37 output | 183,582 / 194,396 / 313,339 |

## Nhiễu lịch sử

Heuristic bot (tên hoặc email khớp `bot|dependabot|renovate|github-actions`) đếm 0 commit. Lịch sử `HEAD` có 152
merge commit và 9 commit chạm lockfile (tên lockfile phổ biến của npm/yarn/pnpm/bun/composer/go/cargo/Python).
Con số bot là gợi ý cho bộ lọc, không chứng minh lịch sử không có automation dùng tên khác.

## Khuyến nghị

- Miner co-change lần đầu nên dùng **một** `git log --name-status -M -z --no-merges` gộp, trần ban đầu **300 commit**
  và timeout **5 giây**. Median 435,771 ms, 83.156 byte và 1.436 cặp cho phép dựng cache nhanh; mở rộng toàn bộ
  lịch sử chỉ khi cần và vẫn dưới 803 ms trong lượt đo này.
- Không gọi `diff-tree` theo từng commit trên hot path: median cho 50 commit chậm khoảng **32,6 lần** so với lệnh gộp.
  Phân tích kết quả trong bộ nhớ sau một lần spawn, thay vì fan-out tuần tự.
- Bỏ qua merge, lockfile và bot theo cấu hình/heuristic; đánh dấu hoặc giảm trọng số commit lớn. Trong 300 commit,
  p99 là 33 và max 45 file/commit; dùng **>45 file** làm ngưỡng loại nhiễu ban đầu là dễ giải thích, rồi S5/R1 phải
  kiểm lại precision trước khi biến nó thành chính sách.
- Kiểm freshness rẻ nhất là `rev-parse HEAD` (median 172,167 ms); `status --porcelain=v2 -z` (194,396 ms) chỉ nên
  dùng khi truy vấn phải bao gồm thay đổi worktree. Không đưa hai spawn này vào hot path stream; cache và debounce
  theo yêu cầu truy vấn.
- Với bulk digest của tracked code, `git hash-object --stdin-paths` nhanh hơn hai phép băm raw Node trong lần đo này.
  Chỉ dùng nó nếu schema cache chấp nhận Git object ID; nếu cần digest raw, chọn một thuật toán Node cố định và đọc
  theo lô có trần concurrency.

Kết quả này là số liệu cục bộ của máy và commit nêu trên, không phải ngưỡng CI hay SLA.
