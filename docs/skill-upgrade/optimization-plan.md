# Kế hoạch tối ưu skill — giai đoạn sau pilot

Ngày: 20/11/2026, Asia/Bangkok. Trạng thái: đã triển khai runtime và đồng bộ catalog;
xem [báo cáo thực hiện](optimization-implementation.md) và giới hạn benchmark. Căn cứ: mã nguồn hiện tại và
[18 kết quả pilot](evaluation.json), không phải bảng xếp hạng GitHub mới.

## 1. Mục tiêu

Skill phải giúp hoàn thành đúng nhiệm vụ với ít công việc thừa hơn: chọn đúng
playbook, đưa đúng phiên bản vào phiên manager/worker, cung cấp tài nguyên trước
khi agent cần, và có bằng chứng về kết quả. Cài thêm skill không phải chỉ tiêu.

Giữ 9 adapter ở mức pilot. Chỉ nâng từng skill sau khi có kết quả đủ tốt; một
skill có thể được rút gọn, gộp phạm vi, sửa hoặc loại khỏi bộ khuyến nghị. Không
buộc thay `e2e`, launcher notes, automation hoặc nội dung do công cụ khác sở hữu.

## 2. Diễn giải lại số liệu hiện có

Mỗi điều kiện dưới đây chỉ có ba lượt, cùng một fixture suy luận; không sửa code.

| Fixture | Baseline trung bình | Pilot trung bình | Baseline trung vị | Pilot trung vị |
| --- | ---: | ---: | ---: | ---: |
| Stale GET sau DELETE | 10.405 giây | 8.857 giây | 10.626 giây | 9.061 giây |
| Cache/draft khác project | 8.627 giây | 11.731 giây | 8.604 giây | 8.734 giây |
| Báo cáo hoàn thành thiếu bằng chứng | 7.512 giây | 9.431 giây | 7.625 giây | 9.049 giây |

Bài React có khoảng dao động 7.938–18.522 giây ở điều kiện pilot. Không được suy
ra một mức chậm cố định cho skill hoặc quy mọi khác biệt cho độ dài prompt.
Tổng input token báo cáo chỉ tăng khoảng 0,87%, còn output tăng khoảng 12,9%;
cache hit và overhead system prompt cũng nằm trong số đó. Không quy đổi ký tự
hoặc từ thành token bằng một hệ số giả định.

Chín entrypoint hiện dài khoảng 1.218–1.354 ký tự, 174–193 từ. Chúng đã ngắn;
cắt thêm có thể làm mất hướng dẫn hữu ích. Chưa có bằng chứng cần một hệ thống
router dùng LLM hoặc một kho skill lớn hơn. Điểm đúng trên ba fixture gần bão hòa
ở cả baseline và pilot, nên phải tăng độ khó và đo bằng kết quả thực thi.

## 3. Các điểm cần xác minh trước khi tối ưu

Đây là quan sát tĩnh hoặc giả thuyết kiểm tra, không phải tất cả đều đã tái hiện.

| Ưu tiên | Căn cứ trong mã | Rủi ro hoặc lãng phí | Phép thử quyết định |
| --- | --- | --- | --- |
| P0 | `run/agent-step.ts`: `step.skill` dựng system prompt, sau đó vẫn mở rộng slash trong user prompt | Chọn cùng tên ở step và `/skill` có thể lặp body | Ghi payload gửi runner; đếm chính xác một body khi hai lựa chọn giống nhau |
| P0 | `run/graph.ts`: worktree đi qua `waitForTeamSkills` kể cả khi đã tìm thấy root | Có thể chờ tới giới hạn 10 giây cho skill offline | Skill bundled, có/không có team source, team pending và companion thật; đo thời gian tới startSession |
| P0 | `run/messages.ts`: mở rộng bằng `state.skills`, provisioning chạy sau và không được await | Skill vừa sửa có thể dùng snapshot cũ; reference có thể chưa sẵn khi đọc | Sửa skill giữa hai lượt, gửi `/skill`, giữ promise provisioning chưa hoàn tất và kiểm tra thứ tự delivery |
| P1 | `skills-provision.ts`: suy companion từ tên xuất hiện trong body | Ví dụ hoặc câu “không dùng skill X” cũng có thể kéo X vào closure | Skill nhắc tên chỉ để minh họa so với dependency được khai báo; giữ cap và chặn vòng |
| P1 | `routes/skills.ts`: CRUD không phát sự kiện skill; frontend tự invalidate sau thao tác của mình | Tab khác, composer và phiên đang mở có thể lệch catalog | Hai client cùng project; create/update/delete, global đổi ở project khác và reconnect |
| P1 | `manifest.json` có `role`, `version`, hash; `discoverSkills` trả shape Skill chung | Vai trò/provenance hiện là metadata tài liệu, không phải bộ chọn hay quyền thực thi | Kiểm tra UI, lựa chọn workflow và worker; không mô tả role như gate đang tồn tại |
| P1 | POST `/skills` từ chối trùng tên bất kỳ nguồn nào | Override trên disk hoạt động nhưng nút tạo trên UI không tạo được bản cùng tên built-in | Kiểm tra thao tác “tạo bản tùy chỉnh” trước khi hứa override được trong giao diện |
| P2 | `materializeSkillDir` resolve ref lại khi copy | Snapshot catalog và tài nguyên có thể khác revision khi upstream đổi giữa hai bước | Chuyển ref có kiểm soát giữa discover/copy; so commit/hashes trước và sau |

