// Trạng thái TỪNG người bảo hộ — điểm khác cốt lõi so với spec "gom một lần".
//
// Wizard hoàn tất được kể cả khi còn người đang chờ; ai xong đến đâu hiện đến
// đó. Người đã tạo danh tính (`deployed`) thì chủ ví ký thêm họ vào ví bằng MỘT
// giao dịch riêng — một người chậm không treo cả nhà. Có ≥2 người `deployed`
// thì hiện thêm "Thêm tất cả": chạy TUẦN TỰ từng người (mỗi người một chữ ký),
// một người lỗi thì báo NGAY TRÊN DÒNG đó và đi tiếp, không dừng cả loạt.
//
// Việc KÝ không nằm ở đây: nó thuộc feature `wallet`, và feature không import
// feature. Route ở tầng app/ ghép hai bên lại và truyền xuống `onAdd`/`onAddAll`.
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

/** Tiến trình "Thêm tất cả" — route giữ state, component chỉ vẽ. */
export type AddAllProgress = {
  running: boolean;
  /** Invite đang xử lý (highlight dòng). */
  currentId: string | null;
  /** Kết quả từng dòng: "ok" hoặc key câu lỗi ĐÚNG NGUYÊN NHÂN của dòng đó. */
  results: Record<string, "ok" | AddGuardianErrorKey>;
};

export function InviteStatusList({
  invites,
  onAdd,
  onAddAll,
  pending,
  errorKey,
  addAll,
}: {
  invites: GuardianInvite[];
  onAdd: (invite: GuardianInvite) => void;
  /** Chạy tuần tự mọi invite đang thêm được — route quyết định thứ tự/logic. */
  onAddAll: (invites: GuardianInvite[]) => void;
  pending: boolean;
  /** i18n key của câu lỗi ĐÚNG NGUYÊN NHÂN (null = không lỗi) — một câu chung
   * cho mọi nguyên nhân là bug 28/07, người dùng không biết phải làm gì. */
  errorKey: AddGuardianErrorKey | null;
  addAll: AddAllProgress;
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
  const addable = invites.filter(
    (i) => i.status === "deployed" && !(i.guardian_address && addedKeys.has(i.guardian_address)),
  );
  const busy = pending || addAll.running;
  const doneCount = Object.keys(addAll.results).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{t("guardians.inviteList.title")}</CardTitle>
        {addable.length >= 2 ? (
          <Button
            size="sm"
            variant="secondary"
            loading={addAll.running}
            disabled={busy}
            onClick={() => onAddAll(addable)}
            data-testid="add-all-guardians"
          >
            {addAll.running
              ? t("guardians.inviteList.addAllProgress", {
                  done: doneCount,
                  total: addable.length,
                })
              : t("guardians.inviteList.addAllCta", { count: addable.length })}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invites.map((invite) => {
          const rowResult = addAll.results[invite.id];
          return (
            <div
              key={invite.id}
              className="flex flex-col gap-1 border-border border-b py-3 first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-3">
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
                      loading={pending || addAll.currentId === invite.id}
                      disabled={busy}
                      onClick={() => onAdd(invite)}
                      data-testid={`add-guardian-${invite.id}`}
                    >
                      {pending || addAll.currentId === invite.id
                        ? t("guardians.inviteList.adding")
                        : t("guardians.inviteList.addCta")}
                    </Button>
                  )
                ) : null}
              </div>
              {/* Lỗi CỦA DÒNG NÀY — một người hỏng không kéo cả loạt xuống. */}
              {rowResult && rowResult !== "ok" ? (
                <p
                  className="text-destructive text-xs"
                  role="alert"
                  data-testid={`add-all-error-${invite.id}`}
                >
                  {t(rowResult)}
                </p>
              ) : null}
            </div>
          );
        })}
        {errorKey ? (
          <p className="text-destructive text-sm" role="alert">
            {t(errorKey)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
