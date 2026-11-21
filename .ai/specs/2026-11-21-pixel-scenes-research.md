# Cảnh nền pixel ("Scenery") — nghiên cứu và kế hoạch chi tiết (CHƯA triển khai)

Bản này thay bản nghiên cứu sơ bộ cùng ngày. Nguồn tham khảo: https://github.com/Aqua2409z/pixel-chat-themes (MIT).
Chỉ học **kỹ thuật**; không dùng lại cảnh, mã hay nghệ thuật của upstream. Bộ cảnh là của riêng OnniCode: phong cảnh đẹp Việt Nam và thế giới.

---

## 0. Các quyết định đã chốt (đọc phần này là đủ nắm hướng)

| # | Quyết định | Lý do ngắn |
| --- | --- | --- |
| D1 | Vẽ bằng **canvas độ phân giải thấp, buffer chỉ số màu (indexed), phóng to nguyên số, `image-rendering: pixelated`**; KHÔNG dùng lưới ký tự ASCII như upstream | Ra đúng chất pixel-art, đẹp hơn ASCII, cho phép đổi palette/ngày-đêm/theme gần như miễn phí |
| D2 | Lõi engine là **TS thuần, không DOM** (trả về `Uint32Array` RGBA); lớp mỏng bên ngoài chạy trong **Web Worker + OffscreenCanvas**, có đường lùi chạy ở main thread | Chat có danh sách ảo hoá nặng; worker không tranh main thread. Lõi không DOM ⇒ test được trong Node, xuất PNG để duyệt tranh |
| D3 | Canvas gắn ở **cột nội dung của app shell** (bên phải sidebar), dưới nội dung, một chỗ duy nhất cho cả `/new` lẫn chat | Một engine, một vị trí; sidebar giữ nền đặc nên luôn đọc được |
| D4 | **Không dùng `backdrop-filter`**. Độ đọc được đảm bảo bằng: màn che (scrim) từ token `--background` + tone-mapping trong palette + **trần độ hiện tính theo tương phản WCAG** | Rẻ GPU, và có bảo đảm đo được thay vì "xem bằng mắt" |
| D5 | Hai **chế độ hiển thị**: `Toàn khung` (mặc định cho `/new`) và `Đường chân trời` (mặc định cho chat: cảnh chỉ nổi ở ~45% phía dưới, phần trên hoà vào nền) | Chat là nơi đọc chữ; `/new` là nơi "trình diễn" |
| D6 | Mặc định **TẮT** (zero-config, không ai bị bất ngờ). Bật ở ba nơi: Settings → Appearance (đầy đủ), nút nhanh ở chân sidebar cạnh ThemeToggle (popover), ⌘K | Quen tay như theme; vẫn tìm được ở Settings |
| D7 | Lưu ở `appearance.scene` trong `~/.onni/ui-state.json` (toàn cục), tất cả khoá optional; id cảnh là `string` chứ không phải enum | Thêm cảnh không phải đổi contract; id lạ ⇒ rơi về "tắt" |
| D8 | Bộ cảnh v1: **4 Việt Nam + 4 thế giới = 8 cảnh**, mỗi cảnh là mã thủ tục (procedural) + vài sprite nhỏ viết tay; có công cụ render PNG trong Node để duyệt/regression | Thủ tục ⇒ nhẹ, đổi kích thước/thời điểm tuỳ ý, không phải kèm ảnh |

---

## 1. Hiện trạng cockpit (đã đọc mã)

