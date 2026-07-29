// Màn passkey — cửa đăng nhập THẬT bằng vân tay (lô passkey-là-chìa-khoá 29/07):
// connect passkey → SEP-45 → JWT ví → ĐỔI LẤY SESSION APP → vào thẳng /wallet.
// Trước lô này màn dừng ở "ví đã mở" (dead-end): JWT ví có nhưng cổng
// `_authenticated` đòi session email — giờ exchange cấp session của CHỦ VÍ nên
// đăng nhập xong là ĐI, không đứng lại.
//
// "Dùng khoá khác": ép ceremony WebAuthn (fresh) để trình duyệt liệt kê passkey —
// người có nhiều ví (hoặc máy dùng chung) chọn đúng chìa. Không có nút này thì
// connectWallet tự nối vào phiên IndexedDB ĐÃ LƯU và khoá khác không có đường vào.
import { sessionQueryKey } from "@repo/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { SessionExchangeError } from "../api/sep45-exchange";
import { connectAndLogin, connectFreshAndLogin } from "../api/sep45-login";
import { WalletNotConfiguredError } from "../lib/kit";

type ErrorCode =
  | "generic"
  | "notConfigured"
  | "cancelled"
  | "walletUnknown"
  | "belongsToOther"
  | "revoked";

type PanelState =
  | { status: "idle" | "working" }
  | { status: "error"; code: ErrorCode; maskedEmail?: string | undefined };

function toErrorState(err: unknown): PanelState {
  if (err instanceof WalletNotConfiguredError) return { status: "error", code: "notConfigured" };
  // Người dùng đóng hộp thoại WebAuthn — trình duyệt ném NotAllowedError.
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return { status: "error", code: "cancelled" };
  }
  // Cửa đổi session từ chối — mỗi mã một câu riêng (vì sao · bảo vệ gì · làm gì).
  if (err instanceof SessionExchangeError && err.code !== "generic") {
    return { status: "error", code: err.code, maskedEmail: err.maskedEmail };
  }
  return { status: "error", code: "generic" };
}

/** Key i18n theo mã lỗi — MỘT chỗ, banner lẫn dòng đọc-màn-hình dùng chung. */
function errorKey(code: ErrorCode) {
  return code === "notConfigured"
    ? ("passkey.errorNotConfigured" as const)
    : code === "cancelled"
      ? ("passkey.errorCancelled" as const)
      : code === "walletUnknown"
        ? ("passkey.errorWalletUnknown" as const)
        : code === "belongsToOther"
          ? ("passkey.errorBelongsToOther" as const)
          : code === "revoked"
            ? ("passkey.errorRevoked" as const)
            : ("passkey.errorGeneric" as const);
}

export function PasskeyPanel() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const busy = state.status === "working";

  async function run(flow: () => Promise<{ contractId: string }>) {
    setState({ status: "working" });
    try {
      await flow();
      // Session vừa được cấp bằng passkey — xoá cache session để guard
      // `_authenticated` đọc phiên MỚI thay vì tin bản "chưa đăng nhập" cũ.
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      await navigate({ to: "/wallet" });
    } catch (err) {
      setState(toErrorState(err));
    }
  }

  return (
    <PrimaryZone>
      <Button
        type="button"
        data-testid="passkey-signin"
        disabled={busy}
        loading={busy}
        loadingLabel={t("passkey.working")}
        onClick={() => void run(connectAndLogin)}
        className="w-full"
      >
        <Icon name="fingerprint" size={32} />
        {t("passkey.signInCta")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        data-testid="passkey-fresh"
        disabled={busy}
        onClick={() => void run(connectFreshAndLogin)}
        className="w-full"
      >
        {t("passkey.useAnotherKeyCta")}
      </Button>
      <Button asChild variant="link">
        <Link to="/recovery" data-testid="passkey-create">
          {t("passkey.recoveryCta")}
        </Link>
      </Button>
      <p data-testid="passkey-status" aria-live="polite" className="sr-only">
        {state.status === "working" ? t("passkey.working") : null}
        {state.status === "error"
          ? t(errorKey(state.code), { email: state.maskedEmail ?? "" })
          : null}
      </p>
      {state.status === "error" ? (
        <ErrorBanner type="warn" title={t("passkey.tryAgainTitle")}>
          {t(errorKey(state.code), { email: state.maskedEmail ?? "" })}
        </ErrorBanner>
      ) : null}
    </PrimaryZone>
  );
}
