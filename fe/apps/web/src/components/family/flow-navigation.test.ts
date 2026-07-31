import { describe, expect, it } from "vitest";
import { getFlowNavigation } from "./flow-navigation";

const FLOW_ROUTES = [
  "/get-started",
  "/passkey",
  "/recovery",
  "/recovery/find-wallet",
  "/recovery/sent",
  "/recovery/progress",
  "/recovery/countdown",
  "/recovery/done",
  "/setup",
  "/setup/assistant",
  "/setup/choose-guardians",
  "/setup/invite",
  "/setup/threshold",
  "/setup/timelock",
  "/setup/review",
  "/setup/done",
  "/wallet/send",
  "/wallet/receive",
  "/guardians/g1",
  "/night-watch/alert",
  "/night-watch/resolve",
  "/night-watch/waiting",
  "/night-watch/guardian-view",
  "/guardian",
  "/guardian/approve",
  "/guardian/approve-intent",
  "/guardian/approve-warning",
  "/guardian/approved",
  "/guardian/accept",
  "/guardian/initiate",
  "/block",
  "/block/confirm",
  "/block/done",
  "/inheritance/heartbeat",
  "/inheritance/claim",
] as const;

describe("flow navigation", () => {
  it.each(FLOW_ROUTES)("%s has a deterministic escape that does not loop", (pathname) => {
    const navigation = getFlowNavigation(pathname);

    expect(navigation).toBeDefined();
    expect(navigation?.homeTo).not.toBe(pathname);
    expect(navigation?.backTo).not.toBe(pathname);
  });

  it.each([
    "/wallet",
    "/wallet/history",
    "/guardians",
    "/night-watch",
    "/settings",
  ])("%s stays on primary tab navigation", (pathname) => {
    expect(getFlowNavigation(pathname)).toBeUndefined();
  });
});
