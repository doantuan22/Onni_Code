# Checklist kiểm thử One & One

> Trạng thái: merge vào `dev` theo yêu cầu, nhưng các bước xác minh chưa hoàn thành vẫn được giữ dưới dạng TODO. Mục chưa đánh dấu **không** được coi là đã kiểm thử hoặc đạt yêu cầu.

## Kết quả focused đã chạy

- [x] `packages/work/src/workflows/run.test.ts`: 176 test đạt.
- [x] `pair-coordinator.test.ts`, `pair-controls.test.ts`, `pair-mutation.test.ts`: 3 file, 17 test đạt.
- [x] `graph-system-nodes.test.ts` với bộ lọc One & One: 2 test đạt.
- [x] Frontend focused gồm roster editor, roster helpers, preset, new-task form, task tree và i18n coverage: 6 file, 140 test đạt.
- [x] Typecheck contract, api-client và server đạt trong lần chạy gần nhất.
- [x] Typecheck web đạt sau khi chạy lại riêng; lỗi narrowing trước đó không còn.
- [x] Test hồi quy chặn acceptance và completion trong cùng một manager turn, đồng thời không chặn turn sau.
- [x] Test hồi quy chặn graph `git.commit` và workflow fork của One & One.

## Xác minh bắt buộc còn nợ

- [x] Chạy lại `npm run typecheck` sau thay đổi cuối của `edit-workers-button.tsx`.
- [x] Chạy `npm run build` (tsc → dist, vite → web/dist, check:pack).
- [x] Chạy `npm run test:package` (5 test, gồm tarball install + dry-run CLI).
- [ ] Chạy toàn bộ `npm test` — tạm hoãn theo yêu cầu; các test cần thiết đã chạy riêng và xanh (~891 test).
- [ ] Chạy toàn bộ `npm run test:unit` — 1 test fail ngoài phạm vi One & One (`test-env-launcher.test.ts`, nohup fallback exit 127, do môi trường Windows).
- [ ] Chạy `npm run test:e2e`; nếu provider trình duyệt không được cấp thì ghi `skipped`, không ghi `passed`.

## Test tích hợp còn nợ

- [x] Test từ chối cross-pair / identity mismatch trước khi mutation (pair-api.test.ts, pair-controls.ts `authorizePairCaller`).
- [x] Test thao tác Git toàn repository chỉ bị chặn khi pair live, được phép sau khi `complete`/`stopped` (pair-api.test.ts).
- [x] Chạy focused test cho `PairCard` và fixture mới (`pair-card.test.tsx`, 3 test).
- [x] Chạy toàn bộ contract parity, route parity và typed-body tests (33 test xanh).
- [ ] Kiểm tra toàn bộ API/CLI One & One trên instance chạy thật.
- [ ] Kiểm tra hồi phục sau restart với worker rồi manager.
- [ ] Kiểm tra hủy/lỗi một peer luôn dừng peer còn lại.
- [ ] Kiểm tra race chuyển `stopped` trong lúc checkpoint/report bất đồng bộ.
- [ ] Kiểm tra revision cycle tái sử dụng cùng worker run ID và session provider.
- [ ] Kiểm tra cap 20 revision, cap 100 handoff và supersede order/proposal.
- [ ] Kiểm tra redaction khi toàn bộ text bắt buộc bị thay thế.
- [ ] Kiểm tra không còn regression của Manager–Worker fan-out mặc định.

## QA giao diện còn nợ

- [ ] Tạo task One & One từ UI và xác nhận chỉ một manager, một worker, concurrency 1.
- [ ] Xác nhận không tạo worktree riêng, không sinh `onni/<id8>`, không bật new branch.
- [ ] Xác nhận cả hai peer dùng repository root và branch hiện tại.
- [ ] Xác nhận khóa Working mode sau khi bắt đầu và khóa backend/model của worker đã admitted.
- [ ] Xác nhận dialog Edit workers chỉ cho sửa role/traits của peer đã admitted.
- [ ] Kiểm tra phase, active role, order revision/status, branch và checkpoint cập nhật realtime.
- [ ] Kiểm tra pair card hiển thị snapshot authoritative, collection bound và long-text expansion.
- [ ] Kiểm tra bàn phím, focus, label, contrast, responsive và tiếng Việt UI.
- [ ] Kiểm tra manager/worker nhận message, proposal, decision và acceptance đúng peer.
- [ ] Kiểm tra golden path từ planning tới complete trên shared checkout.

## Rủi ro/khoảng trống kỹ thuật còn mở

- [x] Khóa repository xuyên process — `git-repository-lock.ts` (proper-lockfile, khóa theo git-common-dir), kèm `git-repository-lock.test.ts`, `pair-store-lock.test.ts`, `pair-runtime-lock.test.ts`.
- [ ] Chưa có cơ chế phủ nhận lệnh Git-write cho mọi backend; hiện dựa vào prompt và fail-closed validation. (giới hạn thiết kế còn mở, cần quyết định của owner)
- [x] Đã chốt: `PAIR_FORBIDDEN_SYSTEM_NODES` chặn mọi node ghi Git/GitHub/network (`git.commit`, `github.draft-pr`/`pr-comment`/`pr-update`/`issue-comment`, `git.push`, `git.sync-base`, `notify.webhook`, `dispatch`, `workflow`).
- [x] Đã chốt semantics xóa pair — `pair-deletion.ts` (chỉ xóa pair `complete`/`stopped`, intent bền vững + phục hồi sau restart), kèm `pair-deletion.test.ts`.
- [x] Cap lưu trữ — `ONE_AND_ONE_MAX_MESSAGES`/`PROPOSALS`/`DECISIONS`/`ORDER_REVISIONS`/`HANDOFFS` trong `pair-store.ts`.
- [x] `PairStatusLine` short-circuit khi root đã có `dispatch.pair`, không gọi `useRunPair()`.

## Ghi chú thực thi

- Các file desktop đã có sẵn trước feature không được đưa vào commit One & One.
- Không push trong lần merge này.
- Không dùng `--no-verify` hay bỏ qua hook nếu hook chặn commit.
