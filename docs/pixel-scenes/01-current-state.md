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

---
[← Mục lục](README.md)
