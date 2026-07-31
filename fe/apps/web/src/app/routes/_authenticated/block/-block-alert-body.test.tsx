// Lô R7 nhóm A — bốn trạng thái của màn chặn phải nói BỐN câu khác nhau.
//
// Ca đắt nhất là ca chain KHÔNG ĐỌC ĐƯỢC: nếu màn này lỡ nói "an toàn" hay
// "không có gì" trong lúc mù, chủ ví đóng tab đi ngủ trong khi có người đang
// chiếm ví. Thà nói "chưa kiểm tra được" còn hơn nói sai.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
}));

import type { ChainTruth, RecoveryRequest } from "@/features/family/api/recovery";
import i18n from "@/lib/i18n";
import { BlockAlertBody, type ChainState } from "./-block-alert-body";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

const COOLDOWN = { active: false, activeUntil: null, cooldownSecs: 0 };

function truth(request: ChainTruth["request"]): ChainTruth {
  return {
    registered: true,
    config: { guardians: [], threshold: 2, timelockSecs: 86_400 },
    request,
    cooldown: COOLDOWN,
  };
}

const OPEN_ONCHAIN = {
  status: "approved" as const,
  approvals: ["G1", "G2"],
  startedAt: 0,
  timelockRemainingSecs: 3600 * 5,
};

function chainState(over: Partial<ChainState> = {}): ChainState {
  return {
    isLoading: false,
    isError: false,
    isSuccess: false,
    isFetching: false,
    data: undefined,
    refetch: vi.fn(),
    ...over,
  };
}

const MIRROR_ROW: RecoveryRequest = {
  id: "01TEST",
  walletId: "01WALLET",
  newOwner: "ab".repeat(28),
  status: "pending",
  riskScore: null,
  approvals: 1,
  threshold: 2,
  txHash: null,
  vetoUntil: new Date(Date.now() + 3600_000).toISOString(),
  startedAt: new Date().toISOString(),
  expiresAt: null,
};

function renderBody(over: {
  chain?: ChainState;
  mirrorOpen?: RecoveryRequest | undefined;
  walletLoading?: boolean;
  walletError?: boolean;
}) {
  return render(
    <BlockAlertBody
      walletLoading={over.walletLoading ?? false}
      walletError={over.walletError ?? false}
      chain={over.chain ?? chainState()}
      mirrorOpen={over.mirrorOpen}
    />,
  );
}

describe("R7 A — /block tách bốn trạng thái", () => {
  it("đang tải → chỉ vòng xoay, KHÔNG câu kết luận nào", () => {
    const { container } = renderBody({ chain: chainState({ isLoading: true }) });
    expect(container.querySelector('[data-testid="block-nothing-open"]')).toBeNull();
    expect(container.querySelector('[data-testid="chain-unreachable"]')).toBeNull();
    expect(container.querySelector('[data-testid="block-open-request"]')).toBeNull();
    expect(screen.queryByText(i18n.t("fw:block.alert.requestClosed"))).toBeNull();
  });

  it("🔴 chain KHÔNG đọc được → 'chưa kiểm tra được' + nút thử lại, CẤM nói an toàn", () => {
    renderBody({ chain: chainState({ isError: true }) });
    expect(screen.getByTestId("chain-unreachable")).toBeTruthy();
    expect(screen.getByText(i18n.t("fw:block.alert.retryCta"))).toBeTruthy();
    // Câu trấn an TUYỆT ĐỐI không được xuất hiện ở đây.
    expect(screen.queryByText(i18n.t("fw:block.alert.requestClosed"))).toBeNull();
  });

  it("A3 — chain nói không có → 'yêu cầu đã đóng hoặc hết hạn', khác hẳn câu lúc mù", () => {
    renderBody({ chain: chainState({ isSuccess: true, data: truth(null) }) });
    expect(screen.getByTestId("block-nothing-open")).toBeTruthy();
    expect(screen.getByText(i18n.t("fw:block.alert.requestClosed"))).toBeTruthy();
    // Ba câu là BA key khác nhau — không tái dùng chữ của nhánh mù.
    expect(screen.queryByText(i18n.t("fw:block.alert.chainDownTitle"))).toBeNull();
  });

  it("chain nói CÓ → phiếu/ngưỡng + mã khoá mới + nút Chặn", () => {
    renderBody({
      chain: chainState({ isSuccess: true, data: truth(OPEN_ONCHAIN) }),
      mirrorOpen: MIRROR_ROW,
    });
    expect(screen.getByTestId("block-open-request")).toBeTruthy();
    expect(
      screen.getByText(i18n.t("fw:block.alert.requestBody", { approvals: 2, threshold: 2 })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        i18n.t("fw:block.alert.fingerprintLabel", { fingerprint: MIRROR_ROW.newOwner }),
      ),
    ).toBeTruthy();
    const cta = screen.getByText(i18n.t("fw:block.alert.cta"));
    expect(cta.closest("a")?.getAttribute("data-to")).toBe("/block/confirm");
  });
});

describe("R7 A3b — banner 'đang cập nhật' không được phá câu kết luận", () => {
  it("🔴 chain ĐÃ CHỐT (isSuccess) + mirror còn dòng ma → KHÔNG banner đang-cập-nhật", () => {
    const { container } = renderBody({
      chain: chainState({ isSuccess: true, data: truth(null) }),
      mirrorOpen: MIRROR_ROW,
    });
    expect(container.querySelector('[data-testid="mirror-out-of-sync"]')).toBeNull();
    // Kết luận đứng MỘT MÌNH.
    expect(screen.getByText(i18n.t("fw:block.alert.requestClosed"))).toBeTruthy();
  });

  it("chain LỖI + mirror nói có → banner đang-cập-nhật VẪN còn (ta thật sự chưa biết)", () => {
    renderBody({ chain: chainState({ isError: true }), mirrorOpen: MIRROR_ROW });
    expect(screen.getByTestId("mirror-out-of-sync")).toBeTruthy();
    expect(screen.getByTestId("chain-unreachable")).toBeTruthy();
  });
});
