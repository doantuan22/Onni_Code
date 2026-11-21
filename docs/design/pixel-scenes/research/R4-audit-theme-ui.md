# R4 — Kiểm toán sáng/tối, độ đọc và tích hợp UI

Ngày: 2026-11-22. Phạm vi: nghiên cứu và đề xuất, **không sửa mã**. Đã đọc `_BRIEF.md`, `00-decisions.md`, README, engine, provider, shell, CSS và contract hiện có. Các con số dưới là kết quả đọc/chạy hàm của checkout này; thông số thiết kế đề xuất được ghi riêng, chưa phải kết quả nghiệm thu UI mới.

## 1. Kết luận nghiệm thu

Mức **70% trên thanh trượt không phải 70% màu cảnh tới mắt người dùng**. Có hai lần kéo màu về `--background`: LUT bị kẹp bởi trần tương phản, rồi scrim vẫn được tính theo mức 70% ban đầu. Với `time:auto`, giữa cột đọc chỉ còn **4,18–4,69%** độ lệch màu cảnh trên theme sáng, **5,99–7,79%** trên theme tối, trước cả horizon và chrome. Vì vậy chỉ tăng mặc định visibility không giải quyết được; trong vùng đã chạm trần, nó còn làm cảnh mờ hơn.

Khuyến nghị: **palette có chủ đích cho từng theme + thời điểm mặc định theo theme + cảnh rõ ở vùng trống + panel bảo vệ chữ cục bộ**. Giữ một canvas tại shell, không blur toàn màn hình, không đổi token nền toàn ứng dụng. Mục tiêu là bỏ ràng buộc tương phản ở nơi không có chữ, thay vì bỏ bảo vệ chữ.

## 2. Bằng chứng ảnh đã xem

Đây là ảnh có sẵn của app thật, không phải ảnh mới do R4 chạy lại. Không có sidecar chứa toàn bộ setting/commit/runtime token, nên không dùng chúng để khẳng định chính xác palette/thời điểm đã chụp.

| Ảnh | Quan sát trực tiếp | Ý nghĩa |
| --- | --- | --- |
| [new-light-world-sahara.png](../evidence/ui/new-light-world-sahara.png) | Dải giữa trắng gần nền; biên đụn cát nhận được ở hai mép nhưng màu rất nhạt | Vùng trống lớn dưới form vẫn bị phủ một cột scrim cao toàn trang |
| [new-dark-world-sahara.png](../evidence/ui/new-dark-world-sahara.png) | Trời, cát và con lạc đà rất tối; trung tâm gần đen | Theme tối cũng mất chi tiết, không chỉ theme sáng |
| [new-light-vn-halong.png](../evidence/ui/new-light-vn-halong.png) | Đảo, nước thành những mảng xanh xám nhạt; thuyền khó nhận | Khó nhận diện địa danh dù diện tích tranh lớn |
| [new-dark-vn-halong.png](../evidence/ui/new-dark-vn-halong.png) | Các lớp đảo chìm trong nền; thuyền chỉ còn vệt nhỏ | Thiếu phân lớp màu đến mắt người xem |
| [chat-light-sahara.png](../evidence/ui/chat-light-sahara.png) | Cảnh chỉ ở đáy; giữa xám, hai mép có mảng tối mạnh; dock che phần thấp | Không được coi đây là phép đo tương phản đã đạt: mép tối ở ảnh sáng cần kiểm tra lại cấu hình/build khi chụp |
| [chat-dark-sahara.png](../evidence/ui/chat-dark-sahara.png) | Transcript dễ tách, nhưng chỉ còn vệt cảnh rất tối sát đáy, dưới dock | Horizon cộng chrome giảm thêm diện tích hữu dụng |

Đối chiếu nguồn `lib/scenery/dev/snapshots.ts`: contact sheet chỉ render `background` với `visibility:0.7`; **không chạy `visibilityCeiling`, CSS scrim, horizon hay chrome**. Golden hash lại render không có tone background. Vì vậy contact sheet/golden đẹp hoặc test engine xanh không chứng minh cảnh trong app rõ.

## 3. Chuỗi làm mờ — số liệu từ mã

Các đường dẫn ở phần này tương đối với `packages/web/src/` trừ contract. “Độ hiện hiệu dụng” dưới đây là hệ số của `(pixel - background)` trong **kênh sRGB**, không phải phần trăm luminance hay mức cảm nhận thị giác; LUT có làm tròn byte.

