// Lô R2 — ba câu SQL tín hiệu chạy trên DB THẬT, vì giá trị của chúng nằm trọn
// trong mệnh đề WHERE: đúng cửa sổ thời gian, đúng status, và QUAN TRỌNG NHẤT
// là đúng ví. Test cuối là negative control: chạy CHÍNH câu SQL đó nhưng bỏ
// `wallet_id = $1` và chứng minh số của ví khác trộn vào — đó là lý do predicate
// này bắt buộc (bài học B3), không phải trang trí.
import { afterAll, describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { guardians } from "@/modules/guardians/infra/guardians.schema";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { transactionIntents } from "../../infra/intents.schema";
import {
  isActiveGuardianUser,
  recipientHistory,
  spendingBaseline,
  velocityLastHour,
} from "../../infra/signals.repository";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const cleanupWalletIds: string[] = [];

function randomAddress(): string {
  const body = crypto
    .randomUUID()
    .replace(/-/g, "")
    .toUpperCase()
    .replace(/[0189]/g, "7");
  return `C${body.slice(0, 55).padEnd(55, "B")}`;
}

async function seedWallet(tag: string): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: `it-sig-${tag}-${crypto.randomUUID().slice(0, 8)}`,
      stellarAddress: randomAddress(),
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  return w.id;
}

async function insertIntent(
  walletId: string,
  input: { amount: bigint; status: string; recipient: string; createdAt: Date },
): Promise<void> {
  await db.insert(transactionIntents).values({
    walletId,
    clientIntentId: crypto.randomUUID().slice(0, 32),
    operations: [],
    status: input.status,
    recipient: input.recipient,
    amount: input.amount,
    createdAt: input.createdAt,
  });
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn intents + guardians
  }
});

const NOW = new Date();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

describe("velocityLastHour — đúng cửa sổ, đúng status, đúng ví", () => {
  testIt("đếm lệnh 1 giờ qua của ĐÚNG ví: bỏ cancelled, bỏ lệnh cũ, bỏ ví khác", async () => {
    const walletA = await seedWallet("va");
    const walletB = await seedWallet("vb");
    const r = randomAddress();
    // Ví A: 2 settled + 1 awaiting trong giờ, 1 cancelled trong giờ, 1 settled 2h trước.
    await insertIntent(walletA, {
      amount: 100n,
      status: "settled",
      recipient: r,
      createdAt: minutesAgo(10),
    });
    await insertIntent(walletA, {
      amount: 200n,
      status: "settled",
      recipient: r,
      createdAt: minutesAgo(20),
    });
    await insertIntent(walletA, {
      amount: 400n,
      status: "awaiting_guardian",
      recipient: r,
      createdAt: minutesAgo(5),
    });
    await insertIntent(walletA, {
      amount: 800n,
      status: "cancelled",
      recipient: r,
      createdAt: minutesAgo(15),
    });
    await insertIntent(walletA, {
      amount: 1600n,
      status: "settled",
      recipient: r,
      createdAt: minutesAgo(120),
    });
    // Ví B ồn ào cùng lúc — không được lọt vào số của A.
    for (let i = 0; i < 5; i++) {
      await insertIntent(walletB, {
        amount: 999n,
        status: "settled",
        recipient: r,
        createdAt: minutesAgo(3),
      });
    }

    const v = await velocityLastHour(walletA, NOW);
    expect(v.txCount).toBe(3);
    expect(v.total).toBe(700n); // 100 + 200 + 400 — không có 800 (cancelled), 1600 (cũ), 999×5 (ví B)
  });
});

describe("recipientHistory — quen/lạ tính THEO VÍ, chỉ đếm settled", () => {
  testIt("đếm đúng số lần settled; draft không tính; lịch sử ví khác không tính", async () => {
    const walletA = await seedWallet("ra");
    const walletB = await seedWallet("rb");
    const known = randomAddress();
    const fresh = randomAddress();
    await insertIntent(walletA, {
      amount: 100n,
      status: "settled",
      recipient: known,
      createdAt: daysAgo(2),
    });
    await insertIntent(walletA, {
      amount: 100n,
      status: "settled",
      recipient: known,
      createdAt: daysAgo(1),
    });
    await insertIntent(walletA, {
      amount: 100n,
      status: "draft",
      recipient: known,
      createdAt: minutesAgo(1),
    });
    // Ví B đã gửi cho `fresh` — nhưng với ví A thì `fresh` vẫn là LẠ.
    await insertIntent(walletB, {
      amount: 100n,
      status: "settled",
      recipient: fresh,
      createdAt: daysAgo(1),
    });

    expect((await recipientHistory(walletA, known)).settledCount).toBe(2);
    expect((await recipientHistory(walletA, fresh)).settledCount).toBe(0);
  });
});

