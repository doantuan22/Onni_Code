# Kế hoạch tuyển chọn và nâng cấp bộ skill của OnniCode

Ngày khảo sát: 19/11/2026. Trạng thái: kế hoạch và khảo sát sơ bộ; chưa cài, xóa,
thay thế skill hoặc sửa engine. Các ứng viên dưới đây chưa được benchmark trên OnniCode.

## 1. Mục tiêu và phạm vi

Tuyển một bộ skill nhỏ, có nguồn rõ ràng, cải thiện kết quả lập kế hoạch, sửa lỗi,
triển khai, review và xác minh của manager/worker. Số sao dùng để tìm nguồn được
quan tâm; chất lượng trên tác vụ thực tế quyết định việc thay thế.

Ưu tiên hệ thống hiện tại: TypeScript ESM, Hono, Zod, React 19, Vite, Tailwind,
Tauri/Rust, Windows 11 + Git Bash; nhiều backend agent và worktree do Onni quản lý.
Bộ skill cũng phải dùng được cho các repo khác mà Onni quản lý: skill theo stack
chỉ áp dụng khi phát hiện stack phù hợp, không biến mọi dự án thành React/Next.js.

Hai phần công việc được đánh giá riêng:

- Nội dung: tuyển và thích nghi từng skill, tài liệu tham chiếu và script cần thiết.
- Engine: chỉ sửa khi có kiểm thử chứng minh discovery, đường dẫn, provisioning,
  truyền skill cho worker hoặc đồng bộ catalog không đáp ứng được bộ đã tuyển.

## 2. Hiện trạng đã xác minh

| Nguồn | Quan sát | Hướng xử lý |
| --- | --- | --- |
| `.agents/skills/e2e` | Có skill và tài liệu cho runner e2e hiện dùng; `.claude/skills/e2e` là bản mirror | Giữ làm baseline, so sánh với ứng viên kiểm thử trước khi quyết định |
| `.ai/skills/om-prepare-test-env` | Chứa kiến thức riêng về launcher, dependency, cache và môi trường QA của repo | Giữ hoặc tách thành lớp hướng dẫn riêng của Onni; tên `om-` không đủ để kết luận đã lỗi thời |
| `.ai/onni/config.json` | Không có `skillsRepos` trong cấu hình đã đọc | Chưa có một bộ team skill cố định để thay thế hàng loạt |
| Cấu hình workspace đọc từ máy hiện tại | Không có `orgSkillsRepos` | Không có nguồn tổ chức được cấu hình trong snapshot này |
| Thư mục skill người dùng | Có các skill được công cụ khác đồng bộ, gồm browser, tài liệu và nghiên cứu | Ghi nhận nguồn và quyền sở hữu; không đưa vào danh sách xóa chỉ vì thay bộ coding skill |
| Built-in của Onni | Có `create-onni-automation`, xuất hiện theo capability | Giữ chức năng đặc thù Onni; skill coding phổ thông không thay được |

Đây là snapshot repo và thư mục người dùng đã đọc, không phải inventory toàn bộ mọi
dự án hoặc mọi cài đặt Onni. Bước 1 phải xuất catalog hợp nhất giống giao diện thực tế,
gồm các skill Markdown phẳng, nguồn bị che bởi trùng tên và workflow đang tham chiếu.

Engine hiện đọc nguồn local, global và team; ưu tiên nguồn local khi trùng tên.
Một bước có `skill` hoặc prompt bắt đầu `/ten-skill` kích hoạt việc đưa nội dung
vào phiên và chuẩn bị file cho worktree. Worker không mặc nhiên kế thừa skill của
manager. Có skill trong catalog chưa chứng minh agent đã dùng skill đó.

## 3. Nguồn ưu tiên khảo sát

Số sao xấp xỉ được quan sát trực tiếp trên trang repo trong lượt khảo sát này,
không lấy số từ các danh sách tổng hợp. Đây là sao của **repo**, không phải từng skill.
Các liên kết `main` là nguồn khảo sát; bản đưa vào thử nghiệm phải ghi SHA cụ thể.

