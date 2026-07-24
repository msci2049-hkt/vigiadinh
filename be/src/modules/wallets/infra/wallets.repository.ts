// WHY: DB query shared trong module. Pure data layer — không đụng req/res.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { WALLET_ERRORS } from "../domain/errors";
import { type NewWallet, type Wallet, wallets } from "./wallets.schema";

const LIST_LIMIT = 50;

// LIMIT ở TẦNG SQL, không fetch-hết-rồi-slice (security review P1-4).
export async function listByUser(userId: string, limit = LIST_LIMIT): Promise<Wallet[]> {
  return db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .orderBy(desc(wallets.createdAt))
    .limit(limit);
}

export async function findByIdForUser(id: string, userId: string): Promise<Wallet | null> {
  const [row] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function insert(data: NewWallet): Promise<Wallet> {
  const [row] = await db.insert(wallets).values(data).returning();
  if (!row) throw new Error(WALLET_ERRORS.CREATE_FAILED);
  return row;
}

export async function findByAddress(stellarAddress: string): Promise<Wallet | null> {
  const [row] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.stellarAddress, stellarAddress))
    .limit(1);
  return row ?? null;
}