- **Shell**: `packages/web/src/components/app-shell.tsx:274` — gốc `flex h-dvh bg-background`; sidebar bên trái; cột phải là `grid grid-rows-[auto_auto_1fr_auto]` (topbar mobile / banner / `<main overflow-y-auto>` / dock composer). `main` không có nền riêng.
- **`/new`**: `routes/new-task-surface.tsx:908` — gốc `relative isolate ... min-h-full`, đã chứa `TwinkleBackdrop` (`components/centered-state.tsx`) và `GhostCodeBackdrop` (`components/ghost-code-backdrop.tsx`), cả hai `absolute inset-0 -z-10` + `mask-image`. Đây là tiền lệ về kỹ thuật xếp lớp.
- **Chat**: `routes/task-thread/*` — transcript ảo hoá (`session-transcript.tsx`, `thread-rows`); bong bóng user `bg-muted/40`, thẻ tool `bg-card/40` (đã bán trong suốt); văn bản trợ lý nằm thẳng trên nền; dock composer `task-composer.tsx:210` là `sticky ... bg-background` (đặc).
- **Appearance**: `components/appearance-provider.tsx` + `lib/appearance.ts` + `routes/settings/appearance.tsx`; schema `appearanceSchema` ở `packages/contract/src/workspace.ts` (~L184, L346); lưu GLOBAL, ghi **toàn bộ** object mỗi lần, có bản sao localStorage cho pre-paint (`index.html` lặp lại logic stamping bằng JS thuần — đổi cái này phải đổi cái kia).
- **Điều khiển sẵn có**: `ThemeToggle` ở chân sidebar (`app-shell.tsx:608`), hành động "Toggle theme" trong ⌘K (`command-palette.tsx:1035`), phím tắt chỉnh được ở Settings → Keyboard (`lib/keybindings.ts`).
- **Ràng buộc kiểm thử**: `design-guardian.test.ts` cấm hex thô `#rrggbb` trong `src/**` (trừ `index.css`), cấm `bg-white/black`, cấm `100vh`, cấm biến thể `dark:`; `theme-contrast.test.ts` ghim tỷ lệ tương phản của token; i18n có `coverage.test.ts` + `untranslated-keys.json` (mỗi chuỗi `t()` mới cần bản `vi-*.ts`).
- **CSP**: server không đặt CSP, Tauri `csp: null` ⇒ Worker/OffscreenCanvas dùng được.

Hệ quả thiết kế: palette trong TS phải viết dạng số (`0xRRGGBB` hoặc `[r,g,b]`), không dùng chuỗi `#hex`.

---

## 2. Kỹ thuật vẽ — vì sao chọn D1

So sánh các hướng:

| Hướng | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| ASCII tile (upstream) | Đơn giản | Chữ trên nền chữ, mờ, kém đẹp, khó diễn tả ánh sáng | Bỏ |
| SVG/SMIL | Vector, dễ | Khó có "chất pixel", nhiều node ⇒ nặng, khó dither | Bỏ |
| WebGL shader | Rất đẹp, GPU | Tốn công, lỗi driver/WebView, khó test Node, khó giữ chất pixel | Bỏ (để dành v3 nếu cần) |
| Video/ảnh dựng sẵn | Đẹp tuỳ ý | Nặng gói, không đổi theme/giờ được, tốn băng thông cài đặt | Bỏ |
| **Canvas 2D buffer indexed + palette LUT** | Nhẹ, đúng chất pixel, đổi palette = đổi 16 phần tử, test được | Cần tự viết "shader mềm" | **Chọn** |

### 2.1 Đường ống (pipeline)

1. **Kích thước**: `px` = số pixel màn hình cho mỗi pixel nghệ thuật = `clamp(round(cao/180), 3, 6)`; buffer `W×H = ceil(rộng/px) × ceil(cao/px)`, tối đa 480×270. Canvas đặt `width=W height=H`, CSS `width:100%;height:100%;image-rendering:pixelated`.
2. **Toạ độ chuẩn hoá**: cảnh viết theo `(u, v)` trong [0,1] với `aspect`, **không phụ thuộc kích thước**. Mỗi cảnh khai báo `horizon` và `focus` (điểm nhấn) để chế độ `Đường chân trời` cắt đúng chỗ.
3. **Buffer chỉ số `Uint8Array(W*H)`** chứa chỉ số palette (0–31). Hai "bank": 0–15 màu thường, 16–31 bản tối/lạnh hơn dùng cho nước phản chiếu & bóng.
4. **Lớp tĩnh** (bầu trời, núi, ruộng, nhà) vẽ **một lần** khi đổi kích thước/cảnh/thời điểm vào `base`. **Lớp động** (mây, nước, thuyền, hạt) mỗi khung: `frame.set(base)` rồi vẽ lớp động lên `frame`.
5. **Chuyển sang màu**: `LUT[32]` (RGBA đã tone-map) → `Uint32Array` → `putImageData`. Đổi giờ trong ngày, đổi theme sáng/tối, đổi độ hiện = **chỉ tính lại LUT**, không vẽ lại buffer.
6. **Nhịp**: 12 fps (đúng chất pixel và rẻ). Chuyển động mượt hơn nhịp này không có ích.

