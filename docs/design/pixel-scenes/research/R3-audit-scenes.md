# R3 — Kiểm toán cảnh và engine hiện tại

Ngày kiểm toán: 2026-11-22. Phạm vi là tám cảnh v1 và engine dưới
`packages/web/src/lib/scenery/`. Đây là đánh giá thị giác từ contact sheet/UI
hiện có, đối chiếu trực tiếp với mã nguồn; không phải đo benchmark thời gian.

## Kết luận nhanh

V1 đã làm đúng phần kỹ thuật (buffer indexed, palette thời điểm, worker/fallback,
ngân sách 480×270 và motion giảm được) nhưng chưa đạt mục tiêu tranh pixel-art
có chiều sâu. Mẫu chung là **mảng địa hình tô phẳng**, nhiều bề mặt dùng một
hoặc hai chỉ số palette, đường chân trời ngang, và chi tiết lặp theo noise thay
vì cụm vật thể có chủ đích. Motion có thật ở cả tám cảnh, nhưng phần lớn chỉ là
dịch/chớp một lớp nhỏ; nó không sửa được silhouette hoặc bố cục tĩnh yếu.

Trong ảnh app thực, `new-light-vn-halong.png` ở chế độ sáng và khoảng 70% hiện
cảnh vẫn nhạt đến mức chỉ còn dải nước/đốm; chính tone-map trộn từng màu vào
`background` là nguyên nhân trực tiếp. Ở chat, gradient scrim mạnh hơn còn làm
phần cảnh vốn ít tương phản mất trước khi người dùng kịp nhận diện.

## Thang điểm và quyết định

Điểm 1–5, trong đó 3 = nhận diện được nhưng chưa đủ chất lượng trình diễn,
5 = có thể giữ gần như nguyên trạng. “Vẽ lại” nghĩa là giữ địa danh/ý tưởng,
không vá thêm noise vào bản cũ.

| Cảnh | Bố cục | Chiều sâu | Màu | Chi tiết | Chuyển động | Quyết định |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Vịnh Hạ Long | 3 | 2 | 3 | 2 | 2 | Vẽ lại |
| Phú Quốc hoàng hôn | 4 | 3 | 4 | 3 | 3 | Giữ (chỉnh lớn) |
| Mù Cang Chải | 2 | 2 | 3 | 2 | 2 | Vẽ lại |
| Fansipan biển mây | 3 | 3 | 4 | 2 | 3 | Vẽ lại |
| Matterhorn | 4 | 3 | 3 | 3 | 3 | Giữ (chỉnh lớn) |
| Sahara | 3 | 2 | 3 | 2 | 1 | Vẽ lại |
| Santorini | 2 | 2 | 3 | 2 | 1 | Bỏ khỏi v2 |
| Tromsø cực quang | 3 | 2 | 3 | 2 | 3 | Vẽ lại |

## Kiểm toán từng cảnh

### 1. Vịnh Hạ Long — vẽ lại

- **Vì sao chưa đẹp:** Ba hàng karst có cùng ngôn ngữ “viên bo tròn dựng đứng”;
  khối giữa/phải to và phẳng, silhouette không có vách, hang, cây hay đường
  viền đặc trưng. Các dải sương và nước đều là hàng ngang dài, đều nhịp nên
  biến vịnh thành pattern sọc. Mặt nước phản chiếu dạng cột lượn giống karst
  nhưng không bị đứt/che bởi gợn sóng. Thuyền chỉ vài pixel ở góc phải, quá nhỏ
  để tạo câu chuyện hay tỷ lệ. Bốn palette đổi hue nhưng value range gần nhau;
  ở light UI càng chìm.
- **Hoạt ảnh đang có (mã thực thi):**
  `reflectWater(..., t * 0.34, 1)` quét vùng từ `waterline` xuống đáy, lấy ảnh
  tĩnh phía trên rồi dịch sin theo từng hàng; `junk` dịch ngang
  `sin(t * .16)` và bob `sin(t * .7)`.
- **Chi phí khung riêng:** phản chiếu quét ~32% buffer (một vòng lồng
  `0.32 × W × H`) + sprite 15×11; ngoài chi phí chung.
