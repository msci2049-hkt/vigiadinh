# ROUTES.md — nguồn sự thật route FE (chốt 2026-07-23, PHA 1.5 §5)

> Quy tắc đã chốt: **giữ tên route FE đang có** (ux-v2), map 1-1 sang ngữ nghĩa handoff §08
> (46 route id). **Handoff thắng về ngữ nghĩa, FE thắng về tên.** Prototype mobile-ui (50 key)
> chỉ là tham chiếu hình ảnh, không phải danh sách route.
> Ngoài phạm vi v1 (đánh N): `letter` (két di chúc M9 ĐÃ HUỶ), `remit*` (kiều hối — handoff tự
> dán nhãn roadmap), `legal` (hồ sơ công chứng).

## A · Route FE hiện có (54 file — 51 màn + 3 layout)

| Route id chính thức (FE) | Ngữ nghĩa handoff §08 | Nguồn | v1? |
|---|---|---|---|
| `/` (index) | — (điều hướng login/app) | template | Y |
| `/login` | — (auth template) | template | Y |
| `/sign-up` | — (auth template) | template | Y |
| `/verify-email` | — (auth template) | template | Y |
| `/forgot-password` | — (auth template) | template | Y |
| `/reset-password` | — (auth template) | template | Y |
| `/unauthorized` | — (auth template) | template | Y |
| `/welcome` | home (điểm vào onboarding) | ux-v2 nhóm 1 | Y |
| `/get-started` | home (chọn tạo/mở ví) | ux-v2 nhóm 1 | Y |
| `/passkey` | biometric (shared state) | ux-v2 nhóm 1 | Y |
| `/recovery` | recovery | ux-v2 nhóm 5 (PUBLIC chủ ý — người mất máy chưa có session) | Y |
| `/recovery/find-wallet` | recovery (tìm ví) | ux-v2 nhóm 5 | Y |
| `/recovery/sent` | recovery-request | ux-v2 nhóm 5 | Y |
| `/recovery/progress` | recovery-mother + recovery-sister (tiến độ approvals) | ux-v2 nhóm 5 | Y |
| `/recovery/countdown` | recovery-wait (timelock) | ux-v2 nhóm 5 | Y |
| `/recovery/done` | done (recovery) | ux-v2 nhóm 5 | Y |
| `/setup` | (mockup nhóm 2 — handoff không tách setup) | ux-v2 nhóm 2 | Y |
| `/setup/assistant` | copilot thiết lập (KHÔNG phải assistant AI tiền) | ux-v2 nhóm 2 | Y |
| `/setup/choose-guardians` | guardian-invite (chọn người) | ux-v2 nhóm 2 | Y |
| `/setup/invite` | guardian-invite (gửi link) | ux-v2 nhóm 2 | Y |
| `/setup/threshold` | (threshold policy) | ux-v2 nhóm 2 | Y |
| `/setup/timelock` | (timelock policy) | ux-v2 nhóm 2 | Y |
| `/setup/review` | (review + owner sign) | ux-v2 nhóm 2 | Y |
| `/setup/done` | done (setup) | ux-v2 nhóm 2 | Y |
| `/wallet` | home / money hub | ux-v2 nhóm 3 | Y |
| `/wallet/send` | send + send-review (send-risk rẽ sang guardian/*) | ux-v2 nhóm 3 | Y |
| `/wallet/receive` | receive (+ receive-qr/copy/share là biến thể trong màn) | ux-v2 nhóm 3 | Y |
| `/wallet/history` | records (sổ giao dịch) | ux-v2 nhóm 3 | Y |
| `/guardians` | guardians | ux-v2 nhóm 3 | Y |
| `/guardians/$guardianId` | guardian-offline + guardian-connect + guardian-replace | ux-v2 nhóm 3 | Y |
| `/night-watch` | watch | ux-v2 nhóm 4 | Y |
| `/night-watch/log` | watch (nhật ký check) | ux-v2 nhóm 4 | Y |
| `/night-watch/alert` | watch-alert | ux-v2 nhóm 4 | Y |
| `/night-watch/resolve` | guardian-replace / reconnect | ux-v2 nhóm 4 | Y |
| `/night-watch/waiting` | guardian-offline (chờ nối lại) | ux-v2 nhóm 4 | Y |
| `/night-watch/guardian-view` | watch phía guardian | ux-v2 nhóm 4 | Y |
| `/guardian` | guardian-request (inbox phía guardian) | ux-v2 nhóm 6 | Y |
| `/guardian/approve` | guardian-approve | ux-v2 nhóm 6 | Y |
| `/guardian/approve-warning` | guardian-approve (nhánh cảnh báo risk) | ux-v2 nhóm 6 | Y |
| `/guardian/approved` | send-final / done (phía guardian) | ux-v2 nhóm 6 | Y |
| `/block` | recovery veto (event recovery.vetoed) — KHÔNG phải blacklist | ux-v2 nhóm 7 | Y |
| `/block/confirm` | veto confirm | ux-v2 nhóm 7 | Y |
| `/block/done` | done (veto) | ux-v2 nhóm 7 | Y |
| `/inheritance` | inherit | ux-v2 nhóm 8 | Y |
| `/inheritance/heartbeat` | heartbeat (owner "tôi vẫn ổn") | ux-v2 nhóm 8 | Y |
| `/inheritance/claim` | inherit claim (phía người thừa kế) | ux-v2 nhóm 8 | Y |
| `/dashboard` | — DEMO template, gọi `/api/dashboard/summary` KHÔNG tồn tại (404) | template | **N — XOÁ (lô 4)** |
| `/admin` `/admin/users` `/admin/sessions` `/admin/settings` | — admin panel template | template | Y (GIỮ NGUYÊN) |
| `__root.tsx`, `_authenticated/route.tsx`, `_admin/route.tsx` | layout — không phải màn | — | Y |

**Ghi chú tách session (CẤM gộp):** `guardians/*` = chủ ví quản lý người bảo hộ ·
`guardian/*` = phiên NGƯỜI BẢO HỘ duyệt yêu cầu. Trông trùng lặp nhưng cố ý (§3 PHA 1.5).

## B · Ngữ nghĩa handoff CHƯA dựng ở FE (không có file — không phải việc của PHA 1.5)

| Handoff route id | Ý nghĩa | v1? |
|---|---|---|
| assistant, ai-review | AI money assistant (voice intent → review) | Sau v1 — không nằm trong 39 khung; quyết ở PHA 6+ |
| gift, gift-review | Lì xì hẹn ngày | Sau v1 — chưa có khung |
| care, care-review, care-approval, care-active, care-log | Chi tiêu được uỷ quyền (care) | BE v1 (PHA 5 `/care/grant\|revoke`); FE sau v1 — chưa có khung |
| policy | Sửa policy rule versioned | BE v1 (PHA 5); FE sau v1 |
| blacklist, blacklist-add | Sổ đen gia đình | Sau v1 |
| tokens, token-detail | Lọc token rác | Sau v1 |
| receive-qr, receive-copy, receive-share | Biến thể trong `/wallet/receive` | Y (trong màn, không tách route) |
| send-risk, guardian-request, send-final | Nhánh risk của send — phủ bởi `/guardian/*` | Y (đã map ở bảng A) |
| biometric, done | Shared state (modal/bước trong màn), không phải route | Y (trong màn) |
| **letter** | Lời nhắn để lại (két di chúc M9) | **N — ĐÃ HUỶ** |
| **legal** | Hồ sơ công chứng | **N — ngoài phạm vi** |
| **remit, remit-review** | Kiều hối | **N — roadmap (handoff tự dán nhãn)** |
| records | Sổ giao dịch — phủ bởi `/wallet/history` | Y (đã map ở bảng A) |

**Đếm phủ:** 46/46 route id handoff xuất hiện đúng một lần trong A hoặc B; 54/54 file route FE có mặt ở bảng A.
