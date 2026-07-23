# HUMAN-TODO — việc con người phải làm (agent không làm được)

> Checklist này áp dụng cho MỌI repo dựng từ template (kể cả chính template).
> Cho tới khi các mục dưới xong, code vẫn AN TOÀN: hook đã chặn lỗi ở local,
> CI validate + secrets-scan tự chạy khi push GitHub. Không có gì bị vỡ khi trì hoãn.
> Degit sang dự án mới → chạy `node scripts/init-project.mjs <tên>` TRƯỚC, script
> sẽ in lại checklist này kèm các việc riêng của dự án mới.

## 1. Xác nhận CI Actions xanh (sau lần push đầu tiên)

Mở `https://github.com/<org>/<repo>/actions` → run `CI` mới nhất phải XANH
(job `validate` + `secrets-scan`). Nếu máy dev có `gh` CLI thì agent tự xem được:
`gh run list --limit 1`.

## 2. Cài gitleaks binary (mỗi máy dev + VPS)

Hook pre-commit gọi `gitleaks` — máy nào commit vào repo này đều cần binary:

```bash
# Windows:  scoop install gitleaks   (hoặc winget install Gitleaks.Gitleaks)
# macOS:    brew install gitleaks
# Ubuntu/VPS:
curl -sL -o /tmp/g.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
sudo tar -C /usr/local/bin -xzf /tmp/g.tar.gz gitleaks
gitleaks version   # → 8.30.1
```

## 3. Bật Renovate app trên repo GitHub

https://github.com/apps/renovate → Install → chọn repo này.
Bật thêm Settings → Security → Dependency graph + Dependabot alerts
(để `vulnerabilityAlerts` của Renovate hoạt động).

## 4. Chạy test integration đúng cách (fail-env ≠ lỗi code)

Test `(Postgres thật)` cần đúng DB của repo NÀY. Nếu port Postgres trên máy
đang là DB của dự án khác → test đỏ với lỗi kiểu "thiếu cột" — đó là lỗi
môi trường. Chạy đúng: `docker compose up -d` của repo này rồi
`bun run db:migrate && bun test`. Xem `ERRORS.md` BUG-014.

## 5. (Tuỳ chọn) Test integration trong CI

CI hiện chạy `bun run validate` + secrets-scan, CHƯA chạy `bun test` vì các
test "(Postgres thật)" cần DB thật — cần cân nhắc thời gian runner.
Nếu muốn: thêm job với services postgres/dragonfly hoặc dùng testcontainers
(runner ubuntu có Docker sẵn).
