# Verification — gates trước khi push (đừng bỏ bước nào)

## Gate tự động (agent chạy được)

1. **Build HONEST — mirror runtime deploy, KHÔNG dùng Bun:**
   ```bash
   node --version                                          # ghi log
   NODE_OPTIONS=--no-experimental-strip-types npx turbo run build --force
   ```
   Xanh CHỈ KHI mọi app build với type-stripping TẮT (mirror Cloudflare Node 20). Xem pitfalls #3, #4.
2. `turbo run type-check` — 0 lỗi toàn monorepo.
3. `biome check` (hoặc lint hiện có) — sạch.
4. **Regression tiền (bắt buộc):** grep chứng minh 0 `persist:true`/`onMutate`/`setQueryData` chạm query wallet/balance/order/checkout/withdraw/carbon/finance/PoF. Dán output.
5. **BE (nếu sửa):** `pm2 reload <app>` (KHÔNG `--update-env` — PATH trap), curl health + endpoint đã đổi, dán RAW output. Không đụng process khác.
6. **Bằng chứng cursor** (nếu làm tầng 6): curl 2–3 trang keyset liên tiếp → 0 overlap + legacy numeric ≡ keyset.
7. **Bằng chứng SSE replay** (nếu làm tầng 5): ngắt kết nối, bắn event, reconnect → event replay đúng (raw log id monotonic).
8. **Bằng chứng cache header** (nếu làm): curl 2 lần → lần 2 trả 304; endpoint tiền KHÔNG có Cache-Control.

## QA tay (con người — KHÔNG tự động được, mắt xích cuối)

Agent phải DỪNG và yêu cầu QA tay trước khi push nếu chưa chạy được (RULE: gate tự động xanh ≠ đúng). 5 mục:

1. **Keep-alive:** chuyển 4 tab × 3 vòng → tab đã ghé giữ state/scroll, KHÔNG refetch, console 0 error.
2. **Video tab ẩn:** lướt sang tab khác → video/nhạc feed DỪNG (`video.paused === true`).
3. **SSE đa-tab:** mở 3 browser tab → Network chỉ 1 connection notif SSE; đóng tab leader → tab khác promote < 5s.
4. **Cold reopen:** refresh → categories/news hiện instant; wallet/order VẪN fetch tươi (Network có request).
5. **Optimistic:** offline → like → apply rồi revert; chat 2 client → không double; tap like 10× → số đếm hội tụ đúng.

## Push flow (chỉ khi gate + QA xanh)

```bash
git checkout -b feat/<tên>       # từ main; commit từng WP
git checkout main && git pull --ff-only
git merge --no-ff feat/<tên> -m "..."
git push origin main              # KHÔNG --force. Main đổi → rebase, chạy lại gate.
```
- Watch deploy: TẤT CẢ app xanh (không chỉ 1). App nào đỏ → đọc log, có thể còn config `.ts` sót.
- Giữ branch tới khi deploy xác nhận xanh toàn bộ.
- Nợ kỹ thuật lớn (vd migrate ~N service offset→cursor) → PR RIÊNG, đừng nhét chung.

## Chống tái phạm (khuyến nghị dựng 1 lần)

- **Guard tĩnh** (immune runtime): script quét mọi config host-loaded, resolve import cross-package qua `exports`, FAIL nếu đích là `.ts`. Chạy pre-commit. Bắt cả class pitfall #3, không cần build.
- **CI mirror deploy:** GitHub Action chạy đúng gate #1 (Node no-strip) trên mỗi push/PR main → chặn merge nếu đỏ. Không phụ thuộc trí nhớ ai.
