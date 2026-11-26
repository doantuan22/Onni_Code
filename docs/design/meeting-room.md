# Meeting Room — Thiết kế chức năng & Quy mô thực hiện

> Tài liệu thiết kế cho cơ chế **Meeting** (phòng họp đa Agent + Người dùng) trong OnniCode.
> Phân tích dựa trên cấu trúc hiện tại của `@onni/contract`, `@onni/work`, `@onni/api-client` và `@onni/web`.

---

## 1. Tổng quan & Định vị

**Meeting** là không gian làm việc cộng tác ngang hàng (peer-to-peer group chat) giữa **Người dùng** và **nhiều AI Agent** trong **một khung chat duy nhất**.

Khác biệt cốt lõi so với các cơ chế hiện có trong OnniCode:

| Khía cạnh | Single Run | Manager–Worker (`roster`) | One & One (`one-and-one.ts`) | **Meeting (Mới)** |
| --- | --- | --- | --- | --- |
| **Mô hình quan hệ** | 1 Agent thực thi | 1 Manager giao việc → Worker (`depth=1`) | 1 Manager ↔ 1 Worker theo pha | **Ngang hàng**: User + N Agents tự do trao đổi |
| **Nơi lưu trữ & `cwd`** | Worktree `.ai/onni/worktrees/<runId>` | Worktree riêng từng node | Worktree cặp Manager/Worker | **Thư mục riêng** `~/.onni/meetings/<meetingId>/` |
| **Phạm vi dự án** | 1 repo | 1 repo | 1 repo | **Đa dự án** (các project User đề cập/gắn vào phòng) |
| **Giới hạn công cụ** | Theo config/preset | Worker bị fence report-only | Theo order/checkpoint | **Không hạn chế** (dùng full tools, bash, MCP, skills) |
| **Mục tiêu đầu ra** | Code diff / PR | Code diff tích hợp về Manager | Code diff qua review | **Thảo luận, phản biện, chốt quyết định (Decisions)** |

---

## 2. Phân tích tương thích với hệ thống hiện tại

### 2.1. Lưu trữ & Workspace (`packages/work/src/paths.ts`)
- OnniCode đã có `onniHomeDir()` (`~/.onni/`, hỗ trợ `ONNI_HOME` trong test) cho các dữ liệu **workspace-level** (như `config.json`, `ui-state.json`, `server-instances/`).
- Vì Meeting độc lập với một repo cụ thể và không nằm trong `.ai/onni/worktrees/`, vị trí tự nhiên nhất là `~/.onni/meetings/<meetingId>/`.
- Quy tắc bất biến cần giữ: mọi ghi JSON phải dùng **atomic write** (tmp file + rename, mode `0600`), và file hỏng phải **degrade gracefully** (không làm crash server).

### 2.2. Runner Layer & Đa dự án (`packages/work/src/core/`)
- `createRunner(backend)` trong `runner-factory.ts` hỗ trợ 9 backends (`RUNNER_IDS`): `claude`, `codex`, `opencode`, `cursor`, `pi`, `junie`, `copilot`, `cline`, `antigravity`.
- `AgentRunSpec` (`agent-runner.ts`) đã có sẵn:
  - `cwd`: thư mục làm việc chính (sẽ trỏ vào `~/.onni/meetings/<meetingId>/workspace/`).
  - `additionalDirectories?: string[]`: danh sách thư mục dự án bổ sung.
  - `sessionId` & `resume`: giữ phiên hội thoại riêng của từng Agent qua nhiều lượt phát biểu.
  - `mcpServers`, `allowedTools`, `systemPrompt`: giữ nguyên năng lực đầy đủ của Agent.
