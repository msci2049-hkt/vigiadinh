// Màn claim thừa kế (PHA 2.3) — dành cho NGƯỜI THỪA KẾ hiểu chu trình + thấy
// đang ở đâu. Dữ liệu thật từ GET /wallet/:id/plan (im lặng bao lâu → guardian
// ĐƯỢC GỢI Ý mở claim; timelock cuối = cửa sổ veto owner; escalation_tier 0..3).
// BẤT BIẾN 2: mở claim là hành động on-chain của guardian — server KHÔNG tự kích
// hoạt; màn này chỉ trình bày, không có nút "bắt đầu thừa kế". Điểm-danh còn mở
// (chưa tới bậc claim) thì có nút "tôi vẫn ổn" reset.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { StatusPill } from "@/components/family/status-pill";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { planKeys, planOptions, sendHeartbeat } from "@/features/family/api/inheritance";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/inheritance/claim")({
  component: InheritanceClaimScreen,
});

const SECS_PER_DAY = 86_400;
const days = (secs: number) => Math.max(1, Math.round(secs / SECS_PER_DAY));

// Bậc leo thang (PHA 4.3): 0 khoẻ · 1 nhắc owner · 2 hỏi người thân · 3 gợi ý claim.
type StatusKey =
  | "inheritance.claimNew.statusHealthy"
  | "inheritance.claimNew.statusReminding"
  | "inheritance.claimNew.statusAsking"
  | "inheritance.claimNew.statusClaimable";

function statusKey(tier: number): StatusKey {
  if (tier >= 3) return "inheritance.claimNew.statusClaimable";
  if (tier === 2) return "inheritance.claimNew.statusAsking";
  if (tier === 1) return "inheritance.claimNew.statusReminding";
  return "inheritance.claimNew.statusHealthy";
}

function InheritanceClaimScreen() {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const plan = useQuery({
    ...planOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });
  const beat = useMutation({
    mutationFn: (walletId: string) => sendHeartbeat(walletId),
    onSuccess: async (_res, walletId) => {
      toast.success(t("inheritance.heartbeatDone"));
      await queryClient.invalidateQueries({ queryKey: planKeys.byWallet(walletId) });
    },
    onError: () => toast.error(t("state.error")),
  });

  const loading = walletLoading || plan.isLoading;
  const data = plan.data ?? null;
  const canReset = data !== null && data.escalationTier < 3;

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("inheritance.claim.title")}
        description={t("inheritance.claimNew.description")}
      />

      {loading ? <LoadingRows /> : null}
      {walletError || plan.isError ? <ErrorState /> : null}
      {!loading && !walletError && wallet === null ? (
        <EmptyState message={t("inheritance.noWallet")} />
      ) : null}
      {plan.isSuccess && data === null && wallet !== null ? (
        <EmptyState message={t("inheritance.claimNew.noPlan")} />
      ) : null}

      {data ? (
        <>
          <Card className="bg-paper-2">
            <CardHeader>
              <CardTitle className="text-lg">{t("inheritance.claimNew.statusTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusPill state={data.escalationTier >= 3 ? "slow" : "active"}>
                {t(statusKey(data.escalationTier))}
              </StatusPill>
            </CardContent>
          </Card>

          <Card className="bg-paper-2">
            <CardHeader>
              <CardTitle className="text-lg">{t("inheritance.claimNew.stagesTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold">
                  1
                </span>
                <p className="text-copy">
                  {t("inheritance.claimNew.stage1", { days: days(data.inactivityPeriodSecs) })}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold">
                  2
                </span>
                <p className="text-copy">
                  {t("inheritance.claimNew.stage2", { days: days(data.finalTimelockSecs) })}
                </p>
              </div>
              <div className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold">
                  3
                </span>
                <p className="text-copy">{t("inheritance.claimNew.stage3")}</p>
              </div>
              <div className="flex items-center justify-between gap-2 border-border border-t pt-3">
                <span className="text-muted-foreground text-sm">
                  {t("inheritance.claimNew.finalWindowLabel")}
                </span>
                <span className="text-right font-medium text-foreground text-sm">
                  {t("inheritance.claimNew.finalWindowValue", {
                    days: days(data.finalTimelockSecs),
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-xs">{t("inheritance.claimNew.guardianNote")}</p>

          {canReset ? (
            <PrimaryZone>
              <Button loading={beat.isPending} onClick={() => wallet && beat.mutate(wallet.id)}>
                <Icon name="heart" />
                {t("inheritance.claimNew.heartbeatCta")}
              </Button>
            </PrimaryZone>
          ) : null}
        </>
      ) : null}

      <Button asChild variant="ghost">
        <Link to="/inheritance">{t("inheritance.claimNew.backCta")}</Link>
      </Button>
    </ProductScreen>
  );
}
