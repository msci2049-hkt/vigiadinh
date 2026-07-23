// WHY: Singleton Resend client — SDK tự handle retry, không cần wrap thêm.
// Route gửi mail qua services/email/* (Phase sau) để có idempotency + audit.
import { Resend } from "resend";
import { env } from "@/env";

export const resend = new Resend(env.RESEND_API_KEY);