### 3.1 Nền, chữ và trần tương phản

`styles/index.css` khai báo:

| Theme | `--background` | `--foreground` | `--muted-foreground` | `--soft-foreground` |
| --- | --- | --- | --- | --- |
| Tối | `#090909` | `#ededed` | `#a1a1a1` | `#8a8a8a` |
| Sáng | `#fafafa` | `#171717` | `#5c5c5c` | `#6b6b6b` |

`scene-backdrop.tsx/readContrastColors` chỉ đọc ba token đầu bằng regex hex **6 chữ số**; `soft-foreground` không nằm trong tập kiểm tra. Đổi token sang `oklch(...)`, hex 3 chữ số hoặc tên màu sẽ khiến hàm không đọc được và cảnh chưa sẵn sàng; không được đổi định dạng CSS mà bỏ quên parser.

`engine/contrast.ts` linearize kênh bằng ngưỡng `0.04045`, trọng số luminance `0.2126/0.7152/0.0722`, ratio `(Lmax+0.05)/(Lmin+0.05)`. Hàm tìm nhị phân **48 vòng**, đòi cả foreground và muted đạt **4.5:1**, bao cả sai số làm tròn, rồi trừ `0.0001` ở trần nội khoảng. Ngưỡng chữ thường 4.5:1 phù hợp [W3C WCAG 2.2, Understanding SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); đây là ngưỡng, không làm tròn kết quả thiếu thành đạt.

Trên nền nguyên gốc: muted đạt **7.70694:1 tối**, **6.40653:1 sáng**. Với muted, vùng nền tối được phép tăng luminance tới khoảng `0.04031`; vùng nền sáng phải giữ luminance ít nhất khoảng `0.65660`. Chữ muted là giới hạn chặt hơn foreground chính trong những palette được tính ở đây. Đây là lý do một điểm màu sáng/tối cực trị kéo cả cảnh về nền.

`visibilityCeiling` với `time:auto` không chỉ dùng giờ hiện tại: nó lấy mọi palette dawn/day/dusk/night, gọi `expandPalette`, rồi lấy **min/max từng kênh** làm envelope. Envelope có thể ghép các kênh không cùng xuất hiện trong một pixel, nên bảo thủ hơn kiểm từng màu thực. Ngay ban ngày, theme sáng vẫn bị giới hạn bởi màu đêm; ngay ban đêm, theme tối vẫn bị giới hạn bởi highlight ban ngày. Bốn mốc giờ nội suy không phải bốn palette dành riêng cho theme.

`expandPalette` tạo đủ **32 màu**, trong đó bank phản chiếu thiếu phần tử được trộn **35% về `#14243b`**. Đây là shade vật liệu có chủ đích, không phải alpha phủ toàn cảnh; tuy vậy bank này cũng tham gia trần nên màu tối của phản chiếu có thể siết giới hạn theme sáng.

### 3.2 Hai lần giảm cùng một ngân sách

Đặt `B` là nền, `P` màu cảnh, `s` mức yêu cầu, `C` là `maxVisibility`:

```text
t = min(s, C)                        // SceneCanvas → HostOptions.visibility
A = clamp(1 - C/s, 0, 1), nếu s > 0 // contrastCeiling.minScrim
P_lut = round(B + t*(P-B))           // createLut/mixColor
P_out ≈ B + t*(1-A*m)*h*(1-q)*(P-B)
```

`m` là alpha mask ngang của scrim, `h` là alpha horizon (full = 1), `q` là opacity nền UI phía trên. Công thức cuối bỏ qua làm tròn LUT; CSS scrim là màu nền pha với transparent trong oklab, có alpha A, **không phải** một bước nội suy pixel cảnh sang màu khác trong oklab.

Trong giữa cột đọc (`m=1`), full (`h=1`), không có panel (`q=0`), khi `s>C`:

```text
độ hiện thực = C*(1-A) = C²/s
```

Nếu chỉ dùng scrim với LUT ở đúng `s`, kết quả sẽ là `s*(C/s)=C`. Nếu chỉ kẹp LUT ở C và bỏ scrim dư, cũng còn C. Mã hiện có thực hiện **cả hai**, nên thấp hơn mục tiêu an toàn cần thiết. Ngoài cột (`m=0`), vẫn chỉ còn C do kẹp LUT toàn cảnh, chứ không được 70%.

### 3.3 Kết quả chạy trực tiếp hàm hiện có, s = 0.7, time = auto

