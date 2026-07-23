# SKILL: Tạo email template (React Email + Resend)

## Dùng khi nào

- Transactional email: welcome, reset password, magic link, receipt, OTP.
- Cần template đẹp, responsive, dark-mode-aware.
- Cần i18n (vi/en).
- **Idempotent send** qua `dedup_key` index.

---

## Thứ tự làm

```
1. Bảng `email_log` trong src/db/schema/email-log.ts (xem skill new-schema).

2. Component template ở src/emails/<name>.tsx
   → JSX dùng @react-email/components (cài khi dùng skill này:
     bun add @react-email/components).
   → Pure function của props, không fetch, không env, không DB.

3. src/services/email/render.ts
   → Discriminated union EmailJob → { html, text, subject }.

4. src/services/email/send.ts
   → sendEmail(): INSERT idempotency + render + Resend.send.

5. Send qua skill new-job (khuyến nghị) HOẶC trực tiếp (rare).

6. Dev: bun react-email dev để preview ở localhost:3001.
```

---

## File tạo ở đâu

```
src/emails/<name>.tsx                      ← template JSX
src/services/email/render.ts               ← union → html/text/subject
src/services/email/send.ts                 ← idempotent send
src/db/schema/email-log.ts                 ← bảng email_log
src/lib/resend.ts                          ← Resend client
```

---

## Code mẫu

### 1. `src/lib/resend.ts`

```ts
/**
 * Resend client singleton.
 */
import { Resend } from "resend";
import { env } from "@/env";

export const resend = new Resend(env.RESEND_API_KEY);
```

### 2. `src/db/schema/email-log.ts`

```ts
/**
 * Bảng email_log — track mọi email gửi đi.
 * - dedup_key UNIQUE → INSERT 2nd throw 23505 → trả deduplicated.
 */
import { pgTable, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const emailLog = pgTable(
  "email_log",
  {
    id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
    dedupKey: varchar("dedup_key", { length: 200 }).notNull(),
    to: varchar("to", { length: 320 }).notNull(),
    templateId: varchar("template_id", { length: 64 }).notNull(),
    providerId: varchar("provider_id", { length: 128 }),
    status: varchar("status", { length: 16 }).notNull(), // pending | sent | failed
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    error: varchar("error", { length: 500 }),
  },
  (t) => ({
    dedupUq: uniqueIndex("email_log_dedup_uq").on(t.dedupKey),
  }),
);
```

### 3. `src/emails/welcome.tsx`

```tsx
/**
 * Welcome email — pure function của props.
 * - Không DB, không fetch, không env.
 * - <Tailwind> handle CSS inlining cross-client.
 * - @react-email/render v1+: render() là ASYNC.
 */
import {
  Html, Head, Preview, Body, Container, Heading, Text, Button, Section, Tailwind,
} from "@react-email/components";

export type WelcomeEmailProps = {
  name: string;
  ctaUrl: string;
  locale: "vi" | "en";
};

const T = {
  vi: { preview: "Chào mừng bạn", title: (n: string) => `Chào mừng, ${n}!`,
    body: "Cảm ơn bạn đã đăng ký.", cta: "Bắt đầu", subject: "Chào mừng 🎉" },
  en: { preview: "Welcome", title: (n: string) => `Welcome, ${n}!`,
    body: "Thanks for signing up.", cta: "Get started", subject: "Welcome 🎉" },
} as const;

export function WelcomeEmail({ name, ctaUrl, locale }: WelcomeEmailProps): JSX.Element {
  const t = T[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto my-10 max-w-[480px] p-6">
            <Heading className="text-2xl font-bold">{t.title(name)}</Heading>
            <Text className="text-base text-gray-700">{t.body}</Text>
            <Section className="mt-6">
              <Button href={ctaUrl} className="rounded bg-black px-5 py-3 text-white no-underline">
                {t.cta}
              </Button>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default WelcomeEmail;
export const welcomeSubject = (locale: "vi" | "en"): string => T[locale].subject;
```

### 4. `src/services/email/render.ts`

```ts
/**
 * Discriminated union → templateId <-> props match compile-time.
 * render() trả Promise<string> từ @react-email/render v1.0.0+.
 */
import { render } from "@react-email/render";
import { WelcomeEmail, welcomeSubject, type WelcomeEmailProps } from "@/emails/welcome";

export type EmailJob =
  | { templateId: "welcome"; locale: "vi" | "en"; props: WelcomeEmailProps };
// | { templateId: "reset-password"; ... }
// | { templateId: "magic-link"; ... }

export async function renderEmail(job: EmailJob): Promise<{
  html: string;
  text: string;
  subject: string;
}> {
  switch (job.templateId) {
    case "welcome": {
      const html = await render(WelcomeEmail(job.props));
      const text = await render(WelcomeEmail(job.props), { plainText: true });
      return { html, text, subject: welcomeSubject(job.locale) };
    }
  }
}
```

