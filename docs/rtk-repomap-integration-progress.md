# RTK OSS và Repo Map: trạng thái tích hợp

Khảo sát tích hợp: 2026-11-19; ghi chú vòng đời artifact cập nhật 2026-11-20.

Trạng thái: **Đã hoàn thiện tích hợp và đóng gói Windows x64; còn gate CI đa nền tảng và benchmark model thật.**

## Mục tiêu và phạm vi đã hoàn thành

Windows installer chứa RTK OSS và Repo Map, không yêu cầu người dùng cài riêng Python, Aider, RTK hay toolchain native cho mapper. Tính năng dùng cho worker trong luồng manager–worker.

- RepoMapper 1.5.3 là **devDependency**, chỉ dùng khi dựng Onni. `bundle-repo-map.mjs` bundle JavaScript cần thiết và copy bảy grammar WASM: TypeScript, TSX, JavaScript, Python, Go, Rust, Solidity. Runtime chỉ phụ thuộc `web-tree-sitter@0.26.3`; không cài `tree-sitter`, native grammar hay `node-gyp-build`. Có LICENSES/NOTICE cho mapper, grammar và thư viện được bundle.
- `repo-map.ts` lấy file Git-tracked theo scope, loại đường dẫn ẩn, symlink và file không thích hợp; giới hạn 56 file, 48 KiB/file, ngân sách khoảng 560 token và 2.400 byte đầu ra. Có kiểm tra thời gian giữa các file, serialize parser và cache tối đa 64 map theo repo/Git tree/scope.
- Map chỉ lấy symbol và dòng, không đưa thân mã hay comment vào prompt. Worktree có thay đổi tracked chưa commit bị bỏ qua để cache không trộn các snapshot. Có fallback symbol khi scope là file độc lập; không báo ready với map chỉ có header.
- `worker-context.ts` gắn map ở lượt mở đầu của worker có scope; tắt bằng `ONNI_WORKER_REPO_MAP=0`. Thiếu dependency/map thì worker vẫn chạy với prompt thường.
- Codex worker có RTK được đóng gói hoặc trên PATH sẽ nhận guidance cho thao tác đọc/navigation. Dùng `rtk rg` khi có ripgrep, không giả định Windows có grep. Giữ lệnh gốc cho source đầy đủ, diff, lỗi và kiểm thử; tắt bằng `ONNI_WORKER_RTK=0`.
- Môi trường worker ép `RTK_TELEMETRY_DISABLED=1` và tắt cảnh báo cài hook. Không thay đổi cấu hình RTK/Codex toàn cục. **Giữ guidance + PATH; chưa bật hook tự động rewrite lệnh.**
- `stage-rtk.mjs` tải RTK **OSS** 1.2.0 ở bước build, kiểm SHA-256 manifest đã ghim và archive, kiểm executable `--version`, kèm Apache-2.0 LICENSE/NOTICE. Download có giới hạn byte/thời gian; lỗi xác minh không xóa binary đang dùng.
- `stage-engine.mjs` cài tarball production sạch rồi đưa RTK vào `engine/node_modules/@onni/work/dist/bin/rtk/`. Không làm bẩn dist nguồn bằng binary dành riêng cho desktop. `build-windows.mjs` await staging trước khi tạo installer.
- `pack-check` bắt buộc có bundle, cả bảy grammar và giấy phép. Có smoke test engine thực bằng `npm run verify:engine --prefix packages/desktop` sau khi build.

## Kiểm chứng thực tế ngày 2026-11-19

