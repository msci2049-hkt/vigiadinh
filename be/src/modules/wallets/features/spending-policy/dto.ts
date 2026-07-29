// DTO ngưỡng mềm chi tiêu (A6/E2). Số tiền đi dây dạng CHUỖI STROOPS (khuôn
// send-flow) — bigint không sống được trong JSON, và XLM lẻ 7 số thập phân.
import { z } from "zod";

/** Chuỗi stroops dương, tối đa 19 ký tự (dưới trần i64 — trần thật là cap on-chain). */
const stroopsString = z.string().regex(/^[1-9][0-9]{0,18}$/, "stroops nguyên dương");

export const putPolicyBody = z.object({
  per_tx_limit: stroopsString,
  daily_limit: stroopsString,
});

export type PutPolicyBody = z.infer<typeof putPolicyBody>;

/** View một bản chính sách trả về FE — stroops chuỗi + mốc thời gian ISO. */
export function policyView(row: {
  perTxLimit: bigint;
  dailyLimit: bigint;
  version: number;
  effectiveAt: Date;
}): {
  perTxLimit: string;
  dailyLimit: string;
  version: number;
  effectiveAt: string;
} {
  return {
    perTxLimit: row.perTxLimit.toString(),
    dailyLimit: row.dailyLimit.toString(),
    version: row.version,
    effectiveAt: row.effectiveAt.toISOString(),
  };
}
