// Test trần đồng thời + các race: timeout vs release, wake clear-timer, queue
// đầy, bất biến active ≤ maxConcurrent. Dùng timeout NGẮN thật (không fake timer).
import { describe, expect, it } from "bun:test";
import { Semaphore } from "./semaphore";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("Semaphore", () => {
  it("acquire tới max → resolve ngay; vượt → vào queue", async () => {
    const s = new Semaphore({ maxConcurrent: 2, maxQueue: 4, acquireTimeoutMs: 1000 });
    await s.acquire();
    await s.acquire();
    expect(s.active).toBe(2);
    expect(s.queued).toBe(0);
    const pending = s.acquire(); // active=max → queue
    expect(s.active).toBe(2);
    expect(s.queued).toBe(1);
    s.release(); // wake pending
    await pending;
    expect(s.active).toBe(2);
    expect(s.queued).toBe(0);
  });

  it("release khi KHÔNG waiter → giảm active đúng 1 slot", async () => {
    const s = new Semaphore({ maxConcurrent: 2, maxQueue: 4, acquireTimeoutMs: 1000 });
    await s.acquire();
    await s.acquire();
    expect(s.active).toBe(2);
    s.release();
    expect(s.active).toBe(1);
    s.release();
    expect(s.active).toBe(0);
    s.release(); // thừa → không âm
    expect(s.active).toBe(0);
  });

  it("queue đầy → reject HASH_QUEUE_FULL NGAY (load-shed)", async () => {
    const s = new Semaphore({ maxConcurrent: 1, maxQueue: 1, acquireTimeoutMs: 1000 });
    await s.acquire(); // active 1
    const w1 = s.acquire(); // queue đầy tới maxQueue=1
    expect(s.queued).toBe(1);
    await expect(s.acquire()).rejects.toThrow("HASH_QUEUE_FULL"); // vượt → reject ngay
    s.release(); // dọn: nhả cho w1
    await w1;
  });

  it("chờ quá hạn → reject HASH_ACQUIRE_TIMEOUT + rời queue", async () => {
    const s = new Semaphore({ maxConcurrent: 1, maxQueue: 5, acquireTimeoutMs: 30 });
    await s.acquire();
    const w = s.acquire();
    await expect(w).rejects.toThrow("HASH_ACQUIRE_TIMEOUT");
    expect(s.queued).toBe(0); // đã splice khỏi queue
    expect(s.active).toBe(1); // slot A vẫn giữ, không bị waiter timeout đụng
  });

  it("RACE: waiter timeout rồi mới release → slot về waiter LIVE, KHÔNG hồi waiter chết", async () => {
    const s = new Semaphore({ maxConcurrent: 1, maxQueue: 5, acquireTimeoutMs: 30 });
    await s.acquire(); // A giữ slot
    const dead = s.acquire(); // sẽ timeout
    await expect(dead).rejects.toThrow("HASH_ACQUIRE_TIMEOUT");
    expect(s.queued).toBe(0);
    expect(s.active).toBe(1);
    const live = s.acquire(); // waiter mới, còn sống
    expect(s.queued).toBe(1);
    s.release(); // A xong → phải trao cho `live`, không phải `dead`
    await live;
    expect(s.active).toBe(1);
    expect(s.queued).toBe(0);
  });

  it("release đánh thức waiter → CLEAR timer, không reject muộn", async () => {
    const s = new Semaphore({ maxConcurrent: 1, maxQueue: 5, acquireTimeoutMs: 40 });
    await s.acquire();
    let state = "pending";
    const w = s.acquire().then(
      () => {
        state = "resolved";
      },
      () => {
        state = "rejected";
      },
    );
    await sleep(10);
    s.release(); // wake sớm, trước timeout 40ms → clear timer
    await w;
    expect(state).toBe("resolved");
    await sleep(60); // qua mốc timeout cũ → KHÔNG được reject muộn
    expect(state).toBe("resolved");
    expect(s.active).toBe(1); // waiter đang giữ slot
  });

  it("bất biến: active KHÔNG BAO GIỜ > maxConcurrent qua chuỗi churn", async () => {
    const max = 3;
    const s = new Semaphore({ maxConcurrent: max, maxQueue: 10, acquireTimeoutMs: 1000 });
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 6; i++) ps.push(s.acquire());
    expect(s.active).toBe(max); // 3 chạy
    expect(s.queued).toBe(3); // 3 chờ
    expect(s.active).toBeLessThanOrEqual(max);
    // release dần: 3 lần đầu wake waiter (active giữ nguyên 3), 3 lần sau giảm dần.
    for (let i = 0; i < 6; i++) {
      s.release();
      await Promise.resolve();
      expect(s.active).toBeLessThanOrEqual(max);
    }
    await Promise.all(ps);
    expect(s.active).toBe(0);
    expect(s.queued).toBe(0);
  });

  it("constructor reject tham số sai (fail-fast)", () => {
    expect(() => new Semaphore({ maxConcurrent: 0, maxQueue: 4, acquireTimeoutMs: 100 })).toThrow();
    expect(
      () => new Semaphore({ maxConcurrent: 2, maxQueue: -1, acquireTimeoutMs: 100 }),
    ).toThrow();
    expect(() => new Semaphore({ maxConcurrent: 2, maxQueue: 4, acquireTimeoutMs: 0 })).toThrow();
    expect(
      () => new Semaphore({ maxConcurrent: 1.5, maxQueue: 4, acquireTimeoutMs: 100 }),
    ).toThrow();
  });
});