- **Hướng vẽ lại:** bố cục một đảo tiền cảnh cắt mép trái, hai lớp đảo xa mờ
  và một junk lớn hơn ở vùng tiêu điểm; phản chiếu bị cắt thành dải ngắn theo
  sóng. Dùng fog layer có alpha/ordered mask để phân tách lớp xa thay vì ba
  sọc sương ngang.

### 2. Phú Quốc hoàng hôn — giữ, chỉnh lớn

- **Vì sao chưa đẹp:** Đây là cảnh có silhouette dễ nhận nhất (hai cây dừa,
  mặt trời và thuyền) và palette hoàng hôn tốt nhất. Tuy nhiên biển bị phủ
  dày bởi các nét 1-pixel đồng đều; bờ cát là một tam giác tối rộng thiếu
  texture/đá/vệt chân, thân và lá dừa còn dạng nét đen một màu. Đảo xa mảnh
  không tạo lớp rõ, thuyền nhỏ không có buồm/nhân vật. Ban đêm mặt trời thành
  đĩa trắng như ban ngày.
- **Hoạt ảnh đang có:** Chỉ số các glint được thu khi `build`; mỗi frame chúng
  palette-cycle 4 nấc ở `Math.floor(t * 2)`. Thuyền bob `sin(t * .9)` và vẽ
  một ripple tĩnh theo thuyền. Không có sway cho lá dừa, sóng hoặc mây.
- **Chi phí khung riêng:** lặp theo số glint đã lưu (cỡ hàng nghìn ở buffer
  lớn), rồi sprite và một `rect`; không quét cả nền ngoài copy chung.
- **Hướng chỉnh:** giới hạn glint vào một “lối sáng” taper, thay nét biển
  random bằng 3 mẫu wave tile luân phiên; thêm 2–3 màu rim/occlusion vào dừa,
  bờ có foam irregular và sprite thuyền riêng. Giữ bố cục/palette hoàng hôn.

### 3. Mù Cang Chải — vẽ lại

- **Vì sao chưa đẹp:** Cảnh đọc như một tấm thảm sọc: các thửa bậc thang phủ
  kín canvas, cùng độ dày và cùng curvature nên không mô tả được thung lũng.
  Mặt trời nằm trên đúng đỉnh đồi, tạo tangency; núi xa ít tách value khỏi
  ruộng. Các “ray” là bảy line cứng, chim chỉ vài pixel. Thiếu nhà sàn, đường
  mòn, cây, người/nông cụ và nhóm ruộng có quy mô khác nhau; vì vậy không có
  tiền–trung–hậu cảnh thuyết phục.
- **Hoạt ảnh đang có:** Hai sprite chim dịch sang phải bằng modulo `t * 3`,
  y dao động `sin(t * .22)`, và đảo một hàng pixel cánh mỗi `floor(t * 2)`.
  Ruộng, nắng và sương hoàn toàn tĩnh.
- **Chi phí khung riêng:** hai sprite 16×5, gần như không đáng kể; copy/conversion
  buffer chung mới là chi phí chính.
- **Hướng vẽ lại:** camera nhìn chéo theo sườn dốc, 3 cụm terrace không đều
  bị che khuất dần, một nhà sàn/cây lớn làm scale anchor, đường nước phản
  sáng dẫn về mặt trời. Sử dụng polygon fill có mask để lip bậc thang không
  thành line sin lặp.

### 4. Fansipan biển mây — vẽ lại

- **Vì sao chưa đẹp:** Đỉnh chính có silhouette “mỏ chim” dễ nhầm với núi
  generic; mảng peak sạch và tối, không có đá/snow/fan ridge có cấu trúc.
  Mây là các dải pastel liên tục, phủ diện tích lớn nhưng thiếu thể tích,
  back-light và mép tan; foreground chỉ hai góc đen nên giống vignette. Màu
  dawn dịu nhưng miền sáng của mây quá đồng nhất.
