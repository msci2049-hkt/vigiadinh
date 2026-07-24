// Trạng thái chờ/lỗi/rỗng dùng chung cho các màn đọc (PHA 6) — một chỗ,
// mọi chuỗi qua i18n key do màn truyền vào.
import { Skeleton } from "@repo/ui";
import { useTranslation } from "react-i18next";

export function LoadingRows() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

export function ErrorState() {
  const { t } = useTranslation("fw");
  return <p className="text-destructive text-sm">{t("state.error")}</p>;
}

/** message = chuỗi ĐÃ dịch từ màn gọi (t("...") tại callsite — giữ type-safe key). */
export function EmptyState({ message }: { message: string }) {
  return <p className="text-muted-foreground text-sm">{message}</p>;
}
