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

- [ ] Chạy lại `npm run typecheck` sau thay đổi cuối của `edit-workers-button.tsx`.
- [ ] Chạy toàn bộ `npm test`.
- [ ] Chạy toàn bộ `npm run test:unit`.
- [ ] Chạy `npm run build`.
- [ ] Chạy `npm run test:package`.
- [ ] Chạy `npm run test:e2e`; nếu provider trình duyệt không được cấp thì ghi `skipped`, không ghi `passed`.

## Test tích hợp còn nợ

- [ ] Test worker từ chối khởi động khi membership hoặc worker identity không khớp persistent pair.
- [ ] Test route chứng minh thao tác Git toàn repository chỉ bị chặn khi còn pair live, không chặn pair lịch sử.
- [ ] Chạy focused test cho `PairCard` và các fixture mới.
- [ ] Chạy toàn bộ contract parity, route parity và typed-body tests.
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

- [ ] Chưa có khóa repository xuyên process; hiện chỉ có lease trong process.
- [ ] Chưa có cơ chế phủ nhận lệnh Git-write cho mọi backend; hiện dựa vào prompt và fail-closed validation.
- [ ] Chưa quyết định các graph node ghi GitHub khác ngoài fork/commit/PR/push/sync-base có nên bị chặn.
- [ ] Chưa chốt semantics xóa/làm sạch lịch sử pair; pair completed/stopped hiện không thể bị xóa qua flow thông thường.
- [ ] Chưa đặt cap lưu trữ riêng cho messages/decisions; UI mới chỉ giới hạn số phần tử render.
- [ ] `PairStatusLine` vẫn gọi `useRunPair()` kể cả khi root đã có `dispatch.pair`; có thể tối ưu sau.

## Ghi chú thực thi

- Các file desktop đã có sẵn trước feature không được đưa vào commit One & One.
- Không push trong lần merge này.
- Không dùng `--no-verify` hay bỏ qua hook nếu hook chặn commit.
