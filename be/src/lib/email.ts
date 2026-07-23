// WHY: 1 helper sendEmail dùng chung. Dev/test → SMTP Mailhog local (port 1025,
// UI 8025) để verify flow mà KHÔNG gửi email thật. Production → Resend.
// Better Auth callback (emailVerification, sendResetPassword) gọi qua đây.
//
// Dynamic import nodemailer + resend để dev không nuốt phải Resend SDK,
// production không cache nodemailer (giảm bundle).
import { env } from "@/env";
import { logger } from "./logger";

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const DEV_SMTP_HOST = "localhost";
const DEV_SMTP_PORT = 1025;

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { to, subject, text, html } = input;

  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST ?? DEV_SMTP_HOST,
      port: env.SMTP_PORT ?? DEV_SMTP_PORT,
      secure: false,
    });
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    logger.info({ to, subject }, "email.sent.dev");
    return;
  }

  const { resend } = await import("./resend");
  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    logger.error({ to, subject, error: result.error }, "email.send.failed");
    throw new Error(`Email send failed: ${result.error.message}`);
  }

  logger.info({ to, subject, id: result.data?.id }, "email.sent.prod");
}
