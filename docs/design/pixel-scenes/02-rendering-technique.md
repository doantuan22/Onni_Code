## 2. Kỹ thuật vẽ — kiến trúc v2 sửa chữa và nâng cấp

Trạng thái: **đặc tả triển khai, chưa phải engine/ảnh v2 đã nghiệm thu**. Theo [_SYNTHESIS](research/_SYNTHESIS.md), giữ indexed + worker; sửa tranh, motion và compositing. Căn cứ: [R1 — upstream](research/R1-upstream.md) (chủ thể, ánh sáng có nhân–quả), [R2 — craft](research/R2-craft.md) (phương án A, recipe/chi phí), [R3 — audit](research/R3-audit-scenes.md) (primitive thiếu/lỗi cảnh), [R4 — theme/UI](research/R4-audit-theme-ui.md) (giảm màu kép). Mọi tham số dưới đây là **mức khởi điểm cần đo và duyệt**, không phải benchmark.

### 2.1 Quyết định kế thừa và phương án A

| Quyết định v1 | v2 | Căn cứ |
| --- | --- | --- |
| D1: Canvas2D indexed, phóng pixel sắc | **Giữ**; tối đa 32 role màu, không chỉ 16 | Chuyển RGBA vẫn O(W×H), không “miễn phí” (R2) |
| D2: lõi TS không DOM, worker + main fallback | **Giữ**, gồm ACK/đóng bitmap/phanh | Worker giảm tranh chấp main, không xoá tổng CPU (R2/R3) |
| D3/D6/D7: một canvas ở shell, mặc định tắt, preference optional | **Giữ** | Không cấu hình bắt buộc, không vẽ ra sidebar |
| D4: trần toàn cảnh + tone-map + scrim cột; không blur | **Thay cơ chế tương phản**, giữ cấm `backdrop-filter` | Chỉ bảo vệ chữ cục bộ, bỏ giảm kép (R4) |
| D5: horizon 45% đáy shell | **Thay hình học** theo transcript/dock ở [04](04-ui-integration.md) | Không để dock nuốt landmark |
| D8: procedural + vài sprite, ≤2 yếu tố động | **Nâng cấp** layer ngữ nghĩa, cluster/sprite tự vẽ; ≥3 hiệu ứng thấy rõ/cảnh | R3: thêm noise không chữa hình khối |
| Bank 16–31 luôn là bóng; đổi giờ rebuild | **Thay ở cảnh v2** bằng role map; giữ đường legacy | Cycle không chiếm màu bóng; geometry độc lập palette |
| “Upstream chỉ ASCII”, “12fps luôn đủ” | **Bỏ nhận định tuyệt đối** | R1 có Noel pixel thực và SVG; nhịp do mỹ thuật/profiling quyết định |

| Hướng | Giá trị / hạn chế | Chốt v2 |
| --- | --- | --- |
| **A: Canvas2D indexed + layer + cycling** | Tái dùng lõi, PNG Node deterministic; copy/convert/present vẫn theo diện tích | **Chọn**, kết hợp atlas nhỏ từ C |
| B: WebGL indexed shader | Có thể giảm CPU lookup; thêm context-lost, GPU/WebView và parity QA | Chỉ spike sau trace chứng minh A nghẽn, chưa default |
| C: layer/sprite-sheet vẽ tay | Tốt cho silhouette/pose; tăng công art và RAM | Dùng chọn lọc trong A, không atlas toàn khung |
| ASCII, SVG/SMIL, video nền | Có thế mạnh riêng, không trực tiếp chữa tranh/scrim hiện tại | Không đổi backend, không chép mã/tài sản upstream |

### 2.2 Lớp ngữ nghĩa và hình học

Giữ **W,H≤480; W×H≤129.600**, mốc ngang 480×270; portrait 240×300 vẫn hợp lệ. Không ép mọi buffer về 16:9, không tăng art resolution theo DPR. Tọa độ cảnh `(u,v)∈[0,1]`, raster cuối snap nguyên; nearest-neighbor, không kéo giãn sprite. `horizon/focus` hướng dẫn crop; full/horizon duyệt riêng theo [03](03-scene-set.md).

Layer là buffer/ROI **nội bộ**, không phải thêm DOM canvas. Sắp theo `z`; cho phép nhiều layer cùng kind để sương xen giữa núi:

