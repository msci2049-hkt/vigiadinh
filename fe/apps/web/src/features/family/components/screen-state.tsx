// Trạng thái chờ/lỗi/rỗng dùng chung cho các màn đọc (PHA 6) — một chỗ,
// mọi chuỗi qua i18n key do màn truyền vào.
import { Link, type LinkProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { Button, Skeleton } from "@/components/family/ui";

export function LoadingRows() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
    </div>
  );
}

export function ErrorState() {
  const { t } = useTranslation("fw");
  return <ErrorBanner type="warn" title={t("state.error")} />;
}

/**
 * message = chuỗi ĐÃ dịch từ màn gọi (t("...") tại callsite — giữ type-safe key).
 * cta OPTIONAL — màn rỗng mà không có lối đi là dead-end (bug M2: "Chưa có
 * người thân nào" không kèm nút mời). Không truyền = giữ nguyên như cũ.
 */
export function EmptyState({
  message,
  cta,
}: {
  message: string;
  cta?: { label: string; to: NonNullable<LinkProps["to"]> };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed bg-paper-2 p-6 text-center">
      <Icon name="users" size={32} className="text-muted-foreground" />
      <p className="text-copy">{message}</p>
      {cta ? (
        <Button asChild>
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
