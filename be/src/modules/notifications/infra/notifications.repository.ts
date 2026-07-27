import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { type NewNotification, type Notification, notifications } from "./notifications.schema";

const LIST_LIMIT = 100;

/**
 * Audit 2026-07-25 (§6.5) — LỌC TRONG SQL, không lọc sau LIMIT.
 *
 * Bản cũ: repo trả 100 dòng mới nhất rồi handler mới `.filter(status)`. Hệ quả là
 * `?status=unread` trả MẢNG RỖNG khi 100 thông báo mới nhất đều đã đọc, dù còn
 * thông báo chưa đọc ở vị trí 101 trở đi. Không phải chậm — SAI, và sai im lặng:
 * người dùng thấy "không có gì mới" trong khi có.
 */
export async function listByUser(
  userId: string,
  status?: string,
  limit = LIST_LIMIT,
): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(
      status
        ? and(eq(notifications.userId, userId), eq(notifications.status, status))
        : eq(notifications.userId, userId),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
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
