import {
  type EventSourceMessage,
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { useEffect, useRef } from "react";
import { notifyUnauthorized } from "./api-client";

export type ServerEvent = {
  id?: string;
  event: string;
  data: string;
};

/** Lifecycle of the SSE connection, surfaced to the UI. */
export type SseStatus = "connecting" | "open" | "reconnecting" | "closed";

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Exponential backoff with jitter, capped. Pure so it's unit-testable:
 *   attempt n → delay in [min(cap, base·2ⁿ) / 2, min(cap, base·2ⁿ)].
 * The half-range jitter avoids reconnect stampedes when many clients drop at once.
 */
export function nextBackoff(
  attempt: number,
  baseMs: number = BASE_BACKOFF_MS,
  capMs: number = MAX_BACKOFF_MS,
): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  const jittered = ceiling * (0.5 + Math.random() * 0.5);
  return Math.round(Math.min(capMs, jittered));
}

/**
 * 401 (session gone) / 403 (forbidden) are fatal — reconnecting can't fix them,
 * so stop and treat it as "session expired". Everything else (network, 5xx,
 * timeouts) is retriable.
 */
export function isFatalStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export type UseServerEventsOptions = {
  /** BE origin (each app passes its own env.VITE_API_URL via a thin wrapper). */
  baseUrl: string;
  /** SSE endpoint on the BE. Default `/api/events`. */
  path?: string;
  /** Pause the connection (e.g. while unauthenticated). Default true. */
  enabled?: boolean;
  /** Fired each time the stream opens successfully (initial connect + every reconnect). */
  onOpen?: () => void;
  /** Fired before a backoff retry, when the stream dropped for a retriable reason. */
  onReconnecting?: () => void;
  /** Fired once when the stream is closed for good (fatal 401/403, won't reconnect). */
  onClosed?: (reason: "fatal") => void;
  /** Fired for every event message. */
  onEvent?: (event: ServerEvent) => void;
  /**
   * Fired when the stream re-opens after a drop. The BE channel is
   * **at-most-once** — events emitted while we were disconnected are GONE — so
   * use this to invalidate/refetch the relevant TanStack queries (refetch-bù).
   */
  onReconnect?: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Subscribe to the BE SSE channel (`sse:user:{id}`) over a credentialed
 * connection. `@microsoft/fetch-event-source` is used (not native EventSource)
 * because it sends cookies (`credentials: "include"`), tracks `Last-Event-ID`
 * across reconnects automatically, and lets us control retry/backoff.
 *
 * Reconnect policy:
 *  - server closes the stream cleanly → throw in `onclose` so it reconnects.
 *  - retriable error (network, 5xx) → `onerror` returns a backoff delay.
 *  - fatal (401/403) → abort + run the shared "session expired" handler; no retry.
 */
export function useServerEvents(options: UseServerEventsOptions): void {
  const { baseUrl, path = "/api/events", enabled = true } = options;

  // Keep callbacks in a ref so the effect doesn't reconnect when they change.
  const handlers = useRef(options);
  handlers.current = options;

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let attempt = 0;
    let recoveringFromDrop = false;

    void fetchEventSource(`${baseUrl}${path}`, {
      signal: controller.signal,
      credentials: "include",
      // Keep the stream alive in background tabs (BE heartbeat ~20s).
      openWhenHidden: true,
      onopen: async (res) => {
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType?.includes(EventStreamContentType)) {
          attempt = 0; // healthy open → reset backoff
          handlers.current.onOpen?.();
          if (recoveringFromDrop) {
            recoveringFromDrop = false;
            handlers.current.onReconnect?.();
          }
          return;
        }
        if (isFatalStatus(res.status)) {
          controller.abort(); // stop fetchEventSource from retrying
          handlers.current.onClosed?.("fatal");
          notifyUnauthorized(); // same "session expired → /login" path as the interceptor
          throw new Error(`SSE fatal (${res.status})`);
        }
        // Retriable open failure (5xx, wrong content-type, …) → reconnect via onerror.
        recoveringFromDrop = true;
        throw new Error(`SSE open failed (${res.status})`);
      },
      onmessage: (msg: EventSourceMessage) => {
        handlers.current.onEvent?.({
          id: msg.id,
          event: msg.event || "message",
          data: msg.data,
        });
      },
      onclose: () => {
        // Server ended the stream cleanly. Throw so it's treated as a drop and
        // reconnected (returning normally would resolve and stop forever).
        recoveringFromDrop = true;
        throw new Error("SSE closed by server");
      },
      onerror: (err) => {
        // Fatal cases already aborted in onopen; reaching here means retriable.
        recoveringFromDrop = true;
        handlers.current.onReconnecting?.();
        handlers.current.onError?.(err);
        const delay = nextBackoff(attempt);
        attempt += 1;
        return delay; // number = retry after delay; throwing would stop retrying
      },
    }).catch((err) => {
      if (!controller.signal.aborted) handlers.current.onError?.(err);
    });

    return () => controller.abort();
  }, [enabled, path, baseUrl]);
}