| Repo nguồn | Sao xấp xỉ | Nội dung ưu tiên xem | Đánh giá sơ bộ cho Onni |
| --- | ---: | --- | --- |
| [mattpocock/skills](https://github.com/mattpocock/skills) | 328k | `diagnosing-bugs`, `tdd`, `codebase-design`, `code-review`, nhóm spec/ticket/handoff | Nguồn ứng viên engineering; so sánh với Superpowers, thích nghi các giả định tracker, thiết lập ban đầu và subagent |
| [obra/superpowers](https://github.com/obra/superpowers) | 322k | `systematic-debugging`, `verification-before-completion`, `writing-plans`, `test-driven-development` | Ưu tiên chẩn đoán/xác minh; không nhập nguyên cơ chế orchestration, worktree, hooks và cập nhật của plugin |
| [anthropics/skills](https://github.com/anthropics/skills) | 198k | `frontend-design`, `webapp-testing`, `skill-creator` | Nguồn bổ sung cho thiết kế, QA và đánh giá skill; kiểm tra từng thư mục và điều kiện chạy |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 152k | `ui-ux-pro-max` | Tùy chọn cho UI; kiểm tra Python, dữ liệu và cách đóng gói đường dẫn trên Windows |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 34.5k | React best practices, composition, web interface review | Ưu tiên cho worker React và reviewer; lọc các quy tắc chỉ dành cho Next.js/Vercel |
| [trailofbits/skills](https://github.com/trailofbits/skills) | 8.3k | `differential-review`, `sharp-edges`, `insecure-defaults`, property-based testing | Gói review chuyên sâu; kiểm tra license và phụ thuộc từng skill trước khi phân phối |

[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
là danh mục để tìm thêm ứng viên khi một nhóm năng lực còn thiếu. Không xem một
danh sách liên kết như một gói skill có thể nhập nguyên bộ.

## 4. Các khác biệt đã thấy khi đọc nội dung

- [Superpowers debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md)
  có quy trình tìm nguyên nhân và tham chiếu skill bằng namespace `superpowers:...`.
  Cần đối chiếu các tên đó với lookup của Onni và bảo đảm file tham chiếu có trong worktree.
- [Superpowers verification](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md)
  là ứng viên cho bằng chứng trước khi báo hoàn thành; cần giữ phân biệt xác minh hẹp
  và xác minh toàn hệ thống, không biến tác vụ nhỏ thành một chuỗi test quá tốn kém.
- [Superpowers README](https://github.com/obra/superpowers#visual-companion-telemetry)
  mô tả việc tải logo từ website trong visual companion. Chỉ xem xét nội dung skill
  đã tuyển; không đưa tính năng đó vào mặc định local-first của Onni.
- [Matt Pocock README](https://github.com/mattpocock/skills)
  có quy trình thiết lập theo repo, tích hợp tracker và skill điều phối agent.
  Chọn phần discipline có thể áp dụng độc lập; không bắt người dùng Onni cấu hình
  tracker, tạo glossary hoặc trả lời phỏng vấn cho mọi task.
- [Vercel React skill](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)
  đặt tên frontmatter `vercel-react-best-practices` nhưng thư mục là
  `react-best-practices`. Onni hiện có thể lấy tên khác nhau giữa remote và local;
  inventory và phép thử migration phải phát hiện khác biệt này.
- [Web design guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)
  yêu cầu tải guideline mới mỗi lần. Bản dùng offline cần snapshot được ghim phiên
  bản và ghi xuất xứ; không giả định một file SKILL ngắn là hoàn toàn offline.
- [Anthropic webapp-testing](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md)
  dùng Python Playwright và gợi ý `networkidle`. Với app có SSE/WebSocket, đánh giá
  điều kiện sẵn sàng theo UI/API và launcher hiện có. Không thay runner e2e chỉ vì
  repo nguồn nhiều sao hơn.
- UI UX Pro Max có script tìm kiếm cần Python; theo
  [README](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill#prerequisites),
  script này dùng thư viện chuẩn. Kiểm tra script và payload thực tế ở SHA đã chọn.
- Giấy phép là điều kiện phân phối theo file/thư mục, không suy ra từ số sao hoặc
  nhãn license chung. Ví dụ [Trail of Bits](https://github.com/trailofbits/skills/blob/main/LICENSE)
  dùng CC-BY-SA-4.0 ở repo; [Matt Pocock](https://github.com/mattpocock/skills/blob/main/LICENSE)
  dùng MIT. Ghi notice và các sửa đổi ở bước đóng gói.

## 5. Quy trình thực hiện và đầu ra

### Bước 1 — Chốt baseline hiện tại

Xuất inventory gồm tên, mô tả, nguồn, scope, đường dẫn, owned/read-only, tên trùng,
workflow/preset tham chiếu và script/phụ thuộc. Chỉ đọc các trường cần thiết trong
cấu hình; không đưa credential vào báo cáo. Phân loại: giữ, ứng viên thay, bổ sung,
hoặc nguồn ngoài phạm vi quản lý. Không xóa nguồn global do công cụ khác sở hữu.

Đầu ra: inventory và bảng mapping cũ → mới; các mục chưa đủ bằng chứng phải ghi rõ.

### Bước 2 — Tìm và đọc ứng viên theo nhóm năng lực

Khảo sát khoảng 15–20 repo, chọn 2–3 ứng viên cho mỗi nhóm: làm rõ yêu cầu, lập kế
hoạch, debugging, implementation, review, verification, frontend và bảo mật.
Ưu tiên nguồn trực tiếp của tác giả/tổ chức. Đọc SKILL, references, scripts, license,
commit gần đây và các issue ảnh hưởng tới cách dùng; không chỉ đọc README.

Mỗi ứng viên có hồ sơ: URL gốc, ngày kiểm tra, số sao, SHA, kỹ năng cụ thể, phụ thuộc,
tool giả định, vai trò phù hợp, chiều dài prompt và điều kiện cần thích nghi.

### Bước 3 — Chấm điểm và loại trùng

| Tiêu chí | Điểm |
| --- | ---: |
| Kết quả trên tác vụ đại diện, độ đúng và bằng chứng xác minh | 30 |
| Tương thích manager/worker và nhiều backend của Onni | 25 |
| Token, thời gian, số lượt sửa lại | 15 |
| Cấu trúc rõ, ví dụ, test/eval và khả năng bảo trì | 10 |
| Hoạt động bảo trì và xử lý issue của upstream | 10 |
| Mức phổ biến: sao, fork, sử dụng thực tế | 10 |
| Tổng | 100 |

Điều kiện bắt buộc trước khi chấm: quyền phân phối rõ, phù hợp quyền của run,
không phụ thuộc bí mật/cấu hình bắt buộc, không thêm gửi dữ liệu hoặc auto-update,
và không vòng qua worktree/roster/limits của Onni. Skill chưa đạt được đánh dấu cần
adapt hoặc loại khỏi vòng thử; không cho điểm cao để bù điều kiện bắt buộc.

Mỗi nhóm chỉ chọn một skill chính trước; skill gần tương đương là phương án so sánh,
không nạp cả hai vào mọi phiên.

### Bước 4 — Thử nghiệm gói 8–12 skill trong môi trường riêng

Danh sách vòng đầu đề xuất:

| Vai trò | Nhóm skill | Ứng viên |
| --- | --- | --- |
| Manager | Lập kế hoạch | `writing-plans`; đối chiếu nhóm spec/ticket của Matt Pocock |
| Manager/reviewer | Kiểm chứng kết quả | `verification-before-completion` |
| Worker sửa lỗi | Chẩn đoán | So sánh `systematic-debugging` với `diagnosing-bugs` |
| Worker triển khai | Kiểm thử phù hợp thay đổi | So sánh `test-driven-development` với `tdd` |
| Worker/reviewer kiến trúc | Thiết kế module | `codebase-design` |
| Worker/reviewer React | Hiệu năng và composition | Chọn phần phù hợp từ Vercel |
| Worker/reviewer UI | Thiết kế và accessibility | `frontend-design`; web guidelines bản offline nếu cần |
| Worker QA | Kiểm thử giao diện | Giữ `e2e` làm baseline, thử `webapp-testing` như ứng viên bổ sung |
| Reviewer bảo mật | Review diff | Một skill phù hợp từ Trail of Bits |

Chuẩn hóa tên gọi và references, giữ attribution, không thay đổi nội dung âm thầm.
Ghim SHA và danh sách file. Kiểm tra tài nguyên ngoài thư mục, symlink, file nhị
phân và permissions: bộ materialize hiện tại không được mặc định xem là hỗ trợ
mọi kiểu gói upstream. Không nhập hàng trăm skill chỉ bằng một URL nguồn chung.

Manager điều phối bằng công cụ Onni; worker chỉ thực hiện order đã giao. Những
skill tự sinh subagent hoặc tạo worktree cần adapter hoặc phải loại khỏi vòng đầu.
Worker Antigravity vẫn bị ràng buộc permission level, không tự commit/push hoặc
gửi CLI report. Skill không nâng quyền của run.

Việc thêm trường skill riêng vào dispatch/roster chỉ là hạng mục engine tiềm năng:
đánh giá nhu cầu sau thử nghiệm. Nếu cần, phải có Zod contract, trường optional,
tương thích dữ liệu cũ và kiểm thử; không coi đề xuất metadata là tính năng đã có.

### Bước 5 — Benchmark với cùng điều kiện

Dùng khoảng 12 tình huống: xóa dự án còn ở UI, race cache khi GET đang chạy,
mất kết nối SSE, đổi project khi request chưa xong, lỗi Zod/API, lỗi Windows path,
lỗi React render, refactor nhiều package, sửa lỗi có regression test, review một
diff có lỗi biết trước, giới hạn worker và task chỉ sửa tài liệu.

So sánh baseline và ứng viên trên cùng commit, backend, model, quyền, giới hạn,
input và tiêu chí chấm; đảo thứ tự chạy và lặp lại tối thiểu ba lần cho nhóm quan
trọng. Dry-run chỉ chứng minh plumbing, không chứng minh chất lượng model.

Ghi tỷ lệ đúng, test bắt được lỗi, lỗi mới, phút chạy, token nếu backend có báo,
chi phí nếu backend hỗ trợ, số worker, số lượt sửa và yêu cầu can thiệp của người
dùng. Không suy ra USD khi backend chỉ báo token. Lưu prompt nguồn và SHA để tái lập.

Ngưỡng đề xuất để chọn: không vi phạm invariant, không giảm chất lượng ở nhóm quan
trọng; có cải thiện chất lượng lặp lại được, hoặc chất lượng tương đương với giảm
khoảng 15% thời gian/token. Đây là tiêu chí dự kiến, chưa phải kết quả đo. Nếu kết
quả gần nhau hoặc nhiễu thì giữ baseline, tăng mẫu trước khi kết luận tối ưu.

### Bước 6 — Lập phương án thay thế có thể khôi phục

Chỉ skill thắng vòng thử mới vào bộ chính. Lưu mapping tên cũ, kiểm tra toàn bộ
workflow/preset còn tham chiếu, giữ cách gọi cũ khi cần và có snapshot khôi phục.
Không xóa `e2e`, launcher notes hoặc automation skill trước khi chứng minh phương
án thay thế giữ đủ chức năng. Không ghi đè skill global được đồng bộ từ app khác.

Thử một project trước; kiểm tra catalog/UI, task mới, Continue, worker được giao
skill và worker không được giao skill. Chỉ skill được gọi hoặc companion cần thiết
được nạp. Kiểm tra thay đổi catalog có tới các màn hình đang mở mà không restart.

Sau pilot mới đề xuất bộ mặc định cho các project. Ưu tiên cơ chế discovery hiện
có, gói nội dung đã tuyển có sẵn khi cần hoạt động offline. Không thêm file cấu
hình bắt buộc, không khôi phục skills auto-update. Cập nhật phiên bản bằng một
thay đổi được review, kèm chạy lại benchmark tương ứng.

## 6. Điều kiện hoàn thành giai đoạn nghiên cứu

1. Inventory đủ cho catalog hợp nhất và các tham chiếu đang dùng.
2. Danh sách nguồn đã kiểm tra và bảng chấm từng skill, không chỉ từng repo.
3. Đề xuất 8–12 skill chính; phần giữ nguyên, thay thế, bổ sung và loại bỏ rõ ràng.
4. Mapping manager/worker/backend và danh sách adapter cần thiết.
5. Benchmark tái lập cùng số liệu baseline/ứng viên, ghi cả thất bại và trường hợp hòa.
6. Manifest nguồn/SHA/license, kế hoạch migration và khôi phục.

Lượt lập kế hoạch này đã hoàn thành khảo sát nguồn ban đầu và đọc một số SKILL cụ
thể. Chưa thực hiện toàn bộ bước 1–6; chưa có đủ bằng chứng để gọi bộ nào là tối ưu
hoặc tuyên bố có thể thay toàn bộ skill hiện tại.