- **Điểm nghẽn cần xử lý theo từng backend** (qua khảo sát `core/*-runner.ts`):
  - **Hỗ trợ native `additionalDirectories`**: `claude` (`--add-dir`), `copilot` (`--add-dir`), `antigravity` (`directories`).
  - **Không có cờ CLI `additionalDirectories`**: `cline`, `opencode` (đã ghi chú rõ trong source), và các runner ACP/RPC khác (`codex`, `cursor`, `pi`, `junie`).
  - **Giải pháp**: Vẫn truyền `additionalDirectories` cho runner nào hỗ trợ, đồng thời luôn nhúng danh sách **absolute paths** của các project được phép vào `systemPrompt` để Agent đọc/truy cập qua shell hoặc file tools; hiển thị badge cảnh báo nhẹ trên UI nếu một backend có sandbox chặt ở `cwd`.
  - **Lưu ý riêng cho `antigravity`**: Tuân thủ invariant fail-closed trong `AGENTS.md` (chạy qua `effectiveAntigravityLevel`, không thêm `--add-dir` hay `agy-acp-bridge`).

### 2.3. Quản lý tài nguyên (`WorkspaceSemaphore` — `workspace/semaphore.ts`)
- `WorkspaceSemaphore` giới hạn `maxParallel` (mặc định 2) trên toàn workspace.
- Trong Meeting, tại một thời điểm thông thường chỉ có **1 Agent đang phát biểu** (turn-based), nên gần như không gây bão process. Tuy nhiên mỗi lượt chạy runner của Meeting vẫn nên đăng ký/tôn trọng hoặc có cơ chế timeout (`inactivity-deadline.ts`) để tránh treo tiến trình nền.

### 2.4. API & Real-time (`packages/work/src/server/`)
- **HTTP**: Đăng ký route family mới theo chuẩn chained builder trong `server.ts` tại `/api/v1/meetings/*` (workspace-level, tương tự `/api/v1/projects` hay `/api/v1/workspace/threads`, không mirror dưới `/p/:projectId`). Mọi request/response khai báo bằng Zod trong `@onni/contract` để `AppType` và `contract-parity` test tự động kiểm tra.
- **WebSocket Bus (`server/ws.ts`)**: Dùng chung một kết nối `/api/v1/ws` của `SocketHub` (không mở `new WebSocket` riêng). Đăng ký topic động `meeting:<id>` theo cơ chế **demand-driven** (`0→1` subscriber mới khởi động stream/watcher, `1→0` thì dọn dẹp).

### 2.5. Giao diện (`packages/web/`)
- `routes.tsx` đã hỗ trợ các workspace-level routes (`/tasks`, `/settings/*`, ...). Có thể thêm `/meetings` và `/meetings/:meetingId` dùng `lazyRoute()` để không tăng bundle trang chủ.
- Có thể tái sử dụng stack render markdown (`Streamdown`) và tool-call blocks từ `routes/task-thread/` để hiển thị tin nhắn của Agent trong phòng họp.

---

## 3. Kiến trúc lưu trữ (Storage Layout)

Mỗi cuộc họp được quản lý hoàn toàn dưới `~/.onni/meetings/`:

```text
~/.onni/meetings/
├── index.json                  # Cache danh sách cuộc họp (rebuild được từ các thư mục con nếu mất)
└── <meetingId>/                # UUID hoặc slug-id8
    ├── meeting.json            # Metadata, danh sách thành viên, projects, config lượt nói
    ├── messages.ndjson         # Append-only log tất cả tin nhắn (User, Agent, System)
    ├── decisions.json          # Danh sách quyết định / kết luận đã chốt
    ├── sessions.json           # Map participantId -> { sessionId, lastSeenSeq, costBaselineUsd }
    └── workspace/              # cwd trung lập cho các Agent (chứa tài liệu nháp, notes, sơ đồ...)
```

**Nguyên tắc Zero-config & An toàn**:
- Thư mục `workspace/` được tạo tự động khi khởi tạo cuộc họp.
- Nếu User xóa `~/.onni/meetings/<meetingId>/`, cuộc họp biến mất sạch sẽ, không ảnh hưởng tới bất kỳ repo Git nào.

---

## 4. Hợp đồng dữ liệu (`@onni/contract/src/meetings.ts`)

Các schema cốt lõi (Node-free, dùng `z.infer`):

