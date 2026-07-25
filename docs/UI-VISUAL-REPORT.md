# UI Visual Regression Report — VíGiaĐình

Ngày chốt: 2026-07-25
Phạm vi: đúng 41 route sản phẩm trong `docs/UI-AUDIT-STATE.md`.

## Baseline đã commit như code

| Platform baseline | Viewport | Route | Ảnh | Kết quả chạy lại |
|---|---:|---:|---:|---:|
| iPhone web/standalone proxy | 390×844 | 41 | 41 | 41/41 PASS |
| Extension popup proxy | 400×560 | 41 | 41 | 41/41 PASS |
| **Tổng** | 2 viewport | **41** | **82** | **82/82 PASS** |

- Baseline nằm ở `fe/apps/web/e2e/ui-assets.spec.ts-snapshots/`: 82 PNG, tổng
  4.851.383 byte.
- Ngưỡng fail là `maxDiffPixelRatio: 0.01`; dùng full-page screenshot.
- Trước khi chụp: chờ `.product-screen`, `document.fonts.ready`, toàn bộ
  `HTMLImageElement.decode()`, tắt animation/transition/caret/scrollbar.
- Chỉ mask vùng động có chủ đích: countdown, địa chỉ định danh, `.money-amount`,
  `code` và `time`. Không mask ảnh nhân vật, icon, button, copy hoặc bố cục.

## Review bằng mắt

Đã ghép và đọc bốn contact sheet: iPhone route 1–21, iPhone 22–41, popup 1–21,
popup 22–41.

- 41/41 màn có nội dung, không ô ảnh trống, không icon vỡ, không placeholder lạc.
- Banker/mascot/avatar giữ cùng nhận diện; ảnh banker ngồi không còn artefact.
- QR nhận tiền render QR thật.
- Các khối magenta trong contact sheet là vùng mask động của Playwright, không
  phải thành phần UI.

## Cách chạy lại

```bash
cd fe
corepack pnpm test:visual
```

Lệnh canonical cuối: 82 test PASS trong 51,5 giây, sau đó chạy lại lần hai không
`--update-snapshots` vẫn 82/82 PASS.