| Kind | Nội dung | Quy tắc |
| --- | --- | --- |
| `sky` | Trời, sun/moon, sao | Nền opaque; thiên thể là mask riêng khi đổi vị trí/giờ |
| `far` | Ridge/đảo xa, haze | Ít chi tiết, role khác lớp gần |
| `mid` | Landmark, ruộng/thung lũng, mặt khối | Một chủ thể, sáng/tối/rim cùng hướng đèn |
| `water` | Nước, source/mask phản chiếu, cycle slots | Chỉ sample trong water mask, không ghi vào bờ |
| `fog` | Mây/sương có depth, coverage 0–15 | Xen giữa các lớp, không phủ sọc trắng xuyên cảnh |
| `near` | Cành/đá/bờ/cổng, bóng tiếp xúc | Che một phần sprite/hạt, để khe thở |
| `fx` | Sprite, particle, aurora/ánh động | Có z riêng: chim sau cành, tuyết gần trước cành |

Index layer 0–31, **255 trong suốt**; sprite ký tự cũ `-1` decode sang sentinel một lần. Coverage dùng byte 0–15; ghép bằng remap hoặc ordered mask Bayer neo theo lớp, không alpha RGB mỗi pixel. `fogRemap[level][index]` chỉ trỏ màu đã có trong 32 slot, không sinh 16 màu mới cho mỗi màu nền. LUT cuối không nhận 255.

Gộp static spans liên tiếp thành cache; foreground đứng trước động vẫn giữ mask để phủ lại đúng thứ tự. Mỗi cảnh ≥5 lớp độ sâu nhìn thấy **khi motion off**. Haze gần/trung/xa thử 0.08/0.28/0.55, bake vào role palette, không phủ haze toàn frame lần nữa.

### 2.3 Palette, theme và cấu trúc frame

**Hai trục riêng:** `themePalettes.light/dark`, mỗi nhánh đủ `dawn/day/dusk/night`, cùng semantic role ở mọi index. Không phủ trắng palette đêm để giả theme sáng. Swatch [03](03-scene-set.md) là key art mặc định; worker hoàn thiện **8 palette ×32 slot/cảnh**.

| Slot v2 mẫu | Vai trò | Điều kiện |
| --- | --- | --- |
| 0–3 | Trời | Dither hạn chế |
| 4–11 | Đất/đá/cây | Ramp 3–4 bậc, bóng lạnh → sáng ấm |
| 12–15 | Xa/sương | Role khí quyển riêng |
| 16–21 | 6 pha nước | Sahara/Kyoto được đổi thành cát/lá |
| 22–23 | Glint/halo | Cycle riêng nếu không dùng chung nước |
| 24–27 | Sprite/đèn | Remap theo theme/time |
| 28–31 | Bóng/rim/accents | Không suy reflection bằng `index+16` |

Layout trên là mẫu, không áp cứng vào scene cũ. Cảnh v2 khai báo đủ 32 màu, không expand ngầm. Cycle groups không giao nhau; một slot không vừa nước động vừa núi tĩnh. Trong TS dùng số `0xRRGGBB`, không chuỗi hex; hex trong tài liệu là swatch.

Pipeline tối đa 12 lần/s:

1. Nhận snapshot seed/size/theme/time đã resolve/visibility/motion/speed. Pool/cache thuộc renderer instance, không module-global dùng chung thumbnail.
2. Advance simulation time nếu motion được phép; `dt≤0.2s`, speed nhân đúng một lần. Event dùng seeded schedule; tab trở lại không phát bù hàng loạt event.
3. Copy static cache đầu → ghép theo z; tính lại ROI/offset/pose khi đổi tick. Phục hồi bounds cũ trước vẽ sprite mới. Reflection dùng source bất biến + vị trí nguồn động hiện tại; phủ near mask sau động ở xa.
4. `theme keyframes → nội suy time → cycle nhóm → visibility một lần → pack LUT[32] → indexedToRgba`. Tái dùng working LUT/buffers; không gọi hàm cấp mảng mới mỗi frame để cycle.
5. Present worker bitmap hoặc main ImageData; **1 bitmap in-flight**, ACK rồi gửi trạng thái mới nhất. Main đóng bitmap sau dùng; dispose đóng pending/worker/listener. Không present khi không dirty.

Ngoài chữ: `P_out=B+s(P−B)`, không ceiling toàn cảnh/scrim kép. UI bảo vệ chữ bằng panel tint + viền 1px, không blur: light nền `#fafafa` alpha .96, dark `#090909` alpha .94 là khởi điểm R4. Kiểm composite cuối với foreground/muted/soft/placeholder/status/code; thiếu AA ⇒ tăng độ đặc **cục bộ** hoặc nền đặc. Default mới `visibility=.9` **chỉ sau** panel + AA, giữ on=false và giá trị explicit cũ. Lõi không đọc DOM.

