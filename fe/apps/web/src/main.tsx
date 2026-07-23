// Sentry PHẢI import đầu tiên — init trước mọi module để bắt cả lỗi lúc boot.
import "@/instrument";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/app/provider";
import "@/index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <AppProvider />
  </StrictMode>,
);
