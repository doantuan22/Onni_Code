# Thực hiện tối ưu skill — 20/11/2026

Đã tích hợp các sửa lỗi nạp skill và đồng bộ catalog trong source. Bộ chín adapter
vẫn là **pilot**; chưa có bằng chứng để công bố bản rút gọn tốt hơn hoặc thay toàn
bộ skill do người dùng/công cụ khác quản lý.

## Runtime

- Workflow chọn cùng tên với slash đầu task: body chỉ xuất hiện một lần, yêu cầu
  người dùng vẫn giữ. Hai skill khác tên vẫn được gửi theo lựa chọn rõ ràng.
- Dependency có thể khai báo rõ ràng. `[]` nghĩa là skill tự chứa; thiếu khai báo
  tiếp tục suy companion từ body như trước, có cap 24 và chống vòng lặp.
- Một closure local đầy đủ, có khai báo dependency, không chờ team load. Root
  thiếu, team root và legacy companion vẫn giữ timeout 10 giây. Chín adapter
  offline khai báo không có dependency; không cài thêm công cụ hoặc gọi mạng.
- Slash trong tin nhắn live đọc lại catalog và chuẩn bị file trước delivery.
  API nhận tin nhắn đồng bộ như cũ; bước chuẩn bị chạy tuần tự, giữ thứ tự các
  tin nhắn tiếp theo và lưu transcript nguyên văn một lần. Hủy task chặn delivery.
- Khi session đóng trong lúc chuẩn bị, đường settlement đợi chuyển tin nhắn đã
  nhận sang queue/deferred hiện có. Delivery manager thường và receipt vẫn đồng bộ.
- Tài nguyên team skill dùng commit đã resolve trong catalog, tránh trộn body ở
  revision cũ với references ở branch mới. Entry cũ thiếu commit vẫn dùng ref.

Frontmatter tương thích native skill:

```yaml
---
name: project-review
description: Review this project's interfaces.
metadata:
  onni-dependencies: '["helper-skill"]'
---
```

HTTP DTO dùng `dependencies: string[]` tùy chọn trên Skill, create và update.
PUT bỏ qua field thì giữ dependency cũ; gửi `[]` để bỏ companions. Sai schema
bị từ chối ở boundary. Frontmatter sai thì dùng legacy matching. Không biến
dependency hoặc role thành quyền thực thi.

Manifest nâng lên version 2 chỉ để ghi metadata/hash mới. Nội dung hướng dẫn
chưa đổi theo candidate. Cả chín thư mục tiếp tục qua skill-creator validator.

## Catalog và giao diện

Sự kiện `skills-changed` đi qua workspace bus/SSE hiện hữu, sau ghi thành công:

- Create/update/delete có scope thật: project chỉ làm stale project đó; global
  làm stale các catalog đã cache trên mọi project.
- Team refresh phát khi catalog active hoặc importable đổi; kết quả giống nhau
  không phát. Thay `importedSkills` cũng thông báo, còn preference không liên quan
  và giá trị lặp lại không phát sự kiện skill.
- Client hủy GET cũ trước khi invalidate catalog, ready và importable. Reconnect
  và trở lại tab cũng reconcile skill. Không thêm polling hoặc socket riêng.
- Snapshot `wait=1` cũ không ghi đè catalog mới khi picker mount lại.
- Ghi project UI state chuyển sang atomic write và serialize theo path để đổi
  selection đồng thời không làm mất preference của request khác.

Đây là đồng bộ thay đổi qua API và reconciliation, không phải filesystem watcher.
Sửa file bằng editor ngoài app được discovery đọc ở invocation tiếp theo; giao
diện hội tụ khi refresh/reconnect/trở lại tab. POST vẫn trả 409 khi trùng tên;
chưa thêm nút tạo override. Override trên disk vẫn ưu tiên built-in, xóa override
thì fallback xuất hiện lại. Không tự thay skill đã chọn bằng tên khác.

## Kiểm chứng