- **Hoạt ảnh đang có:** mặt trời mọc tổng cộng 2.4% chiều cao theo
  `1 - exp(-t / 18)`; mỗi frame `drawClouds` tái tính hai cloud bank bằng
  fbm thời gian, với tốc độ +1.6/-2.7 và tô folds bằng Bayer. Núi tĩnh.
- **Chi phí khung riêng:** mặt trời là một disc nhỏ; hai cloud bank duyệt phần
  lớn chiều rộng và từ crest đến đáy (xấp xỉ 60% rồi 32% chiều cao, có stride),
  là motion procedural nặng nhất ngoài Tromsø.
- **Hướng vẽ lại:** giữ “biển mây + bình minh” nhưng dùng peak silhouette
  tham chiếu cụ thể, ba tầng ridge có atmospheric perspective, mây làm từ
  cloud puff/occlusion mask, rim sáng theo hướng mặt trời; thêm cột cờ/đường
  núi xa rất nhỏ để định danh.

### 5. Matterhorn — giữ, chỉnh lớn

- **Vì sao chưa đẹp:** Đây là silhouette mạnh nhất: đỉnh lệch, tuyết chia
  mặt, rừng và hồ cho đủ lớp. Dù vậy núi vẫn là polygon lớn có crack ngẫu
  nhiên; lake reflection tạo “bản sao nát” thẳng đứng thay vì mặt nước, dải
  cây hai bên thành khối đen đồng chất, valley không có chi tiết scale. Palette
  ngày/dawn hơi xám, highlight tuyết dễ chìm trên UI sáng.
- **Hoạt ảnh đang có:** với mỗi pixel hồ từ 65% xuống đáy, lấy source đối xứng,
  dịch theo `sin(y*.55 + t*.45)`; glint ngang thưa đổi theo `sin(t*.2+y)`.
- **Chi phí khung riêng:** quét 35% buffer, thêm few glint tests/pixel; sprite
  không có. Chi phí giống Hạ Long nhưng biên reflection cao hơn.
- **Hướng chỉnh:** giữ key art, vẽ reflection thành các patch ngắn bị perspective
  warp, cây thành 3 mẫu sprite có snow/rim, thêm bờ đá/cỏ tiền cảnh và color
  ramp riêng cho tuyết–đá–bóng; không cần bỏ cảnh.

### 6. Sahara — vẽ lại

- **Vì sao chưa đẹp:** Bốn đường crest sin tạo các đụn “wave wallpaper” đều
  nhau; bề mặt lớn đơn màu với chấm/hatch rất cơ học. Camel 24×12 pixel là
  điểm nhấn tốt nhưng quá bé và nằm trên một đường viền sáng lẫn vào đụn.
  Núi/đụn xa phẳng, không có bầu khí quyển, cỏ khô, footprint hay caravan
  depth. Màu vàng hồng thanh nhã nhưng dark mode hóa xám, mất nóng/lạnh giữa
  mặt đón gió và mặt trượt.
- **Hoạt ảnh đang có:** 42 hạt cát tính vị trí từ phase tịnh tiến rất chậm
  (`.008–.012 × t`), y rung `sin(t*.35+i)`, và đổi một trong bốn màu mỗi 8
  giây. Camel/dune/sun không chuyển động.
- **Chi phí khung riêng:** đúng 42 line dài 0–2 pixel; gần bằng không. Motion
  khó nhận ra trên background, nên điểm 1.
- **Hướng vẽ lại:** một đụn tiền cảnh cắt chéo, một ridge S-curve có slip face
  tối rõ, caravan 2–3 camel với footprint cong dẫn vào xa; particle cát phải
  tập trung ở crest, có opacity/mask, không rải đều.

### 7. Santorini — bỏ khỏi v2

- **Vì sao chưa đẹp:** Nhiều căn nhà cùng sprite lặp nguyên dạng và cùng
  kích thước nên trông như icon dán trên mặt biển, không phải thị trấn Oia.
  Cliff là block nâu/tím đơn sắc, mép biển/horizon quá thẳng, water/sky chiếm
  nhiều mà không có nhịp. Dome không có shadow, cửa/cầu thang/lan can; silhouette
  thành một hàng khối rời rạc. Đây là cảnh ít thuyết phục nhất trong contact
  sheet dù ý tưởng dễ nhận.