| Cảnh | C tối | A tối | Giữa cột tối | C sáng | A sáng | Giữa cột sáng |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fansipan | 20.47% | 70.75% | 5.99% | 17.32% | 75.26% | 4.28% |
| Hạ Long | 23.35% | 66.64% | 7.79% | 17.83% | 74.53% | 4.54% |
| Mù Cang Chải | 22.70% | 67.57% | 7.36% | 18.11% | 74.12% | 4.69% |
| Phú Quốc | 20.52% | 70.69% | 6.01% | 17.24% | 75.37% | 4.25% |
| Matterhorn | 21.42% | 69.40% | 6.55% | 17.85% | 74.50% | 4.55% |
| Sahara | 21.75% | 68.92% | 6.76% | 18.05% | 74.21% | 4.66% |
| Santorini | 21.33% | 69.53% | 6.50% | 17.93% | 74.38% | 4.59% |
| Tromsø | 23.01% | 67.13% | 7.56% | 17.10% | 75.57% | 4.18% |

Ví dụ Sahara sáng: LUT còn `0.1805412413`, scrim `0.7420839410`, giữa cột `0.0465644855`. Trong header/dock 88% nền, nếu cùng vị trí còn horizon đầy đủ, hệ số chỉ **0.5588%** (`0.0465644855 × 0.12`). Sahara tối tương ứng **0.8113%**. Ở gutter dưới chrome, hệ số vẫn bị nhân 0.12 nhưng không có A đầy đủ.

Chọn giờ cố định chỉ cải thiện phần nào: Sahara sáng `day` có C **20.46%**, giữa cột **5.98%**; `dusk` **19.05% / 5.18%**; `night` **18.05% / 4.66%**. Tối `dusk` C **24.58%**, giữa **8.63%**. Đổi giờ không chữa cơ chế giảm kép.

Nâng slider Sahara sáng từ 70% lên 100%, giữ auto, giữa cột giảm từ **4.66% xuống 3.26%** (`C²/1`); gutter vẫn **18.05%**. Cần sửa ý nghĩa/thực thi slider trước khi nâng mặc định.

Phương pháp tái lập đã chạy: Node **v24.21.0**, `node --input-type=module` qua stdin; dùng `node:module.stripTypeScriptTypes` đọc trực tiếp `palette.ts`, `contrast.ts`, thay đường dẫn import palette bằng data URL trong bộ nhớ; đọc bốn mảng hex của từng scene và dựng envelope đúng `visibilityCeiling`; gọi `contrastCeiling(envelope, B, [foreground, muted], 0.7)`, tính `min(0.7,C)*(1-A)`. Không cài dependency, không sửa TS, không chạy test/build. Số trên là tính toán mã, chưa phải lấy mẫu pixel trình duyệt.

### 3.4 Opacity và diện tích của từng lớp

| Lớp | Giá trị thực từ mã | Hệ quả |
| --- | --- | --- |
| Renderer | `packRgba` alpha **255**, LUT đã trộn B bằng t | Canvas không có CSS opacity 0.7; giảm màu đã diễn ra trong dữ liệu pixel |
| Host/main và worker | Truyền cùng `background/visibility`; main `putImageData`, worker bitmap `drawImage` | Không có lớp opacity bí mật ở host; worker fallback không tự làm sáng lại |
| Full | layer `absolute inset:0`, h=1 | Toàn khung có cảnh nhưng bị LUT kẹp toàn cục |
| Horizon | layer cao **45%** đáy, mask `to top, black 45%, transparent` | 55% trên shell không có cảnh; từ đáy layer tới 45% layer alpha=1, rồi giảm tới 0 ở đỉnh |
| Scrim | `--scene-scrim = A*100%` | Ở giữa bị giảm kép như trên |
| Mask ngang | `/new` **760px**, chat mặc định **768px**, fade hai mép **5rem** | Scrim phủ toàn chiều cao cột, kể cả chỗ không có chữ; ở narrow, backdrop chat dùng `--measure=820px` trong khi `--chat-measure=720px` |
| Header/dock chat | **88%** `--background`, không blur; chỉ khi backdrop `data-ready` | Chỉ 12% cảnh bên dưới xuyên qua; ô nhập nền đặc còn che riêng |
| Shell/main | column `relative isolate`, backdrop `-z-10`, main không có bg | Mount không phải nguồn alpha dư; sidebar nằm ngoài cột cảnh |
| Trạng thái lỗi/chưa sẵn sàng | thiếu ready ⇒ `visibility:hidden`; failed ⇒ null | Có thể mất cảnh hoàn toàn, khác với cảnh đã render nhưng nhạt |

