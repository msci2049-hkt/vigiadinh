import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { HealthBadge } from "./health-badge";

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("HealthBadge", () => {
  it("shows the checking state on initial render", () => {
    renderWithClient(<HealthBadge />);
    expect(screen.getByText(/đang kiểm tra/i)).toBeInTheDocument();
  });
});
