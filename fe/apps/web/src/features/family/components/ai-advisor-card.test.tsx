// Lô R3 — khoá hai điều ở tầng FE:
// 1. AI KHÔNG PHẢI CỔNG: /explain trả null → khối AI biến mất, khối SỐ THÔ
//    đứng thay (đường rơi thật, không phải placeholder), không bao giờ cả hai.
// 2. Nút loa: ẩn khi không có speechSynthesis; bấm là đọc TOÀN BỘ text —
//    kể cả câu miễn trừ BE đã nối ở cuối.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import type { IntentSignals } from "../api/intent-signals";
import { AiAdvisorCard, AiExplainBlock } from "./ai-advisor-card";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from "@/lib/api-client";

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

afterEach(() => {
  vi.unstubAllGlobals();
  mockedGet.mockReset();
  mockedPost.mockReset();
});

const AI_TEXT =
  "Số tiền lần này là 670 XLM, gấp 3 lần mức ví thường gửi. " +
  "Đây là trợ lý AI, chỉ để tham khảo. Quyết định là của bạn.";

const signals = (over: Partial<IntentSignals> = {}): IntentSignals => ({
  amount: "6700000000",
  recipient: "CAEDGA447G2JCTFPN2YNEGPGTCBMXYHCS324IOVC3A35KD7UNUZOQHBY",
  ratioToAvg: 3,
  recipientSettledCount: 0,
  txCountLastHour: 3,
  totalLastHour: "13200000000",
  policyOutcome: "awaiting_guardian",
  requiresGuardian: true,
  ...over,
});

function installSynth() {
  const synth = {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => [{ lang: "vi-VN", name: "vi" }]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  return synth;
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AiExplainBlock — nút loa + dòng dẫn theo khán giả", () => {
  it("🔴 không có speechSynthesis → KHÔNG render nút loa (đừng để nút bấm không kêu)", () => {
    render(<AiExplainBlock text={AI_TEXT} audience="guardian" />);
    expect(screen.queryByTestId("ai-speak")).toBeNull();
    expect(screen.getByTestId("ai-advisor")).toHaveTextContent("AI bảo vệ");
  });

  it("🔴 bấm loa → cancel rồi speak TOÀN BỘ khối: dòng dẫn + câu AI + câu miễn trừ", async () => {
    const synth = installSynth();
    render(<AiExplainBlock text={AI_TEXT} audience="guardian" />);
    await userEvent.click(screen.getByTestId("ai-speak"));
    expect(synth.cancel).toHaveBeenCalled();
    const utterance = synth.speak.mock.calls[0]?.[0] as { text: string };
    expect(utterance.text).toBe(`Tiền đi rồi không lấy lại được. ${AI_TEXT}`);
    expect(utterance.text).toContain("Đây là trợ lý AI, chỉ để tham khảo.");
  });

  it("chủ ví: dòng dẫn là 'cần người thân xác nhận', không phải câu dọa mất tiền", () => {
    render(<AiExplainBlock text={AI_TEXT} audience="owner" />);
    const block = screen.getByTestId("ai-advisor");
    expect(block).toHaveTextContent("Lệnh này sẽ cần một người thân xác nhận.");
    expect(block).not.toHaveTextContent("không lấy lại được");
  });
});

describe("AiAdvisorCard — AI không phải cổng", () => {
  it("🔴 /explain trả null → khối AI ẨN, khối SỐ THÔ hiện đầy đủ (fail-safe)", async () => {
    mockedGet.mockResolvedValue({ data: signals() });
    mockedPost.mockResolvedValue({ data: { text: null } });
    renderWithQuery(<AiAdvisorCard intentId="01TEST00000000000000INTENT" audience="guardian" />);
    await waitFor(() => expect(screen.getByTestId("intent-signals")).toBeInTheDocument());
    expect(screen.queryByTestId("ai-advisor")).toBeNull();
    expect(screen.getByTestId("intent-signals")).toHaveTextContent("Gấp 3,0 lần");
  });

  it("có text → khối AI THAY khối thô, không hiện cả hai", async () => {
    mockedGet.mockResolvedValue({ data: signals() });
    mockedPost.mockResolvedValue({ data: { text: AI_TEXT } });
    renderWithQuery(<AiAdvisorCard intentId="01TEST00000000000000INTENT" audience="guardian" />);
    await waitFor(() => expect(screen.getByTestId("ai-advisor")).toBeInTheDocument());
    expect(screen.queryByTestId("intent-signals")).toBeNull();
  });

  it("🔴 chủ ví dưới ngưỡng → KHÔNG render gì và KHÔNG gọi /explain (đỡ tiền API)", async () => {
    mockedGet.mockResolvedValue({
      data: signals({ requiresGuardian: false, policyOutcome: "direct" }),
    });
    renderWithQuery(<AiAdvisorCard intentId="01TEST00000000000000INTENT" audience="owner" />);
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(screen.queryByTestId("ai-advisor")).toBeNull();
    expect(screen.queryByTestId("intent-signals")).toBeNull();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