Regression trước fix đã bắt: body trùng ở payload runner, ví dụ bị kéo thành
companion, offline root chờ team, live delivery trước provisioning và dùng body cũ.
Sau sửa, các fixture kiểm soát promise và payload runner pass. Kiểm tra team dùng
repo Git local, chuyển branch sau discovery rồi đối chiếu reference trước/sau.

Các log kiểm tra bản cuối nằm trong `.tmp/skill-final-*`:

- Typecheck contract, api-client, server và web: pass.
- 22 suite tập trung: **348 test pass**, gồm SSE, CRUD, scope/reconnect,
  contract/route parity, UI và prompt/delivery.
- Sau khi tăng kiểm tra timestamp bằng nhau ở snapshot ready: **154 test web
  pass**, gồm thêm một regression case so với lượt 348 test.
- Tích hợp session dry-run: **9 test pass** cho task mới, Continue và follow-up;
  các test ngoài filter không được chạy, không phải bị thêm `.skip` vào source.
- Core unit: **47 pass, một capability skip có sẵn** (`setsid` thiếu trên Windows).
- Harness TypeScript: pass; bốn grader đều red với original, green với reference.
- Production build và pack gate: pass. Tarball suite: **5 pass**.
- Test worktree lifecycle từng fail khi full suite tải cao: chạy riêng pass.
- Bỏ ghim commit trong provisioning làm regression đọc `reference v2` thay vì
  `reference v1`; khôi phục fix và core suite pass.

Lượt full Vitest đầu không được tính là pass:
nó chạy giữa các lần sửa metadata, giữ snapshot module cũ, có lỗi ở worktree
lifecycle và sau đó không tiến triển nhiều phút; đã dừng đúng cây tiến trình đó.

## Benchmark sửa code

Đã thêm harness manual `packages/work/scripts/eval-skill-coding.ts` và bốn fixture
B01, B03, B06, B12. Baseline, pilot và candidate không ship chạy tuần tự trong
workspace riêng ngoài checkout này. Node judge được đặt ở bản sao sau khi agent
kết thúc; đáp án tham chiếu và judge không được đặt trong workspace agent.

Preflight bắt buộc cả bốn judge từ chối mã lỗi và chấp nhận mã tham chiếu. Có seed,
model ID rõ ràng, CLI version, hash prompt/skill/fixture/source diff, usage/tool
events, cap 10 phút/lượt, runner shutdown và ghi kết quả nguyên tử. Không gọi
harness ở boot, build hay test suite. Không mô tả model alias như model snapshot.

```powershell
node --import tsx packages/work/scripts/eval-skill-coding.ts --preflight-only 1 --out .tmp/skill-coding-preflight
node --import tsx packages/work/scripts/eval-skill-coding.ts --model gpt-6.1-sol --seed 20261120 --repetitions 1 --out .tmp/skill-coding-smoke
```

Lượt smoke thật đã dừng: hai lượt B03 hoàn tất nhưng tools không khởi chạy được
với lỗi **`registered Core launch requires an installed app`**; candidate bị ngắt
trước khi hoàn tất. Cây tiến trình benchmark do lượt này tạo đã được dừng.
[Evidence đã rà lại](coding-smoke.json) đánh dấu hai lượt là infrastructure-invalid,
không dùng hidden-test fail của mã chưa được sửa để chấm chất lượng model/skill.
Harness ban đầu chưa bắt lỗi tool launch ở tầng con; đã bổ sung detection và lưu
rõ việc sửa nhãn trong bản evidence. Không có vòng 108/72 lượt nào được khởi chạy.

Chưa promote, gộp hoặc bỏ skill dựa trên benchmark lỗi. Bước còn lại là sửa môi
trường tool của Codex, chạy lại smoke hợp lệ rồi mới mở rộng các case còn lại và
so sánh nhiều lần/backend theo cổng trong kế hoạch. Không tự cài lại CLI, đổi
login hoặc cấp quyền rộng hơn để làm đẹp kết quả.
