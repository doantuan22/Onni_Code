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

---
[← Mục lục](README.md)