`auto` mới theo theme lấy default light/dark ở [03](03-scene-set.md); vẫn cho ép giờ/đồng hồ. Normalizer phải phân biệt record cũ `auto`=clock với default mới, ví dụ optional `timeSource` theo R4/[06](06-data-contract.md); không âm thầm đổi nghĩa cũ. Motion off/reduced-motion đóng băng shape/cycle/event ở pose đẹp; đổi theme/time vẫn invalidate một frame. Clock cập nhật khi phút đổi mà không mở animation loop.

### 2.4 Recipe hiệu ứng

Đơn vị **art-pixel, giây tại speed=1**, scale hình học theo W/480,H/270; số hạt là trần ở khung lớn. Căn cứ R1 §5, R2 §3, R3; không phải số đo v2.

| Hiệu ứng | Cách làm / tham số khởi điểm | Phanh / tránh lỗi |
| --- | --- | --- |
| Polygon/curve | Scanline even–odd, cạnh half-open `[yMin,yMax)`; quadratic/cubic Bézier bake điểm cách ≤1px rồi snap/fill. Terrace 3 cụm khác curvature; dune S-curve, karst khe/hang | Không anti-alias mềm; loại điểm trùng, kiểm seam/lỗ; không tính curve dài mỗi frame |
| Mặt khối/rim | Slope hoặc face mask, ramp 3–4 bậc hue-shift; rim 1px trên 10–25% contour hướng sáng; bóng tiếp xúc 2–8px | Không outline sáng kín; crack theo mặt đá, không noise khắp khối |
| Dither/texture | Bayer 4×4 mức 25/50/75% trong dải chuyển; cluster đá/cát/lá neo theo lớp; noise atlas 256² bake theo seed | Trời chủ yếu mảng sạch; không temporal noise/dither sprite nhỏ |
| Nước/cycling | Build 4–6 phase index thành nét ngang xa ngắn/gần dài; `phase=t×6`, cycle working LUT, có thể blend 2 màu kế nhau. Glint 4 bước/s trong lối sáng taper | O(≤6) phần cycle, RGBA vẫn O(N); không cycle toàn LUT |
| Reflection | Source bất biến, remap vật liệu riêng; patch ngang 3–18px, lệch hàng ±1–2px, tick 3–4/s, mask bờ, breakup tăng về gần. Phản thuyền/đèn/aurora theo phase hiện tại | Không lấy output frame trước; không lật thành cột gương nát; giới hạn ROI |
| Mây/sương | Puff tile có bụng tối/rim, 2 lớp trôi .15/.4px/s; fog ROI cao 8–20px tick 2–4/s, remap/mask ngắt theo chân núi | Overscan/wrap không seam; không fBm nhiều octave toàn frame |
| Parallax nhẹ | Offset xa/trung/gần clamp ±1/±3/±6px, overscan tương ứng +2px; state float, sample nguyên | Không tự trôi núi/camera. Scroll/pointer là input optional, chưa default; nếu nối scroll dùng snapshot, không đo DOM từng frame/canvas cuộn theo chat |
| Particle | Pool 64–128, hard cap 160/cảnh; z=.3/.6/1, size=1/1/2px; life 3–8s, spawn từ mask, gần ≤10% pool; nhận màu đèn khi đi qua nón sáng | O(số pixel nét), typed-array tái dùng; không push/splice; không tích tụ |
| Gió có cơn | Chung `wind(t)` cho cát/lá/nước; chờ 8–14s, cơn 2–3s ease-in/out, cành lệch 1–2px tăng từ gốc, burst 8–16 hạt trong pool | Không nhảy gốc cành; không mọi lớp cùng phase; ≤1 event hiếm active |
| Sprite-sheet | Atlas tự vẽ, metadata frameRect/pivot/duration/roleMap/bounds; chim 8×5×4 pose 6fps; thuyền 24×14×2 pose 2fps + bob ±1px; camel 24×14×4 pose 4fps | Chỉ flip/translate/remap, không rotate/scale mờ; sprite động bỏ khỏi base; bóng/wake cùng anchor |
| Aurora | Tromsø 2–3 rèm, grid 120×48, ROI trời; sine .05–.15rad/s, shape 4fps; 4 mức xanh–tím + coverage mép. Mountain mask, reflection patch theo rèm hiện tại | Không bake chỉ t=0; indexed không có `lighter`; không tam giác reflection khổng lồ |
| Glow/đèn/sao | Halo 2–4 vành radius 6–14px, remap 4 mức; đèn biến thiên 5–10% chu kỳ 3–7s lệch phase; 20–40 sao, chỉ 4–8 đổi mức | ≤6 halo nhỏ; không chớp mạnh/đồng loạt; ngày tắt sao/đèn không hợp cảnh |
| Tuyết/khói | Tuyết 20–40 hạt: xa 1px 2–4px/s, gần 1–2px 5–9px/s. Khói ≤16 puff, life 3–5s, radius 1→4px, lên 1–2px/s | Depth/occlusion/nhận sáng; không phủ weather mọi cảnh, không sao chép trần hạt upstream |