- **Hoạt ảnh đang có:** `drawSea(ctx,t)` quét toàn bộ vùng nước mỗi frame và
  chỉ ghi pixel nơi `sin(x*.31+y*.7+t*.42) > .92`; town, mây, ánh cửa tĩnh.
- **Chi phí khung riêng:** duyệt ~38% buffer từng frame để tạo vài shimmer
  thưa — tỷ lệ chi phí/hiệu quả thấp.
- **Lý do bỏ:** cần bộ tile/asset kiến trúc, perspective/occlusion và nhiều
  silhouette nhà khác nhau; chưa có primitive hay art direction để biến bản
  procedural hiện tại thành cảnh đủ tốt bằng chỉnh nhỏ. Thay slot bằng cảnh
  khác (xem cuối tài liệu).

### 8. Tromsø cực quang — vẽ lại

- **Vì sao chưa đẹp:** Cực quang có ý tưởng tốt và đọc được ở dark UI, nhưng
  mỗi ribbon là các khối zig-zag lớn, cạnh cắt gắt, thiếu glow/fade/overlap nên
  giống rèm giấy. Núi là hai dải tối gần như phẳng; reflection là tam giác sọc
  rất lớn ở giữa, không phản chiếu đúng ribbon. Trong UI, đen/scrim nuốt mất
  ridge và nước, trong khi aurora xanh chiếm ưu thế giá trị quá thô.
- **Hoạt ảnh đang có:** `paintAurora` được gọi ở `build(0)` nhưng **không gọi
  lại trong `frame`**, vì thế aurora không thật sự chuyển động. Frame chỉ quét
  vùng nước: displacement nhẹ của tâm reflection (`sin(y*.08+t*.08)`), ripple
  `sin(x*.37+y*1.3+t*.45)`, và sparkle ngưỡng `>.985`.
- **Chi phí khung riêng:** quét ~32% buffer với nhiều `sin`/điều kiện trên mỗi
  pixel; chi phí cao trong khi chuyển động thấy được chỉ ở nước.
- **Hướng vẽ lại:** aurora phải là lớp mask riêng, trượt/biến dạng ở 2–4 fps
  hoặc palette-cycle có dither để nhìn sống; thêm glow ramp có giới hạn, stars
  twinkle thưa, reflection chia patch theo mặt nước và ridge silhouette có
  vài cabin/shore light.

## Chi phí khung toàn engine

`SceneRenderer.render()` luôn (1) copy `base → indexed`, (2) chạy `frame`,
(3) chuyển mọi pixel indexed sang RGBA. Kích thước bị chặn ở **129.600 art
pixel** (`480×270`; renderer còn giới hạn mỗi cạnh 480). Host chính copy tiếp
RGBA sang `ImageData` rồi `putImageData`; worker gửi bitmap. Vì vậy mọi cảnh
đã có tối thiểu hai lượt ghi/đọc toàn buffer mỗi frame trước motion riêng.

`FrameLoop` mục tiêu 12 fps; sau mỗi 30 mẫu, trung bình >8 ms giảm 12→6→0 fps.
Reduced motion, hidden hay `motion:false` không tiến thời gian. Chi phí build
(noise atlas 256²/5 octave và nền procedural) chỉ xảy ra lúc tạo/rebuild, không
phải mỗi frame. Nên ưu tiên animation **sparse/masked** thay vì thêm quét toàn
canvas: Fansipan, Hạ Long, Matterhorn, Santorini và Tromsø hiện đã có frame
pass diện tích lớn.

## Primitive còn thiếu (xếp theo giá trị cho v2)

1. **Layer/compositing có mask và opacity indexed.** Cần `Layer` offscreen
   indexed + mask 0–15, `composite(layer, mode, opacity)` và clipping mask.
   Nó cho fog, cloud, glow, reflection đứt đoạn mà không phá base; tăng bộ nhớ
   thêm 1–2 byte/art-pixel/layer, chỉ update bounding box động.
