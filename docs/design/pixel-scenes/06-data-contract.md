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

---
[← Mục lục](README.md)
