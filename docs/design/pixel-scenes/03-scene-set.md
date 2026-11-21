## 3. Bộ cảnh v2 — sửa chữa và nâng cấp

Trạng thái: **brief giao vẽ, chưa có tranh v2 được duyệt**. Chốt 8 cảnh theo [_SYNTHESIS](research/_SYNTHESIS.md). Căn cứ: [R1](research/R1-upstream.md) cho chủ thể/ánh sáng có nhân–quả; [R2](research/R2-craft.md) cho ramp, layer, atlas/cycling; [R3](research/R3-audit-scenes.md) cho keep/redraw/replace; [R4](research/R4-audit-theme-ui.md) cho hai palette/theme và cảnh rõ ngoài panel. Recipe chung ở [02](02-rendering-technique.md); không chép tài sản upstream.

### 3.1 Danh mục và truy vết v1 → v2

| Slot | Cảnh / id | Nhóm | Quyết định theo R3 | Giờ mặc định sáng / tối |
| --- | --- | --- | --- | --- |
| V1 | Vịnh Hạ Long — `vn-halong` | VN | **Redraw**: giữ địa danh; thay karst viên tròn/sương sọc | dawn / dusk |
| V2 | Mù Cang Chải mùa lúa chín — `vn-mu-cang-chai` | VN | **Redraw**: thay thảm sọc bằng thung lũng chéo | day / dusk |
| V3 | Fansipan biển mây — `vn-fansipan` | VN | **Redraw**: thay peak generic/mây dải bằng ridge + puff | dawn / night |
| V4 | Phú Quốc — `vn-phu-quoc` | VN | **Keep, chỉnh lớn**: giữ dừa/biển/bố cục hoàng hôn, sửa vật liệu | dawn / dusk |
| W1 | Tromsø cực quang — `world-tromso` | Thế giới | **Redraw**: cực quang phải động thật | day / night |
| W2 | Kyoto/Fushimi Inari — **`world-kyoto` mới** | Thế giới | **Replace Santorini** theo đề xuất R3; bỏ nhà icon lặp | dawn / dusk |
| W3 | Alps – Matterhorn — `world-matterhorn` | Thế giới | **Keep, chỉnh lớn**: giữ silhouette đỉnh lệch/hồ, sửa tuyết/rừng | dawn / night |
| W4 | Sahara — `world-sahara` | Thế giới | **Redraw**: thay đụn sin đều/bụi rải bằng S-curve/caravan | day / dusk |

**Giữ D8 về số lượng 4 VN +4 thế giới**, D1/D2/D3/D6/D7. **Thay** Santorini bằng Kyoto, không tăng thành 9: đường cổng torii có phối cảnh và bóng đổ rõ, đa dạng hơn thêm một cảnh biển. R3 nêu Kyoto là ứng viên, lựa chọn chính thức tại đây là quyết định thiết kế v2. Không đưa Hội An/Tam Cốc/Sa Pa hay các ý tưởng dự phòng v1.1 vào đợt này.

Id cũ `world-santorini` không được tái sử dụng để hiển thị Kyoto: bỏ khỏi registry v2, preference id không tồn tại về off theo D7; UI cho chọn cảnh mới, không đổi ngầm địa danh. Đây là kế hoạch migration cho task code, tài liệu này không sửa state.

### 3.2 Quy ước giao vẽ chung

