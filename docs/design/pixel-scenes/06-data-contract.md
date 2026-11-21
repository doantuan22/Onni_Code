## 6. Dữ liệu và hợp đồng v2 — additive, migrate được

> Căn cứ: [R1 §3](research/R1-upstream.md#3-sángtối-độ-đọc-chữ-và-lý-do-v1-dễ-bị-mờ), [R2 §5A](research/R2-craft.md#a-giữ-canvas2d-indexed-thêm-layer-có-ngữ-nghĩa), [R3](research/R3-audit-scenes.md) và [R4 §5–6](research/R4-audit-theme-ui.md#5-thiết-kế-đề-xuất-thông-số-khởi-điểm-để-duyệt).

### 6.1 Wire shape: `appearance.scene` vẫn là túi optional

Trong `packages/contract/src/workspace.ts`, giữ `appearanceSchema.scene` optional
và **mọi khoá con optional**. Không enum `id`: cảnh mới không buộc đổi contract.

```ts
scene?: {
  on?: boolean
  id?: string // max 40
  visibility?: number // 0..1
  speed?: number // 0.25..2
  time?: 'auto' | 'dawn' | 'day' | 'dusk' | 'night'
  timeSource?: 'theme' | 'clock' | 'fixed'
  motion?: boolean
  surfaces?: { new?: boolean; chat?: boolean; other?: boolean }
  mode?: { new?: 'full' | 'horizon'; chat?: 'full' | 'horizon' }
}
```

| Quyết định cũ | Trạng thái v2 |
| --- | --- |
| D7: `appearance.scene`, tất cả optional, `id` string | **Giữ.** `uiStateSchema`/`workspaceUiStateSchema` tiếp tục nhận record cũ và bag mở round-trip key lạ. |
| `time:'auto'` | **Giữ trên wire để tương thích**, nhưng không còn tự mang một nghĩa duy nhất. `timeSource` mới quyết định auto theo theme hay clock; `time` là mốc của `fixed`. |
| `visibility` mặc định 0,7 | **Thay** bằng 0,9 cho record mới/scene thiếu giá trị, chỉ sau UI v2 đã bảo vệ chữ cục bộ. Giá trị explicit 0,7 không đổi. |
| `on:false`, speed 1, motion true, surfaces `{new:true,chat:true,other:false}`, mode `{new:'full',chat:'horizon'}` | **Giữ.** `on:false` không lazy-load engine/canvas. |

Không lưu `resolvedTheme`, palette đã resolve, contrast ceiling, scrim/panel alpha hay
FPS brake: tất cả là trạng thái suy ra theo runtime/theme/token, không phải preference.

### 6.2 Normalization và migration không phá record cũ

`packages/web/src/lib/appearance.ts` vẫn là đường chuẩn nhận dữ liệu không tin
cậy; `ScenePreferences` nội bộ có đầy đủ default, còn wire được phép thiếu mọi
field.

| Record đọc vào | `normalizeScenePreferences` v2 trả về | Ghi lại |
| --- | --- | --- |
| Không có `appearance.scene` | Default scene tắt; khi người dùng mở lần đầu, source `theme`, visibility 0,9. | Không tự tạo/ghi `scene` chỉ vì đọc. |
| V1 `time:'auto'`, không `timeSource` | `timeSource:'clock'`, `time:'auto'`. | Lần ghi appearance kế tiếp persist source rõ ràng; không làm cảnh đang dùng giờ máy đổi mood bất ngờ. |
| V1 `time:'dawn'|'day'|'dusk'|'night'`, không source | `timeSource:'fixed'`, giữ `time`. | Lần ghi kế tiếp persist source. |
| V2 thiếu source nhưng có `time` không hợp lệ/thiếu | `timeSource:'theme'`, `time:'auto'`. | Chỉ persist sau thao tác lưu bình thường. |
| ID lạ, string quá 40, số NaN/out-of-range | Giữ nguyên nguyên tắc v1: id lạ không bật cảnh; kẹp số hữu hạn; fallback default. | Không throw, không làm boot fail. |

Migration là **lazy normalisation**, không script quét `ui-state.json`, không đổi route
và không biến state đã viết thành state bắt buộc. `AppearanceProvider` khi PUT vẫn gửi
toàn bộ object `appearance` theo quy ước hiện có để không làm mất sibling keys.

### 6.3 Điểm chạm thực thi và parity

| File | Thay đổi được giao cho implementation |
| --- | --- |
| `packages/contract/src/workspace.ts` | Bổ sung `timeSource` optional vào đúng `appearanceSchema` dùng chung hai ui-state schema; giữ bounds/existing enum. |
| `packages/web/src/lib/appearance.ts` | Thêm `SceneTimeSource`, `ScenePreferences.timeSource`, default/normalizer và migration ở §6.2; mirror localStorage vẫn chỉ cần `on` + `id` cho pre-paint. |
| `packages/web/src/components/scene-provider.tsx` | Thêm `setTimeSource`; `setTime` chọn `fixed` khi người dùng chọn một mốc, không vô tình đổi preference khác. |
| `packages/web/src/components/scene-backdrop.tsx` | Resolve `timeSource` với `useTheme().resolvedTheme`, truyền theme/time đã resolve cùng semantics tới host/worker; không persist output runtime. |
| `packages/web/src/lib/scenery/engine/{types,palette,renderer}.ts` và `host-types.ts` | Nhận palette theo theme optional với fallback `palettes` v1; serialise theme/time resolve cho cả worker và main fallback. |
| `packages/web/index.html`, `components/appearance-provider.tsx` | Giữ logic pre-paint/mirror đồng bộ với `applyAppearance`; mirror không được giả định nó chứa visibility/time/source. |

### 6.4 Tương thích ngược và kiểm thử

- Schema/DTO/route parity vẫn mô tả đúng payload `GET/PUT /ui-state`; không thêm
  route, database, `ONNI_*` hay file cấu hình bắt buộc.
- Test normalizer cho toàn bộ bảng migration, ID lạ, record thiếu scene, explicit
  visibility 0,7 và record mới thiếu visibility; test provider giữ full object khi
  PUT. Contract/parity/typed-bodies bảo vệ wire optional.
- Test backdrop main/worker dùng cùng resolved theme/time source; đổi theme hệ
  thống không ghi preference. Test `motion:false`, unknown id/error fallback và
  `on:false` không tải engine.

---

[← Mục lục](README.md)