```typescript
// Trạng thái phòng họp
export const meetingStatusSchema = z.enum([
  'idle',          // Mới tạo, chưa bắt đầu
  'discussing',    // Đang có Agent xử lý/phát biểu
  'waiting_user',  // Hết vòng tự động hoặc Agent hỏi User, chờ User phản hồi
  'paused',        // User bấm tạm dừng
  'concluded',     // Đã kết thúc cuộc họp
]);

// Thành viên Agent trong phòng họp
export const meetingParticipantSchema = z.object({
  id: z.string(),                      // VD: "claude-arch", "codex-rev"
  displayName: z.string(),             // Tên hiển thị & dùng để @mention
  runner: runnerIdSchema,
  model: z.string().optional(),
  role: z.string().max(500).optional(), // VD: "Backend Architect", "Security Reviewer"
  accountId: z.string().optional(),    // Chọn profile tài khoản nếu có nhiều
});

// Dự án được cấp quyền trong phòng họp
export const meetingProjectRefSchema = z.object({
  projectId: z.string().optional(),    // Khớp ProjectRegistry nếu có
  name: z.string(),
  root: z.string(),                    // Absolute realpath
  addedAt: z.string(),
});

// Tin nhắn hợp nhất trong 1 khung chat
export const meetingMessageSchema = z.object({
  seq: z.number().int().nonnegative(),
  id: z.string(),
  authorType: z.enum(['user', 'agent', 'system']),
  participantId: z.string().optional(), // Có khi authorType === 'agent'
  displayName: z.string(),
  content: z.string(),
  mentions: z.array(z.string()).optional(), // Danh sách participantId được @tag
  toolSummary: z.array(z.string()).optional(), // Tóm tắt file đã đọc / lệnh đã chạy
  isDecisionCandidate: z.boolean().optional(),
  createdAt: z.string(),
});

// Quyết định đã chốt
export const meetingDecisionSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  sourceMessageSeq: z.number().int().optional(),
  proposedBy: z.string(),
  status: z.enum(['proposed', 'accepted', 'rejected']),
  createdAt: z.string(),
});
```

---

## 5. Thiết kế Meeting Engine (`packages/work/src/meetings/`)

### 5.1. Cơ chế Shared Transcript + Private Session
Để các Agent trao đổi qua lại tự nhiên mà không bị tràn context hoặc tốn token gửi lại lịch sử từ đầu mỗi lượt:
1. Mỗi `participantId` giữ một `sessionId` riêng trong `sessions.json` và chạy với `resume: true` từ lượt thứ 2 trở đi.
2. `sessions.json` lưu `lastSeenSeq` (số thứ tự tin nhắn cuối cùng mà Agent đó đã đọc).
3. Khi đến lượt Agent $A$:
   - Engine lấy tất cả tin nhắn trong `messages.ndjson` có `seq > lastSeenSeq(A)`.
   - Format thành một block ngắn gọn: `[User]: ...`, `[Codex (Reviewer)]: ...` rồi gửi vào `userPrompt` của $A$.
   - Sau khi $A$ trả lời xong, cập nhật `lastSeenSeq(A)` lên `seq` mới nhất.
4. Nếu một Agent bị mất session hoặc đổi model giữa chừng, Engine tự fallback tạo `sessionId` mới và nạp bản tóm tắt + `N` tin nhắn gần nhất.

### 5.2. Cơ chế Điều phối lượt nói (Turn-taking & Anti-loop)
Một vòng lặp điều phối (`MeetingOrchestrator`) chạy bất đồng bộ theo từng cuộc họp:

```text
User gửi tin nhắn
  │
  ├── Có @mention cụ thể (VD: @claude @codex)?
  │     └── Đưa các Agent được tag vào hàng đợi (turnQueue) theo thứ tự
  │
  └── Không có @mention (mở chủ đề chung)?
        └── Đưa tất cả thành viên vào turnQueue (round-robin 1 vòng)

Khi chạy 1 lượt Agent X:
  ├── Stream UiEvent ra WS topic `meeting:<id>`
  ├── Lưu câu trả lời của X vào `messages.ndjson`
  ├── Nếu trong câu trả lời, X @mention Agent Y (và chưa vượt `maxAutoTurns`):
  │     └── Đẩy Y vào đầu turnQueue để phản hồi lại X
  ├── Nếu X trả lời `[PASS]` (không có ý kiến bổ sung):
  │     └── Bỏ qua, không ghi nhiễu (hoặc ghi system note nhỏ), chuyển lượt tiếp theo
  └── Kiểm tra điều kiện dừng:
        ├── `turnQueue` rỗng, HOẶC
        ├── Đã đạt `autoTurnsCount >= maxAutoTurns` (mặc định: 4 lượt Agent liên tiếp), HOẶC
        └── User bấm Stop / gửi tin nhắn mới (Interject)
        ──► Chuyển trạng thái về `waiting_user`
```

