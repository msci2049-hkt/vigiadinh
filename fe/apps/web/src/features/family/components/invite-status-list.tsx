// Trạng thái TỪNG người bảo hộ — điểm khác cốt lõi so với spec "gom một lần".
//
// Wizard hoàn tất được kể cả khi còn người đang chờ; ai xong đến đâu hiện đến
// đó. Người đã tạo danh tính (`deployed`) thì chủ ví ký thêm họ vào ví bằng MỘT
// giao dịch riêng — một người chậm không treo cả nhà.
//
// Việc KÝ không nằm ở đây: nó thuộc feature `wallet`, và feature không import
// feature. Route ở tầng app/ ghép hai bên lại và truyền xuống `onAdd`.
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { StatusPill } from "@/components/family/status-pill";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
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
