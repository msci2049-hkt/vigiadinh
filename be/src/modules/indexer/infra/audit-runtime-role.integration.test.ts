// B-SEC-4 (đóng nốt) — quyền ở tầng ROLE, chạy BẰNG ROLE RUNTIME.
//
// Vì sao cần file riêng thay vì thêm ca vào audit-append-only.integration.test.ts:
// file đó connect qua `@/db`, tức bằng role SỞ HỮU bảng. Nó chứng minh trigger bắn,
// nhưng KHÔNG chứng minh gì về quyền — chủ sở hữu `DROP TRIGGER` xong `TRUNCATE`
// được, và superuser thì bypass sạch mọi GRANT/REVOKE. Nói cách khác: test cũ xanh
// kể cả khi migration 0009 chưa tồn tại.
//
// File này mở MỘT connection RIÊNG bằng role runtime (thành viên `app_runtime`,
// KHÔNG sở hữu bảng, KHÔNG superuser) rồi thử đúng bốn việc mà kịch bản đỏ #2 cần:
// TRUNCATE · DELETE · DROP TRIGGER · và INSERT nghiệp vụ (phải VẪN chạy).
import { afterAll, describe, expect, it } from "bun:test";
import postgres from "postgres";
import { ulid } from "ulid";
import { client } from "@/db";
import { env } from "@/env";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";

const dbUp = await pgReachable();

// Role thật phải do OWNER tạo — và từ audit 2026-07-25 §1.1, `client` (@/db) KHÔNG
// còn là owner nữa, nên setup phải đi bằng connection riêng qua DATABASE_URL_OWNER.
// Đây chính là bằng chứng gián tiếp rằng việc tách role đã sống: trước khi tách,
// `client` tạo role được vì nó là superuser.
const ownerUrl = process.env.DATABASE_URL_OWNER;
const owner = dbUp && ownerUrl ? postgres(ownerUrl, { max: 1, prepare: false }) : null;

const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const roleName = `fw_rt_${suffix}`;
const rolePass = crypto.randomUUID().replace(/-/g, "");

let ready = false;
let setupError = "";
if (dbUp && owner) {
  try {
    // `app_runtime` do migration 0009 tạo — không có nó thì migration chưa chạy.
    const [grp] = await owner`SELECT 1 AS ok FROM pg_roles WHERE rolname = 'app_runtime'`;
    if (!grp) throw new Error("role app_runtime chưa tồn tại — chạy bun run db:migrate (0009)");
    await owner.unsafe(`CREATE ROLE ${roleName} LOGIN PASSWORD '${rolePass}'`);
    await owner.unsafe(`GRANT app_runtime TO ${roleName}`);
    ready = true;
  } catch (err) {
    setupError = (err as Error).message;
  }
} else if (dbUp && !ownerUrl) {
  setupError = "DATABASE_URL_OWNER chưa đặt — không có role owner để dựng role thử nghiệm";
}

const testIt = dbUp && ready ? it : it.skip;
// Khối §1.1 soi thẳng connection của app — KHÔNG cần dựng role nào, nên nó chạy
// kể cả khi không có DATABASE_URL_OWNER. Buộc nó phụ thuộc `ready` là tự bịt mắt:
// môi trường thiếu quyền tạo role chính là môi trường ta cần câu trả lời nhất.
const testItApp = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);
else if (!ready) console.warn(`[skip] không dựng được role runtime: ${setupError}`);

/** Connection RIÊNG bằng role runtime — đây là điểm khác biệt của cả file này. */
const runtimeUrl = (): string => {
  const u = new URL(env.DATABASE_URL);
  u.username = roleName;
  u.password = rolePass;
  return u.toString();
};
const runtime = ready ? postgres(runtimeUrl(), { max: 1, prepare: false }) : null;