- Tọa độ `(u,v)` chuẩn hóa, gốc trên trái; kích thước sprite/tốc độ là art-pixel tại **480×270, speed=1**. Duyệt thêm 320×180 và 240×300; không scale méo thiên thể/sprite. Bảng lớp ghi **xa→gần**, hiệu ứng có mask và z xen kẽ như [02](02-rendering-technique.md).
- Mỗi cảnh ≥5 lớp độ sâu thực, một chủ thể + tối đa hai vật phụ, foreground khoảng 10–20% ảnh; còn vùng yên để panel không cạnh tranh với tranh. `focus` là điểm crop ưu tiên, không cam kết form luôn tránh được nó: kiểm ảnh `/new` và chat, dịch bố cục khi bị che.
- Hai hàng palette/cảnh bên dưới là **swatch chủ đạo ở giờ mặc định**, không phải toàn bộ LUT. Worker khai báo 32 role và đủ **light/dark × dawn/day/dusk/night**, giữ nghĩa index giữa mốc; dành 3–4 bậc cho vật liệu chính, 4–6 slot cycle nếu có nước. Không tạo palette tối bằng nhân độ sáng palette sáng hoặc dùng đĩa mặt trời trắng ở night.
- `time:auto` mới chọn giờ theo resolvedTheme trong bảng; ép giờ vẫn thắng, “theo đồng hồ” vẫn có. Record `auto` cũ giữ nghĩa clock qua normalizer [06](06-data-contract.md). Màu cảnh không chịu trần toàn cục cũ; UI bảo vệ chữ theo [04](04-ui-integration.md)/R4 trước khi default mới .9 được dùng.
- Các hiệu ứng liệt kê phải nhìn thấy ở **cả hai theme tại giờ mặc định** (riêng cực quang chỉ hiện tối/giờ hợp cảnh). Tốc độ dưới đây là điểm thử, không đạt bằng thêm chuyển động quá nhanh. Static/reduced-motion chọn pose đẹp, không để cảnh trống vì event chưa đến.

### 3.3 V1 — Vịnh Hạ Long: vẽ lại

**Vấn đề R3:** karst cùng hình viên tròn, sương thành sọc, thuyền bé; giữ ý tưởng vịnh + junk, thay geometry/texture/reflection. Chủ thể: junk buồm nâu ở `(0.73,0.76)`, `focus=(.73,.70)`, `horizon=.63`; sáng từ trên phải `(0.80,.27)`.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Trời sạch, mây mỏng vùng trên; mặt trời radius 9px, không dither toàn trời |
| Far 1 | Karst thấp u=.18–.92, v=.43–.63, cluster xanh xám khác chiều cao |
| Far 2 + fog | Đảo giữa u=.38–.78, v=.35–.67; fog ngắt đoạn 8–14px che chân đảo |
| Mid | Đảo đá vôi bên phải u=.82–1, v=.30–.72, có mặt vách/khe/hang tối, cây bám mép |
| Water + sprite | Nước từ .63; phản đảo đứt patch, lối sáng tới junk; thuyền không nằm trong base |
| Near + fx | Đảo cắt mép trái u=0–.20, v=.38–1, rim hướng phải; che một phần nước/chim xa |

| Theme / giờ | Trời → horizon | Đá bóng/thân/rim | Nước sâu/glint | Buồm/accents |
| --- | --- | --- | --- | --- |
| Sáng / dawn | `#A9CDDB → #F3D9B0` | `#294C52 / #557B74 / #B7B685` | `#42858D / #E2CE97` | `#965B40 / #D09A66` |
| Tối / dusk | `#202E4D → #B67A77` | `#172A35 / #37525C / #A08074` | `#203F53 / #C69B7C` | `#784E48 / #E1B57F` |

Motion: (1) nước 6 pha, 6 bước/s, patch dài 3–16px; (2) fog .2px/s, tick 3fps, chỉ ở khe đảo; (3) junk bob ±1px chu kỳ 7s + buồm 2 pose/2fps; (4) hai chim 8×5×4 pose/6fps đi cong 2px/s phía trên đảo. Atlas junk 24×16, wake 2–4 nét theo đuôi và water mask; bóng/reflection theo thuyền. Chấp nhận khi chân đảo tách lớp, không cột reflection liền; thumbnail nhận vịnh và buồm, cả khi tắt motion.

### 3.4 V2 — Mù Cang Chải: vẽ lại

**Vấn đề R3:** các bậc đồng độ dày/curvature phủ hết ảnh, thiếu scale; bỏ bảy tia nắng line cứng. Chủ thể: ba cụm terrace dẫn vào thung lũng, `focus=(.69,.65)`, `horizon=.37`; nguồn sáng trên trái `(0.22,.20)`, không chạm đỉnh đồi.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Trời 0–.37, mây có bụng tối; mặt trời lệch khỏi ridge ≥6px |
| Far | Hai ridge u=0–1 v=.25–.48, ít chi tiết, khác silhouette |
| Fog | Lòng thung lũng u=.42–.70, v=.40–.62, mask không cắt qua đỉnh đồi |
| Mid terrace | Ba polygon cong u=.10–.43/.38–.72/.65–1, v=.40–.84; 5–9 bậc/cụm, độ dày 3–12px tăng về gần |
| Anchor | Nhà sàn u=.77 v=.60, chân/cột/bóng tiếp xúc; mương nước cong dẫn mắt từ (.55,.90) tới (.63,.53) |
| Near + fx | Bụi lúa/cây mép phải ở .85–1, v=.70–1, lối đất có khúc khuất, che một góc ruộng |

