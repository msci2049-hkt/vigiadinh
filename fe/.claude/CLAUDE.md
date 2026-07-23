# Đã chuyển

Primer chính thức của repo này nằm ở **`CLAUDE.md` ở root** (Claude Code auto-load).

File này chỉ còn là con trỏ. Nội dung cũ đã lạc hậu — nó mô tả layout **single-app**
(`src/features/...`, `scripts/check-boundaries.ts`) trong khi repo đã là **monorepo pnpm + Turbo**
(`apps/*` + `packages/*`, enforcer thật là `packages/config/scripts/check-boundaries.mjs`),
và không nhắc honest build / Sentry / role-panel / email OTP / deploy Cloudflare.
Bản viết lại từ code thật: xem `../CLAUDE.md`.

> Claude Code chấp nhận project memory ở **một trong hai** vị trí: `./CLAUDE.md` **hoặc**
> `./.claude/CLAUDE.md`. Repo này chọn root. Đừng viết nội dung primer vào đây nữa —
> hai file cùng có nội dung sẽ bị nạp cả hai và mâu thuẫn nhau.

Xem thêm: `.claude/rules/` (luật theo loại file) · `.claude/skills/` (quy trình theo task) ·
`ERRORS.md` ở root (known issues) · `.claude/ERRORS.md` (nhật ký bug).
