// WHY: Trần đồng thời (concurrency cap) cho tác vụ CPU-nặng — ở đây là scrypt
// hash login. Khác rate-limit per-IP: đây là trần TOÀN CỤC mỗi process, chặn
// self-DoS khi credential-stuffing phân tán (nhiều IP lách qua rate-limit) bơm
// hash làm saturate CPU. Hết slot + hết hàng đợi → reject để caller trả 503,
// KHÔNG treo vô hạn (acquire luôn có timeout).
//
// Slot-transfer model: acquire chiếm 1 slot; release "chuyển" slot cho waiter
// kế (active không đổi) hoặc nhả slot (active--). Bất biến: active ≤ maxConcurrent.
// Mỗi acquire THÀNH CÔNG phải có đúng 1 release tương ứng (caller lo, vd finally).

export type SemaphoreOptions = {
  maxConcurrent: number; // số tác vụ chạy đồng thời tối đa
  maxQueue: number; // số waiter chờ tối đa; vượt → reject ngay (load-shed)
  acquireTimeoutMs: number; // chờ slot quá hạn → reject (ACQUIRE_TIMEOUT)
};

type Waiter = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  settled: boolean;
};

export class Semaphore {
  readonly #max: number;
  readonly #maxQueue: number;
  readonly #timeoutMs: number;
  #active = 0;
  #queue: Waiter[] = [];

  constructor(opts: SemaphoreOptions) {
    if (!Number.isInteger(opts.maxConcurrent) || opts.maxConcurrent < 1) {
      throw new Error("Semaphore: maxConcurrent must be a positive integer");
    }
    if (!Number.isInteger(opts.maxQueue) || opts.maxQueue < 0) {
      throw new Error("Semaphore: maxQueue must be a non-negative integer");
    }
    if (!Number.isInteger(opts.acquireTimeoutMs) || opts.acquireTimeoutMs < 1) {
      throw new Error("Semaphore: acquireTimeoutMs must be a positive integer");
    }
    this.#max = opts.maxConcurrent;
    this.#maxQueue = opts.maxQueue;
    this.#timeoutMs = opts.acquireTimeoutMs;
  }

  /** Trần đồng thời (maxConcurrent) — để observ/test mà không hardcode. */
  get capacity(): number {
    return this.#max;
  }

  /** Số slot đang giữ (để observ/test). Không bao giờ vượt maxConcurrent. */
  get active(): number {
    return this.#active;
  }

  /** Số waiter LIVE đang chờ (đã trừ waiter timeout). */
  get queued(): number {
    return this.#queue.length;
  }

  /**
   * Chiếm 1 slot. Còn slot → resolve ngay. Hết slot:
   * - hàng đợi đầy → reject HASH_QUEUE_FULL ngay (load-shed).
   * - còn chỗ chờ → chờ tới khi có slot hoặc reject HASH_ACQUIRE_TIMEOUT.
   */
  acquire(): Promise<void> {
    if (this.#active < this.#max) {
      this.#active++;
      return Promise.resolve();
    }
    if (this.#queue.length >= this.#maxQueue) {
      return Promise.reject(new Error("HASH_QUEUE_FULL"));
    }
    return new Promise<void>((resolve, reject) => {
      // forward-declare waiter: timer callback tham chiếu nó (gán xong trước khi
      // timer có thể fire vì setTimeout là macrotask).
      let waiter: Waiter;
      const timer = setTimeout(() => {
        if (waiter.settled) return;
        waiter.settled = true;
        const idx = this.#queue.indexOf(waiter);
        if (idx >= 0) this.#queue.splice(idx, 1); // giữ queued chính xác
        reject(new Error("HASH_ACQUIRE_TIMEOUT"));
      }, this.#timeoutMs);
      // unref: timer không giữ process sống khi shutdown (Bun/Node).
      (timer as unknown as { unref?: () => void }).unref?.();
      waiter = { resolve, reject, settled: false, timer };
      this.#queue.push(waiter);
    });
  }

  /** Nhả 1 slot: chuyển cho waiter LIVE kế, hoặc giảm active nếu không ai chờ. */
  release(): void {
    while (this.#queue.length > 0) {
      const next = this.#queue.shift();
      if (!next || next.settled) continue; // bỏ qua waiter đã timeout (phòng hờ)
      next.settled = true;
      clearTimeout(next.timer); // chống reject muộn sau khi đã wake
      next.resolve(); // chuyển slot: active KHÔNG đổi
      return;
    }
    if (this.#active > 0) this.#active--;
  }
}
