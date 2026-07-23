---
globs: docker-compose*.yml,deploy/docker-compose*.yml,Dockerfile*,.env.example
description: Luật compose — cấm host port cứng + container_name tĩnh; COMPOSE_PROJECT_NAME + port env-driven để nhiều dự án chạy song song.
---

# Rule: Docker Compose

Máy dev thường chạy **nhiều dự án cùng lúc** (mỗi dự án một stack postgres/dragonfly/mailhog).
Hai lỗi kinh điển làm các stack giẫm nhau: host port cứng và container name tĩnh.

## Bắt buộc

- **KHÔNG hardcode host port.** Vế host của `ports:` phải là biến env có default:
  ```yaml
  ports: ["127.0.0.1:${DB_PORT:-5432}:5432"]     # ✅ đổi được qua .env
  ports: ["127.0.0.1:5432:5432"]                  # ❌ đụng dự án khác đang chiếm 5432
  ```
  Biến port khai ở `.env.example` + thêm vào `INFRA_KEYS` (`scripts/check-env-parity.ts`).
  Đổi `DB_PORT`/`REDIS_PORT` thì `DATABASE_URL`/`REDIS_URL` phải trỏ port mới theo.
- **Luôn bind loopback** `127.0.0.1:` cho service dev — không phơi DB/cache ra LAN.
- **KHÔNG dùng `container_name:`** — để compose tự đặt `<project>-<service>-N`.
  Tên project qua `COMPOSE_PROJECT_NAME` trong `.env` (mỗi dự án MỘT tên riêng;
  `init-project.mjs` tự set = slug). Trùng tên project = trùng network/volume = đè data nhau.
- **App connect qua env** (`DATABASE_URL`, `REDIS_URL`) — trong container trỏ service DNS
  (`postgres:5432`, `dragonfly:6379`), trên host trỏ `localhost:<PORT đã cấp>`.
  KHÔNG hardcode `localhost:5432` trong code — dễ trúng DB của dự án khác (nguồn của
  BUG-012/014: test đỏ giả vì port 5432 là Postgres dự án khác).
- Volume dùng **named volume** (compose tự prefix theo project) — không bind-mount data DB.
- Prod compose (`deploy/docker-compose.prod.yml`): DB/cache **không publish port**,
  network `data` internal, image **pin tag** (không `:latest`).

## Khi sửa compose, MUST verify

- [ ] `docker compose config --quiet` pass (cả file carbon nếu còn).
- [ ] Không còn literal port ở vế host (grep `"127.0.0.1:[0-9]`).
- [ ] Biến port mới đã có trong `.env.example` + `INFRA_KEYS` (`bun run check:env-parity` xanh).