### 2.2 Kỹ thuật làm cảnh trông "đẹp" (bộ công cụ chung của engine)

- **Palette hạn chế, ramp lệch sắc độ (hue-shifted)**: mỗi ramp 4–6 bậc; bóng ngả lạnh/tím, sáng ngả ấm. Tổng ≤ 16 màu/cảnh. Không dùng đen/trắng tuyệt đối.
- **Dithering Bayer 4×4/8×8** giữa hai bậc ramp liền nhau: gradient trời và sương không bị bậc thang, mà vẫn "pixel".
- **Phối cảnh khí quyển**: 3–5 lớp núi/đồi; lớp càng xa càng nhạt, ít tương phản và pha về màu trời (dịch chỉ số ramp về phía trời).
- **Ánh sáng nhất quán**: một nguồn sáng (mặt trời/trăng); viền sáng (rim light) trên sườn quay về nguồn sáng, tính từ dấu của độ dốc đường ridge. Chiều tối ở tiền cảnh = silhouette đậm.
- **Một điểm nhấn** đặt theo quy tắc một phần ba (mặt trời, thuyền, đỉnh núi); mọi thứ khác phục vụ nó.
- **Chuyển động tối thiểu, tinh tế**: tối đa 2 yếu tố di chuyển + **palette cycling** (đổi LUT: nước lấp lánh, cực quang, hoàng hôn đổi màu rất chậm). Không nhấp nháy, không chớp > 3 lần/giây (an toàn co giật).
- **Nhiễu nền (noise atlas)**: bake một texture nhiễu giá trị fBm **lặp được** 256×256 một lần; mây, sương, sóng, vân đá chỉ việc lấy mẫu với độ lệch (wrap) ⇒ mỗi khung chỉ tra mảng, không tính nhiễu.
- **Sinh địa hình có hạt giống** (`mulberry32`): cùng seed ⇒ cùng cảnh ⇒ test golden-hash được.
  - Sườn núi: fBm 1D / midpoint displacement.
  - Núi đá vôi (karst): tổng các "tháp" (parabol chặn đỉnh tròn, sườn dựng đứng) cộng nhiễu mép + vân dọc.
  - Ruộng bậc thang: trường cao độ 2D, **lượng tử hoá thành bậc**, mép bậc = nơi giá trị đổi ⇒ vẽ viền sáng; mỗi bậc lệch màu ngẫu nhiên nhẹ; "mùa nước đổ" = bậc phản chiếu màu trời.
  - Biển mây / sương: nhiều lớp ngưỡng nhiễu, mỗi lớp trôi tốc độ khác nhau (parallax).
  - Nước: phản chiếu lật hàng + lệch ngang `sin(y·f + t)` làm tròn nguyên, đọc từ `base`, ánh xạ sang bank tối.
  - Cực quang: rèm theo cột `x` với chiều cao/phase là tổng sin trôi chậm, ramp xanh→tím theo độ cao, dither.
- **Sprite nhỏ viết tay** (thuyền buồm, nhà mái vòm, cây keo, người): chuỗi ký tự → chỉ số palette, 8–40 px, khung 2 pha cho chim vỗ cánh/thuyền nhấp nhô.
- **Giờ trong ngày**: mỗi cảnh có 4 palette khoá (bình minh, ngày, hoàng hôn, đêm), nội suy trên LUT; vị trí mặt trời/trăng chạy theo `tod∈[0,1)`. Chế độ "Theo giờ máy" cập nhật LUT mỗi phút (rẻ).

### 2.3 Hợp đồng một cảnh

