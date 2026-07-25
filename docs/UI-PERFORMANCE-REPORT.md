# UI Performance & State Report — VíGiaĐình

Ngày chốt: 2026-07-25
Build đo: production build bằng Node/Vite, không dùng Bun.

## State và loading

- Production source có **0** `onMutate` và **0** `setQueryData`: không có
  optimistic wallet UI.
- Recovery draft đã chuyển từ `localStorage` sang RAM của phiên SPA. Reload/tab
  mới cố ý bắt đầu lại; test mới chứng minh vật liệu liên kết ví không đi vào web
  storage.
- Các `localStorage` còn lại được phân loại rõ: theme/ngôn ngữ là cosmetic;
  `fw.device-id` là định danh cài đặt và `fw.wallet-jwt` là credential phiên theo
  quyết định SEP-45 hiện hữu — không phải server-state/query data của ví.
- Query cache không có persister. Hai mắt canh chain 20 giây/30 giây đều có
  `refetchIntervalInBackground: true` và `refetchOnWindowFocus: true`, nên tab ẩn
  không tắt canh.
- Route pending và dữ liệu pending đều dùng skeleton theo hình title/row/card,
  không dùng spinner tròn giữa màn.
- HTML có boot shell cùng nền giấy `#fdfcf7`, brand thật và skeleton theo nội dung;
  test chặn toàn bộ JS vẫn thấy shell. React thay shell nguyên tử nên cold open
  và chuyển màn không rơi về document trắng.

## Cold FCP

DevTools performance MCP không có trong runtime này, nên phép đo fallback dùng
Chromium `PerformancePaintTiming` trên production build. Mỗi mẫu dùng context mới,
cache HTTP bị tắt bằng CDP và service worker bị chặn; warm-up chỉ mở `about:blank`,
không tải URL/asset của app.

| Mẫu cache-disabled | FCP |
|---:|---:|
| 1 | 572 ms |
| 2 | 76 ms |
| 3 | 72 ms |
| 4 | 96 ms |
| 5 | 92 ms |
| **Median** | **92 ms** |
| **P75** | **96 ms** |

Gate: 5/5 mẫu ≤ 600 ms; P75 96 ms ≤ ngân sách 600 ms. Test canonical:
`corepack pnpm test:perf`.

## Bundle

| Mốc | Initial raw | Initial gzip | All JS raw | All JS gzip |
|---|---:|---:|---:|---:|
| Trước audit Pha 3 | 1.040.871 B | 326.957 B | 1.768.835 B | 554.863 B |
| Sau Pha 3 | 1.012.693 B | 316.985 B | 1.758.306 B | 551.585 B |
| Chốt Pha 5 | 1.011.362 B | 316.419 B | 1.757.352 B | 551.271 B |

So với sau Pha 3, initial giảm tiếp 1.331 raw / 566 gzip; all-JS giảm 954 raw /
314 gzip. So với đầu audit, initial giảm 10.538 gzip.

Vite vẫn báo một chunk raw 630.042 B (gzip 199.729 B). Đã thử tách Sentry thành
chunk riêng: cảnh báo raw biến mất nhưng tổng initial gzip tăng từ 316.419 B lên
317.100 B do mất cơ hội nén chéo. Vì ngân sách của yêu cầu là **initial gzip**,
giữ chunk hiện tại là lựa chọn đã đo, không nâng `chunkSizeWarningLimit` và không
che cảnh báo. Stellar 452.980 B vẫn là chunk lazy, không thuộc initial.

## Cảnh báo cũ

- React `act(...)`: bảy lời gọi send-machine trong test đã được bọc đúng điểm
  kích hoạt; bộ Vitest web 76/76 PASS, không còn notice trên full-suite.
- Locale chunking: glob lazy loại hẳn `common` đã eager; build không còn notice
  static/dynamic import.
- Main bundle: đã đo và giải thích bằng phép thử tách chunk ở trên, không bỏ qua
  bằng cấu hình.

## Số test

- Vitest toàn FE: từ 109 lên **110** test (+1 recovery-draft test).
- Gate E2E chuyên biệt thêm: 82 visual snapshots, 205 layout cases, 1 runtime
  asset sweep (41 route), 1 Android Back, 1 safe-area và 2 performance tests.
- Test recovery-draft sẽ fail trên code cũ vì tìm thấy `fw.recovery.draft` trong
  `localStorage`. Test first-paint sẽ fail trên code cũ vì `#root` rỗng khi chặn JS.
