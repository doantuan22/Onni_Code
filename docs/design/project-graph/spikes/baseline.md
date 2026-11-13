# N0 — Baseline môi trường

Ngày đo: **2026-11-13** (giờ Bangkok, UTC+07). Worktree: Windows 11 Pro; Node **v24.21.0**; npm **11.19.0**. Commit trước khi đo: `8aadefdf8fc08f25b2a0758cc49e784aabb52c0b`. Lệnh chạy lần lượt, sau một `npm ci` sạch; không sửa lockfile hay mã nguồn.

## Kết quả

Thời gian tường, exit code và số test lấy từ kết quả lệnh. “—” nghĩa là lệnh không chạy bộ test.

| Lệnh | Thời gian | Exit | Pass | Fail | Skip | Ghi chú |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `npm ci` | 23.2 s | 0 | — | — | — | Cài 528 packages; npm audit báo 17 vulnerabilities (3 low, 5 moderate, 8 high, 1 critical). npm 11 cảnh báo install script `esbuild@0.28.1` chưa được cho phép. |
| `npm run typecheck` | 32.2 s | 0 | — | — | — | Client, server, web đều hoàn tất. |
| `npm run test:unit` | 6.8 s | 1 | 45 | 2 | 1 | 48 tests. Hai lỗi shell/path của Windows, chi tiết dưới đây. |
| `npm run build` | 18.2 s | 0 | — | — | — | Build và `check:pack` thành công; có cảnh báo chunk Vite lớn hơn 500 kB. |
| `npm run test:package` | 52.7 s | 0 | 4 | 0 | 0 | Bốn test tarball/CLI đều qua. |
| `npm test` | 13 min 59.6 s | 1 | 13,502 | 99 | 48 | 13,649 tests trong 870 files: 842 files pass, 24 fail, 4 skip. Vitest báo thời lượng 837.63 s. |

## Phân loại lỗi

### Windows đã biết — 2 test trong `test:unit`

- `test-env-launcher.test.ts`: `spawnSync /bin/sh ENOENT`; native Windows không có `/bin/sh`. `AGENTS.md` nêu rõ lỗi này; chạy suite này dưới WSL hoặc để CI xử lý, không skip test.
- `skills-remote.test.ts`: `spawnSync mkdir ENOENT` khi gọi POSIX `mkdir -p` trên Windows. Đây cũng là lỗi tiện ích shell/path của môi trường native; đầu ra cho thấy không tìm được executable `mkdir`.

### Lỗi thật / lệch dependency đã xác minh — 0

- Không thấy lỗi typecheck do `undici`/`maxRedirections` sau cài sạch. `npm ls undici`: `@onni/work` dùng **undici@6.29.1**; nhánh `@ai-sdk/provider-utils` và `jsdom` dùng **undici@7.30.0**.
- Build, pack gate và toàn bộ 4 test package qua. Chưa có lỗi sản phẩm hoặc lệch dependency nào được xác nhận từ lần đo này.

### Chưa rõ nguyên nhân — 99 test trong `npm test`

Vitest compact reporter chỉ ghi tên test thất bại và suite, không in assertion/error stack; vì vậy không thể xác nhận nguyên nhân từng test chỉ từ log này. Các suite chạm vào worktree, git, process, filesystem và shell phù hợp với cảnh báo chung trong `AGENTS.md` rằng native Windows có khoảng 340 lỗi môi trường. Xếp 99 lỗi vào **chưa rõ (có khả năng môi trường Windows)**, giữ chúng làm baseline và để CI quyết định; không coi là lỗi sản phẩm đã chứng minh.

| Suite | Fail |
| --- | ---: |
| `src/automations/store.test.ts` | 1 |
| `src/workflows/system-prompt.test.ts` | 3 |
| `src/worktree-lifecycle/coordinator.test.ts` | 15 |
| `src/server/git-changes.test.ts` | 4 |
| `src/workflows/worktree-lifecycle.test.ts` | 8 |
| `src/automations/deferred-start.test.ts` | 1 |
| `src/server/forge/draft-pr-autosave.test.ts` | 3 |
| `src/automations/deferred-dispatch.test.ts` | 1 |
| `src/server/worktree-lifecycle.test.ts` | 2 |
| `src/workflows/landing.test.ts` | 15 |
| `src/workflows/trunk-based.test.ts` | 1 |
| `src/workflows/run.test.ts` | 1 |
| `src/workflows/push-guard.test.ts` | 18 |
| `src/workflows/lifecycle-settlement.test.ts` | 2 |
| `src/server/repo-sync.test.ts` | 9 |
| `src/worktree-lifecycle/executor.test.ts` | 4 |
| `src/runs/store-concurrency.test.ts` | 1 |
| `src/server/worktrees-api.test.ts` | 1 |
| `src/workflows/branch-naming.test.ts` | 1 |
| `src/core/windows-job-process.test.ts` | 1 |
| `src/worktree-lifecycle/templates.test.ts` | 1 |
| `src/routes/task-git/task-changes.test.tsx` (web) | 1 |
| `src/components/theme-provider.test.tsx` (web) | 4 |
| `src/components/theme-toggle.test.tsx` (web) | 1 |
| **Tổng** | **99** |

## Đề xuất cổng P1

- Trên máy này, dùng `npm run typecheck`, `npm run build` (kể cả `check:pack`) và `npm run test:package` làm cổng local đáng tin: cả ba qua trong lần đo sạch.
- `npm run test:unit` và `npm test` không phải cổng chặn local Windows hiện tại. Khi so với baseline `onni task verify --baseline`, giữ nguyên hai lỗi unit đã nêu và 99 test/suite trên làm lỗi nền; mọi test mới hỏng vẫn phải được báo. Không nới baseline dựa trên lần chạy này.
- Cổng quyết định cho P1 là CI: yêu cầu typecheck, unit, build, package và các shard Vitest qua trên runner CI được hỗ trợ; phân biệt riêng lỗi môi trường Windows đã biết với hồi quy. Không lấy kết quả “subset pass” làm bằng chứng đủ test.

## Tái lập

Từ root repo trên cùng máy, chạy tuần tự:

```powershell
npm ci
npm run typecheck
npm run test:unit
npm run build
npm run test:package
npm test
npm ls undici
```

Log thô được lưu ngoài git-tracked state tại `.ai/onni/tmp/n0-logs/` trong worktree này; không commit log. Kết quả chỉ mô tả máy và phiên bản nêu trên.
