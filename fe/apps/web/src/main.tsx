// Sentry PHẢI import đầu tiên — init trước mọi module để bắt cả lỗi lúc boot.
import "@/instrument";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/app/provider";
import { restoreWalletSession } from "@/features/wallet/lib/wallet-token";
import "@/index.css";

// Phiên ví SEP-45 (Bearer) — nối lại header trước khi UI render, để query đầu
// tiên của màn ví không bị 401 oan khi JWT còn hạn.
restoreWalletSession();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppProvider />
  </StrictMode>,
);
