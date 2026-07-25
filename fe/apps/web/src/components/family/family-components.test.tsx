import { Button } from "@repo/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BiometricGate } from "./biometric-gate";
import { ErrorBanner } from "./error-banner";
import { DEMO_GUARDIANS, GuardianAvatarCluster } from "./guardian-avatar-cluster";
import { Icon } from "./icon";
import { DetailRow, IconDisc, PrimaryZone, ProductScreen, ScreenHeader } from "./screen";
import { Sheet } from "./sheet";
import { StatusPill } from "./status-pill";
import { TimelockCountdown } from "./timelock-countdown";

describe("FamilyWallet design system", () => {
  it("renders the fixed icon map without exposing decorative icons", () => {
    const { container } = render(<Icon name="shieldCheck" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the product screen, header, primary zone, icon disc and detail row", () => {
    render(
      <ProductScreen>
        <IconDisc>
          <Icon name="lock" />
        </IconDisc>
        <ScreenHeader title="Family wallet" description="Protected together." />
        <DetailRow label="Network">Testnet</DetailRow>
        <PrimaryZone>
          <button type="button">Continue</button>
        </PrimaryZone>
      </ProductScreen>,
    );

    expect(screen.getByRole("heading", { name: "Family wallet" })).toBeInTheDocument();
    expect(screen.getByText("Protected together.")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });

  it("renders every status treatment", () => {
    const states = ["active", "slow", "offline", "pending"] as const;
    render(
      <div>
        {states.map((state) => (
          <StatusPill key={state} state={state}>
            {state}
          </StatusPill>
        ))}
      </div>,
    );

    for (const state of states) expect(screen.getByText(state)).toBeInTheDocument();
  });

  it("renders semantic banners and their details", () => {
    render(
      <ErrorBanner type="warn" title="Check first">
        Call your family member.
      </ErrorBanner>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Call your family member.");
  });

  it("renders a localized countdown with an absolute deadline", () => {
    render(
      <TimelockCountdown countdown="23:59:59" absolute="26 Jul, 20:00" label="Safety window" />,
    );
    expect(screen.getByText("23:59:59")).toHaveClass("money-amount");
    expect(screen.getByText("26 Jul, 20:00")).toBeInTheDocument();
  });

  it("renders generated guardian portraits and an empty fallback", () => {
    const { rerender } = render(<GuardianAvatarCluster people={DEMO_GUARDIANS} />);
    expect(screen.getAllByRole("img")).toHaveLength(3);

    rerender(<GuardianAvatarCluster emptyLabel="Invite family" />);
    expect(screen.getByText("Invite family")).toBeInTheDocument();
  });

  it("renders a biometric gate and invokes the supplied action", () => {
    const onClick = vi.fn();
    render(<BiometricGate label="Unlock" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows and hides the biometric sheet", () => {
    const { rerender } = render(
      <Sheet title="Confirm with fingerprint">Nothing is sent before confirmation.</Sheet>,
    );
    expect(screen.getByRole("heading", { name: "Confirm with fingerprint" })).toBeInTheDocument();

    rerender(
      <Sheet title="Confirm with fingerprint" visible={false}>
        Nothing is sent before confirmation.
      </Sheet>,
    );
    expect(screen.queryByRole("heading", { name: "Confirm with fingerprint" })).toBeNull();
  });

  it("renders all button variants plus loading and disabled states", () => {
    render(
      <>
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        <Button loading>Loading action</Button>
        <Button disabled>Unavailable action</Button>
      </>,
    );

    for (const variant of ["primary", "secondary", "ghost", "danger"]) {
      expect(screen.getByRole("button", { name: variant })).toHaveAttribute(
        "data-variant",
        variant,
      );
    }
    expect(screen.getByRole("button", { name: "Loading action" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unavailable action" })).toBeDisabled();
  });
});