```
SceneDef {
  id, name (vi/en), region: 'vn' | 'world', tone: 'dark' | 'light' | 'both',
  palettes: { dawn, day, dusk, night }   // mỗi cái ≤ 32 số 0xRRGGBB
  defaultTime, horizon, focus,           // chuẩn hoá [0,1]
  build(ctx: BuildCtx): void             // vẽ lớp tĩnh vào base (seeded)
  frame(ctx: FrameCtx, t, dt, activity): void   // vẽ lớp động vào frame
}
```

`BuildCtx` cung cấp: `px(x,y,idx)`, `ridge()`, `fbm1/2`, `dither()`, `sprite()`, `rect/disc/line`, `rng`. Cảnh không được chạm DOM/`Math.random` (dùng `rng`).

Lazy: mỗi cảnh là một chunk `import()` riêng; engine lõi + registry nhỏ nằm trong bundle chính chỉ khi tính năng bật (cũng `import()` từ provider).

---

## 3. Bộ cảnh v1 (tiêu chí: đẹp, nhận ra ngay, đa dạng kỹ thuật)

| # | Cảnh | Nhóm | Điểm nhấn / kỹ thuật chính | Thời điểm mặc định |
| --- | --- | --- | --- | --- |
| V1 | Vịnh Hạ Long | VN | Tháp karst nhiều lớp + sương, nước phản chiếu, thuyền buồm nâu nhấp nhô | bình minh |
| V2 | Mù Cang Chải mùa lúa chín | VN | Ruộng bậc thang lượng tử hoá, viền sáng, ánh nắng chéo, chim | hoàng hôn |
| V3 | Fansipan biển mây | VN | Đỉnh núi + biển mây fbm nhiều lớp trôi, mặt trời lên | bình minh |
| V4 | Phú Quốc hoàng hôn | VN | Mặt trời lặn + đường nước lấp lánh (palette cycling), dừa silhouette, thuyền | hoàng hôn |
| W1 | Cực quang Tromsø (Na Uy) | Thế giới | Rèm cực quang + sao + fjord phản chiếu | đêm |
| W2 | Santorini hoàng hôn | Thế giới | Nhà trắng mái vòm xanh (sprite), vách đá, biển Aegean | hoàng hôn |
| W3 | Alps – Matterhorn bình minh | Thế giới | Đỉnh tuyết rim-light, hồ phản chiếu, thông | bình minh |
| W4 | Sa mạc Sahara chiều tà | Thế giới | Cồn cát đổ bóng bằng độ dốc, gió cuốn cát (hạt), lạc đà silhouette | hoàng hôn |

Dự phòng cho v1.1: Serengeti (cây keo), Monument Valley, Maldives, Đà Lạt sương. Khung hợp đồng cho phép thêm cảnh mà **không đụng contract hay UI** (chỉ đăng ký vào registry).

Quy trình làm một cảnh (checklist nghệ thuật, áp cho từng cảnh):
1. Chọn 1 ảnh tham chiếu mô tả bằng lời (bố cục, 3 màu chủ đạo, nguồn sáng) ghi vào đầu file cảnh.
2. Dựng palette 4 thời điểm trước khi viết mã; kiểm tra tương phản bằng test "trần độ hiện".
3. Viết `build` theo thứ tự xa→gần; xem PNG ở 3 cỡ (`320×180`, `480×270`, `240×300` cho cột hẹp) và 4 thời điểm.
4. Thêm đúng ≤ 2 chuyển động + palette cycling; kiểm tra khung hình đầu tiên khi `reduced-motion` vẫn đẹp.
5. Ghi hash golden của khung `t=0`; duyệt chéo bằng contact sheet.

---

## 4. Tích hợp vào giao diện

### 4.1 Kiến trúc mount (một chỗ cho mọi route)

```
AppearanceProvider  (đã có)  →  SceneProvider  →  Router → AppShell
AppShell (cột phải: relative isolate)
 ├─ <SceneBackdrop/>   canvas + scrim, absolute inset-0, -z-10, pointer-events-none, aria-hidden
 ├─ MobileTopBar / banner / <main> / composer dock   (nội dung, giữ nền trong suốt)
```

