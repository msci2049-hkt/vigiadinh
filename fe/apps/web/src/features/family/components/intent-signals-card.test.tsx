// Lô R2 — khối số liệu thô là FALLBACK THẬT của cả tính năng: AI tắt thì nó vẫn
// đứng. Test khoá 3 điều: render đủ 3 dòng số, gác đúng khán giả (chủ ví dưới
// ngưỡng KHÔNG thấy — chống mệt mỏi cảnh báo), và thập phân theo locale.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import type { IntentSignals } from "../api/intent-signals";
import { IntentSignalsBlock } from "./intent-signals-card";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

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

describe("IntentSignalsBlock", () => {
  it("guardian: đủ 3 dòng — tỉ lệ (thập phân vi '3,0'), địa chỉ lạ, velocity — và câu chốt không-lấy-lại-được", async () => {
    await i18n.changeLanguage("vi");
    render(<IntentSignalsBlock signals={signals()} audience="guardian" />);
    const block = screen.getByTestId("intent-signals");
    expect(block).toHaveTextContent("Gấp 3,0 lần");
    expect(block).toHaveTextContent("lần đầu ví gửi tới");
    expect(block).toHaveTextContent("1 giờ qua: 3 lệnh gửi");
    expect(block).toHaveTextContent("Tiền đi rồi không lấy lại được.");
  });

  it("en: thập phân theo locale — '3.0', không phải '3,0' (§5.5)", async () => {
    await i18n.changeLanguage("en");
    render(<IntentSignalsBlock signals={signals()} audience="guardian" />);
    expect(screen.getByTestId("intent-signals")).toHaveTextContent("About 3.0 times");
    await i18n.changeLanguage("vi");
  });

  it("ratioToAvg null (ví mới) → KHÔNG có dòng tỉ lệ, hai dòng còn lại vẫn đủ", () => {
    render(<IntentSignalsBlock signals={signals({ ratioToAvg: null })} audience="guardian" />);
    const block = screen.getByTestId("intent-signals");
    expect(block).not.toHaveTextContent("Gấp");
    expect(block).toHaveTextContent("lần đầu ví gửi tới");
    expect(block).toHaveTextContent("1 giờ qua");
  });

  it("địa chỉ đã gửi 2 lần → nói số lần, không nói 'lần đầu'", () => {
    render(
      <IntentSignalsBlock signals={signals({ recipientSettledCount: 2 })} audience="guardian" />,
    );
    const block = screen.getByTestId("intent-signals");
    expect(block).toHaveTextContent("đã gửi thành công 2 lần");
    expect(block).not.toHaveTextContent("lần đầu");
  });

  it("🔴 chủ ví + requiresGuardian=false → KHÔNG render gì (chống mệt mỏi cảnh báo)", () => {
    render(
      <IntentSignalsBlock
        signals={signals({ requiresGuardian: false, policyOutcome: "direct" })}
        audience="owner"
      />,
    );
    expect(screen.queryByTestId("intent-signals")).toBeNull();
  });

  it("guardian thì LUÔN hiện, kể cả requiresGuardian=false — guardian đang quyết tiền người khác", () => {
    render(
      <IntentSignalsBlock
        signals={signals({ requiresGuardian: false, policyOutcome: "direct" })}
        audience="guardian"
      />,
    );
    expect(screen.getByTestId("intent-signals")).toBeInTheDocument();
  });

  it("chủ ví (trên ngưỡng): câu chốt là 'cần người thân xác nhận', KHÔNG phải câu dọa mất tiền", () => {
    render(<IntentSignalsBlock signals={signals()} audience="owner" />);
    const block = screen.getByTestId("intent-signals");
    expect(block).toHaveTextContent("Lệnh này sẽ cần một người thân xác nhận.");
    expect(block).not.toHaveTextContent("không lấy lại được");
  });
});