Đọc thêm: [discovery](../../packages/work/src/skills.ts),
[provisioning](../../packages/work/src/skills-provision.ts),
[agent launch](../../packages/work/src/workflows/run/agent-step.ts),
[live messages](../../packages/work/src/workflows/run/messages.ts),
[catalog API](../../packages/work/src/server/routes/skills.ts).

## 4. Thứ tự triển khai

### Đợt A — Đo đường chạy và sửa lỗi nạp có thể chứng minh

1. Viết fixture runner có thể ghi prompt và chặn từng promise, không khởi động
   backend thật. Dùng cùng fixture cho task mới, Continue và tin nhắn live.
2. Tái hiện ba điểm P0. Test phải thất bại khi bỏ fix; chỉ sửa đường đã tái hiện.
3. Chuẩn hóa lựa chọn thành các root duy nhất. Khi step và slash cùng tên: giữ
   yêu cầu người dùng, nạp body một lần. Khi khác tên: bảo toàn hai lựa chọn có
   chủ ý, thứ tự và hành vi workflow; không âm thầm bỏ một skill.
4. Đối với root offline tự chứa, tránh chờ team không cần thiết. Legacy root có
   companion, team root chưa sẵn và skill không có trong catalog vẫn giữ behavior
   hiện hữu. Không xóa timeout: nó đang chặn chờ vô hạn ở đường team.
5. Chọn snapshot/version rõ ràng cho từng lần invocation. Đề xuất: turn mới dùng
   phiên bản mới nhất đã resolve; một turn đang chạy giữ snapshot của nó. Với
   message yêu cầu file hỗ trợ, chuẩn bị file trước delivery theo cơ chế queue
   hiện có, không biến sendMessage đồng bộ thành race mới.

Không cache toàn bộ discovery theo một TTL chung để “tăng tốc” nếu chưa có đo đạc.
Cache file bất biến của bundled skill là một ứng viên độc lập; local override và
team refresh phải vẫn có hiệu lực. Nếu không đo được nút thắt thì không thêm cache.

Đầu ra: regression tests, payload trước/sau, đo thời gian discovery → resolve →
provision → startSession, và mô tả default path khi không cấu hình gì.

### Đợt B — Đồng bộ catalog và làm rõ lựa chọn

- Sự kiện skill có project/scope, phát sau ghi thành công; dùng bus workspace
  hiện có. Với signal cần snapshot/subscription mới thì dùng WebSocket bus chung,
  đúng vòng đời, không tạo socket hoặc polling riêng.
- Global skill thay đổi làm stale catalog liên quan trên các project; project
  skill chỉ làm stale project đó. Cancel GET cũ trước khi reconcile. Refresh team
  có dữ liệu đổi cũng cần cập nhật các client khác.
- Khi create/update/delete, composer, Skills page và workflow picker thống nhất.
  Giữ lựa chọn còn hợp lệ; nếu tên đã xóa thì báo rõ, không tự chọn skill khác.
- Thiết kế thao tác “tạo bản tùy chỉnh” bằng API rõ ràng cho bundled skill nếu cần.
  Giữ POST hiện tại từ chối collision; không âm thầm biến create thành overwrite.
- Chỉ thêm metadata tùy chọn thực sự dùng được: role, status pilot/verified,
  capability/dependency và revision. Dùng Zod và inferred type xuyên package.
  Metadata không được nâng permission, ghi đè roster hoặc cho worker dispatch.

Đầu ra: hai-client integration tests, React tests cho các reader và tương thích
contract/dữ liệu cũ. Bộ builtin là read-only; user override tiếp tục ưu tiên.

### Đợt C — Tối ưu nội dung và khả năng chọn đúng

So sánh nội dung từng skill với các lỗi mà nó phải ngăn được. Giữ entrypoint đủ
để làm nhiệm vụ; chỉ tách references khi có phần chi tiết tùy tình huống thực sự.
Không chuyển đoạn văn ngắn thành nhiều lần đọc file chỉ để giảm số từ trên giấy.