- Cột phải thêm `relative isolate`; canvas `-z-10` nằm trên nền `bg-background` của gốc nhưng dưới mọi nội dung (đúng mẫu `TwinkleBackdrop`).
- Gốc `<html>` được gắn `data-scene="on|off"` (như `data-density`) để CSS đổi các bề mặt chrome mà không cần React.
- `SceneBackdrop` đọc route bằng `matchPath` (cùng cách `routeOwnsScrollArrival`) → `surface ∈ {new, chat, other}` rồi chọn **hồ sơ hiển thị**.
- Khi một route tự có backdrop riêng (`TwinkleBackdrop`, `GhostCodeBackdrop`) và cảnh đang bật cho `new`, hai backdrop cũ **ẩn đi** (`[data-scene=on] [data-slot=twinkle-backdrop],[data-slot=ghost-code-backdrop]{display:none}`): hai nền trang trí chồng nhau là rối mắt.

### 4.2 `/new` — nơi trình diễn

- Hồ sơ `new`: chế độ `Toàn khung`, độ hiện = giá trị người dùng đặt (mặc định 70%), scrim nhẹ chỉ ngay dưới cột form 760px (mask ngang mềm) để ô nhập và tiêu đề đọc rõ.
- Form `/new` đã dùng thẻ/ô có nền; chỉ cần đảm bảo các bề mặt chính (composer, pill) giữ nền token (không đổi gì).
- Một nút phụ nhỏ (ghost icon) ở góc dưới phải trang `/new`: tên cảnh + mũi tên đổi cảnh, mở cùng popover với sidebar. Không đặt gì trong vùng composer.
- Hoạt ảnh được phép sống động nhất ở đây (đủ 12 fps, toàn bộ lớp động).

### 4.3 Chat — nơi phải ưu tiên đọc

Vấn đề thật: văn bản trợ lý nằm thẳng trên nền, transcript ảo hoá cuộn liên tục, dock composer đang đặc.

Giải pháp ghép ba lớp:
1. **Chế độ `Đường chân trời`** (mặc định cho chat): canvas chỉ phủ ~45% đáy cột (`h-[45%] bottom-0`), phần trên mờ dần (`mask-image: linear-gradient(to top, black 45%, transparent)`); cảnh được tác giả bố cục để phần trời trên cùng có thể bị cắt.
2. **Scrim theo cột đọc**: một lớp `background: color-mix(in oklab, var(--background) A%, transparent)` có mask ngang mềm quanh cột `--measure` (820px ở chế độ `narrow`). Alpha `A` ở giữa cột **không thấp hơn** ngưỡng tính từ trần tương phản (4.3.1); hai bên (gutter) để lộ cảnh nhiều hơn trên màn rộng.
3. **Chrome bán trong suốt chỉ khi bật cảnh**: dock composer và header dính `background: color-mix(var(--background) 88%, transparent)` qua selector `[data-scene="on"] [data-slot=thread-dock]`; **không** blur. Thẻ tool/bong bóng đã `/40` nên giữ nguyên.

Hiệu năng trong chat: cảnh chạy trong worker nên không tranh main thread với việc render stream; main thread chỉ có phần ghép lớp của trình duyệt. Hạ cấp tự động nếu cần (4.3.2). Cảnh KHÔNG cuộn theo transcript (cố định), tránh phải đo scroll ở main thread; hiệu ứng parallax theo cuộn để lại v2 và mặc định tắt.

#### 4.3.1 Trần độ hiện bảo đảm tương phản

Với mỗi cảnh/palette/theme tính offline: `Lmax` = độ sáng lớn nhất của pixel trong palette. Màu nền hiệu dụng khi độ hiện `s` và scrim `A`: `eff = A·bg + (1−A)·(s·pixel + (1−s)·bg)`. Test đơn vị khẳng định với `s` = giá trị tối đa của thanh trượt, `foreground` và `muted-foreground` còn ≥ 4.5:1 (AA, đúng chuẩn mà `theme-contrast.test.ts` đang ghim) trên pixel xấu nhất. `A_min` cho cột đọc rút ra từ phép tính này. Nghĩa là thanh trượt không thể đưa người dùng tới trạng thái không đọc được.

#### 4.3.2 Phanh hiệu năng và an toàn