Với chiều cao shell H, horizon bắt đầu tại y=0.55H; alpha đạt 1 từ y=0.7975H tới đáy (0.45 × 0.45 = 0.2025H vùng đầy đủ). Tại y=0.67375H alpha=0.5. Dock ở đáy có thể che phần đẹp nhất. Ở viewport hẹp **<768px**, code ép horizon kể cả `/new`, không phụ thuộc lựa chọn full.

`resolveTime('auto')` lấy `(giờ*60+phút)/1440`, không phải bình minh/hoàng hôn theo địa lý. Anchor night=0, dawn=.25, day=.5, dusk=.75, tức **00:00/06:00/12:00/18:00**; nội suy giữa các mốc. Host/worker cập nhật palette khi phút đổi trong frame loop; đây không phải cơ chế đồng bộ với theme hệ thống. Khi scene tĩnh vì giảm chuyển động, cần xét riêng việc làm mới palette theo thời gian.

Giới hạn bảo đảm hiện có: foreground + muted và envelope palette, không bao hết `soft-foreground`, màu cú pháp, status, alpha chữ, popup hoặc mọi nền lồng nhau. Header `/new` đang có chữ soft trực tiếp trên nền. “Test AA xanh” không có nghĩa toàn UI đã nghiệm thu AA.

## 4. So sánh các hướng sáng/tối

Chi phí là phân tích kỹ thuật định tính; chưa có benchmark mới, không hứa số ms.

| Hướng | Lợi ích và độ đọc | Nhược điểm | Chi phí và khả năng tích hợp |
| --- | --- | --- | --- |
| **A. Palette riêng cho light/dark**, vẫn 4 thời điểm | Giữ vật liệu, xa/gần có chủ đích; sáng dùng sky sáng với silhouette vừa đủ, tối dùng đèn/viền nổi trên trời sâu | Cần duyệt nhiều tranh; không tự bảo vệ chữ trên highlight. Nếu giữ clamp toàn cục, tranh vẫn nhạt | LUT 32 màu rẻ, đổi khi theme/time thay đổi; chi phí chính là tác giả/QA 8 cảnh × 2 theme × 4 mốc |
| **B. Ban ngày cho light, đêm cho dark** | Dễ hiểu, cảnh và chrome cùng mood; lấy resolvedTheme tránh light UI trên đêm bị tẩy trắng | Đồng hồ và theme có thể trái nhau; ép night mọi cảnh làm mất đặc trưng dusk Sahara. Không giải quyết alpha kép | Dùng palette sẵn có, rẻ nhất; phải tách “Theo giao diện” khỏi “Theo đồng hồ”, cho phép giờ cố định |
| **C. Cảnh đủ màu; chữ trong panel kính có viền** | Gutter/vùng trống thấy cảnh thật; nền panel kiểm soát được nên bảo vệ cả muted/soft dễ hơn | Panel chiếm tranh; kính quá trong vẫn khó đọc. Blur thật không bảo đảm ratio | Panel tint + border không blur chi phí nhỏ; `backdrop-filter` trên nhiều bubble đang cuộn có thêm chi phí compositor cần đo và trái D4 hiện tại |
| **D. Mask cục bộ vùng đọc** | Cảnh sáng rõ ngoài chữ; giữ transcript liên tục, ít cảm giác “nhiều thẻ” | Mask cột cao toàn màn hình như hiện tại phá khoảng trống; mask theo từng dòng đo layout tốn kém, lệch khi stream/ảo hoá | Gradient CSS quanh panel/reading lane cố định rẻ; tránh mask từng token/dòng, tránh đo DOM mỗi frame |
| **E. Tự động theo hệ thống** | ThemeProvider đã hỗ trợ OS đổi light/dark; scene đi cùng resolvedTheme sẽ nhất quán | Đây là chính sách chọn A/B, không phải cách bảo vệ độ đọc. `prefers-color-scheme` không phải giờ ngoài trời | Tái dùng listener sẵn, không thêm polling hay listener cho mỗi cảnh; fallback theme ứng dụng khi API vắng |

