// Trạng thái TỪNG người bảo hộ — điểm khác cốt lõi so với spec "gom một lần".
//
// Wizard hoàn tất được kể cả khi còn người đang chờ; ai xong đến đâu hiện đến
// đó. Người đã tạo danh tính (`deployed`) thì chủ ví ký thêm họ vào ví bằng MỘT
// giao dịch riêng — một người chậm không treo cả nhà.
//
// Việc KÝ không nằm ở đây: nó thuộc feature `wallet`, và feature không import
// feature. Route ở tầng app/ ghép hai bên lại và truyền xuống `onAdd`.
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { StatusPill } from "@/components/family/status-pill";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import type { GuardianInvite } from "../api/invites";

/** Ba câu lỗi của "Thêm vào ví" — literal union để i18next kiểm key lúc compile. */
export type AddGuardianErrorKey =
  | "guardians.inviteList.addFailed"
  | "guardians.inviteList.addFailedAlready"
  | "guardians.inviteList.addFailedSelf";

export function InviteStatusList({
  invites,
  onAdd,
  pending,
  errorKey,
}: {
  invites: GuardianInvite[];
  onAdd: (invite: GuardianInvite) => void;
  pending: boolean;
  /** i18n key của câu lỗi ĐÚNG NGUYÊN NHÂN (null = không lỗi) — một câu chung
   * cho mọi nguyên nhân là bug 28/07, người dùng không biết phải làm gì. */
  errorKey: AddGuardianErrorKey | null;
}) {
  const { t } = useTranslation("fw");

  if (invites.length === 0) return null;

  // Danh tính đã được thêm rồi → các dòng khác mang CÙNG địa chỉ không được
  // hiện nút "Thêm vào ví" nữa: bấm được rồi mới báo lỗi là bẫy.
  const addedKeys = new Set(
    invites
      .filter((i) => i.status === "registered" && i.guardian_address)
      .map((i) => i.guardian_address),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("guardians.inviteList.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between gap-3 border-border border-b py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary">
                <Icon name="users" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{invite.label}</p>
                <StatusPill state={invite.status === "registered" ? "active" : "pending"}>
                  {t(`guardians.inviteList.status.${invite.status}`)}
                </StatusPill>
              </div>
            </div>
            {invite.status === "deployed" ? (
              invite.guardian_address && addedKeys.has(invite.guardian_address) ? (
                <p
                  className="shrink-0 text-muted-foreground text-xs"
                  data-testid={`already-guardian-${invite.id}`}
                >
                  {t("guardians.inviteList.alreadyAdded")}
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={() => onAdd(invite)}
                  data-testid={`add-guardian-${invite.id}`}
                >
                  {pending ? t("guardians.inviteList.adding") : t("guardians.inviteList.addCta")}
                </Button>
              )
            ) : null}
          </div>
        ))}
        {errorKey ? (
          <p className="text-destructive text-sm" role="alert">
            {t(errorKey)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