afterAll(async () => {
  await runtime?.end({ timeout: 5 });
  if (ready && owner) {
    // Gỡ role: phải thu quyền trước, nếu không Postgres chối DROP vì còn phụ thuộc.
    try {
      await owner.unsafe(`REVOKE app_runtime FROM ${roleName}`);
      await owner.unsafe(`DROP ROLE IF EXISTS ${roleName}`);
    } catch {
      // Dọn dẹp thất bại không được làm đỏ kết quả bảo mật ở trên.
    }
  }
  await owner?.end({ timeout: 5 });
});

/** Mã lỗi PG (42501 = insufficient_privilege) đi qua chuỗi cause của postgres-js. */
const codeOf = (err: unknown): string | undefined => {
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur; i++) {
    const c = (cur as { code?: unknown }).code;
    if (typeof c === "string") return c;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// §1.1 (audit 2026-07-25) — CÁI NÀY mới là điều đáng sợ. Khối dưới chứng minh
// tầng REVOKE hoạt động trên MỘT role tổng hợp do test tự dựng. Nó đúng, nhưng nó
// KHÔNG nói gì về role mà production thực sự dùng. Phiên trước dừng ở đúng chỗ đó
// và khai "đã đóng", trong khi `DATABASE_URL` vẫn là `app` — owner VÀ superuser —
// nên `can_truncate = true` trên production. Cả migration 0009 là trang trí.
//
// Khối này soi thẳng vào `client` của `@/db`: đúng connection mọi handler đang
// dùng. Không dựng gì, không mock gì. Đỏ trên .env cũ (owner), xanh sau khi tách.
describe("§1.1 — connection THẬT của app (DATABASE_URL) không được là owner", () => {
  testItApp("app KHÔNG nối bằng superuser", async () => {
    const [who] = await client`SELECT current_user AS u,
                                      (SELECT rolsuper FROM pg_roles
                                        WHERE rolname = current_user) AS super`;
    // Superuser bypass sạch mọi GRANT/REVOKE/RLS. Nối bằng nó nghĩa là mọi tầng
    // quyền trong repo này là chữ trên giấy.
    expect(who?.super).toBe(false);
  });

  testItApp("app KHÔNG sở hữu audit_log (owner thì DROP TRIGGER được)", async () => {
    const [row] = await client`SELECT tableowner FROM pg_tables WHERE tablename = 'audit_log'`;
    const [me] = await client`SELECT current_user AS u`;
    // Postgres gắn quyền DDL với QUYỀN SỞ HỮU: owner gỡ trigger append-only trong
    // một câu lệnh rồi TRUNCATE trong câu tiếp theo. Không GRANT nào chặn được.
    expect(row?.tableowner).not.toBe(me?.u);
  });

  testItApp("app KHÔNG có TRUNCATE/DELETE/UPDATE trên audit_log", async () => {
    const [priv] = await client`
      SELECT has_table_privilege(current_user, 'audit_log', 'TRUNCATE') AS can_truncate,
             has_table_privilege(current_user, 'audit_log', 'DELETE')   AS can_delete,
             has_table_privilege(current_user, 'audit_log', 'UPDATE')   AS can_update,
             has_table_privilege(current_user, 'audit_log', 'INSERT')   AS can_insert`;
    expect(priv?.can_truncate).toBe(false);
    expect(priv?.can_delete).toBe(false);
    expect(priv?.can_update).toBe(false);
    // Và đường ghi nhật ký vẫn phải sống — vá chết nó thì mất luôn audit trail.
    expect(priv?.can_insert).toBe(true);
  });

  testItApp("app KHÔNG chạy được DDL (không tạo bảng trong public)", async () => {
    let code: string | undefined;
    try {
      await client.unsafe(`CREATE TABLE fw_app_ddl_probe_${suffix} (id int)`);
      await client.unsafe(`DROP TABLE fw_app_ddl_probe_${suffix}`);
      throw new Error("app KHÔNG được phép CREATE TABLE nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    expect(code).toBe("42501");
  });
});

describe("audit_log — quyền tầng role (connection BẰNG role runtime tổng hợp)", () => {
  testIt("role runtime KHÔNG phải owner và KHÔNG superuser", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    const [who] = await rt`SELECT current_user AS u, usesuper AS super
                             FROM pg_user WHERE usename = current_user`;
    expect(who?.u).toBe(roleName);
    // Nếu dòng này đỏ thì mọi assert dưới VÔ NGHĨA — superuser bypass hết GRANT.
    expect(who?.super).toBe(false);

    const [owner] = await rt`SELECT tableowner FROM pg_tables WHERE tablename = 'audit_log'`;
    expect(owner?.tableowner).not.toBe(roleName);
  });

  testIt("INSERT + SELECT nghiệp vụ VẪN chạy (đường ghi không bị vá chết)", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    const walletId = `it-role-${crypto.randomUUID().slice(0, 8)}`;
    // `id` là ULID sinh ở tầng app (`$defaultFn`), KHÔNG có DEFAULT trong DB — SQL
    // thô phải tự cấp, nếu không là 23502 và ta lại đọc sai thành "thiếu quyền".
    const rows = await rt`
      INSERT INTO audit_log (id, wallet_id, kind, actor_type, payload)
      VALUES (${ulid()}, ${walletId}, 'test.runtime-role', 'system', ${rt.json({ probe: true })})
      RETURNING id`;
    expect(rows).toHaveLength(1);
    const seen = await rt`SELECT id FROM audit_log WHERE wallet_id = ${walletId}`;
    expect(seen).toHaveLength(1);
  });

  testIt("TRUNCATE audit_log → thiếu quyền (42501), không phải nhờ trigger", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    let code: string | undefined;
    try {
      await rt.unsafe("TRUNCATE audit_log");
      throw new Error("TRUNCATE PHẢI bị chặn nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    // 42501 = quyền bị REVOKE. Đây là điểm khác trigger: trigger chặn SAU khi đã
    // được phép chạy câu lệnh; REVOKE chặn TRƯỚC đó, nên không có `DROP TRIGGER`
    // nào cứu được kẻ tấn công.
    expect(code).toBe("42501");
  });

  testIt("DELETE FROM audit_log → thiếu quyền (42501)", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    let code: string | undefined;
    try {
      await rt.unsafe("DELETE FROM audit_log WHERE true");
      throw new Error("DELETE PHẢI bị chặn nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    expect(code).toBe("42501");
  });

  testIt("UPDATE audit_log → thiếu quyền (42501)", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    let code: string | undefined;
    try {
      await rt.unsafe("UPDATE audit_log SET kind = 'tampered'");
      throw new Error("UPDATE PHẢI bị chặn nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    expect(code).toBe("42501");
  });

  testIt("DROP TRIGGER audit_log_no_truncate → thiếu quyền (đường gỡ chốt bị khoá)", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    let code: string | undefined;
    try {
      await rt.unsafe("DROP TRIGGER audit_log_no_truncate ON audit_log");
      throw new Error("DROP TRIGGER PHẢI bị chặn nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    // Đây là câu hỏi trung tâm của B-SEC-4: kẻ chiếm được connection runtime có gỡ
    // được chốt append-only không. 42501 = không.
    expect(code).toBe("42501");
    // Và trigger vẫn còn đó — đọc catalog được bằng chính connection runtime.
    const [trg] = await rt`SELECT tgname FROM pg_trigger
                             WHERE tgname = 'audit_log_no_truncate'`;
    expect(trg?.tgname).toBe("audit_log_no_truncate");
  });

  testIt("role runtime KHÔNG tạo được bảng trong public (không có DDL)", async () => {
    const rt = runtime;
    if (!rt) throw new Error("runtime connection chưa dựng");
    let code: string | undefined;
    try {
      await rt.unsafe(`CREATE TABLE fw_ddl_probe_${suffix} (id int)`);
      await rt.unsafe(`DROP TABLE fw_ddl_probe_${suffix}`);
      throw new Error("CREATE TABLE PHẢI bị chặn nhưng đã chạy qua");
    } catch (err) {
      code = codeOf(err);
    }
    expect(code).toBe("42501");
  });
});