describe("spendingBaseline — mức thường ngày 30 ngày, chỉ settled", () => {
  testIt(
    "avg/n trên settled trong cửa sổ; lệnh 40 ngày trước và lệnh treo không tính",
    async () => {
      const walletA = await seedWallet("ba");
      const r = randomAddress();
      await insertIntent(walletA, {
        amount: 100n,
        status: "settled",
        recipient: r,
        createdAt: daysAgo(1),
      });
      await insertIntent(walletA, {
        amount: 200n,
        status: "settled",
        recipient: r,
        createdAt: daysAgo(5),
      });
      await insertIntent(walletA, {
        amount: 300n,
        status: "settled",
        recipient: r,
        createdAt: daysAgo(29),
      });
      await insertIntent(walletA, {
        amount: 9000n,
        status: "settled",
        recipient: r,
        createdAt: daysAgo(40),
      });
      await insertIntent(walletA, {
        amount: 9000n,
        status: "awaiting_guardian",
        recipient: r,
        createdAt: daysAgo(2),
      });

      const b = await spendingBaseline(walletA, NOW);
      expect(b.n).toBe(3);
      expect(Number(b.avgAmount)).toBe(200); // (100+200+300)/3
      expect(Number(b.maxAmount)).toBe(300);
    },
  );
});

describe("🔴 negative control — bỏ `wallet_id = $1` là số ví khác trộn vào", () => {
  testIt(
    "CÙNG câu SQL velocity nhưng không lọc ví: đếm được lệnh của ví B → predicate là hàng rào thật",
    async () => {
      const walletA = await seedWallet("na");
      const walletB = await seedWallet("nb");
      const r = randomAddress();
      // Dấu vân tay riêng: số tiền 77777n chỉ tồn tại ở ví B trong ca này.
      await insertIntent(walletA, {
        amount: 1n,
        status: "settled",
        recipient: r,
        createdAt: minutesAgo(5),
      });
      await insertIntent(walletB, {
        amount: 77777n,
        status: "settled",
        recipient: r,
        createdAt: minutesAgo(5),
      });

      const scoped = await velocityLastHour(walletA, NOW);
      expect(scoped.total).toBe(1n); // bản THẬT: chỉ tiền của A

      // Bản BỎ predicate (chỉ tồn tại trong test này để chứng minh):
      const since = new Date(NOW.getTime() - 60 * 60 * 1000);
      const [unscoped] = await db
        .select({ total: sql<string>`coalesce(sum(${transactionIntents.amount}), 0)` })
        .from(transactionIntents)
        .where(
          sql`${transactionIntents.createdAt} > ${since.toISOString()}::timestamptz and ${transactionIntents.status} <> 'cancelled'`,
        );
      // Không còn `wallet_id = $1` → 77777 của ví B (và mọi ví khác đang chạy
      // song song) trộn vào — đây chính là rò rỉ chéo ví mà predicate chặn.
      expect(BigInt(unscoped?.total ?? "0")).toBeGreaterThanOrEqual(1n + 77777n);
    },
  );
});

describe("isActiveGuardianUser — cửa authz đọc tín hiệu", () => {
  testIt("guardian hiệu lực → true; removed → false; guardian ví KHÁC → false", async () => {
    const walletA = await seedWallet("ga");
    const walletB = await seedWallet("gb");
    const userA = `it-sig-guard-a-${crypto.randomUUID().slice(0, 8)}`;
    const userB = `it-sig-guard-b-${crypto.randomUUID().slice(0, 8)}`;
    const userGone = `it-sig-guard-x-${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(guardians).values({ walletId: walletA, userId: userA, status: "active" });
    await db.insert(guardians).values({ walletId: walletB, userId: userB, status: "active" });
    await db.insert(guardians).values({ walletId: walletA, userId: userGone, status: "removed" });

    expect(await isActiveGuardianUser(walletA, userA)).toBe(true);
    expect(await isActiveGuardianUser(walletA, userGone)).toBe(false);
    // Guardian của ví B KHÔNG đọc được tín hiệu ví A — thói quen chi tiêu của
    // một gia đình không phải chuyện của guardian nhà khác.
    expect(await isActiveGuardianUser(walletA, userB)).toBe(false);
    expect(await isActiveGuardianUser(walletB, userA)).toBe(false);
  });
});
