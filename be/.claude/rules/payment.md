---
globs: src/modules/payment/**,src/modules/wallet/**,src/modules/billing/**,src/jobs/charge*/**,src/jobs/payout*/**
description: Payment / wallet patterns. NO Redlock, DB transaction + idempotency required.
---

# Rule: Payment & Wallet

Áp dụng cho mọi code liên quan tiền: payment, wallet, billing, charge, payout, refund.

## Quy tắc số 1: KHÔNG dùng Redlock cho payment

antirez (creator Redis): **"Redlock is for efficiency, not correctness."**

Redlock có thể bị:
- Clock drift giữa các node → lock 2 process cùng lúc tin mình đang giữ.
- Stop-the-world GC pause → process A nghỉ 30s, lock hết hạn, B lấy, A wake up viết tiếp.

→ Payment dùng Redlock có thể **double-charge**. Dùng **DB transaction + idempotency key Postgres**.

## Pattern ĐÚNG cho charge

```ts
// 1. Client gửi idempotency_key qua header (UUID/ULID).
// 2. INSERT row vào bảng `charges` với UNIQUE(idempotency_key).
// 3. PG 23505 → trả result cũ. Otherwise tiến hành charge.

export async function createCharge(args: {
  userId: string;
  amount: number;
  idempotencyKey: string;
}) {
  return await db.transaction(async (tx) => {
    // Check idempotency
    const existing = await tx
      .select()
      .from(charges)
      .where(eq(charges.idempotencyKey, args.idempotencyKey))
      .limit(1);
    if (existing.length > 0) return { charge: existing[0], deduplicated: true };

    // Lock wallet row trong tx (SELECT FOR UPDATE)
    const [wallet] = await tx
      .select().from(wallets)
      .where(eq(wallets.userId, args.userId))
      .for("update");
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    if (wallet.balance < args.amount) throw new Error("INSUFFICIENT_BALANCE");

    // Insert charge + update wallet ATOMICALLY
    const [charge] = await tx.insert(charges).values({
      idempotencyKey: args.idempotencyKey,
      userId: args.userId,
      amount: args.amount,
      status: "succeeded",
    }).returning();

    await tx.update(wallets)
      .set({ balance: wallet.balance - args.amount })
      .where(eq(wallets.id, wallet.id));

    return { charge, deduplicated: false };
  });
}
```

## Bảng MUST có

```ts
// src/db/schema/charges.ts
export const charges = pgTable("charges", {
  id: varchar("id", { length: 26 }).primaryKey().$defaultFn(() => ulid()),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
  userId: varchar("user_id", { length: 26 }).notNull(),
  amount: integer("amount").notNull(),  // CENTS, không phải float
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),  // pending|succeeded|failed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("charges_user_idx").on(t.userId),
  statusIdx: index("charges_status_idx").on(t.status),
}));
```

## Tiền lưu CENTS (integer), KHÔNG float

```ts
// ✅
amount: integer("amount").notNull(),  // 10000 = 100.00 VND

// ❌ — float sai số
amount: real("amount").notNull(),
```

100.10 + 0.20 = 100.29999... ở float. Audit lệch 1 đồng → mất license.

## Audit log

Mọi thay đổi balance MUST có row trong `wallet_transactions`:

```ts
export const walletTransactions = pgTable("wallet_transactions", {
  id: ...,
  walletId: ...,
  delta: integer("delta").notNull(),   // âm = trừ, dương = cộng
  reason: varchar("reason", { length: 32 }).notNull(),  // charge|refund|topup|payout
  refType: varchar("ref_type", { length: 32 }),
  refId: varchar("ref_id", { length: 26 }),  // FK đến charges.id, refunds.id...
  createdAt: ...,
});
```

INSERT row này TRONG cùng transaction với UPDATE wallet.balance.

## Cấm tuyệt đối

- ❌ Redlock cho charge/refund/payout.
- ❌ `wallet.balance` lưu float/real.
- ❌ Update balance ngoài transaction.
- ❌ Update balance không có `wallet_transactions` row.
- ❌ Idempotency key chứa timestamp (`charge:${Date.now()}`) — phải là business id từ client.
- ❌ Throw lỗi trong tx nhưng wallet đã update → Drizzle tự rollback nhưng phải verify.
- ❌ Catch error rồi tiếp tục → silent corruption.

## Khi sửa file ở đây, MUST verify

- [ ] Mọi tiền lưu `integer` (cents).
- [ ] Idempotency key UNIQUE index.
- [ ] Wallet update trong transaction + `SELECT FOR UPDATE`.
- [ ] Wallet transaction log row INSERT cùng transaction.
- [ ] Không có Redlock trong code path.
- [ ] Test double-submit: gọi 2 lần cùng idempotency key → cả 2 trả cùng result, balance trừ 1 lần.