| Kiểm tra | Kết quả |
| --- | --- |
| Download/stage RTK Windows x64 | SHA-256 hợp lệ; executable báo `rtk 1.2.0`; có LICENSE/NOTICE |
| Typecheck toàn repo | Đạt; sau lần sửa cuối, typecheck của work cũng đạt |
| Test tập trung RTK/Repo Map/pack và manager–worker | **121/121 đạt**, 6 file |
| Bảy grammar WASM | Đều parse được symbol trong fixture thực |
| Chứng minh test hồi quy | Tạm bỏ riêng bản sửa thân mã và dirty-cache: cả hai lượt test đều đỏ; đã khôi phục source. Consumer test cũng phát hiện lỗi header-only trước khi sửa |
| `npm test` toàn repo | 13.580 đạt, 25 lỗi, 48 skipped từ suite hiện có; 12 file lỗi. Không phải gate xanh |
| `npm run test:unit` | 45 đạt, 2 lỗi, 1 skipped từ suite hiện có: thiếu lệnh POSIX `mkdir` / `/bin/sh` trên Windows |
| `npm run build` | Đạt; có bundle WASM và check:pack |
| `npm run test:package` cuối | **5/5 đạt**, gồm cài tarball production sạch, chạy CLI và mapper; xác nhận không có mapper/native grammar dependency ở consumer |
| `npm run verify:engine --prefix packages/desktop` | Đạt: RTK 1.2.0, PATH và tắt telemetry, map có symbol, `rtk git log` / `git status` chạy được |
| Installer NSIS Windows x64 | **Build thành công**; manifest NSIS chứa rtk.exe, LICENSE/NOTICE, bundle và bảy grammar |
| `git diff --check` | Đạt ở lần kiểm tra cuối |

Các lỗi full suite gồm EBUSY/EPERM khi cleanup, thiếu bash/POSIX command, phép đo kích thước phụ thuộc host và timeout. Chưa kết luận toàn bộ các lỗi đó là có sẵn bằng một lượt chạy baseline độc lập. Theo AGENTS.md, CI/Linux vẫn là gate quyết định; không skip test hoặc sửa các cơ chế ngoài phạm vi để làm xanh Windows.

## Artifact và bằng chứng local

> Các đường dẫn trong mục này ghi lại lần kiểm chứng **2026-11-19**. Bộ cài 0.4.0 và hai staging
> tree RTK cũ đã được dọn ngày 2026-11-20; chúng không còn là artifact hiện hành. Quy trình tạo
> và xác minh bản thay thế nằm trong [runbook Windows](desktop-personal-use.md). Hash lịch sử
> bên dưới được giữ nguyên để không làm sai lệch bằng chứng của lần khảo sát cũ.

- Installer xác minh (version giữ nguyên 0.4.0, **chưa cài hoặc chạy**):  
  `.tmp/desktop-artifacts/rtk-repomap-2026-11-19/OnniCode_0.4.0_x64-setup.exe`
- SHA-256: `cd890678b2afb41edd58dbb62c353877a35db71b35e64c597f3fbb7e843da8f9`
- Manifest bằng chứng: `.tmp/desktop-artifacts/rtk-repomap-2026-11-19/verification.json`
- Engine smoke test: `.tmp/rtk-engine-P2d7oy/verification.json`
- Log: `.tmp/rtk-typecheck.log`, `rtk-focused.log`, `rtk-vitest.log`, `rtk-unit.log`, `rtk-build.log`, `rtk-package.log`, `rtk-engine.log`, `rtk-installer.log` (các tên log đều nằm dưới `.tmp/`).

## Phần cần xác nhận trước khi tuyên bố rộng hơn

1. CI/Linux phải chạy lại full gate; máy Windows hiện tại chưa có full suite xanh.
2. Stager khai báo macOS x64/arm64, Linux musl x64/arm64. Manifest RTK 1.2.0 có các asset tương ứng, nhưng **chưa chạy executable hay installer thực trên các nền tảng đó**.
3. Chưa chạy benchmark bốn cấu hình (baseline, RTK, Repo Map, cả hai) bằng model thật. Chưa công bố tỷ lệ tiết kiệm token hoặc kết luận chất lượng. Dùng cùng commit/task/model/roster/limits và so sánh cả test + diff theo spec; không thay bằng ước tính từ số byte.
4. Hook Codex tự động là phần mở rộng riêng, chỉ làm sau khi chứng minh tương thích app-server và trust theo từng phiên. Nó không phải điều kiện để sử dụng tích hợp lệnh RTK tường minh hiện tại.

## Lưu ý về working tree

Các thay đổi manager–worker có sẵn từ trước được giữ nguyên. Chưa tạo commit, push, tag hoặc phát hành. Installer trên là bản kiểm chứng local của working tree hiện tại.
