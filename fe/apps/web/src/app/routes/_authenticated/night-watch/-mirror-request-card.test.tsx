// Lô R7 nhóm B — CHAIN THẮNG MIRROR ở cửa vào màn chặn.
//
// Ca B4 (chain có, mirror không) không đo được ở đây vì khi mirror trống thì
// thẻ này không tồn tại — đường đó đi qua `<RecoveryAlert>` (đọc thẳng chain) và
// đã có test riêng ở `features/family/components/recovery-alert.test.tsx`. Ca đó
// được khoá lại lần nữa ở cuối file này để lời hứa "chain thắng" không nằm ở hai
// nơi mà không nơi nào kiểm.
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
import { RecoveryAlert } from "@/features/family/components/recovery-alert";
import i18n from "@/lib/i18n";
import { MirrorRequestCard } from "./-mirror-request-card";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

const GHOST: RecoveryRequest = {
  id: "01GHOST",
  walletId: "01WALLET",
  newOwner: "cd".repeat(28),
  status: "pending",
  riskScore: null,
  approvals: 1,
  threshold: 2,
  txHash: null,
  vetoUntil: new Date(Date.now() + 3600_000).toISOString(),
  startedAt: new Date().toISOString(),
  expiresAt: null,
};

const blockCta = () => screen.queryByText(i18n.t("fw:nightWatch.openRecovery.cta"));

describe("R7 B — thẻ mirror bị chain gác", () => {
  it("🔴 B2 — mirror CÓ + chain đã chốt là KHÔNG → không nút chặn, nói 'đã đóng'", () => {
    render(<MirrorRequestCard request={GHOST} chainOpen={false} chainSettled={true} />);
    expect(blockCta()).toBeNull();
    expect(screen.getByTestId("mirror-request-closed")).toBeTruthy();
    expect(screen.getByText(i18n.t("fw:nightWatch.openRecovery.closedBody"))).toBeTruthy();
  });

  it("B3 — mirror CÓ + chain CHƯA chốt (lỗi/đang đọc) → vẫn có nút, kèm 'đang kiểm tra lại'", () => {
    render(<MirrorRequestCard request={GHOST} chainOpen={false} chainSettled={false} />);
    expect(blockCta()).toBeTruthy();
    expect(screen.getByTestId("mirror-rechecking")).toBeTruthy();
    // Chưa đọc được chain thì KHÔNG được khẳng định là đã đóng.
    expect(screen.queryByText(i18n.t("fw:nightWatch.openRecovery.closedBody"))).toBeNull();
  });

  it("mirror CÓ + chain CÓ → nút chặn bình thường, không có ghi chú 'đang kiểm tra lại'", () => {
    const { container } = render(
      <MirrorRequestCard request={GHOST} chainOpen={true} chainSettled={true} />,
    );
    expect(blockCta()?.closest("a")?.getAttribute("data-to")).toBe("/block");
    expect(container.querySelector('[data-testid="mirror-rechecking"]')).toBeNull();
    expect(screen.getByTestId("mirror-request-open")).toBeTruthy();
  });

  it("còn hạn → đồng hồ chạy; chain nói đã đóng → không còn đồng hồ đếm ngược", () => {
    const live = render(<MirrorRequestCard request={GHOST} chainOpen={true} chainSettled={true} />);
    expect(live.container.querySelector('[data-testid="live-countdown"]')).toBeTruthy();
    live.unmount();
    const closed = render(
      <MirrorRequestCard request={GHOST} chainOpen={false} chainSettled={true} />,
    );
    expect(closed.container.querySelector('[data-testid="live-countdown"]')).toBeNull();
  });
});

describe("R7 B4 — chain CÓ + mirror KHÔNG → vẫn phải có nút chặn", () => {
  it("đường chain-truth tự hiện lối chặn, không phụ thuộc mirror", () => {
    const chain: ChainTruth = {
      registered: true,
      config: null,
      request: {
        status: "pending",
        approvals: ["G1"],
        startedAt: 0,
        timelockRemainingSecs: 7200,
      },
      cooldown: { active: false, activeUntil: null, cooldownSecs: 0 },
    };
    render(<RecoveryAlert chain={chain} isError={false} />);
    const cta = screen.getByText(i18n.t("fw:recoveryAlert.cta"));
    expect(cta.closest("a")?.getAttribute("data-to")).toBe("/block");
  });
});