| Theme / giờ | Trời → xa | Lúa bóng/thân/sáng | Bờ đất/mương | Nhà/lá |
| --- | --- | --- | --- | --- |
| Sáng / day | `#A7CBD7 → #CFDBBA` | `#697443 / #B6AE51 / #E4CC78` | `#7D684D / #A6C8B4` | `#675345 / #435E49` |
| Tối / dusk | `#293450 → #AC8074` | `#3F4A3E / #82764A / #C6A96A` | `#53433F / #8A9A92` | `#342F36 / #D8AE70` |

Motion: (1) lúa sway 1px, chu kỳ 6–10s theo cụm/phase, chỉ mép gần; (2) mist .2px/s tick 3fps trong valley; (3) 2–3 chim 8×5×4 pose/6fps, đường cong 2px/s; (4) mương glint 4 pha/4 bước/s trong mask hẹp, không cả ruộng chớp. Atlas nhà 24×18 tĩnh, bụi lúa 8×8×3 pose/2fps, chim động. Không cycle slot vàng lúa khi làm mương. Chấp nhận khi đọc được sườn dốc/đường dẫn và nhà làm mốc tỷ lệ; không còn thảm sọc nhìn thẳng.

### 3.5 V3 — Fansipan biển mây: vẽ lại

**Vấn đề R3:** peak generic, mây pastel ngang thiếu thể tích; giữ biển mây/bình minh, vẽ silhouette ridge từ tham chiếu có ghi nguồn khi làm art. `focus=(.70,.40)`, `horizon=.56`, đỉnh chính `(0.70,.23)`; bình minh từ phải `(0.88,.34)`.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Trời rộng, dawn hồng ấm, night xanh có trăng nhỏ, không “mặt trời trắng” |
| Far | Ridge thấp .32–.50, haze xanh lạnh |
| Mid peak | Peak .50–.85 theo u, v=.23–.66, 3 mặt đá/slate, ridge phụ phá hình mỏ chim; không phủ tuyết Alps |
| Cloud far | Puff xa v=.50–.67, lồi/lõm và rim về phải; khe thấy ridge |
| Cloud near | Puff lớn v=.66–.90, bụng tối, mép tan; che chân peak khác mức với far |
| Near + fx | Sống núi cắt góc trái v=.67–1, cây bụi/đường mòn; cột cờ nhỏ trên ridge bên phải không thành chủ thể thứ hai |

| Theme / giờ | Trời → horizon | Đá bóng/thân/rim | Mây bụng/thân/viền | Accent |
| --- | --- | --- | --- | --- |
| Sáng / dawn | `#A9BED7 → #F0C9AD` | `#3F5365 / #697C87 / #C4B6A5` | `#899DB2 / #C4CFD8 / #F6DCC2` | `#8C5754` |
| Tối / night | `#14233D → #344A65` | `#1B2C40 / #3E526B / #8193A5` | `#30415B / #596C86 / #94A6BC` | `#A36863` |

Motion ở cả hai theme: (1) cloud far .15px/s; (2) cloud near .4px/s + mask fold đổi chậm 3fps, không fBm toàn ảnh; (3) cờ 8×6×4 pose/3fps, gió ±1px; (4) chim 8×5×4/6fps xuất hiện thưa ở khoảng trời rìa, không bắt buộc để đủ ba hiệu ứng. Bản tĩnh đặt cờ mở, mây có khe, đỉnh đủ khối; bỏ chuyển mặt trời lên liên tục theo tuổi session v1, giờ là đầu vào độc lập. Chấp nhận khi mây có bụng/rim/occlusion, không hai băng ngang phủ kín chân núi.

