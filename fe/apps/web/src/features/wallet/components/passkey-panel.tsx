// Màn passkey — luồng THẬT đầu tiên của ví: tạo passkey (WebAuthn) → dựng smart
// account → đăng nhập SEP-45 → giữ JWT Bearer. LƯU Ý PHA 2.3: createWallet mới
// TẠO passkey + build tx deploy (chưa submit) — deploy on-chain + tài trợ phí
// là việc PHA 5; đăng nhập với BE thật chỉ xanh khi ví đã tồn tại trên mạng.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { connectAndLogin } from "../api/sep45-login";
import { WalletNotConfiguredError } from "../lib/kit";

type PanelState =
  | { status: "idle" | "working" }
  | { status: "done"; contractId: string }
  | { status: "error"; code: "generic" | "notConfigured" | "cancelled" };

function toErrorState(err: unknown): PanelState {
  if (err instanceof WalletNotConfiguredError) return { status: "error", code: "notConfigured" };
  // Người dùng đóng hộp thoại WebAuthn — trình duyệt ném NotAllowedError.
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return { status: "error", code: "cancelled" };
  }
  return { status: "error", code: "generic" };
}

export function PasskeyPanel() {
  const { t } = useTranslation("fw");
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const busy = state.status === "working";

  async function run(flow: () => Promise<{ contractId: string }>) {
    setState({ status: "working" });
    try {
      const { contractId } = await flow();
      setState({ status: "done", contractId });
    } catch (err) {
      setState(toErrorState(err));
    }
  }

  // Đăng nhập = connect passkey vào ví ĐÃ deploy rồi SEP-45. TẠO ví là luồng
  // deploy thật (kit.createWallet autoSubmit + mirror BE) → đi qua /setup, KHÔNG
  // làm ở đây: ký SEP-45 cần ví đã tồn tại on-chain (kit đọc signer từ chain).
  const handleSignIn = () => run(connectAndLogin);

  return (
    <div className="mt-4 flex w-full flex-col gap-2">
      <button
        type="button"
        data-testid="passkey-signin"
        disabled={busy}
        onClick={handleSignIn}
        className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
      >
        {t("passkey.signInCta")}
      </button>
      <Link
        to="/setup"
        data-testid="passkey-create"
        className="w-full rounded-md border border-border px-4 py-2 text-center font-medium text-foreground text-sm"
      >
        {t("passkey.createCta")}
      </Link>
      <p
        data-testid="passkey-status"
        aria-live="polite"
        className="min-h-5 text-muted-foreground text-xs"
      >
        {state.status === "working" ? t("passkey.working") : null}
        {state.status === "done"
          ? t("passkey.connected", { wallet: `${state.contractId.slice(0, 8)}…` })
          : null}
        {state.status === "error"
          ? t(
              state.code === "notConfigured"
                ? "passkey.errorNotConfigured"
                : state.code === "cancelled"
                  ? "passkey.errorCancelled"
                  : "passkey.errorGeneric",
            )
          : null}
      </p>
    </div>
  );
}
