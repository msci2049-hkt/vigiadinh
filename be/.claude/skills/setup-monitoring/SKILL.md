---
name: setup-monitoring
description: Setup tools giám sát production (Sentry, Uptime Robot, Better Stack). Dùng khi user gõ "setup monitoring", "thêm giám sát", "config sentry".
---

# Setup monitoring stack

4 tool đề xuất cho project mới có production.

## 1. Sentry (error tracking)

Đã có sẵn trong template (`@sentry/bun`). User cần:

- Đăng ký https://sentry.io (free 5K event/tháng)
- Tạo project, copy `SENTRY_DSN`
- Add `SENTRY_DSN` vào `.env` production
- Verify: throw test error, check Sentry dashboard

Code init đã có ở `src/lib/sentry.ts` — chỉ cần set env.

## 2. Uptime Robot (uptime monitoring)

- Đăng ký https://uptimerobot.com (free 50 monitor, 5-min interval)
- Add monitor cho health endpoint:
  - URL: `https://api.<domain>/health`
  - Type: HTTPS, GET
  - Interval: 5 minutes
  - Alert: email/Telegram khi down
- Setup status page public (optional)

## 3. Better Stack (logs aggregation)

- Đăng ký https://betterstack.com (free 1GB/tháng)
- Tạo source "Bun App", copy `SOURCE_TOKEN`
- Add `BETTERSTACK_TOKEN` vào `.env`
- Hướng dẫn user thêm pino transport `pino-betterstack` vào `src/lib/logger.ts`:

```ts
const transport = pino.transport({
  targets: [
    { target: "pino-pretty", level: "info" },
    {
      target: "@logtail/pino",
      options: { sourceToken: env.BETTERSTACK_TOKEN },
      level: "info",
    },
  ],
});
```

## 4. Cronitor (cron monitoring)

- Đăng ký https://cronitor.io (free 5 monitor)
- Mỗi cron job: ping URL trước + sau khi chạy:

```ts
await fetch(`https://cronitor.link/${MONITOR_KEY}?state=run`);
// ... cron work ...
await fetch(`https://cronitor.link/${MONITOR_KEY}?state=complete`);
```

- Alert nếu cron không chạy đúng schedule

## Verify checklist

- [ ] `SENTRY_DSN` set, test error capture được
- [ ] Uptime Robot monitor running, alert config OK
- [ ] Logs xuất hiện trên Better Stack dashboard
- [ ] Cron job được track (nếu có)
- [ ] `.env.example` đã có placeholder cho `SENTRY_DSN`, `BETTERSTACK_TOKEN`, `CRONITOR_KEY`
