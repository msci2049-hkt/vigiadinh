// Lô R6 nhóm B — banner "có người đang xin chuyển ví của bạn".
//
// Ca quan trọng nhất ở đây là ca CUỐI: chain không đọc được thì banner KHÔNG
// được im lặng. Im lặng ở màn này đọc y hệt "không có ai xin chuyển ví" — đúng
// cái fail-open mà cả đường chain-truth sinh ra để tránh (BE thà trả 502 còn hơn
// trả "an toàn" sai). Các ca trước chỉ là khung.
//
// `Link` được mock thành <a>: thứ cần đo ở đây là banner NÓI GÌ và có lối đi hay
// không, còn việc router nối `/block` đã có flow-navigation.test khoá riêng.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-to={to}>
      {children}
    </a>
  ),
}));

import i18n from "@/lib/i18n";
import type { ChainTruth } from "../api/recovery";
import { RecoveryAlert } from "./recovery-alert";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

const COOLDOWN = { active: false, activeUntil: null, cooldownSecs: 0 };

function truth(request: ChainTruth["request"]): ChainTruth {
  return { registered: true, config: null, request, cooldown: COOLDOWN };
}

describe("RecoveryAlert", () => {
  it("có yêu cầu đang mở → banner + lối sang màn chặn", () => {
    render(
      <RecoveryAlert
        chain={truth({
          status: "approved",
          approvals: ["G1", "G2"],
          startedAt: 0,
          timelockRemainingSecs: 3600 * 5,
        })}
        isError={false}
      />,
    );
    expect(screen.getByTestId("recovery-alert")).toBeTruthy();
    const cta = screen.getByText(i18n.t("fw:recoveryAlert.cta"));
    expect(cta.closest("a")?.getAttribute("data-to")).toBe("/block");
  });

  it("không có yêu cầu nào đang mở → KHÔNG banner", () => {
    const { container } = render(<RecoveryAlert chain={truth(null)} isError={false} />);
    expect(container.querySelector('[data-testid="recovery-alert"]')).toBeNull();
    expect(container.querySelector('[data-testid="recovery-alert-unknown"]')).toBeNull();
  });

  it("yêu cầu đã ĐÓNG trên chain (cancelled/finalized) → KHÔNG banner", () => {
    const { container } = render(
      <RecoveryAlert
        chain={truth({
          status: "cancelled",
          approvals: [],
          startedAt: 0,
          timelockRemainingSecs: 0,
        })}
        isError={false}
      />,
    );
    expect(container.querySelector('[data-testid="recovery-alert"]')).toBeNull();
  });

  it("chain KHÔNG đọc được → nói là đang mù, TUYỆT ĐỐI không im lặng", () => {
    const { container } = render(<RecoveryAlert chain={undefined} isError={true} />);
    expect(screen.getByTestId("recovery-alert-unknown")).toBeTruthy();
    // Và phải nói rõ "đây KHÔNG phải là đã an toàn", không chỉ là một dòng xám.
    expect(container.textContent).toContain(i18n.t("fw:recoveryAlert.unknownBody"));
  });

  it("đang tải lần đầu → chưa kết luận gì (không banner, không 'an toàn')", () => {
    const { container } = render(
      <RecoveryAlert chain={undefined} isError={false} isLoading={true} />,
    );
    expect(container.querySelector('[data-testid="recovery-alert"]')).toBeNull();
    expect(container.querySelector('[data-testid="recovery-alert-unknown"]')).toBeNull();
  });
});
