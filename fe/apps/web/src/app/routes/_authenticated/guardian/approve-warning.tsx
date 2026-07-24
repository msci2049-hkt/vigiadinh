// Cảnh báo THEO QUY TẮC trước khi duyệt khôi phục (PHA 2.4) — speed-bump chống
// social-engineering. Đọc yêu cầu từ cache hộp thư guardian (cùng queryOptions —
// không gọi lại mạng), chạy rule THUẦN (recovery-warnings.ts — KHÔNG phải AI),
// hiện các cảnh báo đã kích + nhãn RÕ "theo quy tắc, không phải AI". Luật 6:
// cảnh báo chỉ nhắc, KHÔNG chặn — vẫn có nút sang màn duyệt thật.
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { guardianInboxOptions } from "@/features/family/api/guardian-inbox";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { evaluateRecoveryWarnings } from "@/features/family/lib/recovery-warnings";

export const Route = createFileRoute("/_authenticated/guardian/approve-warning")({
  validateSearch: z.object({ wallet: z.string().catch("") }),
  component: GuardianApproveWarningScreen,
});

function GuardianApproveWarningScreen() {
  const { t } = useTranslation("fw");
  const { wallet } = Route.useSearch();
  const inbox = useQuery(guardianInboxOptions);

  const item = (inbox.data ?? []).find((i) => i.wallet.id === wallet) ?? null;
  const warnings = item ? evaluateRecoveryWarnings(item.request) : [];

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-destructive">
        {t("guardian.approveWarning.title")}
      </h1>
      <p className="text-muted-foreground text-sm">{t("guardian.approveWarning.description")}</p>

      {inbox.isLoading ? <LoadingRows /> : null}
      {inbox.isError ? <ErrorState /> : null}
      {inbox.isSuccess && item === null ? <EmptyState message={t("guardian.inbox.empty")} /> : null}

      {item ? (
        <>
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="font-medium text-foreground text-sm">
                {t("guardian.approveWarning.rulesLabel")}
              </p>
              <ul className="flex flex-col gap-2">
                {warnings.map((key) => (
                  <li key={key} className="flex gap-2 text-foreground text-sm">
                    <span aria-hidden className="text-destructive">
                      •
                    </span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                {t("guardian.approveWarning.rulesNote")}
              </p>
            </CardContent>
          </Card>

          <div className="mt-2 flex flex-col gap-2">
            {/* Nút cẩn trọng đứng TRƯỚC (mặc định người bảo hộ nên gọi điện). */}
            <Button asChild variant="ghost">
              <Link to="/guardian">{t("guardian.approveWarning.backCta")}</Link>
            </Button>
            <Button asChild variant="destructive">
              <Link to="/guardian/approve" search={{ wallet }}>
                {t("guardian.approveWarning.approveCta")}
              </Link>
            </Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
