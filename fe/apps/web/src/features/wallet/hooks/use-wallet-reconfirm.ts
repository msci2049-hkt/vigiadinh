// Lô R5 §4 — state máy "xin lại phiên ví" cho màn ký: idle → busy → exhausted.
// exhausted là MỘT CHIỀU (trừ khi người dùng tự huỷ hộp thoại passkey → về idle,
// họ chưa dùng lượt nào) — nút chỉ hiện ở idle nên không bao giờ lặp xin phiên.
// Hook nằm trong features/wallet vì kéo connectAndLogin (kit) — screens (tầng
// app) gọi; phần thuần đếm-một-lần nằm ở @/lib/session-reconfirm (có test).
import { useCallback, useRef, useState } from "react";
import { runSessionReconfirm } from "@/lib/session-reconfirm";
import { connectAndLogin } from "../api/sep45-login";

export type ReconfirmPhase = "idle" | "busy" | "exhausted";

export function useWalletReconfirm(): {
  phase: ReconfirmPhase;
  start: (retry: () => void) => void;
} {
  const [phase, setPhase] = useState<ReconfirmPhase>("idle");
  const startedRef = useRef(false);

  const start = useCallback((retry: () => void) => {
    if (startedRef.current) return; // đúng MỘT lượt cho mỗi màn ký
    startedRef.current = true;
    setPhase("busy");
    void runSessionReconfirm({ login: connectAndLogin, retry }).then((outcome) => {
      if (outcome === "cancelled") {
        startedRef.current = false; // tự huỷ hộp thoại — chưa dùng lượt
        setPhase("idle");
        return;
      }
      setPhase("exhausted");
    });
  }, []);

  return { phase, start };
}
