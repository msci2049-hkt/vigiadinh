// WHY: migration 0009 tạo role NHÓM `app_runtime` (NOLOGIN — migration nằm trong
// git nên KHÔNG được chứa mật khẩu). Nhóm đó mang đúng bộ quyền, nhưng app không
// đăng nhập bằng nó được. Thiếu bước này thì `DATABASE_URL` vẫn trỏ role OWNER, và
// toàn bộ tầng REVOKE của 0009 là TRANG TRÍ: owner `DROP TRIGGER` rồi `TRUNCATE`
// audit_log trong hai câu lệnh (audit 2026-07-25 §1.1 — đo thật, can_truncate=true).
//
// Script này đóng khoảng cách đó: tạo role ĐĂNG NHẬP thật (user+pass lấy từ chính
// `DATABASE_URL`) rồi `GRANT app_runtime`. Chạy bằng `DATABASE_URL_OWNER`.
//
// Idempotent: chạy lại chỉ đồng bộ lại mật khẩu + grant, không lỗi.
import postgres from "postgres";

export type RoleSpec = { user: string; password: string; database: string };

/** Tách user/pass/db từ connection string. Ném lỗi rõ khi thiếu — sai ở đây mà
 * đi tiếp thì tạo ra role không đăng nhập được, phát hiện ở tận lúc app boot. */
export function parseRoleSpec(url: string): RoleSpec {
  const u = new URL(url);
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!user) throw new Error("DATABASE_URL thiếu username — không biết tạo role nào");
  if (!password) throw new Error("DATABASE_URL thiếu password — role LOGIN phải có mật khẩu");
  if (!database) throw new Error("DATABASE_URL thiếu tên database");
  return { user, password, database };
}

/** Bất biến: role runtime PHẢI khác role owner. Bằng nhau nghĩa là app vẫn chạy
 * bằng owner — đúng lỗ mà script này sinh ra để vá, nên chặn thẳng thay vì cấp
 * quyền rồi báo "xong". */
export function assertNotOwner(runtime: RoleSpec, ownerUrl: string): void {
  const owner = decodeURIComponent(new URL(ownerUrl).username);
  if (runtime.user === owner) {
    throw new Error(
      `DATABASE_URL và DATABASE_URL_OWNER cùng dùng role "${owner}". ` +
        "Role runtime phải KHÁC owner, nếu không tầng REVOKE của migration 0009 vô hiệu.",
    );
  }
}

async function main(): Promise<void> {
  const ownerUrl = process.env.DATABASE_URL_OWNER;
  const runtimeUrl = process.env.DATABASE_URL;
  if (!ownerUrl) {
    console.error("[provision] ❌ DATABASE_URL_OWNER is required (role sở hữu bảng).");
    process.exit(1);
  }
  if (!runtimeUrl) {
    console.error("[provision] ❌ DATABASE_URL is required (role runtime cần tạo).");
    process.exit(1);
  }

  let spec: RoleSpec;
  try {
    spec = parseRoleSpec(runtimeUrl);
    assertNotOwner(spec, ownerUrl);
  } catch (err) {
    console.error("[provision] ❌", (err as Error).message);
    process.exit(1);
  }

  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const [grp] = await sql`SELECT 1 AS ok FROM pg_roles WHERE rolname = 'app_runtime'`;
    if (!grp) {
      console.error(
        "[provision] ❌ role app_runtime chưa tồn tại — chạy `bun run db:migrate` (0009) trước.",
      );
      process.exit(1);
    }

    // Identifier KHÔNG tham số hoá được trong Postgres → phải nội suy. An toàn ở
    // đây vì tên role đến từ env của người vận hành, không từ request; vẫn chặn
    // ký tự lạ để không có đường chèn SQL kể cả khi env bị đặt bậy.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(spec.user)) {
      throw new Error(`Tên role không hợp lệ: ${spec.user}`);
    }
    const ident = sql(spec.user);

    const [exists] = await sql`SELECT 1 AS ok FROM pg_roles WHERE rolname = ${spec.user}`;
    if (exists) {
      await sql`ALTER ROLE ${ident} WITH LOGIN PASSWORD ${sql.unsafe(literal(spec.password))}`;
      console.log(`[provision] role ${spec.user} đã có — đồng bộ lại mật khẩu.`);
    } else {
      await sql`CREATE ROLE ${ident} WITH LOGIN PASSWORD ${sql.unsafe(literal(spec.password))}`;
      console.log(`[provision] ✅ tạo role ${spec.user}.`);
    }

    await sql`GRANT app_runtime TO ${ident}`;
    await sql`GRANT CONNECT ON DATABASE ${sql(spec.database)} TO ${ident}`;

    // Chứng minh bằng chính Postgres, không bằng niềm tin: role mới KHÔNG được
    // phép xoá/sửa nhật ký. In ra để bước deploy có bằng chứng đọc được.
    const [priv] = await sql`
      SELECT has_table_privilege(${spec.user}, 'audit_log', 'TRUNCATE') AS truncate,
             has_table_privilege(${spec.user}, 'audit_log', 'DELETE')   AS delete,
             has_table_privilege(${spec.user}, 'audit_log', 'UPDATE')   AS update,
             has_table_privilege(${spec.user}, 'audit_log', 'INSERT')   AS insert,
             (SELECT rolsuper FROM pg_roles WHERE rolname = ${spec.user}) AS superuser`;
    console.log(
      `[provision] audit_log — truncate=${priv?.truncate} delete=${priv?.delete} ` +
        `update=${priv?.update} insert=${priv?.insert} superuser=${priv?.superuser}`,
    );
    if (priv?.truncate || priv?.delete || priv?.update || priv?.superuser) {
      console.error("[provision] ❌ role runtime VẪN xoá/sửa được audit_log — 0009 chưa ăn.");
      process.exit(1);
    }
    if (!priv?.insert) {
      console.error("[provision] ❌ role runtime KHÔNG ghi được audit_log — app sẽ gãy.");
      process.exit(1);
    }
    console.log("[provision] ✅ role runtime đúng quyền: ghi được nhật ký, không xoá được.");
  } catch (err) {
    console.error("[provision] ❌ FAILED:", (err as Error).message);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

/** Mật khẩu là literal chuỗi trong CREATE/ALTER ROLE — không bind param được. */
function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

if (import.meta.main) {
  await main();
}
