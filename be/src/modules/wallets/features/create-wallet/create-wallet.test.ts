// Integration Postgres THẬT: mirror ví (setup mức A). Idempotent theo địa chỉ
// cho CHÍNH user; địa chỉ đã thuộc user khác → chặn.
import { afterAll, describe, expect, it } from "bun:test";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { findByAddress, insert } from "../../infra/wallets.repository";
import { wallets } from "../../infra/wallets.schema";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const cleanupIds: string[] = [];
type StrKeyBytes = Parameters<typeof StrKey.encodeContract>[0];
function contractAddress(): string {
  const b = Keypair.random().rawPublicKey() as unknown as StrKeyBytes;
  return StrKey.encodeContract(b);
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupIds) await db.delete(wallets).where(eq(wallets.id, id));
});

describe("create-wallet (mirror ví smart account)", () => {
  testIt("insert + findByAddress; địa chỉ contract là duy nhất", async () => {
    const addr = contractAddress();
    const user = `it-cw-${crypto.randomUUID().slice(0, 8)}`;
    const w = await insert({ userId: user, stellarAddress: addr, contractId: addr });
    cleanupIds.push(w.id);
    expect(w.contractId).toBe(addr);

    const found = await findByAddress(addr);
    expect(found?.id).toBe(w.id);
    expect(found?.userId).toBe(user);

    // Địa chỉ lạ → null (không lộ ví nào tồn tại ở tầng repo).
    expect(await findByAddress(contractAddress())).toBeNull();
  });
});
