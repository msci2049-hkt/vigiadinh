// Vòng "Thêm tất cả" — TUẦN TỰ, lỗi cục bộ: một người hỏng thì ghi kết quả
// của NGƯỜI ĐÓ rồi đi tiếp, không dừng loạt, không gom giao dịch (mỗi người
// một chữ ký passkey). Tách thuần để test không cần router/passkey thật.

export type SequentialResult<E> = Record<string, "ok" | E>;

export async function runSequential<T extends { id: string }, E>({
  targets,
  runOne,
  errorOf,
  onStep,
}: {
  targets: T[];
  runOne: (target: T) => Promise<void>;
  /** Đổi lỗi ném ra thành giá trị kết quả của DÒNG đó (vd i18n key đúng nguyên nhân). */
  errorOf: (err: unknown) => E;
  /** Gọi sau TỪNG người (kể cả người lỗi) — chỗ cho invalidate/vẽ tiến độ. */
  onStep: (target: T, result: "ok" | E, results: SequentialResult<E>) => void | Promise<void>;
}): Promise<SequentialResult<E>> {
  const results: SequentialResult<E> = {};
  for (const target of targets) {
    let result: "ok" | E;
    try {
      await runOne(target);
      result = "ok";
    } catch (err) {
      result = errorOf(err);
    }
    results[target.id] = result;
    await onStep(target, result, { ...results });
  }
  return results;
}