- Tạm dừng khi `document.hidden`; dừng hoạt ảnh (chỉ 1 khung tĩnh) khi `prefers-reduced-motion: reduce` hoặc người dùng tắt "Chuyển động".
- Đo thời gian trung bình 30 khung: > 8 ms ⇒ hạ xuống 6 fps ⇒ vẫn quá ⇒ khung tĩnh và hiện một dòng nhỏ trong Settings ("đã tự giảm để tiết kiệm máy").
- Màn hình hẹp (< `md`): chỉ chế độ `Đường chân trời`, buffer ≤ 240 px chiều rộng; mặc định chat trên mobile = tắt trừ khi người dùng bật.
- Không gửi sự kiện nào ra ngoài; không mạng; worker terminate khi unmount/tắt; kiểm thử rò rỉ (rAF/timer/worker).
- Worker không khả dụng ⇒ chạy cùng lõi trên main thread với cùng phanh.

### 4.4 "Cảnh phản ứng theo agent" (v2, tuỳ chọn)

Truyền một số `activity∈[0,1]` (có run đang chạy) vào `frame`: cảnh chỉ đổi **tốc độ/độ dày** hạt và mây (không chớp). Lấy từ truy vấn run đang hoạt động đã có (không thêm `refetchInterval`, không `new WebSocket`). Chốt v2 vì cần đo đạc, không chặn v1.

---

## 5. Điều khiển người dùng — đặt ở đâu

Nguyên tắc: bật/tắt phải **một chạm**, chỉnh sâu ở Settings, không thêm gì vào vùng composer.

| Nơi | Có gì | Ghi chú |
| --- | --- | --- |
| **Chân sidebar**, ngay cạnh `ThemeToggle` (`app-shell.tsx:~608`) | Nút icon (lucide `MountainSnowIcon`, trạng thái bật được tô) mở **Popover**: công tắc Bật/Tắt; lưới thumbnail 8 cảnh (tab VN / Thế giới); thanh trượt **Độ hiện**; liên kết "Cài đặt cảnh nền…" | Có ở cả sidebar thu gọn (rail) và `MobileNavDrawer` |
| **Settings → Appearance** (thẻ mới "Cảnh nền") | Công tắc chính; thư viện thumbnail sống (render 1 khung tĩnh mỗi cảnh); **Hiển thị ở**: `/new`, Chat, Trang khác (3 công tắc); **Chế độ** theo mặt: Toàn khung / Đường chân trời; **Thời điểm**: Theo giờ máy / Bình minh / Ngày / Hoàng hôn / Đêm; **Độ hiện**; **Tốc độ**; **Chuyển động** bật/tắt; ghi chú "tự giảm khi máy yếu / hệ điều hành bật giảm chuyển động" | Dùng `SettingsField`, `Segmented`, `Switch`, `Button` sẵn có |
| **⌘K** | "Bật/Tắt cảnh nền", "Cảnh nền kế tiếp", "Cảnh nền trước" (cạnh "Toggle theme") | Phím tắt riêng **không gán mặc định** (tránh đụng `Mod+Alt+*`/`Alt+n`); người dùng gán được ở Settings → Keyboard |
| **Góc dưới phải `/new`** | Chip tên cảnh + ‹ › | Cùng popover; chỉ hiện khi cảnh đang bật cho `/new` |

Không đặt nút trong header của chat (đã chật) và không tạo màn hình riêng.

Trạng thái thân thiện: khi tắt, popover vẫn mở được để xem trước ("xem thử" hiển thị cảnh tạm trong khung 16:9 trong popover, không phủ cả app). Đổi cảnh có chuyển mờ 400 ms (hai canvas hoặc fade LUT); `reduced-motion` ⇒ đổi tức thì.

---

## 6. Dữ liệu và hợp đồng

`appearanceSchema` (cả hai file ui-state dùng chung) thêm khoá tuỳ chọn:

```
scene: { on?: boolean, id?: string(≤40), visibility?: 0..1, speed?: 0.25..2,
         time?: 'auto'|'dawn'|'day'|'dusk'|'night', motion?: boolean,
         surfaces?: { new?: boolean, chat?: boolean, other?: boolean },
         mode?: { new?: 'full'|'horizon', chat?: 'full'|'horizon' } }
```

