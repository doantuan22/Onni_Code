# Đánh giá cơ chế tự sửa lỗi One & One

Ngày kiểm tra: 26/11/2026, múi giờ Asia/Bangkok. Mã nguồn: nhánh `dev`, HEAD `11c02bd`.

## Kết luận

One & One **đã tự phục hồi được một số lỗi điều phối**, nhưng **chưa có vòng tự sửa lỗi khép kín được engine xác minh**, và chưa thể coi là đã tối ưu. Nó có thể giúp hai agent sửa lỗi bằng vòng giao việc → thực hiện → review → giao lại; chất lượng sửa vẫn phụ thuộc vào agent và việc chúng thực sự chạy kiểm chứng.

Phân biệt ba mức:

1. Giữ cặp agent tồn tại sau lỗi: có.
2. Tự khôi phục tiến trình làm việc sau mọi lỗi có thể phục hồi: chưa; còn đường bị kẹt và mất thông báo.
3. Tự chứng minh lỗi trong mã nguồn đã được sửa, không hồi quy: chưa; không có điều kiện kiểm chứng bắt buộc gắn với acceptance và checkpoint hiện tại.

Kết luận dựa trên đọc code, lịch sử Git, 131 test hiện có và 6 tình huống chèn lỗi trong repository tạm. Đây không phải benchmark khả năng sửa bug của các model thật: không gọi CLI/provider agent trả phí và không dùng một dry-run thành công làm bằng chứng sửa được mã nguồn thật.

## Cơ chế hiện tại

Luồng chính:

`planning → worker_queued → worker_working → manager_review → final_check → user_wait`

Manager có thể giao order mới thay vì accept, tạo vòng revision. Worker bình thường dùng lại run/session; worker failed/cancelled được thay bằng worker mới. Hai bên dùng chung checkout và branch; engine checkpoint các thay đổi bằng Git.

- Worker kết thúc bằng `ONNI:DONE`; Antigravity có fallback cho final text không rỗng, không chứa ASK/MONITORING.
- Engine checkpoint, đọc diff, lưu report, chuyển sang manager review rồi gửi report cho manager.
- Manager accept qua CLI/API hoặc marker `ONNI:PAIR:ACCEPT`.
- Engine chặn accept và DONE trong cùng turn. Turn sau được nhắc chạy final verification; engine không bắt buộc có kết quả kiểm tra thực tế trước khi park.
- Pair được giữ lâu dài tại `user_wait`; Finish là thao tác đóng cặp của người dùng.

Nguồn: `dispatch/pair-prompts.ts`, `workflows/run/dispatch.ts:509`, `workflows/run/pair-coordinator.ts:228`, `workflows/run/manager-state.ts:362`, dưới `packages/work/src/`.

## Những phần tự phục hồi có thật

| Tình huống | Hành vi hiện tại | Giới hạn |
| --- | --- | --- |
| Lock tạm thời khi lưu worker report | Retry sau 150/500/1.500 ms; thử đầu + tối đa 3 lần retry | Không bao phủ toàn bộ checkpoint/diff/accept |
| Report đã ghi nhưng phase chưa đổi | `reportOrder` gọi lại có thể hoàn tất chuyển phase; reconciler cũng có nhánh sửa | Chỉ xử lý một số tổ hợp state/order |
| Worker failed/cancelled | Ghi failure report và đánh thức manager; giữ pair mở | Quyết định giao lại phụ thuộc manager; failure report vẫn có thể được accept |
| Relay failure gặp lock | Có retry nền 1/3/10 giây | Bộ nhớ timer mất khi restart; sweep chỉ phủ các phase nhất định |
| Worker `running` không còn owner | Sweep xác nhận ghost sau grace 30 giây rồi báo thất bại | Sweep mỗi 15 giây; không áp dụng worker `waiting` |
| Worker còn live nhưng im lặng | Sau 20 phút ghi cảnh báo | Chỉ ghi note; không tự phục hồi hoặc chủ động giao lại |
| Restart | Có thứ tự hồi phục worker trước manager, giữ các trạng thái park cần review | Chưa bao phủ mọi cửa sổ crash và giao nhận report |

Nguồn: `git-repository-lock.ts:18`, `workflows/run/pair-coordinator.ts:126`, `workflows/run/pair-reconcile.ts`, `workflows/run/lifecycle.ts:36`, `workflows/run.ts:978` và `:1411`.

