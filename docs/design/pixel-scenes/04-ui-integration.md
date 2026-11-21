## 4. Tích hợp vào giao diện v2 — sửa chữa và nâng cấp

> Căn cứ: [R1 §3](research/R1-upstream.md#3-sángtối-độ-đọc-chữ-và-lý-do-v1-dễ-bị-mờ), [R2 §6](research/R2-craft.md#6-khuyến-nghị-triển-khai-và-tiêu-chí-duyệt), [R3](research/R3-audit-scenes.md) và [R4 §3–7](research/R4-audit-theme-ui.md#3-chuỗi-làm-mờ--số-liệu-từ-mã). V2 sửa v1, không dựng lại shell hay đổi D1/D2/D3/D6/D7.

### 4.1 Kiến trúc mount — **GIỮ, nhưng thay chính sách ghép**

```
AppearanceProvider → SceneProvider → Router → AppShell
AppShell (app-content-column: relative isolate)
 ├─ <SceneBackdrop/>  canvas, absolute inset-0, -z-10, pointer-events-none
 ├─ wrapper/chrome trong suốt khi là khoảng trống
 └─ các khối đọc có tint + viền cục bộ, không blur
```

| Quyết định | V1 | V2 cần làm |
| --- | --- | --- |
| Một canvas ở cột nội dung | Giữ D3; `app-shell.tsx` mount `SceneBackdrop` một lần. | **Giữ.** Không mở canvas ra sidebar; sidebar vẫn đặc. |
| Route/surface | `scene-backdrop.tsx` phân `new` / `chat` / `other`. | **Giữ.** `new` là không gian trình diễn, `chat` ưu tiên transcript; `other` vẫn horizon. |
| Backdrop cũ `/new` | CSS ẩn `twinkle-backdrop` và `ghost-code-backdrop` khi scene sẵn sàng. | **Giữ.** Không chồng nền trang trí. |
| Bộ ghép | LUT toàn cảnh bị clamp rồi `scene-scrim` che cả cột dọc. | **THAY.** Tách cảnh vùng trống và nền đọc; bỏ cơ chế giảm cùng một ngân sách hai lần. |

### 4.2 Sáng/tối và sửa lỗi clamp LUT + scrim kép

**Lỗi v1 cần bỏ.** `components/scene-backdrop.tsx` hiện đặt
`visibility: min(s, ceiling.maxVisibility)` cho renderer **và** đặt
`--scene-scrim: ceiling.minScrim`; `styles/index.css` phủ scrim lên cùng cột.
Theo R4, khi `s=0,7`, tâm cột còn khoảng 4,18–7,79% thay vì mức bảo vệ
cần thiết. Tăng slider lên 1 còn làm tâm cột mờ hơn (`C²/s`).

| Bước thực thi | Điểm chạm mã | Quy tắc v2 |
| --- | --- | --- |
| Chọn palette | `lib/scenery/engine/types.ts`, scene `palettes`, `engine/palette.ts`, `scene-backdrop.tsx` | Mỗi scene có palette light/dark riêng, fallback về palette v1 khi chưa vẽ lại. `resolvedTheme` từ `theme-provider.tsx` là đầu vào; không dùng một palette đêm rồi phủ trắng cho light. |
| Resolve thời điểm | `scene-backdrop.tsx`, renderer/host/worker | `timeSource:'theme'` chọn `defaultTime` theo theme (light: day/dawn; dark: dusk/night do scene khai báo); `clock` dùng giờ máy; `fixed` dùng `time`. Cùng options được serialise qua `host-types.ts` tới main/worker. |
| Render vùng trống | `scene-backdrop.tsx`, `renderer.ts`, `contrast.ts` | LUT dùng đúng visibility người dùng `s` ngoài khối đọc; **không** clamp toàn canvas để bảo vệ chữ không nằm ở đó. Slider phải làm độ lệch pixel khỏi `--background` tăng đơn điệu ở gutter. |
| Bảo vệ chữ cục bộ | `contrast.ts`, `scene-backdrop.tsx`, `styles/index.css` | Đo foreground, muted và soft trên **composite panel thật**. Tint nền token + border 1px chỉ nằm dưới khối chữ; tăng độ đặc của khối đó/fallback đặc khi không đạt AA, không hạ saturation toàn cảnh. |
| Ngân sách một lần | `contrast.ts` | Không đồng thời `min(s,C)` và `A=1-C/s` cho cùng pixel. Nếu giao diện chưa tách panel được, hotfix tối thiểu là chỉ giữ một trong hai để đạt C; đó không phải trạng thái v2 hoàn chỉnh. |

- **[Thay D4 về phạm vi]** vẫn cấm `backdrop-filter`; “kính” là `color-mix`
  tint và border 1px, không blur canvas hay transcript. R1 cho thấy bề mặt cục
  bộ bảo vệ chữ tốt hơn veil toàn ảnh; R4 đặt alpha khởi điểm panel **light 96%,
  dark 94%**, sau đó đo composite thực, không coi đó là chứng nhận AA.
- **[Giữ quyết định cũ]** `--background` toàn app không đổi; không đổi token
  để cứu cảnh. Parser `readContrastColors` phải đọc cả `--soft-foreground` và
  phải được mở rộng nếu token rời hex 6 chữ số.
- Sau khi panel cục bộ và kiểm tra AA đã có: default `visibility` mới là **0,9**
  cho preference thiếu giá trị/record mới; giữ nguyên lựa chọn explicit 0,7 của
  người dùng. Cảnh vẫn mặc định `on:false`.

### 4.3 `/new` — Toàn khung có khoảng thở thật

| Hạng mục | Thay đổi cụ thể |
| --- | --- |
| Hình học | Trong `routes/new-task-surface.tsx`, giữ `new-task-layout` tối đa 1040px và `new-task-main` 760px nhưng gom header, mô tả, composer, metadata, suggestion thành một **reading panel** đặt trên; feather 24–40px chỉ bao panel và kết thúc dưới suggestion. |
| Cảnh | `SceneBackdrop` ở `full`; cảnh đi xuyên vùng trống dưới form, không có `scene-scrim` cột 760px kéo tới đáy như CSS v1. Duyệt desktop 1440×900 với 35–45% cột nội dung không bị panel khi form không mở rộng. |
| Điểm nhấn | Dùng `SceneDef.focus` khi đặt chip/landmark; chip `ScenePopover` vẫn ở góc dưới, nhưng có panel nhỏ và không đè chủ thể. Chưa lệch form trái trong đợt đầu. |
| Hẹp/mobile | **Thay** ép horizon v1 do `narrow`: `/new` dùng hero strip tĩnh 160–200px trước/sau form nền đặc; không tăng buffer để lấp màn hình, kiểm cả bàn phím. |

### 4.4 Chat — Horizon nhìn thấy được, transcript an toàn

| Hạng mục | V1 | V2 |
| --- | --- | --- |
| Rect cảnh | Layer đáy 45%; 55% của layer bị fade và dock đè vùng đậm. | `app-shell.tsx`/thread layout tính rect theo viewport và dock bằng `ResizeObserver`: strip cao **32–40% transcript nhìn thấy**, kết thúc ngay trên dock; fade bầu trời chỉ **20–30%** strip. Không cập nhật theo scroll mỗi frame. |
| Lane đọc | Scrim ngang 768/820px phủ toàn chiều cao. | Wrapper transcript/khối nội dung có tint 94/96% + border; gutter và khoảng trống sau message không có panel để thấy cảnh. Không tạo background đo theo từng token/dòng, giữ tương thích virtualizer. |
| Dock | `task-composer.tsx` `bg-background`; CSS v1 cho header/dock 88% nền. | Textarea/composer vẫn nền đặc. Wrapper chrome có thể trong suốt ở khoảng trống; control và text nằm trong panel đủ contrast. Trên mobile/text dài trở về bar cục bộ đặc. |
| Hẹp | `narrow` ép horizon nhưng vẫn dùng mask cột sai measure. | Không có gutter: lane đặc là ưu tiên, strip/empty-state nhỏ là nơi trình diễn; không tuyên bố cảnh nền chat dài phải nổi như `/new`. |

### 4.5 Chrome, hiệu năng và nghiệm thu

- **Chrome trong suốt có điều kiện:** chỉ nền của wrapper header/dock được trong
  suốt; không đặt `opacity` lên parent chứa chữ và không hạ bar đồng loạt 50%.
  `styles/index.css` chỉ bật token scene khi `[data-ready]`; sidebar vẫn đặc.
- **Giữ:** canvas `pointer-events-none`, fixed theo cột chứ không theo
  transcript; worker/fallback, hidden/reduced-motion, phanh 12→6→0 FPS của
  engine giữ nguyên. R2/R3 nhấn mạnh worker không làm compositing CSS miễn phí,
  nên đo main/worker sau thay đổi.
- **Ảnh nghiệm thu bắt buộc:** raw palette, sau LUT, UI cuối; 8 cảnh × light/dark
  ở `/new`, chat tối thiểu Hạ Long/Sahara/Tromsø × light/dark và viewport hẹp.
  Ghi scene/seed/time/timeSource/visibility/panel alpha. Kiểm pixel gutter ở
  slider 0/.3/.7/.9/1 tăng đơn điệu; kiểm ≥4,5:1 cho foreground/muted/soft trên
  panel cuối. Contact sheet/golden không thay ảnh app (R1, R4).

---

[← Mục lục](README.md)
