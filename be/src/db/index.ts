// WHY: 1 instance Drizzle dùng toàn hệ thống. `prepare: false` vì postgres-js
// cache prepared statement per-connection — với pool transient, cache miss
// cao, lại tốn memory. Drizzle gen dynamic query → không tận dụng được.
//
// `idle_timeout: 30` (giây): release connection nhàn rỗi để Postgres không
// nuôi quá nhiều idle session (Postgres default `max_connections=100`).
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

// Export `client` để graceful shutdown gọi client.end({ timeout }).
export const client = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,
  idle_timeout: 30,
  prepare: false,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