- **User Interject (Xen ngang)**: Khi User gửi tin nhắn lúc một Agent đang chạy, Engine gọi `abort` lên phiên runner hiện tại (dùng cơ chế hủy của `AgentRunner`), dọn `turnQueue` cũ và xử lý ngay tin nhắn mới của User.

### 5.3. Quy ước Prompt & An toàn đa dự án
- **System Prompt của phòng họp** cung cấp cho mỗi Agent:
  - Danh tính của chính Agent đó (`displayName`, `role`).
  - Danh sách các thành viên khác trong phòng và cách `@mention` khi muốn hỏi/phản biện trực tiếp.
  - Danh sách đường dẫn các dự án được phép truy cập (`projects[]`) và thư mục `workspace/` chung để lưu tài liệu nháp.
  - **Quy tắc ghi file an toàn**: Vì phòng họp không tách git worktree riêng, prompt mặc định hướng dẫn Agent *"chỉ đọc và phân tích code trong các thư mục dự án; chỉ thực hiện sửa đổi file trực tiếp trong dự án khi User yêu cầu rõ ràng bằng tên"* — tránh tình trạng 2 Agent cùng sửa 1 file gây xung đột.
  - Cách đánh dấu đề xuất quyết định (ví dụ block `[DECISION] ... [/DECISION]`) để Engine tự động tách vào `decisions.json` với trạng thái `proposed` chờ User duyệt (`accepted`).

---

## 6. Giao diện HTTP API & WebSocket

### 6.1. REST Endpoints (`/api/v1/meetings`, chained vào `AppType`)
| Method & Path | Chức năng |
| --- | --- |
| `GET /api/v1/meetings` | Lấy danh sách cuộc họp |
| `POST /api/v1/meetings` | Tạo phòng họp mới (tên, participants, projects, `maxAutoTurns`) |
| `GET /api/v1/meetings/:id` | Chi tiết phòng họp + messages + decisions |
| `PATCH /api/v1/meetings/:id` | Cập nhật tiêu đề, thêm/bớt participant hoặc project, đổi `maxAutoTurns` |
| `DELETE /api/v1/meetings/:id` | Xóa phòng họp và thư mục `~/.onni/meetings/:id` |
| `POST /api/v1/meetings/:id/messages` | User gửi tin nhắn (kèm `mentions`, hỗ trợ interject khi đang chạy) |
| `POST /api/v1/meetings/:id/control` | Điều khiển: `pause`, `resume`, `stop_turn`, `conclude` |
| `POST /api/v1/meetings/:id/decisions` | Tạo hoặc duyệt (`accept`/`reject`) một quyết định |

### 6.2. WebSocket Topics (`/api/v1/ws`)
- `meetings`: Phát sự kiện khi có cuộc họp mới / đổi trạng thái / xóa.
- `meeting:<id>`: Phát real-time:
  - `turn_started` / `turn_delta` (text + tool activity đang chạy của Agent) / `turn_completed`
  - `message_added`
  - `decision_updated`
  - `status_changed` (`discussing` ↔ `waiting_user` ↔ `paused` ↔ `concluded`)

---

## 7. Giao diện người dùng (`@onni/web`)