### 3.6 V4 — Phú Quốc: giữ, chỉnh lớn

**Giữ theo R3:** key art hai dừa, đường sáng, thuyền, palette hoàng hôn. **Thay:** bờ tam giác tối/rải glint đều, dừa một màu, đĩa mặt trời ở night. `focus=(.72,.65)`, `horizon=.57`; thiên thể `(0.76,.37)`, radius 12px; dừa đóng khung trái.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Trời phân 4 bậc; mây lùi sau mặt trời, night đổi sun sang moon/mask nhỏ |
| Far | Đảo u=.05–.50, v=.48–.60 có 2 lớp haze, không đường ngang mảnh |
| Water | Biển v=.57–1, lối sáng mở rộng 8→65px theo y, wave patch sạch |
| Mid sprite | Thuyền u=.72 v=.70, thân/buồm/người nhỏ, bóng ngắn/wake |
| Shore | Bờ S-curve từ (.05,.73) qua (.35,.86) tới (.72,1); foam không đều, đá/vệt chân |
| Near + fx | Hai dừa u=.10/.24, v=.30–1; thân 3 bậc, lá chồng/shadow/rim, không silhouette đen kín |

| Theme / giờ | Trời → horizon | Biển sâu/glint | Cát bóng/sáng | Dừa/thuyền |
| --- | --- | --- | --- | --- |
| Sáng / dawn | `#A9CDD2 → #F1C7A0` | `#438C96 / #F0D7AD` | `#AD9771 / #E6D3A8` | `#385B50 / #986B4D` |
| Tối / dusk | `#39314F → #DB926C` | `#394B63 / #E9AE7C` | `#64515A / #B99479` | `#273D42 / #C08A66` |

Motion: (1) water 6 pha/6 bước/s chỉ trong lối sáng; (2) foam 3 tile pose/3fps, tiến/lùi 1–2px chu kỳ 8s dọc shore mask; (3) lá dừa 3 pose/2fps biên độ 1–2px theo cơn gió 10–14s; (4) boat 24×14×2/2fps bob ±1px chu kỳ 7s. Atlas lá theo pivot gốc, không rung cả thân. Mây .2px/s là phụ. Chấp nhận khi giữ được silhouette mạnh v1 nhưng nước có khoảng yên, thuyền đủ tỷ lệ; night không còn mặt trời trắng.

### 3.7 W1 — Tromsø: vẽ lại, aurora động thật

**Vấn đề R3/R1:** aurora v1 chỉ vẽ ở build(0), frame chỉ đổi nước; rèm zig-zag và reflection tam giác quá lớn. `focus=(.70,.34)`, `horizon=.65`, nguồn sáng tối từ rèm trên phải, cabin ấm ở (.83,.71). Theme sáng là **ngày mùa đông**: không ép cực quang xanh lên trời ngày.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Sky sạch; đêm 20–40 sao thưa, ngày mây băng mỏng |
| Aurora/cloud fx xa | 2–3 rèm u=.20–.95 v=.10–.44, mép fade/overlap; chỉ hiện dusk/night, dưới mask núi |
| Far ridge | Núi xa v=.40–.66, 2 mặt tuyết ít chi tiết |
| Mid ridge | Sườn phải u=.60–1 v=.39–.72, đá/tuyết có rim, cabin dưới chân |
| Water | Fjord v=.65–.94, phản rèm và đèn thành patch riêng, phần nước tối vẫn có màu |
| Near + fx | Bờ đá/tuyết u=0–.32 v=.77–1, vài cọc; tuyết xa sau bờ, tuyết gần trước bờ |

| Theme / giờ | Trời → horizon | Núi bóng/tuyết | Nước/reflection | Aurora / đèn |
| --- | --- | --- | --- | --- |
| Sáng / day | `#AFC8D7 → #DDE1DC` | `#4E677D / #D5E2E6` | `#557D96 / #B4CCD2` | Ẩn aurora / `#A67F58` |
| Tối / night | `#111D36 → #294460` | `#23394F / #829CAD` | `#1C344C / #4C8B87` | `#6EBE9C / #8E82AE / #E3B576` |