2. **Color ramp theo hướng/độ cao.** `ramp(value, stops)` và
   `shade(mask, lightDirection, ramp)` cho sky/snow/dune/aurora; dither chỉ
   nên là cách chuyển giữa stop, không thay cho vật liệu. Chi phí O(pixel) ở
   build hoặc vùng animation.
3. **Polygon scanline + Bézier/curve đã lượng tử hoá.** `polygon(points)`,
   `curve(points, step)` và fill có edge rule ổn định giúp terrace, cliff,
   dune, bờ biển có silhouette người vẽ. Không cần anti-alias mờ: rasterize
   pixel-art có kiểm soát (snap grid, optional 2-color dither edge).
4. **Sprite-sheet/tile thủ công và transform hạn chế.** Hỗ trợ frame,
   flip, palette remap và anchor, cộng catalogue cho cây, nhà, thuyền, camel,
   đá. Chi phí proportional số pixel sprite; tốt hơn noise cho vật thể nhận
   diện và scale.
5. **Particle emitter có pool/bounds.** Hạt 1–3 px với lifetime, velocity,
   wind, spawn band/mask và density cap: cát trên crest, mist, firefly/snow.
   Dùng pool cố định (ví dụ 64–160) và update sparse; không quét frame.
6. **Palette cycling theo range/mask.** Hiện Phú Quốc tự cài riêng. Primitive
   `cycle(indices, range, period, mask)` tái dùng cho water, windows, aurora;
   rất rẻ vì chỉ đụng danh sách pixel đã ghi nhận.
7. **Fog/atmosphere và shadow/rim-light helpers.** `fogByDepth`, `castShadow`
   (offset mask), `rim(mask, direction, thickness)` làm lớp xa nhạt và chủ thể
   tách nền. Shadow không cần blur; dither/2–3 shade đủ đúng pixel art.
8. **Reflection/wave warp có mask/perspective.** Thay phản chiếu toàn hàng
   bằng sample region/mask, break-up tăng theo khoảng cách và wave tile 2–4
   frame. Tránh cột đối xứng “gương vỡ” hiện tại.

Các primitive này vẫn phù hợp indexed palette tối đa 32 màu, pure TS/worker và
budget hiện có; không cần ảnh bitmap bên ngoài hay GPU filter.

## 4 cảnh mới nên cân nhắc

| Cảnh | Lý do thay thế/giá trị thị giác | Primitive cần ưu tiên |
| --- | --- | --- |
| Hội An đêm lồng đèn | Kiến trúc Việt Nam dễ nhận diện, điểm sáng phản chiếu tạo chiều sâu tốt cho dark mode. | sprite/tile nhà–đèn, palette cycling, reflection mask |
| Tam Cốc mùa lúa | Khác Hạ Long nhờ sông dẫn phối cảnh, thuyền và đồng lúa tạo scale/story. | polygon ruộng, fog depth, sprite thuyền/cây |
| Sa Pa ruộng nước sau mưa | Terrace nhưng có puddle phản chiếu, nhà sàn và mây thấp; thay Mù Cang Chải nếu cần phong phú. | curve/polygon, fog layer, rain ripple sparse |
| Kyoto/Fushimi Inari lúc chạng vạng | Chuỗi torii dẫn mắt, silhouette đặc trưng và palette đỏ–indigo; thay Santorini. | tile/sprite, cast shadow, fog/rim |

## Evidence đã xem

- Contact sheets: `docs/design/pixel-scenes/evidence/contact-sheets/scene-vn-halong.png`,
  `scene-vn-phu-quoc.png`, `scene-vn-mu-cang-chai.png`, `scene-vn-fansipan.png`,
  `scene-world-matterhorn.png`, `scene-world-sahara.png`,
  `scene-world-santorini.png`, `scene-world-tromso.png`.
- UI thực: `docs/design/pixel-scenes/evidence/ui/new-light-vn-halong.png`,
  `new-dark-world-tromso.png`, `chat-light-sahara.png`, `chat-dark-sahara.png`.
- Mã đối chiếu: `packages/web/src/lib/scenery/engine/{renderer,context,palette,
  terrain,loop,noise,dither,sprite}.ts` và tám file dưới
  `packages/web/src/lib/scenery/scenes/{vn,world}/`.