1. **Điều hướng**: Thêm mục **Meetings** trên thanh điều hướng workspace.
2. **Màn hình `/meetings`**: Danh sách phòng họp (trạng thái, số thành viên, các project liên quan, thời gian hoạt động cuối) + nút **New Meeting**.
3. **Modal / Form tạo phòng họp**:
   - Đặt tên chủ đề.
   - Chọn nhiều Agent từ `RUNNER_IDS` + chọn model + đặt `displayName` & `role` ngắn (có thể tạo nhiều Agent cùng backend nhưng khác role, ví dụ `claude-arch` và `claude-qa`).
   - Chọn một hoặc nhiều Project từ Project Registry (hoặc thêm sau trong lúc họp).
4. **Màn hình phòng họp `/meetings/:id`** (1 khung chat duy nhất):
   - **Top Bar**: Tên cuộc họp, các Project Chips (bấm `+` để cấp quyền thêm dự án ngay trong cuộc họp), nút `Pause / Stop Turn / End Meeting`.
   - **Chat Timeline**: Tin nhắn của User và từng Agent phân biệt rõ bằng màu sắc/avatar/role badge; phần tool calls (đọc file, grep, bash) thu gọn thành accordion nhỏ dưới tin nhắn.
   - **Composer**: Hỗ trợ gõ `@` để autocomplete tên Agent trong phòng, `#` để tham chiếu Project, và chế độ gửi bình thường hoặc ngắt lượt hiện tại.
   - **Right Drawer (thu gọn được)**: Tab **Participants** (trạng thái `thinking / idle / error` + token/cost) và tab **Decisions** (danh sách quyết định `proposed / accepted` + nút xuất `summary.md`).

---

## 8. Quy mô thực hiện & Lộ trình triển khai

Tổng quy mô: **Trung bình – Lớn (Medium–Large)**. Tận dụng được ~70% hạ tầng sẵn có (`AgentRunner`, `SocketHub`, `Streamdown`, `ProjectRegistry`), phần mới hoàn toàn nằm ở **Meeting Orchestrator** và **UI Group Chat**.

| Package | Thành phần cần làm | Độ phức tạp |
| --- | --- | --- |
| `@onni/contract` | `src/meetings.ts` + export ở `index.ts` | Thấp |
| `@onni/api-client` | Typed endpoints + WS topic subscription helpers | Thấp |
| `@onni/work` | `paths.ts`, `meetings/store.ts`, `meetings/orchestrator.ts`, `meetings/prompts.ts`, `server/routes/meetings.ts`, WS topic wiring | **Cao (Trọng tâm)** |
| `@onni/web` | Routes `/meetings`, `/meetings/:id`, Create Modal, Group Chat Stream, Decisions Drawer | Trung bình |

### Thứ tự triển khai đề xuất
1. **Phase 1 — Core Engine & MVP Chat**:
   - Contract (`meetings.ts`) + Store (`~/.onni/meetings/<id>/`).
   - Orchestrator hỗ trợ tuần tự từng lượt, `@mention` từ User, `maxAutoTurns`, `additionalDirectories`, và Interject/Stop.
   - API routes + WS `meeting:<id>` + UI phòng họp cơ bản.
2. **Phase 2 — Agent-to-Agent Routing & Decisions**:
   - Parse `@mention` giữa các Agent, xử lý `[PASS]`, tự động bắt `[DECISION]` vào `decisions.json` và UI duyệt quyết định.
   - Fallback context cho các backend không hỗ trợ `additionalDirectories` và hiển thị cảnh báo sandbox trên UI.
3. **Phase 3 — Hậu cuộc họp**:
   - Xuất biên bản `summary.md` vào `workspace/`.
   - Nút **"Create Task from Decision"** đẩy thẳng nội dung quyết định + project sang màn hình `/new` để thực thi bằng worktree.

### Kiểm thử bắt buộc (theo chuẩn repo)
- `contract-parity.meetings.test.ts`: Kiểm tra khớp schema `@onni/contract` ↔ Hono routes.
- `meetings/store.test.ts`: Atomic write, corrupt file fallback, `ONNI_HOME` isolation.
- `meetings/orchestrator.test.ts`: Test mock runner cho `@mention` routing, chống lặp `maxAutoTurns`, `[PASS]`, và User interject/abort.
- `packages/web`: Unit test cho composer `@mention` và render group chat timeline.