### 2.5 Hợp đồng mở rộng và ngân sách

Phác thảo **API cần triển khai**, không khẳng định field đã có:

```ts
SceneDefV2 {
  // Giữ id/name/region/horizon/focus, build/frame và palette legacy.
  themePalettes?: { light: Keyframes32, dark: Keyframes32 },
  themeDefaultTime?: { light: TimeAnchor, dark: TimeAnchor },
  paletteRoleLayout?: RoleLayout,
  layers?: LayerSpec[],   // kind, z, bounds, overscan, indices, coverage/remap
  cycles?: CycleSpec[],   // slots không giao nhau, rate, role ownership
  emitters?: EmitterSpec[],
  sprites?: AtlasSpec[]
}
```

`BuildCtx` giữ rng/noise/ridge/dither/sprite/rect/disc/line, thêm polygon/curve/layer/mask/ramp. `FrameCtx` nhận pool/cache riêng instance, LUT tái dùng, dirty bounds. Scene cũ không extension chạy adapter v1, giữ bank cũ; không đoán slot để tự migrate. Không DOM/`Math.random`/fetch/asset mạng trong scene. Mỗi scene là chunk lazy, engine không tải khi tắt. Thumbnail render thật một frame rồi dispose, không 8 loop.

| Hạng mục | Ngân sách / cách đo | Khi vượt |
| --- | --- | --- |
| Nhịp | Default 12fps; sprite 2–6fps, sương/aurora 2–4fps; present khi dirty | Giữ phanh v1: sau 30 mẫu mean >8ms hạ 12→6→0; hidden/reduced-motion còn nguyên |
| CPU | Core p95 mục tiêu ≤2ms @480×270; đo riêng copy/frame/convert/ImageData/put/transfer/main draw | Đo worker/main; giảm ROI/hạt; core 2ms không đồng nghĩa cả UI 2ms |
| Pass | Cache static spans, composite ROI; aurora ≤17.280 mẫu/3 rèm; reflection động khởi điểm ≤35% N | Không thêm 7 pass full N vì có 7 kind; dùng bounds/runs |
| RAM CPU | 2 indexed + RGBA =777.600 byte; ImageData thêm 518.400; 4 full index layer thêm 518.400 chưa mask. Cache index+mask+atlas mục tiêu ≤2MiB ngoài core | Dùng ROI/runs, dispose scene cũ; đo cả canvas/bitmap/GPU, không hứa toàn engine <1MB |
| Gói tải | Giữ mục tiêu lõi ~20KB gzip, scene+atlas ~15KB gzip; đo khi triển khai | Tối giản atlas, không full-frame animation; báo rõ nếu vượt |
| Trace | Off/v1/v2 cùng seed/crop; warm-up 10s + trace 60s idle/stream/scroll; máy/browser/WebView/DPR/power, p50/p95 CPU/RAM/present | Không lấy callback rAF làm FPS thực; không tăng 60fps trước khi chứng minh lợi ích |

### 2.6 Cổng hoàn thành

Thử **Hạ Long (nước) + Sahara (đất)** trước, thêm Tromsø để khóa aurora. Art tĩnh qua duyệt trước motion. Kiểm layer occlusion, cycle không đổi màu đất, reflection không feedback, sprite không bóng ma, crop không mất chủ thể; cùng seed/timeline tái lập được PNG và worker/main.

Mỗi cảnh: contact sheet 2 theme ×4 mốc ×3 cỡ; ảnh app thật 2 theme ×(`/new`, chat); loop 10s và t=0/5/15/30s; slider 0/.3/.7/.9/1 tăng đơn điệu ngoài panel. Sidecar ghi scene/seed/timeSource/time/theme/backend/size/visibility/commit. So cạnh upstream như chuẩn cảm nhận, không lấy ảnh cũ làm bằng chứng v2. Chủ sản phẩm chấm năm tiêu chí ở [03](03-scene-set.md), **từng tiêu chí ≥4**; golden/AA/perf không thay chữ ký duyệt. Xem [07](07-testing.md), [08](08-implementation-plan.md).

Không lệch hướng _SYNTHESIS; slot/recipe/ngưỡng là đặc tả thử, chưa phải kết quả đã đạt.

---
[← Mục lục](README.md)
