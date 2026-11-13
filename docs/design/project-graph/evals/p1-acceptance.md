# Biên bản chấp nhận P1 (thu hẹp) — PLAN.md §10 "Chấp nhận P1"

Ngày 2026-11-13, nhánh `onni/f57736aa`, Windows 11, Node v24.21.0, sau `npm ci` sạch trong worktree.

| Tiêu chí (§10) | Bằng chứng | Kết quả |
| --- | --- | --- |
| `impact/tests` đúng trên bộ vàng | `project-graph/golden.test.ts`: recall `imports` 623/631 = 98,7%, `reexports` 45/45, `type-imports` 201/201 (8 lệch là quy ước nhãn của bộ vàng: đích `@onni/contract` vs `index.ts`) | đạt |
| Xóa cache → tự dựng | `store.test.ts` "missing, corrupt and wrong-version…", `build.test.ts` "survives a missing, corrupt or wrong-version cache" | đạt |
| Không đọc `.env`/khóa | `build.test.ts` "never reads or hashes denylisted files…", `denylist.test.ts` (24 ca) | đạt |
| Build không làm trễ event loop | `build.test.ts` lô 10 + nhường: trễ tối đa 16 ms (ngưỡng test 200 ms; S1 đề xuất ≤ 50 ms) | đạt |
| Tắt công tắc → 409, không process nền | `server/project-graph-api.test.ts` "answers 409 on every graph route while ONNI_PROJECT_GRAPH is unset"; không build lúc boot (chỉ `onni graph build` / `POST /graph/rebuild`, trần 10 s/root) | đạt |
| `context` theo quyết định G0 | Không làm (ra khỏi P1) | — |
| Cổng repo | `npm run typecheck` 0, `npm run build` 0, `npm run test:package` 0; 24 file test chạm/thêm 328/328; `test:unit` 46/47 (fail còn lại = `test-env-launcher` `/bin/sh`, baseline Windows N0); cả bộ `npm test` để CI | đạt (cục bộ) |
| CLI chạy thật | `onni graph status` khi tắt in hướng dẫn bật; `impact git-changes.ts` → 7 dependents, 5 test (`git-changes.test.ts` high), `complete: true`; chạy được trên checkout commit cũ | đạt |
| **G-B** chạy trên bản này | `evals/g-b.md`: test cao+vừa recall validation 89,2% (CI95 82,7–95,3), bỏ sót 10/54 commit → `verify` **giữ chế độ gợi ý**; `complete=true` 98–100% câu hỏi validation | kết luận ghi lại |
| **G-A** chạy trên bản này | `evals/g-a.md`: pass như cánh off, chi phí cao hơn ở 3/3 tác vụ → **no-go cho H1**, P2 không bắt đầu | kết luận ghi lại |

Việc tồn đọng (không chặn P1, ghi cho lần mở lại):
- Hiệu chỉnh mức `high` của chọn test: với hub tối thiểu 20, tập `high` train p90 = 156 (prototype 9) — `evals/g-b.md` (c).
- Thử regex/CLI trên Node 20/22 và Linux/macOS (CI chạy Linux); `capabilities.projectGraph` đang `optional` trong
  `contract/health.ts` — đổi thành bắt buộc khi có task chạm web.
- Bộ vàng: nhãn `@onni/*` và `import()` ở vị trí kiểu.
- Runner `vitest related` (`ONNI_PROJECT_GRAPH_TOOLS=1`) dùng `execFile` timeout: trên Windows có thể không giết cả cây tiến
  trình con (cùng loại lỗi T2 của A/B) — xem lại nếu bật mặc định.
