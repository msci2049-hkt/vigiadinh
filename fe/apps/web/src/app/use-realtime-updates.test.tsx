// LÔ 3 — sự kiện domain qua SSE phải: (1) invalidate cây ["family"] để màn
// đang mở tự refetch, (2) toast tiếng người, (3) rác/parse hỏng thì im lặng
// bỏ qua (không crash cả vỏ), (4) reconnect thì refetch-bù (at-most-once).

import type { ServerEvent, UseServerEventsOptions } from "@repo/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { useRealtimeUpdates } from "./use-realtime-updates";

let captured: UseServerEventsOptions | null = null;
vi.mock("@/lib/sse", () => ({
  useServerEvents: (options: UseServerEventsOptions) => {
    captured = options;
  },
}));

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastSpy }));

function Host() {
  useRealtimeUpdates();
  return null;
}

function renderHost(): QueryClient {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  render(<Host />, { wrapper });
  return queryClient;
}

function emit(event: ServerEvent): void {
  if (!captured?.onEvent) throw new Error("useServerEvents chưa được mount");
  captured.onEvent(event);
}

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

beforeEach(() => {
  captured = null;
  toastSpy.mockClear();
});

describe("useRealtimeUpdates", () => {
  it("guardian.accepted → invalidate ['family'] + toast tiếng người có tên", () => {
    const queryClient = renderHost();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    emit({
      event: "domain",
      data: JSON.stringify({ type: "guardian.accepted", label: "Anh ba" }),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["family"] });
    expect(toastSpy).toHaveBeenCalledWith("Anh ba vừa nhận lời làm người bảo hộ cho ví của bạn.");
  });

  it("intent.awaiting_approval → invalidate + toast không cần label", () => {
    const queryClient = renderHost();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    emit({ event: "domain", data: JSON.stringify({ type: "intent.awaiting_approval" }) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["family"] });
    expect(toastSpy).toHaveBeenCalledWith("Có một khoản chuyển đang chờ bạn duyệt.");
  });

  it("R5: recovery.closed → invalidate ['family'] (thẻ guardian tự biến mất) + toast tin tốt", () => {
    const queryClient = renderHost();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    emit({ event: "domain", data: JSON.stringify({ type: "recovery.closed" }) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["family"] });
    expect(toastSpy).toHaveBeenCalledWith("Chủ ví đã vào lại được ví. Yêu cầu khôi phục đã đóng.");
  });

  it("rác — type lạ hoặc JSON hỏng → bỏ qua, không invalidate, không toast", () => {
    const queryClient = renderHost();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    emit({ event: "domain", data: JSON.stringify({ type: "hacker.injected" }) });
    emit({ event: "domain", data: "{khong-phai-json" });
    expect(invalidate).not.toHaveBeenCalled();
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("reconnect → refetch-bù cây ['family'] (SSE at-most-once)", () => {
    const queryClient = renderHost();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    captured?.onReconnect?.();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["family"] });
  });

  it("chuỗi toast render sạch — không {{ }} và không placeholder thô", () => {
    renderHost();
    emit({
      event: "domain",
      data: JSON.stringify({ type: "guardian.added", label: "Mẹ" }),
    });
    const text = String(toastSpy.mock.calls[0]?.[0] ?? "");
    expect(text).not.toMatch(/\{\{|\}\}|\{name\}/);
    expect(text).toContain("Mẹ");
  });
});
