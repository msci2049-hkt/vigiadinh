# TEMPLATE — Prompt FIX (chạy SAU khi có SCAN report)

> Phase FIX. Điều kiện: đã có SCAN report — đọc lại, fix theo BẰNG CHỨNG, không mù. Tự tạo `docs/{{tên}}-checklist.md` làm nguồn sự thật, cập nhật sau mỗi WP (✅ + commit hash). Commit từng WP trên branch `feat/{{tên}}`.

## Ràng buộc (điền theo dự án)
- **CẤM đụng:** {{process/service}}. Money = {{kiểu}} — KHÔNG optimistic/persist/cache trên tiền.
- Gate build HONEST: `NODE_OPTIONS=--no-experimental-strip-types npx turbo run build --force` (Bun/Node≥23.6 = false green).
- KHÔNG force-push. Push main chỉ khi gate + QA xanh. Monorepo: gom code chung vào package chung.
- Được phép CÃI prompt khi bằng chứng mâu thuẫn (dead code, scroll container chung, refactor risk>lợi) — ghi lý do checklist.

## Work packages (bật/tắt theo scan; thứ tự ROI)
- **WP1 — Query cache:** factory dùng chung + `persistQueryClient` allowlist `meta.persist` (buster = version hash; `gcTime ≥ maxAge`). Allowlist chỉ data public an toàn. keepPreviousData cho list bounded. → smooth-nav.md §1
- **WP2 — Keep-alive `<Activity>`** (nếu react≥19.2) cho 4–5 tab bottom bar. XỬ LÝ video-pause guard + hiểu hidden-không-fetch. Scroll: kiểm container chung/riêng. → smooth-nav.md §4, pitfalls #1,#2
- **WP3 — Cursor thật TRƯỚC, virtual list SAU** cho feed/list nóng. Đừng ảo hoá dead code/list bounded. → smooth-nav.md §6, pitfalls #7,#15
- **WP4 — Prefetch + skeleton + transition** lên package chung, áp cho app mobile-first trước. Skeleton đặt ở package tailwind-scanned. → smooth-nav.md §2,§3, pitfalls #12
- **WP5 — SSE hardening:** BE replay buffer + Last-Event-ID (event ngoài buffer BỎ `id:`) + FE Web Locks leader + BroadcastChannel dedupe notif. → smooth-nav.md §5, pitfalls #5
- **WP6 — Cache header** (GET public thuần) + bundle preset (config `.mjs` KHÔNG `.ts`). → pitfalls #3
- **WP-Optimistic** (sprint riêng): helper toggle + append trong package chung; áp like/follow/comment/cart; chat dùng `clientMsgId` dedupe. Grep chứng minh 0 optimistic chạm tiền. → optimistic-ui.md

## Test-loop → Push → Docs
Chạy toàn bộ gate trong `references/verification.md`. Bất kỳ đỏ → sửa → chạy lại từ đầu. QA tay 5 mục (agent DỪNG xin QA nếu không tự chạy được). Push non-force qua branch → watch deploy TẤT CẢ app xanh → giữ branch tới khi xác nhận. Viết `docs/{{tên}}-guide.md` (cách cài vào project mới + lằn ranh tiền + cạm bẫy thật đã xử lý + benchmark). Báo cáo cuối kèm raw log + commit hash + nợ kỹ thuật (PR riêng).
