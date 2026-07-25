# UI Audit State — VíGiaĐình

## Pha hiện tại: 1/6
## Màn đã đọc: 0/41

| # | Route | File | Đọc xong | Thiếu gì | Đã vá | Commit |
|---:|---|---|:---:|---|---|---|
| 1–41 | Chờ trích xuất từ router ở Pha 1 | — | Không | Chưa kiểm kê | Chưa | — |

## Việc tiếp theo chính xác

1. Đọc `fe/CLAUDE.md` và trích xuất chính xác 41 route từ router.
2. Đọc lần lượt từng file route, cập nhật bảng ngay sau từng màn.
3. Kiểm kê asset độc lập và đối chiếu hai chiều với code.

## Quyết định đã chốt (đừng quyết lại)

- Chỉ sửa mã sản phẩm trong `fe/`; không sửa nội dung `be/` hoặc `contracts/`.
- Mọi WIP có sẵn được bảo toàn riêng, không đưa vào commit UI.
- Không dùng `--no-verify`.
- HEAD đầu phiên: `0db71cd304af261736e5660df41c41f43829443d`.
- Nhánh đầu phiên thực tế: `sec/be-audit-2026-07-25` (khác `main` trong yêu cầu).
- Nhánh thực thi UI: `feat/fe-ui-assets`, tạo từ `origin/main@0db71cd`.
- 37 thay đổi `be/` đã nằm trong stash có nhãn `be-wip-2026-07-25`.
- Ba WIP root `BLOCKERS.md`, `lefthook.yml`, `pnpm-lock.yaml` đã nằm trong stash có nhãn
  `root-wip-from-be-audit-2026-07-25`.
- Gitleaks 8.30.1 sạch trên toàn lịch sử của `0db71cd`, quét bù ngày 2026-07-25:
  134 commit, khoảng 7,89 MB, 0 leak.
- Hook root dùng `node scripts/run-gitleaks.mjs protect --staged`; script tải bản chính thức
  8.30.1, kiểm SHA-256 và cache trong `.git/tools/`.
- Test hook: stage fixture seed giả rồi chạy commit thật; commit bị chặn với exit code 1.

## Chỗ đang nghi ngờ

- `main` cục bộ ở `17f6334`, không cùng HEAD với `origin/main`; không được ghi đè nhánh cục bộ đó.
- Khi kết thúc phải khôi phục BE stash; root stash có thay đổi `lefthook.yml` trùng với hook mới nên
  cần khôi phục chọn lọc `BLOCKERS.md` và `pnpm-lock.yaml`, không ghi đè hàng rào mới.

## Nhật ký checkpoint

- 2026-07-25: Khởi tạo checkpoint trước khi thay đổi mã.
- 2026-07-25: Pha 0 hoàn tất; BE/root WIP đã cô lập, gitleaks full-history sạch, hook giả-secret
  đã chặn commit như yêu cầu.