**Chọn A + C (kính bằng tint, không blur) + D giới hạn theo khối; B là mặc định chọn mốc theo theme, E đi qua ThemeProvider.** Với cảnh có giờ đặc trưng, tác giả có thể chọn light=dawn/day và dark=dusk/night thay vì ép cứng 12h/0h. Người dùng vẫn chọn cố định hoặc theo đồng hồ. Không dùng API thời tiết/vị trí, không cần cấu hình mới để chạy.

D4 hiện chốt không `backdrop-filter`: khuyến nghị chính giữ quyết định này, làm “kính” bằng tint và viền 1px; blur thật chỉ là hướng so sánh, cần quyết định sửa D4 và benchmark riêng trước triển khai. D1/D2/D3/D6/D7 giữ nguyên. D4 cần cập nhật **phạm vi trần tương phản** từ toàn cảnh sang nền ngay dưới chữ; D5 cần cập nhật hình học horizon.

## 5. Thiết kế đề xuất, thông số khởi điểm để duyệt

### 5.1 Ngân sách màu và panel

- Sau khi đổi kiến trúc bảo vệ chữ, default `visibility` từ **0.7 → 0.9** cho người bật cảnh mới/record thiếu giá trị; **giữ on:false**, không tự bật, không ghi đè người đã đặt 0.7. Slider điều khiển màu cảnh **ngoài vùng đọc**, tăng phải làm cảnh rõ hơn đơn điệu. Sáng/tối cùng giá trị mang cùng nghĩa, không để người dùng phải bù lỗi bằng hai slider.
- Vùng trống: `P_out=B+s(P-B)`, **không clamp C vì không có chữ**; không scrim toàn trang. Tối có thể chọn palette night/dusk nhưng không trộn cả tranh về đen để giả night. Sáng giữ màu vật liệu, không phủ trắng cho giống nền.
- Panel chữ sáng khởi điểm nền `#fafafa` **96%**, tối nền `#090909` **94%**, border 1px theo token theme, radius theo hệ thống. Phần kính xuyên cảnh chỉ 4–6% ngay dưới chữ nhưng cảnh ngoài panel còn 90% — đây là chủ đích, không phải hạ màu cả tranh.
- Kiểm tra biên cực đoan bằng hàm luminance hiện có: panel sáng 96% trên đen cho `#f0f0f0`, soft `#6b6b6b` đạt **4.67634:1**; panel tối 94% trên trắng cho `#181818`, soft `#8a8a8a` đạt **5.14343:1** (màu byte làm tròn). Đây là sanity check cho nền/soft đơn giản, không thay thế kiểm tất cả token UI. Ưu tiên alpha sRGB tường minh để phép tính và CSS khớp nhau.
- Form, code, diff, tool output, popover dày chữ giữ nền đủ đặc; chữ phụ/giờ/trạng thái cũng phải ở vùng được bảo vệ. Nâng alpha panel cục bộ khi thiếu tương phản; không giảm saturation/visibility toàn cảnh. Có fallback panel nền đặc khi màu không đọc được.

### 5.2 `/new`: dành chỗ thật cho tranh

Hiện form rộng tối đa 760px trong layout 1040px, top padding `clamp(32px,7vh,84px)`; phần dưới thường trống nhưng mask giữa vẫn phủ tới đáy.

Đề xuất desktop: gom tiêu đề + mô tả + composer + metadata + suggestion vào **một khối đọc gọn**, canh trên như hiện tại, padding panel 20–24px. Mask feather 24–40px quanh khối, chấm dứt ngay dưới suggestion, không kéo cột trắng/đen xuống hết trang. Cho phép cảnh đi xuyên vùng trống dưới form; mục tiêu duyệt là ít nhất **35–45% diện tích cột nội dung** không có panel trên màn 1440×900, không phải ràng buộc cứng khiến tràn form khi settings mở.

Với cửa sổ rộng ≥1200px có thể thử form lệch trái và landmark phía phải dùng `scene.focus`; mặc định đầu tiên giữ form giữa để ít thay đổi. Cả hai phải bố cục focal landmark tránh composer 760px. Không chèn chữ quảng bá lên trời rồi phải che thêm. Chip tên cảnh ở góc có panel nhỏ và tránh vật thể chính.

Mobile: bỏ ép horizon cho `/new` như một hệ quả phụ của width; dùng hero strip tĩnh cao **160–200px** trên form hoặc cảnh sau vùng trống, form nền đặc. Không tăng buffer quá ngân sách chỉ để lấp strip; kiểm chiều cao khả dụng với bàn phím mở.

