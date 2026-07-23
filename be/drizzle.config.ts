// WHY: schema trỏ vào file re-export (`src/db/schema/index.ts`) — KHÔNG dùng
// glob để drizzle-kit deterministic về import order. `strict: true` buộc xác
// nhận trước khi DROP COLUMN (rule db-schema.md: workflow 3 release).
//
// Import env qua relative path — drizzle-kit CLI không setup TS path resolver
// (`@/env` fail).
import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL },
  strict: true,
  verbose: true,
});
