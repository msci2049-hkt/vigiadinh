import type { ReactNode } from "react";

type StatusState = "active" | "slow" | "offline" | "pending";

export function StatusPill({ state, children }: { state: StatusState; children: ReactNode }) {
  return (
    <span className="fw-status-pill" data-state={state}>
      {children}
    </span>
  );
}
