import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, HomeIcon } from "./icons";

type FlowDestination =
  | "/welcome"
  | "/get-started"
  | "/passkey"
  | "/recovery"
  | "/setup"
  | "/setup/choose-guardians"
  | "/setup/threshold"
  | "/setup/timelock"
  | "/wallet"
  | "/guardians"
  | "/night-watch"
  | "/block"
  | "/inheritance"
  | "/guardian";

type HomeLabel = "nav.walletHome" | "nav.publicHome";

export type FlowNavigationConfig = {
  backTo?: FlowDestination;
  homeTo: FlowDestination;
  homeLabel: HomeLabel;
};

const FLOW_NAVIGATION: Readonly<Record<string, FlowNavigationConfig>> = {
  "/get-started": publicHome(),
  "/passkey": publicHome("/get-started"),
  "/recovery": publicHome(),
  "/recovery/find-wallet": publicHome("/recovery"),
  "/recovery/sent": publicHome("/recovery"),
  "/recovery/progress": publicHome("/recovery"),
  // Countdown keeps the address in route-local navigation. The global escape
  // deliberately goes to a stable destination instead of dropping search state.
  "/recovery/countdown": publicHome(),
  "/recovery/done": publicHome(),
  "/setup": walletHome(),
  "/setup/assistant": walletHome("/setup"),
  "/setup/choose-guardians": walletHome("/setup"),
  "/setup/invite": walletHome("/setup/choose-guardians"),
  "/setup/threshold": walletHome("/setup/choose-guardians"),
  "/setup/timelock": walletHome("/setup/threshold"),
  "/setup/review": walletHome("/setup/timelock"),
  "/setup/done": walletHome(),
  "/wallet/send": walletHome(),
  "/wallet/receive": walletHome(),
  "/night-watch/alert": walletHome("/night-watch"),
  "/night-watch/resolve": walletHome("/night-watch"),
  "/night-watch/waiting": walletHome("/night-watch"),
  "/night-watch/guardian-view": walletHome("/night-watch"),
  "/block": walletHome("/night-watch"),
  "/block/confirm": walletHome("/block"),
  "/block/done": walletHome("/night-watch"),
  "/inheritance/heartbeat": walletHome("/inheritance"),
  "/inheritance/claim": walletHome("/inheritance"),
  "/guardian": walletHome(),
  "/guardian/approve": walletHome("/guardian"),
  "/guardian/approve-intent": walletHome("/guardian"),
  "/guardian/approve-warning": walletHome("/guardian"),
  "/guardian/approved": walletHome("/guardian"),
  "/guardian/initiate": walletHome("/guardian"),
  "/guardian/accept": publicHome(),
};

function publicHome(backTo?: FlowDestination): FlowNavigationConfig {
  return {
    ...(backTo ? { backTo } : {}),
    homeTo: "/welcome",
    homeLabel: "nav.publicHome",
  };
}

function walletHome(backTo?: FlowDestination): FlowNavigationConfig {
  return {
    ...(backTo ? { backTo } : {}),
    homeTo: "/wallet",
    homeLabel: "nav.walletHome",
  };
}

export function getFlowNavigation(pathname: string): FlowNavigationConfig | undefined {
  if (pathname.startsWith("/guardians/")) {
    return walletHome("/guardians");
  }
  return FLOW_NAVIGATION[pathname];
}

export function FlowNavigation({ backTo, homeTo, homeLabel }: FlowNavigationConfig) {
  const { t } = useTranslation("common");
  const showBack = backTo !== undefined && backTo !== homeTo;

  return (
    <nav className="product-shell__flow-navigation" aria-label={t("nav.flow")}>
      {showBack ? (
        <Link to={backTo} className="product-shell__flow-link">
          <ArrowLeftIcon size={20} />
          <span>{t("nav.back")}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      <Link to={homeTo} className="product-shell__flow-link product-shell__flow-link--home">
        <HomeIcon size={20} />
        <span>{t(homeLabel)}</span>
      </Link>
    </nav>
  );
}