Lịch sử liên quan: `9e652e3` giữ pair qua lỗi; `86d6072` handoff Antigravity; `18bd03f` sửa released lease; `2bde45b` retry lock; `0d7d6ac` reconcile worker; `11c02bd` hồi phục handoff gián đoạn. Các bản sửa giải quyết những lỗi thực, nhưng không chứng minh mọi đường đã khép kín.

## Phát hiện được tái hiện

Mức P1 dưới đây nghĩa là cần ưu tiên vì có thể báo thành công sai hoặc làm ngừng tiến triển tự động. Đây là các tình huống được dựng để kiểm tra cơ chế, không phải khẳng định chúng đã xảy ra trong task thực tế của người dùng.

### F1 — P1: Failure report vẫn được accept, không cần bằng chứng test

Tái hiện:

1. Đặt worker failed với lỗi `tests failed: expected 2, got 1`.
2. Gọi relay của engine: order trở thành `reported`, report bắt đầu bằng `WORKER ENDED EARLY (failed)`.
3. Gọi `pairAcceptFor` bằng identity của manager: API vẫn trả order `accepted`.
4. Gọi luồng final checkpoint/park: thành công, phase thành `user_wait`.

Order trong probe có cả success criteria `tests pass` và required evidence `test result`. Không có test nào được chạy để đạt hai điều kiện đó.

Nguyên nhân: failure được mã hóa trong chuỗi report, dùng chung status `reported` với report thành công. Acceptance chỉ kiểm tra vai trò, phase, current order và status. Lời nhắc “Do not accept this order” chỉ nằm trong text gửi model. Final checkpoint chứng minh trạng thái Git được lưu, không chứng minh chương trình đúng.

Nguồn: `workflows/run/pair-coordinator.ts:176–187`, `dispatch/pair-controls.ts:204–231`, `dispatch/pair-store.ts:426–431`, `contract/src/one-and-one.ts:46–47`.

Hướng sửa: thêm outcome có cấu trúc, tương thích record cũ; failure không được dùng đường accept thành công thông thường. Lưu bằng chứng verification gắn với order và checkpoint SHA. Phải định nghĩa rõ trường hợp không có lệnh test có thể tự khám phá, không bắt người dùng tạo config.

### F2 — P1: `onni task verify` không dùng được cho worker shared checkout

Tái hiện: worker One & One đã `done`, repo có script test có thể khám phá, gọi hàm đứng sau `onni task verify`. Kết quả:

```json
{
  "state": "unavailable",
  "reasonCode": "no-worktree",
  "source": "discovered",
  "results": []
}
```

Nguyên nhân: verifier lấy `target.worktreePath` và trả unavailable nếu thiếu. Worker One & One cố ý không có worktree riêng. Thông báo “worktree ... was reclaimed” còn mô tả sai trường hợp này.

Manager vẫn có thể tự chạy test qua shell. Phát hiện này nói đường kiểm chứng do engine quản lý không hỗ trợ topology hiện tại, không có nghĩa manager hoàn toàn không thể kiểm tra mã.

Nguồn: `workflows/run/verify.ts:125–127`; cấu hình worker `worktree: false` trong `workflows/run/dispatch.ts:576`.

Hướng sửa: verifier hiểu pair workspace, khóa hoặc điều phối để không có peer chỉnh file trong lúc kiểm chứng, ghi SHA và kết quả. Baseline dùng baseline của pair; không thay topology shared checkout.

### F3 — P1: Lưu report xong nhưng gửi manager thất bại thì không gửi lại

Tái hiện: cho `deliverMessage`, `deferMessage` và `continueRun` đều từ chối. `handlePairWorkerTurn` vẫn trả `{ handled: true, ok: true }`; phase đã là `manager_review`. Sau 5 sweep bổ sung, số lần deliver/defer/resume vẫn là 1/1/1.

Nguyên nhân: delivery không trả trạng thái giao nhận bền vững; khi thất bại chỉ append note. Sweep bỏ qua manager có phase khác `worker_queued`/`worker_working`. Nếu crash sau chuyển phase nhưng trước delivery, cũng có cùng khoảng hở thiết kế.

Failure relay còn có early-return cho failure report đã lưu, nên gọi lại relay không tự bảo đảm gửi lại report.

Nguồn: `workflows/run/pair-coordinator.ts:167`, `:208–225`; `workflows/run/pair-reconcile.ts:55`.

Hướng sửa: durable outbox với message ID, order ID, revision và ack; retry có giới hạn, chống gửi trùng, tôn trọng manager người dùng đã dừng. Reconcile cả `manager_review`, không chỉ worker đang làm.