| Skill | Giả thuyết cải thiện | Điều phải giữ |
| --- | --- | --- |
| `onni-plan` | Rút routing trùng manager brief; tách ví dụ khỏi dependency | Order đủ scope, tiêu chí thành công, dependency và evidence |
| `onni-debug` | Hướng dẫn chuyên biệt race/log/repro theo tình huống | Có kiểm chứng nguyên nhân, tránh sửa đoán |
| `onni-verify` | Báo cáo ngắn theo claim/evidence/gap | Không biến skip, build pending hoặc lời worker thành pass |
| `onni-tdd` | Phân biệt thay đổi hành vi với docs/cosmetic | Red có ý nghĩa, test qua public behavior, runner đúng repo |
| `onni-design` | Kiểm tra guarantee/default path trước refactor | Không áp đặt thêm abstraction hoặc kiến trúc không được yêu cầu |
| `onni-review` | Giảm checklist chung; chấm findings bằng lỗi có thật | Tách correctness/spec, vị trí, trigger và impact |
| `onni-react` | Rõ trigger data/cache/render | Không áp dụng Next.js/Vercel vào mọi React app |
| `onni-react-composition` | Rõ trigger component API/state ownership | Không trùng toàn bộ phạm vi `onni-react` |
| `onni-frontend-design` | Kiểm tra tính hữu ích sau khi adapter rút nhiều từ upstream | Design system hiện có, a11y, responsive và visual evidence |

Tách phần quy tắc role đã có trong engine chỉ sau khi kiểm tra mọi đường dùng:
manager, worker roster, worker không roster, Antigravity và headless. Nếu xóa
footer khỏi skill mà một đường không còn nhận quy tắc đó thì phải giữ nó.

Chọn thủ công hoặc qua workflow vẫn là chuẩn. Trước khi cân nhắc gợi ý tự động,
tạo một tập phân loại gồm task đúng skill, task mơ hồ và task không cần skill.
Đề xuất phải giải thích được từ task/stack/role, không dùng một LLM router nền.
Người dùng đã chỉ định skill thì luôn ưu tiên ý định đó, trừ khi không chạy được
do capability thực tế; khi đó nói rõ giới hạn thay vì đổi âm thầm.

## 5. Benchmark giai đoạn hai

### Điều kiện chạy

Ghim backend/model ID được backend chấp nhận, CLI version, commit code, hash skill,
prompt, quyền, giới hạn và fixture. Nếu chỉ có alias, ghi alias và giới hạn tái
lập; không gọi đó là exact model snapshot. Xác nhận CLI thật sự dùng model yêu
cầu. Chuẩn hóa context giữa các điều kiện, tách cold/warm và ghi cache hit.

Ba điều kiện vòng đầu: baseline không adapter, pilot v1, candidate v2. Baseline
vẫn nhận repo instructions và role protocol như hai điều kiện còn lại. Hoán đổi
thứ tự theo seed; không cho candidate thấy đáp án hay hidden test. Mỗi lượt dùng
checkout/fixture riêng. Không chạy fixture sửa code trong checkout người dùng.

Harness hiện chỉ hỗ trợ fixture không tool nên chưa dùng được để đo sửa code.
Mở rộng theo runner seam hiện có; lưu kết quả nguyên tử và phân biệt timeout,
auth, permission, tool failure và kết quả model. Không chạy cùng fixture song song
gây tranh tài nguyên Windows. Thêm kiểm tra tool-item/schema của từng backend,
shutdown tiến trình con có ownership và dọn temp sau khi giữ đủ evidence.

### Bộ 12 tình huống

| ID | Nhiệm vụ | Skill chính | Kết quả khách quan |
| --- | --- | --- | --- |
| B01 | Xóa dự án khi GET cũ chưa trả về | debug | Không phục hồi row cũ; test điều khiển promise |
| B02 | SSE reconnect và event xảy ra lúc refetch | debug/react | Cache giữ trạng thái mới nhất, không request flood |
| B03 | Đổi project khi có request và draft đang mở | react | Không rò task/draft giữa project |
| B04 | API body hợp lệ nhưng response lệch schema | tdd/review | Contract/parity và test ranh giới đúng |
| B05 | Path có dấu cách, junction/copy trong worktree Windows | debug | File tham chiếu đọc được; không phụ thuộc cwd sai |
| B06 | Refactor một cơ chế cap/timer đang làm liveness bound | design | Giữ default behavior, terminal transitions và limit |
| B07 | Lập kế hoạch thay đổi nhiều package | plan | Order có scope/dependency/evidence; không tự thực thi vượt yêu cầu |
| B08 | Review diff cài sẵn lỗi và một control diff sạch | review | Tìm lỗi có trigger; không bịa lỗi ở diff sạch |
| B09 | Cải tiến component API với state không hợp lệ | react-composition | Behavior/a11y giữ đúng, API ít trạng thái sai |
| B10 | Sửa UI trong design system có sẵn | frontend-design | Luồng browser, responsive/a11y và ảnh đối chiếu |
| B11 | Worker báo pass khi skip/pending/permission denied | verify | Báo đúng gap, không merge hoặc vượt quyền |
| B12 | Task chỉ sửa docs hoặc đổi copy | tdd/none control | Đúng phạm vi, không tạo bộ test/worker thừa |