### 5.3 Chat: chân trời không bị dock nuốt

Giữ chat mặc định horizon nhưng tách **rect cảnh** và **rect đọc**: thử strip cao **32–40% phần transcript nhìn thấy**, kết thúc ngay phía trên dock thay vì ở đáy cả app-content-column. Fade phần trời trên **20–30% chiều cao strip**; phần còn lại giữ màu đủ. Đây là thông số thử nghiệm, thay cho hiện trạng 55% chiều cao layer bị fade và dock nằm đè lên vùng alpha 1.

Reading lane có nền tint 94/96% chỉ trong transcript; tool/code giữ nền riêng. Gutter hai bên, khoảng trống sau tin nhắn cuối và vùng chưa có tin nhắn được mở cảnh. Không tạo một panel/filter cho mỗi dòng token; nền có thể nằm trong wrapper khối nội dung đang được virtualizer hiển thị. Đo theo viewport/dock bằng ResizeObserver khi resize, không theo scroll mỗi frame; scene vẫn đứng yên khi transcript cuộn.

Trên cửa sổ hẹp không có gutter, ưu tiên lane đặc và hero/empty-state nhỏ nhìn rõ; không giả vờ hạ alpha toàn bộ là đã trình diễn được tranh. Với chat dài, độ đọc thắng diện tích tranh; tuyệt đối không đặt foreground trực tiếp trên unbounded palette.

### 5.4 Thanh/chrome

Header/dock hiện 88% nền vẫn chỉ truyền 12% cảnh và không bảo vệ mọi màu chữ. Đề xuất **wrapper chrome trong suốt ở khoảng không**, nhóm điều khiển/thông tin nằm trong panel 94/96% có viền; textarea vẫn nền đặc. Khi text chạy dài hoặc mobile, quay về bar nền đặc/cục bộ đủ tương phản. Giữ sidebar đặc như D3, không mở rộng canvas ra sau sidebar chỉ để tăng diện tích.

Không hạ cả header xuống opacity 50%: opacity trên parent làm nhạt cả chữ, còn background alpha quá thấp tạo mất tương phản. Chỉ đổi nền wrapper, không đổi alpha nội dung. Không thêm `backdrop-filter` toàn shell.

## 6. Điểm chạm triển khai tiếp theo

