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
