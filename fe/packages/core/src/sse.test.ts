import { renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the SSE transport so no real network connection is opened.
const { fetchEventSourceMock } = vi.hoisted(() => ({
  fetchEventSourceMock: vi.fn(() => new Promise<void>(() => {})),
}));
vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: fetchEventSourceMock,
  EventStreamContentType: "text/event-stream",
}));

import { isFatalStatus, nextBackoff, useServerEvents } from "./sse";

const BASE_URL = "http://be.test";

afterEach(() => {
  fetchEventSourceMock.mockClear();
});

describe("nextBackoff", () => {
  it("grows exponentially, always within the jittered [ceiling/2, ceiling] band", () => {
    const cases: ReadonlyArray<readonly [number, number, number]> = [
      [0, 500, 1000],
      [1, 1000, 2000],
      [2, 2000, 4000],
      [3, 4000, 8000],
    ];
    for (const [attempt, lo, hi] of cases) {
      for (let i = 0; i < 50; i++) {
        const d = nextBackoff(attempt);
        expect(d).toBeGreaterThanOrEqual(lo);
        expect(d).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("caps at ~30s for large attempts (no unbounded growth)", () => {
    for (let i = 0; i < 50; i++) {
      const d = nextBackoff(20);
      expect(d).toBeLessThanOrEqual(30_000);
      expect(d).toBeGreaterThanOrEqual(15_000); // jitter floor of the cap
    }
  });

  it("clamps negative attempts to 0", () => {
    const d = nextBackoff(-5);
    expect(d).toBeGreaterThanOrEqual(500);
    expect(d).toBeLessThanOrEqual(1000);
  });
});

describe("isFatalStatus", () => {
  it("401 and 403 are fatal (stop reconnecting)", () => {
    expect(isFatalStatus(401)).toBe(true);
    expect(isFatalStatus(403)).toBe(true);
  });

  it("network/5xx/others are retriable", () => {
    for (const s of [0, 200, 408, 429, 500, 502, 503, 504]) {
      expect(isFatalStatus(s)).toBe(false);
    }
  });
});

describe("useServerEvents lifecycle", () => {
  function liveSignals() {
    const calls = fetchEventSourceMock.mock.calls as unknown as ReadonlyArray<
      [string, { signal: AbortSignal }]
    >;
    return calls.filter((c) => !c[1].signal.aborted);
  }

  it("keeps exactly one live connection under StrictMode and aborts on cleanup", () => {
    const { unmount } = renderHook(() => useServerEvents({ baseUrl: BASE_URL, enabled: true }), {
      wrapper: StrictMode,
    });

    // StrictMode may mount→cleanup→mount, but only ONE connection stays live.
    expect(fetchEventSourceMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(liveSignals()).toHaveLength(1);

    unmount();
    expect(liveSignals()).toHaveLength(0);
  });

  it("does not connect while disabled", () => {
    renderHook(() => useServerEvents({ baseUrl: BASE_URL, enabled: false }));
    expect(fetchEventSourceMock).not.toHaveBeenCalled();
  });
});