### 5. `src/services/email/send.ts`

```ts
/**
 * Idempotent send:
 *  1) INSERT email_log với UNIQUE dedup_key.
 *  2) PG 23505 → đã gửi, return deduplicated.
 *  3) Otherwise render + Resend.send, update status.
 */
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/bun";
import { db } from "@/lib/db";
import { emailLog } from "@/db/schema/email-log";
import { resend } from "@/lib/resend";
import { renderEmail, type EmailJob } from "./render";
import { env } from "@/env";
import { logger } from "@/lib/logger";

const PG_UNIQUE_VIOLATION = "23505";

export async function sendEmail(args: {
  to: string;
  dedupKey: string;
  job: EmailJob;
}): Promise<{ id: string; deduplicated: boolean }> {
  let id: string;
  try {
    const [row] = await db.insert(emailLog).values({
      dedupKey: args.dedupKey, to: args.to,
      templateId: args.job.templateId, status: "pending",
    }).returning({ id: emailLog.id });
    id = row.id;
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      logger.info({ dedupKey: args.dedupKey }, "email.skipped-duplicate");
      return { id: "", deduplicated: true };
    }
    throw err;
  }

  const { html, text, subject } = await renderEmail(args.job);
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM, to: args.to, subject, html, text,
    headers: { "X-Entity-Ref-ID": args.dedupKey },
  });

  if (error) {
    await db.update(emailLog).set({ status: "failed", error: error.message })
      .where(eq(emailLog.id, id));
    Sentry.captureException(error, { tags: { templateId: args.job.templateId } });
    throw new Error(`RESEND_FAILED:${error.message}`);
  }
  await db.update(emailLog).set({ status: "sent", providerId: data?.id })
    .where(eq(emailLog.id, id));
  return { id, deduplicated: false };
}
```

---

## Dev preview

```bash
# package.json: "email:dev": "bunx react-email dev --port 3001"
bun run email:dev  # mở http://localhost:3001
```

---

## Test

```bash
# 1. Preview template
bun run email:dev
# → http://localhost:3001 → click "welcome" thấy template render.

# 2. Send lần 1
bun --eval "
  import('./src/services/email/send').then(async ({ sendEmail }) => {
    const r = await sendEmail({
      to: 'test@example.com',
      dedupKey: 'welcome:user_123',
      job: { templateId: 'welcome', locale: 'vi', props: { name: 'Gin', ctaUrl: 'https://x.com', locale: 'vi' } },
    });
    console.log(r); // { id: '...', deduplicated: false }
  });
"

# 3. Send lần 2 cùng dedupKey → { deduplicated: true }, KHÔNG gọi Resend.

# 4. Verify dấu tiếng Việt ở Gmail/Outlook.
```

---

## Checklist cuối

- [ ] Bảng `email_log` có unique index trên `dedup_key`.
- [ ] Template là pure function (no DB/env/fetch).
- [ ] `render()` dùng `await` (async từ v1.0).
- [ ] Discriminated union ở `render.ts`.
- [ ] `sendEmail` bắt PG 23505 → deduplicated.
- [ ] `bun react-email dev` preview thành công.
- [ ] Resend domain đã verify, dấu tiếng Việt OK.
- [ ] File ≤ 300 dòng.

---

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Cách fix |
|---|---|---|
| `render()` không có `.then` | @react-email/render < 1.0 | Upgrade. v1+ render là async. |
| Email body trống ở Gmail | Thiếu text version hoặc Tailwind chưa inline | Wrap `<Tailwind>`, truyền cả html lẫn text. |
| Resend trả `validation_error` | `from` không thuộc domain verified | Verify domain trên Resend dashboard. |
| Dedup không hoạt động | `dedupKey` có timestamp/random | Dùng business identity: `welcome:${userId}`. |
| Dấu tiếng Việt thành `?` | Charset header sai | Resend mặc định UTF-8. Kiểm tra file template UTF-8. |
| Email vào spam | SPF/DKIM/DMARC chưa cấu hình | Verify đầy đủ DNS record ở Resend. |
| Render lỗi `Cannot find module react/jsx-runtime` | TypeScript config thiếu jsx | `"jsx": "react-jsx"` trong tsconfig. |
| Email log đầy DB sau 1 tháng | Quên cleanup | Cron xoá row > 90 ngày qua skill new-cron. |
