// Khung màn hình FamilyWallet — placeholder đồng nhất chờ spec chi tiết
// (vigiadinh-mockup.html). Mọi chuỗi ĐI QUA i18n key — cấm hardcode (rule code-style).
//
// `cta` tồn tại ngay từ khung vì màn CẢNH BÁO bắt buộc trả lời "tôi bấm gì bây
// giờ" bằng NÚT, không thể nhét vào description (rà ux-writer 2026-07-20).
// Luật veto: màn chặn chỉ MỘT nút nổi bật — `ctaSecondary` phải mờ hơn hẳn.
type ScreenStubProps = {
  title: string;
  description?: string | undefined;
  /** Hành động chính. Chưa nối logic — khung. */
  cta?: string | undefined;
  /** Hành động phụ, cố ý mờ (vd "Vẫn đồng ý"). */
  ctaSecondary?: string | undefined;
  /** Màn cảnh báo: tiêu đề đỏ. */
  tone?: "default" | "alert" | undefined;
};

export function ScreenStub({ title, description, cta, ctaSecondary, tone }: ScreenStubProps) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1
        className={
          tone === "alert"
            ? "font-semibold text-2xl text-destructive"
            : "font-semibold text-2xl text-foreground"
        }
      >
        {title}
      </h1>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      {cta ? (
        <div className="mt-4 flex w-full flex-col gap-2">
          <button
            type="button"
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
          >
            {cta}
          </button>
          {ctaSecondary ? (
            <button type="button" className="w-full px-4 py-2 text-muted-foreground text-xs">
              {ctaSecondary}
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
