// Các màn kết cục của luồng gửi tiền (WP3 fe-smooth) — tách khỏi send.tsx để
// route chính dưới trần 300 dòng. Tiền tố `-` = TanStack Router bỏ qua file
// này khi sinh route tree (co-located, không phải route).

import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { DetailRow, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import type { PendingSignature } from "@/features/family/api/pending-signature";
import { cancelSend } from "@/features/family/api/send";
import { AiAdvisorCard } from "@/features/family/components/ai-advisor-card";
import { useResumeSigning } from "@/features/family/hooks/use-resume-signing";
import { signWalletEntries } from "@/features/wallet/lib/sign-wallet-entries";
import { explorerTxUrl } from "@/lib/stellar-explorer";
import { PendingSignatureSolo, usePendingSignature } from "./-pending-signature";

export function Shell({ children }: { children: React.ReactNode }) {
  return <ProductScreen className="justify-center">{children}</ProductScreen>;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <DetailRow label={label}>{children}</DetailRow>;
}

/**
 * "Đã gửi" — kết cục THÀNH CÔNG của cả hai đường: gửi thẳng và ký-tiếp sau khi
 * người thân duyệt.
 *
 * `onSendMore` về form nhập SẠCH (reset máy gửi ở tầng route). Trước 30/07 màn
 * này không có nút nào: gửi xong là đứng đó, muốn đi đâu phải bấm back của trình
 * duyệt. Kết cục tốt cũng cần đường ra như kết cục lỗi.
 */
export function SendDoneScreen({
  txHash,
  onSendMore,
}: {
  txHash: string | null;
  onSendMore: () => void;
}) {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-success text-paper">
          <Icon name="checkCircle" size={32} />
        </span>
        <ScreenHeader
          title={t("wallet.send.done.title")}
          description={t("wallet.send.done.description")}
          className="text-center"
        />
        {txHash ? (
          <a
            href={explorerTxUrl(txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center break-all font-mono text-muted-foreground text-xs underline"
          >
            {t("wallet.send.done.txLabel", { hash: `${txHash.slice(0, 8)}…` })}
          </a>
        ) : null}
        <PrimaryZone className="w-full">
          <Button asChild>
            <Link to="/wallet">{t("wallet.send.done.homeCta")}</Link>
          </Button>
          <Button variant="ghost" onClick={onSendMore} data-testid="send-done-again">
            {t("wallet.send.done.againCta")}
          </Button>
        </PrimaryZone>
      </div>
    </Shell>
  );
}

/**
 * Màn chờ người thân duyệt — LÔ 1 A6 thêm nút HUỶ LỆNH: trước đây lệnh vào đây
 * là chủ ví hết đường rút lại, chỉ còn chờ 24h cho sweeper cho hết hạn.
 * Huỷ có bước xác nhận (không phải hộp thoại hệ thống — inline cho mobile).
 *
 * LÔ VÁ L2 (2026-07-30): màn này từng là NGÕ CỤT THẬT. Người thân duyệt xong,
 * BE mở khoá ký, chủ ví nhận toast "đã duyệt" — mà màn vẫn đứng nguyên chữ "đang
 * chờ", vì nó không poll, không nghe SSE và không có nút nào ngoài "huỷ". Giờ nó
 * tự hỏi danh sách chờ ký: lệnh của mình xuất hiện ở đó = đã duyệt xong → đổi
 * hẳn sang khối "Ký ngay". Hai lưới: SSE `intent.approved` invalidate cây
 * ["family"], và poll 10s phòng khi SSE chết (đã từng chết cả kênh).
 *
 * VÁ TIẾP (cùng ngày, sau test tay): ký xong TIỀN ĐI THẬT mà màn nhảy về "đang
 * chờ người thân" — sai trắng trợn. Cơ chế: màn này chọn nhánh theo `ready`, tức
 * theo việc lệnh CÒN trong `/pending-signature`; ký thành công thì BE thôi trả
 * lệnh đó, và cú invalidate ngay sau khi ký (use-resume-signing.ts) tự tay kéo
 * `ready` về undefined → rơi xuống nhánh cuối = màn chờ. Máy ký vì thế phải sống
 * Ở ĐÂY (không trong component con phụ thuộc `ready`), và `settled` phải được xét
 * TRƯỚC `ready`.
 */
export function SendGuardianWaitScreen({
  intentId,
  onCancelled,
  onSendMore,
}: {
  intentId: string | null;
  onCancelled: () => void;
  /** Về form nhập sạch — dùng cho nút "gửi tiếp" của màn "Đã gửi". */
  onSendMore: () => void;
}) {
  const { t } = useTranslation("fw");
  const [confirming, setConfirming] = useState(false);
  const pending = usePendingSignature({ poll: true });
  const signing = useResumeSigning({ signEntries: signWalletEntries });
  const ready = intentId ? pending.data?.find((i) => i.intent_id === intentId) : undefined;

  // Bản chụp lệnh đang ký: lỗi ký (hay lệnh vừa hết hạn) cũng làm nó rời danh
  // sách, và khi đó màn PHẢI nói ra chuyện gì đã xảy ra thay vì âm thầm quay về
  // "đang chờ người thân" — đúng cái bẫy vừa vá ở nhánh thành công.
  const lastReady = useRef<PendingSignature | null>(null);
  useEffect(() => {
    if (ready) lastReady.current = ready;
  }, [ready]);
  const signingThis = signing.activeIntentId !== null && signing.activeIntentId === intentId;
  const item = ready ?? (signingThis ? lastReady.current : null);

  const cancel = useMutation({
    mutationFn: () => {
      if (!intentId) throw new Error("NO_INTENT");
      return cancelSend(intentId);
    },
    onSuccess: onCancelled,
  });

  // ĐÃ GỬI — xét TRƯỚC `ready`, vì `ready` biến mất ngay khi ký xong. Đây là màn
  // kết cục dùng chung với luồng gửi thẳng, có mã giao dịch + đường ra.
  if (signingThis && signing.phase === "settled") {
    return <SendDoneScreen txHash={signing.txHash} onSendMore={onSendMore} />;
  }

  // ĐÃ DUYỆT — không còn "đang chờ" nữa, và tuyệt đối không còn nút huỷ ở đây:
  // người dùng vừa được người thân đồng ý, thứ họ cần là đường đi tiếp.
  if (item) {
    return (
      <Shell>
        <div className="flex w-full flex-col gap-4">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-success text-paper">
            <Icon name="checkCircle" size={32} />
          </span>
          <ScreenHeader
            title={t("wallet.send.guardian.approvedTitle")}
            description={t("wallet.send.guardian.approvedDescription")}
            className="text-center"
          />
          <PendingSignatureSolo item={item} signing={signing} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col items-center gap-4 text-center">
        <ProductImage
          src="/assets/characters/family-guide-wait.png"
          webpSrc="/assets/characters/family-guide-wait.webp"
          alt=""
          width={640}
          height={640}
          className="h-44 w-44 object-contain"
        />
        <ScreenHeader
          title={t("wallet.send.guardian.title")}
          description={t("wallet.send.guardian.description")}
          className="text-center"
        />
        {/* Lô R2/R3 §5.4 — chủ ví CHỈ thấy khối tín hiệu khi lệnh phải chờ
            người thân (màn này chính là trạng thái đó; component còn tự gác
            thêm requiresGuardian). Dưới ngưỡng thì không có màn này, không
            cảnh báo — tránh mệt mỏi cảnh báo. Chủ ví vẫn còn nút huỷ ngay dưới. */}
        {intentId ? <AiAdvisorCard intentId={intentId} audience="owner" /> : null}
        {cancel.isError ? (
          <ErrorBanner type="error" title={t("wallet.send.guardian.cancelFailed")} />
        ) : null}
        {intentId ? (
          confirming ? (
            <div className="flex w-full flex-col gap-2 rounded-card border border-dashed bg-card p-4">
              <p className="text-muted-foreground text-sm">
                {t("wallet.send.guardian.confirmBody")}
              </p>
              <Button
                variant="destructive"
                loading={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {t("wallet.send.guardian.confirmYes")}
              </Button>
              <Button
                variant="ghost"
                disabled={cancel.isPending}
                onClick={() => setConfirming(false)}
              >
                {t("wallet.send.guardian.confirmNo")}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {t("wallet.send.guardian.cancelCta")}
            </Button>
          )
        ) : null}
      </div>
    </Shell>
  );
}

/**
 * Mạng đứt SAU khi nộp — tiền có thể đã đi. KHÔNG có nút gửi lại ở đây, theo
 * thiết kế: gửi lại lúc này là đường mất tiền hai lần (QA mục 8).
 */
export function SendUnconfirmedScreen({ pollExhausted }: { pollExhausted: boolean }) {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex flex-col gap-5" role="alert">
        <ScreenHeader title={t("wallet.send.unconfirmed.title")} />
        <ErrorBanner type="warn" title={t("wallet.send.unconfirmed.title")}>
          {t("wallet.send.unconfirmed.body")}
        </ErrorBanner>
        {pollExhausted ? (
          <>
            <p className="product-copy">{t("wallet.send.unconfirmed.stillUnknown")}</p>
            <PrimaryZone>
              <Button asChild>
                <Link to="/wallet/history">{t("wallet.send.unconfirmed.historyCta")}</Link>
              </Button>
            </PrimaryZone>
          </>
        ) : (
          <ErrorBanner type="pending" title={t("wallet.send.unconfirmed.checking")} />
        )}
      </div>
    </Shell>
  );
}