Chấm bằng hidden tests, diff và yêu cầu; UI có rubric dựa screenshot/interaction
được kiểm tra độc lập. Reviewer không thấy nhãn điều kiện khi chấm. Có thể chấm
thủ công; không bắt buộc subagent hoặc một model judge phải đồng ý với tác giả.

### Quy mô và giới hạn

1. Smoke: 4 case × 3 điều kiện × 1 lần = **12 lượt**. Dừng nếu harness/tool/shutdown
   sai; không chạy vòng lớn để bù một harness hỏng.
2. Một backend/model chính: 12 case × 3 điều kiện × 3 lần = **108 lượt**.
3. Candidate tốt nhất so baseline trên hai backend khác: 6 case đại diện ×
   2 điều kiện × 3 lần × 2 backend = **72 lượt**.

Tổng trần đề xuất **192 lượt**, chia theo cổng kết quả; không tự chạy hết chỉ vì
đã có kế hoạch. Chọn backend đã có auth/quyền; không tự cài hoặc đổi login.
Mỗi coding run tối đa 10 phút, một fixture có timeout riêng theo test, không retry
model lỗi vô hạn. Chỉ chuyển vòng nếu vòng trước hợp lệ và tổng usage còn trong
giới hạn task. Khi trần usage có USD thì dùng số backend báo; backend không có
USD phải dùng token/time/run-count. Báo số đã dùng trước khi tăng quy mô.

### Số liệu và cổng quyết định

- Chất lượng: success theo case, lỗi mới, missing requirements, false-positive
  review, số cần con người cứu, vi phạm scope/role.
- Hiệu quả: time-to-first-session, time-to-valid-result, median và tail, prompt
  token trước gọi model, input/output/cache token thực tế, số tool/worker/test.
- Bỏ riêng lượt infrastructure-invalid; vẫn lưu kết quả và lý do. Không loại một
  lượt chậm chỉ để biểu đồ đẹp. Báo tổng denominator và missing metrics.
- Một skill chỉ được promote khi không vi phạm invariant và có cải thiện lặp lại
  được ở case nó phục vụ; hoặc chất lượng tương đương và giảm ít nhất khoảng 15%
  time/token đo được. Không dùng một trung bình chung để che skill giảm chất lượng.
- Với chỉ ba lần mỗi case, kết luận mang tính thăm dò. Nếu gần nhau hoặc dao động
  lớn, giữ pilot và tăng mẫu có mục tiêu. Không công bố “verified” trên mọi backend
  khi mới có kết quả trên một backend/model.

## 6. Hoàn thành, migration và khôi phục

Đợt A phải có red/green, Đợt B phải có cross-client tests, Đợt C phải có diff nội
dung/hash và dữ liệu so sánh. Cập nhật provenance/version của adapter riêng với
upstream SHA; thay đổi adapter không có nghĩa upstream cũng đổi phiên bản.

Giữ tên `/onni-*` và mọi workflow/preset hợp lệ. Nếu bỏ hoặc gộp skill, cần mapping
và đường tương thích cụ thể trước khi gỡ, kể cả Continue của run cũ. Giữ snapshot
nội dung đã dùng để điều tra kết quả nếu cần; không sửa JSON state ngoài helper
atomic-write, mọi field thêm vào RunRecord phải optional.

Mọi cập nhật runtime cần typecheck, test liên quan và build/package gate; trước
commit/PR chạy đầy đủ thứ tự yêu cầu trong AGENTS.md. Nếu OS-backed tests cần
quyền host thì chạy ở môi trường đó và ghi giới hạn thực tế. Không sửa test thành
skip để qua gate. Không tuyên bố desktop cài sẵn đã nhận thay đổi chỉ từ build.

Đầu ra cuối: bảng từng skill `giữ pilot / promote / sửa tiếp / rút khỏi khuyến
nghị`, bằng chứng theo backend/model, chi phí đo được, migration và cách quay lại
phiên bản trước. Nội dung vẫn offline, không auto-update, không telemetry và
không có cấu hình bắt buộc mới.

## 7. Việc nên làm ngay khi bước sang triển khai

Thực hiện **Đợt A trước**: test prompt trùng, fast path cho offline skill và thứ
tự chuẩn bị tài nguyên/tin nhắn. Sau đó mới sửa catalog sync và nội dung. Đây là
thứ tự giúp phân biệt lợi ích từ engine với lợi ích từ câu chữ skill, thay vì
đổi cả hai rồi không biết điều gì thực sự cải thiện.
