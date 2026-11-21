## 5. Điều khiển người dùng v2 — ít nhưng thật

> Căn cứ: [R1 §5](research/R1-upstream.md#5-mười-ý-tưởng-nên-học-chuyển-sang-engine-indexed-thế-nào), [R2 §3–4](research/R2-craft.md#3-danh-mục-theo-hiệu-quả-thị-giác--chi-phí), [R3 §4](research/R3-audit-scenes.md#4-cảnh-mới-nên-cân-nhắc) và [R4 §4–6](research/R4-audit-theme-ui.md#4-so-sánh-các-hướng-sángtối).

**Nguyên tắc giữ lại:** bật/tắt một chạm; cấu hình đầy đủ ở Settings; không đặt
điều khiển vào composer; cảnh mặc định tắt. **Thay v1:** thumbnail không còn icon
giữ chỗ, và “Theo giờ máy” không còn là lựa chọn auto duy nhất.

| Nơi | Nội dung v2 | Điểm chạm |
| --- | --- | --- |
| Chân sidebar / rail / `MobileNavDrawer` | `ScenePopover`: bật/tắt, lưới 2×2 theo tab VN/Thế giới, thumbnail thật, độ rõ cảnh; link Appearance. | `components/scene-popover.tsx`, `app-shell.tsx` |
| Settings → Appearance | Thẻ “Cảnh nền”: thư viện, bề mặt/chế độ, palette/thời điểm, độ rõ, chuyển động/tốc độ. | `routes/settings/appearance.tsx`, `scene-provider.tsx` |
| ⌘K | Bật/tắt, cảnh kế/trước; không gán phím mặc định. | `components/command-palette.tsx`, keybindings hiện có |
| `/new` | Chip tên + trước/sau, mở đúng popover; chỉ hiện khi scene bật cho `/new`. | `routes/new-task-surface.tsx`, `ScenePopover chip` |

### 5.1 Popover: thumbnail là khung render thật

| Quyết định | V2 |
| --- | --- |
| Nguồn ảnh | `SceneThumbnail` lazy-load registry/engine và render **một khung tĩnh thật** tại layout thumb (mục tiêu 168×96 theo tham chiếu R1), seed cố định; không dùng `MountainSnowIcon` hoặc ảnh minh hoạ tách rời. |
| Semantics | Thumbnail dùng palette đã resolve theo `resolvedTheme` và `timeSource`; reduced-motion luôn tĩnh. Nhãn cảnh vẫn là text i18n, `aria-pressed`/focus hiện tại giữ nguyên. |
| Chi phí | Render lúc popover/Settings mở, cache theo `sceneId + theme + resolvedTime + palette version`; giải phóng host/canvas khi đóng. Không khởi động full-frame worker chỉ để chạy thumbnail động. |
| Trạng thái tắt/lỗi | Popover vẫn cho xem lưới khi `on:false`; chọn cảnh chỉ đổi preference, bật là hành động riêng. Nếu chunk/lõi lỗi, hiện tên + fallback token, không thay nền app. |

**[Bị thay]** `SceneLibrary` hiện sinh icon placeholder từ `SCENE_IDS` và ghi
“Scene previews are placeholders.”; v2 bỏ thông báo này sau khi thumbnail thật
được kiểm bằng scene/theme/time cố định. Registry, không phải một mảng tên lặp
trong popover, là nguồn metadata thumbnail/region/focus.

### 5.2 Palette và thời điểm: tách “giao diện” khỏi “đồng hồ”

Settings thay select “Time of day” cũ bằng hai control rõ nghĩa:

| Control | Giá trị | Hiệu lực |
| --- | --- | --- |
| **Nguồn thời điểm** | **Theo giao diện** (mặc định v2), Theo đồng hồ, Cố định | `theme` dùng mốc mặc định per-scene/per light–dark palette; `clock` resolve giờ máy; `fixed` dùng mốc bên cạnh. Theme hệ thống và giờ máy độc lập. |
| **Thời điểm cố định** | Bình minh / Ngày / Hoàng hôn / Đêm | Chỉ hiện/bật khi nguồn là Cố định; giữ `time` trong state để đổi qua lại không mất lựa chọn. |

- **[Giữ để truy vết]** bốn mốc palette `dawn/day/dusk/night` và nội suy giờ
  máy vẫn tồn tại. **[Thay]** `auto` v1 của record cũ được migrate thành
  `timeSource:'clock'`; record mới thiếu source dùng `theme`.
- Light mặc định day/dawn, dark mặc định dusk/night do **từng scene** khai báo,
  không phải quy tắc ép mọi cảnh về 12:00/00:00. Người dùng vẫn luôn ép được
  mốc cố định. Không gọi API vị trí/thời tiết.
- Nhãn slider đổi thành **“Độ rõ cảnh (vùng trống)”**: nó không hứa làm chữ
  nền cảnh rõ hơn. Giá trị mặc định 0,9 chỉ xuất hiện sau compositor bảo vệ chữ
  cục bộ; không ghi đè giá trị explicit.

### 5.3 Hiệu ứng và tốc độ

| Điều khiển | Giá trị / hành vi |
| --- | --- |
| **Chuyển động cảnh** | `motion` bật/tắt toàn bộ animation (nước, hạt, sprite, palette cycle, event); tắt/reduced-motion cho một khung tĩnh hoàn chỉnh. |
| **Tốc độ hiệu ứng** | `speed` 0,25–2×, bước 0,05; nhân timeline của hiệu ứng, không tăng FPS hay ngân sách hạt. Hiển thị x× và giữ phanh 12→6→0. |
| **Không thêm toggle từng effect** | Người dùng không phải chọn riêng gió/sương/nước. R1/R2 ưu tiên tác giả chọn 3 hiệu ứng có ý nghĩa; toggle hạt riêng dễ biến chất lượng cảnh thành ma trận cấu hình và không sửa silhouette. |
| **Tự giảm** | Khi hidden, OS reduced-motion, người dùng tắt motion hoặc engine tự brake, hiển thị lý do trong Settings; speed vẫn được lưu, không bị âm thầm sửa. |

### 5.4 Tiêu chí hoàn thành UI

1. Thumbnail mỗi scene đúng art/palette light hoặc dark ở cùng thời điểm đã resolve;
   kiểm không giữ canvas/worker sau popover close.
2. “Theo giao diện / Theo đồng hồ / Cố định” thay đổi kết quả dễ hiểu và giữ
   lựa chọn fixed khi chuyển nguồn; record v1 vẫn hiển thị “Theo đồng hồ”.
3. Tốc độ thay timeline, không tăng cadence 12 FPS; motion off vẫn đẹp và không
   còn timer render. Popover, Settings, ⌘K, `/new` chip và i18n đều có test.

---

[← Mục lục](README.md)
