import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { type NewNotification, type Notification, notifications } from "./notifications.schema";

const LIST_LIMIT = 100;

export async function listByUser(userId: string): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(LIST_LIMIT);
}

export async function enqueue(data: NewNotification): Promise<Notification> {
  const [row] = await db.insert(notifications).values(data).returning();
  if (!row) throw new Error("NOTIFICATION_CREATE_FAILED");
  return row;
}

// Bản tx-aware cho batch atomic (indexer PHA 4.2): notify phải nằm CÙNG
// transaction với mirror + checkpoint — kill giữa batch thì cả ba cùng rollback.
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function enqueueTx(tx: DbTx, data: NewNotification): Promise<void> {
  await tx.insert(notifications).values(data);
}