Motion tối: (1) shape aurora 120×48, 4fps, phase .05–.15rad/s; 4 bậc sáng + coverage mép, biên u dao động 2–4px; (2) nước 6 pha/4 bước/s, phản đúng phase rèm; (3) tuyết 32 hạt hai depth 2–6px/s; (4) khói cabin 12×12×4 pose/2fps, trôi lên 1px/s. **Sáng vẫn ≥3:** mây trôi .25px/s thay aurora, nước, tuyết, khói. Atlas cabin 24×18 tĩnh, khói động; tuyết pool nằm trong trần chung. Night có sao đổi sáng 4–8 điểm/chu kỳ 4–7s. Chấp nhận bằng loop chứng minh rèm biến hình, vẫn đọc ridge/nước, không chớp cả bầu trời; screenshot đơn không đủ.

### 3.8 W2 — Kyoto/Fushimi Inari: thay Santorini

**Replace theo R3:** bỏ phố mái vòm procedural; cổng torii đỏ–indigo có scale/occlusion dẫn mắt. Không bê cổng/sprite Sakura từ upstream R1. `focus=(.73,.57)`, `horizon=.42` (mốc dẫn phối cảnh), vanishing point `(.69,.46)`; sáng xiên từ phải, tối đèn đá ấm cạnh đường.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky/far | Khe trời u=.47–.86 v=0–.38; rừng xa xanh xám, ít nhánh |
| Far path + fog | Đường về (.69,.46), sương 8–12px ở cuối lối, không sáng trắng |
| Mid torii | 3 cổng tại y=.48/.59/.72, rộng 14/26/48px; phối cảnh theo một điểm tụ, xà cong nhẹ |
| Mid ground | Đá lát, chân cột đen, bóng đổ có hướng, rêu xen cụm; đèn đá ở (.85,.70) |
| Near torii | Một phần cổng lớn cắt khung u=.15–.98, y=.19–1; cột bên tránh che lối, mặt bên tối, rim phải |
| Near/fx | Cành lá góc trái và chân khung, vài lá rơi đi trước/sau cổng; không tán lá kín cả trời |

| Theme / giờ | Trời/rừng xa | Torii bóng/thân/rim | Đá/rêu | Đèn/lá |
| --- | --- | --- | --- | --- |
| Sáng / dawn | `#C7D6CF / #78938A` | `#713F3B / #B85E46 / #E3A270` | `#8A8880 / #526C50` | `#D8B981 / #C19155` |
| Tối / dusk | `#27384B / #374E52` | `#482E3A / #924B43 / #C67C58` | `#4B5059 / #344C43` | `#E1B573 / #A97959` |

Motion cả hai theme: (1) 18 lá 1–3px từ cành, life 4–8s, 2–4px/s, cùng gió; (2) cành lá 3 pose/2fps lệch 1px, không rung cột; (3) fog .15px/s tick 3fps cuối đường; tối thêm halo đèn biến thiên 5% chu kỳ 5s, sáng đèn không phát glow. Atlas torii **4 scale tự vẽ** có mặt trước/bên/đế, cành 24×16×3 pose, lá 4×4×4 pose/4fps. Không thu nhỏ lặp cùng một icon nguyên hình; torii gần che cổng xa, shadow chân cùng góc sáng. Chấp nhận khi nhìn thumbnail nhận đường cổng sâu, cả ngày không cần đèn cứu màu; không ghi “Kyoto đã đẹp” chỉ vì Santorini bị loại.

### 3.9 W3 — Matterhorn: giữ, chỉnh lớn

**Giữ R3:** đỉnh lệch, tuyết chia mặt, hồ/rừng. **Thay:** crack random, rừng đen đồng chất và reflection bản sao nát. `focus=(.70,.38)`, `horizon=.65`, peak `(.70,.17)`; nguồn sáng trái trên `(0.25,.22)`.

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Dawn lạnh–ấm, night trăng nhỏ; khoảng yên quanh đỉnh |
| Far ridge | Ridge phụ v=.36–.60, 2 lớp haze không cạnh tranh peak |
| Mid peak | Đỉnh .50–.86 theo u; tuyết/đá/bóng riêng, khe nứt chạy theo mặt, rim trái 1px |
| Valley + forest | Valley v=.57–.73 có cabin nhỏ làm scale; 3 mẫu thông khác cao/màu, không khối đen |
| Water | Hồ v=.65–.92, patch phản núi + gợn, không gương đối xứng nguyên khối |
| Near + fx | Bờ đá/cỏ u=0–.28 và .90–1, v=.78–1, cây gần có rim che hồ một phần |

