// 🔴 Bằng chứng trực tiếp cho vá 30/07 (SSE đứt mỗi ~10s): stream IM LẶNG hơn
// 30 giây vẫn sống khi handler gọi `server.timeout(req, 0)`; route KHÔNG gọi
// thì Bun giết ở giây ~10 (idleTimeout mặc định) — ca đối chứng chứng minh lớp
// bảo vệ của route thường KHÔNG bị tắt lây.
//
// Hermetic có chủ đích: Bun.serve thật + Hono thật + đồng hồ thật, KHÔNG import
// app (không cần DB/Dragonfly). Chi phí ~31s (3 ca chạy song song) — cái giá
// của việc chứng minh bằng đồng hồ thay vì niềm tin; đừng "tối ưu" bằng cách
// mock thời gian, mock là mất luôn thứ test này tồn tại để đo.
import { afterAll, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { getBunServer } from "hono/bun";
import { streamSSE } from "hono/streaming";

const SILENCE_MS = 31_000;

/** Cùng type cấu trúc với routes.ts — bun-types đổi generic của Server giữa các bản. */
type BunServerLike = { timeout: (request: Request, seconds: number) => void };

const app = new Hono()
  // Giống realtime/routes.ts sau vá: tắt idle timeout cho riêng stream.
  .get("/fixed", (c) => {
    getBunServer<BunServerLike>(c)?.timeout(c.req.raw, 0);
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "connected", data: "" });
      await stream.sleep(SILENCE_MS);
      await stream.writeSSE({ event: "alive", data: "" });
    });
  })
  // Đối chứng: không tắt — idleTimeout mặc định 10s của Bun phải còn nguyên.
  .get("/control", (c) =>
    streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "connected", data: "" });
      await stream.sleep(SILENCE_MS);
      await stream.writeSSE({ event: "alive", data: "" });
    }),
  )
  // Nhịp heartbeat (bản thu nhỏ của HEARTBEAT_MS): ping đều, client nhận đủ.
  .get("/ping", (c) => {
    getBunServer<BunServerLike>(c)?.timeout(c.req.raw, 0);
    return streamSSE(c, async (stream) => {
      for (let i = 0; i < 3; i += 1) {
        await stream.writeSSE({ event: "ping", data: String(i) });
        await stream.sleep(2_000);
      }
    });
  });

// port 0 = OS cấp port rảnh — không giẫm stack dev đang chạy.
const server = Bun.serve({ port: 0, fetch: app.fetch });
afterAll(() => server.stop(true));

/** Đọc trọn stream (tới khi server đóng hoặc Bun giết), đo sống bao lâu. */
async function drain(path: string): Promise<{ body: string; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`http://localhost:${server.port}${path}`);
  const body = await res.text().catch(() => "");
  return { body, ms: Date.now() - t0 };
}

describe("SSE vs Bun idleTimeout — timeout(req, 0) cho riêng stream (vá 30/07)", () => {
  it("fixed: im lặng 31s vẫn sống · control: bị giết ~10s (không tắt lây) · ping: đủ nhịp", async () => {
    const [fixed, control, ping] = await Promise.all([
      drain("/fixed"),
      drain("/control"),
      drain("/ping"),
    ]);
    // 🔴 Ca chứng minh: sống qua 31 giây không một byte nào, nhận được event cuối.
    expect(fixed.body).toContain("event: alive");
    expect(fixed.ms).toBeGreaterThan(30_000);
    // Đối chứng: route thường vẫn được Bun bảo vệ — chết TRƯỚC khi tới "alive".
    expect(control.body).not.toContain("event: alive");
    expect(control.ms).toBeLessThan(20_000);
    // Heartbeat tới đúng chu kỳ.
    expect(ping.body.split("event: ping").length - 1).toBe(3);
  }, 45_000);
});
