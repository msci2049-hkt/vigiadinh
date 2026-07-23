// WHY: @hono/zod-validator default hook short-circuits với shape riêng
// (`{success:false,error:{name:"ZodError",...}}`) → bypass global onError →
// response error shape khác với phần còn lại của app.
//
// Wrapper này throw ZodError thật, để errorHandler (src/middlewares/error.ts)
// map sang `{error:{code:"VALIDATION_ERROR",message,details}}` thống nhất.
//
// Mọi route mới MUST dùng `zv()` thay vì `zValidator` trực tiếp.
import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

export function zv<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) throw result.error;
  });
}