| Theme / giờ | Trời → horizon | Tuyết bóng/thân/sáng | Đá/rừng | Nước/glint |
| --- | --- | --- | --- | --- |
| Sáng / dawn | `#AEC9DD → #E9CBB5` | `#69819C / #C2D5DF / #F2DCC4` | `#596474 / #3F5D5C` | `#537F96 / #C9D5CA` |
| Tối / night | `#172742 → #3E5873` | `#3F5475 / #7E98B4 / #B4C5D2` | `#29384F / #263F47` | `#253F59 / #799AAE` |

Motion: (1) nước 6 pha/4 bước/s, warp ±1px tick 3fps chỉ trong lake mask; (2) cloud .15px/s qua ridge phụ, không che peak liên tục; (3) chim 8×5×4 pose/6fps, 2px/s dọc valley, silhouette đọc được cả tối; (4) khói cabin 12×12×4 pose/2fps là phụ. Atlas thông 3 mẫu 12×24 tĩnh, cabin 18×14, chim/khói động. Không thêm tuyết rơi chỉ để đủ số effect. Chấp nhận khi tuyết sáng vẫn tách trời light, rừng có lớp và phản chiếu ngắt phối cảnh, không mất silhouette mạnh v1.

### 3.10 W4 — Sahara: vẽ lại

**Vấn đề R3:** cồn sin đều, camel quá bé/trùng mép sáng, bụi rất khó thấy; giữ ý tưởng cát nóng–bóng tím, thay geometry/đường caravan. `focus=(.73,.64)`, `horizon=.42`, nguồn sáng `(0.25,.24)`, ridge S từ (.24,.89) qua (.62,.56) tới (.93,.66).

| Lớp | Bố cục / việc cần vẽ |
| --- | --- |
| Sky | Mảng trời sạch; mặt trời không tiếp tuyến đụn, night trăng nhỏ |
| Far dunes | 2 lớp cồn thấp v=.38–.57, haze ấm/lạnh theo theme |
| Mid slip face | S-curve chủ đạo, mặt trượt bóng tím đối lập sườn cát vàng, rim đứt 1px |
| Caravan | 3 camel ở (.72,.64)/(.64,.61)/(.59,.59), lớn 24×14/17×10/12×7, không đặt silhouette trùng crest sáng |
| Trail | Footprint cong theo đường đi, giảm kích cỡ về xa, bóng tiếp xúc khớp chân |
| Near + fx | Đụn chéo cắt góc trái/dưới v=.75–1, cụm cỏ khô/đá nhỏ; cát bay từ crest, không rải đều trời |

| Theme / giờ | Trời → horizon | Cát bóng/thân/sáng | Xa/foreground | Camel/accents |
| --- | --- | --- | --- | --- |
| Sáng / day | `#9DC4D4 → #E5D2B3` | `#8B6571 / #CCA274 / #EACB8F` | `#B8A28E / #A47B5A` | `#57494C / #E9D7A8` |
| Tối / dusk | `#3B3658 → #C58C79` | `#423650 / #895368 / #EDB879` | `#806779 / #6B495B` | `#302C40 / #C18A72` |

Motion: (1) camel gần 4 pose chân/4fps, .3–.6px/s theo waypoint ridge, bob 0–1px; hai con xa phase khác; (2) cát pool 48 hạt, spawn band crest 2–4px, life 3–5s, gió 2–5px/s, gần ≤4 hạt; (3) haze thấp .2px/s tick 3fps, amplitude 1px, không làm đụn trôi; (4) cơn gió 8–14s kéo 2–3s điều khiển bụi/cỏ khô cùng tín hiệu. Atlas camel 3 scale, 4 pose tự vẽ mỗi scale; cỏ 8×10×3 pose/2fps nếu còn ngân sách. Chọn một đoạn đường caravan tiến ra khỏi khung rồi hồi sinh ngoài khung, không teleport giữa ảnh; footprints bền theo segment, không mọc vĩnh viễn. Chấp nhận khi camel không trượt chân, bụi có nguồn và hướng, cát tối vẫn phân nóng/lạnh, không wallpaper sóng sin.

