# syntax=docker/dockerfile:1.7
# PIN version cụ thể (không :latest, không :1) — build hôm nay = build 6 tháng nữa.
# 1.3.8 = bun đang chạy ở dev (bun --version) → dev/prod cùng runtime, không drift.
# Bump: đổi 2 dòng FROM (base + runtime) CÙNG LÚC + chạy lại full test.
FROM oven/bun:1.3.8 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
# --ignore-scripts: stage này CHỈ để `bun build` bundle (resolve import) — không
# cần native postinstall. Không có cờ này: better-sqlite3 (dep cứng của
# @better-auth/cli, devDep) chạy node-gyp → image bun không có → build FAIL
# (BUG-013). Native module runtime thật (nếu có) nằm ở prod-deps.
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile --ignore-scripts

FROM base AS prod-deps
COPY package.json bun.lock ./
# --ignore-scripts BẮT BUỘC ở đây cũng vậy: `--production` bỏ devDependencies
# (lefthook nằm trong đó) nhưng script `prepare` VẪN chạy `lefthook install`
# → `command not found` → exit 127 → build container FAIL. Cùng footgun với
# stage `deps` ở trên, chỉ khác nguyên nhân (thiếu binary thay vì node-gyp).
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile --production --ignore-scripts

FROM deps AS builder
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle ./drizzle
RUN bun build ./src/index.ts --target=bun --outdir ./dist --minify --sourcemap
RUN bun build ./src/cluster.ts --target=bun --outdir ./dist --minify --sourcemap
RUN bun build ./src/workers/index.ts --target=bun --outdir ./dist/workers --minify --sourcemap
# FIX: migrate script ở scripts/migrate.ts (KHÔNG phải src/migrate.ts) — path cũ
# `./src/migrate.ts` làm `docker build` fail (file không tồn tại). Cần COPY scripts.
RUN bun build ./scripts/migrate.ts --target=bun --outdir ./dist --minify --sourcemap
# Role runtime (thành viên app_runtime) phải tồn tại TRƯỚC khi app connect —
# entrypoint.sh gọi ngay sau migrate. Thiếu bundle này thì deploy đầu tiên chết.
RUN bun build ./scripts/provision-runtime-role.ts --target=bun --outdir ./dist --minify --sourcemap

FROM oven/bun:1.3.8-alpine AS runtime
RUN apk add --no-cache tini tzdata ca-certificates \
    && cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime \
    && echo "Asia/Ho_Chi_Minh" > /etc/timezone

WORKDIR /app
ENV NODE_ENV=production PORT=3000 TZ=Asia/Ho_Chi_Minh

COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder   --chown=bun:bun /app/dist         ./dist
COPY --from=builder   --chown=bun:bun /app/drizzle      ./drizzle
COPY --chown=bun:bun package.json ./
COPY --chown=bun:bun entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER bun
EXPOSE 3000

# Healthcheck KHÔNG phụ thuộc curl/wget (alpine slim không có sẵn) — dùng bun fetch.
# PORT env-aware (không hardcode 3000). start-period 40s: đủ cho container boot
# + (dev-compose) migrate ở entrypoint; deploy prod migrate chạy ở GATE trước up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default CMD = cluster supervisor (spawn WEB_INSTANCES bản dist/index.js, reusePort).
# entrypoint.sh chạy migrate trước rồi exec CMD. Worker override CMD ở compose.
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
CMD ["bun", "run", "dist/cluster.js"]