| Vị trí | Thay đổi cụ thể cần làm trong task triển khai |
| --- | --- |
| `packages/contract/src/workspace.ts`, `appearanceSchema.scene` | Giữ tất cả khóa optional, id string ≤40, visibility 0..1. Thêm optional `timeSource:'theme'|'clock'|'fixed'` để giữ các enum time cũ; không đổi nghĩa `auto` cũ một cách âm thầm. Với record mới thiếu timeSource/time ⇒ theme; record cũ có `time:'auto'` ⇒ clock; giờ cố định cũ ⇒ fixed. `time` tiếp tục giữ mốc cho fixed. Không lưu resolvedTheme hay C/A tính được vào state |
| `lib/appearance.ts` | Cập nhật type/default/normalizer: default mới visibility=.9 chỉ sau khi thay compositor; normalize timeSource theo migration trên; giữ người dùng explicit visibility/on/surfaces/mode. Không tạo yêu cầu config/env mới |
| `components/scene-provider.tsx` | Thêm setter timeSource nếu cần; provider giữ preference, không sở hữu timer hoặc renderer. `setTime` từ UI đặt fixed/clock nhất quán, lưu full scene qua onChange |
| `components/appearance-provider.tsx`, `web/index.html` | Lưu qua workspace ui-state toàn cục hiện có, không ghi file tay. Giữ full appearance khi PUT vì merge top-level. Đồng bộ mirror/prepaint nếu thêm data attribute; mirror hiện chỉ on/id nên không suy đoán nó đã giữ visibility/time |
| `components/theme-provider.tsx` | Dùng resolvedTheme sẵn có; không thêm listener OS vào từng backdrop. System theme và clock scene là hai lựa chọn độc lập |
| `engine/types.ts`, từng SceneDef/palette | Thêm nhánh palette theme optional với fallback palette cũ; giữ 32 chỉ số, shade bank và vật liệu nhất quán giữa theme. Metadata light/dark time mặc định theo cảnh để giữ mood |
| `components/scene-backdrop.tsx` | Tách render visibility toàn cảnh khỏi contrast protection vùng đọc; bỏ việc vừa min(s,C) vừa áp A cũ. Resolve theme/timeSource thống nhất cho cả palette vẽ và tập màu contrast. Bổ sung soft/ink thực dùng; token parser hỗ trợ định dạng mới nếu đổi. Không render chữ chưa có nền an toàn trong frame đổi theme |
| `engine/contrast.ts` | Tái dùng phép đo nhưng tính trên composite panel/reading mask thật. Nếu chỉ sửa tối thiểu trước redesign, giữ clamp LUT và bỏ scrim dư để đạt C — đây chỉ là sửa giảm kép, chưa đủ mục tiêu tranh 90% ngoài chữ |
| `engine/palette.ts`, `renderer.ts`, `host-types.ts`, `host.ts`, `worker-runtime.ts` | Tone-map ngoài chữ một lần bằng s; truyền theme palette/time đã resolve cùng semantics qua cả worker/main. Chỉ cập nhật LUT khi theme/minute thay đổi; xem palette clock khi motion=false; giữ hidden/reduced-motion/phanh, bitmap tối đa một frame chờ |
| `styles/index.css` | Giữ `--background` toàn app. Thêm token scene-local cho panel alpha light/dark, border, feather, strip-height. Thay mask ngang cao toàn shell bằng mask theo khối; bỏ scrim global cộng với LUT clamp. CSS chỉ kích hoạt khi đúng surface và data-ready |
| `components/app-shell.tsx`, `routes/new-task-surface.tsx`, thread header/dock/transcript | Giữ một backdrop/isolation, tạo rect/wrapper đọc và vị trí horizon theo dock; không đặt background opaque trên toàn main. Tiêu đề/metadata/suggestion `/new` vào cùng panel. Wrapper chrome rỗng trong suốt, controls có nền |
| `components/scene-popover.tsx`, `routes/settings/appearance.tsx`, bản dịch | Nhãn rõ “Theo giao diện / Theo đồng hồ / Cố định”; slider “Độ rõ cảnh” mô tả vùng trống. Không thêm bảng kỹ thuật C/A vào flow người dùng; số này dành cho dev/QA |
| Test và tài liệu kế tiếp | Cập nhật appearance/contract/parity, backdrop/provider/worker và theme contrast tests theo semantics mới; cập nhật docs D4/D5/default, không rebaseline golden để che tranh xấu |

Migration nêu trên là đề xuất cụ thể, cần triển khai bằng schema/normalizer và test record cũ. Bản R4 không thay file state và không thêm setting bắt buộc. Không cần thêm field panel alpha cho người dùng: là token thiết kế được suy ra tự động.

## 7. Tiêu chí nghiệm thu lần tới

1. 8 cảnh × 2 theme ở `/new`; chat ít nhất Sahara/Hạ Long/Tromsø × 2 theme, window rộng và <768px. Chụp cùng scene/time/seed/viewport/scroll, lưu sidecar commit, s, resolvedTheme, timeSource, palette time, A/panel alpha để so sánh có nghĩa.
2. Bảng tính và ảnh riêng ba trạng thái: raw palette, render trong app ở default, render khi giảm chuyển động. Contact sheet không thay ảnh app. Đưa landmark/hạt/mặt nước vào vùng không bị form hoặc dock che.
3. Slider 0/.3/.7/.9/1: tại pixel gutter/vùng trống cố định, độ lệch khỏi B tăng đơn điệu (trừ byte rounding), không còn C²/s. Screenshot so sánh xác nhận default .9 thực sự thấy tranh mà không cần nheo mắt.
4. Đo ≥4.5:1 trên composite cuối cho foreground/muted/soft, placeholder và mọi token chữ dùng trong panel, cả cảnh sáng nhất/tối nhất, đổi theme giữa stream. Kiểm riêng icon/border/focus theo yêu cầu tương ứng; không tuyên bố đạt chỉ từ một threshold palette.
5. Giữ text input, chọn chữ, scroll/virtualization, popover, tắt cảnh/unknown id/error fallback, system change, motion=false, worker fallback hoạt động. Cảnh tắt không tải engine. So sánh perf trước/sau trên cùng máy; chưa được ghi “miễn phí GPU” nếu chưa đo.

R4 chỉ thực hiện kiểm toán nguồn, tính số và đọc ảnh. Không chạy npm test/build/install theo giới hạn brief; không có bằng chứng nghiệm thu thiết kế mới vì chưa triển khai.
