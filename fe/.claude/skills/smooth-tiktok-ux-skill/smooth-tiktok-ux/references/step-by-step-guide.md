# Hướng dẫn chi tiết — Làm app MƯỢT NHƯ TIKTOK từ A→Z

Tài liệu này là quy trình đầy đủ đã chạy thật trên production (CDHC — Turborepo 6 app). Đọc thẳng, làm theo. Chi tiết kỹ thuật + code nằm trong skill `smooth-tiktok-ux` (5 file references + 2 template prompt).

---

## Bước 0 — Hiểu đúng "mượt như TikTok" là gì

Có **2 việc khác nhau**, đừng trộn:
1. **Giảm độ trễ thật** — hết refetch khi quay lại tab, hết remount, hết nháy trắng. (6 tầng smooth navigation)
2. **Giấu độ trễ còn lại** — server round-trip không xoá được thì đừng cho user thấy. (Optimistic UI)

TikTok không nhanh hơn app khác — nó chỉ **không bao giờ cho mày thấy nó đang đợi**. Làm (1) trước, (2) sau.

---

## Bước 1 — ĐO trước khi làm (đừng bỏ qua)

Mở React DevTools Profiler + `performance.now()` quanh `navigate()`. Ghi 3 số:
- Tab đã ghé lại: bao nhiêu ms?
- Tab mở lần đầu: bao nhiêu ms?
- Cold reopen (refresh): có màn trắng không?

Ba số này cho biết chỗ nào đáng làm, chỗ nào đã kịch trần. **Không đo = làm mù = phí công.**

---

## Bước 2 — SCAN (đọc code, không sửa)

Dùng `prompts/SCAN_template.md`, điền tên repo/app/stack. Chạy bằng Claude Code (model mạnh, có MCP tool đọc code). Yêu cầu cốt lõi:
- Audit 6 tầng cho MỌI app, mỗi kết luận kèm `path:line` + code thật.
- Phân loại toàn bộ mutation: eligible / forbidden (tiền) / review.
- Lấy đúng version react (≥19.2 hay chưa → quyết định keep-alive).
- Ra top 5 việc ROI cao nhất DỰA TRÊN bằng chứng.

**Không cho agent sửa gì ở bước này.** Scan xong đọc report, chốt 3 câu hỏi:
- Push thẳng main hay mở PR? (App có tiền → nên PR)
- React đã ≥19.2 chưa?
- Mutation nào là "review" cần mày tự quyết?

---

## Bước 3 — FIX theo thứ tự ROI

Dùng `prompts/FIX_template.md`. Dán SCAN report vào đầu session FIX. Làm theo work-package, **commit riêng từng cái**, gate xanh mới qua WP sau. Thứ tự:

| WP | Làm gì | Tác dụng |
|----|--------|----------|
| 1 | Query cache + persist (allowlist tiền) | Hết refetch + hết màn trắng cold-open |
| 2 | `<Activity>` keep-alive 4-5 tab | Tab switch < 16ms — "chất TikTok" |
| 3 | Cursor thật + virtual list feed | Mượt trên Android yếu |
| 4 | Prefetch + skeleton + transition | Tab lần đầu nhanh, hết nháy trắng |
| 5 | SSE hardening | Realtime bền, N tab = 1 connection |
| 6 | Cache header + bundle | Chịu tải tốt khi scale |
| Optimistic | Sprint RIÊNG sau | Mọi nút bấm phản hồi tức thì |

Gom code dùng chung vào package chung (`packages/core`) nếu monorepo → sửa 1 lần lời mọi app.

**LẰN RANH CỨNG — áp mọi lúc:**
- KHÔNG persist / optimistic / cache header trên bất cứ thứ gì dính tiền. Like sai 200ms hoàn tác được; số dư sai thì không.

---

## Bước 4 — VERIFY (mắt xích hay bị bỏ qua nhất)

### Gate tự động
```bash
node --version
NODE_OPTIONS=--no-experimental-strip-types npx turbo run build --force   # mirror Cloudflare Node 20
```
**Cực kỳ quan trọng:** build xanh trên Bun hoặc Node mới KHÔNG chứng minh gì — cả hai nạp được `.ts` config nên nói dối. Đây là bug đã làm sập deploy thật. Gate phải chạy đúng runtime deploy.

Rồi: type-check, biome, grep chứng minh 0 optimistic/persist chạm tiền.

### QA tay (con người — máy không test được)
5 mục bắt buộc trước khi lên prod:
1. Chuyển 4 tab × 3 vòng: giữ state/scroll, không refetch.
2. Video tab ẩn: lướt đi → nhạc DỪNG.
3. 3 browser tab: chỉ 1 SSE connection; đóng tab leader → tab khác lên.
4. Refresh: data public hiện instant; wallet vẫn fetch tươi.
5. Optimistic: offline → like → revert; chat 2 máy → không double; tap nhanh → không drift.

**Nếu QA chưa chạy được → DỪNG, chưa push main.** Gate tự động xanh ≠ đúng.

---

## Bước 5 — PUSH & DEPLOY

```bash
git checkout -b feat/smooth-nav
# ... commit từng WP ...
git checkout main && git pull --ff-only
git merge --no-ff feat/smooth-nav
git push origin main          # KHÔNG force
```
- Watch deploy: **TẤT CẢ app xanh**, không chỉ 1.
- Chỉ xoá branch sau khi deploy xác nhận toàn bộ xanh + QA tay sạch.
- Nợ kỹ thuật lớn (vd migrate offset→cursor cho nhiều service) → PR RIÊNG, đừng nhét chung.

---

## Bước 6 — Chống tái phạm (làm 1 lần, dùng mãi)

- **Guard tĩnh:** script quét config import `.ts` từ package → fail. Immune với runtime, chạy pre-commit.
- **CI mirror deploy:** GitHub Action chạy build Node-no-strip trên mỗi push main.

---

## Nguyên tắc vàng (rút ra từ toàn bộ hành trình)

1. **Scan trước, fix sau.** Không bao giờ fix mù.
2. **Mọi "đã xong" phải có bằng chứng thô** (raw curl, node --version, grep) — không phải lời khẳng định.
3. **Agent được phép cãi prompt khi bằng chứng mâu thuẫn** — đừng tối ưu dead code, đừng xoá cái đang cần.
4. **Gate bằng đúng runtime deploy**, không phải runtime dev.
5. **Tiền luôn pessimistic.** Đây là lằn ranh không bao giờ vượt.
6. **Đo, đừng đoán.** Thêm feature bừa khi chưa đo = phí.

---

## Cách đưa vào dự án mới (tái sử dụng skill)

1. Cài skill `smooth-tiktok-ux` vào Claude (bấm Save skill trên file `.skill`, hoặc giải nén vào thư mục skills).
2. Mở Claude Code trong repo mới, nói: *"làm app này mượt như tiktok"* hoặc *"app tao bị giật/nháy trắng khi chuyển tab"* → skill tự trigger.
3. Claude chạy SCAN template → report → FIX template → gate → push, theo đúng quy trình trên.
4. Trả lời 3 câu chốt (push/PR, react version, app có tiền không) là xong.