### F4 — P1: Worker đóng vì idle có thể bị bỏ ngoài tự phục hồi

Tái hiện bằng chính nhánh settlement idle:

```text
worker.status = waiting
order.status = working
pair.phase = worker_working
preparePairContinuation(manager) = refused: must wait for worker report
```

Sau nhiều sweep với thời gian mô phỏng cách nhau một giờ, trạng thái không đổi.

Nguyên nhân: settlement giữ mọi live pair participant ở `waiting` khi idle; reconciler chỉ xử lý failed/cancelled/running. Một worker không còn session nhưng `waiting` không bị xem là ghost. Manager không nhận report và đường continuation của manager đang bị chặn để chờ worker.

Người dùng vẫn có thể can thiệp, chẳng hạn tiếp tục/dừng worker; đây là thiếu tiến triển tự động, không khẳng định dữ liệu không thể phục hồi.

Nguồn: `workflows/run/settlement.ts:253–259`, `workflows/run/pair-reconcile.ts:132–146`, `workflows/run/pair-coordinator.ts:346`.

Hướng sửa: phân biệt manager chờ người dùng với worker mất khả năng chạy. Worker hết thời gian chờ có thể chuyển thành failure report có cấu trúc; không tự trả lời câu hỏi thay người dùng và không hủy pair.

### F5 — P1: Crash giữa hai lần ghi acceptance để lại state không tự hòa giải

Tái hiện mô phỏng crash bằng trạng thái lưu đúng giữa hai write:

```text
orders.json: current order accepted
state.json: manager_review
```

Reconcile không sửa; retry accept trả 409 `only a reported order can be accepted`; final park từ chối vì phase chưa là `final_check`/`transitioning`. Manager có thể chọn giao lại order để thoát, nhưng acceptance đã thực hiện không được tự hoàn tất.

Nguyên nhân: mỗi file atomic, nhưng cặp thay đổi chưa phải một transaction. `reportOrder` đã có đường idempotent cho cửa sổ tương tự; `acceptOrder` chưa có.

Nguồn: `dispatch/pair-store.ts:426–431`, đối chiếu `:397–418`; `dispatch/pair-controls.ts:218`.

Hướng sửa: acceptance idempotent, hoàn tất phase khi cùng current order đã accepted; hoặc journal giao dịch và reconciler bao phủ toàn bộ trạng thái trung gian. Ràng buộc order ID/revision để không hồi sinh acceptance cũ.

### F6 — P2: Retry lock chưa bao phủ toàn bộ handoff

Tái hiện: giữ repository lease trong cùng process rồi gọi checkpoint từ context khác. Checkpoint trả lỗi `One & One repository is already locked in this process` sau khoảng 49 ms; không chờ retry bất đồng bộ.

Đây là fail-closed đúng về bảo vệ khóa, nhưng chưa phải tự phục hồi khi contention chỉ tạm thời. Worker handoff gọi checkpoint và inspect diff trước đoạn `retryTransientLock` bọc lưu report. Lỗi ở bước trước vẫn khiến worker thất bại và có thể phải gọi lại model. Final checkpoint lỗi thì park và yêu cầu message từ người dùng để retry.

Nguồn: `workflows/run/pair-coordinator.ts:245–265`, `workflows/run/settlement.ts:293–300`, `git-repository-lock.ts:195`.

Hướng sửa: trả loại lỗi có cấu trúc từ checkpoint/diff, retry bất đồng bộ chỉ cho lỗi transient; trước mỗi retry đọc lại phase, order và SHA. Không retry mù phần Git write đã có thể commit thành công. Không retry conflict, branch mismatch hay lỗi quyền ghi như thể chúng là contention.

## Đánh giá tối ưu

Các điểm tốt: tái sử dụng worker/session ở vòng revision bình thường; retry có giới hạn; checkpoint dùng path cụ thể và tránh state nội bộ; lock có owner identity; giới hạn 20 revision/order scope, 100 handoff; sweep có xử lý ghost và không giết ngay tiến trình build im lặng.

Các điểm nên tối ưu sau khi sửa tính đúng:

- `inspectPairDiff` luôn tạo full patch rồi cắt ở 200.000 ký tự; handoff chỉ dùng name-status/stat, không dùng `diff`. Đây là công việc thừa và có thể đụng `maxBuffer` 8 MiB trước khi cắt. Cho phép gọi chỉ lấy metadata khi không cần patch. Nguồn: `pair-runtime.ts:44–49`, `:298–322`, `pair-coordinator.ts:277–299`.
- Sweep lặp qua `listRuns()` rồi đọc state/order từ đĩa mỗi 15 giây. Chưa đo tải repo lớn; không khẳng định đây đang là bottleneck. Có thể dùng index pair đang mở nếu profiling cho thấy cần.
- Không có dấu hiệu engine so sánh fingerprint lỗi hoặc kết quả test giữa hai revision để biết sửa có tiến triển. Cap revision giúp chặn vòng dài, nhưng không tự chọn chiến lược khác khi lặp cùng lỗi.
- Các lời hứa “Onni owns every Git write” chủ yếu là quy ước prompt và API fence; không phải sandbox cho mọi backend. Validation đang cho phép HEAD drift ở các đường checkpoint/continuation. Không nên diễn giải việc bỏ qua HEAD drift là chứng minh lỗi đã được sửa an toàn.

Không thể tính tỷ lệ sửa thành công, số vòng trung bình hoặc token/bug từ những test điều phối này. Cần bộ bug có oracle kiểm tra độc lập và agent thực tế mới đo được.

## Kiểm chứng đã chạy

Lệnh qua pinned Vitest của repository:

```powershell
npm test -- packages/work/src/workflows/run/pair-reconcile.test.ts packages/work/src/workflows/run/pair-coordinator.test.ts packages/work/src/workflows/run/pair-runtime-lock.test.ts packages/work/src/workflows/run/pair-lifecycle.test.ts packages/work/src/workflows/run/pair-settle.test.ts packages/work/src/workflows/run/pair-startup.test.ts packages/work/src/workflows/run/pair-turn.test.ts packages/work/src/dispatch/pair-store.test.ts packages/work/src/dispatch/pair-store-lock.test.ts packages/work/src/dispatch/pair-controls.test.ts packages/work/src/git-repository-lock.test.ts packages/work/src/server/pair-api.test.ts
```

Kết quả: **12 file, 130 test đạt, 1 test fail**, thời gian 62,71 giây. Lần đầu sandbox chặn spawn `EPERM`; kết quả trên là lần chạy với quyền host để các fixture Git hoạt động.

Test fail tại `packages/work/src/server/pair-api.test.ts:385`: mong lỗi chứa `completed or stopped`, thực nhận `pair peers must be done, failed or cancelled before deletion`. HTTP vẫn là 409; đây chưa phải bằng chứng fence bị vượt qua. Chạy riêng test cùng tên vẫn fail. Vì assertion dừng tại đó, các assertion phía sau của test này chưa được xác nhận trong lần chạy.

Script chẩn đoán chỉ đặt ở `.tmp/`, không thay production code hay test suite:

```powershell
node --import tsx .tmp/one-and-one-self-heal-audit.ts
```

Kết quả chi tiết: `.tmp/one-and-one-self-heal-audit-results.json`. Cả 6 probe dùng implementation thật cùng Git/store trong thư mục tạm; delivery và liveness được điều khiển để dựng lỗi; cửa sổ crash acceptance được mô phỏng bằng dữ liệu ở giữa hai write. Các probe chứng minh đường lỗi, không phải test hồi quy xanh cho một bản sửa.

Chưa chạy toàn bộ repo typecheck/build/unit/E2E và chưa chạy benchmark model thật. Không sửa code sản phẩm, không commit/push; các thay đổi desktop có sẵn được giữ nguyên.

## Thứ tự xử lý đề xuất

1. Khép đường tiến triển: durable delivery F3, xử lý worker idle F4, acceptance idempotent F5.
2. Khép điều kiện thành công: verifier cho shared checkout F2 và outcome/evidence gate F1. Verification phải gắn order/revision/SHA, mất hiệu lực khi mã đổi; `unavailable` không được hiển thị là passed.
3. Hoàn thiện retry F6; gom logic finalize/park đang gần trùng nhau để giảm lệch hành vi, sau khi có test giữ các chuyển trạng thái hiện tại.
4. Kiểm tra bằng fault injection qua restart thật tại từng mốc ghi state và giao report; bao phủ ít nhất marker backend thông thường và handoff Antigravity.
5. Đo bằng bộ bug thật có test tái hiện đỏ trước sửa, xanh sau sửa; kiểm tra hồi quy bằng engine, số vòng, thời gian, token, vòng lặp lỗi và số lần cần người dùng. Không đặt tỷ lệ thành công trước khi có số đo.