- `normalizeAppearance` kẹp giá trị, id lạ ⇒ `on:false`; mặc định: `on:false, visibility:0.7, speed:1, time:'auto', motion:true, surfaces:{new:true,chat:true,other:false}, mode:{new:'full',chat:'horizon'}`.
- `Appearance`, bản sao localStorage (`onni-scene` — chỉ cờ bật + id, đủ cho pre-paint đặt `data-scene`) và script pre-paint trong `index.html` cập nhật **cùng commit** (cảnh báo sẵn ở đầu `lib/appearance.ts`).
- `PUT /ui-state` ghi cả object `appearance` (đã là quy ước); các test contract-parity/typed-bodies phải xanh. Trường mới tuỳ chọn ⇒ file cũ vẫn parse. Không đổi route nào, không thêm biến `ONNI_*`, không đổi `.env.example`.
- Tài liệu: `docs/reference.md` mục Appearance.

---

## 7. Kiểm thử và cách duyệt "đẹp"

| Lớp | Cách |
| --- | --- |
| Lõi engine (Node) | `rng`/noise/dither/ridge là hàm thuần ⇒ test đơn vị; **golden hash** FNV của khung `t=0`, `320×180`, từng cảnh × từng thời điểm; đổi mã làm đổi hash ⇒ phải cố ý cập nhật |
| Duyệt tranh | Script dev `scripts/scene-snap` (Node, tự ghi PNG bằng `zlib`) → contact sheet: cảnh × {320×180, 480×270, 240×300} × {dawn, day, dusk, night} × {theme sáng, tối}; người/worker xem ảnh trước khi nhận cảnh |
| Tương phản | Test "trần độ hiện" (4.3.1) cho mọi cảnh × theme; palette không chứa hex chuỗi (qua `design-guardian`) |
| UI | Vitest + Testing Library: popover, Settings, ⌘K, route `/new` và chat gắn đúng hồ sơ, `data-scene`, cờ `reduced-motion` ⇒ không có timer chạy, unmount ⇒ worker terminate; `route-parity`, contract parity |
| i18n | Thêm bản vi cho mọi chuỗi (`coverage.test.ts`) |
| Hiệu năng | Khung lõi ≤ 2 ms ở 480×270 (benchmark trong test, ngưỡng rộng để không flaky); kích thước chunk: lõi ≤ ~20 KB gz, mỗi cảnh ≤ ~15 KB gz; bundle chính không đổi khi tính năng tắt |
| E2E | `npm run test:e2e` (agent-browser): bật cảnh ở popover → `data-scene=on`, canvas có mặt ở `/new` và chat, tắt → canvas biến mất; ảnh chụp 2 theme |

Không bỏ/skip test nào; các kiểm tra phụ thuộc OffscreenCanvas dùng cổng khả năng trong test.

---

## 8. Kế hoạch triển khai (để giao worker sau)

Giai đoạn và quyền sở hữu file rời nhau:

| Phần | Nội dung | File sở hữu | Phụ thuộc |
| --- | --- | --- | --- |
| P1 Contract + lưu trữ | Schema, `Appearance`, normalize, mirror, pre-paint, provider mới (`SceneProvider`) | `packages/contract/src/workspace.ts`, `lib/appearance.ts`, `index.html`, `components/scene-provider.tsx` + tests | — |
| P2 Engine lõi | rng, noise atlas, dither, ridge, sprite, LUT/tone-map, trần tương phản, frame loop, worker + fallback, phanh hiệu năng | `packages/web/src/lib/scenery/engine/**` | kiểu từ P1 |
| P3 Công cụ duyệt | `scene-snap` PNG + contact sheet + golden hash | `packages/web/scripts/scene-snap.*` (hoặc `packages/web/src/lib/scenery/dev/`) | P2 |
| P4a Cảnh VN (V1–V4) | 4 file cảnh + palette + sprite | `lib/scenery/scenes/vn/**` | P2, P3 |
| P4b Cảnh thế giới (W1–W4) | 4 file cảnh | `lib/scenery/scenes/world/**` | P2, P3 |
| P5 Mount + CSS | `SceneBackdrop`, hồ sơ theo route, scrim, chrome bán trong suốt, ẩn backdrop cũ | `components/scene-backdrop.tsx`, `app-shell.tsx`, `styles/index.css` | P1, P2 |
| P6 Điều khiển | Popover sidebar, thẻ Settings, ⌘K, chip `/new`, i18n vi | `components/scene-popover.tsx`, `routes/settings/appearance.tsx`, `command-palette.tsx`, `routes/settings/registry*`, `i18n/vi-*` | P1 |
| P7 Tài liệu + E2E | `docs/reference.md`, spec cập nhật, e2e | `docs/`, `.ai/specs/`, e2e | tất cả |