### 3.11 Bảng điểm mục tiêu và cổng giao nhận

R3 chấm v1 theo thứ tự **bố cục / chiều sâu / màu / chi tiết / chuyển động**. Mục tiêu dưới đây là ngưỡng giao nhận **ở từng theme**, chưa là điểm đã đạt. Không lấy trung bình để che một tiêu chí yếu.

| Cảnh | Điểm v1 R3 (5 tiêu chí) | Bố cục | Chiều sâu | Màu | Chi tiết | Chuyển động |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Hạ Long | 3 / 2 / 3 / 2 / 2 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Mù Cang Chải | 2 / 2 / 3 / 2 / 2 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Fansipan | 3 / 3 / 4 / 2 / 3 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Phú Quốc | 4 / 3 / 4 / 3 / 3 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Tromsø | 3 / 2 / 3 / 2 / 3 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Kyoto (thay Santorini) | Santorini 2 / 2 / 3 / 2 / 1; Kyoto chưa có | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Matterhorn | 4 / 3 / 3 / 3 / 3 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |
| Sahara | 3 / 2 / 3 / 2 / 1 | ≥4 | ≥4 | ≥4 | ≥4 | ≥4 |

| Tiêu chí | Mốc 4/5 phải quan sát được |
| --- | --- |
| Bố cục | Chủ thể nhận ra ở thumbnail, có khoảng yên, không tangency, crop full/horizon không mất landmark |
| Chiều sâu | ≥5 lớp khác silhouette/value/scale, có che khuất và hướng sáng nhất quán; static vẫn có khối |
| Màu | Hai palette được duyệt độc lập, ramp vật liệu rõ; ngoài panel không bị bạc/đen; 4 mốc ép giờ không sai nghĩa |
| Chi tiết | Cluster vẽ có chủ đích, không noise phủ đều; sprite/tỷ lệ/vật liệu hợp cảnh |
| Chuyển động | ≥3 hiệu ứng thấy trong loop 10s tại speed=1; ≥1 sprite động; khác phase/depth, không seam/ghost/flash, riêng aurora biến hình thật |

Quy trình giao mỗi cảnh:

1. Ghi mô tả/tham chiếu silhouette, quyền dùng nguồn và role map ở scene; tự vẽ geometry/atlas. Làm Hạ Long + Sahara làm mẫu, sau đó các cảnh khác; mỗi worker triển khai tối đa hai cảnh, quyền sở hữu file theo [08](08-implementation-plan.md).
2. Giao art tĩnh: light/dark ×4 thời điểm ×3 cỡ (320×180,480×270,240×300); thêm thumbnail engine thật. Review grayscale/value và rim/contact shadow trước motion. Hash chỉ chống hồi quy, không là duyệt đẹp.
3. Giao loop 10s + frame t=0/5/15/30s cùng seed=42; khai seed/timeSource/time/theme/visibility/backend/viewport/commit. Event hiếm ghi thêm đoạn đủ 30s, không dùng ảnh tĩnh chứng minh chuyển động.
4. Chụp app thật **8 cảnh ×2 theme ×(`/new`,chat)=32 ảnh** với compositor v2, thêm mobile/crop/reduced-motion và so cạnh upstream. Contact sheet không thay ảnh app; hình trong `evidence/` hiện tại là v1, không gắn nhãn v2.
5. Đo AA sau composite cuối (mọi màu chữ thực), perf theo [02](02-rendering-technique.md); tắt motion/ẩn tab/fallback không làm hỏng app. Chủ sản phẩm chấm từng tiêu chí ≥4 ở cả hai theme và ký duyệt; cảnh dưới 4 quay lại sửa, không rebaseline golden để hợp thức hóa.

Không lệch _SYNTHESIS. Kyoto là chốt từ danh sách ứng viên R3; toàn bộ swatch/geometry/tham số là chỉ dẫn tác giả v2, chưa phải bằng chứng hoàn tất sản phẩm.

---
[← Mục lục](README.md)
