// Trạng thái TỪNG người bảo hộ — điểm khác cốt lõi so với spec "gom một lần".
//
// Wizard hoàn tất được kể cả khi còn người đang chờ; ai xong đến đâu hiện đến
// đó. Người đã tạo danh tính (`deployed`) thì chủ ví ký thêm họ vào ví bằng MỘT
// giao dịch riêng — một người chậm không treo cả nhà.
//
// Việc KÝ không nằm ở đây: nó thuộc feature `wallet`, và feature không import
// feature. Route ở tầng app/ ghép hai bên lại và truyền xuống `onAdd`.
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useTranslation } from "react-i18next";
import type { GuardianInvite } from "../api/invites";

export function InviteStatusList({
  invites,
  onAdd,
  pending,
  failed,
}: {
  invites: GuardianInvite[];
  onAdd: (invite: GuardianInvite) => void;
  pending: boolean;
  failed: boolean;
}) {
  const { t } = useTranslation("fw");

  if (invites.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("guardians.inviteList.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between gap-3 border-border border-b pb-2 last:border-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{invite.label}</p>
              <p className="text-muted-foreground text-xs">
                {t(`guardians.inviteList.status.${invite.status}`)}
              </p>
            </div>
            {invite.status === "deployed" ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onAdd(invite)}
                data-testid={`add-guardian-${invite.id}`}
              >
                {pending ? t("guardians.inviteList.adding") : t("guardians.inviteList.addCta")}
              </Button>
            ) : null}
          </div>
        ))}
        {failed ? (
          <p className="text-destructive text-sm" role="alert">
            {t("guardians.inviteList.addFailed")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