Thứ tự gợi ý: P1 → (P2 ‖ P6 giao diện với cảnh giả) → P3 → (P4a ‖ P4b) → P5 → P7. P5 là chỗ chạm `app-shell.tsx` nên chỉ một chủ.
Gợi ý worker: P2 và P5 cần suy luận (nặng); P4 là việc sáng tạo lặp-xem-ảnh nên giao cho worker xem được ảnh, mỗi worker không quá 2 cảnh; P1, P6, P7 mức vừa. Quy tắc dự án: worker chạy test chỉ từng file liên quan, không chạy full suite.

Ước lượng thô: P1 nhỏ, P2 lớn nhất (lõi), P3 nhỏ-vừa, mỗi cảnh vừa (phần lớn thời gian là chỉnh thẩm mỹ), P5/P6 vừa.

### Tiêu chí hoàn thành v1
- Tắt: không tải mã engine, bundle chính không đổi, không worker, không canvas.
- Bật ở `/new` và chat: đọc rõ ở cả hai theme tại độ hiện tối đa (test tương phản xanh), CPU nhàn rỗi thấp (khung lõi ≤ 2 ms), `reduced-motion` ⇒ khung tĩnh.
- 8 cảnh qua duyệt contact sheet (ở 3 cỡ × 4 thời điểm).
- Gỡ file cấu hình ⇒ về mặc định tắt; ui-state cũ vẫn mở được.

---

## 9. Rủi ro và cách xử lý

| Rủi ro | Cách xử lý |
| --- | --- |
| Văn bản khó đọc trên cảnh sáng | Trần độ hiện theo tương phản + scrim tối thiểu quanh cột đọc + chế độ Horizon cho chat |
| Tranh "không đẹp" (rủi ro lớn nhất, mang tính chủ quan) | Quy trình checklist nghệ thuật, contact sheet duyệt trước khi nhận, mỗi cảnh một chủ, cho phép loại cảnh không đạt khỏi v1 thay vì kéo dài |
| Worker/OffscreenCanvas thiếu trong một WebView | Phát hiện khả năng, lùi về main thread cùng lõi; phanh hiệu năng |
| Pin/CPU trên laptop | 12 fps, dừng khi ẩn tab, tự hạ, tắt ở mobile mặc định |
| Hai nền trang trí chồng nhau | Ẩn `TwinkleBackdrop`/`GhostCodeBackdrop` khi cảnh bật |
| `design-guardian` | Palette số, màu UI chỉ qua token; kiểm lại sau khi viết |
| Đổi `app-shell.tsx` làm vỡ test layout (`app-shell.test.tsx`, `sidebar-frame.test.tsx`) | Canvas là phần tử `absolute` thêm vào, không đổi lưới; chạy riêng các test đó |
| Cảnh phản ứng theo agent (v2) gây phân tâm | Tách v2, chỉ đổi tốc độ/độ dày, mặc định tắt |
| Credit | Ghi "kỹ thuật lấy cảm hứng từ Pixel Chat Themes (MIT)" trong docs; không sao chép mã/nghệ thuật |

## 10. Giả định cần bạn xác nhận khi bắt đầu (có mặc định, không chặn việc lập kế hoạch)
- Danh sách 8 cảnh ở mục 3 (đổi/thêm cảnh không ảnh hưởng kiến trúc).
- Mặc định TẮT và chat dùng `Đường chân trời`.
- v2 (parallax khi cuộn, cảnh phản ứng theo agent) để sau.
